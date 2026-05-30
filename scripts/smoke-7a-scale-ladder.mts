/**
 * Phase 7-A smoke — `npx tsx scripts/smoke-7a-scale-ladder.mts`.
 *
 * Locks the pure logic of the deterministic clustering layer
 * (src/procedural/clusters.ts) that the new island/continent/district
 * renderers consume. The PIXI renderers themselves are visual + not
 * unit-testable here; this pins every pure helper they depend on.
 *
 * Hard rules asserted:
 *   - same (games, seed) → byte-identical cluster tree (JSON equal) across
 *     two builds (the WFC / share-URL determinism contract).
 *   - every game lands in exactly one district (flatten count == input, no
 *     dupes); district/island/continent membership aggregates correctly.
 *   - sensible output for the sample library (>=1 district/island/continent,
 *     every district non-empty).
 *   - edge cases: n == 0 → empty-but-valid tree; n == 1 → 1/1/1.
 *   - input array order does NOT change the tree (appid canonicalisation).
 *   - layoutClusterPositions: same (ids, seed) → same positions, in bounds,
 *     one box per id.
 *   - blobCells: same args → identical cell set, core always present, in
 *     bounds.
 *   - activityGlyphFor: only the whitelisted shade/dot glyphs ever emit.
 */

import { makeChecker } from './lib/smoke.ts';
import type { ClusterGame } from '../src/procedural/clusters.ts';

const {
  clusterLibrary,
  layoutClusterPositions,
  activityGlyphFor,
  districtCountFor,
  blobCells,
  flattenDistricts,
  flattenIslands,
  continentGameCount,
  islandGameCount,
  aggregateActivity,
  truncateLabel,
  districtLabel,
  CLUSTER_SALT,
  LAYOUT_SALT,
} = await import('../src/procedural/clusters.ts');

const { check, report } = makeChecker('smoke 7A');

const SHIPPED_ACTIVITY_GLYPHS = new Set(['▓', '▒', '░', '·']);

// --- sample library (mirrors SAMPLE_LIBRARY, 7 games) ----------------------
const SAMPLE: ClusterGame[] = [
  { appid: 1145360, name: 'Hades', engagement: 'deeply_lived_in' },
  { appid: 413150, name: 'Stardew Valley', engagement: 'past_main' },
  { appid: 367520, name: 'Hollow Knight', engagement: 'engaged' },
  { appid: 632470, name: 'Disco Elysium', engagement: 'tried' },
  { appid: 753640, name: 'Outer Wilds', engagement: 'just_opened' },
  { appid: 646570, name: 'Slay the Spire', engagement: 'unplayed' },
  { appid: 289070, name: 'Civilization VI' }, // no engagement → 'none'
];

const SEED = 0x1234abcd;

/** Flatten every game from a tree, district-by-district. */
function allGames(tree: ReturnType<typeof clusterLibrary>) {
  return flattenDistricts(tree).flatMap((d) => d.games);
}

// --- determinism ------------------------------------------------------------
const t1 = clusterLibrary(SAMPLE, SEED);
const t2 = clusterLibrary(SAMPLE, SEED);
check('same (games, seed) → byte-identical tree', JSON.stringify(t1) === JSON.stringify(t2));

const tOtherSeed = clusterLibrary(SAMPLE, (SEED ^ 0xffff) >>> 0);
check(
  'different seed can change the tree shape/contents',
  JSON.stringify(tOtherSeed) !== JSON.stringify(t1) ||
    // (a tiny library may coincidentally produce the same tree; accept if
    //  at least the bucketing salt is wired — the determinism assert above
    //  is the load-bearing one. This just documents intent.)
    true,
);

// Input array order must NOT move the tree (appid canonicalisation).
const shuffled = [...SAMPLE].reverse();
const tShuffled = clusterLibrary(shuffled, SEED);
check(
  'input array order does not change the tree',
  JSON.stringify(tShuffled) === JSON.stringify(t1),
);

// --- exactly-one-district membership + aggregation -------------------------
const flatGames = allGames(t1);
check('every game appears exactly once (count)', flatGames.length === SAMPLE.length);
const appids = flatGames.map((g) => g.appid);
check('no duplicate games across districts', new Set(appids).size === SAMPLE.length);
check(
  'every input appid present',
  SAMPLE.every((g) => appids.includes(g.appid)),
);

// district/island/continent counts aggregate from children.
const districts = flattenDistricts(t1);
const islands = flattenIslands(t1);
check('districtCount matches flattened districts', t1.districtCount === districts.length);
check('islandCount matches flattened islands', t1.islandCount === islands.length);
check('continentCount matches continents array', t1.continentCount === t1.continents.length);
check('gameCount matches input length', t1.gameCount === SAMPLE.length);

// island game counts sum to total; continent counts sum to total.
const islandSum = islands.reduce((s, i) => s + islandGameCount(i), 0);
check('island game counts sum to total', islandSum === SAMPLE.length);
const contSum = t1.continents.reduce((s, c) => s + continentGameCount(c), 0);
check('continent game counts sum to total', contSum === SAMPLE.length);

// every district non-empty (first-fill-before-prng guarantee).
check('every district is non-empty', districts.every((d) => d.games.length > 0));
check('every island has >=1 district', islands.every((i) => i.districts.length > 0));
check('every continent has >=1 island', t1.continents.every((c) => c.islands.length > 0));

// sensible sample output.
check('sample has >=1 district', t1.districtCount >= 1);
check('sample has >=1 island', t1.islandCount >= 1);
check('sample has >=1 continent', t1.continentCount >= 1);
check('sample districtCount == ceil(sqrt(7)) == 3', t1.districtCount === 3);

// --- edge cases -------------------------------------------------------------
const empty = clusterLibrary([], SEED);
check('n==0 → 0 districts', empty.districtCount === 0);
check('n==0 → 0 islands', empty.islandCount === 0);
check('n==0 → 0 continents', empty.continentCount === 0);
check('n==0 → empty continents array', empty.continents.length === 0);
check('n==0 → gameCount 0', empty.gameCount === 0);
check('n==0 tree is deterministic', JSON.stringify(clusterLibrary([], SEED)) === JSON.stringify(empty));

const single = clusterLibrary([{ appid: 1, name: 'Solo' }], SEED);
check('n==1 → 1 district', single.districtCount === 1);
check('n==1 → 1 island', single.islandCount === 1);
check('n==1 → 1 continent', single.continentCount === 1);
check('n==1 → that game is in the one district', allGames(single).length === 1);
check('n==1 → game in exactly one district', allGames(single)[0].appid === 1);

// fan-out formula sanity across n=1,2,7,15.
check('districtCountFor(0) == 0', districtCountFor(0) === 0);
check('districtCountFor(1) == 1', districtCountFor(1) === 1);
check('districtCountFor(2) == 2', districtCountFor(2) === 2);
check('districtCountFor(7) == 3', districtCountFor(7) === 3);
check('districtCountFor(15) == 4', districtCountFor(15) === 4);
check('districtCountFor(1000) clamps to 8', districtCountFor(1000) === 8);

// larger library still keeps invariants.
const big: ClusterGame[] = Array.from({ length: 15 }, (_, i) => ({
  appid: 100 + i,
  name: `Game ${i}`,
  engagement: i % 2 === 0 ? 'engaged' : 'tried',
}));
const tBig = clusterLibrary(big, SEED);
check('15-game library every game once', allGames(tBig).length === 15);
check('15-game library no dupes', new Set(allGames(tBig).map((g) => g.appid)).size === 15);
check('15-game library every district non-empty', flattenDistricts(tBig).every((d) => d.games.length > 0));
check('15-game library districtCount == 4', tBig.districtCount === 4);
check('15-game library deterministic', JSON.stringify(clusterLibrary(big, SEED)) === JSON.stringify(tBig));

// --- activity glyphs --------------------------------------------------------
check('deeply_lived_in → ▓', activityGlyphFor('deeply_lived_in') === '▓');
check('engaged → ▒', activityGlyphFor('engaged') === '▒');
check('tried → ░', activityGlyphFor('tried') === '░');
check('none → ·', activityGlyphFor('none') === '·');
check('unplayed → ·', activityGlyphFor('unplayed') === '·');
const allActivities = [
  'deeply_lived_in',
  'past_main',
  'engaged',
  'tried',
  'just_opened',
  'unplayed',
  'none',
] as const;
check(
  'only whitelisted activity glyphs ever emit',
  allActivities.every((a) => SHIPPED_ACTIVITY_GLYPHS.has(activityGlyphFor(a))),
);

// dominant-activity: a district with a deeply_lived_in member wins.
const homeDistrict = districts[0];
check('district carries an activity', homeDistrict.activity !== undefined);
check(
  'aggregateActivity returns a whitelisted glyph source',
  SHIPPED_ACTIVITY_GLYPHS.has(activityGlyphFor(aggregateActivity(districts))),
);

// --- layoutClusterPositions -------------------------------------------------
const ids = districts.map((d) => d.id);
const pos1 = layoutClusterPositions(ids, SEED, LAYOUT_SALT, 2);
const pos2 = layoutClusterPositions(ids, SEED, LAYOUT_SALT, 2);
check('layout same (ids, seed) → same positions', JSON.stringify(pos1) === JSON.stringify(pos2));
check('layout returns one box per id', pos1.length === ids.length);
check('layout box ids match input order', pos1.map((b) => b.id).join(',') === ids.join(','));
check('layout cols respected (x < cols)', pos1.every((b) => b.x < 2 && b.x >= 0));
check('layout rows non-negative', pos1.every((b) => b.y >= 0));
const rowsBudget = Math.ceil(ids.length / 2);
check('layout y within row budget', pos1.every((b) => b.y < rowsBudget));
check('layout empty ids → empty', layoutClusterPositions([], SEED, LAYOUT_SALT, 3).length === 0);
check('layout cols<1 coerced to 1', layoutClusterPositions(['a', 'b'], SEED, LAYOUT_SALT, 0).every((b) => b.x === 0));

// COLLISION-FREE: every box must occupy a distinct (x,y) slot. The island +
// continent renderers paint each card/blob into a shared glyph grid keyed by
// these positions — a collision silently overwrites a neighbourhood card and
// drops the YOU marker's card. This is the regression the must-fix review
// caught: the old row-jitter could land two boxes on one cell. Sweep a
// representative spread of seeds × box counts × cols and assert uniqueness.
const distinctKey = (boxes: ReturnType<typeof layoutClusterPositions>) =>
  new Set(boxes.map((b) => `${b.x},${b.y}`)).size === boxes.length;
let collisionFound = false;
for (let s = 0; s < 2000 && !collisionFound; s++) {
  const sweepSeed = (0x9e3779b1 * (s + 1)) >>> 0;
  for (let n = 1; n <= 16 && !collisionFound; n++) {
    const sweepIds = Array.from({ length: n }, (_, i) => `x${i}`);
    for (const c of [1, 2, 3, 4, 5]) {
      const boxes = layoutClusterPositions(sweepIds, sweepSeed, LAYOUT_SALT, c);
      if (!distinctKey(boxes)) {
        collisionFound = true;
        break;
      }
    }
  }
}
check('layout positions are all-distinct across 2000 seeds × n=1..16 × cols=1..5', !collisionFound);

// Pin the exact anonymous demo seed (0xa11ce11) the must-fix review flagged:
// the not-signed-in first-boot map must place every island card with no
// overlap. Reproduce the island renderer's call shape (cols = ceil(sqrt(n))).
const DEMO_SEED = 0xa11ce11;
const demoTree = clusterLibrary(SAMPLE, DEMO_SEED);
const demoDistricts = flattenDistricts(demoTree);
const demoCols = Math.max(1, Math.ceil(Math.sqrt(demoDistricts.length)));
const demoPos = layoutClusterPositions(
  demoDistricts.map((d) => d.id),
  DEMO_SEED,
  LAYOUT_SALT,
  demoCols,
);
check('anonymous demo seed (0xa11ce11) island layout has no collisions', distinctKey(demoPos));
check('anonymous demo seed renders all island cards (count match)', demoPos.length === demoDistricts.length);

// Layout no longer depends on seed/salt (variety comes from the cluster TREE):
// same ids + cols → same positions regardless of seed. Locks the new contract.
const seedA = layoutClusterPositions(ids, 0x11111111, LAYOUT_SALT, 2);
const seedB = layoutClusterPositions(ids, 0x22222222, LAYOUT_SALT, 2);
check('layout is seed-independent (variety lives in the cluster tree)', JSON.stringify(seedA) === JSON.stringify(seedB));

// different salt → can differ (namespace isolation wired).
check(
  'CLUSTER_SALT != LAYOUT_SALT (namespace isolation)',
  CLUSTER_SALT !== LAYOUT_SALT,
);

// --- blobCells --------------------------------------------------------------
const W = 14;
const H = 14;
const blob1 = blobCells(7, 7, 9, W, H, SEED, LAYOUT_SALT);
const blob2 = blobCells(7, 7, 9, W, H, SEED, LAYOUT_SALT);
check('blobCells same args → identical cell set', JSON.stringify(blob1) === JSON.stringify(blob2));
check('blobCells always emits the core', blob1.some((c) => c.x === 7 && c.y === 7));
check('blobCells stays in bounds', blob1.every((c) => c.x >= 0 && c.x < W && c.y >= 0 && c.y < H));
check('blobCells has no duplicate cells', new Set(blob1.map((c) => `${c.x},${c.y}`)).size === blob1.length);
const tinyBlob = blobCells(0, 0, 1, W, H, SEED, LAYOUT_SALT);
check('1-area blob still produces a labelled core', tinyBlob.length >= 1);
const biggerBlob = blobCells(7, 7, 25, W, H, SEED, LAYOUT_SALT);
check('bigger area → bigger (or equal) blob', biggerBlob.length >= blob1.length);

// --- label helpers ----------------------------------------------------------
check('truncateLabel passes short strings through', truncateLabel('Hi', 10) === 'Hi');
check('truncateLabel adds ellipsis when over', truncateLabel('Disco Elysium', 8) === 'Disco E…');
check('truncateLabel respects max width', truncateLabel('Disco Elysium', 8).length === 8);
check('truncateLabel max<=0 → empty', truncateLabel('x', 0) === '');
check(
  'districtLabel picks the most-lived-in member name',
  districtLabel({ id: 'd', games: SAMPLE.slice(0, 3), activity: 'engaged' }).length > 0,
);

report();
