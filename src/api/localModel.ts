/**
 * Local-model client (Phase 6A — "Local AI lives in your world" Depth 1).
 * Thin wrapper over the Worker's GET /api/local-model, which probes the
 * user's localhost Ollama daemon for installed + running models.
 *
 * **Local-only by contract, failure is expected.** The Worker returns
 * `{present:false}` whenever LLM_PROVIDER !== 'local' (cloud config) or
 * Ollama is unreachable, and this wrapper additionally maps any network
 * error / non-ok response to `{present:false}` — mirroring `embedTexts`'
 * defensive `{ok:false}` shape. Callers treat `{present:false}` as the
 * normal "no local model in this world" state (no landmark, no glow), NOT
 * an error to surface.
 *
 * Reads ONLY local model metadata (names/sizes/param class). Nothing about
 * a model ever egresses to a third party (CLAUDE.md privacy contract,
 * extended to model metadata).
 *
 * **Production follow-up (documented, NOT built here):** a deployed remote
 * Worker cannot reach the user's localhost:11434, and neither can a deployed
 * frontend. The real production path is the Electron main process probing
 * localhost directly and exposing the result over an IPC channel
 * (`src/api/electron.ts` + the desktop preload), the way the v0.6 wrapper
 * checked Ollama. The local wrangler→Ollama path wired here is the
 * dev/WSL-testable equivalent that proves the contract.
 */

export interface LocalModelInfo {
  name: string;
  sizeBytes?: number;
  /** Canonical parameter-size token from Ollama (`'7B'`, `'70B'`, ...). */
  paramClass?: string;
}

export type LocalModelResult =
  | { present: true; models: LocalModelInfo[]; running: boolean }
  | { present: false };

/** The "nothing here" result — a frozen singleton so the renderer can use
 *  it as a safe default param value without re-allocating. */
export const NO_LOCAL_MODEL: LocalModelResult = { present: false };

/**
 * Fetch the local-model snapshot from the Worker. Resolves `{present:false}`
 * on any failure (network, non-ok, cloud path, malformed body) — never
 * rejects, so the renderer can `await` it inside mount without a try/catch.
 */
export async function getLocalModel(): Promise<LocalModelResult> {
  let res: Response;
  try {
    res = await fetch('/api/local-model', { credentials: 'same-origin' });
  } catch {
    return NO_LOCAL_MODEL;
  }
  if (!res.ok) return NO_LOCAL_MODEL;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NO_LOCAL_MODEL;
  }
  return parseLocalModelBody(data);
}

/**
 * Pure parser for a /api/local-model response body. Exported for the smoke
 * (the network leg is the only untestable part in WSL; the body→result
 * transform is pure and pinned here). Anything that isn't a well-formed
 * `present:true` payload with ≥1 model collapses to `{present:false}`.
 */
export function parseLocalModelBody(data: unknown): LocalModelResult {
  if (typeof data !== 'object' || data === null) return NO_LOCAL_MODEL;
  const body = data as {
    present?: unknown;
    models?: unknown;
    running?: unknown;
  };
  if (body.present !== true) return NO_LOCAL_MODEL;
  if (!Array.isArray(body.models) || body.models.length === 0) return NO_LOCAL_MODEL;
  const models: LocalModelInfo[] = [];
  for (const raw of body.models) {
    if (typeof raw !== 'object' || raw === null) continue;
    const m = raw as { name?: unknown; sizeBytes?: unknown; paramClass?: unknown };
    if (typeof m.name !== 'string' || m.name.length === 0) continue;
    models.push({
      name: m.name,
      sizeBytes: typeof m.sizeBytes === 'number' ? m.sizeBytes : undefined,
      paramClass: typeof m.paramClass === 'string' ? m.paramClass : undefined,
    });
  }
  if (models.length === 0) return NO_LOCAL_MODEL;
  return { present: true, models, running: body.running === true };
}
