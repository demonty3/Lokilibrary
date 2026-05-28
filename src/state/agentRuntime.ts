/**
 * Per-agent runtime state. Mutated at frame rate by the Tier 0 BT
 * (src/agents/behavior.ts) and by the perception layer (Phase 2C). Lives
 * outside Zustand for the same reason as `playerPos.ts`: 60Hz mutation
 * would re-render every store subscriber. The cohort renderer reads
 * straight from this Map in its Ticker.
 *
 * On cell unmount the Map is cleared so a remount (theme change, player
 * sign-in) doesn't surface stale positions from the previous room. The
 * `cell_id` namespace in the SQLite memory store keeps the persistent
 * memory stream cleanly separated from this volatile runtime.
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
  | { readonly kind: 'scheduled'; readonly label: string; readonly target?: CellPoint };

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
  /** performance.now() of the last Tier-1 call — debounces back-to-back
   *  calls from the same perception burst. */
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
}

const runtimes = new Map<string, AgentRuntimeState>();

export function setRuntime(state: AgentRuntimeState): void {
  runtimes.set(state.id, state);
}

export function getRuntime(id: string): AgentRuntimeState | undefined {
  return runtimes.get(id);
}

export function deleteRuntime(id: string): void {
  runtimes.delete(id);
}

/** Iterate over all known runtimes in insertion order. */
export function listRuntimes(): AgentRuntimeState[] {
  return Array.from(runtimes.values());
}

export function clearRuntimes(): void {
  runtimes.clear();
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
  };
}
