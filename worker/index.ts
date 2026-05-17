/**
 * LibraryWorld Cloudflare Worker — single AI orchestration surface.
 *
 * Endpoints:
 *   GET  /healthz                  — liveness + provider config sanity
 *   GET  /api/auth/steam/login     — redirect to Steam OpenID checkid_setup
 *   GET  /api/auth/steam/return    — verify Steam OpenID response, set cookie
 *   GET  /api/auth/me              — session check; returns {steamId, persona?}
 *   POST /api/auth/logout          — clear session cookie
 *   GET  /api/library              — authed user's owned games (top-sorted)
 *   POST /api/world                — Stage 1: world manifest from games + profile
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

interface WorldRequestBody {
  template?: string;
  profile?: { summary?: string };
  games?: Array<{ appid?: number; name?: string; state?: string }>;
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
    // Slice 2 of Phase 2 (PLAN.md tasks 2). Returns the signed-in user's owned
    // games, sorted desc by playtime. Cached per-steamid in KV with a 1h TTL.
    // ?force=1 bypasses the read but still writes — developer escape hatch.

    if (req.method === 'GET' && url.pathname === '/api/library') {
      const claims = await readSession(req, env);
      if (!claims) return json({ error: 'unauthenticated' }, { status: 401 }, cors);
      if (!env.STEAM_WEB_API_KEY) {
        return json({ error: 'STEAM_WEB_API_KEY not configured' }, { status: 500 }, cors);
      }

      const force = url.searchParams.get('force') === '1';
      const apiKey = env.STEAM_WEB_API_KEY;
      const steamId = claims.sub;

      let games: OwnedGame[];
      try {
        games = await kvGet<OwnedGame[]>(
          env.CACHE,
          `steam:owned:${steamId}`,
          OWNED_GAMES_TTL_S,
          () => fetchOwnedGames(steamId, apiKey),
          { force },
        );
      } catch (e) {
        if (e instanceof SteamError) {
          const status = e.reason === 'private_profile' ? 403
            : e.reason === 'unauthorized' ? 502
            : e.reason === 'rate_limited' ? 429
            : 502;
          return json({ error: e.reason, message: e.message }, { status }, cors);
        }
        const message = e instanceof Error ? e.message : 'unknown steam error';
        return json({ error: 'upstream', message }, { status: 502 }, cors);
      }

      // Enrich the top-N in place; the long tail stays minimal so the JSON
      // payload doesn't balloon for 500-game libraries.
      const topGames = await enrichTopGames(env, steamId, apiKey, games.slice(0, TOP_N));
      const enrichedGames: EnrichedGame[] = [...topGames, ...games.slice(TOP_N)];

      // Slice 6: SPEC §4 state tagging. Runs over the whole library so the
      // long-tail `dusty` count is honest; the top-N pick up `loved` /
      // `mastered` / `abandoned` / `recent` / `default`. Per PLAN.md task 6,
      // Stage 1 will see `state: "loved"` rather than raw playtime numbers
      // when slice 7 wires the prompt.
      const taggedGames = tagLibrary(enrichedGames, Math.floor(Date.now() / 1000));

      // Slice 5: aggregate the per-game signals into a behavioral profile.
      // The profile.summary feeds Stage 1's prompt at slice 7; profile itself
      // becomes the seed for Phase 5's procedural layout layer.
      const profile = buildProfile(taggedGames, TOP_N);

      const persona = await cachedPersona(env, steamId);

      return json(
        {
          steamId,
          ...(persona && { persona }),
          totalGames: games.length,
          topN: TOP_N,
          games: taggedGames,
          profile,
        },
        { status: 200 },
        cors,
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/world') {
      let body: WorldRequestBody;
      try {
        body = (await req.json()) as WorldRequestBody;
      } catch {
        return json({ error: 'invalid json' }, { status: 400 }, cors);
      }

      const template = body.template ?? 'seaside_town';
      if (!(template in TEMPLATE_WHITELIST)) {
        return json({ error: `unknown template "${template}"` }, { status: 400 }, cors);
      }
      const games = (body.games ?? []).filter(
        (g): g is { appid: number; name: string } =>
          typeof g.appid === 'number' && typeof g.name === 'string',
      );
      if (games.length === 0) return json({ error: 'no games provided' }, { status: 400 }, cors);

      const { system, user } = buildStageOnePrompt({
        template: template as TemplateId,
        profile: { summary: body.profile?.summary },
        games,
      });

      let text: string;
      try {
        text = await callStageOne(env, system, user);
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 500;
        const message = e instanceof Error ? e.message : 'unknown provider error';
        return json({ error: message }, { status }, cors);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(text));
      } catch {
        return json(
          { error: 'model returned invalid json', raw: text.slice(0, 500) },
          { status: 502 },
          cors,
        );
      }

      const allowedAppids = new Set(games.map((g) => g.appid));
      const result = validateManifest(template as TemplateId, allowedAppids, parsed);
      if (!result.ok) {
        return json(
          { error: `manifest validation failed: ${result.reason}`, raw: parsed },
          { status: 502 },
          cors,
        );
      }
      return json(result.manifest, { status: 200 }, cors);
    }

    return json({ error: 'not found' }, { status: 404 }, cors);
  },
};
