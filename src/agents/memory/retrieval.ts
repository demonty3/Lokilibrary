/**
 * Smallville-style memory retrieval. For a given query the score is
 * the unweighted sum (α=β=γ=1) of three normalised signals:
 *
 *   - recency   = 0.99^hours_since_access     (exponential decay)
 *   - relevance = cosine similarity (when embeddings available)
 *                 or BM25 rank (FTS5 fallback)
 *   - importance = importance / 10            (already 1..10, normalise)
 *
 * Phase 2D ships the recency + importance scoring + the FTS5 hybrid
 * path. Cosine relevance is wired but no-ops when the embedding store
 * is empty (which it always is until the local Ollama embedding route
 * lands — see worker/index.ts:/api/embed). When relevance is absent,
 * `relevance = 0.5` so it stops dominating the ranking — recency +
 * importance still drive ordering.
 *
 * Constants are the Smallville paper's verbatim values (joonspk-
 * research/generative_agents). Phase 2F may tune via telemetry; PRs
 * that change them should cite a measurement.
 */

import type { MemoryDb } from './db';
import type { Memory, MemoryRow } from './schema';
import { decodeMemory } from './schema';

export const RECENCY_HALF_LIFE_HOURS = 69; // 0.99^69 ≈ 0.5
export const RECENCY_DECAY_PER_HOUR = 0.99;

export interface RetrievalOptions {
  /** Recent-fetch window in DB rows before scoring. Larger = more
   *  candidates, more scoring work. Default 100 — Smallville's default
   *  retrieval window. */
  candidatePoolSize?: number;
  /** Maximum results to return. Default 5 — the Tier-1 context. */
  topK?: number;
  /** Optional query embedding for cosine relevance. When omitted (or
   *  zero-length) relevance defaults to 0.5 + FTS5 rank if available. */
  queryEmbedding?: Float32Array;
  /** Optional textual query for the FTS5 path. When provided and
   *  queryEmbedding is omitted, hybrid retrieval falls back to FTS5 +
   *  recency + importance only. */
  ftsQuery?: string;
  /** Wall clock in ms (testable). Defaults to Date.now(). */
  now?: number;
}

export interface ScoredMemory {
  readonly memory: Memory;
  readonly recency: number;
  readonly relevance: number;
  readonly importance: number;
  readonly total: number;
}

/**
 * Retrieve scored memories for one agent. Always reads the recent
 * candidate pool synchronously from SQLite; embedding cosine is only
 * applied if `queryEmbedding` is supplied AND the row has an
 * `embedding_id`.
 */
export function retrieveScored(
  db: MemoryDb,
  agentId: string,
  opts: RetrievalOptions = {},
): ScoredMemory[] {
  const candidatePool = opts.candidatePoolSize ?? 100;
  const topK = opts.topK ?? 5;
  const now = opts.now ?? Date.now();

  // Candidate fetch: most-recent N rows. Smallville also retrieves by
  // FTS5 BM25 ranking; we union the two pools when ftsQuery is set.
  const recentRows = db.recentForAgent(agentId, candidatePool);
  const ftsRows = opts.ftsQuery
    ? db.searchFts(opts.ftsQuery, agentId, candidatePool)
    : [];

  // Union by id; track FTS rank for relevance scoring.
  const seen = new Map<string, { row: MemoryRow; ftsRank: number | null }>();
  for (const row of recentRows) seen.set(row.id, { row, ftsRank: null });
  for (let i = 0; i < ftsRows.length; i++) {
    const existing = seen.get(ftsRows[i].id);
    if (existing) existing.ftsRank = i;
    else seen.set(ftsRows[i].id, { row: ftsRows[i], ftsRank: i });
  }

  const ftsTotal = ftsRows.length;
  const scored: ScoredMemory[] = [];
  for (const { row, ftsRank } of seen.values()) {
    const memory = decodeMemory(row);
    const recency = computeRecency(memory.accessed_at, now);
    const importance = memory.importance / 10;
    const relevance = computeRelevance(ftsRank, ftsTotal);
    const total = recency + relevance + importance;
    scored.push({ memory, recency, relevance, importance, total });
  }

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, topK);
}

/**
 * Convenience helper for the router: returns the top-K memories
 * already shaped as `RecentMemorySummary` (id + text + kind + ...). */
export function recentForRouter(
  db: MemoryDb,
  agentId: string,
  n: number,
): ReadonlyArray<{
  id: string;
  text: string;
  kind: 'observation' | 'reflection' | 'plan' | 'dialogue';
  created_at: number;
  importance: number;
}> {
  const scored = retrieveScored(db, agentId, { topK: n });
  return scored.map(({ memory }) => ({
    id: memory.id,
    text: textOf(memory),
    kind: memory.kind,
    created_at: memory.created_at,
    importance: memory.importance,
  }));
}

/**
 * Recency = decay_per_hour^hours_since_access. Phase 2D uses
 * `accessed_at` (Smallville convention — read-recency, not write-
 * recency). The router currently doesn't call `db.touchMemory` on
 * retrieval; slice 2F may add that.
 */
export function computeRecency(accessedAt: number, now: number): number {
  const hours = Math.max(0, (now - accessedAt) / (1000 * 60 * 60));
  return Math.pow(RECENCY_DECAY_PER_HOUR, hours);
}

/**
 * Relevance: when FTS rank is known (lower index = better), map to
 * (1 .. 0). When neither rank nor embedding is present, fall back to
 * 0.5 so relevance stays neutral and recency + importance can still
 * differentiate ordering.
 */
function computeRelevance(rank: number | null, total: number): number {
  if (rank === null || total === 0) return 0.5;
  // rank 0 → 1.0, rank (total-1) → ~0.0. Linear is good enough at the
  // pool sizes we use (≤100); BM25-based weighting is a Phase 2F polish.
  return 1 - rank / total;
}

function textOf(m: Memory): string {
  switch (m.kind) {
    case 'observation':
    case 'reflection':
    case 'plan':
    case 'dialogue':
      return m.payload.text;
  }
}

export interface LoreSnippet {
  readonly id: string;
  readonly text: string;
  readonly source: string;
}

export interface LoreRetrievalOptions {
  /** Max lore chunks to return. Default 4. */
  topK?: number;
  /** Optional query embedding (search_query: prefixed, embedded by the
   *  caller). When present AND sqlite-vec is loaded, cosine KNN ranks
   *  lore by semantic similarity. When absent, falls back to recency. */
  queryEmbedding?: Float32Array;
}

/**
 * Retrieve lore chunks for one library (Phase 5C). Two paths:
 *   - cosine: when a queryEmbedding is supplied and vec is loaded, KNN
 *     over `lore_vec` (over-fetched, then filtered to this library and
 *     sliced to topK — robust regardless of how sqlite-vec orders its
 *     k-limit vs. metadata filtering).
 *   - recency: otherwise the most-recent topK chunks in the library.
 *
 * A freshly-uploaded doc has all chunks equally recent, so the recency
 * path surfaces it fine for the MVP; the cosine path lights up the
 * moment a query embedding is threaded in (5D / reflect-query wiring).
 */
export function retrieveLore(
  db: MemoryDb,
  libraryId: string,
  opts: LoreRetrievalOptions = {},
): LoreSnippet[] {
  const topK = opts.topK ?? 4;
  if (opts.queryEmbedding && opts.queryEmbedding.length > 0 && db.hasVec) {
    // Over-fetch so the library filter can't starve the result set when
    // another library's chunks happen to be globally nearer.
    const k = Math.min(Math.max(topK * 4, 32), 256);
    const hits = db.searchLoreVec(opts.queryEmbedding, k);
    const filtered = hits
      .filter((h) => h.row.library_id === libraryId)
      .slice(0, topK);
    if (filtered.length > 0) {
      return filtered.map(({ row }) => ({
        id: row.id,
        text: row.text,
        source: row.source,
      }));
    }
    // Fall through to recency if the KNN pool held nothing for this library.
  }
  return db
    .recentLore(libraryId, topK)
    .map((row) => ({ id: row.id, text: row.text, source: row.source }));
}

/**
 * Collect `place_mark` steps from all active plans in this cell.
 * Used by the cell renderer at mount to draw persisted marginalia
 * glyphs that survived restart. Dedupes by (agentId, x, y) so a plan
 * with two identical place_mark steps doesn't double-render.
 *
 * Status filter is `'active'` — completed / abandoned plans drop out.
 * Pool size is capped at 64 plans per cell to keep render cheap; if
 * that ever matters we add an LRU prune at write time.
 */
export function placedMarksForCell(
  db: MemoryDb,
  cellId: string,
): ReadonlyArray<{
  agentId: string;
  location: { x: number; y: number };
  target?: string;
  text: string;
}> {
  const rows = db.recentByCellAndKind(cellId, 'plan', 64);
  const out: Array<{
    agentId: string;
    location: { x: number; y: number };
    target?: string;
    text: string;
  }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let payload: {
      text?: string;
      steps?: Array<{
        kind: string;
        target?: string;
        location?: { x: number; y: number };
        status?: string;
      }>;
      status?: string;
    };
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      continue;
    }
    if (payload.status && payload.status !== 'active') continue;
    if (!Array.isArray(payload.steps)) continue;
    for (const step of payload.steps) {
      if (step.kind !== 'place_mark') continue;
      if (!step.location) continue;
      if (step.status && step.status !== 'pending') continue;
      const key = `${row.agent_id}|${step.location.x}|${step.location.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        agentId: row.agent_id,
        location: step.location,
        target: step.target,
        text: payload.text ?? '',
      });
    }
  }
  return out;
}
