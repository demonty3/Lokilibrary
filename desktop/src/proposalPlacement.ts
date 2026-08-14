/**
 * T5 — orchestration v0, the broker's pure half
 * (docs/superpowers/specs/2026-08-14-t5-orchestration-design.md).
 * NO electron imports — the topology.ts posture, so
 * scripts/smoke-t5-placement.mts drives it from the repo root.
 *
 * Two jobs:
 *   - validateProposal: the one-per-desk-per-night gate as a pure function
 *     (first-writer-wins lives in the caller's session state; this decides
 *     whether a candidate is even eligible).
 *   - proposalSpawnBounds: where an APPLIED proposal's window goes. Exact
 *     abutment against the anchor's join chain, same y — which is precisely
 *     what computeJoins (JOIN_EPS_PX) recognises as a join on the next
 *     broadcast. The PRD's hard rule is enforced by construction: this
 *     returns a position for a NEW window and nothing else; no existing
 *     window's bounds are ever an output.
 */

import { JOIN_EPS_PX, type TermBounds } from './topology';

export type ProposalVerdict = 'ok' | 'opted_out' | 'unknown_wing' | 'wing_open' | 'already_proposed';

export interface ProposalGateState {
  optIn: boolean;
  openWings: readonly string[];
  allWings: readonly string[];
  /** The wing already accepted this sleep session, or null. */
  accepted: string | null;
}

/** Is `wing` an acceptable proposal right now? Checks are ordered so the
 *  reported reason is the most fundamental failure. */
export function validateProposal(state: ProposalGateState, wing: string): ProposalVerdict {
  if (!state.optIn) return 'opted_out';
  if (!state.allWings.includes(wing)) return 'unknown_wing';
  if (state.openWings.includes(wing)) return 'wing_open';
  if (state.accepted !== null) return 'already_proposed';
  return 'ok';
}

function abuts(cur: TermBounds, next: TermBounds, side: 'left' | 'right'): boolean {
  const flushX =
    side === 'right'
      ? Math.abs(cur.x + cur.width - next.x) <= JOIN_EPS_PX
      : Math.abs(next.x + next.width - cur.x) <= JOIN_EPS_PX;
  return flushX && Math.abs(cur.y - next.y) <= JOIN_EPS_PX;
}

/** Walk the join chain from `start` in one direction; returns the chain's
 *  last window on that side (start itself when nothing abuts). */
function chainEnd(start: TermBounds, others: readonly TermBounds[], side: 'left' | 'right'): TermBounds {
  let cur = start;
  const seen = new Set([start.id]);
  for (;;) {
    const next = others.find((o) => !seen.has(o.id) && abuts(cur, o, side));
    if (!next) return cur;
    seen.add(next.id);
    cur = next;
  }
}

function overlapsAny(x: number, y: number, w: number, h: number, all: readonly TermBounds[]): boolean {
  return all.some((o) => x < o.x + o.width && o.x < x + w && y < o.y + o.height && o.y < y + h);
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position for the applied proposal's window: flush against the END of the
 * anchor's join chain (right preferred, left fallback), same y as the chain
 * end — never moving anything. A candidate is rejected if it would overlap
 * an existing window or leave the work area horizontally (y is inherited
 * from a window that already lives at that y, so it is not re-judged).
 * Both sides fail → null, and the caller treats apply as a quiet no-op.
 */
export function proposalSpawnBounds(
  anchor: TermBounds,
  others: readonly TermBounds[],
  workArea: WorkArea,
): { x: number; y: number } | null {
  const w = anchor.width;
  const h = anchor.height;
  for (const side of ['right', 'left'] as const) {
    const end = chainEnd(anchor, others, side);
    const x = side === 'right' ? end.x + end.width : end.x - w;
    const y = end.y;
    if (x < workArea.x || x + w > workArea.x + workArea.width) continue;
    if (overlapsAny(x, y, w, h, [anchor, ...others])) continue;
    return { x, y };
  }
  return null;
}
