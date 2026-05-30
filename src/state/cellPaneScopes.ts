/**
 * Live cell-pane runtime-scope registry (Phase 7 / v2.x Composable panes).
 *
 * Each mounted CELL pane registers its `RuntimeScope` here at mount and
 * unregisters at teardown. The sleep-reflection sweep iterates the union of
 * all live cell panes' runtimes (each pane is a live world that accrued a
 * `reflectionCounter` overnight), so the morning dispatch covers every pane.
 *
 * Standalone module (not hosted on PixiApp.ts) deliberately: `sleep-reflection.ts`
 * imports `listCellPaneScopes()` and PixiApp.ts imports nothing from
 * sleep-reflection, but routing the registry through a tiny leaf module keeps
 * the import graph acyclic regardless of future wiring. Non-cell panes
 * (district/island/…) never register, so the sweep only ever sees cohort
 * worlds.
 *
 * Single-pane reduction: with the default single 'root' cell pane the set
 * holds exactly that pane's scope, so `listCellPaneScopes()` yields one
 * scope whose runtimes === the world's runtimes — byte-identical to sweeping
 * `DEFAULT_SCOPE`/`listRuntimes()` as before.
 */

import type { RuntimeScope } from './agentRuntime';

const cellPaneScopes = new Set<RuntimeScope>();

/** Register a live cell pane's scope. Returns an unregister fn the cell
 *  renderer calls in its teardown closure (idempotent — a double-call is a
 *  no-op once removed). */
export function registerCellPaneScope(scope: RuntimeScope): () => void {
  cellPaneScopes.add(scope);
  return () => {
    cellPaneScopes.delete(scope);
  };
}

/** Snapshot of all live cell-pane scopes (insertion order). Empty before
 *  any cell mounts — sweeps over it no-op, same as the pre-pane-scoping
 *  `listRuntimes()` returning [] pre-mount. */
export function listCellPaneScopes(): RuntimeScope[] {
  return Array.from(cellPaneScopes);
}
