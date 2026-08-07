/**
 * The sun's and moon's arc across the sky — pure maths for the terminal
 * renderer, the "hour without colour" rung
 * (docs/superpowers/specs/2026-08-07-hour-without-colour-design.md).
 *
 * Why position and not colour: the previous attempt at this rung lifted the
 * sky's COLOUR and died at calibration. Beings are drawn at `surface - 1` — a
 * sky cell — so the sky is the contrast denominator for nearly everything on
 * screen, and the corpus clears the frozen BEING_MIN_CONTRAST 3.0 by only 8%.
 * A body that MOVES spends none of that: alpha and y touch nothing any bar
 * measures, so this slice is contrast-neutral by construction rather than by
 * tuning.
 *
 * Composed geometry (measured over seeds 1/7/41/1234 at real desk size,
 * 53×20 cells): the sky band is rows 0–9, the ☼ is always composed at y = 0
 * and the ☾ at y = 1, and beings stand at row 9. So the arc travels DOWN from
 * the composed peak toward the horizon, which is also the correct physics —
 * low at dawn and dusk, high at noon and midnight.
 *
 * Pure + Pixi-free so scripts/smoke-sky-arc.mts can run it. Same posture as
 * clouds.ts, whose occlusion rule this borrows on the other axis.
 */
import type { LandModel, LandRole } from '../procedural/land';

/** Rows of clearance the arc keeps above the being row (`surface - 1`). A body
 *  and an inhabitant must never contend for a cell, and 2 rows is the measured
 *  distance that keeps the ☼ clear of a being's own glyph and its idle bob. */
export const ARC_CLEARANCE = 2;

/** Roles a body may pass in front of — sky register only. Anything else (a
 *  mural, a skyline silhouette, a structure top) fades it out: the world
 *  always wins, the same rule and the same words as clouds.ts DRIFTABLE. */
const PASSABLE = new Set<LandRole>(['sky', 'skyDither', 'star', 'starBright', 'cloud']);

export interface ArcSpec {
  /** Column the body was composed in — the arc moves y only, never x. */
  readonly col: number;
  /** Composed row: the top of this body's travel, reached at its peak. */
  readonly peakY: number;
  /** Bottom of travel — `min(surface) - 1 - ARC_CLEARANCE`. */
  readonly floorY: number;
  /** Row spans [start, end) in this column the body must not cover. */
  readonly blocked: ReadonlyArray<readonly [number, number]>;
}

/** Row spans in column `x` that a body may not pass over. */
function blockedRowsAt(model: LandModel, x: number): Array<readonly [number, number]> {
  const blocked: Array<readonly [number, number]> = [];
  let bs = -1;
  for (let y = 0; y <= model.height; y++) {
    const bad = y < model.height && !PASSABLE.has(model.role[y][x]);
    if (bad && bs < 0) bs = y;
    if (!bad && bs >= 0) { blocked.push([bs, y]); bs = -1; }
  }
  return blocked;
}

/** The arc a composed body will travel, or null if this land has no such body
 *  (a pack's landOmit deletes it, or the mural evicted it). */
export function extractArc(model: LandModel, role: 'sun' | 'moon'): ArcSpec | null {
  let col = -1;
  let peakY = -1;
  for (let y = 0; y < model.height && peakY < 0; y++)
    for (let x = 0; x < model.width; x++)
      if (model.role[y][x] === role) { col = x; peakY = y; break; }
  if (peakY < 0) return null;
  const floorY = Math.min(...model.surface) - 1 - ARC_CLEARANCE;
  return { col, peakY, floorY: Math.max(peakY, floorY), blocked: blockedRowsAt(model, col) };
}

/**
 * Drawn row at height `high` ∈ [0,1] — `peakY` at 1, `floorY` at 0.
 *
 * Fractional on purpose: the caller multiplies by the cell height, so the body
 * climbs BETWEEN rows rather than snapping between them. Snap-to-cell movement
 * is exactly what CLAUDE.md's sub-character-animation rule forbids, and at
 * WORLD_SCALE 2 a row is 26 screen pixels — a stepped climb would read as a
 * glyph on rails.
 */
export function arcY(spec: ArcSpec, high: number): number {
  const h = Math.min(1, Math.max(0, high));
  return spec.floorY + (spec.peakY - spec.floorY) * h;
}

/**
 * Occlusion alpha at drawn row `y`: 0 while the body overlaps a blocked span,
 * 1 in the clear, a linear 2-row skirt between — it fades approaching a mural
 * or a structure top and back in past it, never pops.
 *
 * The same shape as clouds.ts `wispAlpha` on the other axis. Deliberately a
 * sibling rather than a shared helper: that one is smoke-pinned over spans of
 * COLUMNS for a run of glyphs, this one is a single cell over ROWS, and
 * merging them would mean generalising a frozen function to earn eight lines.
 */
export function arcAlpha(spec: ArcSpec, y: number): number {
  const y0 = y;
  const y1 = y + 1;
  let gap = Infinity;
  for (const [s, e] of spec.blocked) {
    if (y1 > s && y0 < e) return 0;
    gap = Math.min(gap, y0 >= e ? y0 - e : s - y1);
  }
  return Math.min(1, gap / 2);
}
