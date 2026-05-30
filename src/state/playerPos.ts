/**
 * Player position singleton — now PANE-SCOPED (Phase 7 / v2.x Composable
 * panes). Mutated by keyboard handlers each frame (or each debounced step)
 * and read by the cell-level renderer's Ticker. **NOT** in Zustand on
 * purpose — Zustand re-renders on every mutation, and a 60Hz position
 * update would trigger 60 React re-renders per second. Module-local mutable
 * objects are the canonical pattern for frame-rate values that need to be
 * shared between imperative subsystems.
 *
 * Pane-scoping: each cell pane gets its OWN `{x,y}` object, keyed by pane
 * id, behind a lazy `Map<paneId,{x,y}>`. `getPlayerPos(paneId)` returns a
 * STABLE mutable object (created lazily, cached in the Map) so the cell
 * renderer can capture the reference ONCE at mount and mutate `.x/.y` in
 * place at frame rate — zero per-frame allocation, zero re-render. Two cell
 * panes therefore drive two independent `@`s with no collision (the Phase
 * 7-B deferred limitation this removes).
 *
 * Single-pane reduction: `playerPosition` + `setPlayerPosition` are retained
 * as thin aliases bound to the `'root'` pane id. With the default single
 * 'root' cell pane every read/write goes through the exact same cached
 * object as the pre-pane-scoping singleton → byte-identical behaviour, and
 * any consumer not yet migrated keeps compiling + working.
 *
 * Coordinates are in tile-cell units (not pixels). The level renderer
 * multiplies by COZETTE_CELL_WIDTH / HEIGHT for screen placement.
 *
 * Revived from legacy-3d/state/playerPos.ts (was vec3 in the 3D build).
 * On level mount, the renderer should reset the pane's position to
 * layout.spawnAt — the previous value belongs to the previous cell. On pane
 * teardown the renderer calls `clearPlayerPos(paneId)` so a reused pane id
 * never inherits a stale position before its own mount reset runs.
 */

/** Default pane id — the single 'root' cell pane (back-compat default). */
const ROOT_PANE = 'root';

const positions = new Map<string, { x: number; y: number }>();

/**
 * Return the STABLE mutable position object for a pane. Created lazily on
 * first access (default {0,0}, matching the old singleton's initial value)
 * and cached so every call for the same pane id returns the SAME reference.
 * Callers capture this once at mount and mutate `.x/.y` in place at frame
 * rate. Never returns a fresh object for an existing pane.
 */
export function getPlayerPos(paneId: string): { x: number; y: number } {
  let pos = positions.get(paneId);
  if (!pos) {
    pos = { x: 0, y: 0 };
    positions.set(paneId, pos);
  }
  return pos;
}

/** Mutate a pane's position in place (creating the cached object if absent).
 *  Preserves object identity so a captured reference stays live. */
export function setPlayerPos(paneId: string, x: number, y: number): void {
  const pos = getPlayerPos(paneId);
  pos.x = x;
  pos.y = y;
}

/** Drop a pane's position entry on teardown so a reused pane id respawns
 *  clean (belt-and-suspenders alongside the cell renderer's mount-time
 *  spawn reset). Clearing one pane never affects another. */
export function clearPlayerPos(paneId: string): void {
  // 'root' is the permanent default pane (never closed) and the
  // `playerPosition` back-compat alias captured its object at module load.
  // Deleting the entry would orphan that alias (a later getPlayerPos('root')
  // would mint a fresh object the alias no longer points to). Reset the
  // 'root' position in place instead so the captured reference stays live
  // across cell remounts; other panes are truly removed on teardown.
  if (paneId === ROOT_PANE) {
    const pos = positions.get(ROOT_PANE);
    if (pos) {
      pos.x = 0;
      pos.y = 0;
    }
    return;
  }
  positions.delete(paneId);
}

/**
 * Back-compat alias — the 'root' pane's position object. This is the EXACT
 * same cached reference `getPlayerPos('root')` returns, so reads through this
 * symbol track the live position with no lag. Single-pane consumers (and any
 * not-yet-migrated reader) keep working unchanged.
 */
export const playerPosition = getPlayerPos(ROOT_PANE);

/** Back-compat alias — writes the 'root' pane's position. Identical to
 *  `setPlayerPos('root', x, y)`. */
export function setPlayerPosition(x: number, y: number): void {
  setPlayerPos(ROOT_PANE, x, y);
}
