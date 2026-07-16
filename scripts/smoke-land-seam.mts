/**
 * Join-moment smoke — `npx tsx scripts/smoke-land-seam.mts`.
 * Locks the pure seam-continuity math (src/procedural/land.ts):
 *   - landSeamBoundary is symmetric + deterministic
 *   - two joined wings agree on the seam surface row
 *   - the K-column blend buffer is structure-free
 *   - no-join / empty-join composeLand is byte-identical
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, landSeamBoundary, SAMPLE_LAND } from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke land-seam');

// Wing seeds à la terminalLand (fnv1a('terminal:'+wing)); inline copy.
const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const seedA = fnv('terminal:d0');
const seedB = fnv('terminal:d1');

// 1 · symmetric + deterministic
const b1 = landSeamBoundary(seedA, seedB);
const b2 = landSeamBoundary(seedB, seedA);
check('landSeamBoundary symmetric', b1.height === b2.height && b1.slope === b2.slope);
check('landSeamBoundary deterministic', JSON.stringify(landSeamBoundary(seedA, seedB)) === JSON.stringify(b1));

// 2 · joined wings agree at the shared seam column (equal dims → equal groundLine)
const dims = { width: 60, skyH: 6, surfaceBand: 4, underH: 10, withPlayer: false } as const;
const wingA = composeLand(seedA, SAMPLE_LAND.slice(0, 5), { ...dims, join: { right: seedB } });
const wingB = composeLand(seedB, SAMPLE_LAND.slice(1, 6), { ...dims, join: { left: seedA } });
check('seam surface rows match', wingA.surface[wingA.width - 1] === wingB.surface[0],
  `A=${wingA.surface[wingA.width - 1]} B=${wingB.surface[0]}`);

// 3 · blend buffer is structure-free (no structure role in the K right-edge cols)
const K = 6;
const STRUCTURE_ROLES = new Set(['monument', 'roof', 'shelf', 'cottage', 'foliage', 'label']);
let clean = true;
for (let y = 0; y < wingA.height; y++)
  for (let x = wingA.width - K; x < wingA.width; x++)
    if (STRUCTURE_ROLES.has(wingA.role[y][x])) clean = false;
check('right-edge blend buffer is structure-free', clean);

// 4 · no-join / empty-join byte-identity
const plain = composeLand(seedA, SAMPLE_LAND.slice(0, 5), dims);
check('no-join deterministic', JSON.stringify(composeLand(seedA, SAMPLE_LAND.slice(0, 5), dims)) === JSON.stringify(plain));
check('empty join === no-join (byte-identical)',
  JSON.stringify(composeLand(seedA, SAMPLE_LAND.slice(0, 5), { ...dims, join: {} })) === JSON.stringify(plain));

report();
