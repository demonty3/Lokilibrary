/**
 * Tier-1 "living society" — terminal-land memory recording.
 *
 * Crossings + arrivals become plain 'observation' rows in the Smallville
 * memory stream through the injected MemoryWriter — the DB-backed writer
 * in the desktop wrapper (bootstrapMemory), the null writer on web. NO
 * Tier-1/Tier-2 dispatch fires from terminals: record only. (PRD-T2's
 * "Tier-1 perception fires on arrival" is deliberately deferred — the
 * no-LLM rail for this arc.)
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
