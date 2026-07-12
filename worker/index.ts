/**
 * Memory Palace Cloudflare Worker — single AI orchestration surface.
 *
 * Endpoints:
 *   GET  /healthz                  — liveness + provider config sanity
 *   GET  /api/auth/steam/login     — redirect to Steam OpenID checkid_setup
 *   GET  /api/auth/steam/return    — verify Steam OpenID response, set cookie
 *   POST /api/auth/steamticket     — verify Steamworks AuthSessionTicket from
 *                                    desktop wrapper, mint same ll_session cookie
 *   GET  /api/auth/me              — session check; returns {steamId, persona?}
 *   POST /api/auth/logout          — clear session cookie
 *   GET  /api/library              — authed user's enriched + tagged library + profile
 *   GET  /api/world                — Stage 1 manifest from the session library
 *                                    (?template=... ?force=1; cached 24h)
 *   POST /api/agent/tick           — Tier 1 micro-action call for one agent
 *                                    given its state + perception payload
 *   POST /api/agent/reflect        — Tier 2 reflection (Phase 2D)
 *   POST /api/embed                — local-Ollama embeddings stub (Phase 2D)
 *   GET  /api/local-model          — local-Ollama presence probe (Phase 6A);
 *                                    cloud / no-Ollama → {present:false}
 *   POST /api/bake/sprite          — Phase 3C bake-time proxy to PixelLab.ai
 *                                    pixflux; dev tool only, not user-runtime
 *
 * The frontend never holds an API key. All Anthropic / Ollama / PixelLab /
 * (future) Stable Audio / ElevenLabs traffic terminates here.
 */

import { buildStageOnePrompt } from './lib/prompt';
import { buildTickPrompt, buildReflectPrompt } from './lib/agent-prompt';
import { extractJson, validateManifest } from './lib/manifest';
import {
  callEmbed,
  callStageOne,
  callTier1Agent,
  callTier2Reflect,
  detectLocalModel,
  detectOllamaGpu,
  ProviderError,
  type ProviderEnv,
} from './lib/providers';
import { TEMPLATE_WHITELIST, type TemplateId } from './lib/whitelist';
import { buildSteamLoginUrl, verifySteamReturn } from './lib/steam-openid';
import {
  clearSessionCookieHeader,
  readSessionCookie,
  setSessionCookieHeader,
  signSession,
  verifySession,
  type SessionClaims,
} from './lib/session';
import {
  fetchAchievements,
  fetchOwnedGames,
  fetchPersona,
  fetchRecentlyPlayed,
  SteamError,
  verifyAuthSessionTicket,
  type AchievementsSummary,
  type OwnedGame,
  type Persona,
  type RecentlyPlayedEntry,
} from './lib/steam';
import {
  discoverHltbEndpoint,
  searchHltb,
  HLTB_ENDPOINT_TTL_S,
  HLTB_RESULT_TTL_S,
  type HltbResult,
} from './lib/hltb';
import { buildProfile } from './lib/profile';
import { tagLibrary, type LibraryState } from './lib/state';
import { kvGet } from './lib/cache';

interface Env extends ProviderEnv {
  /** Comma-separated list of allowed origins for CORS. Local dev defaults below. */
  ALLOWED_ORIGINS?: string;
  /** HMAC secret for the session JWT. Required for any /api/auth route. */
  SESSION_SECRET?: string;
  /** User-facing origin (e.g. http://localhost:5183). Used to build the OpenID
   *  return URL and to decide whether the session cookie is Secure. */
  PUBLIC_BASE_URL?: string;
  /** Slice 2: required for /api/library and the persona fetch in /api/auth/me. */
  STEAM_WEB_API_KEY?: string;
  /** Phase 6 slice 2: appid the desktop app's AuthSessionTickets are
   *  generated for. Steam Web API rejects ticket-verify calls where this
   *  doesn't match the ticket. Defaults to SpaceWar (480) for dev. */
  STEAM_APP_ID?: string;
  /** Read-through cache for Steam (slice 2), HLTB (slice 4), IGDB (Phase 3),
   *  and the Stage 1 manifest. See worker/wrangler.toml. */
  CACHE?: KVNamespace;
  /** Phase 3C: PixelLab.ai bearer token for the bake-time sprite generator
   *  proxy (POST /api/bake/sprite). Bake-time only — never hit at user
   *  runtime. Per CLAUDE.md, this key must NEVER be embedded in the
   *  frontend bundle; the bake script reaches PixelLab via this Worker. */
  PIXELLAB_API_KEY?: string;
}

const OWNED_GAMES_TTL_S = 60 * 60;        // 1h, per SPEC §7.1 + PLAN.md task 2
const PERSONA_TTL_S = 60 * 60 * 24;       // 24h — personas barely change
const RECENT_TTL_S = 60 * 30;             // 30min — playtime accrues mid-session
const ACHIEVEMENTS_TTL_S = 60 * 60;       // 1h — unlocks happen mid-session
const MANIFEST_TTL_S = 60 * 60 * 24;      // 24h, per PLAN.md task 1.8

/** Top-N games we'll enrich / surface in the world (PLAN.md Phase 2 task 3). */
const TOP_N = 15;

/** Recency window for the `recent` state tag (SPEC §4). */
const RECENT_WINDOW_S = 60 * 60 * 24 * 7; // 7 days

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5183',
  'http://localhost:5173', // Vite's default, in case strictPort:false fell back
  'http://127.0.0.1:5183',
];

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : DEFAULT_ALLOWED_ORIGINS;
  const allow = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function publicBaseUrl(env: Env): string {
  return (env.PUBLIC_BASE_URL ?? 'http://localhost:5183').replace(/\/$/, '');
}

function cookieIsSecure(base: string): boolean {
  return base.startsWith('https://');
}

function json(body: unknown, init: ResponseInit, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...headers, 'content-type': 'application/json' },
  });
}

async function readSession(req: Request, env: Env): Promise<SessionClaims | null> {
  if (!env.SESSION_SECRET) return null;
  const token = readSessionCookie(req);
  if (!token) return null;
  return verifySession(token, env.SESSION_SECRET);
}

/** Cached persona lookup. Returns null if the key is missing or Steam errors;
 *  callers decide whether that's worth surfacing — for /api/auth/me we just
 *  omit persona so the auth check itself stays fast. */
async function cachedPersona(env: Env, steamId: string): Promise<Persona | null> {
  if (!env.STEAM_WEB_API_KEY) return null;
  const key = env.STEAM_WEB_API_KEY;
  try {
    return await kvGet(env.CACHE, `steam:persona:${steamId}`, PERSONA_TTL_S, () =>
      fetchPersona(steamId, key),
    );
  } catch {
    return null;
  }
}

/** One enriched game row. Top-N games may get `achievements`, `recent`, and
 *  HLTB-derived fields populated; the rest of the library returns the
 *  minimal OwnedGame shape. Each enrichment is independent — none of them
 *  failing should cascade into another. Every game gets a `state` from the
 *  slice-6 tagger. */
interface EnrichedGame extends OwnedGame {
  achievements?: AchievementsSummary;
  recent?: boolean;
  hltb?: HltbResult;
  /** Steam playtime hours ÷ HLTB main-story hours. > 1.0 means past main. */
  completion_fraction?: number;
  /** SPEC §4 library state — loved / recent / mastered / abandoned / dusty
   *  / default. Drives in-world visual treatment at Phase 4 and feeds into
   *  the Stage 1 prompt at slice 7. */
  state?: LibraryState;
}

/** Cached HLTB lookup. Endpoint discovery is cached separately (1h) from the
 *  per-name search result (30d, per SPEC §7.2). Any failure returns null so
 *  one missing game can't break the library load — playtime alone still
 *  drives state tagging in that case. */
async function cachedHltb(env: Env, name: string): Promise<HltbResult | null> {
  const key = `hltb:name:${name.toLowerCase()}`;
  try {
    return await kvGet<HltbResult | null>(env.CACHE, key, HLTB_RESULT_TTL_S, async () => {
      const endpoint = await kvGet<string | null>(
        env.CACHE,
        'hltb:endpoint',
        HLTB_ENDPOINT_TTL_S,
        discoverHltbEndpoint,
      );
      if (!endpoint) return null;
      return searchHltb(name, endpoint);
    });
  } catch {
    return null;
  }
}

/**
 * Slice 3 + slice 4 enrichment for the top-N games. Each enrichment runs in
 * parallel and is allSettled-style — one failure (private achievement stats,
 * HLTB outage, missing recently-played row) never cascades.
 *
 *   - recently_played cross-reference (one call, 30min cache)
 *   - per-appid achievement summary (each 1h cache)
 *   - per-name HLTB lookup (each 30d cache, endpoint discovery 1h cache)
 *
 * Derived signals:
 *   - `recent` from rtime_last_played within 7d OR appid in recently-played
 *   - `completion_fraction` from Steam playtime ÷ HLTB main-story hours
 *     (per SPEC §7.2 — what separates "lived in" from "tutorial abandoned")
 */
async function enrichTopGames(
  env: Env,
  steamId: string,
  apiKey: string,
  top: OwnedGame[],
): Promise<EnrichedGame[]> {
  const nowS = Math.floor(Date.now() / 1000);
  const recentCutoff = nowS - RECENT_WINDOW_S;

  const recentPromise = kvGet<RecentlyPlayedEntry[]>(
    env.CACHE,
    `steam:recent:${steamId}`,
    RECENT_TTL_S,
    () => fetchRecentlyPlayed(steamId, apiKey),
  ).catch((): RecentlyPlayedEntry[] => []);

  const achievementPromises = top.map((game) =>
    kvGet<AchievementsSummary | null>(
      env.CACHE,
      `steam:ach:${steamId}:${game.appid}`,
      ACHIEVEMENTS_TTL_S,
      () => fetchAchievements(steamId, game.appid, apiKey),
    ).catch(() => null),
  );

  const hltbPromises = top.map((game) => cachedHltb(env, game.name));

  const [recent, achievements, hltbs] = await Promise.all([
    recentPromise,
    Promise.all(achievementPromises),
    Promise.all(hltbPromises),
  ]);
  const recentAppids = new Set(recent.map((g) => g.appid));

  return top.map((game, i) => {
    const isRecent =
      recentAppids.has(game.appid) ||
      (typeof game.rtime_last_played === 'number' && game.rtime_last_played >= recentCutoff);
    const ach = achievements[i];
    const hltb = hltbs[i];
    const completionFraction =
      hltb && hltb.mainStoryHours > 0 && game.playtime_forever > 0
        ? Math.round(((game.playtime_forever / 60) / hltb.mainStoryHours) * 100) / 100
        : undefined;
    return {
      ...game,
      ...(ach && { achievements: ach }),
      ...(isRecent && { recent: true }),
      ...(hltb && { hltb }),
      ...(completionFraction !== undefined && { completion_fraction: completionFraction }),
    };
  });
}

/**
 * Shared library-loading pipeline. Both /api/library and /api/world need
 * the full enriched + tagged + profiled view; we run it once and let the
 * routes decide what to do with it. Errors come back as a structured
 * Response rather than thrown, so each route can attach its own cors headers.
 */
interface LibraryBundle {
  steamId: string;
  apiKey: string;
  totalGames: number;
  taggedGames: Array<EnrichedGame & { state: ReturnType<typeof tagLibrary>[number]['state'] }>;
  profile: ReturnType<typeof buildProfile>;
  persona: Persona | null;
}

async function assembleLibrary(
  env: Env,
  req: Request,
  cors: Record<string, string>,
  opts: { force: boolean },
): Promise<{ ok: true; bundle: LibraryBundle } | { ok: false; response: Response }> {
  const claims = await readSession(req, env);
  if (!claims) {
    return { ok: false, response: json({ error: 'unauthenticated' }, { status: 401 }, cors) };
  }
  if (!env.STEAM_WEB_API_KEY) {
    return {
      ok: false,
      response: json({ error: 'STEAM_WEB_API_KEY not configured' }, { status: 500 }, cors),
    };
  }

  const steamId = claims.sub;
  const apiKey = env.STEAM_WEB_API_KEY;

  let games: OwnedGame[];
  try {
    games = await kvGet<OwnedGame[]>(
      env.CACHE,
      `steam:owned:${steamId}`,
      OWNED_GAMES_TTL_S,
      () => fetchOwnedGames(steamId, apiKey),
      { force: opts.force },
    );
  } catch (e) {
    if (e instanceof SteamError) {
      const status = e.reason === 'private_profile' ? 403
        : e.reason === 'unauthorized' ? 502
        : e.reason === 'rate_limited' ? 429
        : 502;
      return {
        ok: false,
        response: json({ error: e.reason, message: e.message }, { status }, cors),
      };
    }
    const message = e instanceof Error ? e.message : 'unknown steam error';
    return {
      ok: false,
      response: json({ error: 'upstream', message }, { status: 502 }, cors),
    };
  }

  const topGames = await enrichTopGames(env, steamId, apiKey, games.slice(0, TOP_N));
  const enrichedGames: EnrichedGame[] = [...topGames, ...games.slice(TOP_N)];
  const taggedGames = tagLibrary(enrichedGames, Math.floor(Date.now() / 1000));
  const profile = buildProfile(taggedGames, TOP_N);
  const persona = await cachedPersona(env, steamId);

  return {
    ok: true,
    bundle: { steamId, apiKey, totalGames: games.length, taggedGames, profile, persona },
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const cors = corsHeaders(env, origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (req.method === 'GET' && url.pathname === '/healthz') {
      // Phase 2F: include Ollama GPU snapshot when running local. Cheap
      // (one /api/ps call against a localhost service) and gives the
      // dev a hard signal that the GPU runtime is wired before the
      // first 27s CPU-only Tier-1 latency.
      const gpu = await detectOllamaGpu(env);
      const allCpu =
        gpu.available && gpu.models && gpu.models.length > 0 &&
        gpu.models.every((m) => !m.onGpu);
      if (allCpu) {
        // eslint-disable-next-line no-console
        console.warn(
          '[healthz] ollama running but all loaded models are CPU-only. ' +
            'Tier-1 latency will be measured in tens of seconds; expect <1s on a 12GB+ GPU.',
        );
      }
      return json(
        {
          ok: true,
          provider: env.LLM_PROVIDER ?? 'anthropic',
          anthropic_configured: Boolean(env.ANTHROPIC_API_KEY),
          steam_configured: Boolean(env.STEAM_WEB_API_KEY),
          session_configured: Boolean(env.SESSION_SECRET),
          ollama_gpu: gpu,
        },
        { status: 200 },
        cors,
      );
    }

    // --- Local-model presence probe (Phase 6A) -------------------------------
    // GET /api/local-model — "Local AI lives in your world" Depth 1. Reports
    // the user's installed/running local Ollama models so the cell renderer
    // can place a presence landmark (cottage for a small model, tower for a
    // large one) that glows when a model is loaded.
    //
    // Local-only by contract, but UNLIKE /api/embed (which 501s on cloud),
    // absence of a local model is a NORMAL state, not an error: cloud /
    // no-Ollama returns 200 {present:false} so the renderer silently shows
    // no landmark. Reads ONLY local model metadata (names/sizes/param class)
    // from localhost — nothing about a model ever egresses to a third party.
    if (req.method === 'GET' && url.pathname === '/api/local-model') {
      const snapshot = await detectLocalModel(env);
      return json(snapshot, { status: 200 }, cors);
    }

    // --- Steam OpenID + session ----------------------------------------------
    // Slice 1 of Phase 2 (SPEC §7.1). The Steam Web API key is NOT needed for
    // the handshake itself; it becomes load-bearing at slice 2.

    if (req.method === 'GET' && url.pathname === '/api/auth/steam/login') {
      const base = publicBaseUrl(env);
      const returnTo = `${base}/api/auth/steam/return`;
      const realm = `${base}/`;
      return Response.redirect(buildSteamLoginUrl(returnTo, realm), 302);
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/steam/return') {
      if (!env.SESSION_SECRET) {
        return json({ error: 'SESSION_SECRET not configured' }, { status: 500 }, cors);
      }
      const result = await verifySteamReturn(url.searchParams);
      if (!result.ok) {
        return json({ error: `steam openid: ${result.reason}` }, { status: 401 }, cors);
      }
      const base = publicBaseUrl(env);
      const token = await signSession(result.steamId, env.SESSION_SECRET);
      return new Response(null, {
        status: 302,
        headers: {
          location: `${base}/`,
          'set-cookie': setSessionCookieHeader(token, cookieIsSecure(base)),
        },
      });
    }

    // Phase 6 slice 2: desktop apps skip OpenID. steamworks.js generates an
    // AuthSessionTicket locally; the renderer POSTs it here; we verify with
    // Steam Web API and mint the same ll_session cookie as the OpenID path.
    if (req.method === 'POST' && url.pathname === '/api/auth/steamticket') {
      if (!env.SESSION_SECRET) {
        return json({ error: 'SESSION_SECRET not configured' }, { status: 500 }, cors);
      }
      if (!env.STEAM_WEB_API_KEY) {
        return json({ error: 'STEAM_WEB_API_KEY not configured' }, { status: 500 }, cors);
      }

      let body: { ticket?: unknown };
      try {
        body = (await req.json()) as { ticket?: unknown };
      } catch {
        return json({ error: 'invalid json body' }, { status: 400 }, cors);
      }
      if (typeof body.ticket !== 'string' || body.ticket.length === 0) {
        return json({ error: 'ticket (hex string) required' }, { status: 400 }, cors);
      }

      const appId = Number(env.STEAM_APP_ID) || 480; // SpaceWar default for dev
      let steamId: string;
      try {
        steamId = await verifyAuthSessionTicket(body.ticket, env.STEAM_WEB_API_KEY, appId);
      } catch (e) {
        if (e instanceof SteamError) {
          const status = e.reason === 'unauthorized' ? 502
            : e.reason === 'rate_limited' ? 429
            : 401;
          return json({ error: e.reason, message: e.message }, { status }, cors);
        }
        const message = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'upstream', message }, { status: 502 }, cors);
      }

      const base = publicBaseUrl(env);
      const token = await signSession(steamId, env.SESSION_SECRET);
      return new Response(JSON.stringify({ authenticated: true, steamId }), {
        status: 200,
        headers: {
          ...cors,
          'content-type': 'application/json',
          'set-cookie': setSessionCookieHeader(token, cookieIsSecure(base)),
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      const claims = await readSession(req, env);
      if (!claims) return json({ authenticated: false }, { status: 200 }, cors);
      const persona = await cachedPersona(env, claims.sub);
      return json(
        { authenticated: true, steamId: claims.sub, ...(persona && { persona }) },
        { status: 200 },
        cors,
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const base = publicBaseUrl(env);
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'set-cookie': clearSessionCookieHeader(cookieIsSecure(base)) },
      });
    }

    // --- Library --------------------------------------------------------------
    // Slices 2–6 of Phase 2. Returns the signed-in user's owned games + the
    // top-N enrichment (achievements / HLTB / state tags) + the aggregate
    // behavioral profile. The pipeline is shared with /api/world; see
    // assembleLibrary().

    if (req.method === 'GET' && url.pathname === '/api/library') {
      const force = url.searchParams.get('force') === '1';
      const result = await assembleLibrary(env, req, cors, { force });
      if (!result.ok) return result.response;
      const { steamId, totalGames, taggedGames, profile, persona } = result.bundle;
      return json(
        {
          steamId,
          ...(persona && { persona }),
          totalGames,
          topN: TOP_N,
          games: taggedGames,
          profile,
        },
        { status: 200 },
        cors,
      );
    }

    // --- World manifest (Stage 1 LLM call) ------------------------------------
    // Slice 7 of Phase 2 (PLAN.md task 7). Reads the session, runs the same
    // assembly pipeline as /api/library, strips top-N games down to
    // {appid, name, state} (PLAN.md task 6: Claude sees state tags, not raw
    // playtime), feeds Stage 1, validates, caches the manifest 24h per
    // (steamid, template). ?force=1 bypasses the manifest cache; lower-level
    // Steam / HLTB caches still apply.

    if (req.method === 'GET' && url.pathname === '/api/world') {
      const force = url.searchParams.get('force') === '1';
      const template = (url.searchParams.get('template') ?? 'seaside_town') as TemplateId;
      if (!(template in TEMPLATE_WHITELIST)) {
        return json({ error: `unknown template "${template}"` }, { status: 400 }, cors);
      }

      const assembled = await assembleLibrary(env, req, cors, { force });
      if (!assembled.ok) return assembled.response;
      const { steamId, taggedGames, profile } = assembled.bundle;

      const topN = taggedGames.slice(0, TOP_N);
      if (topN.length === 0) {
        return json({ error: 'no games to cast' }, { status: 400 }, cors);
      }

      // PLAN.md task 6: Claude only ever sees the tagged state, never the raw
      // playtime numbers it would have to reinterpret. 'default' carries no
      // signal worth mentioning — drop it to undefined so the prompt skips
      // the tag entirely for those games.
      const promptGames = topN.map((g) => ({
        appid: g.appid,
        name: g.name,
        ...(g.state !== 'default' && { state: g.state }),
      }));
      const allowedAppids = new Set(promptGames.map((g) => g.appid));

      // Phase 5 slice 2 bumped the schema (no `position`). Cache key tag
      // `v2` orphans pre-Phase-5 entries — they expire on their original TTL.
      const cacheKey = `manifest:v2:${steamId}:${template}`;
      let parsed: unknown;
      try {
        parsed = await kvGet<unknown>(
          env.CACHE,
          cacheKey,
          MANIFEST_TTL_S,
          async () => {
            const { system, user } = buildStageOnePrompt({
              template,
              profile: { summary: profile.summary },
              games: promptGames,
            });
            const text = await callStageOne(env, system, user);
            return JSON.parse(extractJson(text)) as unknown;
          },
          { force },
        );
      } catch (e) {
        if (e instanceof ProviderError) {
          return json({ error: e.message }, { status: e.status }, cors);
        }
        if (e instanceof SyntaxError) {
          return json({ error: 'model returned invalid json' }, { status: 502 }, cors);
        }
        const message = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'stage1', message }, { status: 502 }, cors);
      }

      const result = validateManifest(template, allowedAppids, parsed);
      if (!result.ok) {
        return json(
          { error: `manifest validation failed: ${result.reason}`, raw: parsed },
          { status: 502 },
          cors,
        );
      }
      return json(result.manifest, { status: 200 }, cors);
    }

    // --- Tier 1 agent micro-action (Phase 0 spike) ---------------------------
    // POST /api/agent/tick — given an agent snapshot + perception payload,
    // ask the Tier 1 model for the next short action. Hello-world for the
    // agent runtime that lands properly in Phase 2; this endpoint exists in
    // Phase 0 just to prove the renderer → worker → Ollama (or Anthropic
    // Haiku) → renderer loop completes end-to-end.
    if (req.method === 'POST' && url.pathname === '/api/agent/tick') {
      let body: {
        agent?: unknown;
        perception?: unknown;
        context?: {
          recentMemories?: ReadonlyArray<{
            text: string;
            kind: string;
            created_at: number;
            importance: number;
          }>;
          persona?: { name: string; system_prompt: string } | null;
          reprompt?: boolean;
          denyVerbs?: readonly string[];
          /** Agent-mind pass — capped library-context line (Task 3);
           *  flows structurally into buildTickPrompt's context.library. */
          library?: string;
        };
      };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: 'invalid json body' }, { status: 400 }, cors);
      }
      if (!body.agent || !body.perception) {
        return json({ error: 'agent + perception required' }, { status: 400 }, cors);
      }

      // Agent-mind pass: assembly delegated to lib/agent-prompt.ts —
      // house rules + persona-as-character + task, context rendered as
      // legible lines (not JSON blobs). Back-compat: Phase-0 callers
      // omitting `context` get house rules + task only.
      const { system, user: userPrompt } = buildTickPrompt({
        agent: (body.agent ?? {}) as { id?: string; name?: string },
        perception: (body.perception ?? {}) as {
          scene?: string;
          saw?: string[];
          lastAction?: string;
        },
        context: body.context,
      });

      const startedAt = Date.now();
      let result: { text: string; model: string; provider: string; tokensIn: number; tokensOut: number };
      try {
        result = await callTier1Agent(env, system, userPrompt);
      } catch (e) {
        if (e instanceof ProviderError) {
          return json({ error: e.message }, { status: e.status }, cors);
        }
        const message = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'tier1', message }, { status: 502 }, cors);
      }
      const latencyMs = Date.now() - startedAt;

      // Anthropic models often wrap JSON in ```json…``` fences despite the
      // "JSON only" instruction. extractJson() handles fenced + bare output;
      // Ollama's format:'json' mode usually produces bare JSON already.
      let parsed: { action?: unknown; intent?: unknown };
      try {
        parsed = JSON.parse(extractJson(result.text)) as { action?: unknown; intent?: unknown };
      } catch {
        return json(
          { error: 'tier1 returned invalid json', raw: result.text.slice(0, 400) },
          { status: 502 },
          cors,
        );
      }
      if (typeof parsed.action !== 'string' || typeof parsed.intent !== 'string') {
        return json(
          { error: 'tier1 missing action/intent', raw: parsed },
          { status: 502 },
          cors,
        );
      }
      return json(
        {
          action: parsed.action,
          intent: parsed.intent,
          model: result.model,
          provider: result.provider,
          latencyMs,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
        { status: 200 },
        cors,
      );
    }

    // --- Tier 2 reflection (Phase 2D slice 2D.2) -----------------------------
    // POST /api/agent/reflect — given an agent + recent memories + persona,
    // ask the Tier 2 model to synthesise a one-sentence reflection plus the
    // memory ids it drew from. Renderer writes the resulting Reflection +
    // optional Plan into the SQLite memory store. Fires from the router only
    // when reflectionCounter crosses Smallville's threshold (150 by default,
    // tuneable in router.ts).
    if (req.method === 'POST' && url.pathname === '/api/agent/reflect') {
      let body: {
        agent?: { id?: string; name?: string };
        recentMemories?: ReadonlyArray<{
          id: string;
          text: string;
          kind: string;
          importance: number;
          created_at: number;
        }>;
        persona?: { name: string; system_prompt: string } | null;
        recentLore?: ReadonlyArray<{ text: string; source: string }>;
        loreContext?: { themes?: string[]; tone?: string };
      };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: 'invalid json body' }, { status: 400 }, cors);
      }
      if (!body.agent || !body.recentMemories || body.recentMemories.length === 0) {
        return json(
          { error: 'agent + recentMemories (non-empty) required' },
          { status: 400 },
          cors,
        );
      }

      // Agent-mind pass: assembly delegated to lib/agent-prompt.ts.
      // `roomDims` arrives from the router when the caller knows its
      // layout (Task 5); absent → the builder's 24×16 fallback keeps
      // pre-pass callers byte-compatible. `library` is the capped
      // library-context line (Task 3).
      const { system, user: userPrompt } = buildReflectPrompt({
        agent: body.agent as { id?: string; name?: string },
        recentMemories: body.recentMemories,
        persona: body.persona,
        recentLore: body.recentLore,
        loreContext: body.loreContext,
        library: (body as { library?: string }).library,
        roomDims: (body as { roomDims?: { width: number; height: number } }).roomDims,
      });

      const startedAt = Date.now();
      let result: { text: string; model: string; provider: string; tokensIn: number; tokensOut: number };
      try {
        result = await callTier2Reflect(env, system, userPrompt);
      } catch (e) {
        if (e instanceof ProviderError) {
          return json({ error: e.message }, { status: e.status }, cors);
        }
        const message = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'tier2', message }, { status: 502 }, cors);
      }
      const latencyMs = Date.now() - startedAt;

      let parsed: {
        reflection?: unknown;
        synthesised_from?: unknown;
        themes?: unknown;
        importance?: unknown;
        plan?: unknown;
      };
      try {
        parsed = JSON.parse(extractJson(result.text)) as typeof parsed;
      } catch {
        return json(
          { error: 'tier2 returned invalid json', raw: result.text.slice(0, 400) },
          { status: 502 },
          cors,
        );
      }
      if (typeof parsed.reflection !== 'string') {
        return json({ error: 'tier2 missing reflection', raw: parsed }, { status: 502 }, cors);
      }
      const synthesised = Array.isArray(parsed.synthesised_from)
        ? parsed.synthesised_from.filter((s): s is string => typeof s === 'string')
        : [];
      const themes = Array.isArray(parsed.themes)
        ? parsed.themes.filter((s): s is string => typeof s === 'string')
        : [];
      const importance =
        typeof parsed.importance === 'number' && parsed.importance >= 1 && parsed.importance <= 10
          ? Math.round(parsed.importance)
          : 7;

      // Phase 5 5A — parse the optional plan. Whitelist verb kinds
      // (the 5 PlanStepKinds the renderer knows about); strip
      // anything out-of-list. Cap to 5 steps to bound Sonnet drift.
      // Clamp location to room bounds (0-23 × 0-15 matches the
      // 24×16 cell room layout). Missing plan / empty steps array
      // → omit the field from the response (caller treats absence as
      // "no plan" — the router doesn't install activePlan).
      const PLAN_VERBS = new Set([
        'move_to', 'inspect', 'place_mark', 'linger', 'withdraw',
      ]);
      const MAX_STEPS = 5;
      const ROOM_W = 24;
      const ROOM_H = 16;
      let plan: { text: string; steps: Array<{ kind: string; target?: string; location?: { x: number; y: number } }> } | undefined;
      const rawPlan = parsed.plan as
        | { text?: unknown; steps?: unknown }
        | undefined;
      if (rawPlan && typeof rawPlan === 'object' && Array.isArray(rawPlan.steps) && rawPlan.steps.length > 0) {
        const cleanedSteps = (rawPlan.steps as unknown[])
          .slice(0, MAX_STEPS)
          .map((s) => {
            if (!s || typeof s !== 'object') return null;
            const step = s as { kind?: unknown; target?: unknown; location?: unknown };
            if (typeof step.kind !== 'string' || !PLAN_VERBS.has(step.kind)) return null;
            const cleaned: { kind: string; target?: string; location?: { x: number; y: number } } = {
              kind: step.kind,
            };
            if (typeof step.target === 'string' && step.target.length > 0) {
              cleaned.target = step.target.slice(0, 80);
            }
            if (
              step.location &&
              typeof step.location === 'object' &&
              typeof (step.location as { x?: unknown }).x === 'number' &&
              typeof (step.location as { y?: unknown }).y === 'number'
            ) {
              const lx = Math.max(0, Math.min(ROOM_W - 1, Math.floor((step.location as { x: number }).x)));
              const ly = Math.max(0, Math.min(ROOM_H - 1, Math.floor((step.location as { y: number }).y)));
              cleaned.location = { x: lx, y: ly };
            }
            return cleaned;
          })
          .filter((s): s is { kind: string; target?: string; location?: { x: number; y: number } } => s !== null);
        if (cleanedSteps.length > 0) {
          const planText = typeof rawPlan.text === 'string' && rawPlan.text.length > 0
            ? rawPlan.text.slice(0, 200)
            : 'plan';
          plan = { text: planText, steps: cleanedSteps };
        }
      }

      return json(
        {
          reflection: parsed.reflection,
          synthesised_from: synthesised,
          themes,
          importance,
          ...(plan && { plan }),
          model: result.model,
          provider: result.provider,
          latencyMs,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
        { status: 200 },
        cors,
      );
    }

    // --- Embedding (Phase 5C slice 5C.1) -------------------------------------
    // POST /api/embed — accepts {texts: string[]} and returns
    // {embeddings: number[][]} (768-dim, nomic-embed-text). **Cloud path is
    // intentionally a 501** (CLAUDE.md privacy contract: lore + memories
    // never leave the machine). Only the local Ollama path is implemented;
    // when LLM_PROVIDER=anthropic the renderer degrades to FTS5-only
    // retrieval.
    if (req.method === 'POST' && url.pathname === '/api/embed') {
      const provider = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
      if (provider !== 'local') {
        return json(
          {
            error: 'embeddings only supported via local Ollama; ' +
              'set LLM_PROVIDER=local. Cloud embeddings would violate the privacy contract.',
          },
          { status: 501 },
          cors,
        );
      }
      // Local-Ollama path (Phase 5C). nomic-embed-text via Ollama; 768-dim
      // vectors land in the renderer's sqlite-vec store. Keep the cloud 501
      // above — embeddings are local-only by privacy contract.
      let body: { texts?: unknown };
      try {
        body = (await req.json()) as { texts?: unknown };
      } catch {
        return json({ error: 'invalid json body' }, { status: 400 }, cors);
      }
      const texts = body.texts;
      if (
        !Array.isArray(texts) ||
        texts.length === 0 ||
        !texts.every((t) => typeof t === 'string' && t.length > 0)
      ) {
        return json(
          { error: 'body.texts must be a non-empty string[]' },
          { status: 400 },
          cors,
        );
      }
      try {
        const embeddings = await callEmbed(env, texts as string[]);
        return json({ embeddings }, { status: 200 }, cors);
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 502;
        return json({ error: (e as Error).message }, { status }, cors);
      }
    }

    // --- Pixel-art bake (Phase 3C) -------------------------------------------
    // POST /api/bake/sprite — proxies one create-image-pixflux call to
    // PixelLab.ai. Bake-time only: scripts/bake-sprites.mts loops this N
    // times per slot, palette-quantizes the candidates, and stages them for
    // manual curation. Per CLAUDE.md, the PixelLab API key lives ONLY here;
    // the bake script reaches the Worker by HTTP just like the frontend
    // does, so the key never leaves this process.
    //
    // Body: {description: string, width?: 16-400, height?: 16-400, seed?: number}.
    // Response: {image: {base64, format}, usage: {usd|credits} | null, latencyMs}.
    if (req.method === 'POST' && url.pathname === '/api/bake/sprite') {
      if (!env.PIXELLAB_API_KEY) {
        return json({ error: 'PIXELLAB_API_KEY not configured' }, { status: 500 }, cors);
      }
      let body: { description?: unknown; width?: unknown; height?: unknown; seed?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: 'invalid json body' }, { status: 400 }, cors);
      }
      if (typeof body.description !== 'string' || body.description.length === 0) {
        return json({ error: 'description (non-empty string) required' }, { status: 400 }, cors);
      }
      // PixelLab's pixflux endpoint enforces 16 ≤ dim ≤ 400 (validated
      // server-side; we mirror the bounds here so a typo in the bake
      // script fails fast rather than burning a paid round-trip).
      const width = typeof body.width === 'number' ? Math.floor(body.width) : 16;
      const height = typeof body.height === 'number' ? Math.floor(body.height) : 32;
      if (width < 16 || width > 400 || height < 16 || height > 400) {
        return json(
          { error: 'width/height must be integers in [16, 400]' },
          { status: 400 },
          cors,
        );
      }

      const startedAt = Date.now();
      let upstream: Response;
      try {
        upstream = await fetch('https://api.pixellab.ai/v2/create-image-pixflux', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${env.PIXELLAB_API_KEY}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            description: body.description,
            image_size: { width, height },
            no_background: true,
            ...(typeof body.seed === 'number' && { seed: Math.floor(body.seed) }),
          }),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'pixellab upstream fetch failed', message }, { status: 502 }, cors);
      }
      const latencyMs = Date.now() - startedAt;

      if (!upstream.ok) {
        const raw = await upstream.text().catch(() => '');
        // 401 (bad key) / 402 (out of credits) / 429 (rate) are user-actionable
        // upstream signals — pass them through verbatim so the bake script can
        // print a useful error. Everything else collapses to 502.
        const passthrough =
          upstream.status === 401 ||
          upstream.status === 402 ||
          upstream.status === 422 ||
          upstream.status === 429 ||
          upstream.status === 529;
        return json(
          { error: `pixellab returned ${upstream.status}`, raw: raw.slice(0, 400) },
          { status: passthrough ? upstream.status : 502 },
          cors,
        );
      }

      let data: {
        image?: { base64?: string; format?: string };
        usage?: { type?: string; usd?: number; credits?: number } | null;
      };
      try {
        data = (await upstream.json()) as typeof data;
      } catch {
        return json({ error: 'pixellab returned non-json' }, { status: 502 }, cors);
      }
      if (!data.image?.base64) {
        return json({ error: 'pixellab response missing image.base64' }, { status: 502 }, cors);
      }

      return json(
        {
          image: data.image,
          usage: data.usage ?? null,
          latencyMs,
        },
        { status: 200 },
        cors,
      );
    }

    return json({ error: 'not found' }, { status: 404 }, cors);
  },
};
