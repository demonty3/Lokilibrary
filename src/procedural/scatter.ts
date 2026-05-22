import { mulberry32 } from './prng';
import type { CellLayout, CellPoint } from './cell';
import { T_FLOOR } from './tiles/library';
import type { ThemePalette } from '../themes/types';

/**
 * 2D rewrite of legacy-3d/procedural/scatter.ts. Mitchell-style
 * rejection sampling across the cell's floor cells. Keepouts: any
 * non-floor tile (walls, bookshelves, doors, windows, tables) plus
 * the player spawn + a passed-in extra-keepout list (caller hands in
 * Loki's spawn).
 *
 * MIN_SPACING = 2 cells — sparse enough that scatter reads as
 * intentional decor, not asset-pack vomit.
 *
 * **Scatter items do not block movement.** The player walks through
 * a plant tile freely; collision is floor-only and lives in the cell
 * renderer's keydown handler, which checks layout.tiles (not
 * scatter overlays). This is by design (CLAUDE.md "sub-character
 * animation matters" + Phase 1 scope guard: collision is for Phase 2
 * if anyone wants it richer).
 *
 * Determinism: PRNG = mulberry32(seed ^ 0x5ca7) — namespace isolated
 * from cell/Loki/etc. Same profile → same scatter.
 */

export interface ScatterItem {
  glyph: string;
  fgKey: keyof ThemePalette;
  x: number;
  y: number;
}

/** Compact glyph bible for Phase 1 cell decor. Each tuple is
 *  (glyph, palette-key, weight). Weights sum doesn't need to be 1 —
 *  PRNG picks proportionally. */
const SCATTER_BIBLE: ReadonlyArray<readonly [string, keyof ThemePalette, number]> = [
  ['♠', 'green', 5],   // potted plant
  ['∩', 'fgDim', 4],   // chair
  ['≡', 'yellow', 3],  // small stack of books
  ['☼', 'orange', 1],  // standing lamp (rare)
];

const TOTAL_WEIGHT = SCATTER_BIBLE.reduce((s, [, , w]) => s + w, 0);

const MIN_SPACING = 2;
const MIN_SPACING_SQ = MIN_SPACING * MIN_SPACING;
const TARGET_COUNT = 18;
const MAX_ATTEMPTS_PER_TARGET = 8;

export function scatterDecor(
  seed: number,
  layout: CellLayout,
  extraKeepouts: readonly CellPoint[] = [],
): ScatterItem[] {
  const prng = mulberry32((seed ^ 0x5ca7) >>> 0);

  // Build the set of forbidden cells: any non-floor tile, the player
  // spawn, plus extras. Encode as `${x},${y}` strings — small allocation,
  // O(1) lookup.
  const forbidden = new Set<string>();
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (layout.tiles[y][x] !== T_FLOOR) forbidden.add(key(x, y));
    }
  }
  forbidden.add(key(layout.spawnAt.x, layout.spawnAt.y));
  for (const p of extraKeepouts) forbidden.add(key(p.x, p.y));

  const accepted: ScatterItem[] = [];
  const maxAttempts = TARGET_COUNT * MAX_ATTEMPTS_PER_TARGET;
  for (let attempt = 0; attempt < maxAttempts && accepted.length < TARGET_COUNT; attempt++) {
    const x = prng.range(1, layout.width - 1);
    const y = prng.range(1, layout.height - 1);
    if (forbidden.has(key(x, y))) continue;
    let conflict = false;
    for (let i = 0; i < accepted.length; i++) {
      const a = accepted[i];
      const dx = a.x - x;
      const dy = a.y - y;
      if (dx * dx + dy * dy < MIN_SPACING_SQ) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;
    const [glyph, fgKey] = pickGlyph(prng);
    accepted.push({ glyph, fgKey, x, y });
  }

  return accepted;
}

function pickGlyph(
  prng: ReturnType<typeof mulberry32>,
): readonly [string, keyof ThemePalette] {
  let r = prng.next() * TOTAL_WEIGHT;
  for (const [glyph, fgKey, weight] of SCATTER_BIBLE) {
    r -= weight;
    if (r <= 0) return [glyph, fgKey];
  }
  const last = SCATTER_BIBLE[SCATTER_BIBLE.length - 1];
  return [last[0], last[1]];
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
