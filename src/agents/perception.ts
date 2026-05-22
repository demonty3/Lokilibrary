/**
 * Per-agent perception. Each tick the cohort renderer asks every agent
 * "what do you see right now?" via `computePerception`; salient events
 * land in `runtime.perceptionQueue` and the router (router.ts) decides
 * whether they warrant a Tier-1 LLM call.
 *
 * FOV is a Chebyshev radius (`def.fov` cells). Inside the radius we
 * generate one event per (subject_id, kind) per tick — duplicates land
 * in the queue, but the salience filter (`isSalient`) drops them before
 * the router sees them so a single player-proximity hover doesn't fire
 * a Tier-1 call every 16ms.
 *
 * Event types in Phase 2C:
 *   - `player_proximity`     player entered FOV
 *   - `player_holding`       player has been in FOV for ≥3s (different cohort response)
 *   - `agent_meeting`        another cohort agent entered FOV
 *   - `bookshelf_in_reach`   bookshelf in FOV — least salient, agent-specific
 *
 * Game-launch + bookshelf-E events come from interaction handlers
 * (slice 2E), not from this poll loop — they're injected directly into
 * the queue.
 *
 * Phase 2D will add `salience_score` tuning to drop low-importance
 * events under cost pressure (telemetry-driven).
 */

import type { CellLayout, CellPoint } from '../procedural/cell';
import type { AgentDef } from './cohort';
import type {
  AgentRuntimeState,
  PerceptionEvent,
} from '../state/agentRuntime';

export interface WorldSnapshot {
  /** Player position in cell coords. */
  player: CellPoint;
  /** Other cohort agents — id → position. The agent being polled is
   *  passed in separately and filtered out before scoring. */
  agents: ReadonlyMap<string, CellPoint>;
  /** Bookshelf slot positions; used for `bookshelf_in_reach` events. */
  bookshelves: readonly CellPoint[];
}

export interface PerceptionOptions {
  /** Hold timer for `player_holding` — after this many ms of continuous
   *  proximity, emit a second-tier event. Default 3000ms. */
  playerHoldMs?: number;
  /** Salience window — same (subject, kind) won't re-fire within this
   *  many ms. Default 8000ms (Phase 2C; Phase 2F tunes via telemetry). */
  salienceWindowMs?: number;
}

const DEFAULT_PLAYER_HOLD_MS = 3000;
const DEFAULT_SALIENCE_WINDOW_MS = 8000;

/**
 * Build the perception event list for one agent this tick. **Stateful**
 * through `runtime.perceptionQueue` — appends new events; the router
 * drains the queue when it dispatches Tier 1.
 *
 * Returns the events appended this tick (also visible inside the
 * queue) so the cohort renderer can log them in dev mode.
 */
export function computePerception(
  def: AgentDef,
  runtime: AgentRuntimeState,
  world: WorldSnapshot,
  now: number,
  opts: PerceptionOptions = {},
  layout?: CellLayout,
): PerceptionEvent[] {
  const playerHoldMs = opts.playerHoldMs ?? DEFAULT_PLAYER_HOLD_MS;
  const salienceWindowMs = opts.salienceWindowMs ?? DEFAULT_SALIENCE_WINDOW_MS;

  if (!runtime.present) return [];

  const events: PerceptionEvent[] = [];
  const fov = def.fov;

  // --- player_proximity ---
  if (chebyshev(runtime, world.player) <= fov) {
    if (push(runtime, events, salienceWindowMs, now, {
      kind: 'player_proximity',
      subject: 'player',
      at: { x: world.player.x, y: world.player.y },
      when: now,
    })) {
      // Reset the hold timer on fresh proximity.
      proximitySince.set(runtime.id, now);
    } else if (proximitySince.has(runtime.id)) {
      // Already-tracked proximity; check hold.
      const since = proximitySince.get(runtime.id)!;
      if (now - since >= playerHoldMs && !holdFired.get(runtime.id)) {
        push(runtime, events, salienceWindowMs, now, {
          kind: 'player_holding',
          subject: 'player',
          at: { x: world.player.x, y: world.player.y },
          when: now,
        });
        holdFired.set(runtime.id, true);
      }
    }
  } else {
    proximitySince.delete(runtime.id);
    holdFired.delete(runtime.id);
  }

  // --- agent_meeting ---
  for (const [otherId, pos] of world.agents) {
    if (otherId === runtime.id) continue;
    if (chebyshev(runtime, pos) <= fov) {
      push(runtime, events, salienceWindowMs, now, {
        kind: 'agent_meeting',
        subject: otherId,
        at: { x: pos.x, y: pos.y },
        when: now,
      });
    }
  }

  // --- bookshelf_in_reach ---
  // Only fire for shelves at Chebyshev <= 1 (next to). Wider FOV would
  // spam events every cell hop; we want "agent paused near a shelf",
  // not "agent can see shelves in this room."
  for (let i = 0; i < world.bookshelves.length; i++) {
    const shelf = world.bookshelves[i];
    if (chebyshev(runtime, shelf) <= 1) {
      push(runtime, events, salienceWindowMs, now, {
        kind: 'bookshelf_in_reach',
        subject: `shelf:${i}`,
        at: { x: shelf.x, y: shelf.y },
        when: now,
      });
    }
  }

  // `layout` is unused for now — accepted for future spatial reasoning
  // (e.g. wall-occluded FOV). Suppress unused warning without changing
  // the export shape.
  void layout;

  return events;
}

/** Clear per-agent perception caches. Called by cohort renderer
 *  teardown so a remount doesn't carry over the "player was held"
 *  state from the previous cell. */
export function resetPerceptionState(): void {
  proximitySince.clear();
  holdFired.clear();
  lastSeen.clear();
}

// ---------- internals ----------

/**
 * Per-agent caches keyed by `runtime.id`. Module-level so they survive
 * across ticks but get cleared on cell remount via
 * `resetPerceptionState()`. Same pattern as `playerPos.ts`.
 */
const proximitySince = new Map<string, number>();
const holdFired = new Map<string, boolean>();

/** Salience window dedupe — `${agent_id}|${kind}|${subject}` → lastFireMs */
const lastSeen = new Map<string, number>();

function push(
  runtime: AgentRuntimeState,
  events: PerceptionEvent[],
  windowMs: number,
  now: number,
  ev: PerceptionEvent,
): boolean {
  if (!isSalient(runtime.id, ev, now, windowMs)) return false;
  events.push(ev);
  runtime.perceptionQueue.push(ev);
  return true;
}

function isSalient(
  agentId: string,
  ev: PerceptionEvent,
  now: number,
  windowMs: number,
): boolean {
  const key = `${agentId}|${ev.kind}|${ev.subject ?? ''}`;
  const last = lastSeen.get(key) ?? -Infinity;
  if (now - last < windowMs) return false;
  lastSeen.set(key, now);
  return true;
}

function chebyshev(a: CellPoint, b: CellPoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Direct event injection — slice 2E uses this for bookshelf-E +
 *  game-launch events that don't come from the poll loop. */
export function injectPerceptionEvent(
  runtime: AgentRuntimeState,
  ev: PerceptionEvent,
): void {
  runtime.perceptionQueue.push(ev);
}
