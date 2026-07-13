import type { Tile, TileBible } from './types';

/**
 * Library-room tile bible. Phase 1's only district type — a single
 * enclosed room with bookshelf rows, tables, one door on the bottom
 * wall, one window. The 12 tiles below cover walls + corners + interior
 * fill + structural openings.
 *
 * Convention: interior tiles (floor, bookshelf, table) carry
 * frequency > 0 and are selected by WFC during interior collapse.
 * Boundary tiles (walls, corners, door, window, tee) carry frequency = 0
 * and are pre-placed by `layoutCell` before WFC runs; WFC's propagation
 * step uses their adjacency only to constrain neighbouring interior
 * cells.
 *
 * The Tee variant (id 8, `┴`) is reserved for future fancier door
 * framing (wall_h ─ tee ┴ door ╪ tee ┴ wall_h). Not used in Phase 1.
 */

// Tile id constants — exported so cell.ts + render code can refer
// without hand-typing numbers.
export const T_FLOOR = 1;
export const T_WALL_H = 2;
export const T_WALL_V = 3;
export const T_CORNER_TL = 4;
export const T_CORNER_TR = 5;
export const T_CORNER_BL = 6;
export const T_CORNER_BR = 7;
export const T_TEE = 8;
export const T_BOOKSHELF = 9;
export const T_DOOR = 10;
export const T_WINDOW = 11;
export const T_TABLE = 12;

// Helper to build a readonly set succinctly.
const s = (...ids: number[]): ReadonlySet<number> => new Set(ids);

const TILES: readonly Tile[] = [
  {
    id: T_FLOOR,
    glyph: '·',
    fgKey: 'fgDim',
    frequency: 70,
    allowed: {
      // Floor sits next to anything interior + most boundary tiles.
      n: s(T_FLOOR, T_BOOKSHELF, T_TABLE, T_WALL_H, T_CORNER_TL, T_CORNER_TR, T_WINDOW, T_TEE),
      e: s(T_FLOOR, T_BOOKSHELF, T_TABLE, T_WALL_V, T_CORNER_TR, T_CORNER_BR, T_DOOR, T_WINDOW),
      s: s(T_FLOOR, T_BOOKSHELF, T_TABLE, T_WALL_H, T_CORNER_BL, T_CORNER_BR, T_DOOR, T_WINDOW, T_TEE),
      w: s(T_FLOOR, T_BOOKSHELF, T_TABLE, T_WALL_V, T_CORNER_TL, T_CORNER_BL, T_DOOR, T_WINDOW),
    },
  },
  {
    id: T_WALL_H,
    glyph: '─',
    fgKey: 'fg',
    frequency: 0,
    allowed: {
      // Top wall: nothing north (off-grid). Bottom wall: nothing south.
      // We permit both since the same tile id serves both edges; the
      // boundary pre-placement ensures wall_h never appears interior.
      n: s(T_WALL_H, T_CORNER_TL, T_CORNER_TR, T_FLOOR, T_BOOKSHELF),
      e: s(T_WALL_H, T_DOOR, T_WINDOW, T_TEE, T_CORNER_TR, T_CORNER_BR),
      s: s(T_WALL_H, T_CORNER_BL, T_CORNER_BR, T_FLOOR, T_BOOKSHELF),
      w: s(T_WALL_H, T_DOOR, T_WINDOW, T_TEE, T_CORNER_TL, T_CORNER_BL),
    },
  },
  {
    id: T_WALL_V,
    glyph: '│',
    fgKey: 'fg',
    frequency: 0,
    allowed: {
      n: s(T_WALL_V, T_CORNER_TL, T_CORNER_TR, T_WINDOW),
      e: s(T_WALL_V, T_FLOOR, T_BOOKSHELF, T_CORNER_TR, T_CORNER_BR),
      s: s(T_WALL_V, T_CORNER_BL, T_CORNER_BR, T_WINDOW),
      w: s(T_WALL_V, T_FLOOR, T_BOOKSHELF, T_CORNER_TL, T_CORNER_BL),
    },
  },
  {
    id: T_CORNER_TL,
    glyph: '┌',
    fgKey: 'fg',
    frequency: 0,
    // Top-left: nothing N or W (off-grid), wall_h to E, wall_v to S.
    allowed: { n: s(), e: s(T_WALL_H), s: s(T_WALL_V), w: s() },
  },
  {
    id: T_CORNER_TR,
    glyph: '┐',
    fgKey: 'fg',
    frequency: 0,
    // Top-right: nothing N or E, wall_h to W, wall_v to S.
    allowed: { n: s(), e: s(), s: s(T_WALL_V), w: s(T_WALL_H) },
  },
  {
    id: T_CORNER_BL,
    glyph: '└',
    fgKey: 'fg',
    frequency: 0,
    // Bottom-left: nothing S or W, wall_h to E, wall_v to N.
    allowed: { n: s(T_WALL_V), e: s(T_WALL_H), s: s(), w: s() },
  },
  {
    id: T_CORNER_BR,
    glyph: '┘',
    fgKey: 'fg',
    frequency: 0,
    // Bottom-right: nothing S or E, wall_h to W, wall_v to N.
    allowed: { n: s(T_WALL_V), e: s(), s: s(), w: s(T_WALL_H) },
  },
  {
    id: T_TEE,
    glyph: '┴',
    fgKey: 'fg',
    frequency: 0,
    // Tee variant: reserved for future door framing. Not actively used.
    allowed: {
      n: s(T_WALL_V, T_DOOR, T_FLOOR),
      e: s(T_WALL_H, T_CORNER_TR, T_CORNER_BR),
      s: s(T_FLOOR, T_BOOKSHELF),
      w: s(T_WALL_H, T_CORNER_TL, T_CORNER_BL),
    },
  },
  {
    id: T_BOOKSHELF,
    glyph: '▓',
    fgKey: 'yellow',
    frequency: 8,
    allowed: {
      // Bookshelves cluster east-west into rows; north/south permits
      // floor / wall for backing.
      n: s(T_FLOOR, T_BOOKSHELF, T_WALL_H, T_CORNER_TL, T_CORNER_TR),
      e: s(T_FLOOR, T_BOOKSHELF, T_WALL_V, T_CORNER_TR, T_CORNER_BR),
      s: s(T_FLOOR, T_BOOKSHELF, T_WALL_H, T_CORNER_BL, T_CORNER_BR),
      w: s(T_FLOOR, T_BOOKSHELF, T_WALL_V, T_CORNER_TL, T_CORNER_BL),
    },
  },
  {
    id: T_DOOR,
    glyph: '╪',
    fgKey: 'blue', // aperture dialect (door/window/seam caps share blue) — salience campaign
    frequency: 0,
    // Door sits in a wall_h on the bottom edge. Wall sides E/W, floor
    // inside (N), off-grid outside (S).
    allowed: {
      n: s(T_FLOOR),
      e: s(T_WALL_H, T_TEE, T_CORNER_BR),
      s: s(),
      w: s(T_WALL_H, T_TEE, T_CORNER_BL),
    },
  },
  {
    id: T_WINDOW,
    glyph: '╫',
    fgKey: 'blue',
    frequency: 0,
    // Window sits on a top wall (wall_h) or vertical wall (wall_v).
    // Permit both orientations by accepting wall on opposite sides.
    allowed: {
      n: s(T_WALL_V, T_FLOOR),
      e: s(T_WALL_H, T_WALL_V, T_CORNER_TR, T_CORNER_BR),
      s: s(T_WALL_V, T_FLOOR),
      w: s(T_WALL_H, T_WALL_V, T_CORNER_TL, T_CORNER_BL),
    },
  },
  {
    id: T_TABLE,
    glyph: '▤', // ▤ (not □ — hollow squares read as tofu); quiet-decor tier
    fgKey: 'fgDim',
    frequency: 3,
    allowed: {
      // Tables sit in open floor, not adjacent to bookshelves or other
      // tables. Wall neighbours allowed (a table tucked against a wall
      // is fine).
      n: s(T_FLOOR, T_WALL_H, T_CORNER_TL, T_CORNER_TR),
      e: s(T_FLOOR, T_WALL_V, T_CORNER_TR, T_CORNER_BR),
      s: s(T_FLOOR, T_WALL_H, T_CORNER_BL, T_CORNER_BR),
      w: s(T_FLOOR, T_WALL_V, T_CORNER_TL, T_CORNER_BL),
    },
  },
];

export const LIBRARY_BIBLE: TileBible = {
  name: 'library',
  width: 24,
  height: 16,
  tiles: TILES,
  boundary: {
    cornerTL: T_CORNER_TL,
    cornerTR: T_CORNER_TR,
    cornerBL: T_CORNER_BL,
    cornerBR: T_CORNER_BR,
    edgeN: T_WALL_H,
    edgeS: T_WALL_H,
    edgeE: T_WALL_V,
    edgeW: T_WALL_V,
    door: T_DOOR,
    window: T_WINDOW,
  },
  walkable: new Set([T_FLOOR]),
};

/** Tile-id → Tile lookup. Used by WFC propagation + the renderer. */
export const TILE_BY_ID: ReadonlyMap<number, Tile> = new Map(
  TILES.map((t) => [t.id, t]),
);
