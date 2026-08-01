/**
 * Tier-1 "living society" — terminal-land memory recording.
 *
 * Crossings + arrivals become plain 'observation' rows in the Smallville
 * memory stream through the injected MemoryWriter — the DB-backed writer
 * in the desktop wrapper (bootstrapMemory), the null writer on web. As of
 * the T2 society migration (schema v3), crossings/arrivals carry their own
 * source tokens ('terminal_crossing' / 'terminal_arrival') and
 * terminalLand.ts dispatches Tier-1 on arrival. This module still only
 * records; the Tier-1 dispatch happens upstream.
 *
 * Every write is try/caught: terminal windows are separate renderer
 * processes sharing one memory.sqlite (WAL + busy_timeout), and write
 * contention must cost a lost observation, never a broken tick.
 */

import type { MemoryWriter } from '../agents/router';

/** Smallville importance for a cross-window move — between agent_meeting
 *  (6) and player_proximity (4): noteworthy, not headline. */
export const CROSSING_IMPORTANCE = 5;
/** Arrival in a land (spawn) — ambient, like cell_mount (3). */
export const ARRIVAL_IMPORTANCE = 3;

export function recordCrossing(
  writer: MemoryWriter,
  args: {
    agentId: string;
    fromWing: string;
    toWing: string;
    col: number;
    row: number;
    whenMs: number;
  },
): string | null {
  try {
    return writer.recordPerception(
      args.agentId,
      {
        kind: 'terminal_crossing',
        subject: `${args.fromWing}→${args.toWing}`,
        at: { x: args.col, y: args.row },
        when: args.whenMs,
      },
      CROSSING_IMPORTANCE,
    );
  } catch {
    return null;
  }
}

/** Palace launch-mark parity (cell.ts handleLaunch): importance 6. */
export const MARK_IMPORTANCE = 6;

/** Persist a land mark as a plan row — the palace's exact shape.
 *  status 'active' + step 'pending' is load-bearing: placedMarksForCell
 *  filters to exactly that pair; a 'done' step would be invisible to the
 *  read path. Try/caught like every write here. */
export function recordMark(
  writer: MemoryWriter,
  args: { agentId: string; note: string; col: number; row: number },
): string | null {
  try {
    return writer.recordPlan({
      agentId: args.agentId,
      text: args.note,
      steps: [{ kind: 'place_mark', location: { x: args.col, y: args.row }, status: 'pending' }],
      status: 'active',
      importance: MARK_IMPORTANCE,
    });
  } catch {
    return null;
  }
}

export function recordArrival(
  writer: MemoryWriter,
  args: { agentId: string; wing: string; col: number; row: number; whenMs: number },
): string | null {
  try {
    return writer.recordPerception(
      args.agentId,
      {
        kind: 'terminal_arrival',
        subject: args.wing,
        at: { x: args.col, y: args.row },
        when: args.whenMs,
      },
      ARRIVAL_IMPORTANCE,
    );
  } catch {
    return null;
  }
}
