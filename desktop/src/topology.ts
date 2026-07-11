/**
 * T0 spike — pure desktop-topology math for snapping terminals
 * (docs/PRD-snapping-terminals.md).
 *
 * Terminal windows snap edge-to-edge to JOIN worlds: when window A's right
 * edge abuts window B's left edge (and they overlap vertically), their lands
 * connect and beings can walk across. This module is the pure half of the
 * main-process broker: snap-target computation + join derivation from window
 * bounds. NO electron imports — smoke-testable from the repo root
 * (scripts/smoke-t0-topology.mts), mirroring the seams.ts discipline.
 *
 * v0 scope: horizontal joins only (side-on lands join left/right; vertical
 * stacking is a later idea). Ground-line continuity comes from snapping the
 * moved window's y to its neighbour's y — terminals share a fixed window
 * size in the spike, so equal y ⇒ equal ground row.
 */

export interface TermBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A live horizontal join: `left`'s right edge abuts `right`'s left edge. */
export interface Join {
  left: string;
  right: string;
}

/** Magnetic range: a settle within this many px of abutment snaps. */
export const SNAP_PX = 32;
/** Post-snap tolerance for considering two edges joined (setBounds is exact;
 *  this absorbs platform rounding). */
export const JOIN_EPS_PX = 2;
/** Vertical overlap (fraction of the shorter window) required to snap —
 *  prevents snapping to a window far above/below. */
export const MIN_OVERLAP_FRAC = 0.5;

function verticalOverlap(a: TermBounds, b: TermBounds): number {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, bottom - top);
}

function overlapsEnough(a: TermBounds, b: TermBounds): boolean {
  return verticalOverlap(a, b) >= MIN_OVERLAP_FRAC * Math.min(a.height, b.height);
}

/**
 * Where should `moved` snap, given the other (stationary) terminals?
 * Returns the snapped top-left, or null if nothing is in magnetic range.
 * Chooses the nearest candidate edge; y aligns to the neighbour (ground-line
 * continuity). Pure — same inputs, same answer.
 */
export function computeSnapTarget(
  moved: TermBounds,
  others: readonly TermBounds[],
): { x: number; y: number } | null {
  let best: { x: number; y: number; gap: number } | null = null;
  for (const o of others) {
    if (o.id === moved.id || !overlapsEnough(moved, o)) continue;
    // moved sits to the RIGHT of o: moved.left vs o.right
    const gapRight = Math.abs(moved.x - (o.x + o.width));
    if (gapRight <= SNAP_PX && (best === null || gapRight < best.gap)) {
      best = { x: o.x + o.width, y: o.y, gap: gapRight };
    }
    // moved sits to the LEFT of o: moved.right vs o.left
    const gapLeft = Math.abs(moved.x + moved.width - o.x);
    if (gapLeft <= SNAP_PX && (best === null || gapLeft < best.gap)) {
      best = { x: o.x - moved.width, y: o.y, gap: gapLeft };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Derive the live joins from all terminal bounds. A join exists where two
 * terminals abut horizontally (within JOIN_EPS_PX) with aligned tops (same
 * tolerance — the snap sets y exactly, so misaligned grounds never join).
 * Deterministic order: sorted by (left, right) id.
 */
export function computeJoins(all: readonly TermBounds[]): Join[] {
  const joins: Join[] = [];
  for (const a of all) {
    for (const b of all) {
      if (a.id === b.id) continue;
      if (
        Math.abs(a.x + a.width - b.x) <= JOIN_EPS_PX &&
        Math.abs(a.y - b.y) <= JOIN_EPS_PX &&
        overlapsEnough(a, b)
      ) {
        joins.push({ left: a.id, right: b.id });
      }
    }
  }
  joins.sort((p, q) => (p.left + p.right).localeCompare(q.left + q.right));
  return joins;
}

/** Which sides of `id` are open, given the joins. */
export function openSides(id: string, joins: readonly Join[]): { left: boolean; right: boolean } {
  return {
    left: joins.some((j) => j.right === id),
    right: joins.some((j) => j.left === id),
  };
}

/** The neighbour across a side of `id`, or null. */
export function neighbourOf(
  id: string,
  side: 'left' | 'right',
  joins: readonly Join[],
): string | null {
  if (side === 'right') return joins.find((j) => j.left === id)?.right ?? null;
  return joins.find((j) => j.right === id)?.left ?? null;
}
