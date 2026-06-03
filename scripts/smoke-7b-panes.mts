/**
 * Phase 7-B smoke — `npx tsx scripts/smoke-7b-panes.mts`.
 *
 * Locks the PURE store/reducer logic of the composable-panes model
 * (src/state/store.ts) + the pane-grid rect math. The PIXI router (Container
 * Map, clipping masks, seam glyphs) is visual + not unit-testable here; it is
 * covered by the Windows visual checklist (TODO-USER.md). This smoke's whole
 * job is to certify that the panes model with ONE pane reduces to the old
 * scale semantics — i.e. NO single-pane regression.
 *
 * The store imports cleanly in Node (api/* + types only, no PIXI/DOM) — the
 * 5d4-lore-visible smoke proves the precedent.
 *
 * Sections:
 *   A1  default = one 'root' pane, level 'cell', full-grid rect, focus 'root',
 *       grid 1×1, paneSeq 1.
 *   A2  scale === focused pane level in the default.
 *   A3  setScale(level) for every SCALE_ORDER level → scale === level AND the
 *       focused pane's level === level.
 *   A4  replay App.tsx's [ / ] algorithm for a full out-and-back cycle; assert
 *       scale walks SCALE_ORDER identically to a reference array (the zoom
 *       handler is behavior-preserving).
 *   A5  setPaneLevel on the focused pane re-syncs scale; on a non-focused pane
 *       does NOT change scale.
 *   A6  splitPane: +1 pane, rects tile the grid with no overlap + full
 *       coverage, ids unique + deterministic (split twice from reset → identical
 *       via paneSeq).
 *   A7  closePane: removes a pane; closing the focused one refocuses a survivor
 *       + re-syncs scale; closing the LAST pane is a no-op.
 *   A8  focusPane changes focus + re-syncs scale; focusPane(bad id) is a no-op.
 *   A9  cycleFocus wraps array order.
 *   A10 setArrangement('single') deep-equals default; 'study' = cell+district,
 *       focus cell, scale 'cell'.
 *   A11 every rect is in-bounds (col+cols<=gridCols, row+rows<=gridRows).
 *   A12 single→study clip-mask regression trigger: the `root` pane KEEPS its id
 *       across the transition AND flips full-grid → partial-grid. This is the
 *       model-layer fact the PixiApp mask-reconcile fix relies on (the rect-only
 *       reconcile branch fires because id+level are unchanged, so refitAll's
 *       reconcileMask MUST create the now-needed mask). The mask itself is PIXI
 *       + needs Windows (TODO-USER.md B1); this locks the condition.
 */

import { makeChecker } from './lib/smoke.ts';
import type { PaneDescriptor, PaneRect, ScaleLevel } from '../src/types.ts';

const { useAppStore } = await import('../src/state/store.ts');
const { SCALE_ORDER } = await import('../src/types.ts');

const { check, report } = makeChecker('smoke 7B');

type Store = ReturnType<typeof useAppStore.getState>;
const get = (): Store => useAppStore.getState();

/** Reset to the back-compat default between sub-sections. */
function reset(): void {
  get().setArrangement('single');
}

/** Deep structural equality of two pane arrays (order-sensitive). */
function panesEqual(a: readonly PaneDescriptor[], b: readonly PaneDescriptor[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when a set of rects exactly tiles a gridCols×gridRows grid: every grid
 *  cell covered by exactly one rect (no gaps, no overlaps). */
function tilesGrid(rects: readonly PaneRect[], gridCols: number, gridRows: number): boolean {
  const seen = new Map<string, number>();
  for (const r of rects) {
    for (let c = r.col; c < r.col + r.cols; c++) {
      for (let rw = r.row; rw < r.row + r.rows; rw++) {
        const key = `${c},${rw}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }
  if (seen.size !== gridCols * gridRows) return false;
  for (let c = 0; c < gridCols; c++) {
    for (let rw = 0; rw < gridRows; rw++) {
      if (seen.get(`${c},${rw}`) !== 1) return false; // gap or overlap
    }
  }
  return true;
}

// ===========================================================================
// A1 — default single-pane state
// ===========================================================================
reset();
{
  const s = get();
  check('A1 default has exactly one pane', s.panes.length === 1);
  check("A1 default pane id is 'root'", s.panes[0].id === 'root');
  check("A1 default pane level is 'cell'", s.panes[0].level === 'cell');
  check(
    'A1 default pane covers the whole 1×1 grid',
    JSON.stringify(s.panes[0].rect) === JSON.stringify({ col: 0, row: 0, cols: 1, rows: 1 }),
  );
  check("A1 focusedPaneId is 'root'", s.focusedPaneId === 'root');
  check('A1 grid is 1×1', s.gridCols === 1 && s.gridRows === 1);
  check('A1 paneSeq is 1', s.paneSeq === 1);
}

// ===========================================================================
// A2 — scale mirrors the focused pane level in the default
// ===========================================================================
{
  const s = get();
  const focused = s.panes.find((p) => p.id === s.focusedPaneId)!;
  check('A2 scale === focused pane level (default)', s.scale === focused.level);
  check('A2 scale is cell in the default', s.scale === 'cell');
}

// ===========================================================================
// A3 — setScale mutates the focused pane AND mirrors scale
// ===========================================================================
for (const level of SCALE_ORDER) {
  get().setScale(level);
  const s = get();
  const focused = s.panes.find((p) => p.id === s.focusedPaneId)!;
  check(`A3 setScale(${level}) → scale === ${level}`, s.scale === level);
  check(`A3 setScale(${level}) → focused pane level === ${level}`, focused.level === level);
}
reset();

// ===========================================================================
// A4 — replay App.tsx's [ / ] handler; scale must walk SCALE_ORDER identically
// ===========================================================================
{
  // The exact algorithm from App.tsx:209-216 — read scale, walk SCALE_ORDER.
  function pressBracket(key: '[' | ']'): void {
    const current = get().scale;
    const idx = SCALE_ORDER.indexOf(current);
    if (idx < 0) return;
    const nextIdx = key === '[' ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= SCALE_ORDER.length) return;
    get().setScale(SCALE_ORDER[nextIdx]);
  }
  reset();
  const observed: ScaleLevel[] = [get().scale];
  // Zoom out to the top.
  for (let i = 0; i < SCALE_ORDER.length + 2; i++) {
    pressBracket('[');
    observed.push(get().scale);
  }
  // Zoom back in to the bottom.
  for (let i = 0; i < SCALE_ORDER.length + 2; i++) {
    pressBracket(']');
    observed.push(get().scale);
  }
  // Reference: the bracket handler clamps at both ends.
  const ref: ScaleLevel[] = ['cell'];
  let cursor = 0;
  for (let i = 0; i < SCALE_ORDER.length + 2; i++) {
    cursor = Math.min(SCALE_ORDER.length - 1, cursor + 1);
    ref.push(SCALE_ORDER[cursor]);
  }
  for (let i = 0; i < SCALE_ORDER.length + 2; i++) {
    cursor = Math.max(0, cursor - 1);
    ref.push(SCALE_ORDER[cursor]);
  }
  check(
    'A4 [ / ] zoom walk matches reference SCALE_ORDER traversal',
    JSON.stringify(observed) === JSON.stringify(ref),
    `observed=${observed.join(',')} ref=${ref.join(',')}`,
  );
  // And the focused pane tracked it the whole way.
  check('A4 focused pane level tracked the walk', get().panes[0].level === get().scale);
}
reset();

// ===========================================================================
// A5 — setPaneLevel re-syncs scale only for the focused pane
// ===========================================================================
{
  get().setArrangement('study'); // root (cell, focused) + p2 (district)
  const before = get().scale;
  check('A5 study focus scale is cell', before === 'cell');
  // Change the NON-focused pane (p2) — scale must NOT change.
  get().setPaneLevel('p2', 'island');
  check('A5 setPaneLevel on non-focused does not move scale', get().scale === 'cell');
  check('A5 non-focused pane level did change', get().panes.find((p) => p.id === 'p2')!.level === 'island');
  // Change the FOCUSED pane (root) — scale must re-sync.
  get().setPaneLevel('root', 'continent');
  check('A5 setPaneLevel on focused re-syncs scale', get().scale === 'continent');
  // Bad id → no-op.
  const snap = JSON.stringify(get().panes);
  get().setPaneLevel('does-not-exist', 'planet');
  check('A5 setPaneLevel(bad id) is a no-op', JSON.stringify(get().panes) === snap);
}
reset();

// ===========================================================================
// A6 — splitPane: +1 pane, tiles grid, deterministic ids/rects
// ===========================================================================
{
  reset();
  get().splitPane('vertical');
  const s1 = get();
  check('A6 split adds exactly one pane', s1.panes.length === 2);
  check('A6 split mints deterministic id p2', s1.panes.some((p) => p.id === 'p2'));
  check('A6 split ids are unique', new Set(s1.panes.map((p) => p.id)).size === s1.panes.length);
  check(
    'A6 split rects tile the grid (no overlap, full coverage)',
    tilesGrid(s1.panes.map((p) => p.rect), s1.gridCols, s1.gridRows),
  );
  check('A6 split keeps focus on the original pane', s1.focusedPaneId === 'root');
  check('A6 split inherits the focused pane level', s1.panes.find((p) => p.id === 'p2')!.level === 'cell');

  // Split-twice-from-reset must be byte-identical (deterministic ids/rects).
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  const a = JSON.stringify({ panes: get().panes, gridCols: get().gridCols, gridRows: get().gridRows });
  reset();
  get().splitPane('vertical');
  get().splitPane('horizontal');
  const b = JSON.stringify({ panes: get().panes, gridCols: get().gridCols, gridRows: get().gridRows });
  check('A6 split-twice-from-reset is deterministic', a === b);
  check(
    'A6 double-split still tiles the grid',
    tilesGrid(get().panes.map((p) => p.rect), get().gridCols, get().gridRows),
  );
}
reset();

// ===========================================================================
// A7 — closePane
// ===========================================================================
{
  reset();
  // Closing the last (only) pane is a no-op.
  const snap = JSON.stringify(get().panes);
  get().closePane('root');
  check('A7 closePane on the last pane is a no-op', JSON.stringify(get().panes) === snap);
  check('A7 still exactly one pane after no-op close', get().panes.length === 1);

  // Split, then close the focused pane → refocus a survivor + re-sync scale.
  reset();
  get().setPaneLevel('root', 'island'); // focused root at island
  get().splitPane('vertical'); // p2 inherits island; focus stays root
  get().setPaneLevel('p2', 'continent'); // p2 now continent (non-focused)
  check('A7 pre-close scale tracks focused root (island)', get().scale === 'island');
  get().closePane('root'); // close the FOCUSED pane
  check('A7 closePane removed the pane', !get().panes.some((p) => p.id === 'root'));
  check('A7 focus moved to a survivor', get().panes.some((p) => p.id === get().focusedPaneId));
  check('A7 scale re-synced to the new focused pane', get().scale === get().panes.find((p) => p.id === get().focusedPaneId)!.level);
  check('A7 scale is the survivor (continent)', get().scale === 'continent');

  // Closing a non-existent id is a no-op.
  const snap2 = JSON.stringify(get().panes);
  get().closePane('ghost');
  check('A7 closePane(bad id) is a no-op', JSON.stringify(get().panes) === snap2);
}
reset();

// ===========================================================================
// A8 — focusPane
// ===========================================================================
{
  get().setArrangement('study'); // root (cell, focused) + p2 (district)
  get().focusPane('p2');
  check('A8 focusPane changes focus', get().focusedPaneId === 'p2');
  check('A8 focusPane re-syncs scale to district', get().scale === 'district');
  // Bad id → no-op.
  get().focusPane('nope');
  check('A8 focusPane(bad id) is a no-op', get().focusedPaneId === 'p2');
  // Refocus original.
  get().focusPane('root');
  check('A8 focusPane back to root re-syncs scale to cell', get().scale === 'cell');
}
reset();

// ===========================================================================
// A9 — cycleFocus wraps array order
// ===========================================================================
{
  // One pane → no-op.
  get().cycleFocus();
  check('A9 cycleFocus with one pane is a no-op', get().focusedPaneId === 'root');

  get().setArrangement('study'); // [root, p2]
  check('A9 study focus starts at root', get().focusedPaneId === 'root');
  get().cycleFocus();
  check('A9 cycleFocus → p2', get().focusedPaneId === 'p2');
  get().cycleFocus();
  check('A9 cycleFocus wraps back to root', get().focusedPaneId === 'root');
  check('A9 cycleFocus kept scale synced', get().scale === get().panes.find((p) => p.id === get().focusedPaneId)!.level);
}
reset();

// ===========================================================================
// A10 — setArrangement
// ===========================================================================
{
  // Capture the default, perturb, then 'single' must deep-equal it.
  reset();
  const defaultSnap = {
    panes: get().panes,
    focusedPaneId: get().focusedPaneId,
    gridCols: get().gridCols,
    gridRows: get().gridRows,
    paneSeq: get().paneSeq,
    scale: get().scale,
  };
  get().setArrangement('study');
  get().splitPane('vertical');
  get().setArrangement('single');
  const restored = {
    panes: get().panes,
    focusedPaneId: get().focusedPaneId,
    gridCols: get().gridCols,
    gridRows: get().gridRows,
    paneSeq: get().paneSeq,
    scale: get().scale,
  };
  check(
    "A10 setArrangement('single') deep-equals the default",
    JSON.stringify(restored) === JSON.stringify(defaultSnap) && panesEqual(restored.panes, defaultSnap.panes),
  );

  get().setArrangement('study');
  const st = get();
  check('A10 study has two panes', st.panes.length === 2);
  check('A10 study pane0 is cell', st.panes[0].level === 'cell');
  check('A10 study pane1 is district', st.panes[1].level === 'district');
  check('A10 study focuses the cell pane', st.focusedPaneId === st.panes[0].id);
  check('A10 study scale is cell', st.scale === 'cell');
  check(
    'A10 study rects tile the 2×1 grid',
    tilesGrid(st.panes.map((p) => p.rect), st.gridCols, st.gridRows),
  );
}
reset();

// ===========================================================================
// A11 — all rects in bounds across arrangements + splits
// ===========================================================================
{
  function allInBounds(): boolean {
    const s = get();
    return s.panes.every(
      (p) =>
        p.rect.col >= 0 &&
        p.rect.row >= 0 &&
        p.rect.cols >= 1 &&
        p.rect.rows >= 1 &&
        p.rect.col + p.rect.cols <= s.gridCols &&
        p.rect.row + p.rect.rows <= s.gridRows,
    );
  }
  reset();
  check('A11 default rects in bounds', allInBounds());
  get().setArrangement('study');
  check('A11 study rects in bounds', allInBounds());
  get().splitPane('horizontal');
  check('A11 study+split rects in bounds', allInBounds());
  get().splitPane('vertical');
  check('A11 study+2 splits rects in bounds', allInBounds());
}
reset();

// ===========================================================================
// A12 — single→study clip-mask regression trigger (model-layer lock)
// ===========================================================================
{
  // Mirror PixiApp.isFullGrid purely from store state (PixiApp imports PIXI,
  // so we re-derive the predicate here rather than import it in Node).
  const fullGrid = (r: PaneRect, gc: number, gr: number): boolean =>
    r.col === 0 && r.row === 0 && r.cols === gc && r.rows === gr;

  reset();
  const s0 = get();
  const root0 = s0.panes.find((p) => p.id === 'root')!;
  check('A12 default root is full-grid (maskless single-pane path)', fullGrid(root0.rect, s0.gridCols, s0.gridRows));

  get().setArrangement('study');
  const s1 = get();
  const root1 = s1.panes.find((p) => p.id === 'root');
  check('A12 study KEEPS the root pane id (rect-only reconcile branch)', !!root1);
  check('A12 study root level is still cell (level unchanged → no remount)', root1!.level === 'cell');
  check(
    'A12 study root flipped full-grid → PARTIAL (mask now required)',
    !fullGrid(root1!.rect, s1.gridCols, s1.gridRows),
  );
}
reset();

// ===========================================================================
// R — cycleFocusedPaneRegion (Phase 7 / v2.x region terminals)
// ===========================================================================
{
  const WINGS = ['d0', 'd1', 'd2'];
  const focusedRegion = (): string | undefined =>
    get().panes.find((p) => p.id === get().focusedPaneId)?.regionId;

  reset();
  // R1 — default focused cell pane starts with no region (whole library).
  check('R1 default focused pane has no region', focusedRegion() === undefined);

  // R2 — cycles undefined → first wing → … → last wing → back to undefined.
  get().cycleFocusedPaneRegion(WINGS);
  check('R2 first cycle → d0', focusedRegion() === 'd0');
  get().cycleFocusedPaneRegion(WINGS);
  check('R2 second cycle → d1', focusedRegion() === 'd1');
  get().cycleFocusedPaneRegion(WINGS);
  check('R2 third cycle → d2', focusedRegion() === 'd2');
  get().cycleFocusedPaneRegion(WINGS);
  check('R2 wraps last wing → whole-library (undefined)', focusedRegion() === undefined);

  // R3 — a stale regionId no longer in the live wing list resets to whole-lib.
  get().cycleFocusedPaneRegion(WINGS); // → d0
  get().cycleFocusedPaneRegion(['d5', 'd6']); // d0 absent → indexOf -1 → slot 0 → undefined
  check('R3 stale region falls back to whole-library', focusedRegion() === undefined);

  // R4 — no-op on a non-cell focused pane (region only applies to cells).
  reset();
  get().setPaneLevel('root', 'district');
  get().cycleFocusedPaneRegion(WINGS);
  check('R4 non-cell focused pane is untouched', focusedRegion() === undefined);

  // R5 — only the FOCUSED pane gets a region; a split sibling stays whole-lib.
  reset();
  get().splitPane('vertical'); // focus stays on root (the focused-pane split)
  get().cycleFocusedPaneRegion(WINGS); // → focused pane = d0
  const focusedId = get().focusedPaneId;
  const sibling = get().panes.find((p) => p.id !== focusedId)!;
  check('R5 focused pane took the region', focusedRegion() === 'd0');
  check('R5 sibling pane stays whole-library', sibling.regionId === undefined);
}
reset();

report();
