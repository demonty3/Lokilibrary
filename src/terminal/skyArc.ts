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

/** Row spans in column `x` that a body may not pass over. `self` is the body's
 *  own role, which must count as passable: the composer stamps the ☼ INTO the
 *  grid, so without this a body's own cell is in its own blocked set and it
 *  fades itself to nothing at its peak — found on screen, where the sun sat at
 *  alpha 0 at every hour while every smoke was green. */
function blockedRowsAt(model: LandModel, x: number, self: LandRole): Array<readonly [number, number]> {
  const blocked: Array<readonly [number, number]> = [];
  let bs = -1;
  for (let y = 0; y <= model.height; y++) {
    const role = y < model.height ? model.role[y][x] : null;
    const bad = role !== null && role !== self && !PASSABLE.has(role);
    if (bad && bs < 0) bs = y;
    if (!bad && bs >= 0) { blocked.push([bs, y]); bs = -1; }
  }
  return blocked;
}

/** Where the composer put this body, or null if the mural evicted it. */
function composedAt(model: LandModel, role: 'sun' | 'moon'): { col: number; peakY: number } | null {
  for (let y = 0; y < model.height; y++)
    for (let x = 0; x < model.width; x++)
      if (model.role[y][x] === role) return { col: x, peakY: y };
  return null;
}

/** Fraction of a column's travel band that a body could actually be seen in. */
function clearFraction(model: LandModel, col: number, peakY: number, floorY: number, self: LandRole): number {
  if (floorY <= peakY) return 0;
  let clear = 0;
  for (let y = peakY; y <= floorY; y++) {
    const r = model.role[y][col];
    if (r === self || PASSABLE.has(r)) clear++;
  }
  return clear / (floorY - peakY + 1);
}

/** A composed column is kept unless it is mostly obstructed — the seeded
 *  placement is the pack's own, and moving a body that can already be seen
 *  would churn the look for nothing. */
const KEEP_COMPOSED_ABOVE = 0.6;

/**
 * The arc a body will travel. Never null for a land that has sky: if the
 * composer's body was evicted, or its column is mostly wall, this picks the
 * clearest column and the body is drawn there render-side.
 *
 * **Why this exists, measured over 60 seeds at real desk options: the mural
 * evicts the ☼ outright in 42% of lands, and where one survives the median is
 * visible over just 33% of its travel.** The mural composes last and clears its
 * rect unconditionally ("the world always wins"), and at desk geometry it
 * dominates the sky. An arc bound to the composed cell is therefore absent or
 * hidden most of the time — the whole mechanism, silently missing.
 *
 * The fix is not novel here: the drifting wisps hit exactly this on 2026-08-06
 * ("every window wears a mural whose occlusion span covered ~60% of both cloud
 * rows; one seed wiped both wisps outright") and shipped the same answer — the
 * terminal path hides the baked layer and re-renders the body itself, re-placed
 * into clear sky. Deterministic: first-best column, no RNG, so joined windows
 * on one wing agree without talking.
 */
export function extractArc(model: LandModel, role: 'sun' | 'moon'): ArcSpec | null {
  if (model.height < 3 || model.width < 1) return null;
  const composed = composedAt(model, role);
  // A body the composer never placed still needs a peak. Mirror the composer's
  // own convention (land.ts: the ☼ rides the top third of the sky, the ☾ starts
  // at row 1 because the drag strip overlays row 0).
  const peakY = composed?.peakY ?? (role === 'sun' ? 1 : 2);
  const floorOf = (col: number): number => Math.max(peakY, model.surface[col] - 1 - ARC_CLEARANCE);

  let col = composed?.col ?? -1;
  if (col < 0 || clearFraction(model, col, peakY, floorOf(col), role) < KEEP_COMPOSED_ABOVE) {
    let best = -1;
    let bestScore = -1;
    for (let x = 0; x < model.width; x++) {
      const score = clearFraction(model, x, peakY, floorOf(x), role);
      if (score > bestScore) { bestScore = score; best = x; }
    }
    if (best < 0 || bestScore <= 0) return null; // a land with no clear sky at all
    col = best;
  }
  return { col, peakY, floorY: floorOf(col), blocked: blockedRowsAt(model, col, role) };
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
 * half-lit where it abuts one, 1 a clear row away — it fades approaching a
 * mural or a structure top and back in past it, never pops.
 *
 * The shape comes from clouds.ts `wispAlpha` on the other axis, with one
 * deliberate difference: there, gap 0 means fully faded, because a drifting
 * wisp at gap 0 is a whole glyph run about to slide UNDER the mural and the
 * skirt is about approach. A body is one cell and mostly at REST, so the same
 * rule made a ☾ composed one row above a ridge invisible at every hour — seen
 * on screen, at seed 113. Touching is half-lit; only overlapping is gone.
 *
 * Kept a sibling of wispAlpha rather than a shared helper for exactly this
 * reason: they agree on the shape and disagree on the boundary, and merging
 * them would mean parameterising a frozen function to earn eight lines.
 */
export function arcAlpha(spec: ArcSpec, y: number): number {
  const y0 = y;
  const y1 = y + 1;
  let gap = Infinity;
  for (const [s, e] of spec.blocked) {
    if (y1 > s && y0 < e) return 0;
    gap = Math.min(gap, y0 >= e ? y0 - e : s - y1);
  }
  return Math.min(1, (gap + 1) / 2);
}
