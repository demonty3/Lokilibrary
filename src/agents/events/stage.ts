/**
 * Events-calendar staging (spec 2026-07-12-events-calendar-design § 2).
 *
 * Walks real days elapsed since the last staged day (cap
 * CATCHUP_CAP_DAYS; first run = today only), asks the pure calendar
 * what happened each day, and materializes it: a ledger row (idempotent
 * on the day PK), a loki place_mark plan carrying the event's note (the
 * "legible" constraint — every event's rationale is findable on the
 * floor), and one world_event perception per staged event.
 *
 * Invoked through cell-registered closures (the registerCellPaneScope
 * pattern) because effects need the live layout: mountCell registers a
 * staging closure per pane at mount and runs it once (boot path);
 * App.tsx's wake handler calls callStageNow() (a day may roll over
 * mid-sleep), which runs every live pane's closure. Best-effort:
 * failures warn, never throw into mount or the wake handler.
 */

import {
  addDays,
  buildLibraryFacts,
  CATCHUP_CAP_DAYS,
  dayKey,
  daysBetween,
  eventForDay,
} from '../../procedural/calendar';
import type { LibraryGame } from '../../types';
import type { CellPoint } from '../../procedural/cell';
import type { AgentRuntimeState } from '../../state/agentRuntime';
import { broadcastWorldEvent, type MemoryWriter } from '../router';

export interface StageDeps {
  writer: MemoryWriter;
  games: readonly LibraryGame[] | null;
  profileSeed: number;
  /** Resolve a book's CURRENT base shelf slot; null if not shelved. */
  slotForAppid(appid: number): CellPoint | null;
  runtimes: readonly AgentRuntimeState[];
  now: Date;
}

export interface StagedSummary {
  staged: number;
}

/** One buffered banner line; drained by the morning-dispatch caller. */
let calendarDispatch: { agentName: string; text: string; hadPlan: boolean } | null = null;

export function consumeCalendarDispatch(): typeof calendarDispatch {
  const out = calendarDispatch;
  calendarDispatch = null;
  return out;
}

/** Whole-arc review fix 3 — a boot banner nudge. App.tsx's fixed 2.5s timer
 *  could race the profile-driven remount (the real-library staging often
 *  lands AFTER that timer already fired, silently dropping the "kept its
 *  calendar…" line). Instead, App.tsx registers a callback here once at
 *  mount; `stageMissedDays` calls it the instant a line is actually
 *  buffered, so the nudge only ever fires when there's something to show.
 *  Single ref (not a Set) — App.tsx is the sole owner. */
let onCalendarStaged: (() => void) | null = null;
export function registerCalendarStagedCallback(cb: (() => void) | null): void {
  onCalendarStaged = cb;
}

/** Session-level staging guard keyed by writer identity: the ledger is
 *  the real idempotence source (day PK), but the null writer has no
 *  ledger — without this, every cell remount in a web session re-walks
 *  today and re-broadcasts world_event perceptions. WeakMap so smoke
 *  fakes (distinct objects) stay independent while the null-writer
 *  singleton is guarded session-wide. */
const sessionStagedDay = new WeakMap<MemoryWriter, string>();

export function stageMissedDays(deps: StageDeps): StagedSummary {
  const today = dayKey(deps.now);
  const last = deps.writer.lastStagedDay() ?? sessionStagedDay.get(deps.writer) ?? null;
  // First run: today only. Otherwise from the day after `last`, capped to
  // the most recent CATCHUP_CAP_DAYS — a month away yields ≤7 rows and
  // older days collapse into quiet (the palace kept its calendar; it
  // does not flood the floor).
  let from = last === null ? today : addDays(last, 1);
  if (daysBetween(from, today) >= CATCHUP_CAP_DAYS) {
    from = addDays(today, -(CATCHUP_CAP_DAYS - 1));
  }
  if (daysBetween(from, today) < 0) return { staged: 0 };

  const facts = buildLibraryFacts(deps.games);
  let staged = 0;
  for (let d = from; daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    try {
      const event = eventForDay(d, deps.profileSeed, facts);
      if (!event) continue;
      deps.writer.recordWorldEvent(event);
      // The rationale mark: at the note's target slot, or the move
      // pair's first-book slot (the pair's shared shelf area).
      const anchorAppid = event.kind === 'note' ? event.target.appid : event.pair[0].appid;
      const slot = deps.slotForAppid(anchorAppid);
      if (slot) {
        deps.writer.recordPlan({
          agentId: 'loki',
          text: event.note,
          steps: [{ kind: 'place_mark', target: `shelf:${slot.x},${slot.y}`, location: slot, status: 'pending' }],
          status: 'active',
          importance: 6,
        });
      }
      broadcastWorldEvent(deps.runtimes, {
        day: event.day,
        kind: event.kind,
        at: slot ?? { x: 0, y: 0 },
        when: Date.now(),
      });
      staged++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[events] staging ${d} failed: ${(e as Error).message}`);
    }
  }

  sessionStagedDay.set(deps.writer, today);

  if (staged > 0) {
    calendarDispatch = {
      agentName: 'the palace',
      text: `kept its calendar. ${staged} thing${staged === 1 ? '' : 's'} changed while you were away.`,
      hadPlan: false,
    };
    onCalendarStaged?.();
  }
  return { staged };
}

/** Live cell-pane staging closures — the registerCellPaneScope pattern
 *  (`src/state/cellPaneScopes.ts`). A single last-mount-wins slot would
 *  drop every pane but the last in a split; the Set runs every live
 *  pane's closure on callStageNow(). */
const stageNowFns = new Set<() => void>();

/** Register a live cell pane's staging closure. Returns the unregister
 *  fn the cell's teardown calls (idempotent) — the registerCellPaneScope
 *  pattern. Every live pane's closure runs on callStageNow(); the
 *  ledger day-PK (or the session guard above) makes overlapping walks
 *  idempotent. */
export function registerStageNow(fn: () => void): () => void {
  stageNowFns.add(fn);
  return () => {
    stageNowFns.delete(fn);
  };
}
export function callStageNow(): boolean {
  if (stageNowFns.size === 0) return false;
  for (const fn of stageNowFns) {
    // Whole-arc review fix 4 — isolate each pane's closure so one pane's
    // staging failure doesn't skip the remaining panes' staging.
    try {
      fn();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[events] pane staging failed: ${(e as Error).message}`);
    }
  }
  return true;
}
