/**
 * AI provider dispatch. The Worker is the single AI orchestration surface
 * (CLAUDE.md): all providers wire up here, never in the frontend. For v0.1 we
 * support two providers for Stage 1:
 *   - anthropic (prod) — Claude Opus 4.7
 *   - local (dev only) — Ollama running qwen3:14b
 *
 * Future stages (Stable Audio, ElevenLabs, Blockade Labs, Meshy) are
 * template-build-time and live outside this runtime path.
 */

export interface ProviderEnv {
  LLM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OLLAMA_URL?: string;
  OLLAMA_MODEL?: string;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export async function callStageOne(
  env: ProviderEnv,
  system: string,
  user: string,
): Promise<string> {
  const provider = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider === 'local') return callOllama(env, system, user);
  if (provider === 'anthropic') return callAnthropic(env, system, user);
  throw new ProviderError(`unknown LLM_PROVIDER "${provider}"`, 500);
}

async function callAnthropic(env: ProviderEnv, system: string, user: string): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ProviderError('ANTHROPIC_API_KEY not configured', 500);
  }
  const model = env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ProviderError(`anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw new ProviderError('anthropic returned no text content');
  return text;
}

async function callOllama(env: ProviderEnv, system: string, user: string): Promise<string> {
  const url = (env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  const model = env.OLLAMA_MODEL ?? 'qwen3:14b';
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      format: 'json',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ProviderError(`ollama ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content;
  if (!text) throw new ProviderError('ollama returned no content');
  return text;
}
