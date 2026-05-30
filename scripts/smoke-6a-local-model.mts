/**
 * Phase 6A smoke — `npx tsx scripts/smoke-6a-local-model.mts`.
 *
 * "Local AI lives in your world" Depth 1. Pins the PURE logic that backs the
 * local-model landmark (no live Ollama required — the renderer wiring +
 * worker fetch are the only untestable legs):
 *
 *   1. size → variant mapping crosses the cottage/tower threshold at the
 *      right boundary, and only ever emits whitelisted glyphs;
 *   2. landmark-model selection is deterministic (largest, name tiebreak);
 *   3. deterministic placement — same (seed, layout, keepouts) → identical
 *      CellPoint, and the landmark never lands on a keepout / non-floor cell
 *      and always has a walkable neighbour to stand on for press-E;
 *   4. the {present:false} no-Ollama / cloud parse path → no landmark
 *      (pickLandmarkModel === null) and steady (non-glow) state;
 *   5. formatLocalModelStatus → "Name · idle|running · localhost".
 */

import { makeChecker } from './lib/smoke.ts';
import type { CellLayout } from '../src/procedural/cell.ts';

const {
  pickLandmarkCell,
  pickLandmarkModel,
  landmarkVariantFor,
  landmarkGlyphFor,
  paramClassToBillions,
  formatLocalModelStatus,
  LANDMARK_GLYPHS,
  TOWER_PARAM_THRESHOLD_B,
} = await import('../src/procedural/localLandmark.ts');
const { parseLocalModelBody, NO_LOCAL_MODEL } = await import('../src/api/localModel.ts');
const { T_FLOOR, T_WALL_H, T_WALL_V, T_CORNER_TL, T_CORNER_TR, T_CORNER_BL, T_CORNER_BR } =
  await import('../src/procedural/tiles/library.ts');

const { check, report } = makeChecker('smoke 6A');

const WHITELIST = new Set(Object.values(LANDMARK_GLYPHS));

/** A walled room: floor interior, wall border, spawn at (2,2). */
function roomLayout(w: number, h: number): CellLayout {
  const tiles: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      let t = T_FLOOR as number;
      if (y === 0 && x === 0) t = T_CORNER_TL;
      else if (y === 0 && x === w - 1) t = T_CORNER_TR;
      else if (y === h - 1 && x === 0) t = T_CORNER_BL;
      else if (y === h - 1 && x === w - 1) t = T_CORNER_BR;
      else if (y === 0 || y === h - 1) t = T_WALL_H;
      else if (x === 0 || x === w - 1) t = T_WALL_V;
      row.push(t);
    }
    tiles.push(row);
  }
  return {
    tiles,
    width: w,
    height: h,
    bookshelfSlots: [],
    doorAt: { x: 0, y: h - 1 },
    spawnAt: { x: 2, y: 2 },
    windowAt: { x: 1, y: 0 },
    // wfc diagnostic is unused by the placement logic; cast through unknown.
  } as unknown as CellLayout;
}

// --- 1. size → variant mapping + glyph whitelist ----------------------------
check('paramClass "7B" parses to 7', paramClassToBillions('7B') === 7);
check('paramClass "70B" parses to 70', paramClassToBillions('70B') === 70);
check('paramClass "13.0B" parses to 13', paramClassToBillions('13.0B') === 13);
check('paramClass undefined → undefined', paramClassToBillions(undefined) === undefined);
check('paramClass garbage → undefined', paramClassToBillions('latest') === undefined);

check('7B → cottage', landmarkVariantFor({ name: 'qwen2.5:7b', paramClass: '7B' }) === 'cottage');
check('14B → cottage', landmarkVariantFor({ name: 'qwen3:14b', paramClass: '14B' }) === 'cottage');
check('70B → tower', landmarkVariantFor({ name: 'llama3:70b', paramClass: '70B' }) === 'tower');
// Boundary: threshold is inclusive of tower.
check(
  `${TOWER_PARAM_THRESHOLD_B}B (== threshold) → tower`,
  landmarkVariantFor({ name: 'x', paramClass: `${TOWER_PARAM_THRESHOLD_B}B` }) === 'tower',
);
check(
  `${TOWER_PARAM_THRESHOLD_B - 1}B (just below) → cottage`,
  landmarkVariantFor({ name: 'x', paramClass: `${TOWER_PARAM_THRESHOLD_B - 1}B` }) === 'cottage',
);
// sizeBytes fallback when no paramClass.
check(
  'no paramClass, tiny bytes → cottage',
  landmarkVariantFor({ name: 'x', sizeBytes: 4 * 1024 * 1024 * 1024 }) === 'cottage',
);
check(
  'no paramClass, huge bytes → tower',
  landmarkVariantFor({ name: 'x', sizeBytes: 40 * 1024 * 1024 * 1024 }) === 'tower',
);
check('no size info at all → cottage (humble default)', landmarkVariantFor({ name: 'x' }) === 'cottage');

check('cottage glyph is whitelisted', WHITELIST.has(landmarkGlyphFor('cottage')));
check('tower glyph is whitelisted', WHITELIST.has(landmarkGlyphFor('tower')));
check('cottage and tower glyphs differ', landmarkGlyphFor('cottage') !== landmarkGlyphFor('tower'));

// --- 2. deterministic model selection ---------------------------------------
const multi = {
  present: true as const,
  running: false,
  models: [
    { name: 'qwen2.5:7b', sizeBytes: 4_700_000_000, paramClass: '7B' },
    { name: 'llama3:70b', sizeBytes: 39_000_000_000, paramClass: '70B' },
    { name: 'qwen3:14b', sizeBytes: 9_000_000_000, paramClass: '14B' },
  ],
};
const picked = pickLandmarkModel(multi);
check('picks the largest model by sizeBytes', picked !== null && picked.name === 'llama3:70b');
const picked2 = pickLandmarkModel(multi);
check('model pick is deterministic', JSON.stringify(picked) === JSON.stringify(picked2));

// Name tiebreak when sizes are equal.
const tie = {
  present: true as const,
  running: false,
  models: [
    { name: 'beta', sizeBytes: 1000 },
    { name: 'alpha', sizeBytes: 1000 },
  ],
};
const tiePick = pickLandmarkModel(tie);
check('equal-size tiebreak picks lexically-first name', tiePick !== null && tiePick.name === 'alpha');

// --- 3. deterministic placement ---------------------------------------------
const layout = roomLayout(24, 16);
const SEED = 0x6a10ca1;
const keepouts = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
];
const cellA = pickLandmarkCell(layout, SEED, keepouts);
const cellB = pickLandmarkCell(layout, SEED, keepouts);
check('placement is deterministic (same seed → same cell)', cellA.x === cellB.x && cellA.y === cellB.y);

const differentSeed = pickLandmarkCell(layout, SEED ^ 0xffff, keepouts);
check(
  'a different seed can yield a different cell',
  differentSeed.x !== cellA.x || differentSeed.y !== cellA.y,
);

// Landmark must land on a real floor cell, never a keepout, never the spawn.
check('landmark lands on T_FLOOR', layout.tiles[cellA.y][cellA.x] === T_FLOOR);
const keepoutKeys = new Set(keepouts.map((k) => `${k.x},${k.y}`));
check('landmark avoids the keepout set', !keepoutKeys.has(`${cellA.x},${cellA.y}`));
check(
  'landmark avoids the player spawn',
  !(cellA.x === layout.spawnAt.x && cellA.y === layout.spawnAt.y),
);

// Landmark must have at least one free floor neighbour so the player can
// stand adjacent and press E.
function hasFreeFloorNeighbour(cx: number, cy: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= layout.width || ny < 0 || ny >= layout.height) continue;
      if (layout.tiles[ny][nx] !== T_FLOOR) continue;
      if (keepoutKeys.has(`${nx},${ny}`)) continue;
      if (nx === layout.spawnAt.x && ny === layout.spawnAt.y) continue;
      return true;
    }
  }
  return false;
}
check('landmark has a walkable neighbour for press-E', hasFreeFloorNeighbour(cellA.x, cellA.y));

// Determinism across many seeds — every result is a valid placeable cell.
let allValid = true;
for (let s = 0; s < 200; s++) {
  const c = pickLandmarkCell(layout, s, keepouts);
  if (
    layout.tiles[c.y][c.x] !== T_FLOOR ||
    keepoutKeys.has(`${c.x},${c.y}`) ||
    (c.x === layout.spawnAt.x && c.y === layout.spawnAt.y)
  ) {
    allValid = false;
    break;
  }
}
check('200 seeds all place on a valid free floor cell', allValid);

// --- 4. present:false / no-Ollama / cloud path ------------------------------
check('NO_LOCAL_MODEL has present:false', NO_LOCAL_MODEL.present === false);
check('pickLandmarkModel(NO_LOCAL_MODEL) === null', pickLandmarkModel(NO_LOCAL_MODEL) === null);
check(
  'pickLandmarkModel of present-but-empty === null',
  pickLandmarkModel({ present: true, running: false, models: [] }) === null,
);

// parse path mirrors the worker shapes.
check('parse {present:false} → present:false', parseLocalModelBody({ present: false }).present === false);
check(
  'parse cloud-style empty present:false → present:false',
  parseLocalModelBody({ present: false, models: [], running: false }).present === false,
);
check('parse null body → present:false', parseLocalModelBody(null).present === false);
check('parse non-object body → present:false', parseLocalModelBody('nope').present === false);
check(
  'parse present:true with no models → present:false',
  parseLocalModelBody({ present: true, models: [], running: false }).present === false,
);

const goodBody = {
  present: true,
  running: true,
  models: [{ name: 'qwen2.5:7b', sizeBytes: 4_700_000_000, paramClass: '7B' }],
};
const parsedGood = parseLocalModelBody(goodBody);
check('parse valid body → present:true', parsedGood.present === true);
check(
  'parse valid body preserves running flag',
  parsedGood.present === true && parsedGood.running === true,
);
check(
  'parse valid body preserves model name',
  parsedGood.present === true && parsedGood.models[0]?.name === 'qwen2.5:7b',
);
// Malformed entries are dropped, not crash.
const mixedBody = {
  present: true,
  running: false,
  models: [{ name: '' }, { foo: 1 }, { name: 'real:7b' }],
};
const parsedMixed = parseLocalModelBody(mixedBody);
check(
  'parse drops nameless/garbage model entries',
  parsedMixed.present === true && parsedMixed.models.length === 1 && parsedMixed.models[0].name === 'real:7b',
);

// --- 5. status string formatting --------------------------------------------
const m = { name: 'Qwen 2.5 7B' };
check(
  'idle status string',
  formatLocalModelStatus(m, false) === 'Qwen 2.5 7B · idle · localhost',
);
check(
  'running status string',
  formatLocalModelStatus(m, true) === 'Qwen 2.5 7B · running · localhost',
);
check('status always ends in localhost', formatLocalModelStatus(m, false).endsWith('localhost'));
check('status names the model', formatLocalModelStatus(m, true).startsWith('Qwen 2.5 7B'));

report();
