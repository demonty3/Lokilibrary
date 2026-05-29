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

/** Compact glyph bible for cell decor. Each candidate carries a base weight
 *  (PRNG picks proportionally — weights need not sum to 1) plus the theme
 *  tags it leans into. Phase 5D lore uses those tags to REWEIGHT how often
 *  each decor glyph appears (a nautical library shows more lamps; an arcane
 *  one more book stacks). Lore only changes WEIGHTS — it never adds, removes,
 *  reorders, or zeroes a candidate — so a library with no lore renders
 *  byte-for-byte identically to pre-5D. The tags are plain strings (from
 *  lore-profile's THEME_TAGS) so this module stays decoupled from src/agents. */
interface ScatterCandidate {
  readonly glyph: string;
  readonly fgKey: keyof ThemePalette;
  readonly baseWeight: number;
  readonly themes: readonly string[];
}

const SCATTER_BIBLE: readonly ScatterCandidate[] = [
  { glyph: '♠', fgKey: 'green',  baseWeight: 5, themes: ['pastoral', 'folklore', 'cozy'] },      // potted plant
  { glyph: '∩', fgKey: 'fgDim',  baseWeight: 4, themes: ['cozy', 'noir', 'mystery'] },           // chair
  { glyph: '≡', fgKey: 'yellow', baseWeight: 3, themes: ['arcane', 'mystery', 'high-fantasy'] }, // small stack of books
  { glyph: '☼', fgKey: 'orange', baseWeight: 1, themes: ['nautical', 'heroic', 'sci-fi'] },      // standing lamp (rare)
];

/** Each matching dominant theme multiplies a candidate's weight by this much.
 *  Integer so the weighted table + total stay exact (no float drift across
 *  machines — the determinism contract spans creator + share-viewer). */
const LORE_BOOST_PER_MATCH = 2;

interface ScatterTable {
  readonly entries: ReadonlyArray<readonly [string, keyof ThemePalette, number]>;
  readonly total: number;
}

/** Build the (optionally lore-weighted) scatter table. No lore profile, or one
 *  with no dominant themes, returns the base bible — same entries, same order,
 *  same total — so output is byte-identical to pre-5D. Lore only reweights the
 *  existing shipped candidates. Exported for the determinism smoke. */
export function buildScatterTable(
  loreProfile?: { readonly dominantThemes: readonly string[] },
): ScatterTable {
  const themes = loreProfile?.dominantThemes ?? [];
  const entries = SCATTER_BIBLE.map((c) => {
    let mult = 1;
    if (themes.length > 0) {
      for (const t of c.themes) if (themes.includes(t)) mult += LORE_BOOST_PER_MATCH;
    }
    return [c.glyph, c.fgKey, c.baseWeight * mult] as const;
  });
  const total = entries.reduce((s, [, , w]) => s + w, 0);
  return { entries, total };
}

const MIN_SPACING = 2;
const MIN_SPACING_SQ = MIN_SPACING * MIN_SPACING;
const TARGET_COUNT = 18;
const MAX_ATTEMPTS_PER_TARGET = 8;

export function scatterDecor(
  seed: number,
  layout: CellLayout,
  extraKeepouts: readonly CellPoint[] = [],
  loreProfile?: { readonly dominantThemes: readonly string[] },
): ScatterItem[] {
  const prng = mulberry32((seed ^ 0x5ca7) >>> 0);
  // Lore reweights the glyph table only; it does NOT touch position sampling,
  // so the accepted-position sequence (and the number of prng draws) is
  // identical with or without lore — only WHICH glyph each position gets
  // changes. No-lore output is therefore byte-identical to pre-5D.
  const table = buildScatterTable(loreProfile);

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
    const [glyph, fgKey] = pickGlyph(prng, table);
    accepted.push({ glyph, fgKey, x, y });
  }

  return accepted;
}

function pickGlyph(
  prng: ReturnType<typeof mulberry32>,
  table: ScatterTable,
): readonly [string, keyof ThemePalette] {
  let r = prng.next() * table.total;
  for (const [glyph, fgKey, weight] of table.entries) {
    r -= weight;
    if (r <= 0) return [glyph, fgKey];
  }
  const last = table.entries[table.entries.length - 1];
  return [last[0], last[1]];
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
