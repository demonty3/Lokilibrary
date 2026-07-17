/**
 * Tint-layer panel composition (ladder identity pass, spec 2026-07-17).
 *
 * The scale-ladder rungs need per-surface accents (gold frames, warm ramp,
 * being letters, a bright YOU) inside ONE composed character panel. The
 * prior pattern — a single-fill BitmapText plus a "carved out" second text
 * for the home card — generalizes here: a canvas where every glyph cell is
 * OWNED by exactly one named tint layer. `layerStrings` emits one
 * spaces-elsewhere string per layer; the renderer draws one BitmapText per
 * layer at a shared origin, so no cell is ever double-drawn (the ladder
 * overstrike bug can't come back by construction).
 *
 * Pure string/number logic only — no pixi import, so the smoke pins it
 * headlessly (same contract as src/procedural).
 */

import { roleKey } from '../../themes/roles';
import type { PaletteKey, Theme, ThemeRole } from '../../themes/types';

export interface TintCanvas {
  cols: number;
  rows: number;
  /** glyph per cell (' ' = empty) */
  glyphs: string[][];
  /** owning layer per cell */
  owner: string[][];
}

export function createCanvas(cols: number, rows: number, baseLayer: string): TintCanvas {
  return {
    cols,
    rows,
    glyphs: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' ')),
    owner: Array.from({ length: rows }, () => Array.from({ length: cols }, () => baseLayer)),
  };
}

/** Stamp one row of text; each stamped cell's ownership MOVES to `layer`
 *  (last write wins). Out-of-bounds cells are clipped, not thrown — a
 *  truncated label at a panel edge is a composition detail, not a crash. */
export function stamp(c: TintCanvas, x: number, y: number, text: string, layer: string): void {
  if (y < 0 || y >= c.rows) return;
  for (let i = 0; i < text.length; i++) {
    const cx = x + i;
    if (cx < 0 || cx >= c.cols) continue;
    c.glyphs[y][cx] = text[i];
    c.owner[y][cx] = layer;
  }
}

export function stampLines(
  c: TintCanvas,
  x: number,
  y: number,
  lines: readonly string[],
  layer: string,
): void {
  for (let r = 0; r < lines.length; r++) stamp(c, x, y + r, lines[r], layer);
}

/** One spaces-elsewhere multi-line string per layer that owns ≥1 non-space
 *  glyph. Every row in every string is exactly `cols` wide (BitmapText
 *  alignment depends on it). */
export function layerStrings(c: TintCanvas): Map<string, string> {
  const grids = new Map<string, string[][]>();
  for (let y = 0; y < c.rows; y++) {
    for (let x = 0; x < c.cols; x++) {
      const g = c.glyphs[y][x];
      if (g === ' ') continue;
      const layer = c.owner[y][x];
      let grid = grids.get(layer);
      if (!grid) {
        grid = Array.from({ length: c.rows }, () => Array.from({ length: c.cols }, () => ' '));
        grids.set(layer, grid);
      }
      grid[y][x] = g;
    }
  }
  const out = new Map<string, string>();
  for (const [layer, grid] of grids) out.set(layer, grid.map((r) => r.join('')).join('\n'));
  return out;
}

export interface FitResult {
  scale: number;
  x: number;
  y: number;
}

/** The cell room's composition rule (cell.ts fit): integer scale that fits
 *  BOTH dimensions, floored at 1, centred. Ladder panels now inhabit the
 *  pane like the room does instead of floating at 0.55×. */
export function fitGrid(
  panelW: number,
  panelH: number,
  rect: { pw: number; ph: number },
): FitResult {
  const scale = Math.max(
    1,
    Math.min(
      Math.floor(rect.pw / Math.max(1, panelW)),
      Math.floor(rect.ph / Math.max(1, panelH)),
    ),
  );
  return {
    scale,
    x: Math.floor((rect.pw - panelW * scale) / 2),
    y: Math.floor((rect.ph - panelH * scale) / 2),
  };
}

/** Layer name → palette key for the ladder rungs (spec §2 table). Frames
 *  wear shelf-gold (the built/owned dialect, shelfStrokeTints stroke 0);
 *  ramps the warm accent; beings their reserved role accents; home the
 *  player role. */
export function ladderLayerTint(theme: Theme, layer: string): PaletteKey {
  if (layer === 'frame' || layer === 'land') return 'yellow';
  if (layer === 'ramp') return 'orange';
  if (layer === 'dim') return 'fgDim';
  if (layer === 'home') return roleKey(theme, 'player', 'fgBright');
  if (layer.startsWith('being.')) return roleKey(theme, layer as ThemeRole, 'fg');
  return 'fg';
}
