/**
 * AI provider dispatch. The Worker is the single AI orchestration surface
 * (CLAUDE.md): all providers wire up here, never in the frontend.
 *
 * Two tiers (FEASIBILITY.md):
 *   - Stage 1 orchestration / Tier 2 reflection — larger model, ~2k tokens.
 *     Production: Claude Opus 4.7. Dev: Ollama running qwen3:14b.
 *   - Tier 1 agent micro-actions — small model, ≤256 tokens, called many
 *     times per minute per agent. Production: Claude Haiku 4.5. Dev:
 *     Ollama running qwen2.5:7b (cheap + fast on a 12 GB-VRAM-class GPU).
 *
 * Future stages (Stable Audio, ElevenLabs, Blockade Labs, Meshy) are
 * template-build-time and live outside this runtime path.
 */

export interface ProviderEnv {
  LLM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  /** Stage 1 model. Defaults to claude-opus-4-7. */
  ANTHROPIC_MODEL?: string;
  /** Tier 1 agent micro-action model. Defaults to claude-haiku-4-5. */
  ANTHROPIC_TIER1_MODEL?: string;
  /** Tier 2 reflection model. Defaults to claude-sonnet-4-6 per CLAUDE.md
   *  (Sonnet is the right tier for reflection — Opus is reserved for
   *  Stage 1 world generation; Haiku is too small for synthesis). */
  ANTHROPIC_TIER2_MODEL?: string;
  OLLAMA_URL?: string;
  /** Stage 1 / Tier 2 Ollama model. Defaults to qwen3:14b. */
  OLLAMA_MODEL?: string;
  /** Tier 1 agent micro-action Ollama model. Defaults to qwen2.5:7b. */
  OLLAMA_TIER1_MODEL?: string;
  /** Lore/memory embedding model (Phase 5C). Local Ollama only —
   *  defaults to nomic-embed-text (768-dim, matches the memory_vec table
   *  in src/agents/memory/db.ts). There is deliberately no cloud
   *  embedding model: CLAUDE.md's privacy contract keeps lore + memories
   *  on the machine. */
  EMBED_MODEL?: string;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/**
 * Phase 2F: best-effort Ollama GPU detection via /api/ps. Returns a
 * compact snapshot of running models + their VRAM allocation; the
 * worker's /healthz endpoint surfaces this so a misconfigured local
 * dev box (Ollama defaulted to CPU because the GPU runtime didn't
 * load) is visible immediately rather than 27s into the first Tier-1
 * latency.
 *
 * Never throws — returns `{available: false, reason}` on any failure
 * so /healthz stays a green probe even if Ollama is down.
 */
export interface OllamaGpuSnapshot {
  available: boolean;
  reason?: string;
  models?: Array<{
    name: string;
    sizeBytes: number;
    vramBytes: number;
    onGpu: boolean;
  }>;
}

export async function detectOllamaGpu(env: ProviderEnv): Promise<OllamaGpuSnapshot> {
  const provider = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider !== 'local') {
    return { available: false, reason: 'LLM_PROVIDER != local' };
  }
  const url = (env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${url}/api/ps`);
  } catch (e) {
    return { available: false, reason: `ollama unreachable: ${(e as Error).message}` };
  }
  if (!res.ok) {
    return { available: false, reason: `ollama /api/ps ${res.status}` };
  }
  type PsResponse = {
    models?: Array<{
      name?: string;
      size?: number;
      size_vram?: number;
    }>;
  };
  const data = (await res.json()) as PsResponse;
  if (!data.models || data.models.length === 0) {
    return { available: true, models: [] };
  }
  const models = data.models.map((m) => ({
    name: m.name ?? '',
    sizeBytes: m.size ?? 0,
    vramBytes: m.size_vram ?? 0,
    onGpu: (m.size_vram ?? 0) > 0,
  }));
  return { available: true, models };
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

/**
 * Local embedding call (Phase 5C). Embeds a batch of texts via Ollama's
 * `/api/embed` using nomic-embed-text (768-dim — matches the `memory_vec`
 * table in src/agents/memory/db.ts).
 *
 * **Local-only by contract.** There is no cloud fallback: CLAUDE.md's
 * privacy contract says lore + memories never leave the machine, so the
 * `/api/embed` route 501s when LLM_PROVIDER !== 'local' (worker/index.ts).
 * The caller applies nomic's `search_document:` / `search_query:` task
 * prefixes; this transport just forwards whatever text it's given.
 */
export async function callEmbed(env: ProviderEnv, texts: string[]): Promise<number[][]> {
  const url = (env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  const model = env.EMBED_MODEL ?? 'nomic-embed-text';
  const res = await fetch(`${url}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ProviderError(`ollama embed ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { embeddings?: number[][] };
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new ProviderError(
      `ollama embed returned ${data.embeddings?.length ?? 0} vectors for ${texts.length} inputs`,
    );
  }
  return data.embeddings;
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

/**
 * Tier 1 agent micro-action call. Returns the raw model text; the caller
 * parses to whatever shape the prompt requested (typically `{ action, intent }`).
 * Lower max_tokens than Stage 1 — these calls happen many times per minute
 * per agent, so latency and cost discipline matter more than depth.
 */
export async function callTier1Agent(
  env: ProviderEnv,
  system: string,
  user: string,
): Promise<{
  text: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const provider = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider === 'local') {
    const url = (env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
    const model = env.OLLAMA_TIER1_MODEL ?? 'qwen2.5:7b';
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
        options: { num_predict: 256, temperature: 0.7 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ProviderError(`ollama ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const text = data.message?.content;
    if (!text) throw new ProviderError('ollama returned no content');
    return {
      text,
      model,
      provider,
      tokensIn: data.prompt_eval_count ?? 0,
      tokensOut: data.eval_count ?? 0,
    };
  }
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) {
      throw new ProviderError('ANTHROPIC_API_KEY not configured', 500);
    }
    const model = env.ANTHROPIC_TIER1_MODEL ?? 'claude-haiku-4-5-20251001';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ProviderError(`anthropic ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new ProviderError('anthropic returned no text content');
    return {
      text,
      model,
      provider,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
    };
  }
  throw new ProviderError(`unknown LLM_PROVIDER "${provider}"`, 500);
}

/**
 * Tier 2 reflection call. Larger context budget than Tier 1 (~2k tokens
 * for synthesis), Sonnet 4.6 in production, qwen3:14b in dev. Mirrors
 * the `callTier1Agent` shape so worker/index.ts can swap providers
 * without route-specific glue.
 *
 * Per CLAUDE.md: Tier 2 fires only on reflection threshold (Smallville
 * 150) or direct user action. Cost discipline lives one layer up; this
 * function is the transport.
 */
export async function callTier2Reflect(
  env: ProviderEnv,
  system: string,
  user: string,
): Promise<{
  text: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const provider = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider === 'local') {
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
        options: { num_predict: 2048, temperature: 0.5 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ProviderError(`ollama ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const text = data.message?.content;
    if (!text) throw new ProviderError('ollama returned no content');
    return {
      text,
      model,
      provider,
      tokensIn: data.prompt_eval_count ?? 0,
      tokensOut: data.eval_count ?? 0,
    };
  }
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) {
      throw new ProviderError('ANTHROPIC_API_KEY not configured', 500);
    }
    const model = env.ANTHROPIC_TIER2_MODEL ?? 'claude-sonnet-4-6';
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
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new ProviderError('anthropic returned no text content');
    return {
      text,
      model,
      provider,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
    };
  }
  throw new ProviderError(`unknown LLM_PROVIDER "${provider}"`, 500);
}
