/**
 * LibraryWorld Cloudflare Worker — single AI orchestration surface.
 *
 * Endpoints:
 *   POST /api/world  — Stage 1: world manifest from games + profile
 *   GET  /healthz    — liveness + provider config sanity
 *
 * The frontend never holds an API key. All Anthropic / Ollama / (future)
 * Stable Audio / ElevenLabs / Meshy traffic terminates here.
 */

import { buildStageOnePrompt } from './lib/prompt';
import { extractJson, validateManifest } from './lib/manifest';
import { callStageOne, ProviderError, type ProviderEnv } from './lib/providers';
import { TEMPLATE_WHITELIST, type TemplateId } from './lib/whitelist';

interface Env extends ProviderEnv {
  /** Comma-separated list of allowed origins for CORS. Local dev defaults below. */
  ALLOWED_ORIGINS?: string;
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
    'access-control-max-age': '86400',
    vary: 'origin',
  };
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
