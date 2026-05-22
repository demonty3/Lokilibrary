import type { Prng } from './prng';
import type { Tile, TileBible } from './tiles/types';
import { UNSOLVED } from './tiles/types';
import { TILE_BY_ID } from './tiles/library';

/**
 * Hand-rolled tiled-model Wave Function Collapse. Mulberry32-seeded via
 * `prng`. The only JS WFC option (`wavefunctioncollapse` npm) is 2018
 * CommonJS, untyped, and can't take an injected PRNG — adapting it
 * costs more than this solver. Repo convention is TS strict + ESM.
 * Escape hatch for Phase 3+: DeBroglie-via-WASM behind a stable
 * `solveWfc(...)` interface.
 *
 * The min-entropy heuristic + adjacency propagation are the textbook
 * mxgmn pattern. Restart-on-contradiction (instead of single-cell
 * backtracking) is the simplification — the 22×14 interior grid + 3
 * interior tiles + permissive adjacency means contradictions are rare
 * and restarts are cheap. After RESTART_BUDGET attempts, unsolved cells
 * default to `fallbackTile` and the result reports `defaulted > 0`.
 *
 * Determinism: `prng` advances through restarts, so the same seed
 * always produces the same final grid. No `Math.random()`.
 */

const RESTART_BUDGET = 8;

export interface WfcResult {
  /** Solved grid, [y][x]. After success, every entry is a tile id > 0. */
  tiles: number[][];
  /** Count of cells that fell back to `fallbackTile` on budget exhaustion. */
  defaulted: number;
  /** Number of restart attempts the solver consumed. */
  attempts: number;
}

export function solveWfc(
  bible: TileBible,
  initial: ReadonlyArray<ReadonlyArray<number>>,
  prng: Prng,
  fallbackTile: number,
): WfcResult {
  const height = initial.length;
  const width = initial[0]?.length ?? 0;

  // Pool of tile ids WFC may choose when collapsing an empty cell.
  const interiorPool: readonly number[] = bible.tiles
    .filter((t) => t.frequency > 0)
    .map((t) => t.id);

  let lastCells: Set<number>[][] | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < RESTART_BUDGET; attempt++) {
    attempts = attempt + 1;
    const cells = initCells(initial, interiorPool);

    // Propagate from all pre-collapsed cells before main loop.
    const seedQueue: Array<[number, number]> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (initial[y][x] !== UNSOLVED) seedQueue.push([x, y]);
      }
    }
    if (!propagate(cells, seedQueue, width, height)) {
      // Pre-collapse itself contradicts — bible is misconfigured, no
      // restart will help. Bail to fallback.
      lastCells = cells;
      break;
    }

    let contradiction = false;
    for (;;) {
      const pick = findMinEntropy(cells, width, height);
      if (!pick) break; // all collapsed
      const [x, y] = pick;
      const choice = weightedPick(cells[y][x], prng);
      cells[y][x] = new Set([choice]);
      if (!propagate(cells, [[x, y]], width, height)) {
        contradiction = true;
        break;
      }
    }

    if (!contradiction) {
      return {
        tiles: serialize(cells, width, height, fallbackTile).tiles,
        defaulted: 0,
        attempts,
      };
    }
    lastCells = cells;
  }

  // All attempts exhausted. Use the last state and default unsolved.
  const finalCells = lastCells ?? initCells(initial, interiorPool);
  const { tiles, defaulted } = serialize(finalCells, width, height, fallbackTile);
  if (defaulted > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[wfc] backtrack budget exhausted after ${attempts} attempts, defaulted ${defaulted} cells to fallback`,
    );
  }
  return { tiles, defaulted, attempts };
}

function initCells(
  initial: ReadonlyArray<ReadonlyArray<number>>,
  pool: readonly number[],
): Set<number>[][] {
  return initial.map((row) =>
    row.map((id) => (id === UNSOLVED ? new Set(pool) : new Set([id]))),
  );
}

function propagate(
  cells: Set<number>[][],
  queue: Array<[number, number]>,
  width: number,
  height: number,
): boolean {
  // Each direction step is (dx, dy, keyOnSource).
  // The constraint: if cell at (x, y) holds possibility T, then the
  // neighbour at (x+dx, y+dy) must be in T.allowed[keyOnSource].
  const steps: Array<[number, number, 'n' | 'e' | 's' | 'w']> = [
    [0, -1, 'n'],
    [1, 0, 'e'],
    [0, 1, 's'],
    [-1, 0, 'w'],
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const here = cells[y][x];
    for (const [dx, dy, dir] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      // Build the union of "what can sit at (nx, ny)" given my own
      // possibilities at (x, y).
      const allowedAtNeighbour = new Set<number>();
      for (const tileId of here) {
        const tile = TILE_BY_ID.get(tileId);
        if (!tile) continue;
        for (const nid of tile.allowed[dir]) allowedAtNeighbour.add(nid);
      }
      const neighbour = cells[ny][nx];
      let changed = false;
      for (const id of neighbour) {
        if (!allowedAtNeighbour.has(id)) {
          neighbour.delete(id);
          changed = true;
        }
      }
      if (neighbour.size === 0) return false;
      if (changed) queue.push([nx, ny]);
    }
  }
  return true;
}

function findMinEntropy(
  cells: Set<number>[][],
  width: number,
  height: number,
): [number, number] | null {
  let best: [number, number] | null = null;
  let bestSize = Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const size = cells[y][x].size;
      if (size > 1 && size < bestSize) {
        bestSize = size;
        best = [x, y];
        if (bestSize === 2) return best; // can't get lower
      }
    }
  }
  return best;
}

function weightedPick(possibilities: Set<number>, prng: Prng): number {
  let totalWeight = 0;
  const ids: number[] = [];
  const weights: number[] = [];
  for (const id of possibilities) {
    const tile = TILE_BY_ID.get(id);
    if (!tile) continue;
    // Pre-collapsed tiles (frequency 0) shouldn't appear in min-entropy
    // collapsing pools; if they do, treat as weight 1 so the pick still
    // works.
    const w = tile.frequency > 0 ? tile.frequency : 1;
    ids.push(id);
    weights.push(w);
    totalWeight += w;
  }
  let r = prng.next() * totalWeight;
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) return ids[i];
  }
  return ids[ids.length - 1]; // float guard
}

function serialize(
  cells: Set<number>[][],
  width: number,
  height: number,
  fallbackTile: number,
): { tiles: number[][]; defaulted: number } {
  let defaulted = 0;
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const cell = cells[y][x];
      if (cell.size === 1) {
        row.push([...cell][0]);
      } else {
        row.push(fallbackTile);
        defaulted++;
      }
    }
    tiles.push(row);
  }
  return { tiles, defaulted };
}

/** Re-export so tests / callers can type-check against the same Tile shape. */
export type { Tile };
