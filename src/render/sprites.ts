/**
 * Phase 3A — sprite atlas loader. Reads baked pixel-art sprites from
 * `public/sprites/{theme_id}/<slot>.png` and exposes them to the cell
 * renderer as `PIXI.Texture` handles. When a sprite is present for a
 * tile, the renderer draws a `PIXI.Sprite`; when absent, it falls back
 * to the BitmapText glyph (current Phase 1 path).
 *
 * Most slots are 6×13 native, matching Cozette's cell dimensions — they
 * sit in the same grid as the glyph layer, scaled by the cell renderer's
 * integer fit factor. **Phase 3C-β adds per-slot overrides** for slots
 * whose native PixelLab generation is larger than 16×16 (PixelLab's
 * minimum); those sprites render at their declared display size,
 * bottom-anchored to their tile and horizontally centered. The
 * 16×32-displayed bookshelf is the first such slot — it visually
 * overflows its 6×13 grid cell (about ±5 px horizontal, +19 px upward),
 * which reads as "tall furniture rising out of the floor row."
 *
 * Nearest-neighbor sampling is enforced per texture so they stay crisp at
 * scale.
 *
 * Phase 3D will replace the remaining placeholder PNGs (from
 * `scripts/gen-placeholder-sprites.mts`) with model-generated sprites at
 * 16×32; the directory layout + slot ids stay identical, so the renderer
 * doesn't need to change again — only the `SLOT_DISPLAY` table here.
 */

import { Assets, Texture } from 'pixi.js';
import {
  T_BOOKSHELF,
  T_CORNER_BL,
  T_CORNER_BR,
  T_CORNER_TL,
  T_CORNER_TR,
  T_DOOR,
  T_TABLE,
  T_TEE,
  T_WALL_H,
  T_WALL_V,
  T_WINDOW,
} from '../procedural/tiles/library';

/** Public slot ids the renderer knows about. Phase 3A shipped
 *  bookshelf; Phase 3B adds every tile in the library bible except
 *  floor (which stays as the `·` glyph — sprite for it would create
 *  huge bind churn since floor is ~70% of cells). The names match
 *  the PNG filenames under `public/sprites/{theme_id}/`. */
export type SpriteSlotId =
  | 'bookshelf'
  | 'wall-h'
  | 'wall-v'
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-bl'
  | 'corner-br'
  | 'tee'
  | 'door'
  | 'window'
  | 'table';

/** Tile id → slot id. Tiles not in this map render as their BitmapText
 *  glyph (currently just T_FLOOR). MUST stay in sync with the
 *  `LAYOUTS` registry in `scripts/gen-placeholder-sprites.mts`. */
const TILE_TO_SLOT: ReadonlyMap<number, SpriteSlotId> = new Map([
  [T_BOOKSHELF, 'bookshelf' as const],
  [T_WALL_H, 'wall-h' as const],
  [T_WALL_V, 'wall-v' as const],
  [T_CORNER_TL, 'corner-tl' as const],
  [T_CORNER_TR, 'corner-tr' as const],
  [T_CORNER_BL, 'corner-bl' as const],
  [T_CORNER_BR, 'corner-br' as const],
  [T_TEE, 'tee' as const],
  [T_DOOR, 'door' as const],
  [T_WINDOW, 'window' as const],
  [T_TABLE, 'table' as const],
]);

/** All slot ids the atlas loader will try to fetch per theme. Missing
 *  PNGs are NOT errors — they just leave the slot unset and the
 *  renderer falls back. */
const KNOWN_SLOTS: readonly SpriteSlotId[] = [
  'bookshelf',
  'wall-h',
  'wall-v',
  'corner-tl',
  'corner-tr',
  'corner-bl',
  'corner-br',
  'tee',
  'door',
  'window',
  'table',
];

export interface SpriteAtlas {
  readonly themeId: string;
  /** Slot id → Texture. Absent entries → no sprite available, fall back
   *  to glyph. */
  readonly textures: ReadonlyMap<SpriteSlotId, Texture>;
}

/** Displayed pixel size at scale 1, per slot. The cell renderer reads
 *  this when constructing the PIXI.Sprite so the sprite stays at its
 *  designed resolution regardless of the container's integer fit factor
 *  (which then upscales everything together for the final view).
 *
 *  Slots not in this table default to `DEFAULT_DISPLAY` (one glyph cell
 *  — current Phase 1/3A/3B behavior). Adding a slot here means the
 *  on-disk PNG MUST also be that size — the renderer doesn't resize. */
const DEFAULT_DISPLAY: { readonly width: number; readonly height: number } = {
  width: 6,
  height: 13,
};

const SLOT_DISPLAY: ReadonlyMap<SpriteSlotId, { readonly width: number; readonly height: number }> =
  new Map([
    // 3C-β shipped bookshelf at {16, 32} displayed — visually too big in
    // the browser (~3 cells wide × ~2.5 cells tall, stomped on adjacent
    // bookshelves and the wall band). Reverted to {6, 13} = the glyph
    // cell, matching 3A/3B's behavior. The on-disk PNG stays 16×32 so
    // when a real PixelLab bake lands the native source is preserved;
    // PixiJS nearest-neighbor downsamples to 6×13 at render time. Lossy
    // for fine pixel-art detail (0.375× per axis is not an integer
    // downsample) — when the real art is ready we either: (a) bake-time
    // downsample to 6×13 via pngjs/sharp, or (b) bump the glyph cell
    // size globally so the displayed sprite cell has integer room for
    // 16×32 native, or (c) cluster bookshelves at the WFC layer so a
    // multi-tile sprite has a coherent footprint.
  ]);

/** Width × height in display pixels (at container scale 1) the renderer
 *  should draw this slot at. Exposed for the smoke + cell.ts. */
export function displaySizeForSlot(slot: SpriteSlotId): {
  readonly width: number;
  readonly height: number;
} {
  return SLOT_DISPLAY.get(slot) ?? DEFAULT_DISPLAY;
}

/** Convenience: width × height for a tile id. Returns the default cell
 *  size for tiles that don't map to a sprite slot — caller will be
 *  rendering a glyph in that case anyway. */
export function displaySizeForTile(tileId: number): {
  readonly width: number;
  readonly height: number;
} {
  const slot = TILE_TO_SLOT.get(tileId);
  return slot ? displaySizeForSlot(slot) : DEFAULT_DISPLAY;
}

/** Per-theme memo so theme swaps don't re-fetch already-loaded PNGs. */
const cache = new Map<string, Promise<SpriteAtlas>>();

/**
 * Load every known sprite for a theme. Concurrent calls for the same
 * theme share the same in-flight promise; failed loads for individual
 * slots are absorbed (the slot is just absent from the result).
 *
 * Called from PixiApp before each cell mount — cheap on subsequent
 * calls because of the cache.
 */
export function loadSpriteAtlas(themeId: string): Promise<SpriteAtlas> {
  const cached = cache.get(themeId);
  if (cached) return cached;
  const p = (async (): Promise<SpriteAtlas> => {
    const textures = new Map<SpriteSlotId, Texture>();
    await Promise.all(
      KNOWN_SLOTS.map(async (slot) => {
        const url = spriteUrl(themeId, slot);
        try {
          const tex = (await Assets.load(url)) as Texture;
          // Crisp pixel-art: nearest-neighbor on upscale. v8 sets the
          // sampling mode on the underlying TextureSource.
          tex.source.scaleMode = 'nearest';
          textures.set(slot, tex);
        } catch {
          // Missing or unreadable — leave the slot unset; renderer
          // falls back to BitmapText.
        }
      }),
    );
    return { themeId, textures };
  })();
  cache.set(themeId, p);
  return p;
}

/** URL Vite serves the sprite at. `public/` is the static root. */
export function spriteUrl(themeId: string, slot: SpriteSlotId): string {
  return `/sprites/${themeId}/${slot}.png`;
}

/** Resolve a tile id to its texture in the given atlas. Returns null
 *  when the tile has no sprite slot OR the sprite failed to load — the
 *  caller draws the BitmapText glyph instead. */
export function textureForTile(
  atlas: SpriteAtlas,
  tileId: number,
): Texture | null {
  const slot = TILE_TO_SLOT.get(tileId);
  if (!slot) return null;
  return atlas.textures.get(slot) ?? null;
}

/** Drop the cache. Useful for tests + dev-time sprite hot-reload. */
export function resetSpriteAtlasCache(): void {
  cache.clear();
}

/** Pure, dep-free predicate used by the smoke test: would the renderer
 *  attempt a sprite for this tile id? Same logic as textureForTile but
 *  doesn't need a loaded atlas. */
export function tileHasSpriteSlot(tileId: number): boolean {
  return TILE_TO_SLOT.has(tileId);
}

/** Expose the slot mapping for tests / debugging. */
export const TILE_TO_SLOT_VIEW: ReadonlyMap<number, SpriteSlotId> = TILE_TO_SLOT;
