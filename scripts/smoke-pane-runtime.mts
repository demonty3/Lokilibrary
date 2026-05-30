/**
 * Phase 7 / v2.x smoke — `npx tsx scripts/smoke-pane-runtime.mts`.
 *
 * Pure-state verification of the per-pane playerPos + agentRuntime +
 * perception scoping (the "per-pane runtime unblock"). NO PIXI / Electron —
 * this exercises ONLY the state modules. Covers:
 *
 *   PLAYER POSITION (playerPos.ts)
 *     P1 isolation       — setPlayerPos('A',…) doesn't move pane 'B'
 *     P2 stable ref      — getPlayerPos('A') returns the SAME object each call
 *     P3 single-pane     — playerPosition === getPlayerPos('root') (identity)
 *                          AND setPlayerPosition(x,y) moves getPlayerPos('root')
 *     P4 clear isolation — clearPlayerPos('A') doesn't affect 'B'
 *     P5 respawn         — getPlayerPos on a freshly-cleared id → default {0,0}
 *
 *   RUNTIME (agentRuntime.ts)
 *     R1 isolation       — setRuntimeIn(A,…) leaves getRuntimeIn(B,id) undefined
 *     R2 mutate isolation— mutating A's loki.x doesn't move B's loki
 *     R3 clear isolation — clearRuntimesIn(A) leaves B intact
 *     R4 list order      — listRuntimesIn returns only that scope's agents, in
 *                          insertion order
 *     R5 single-pane     — global setRuntime/getRuntime/listRuntimes/clearRuntimes
 *                          === the same ops on DEFAULT_SCOPE (cross-checked both ways)
 *     R6 initialRuntime  — pure constructor: never mutates any scope's Map
 *
 *   PERCEPTION (perception.ts)
 *     C1 cache isolation — a scope's salience dedupe is INDEPENDENT per scope
 *                          (same agent+event in scope A doesn't dedupe in scope B)
 *     C2 reset isolation — resetPerceptionState(A.perception) doesn't clear B's
 */

import { makeChecker } from './lib/smoke.ts';
import { COHORT } from '../src/agents/cohort.ts';
import {
  computePerception,
  resetPerceptionState,
  type WorldSnapshot,
} from '../src/agents/perception.ts';
import {
  createRuntimeScope,
  initialRuntime,
  setRuntimeIn,
  getRuntimeIn,
  listRuntimesIn,
  clearRuntimesIn,
  setRuntime,
  getRuntime,
  listRuntimes,
  clearRuntimes,
  DEFAULT_SCOPE,
} from '../src/state/agentRuntime.ts';
import {
  getPlayerPos,
  setPlayerPos,
  clearPlayerPos,
  playerPosition,
  setPlayerPosition,
} from '../src/state/playerPos.ts';

const { check, report } = makeChecker('pane-runtime');

// ----------------------------------------------------------------------
// PLAYER POSITION
// ----------------------------------------------------------------------

// P1 — isolation
setPlayerPos('paneA', 3, 4);
setPlayerPos('paneB', 9, 1);
check(
  'P1 player isolation — pane A move leaves pane B',
  getPlayerPos('paneA').x === 3 &&
    getPlayerPos('paneA').y === 4 &&
    getPlayerPos('paneB').x === 9 &&
    getPlayerPos('paneB').y === 1,
  `A=${JSON.stringify(getPlayerPos('paneA'))} B=${JSON.stringify(getPlayerPos('paneB'))}`,
);

// P2 — stable reference across calls (cell.ts caches this + mutates at 60Hz)
const refA1 = getPlayerPos('paneA');
const refA2 = getPlayerPos('paneA');
check('P2 player stable reference', refA1 === refA2, 'getPlayerPos must cache + return same object');
// mutating through the captured ref is visible via a fresh read
refA1.x = 42;
check('P2b mutation through cached ref is live', getPlayerPos('paneA').x === 42);

// P3 — single-pane reduction: the back-compat aliases ARE the 'root' object
check(
  'P3 playerPosition === getPlayerPos("root") identity',
  playerPosition === getPlayerPos('root'),
  'alias must be the same cached reference, not a copy',
);
setPlayerPosition(7, 8);
check(
  'P3b setPlayerPosition moves getPlayerPos("root")',
  getPlayerPos('root').x === 7 && getPlayerPos('root').y === 8,
);
setPlayerPos('root', 1, 2);
check(
  'P3c playerPosition reads track live root writes (no lag)',
  playerPosition.x === 1 && playerPosition.y === 2,
);

// P3d — clearing 'root' (cell teardown) must NOT orphan the back-compat
// alias: it captured the object at module load, so a delete+remint would
// leave it stale. clearPlayerPos resets 'root' in place instead.
clearPlayerPos('root');
check(
  'P3d clearPlayerPos("root") preserves alias identity',
  playerPosition === getPlayerPos('root'),
);
setPlayerPosition(5, 6);
check(
  'P3e alias still tracks writes after a root clear (no stale ref)',
  playerPosition.x === 5 && playerPosition.y === 6,
);
// restore the P3c value so any later root reads see the pre-insert state
setPlayerPos('root', 1, 2);

// P4 — clear isolation
setPlayerPos('paneA', 5, 5);
setPlayerPos('paneB', 6, 6);
clearPlayerPos('paneA');
check(
  'P4 clearPlayerPos(A) leaves B intact',
  getPlayerPos('paneB').x === 6 && getPlayerPos('paneB').y === 6,
);

// P5 — respawn after clear → default {0,0}
check(
  'P5 respawn after clear → default {0,0}',
  getPlayerPos('paneA').x === 0 && getPlayerPos('paneA').y === 0,
);

// ----------------------------------------------------------------------
// RUNTIME
// ----------------------------------------------------------------------

const scopeA = createRuntimeScope();
const scopeB = createRuntimeScope();

setRuntimeIn(scopeA, initialRuntime({ id: 'loki', x: 1, y: 1 }));

// R1 — isolation: B never saw loki
check('R1 runtime isolation — B has no loki', getRuntimeIn(scopeB, 'loki') === undefined);

// R2 — mutate isolation
setRuntimeIn(scopeB, initialRuntime({ id: 'loki', x: 20, y: 20 }));
getRuntimeIn(scopeA, 'loki')!.x = 99;
check(
  'R2 mutate isolation — A.loki.x change leaves B.loki',
  getRuntimeIn(scopeB, 'loki')!.x === 20 && getRuntimeIn(scopeA, 'loki')!.x === 99,
);

// R3 — clear isolation
setRuntimeIn(scopeA, initialRuntime({ id: 'cat', x: 2, y: 2 }));
clearRuntimesIn(scopeA);
check(
  'R3 clear isolation — clearRuntimesIn(A) leaves B',
  listRuntimesIn(scopeA).length === 0 && getRuntimeIn(scopeB, 'loki') !== undefined,
);

// R4 — list order (insertion order, only this scope's agents)
const scopeC = createRuntimeScope();
setRuntimeIn(scopeC, initialRuntime({ id: 'first', x: 0, y: 0 }));
setRuntimeIn(scopeC, initialRuntime({ id: 'second', x: 0, y: 0 }));
setRuntimeIn(scopeC, initialRuntime({ id: 'third', x: 0, y: 0 }));
const ids = listRuntimesIn(scopeC).map((r) => r.id);
check(
  'R4 list insertion order + scope-only',
  ids.length === 3 && ids[0] === 'first' && ids[1] === 'second' && ids[2] === 'third',
  ids.join(','),
);

// R5 — single-pane reduction: globals === DEFAULT_SCOPE ops, both directions
clearRuntimes();
setRuntime(initialRuntime({ id: 'glob', x: 3, y: 3 }));
// read back via the scope-taking variant on DEFAULT_SCOPE
check(
  'R5 global setRuntime writes DEFAULT_SCOPE',
  getRuntimeIn(DEFAULT_SCOPE, 'glob') !== undefined,
);
// write via the scope variant on DEFAULT_SCOPE, read via the global
setRuntimeIn(DEFAULT_SCOPE, initialRuntime({ id: 'glob2', x: 4, y: 4 }));
check(
  'R5b DEFAULT_SCOPE write visible via global getRuntime',
  getRuntime('glob2') !== undefined,
);
check(
  'R5c global listRuntimes === listRuntimesIn(DEFAULT_SCOPE)',
  listRuntimes().length === listRuntimesIn(DEFAULT_SCOPE).length &&
    listRuntimes().every((r, i) => r.id === listRuntimesIn(DEFAULT_SCOPE)[i].id),
);
clearRuntimes();
check('R5d global clearRuntimes clears DEFAULT_SCOPE', listRuntimesIn(DEFAULT_SCOPE).length === 0);

// R6 — initialRuntime purity (never touches a scope)
const before = listRuntimesIn(scopeB).length;
const built = initialRuntime({ id: 'phantom', x: 0, y: 0 });
check(
  'R6 initialRuntime is pure (no scope mutation)',
  listRuntimesIn(scopeB).length === before && built.id === 'phantom',
);

// ----------------------------------------------------------------------
// PERCEPTION CACHE ISOLATION
// ----------------------------------------------------------------------

const lokiDef = COHORT.find((d) => d.id === 'loki')!;

// Two scopes, each with its OWN 'loki' near the player. The salience window
// dedupes a repeated (agent|kind|subject) WITHIN a scope; across scopes the
// caches are independent, so the same event fires fresh in each.
const psA = createRuntimeScope();
const psB = createRuntimeScope();
const rtA = initialRuntime({ id: 'loki', x: 10, y: 5 });
rtA.present = true;
const rtB = initialRuntime({ id: 'loki', x: 10, y: 5 });
rtB.present = true;
const world: WorldSnapshot = {
  player: { x: 11, y: 5 }, // distance 1 — inside fov
  agents: new Map([['loki', { x: 10, y: 5 }]]),
  bookshelves: [],
};

// First fire in scope A at t=1000 — proximity is salient → 1 event.
const a1 = computePerception(lokiDef, rtA, world, 1000, undefined, undefined, psA.perception);
// Immediate re-fire in scope A (same window) → deduped → 0 proximity events.
const a2 = computePerception(lokiDef, rtA, world, 1100, undefined, undefined, psA.perception);
// First fire in scope B at the SAME t=1100 — independent cache → salient again.
const b1 = computePerception(lokiDef, rtB, world, 1100, undefined, undefined, psB.perception);

const a1Prox = a1.filter((e) => e.kind === 'player_proximity').length;
const a2Prox = a2.filter((e) => e.kind === 'player_proximity').length;
const b1Prox = b1.filter((e) => e.kind === 'player_proximity').length;
check(
  'C1 perception cache isolation — A dedupes within scope, B fires fresh',
  a1Prox === 1 && a2Prox === 0 && b1Prox === 1,
  `a1=${a1Prox} a2=${a2Prox} b1=${b1Prox}`,
);

// C2 — reset isolation. Reset scope A's perception cache; B's stays warm.
resetPerceptionState(psA.perception);
// After A's reset, A fires fresh again at same window…
const a3 = computePerception(lokiDef, rtA, world, 1150, undefined, undefined, psA.perception);
// …but B is still within its window from b1 (t=1100) → still deduped.
const b2 = computePerception(lokiDef, rtB, world, 1150, undefined, undefined, psB.perception);
const a3Prox = a3.filter((e) => e.kind === 'player_proximity').length;
const b2Prox = b2.filter((e) => e.kind === 'player_proximity').length;
check(
  'C2 reset isolation — reset(A) re-arms A, leaves B deduped',
  a3Prox === 1 && b2Prox === 0,
  `a3=${a3Prox} b2=${b2Prox}`,
);

report();
