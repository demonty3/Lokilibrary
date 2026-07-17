/**
 * T2 society migration — pure renderer-side society helpers
 * (docs/superpowers/specs/2026-07-17-t2-society-migration-design.md).
 *
 * The main-process broker owns HOMES (agentId → wing, persisted in
 * config); this module answers "who lives on THIS land" and packs/
 * unpacks the mind half of a seam handoff. NO PIXI, NO IPC — the
 * smoke drives everything headlessly.
 */

import type { AgentRuntimeState, PerceptionEvent } from '../state/agentRuntime';
import { initialRuntime } from '../state/agentRuntime';
import { COHORT } from '../agents/cohort';

/** Cohort ids in COHORT order — the round-robin order the broker mirrors
 *  (desktop/src/terminals.ts SOCIETY_IDS; desktop compiles separately, so
 *  it keeps a literal copy the way preload mirrors TerminalBeingState). */
export const SOCIETY_IDS: readonly string[] = COHORT.map((d) => d.id);

/** Which cohort members live on `wing`. A null society means no broker
 *  (web preview / missing preload): the lone land hosts everyone. */
export function residentsOf(
  society: Record<string, string> | null,
  wing: string,
): string[] {
  if (!society) return [...SOCIETY_IDS];
  return SOCIETY_IDS.filter((id) => society[id] === wing);
}

/** The mind half of a handoff — plain JSON, broker-opaque. The queue is
 *  usually empty (dispatch drains it) but a THROTTLED arrival leaves its
 *  event queued; carrying it means no perception is ever lost at a seam. */
export interface CarriedMind {
  lastTier1At: number;
  reflectionCounter: number;
  perceptionQueue: PerceptionEvent[];
}

export function carriedFromMind(mind: AgentRuntimeState): CarriedMind {
  return {
    lastTier1At: mind.lastTier1At,
    reflectionCounter: mind.reflectionCounter,
    perceptionQueue: [...mind.perceptionQueue],
  };
}

/** migrateRuntime-over-IPC, arrival side: a REAL runtime via
 *  initialRuntime + the carried mind fields overlaid. Everything else
 *  (intent, plans, seam state) starts fresh — those are cell-surface
 *  concepts the land does not run. */
export function reconstructMind(
  id: string,
  x: number,
  y: number,
  carried?: CarriedMind,
): AgentRuntimeState {
  const mind = initialRuntime({ id, x, y });
  if (carried) {
    mind.lastTier1At = carried.lastTier1At;
    mind.reflectionCounter = carried.reflectionCounter;
    mind.perceptionQueue.push(...carried.perceptionQueue);
  }
  return mind;
}

/** Tier-1 scene string. Names the structure COLUMNS so the existing
 *  `approach x,y` intent grammar is expressible without any worker/
 *  prompt change (y on a land surface is always given as 0). */
export function sceneLabelFor(
  wing: string,
  width: number,
  structureCols: readonly number[],
): string {
  const structures =
    structureCols.length > 0
      ? `structures stand near columns ${structureCols.join(', ')}`
      : 'no structures stand here yet';
  return (
    `a side-on terminal land showing the ${wing} wing, ${width} columns wide ` +
    `(positions are "column,0" — y is always 0); ${structures}`
  );
}
