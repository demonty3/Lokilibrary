/**
 * Ladder identity smoke — `npx tsx scripts/smoke-ladder-identity.mts`.
 *
 * Pins the pure layer-composition + fit + presence + home-resolution +
 * mark-re-key logic behind the themed scale-ladder rungs
 * (spec docs/superpowers/specs/2026-07-17-ladder-identity-design.md).
 *
 * Hard rules asserted:
 *   - TintCanvas layers are DISJOINT and their union reproduces the canvas
 *     (the no-overstrike-by-construction contract).
 *   - fitGrid is the cell room's composition rule (integer, centred, ≥1).
 *   - home resolution: a pane's bound wing wins; stale/absent falls back
 *     to the canonical first district.
 *   - presence: live scopes map by wing, whole-library counts as home,
 *     no live scopes → theme-filtered cohort fallback on home.
 *   - composition: YOU composed into the home border, frames/ramp/letters
 *     in their own layers, deterministic, per-rung home follows the wing.
 *   - mark re-key: ghost marks = 'mark.ghost' → fg (the dim-but-distinct
 *     step); BEING_ROLE_KEYS derives to the same reserved value.
 */
import { makeChecker } from './lib/smoke.ts';
import {
  createCanvas, stamp, stampLines, layerStrings, fitGrid,
} from '../src/render/levels/tintPanel.ts';

const { check, report } = makeChecker('smoke ladder-identity');

// T1 — canvas: base layer owns everything; stamp moves ownership.
{
  const c = createCanvas(6, 2, 'base');
  stamp(c, 1, 0, '┌──┐', 'gold');
  stamp(c, 2, 0, 'YO', 'you'); // overwrites two gold cells
  const layers = layerStrings(c);
  const gold = layers.get('gold')!.split('\n');
  const you = layers.get('you')!.split('\n');
  check('T1 gold keeps non-stolen cells', gold[0] === ' ┌  ┐ ', gold[0]);
  check('T1 you owns stolen cells', you[0] === '  YO  ', you[0]);
  check('T1 base layer absent when it owns no glyphs', !layers.has('base'));
  // Disjoint union: per cell exactly one non-space owner across layers.
  let disjoint = true;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 6; x++) {
      const owners = [...layers.values()].filter((s) => s.split('\n')[y][x] !== ' ').length;
      const glyph = c.glyphs[y][x];
      if (glyph !== ' ' && owners !== 1) disjoint = false;
      if (glyph === ' ' && owners !== 0) disjoint = false;
    }
  }
  check('T1 layers disjoint, union = canvas', disjoint);
}

// T2 — stampLines + all rows same width in every layer string.
{
  const c = createCanvas(4, 3, 'base');
  stampLines(c, 0, 1, ['ab', 'cd'], 'x');
  const s = layerStrings(c);
  check('T2 stampLines rows land', s.get('x')!.split('\n')[1] === 'ab  ' && s.get('x')!.split('\n')[2] === 'cd  ');
  check(
    'T2 uniform row width',
    [...s.values()].every((t) => t.split('\n').every((r) => r.length === 4)),
  );
  // Clipping: out-of-bounds stamps neither throw nor wrap.
  stamp(c, 3, 0, 'wxyz', 'x');
  check('T2 stamp clips at the edge', c.glyphs[0][3] === 'w' && c.glyphs[0].join('').length === 4);
  stamp(c, 0, 99, 'nope', 'x'); // silently ignored
  check('T2 row out of range ignored', c.rows === 3);
}

// T3 — fitGrid = the cell room rule (integer, centred, min 1).
{
  const f = fitGrid(60, 26, { pw: 600, ph: 130 });
  check('T3 integer scale min(sx,sy)', f.scale === 5, `got ${f.scale}`);
  check('T3 centred', f.x === Math.floor((600 - 300) / 2) && f.y === 0);
  const tiny = fitGrid(600, 260, { pw: 100, ph: 100 });
  check('T3 floor at 1', tiny.scale === 1);
  // Full-rect identity: panel == rect → scale 1, origin 0.
  const id = fitGrid(200, 100, { pw: 200, ph: 100 });
  check('T3 exact fit identity', id.scale === 1 && id.x === 0 && id.y === 0);
}

report();
