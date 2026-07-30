/**
 * Raised-horizon band smoke — `npx tsx scripts/smoke-land-bands.mts`.
 * Locks the UNDER_H-relative underground maths (src/procedural/land.ts) that
 * the terminal desk's shallow band (underH=4) exposed as silent regressions:
 *   - bedrock survives at every band depth 4..14
 *   - relics rest strictly BELOW the crust (never at/above the surface)
 *   - labels are never drawn on their own column's crust row — the ground
 *     line stays continuous (only the shaft legitimately interrupts it)
 *   - model.sites is complete (one per game), on-grid, kind-correct, and
 *     surface sites land where structureColumns derives intent targets
 *   - starDensity: zenith-dense, monotone toward the ridge, 0 outside
 *   - determinism: same seed → byte-identical model (covers the sky salt)
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, starDensity } from '../src/procedural/land.ts';
import type { LandModel } from '../src/procedural/land.ts';
import { structureColumns } from '../src/terminal/beingIntents.ts';

const { check, report } = makeChecker('smoke land-bands');

// Terminal desk dims (640×520 @ 2×: 53 cols, 20 rows → skyH 11, underH 4).
const TERM = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false } as const;
const SEEDS = [0x1, 0xbeef, 0xc0ffee, 0xdecaf, 0xfeed, 0xa11ce, 0x5eed, 0xd00d, 0xcafe, 0xf00d];

interface BandFacts {
  bedrock: number;
  relicAboveSurface: number;
  labelOnOwnCrust: number;
  crustBreaks: number;
  sitesOffGrid: number;
}
const factsOf = (m: LandModel): BandFacts => {
  const f: BandFacts = { bedrock: 0, relicAboveSurface: 0, labelOnOwnCrust: 0, crustBreaks: 0, sitesOffGrid: 0 };
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const r = m.role[y][x];
      if (r === 'bedrock') f.bedrock++;
      if (r === 'relic' && y <= m.surface[x]) f.relicAboveSurface++;
      if (r === 'label' && y === m.surface[x]) f.labelOnOwnCrust++;
    }
  // Structures legitimately sit INTO sloped terrain (a shelf's flank can
  // occupy a neighbouring column's crust row) — the regression we guard is
  // carved HOLES: 'sky' (the old label strip) or 'label' cells on the line.
  for (let x = 0; x < m.width; x++) {
    const r = m.role[m.surface[x]][x];
    if (r === 'sky' || r === 'label') f.crustBreaks++;
  }
  for (const s of m.sites) {
    if (s.y < 0 || s.y >= m.height || s.x < 0 || s.x >= m.width) f.sitesOffGrid++;
  }
  return f;
};

// 1 · the shallow terminal band, across seeds
for (const seed of SEEDS) {
  const m = composeLand(seed, SAMPLE_LAND, TERM);
  const f = factsOf(m);
  const tag = `seed=${seed.toString(16)}`;
  check(`bedrock survives underH=4 (${tag})`, f.bedrock > 0, `bedrock=${f.bedrock}`);
  check(`relics rest below the crust (${tag})`, f.relicAboveSurface === 0, `above=${f.relicAboveSurface}`);
  check(`no label on its own crust row (${tag})`, f.labelOnOwnCrust === 0, `hits=${f.labelOnOwnCrust}`);
  check(`ground line continuous (${tag})`, f.crustBreaks === 0, `breaks=${f.crustBreaks}`);
  check(`sites on-grid (${tag})`, f.sitesOffGrid === 0);
}

// 2 · sites completeness + kinds + intent-target agreement (one seed, deep look)
const m = composeLand(0xa11ce, SAMPLE_LAND, TERM);
const surfaceGames = SAMPLE_LAND.filter((g) => g.state !== 'abandoned').length;
const buriedGames = SAMPLE_LAND.length - surfaceGames;
check('one site per game', m.sites.length === SAMPLE_LAND.length, `sites=${m.sites.length}`);
check(
  'site kinds match engagement split',
  m.sites.filter((s) => s.kind === 'surface').length === surfaceGames &&
    m.sites.filter((s) => s.kind === 'buried').length === buriedGames,
);
// structureColumns scans COLUMN-wise and merges label runs that overlap in x
// across different rows (pre-existing semantics), so centres are approximate.
// The guard that matters: intents still have targets, and every target points
// at a real site (within half a strip of some site's centre).
const cols = structureColumns(m.role);
check('labels still yield intent targets', cols.length > 0, `cols=${cols.length}`);
const stray = cols.filter((c) => !m.sites.some((s) => Math.abs(c - s.x) <= 4));
check('every intent-target column points at a site (±4)', stray.length === 0, stray.join(' '));
check(
  'surface labels sit below their strip, buried labels in the strata',
  m.sites.every((s) => s.y > Math.min(...m.surface)),
);

// 3 · the band maths hold across the whole underH range
for (const underH of [4, 5, 6, 8, 10, 12, 14]) {
  const mm = composeLand(0xbeef, SAMPLE_LAND, { ...TERM, underH });
  const f = factsOf(mm);
  const tag = `underH=${underH}`;
  check(`bedrock present (${tag})`, f.bedrock > 0, `bedrock=${f.bedrock}`);
  check(`relics below crust (${tag})`, f.relicAboveSurface === 0);
  check(`ground continuous (${tag})`, f.crustBreaks === 0);
}

// 4 · starDensity shape (the pure celestial band function)
const SKY_H = 11;
check('stars densest at the zenith', starDensity(0, SKY_H) > 0);
let monotone = true;
for (let y = 1; y < SKY_H; y++) if (starDensity(y, SKY_H) > starDensity(y - 1, SKY_H)) monotone = false;
check('star density monotone toward the ridge', monotone);
check(
  'star density 0 at the ridge line and outside the band',
  starDensity(SKY_H - 1, SKY_H) === 0 && starDensity(-1, SKY_H) === 0 && starDensity(SKY_H, SKY_H) === 0,
);

// 5 · deterministic (same seed → byte-identical, covers the salted sky stream)
check(
  'deterministic at terminal dims',
  JSON.stringify(composeLand(0xa11ce, SAMPLE_LAND, TERM)) === JSON.stringify(m),
);

report();
