/**
 * Phase 5D.2 smoke — `npx tsx scripts/smoke-5d-scatter.mts`.
 *
 * Locks the determinism contract for lore-weighted scatter. The hard rules:
 *   - No lore (undefined OR empty dominantThemes) → output byte-identical to
 *     the pre-5D base bible (entries, order, total weight 13).
 *   - Lore only REWEIGHTS existing shipped candidates — never adds, removes,
 *     reorders, or zeroes one (entries stay length 4, glyphs in base order).
 *   - Lore does NOT move positions: the accepted (x,y) sequence is identical
 *     with and without lore; only the chosen glyph differs.
 *   - Same (seed + lore) → identical scatter, every run.
 *   - Only shipped glyphs ever appear.
 */

import { makeChecker } from './lib/smoke.ts';
import type { CellLayout } from '../src/procedural/cell.ts';

const { scatterDecor, buildScatterTable } = await import('../src/procedural/scatter.ts');
const { T_FLOOR } = await import('../src/procedural/tiles/library.ts');

const { check, report } = makeChecker('smoke 5D.2');

const SHIPPED_GLYPHS = new Set(['♠', '∩', '≡', '☼']);

/** All-floor cell with a 1-tile border keepout via spawn — enough for scatter. */
function floorLayout(w: number, h: number): CellLayout {
  const tiles = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => T_FLOOR as number),
  );
  return {
    width: w,
    height: h,
    tiles,
    spawnAt: { x: 1, y: 1 },
    bookshelfSlots: [],
    doorAt: { x: 0, y: 1 },
  };
}

const layout = floorLayout(24, 16);
const SEED = 0x1234abcd;
const NAUTICAL = { dominantThemes: ['nautical'] }; // boosts ☼ lamp
const ARCANE = { dominantThemes: ['arcane', 'mystery'] }; // boosts ≡ books
const EMPTY = { dominantThemes: [] as string[] };

// --- buildScatterTable invariants -------------------------------------------
const base = buildScatterTable();
check('base table has 4 entries', base.entries.length === 4);
check('base total weight is 13', base.total === 13);
check(
  'base glyph order preserved',
  base.entries.map((e) => e[0]).join('') === '♠∩≡☼',
);

const baseFromEmpty = buildScatterTable(EMPTY);
check(
  'empty dominantThemes == base table',
  JSON.stringify(baseFromEmpty) === JSON.stringify(base),
);

const naut = buildScatterTable(NAUTICAL);
check('nautical table same length (no add/remove)', naut.entries.length === 4);
check('nautical table same glyph order', naut.entries.map((e) => e[0]).join('') === '♠∩≡☼');
check('nautical boosts the lamp weight', naut.entries[3][2] > base.entries[3][2]);
check('nautical total > base total', naut.total > base.total);
check('every nautical weight stays > 0', naut.entries.every((e) => e[2] > 0));

// --- scatterDecor determinism -----------------------------------------------
const a = scatterDecor(SEED, layout, []);
const b = scatterDecor(SEED, layout, []);
check('no-lore scatter deterministic', JSON.stringify(a) === JSON.stringify(b));

const aEmpty = scatterDecor(SEED, layout, [], EMPTY);
check(
  'empty lore == no-lore (byte identical)',
  JSON.stringify(aEmpty) === JSON.stringify(a),
);

const withLore = scatterDecor(SEED, layout, [], NAUTICAL);
const withLore2 = scatterDecor(SEED, layout, [], NAUTICAL);
check('lore scatter deterministic', JSON.stringify(withLore) === JSON.stringify(withLore2));

// Positions identical with/without lore; only glyphs may differ.
const posNoLore = a.map((s) => `${s.x},${s.y}`).join(';');
const posLore = withLore.map((s) => `${s.x},${s.y}`).join(';');
check('lore does not move positions', posNoLore === posLore);
check('same item count with/without lore', a.length === withLore.length);

// Lore actually changes at least one glyph (the reweight has an effect).
const glyphsNoLore = a.map((s) => s.glyph).join('');
const glyphsLore = withLore.map((s) => s.glyph).join('');
check('lore changes the glyph distribution', glyphsNoLore !== glyphsLore);

// Only shipped glyphs, in every variant.
const allItems = [...a, ...withLore, ...scatterDecor(SEED, layout, [], ARCANE)];
check('only shipped glyphs appear', allItems.every((s) => SHIPPED_GLYPHS.has(s.glyph)));

report();
