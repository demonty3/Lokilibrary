import { BitmapText, Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { CellLayout } from '../../procedural/cell';
import { TILE_BY_ID } from '../../procedural/tiles/library';
import type { Theme, ThemePalette } from '../../themes/types';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * Cell-level renderer. Builds a PIXI Container containing one BitmapText
 * per tile cell (Cozette glyph), tinted by the tile's palette key.
 * Bookshelf cells get a second-pass spine overlay using the first letter
 * of each game from `bookSpines`, in reading order; once spines run out
 * the remaining bookshelves stay as base bookshelf glyphs.
 *
 * Returns a teardown function that detaches + destroys the Container
 * (called by PixiApp's level router on scale transitions).
 *
 * The Container is centred + integer-scaled to fit the app's current
 * screen; scaling re-runs on resize so the room stays maximised + crisp
 * without antialias.
 */
export function mountCell(
  app: Application,
  theme: Theme,
  layout: CellLayout,
  bookSpines: readonly string[] = [],
): () => void {
  const container = new Container();
  app.stage.addChild(container);

  const baseLayer = new Container();
  const spineLayer = new Container();
  container.addChild(baseLayer);
  container.addChild(spineLayer);

  // Base tile layer — one BitmapText per cell.
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const tileId = layout.tiles[y][x];
      const tile = TILE_BY_ID.get(tileId);
      if (!tile) continue;
      const glyph = new BitmapText({
        text: tile.glyph,
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          fill: hexToInt(theme.palette[tile.fgKey]),
        },
      });
      glyph.x = x * COZETTE_CELL_WIDTH;
      glyph.y = y * COZETTE_CELL_HEIGHT;
      baseLayer.addChild(glyph);
    }
  }

  // Spine overlay — first character of each game name on a bookshelf
  // slot, in reading order. Tinted bright so it pops against the
  // base bookshelf glyph.
  const spineColour = hexToInt(theme.palette.fgBright);
  const usableSpines = bookSpines.slice(0, layout.bookshelfSlots.length);
  for (let i = 0; i < usableSpines.length; i++) {
    const slot = layout.bookshelfSlots[i];
    const ch = usableSpines[i].slice(0, 1).toUpperCase() || '?';
    const spine = new BitmapText({
      text: ch,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: spineColour,
      },
    });
    spine.x = slot.x * COZETTE_CELL_WIDTH;
    spine.y = slot.y * COZETTE_CELL_HEIGHT;
    spineLayer.addChild(spine);
  }

  // Center + integer-scale the container to fit the app screen.
  const fit = () => {
    const roomW = layout.width * COZETTE_CELL_WIDTH;
    const roomH = layout.height * COZETTE_CELL_HEIGHT;
    const sx = Math.floor(app.screen.width / roomW);
    const sy = Math.floor(app.screen.height / roomH);
    const scale = Math.max(1, Math.min(sx, sy));
    container.scale.set(scale);
    container.x = Math.floor((app.screen.width - roomW * scale) / 2);
    container.y = Math.floor((app.screen.height - roomH * scale) / 2);
  };
  fit();
  app.renderer.on('resize', fit);

  return () => {
    app.renderer.off('resize', fit);
    container.destroy({ children: true });
  };
}

/**
 * Sanity-check helper — verifies the theme has the slot referenced by
 * each tile's fgKey. Throws on misconfig so a tile bible that names a
 * non-existent palette slot fails loudly at level mount, not silently
 * at first tint.
 */
export function validateThemeTileCoverage(
  theme: Theme,
  tileIds: readonly number[],
): void {
  for (const id of tileIds) {
    const tile = TILE_BY_ID.get(id);
    if (!tile) continue;
    if (!(tile.fgKey in theme.palette)) {
      throw new Error(
        `[cell] theme "${theme.id}" missing palette slot "${String(tile.fgKey)}" referenced by tile ${id}`,
      );
    }
  }
}

// Re-export the type so callers don't need a second import.
export type { ThemePalette };
