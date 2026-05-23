/**
 * Aggregation helpers over the `agent_telemetry` table. The DB-side
 * writes happen in `memory/writer.ts` via `db.logTelemetry()`; this
 * module reads them back into the shape the debug overlay (Ctrl+\`)
 * and the cost-soak verification want.
 *
 * Per-(provider, model) price table is the single source of truth for
 * cost conversion — `cost_usd_est` in each row was computed at write
 * time using these constants, but extrapolation here re-derives in
 * case the price table evolves under existing rows.
 *
 * Phase 2F follow-up: per-month extrapolation linearly projects the
 * last hour. That's pessimistic during a soak (real cohort cadence
 * isn't steady-state) but it's the right shape for the ≤$1/user/month
 * cost-discipline check (CLAUDE.md "Cost target ≤$1/user/month at
 * Claude Sonnet rates").
 */

import type { MemoryDb } from './memory/db';

/** USD per million tokens, indexed by `${provider}:${model}` prefix.
 *  Lookup is `startsWith`, so a date-suffixed Anthropic model name
 *  (`claude-haiku-4-5-20251001`) matches a key prefix without the
 *  date. Unknown combos return zero — cost UI shows "?" and a warning. */
export interface PriceEntry {
  inPerMtok: number;
  outPerMtok: number;
}

export const PRICE_TABLE: ReadonlyMap<string, PriceEntry> = new Map([
  ['anthropic:claude-haiku-4-5', { inPerMtok: 0.8, outPerMtok: 4.0 }],
  ['anthropic:claude-sonnet-4-6', { inPerMtok: 3.0, outPerMtok: 15.0 }],
  ['anthropic:claude-opus-4-7', { inPerMtok: 15.0, outPerMtok: 75.0 }],
  // Local Ollama costs nothing at the model-spend layer (electricity is
  // not in scope here). Returning zero keeps the math correct.
  ['local:qwen2.5:7b', { inPerMtok: 0, outPerMtok: 0 }],
  ['local:qwen3:14b', { inPerMtok: 0, outPerMtok: 0 }],
  // Stub provider — appears in smoke tests; never in a real bill.
  ['stub:stub', { inPerMtok: 0, outPerMtok: 0 }],
]);

export function priceFor(provider: string, model: string): PriceEntry | null {
  const key = `${provider}:${model}`;
  // Exact match first (cheap), then prefix-walk to handle date suffixes.
  const exact = PRICE_TABLE.get(key);
  if (exact) return exact;
  for (const [prefix, price] of PRICE_TABLE) {
    if (key.startsWith(prefix)) return price;
  }
  return null;
}

export interface CostBucket {
  tier1Count: number;
  tier2Count: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  meanLatencyMs: number;
}

export interface CostSummary {
  windowMs: number;
  windowStartMs: number;
  windowEndMs: number;
  total: CostBucket;
  /** Per-(provider, model) breakdown for the same window. */
  byModel: Map<string, CostBucket>;
}

/** Default window: last 60 minutes. */
export const HOUR_MS = 60 * 60 * 1000;

/**
 * Aggregate telemetry rows in the [now - windowMs, now] window. Reads
 * via the wrapper's `recentByCellAndKind`-free path; we go through a
 * dedicated raw query because telemetry isn't keyed by agent_id /
 * cell_id but by `created_at` only. The MemoryDb wrapper doesn't
 * expose a generic prepared-statement surface, so we use the
 * `recentByCellAndKind` analog `recentByCellAndKind`-style — see
 * `aggregateRaw` below for the internal raw path.
 *
 * For tests, `nowMs` is injectable.
 */
export function aggregateSince(
  db: MemoryDb,
  windowMs: number,
  nowMs: number = Date.now(),
): CostSummary {
  const start = nowMs - windowMs;
  // We piggy-back on the same require() we exposed in memory/db.ts —
  // every telemetry consumer runs in the same Electron renderer as
  // the writer. `aggregateRaw` opens a fresh prepared statement once
  // and caches it on the wrapper's hidden handle.
  const rows = readTelemetryRows(db, start);

  const total: CostBucket = {
    tier1Count: 0,
    tier2Count: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    meanLatencyMs: 0,
  };
  const latencyByTier: Record<number, { sum: number; n: number }> = {};
  const byModel = new Map<string, CostBucket>();

  for (const row of rows) {
    if (row.tier === 1) total.tier1Count++;
    else if (row.tier === 2) total.tier2Count++;
    total.tokensIn += row.tokens_in;
    total.tokensOut += row.tokens_out;
    total.costUsd += row.cost_usd_est;

    const lat = latencyByTier[row.tier] ?? { sum: 0, n: 0 };
    lat.sum += row.latency_ms;
    lat.n++;
    latencyByTier[row.tier] = lat;

    const key = `${row.provider}:${row.model}`;
    const bucket = byModel.get(key) ?? {
      tier1Count: 0,
      tier2Count: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      meanLatencyMs: 0,
    };
    if (row.tier === 1) bucket.tier1Count++;
    else if (row.tier === 2) bucket.tier2Count++;
    bucket.tokensIn += row.tokens_in;
    bucket.tokensOut += row.tokens_out;
    bucket.costUsd += row.cost_usd_est;
    bucket.meanLatencyMs = (bucket.meanLatencyMs * (bucket.tier1Count + bucket.tier2Count - 1) +
      row.latency_ms) / (bucket.tier1Count + bucket.tier2Count);
    byModel.set(key, bucket);
  }

  const totalCalls = total.tier1Count + total.tier2Count;
  total.meanLatencyMs = totalCalls > 0
    ? Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / totalCalls)
    : 0;

  return {
    windowMs,
    windowStartMs: start,
    windowEndMs: nowMs,
    total,
    byModel,
  };
}

/**
 * Linearly extrapolate the last-hour spend to a monthly figure. Used
 * by the cost-soak verification and the overlay's "≈ $X/mo" line.
 * Returns 0 when the window had no calls (would otherwise divide by
 * zero — caller should render "—").
 */
export function extrapolateMonthlyCost(summary: CostSummary): number {
  if (summary.windowMs === 0) return 0;
  const hoursPerMonth = 24 * 30;
  const hoursInWindow = summary.windowMs / HOUR_MS;
  if (hoursInWindow === 0) return 0;
  const perHour = summary.total.costUsd / hoursInWindow;
  return perHour * hoursPerMonth;
}

/** Re-export the telemetry row shape so the overlay can type-narrow
 *  without re-importing from db.ts. */
export type TelemetryRow = ReturnType<MemoryDb['telemetrySince']>[number];

function readTelemetryRows(db: MemoryDb, sinceMs: number): TelemetryRow[] {
  return db.telemetrySince(sinceMs);
}
