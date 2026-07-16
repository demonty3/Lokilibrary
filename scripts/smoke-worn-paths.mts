/**
 * Tier-2 depth smoke — `npx tsx scripts/smoke-worn-paths.mts`.
 * Locks the pure worn-path logic (src/terminal/wear.ts):
 *   - createFootfall: a column wears exactly when its count crosses the
 *     threshold, reports the crossing exactly once, and stays worn
 *   - crustLayerText: swaps ▀ → ▔ on worn columns ONLY, leaves every other
 *     cell untouched (renderer layer-text shape: trimmed rows, \n-joined)
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { createFootfall, crustLayerText, WEAR_THRESHOLD, WORN_CRUST_GLYPH } from '../src/terminal/wear.ts';

const { check, report } = makeChecker('smoke worn-paths');

// 1 · threshold semantics
const f = createFootfall(3);
check('below threshold: no wear', !f.step(10) && !f.step(10) && !f.worn.has(10));
check('crossing reports exactly once', f.step(10) === true && f.worn.has(10));
check('past threshold: worn stays, no re-report', f.step(10) === false && f.worn.has(10));
check('columns independent', !f.worn.has(11) && !f.step(11));
check('default threshold sane', WEAR_THRESHOLD >= 4 && WEAR_THRESHOLD <= 30);

// 2 · crust layer text: the swap is surgical
const m = composeLand(0xbee5, SAMPLE_LAND, { width: 60, skyH: 6, surfaceBand: 4, underH: 8, withPlayer: false });
const plain = crustLayerText(m, new Set());
const rowsPlain = plain.split('\n');
check('plain crust text carries crust glyphs', rowsPlain.some((r) => r.includes('▀')));
// Wear the first three columns whose crust cell survived composition
// (labels/shaft legitimately overwrite some ground-line cells).
const crustCols: number[] = [];
for (let x = 0; x < m.width && crustCols.length < 3; x++)
  if ((rowsPlain[m.surface[x]] ?? '')[x] === '▀') crustCols.push(x);
check('found 3 crust columns to wear', crustCols.length === 3, `cols=${crustCols.join(',')}`);
const wornSet = new Set(crustCols);
const rowsWorn = crustLayerText(m, wornSet).split('\n');
let diffs = 0;
let swapOk = true;
for (let y = 0; y < m.height; y++) {
  const a = rowsPlain[y] ?? '';
  const b = rowsWorn[y] ?? '';
  for (let x = 0; x < Math.max(a.length, b.length); x++) {
    if ((a[x] ?? ' ') !== (b[x] ?? ' ')) {
      diffs++;
      if (!wornSet.has(x) || (b[x] ?? ' ') !== WORN_CRUST_GLYPH) swapOk = false;
    }
  }
}
check('exactly the worn columns changed', diffs === 3, `diffs=${diffs}`);
check('changed cells became the worn glyph', swapOk);
check('worn glyph is ▔', WORN_CRUST_GLYPH === '▔');

report();
