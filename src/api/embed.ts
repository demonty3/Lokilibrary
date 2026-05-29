/**
 * Embedding client (Phase 5C slice 5C.1). Thin wrapper over the Worker's
 * POST /api/embed, which embeds text via local Ollama nomic-embed-text
 * (768-dim).
 *
 * **Local-only by contract.** The Worker 501s when LLM_PROVIDER !== 'local'
 * (CLAUDE.md: lore + memories never leave the machine), so callers must
 * treat `{ok:false}` as expected in production and fall back to FTS5
 * retrieval rather than failing the user action.
 */

/** nomic-embed-text task prefixes — materially improve retrieval recall.
 *  Documents (lore chunks, stored memories) get `search_document:`; live
 *  queries get `search_query:`. */
export const NOMIC_DOC_PREFIX = 'search_document: ';
export const NOMIC_QUERY_PREFIX = 'search_query: ';

export function withDocumentPrefix(text: string): string {
  return `${NOMIC_DOC_PREFIX}${text}`;
}

export function withQueryPrefix(text: string): string {
  return `${NOMIC_QUERY_PREFIX}${text}`;
}

export type EmbedResult =
  | { ok: true; embeddings: number[][] }
  | { ok: false; error: string };

/** Embed a batch of texts. Empty input short-circuits without a request. */
export async function embedTexts(texts: readonly string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { ok: true, embeddings: [] };
  let res: Response;
  try {
    res = await fetch('/api/embed', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `${res.status} ${body.slice(0, 200)}` };
  }
  const data = (await res.json()) as { embeddings?: number[][] };
  if (!data.embeddings) return { ok: false, error: 'no embeddings in response' };
  return { ok: true, embeddings: data.embeddings };
}
