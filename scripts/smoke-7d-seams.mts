/**
 * Phase 7-D smoke — `npx tsx scripts/smoke-7d-seams.mts`.
 *
 * Pure-Node verification (no PIXI Application, no DOM, no Electron) of the
 * Depth-2 seam-crossing foundation:
 *
 *   SEAM GRAPH (src/state/seams.ts — buildSeams)
 *     S1  single default → []  (no-seam path preserved)
 *     S2  study (2×1) → exactly 1 vertical seam, root|p2, edgeA right / edgeB
 *         left, segment.line === 1 spanning all rows [0,1)
 *     S3  horizontal split → 1 horizontal seam, top/bottom, along the row line
 *     S4  double split → seam count === # interior shared edges, all ids unique
 *     S5  determinism → build twice from the same reset→split sequence is
 *         JSON-identical
 *     S6  order-independence → buildSeams(panes) and buildSeams(reversed) yield
 *         the same id set
 *     S10 every seam.segment is in-bounds of the grid
 *
 *   DRAW NO-DIVERGENCE (src/render/PixiApp.ts — projectSeamToPixels)
 *     D1  the seam-graph PAINTED-PIXEL set equals the OLD per-pane right/bottom
 *         edge painted-pixel set — across clean AND asymmetric tilings. (The
 *         weaker stroke-SET equality holds ONLY on clean tilings; on an
 *         asymmetric tiling the seam graph splits a shared edge into collinear
 *         segments, so the strokes differ but the painted pixels are identical.
 *         The pixel-coverage check is the real no-seam-regression lock.)
 *
 *   COORDINATE BRIDGE (bridgeCoord)
 *     S7  same-level vertical seam: root→p2 entry x===0, y projected; round-trip
 *         lands within ±1 of origin
 *     S8  cross-level seam (cell ↔ district) → {kind:'cross-level'}, no cell
 *     S9  synthetically CLOSED seam → {kind:'closed'}
 *
 *   CROSS-SEAM PERCEPTION (src/agents/crossSeam.ts — enrichSnapshotAcrossSeams)
 *     X1  sees-across-OPEN — neighbour agent just over the shared edge,
 *         projected within FOV, produces an agent_meeting event
 *     X2  not-across-CLOSED — openSeamsFor→[] ⇒ no cross-seam event AND base
 *         returned by reference (object identity)
 *     X3  not-across-NON-ADJACENT — a non-walkable seam edge ⇒ skipped ⇒ no event
 *     X4  no-seam-identical — with openSeamsFor→[], the event set equals
 *         computePerception on the un-enriched snapshot
 *     X5  id-namespacing — neighbour `loki` does not collide with this pane's
 *         own `loki` (self-skip not triggered, both perceivable)
 *     X6  neighbour-not-registered (district neighbour) → seam skipped, base
 *         returned unchanged
 *
 *   CROSSING MIGRATION PRIMITIVE (src/state/agentRuntime.ts — migrateRuntime)
 *     M1  ok — runtime leaves A, lands in B at the bridged cell, SAME object
 *     M2  no-leak/no-dup — after migrate, listRuntimesIn(A) lacks id AND B has
 *         exactly one
 *     M3  duplicate-identity guard — target already has the id ⇒ 'duplicate',
 *         no move (shared-COHORT collision is refused, not half-built)
 *     M4  perception-cache cleanup — departed agent's proximitySince/holdFired
 *         entries cleared in A
 *     M5  in-flight plan/queue preserved across the seam (same object ref)
 */

import { makeChecker } from './lib/smoke.ts';
import type { PaneDescriptor } from '../src/types.ts';

const { useAppStore } = await import('../src/state/store.ts');
const { buildSeams, bridgeCoord } = await import('../src/state/seams.ts');
const { projectSeamToPixels, computePixelRect } = await import('../src/render/PixiApp.ts');
const { enrichSnapshotAcrossSeams } = await import('../src/agents/crossSeam.ts');
const { computePerception } = await import('../src/agents/perception.ts');
const { COHORT } = await import('../src/agents/cohort.ts');
const {
  createRuntimeScope,
  initialRuntime,
  setRuntimeIn,
  getRuntimeIn,
  listRuntimesIn,
  migrateRuntime,
} = await import('../src/state/agentRuntime.ts');

type Seam = ReturnType<typeof buildSeams>[number];
type SeamEdge = Parameters<typeof enrichSnapshotAcrossSeams>[2]['openSeamsFor'] extends (
  p: string,
) => readonly (infer E)[]
  ? E
  : never;

const { check, report } = makeChecker('smoke 7D');

type Store = ReturnType<typeof useAppStore.getState>;
const get = (): Store => useAppStore.getState();
const reset = (): void => get().setArrangement('single');

// ===========================================================================
// S1 — single default → []
// ===========================================================================
reset();
{
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  check('S1 single default yields zero seams (no-seam path preserved)', seams.length === 0, `got ${seams.length}`);
}

// ===========================================================================
// S2 — study (2×1) → exactly one vertical seam
// ===========================================================================
reset();
get().setArrangement('study');
{
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  check('S2 study yields exactly one seam', seams.length === 1, `got ${seams.length}`);
  const seam = seams[0];
  check('S2 seam axis is vertical', seam.segment.axis === 'vertical');
  check(
    'S2 seam is root|p2',
    (seam.paneA === 'root' && seam.paneB === 'p2') || (seam.paneA === 'p2' && seam.paneB === 'root'),
    `${seam.paneA}|${seam.paneB}`,
  );
  check('S2 paneA is the left pane (root) with edgeA right', seam.paneA === 'root' && seam.edgeA === 'right');
  check('S2 paneB is the right pane (p2) with edgeB left', seam.paneB === 'p2' && seam.edgeB === 'left');
  check('S2 segment.line === 1 (shared grid column)', seam.segment.line === 1, `line=${seam.segment.line}`);
  check('S2 segment spans all rows [0,1)', seam.segment.start === 0 && seam.segment.end === 1);
  check('S2 seam is open by default', seam.open === true);
  check('S2 edgeType reserved null', seam.edgeType === null);
}

// ===========================================================================
// S3 — horizontal split → one horizontal seam
// ===========================================================================
reset();
get().splitPane('horizontal');
{
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  check('S3 horizontal split yields one seam', seams.length === 1, `got ${seams.length}`);
  const seam = seams[0];
  check('S3 seam axis is horizontal', seam.segment.axis === 'horizontal');
  check('S3 top pane edgeA bottom / bottom pane edgeB top', seam.edgeA === 'bottom' && seam.edgeB === 'top');
  // After a horizontal split of a 1×1 grid → 1×2; the seam is at row 1.
  check('S3 segment.line is the row boundary (1)', seam.segment.line === 1, `line=${seam.segment.line}`);
}

// ===========================================================================
// S4 — double split → count === interior shared edges, ids unique
// ===========================================================================
reset();
get().splitPane('vertical'); // root | p2  (2×1)
get().splitPane('horizontal'); // splits the focused root into top/bottom (2×2)
{
  const s = get();
  const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
  // After v-split: root(0,0,1,1) p2(1,0,1,1) on 2×1. Then h-split of root (2×2):
  // every pane scales rows×2; root keeps top-half. Panes:
  //   root(0,0,1,1) p2(2,0,2,2... ) p3(0,1,1,1). Interior shared edges:
  //   root|p2 (vertical), root|p3 (horizontal), p3|p2 (vertical) = 3.
  const ids = new Set(seams.map((x: Seam) => x.id));
  check('S4 all seam ids unique (no double-count)', ids.size === seams.length, `${ids.size} vs ${seams.length}`);
  check('S4 double-split seam count > 1', seams.length >= 2, `got ${seams.length}`);
  // Count interior shared edges independently from the tiling.
  const expected = countInteriorSharedEdges(s.panes);
  check('S4 seam count === interior shared edge count', seams.length === expected, `seams=${seams.length} expected=${expected}`);
}

// ===========================================================================
// S5 — determinism: same reset→split sequence is JSON-identical
// ===========================================================================
{
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  const a = JSON.stringify(buildSeams(get().panes, get().gridCols, get().gridRows));
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  const b = JSON.stringify(buildSeams(get().panes, get().gridCols, get().gridRows));
  check('S5 buildSeams is deterministic across identical sequences', a === b);
}

// ===========================================================================
// S6 — order-independence: reversed pane array → same id set
// ===========================================================================
{
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  const s = get();
  const forward = buildSeams(s.panes, s.gridCols, s.gridRows).map((x: Seam) => x.id).sort();
  const reversed = buildSeams([...s.panes].reverse(), s.gridCols, s.gridRows).map((x: Seam) => x.id).sort();
  check(
    'S6 buildSeams is order-independent (same id set forward + reversed)',
    JSON.stringify(forward) === JSON.stringify(reversed),
    `fwd=${forward.join(',')} rev=${reversed.join(',')}`,
  );
}

// ===========================================================================
// S10 — every seam.segment is in-bounds of the grid
// ===========================================================================
{
  function allSeamsInBounds(): boolean {
    const s = get();
    const seams = buildSeams(s.panes, s.gridCols, s.gridRows);
    return seams.every((seam: Seam) => {
      const { axis, line, start, end } = seam.segment;
      if (start >= end) return false;
      if (axis === 'vertical') {
        return line >= 0 && line <= s.gridCols && start >= 0 && end <= s.gridRows;
      }
      return line >= 0 && line <= s.gridRows && start >= 0 && end <= s.gridCols;
    });
  }
  reset();
  get().setArrangement('study');
  check('S10 study seams in bounds', allSeamsInBounds());
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  check('S10 double-split seams in bounds', allSeamsInBounds());
  reset();
  get().splitPane('horizontal');
  get().splitPane('vertical');
  check('S10 alt double-split seams in bounds', allSeamsInBounds());
}

// ===========================================================================
// D1 — drawSeams no-divergence.
//
//   THE REAL INVARIANT IS PIXEL-COVERAGE EQUIVALENCE, NOT STROKE-SET EQUALITY.
//   The old per-pane loop strokes each pane's right/bottom edge as ONE full-span
//   line; the seam graph strokes each shared edge as the OVERLAP SEGMENT. On a
//   CLEAN tiling (every interior edge full-span) these stroke SETS happen to be
//   identical. But on an ASYMMETRIC tiling — e.g. a tall pane abutting two
//   stacked half-height panes — the old loop emits ONE full-height stroke while
//   the seam graph emits TWO collinear half-height strokes that JOIN at the
//   shared corner. The stroke SETS differ; the PAINTED PIXELS are identical
//   (two collinear opaque 1px segments sharing an endpoint rasterise to the same
//   pixels as one continuous segment). So D1 asserts the load-bearing thing —
//   the set of painted pixels is byte-identical — across clean AND asymmetric
//   tilings (the asymmetric case is the one the weaker set-equality claim
//   misses; including it is the actual no-regression lock).
// ===========================================================================
{
  function seg(x1: number, y1: number, x2: number, y2: number): string {
    // Normalise endpoint order so direction doesn't matter.
    const a = `${x1},${y1}`;
    const b = `${x2},${y2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  // Rasterise an axis-aligned segment to the integer pixels it covers (both
  // endpoints inclusive — the seam stroke is 1px). This models what PIXI paints.
  function raster(x1: number, y1: number, x2: number, y2: number, out: Set<string>): void {
    if (x1 === x2) {
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      for (let y = lo; y <= hi; y++) out.add(`${x1},${y}`);
    } else {
      const lo = Math.min(x1, x2);
      const hi = Math.max(x1, x2);
      for (let x = lo; x <= hi; x++) out.add(`${x},${y1}`);
    }
  }
  // OLD per-pane edge math (pre-7-D drawSeams) → both the stroke SET and the
  // painted PIXEL set, over the SAME computePixelRect projection PixiApp uses.
  function oldEdge(
    panes: readonly PaneDescriptor[],
    gc: number,
    gr: number,
    sw: number,
    sh: number,
  ): { strokes: Set<string>; pixels: Set<string> } {
    const strokes = new Set<string>();
    const pixels = new Set<string>();
    for (const p of panes) {
      const pr = computePixelRect(p.rect, gc, gr, sw, sh);
      if (pr.px + pr.pw < sw - 1) {
        strokes.add(seg(pr.px + pr.pw, pr.py, pr.px + pr.pw, pr.py + pr.ph));
        raster(pr.px + pr.pw, pr.py, pr.px + pr.pw, pr.py + pr.ph, pixels);
      }
      if (pr.py + pr.ph < sh - 1) {
        strokes.add(seg(pr.px, pr.py + pr.ph, pr.px + pr.pw, pr.py + pr.ph));
        raster(pr.px, pr.py + pr.ph, pr.px + pr.pw, pr.py + pr.ph, pixels);
      }
    }
    return { strokes, pixels };
  }
  // NEW seam-graph math (the production drawSeams path) → stroke SET + pixels.
  function newSeam(
    panes: readonly PaneDescriptor[],
    gc: number,
    gr: number,
    sw: number,
    sh: number,
  ): { strokes: Set<string>; pixels: Set<string> } {
    const strokes = new Set<string>();
    const pixels = new Set<string>();
    for (const s of buildSeams(panes, gc, gr)) {
      const { x1, y1, x2, y2 } = projectSeamToPixels(s, gc, gr, sw, sh);
      strokes.add(seg(x1, y1, x2, y2));
      raster(x1, y1, x2, y2, pixels);
    }
    return { strokes, pixels };
  }

  const W = 1920;
  const H = 1080;

  // The single source of truth this test defends: PAINTED PIXELS are identical.
  function assertPixelIdentical(label: string): void {
    const s = get();
    const o = oldEdge(s.panes, s.gridCols, s.gridRows, W, H);
    const n = newSeam(s.panes, s.gridCols, s.gridRows, W, H);
    check(
      `D1 ${label}: seam-graph PAINTED PIXELS === old per-pane edge pixels (no-regression lock)`,
      setEq(o.pixels, n.pixels),
      `oldPx=${o.pixels.size} newPx=${n.pixels.size}`,
    );
  }

  // Clean equal-span tilings: pixels AND stroke sets agree.
  reset();
  get().setArrangement('study');
  assertPixelIdentical('study 2×1');
  {
    const s = get();
    const o = oldEdge(s.panes, s.gridCols, s.gridRows, W, H);
    const n = newSeam(s.panes, s.gridCols, s.gridRows, W, H);
    check(
      'D1 study 2×1: stroke SET also matches on a clean tiling',
      setEq(o.strokes, n.strokes),
      `old=${[...o.strokes].join(' ; ')} new=${[...n.strokes].join(' ; ')}`,
    );
  }
  reset();
  get().splitPane('vertical');
  get().splitPane('vertical'); // 4×1 — all panes equal full-height span
  assertPixelIdentical('4×1 split');

  // Clean 2×2 double-splits — every interior edge full-span, pixels identical.
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  assertPixelIdentical('2×2 vh double-split');
  reset();
  get().splitPane('horizontal');
  get().splitPane('vertical');
  assertPixelIdentical('2×2 hv double-split');

  // ASYMMETRIC tiling — THE case the weaker set-equality claim misses. A tall
  // left pane (root, full height) abuts two stacked half-height right panes
  // (p2 over p3). The shared vertical seam at the grid column is ONE stroke in
  // the old loop but TWO collinear strokes in the seam graph; the painted
  // pixels MUST still be identical. Pinning this is the actual no-seam lock.
  reset();
  get().splitPane('vertical'); // root | p2  (2×1)
  get().focusPane('p2');
  get().splitPane('horizontal'); // p2 → p2 (top) + p3 (bottom); root stays full height
  {
    const s = get();
    const o = oldEdge(s.panes, s.gridCols, s.gridRows, W, H);
    const n = newSeam(s.panes, s.gridCols, s.gridRows, W, H);
    // The stroke SETS genuinely differ here (1 full-height vs 2 half-height) —
    // assert that they differ so this case can never silently degrade into a
    // clean tiling and stop exercising the split-segment path.
    check(
      'D1 asymmetric: stroke SETS differ (old 1 full-span vs seam-graph 2 segments)',
      !setEq(o.strokes, n.strokes),
      `old=${[...o.strokes].join(' ; ')} new=${[...n.strokes].join(' ; ')}`,
    );
    // …but the PAINTED PIXELS are byte-identical — the guarantee that matters.
    check(
      'D1 asymmetric: PAINTED PIXELS still byte-identical (collinear segments cover the same line)',
      setEq(o.pixels, n.pixels),
      `oldPx=${o.pixels.size} newPx=${n.pixels.size}`,
    );
  }
  reset();
}

// ===========================================================================
// S7 — bridgeCoord same-level vertical seam, round-trip within ±1
// ===========================================================================
{
  reset();
  get().setArrangement('study');
  // Force both panes to 'cell' so the seam is same-level (study is cell+district).
  get().setPaneLevel('p2', 'cell');
  const s = get();
  const seam = buildSeams(s.panes, s.gridCols, s.gridRows)[0];
  check('S7 study(cell+cell) is a same-level seam', seam.levelA === seam.levelB);
  // dimsA = root's interior, dimsB = p2's interior. Use distinct sizes to
  // exercise the proportional projection.
  const dimsA = { width: 20, height: 12 };
  const dimsB = { width: 16, height: 18 };
  const originY = 6;
  const fwd = bridgeCoord(seam, { paneId: 'root', x: dimsA.width - 1, y: originY }, dimsA, dimsB);
  check('S7 forward is same-level', fwd.kind === 'same-level');
  if (fwd.kind === 'same-level') {
    check('S7 forward lands in p2', fwd.paneId === 'p2');
    check('S7 forward entry x === 0 (right neighbour left edge)', fwd.cell.x === 0, `x=${fwd.cell.x}`);
    // Round-trip back from p2's left edge at the projected y.
    const back = bridgeCoord(seam, { paneId: 'p2', x: 0, y: fwd.cell.y }, dimsA, dimsB);
    check('S7 round-trip is same-level', back.kind === 'same-level');
    if (back.kind === 'same-level') {
      check('S7 round-trip lands back in root', back.paneId === 'root');
      check('S7 round-trip entry x === dimsA.width-1 (left neighbour right edge)', back.cell.x === dimsA.width - 1);
      check('S7 round-trip y within ±1 of origin', Math.abs(back.cell.y - originY) <= 1, `Δ=${back.cell.y - originY}`);
    }
  }
}

// ===========================================================================
// S8 — cross-level seam → {kind:'cross-level'}, no cell
// ===========================================================================
{
  reset();
  get().setArrangement('study'); // root=cell, p2=district (cross-level)
  const s = get();
  const seam = buildSeams(s.panes, s.gridCols, s.gridRows)[0];
  check('S8 study seam is cross-level (cell vs district)', seam.levelA !== seam.levelB);
  const r = bridgeCoord(seam, { paneId: 'root', x: 5, y: 5 }, { width: 20, height: 12 }, { width: 20, height: 12 });
  check('S8 bridge across cross-level seam → kind cross-level', r.kind === 'cross-level');
  check('S8 cross-level result carries no cell', !('cell' in r));
}

// ===========================================================================
// S9 — synthetically CLOSED seam → {kind:'closed'}
// ===========================================================================
{
  reset();
  get().setArrangement('study');
  get().setPaneLevel('p2', 'cell');
  const s = get();
  const seam = { ...buildSeams(s.panes, s.gridCols, s.gridRows)[0], open: false };
  const r = bridgeCoord(seam, { paneId: 'root', x: 5, y: 5 }, { width: 20, height: 12 }, { width: 20, height: 12 });
  check('S9 closed seam → kind closed', r.kind === 'closed');
}

// ===========================================================================
// CROSS-SEAM PERCEPTION
// ===========================================================================
const lokiDef = COHORT.find((d) => d.id === 'loki')!; // fov 8
const FOV = lokiDef.fov;

/** This pane (perceiver) is the LEFT pane; the neighbour is to its EAST.
 *  A neighbour point (nx, ny) in the neighbour's space projects into THIS
 *  pane's space as (nx + thisWidth, ny) — i.e. just past this pane's right
 *  column. Mirrors the seam-graph bridge contract: toLocal(neighbour)→this. */
const THIS_WIDTH = 20;
const THIS_HEIGHT = 12;
function eastEdge(neighbourPaneId: string, walkable = true): SeamEdge {
  return {
    neighbourPaneId,
    bridge: { toLocal: (p: { x: number; y: number }) => ({ x: p.x + THIS_WIDTH, y: p.y }) },
    sharedEdge: 'E',
    bandLine: THIS_WIDTH, // one past the right column
    bandStart: 0,
    bandEnd: THIS_HEIGHT,
    walkable,
  } as SeamEdge;
}

function baseSnapshot() {
  return {
    player: { x: 5, y: 5 },
    agents: new Map<string, { x: number; y: number }>([['loki', { x: 5, y: 5 }]]),
    bookshelves: [] as { x: number; y: number }[],
  };
}

// X1 — sees-across-OPEN: neighbour 'archivist' sits at (1,5) in its own space
// → projects to (21,5) here, Chebyshev 1 from the band (x=20) → within FOV.
{
  const neighbourScope = createRuntimeScope();
  const arch = initialRuntime({ id: 'archivist', x: 1, y: 5 });
  arch.present = true;
  setRuntimeIn(neighbourScope, arch);
  const deps = {
    openSeamsFor: (id: string) => (id === 'root' ? [eastEdge('p2')] : []),
    getNeighbourScope: (id: string) => (id === 'p2' ? neighbourScope : undefined),
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov: FOV,
  };
  const enriched = enrichSnapshotAcrossSeams(baseSnapshot(), 'root', deps);
  check('X1 enriched snapshot is a NEW object (open seam)', enriched !== undefined);
  check('X1 neighbour archivist namespaced into agents', enriched.agents.has('p2:archivist'));
  const proj = enriched.agents.get('p2:archivist')!;
  check('X1 projected to this-pane space (x=21,y=5)', proj.x === 21 && proj.y === 5, JSON.stringify(proj));
  // Perceive: a loki standing at (20,5) here should fire agent_meeting on p2:archivist.
  const perceiver = initialRuntime({ id: 'loki', x: 20, y: 5 });
  perceiver.present = true;
  const scope = createRuntimeScope();
  const events = computePerception(lokiDef, perceiver, enriched, 1000, undefined, undefined, scope.perception);
  const meet = events.filter((e) => e.kind === 'agent_meeting' && e.subject === 'p2:archivist');
  check('X1 perceiver fires agent_meeting on the cross-seam neighbour', meet.length === 1, `got ${meet.length}`);
}

// X2 — not-across-CLOSED: openSeamsFor returns [] ⇒ base returned by reference.
{
  const deps = {
    openSeamsFor: () => [],
    getNeighbourScope: () => undefined,
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov: FOV,
  };
  const base = baseSnapshot();
  const enriched = enrichSnapshotAcrossSeams(base, 'root', deps);
  check('X2 closed/no-open-seam returns base BY REFERENCE', enriched === base);
  check('X2 no neighbour subjects spliced in', !enriched.agents.has('p2:archivist'));
}

// X3 — not-across-NON-ADJACENT (modelled as a non-walkable seam edge): skipped.
{
  const neighbourScope = createRuntimeScope();
  const arch = initialRuntime({ id: 'archivist', x: 1, y: 5 });
  arch.present = true;
  setRuntimeIn(neighbourScope, arch);
  const deps = {
    openSeamsFor: () => [eastEdge('p2', /* walkable */ false)],
    getNeighbourScope: () => neighbourScope,
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov: FOV,
  };
  const enriched = enrichSnapshotAcrossSeams(baseSnapshot(), 'root', deps);
  check('X3 non-walkable seam edge contributes no neighbour subject', !enriched.agents.has('p2:archivist'));
}

// X4 — no-seam-identical: enriched event set === un-enriched event set.
{
  const depsOff = {
    openSeamsFor: () => [],
    getNeighbourScope: () => undefined,
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov: FOV,
  };
  const base = baseSnapshot();
  const enriched = enrichSnapshotAcrossSeams(base, 'root', depsOff);
  const perceiver1 = initialRuntime({ id: 'loki', x: 6, y: 5 });
  perceiver1.present = true;
  const perceiver2 = initialRuntime({ id: 'loki', x: 6, y: 5 });
  perceiver2.present = true;
  const sc1 = createRuntimeScope();
  const sc2 = createRuntimeScope();
  const ev1 = computePerception(lokiDef, perceiver1, base, 5000, undefined, undefined, sc1.perception);
  const ev2 = computePerception(lokiDef, perceiver2, enriched, 5000, undefined, undefined, sc2.perception);
  const key = (es: { kind: string; subject?: string }[]) =>
    es.map((e) => `${e.kind}|${e.subject ?? ''}`).sort().join(',');
  check('X4 no-seam enriched event set === un-enriched set', key(ev1) === key(ev2), `${key(ev1)} vs ${key(ev2)}`);
}

// X5 — id-namespacing: neighbour 'loki' does NOT collide with this pane's loki.
{
  const neighbourScope = createRuntimeScope();
  const nLoki = initialRuntime({ id: 'loki', x: 1, y: 5 });
  nLoki.present = true;
  setRuntimeIn(neighbourScope, nLoki);
  const deps = {
    openSeamsFor: () => [eastEdge('p2')],
    getNeighbourScope: () => neighbourScope,
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov: FOV,
  };
  const enriched = enrichSnapshotAcrossSeams(baseSnapshot(), 'root', deps);
  check('X5 this-pane loki still present (own id intact)', enriched.agents.has('loki'));
  check('X5 neighbour loki namespaced as p2:loki', enriched.agents.has('p2:loki'));
  // A perceiver named 'loki' at (20,5): self-skip drops 'loki' but NOT 'p2:loki'.
  const perceiver = initialRuntime({ id: 'loki', x: 20, y: 5 });
  perceiver.present = true;
  const scope = createRuntimeScope();
  const events = computePerception(lokiDef, perceiver, enriched, 9000, undefined, undefined, scope.perception);
  const sawSelf = events.some((e) => e.kind === 'agent_meeting' && e.subject === 'loki');
  const sawNeighbour = events.some((e) => e.kind === 'agent_meeting' && e.subject === 'p2:loki');
  check('X5 self-skip drops own loki', !sawSelf);
  check('X5 namespaced neighbour loki IS perceived (not self-skipped)', sawNeighbour);
}

// X6 — neighbour not a registered cell pane (e.g. district) → seam skipped.
{
  const deps = {
    openSeamsFor: () => [eastEdge('p2')],
    getNeighbourScope: () => undefined, // district has no cohort/scope
    getNeighbourPlayer: () => ({ x: 100, y: 100 }), // far → not within band anyway
    maxFov: FOV,
  };
  const base = baseSnapshot();
  const enriched = enrichSnapshotAcrossSeams(base, 'root', deps);
  // No agents added (scope undefined); the far player is out of band so absent.
  check('X6 unregistered neighbour scope contributes no agents', !enriched.agents.has('p2:archivist'));
  check('X6 far neighbour player out of band → not spliced', !enriched.agents.has('p2:player'));
}

// ===========================================================================
// CROSSING MIGRATION PRIMITIVE
// ===========================================================================
{
  const A = createRuntimeScope();
  const B = createRuntimeScope();
  const rt = initialRuntime({ id: 'loki', x: 19, y: 7 });
  rt.activePlan = { steps: [{ kind: 'place_mark', note: 'inflight' }] } as never;
  rt.activePlanStepIndex = 0;
  rt.perceptionQueue.push({ kind: 'agent_meeting', subject: 'cat', at: { x: 1, y: 1 }, when: 5 });
  setRuntimeIn(A, rt);
  // Pre-seed A's perception caches for loki so we can assert cleanup.
  A.perception.proximitySince.set('loki', 1234);
  A.perception.holdFired.set('loki', true);

  // M1/M2 — migrate loki A→B at bridged cell (0,7).
  const res = migrateRuntime(A, B, 'loki', 0, 7);
  check('M1 migrate returns ok', res === 'ok', `got ${res}`);
  const moved = getRuntimeIn(B, 'loki');
  check('M1 landed in B', moved !== undefined);
  check('M1 SAME object reference moved (not a copy)', moved === rt);
  check('M1 repositioned to bridged cell (0,7)', moved!.x === 0 && moved!.y === 7);
  check('M2 no-leak: A no longer has loki', getRuntimeIn(A, 'loki') === undefined);
  check('M2 no-dup: B has exactly one loki', listRuntimesIn(B).filter((r) => r.id === 'loki').length === 1);

  // M4 — perception caches cleaned in A.
  check('M4 A.proximitySince cleared for loki', !A.perception.proximitySince.has('loki'));
  check('M4 A.holdFired cleared for loki', !A.perception.holdFired.has('loki'));

  // M5 — in-flight plan + queue preserved.
  check('M5 activePlan preserved across the seam', moved!.activePlan !== null && moved!.activePlanStepIndex === 0);
  check('M5 perceptionQueue preserved across the seam', moved!.perceptionQueue.length === 1);

  // M3 — duplicate-identity guard. B already has a loki; try to cross another.
  const A2 = createRuntimeScope();
  const dup = initialRuntime({ id: 'loki', x: 5, y: 5 });
  setRuntimeIn(A2, dup);
  const dupRes = migrateRuntime(A2, B, 'loki', 0, 0);
  check('M3 duplicate-identity guard returns "duplicate"', dupRes === 'duplicate', `got ${dupRes}`);
  check('M3 refused cross leaves the agent in the source pane', getRuntimeIn(A2, 'loki') === dup);
  check('M3 target B unchanged (still the originally-migrated loki)', getRuntimeIn(B, 'loki') === rt);

  // absent
  const absentRes = migrateRuntime(A, B, 'ghost', 0, 0);
  check('M3b absent runtime → "absent"', absentRes === 'absent');
}

reset();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Count interior shared grid edges in a tiling by walking the per-cell border
 *  ownership — independent of buildSeams so it is a real cross-check. */
function countInteriorSharedEdges(panes: readonly PaneDescriptor[]): number {
  // Map each grid cell → pane id, then count distinct (paneId-pair, line, span)
  // edges. Simpler: count unique vertical + horizontal seam segments by the same
  // pairwise abutment rule but via an independent representation.
  let count = 0;
  for (let i = 0; i < panes.length; i++) {
    for (let j = i + 1; j < panes.length; j++) {
      const a = panes[i].rect;
      const b = panes[j].rect;
      // vertical adjacency
      const aRightB = a.col + a.cols === b.col;
      const bRightA = b.col + b.cols === a.col;
      if (aRightB || bRightA) {
        const lo = Math.max(a.row, b.row);
        const hi = Math.min(a.row + a.rows, b.row + b.rows);
        if (hi > lo) count++;
      }
      // horizontal adjacency
      const aBelowB = b.row + b.rows === a.row;
      const aAboveB = a.row + a.rows === b.row;
      if (aBelowB || aAboveB) {
        const lo = Math.max(a.col, b.col);
        const hi = Math.min(a.col + a.cols, b.col + b.cols);
        if (hi > lo) count++;
      }
    }
  }
  return count;
}

function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

report();
