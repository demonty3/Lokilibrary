import { BitmapText, Container, Sprite } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { CellLayout, CellPoint } from '../../procedural/cell';
import { T_BOOKSHELF, T_FLOOR, TILE_BY_ID } from '../../procedural/tiles/library';
import type { Theme, ThemePalette } from '../../themes/types';
import { playerPosition, setPlayerPosition } from '../../state/playerPos';
import { useAppStore } from '../../state/store';
import { pickLokiSpawn } from '../../agents/loki';
import { mountCohort } from '../agents/cohort';
import { scatterDecor } from '../../procedural/scatter';
import { displaySizeForTile, textureForTile, type SpriteAtlas } from '../sprites';
import {
  broadcastGameLaunched,
  nullMemoryWriter,
  routeTier2,
  type MemoryWriter,
} from '../../agents/router';
import { launchGame } from '../../agents/launch';
import { listRuntimes, getRuntime } from '../../state/agentRuntime';
import { COHORT } from '../../agents/cohort';
import { cellIdFor } from '../../agents/memory/schema';
import { mountBookshelfPrompt, type BookshelfPromptHandle } from '../overlays/bookshelfPrompt';
import type { BookGame } from '../PixiApp';
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
 *   - The Phase 2B agent cohort: 5 BitmapText sprites managed by
 *     `mountCohort()`. Each runs a Tier-0 utility-AI BT
 *     (`src/agents/behavior.ts`) — no LLM calls in this slice. Tier 1
 *     dispatch lands in 2C; Tier 2 reflection in 2D.
 *
 * Returns a teardown function that detaches + destroys the Container,
 * removes the keydown listener, and unregisters Tickers (called by
 * PixiApp's level router on scale transitions).
 */
export function mountCell(
  app: Application,
  theme: Theme,
  layout: CellLayout,
  books: readonly BookGame[] = [],
  seed = 0,
  memoryWriter: MemoryWriter = nullMemoryWriter,
  spriteAtlas: SpriteAtlas | null = null,
): () => void {
  const container = new Container();
  app.stage.addChild(container);

  const baseLayer = new Container();
  const spineLayer = new Container();
  const scatterLayer = new Container();
  const markLayer = new Container();
  const agentLayer = new Container();
  container.addChild(baseLayer);
  container.addChild(spineLayer);
  container.addChild(scatterLayer);
  container.addChild(markLayer);
  container.addChild(agentLayer);

  // Phase 2E: cell-level namespace for memory writes/reads — same hash
  // the writer uses, so placedMarks written last session land here on
  // mount this session.
  const cellId = cellIdFor(seed);

  // Base tile layer — one PIXI.Sprite per cell when a sprite is baked
  // for that tile id (Phase 3A; bookshelf only today), else one
  // BitmapText glyph (current Phase 1 path). Sprite + glyph go into
  // the SAME baseLayer so Z-order vs spineLayer / scatterLayer / etc.
  // stays unchanged.
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const tileId = layout.tiles[y][x];
      const tile = TILE_BY_ID.get(tileId);
      if (!tile) continue;
      const texture = spriteAtlas ? textureForTile(spriteAtlas, tileId) : null;
      if (texture) {
        const sprite = new Sprite(texture);
        // Phase 3C-β: sprites can be larger than one glyph cell. The
        // PNG on disk is the slot's native size; here we set the
        // displayed size to match (1:1 nearest-neighbor — the
        // container's integer fit scale handles the final upscale).
        // Anchor bottom-center on the tile so a tall bookshelf "stands
        // on" the floor row at (x, y) and rises upward through whatever
        // cells happen to be above it (typically the wall band).
        const display = displaySizeForTile(tileId);
        sprite.width = display.width;
        sprite.height = display.height;
        sprite.x = x * COZETTE_CELL_WIDTH + (COZETTE_CELL_WIDTH - display.width) / 2;
        sprite.y = y * COZETTE_CELL_HEIGHT + COZETTE_CELL_HEIGHT - display.height;
        baseLayer.addChild(sprite);
      } else {
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
  }

  // Spine overlay — first character of each game name on a bookshelf
  // slot, in reading order. Tinted bright so it pops against the
  // base bookshelf glyph. Slot → BookGame map drives the bookshelf
  // launch prompt (slot index lines up across the spines + slots).
  const spineColour = hexToInt(theme.palette.fgBright);
  const usableBooks = books.slice(0, layout.bookshelfSlots.length);
  const slotToBook = new Map<string, BookGame>();
  for (let i = 0; i < usableBooks.length; i++) {
    const slot = layout.bookshelfSlots[i];
    const ch = usableBooks[i].name.slice(0, 1).toUpperCase() || '?';
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
    slotToBook.set(`${slot.x},${slot.y}`, usableBooks[i]);
  }

  // Scatter — decorative chairs / plants / book stacks / lamps in
  // open floor cells. Keep Loki's spawn out of the scatter footprint
  // so the L doesn't overlap a plant at boot. Scatter does NOT block
  // movement (collision is floor-only via layout.tiles).
  const lokiSpawn = pickLokiSpawn(layout, seed);
  const scatterItems = scatterDecor(seed, layout, [lokiSpawn]);
  const scatterAnchors = new Map<string, CellPoint[]>();
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
    // Index by glyph so behavior.ts can find e.g. all '☼' lamp cells
    // for Cat's `bias_idle_near_glyph` schedule rule.
    const list = scatterAnchors.get(item.glyph);
    if (list) list.push({ x: item.x, y: item.y });
    else scatterAnchors.set(item.glyph, [{ x: item.x, y: item.y }]);
  }

  // Phase 2B agent cohort — 5 sprites + Tier-0 BT. One shared Ticker
  // inside mountCohort handles all per-agent ticks.
  const teardownCohort = mountCohort({
    app,
    parent: agentLayer,
    theme,
    layout,
    seed,
    scatterAnchors,
    memoryWriter,
  });

  // Phase 2E marginalia: render any placed-mark glyphs from prior
  // Plans for this cell. These persist across restart because they
  // live in the SQLite memory store; the null writer just returns []
  // here so the web build is a no-op.
  for (const mark of memoryWriter.placedMarksForCell(cellId)) {
    const markSprite = new BitmapText({
      text: '·',
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette.magenta),
      },
    });
    markSprite.x = mark.location.x * COZETTE_CELL_WIDTH;
    markSprite.y = mark.location.y * COZETTE_CELL_HEIGHT;
    markLayer.addChild(markSprite);
  }

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

  // Bookshelf prompt — spawned when the player walks adjacent to a
  // known-game shelf and despawned when they step away. Single handle
  // at a time; switching shelves destroys the old prompt + builds a new.
  let promptHandle: BookshelfPromptHandle | null = null;

  function nearestAdjacentBookshelf(): { slot: CellPoint; book: BookGame } | null {
    // Check each of the 8 Chebyshev-1 neighbours + the player tile itself.
    // (The shelf itself isn't walkable, so the player can't be ON one;
    // we still loop dx=0,dy=0 for code symmetry, the slotToBook lookup
    // will miss for a non-shelf cell.)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = playerPosition.x + dx;
        const ny = playerPosition.y + dy;
        if (nx < 0 || nx >= layout.width || ny < 0 || ny >= layout.height) continue;
        if (layout.tiles[ny][nx] !== T_BOOKSHELF) continue;
        const book = slotToBook.get(`${nx},${ny}`);
        if (!book) continue;
        return { slot: { x: nx, y: ny }, book };
      }
    }
    return null;
  }

  const positionPlayer: TickerCallback<unknown> = () => {
    const px = playerPosition.x * COZETTE_CELL_WIDTH;
    const py = playerPosition.y * COZETTE_CELL_HEIGHT;
    if (playerSprite.x !== px) playerSprite.x = px;
    if (playerSprite.y !== py) playerSprite.y = py;

    // Refresh prompt visibility. Cheap — ≤9 grid checks per frame.
    const target = nearestAdjacentBookshelf();
    if (!target) {
      if (promptHandle) {
        promptHandle.destroy();
        promptHandle = null;
      }
      return;
    }
    if (
      promptHandle &&
      promptHandle.slot.x === target.slot.x &&
      promptHandle.slot.y === target.slot.y
    ) {
      return; // already showing the right one
    }
    if (promptHandle) promptHandle.destroy();
    promptHandle = mountBookshelfPrompt({
      parent: spineLayer,
      theme,
      slot: target.slot,
      name: target.book.name,
    });
  };
  app.ticker.add(positionPlayer);

  // Keyboard movement — debounced per-key so holding doesn't teleport.
  // Wallpaper-mode gates: the wallpaper layer should not consume input.
  const MOVE_DEBOUNCE_MS = 100;
  const LAUNCH_DEBOUNCE_MS = 1500; // Steam dialog takes a moment; suppress repeats.
  const lastMove = new Map<string, number>();
  let lastLaunchAt = 0;
  const onKeydown = (e: KeyboardEvent) => {
    if (useAppStore.getState().wallpaperMode) return;
    // Bookshelf launch — only fires when prompt is currently shown.
    if (e.key.toLowerCase() === 'e') {
      const target = nearestAdjacentBookshelf();
      if (!target) return;
      const now = performance.now();
      if (now - lastLaunchAt < LAUNCH_DEBOUNCE_MS) return;
      lastLaunchAt = now;
      e.preventDefault();
      void handleLaunch(target.slot, target.book);
      return;
    }

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

  /**
   * Bookshelf launch handler. Fires Steam + writes a deterministic
   * Loki Plan with a `place_mark` step at the player's current tile,
   * broadcasts the `game_launched` perception event to all present
   * agents, and force-fires Tier-2 reflection on Loki (CLAUDE.md
   * "Tier 2 fires only on reflection threshold or direct user action").
   *
   * The Plan write is the part that produces the persistent magenta
   * mark on next mount — it doesn't depend on the LLM response. The
   * Tier-2 reflection is a separate concurrent surface that lands in
   * the memory stream when it returns.
   */
  async function handleLaunch(slot: CellPoint, book: BookGame): Promise<void> {
    const ev = await launchGame({ appid: book.appid, name: book.name });
    // eslint-disable-next-line no-console
    console.log(
      `[cell] launch ${ev.surface} appid=${book.appid} ok=${ev.ok} name="${book.name}"`,
    );

    // Persist Loki's marginalia immediately — independent of LLM round-trip.
    memoryWriter.recordPlan({
      agentId: 'loki',
      text: `place a small mark near the ${book.name} shelf for next time`,
      steps: [
        {
          kind: 'place_mark',
          target: `shelf:${slot.x},${slot.y}`,
          location: { x: playerPosition.x, y: playerPosition.y },
          status: 'pending',
        },
      ],
      status: 'active',
      importance: 6,
    });

    // Broadcast to every present agent — game launch is a world event.
    broadcastGameLaunched(listRuntimes(), {
      appid: book.appid,
      name: book.name,
      at: slot,
      when: ev.when,
    });

    // Force-fire Loki's Tier 2 (direct user action override).
    const lokiDef = COHORT.find((d) => d.id === 'loki');
    const lokiRuntime = getRuntime('loki');
    if (lokiDef && lokiRuntime) {
      void routeTier2(lokiDef, lokiRuntime, performance.now(), {
        memory: memoryWriter,
        force: true,
      });
    }
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
    window.removeEventListener('keydown', onKeydown);
    app.ticker.remove(positionPlayer);
    if (promptHandle) {
      promptHandle.destroy();
      promptHandle = null;
    }
    teardownCohort();
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
