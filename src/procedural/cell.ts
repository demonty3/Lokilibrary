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
  /** Rows where the EAST + WEST side walls are carved open to walkable floor
   *  (deterministic per seed). A vertical pane split shares its seam along the
   *  side walls, so these are the rows an agent can actually cross between
   *  panes — the floor-gate in `seams.ts` needs floor on both the exit edge and
   *  the bridged-entry cell, which (both panes showing this same layout) means
   *  the same row must be open on each wall. */
  seamRows: number[];
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
/** PRNG namespace for the walkable seam-opening row. DISTINCT from the cell
 *  layout salt (0xce11) so the seam row can be drawn from a DIFFERENT seed than
 *  the room without disturbing the room's PRNG stream. Threading a SHARED seed
 *  here (the profile seed, identical across every region/wing of a profile) is
 *  what makes two DIFFERENT-looking rooms carve their openings at the SAME row —
 *  so an agent can walk from one terminal into a neighbour that looks different
 *  and the floor-gate still finds an aligned crossing. */
const SEAM_SALT = 0x5ea3;

/**
 * @param seed      the layout seed (per-region for a wing, profile seed for the
 *                  whole library) — drives the room (walls, WFC, shelves).
 * @param seamSeed  OPTIONAL shared seed for the walkable seam-opening row. When
 *                  omitted it falls back to `seed` (single-pane / smoke callers
 *                  keep a self-consistent opening). Pane callers pass the PROFILE
 *                  seed so every wing of the same profile opens at the same row,
 *                  making region↔region (different-looking) seams crossable.
 */
export function layoutCell(seed: number, seamSeed?: number): CellLayout {
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

  // 2b. Walkable seam openings. Carve a one-cell floor gap on BOTH side walls
  //     (west x=0, east x=width-1) at one seeded row, plus the interior cell
  //     beside each, so a VERTICAL pane split has a crossable seam: an agent can
  //     walk to the east edge and step off into the west edge of the neighbour
  //     (seams.ts's floor-gate needs floor on BOTH the exit edge and the bridged
  //     entry, which — both panes showing this same layout — means the same row
  //     must be open on each wall). Carved AFTER WFC (overwriting the solved grid
  //     like spawnAt below) because T_FLOOR can't sit vertically adjacent to
  //     T_WALL_V under the bible's adjacency — the gap is a deliberate post-solve
  //     carve, not a WFC choice. Drawn from `prng` AFTER solveWfc so the room
  //     itself stays byte-identical to before; only these few cells change. The
  //     bookshelf walk below runs after this, so a carved-over shelf is correctly
  //     dropped from bookshelfSlots.
  //     A THREE-cell-tall doorway (not one) for a comfortable opening. Drawn
  //     from a SEPARATE prng seeded by `seamSeed` (the shared profile seed for
  //     pane callers) so every wing of a profile opens at the SAME row — the
  //     alignment that lets an agent cross between DIFFERENT-looking rooms. Uses
  //     its own prng (not the room `prng`) so the room stays byte-identical
  //     regardless of which seed feeds the seam; `prng` is unused after WFC, so
  //     dropping its old seamMid draw shifts nothing downstream.
  const seamPrng = mulberry32(((seamSeed ?? seed) ^ SEAM_SALT) >>> 0);
  const seamMid = seamPrng.range(3, height - 3);
  const seamRows = [seamMid - 1, seamMid, seamMid + 1];
  for (const r of seamRows) {
    for (const x of [0, 1, width - 2, width - 1]) {
      wfc.tiles[r][x] = T_FLOOR;
    }
  }

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
    seamRows,
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
