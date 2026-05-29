/**
 * Reflection-time lore gathering (Phase 5C slice 5C.2).
 *
 * Bridges the embedding client (`src/api/embed.ts`) and the memory
 * writer's lore retrieval so a Tier-2 reflection can weave in the
 * library's uploaded canon. Kept out of router.ts proper so the router
 * stays free of the embed-network dependency and so the smoke can inject
 * a deterministic stub.
 *
 * Flow:
 *   1. Skip entirely when the library has no lore (no embed call wasted).
 *   2. Build a query string from the agent's recent memories, embed it
 *      once (search_query: prefix) via the local Ollama route.
 *   3. KNN cosine over the library's lore (writer.recentLore) — or, if
 *      the embed call fails / vec is off, recency fallback.
 *
 * Best-effort: any failure returns the recency fallback (or []), never
 * blocks the reflection.
 */

import { embedTexts, withQueryPrefix } from '../api/embed';
import type {
  LoreSnippet,
  MemoryWriter,
  RecentMemorySummary,
} from './router';

/** Signature the router depends on; the default impl below is injected
 *  by `routeTier2` unless a test overrides it. */
export type LoreGatherer = (
  memory: MemoryWriter,
  recentMemories: readonly RecentMemorySummary[],
  topK: number,
) => Promise<readonly LoreSnippet[]>;

/** Max chars of recent-memory text folded into the lore query. Keeps
 *  the single embed call cheap + within nomic's context. */
const MAX_QUERY_CHARS = 2000;

export const defaultLoreGatherer: LoreGatherer = async (
  memory,
  recentMemories,
  topK,
) => {
  if (memory.loreCount() === 0) return [];

  const queryText = recentMemories
    .slice(0, 8)
    .map((m) => m.text)
    .join(' ')
    .slice(0, MAX_QUERY_CHARS)
    .trim();

  let queryEmbedding: Float32Array | undefined;
  if (queryText.length > 0) {
    try {
      const res = await embedTexts([withQueryPrefix(queryText)]);
      if (res.ok && res.embeddings[0] && res.embeddings[0].length > 0) {
        queryEmbedding = Float32Array.from(res.embeddings[0]);
      }
    } catch {
      // best-effort — fall back to recency-ranked lore
    }
  }

  return memory.recentLore(topK, queryEmbedding);
};
