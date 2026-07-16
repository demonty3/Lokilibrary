/**
 * Tier-2 depth smoke — `npx tsx scripts/smoke-sky-dither.mts`.
 * Locks the pure dithered-sky-gradient maths (src/procedural/land.ts):
 *   - skyDitherDensity: 0 at the zenith, monotone toward the horizon, bounded
 *   - skyDitherGlyph walks the vocabulary light → heavy
 *   - composed dither uses only SKY_DITHER_GLYPHS, only in sky rows, never
 *     over scatter/sun/cloud/ridge, and thickens toward the horizon
 *   - deterministic (same seed → byte-identical model)
 */
import { makeChecker } from './lib/smoke.ts';
import {
  composeLand,
  SAMPLE_LAND,
  SKY_DITHER_GLYPHS,
  skyDitherDensity,
  skyDitherGlyph,
} from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke sky-dither');

// 1 · pure band function
const SKY_H = 12;
check('density 0 at zenith', skyDitherDensity(0, SKY_H) === 0);
let monotone = true;
for (let y = 1; y < SKY_H; y++)
  if (skyDitherDensity(y, SKY_H) < skyDitherDensity(y - 1, SKY_H)) monotone = false;
check('density monotone toward the horizon', monotone);
const horizon = skyDitherDensity(SKY_H - 1, SKY_H);
check('density bounded', horizon > 0.1 && horizon <= 0.25, `horizon=${horizon}`);
check('density 0 outside the sky band', skyDitherDensity(-1, SKY_H) === 0 && skyDitherDensity(SKY_H, SKY_H) === 0);

// 2 · glyph ramp light → heavy
check('glyph ramp starts light', skyDitherGlyph(0) === SKY_DITHER_GLYPHS[0]);
check('glyph ramp ends heavy', skyDitherGlyph(1) === SKY_DITHER_GLYPHS[SKY_DITHER_GLYPHS.length - 1]);

// 3 · composed dither: vocabulary + sky rows only, denser at the horizon
const dims = { width: 200, skyH: SKY_H, surfaceBand: 5, underH: 10, withPlayer: false } as const;
const m = composeLand(0xa11ce, SAMPLE_LAND, dims);
const vocab = new Set<string>(SKY_DITHER_GLYPHS);
const perRow: number[] = Array.from({ length: m.height }, () => 0);
let vocabOk = true;
let rowsOk = true;
for (let y = 0; y < m.height; y++)
  for (let x = 0; x < m.width; x++)
    if (m.role[y][x] === 'skyDither') {
      perRow[y]++;
      if (!vocab.has(m.char[y][x])) vocabOk = false;
      if (y >= SKY_H) rowsOk = false;
    }
const total = perRow.reduce((a, b) => a + b, 0);
check('dither present', total > 40, `total=${total}`);
check('dither uses only SKY_DITHER_GLYPHS', vocabOk);
check('dither confined to the sky band', rowsOk);
const top = perRow.slice(0, Math.floor(SKY_H / 2)).reduce((a, b) => a + b, 0);
const bottom = perRow.slice(Math.floor(SKY_H / 2), SKY_H).reduce((a, b) => a + b, 0);
check('gradient: horizon half denser than zenith half', bottom > top * 2, `top=${top} bottom=${bottom}`);

// 4 · deterministic
check('deterministic', JSON.stringify(composeLand(0xa11ce, SAMPLE_LAND, dims)) === JSON.stringify(m));

report();
