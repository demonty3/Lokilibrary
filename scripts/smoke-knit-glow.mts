/**
 * Knit-glow placement smoke — `npx tsx scripts/smoke-knit-glow.mts`.
 * Locks the pure glow geometry the terminal renderer draws the join beat from
 * (src/terminal/knit.ts + the ▀ → ▔ rule in src/terminal/wear.ts):
 *   - knitGlowCol marches inward from each seam
 *   - knitGlowCell reads the row + glyph from the model it is HANDED, so the
 *     renderer re-deriving per tick tracks a recompose
 *   - a join genuinely moves the seam surface — the reason baking the glyphs
 *     at knit time stranded them (the bug this file was added with)
 *   - crustGlyphAt is the single ▀ → ▔ authority: crustLayerText agrees with it
 *
 * What this CANNOT see: whether terminalLand's tick actually calls it. The
 * live invariant is `window.__terminal.state().knits.glowStale === 0`, driven
 * by scripts/e2e/join-demo.sh.
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { knitGlowCell, knitGlowCol } from '../src/terminal/knit.ts';
import { crustGlyphAt, crustLayerText, WORN_CRUST_GLYPH } from '../src/terminal/wear.ts';

const { check, report } = makeChecker('smoke knit-glow');

const KNIT_SPAN = 6; // mirrors terminalLand.ts
const WIDTH = 80;
const opts = { width: WIDTH, skyH: 7, surfaceBand: 5, underH: 14, withPlayer: false } as const;
const SEED = 0x5ea11;
const solo = composeLand(SEED, SAMPLE_LAND, opts);
const noWear: ReadonlySet<number> = new Set<number>();

// 1 · columns march inward from the seam
check(
  'left glow runs 0 → span-1',
  Array.from({ length: KNIT_SPAN }, (_, i) => knitGlowCol('left', WIDTH, i)).join(',') === '0,1,2,3,4,5',
);
check(
  'right glow runs width-1 → width-span',
  Array.from({ length: KNIT_SPAN }, (_, i) => knitGlowCol('right', WIDTH, i)).join(',') ===
    '79,78,77,76,75,74',
  `got=${Array.from({ length: KNIT_SPAN }, (_, i) => knitGlowCol('right', WIDTH, i)).join(',')}`,
);

// 2 · the cell sits on the model's own ground line, with the model's own glyph
let onGround = true;
let glyphOk = true;
for (const side of ['left', 'right'] as const)
  for (let i = 0; i < KNIT_SPAN; i++) {
    const cell = knitGlowCell(solo, noWear, side, i);
    if (cell.row !== solo.surface[cell.col]) onGround = false;
    if (cell.glyph !== solo.char[cell.row][cell.col]) glyphOk = false;
  }
check('glow sits on the surface row of its column', onGround);
check('glow takes the model glyph when nothing is worn', glyphOk);

// 3 · a join MOVES the seam surface — so a glyph baked at knit time and never
// re-anchored would hang off the ground. This is the defect, asserted as a
// premise: if a future seam change made it false, the per-tick re-derivation
// in terminalLand's knit branch would no longer be load-bearing.
const joined = composeLand(SEED, SAMPLE_LAND, { ...opts, join: { left: 0xbeef } });
let movedCols = 0;
let maxDelta = 0;
for (let i = 0; i < KNIT_SPAN; i++) {
  const a = knitGlowCell(solo, noWear, 'left', i);
  const b = knitGlowCell(joined, noWear, 'left', i);
  if (a.row !== b.row) movedCols++;
  maxDelta = Math.max(maxDelta, Math.abs(a.row - b.row));
}
check('a join moves the seam ground under the glow', movedCols > 0, `moved=${movedCols} maxDelta=${maxDelta}`);

// 4 · crustGlyphAt is the single ▀ → ▔ authority
const crustCol = solo.role[solo.surface[0]][0] === 'crust' ? 0 : -1;
check('seam column 0 is crust (the glow brightens ground)', crustCol === 0, `role=${solo.role[solo.surface[0]][0]}`);
const worn = new Set<number>([0]);
check(
  'worn column takes the packed variant',
  crustGlyphAt(solo, worn, 0, solo.surface[0]) === WORN_CRUST_GLYPH,
);
check(
  'unworn column keeps the model glyph',
  crustGlyphAt(solo, worn, 1, solo.surface[1]) === solo.char[solo.surface[1]][1],
);
check(
  'glow honours wear on a worn seam column',
  knitGlowCell(solo, worn, 'left', 0).glyph === WORN_CRUST_GLYPH,
);
// crustLayerText must show the same glyph the glow does, cell for cell.
const layer = crustLayerText(solo, worn).split('\n');
let agrees = true;
for (let y = 0; y < solo.height; y++)
  for (let x = 0; x < solo.width; x++)
    if (solo.role[y][x] === 'crust' && (layer[y]?.[x] ?? ' ') !== crustGlyphAt(solo, worn, x, y))
      agrees = false;
check('crustLayerText and crustGlyphAt agree on every crust cell', agrees);

report();
