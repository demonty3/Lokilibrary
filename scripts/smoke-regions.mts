/**
 * Phase 7 / v2.x smoke — `npx tsx scripts/smoke-regions.mts`.
 *
 * Locks the PURE region-terminal logic (src/procedural/regions.ts) that the
 * composable-panes Depth-3 wiring consumes: bucketing the library into wings
 * (delegated to the 7-A `clusterLibrary`) + deriving one deterministic cell
 * seed per wing. The renderer wiring (mountPaneLevel region branch, the 'r'
 * keybind) is visual; the cycle reducer is covered in smoke-7b-panes (R1–R5).
 *
 * Hard rules asserted (CLAUDE.md src/procedural determinism contract):
 *   - same (games, profileSeed) → byte-identical region list
 *   - every game lands in exactly one wing (no dupes, no gaps) — delegated to
 *     clusterLibrary, re-checked here so the delegation can't silently rot
 *   - regionId / seed are unique per wing; every wing has a non-empty label
 *   - regionSeed determinism: same (profileSeed, regionId) → same uint32, each
 *     wing distinct, every wing distinct from the bare profile seed (so a wing
 *     never aliases the root pane)
 *   - input-order invariance (appid canonicalisation via clusterLibrary)
 *   - REGION_SALT is a fresh PRNG namespace (no collision with any other
 *     src/procedural consumer)
 *   - edge cases: 0 games → [], 1 game → 1 wing
 */

import { makeChecker } from './lib/smoke.ts';
import type { ClusterGame } from '../src/procedural/clusters.ts';

const { regionTerminals, regionSeed, REGION_SALT } = await import(
  '../src/procedural/regions.ts'
);

const { check, report } = makeChecker('smoke regions');

// --- sample library (mirrors SAMPLE_LIBRARY / smoke-7a, 7 games) -----------
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

// --- R/D: determinism ------------------------------------------------------
const r1 = regionTerminals(SAMPLE, SEED);
const r2 = regionTerminals(SAMPLE, SEED);
check('same (games, seed) → byte-identical region list', JSON.stringify(r1) === JSON.stringify(r2));
check('at least one region for a non-empty library', r1.length >= 1);

// --- M: membership (delegation to clusterLibrary stays honest) -------------
const allAppids = r1.flatMap((rt) => rt.games.map((g) => g.appid));
check('every game lands in exactly one wing (count)', allAppids.length === SAMPLE.length);
check('no game appears in two wings', new Set(allAppids).size === SAMPLE.length);
check(
  'every input appid is present somewhere',
  SAMPLE.every((g) => allAppids.includes(g.appid)),
);

// --- S: structure ----------------------------------------------------------
check('every wing has games', r1.every((rt) => rt.games.length > 0));
check('every wing has a canonical district id (d\\d+)', r1.every((rt) => /^d\d+$/.test(rt.regionId)));
check('every wing has a non-empty label', r1.every((rt) => typeof rt.label === 'string' && rt.label.length > 0));
check('every wing seed is a uint32', r1.every((rt) => rt.seed === (rt.seed >>> 0)));
check('wing regionIds are unique', new Set(r1.map((rt) => rt.regionId)).size === r1.length);
check('wing seeds are unique', new Set(r1.map((rt) => rt.seed)).size === r1.length);

// --- N: regionSeed namespace + determinism ---------------------------------
check('regionSeed deterministic', regionSeed(SEED, 'd0') === regionSeed(SEED, 'd0'));
check('regionSeed(d0) ≠ regionSeed(d1)', regionSeed(SEED, 'd0') !== regionSeed(SEED, 'd1'));
check('every wing seed differs from the bare profile seed', r1.every((rt) => rt.seed !== (SEED >>> 0)));
check('regionSeed is a uint32', (regionSeed(SEED, 'd3') >>> 0) === regionSeed(SEED, 'd3'));
// REGION_SALT must not collide with cell 0xce11 / scatter 0x5ca7 / Loki 0x10ce
// / landmark 0x1a4d / cluster 0xc1a5 / layout 0xc0a5 (the share-URL contract).
const OTHER_SALTS = [0xce11, 0x5ca7, 0x10ce, 0x1a4d, 0xc1a5, 0xc0a5];
check('REGION_SALT is a fresh PRNG namespace', !OTHER_SALTS.includes(REGION_SALT));

// --- I: input-order invariance (canonicalised by appid in clusterLibrary) --
const shuffled = [...SAMPLE].reverse();
check(
  'reversed input → identical regions',
  JSON.stringify(regionTerminals(shuffled, SEED)) === JSON.stringify(r1),
);

// --- A: aligned seams — the "walk into a DIFFERENT-looking room" enabler ----
// Every wing carves its walkable seam opening from the SHARED profile seed, so
// all wings (and the whole-library pane) open at the SAME row even though their
// rooms differ. That alignment is what lets the floor-gate find a crossing
// between two visibly different terminals.
const { layoutCell } = await import('../src/procedural/cell.ts');
const { T_FLOOR } = await import('../src/procedural/tiles/library.ts');

const wholeLib = layoutCell(SEED, SEED);
const wings = r1.map((rt) => layoutCell(rt.seed, SEED)); // shared seamSeed = profile
const seamKey = (l: { seamRows: number[] }) => l.seamRows.join(',');
check(
  'A every wing carves the SAME seam rows as the whole library (shared seamSeed)',
  wings.every((l) => seamKey(l) === seamKey(wholeLib)),
  `whole=${seamKey(wholeLib)} wings=[${wings.map(seamKey).join(' | ')}]`,
);
// …yet the rooms themselves still LOOK DIFFERENT (different wing seeds → WFC).
const distinctRooms = new Set([wholeLib, ...wings].map((l) => JSON.stringify(l.tiles)));
check('A wings render visibly different rooms (distinct tile grids)', distinctRooms.size >= 2, `distinct=${distinctRooms.size}`);
// Every aligned row is floor on BOTH side walls in every wing → crossable.
const W = wholeLib.width;
check(
  'A every seam row is floor on both E+W edges in every wing (crossable)',
  [wholeLib, ...wings].every((l) => l.seamRows.every((rr) => l.tiles[rr][0] === T_FLOOR && l.tiles[rr][W - 1] === T_FLOOR)),
);
// Determinism: the seam row is a pure function of seamSeed (independent of which
// room seed it's paired with — that's exactly why wings align).
check('A seam rows are deterministic for a given seamSeed', seamKey(layoutCell(0x999, SEED)) === seamKey(wholeLib));

// --- E: edge cases ---------------------------------------------------------
check('0 games → no regions', regionTerminals([], SEED).length === 0);
const single = regionTerminals([{ appid: 1, name: 'Solo' }], SEED);
check('1 game → 1 wing', single.length === 1);
check('single wing holds that one game', single[0]?.games.length === 1 && single[0]?.games[0]?.appid === 1);

report();
