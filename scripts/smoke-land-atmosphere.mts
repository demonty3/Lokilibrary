/**
 * Tier-2 depth smoke — `npx tsx scripts/smoke-land-atmosphere.mts`.
 * Locks the atmospheric-perspective primitives:
 *   - composeLand emits a far ridge plane ('ridgeFar'), strictly above the
 *     surface, ▁ hilltop line only, deterministic (own salted PRNG)
 *   - the near ridge still draws (it wins where the planes meet)
 *   - mixToward is exact at both endpoints and channel-correct between
 *   - FAR_FADE orders the planes: farther = closer to bg
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { FAR_FADE, mixToward } from '../src/render/levels/land.ts';

const { check, report } = makeChecker('smoke land-atmosphere');

const dims = { width: 120, skyH: 10, surfaceBand: 5, underH: 12, withPlayer: false } as const;
const m1 = composeLand(0xd00dfeed, SAMPLE_LAND, dims);
const m2 = composeLand(0xd00dfeed, SAMPLE_LAND, dims);

// 1 · deterministic
check('composeLand deterministic with far ridge', JSON.stringify(m1) === JSON.stringify(m2));

// 2 · far ridge exists, strictly above the surface, ▁ only
let farCells = 0;
let farOk = true;
for (let y = 0; y < m1.height; y++)
  for (let x = 0; x < m1.width; x++)
    if (m1.role[y][x] === 'ridgeFar') {
      farCells++;
      if (y >= m1.surface[x]) farOk = false;
      if (m1.char[y][x] !== '▁') farOk = false;
    }
check('far ridge plane present', farCells > 0, `farCells=${farCells}`);
check('far ridge strictly above the surface, ▁ only', farOk);

// 3 · near ridge still present (it overwrites the far plane where they meet)
let nearCells = 0;
for (let y = 0; y < m1.height; y++)
  for (let x = 0; x < m1.width; x++) if (m1.role[y][x] === 'ridge') nearCells++;
check('near ridge still present', nearCells > 0);

// 4 · mixToward endpoints + interior channel math
check('mixToward t=0 is pure ink', mixToward('#3dff8c', '#0a0a0a', 0) === 0x3dff8c);
check('mixToward t=1 is pure bg', mixToward('#3dff8c', '#0a0a0a', 1) === 0x0a0a0a);
const mid = mixToward('#000000', '#ffffff', 0.5);
check('mixToward midpoint channel math', mid === 0x808080, `got 0x${mid.toString(16)}`);

// 5 · plane ordering: farther planes fade harder
check(
  'FAR_FADE orders the planes',
  (FAR_FADE.ridgeFar ?? 0) > (FAR_FADE.ridge ?? 0) && (FAR_FADE.ridge ?? 0) > 0,
);

report();
