/**
 * LibraryWorld Cloudflare Worker — single AI orchestration surface.
 *
 * Endpoints:
 *   GET  /healthz                  — liveness + provider config sanity
 *   GET  /api/auth/steam/login     — redirect to Steam OpenID checkid_setup
 *   GET  /api/auth/steam/return    — verify Steam OpenID response, set cookie
 *   GET  /api/auth/me              — read session cookie, return {steamId}
 *   POST /api/auth/logout          — clear session cookie
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
} from './lib/session';

interface Env extends ProviderEnv {
  /** Comma-separated list of allowed origins for CORS. Local dev defaults below. */
  ALLOWED_ORIGINS?: string;
  /** HMAC secret for the session JWT. Required for any /api/auth route. */
  SESSION_SECRET?: string;
  /** User-facing origin (e.g. http://localhost:5183). Used to build the OpenID
   *  return URL and to decide whether the session cookie is Secure. */
  PUBLIC_BASE_URL?: string;
  /** First used in slice 2 (GetOwnedGames). Acknowledged here so wrangler stops
   *  warning about an unknown var once it's set in .dev.vars. */
  STEAM_WEB_API_KEY?: string;
}

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
      if (!env.SESSION_SECRET) {
        return json({ authenticated: false }, { status: 200 }, cors);
      }
      const token = readSessionCookie(req);
      if (!token) return json({ authenticated: false }, { status: 200 }, cors);
      const claims = await verifySession(token, env.SESSION_SECRET);
      if (!claims) return json({ authenticated: false }, { status: 200 }, cors);
      return json({ authenticated: true, steamId: claims.sub }, { status: 200 }, cors);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const base = publicBaseUrl(env);
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'set-cookie': clearSessionCookieHeader(cookieIsSecure(base)) },
      });
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
