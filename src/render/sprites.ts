/**
 * Phase 3A — sprite atlas loader. Reads baked pixel-art sprites from
 * `public/sprites/{theme_id}/<slot>.png` and exposes them to the cell
 * renderer as `PIXI.Texture` handles. When a sprite is present for a
 * tile, the renderer draws a `PIXI.Sprite`; when absent, it falls back
 * to the BitmapText glyph (current Phase 1 path).
 *
 * Sprites are 6×13 to match Cozette's cell dimensions — they sit in
 * the same grid as the glyph layer, scaled by the cell renderer's
 * integer fit factor. Nearest-neighbor sampling is enforced per texture
 * so they stay crisp at scale.
 *
 * Phase 3B/3C will replace the placeholder PNGs (from
 * `scripts/gen-placeholder-sprites.mts`) with model-generated sprites;
 * the directory layout + slot ids stay identical, so the renderer
 * doesn't need to change again.
 */

import { Assets, Texture } from 'pixi.js';
import {
  T_BOOKSHELF,
} from '../procedural/tiles/library';

/** Public slot ids the renderer knows about. Phase 3A: bookshelf
 *  only. Phase 3+ will add agents (loki / cat / ...) and the rest of
 *  the tile bible. */
export type SpriteSlotId = 'bookshelf';

/** Tile id → slot id. Tiles not in this map render as their BitmapText
 *  glyph. */
const TILE_TO_SLOT: ReadonlyMap<number, SpriteSlotId> = new Map([
  [T_BOOKSHELF, 'bookshelf' as const],
]);

/** All slot ids the atlas loader will try to fetch per theme. Missing
 *  PNGs are NOT errors — they just leave the slot unset and the
 *  renderer falls back. */
const KNOWN_SLOTS: readonly SpriteSlotId[] = ['bookshelf'];

export interface SpriteAtlas {
  readonly themeId: string;
  /** Slot id → Texture. Absent entries → no sprite available, fall back
   *  to glyph. */
  readonly textures: ReadonlyMap<SpriteSlotId, Texture>;
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
