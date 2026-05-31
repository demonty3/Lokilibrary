/**
 * Phase 7-D — paneId-keyed pane registry (leaf module).
 *
 * Cross-seam perception needs a pane to reach its NEIGHBOUR's RuntimeScope +
 * interior layout BY paneId. Today `cellPaneScopes.ts` is a paneId-less Set
 * used only by the sleep-reflection sweep — it cannot answer "give me pane p2's
 * agents." This registry answers exactly that, in a SEPARATE module so
 * `cellPaneScopes.ts` (the sleep-sweep contract) stays byte-identical.
 *
 * Acyclic leaf: imports ONLY types (RuntimeScope from agentRuntime, CellLayout
 * from procedural/cell — both leaves). Mirrors `cellPaneScopes.ts`'s
 * register-returns-unregister structure.
 *
 * Single-pane reduction: with the default single 'root' cell pane the registry
 * holds exactly that one entry. Nothing reads a NEIGHBOUR (there is none), so
 * the cross-seam enricher's `getNeighbourScope` lookups never run — the
 * no-open-seam path is byte-identical to today.
 */

import type { RuntimeScope } from './agentRuntime';
import type { CellLayout } from '../procedural/cell';

export interface PaneRegistration {
  scope: RuntimeScope;
  layout: CellLayout;
}

const panes = new Map<string, PaneRegistration>();

/** Register a live cell pane by id. Returns an unregister fn the cell renderer
 *  calls in teardown (idempotent — only deletes if still the same entry). */
export function registerPane(
  paneId: string,
  scope: RuntimeScope,
  layout: CellLayout,
): () => void {
  const entry: PaneRegistration = { scope, layout };
  panes.set(paneId, entry);
  return () => {
    // Only delete if this exact entry is still registered (a remount of the
    // same paneId before teardown of the old must not drop the new one).
    if (panes.get(paneId) === entry) panes.delete(paneId);
  };
}

/** Look up a pane by id. Returns undefined for an unregistered (or non-cell)
 *  pane — the enricher skips that seam gracefully. */
export function getPane(paneId: string): PaneRegistration | undefined {
  return panes.get(paneId);
}

/** Test-only — clear the whole registry between smoke sub-sections. */
export function _resetPaneRegistry(): void {
  panes.clear();
}
