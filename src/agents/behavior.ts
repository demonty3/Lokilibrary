/**
 * Tier-0 behaviour tree — utility-AI scoring. Every tick (per-agent
 * cadence in `cohort.tier0StepMs`) we compute a score for each
 * candidate action, pick the max, and execute. **No LLM call lives in
 * this file.** Tier 1 dispatch is slice 2C; Tier 2 reflection is slice
 * 2D. Tier 0 is the cheap default — it's what runs when nothing
 * salient is happening, which is almost always.
 *
 * Determinism: each agent gets its own `mulberry32(seed ^ agentSalt)`
 * PRNG, so the same seed produces the same wander walk across runs
 * (matching the procedural-layer contract). PRNGs live in
 * `BehaviorContext.prngs` keyed by agent_id; the cohort renderer
 * constructs them once at mount.
 *
 * Action scoring weights are tuned by feel — Phase 2 starts with these
 * and Phase 2F telemetry will tell us if Cat is too idle or Loki too
 * twitchy. Adjust here, not by editing schedule rules.
 */

import type { CellLayout, CellPoint } from '../procedural/cell';
import { T_FLOOR } from '../procedural/tiles/library';
import type { Prng } from '../procedural/prng';
import type { AgentDef, ScheduleRule } from './cohort';
import type { AgentRuntimeState, Tier0Action } from '../state/agentRuntime';

export interface BehaviorContext {
  readonly layout: CellLayout;
  /** Per-agent PRNG. Built once at cohort mount; shared across ticks. */
  readonly prngs: ReadonlyMap<string, Prng>;
  /** Glyph → cells anchor index for `bias_idle_near_glyph` schedule
   *  rules. Populated from the cell's scatter pass at mount time. */
  readonly scatterAnchors: ReadonlyMap<string, readonly CellPoint[]>;
  /** Wall clock in hours-of-day (0..24); injected for testability. */
  readonly wallClockHour: () => number;
}

/** Score-and-execute one BT step for one agent. Mutates `runtime` in
 *  place. Returns the action that ran (useful for telemetry / tests). */
export function tickBehavior(
  def: AgentDef,
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
  nowMs: number,
): Tier0Action {
  if (!runtime.present) return { kind: 'idle' };

  if (nowMs < runtime.actionEndsAt && runtime.currentAction.kind !== 'idle') {
    // Action still running. The Pixi Ticker drives this at ~60Hz; the
    // action's per-step cadence is `tier0StepMs`, so we hold position
    // until the action ends and the BT re-scores. (Previously this
    // branch re-ran executeAction every frame, producing ~24 random
    // wander steps per Tier-0 interval — the "letters moving fast"
    // bug.)
    return runtime.currentAction;
  }

  const candidates: ScoredAction[] = [];

  // Baseline actions — always in the pool.
  candidates.push({ score: 0.4, action: { kind: 'wander' } });
  candidates.push({ score: 0.2, action: { kind: 'idle' } });

  if (runtime.intent.length > 0) {
    // Phase 2C populates intent with a Tier-1-issued goal. For Phase 2B
    // it's never set, so this branch stays dormant unless tests
    // pre-seed an intent.
    const target = parseIntentTarget(runtime.intent);
    if (target) {
      candidates.push({ score: 0.7, action: { kind: 'approach', target } });
    }
  }

  // Schedule-driven candidates.
  for (const rule of def.schedule) {
    const scored = scoreSchedule(rule, def, runtime, ctx);
    if (scored) candidates.push(scored);
  }

  // Pick the highest-scoring action. Ties broken by insertion order
  // (i.e., baseline before schedule) — deliberate, keeps Tier 0
  // boring + predictable.
  let best: ScoredAction = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].score > best.score) best = candidates[i];
  }

  runtime.currentAction = best.action;
  runtime.actionEndsAt = nowMs + def.tier0StepMs;
  executeAction(best.action, runtime, def, ctx);
  return best.action;
}

interface ScoredAction {
  score: number;
  action: Tier0Action;
}

function scoreSchedule(
  rule: ScheduleRule,
  _def: AgentDef,
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
): ScoredAction | null {
  switch (rule.kind) {
    case 'visit_window_at_hours': {
      const h = ctx.wallClockHour();
      if (h >= rule.startHour && h < rule.endHour) {
        const target = { x: ctx.layout.windowAt.x, y: ctx.layout.windowAt.y + 1 };
        const floorTarget = nudgeOntoFloor(ctx.layout, target);
        return {
          score: 0.8,
          action: { kind: 'scheduled', label: 'visit_window', target: floorTarget },
        };
      }
      return null;
    }
    case 'bias_idle_near_glyph': {
      const anchors = ctx.scatterAnchors.get(rule.glyph);
      if (!anchors || anchors.length === 0) return null;
      const nearest = nearestAnchor(anchors, runtime);
      const dist = chebyshev(runtime, nearest);
      if (dist <= 1) {
        // Already next to anchor — strongly bias idle.
        return {
          score: 0.5 + rule.bias,
          action: { kind: 'scheduled', label: 'rest_near_anchor' },
        };
      }
      // Otherwise approach the anchor — score climbs the closer we
      // already are (so Cat doesn't sprint across the room every tick).
      const proximityBonus = Math.max(0, 0.2 - dist * 0.02);
      return {
        score: 0.45 + proximityBonus,
        action: { kind: 'scheduled', label: 'seek_anchor', target: nearest },
      };
    }
    case 'intermittent_presence':
    case 'rare_appearance':
      // These don't pick actions — they gate runtime.present. Handled
      // by tickPresence (called separately from cohort renderer).
      return null;
  }
}

function executeAction(
  action: Tier0Action,
  runtime: AgentRuntimeState,
  def: AgentDef,
  ctx: BehaviorContext,
): void {
  const prng = ctx.prngs.get(def.id);
  if (!prng) return;

  switch (action.kind) {
    case 'idle':
      return;
    case 'wander':
      stepRandom(runtime, ctx, prng);
      return;
    case 'approach':
    case 'scheduled': {
      const target = action.kind === 'approach' ? action.target : action.target;
      if (!target) {
        // Scheduled action without a target — sit (e.g. rest_near_anchor).
        return;
      }
      stepTowardTarget(runtime, ctx, target);
      return;
    }
  }
}

function stepRandom(
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
  prng: Prng,
): void {
  const candidates = walkableNeighbours(ctx.layout, runtime.x, runtime.y);
  if (candidates.length === 0) return;
  const pick = prng.pick(candidates);
  runtime.x = pick.x;
  runtime.y = pick.y;
}

function stepTowardTarget(
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
  target: CellPoint,
): void {
  if (runtime.x === target.x && runtime.y === target.y) return;
  const candidates = walkableNeighbours(ctx.layout, runtime.x, runtime.y);
  if (candidates.length === 0) return;
  // Pick the neighbour with smallest Chebyshev distance to target.
  let best = candidates[0];
  let bestDist = chebyshev(best, target);
  for (let i = 1; i < candidates.length; i++) {
    const d = chebyshev(candidates[i], target);
    if (d < bestDist) {
      bestDist = d;
      best = candidates[i];
    }
  }
  runtime.x = best.x;
  runtime.y = best.y;
}

function walkableNeighbours(
  layout: CellLayout,
  x: number,
  y: number,
): CellPoint[] {
  const out: CellPoint[] = [];
  const steps: ReadonlyArray<[number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const [dx, dy] of steps) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= layout.width || ny < 0 || ny >= layout.height) continue;
    if (layout.tiles[ny][nx] === T_FLOOR) out.push({ x: nx, y: ny });
  }
  return out;
}

function chebyshev(a: CellPoint, b: CellPoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function nearestAnchor(
  anchors: readonly CellPoint[],
  from: CellPoint,
): CellPoint {
  let best = anchors[0];
  let bestD = chebyshev(best, from);
  for (let i = 1; i < anchors.length; i++) {
    const d = chebyshev(anchors[i], from);
    if (d < bestD) {
      bestD = d;
      best = anchors[i];
    }
  }
  return best;
}

function nudgeOntoFloor(layout: CellLayout, p: CellPoint): CellPoint {
  if (
    p.x >= 0 &&
    p.x < layout.width &&
    p.y >= 0 &&
    p.y < layout.height &&
    layout.tiles[p.y][p.x] === T_FLOOR
  ) {
    return p;
  }
  // Walk south (+y) until we hit floor — covers the visit_window case
  // where the target is "below the window glyph".
  for (let dy = 1; dy < layout.height; dy++) {
    const ny = p.y + dy;
    if (ny >= layout.height) break;
    if (layout.tiles[ny][p.x] === T_FLOOR) return { x: p.x, y: ny };
  }
  return layout.spawnAt;
}

/**
 * Parse a free-form intent string for an `approach <x>,<y>` target.
 * Phase 2C's router will issue these; Phase 2B just defines the format
 * so behavior.ts is forward-compatible.
 *
 * Format: `approach 12,7` → { x: 12, y: 7 }. Returns null on any other
 * shape (intent may also be e.g. `inspect shelf:hades`, which Phase 2D
 * will route differently).
 */
function parseIntentTarget(intent: string): CellPoint | null {
  const m = /^approach\s+(-?\d+)\s*,\s*(-?\d+)$/.exec(intent);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

// ---------- presence (Visitor + Ghost) ----------

/** Update `runtime.present` based on intermittent / rare-appearance
 *  schedule rules. Called by the cohort renderer alongside tickBehavior;
 *  uses `mountedAt` so cycles start from cell mount, not Unix epoch
 *  (otherwise Visitor's first "absent" window would land randomly). */
export function tickPresence(
  def: AgentDef,
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
  mountedAt: number,
  nowMs: number,
): void {
  for (const rule of def.schedule) {
    if (rule.kind === 'intermittent_presence') {
      const cycle = rule.visitMs + rule.absenceMs;
      const t = (nowMs - mountedAt) % cycle;
      runtime.present = t < rule.visitMs;
      return;
    }
    if (rule.kind === 'rare_appearance') {
      // Probabilistic: each tick has ~`appearanceChancePerMin/60_000 * dtMs`
      // chance of toggling presence. For Phase 2B we approximate by
      // checking once per (call) and using the per-agent PRNG.
      const prng = ctx.prngs.get(def.id);
      if (!prng) return;
      // Roll once per ~10 seconds to avoid spam. Compress to a coarse tick.
      const tenSecondBucket = Math.floor((nowMs - mountedAt) / 10_000);
      const seedRoll = mixBuckets(def.id, tenSecondBucket);
      const stable = stableRoll(seedRoll);
      runtime.present = stable < rule.appearanceChancePerMin / 6; // /6 because 10s buckets
      return;
    }
  }
}

function mixBuckets(id: string, bucket: number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= bucket;
  h = Math.imul(h, 16777619) >>> 0;
  return h >>> 0;
}

function stableRoll(seed: number): number {
  // Single Mulberry32 step against `seed`, return [0,1).
  let s = (seed + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
