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
import type { SeamExit } from '../state/seams';

export interface BehaviorContext {
  readonly layout: CellLayout;
  /** Per-agent PRNG. Built once at cohort mount; shared across ticks. */
  readonly prngs: ReadonlyMap<string, Prng>;
  /** Glyph → cells anchor index for `bias_idle_near_glyph` schedule
   *  rules. Populated from the cell's scatter pass at mount time. */
  readonly scatterAnchors: ReadonlyMap<string, readonly CellPoint[]>;
  /** Wall clock in hours-of-day (0..24); injected for testability. */
  readonly wallClockHour: () => number;
  /** Phase 7-D.2 — open walkable seam exits for THIS pane, keyed by the
   *  interior edge cell ("x,y") the agent must be at to cross. Built once
   *  per cohort mount from `seamExitsForPane(buildSeams(...), paneId, dims)`.
   *  EMPTY (or omitted) for a single 'root' pane — no seam ⇒ no exits ⇒ the
   *  crossing branch is dead and the wander walk is byte-identical to today. */
  readonly seamExits?: ReadonlyMap<string, SeamExit>;
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

  // Phase 7-D.2 — clear the anti-ping-pong guard once the agent is no longer
  // sitting on the cell it migrated into. Until then the cross-intent branch
  // is suppressed so a just-arrived agent can't immediately re-cross the seam
  // it just walked through. Deterministic (position-based, no wall-clock).
  if (
    runtime.justArrivedAt &&
    (runtime.x !== runtime.justArrivedAt.x || runtime.y !== runtime.justArrivedAt.y)
  ) {
    runtime.justArrivedAt = null;
  }

  // Phase 7-D.2b (Increment 2) — deliberate seam-seeking. Multi-pane only; a
  // no-op (and clears any stale goal) when this pane has no open seam exits, so
  // the single-pane walk is byte-identical. Latches the nearest exit so the BT
  // below can score an approach toward it and the agent actually crosses.
  maybeSeekSeam(runtime, ctx, nowMs);

  // Phase 5 5A — advance the active plan if the current step is
  // "complete" (we're at the step's target location, or the step
  // has no location and at least one BT cycle has elapsed since
  // installing it). Called BEFORE the action-still-running check so
  // the plan progresses across cycles, not just on action picks.
  tryAdvancePlanStep(runtime);

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

  // Phase 5 5A — Tier-2 reflection plan execution. Score the current
  // pending step at 0.75 — above the intent-driven approach (0.7) so
  // a Tier-2 plan beats a stale Tier-1 intent, below the highest
  // schedule peaks (e.g. visit_window at 0.8) so character-defining
  // schedule rules still win when they fire. The result: the agent
  // walks the plan as a backbone, with schedule rules adding flavor
  // when they're salient.
  if (runtime.activePlan && runtime.activePlanStepIndex < runtime.activePlan.steps.length) {
    const step = runtime.activePlan.steps[runtime.activePlanStepIndex];
    const action = planStepToAction(step);
    if (action) candidates.push({ score: 0.75, action, source: 'plan-step' });
  }

  // Phase 7-D.2b — walk toward a latched seam exit. Scored 0.6: above
  // wander (0.4) / idle (0.2) so a chosen cross actually happens, but below the
  // plan-step (0.75), live intent (0.7) and schedule peaks (0.8) so a Tier-2
  // plan or a character-defining schedule rule still wins — the cross reads as a
  // background drift between rooms, not a compulsion.
  if (runtime.seamGoal) {
    candidates.push({ score: 0.6, action: { kind: 'approach', target: runtime.seamGoal.edge } });
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

  // Phase 5 5A — if we picked the plan-step candidate AND the step has
  // no location, the step completes in this single cycle (linger /
  // idle / wander all have no spatial target to "arrive at"). Advance
  // the index now so the next BT pick sees the next pending step.
  // Location-bearing steps advance via tryAdvancePlanStep when the
  // agent's (x, y) matches the step's location next cycle.
  if (best.source === 'plan-step' && runtime.activePlan) {
    const idx = runtime.activePlanStepIndex;
    const step = runtime.activePlan.steps[idx];
    if (step && !step.location) {
      runtime.activePlanStepIndex = idx + 1;
      if (runtime.activePlanStepIndex >= runtime.activePlan.steps.length) {
        runtime.activePlan = null;
        runtime.activePlanStepIndex = 0;
      }
    }
  }

  // Phase 7-D.2b — arrived at the latched seam edge → cross. Write pendingCross
  // (the cohort tick performs the single migrate), clear the goal, and arm the
  // staggered cooldown so the agent settles in the neighbour before seeking
  // again — no bounce back across the seam it just walked through. Fires the
  // tick the agent steps ONTO the edge cell (stepTowardTarget moved it here this
  // cycle), so there's no visible "stuck on the wall" beat.
  if (
    runtime.seamGoal &&
    runtime.x === runtime.seamGoal.edge.x &&
    runtime.y === runtime.seamGoal.edge.y
  ) {
    runtime.pendingCross = runtime.seamGoal.entry;
    runtime.seamGoal = null;
    runtime.seamCooldownUntil = nowMs + seamCooldownMs(def.id);
  }

  return best.action;
}

interface ScoredAction {
  score: number;
  action: Tier0Action;
  /** Phase 5 5A — tag plan-step candidates so the post-pick handler
   *  can advance no-location steps after execution. Schedule + base
   *  + intent candidates leave this undefined. */
  source?: 'plan-step';
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

/** Phase 5 5A — advance `runtime.activePlanStepIndex` for
 *  location-bearing steps where the agent has arrived. No-location
 *  steps (linger / idle / wander mappings) are advanced *after*
 *  execution by the post-pick handler in tickBehavior; advancing
 *  them HERE would skip them before the BT got a chance to pick
 *  their action.
 *
 *  Approach takes one BT pick per cell-step; a 5-cell path completes
 *  after ~5 picks (one per stepTowardTarget call).
 *  When all steps are done, clears `runtime.activePlan` so the BT
 *  falls back to wander/idle/schedule until the next reflection. */
function tryAdvancePlanStep(runtime: AgentRuntimeState): void {
  const plan = runtime.activePlan;
  if (!plan) return;
  const idx = runtime.activePlanStepIndex;
  if (idx >= plan.steps.length) {
    runtime.activePlan = null;
    runtime.activePlanStepIndex = 0;
    return;
  }
  const step = plan.steps[idx];
  // No-location steps wait for the post-pick handler — don't advance
  // here.
  if (!step.location) return;
  const atTarget = runtime.x === step.location.x && runtime.y === step.location.y;
  if (!atTarget) return;
  runtime.activePlanStepIndex = idx + 1;
  if (runtime.activePlanStepIndex >= plan.steps.length) {
    runtime.activePlan = null;
    runtime.activePlanStepIndex = 0;
  }
}

/** Map a `PlanStep` to a `Tier0Action`. Phase 5 5A — used by the BT
 *  to translate Tier-2 reflection plans into existing Tier-0 primitives.
 *  Returns null only when the step kind is somehow unknown (shouldn't
 *  happen — the Worker whitelists the 5 PlanStepKinds before sending). */
function planStepToAction(step: {
  readonly kind: 'move_to' | 'inspect' | 'place_mark' | 'linger' | 'withdraw';
  readonly location?: CellPoint;
}): Tier0Action | null {
  switch (step.kind) {
    case 'move_to':
    case 'inspect':
    case 'place_mark':
      // All three want the agent at a specific location. inspect +
      // place_mark differ from move_to only in their visible
      // marginalia output — for the BT they're identical "walk
      // there" actions. The marginalia rendering for place_mark
      // already happens at recordPlan time via cell.ts:179
      // (Phase 2E path); the agent's visit is the *temporal*
      // contribution this slice adds.
      if (step.location) {
        return { kind: 'approach', target: step.location };
      }
      // Step without a location → just one beat of idle, completes
      // on next BT cycle (no location ⇒ tryAdvancePlanStep
      // auto-advances).
      return { kind: 'idle' };
    case 'linger':
      return { kind: 'idle' };
    case 'withdraw':
      // Walk somewhere else — Tier-0 wander is the simplest "move
      // away" primitive. A future slice could do a target-aware
      // "walk opposite of target" but wander reads as character-
      // appropriate uncertainty.
      return { kind: 'wander' };
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

/** Sentinel appended to the wander candidate pool to represent "step OFF the
 *  edge across the open seam" — picked like any other neighbour so the
 *  per-agent PRNG stays the single source of which direction the agent walks
 *  (determinism preserved). Carries the bridged entry the cohort migrates to. */
const CROSS_SENTINEL = '__cross__' as const;
type WanderCandidate =
  | CellPoint
  | { readonly [CROSS_SENTINEL]: true; readonly paneId: string; readonly x: number; readonly y: number };

function stepRandom(
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
  prng: Prng,
): void {
  const neighbours = walkableNeighbours(ctx.layout, runtime.x, runtime.y);

  // Phase 7-D.2 — if the agent stands on an open walkable seam-exit edge cell
  // (and isn't under the just-arrived guard), offer "step off the edge across
  // the seam" as ONE extra wander candidate, appended at a FIXED position
  // (after the in-bounds neighbours) so the PRNG pick is reproducible. When
  // picked we set runtime.pendingCross instead of mutating x/y — the cohort
  // tick performs the single migrate. No seam exit here ⇒ empty/undefined
  // map ⇒ this is a no-op and the wander walk is byte-identical to today.
  const candidates: WanderCandidate[] = neighbours.slice();
  const exit =
    runtime.justArrivedAt === null
      ? ctx.seamExits?.get(`${runtime.x},${runtime.y}`)
      : undefined;
  if (exit) {
    candidates.push({ [CROSS_SENTINEL]: true, paneId: exit.entry.paneId, x: exit.entry.x, y: exit.entry.y });
  }

  if (candidates.length === 0) return;
  const pick = prng.pick(candidates);
  if (CROSS_SENTINEL in pick) {
    // Cross picked — record the intent; do NOT mutate x/y (exactly-once move:
    // the cohort's migrateRuntime is the sole mover).
    runtime.pendingCross = { paneId: pick.paneId, x: pick.x, y: pick.y };
    return;
  }
  runtime.x = pick.x;
  runtime.y = pick.y;
}

/**
 * Phase 7-D.2b (Increment 2 — the observable walk) — DELIBERATE seam-seeking.
 * Multi-pane only: when this pane exposes open walkable seam exits and the agent
 * is neither freshly-arrived nor cooling down, latch the NEAREST exit as a goal
 * so the BT walks the agent to the seam and crosses — making the A→B walk happen
 * on purpose instead of waiting on a lucky random wander onto an exit cell
 * (`stepRandom`'s probabilistic branch, which still exists as a fallback).
 *
 * Determinism: "nearest" is Chebyshev, tie-broken by the exits map's key order
 * (which `seamExitsForPane` builds deterministically), and the cooldown stagger
 * is an id hash — so this draws NOTHING from the wander PRNG and the wander
 * sequence stays byte-identical. No exits (single pane) ⇒ clears any goal and
 * returns ⇒ the BT below behaves exactly as before seams existed.
 */
function maybeSeekSeam(
  runtime: AgentRuntimeState,
  ctx: BehaviorContext,
  nowMs: number,
): void {
  const exits = ctx.seamExits;
  if (!exits || exits.size === 0) {
    runtime.seamGoal = null; // single-pane / seam closed → never seeking
    return;
  }
  // Just walked in across a seam → let the agent step into the interior before
  // it considers seeking again (works with `justArrivedAt` + the cooldown to
  // stop an immediate bounce back).
  if (runtime.justArrivedAt) return;
  // Drop a stale goal whose exit no longer exists (pane closed / re-split).
  if (runtime.seamGoal && !exits.has(`${runtime.seamGoal.edge.x},${runtime.seamGoal.edge.y}`)) {
    runtime.seamGoal = null;
  }
  if (runtime.seamGoal) return; // already seeking — hold the target
  if (nowMs < runtime.seamCooldownUntil) return; // settling after a recent cross

  let best: SeamExit | null = null;
  let bestD = Infinity;
  for (const exit of exits.values()) {
    const d = chebyshev(runtime, exit.edge);
    if (d < bestD) {
      bestD = d;
      best = exit;
    }
  }
  if (best) runtime.seamGoal = { edge: best.edge, entry: best.entry };
}

/**
 * Per-agent staggered cooldown (ms) armed after a seam crossing. A fixed base
 * plus an id-derived spread so the five agents don't cross in lockstep and a
 * just-crossed agent settles before seeking again. Derived from an FNV-1a hash
 * of the agent id — NOT the wander PRNG — so it neither perturbs the wander
 * sequence nor depends on draw count.
 */
function seamCooldownMs(id: string): number {
  const BASE_MS = 6000;
  const SPREAD_MS = 6000;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return BASE_MS + ((h >>> 0) % SPREAD_MS);
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
