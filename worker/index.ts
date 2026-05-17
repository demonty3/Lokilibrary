/**
 * LibraryWorld Cloudflare Worker — single AI orchestration surface.
 *
 * Endpoints:
 *   GET  /healthz                  — liveness + provider config sanity
 *   GET  /api/auth/steam/login     — redirect to Steam OpenID checkid_setup
 *   GET  /api/auth/steam/return    — verify Steam OpenID response, set cookie
 *   GET  /api/auth/me              — session check; returns {steamId, persona?}
 *   POST /api/auth/logout          — clear session cookie
 *   GET  /api/library              — authed user's enriched + tagged library + profile
 *   GET  /api/world                — Stage 1 manifest from the session library
 *                                    (?template=... ?force=1; cached 24h)
 *   POST /api/share                — save current world as a /w/:id share record
 *   GET  /api/share/:id            — fetch a public share record (no auth)
 *
 * The frontend never holds an API key. All Anthropic / Ollama / (future)
 * Stable Audio / ElevenLabs / Meshy traffic terminates here.
 */

import { buildStageOnePrompt } from './lib/prompt';
import { extractJson, validateManifest } from './lib/manifest';
import { callStageOne, ProviderError, type ProviderEnv } from './lib/providers';
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
import {
  newShareId,
  shareKvKey,
  SHARE_SCHEMA_VERSION,
  SHARE_TTL_S,
  type ShareRecord,
  type SharedLibraryGame,
} from './lib/share';
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
  /** Read-through cache for Steam (slice 2), HLTB (slice 4), IGDB (Phase 3),
   *  and the Stage 1 manifest. See worker/wrangler.toml. */
  CACHE?: KVNamespace;
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
      return json(
        {
          ok: true,
          provider: env.LLM_PROVIDER ?? 'anthropic',
          anthropic_configured: Boolean(env.ANTHROPIC_API_KEY),
          steam_configured: Boolean(env.STEAM_WEB_API_KEY),
          session_configured: Boolean(env.SESSION_SECRET),
        },
        { status: 200 },
        cors,
      );
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

    // --- Share-URL save + fetch ----------------------------------------------
    // Phase 5 slice 3. The /w/:id viewer reconstructs a world from {manifest,
    // profile_seed, top-N states} — no worker round-trip beyond the GET.

    if (req.method === 'POST' && url.pathname === '/api/share') {
      const claims = await readSession(req, env);
      if (!claims) return json({ error: 'unauthenticated' }, { status: 401 }, cors);

      // Caller POSTs only the profileSeed — everything else the worker has
      // (or can rebuild) from the session. Body parsing is tolerant: an empty
      // body works for clients that didn't bother sending one.
      let body: { profileSeed?: unknown } = {};
      try {
        body = (await req.json()) as { profileSeed?: unknown };
      } catch {
        // empty / non-JSON body — fall through with body = {}
      }
      const seed = typeof body.profileSeed === 'number' ? body.profileSeed >>> 0 : null;
      if (seed === null) {
        return json({ error: 'profileSeed required' }, { status: 400 }, cors);
      }

      // Rebuild the user's library from the session. Reuses the same caches
      // as /api/library and /api/world, so this is cheap on a warm visit.
      const assembled = await assembleLibrary(env, req, cors, { force: false });
      if (!assembled.ok) return assembled.response;
      const { steamId, taggedGames, profile, persona } = assembled.bundle;

      // Pull the current manifest from cache. If it's missing (cold worker /
      // 24h expired), do a Stage 1 call so the share record reflects a real
      // world rather than failing.
      const template: TemplateId = 'seaside_town';
      const cacheKey = `manifest:v2:${steamId}:${template}`;
      const topN = taggedGames.slice(0, TOP_N);
      const promptGames = topN.map((g) => ({
        appid: g.appid,
        name: g.name,
        ...(g.state !== 'default' && { state: g.state }),
      }));
      const allowedAppids = new Set(promptGames.map((g) => g.appid));

      let parsed: unknown;
      try {
        parsed = await kvGet<unknown>(env.CACHE, cacheKey, MANIFEST_TTL_S, async () => {
          const { system, user } = buildStageOnePrompt({
            template,
            profile: { summary: profile.summary },
            games: promptGames,
          });
          const text = await callStageOne(env, system, user);
          return JSON.parse(extractJson(text)) as unknown;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'stage1', message }, { status: 502 }, cors);
      }

      const result = validateManifest(template, allowedAppids, parsed);
      if (!result.ok) {
        return json({ error: `manifest validation failed: ${result.reason}` }, { status: 502 }, cors);
      }

      const topLibrary: SharedLibraryGame[] = topN.map((g) => ({
        appid: g.appid,
        name: g.name,
        ...(g.state !== undefined && { state: g.state }),
        playtime_forever: g.playtime_forever,
      }));

      const record: ShareRecord = {
        v: SHARE_SCHEMA_VERSION,
        manifest: result.manifest,
        profileSeed: seed,
        topLibrary,
        dustyCount: profile.stateCounts?.dusty ?? 0,
        ...(persona && { persona }),
        createdAt: Math.floor(Date.now() / 1000),
      };

      const id = newShareId();
      if (env.CACHE) {
        try {
          await env.CACHE.put(shareKvKey(id), JSON.stringify(record), {
            expirationTtl: SHARE_TTL_S,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'kv put failed';
          return json({ error: 'storage', message }, { status: 500 }, cors);
        }
      } else {
        // Without KV we can't actually persist; fail loud so the user sees
        // why their share URL isn't showing up.
        return json({ error: 'share storage not configured (CACHE binding)' }, { status: 503 }, cors);
      }

      const base = publicBaseUrl(env);
      return json({ id, url: `${base}/w/${id}` }, { status: 201 }, cors);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/share/')) {
      const id = url.pathname.slice('/api/share/'.length);
      if (!id || !/^[a-f0-9]{8,32}$/.test(id)) {
        return json({ error: 'invalid share id' }, { status: 400 }, cors);
      }
      if (!env.CACHE) {
        return json({ error: 'share storage not configured' }, { status: 503 }, cors);
      }
      try {
        const raw = await env.CACHE.get(shareKvKey(id), 'json');
        if (raw === null) return json({ error: 'share not found' }, { status: 404 }, cors);
        // Echo back the record verbatim. Schema version mismatch handled
        // client-side — newer viewer reading older record can pick fields.
        return json(raw, { status: 200 }, cors);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'kv read failed';
        return json({ error: 'storage', message }, { status: 500 }, cors);
      }
    }

    return json({ error: 'not found' }, { status: 404 }, cors);
  },
};
