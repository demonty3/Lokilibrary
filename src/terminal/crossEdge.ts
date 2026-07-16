/**
 * Tier-1 society — cross-edge perception, the 1-D land port of
 * src/agents/crossSeam.ts's enrichSnapshotAcrossSeams idea: a being near
 * an OPEN edge perceives the joined neighbour's near-edge beings,
 * projected just OUTSIDE the local land so distances still measure
 * correctly and nothing renders. PURE helpers only — the transport
 * (renderer ≤1 Hz change-gated report → broker relay) lives in
 * terminalLand.ts / desktop/src/terminals.ts.
 */

/** A being near a shared edge, as reported across a join. `dist` = whole
 *  cells between the being and the shared edge (0 = on the edge column). */
export interface NearEdgeBeing {
  id: string;
  dist: number;
}

/** How close to an open edge a being must be to appear in the summary. */
export const NEAR_EDGE_CELLS = 10;
/** Cap per side — keeps the ≤1 Hz IPC payload bounded. */
export const NEAR_EDGE_MAX = 4;

/** THIS terminal's near-edge summary: for each OPEN edge, the beings
 *  within NEAR_EDGE_CELLS of it, nearest first, capped at NEAR_EDGE_MAX.
 *  Closed edges report [] — the broker never learns about beings at a
 *  wall (the openSeamsFor-returns-[] invariant, 1-D). */
export function nearEdgeSummary(
  beings: ReadonlyArray<{ id: string; x: number }>,
  width: number,
  edges: { left: boolean; right: boolean },
): { left: NearEdgeBeing[]; right: NearEdgeBeing[] } {
  const side = (open: boolean, distOf: (x: number) => number): NearEdgeBeing[] => {
    if (!open) return [];
    return beings
      .map((b) => ({ id: b.id, dist: Math.round(distOf(b.x)) }))
      .filter((b) => b.dist >= 0 && b.dist <= NEAR_EDGE_CELLS)
      .sort((a, b) => a.dist - b.dist || a.id.localeCompare(b.id))
      .slice(0, NEAR_EDGE_MAX);
  };
  return {
    left: side(edges.left, (x) => x),
    right: side(edges.right, (x) => width - 1 - x),
  };
}

/** Project a neighbour's near-edge beings into THIS terminal's column
 *  space: they land just outside the local land (x < 0 / x > width-1),
 *  mirroring crossSeam's toLocal contract. My col width-1 abuts the
 *  neighbour's col 0, so their dist-d being sits at width+d (right join)
 *  or -1-d (left join). */
export function projectAcrossEdge(
  side: 'left' | 'right',
  width: number,
  beings: readonly NearEdgeBeing[],
): Array<{ id: string; x: number }> {
  return beings.map((b) => ({
    id: b.id,
    x: side === 'left' ? -1 - b.dist : width + b.dist,
  }));
}
