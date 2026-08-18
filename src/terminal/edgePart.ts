/**
 * T3 slice 2 — the parting-frame maths for a terminal's land edges
 * (docs/superpowers/specs/2026-08-09-t3-slice2-design.md). Pure, PIXI-free —
 * the wear.ts / knit.ts / siteLabels.ts / packAssignment.ts posture, so
 * scripts/smoke-edge-part.mts drives the whole shape headlessly.
 *
 * A closed edge is a full-height wall; an open one used to be nothing at all,
 * destroyed in the single frame the join fired. Here the wall PARTS: a front
 * travels outward from the ground line, upward into the sky and downward into
 * the strata, and behind it a short dim JAMB lights directly above the
 * threshold — the frame pushed aside and left aside, not deleted.
 *
 * One front covers both directions and both rest states. It is measured in
 * rows from the ground line and runs from -EDGE_FEATHER (rest closed: the
 * whole wall lit) to `span` (rest open: no wall, jamb lit); closing runs it
 * back. Every alpha is a function of (row distance, front), so the caller
 * holds one number per side and no per-row state at all.
 */

/** Seconds for a full part (or a full close). */
export const EDGE_PART_S = 0.45;
/** Rows the front is soft over — a row does not pop, it hands over. */
export const EDGE_FEATHER = 1.5;
/** Rows of jamb left standing above the threshold once open. */
export const JAMB_H = 3;
/** Alpha of the bend, the brightest jamb row. Rows above fall from it. */
export const JAMB_ALPHA = 0.6;
/** Rows from the ground line to the bottom jamb row. Row 1 is the threshold
 *  (the pulsing ‹ / ›), so the jamb starts at 2 and rises. */
export const JAMB_ROW0 = 2;

/** How far the front must travel to clear an edge column. */
export function edgeSpan(height: number, surfaceRow: number): number {
  return Math.max(surfaceRow, height - 1 - surfaceRow);
}

/** Smoothstep — the land's ease (siteLabels.easeLabelAlpha's curve). Reads as
 *  a beat of resistance, then the yield, then a settle. */
export function partEase(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** The front's resting position: fully travelled when open, tucked one
 *  feather behind the ground line when closed. */
export function restFront(open: boolean, span: number): number {
  return open ? span : -EDGE_FEATHER;
}

/** Exact inverse of partEase — where on the curve a front already sits, so a
 *  mid-flight reversal resumes from where it is instead of snapping back to
 *  a full wall and sweeping again. */
export function partEaseInv(y: number): number {
  const c = Math.min(1, Math.max(0, y));
  return 0.5 - Math.sin(Math.asin(1 - 2 * c) / 3);
}

/** The front `tS` seconds into a part (`opening`) or a close. */
export function partFront(tS: number, span: number, opening: boolean): number {
  const e = partEase(tS / EDGE_PART_S);
  const from = restFront(!opening, span);
  const to = restFront(opening, span);
  return from + (to - from) * e;
}

/** True once the front has come to rest and the caller can drop the tween. */
export function partDone(tS: number): boolean {
  return tS >= EDGE_PART_S;
}

/** A wall row's alpha. `dist` is |row - groundRow|: lit ahead of the front,
 *  gone behind it, handed over across EDGE_FEATHER rows in between. */
export function wallAlpha(dist: number, front: number): number {
  return Math.min(1, Math.max(0, (dist - front) / EDGE_FEATHER));
}

/** A jamb row's full-strength alpha — brightest at the bend, falling upward
 *  so the remnant fades into the sky rather than ending on a hard row. */
export function jambBase(j: number): number {
  return JAMB_ALPHA * (1 - j / (JAMB_H + 1));
}

/** A jamb row's live alpha: it lights only once the front has passed it, so
 *  the jamb emerges from behind the parting wall instead of over it. */
export function jambAlpha(j: number, front: number): number {
  const d = JAMB_ROW0 + j;
  return jambBase(j) * Math.min(1, Math.max(0, (front - d) / EDGE_FEATHER));
}

/** The jamb's glyphs, bottom (j=0) up. The bottom one is the bend, turning
 *  AWAY from the opening and back into its own land — a left edge's doorway
 *  is to the left, so its frame leans right. Above the bend the remnant is
 *  the wall's own thin rule. */
export function jambGlyph(side: 'left' | 'right', j: number): string {
  if (j > 0) return '╎';
  return side === 'left' ? '╰' : '╯';
}

/** Phase B — how far the SEAM-ROW front must travel outward from the shaft
 *  column to clear the row (the vertical seam's edgeSpan sibling; the front
 *  is measured in columns from the shaft, and wallAlpha/partFront/partEase
 *  are reused as-is with dist = |col - shaftX|). */
export function rowSpan(width: number, shaftX: number): number {
  return Math.max(shaftX, width - 1 - shaftX);
}
