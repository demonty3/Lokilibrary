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
 * Scope: SURFACE windows join horizontally only (side-on lands join
 * left/right). Phase B (2026-08-18, probe-gated) adds the ONE vertical case:
 * an 'under' window — a wing's undercroft — snaps beneath its surface window
 * (VJoin). Under windows never join horizontally; surface windows never snap
 * vertically. The kind gate is what dissolves the old SNAP_Y_PX conflict:
 * vertical drag stays the surface un-snap gesture, horizontal drag is the
 * under window's escape. Ground-line continuity comes from snapping the
 * moved window's y to its neighbour's y — surface terminals share a fixed
 * window size, so equal y ⇒ equal ground row.
 */

/** Window kind: 'surface' is the 640×520 wing terminal; 'under' is the
 *  640×260 undercroft (Phase B). Optional so every pre-B caller/smoke
 *  compiles untouched; absent means 'surface'. */
export type TermKind = 'surface' | 'under';

export interface TermBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind?: TermKind;
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
/** Vertical capture band for SNAPPING (not joining): a settle only snaps to
 *  a neighbour whose top is within this many px. Doubles as the un-snap
 *  escape distance — T0's overlap-only test recaptured any vertical drag-out
 *  up to half a window height (260px), so a snapped terminal could never be
 *  detached by dragging it away vertically. 48px holds the snap against
 *  nudges (and the 36px boot ladder) while a deliberate drag escapes — and
 *  stays escaped, because the test is position-based, not history-based.
 *  computeJoins is untouched (JOIN_EPS_PX). */
export const SNAP_Y_PX = 48;

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
    if (Math.abs(moved.y - o.y) > SNAP_Y_PX) continue; // outside the capture band — un-snap escape
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

// ─── Vertical (Phase B): the undercroft join ────────────────────────────────

/** A live vertical join: `top`'s bottom edge abuts `bottom`'s top edge.
 *  `bottom` is always an under-kind window (computeVJoins gates on it). */
export interface VJoin {
  top: string;
  bottom: string;
}

/** Horizontal capture band for VERTICAL snapping — the mirror of SNAP_Y_PX:
 *  it holds the dock against nudges while a deliberate HORIZONTAL drag
 *  escapes, and stays escaped (position-based, not history-based). */
export const SNAP_X_PX = 48;

function horizontalOverlap(a: TermBounds, b: TermBounds): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  return Math.max(0, right - left);
}

/**
 * Where should a moved UNDER window snap, given the other terminals?
 * Only under-kind movers snap vertically, only to surface-kind candidates
 * ABOVE them, and never to a surface that already has an undercroft docked
 * (one under window per surface window — v0's vertical pair). Snapped
 * position is exact abutment: the probe's "honest 2px gap" is render-side
 * seam honesty, not window geometry (horizontal joins abut exactly too).
 * Pure — same inputs, same answer.
 */
export function computeVSnapTarget(
  moved: TermBounds,
  others: readonly TermBounds[],
): { x: number; y: number } | null {
  if (moved.kind !== 'under') return null;
  let best: { x: number; y: number; gap: number } | null = null;
  for (const o of others) {
    if (o.id === moved.id || o.kind === 'under') continue;
    if (horizontalOverlap(moved, o) < MIN_OVERLAP_FRAC * Math.min(moved.width, o.width)) continue;
    if (Math.abs(moved.x - o.x) > SNAP_X_PX) continue; // outside the capture band — un-snap escape
    // Occupied surface: another under window is already docked beneath it.
    const taken = others.some(
      (u) =>
        u.kind === 'under' &&
        u.id !== moved.id &&
        Math.abs(o.y + o.height - u.y) <= JOIN_EPS_PX &&
        Math.abs(o.x - u.x) <= JOIN_EPS_PX,
    );
    if (taken) continue;
    const gap = Math.abs(moved.y - (o.y + o.height));
    if (gap <= SNAP_PX && (best === null || gap < best.gap)) {
      best = { x: o.x, y: o.y + o.height, gap };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Derive the live vertical joins from all terminal bounds. A vjoin exists
 * where a surface window's bottom edge abuts an under window's top edge
 * (within JOIN_EPS_PX) with aligned left edges (same tolerance — the snap
 * sets x exactly). Deterministic order: sorted by (top, bottom) id.
 */
export function computeVJoins(all: readonly TermBounds[]): VJoin[] {
  const vjoins: VJoin[] = [];
  for (const a of all) {
    if (a.kind === 'under') continue;
    for (const b of all) {
      if (b.kind !== 'under' || a.id === b.id) continue;
      if (
        Math.abs(a.y + a.height - b.y) <= JOIN_EPS_PX &&
        Math.abs(a.x - b.x) <= JOIN_EPS_PX
      ) {
        vjoins.push({ top: a.id, bottom: b.id });
      }
    }
  }
  vjoins.sort((p, q) => (p.top + p.bottom).localeCompare(q.top + q.bottom));
  return vjoins;
}

/** The undercroft docked beneath `id`, or null. */
export function neighbourBelow(id: string, vjoins: readonly VJoin[]): string | null {
  return vjoins.find((v) => v.top === id)?.bottom ?? null;
}

/** The surface window `id` is docked beneath, or null. */
export function neighbourAbove(id: string, vjoins: readonly VJoin[]): string | null {
  return vjoins.find((v) => v.bottom === id)?.top ?? null;
}
