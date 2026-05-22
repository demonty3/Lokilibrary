/**
 * Player position singleton. Mutated by keyboard handlers each frame
 * (or each debounced step) and read by the cell-level renderer's
 * Ticker. **NOT** in Zustand on purpose — Zustand re-renders on every
 * mutation, and a 60Hz position update would trigger 60 React
 * re-renders per second. Module-local mutable object is the canonical
 * pattern for frame-rate values that need to be shared between
 * imperative subsystems.
 *
 * Coordinates are in tile-cell units (not pixels). The level renderer
 * multiplies by COZETTE_CELL_WIDTH / HEIGHT for screen placement.
 *
 * Revived from legacy-3d/state/playerPos.ts (was vec3 in the 3D build).
 * On level mount, the renderer should reset to layout.spawnAt — the
 * singleton's previous value belongs to the previous cell.
 */

export const playerPosition = { x: 0, y: 0 };

export function setPlayerPosition(x: number, y: number): void {
  playerPosition.x = x;
  playerPosition.y = y;
}
