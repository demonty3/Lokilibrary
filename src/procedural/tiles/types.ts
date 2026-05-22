import type { ThemePalette } from '../../themes/types';

/**
 * Per-direction adjacency: the set of tile ids that may sit immediately
 * in that direction from this tile. North/east/south/west are screen-space
 * (north = lower y, east = higher x). Directional, not symmetric — a
 * bookshelf permits another bookshelf east/west (row clustering) but not
 * north/south (no toppling stacks), which an undirected matrix can't
 * express.
 */
export interface TileAdjacency {
  readonly n: ReadonlySet<number>;
  readonly e: ReadonlySet<number>;
  readonly s: ReadonlySet<number>;
  readonly w: ReadonlySet<number>;
}

/**
 * A tile in a WFC bible. `glyph` is the unicode codepoint rendered via
 * BitmapText; `fgKey` selects the palette slot for tinting (so themes
 * recolour without touching the bible). `frequency` weights the
 * collapsing-random pick — zero means "pre-placed only, WFC will never
 * choose this tile for an empty cell."
 */
export interface Tile {
  readonly id: number;
  readonly glyph: string;
  readonly fgKey: keyof ThemePalette;
  readonly frequency: number;
  readonly allowed: TileAdjacency;
}

/**
 * Pre-placement instructions for the bible's boundary. Each corner +
 * each edge gets a specific tile id; the WFC solver pre-collapses these
 * cells before propagation begins so the room is guaranteed bounded.
 * door + window slots are picked deterministically by `layoutCell` from
 * the seeded PRNG and slotted into the appropriate edge after the basic
 * boundary fill.
 */
export interface BoundaryPlan {
  readonly cornerTL: number;
  readonly cornerTR: number;
  readonly cornerBL: number;
  readonly cornerBR: number;
  readonly edgeN: number;
  readonly edgeS: number;
  readonly edgeE: number;
  readonly edgeW: number;
  readonly door: number;
  readonly window: number;
}

export interface TileBible {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly boundary: BoundaryPlan;
  /** Tile ids that the player avatar can walk through (collision = false). */
  readonly walkable: ReadonlySet<number>;
}

/** Tile-id sentinel for "unsolved" — must not collide with any real id. */
export const UNSOLVED = 0;
