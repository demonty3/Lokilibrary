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

/**
 * Phase 7-D.2 — is `agentId` currently live in SOME registered pane OTHER than
 * `exceptPaneId`? The single-roaming-roster invariant: an agent lives in exactly
 * ONE pane's scope. The root-gate (cohort.ts) consults this on a root (re)mount
 * so it never RE-SPAWNS an agent that has already walked out of root into a
 * sibling cell pane — without it, a partial root remount (zoom root out + back
 * while p2 holds a migrated `loki`) would re-create `loki` in root AND leave it
 * in p2 = a duplicate runtime + two sprites + doubled Tier-1 cost.
 *
 * Single-pane: with the lone 'root' pane there is no other registered pane, so
 * this always returns false ⇒ the gate spawns the full roster exactly as before
 * (byte-identical). On the FIRST world mount the registry holds only 'root'
 * itself (cell.ts registers before mountCohort runs), and we exclude it via
 * `exceptPaneId`, so the initial spawn is never suppressed.
 */
export function isAgentLiveElsewhere(agentId: string, exceptPaneId: string): boolean {
  for (const [pid, reg] of panes) {
    if (pid === exceptPaneId) continue;
    if (reg.scope.runtimes.has(agentId)) return true;
  }
  return false;
}

/** Test-only — clear the whole registry between smoke sub-sections. */
export function _resetPaneRegistry(): void {
  panes.clear();
}
