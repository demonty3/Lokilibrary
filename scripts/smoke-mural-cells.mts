/** Mural quantiser smoke — `npx tsx scripts/smoke-mural-cells.mts`. */
import { makeChecker } from './lib/smoke.ts';
import { MURAL_RAMP, muralQuantizeTargets, quantizeMural } from '../src/render/muralCells.ts';
import { THEMES } from '../src/themes/index.ts';
const { check, report } = makeChecker('smoke mural-cells');

const pal = Object.values(THEMES)[0].palette;
const targets = muralQuantizeTargets(pal);
check('ramp is space..full-block', MURAL_RAMP.join('') === ' ░▒▓█');
for (const theme of Object.values(THEMES)) {
  const keys = muralQuantizeTargets(theme.palette).map((t) => t.key);
  check(`${theme.id ?? theme.name ?? 'theme'}: no bg/bgAlt/fgBright target`,
    !keys.includes('bg') && !keys.includes('bgAlt') && !keys.includes('fgBright'));
}

// A 2×1-source image quantised to 2×1 cells: pure black + pure white.
const px = (r: number, g: number, b: number) => [r, g, b, 255];
const bw = [...px(0, 0, 0), ...px(255, 255, 255)];
const cells = quantizeMural(bw, 2, 1, 2, 1, targets);
check('black → blank cell', cells[0].ch === ' ' && cells[0].key === null);
check('white → full block', cells[1].ch === '█' && cells[1].key !== null);

// Chroma: a saturated red cell maps to the palette's red.
const red = quantizeMural([...px(200, 30, 30), ...px(200, 30, 30)], 2, 1, 1, 1, targets);
check('red pixels → red key', red[0].key === 'red');

// Box-averaging: 2×2 source → 1 cell, mean of all four.
const quad = [...px(255, 255, 255), ...px(255, 255, 255), ...px(0, 0, 0), ...px(0, 0, 0)];
const avg = quantizeMural(quad, 2, 2, 1, 1, targets);
check('box average lands mid-ramp', avg[0].ch === '▒' || avg[0].ch === '▓');

check('deterministic', JSON.stringify(cells) ===
  JSON.stringify(quantizeMural(bw, 2, 1, 2, 1, targets)));
report();
