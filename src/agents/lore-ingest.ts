/**
 * Lore ingestion orchestration (Phase 5C slice 5C.2b).
 *
 * Ties the three 5C pieces together for a single uploaded document:
 *   chunkText (5C.1) → embedTexts /api/embed (5C.1) → writer.recordLore
 *   (5C.2a).
 *
 * Kept as a pure-ish function (the embed call + writer are injectable) so
 * the React drop-zone stays thin and this is smoke-testable without a
 * browser. The embed step is best-effort: if /api/embed fails or 501s
 * (cloud provider — privacy contract), we still persist every chunk so
 * FTS5 keyword retrieval works; only cosine relevance is lost. The
 * uploaded lore is never dropped on the floor because embeddings weren't
 * available.
 */

import { chunkText, type ChunkOptions } from './memory/chunk';
import { embedTexts, withDocumentPrefix, type EmbedResult } from '../api/embed';
import type { MemoryWriter } from './router';

export interface IngestResult {
  readonly source: string;
  /** Chunks the document split into. */
  readonly chunkCount: number;
  /** Chunks that got a vector attached (0 → FTS-only fallback). */
  readonly embeddedCount: number;
  /** Lore row ids written (length ≤ chunkCount; null-writer → empty). */
  readonly loreIds: readonly string[];
  /** Set when embedding was skipped/failed; chunks were still stored. */
  readonly embedError?: string;
}

export type EmbedFn = (texts: readonly string[]) => Promise<EmbedResult>;

export interface IngestOptions {
  /** Inject the embed transport (defaults to the real /api/embed call). */
  embed?: EmbedFn;
  /** Chunker tuning (defaults to 500/50). */
  chunk?: ChunkOptions;
}

/**
 * Ingest one document's text into the writer's library as lore.
 * Returns a summary the UI surfaces ("12 chunks, 12 embedded").
 */
export async function ingestLore(
  text: string,
  source: string,
  writer: MemoryWriter,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const chunks = chunkText(text, opts.chunk);
  if (chunks.length === 0) {
    return { source, chunkCount: 0, embeddedCount: 0, loreIds: [] };
  }

  const embed = opts.embed ?? embedTexts;
  const prefixed = chunks.map(withDocumentPrefix);

  let res: EmbedResult;
  try {
    res = await embed(prefixed);
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : 'embed threw' };
  }

  const loreIds: string[] = [];
  const vectorsOk =
    res.ok && Array.isArray(res.embeddings) && res.embeddings.length === chunks.length;

  if (vectorsOk) {
    const embeddings = (res as { embeddings: number[][] }).embeddings;
    for (let i = 0; i < chunks.length; i++) {
      const id = writer.recordLore({
        text: chunks[i],
        source,
        embedding: embeddings[i],
      });
      if (id) loreIds.push(id);
    }
    return { source, chunkCount: chunks.length, embeddedCount: chunks.length, loreIds };
  }

  // FTS-only fallback — persist chunks without vectors.
  const embedError = res.ok
    ? `embedding count mismatch (${(res as { embeddings: number[][] }).embeddings.length}/${chunks.length})`
    : (res as { error: string }).error;
  for (const chunk of chunks) {
    const id = writer.recordLore({ text: chunk, source });
    if (id) loreIds.push(id);
  }
  return {
    source,
    chunkCount: chunks.length,
    embeddedCount: 0,
    loreIds,
    embedError,
  };
}
