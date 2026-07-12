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
 * Invoked through a cell-registered closure (the e2e-hook registration
 * pattern) because effects need the live layout: mountCell registers
 * stageNow at mount and runs it once (boot path); App.tsx's wake handler
 * calls callStageNow() (a day may roll over mid-sleep). Best-effort:
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

export function stageMissedDays(deps: StageDeps): StagedSummary {
  const today = dayKey(deps.now);
  const last = deps.writer.lastStagedDay();
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

  if (staged > 0) {
    calendarDispatch = {
      agentName: 'the palace',
      text: `kept its calendar. ${staged} thing${staged === 1 ? '' : 's'} changed while you were away.`,
      hadPlan: false,
    };
  }
  return { staged };
}

/** Cell-registered staging closure (last mount wins; cleared at
 *  teardown) — the e2e-hook registration pattern. */
let stageNow: (() => void) | null = null;
export function registerStageNow(fn: (() => void) | null): void {
  stageNow = fn;
}
export function callStageNow(): boolean {
  if (!stageNow) return false;
  stageNow();
  return true;
}
