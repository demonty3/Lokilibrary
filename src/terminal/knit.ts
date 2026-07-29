/**
 * Knit-sweep glow placement — pure, PIXI-free (the wear.ts precedent).
 *
 * The glow is the run of brightened ground glyphs that holds at a
 * newly-joined seam while the sweep runs inward. It must be derived from the
 * LIVE model on every tick, never baked when the knit starts: a mid-knit
 * unjoin or rewire recomposes the seam ramp under these exact columns, and a
 * glyph pinned to the old surface then floats above or below the redrawn
 * ground for the rest of the fade.
 *
 * Pure + renderer-side: no PIXI, no procedural coupling — composeLand's
 * output is read, never written (the determinism contract holds).
 */

import type { LandModel } from '../procedural/land';
import { crustGlyphAt } from './wear';

export interface KnitGlowCell {
  /** Land column, counted inward from the joined seam. */
  col: number;
  /** Surface row in that column — the ground line the glow sits on. */
  row: number;
  /** The ground glyph to brighten, wear included. */
  glyph: string;
}

/** The column `index` steps inward from `side`'s seam. */
export function knitGlowCol(side: 'left' | 'right', width: number, index: number): number {
  return side === 'left' ? index : width - 1 - index;
}

/** Where the `index`-th glow glyph belongs in the CURRENT model. Called on
 *  every tick of a live knit (≤ KNIT_SPAN cells, under a second) — one small
 *  object per glyph is the price of one source of truth for the placement. */
export function knitGlowCell(
  model: LandModel,
  worn: ReadonlySet<number>,
  side: 'left' | 'right',
  index: number,
): KnitGlowCell {
  const col = knitGlowCol(side, model.width, index);
  const row = model.surface[col];
  return { col, row, glyph: crustGlyphAt(model, worn, col, row) };
}
