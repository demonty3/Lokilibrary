import { mulberry32 } from './prng';
import { solveWfc, type WfcResult } from './wfc';
import { LIBRARY_BIBLE, T_FLOOR } from './tiles/library';
import { UNSOLVED } from './tiles/types';

/** Cartesian coordinate within the cell grid. */
export interface CellPoint {
  x: number;
  y: number;
}

export interface CellLayout {
  /** Solved tile grid, [y][x]. Indexed 0..width-1, 0..height-1. */
  tiles: number[][];
  width: number;
  height: number;
  /** Floor cells where the library bookshelves landed — one game's
   *  spine glyph gets overlaid per slot, in profile order, until the
   *  list runs out or all slots are filled. Order is reading order
   *  (top-to-bottom, left-to-right) so the same profile produces a
   *  stable mapping. */
  bookshelfSlots: CellPoint[];
  /** The door cell on the south wall (deterministic per seed). */
  doorAt: CellPoint;
  /** Player avatar spawn — one cell north of the door. */
  spawnAt: CellPoint;
  /** Window cell on the north wall (deterministic per seed). */
  windowAt: CellPoint;
  /** Diagnostic info passed through from the WFC pass. */
  wfc: WfcResult;
}

/**
 * Build a deterministic cell layout for the given profile seed. PRNG is
 * `mulberry32(seed ^ 0xce11)` (namespace isolation — keeps the cell
 * layer's PRNG independent of scatter, agent walks, etc., even if the
 * same seed is reused).
 *
 * `gameCount` doesn't change the layout — same seed, same room — but
 * the bookshelfSlots returned will be the full set of bookshelves WFC
 * placed, ready for the renderer to overlay `gameCount`-many spines.
 *
 * Use `LIBRARY_BIBLE` for now; future district types swap in their own
 * bibles via an overload.
 */
export function layoutCell(seed: number): CellLayout {
  const bible = LIBRARY_BIBLE;
  const width = bible.width;
  const height = bible.height;
  const prng = mulberry32((seed ^ 0xce11) >>> 0);

  // 1. Pre-collapse boundary: corners + walls + door + window.
  const initial: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(boundaryAt(bible, x, y, width, height));
    }
    initial.push(row);
  }

  // Door: somewhere on the bottom wall, away from corners.
  const doorX = prng.range(3, width - 3);
  const doorAt: CellPoint = { x: doorX, y: height - 1 };
  initial[doorAt.y][doorAt.x] = bible.boundary.door;

  // Window: somewhere on the top wall, away from corners + the door
  // column (so the door + window don't visually stack).
  let windowX = prng.range(3, width - 3);
  if (windowX === doorX) windowX = (windowX + 2) % (width - 4) + 2;
  const windowAt: CellPoint = { x: windowX, y: 0 };
  initial[windowAt.y][windowAt.x] = bible.boundary.window;

  // 2. WFC fills the interior (rows 1..h-2, cols 1..w-2 by default
  //    since the boundary cells are pre-set to non-zero ids).
  const wfc = solveWfc(bible, initial, prng, T_FLOOR);

  // 3. Walk the solved grid for bookshelf slots (reading order) +
  //    pick a spawn one cell north of the door.
  const bookshelfSlots: CellPoint[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Bookshelf tile id 9 — keep this in sync with the bible.
      if (wfc.tiles[y][x] === /* T_BOOKSHELF */ 9) bookshelfSlots.push({ x, y });
    }
  }
  const spawnAt: CellPoint = { x: doorAt.x, y: doorAt.y - 1 };
  // If WFC put a non-floor where we want to spawn, force it to floor —
  // the player avatar must have somewhere to stand. (Rare; logged.)
  if (wfc.tiles[spawnAt.y][spawnAt.x] !== T_FLOOR) {
    // eslint-disable-next-line no-console
    console.warn(
      `[cell] spawn cell (${spawnAt.x},${spawnAt.y}) had tile ${wfc.tiles[spawnAt.y][spawnAt.x]}; forcing to floor`,
    );
    wfc.tiles[spawnAt.y][spawnAt.x] = T_FLOOR;
  }

  return {
    tiles: wfc.tiles,
    width,
    height,
    bookshelfSlots,
    doorAt,
    spawnAt,
    windowAt,
    wfc,
  };
}

function boundaryAt(
  bible: typeof LIBRARY_BIBLE,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const onN = y === 0;
  const onS = y === height - 1;
  const onW = x === 0;
  const onE = x === width - 1;
  if (onN && onW) return bible.boundary.cornerTL;
  if (onN && onE) return bible.boundary.cornerTR;
  if (onS && onW) return bible.boundary.cornerBL;
  if (onS && onE) return bible.boundary.cornerBR;
  if (onN) return bible.boundary.edgeN;
  if (onS) return bible.boundary.edgeS;
  if (onE) return bible.boundary.edgeE;
  if (onW) return bible.boundary.edgeW;
  return UNSOLVED;
}
