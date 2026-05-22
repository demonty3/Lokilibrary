import { BitmapText, Container } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { CellLayout } from '../../procedural/cell';
import { T_FLOOR, TILE_BY_ID } from '../../procedural/tiles/library';
import type { Theme, ThemePalette } from '../../themes/types';
import { playerPosition, setPlayerPosition } from '../../state/playerPos';
import { useAppStore } from '../../state/store';
import { mountLoki, pickLokiSpawn } from '../../agents/loki';
import { scatterDecor } from '../../procedural/scatter';
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
 * Adds two interactive sprites:
 *   - `@` player avatar (bright tint), positioned each frame from the
 *     module-local `playerPosition` singleton. WASD / arrow keys move
 *     one cell per ~100ms keypress, collision-checked against the WFC
 *     grid (floor-only is walkable).
 *   - `L` Loki test sprite (magenta tint), random-walks the floor every
 *     400ms via a seeded PRNG. No LLM call — Tier 1 agent dialogue is
 *     Phase 2 work.
 *
 * Returns a teardown function that detaches + destroys the Container,
 * removes the keydown listener, and unregisters Tickers (called by
 * PixiApp's level router on scale transitions).
 */
export function mountCell(
  app: Application,
  theme: Theme,
  layout: CellLayout,
  bookSpines: readonly string[] = [],
  seed = 0,
): () => void {
  const container = new Container();
  app.stage.addChild(container);

  const baseLayer = new Container();
  const spineLayer = new Container();
  const scatterLayer = new Container();
  const agentLayer = new Container();
  container.addChild(baseLayer);
  container.addChild(spineLayer);
  container.addChild(scatterLayer);
  container.addChild(agentLayer);

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

  // Scatter — decorative chairs / plants / book stacks / lamps in
  // open floor cells. Keep Loki's spawn out of the scatter footprint
  // so the L doesn't overlap a plant at boot. Scatter does NOT block
  // movement (collision is floor-only via layout.tiles).
  const lokiSpawn = pickLokiSpawn(layout, seed);
  const scatterItems = scatterDecor(seed, layout, [lokiSpawn]);
  for (const item of scatterItems) {
    const sprite = new BitmapText({
      text: item.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[item.fgKey]),
      },
    });
    sprite.x = item.x * COZETTE_CELL_WIDTH;
    sprite.y = item.y * COZETTE_CELL_HEIGHT;
    scatterLayer.addChild(sprite);
  }

  // Loki agent — random-walk BT sprite, owns its own Ticker + teardown.
  const teardownLoki = mountLoki(app, agentLayer, theme, layout, seed);

  // Player avatar — `@` rendered + repositioned each frame from
  // playerPosition. Reset the singleton to the layout's spawn point on
  // mount (last value belonged to the previous cell).
  setPlayerPosition(layout.spawnAt.x, layout.spawnAt.y);
  const playerSprite = new BitmapText({
    text: '@',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  playerSprite.x = playerPosition.x * COZETTE_CELL_WIDTH;
  playerSprite.y = playerPosition.y * COZETTE_CELL_HEIGHT;
  agentLayer.addChild(playerSprite);

  const positionPlayer: TickerCallback<unknown> = () => {
    const px = playerPosition.x * COZETTE_CELL_WIDTH;
    const py = playerPosition.y * COZETTE_CELL_HEIGHT;
    if (playerSprite.x !== px) playerSprite.x = px;
    if (playerSprite.y !== py) playerSprite.y = py;
  };
  app.ticker.add(positionPlayer);

  // Keyboard movement — debounced per-key so holding doesn't teleport.
  // Wallpaper-mode gates: the wallpaper layer should not consume input.
  const MOVE_DEBOUNCE_MS = 100;
  const lastMove = new Map<string, number>();
  const onKeydown = (e: KeyboardEvent) => {
    if (useAppStore.getState().wallpaperMode) return;
    let dx = 0;
    let dy = 0;
    switch (e.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        dy = -1;
        break;
      case 's':
      case 'arrowdown':
        dy = 1;
        break;
      case 'a':
      case 'arrowleft':
        dx = -1;
        break;
      case 'd':
      case 'arrowright':
        dx = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const now = performance.now();
    const last = lastMove.get(e.key) ?? 0;
    if (now - last < MOVE_DEBOUNCE_MS) return;
    const tx = playerPosition.x + dx;
    const ty = playerPosition.y + dy;
    if (tx < 0 || tx >= layout.width || ty < 0 || ty >= layout.height) return;
    if (layout.tiles[ty][tx] !== T_FLOOR) return;
    setPlayerPosition(tx, ty);
    lastMove.set(e.key, now);
  };
  window.addEventListener('keydown', onKeydown);

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
    window.removeEventListener('keydown', onKeydown);
    app.ticker.remove(positionPlayer);
    teardownLoki();
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
