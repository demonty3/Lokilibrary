/**
 * Phase 7-D.2 smoke — `npx tsx scripts/smoke-7d2-walk.mts`.
 *
 * Pure-Node verification (NO PIXI Application, NO DOM, NO Electron) of the LIVE
 * seam walk under the SINGLE ROAMING ROSTER model. The on-screen sprite handoff
 * is PIXI-visual (Windows-only, see TODO-USER.md); this smoke locks the
 * runtime-side logic that the handoff rides on:
 *
 *   ROSTER-ONCE (single roaming roster)
 *     A1  the world's COHORT spawns ONCE into root's scope; a split pane starts
 *         EMPTY — two scopes do NOT both contain 'loki' at init.
 *     A2  the root-gate replicates resolveSpawn determinism (same as 2b-cohort).
 *
 *   WIRING (Seam[] → SeamEdge[] / SeamExit, the perception + crossing graph)
 *     W1  buildSeamEdgesForPane('root', study-split) → exactly one SeamEdge,
 *         neighbour p2, sharedEdge 'E', bandLine === rootInteriorWidth,
 *         walkable true; matches the smoke-7d-seams eastEdge oracle shape.
 *     W2  seamExitsForPane('root', …) → an exit on root's right column whose
 *         bridged entry lands on p2's LEFT column (x===0).
 *     W3  single-pane reduction — buildSeams([root]) === [] ⇒ openSeamsFor('root')
 *         returns [] ⇒ enrichSnapshotAcrossSeams returns base BY REFERENCE.
 *
 *   CROSS-INTENT (behavior.ts emits at an open walkable seam edge; clamps else)
 *     B1  an agent ON a seam-exit edge cell, wandering, can emit a pendingCross
 *         to the correct neighbour + bridged entry.
 *     B2  no seam exits in ctx ⇒ the agent NEVER emits pendingCross (clamps to
 *         in-bounds floor exactly as today).
 *
 *   MIGRATION (consume the intent A→B exactly once)
 *     M1  consuming pendingCross migrates the agent A→B exactly once: gone from
 *         A, present once in B, repositioned at the bridged entry, in-flight
 *         activePlan preserved (same object), pendingCross cleared.
 *
 *   NO PING-PONG
 *     D1  a just-arrived agent (justArrivedAt stamped on the entry cell) does
 *         NOT emit a cross-intent on its immediate next BT tick.
 *     D2  once the agent steps OFF the entry cell, justArrivedAt clears so it
 *         can cross again later.
 *
 *   ROSTER-AWARE REMOUNT (must-fix — no DUP on a partial root relevel)
 *     C1  with `loki` already migrated into a sibling pane (p2, registered), a
 *         root REMOUNT running the roster-aware gate does NOT re-create `loki`
 *         in root — total `loki` count across panes stays exactly 1.
 *     C2  isAgentLiveElsewhere excludes the queried pane itself (so the FIRST
 *         world mount, where only root is registered, still seeds the roster).
 *
 *   FLOOR-GATED SEAM EXITS (must-fix — never strand an agent in a wall)
 *     F1  with the REAL cell layout, the carved walkable seam openings
 *         (layout.seamRows) are EXACTLY the crossable E/W exits through the
 *         walkability oracle; every other edge row is wall (no stranding).
 *     F2  the oracle rejects an exit whose bridged ENTRY cell is a wall even
 *         when the exit cell is floor (no migrate-into-wall).
 *
 *   SINGLE-PANE REDUCTION (the load-bearing safety constraint)
 *     R1  one 'root' pane: roster present, openSeamsFor [], snapshot by
 *         reference, migrateRuntime NEVER invoked.
 */

import { makeChecker } from './lib/smoke.ts';
import { layoutCell } from '../src/procedural/cell.ts';
import { mulberry32 } from '../src/procedural/prng.ts';
import { T_FLOOR } from '../src/procedural/tiles/library.ts';
import { COHORT, resolveSpawn } from '../src/agents/cohort.ts';
import {
  tickBehavior,
  type BehaviorContext,
} from '../src/agents/behavior.ts';
import {
  createRuntimeScope,
  initialRuntime,
  setRuntimeIn,
  getRuntimeIn,
  listRuntimesIn,
  migrateRuntime,
  type RuntimeScope,
} from '../src/state/agentRuntime.ts';
import {
  buildSeams,
  seamExitsForPane,
  type PaneDims,
  type SeamExit,
  type WalkableOracle,
} from '../src/state/seams.ts';
import {
  buildSeamEdgesForPane,
  enrichSnapshotAcrossSeams,
} from '../src/agents/crossSeam.ts';
import {
  registerPane,
  isAgentLiveElsewhere,
  _resetPaneRegistry,
} from '../src/state/paneRegistry.ts';
import type { PaneDescriptor } from '../src/types.ts';

const { check, report } = makeChecker('smoke 7D.2');

const SEED = 0xa11ce11 >>> 0;
const layout = layoutCell(SEED);

// FNV-1a (same as the cohort renderer) for per-agent PRNG namespacing.
function fnv(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function buildPrngs(): Map<string, ReturnType<typeof mulberry32>> {
  const m = new Map<string, ReturnType<typeof mulberry32>>();
  for (const def of COHORT) m.set(def.id, mulberry32((SEED ^ fnv(def.id)) >>> 0));
  return m;
}

/** Replicate the cohort's root-gated roster spawn (setRuntimeIn only, no
 *  sprite). A non-root pane is left EMPTY. */
function spawnRoster(scope: RuntimeScope, paneId: string): void {
  if (paneId !== 'root') return;
  if (scope.runtimes.size !== 0) return;
  for (const def of COHORT) {
    const spawn = resolveSpawn(def.spawn, layout, SEED);
    setRuntimeIn(scope, initialRuntime({ id: def.id, x: spawn.x, y: spawn.y }));
  }
}

// ===========================================================================
// A — ROSTER ONCE
// ===========================================================================
{
  const root = createRuntimeScope();
  const p2 = createRuntimeScope();
  spawnRoster(root, 'root');
  spawnRoster(p2, 'p2'); // split pane → no-op

  check('A1 root holds the full roster (all 5)', listRuntimesIn(root).length === COHORT.length, `got ${listRuntimesIn(root).length}`);
  check('A1 split pane p2 starts EMPTY', listRuntimesIn(p2).length === 0, `got ${listRuntimesIn(p2).length}`);
  check('A1 loki lives ONLY in root (not both panes)', getRuntimeIn(root, 'loki') !== undefined && getRuntimeIn(p2, 'loki') === undefined);

  // A2 — determinism: a second root spawn from a fresh scope matches positions.
  const root2 = createRuntimeScope();
  spawnRoster(root2, 'root');
  const posA = listRuntimesIn(root).map((r) => `${r.id}:${r.x},${r.y}`).join('|');
  const posB = listRuntimesIn(root2).map((r) => `${r.id}:${r.x},${r.y}`).join('|');
  check('A2 roster spawn is deterministic (same seed → same positions)', posA === posB, `${posA} vs ${posB}`);
  // Loki lands on floor.
  const loki = getRuntimeIn(root, 'loki')!;
  check('A2 loki spawn is a floor cell', layout.tiles[loki.y]?.[loki.x] === T_FLOOR);
}

// ===========================================================================
// WIRING — build a study(cell+cell) split via the store, then project.
// ===========================================================================
const { useAppStore } = await import('../src/state/store.ts');
const get = () => useAppStore.getState();
get().setArrangement('single');
get().setArrangement('study');
get().setPaneLevel('p2', 'cell'); // force same-level so the seam is walkable

const ROOT_W = 20;
const ROOT_H = 12;
const P2_W = 16;
const P2_H = 18;
const dims = new Map<string, PaneDims>([
  ['root', { width: ROOT_W, height: ROOT_H }],
  ['p2', { width: P2_W, height: P2_H }],
]);

{
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  check('W0 study(cell+cell) yields one same-level seam', seams.length === 1 && seams[0].levelA === seams[0].levelB, `n=${seams.length}`);

  // W1 — SeamEdge projection (perception side) matches the eastEdge oracle.
  const edges = buildSeamEdgesForPane(seams, 'root', dims);
  check('W1 root sees exactly one SeamEdge', edges.length === 1, `got ${edges.length}`);
  const e = edges[0];
  check('W1 neighbour is p2', e.neighbourPaneId === 'p2', e.neighbourPaneId);
  check('W1 sharedEdge is E (root is the left pane)', e.sharedEdge === 'E', e.sharedEdge);
  check('W1 bandLine === root interior width', e.bandLine === ROOT_W, `bandLine=${e.bandLine}`);
  check('W1 bandStart/bandEnd span root height [0,H)', e.bandStart === 0 && e.bandEnd === ROOT_H);
  check('W1 walkable (same-level cell↔cell)', e.walkable === true);
  // bridge.toLocal maps a NEIGHBOUR point to just-past-this-pane's-right-column
  // — matching the eastEdge oracle: a neighbour at its left col (x=0) lands at
  // x = ROOT_W; at (x=1) lands at ROOT_W+1.
  const proj0 = e.bridge.toLocal({ x: 0, y: 5 });
  const proj1 = e.bridge.toLocal({ x: 1, y: 5 });
  check('W1 toLocal projects neighbour x=0 → ROOT_W (just past right column)', proj0.x === ROOT_W && proj0.y === 5, JSON.stringify(proj0));
  check('W1 toLocal projects neighbour x=1 → ROOT_W+1', proj1.x === ROOT_W + 1, `${proj1.x}`);

  // p2's view of root: it's the RIGHT pane → W edge, bandLine 0.
  const p2edges = buildSeamEdgesForPane(seams, 'p2', dims);
  check('W1b p2 sees root across a W edge, bandLine 0', p2edges.length === 1 && p2edges[0].sharedEdge === 'W' && p2edges[0].bandLine === 0);

  // W2 — seam EXITS (crossing side): root's right column → p2's left column.
  const exits = seamExitsForPane(seams, 'root', dims);
  check('W2 root has seam exits along its right column', exits.size === ROOT_H, `got ${exits.size}`);
  const exitMid = exits.get(`${ROOT_W - 1},6`);
  check('W2 exit at (ROOT_W-1, 6) exists', exitMid !== undefined);
  check('W2 exit edge faces E', exitMid?.sharedEdge === 'E');
  check('W2 bridged entry lands in p2', exitMid?.entry.paneId === 'p2', exitMid?.entry.paneId);
  check('W2 bridged entry x === 0 (p2 left column)', exitMid?.entry.x === 0, `x=${exitMid?.entry.x}`);

  // p2 → root exits (other direction): p2's left column → root's right column.
  const p2exits = seamExitsForPane(seams, 'p2', dims);
  const p2exitMid = p2exits.get(`0,6`);
  check('W2b p2 left-column exit bridges into root right column', p2exitMid?.entry.paneId === 'root' && p2exitMid?.entry.x === ROOT_W - 1, JSON.stringify(p2exitMid?.entry));
}

// W3 — single-pane reduction: buildSeams([root]) === [] ⇒ empty projections.
{
  get().setArrangement('single');
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  check('W3 single pane → zero seams', seams.length === 0);
  check('W3 buildSeamEdgesForPane → []', buildSeamEdgesForPane(seams, 'root', dims).length === 0);
  check('W3 seamExitsForPane → empty', seamExitsForPane(seams, 'root', dims).size === 0);
  // enricher returns base BY REFERENCE when openSeamsFor returns [].
  const base = { player: { x: 1, y: 1 }, agents: new Map<string, { x: number; y: number }>(), bookshelves: [] as { x: number; y: number }[] };
  const deps = {
    openSeamsFor: () => buildSeamEdgesForPane(seams, 'root', dims),
    getNeighbourScope: () => undefined,
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov: 8,
  };
  const enriched = enrichSnapshotAcrossSeams(base, 'root', deps);
  check('W3 enricher returns base BY REFERENCE (no-seam identity)', enriched === base);
}

// ===========================================================================
// CROSS-INTENT — behavior emits pendingCross at an open walkable seam edge.
// ===========================================================================

/** Build a BehaviorContext whose seamExits offer a single E-edge cross from
 *  cell (edgeX, edgeY) of `layout` into pane 'p2' at (entryX, entryY). The edge
 *  cell is forced to floor by picking a real floor edge cell on the layout. */
function ctxWithExit(
  exitCell: { x: number; y: number },
  entry: { paneId: string; x: number; y: number },
): { ctx: BehaviorContext; exit: SeamExit } {
  const exit: SeamExit = { edge: exitCell, sharedEdge: 'E', entry };
  const seamExits = new Map<string, SeamExit>([[`${exitCell.x},${exitCell.y}`, exit]]);
  const ctx: BehaviorContext = {
    layout,
    prngs: buildPrngs(),
    scatterAnchors: new Map(),
    wallClockHour: () => 12,
    seamExits,
  };
  return { ctx, exit };
}

// Find a real floor cell to use as the "agent sitting on a seam edge" cell.
function firstFloorCell(): { x: number; y: number } {
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (layout.tiles[y][x] === T_FLOOR) return { x, y };
    }
  }
  throw new Error('no floor cell');
}

{
  const edgeCell = firstFloorCell();
  const entry = { paneId: 'p2', x: 0, y: 7 };
  const { ctx } = ctxWithExit(edgeCell, entry);
  const def = COHORT.find((d) => d.id === 'loki')!;

  // B1 — an agent on the seam-exit cell, forced to wander, eventually emits a
  // pendingCross. Drive ticks until it crosses (the PRNG decides which step,
  // but the cross is one fixed candidate among the floor neighbours, so it
  // fires within a bounded number of re-picks).
  let emitted = false;
  for (let i = 0; i < 200; i++) {
    const rt = initialRuntime({ id: 'loki', x: edgeCell.x, y: edgeCell.y });
    rt.actionEndsAt = 0;
    // Force a wander pick by clearing schedule influence (mid-day, no anchors).
    tickBehavior(def, rt, { ...ctx, prngs: new Map([['loki', mulberry32((SEED ^ fnv('loki') ^ i) >>> 0)]]) }, 1000 + i);
    if (rt.pendingCross) {
      check('B1 cross-intent targets the right neighbour', rt.pendingCross.paneId === 'p2', rt.pendingCross.paneId);
      check('B1 cross-intent carries the bridged entry cell', rt.pendingCross.x === entry.x && rt.pendingCross.y === entry.y, JSON.stringify(rt.pendingCross));
      check('B1 agent did NOT mutate its own x/y on the cross-emit tick', rt.x === edgeCell.x && rt.y === edgeCell.y);
      emitted = true;
      break;
    }
  }
  check('B1 an agent on an open seam edge CAN emit a cross-intent (within 200 seeds)', emitted);
}

// B2 — no seam exits ⇒ NEVER a cross-intent (clamps exactly as today).
{
  const edgeCell = firstFloorCell();
  const def = COHORT.find((d) => d.id === 'loki')!;
  const ctxNoSeam: BehaviorContext = {
    layout,
    prngs: buildPrngs(),
    scatterAnchors: new Map(),
    wallClockHour: () => 12,
    // seamExits omitted
  };
  let anyCross = false;
  let allOnFloor = true;
  const rt = initialRuntime({ id: 'loki', x: edgeCell.x, y: edgeCell.y });
  for (let i = 0; i < 300; i++) {
    rt.actionEndsAt = 0;
    tickBehavior(def, rt, ctxNoSeam, 1000 + i * 10);
    if (rt.pendingCross) anyCross = true;
    if (layout.tiles[rt.y]?.[rt.x] !== T_FLOOR) allOnFloor = false;
  }
  check('B2 no-seam ctx ⇒ agent NEVER emits a cross-intent (clamp preserved)', !anyCross);
  check('B2 no-seam walk stays on floor (byte-identical wander)', allOnFloor);
}

// ===========================================================================
// MIGRATION — consume pendingCross A→B exactly once.
// ===========================================================================
{
  const A = createRuntimeScope();
  const B = createRuntimeScope();
  const rt = initialRuntime({ id: 'loki', x: 19, y: 7 });
  rt.activePlan = { steps: [{ kind: 'place_mark', note: 'inflight' }] } as never;
  rt.activePlanStepIndex = 0;
  rt.pendingCross = { paneId: 'p2', x: 0, y: 7 };
  setRuntimeIn(A, rt);

  // Replicate the cohort's intent-consume: resolve neighbour scope → migrate.
  const getNeighbourScope = (pid: string): RuntimeScope | undefined => (pid === 'p2' ? B : undefined);
  const target = rt.pendingCross!;
  const neighbour = getNeighbourScope(target.paneId)!;
  const res = migrateRuntime(A, neighbour, rt.id, target.x, target.y);

  check('M1 migrate returns ok', res === 'ok', `got ${res}`);
  check('M1 gone from A (no leak)', getRuntimeIn(A, 'loki') === undefined);
  const moved = getRuntimeIn(B, 'loki');
  check('M1 present exactly once in B', listRuntimesIn(B).filter((r) => r.id === 'loki').length === 1);
  check('M1 SAME object moved (not a copy)', moved === rt);
  check('M1 repositioned at the bridged entry (0,7)', moved!.x === 0 && moved!.y === 7);
  check('M1 in-flight activePlan preserved across the seam', moved!.activePlan !== null && moved!.activePlanStepIndex === 0);
  check('M1 pendingCross cleared on arrival (no carried intent)', moved!.pendingCross === null);
  check('M1 justArrivedAt stamped at the entry cell (anti-ping-pong)', moved!.justArrivedAt?.x === 0 && moved!.justArrivedAt?.y === 7);
}

// ===========================================================================
// NO PING-PONG — a just-arrived agent does not immediately re-cross.
// ===========================================================================
{
  const def = COHORT.find((d) => d.id === 'loki')!;
  // The agent arrived at its CURRENT cell; that very cell is also a seam exit
  // back the way it came. justArrivedAt must suppress emitting a fresh cross.
  const arrivalCell = firstFloorCell();
  const entryBack = { paneId: 'root', x: 19, y: arrivalCell.y };
  const { ctx } = ctxWithExit(arrivalCell, entryBack);

  // D1 — justArrivedAt === the arrival cell ⇒ no cross-intent on the next tick,
  // across many seeds (the suppression is unconditional while sitting there).
  let suppressed = true;
  for (let i = 0; i < 200; i++) {
    const rt = initialRuntime({ id: 'loki', x: arrivalCell.x, y: arrivalCell.y });
    rt.justArrivedAt = { x: arrivalCell.x, y: arrivalCell.y };
    rt.actionEndsAt = 0;
    tickBehavior(def, rt, { ...ctx, prngs: new Map([['loki', mulberry32((SEED ^ fnv('loki') ^ i) >>> 0)]]) }, 2000 + i);
    if (rt.pendingCross) { suppressed = false; break; }
  }
  check('D1 just-arrived agent does NOT re-emit a cross-intent on its next tick', suppressed);

  // D2 — once the agent steps OFF the arrival cell, justArrivedAt clears so it
  // can cross again later. Put justArrivedAt at a DIFFERENT cell than current.
  const rt = initialRuntime({ id: 'loki', x: arrivalCell.x, y: arrivalCell.y });
  rt.justArrivedAt = { x: arrivalCell.x + 1, y: arrivalCell.y }; // already moved off
  rt.actionEndsAt = 0;
  tickBehavior(def, rt, { ...ctx, prngs: new Map([['loki', mulberry32(SEED >>> 0)]]) }, 3000);
  check('D2 stepping off the arrival cell clears justArrivedAt (cross re-armed)', rt.justArrivedAt === null);
}

// ===========================================================================
// C — ROSTER-AWARE REMOUNT (must-fix): a partial root remount while a sibling
// pane holds a migrated agent must NOT re-spawn that agent into root.
// ===========================================================================

/** Replicate the cohort's roster-aware root gate: clear the (fresh) scope, then
 *  seed each absent def — SKIPPING any id already live in another registered
 *  pane (isAgentLiveElsewhere). Mirrors cohort.ts exactly. */
function rootGateSpawn(rootScope: RuntimeScope): void {
  rootScope.runtimes.clear();
  if (rootScope.runtimes.size !== 0) return;
  for (const def of COHORT) {
    if (isAgentLiveElsewhere(def.id, 'root')) continue;
    const spawn = resolveSpawn(def.spawn, layout, SEED);
    setRuntimeIn(rootScope, initialRuntime({ id: def.id, x: spawn.x, y: spawn.y }));
  }
}

{
  _resetPaneRegistry();
  // Initial world mount: root registers FIRST (cell.ts registers before
  // mountCohort), then the gate runs. Only root is registered → no agent is
  // live elsewhere → the full roster seeds. (C2 — exclude-self semantics.)
  const root1 = createRuntimeScope();
  const unregRoot1 = registerPane('root', root1, layout);
  check('C2 isAgentLiveElsewhere excludes the queried pane (root alone → false)', isAgentLiveElsewhere('loki', 'root') === false);
  rootGateSpawn(root1);
  check('C2 first mount still seeds the full roster (5)', listRuntimesIn(root1).length === COHORT.length, `got ${listRuntimesIn(root1).length}`);

  // Split: p2 mounts EMPTY + registers. loki walks root → p2 (migrate).
  const p2 = createRuntimeScope();
  const unregP2 = registerPane('p2', p2, layout);
  migrateRuntime(root1, p2, 'loki', 0, 5);
  check('C1 setup: loki now lives ONLY in p2 after the walk', getRuntimeIn(root1, 'loki') === undefined && getRuntimeIn(p2, 'loki') !== undefined);
  check('C1 setup: isAgentLiveElsewhere sees loki in p2 (from root\'s view)', isAgentLiveElsewhere('loki', 'root') === true);

  // PARTIAL ROOT REMOUNT: root relevels (zoom out+back). cell.ts tears down the
  // old root (unregister) + mounts a NEW root with a fresh empty scope, which
  // RE-REGISTERS before the gate runs. p2 is untouched (still holds loki).
  unregRoot1();
  const root2 = createRuntimeScope();
  const unregRoot2 = registerPane('root', root2, layout);
  rootGateSpawn(root2);

  // THE BUG (pre-fix): the unconditional gate would re-create loki in root2.
  // THE FIX: loki is live in p2 → skipped → root2 seeds only the 4 absentees.
  const lokiInRoot = getRuntimeIn(root2, 'loki') !== undefined;
  const lokiInP2 = getRuntimeIn(p2, 'loki') !== undefined;
  const lokiTotal = (lokiInRoot ? 1 : 0) + (lokiInP2 ? 1 : 0);
  check('C1 root remount does NOT re-create loki (no dup runtime)', !lokiInRoot, `loki re-spawned in root: ${lokiInRoot}`);
  check('C1 loki still lives exactly once across panes (in p2)', lokiTotal === 1, `total loki = ${lokiTotal}`);
  check('C1 the other 4 agents DID re-seed into the remounted root', listRuntimesIn(root2).length === COHORT.length - 1, `got ${listRuntimesIn(root2).length}`);
  check('C1 archivist (an absentee) DID re-seed into root', getRuntimeIn(root2, 'archivist') !== undefined);

  unregRoot2();
  unregP2();
  _resetPaneRegistry();
}

// ===========================================================================
// F — FLOOR-GATED SEAM EXITS (must-fix): the live wiring's walkability oracle
// must refuse exits off / into a WALL so an agent is never stranded.
// ===========================================================================
{
  // The REAL layout walls its whole perimeter EXCEPT the carved seam openings
  // (layout.seamRows) on the side walls + the south door. Build a real same-level
  // seam graph and a real walkability oracle (T_FLOOR only) over the actual
  // layout tiles: only the opening rows are crossable.
  get().setArrangement('single');
  get().setArrangement('study');
  get().setPaneLevel('p2', 'cell');
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);

  // Both panes use the SAME real layout (same seed → same room).
  const realDims = new Map<string, PaneDims>([
    ['root', { width: layout.width, height: layout.height }],
    ['p2', { width: layout.width, height: layout.height }],
  ]);
  const realLayouts = new Map([['root', layout], ['p2', layout]]);
  const isWalkable: WalkableOracle = (pid, x, y) => {
    const lay = realLayouts.get(pid);
    if (!lay) return false;
    const row = lay.tiles[y];
    return !!row && row[x] === T_FLOOR;
  };

  // WITHOUT the gate: the geometric pass offers an exit for every edge row.
  const ungated = seamExitsForPane(seams, 'root', realDims);
  check('F1 ungated (geometry-only) offers exits on the full right column', ungated.size === layout.height, `got ${ungated.size}`);
  // Sanity: the geometric (ungated) exits sit on WALL cells EXCEPT the carved
  // seam-opening rows — those wall cells are exactly the stranding the gate must
  // prevent, and the opening rows are exactly what it must allow.
  const openRows = new Set(layout.seamRows);
  const ungatedFloor = [...ungated.keys()].filter((k) => {
    const [x, y] = k.split(',').map(Number);
    return layout.tiles[y]?.[x] === T_FLOOR;
  });
  check(
    'F1 ungated exits sit on WALL except the carved seam openings',
    ungatedFloor.length === layout.seamRows.length &&
      ungatedFloor.every((k) => openRows.has(Number(k.split(',')[1]))),
    `floor-edge=${ungatedFloor.length} seamRows=${layout.seamRows.length}`,
  );

  // WITH the gate: exactly the carved opening rows are crossable (floor on BOTH
  // the exit edge and the bridged entry — the walkable seam edge now lands).
  const gated = seamExitsForPane(seams, 'root', realDims, isWalkable);
  check(
    'F1 floor-gated E/W seam yields exactly the seam-opening exits',
    gated.size === layout.seamRows.length,
    `got ${gated.size}, want ${layout.seamRows.length}`,
  );
  check(
    'F1 each gated exit sits on a carved seam-opening row',
    [...gated.keys()].every((k) => openRows.has(Number(k.split(',')[1]))),
  );

  // F2 — entry-cell gate: even a FLOOR exit cell is refused if the bridged
  // ENTRY lands in a wall. Use a synthetic oracle: exit cell floor, entry wall.
  const entryWallOracle: WalkableOracle = (pid, x, y) => {
    if (pid === 'root') return true; // every root edge cell "floor"
    // neighbour: only NON-edge cells are floor → the bridged entry (x=0, the
    // left column) is wall, so every exit must be refused.
    return x !== 0;
  };
  const f2 = seamExitsForPane(seams, 'root', realDims, entryWallOracle);
  check('F2 exit refused when bridged ENTRY cell is a wall (no migrate-into-wall)', f2.size === 0, `got ${f2.size}`);

  // And the inverse control: both-floor oracle → exits DO appear (gate isn't a
  // blanket off-switch; it's a precise floor check).
  const allFloorOracle: WalkableOracle = () => true;
  const f2ctrl = seamExitsForPane(seams, 'root', realDims, allFloorOracle);
  check('F2 control: both-floor oracle restores the full exit column', f2ctrl.size === layout.height, `got ${f2ctrl.size}`);

  get().setArrangement('single');
}

// ===========================================================================
// R — SINGLE-PANE REDUCTION (the safety constraint, end-to-end).
// ===========================================================================
{
  const root = createRuntimeScope();
  spawnRoster(root, 'root');
  check('R1 single pane: roster present (5)', listRuntimesIn(root).length === COHORT.length);

  // No seams ⇒ openSeamsFor [] ⇒ base by reference ⇒ migrate never invoked.
  get().setArrangement('single');
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  check('R1 single pane openSeamsFor === []', buildSeamEdgesForPane(seams, 'root', dims).length === 0);

  let migrateCalls = 0;
  const def = COHORT.find((d) => d.id === 'loki')!;
  const loki = getRuntimeIn(root, 'loki')!;
  const ctxNoSeam: BehaviorContext = {
    layout,
    prngs: buildPrngs(),
    scatterAnchors: new Map(),
    wallClockHour: () => 12,
  };
  for (let i = 0; i < 300; i++) {
    loki.actionEndsAt = 0;
    tickBehavior(def, loki, ctxNoSeam, 1000 + i * 10);
    if (loki.pendingCross) {
      migrateCalls++; // would trigger a migrate — must never happen single-pane
      loki.pendingCross = null;
    }
  }
  check('R1 migrateRuntime NEVER invoked in single-pane (no pendingCross ever)', migrateCalls === 0, `got ${migrateCalls}`);
  check('R1 loki stayed on floor across 300 single-pane ticks', layout.tiles[loki.y]?.[loki.x] === T_FLOOR);
}

// ===========================================================================
// S — SEAM-SEEKING (Increment 2, Phase 7-D.2b): an agent DELIBERATELY walks to
// a seam and crosses, rather than waiting on a lucky random wander onto an exit.
// Driven on a synthetic all-floor room so the greedy approach provably reaches
// the edge (the real layout's walls are exercised by the F-section).
// ===========================================================================

/** A minimal all-floor room (spreads the real layout so every required field is
 *  present, overrides the grid). tickBehavior only reads width/height/tiles +
 *  windowAt/spawnAt, so an open grid makes the greedy approach deterministic. */
function openRoom(w: number, h: number): typeof layout {
  const tiles = Array.from({ length: h }, () => Array.from({ length: w }, () => T_FLOOR));
  return { ...layout, width: w, height: h, tiles, spawnAt: { x: 1, y: 1 }, windowAt: { x: 1, y: 1 } };
}

/** BehaviorContext over an open room with a given exits map. wallClockHour=3 so
 *  no daytime visit_window rule outscores the 0.6 seam-seek candidate; empty
 *  scatterAnchors so bias_idle rules stay dormant. */
function openCtx(room: typeof layout, exits: Map<string, SeamExit>): BehaviorContext {
  return {
    layout: room,
    prngs: buildPrngs(),
    scatterAnchors: new Map(),
    wallClockHour: () => 3,
    seamExits: exits,
  };
}

const loDef = COHORT.find((d) => d.id === 'loki')!;

// S1 — latch the nearest exit, walk to it, cross. Agent starts in the interior,
// one E-edge exit; the deterministic approach must arrive + emit pendingCross.
{
  const room = openRoom(10, 6);
  const exit: SeamExit = { edge: { x: 9, y: 3 }, sharedEdge: 'E', entry: { paneId: 'p2', x: 0, y: 3 } };
  const ctx = openCtx(room, new Map([[`9,3`, exit]]));
  const rt = initialRuntime({ id: 'loki', x: 1, y: 3 });

  // First tick: it should latch the (only) exit as its goal BEFORE moving.
  rt.actionEndsAt = 0;
  tickBehavior(loDef, rt, ctx, 1000);
  check('S1 agent latches the seam exit as a goal (seamGoal set)', rt.seamGoal?.edge.x === 9 && rt.seamGoal?.edge.y === 3, JSON.stringify(rt.seamGoal));
  check('S1 agent began walking toward the edge (x increased from 1)', rt.x > 1, `x=${rt.x}`);

  // Drive until it reaches the edge and emits the cross.
  let crossed = false;
  for (let i = 0; i < 60 && !crossed; i++) {
    rt.actionEndsAt = 0;
    tickBehavior(loDef, rt, ctx, 1100 + i * 10);
    if (rt.pendingCross) crossed = true;
  }
  check('S1 the agent deliberately reached the seam and emitted a cross', crossed);
  check('S1 cross targets the bridged entry in p2 (0,3)', rt.pendingCross?.paneId === 'p2' && rt.pendingCross?.x === 0 && rt.pendingCross?.y === 3, JSON.stringify(rt.pendingCross));
  check('S1 seamGoal cleared once the cross is emitted', rt.seamGoal === null);
  check('S1 a staggered cooldown was armed on the cross', rt.seamCooldownUntil > 0, `${rt.seamCooldownUntil}`);
}

// S2 — nearest selection: with two exits, the Chebyshev-closest is latched.
{
  const room = openRoom(10, 6);
  const near: SeamExit = { edge: { x: 9, y: 1 }, sharedEdge: 'E', entry: { paneId: 'p2', x: 0, y: 1 } };
  const far: SeamExit = { edge: { x: 9, y: 5 }, sharedEdge: 'E', entry: { paneId: 'p2', x: 0, y: 5 } };
  const ctx = openCtx(room, new Map([[`9,1`, near], [`9,5`, far]]));
  const rt = initialRuntime({ id: 'loki', x: 8, y: 2 }); // adjacent column, closest to (9,1)
  rt.actionEndsAt = 0;
  tickBehavior(loDef, rt, ctx, 1000);
  check('S2 the NEARER of two exits is latched (9,1 over 9,5)', rt.seamGoal?.edge.y === 1, JSON.stringify(rt.seamGoal));
}

// S3 — cooldown gates re-seeking: within the cooldown window no goal latches;
// past it, seeking resumes. (Anti-oscillation across the just-crossed seam.)
{
  const room = openRoom(10, 6);
  const exit: SeamExit = { edge: { x: 9, y: 3 }, sharedEdge: 'E', entry: { paneId: 'p2', x: 0, y: 3 } };
  const ctx = openCtx(room, new Map([[`9,3`, exit]]));

  const rt = initialRuntime({ id: 'loki', x: 1, y: 3 });
  rt.seamCooldownUntil = 100_000; // freshly crossed → settling
  rt.actionEndsAt = 0;
  tickBehavior(loDef, rt, ctx, 5_000); // now < cooldown
  check('S3 no new goal is latched during the cooldown window', rt.seamGoal === null, JSON.stringify(rt.seamGoal));

  rt.actionEndsAt = 0;
  tickBehavior(loDef, rt, ctx, 200_000); // now > cooldown
  check('S3 seeking resumes once the cooldown elapses', rt.seamGoal?.edge.x === 9 && rt.seamGoal?.edge.y === 3, JSON.stringify(rt.seamGoal));
}

// S4 — single-pane reduction: no seam exits ⇒ seamGoal is never set (and a
// stray goal is cleared), so the byte-identical single-pane walk is preserved.
{
  const room = openRoom(10, 6);
  const ctxNoSeam: BehaviorContext = { layout: room, prngs: buildPrngs(), scatterAnchors: new Map(), wallClockHour: () => 3 };
  const rt = initialRuntime({ id: 'loki', x: 1, y: 3 });
  rt.seamGoal = { edge: { x: 9, y: 3 }, entry: { paneId: 'p2', x: 0, y: 3 } }; // stray
  rt.actionEndsAt = 0;
  tickBehavior(loDef, rt, ctxNoSeam, 1000);
  check('S4 no-seam ctx clears any seamGoal (never seeks)', rt.seamGoal === null);
  check('S4 no cross ever emitted without seam exits', rt.pendingCross === null);
}

// S5 — a stale goal (exit no longer present) is dropped, then re-latched to a
// current exit the same tick (so a re-split doesn't leave the agent chasing a
// vanished cell).
{
  const room = openRoom(10, 6);
  const exit: SeamExit = { edge: { x: 9, y: 3 }, sharedEdge: 'E', entry: { paneId: 'p2', x: 0, y: 3 } };
  const ctx = openCtx(room, new Map([[`9,3`, exit]]));
  const rt = initialRuntime({ id: 'loki', x: 1, y: 3 });
  rt.seamGoal = { edge: { x: 9, y: 99 }, entry: { paneId: 'gone', x: 0, y: 0 } }; // not in exits
  rt.actionEndsAt = 0;
  tickBehavior(loDef, rt, ctx, 1000);
  check('S5 a stale seamGoal is dropped + re-latched to a live exit', rt.seamGoal?.edge.x === 9 && rt.seamGoal?.edge.y === 3, JSON.stringify(rt.seamGoal));
}

get().setArrangement('single');
report();
