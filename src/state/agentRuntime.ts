/**
 * Per-agent runtime state — now PANE-SCOPED (Phase 7 / v2.x Composable
 * panes). Mutated at frame rate by the Tier 0 BT (src/agents/behavior.ts)
 * and by the perception layer (Phase 2C). Lives outside Zustand for the
 * same reason as `playerPos.ts`: 60Hz mutation would re-render every store
 * subscriber. The cohort renderer reads straight from this Map in its
 * Ticker.
 *
 * Pane-scoping: each cell pane owns its OWN `Map<agentId, state>` via a
 * `RuntimeScope` handle (created by the cell renderer at mount with
 * `createRuntimeScope()`). The scope-taking `*In(scope, …)` functions
 * operate on one pane's map; two cell panes therefore run two independent
 * cohorts with no key collision (the Phase 7-B deferred limitation this
 * removes). The RuntimeScope also carries the pane-local perception caches
 * (`scope.perception`) so the whole volatile-agent state for a pane threads
 * as ONE handle.
 *
 * Single-pane reduction: the existing module-global functions
 * (`setRuntime`/`getRuntime`/`deleteRuntime`/`listRuntimes`/`clearRuntimes`)
 * are retained as thin delegates over a module-local `DEFAULT_SCOPE`. With
 * the default single 'root' cell pane these are byte-identical to the
 * pre-pane-scoping singleton (same insertion-order Map, same semantics), so
 * every existing smoke + caller keeps working unchanged.
 *
 * On cell unmount the pane's scope is cleared so a remount (theme change,
 * player sign-in) doesn't surface stale positions from the previous room.
 * The `cell_id` namespace in the SQLite memory store keeps the PERSISTENT
 * memory stream cleanly separated from this volatile runtime — and stays
 * cell-keyed (by seed), NOT pane-scoped, so two panes of the same cell
 * correctly share persistent memory while keeping independent runtimes.
 *
 * Phase 2B fills in Tier-0 fields (currentAction / actionEndsAt).
 * Phase 2C+ extend with perceptionQueue + reflectionCounter + lastTier1At;
 * those are stubs here so the BT can read them without conditional shims.
 */

import type { CellPoint } from '../procedural/cell';
import type { PlanPayload } from '../agents/memory/schema';

/**
 * Discriminated union for what an agent is currently doing at Tier 0.
 * `wander` picks an adjacent floor cell each step; `idle` stands still;
 * `approach` walks one cell at a time toward a target; `scheduled` is
 * the cohort-rule label (e.g. "sleep_near_lamp" for Cat) which the BT
 * dispatches to per-agent code.
 */
export type Tier0Action =
  | { readonly kind: 'wander' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'approach'; readonly target: CellPoint }
  | { readonly kind: 'scheduled'; readonly label: string; readonly target?: CellPoint }
  /** Phase 7-D.2b — walk to a latched seam exit. Distinct from `approach` because
   *  it routes with BFS (obstacle-avoiding) rather than greedy Chebyshev: the
   *  carved opening often sits behind a shelf, and greedy gets stuck against the
   *  wall. Used ONLY for seam-seeking, so plan/schedule movement keeps its
   *  (verified) greedy stepping unchanged. */
  | { readonly kind: 'seek_seam'; readonly target: CellPoint };

/** Placeholder for Phase 2C's PerceptionEvent. Defined here so the
 *  runtime state shape stays stable across slices. */
export interface PerceptionEvent {
  readonly kind: string;
  readonly subject?: string;
  readonly at: CellPoint;
  readonly when: number;
}

export interface AgentRuntimeState {
  id: string;
  /** Cell-grid coordinate (not pixels). */
  x: number;
  y: number;
  /** Whether the sprite is visible this frame. Used for Visitor/Ghost
   *  schedules where the agent leaves the room entirely. */
  present: boolean;
  /** Current Tier-1-issued intent — free-form string the BT uses as a
   *  hint when scoring. Empty string means "no live intent". */
  intent: string;
  /** Perception events queued for next Tier-1 dispatch (Phase 2C). */
  perceptionQueue: PerceptionEvent[];
  /** Smallville reflection-trigger accumulator; fires Tier 2 at 150. */
  reflectionCounter: number;
  /** Timestamp of the last Tier-1 call — debounces back-to-back calls
   *  from the same perception burst. Time base is the caller's:
   *  `performance.now()` on the cell surface, `Date.now()` (epoch ms) on
   *  terminal lands, deliberately, because land minds cross process
   *  boundaries in seam handoffs and `performance.now()` doesn't survive
   *  that. The two bases must never be mixed for one agent. */
  lastTier1At: number;
  /** Phase 5 5A — performance.now() of the last Tier-2 reflection
   *  dispatch. Used by `routeTier2` to enforce the per-real-hour
   *  rate-limit (`REFLECTION_MIN_INTERVAL_MS`). Even when the
   *  reflectionCounter crosses threshold, Tier-2 won't fire again
   *  until this+interval has elapsed. Smallville's "queue events,
   *  fire one reflection per agent per real-world hour" semantic from
   *  PLAN.md § Phase 5. */
  lastReflectionAt: number;
  /** Phase 5 5A — the currently-active multi-step plan the agent is
   *  executing. Populated by `routeTier2` after a successful Tier-2
   *  dispatch parses a `plan` field from the reflection response.
   *  Cleared when all steps are complete (BT marks the last step
   *  done in `behavior.ts`). The Tier-0 BT scores an
   *  `execute_plan_step` candidate ahead of wander/idle whenever this
   *  is non-null and has pending steps. */
  activePlan: PlanPayload | null;
  /** Phase 5 5A — index of the next pending step in `activePlan.steps`.
   *  The BT advances this once the agent arrives at the current
   *  step's location (or immediately for steps without a location).
   *  When `activePlanStepIndex >= activePlan.steps.length`, the plan
   *  completes and `activePlan` is cleared. Reset to 0 when a new
   *  plan installs. */
  activePlanStepIndex: number;
  /** Current BT action — the BT swaps this when actionEndsAt elapses. */
  currentAction: Tier0Action;
  /** performance.now() at which the current action expires + the BT
   *  picks again. */
  actionEndsAt: number;
  /** Phase 7-D.2 — the live seam-crossing intent. When the Tier-0 BT
   *  picks a movement step that would EXIT this pane's interior AT an open
   *  walkable seam edge, it writes the target neighbour pane id + the
   *  bridged entry cell HERE instead of mutating x/y, and the cohort tick
   *  consumes it by calling `migrateRuntime`. `null` means "no cross
   *  pending" — the byte-identical single-pane default (no seam ⇒ behavior
   *  never sets this). MUST be cleared on a successful migrate (a stale
   *  intent travelling to the destination would re-fire = ping-pong). */
  pendingCross: { paneId: string; x: number; y: number } | null;
  /** Phase 7-D.2 — anti-ping-pong guard. When an agent migrates INTO a
   *  pane it lands ON the shared-edge entry cell, which is itself a
   *  seam-exit back toward the source. This records the cell it arrived
   *  at; behavior.ts SUPPRESSES emitting a new cross-intent while the agent
   *  still sits on that exact cell, and clears the guard once the agent has
   *  stepped strictly off it (into the interior). Deterministic (no
   *  wall-clock / no timer) so the share-URL reproducibility contract is
   *  untouched. `null` = not freshly arrived. */
  justArrivedAt: { x: number; y: number } | null;
  /** Phase 7-D.2b (Increment 2 — the observable walk) — DELIBERATE seam-seeking.
   *  When the BT chooses to cross (rather than waiting to randomly wander onto an
   *  exit), it latches the chosen exit here: `edge` is the interior edge cell to
   *  walk to, `entry` the bridged neighbour cell to migrate into on arrival. The
   *  BT scores an `approach` toward `edge`; the tick it arrives it writes
   *  `pendingCross = entry` and clears this. `null` = not seeking. Multi-pane
   *  ONLY — with no open seam exits the BT never latches it, so the single-pane
   *  walk is byte-identical. MUST be cleared on migrate (it names the OLD pane's
   *  exit; the agent re-evaluates seams in the destination next tick). */
  seamGoal: { edge: CellPoint; entry: { paneId: string; x: number; y: number } } | null;
  /** Phase 7-D.2b — performance.now() before which the agent won't latch a NEW
   *  seamGoal. Armed on each successful cross to a per-agent staggered interval
   *  so agents drift across one at a time and don't immediately re-seek the seam
   *  they just walked through (anti-oscillation, complements `justArrivedAt`). */
  seamCooldownUntil: number;
}

/**
 * Pane-local perception caches. The shape is OWNED by `perception.ts` (it
 * is the only module that reads/writes these); declared here so the
 * `RuntimeScope` can carry the perception state as one opaque handle
 * without `agentRuntime` importing `perception` internals. `createRuntimeScope`
 * fills these with empty Maps; `perception.ts`'s `computePerception` +
 * `resetPerceptionState` operate on them when a scope is threaded.
 *
 *   - proximitySince  agentId → ms the player entered FOV (hold timer)
 *   - holdFired       agentId → whether the player_holding event already fired
 *   - lastSeen        `${agentId}|${kind}|${subject}` → lastFireMs (salience dedupe)
 */
export interface PerceptionScope {
  readonly proximitySince: Map<string, number>;
  readonly holdFired: Map<string, boolean>;
  readonly lastSeen: Map<string, number>;
}

/**
 * One cell pane's volatile agent state: its runtime Map + its perception
 * caches. Created per pane by the cell renderer (`createRuntimeScope()`),
 * threaded into `mountCohort` + the cell's launch handler, and cleared on
 * teardown. Two panes' scopes never alias.
 */
export interface RuntimeScope {
  readonly runtimes: Map<string, AgentRuntimeState>;
  readonly perception: PerceptionScope;
}

/** Build a fresh, empty pane scope. */
export function createRuntimeScope(): RuntimeScope {
  return {
    runtimes: new Map<string, AgentRuntimeState>(),
    perception: {
      proximitySince: new Map<string, number>(),
      holdFired: new Map<string, boolean>(),
      lastSeen: new Map<string, number>(),
    },
  };
}

// ---------- scope-taking operations ----------

export function setRuntimeIn(scope: RuntimeScope, state: AgentRuntimeState): void {
  scope.runtimes.set(state.id, state);
}

export function getRuntimeIn(
  scope: RuntimeScope,
  id: string,
): AgentRuntimeState | undefined {
  return scope.runtimes.get(id);
}

export function deleteRuntimeIn(scope: RuntimeScope, id: string): void {
  scope.runtimes.delete(id);
}

/** Iterate over one pane's runtimes in insertion order. */
export function listRuntimesIn(scope: RuntimeScope): AgentRuntimeState[] {
  return Array.from(scope.runtimes.values());
}

export function clearRuntimesIn(scope: RuntimeScope): void {
  scope.runtimes.clear();
}

/**
 * Phase 7-D — migration primitive for same-level seam-crossing. Moves the SAME
 * `AgentRuntimeState` object from `from` to `to`, repositioning it to the
 * bridged destination cell. Handing the same object reference to `to` preserves
 * an in-flight plan / perception queue / reflection counter across the seam
 * with zero serialization (the whole point: volatile runtime migrates;
 * persistent memory is library-scoped + already shared, so there is nothing to
 * merge).
 *
 * Result discriminates so the caller can react without try/catch:
 *  - 'ok'        — migrated; `to` now has the id, `from` does not.
 *  - 'absent'    — `from` has no such runtime (nothing to move).
 *  - 'duplicate' — `to` ALREADY has that id. Under 7-D.1's per-pane model this
 *                  was the DEFAULT (every pane mounts all 5 agents, so 'loki'
 *                  already lives in `to`). Under 7-D.2's SINGLE ROAMING ROSTER
 *                  an agent lives in exactly ONE scope at a time, so 'duplicate'
 *                  should NEVER fire in normal flow — it is now a BACKSTOP /
 *                  bug-signal, not the expected path. The cross is REFUSED —
 *                  the agent stays in `from`, unchanged (no vanish).
 *
 * On a successful move the agent's entries in `from`'s perception caches
 * (proximitySince / holdFired) are cleared so the departed agent doesn't leave
 * a stale FOV hold timer in the source pane (mirrors resetPerceptionState
 * discipline, per-agent). The salience `lastSeen` cache is intentionally NOT
 * swept: its keys are `${perceiverId}|${kind}|${subject}`, so the departed
 * agent's entries (`loki|...`) only matter if `loki` is perceived FROM `from`
 * again — i.e. only if it migrates BACK within the 8s salience window, in which
 * case suppressing the re-fire is correct dedup, not a bug. Clearing it would be
 * harmless but unnecessary; leaving it avoids a Map scan on the crossing path.
 *
 * This is the no-dup/no-leak chokepoint: a SINGLE delete + a SINGLE set of the
 * SAME object. Never copy; never set-without-delete (that would tick the agent
 * in both panes = two sprites, two BT walks, double Tier-1 cost).
 */
export type MigrateResult = 'ok' | 'absent' | 'duplicate';

export function migrateRuntime(
  from: RuntimeScope,
  to: RuntimeScope,
  id: string,
  newX: number,
  newY: number,
): MigrateResult {
  const rt = from.runtimes.get(id);
  if (!rt) return 'absent';
  if (to.runtimes.has(id)) return 'duplicate'; // duplicate-identity guard
  from.runtimes.delete(id);
  // Clear the departed agent's per-agent FOV/hold state in the source scope so
  // a now-absent agent can't mis-fire a perception event from a stale timer.
  from.perception.proximitySince.delete(id);
  from.perception.holdFired.delete(id);
  rt.x = newX;
  rt.y = newY;
  // Phase 7-D.2 — the intent is consumed: drop it so the SAME object arriving
  // in `to` does not re-fire a cross on its next tick (ping-pong root cause).
  rt.pendingCross = null;
  // Stamp the entry cell as just-arrived. behavior.ts refuses to emit a fresh
  // cross-intent while the agent still sits here, so it can't immediately
  // bounce back across the seam it just walked through. Cleared once the agent
  // steps strictly off this cell (deterministic, no wall-clock).
  rt.justArrivedAt = { x: newX, y: newY };
  // Phase 7-D.2b — the latched goal named the SOURCE pane's exit; drop it so the
  // agent re-evaluates the destination pane's seams afresh next tick. The
  // cooldown is deliberately NOT reset: it was just armed at cross-time and
  // travels with this object to gate immediate re-seeking in the new pane.
  rt.seamGoal = null;
  to.runtimes.set(id, rt);
  return 'ok';
}

// ---------- back-compat module globals (delegate to DEFAULT_SCOPE) ----------

/**
 * The default scope backs the legacy module-global functions. With the
 * single 'root' cell pane this IS the world's runtime map — byte-identical
 * to the pre-pane-scoping singleton (same Map identity per process, same
 * insertion order, same undefined-on-miss). Eagerly created at module load
 * so the very first global call sees a real Map. Exported so callers that
 * want the focused/default pane explicitly (App.tsx, sleep-reflection in the
 * single-pane fallback) can reference it.
 */
export const DEFAULT_SCOPE = createRuntimeScope();

export function setRuntime(state: AgentRuntimeState): void {
  setRuntimeIn(DEFAULT_SCOPE, state);
}

export function getRuntime(id: string): AgentRuntimeState | undefined {
  return getRuntimeIn(DEFAULT_SCOPE, id);
}

export function deleteRuntime(id: string): void {
  deleteRuntimeIn(DEFAULT_SCOPE, id);
}

/** Iterate over all known runtimes in insertion order. */
export function listRuntimes(): AgentRuntimeState[] {
  return listRuntimesIn(DEFAULT_SCOPE);
}

export function clearRuntimes(): void {
  clearRuntimesIn(DEFAULT_SCOPE);
}

/** Convenience constructor with sensible defaults. */
export function initialRuntime(args: {
  id: string;
  x: number;
  y: number;
  present?: boolean;
}): AgentRuntimeState {
  return {
    id: args.id,
    x: args.x,
    y: args.y,
    present: args.present ?? true,
    intent: '',
    perceptionQueue: [],
    reflectionCounter: 0,
    lastTier1At: 0,
    lastReflectionAt: 0,
    activePlan: null,
    activePlanStepIndex: 0,
    currentAction: { kind: 'idle' },
    actionEndsAt: 0,
    pendingCross: null,
    justArrivedAt: null,
    seamGoal: null,
    seamCooldownUntil: 0,
  };
}
