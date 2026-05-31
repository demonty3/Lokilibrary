import { BitmapText, Container, Sprite } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { CellLayout, CellPoint } from '../../procedural/cell';
import { T_BOOKSHELF, T_FLOOR, TILE_BY_ID } from '../../procedural/tiles/library';
import type { Theme, ThemePalette } from '../../themes/types';
import { getPlayerPos, setPlayerPos, clearPlayerPos } from '../../state/playerPos';
import { useAppStore } from '../../state/store';
import { pickLokiSpawn } from '../../agents/loki';
import { mountCohort } from '../agents/cohort';
import { scatterDecor } from '../../procedural/scatter';
import { getCurrentMemoryWriter } from '../../agents/memory/bootstrap';
import { buildLoreProfile } from '../../agents/lore-profile';
import { displaySizeForTile, textureForTile, type SpriteAtlas } from '../sprites';
import {
  broadcastGameLaunched,
  nullMemoryWriter,
  routeTier2,
  type MemoryWriter,
} from '../../agents/router';
import { launchGame } from '../../agents/launch';
import {
  createRuntimeScope,
  listRuntimesIn,
  getRuntimeIn,
} from '../../state/agentRuntime';
import { registerCellPaneScope } from '../../state/cellPaneScopes';
import { registerPane } from '../../state/paneRegistry';
import { COHORT } from '../../agents/cohort';
import { cellIdFor } from '../../agents/memory/schema';
import {
  mountBookshelfPrompt,
  mountLocalModelStatus,
  type BookshelfPromptHandle,
  type StatusPanelHandle,
} from '../overlays/bookshelfPrompt';
import {
  formatLocalModelStatus,
  landmarkGlyphFor,
  landmarkVariantFor,
  pickLandmarkCell,
  pickLandmarkModel,
  LANDMARK_FG_KEY,
} from '../../procedural/localLandmark';
import { NO_LOCAL_MODEL, type LocalModelResult } from '../../api/localModel';
import type { BookGame, PixelRect } from '../PixiApp';
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
 *   - `@` player avatar (bright tint), positioned each frame from this
 *     pane's player position (`getPlayerPos(paneId)`, captured once as
 *     `pos`). WASD / arrow keys move one cell per ~100ms keypress,
 *     collision-checked against the WFC grid (floor-only is walkable).
 *   - The Phase 2B agent cohort: 5 BitmapText sprites managed by
 *     `mountCohort()`. Each runs a Tier-0 utility-AI BT
 *     (`src/agents/behavior.ts`) — no LLM calls in this slice. Tier 1
 *     dispatch lands in 2C; Tier 2 reflection in 2D.
 *
 * Returns `{teardown, refit}`. `teardown` detaches + destroys the Container,
 * removes the keydown listener, and unregisters Tickers (called by PixiApp's
 * pane router on level/pane transitions). `refit` re-fits to a new pixel rect
 * on resize (PixiApp owns the resize listener now — one app-level listener
 * drives every pane's refit).
 *
 * Phase 7-B — pane-scoped. Adds its Container to `parent` (a per-pane root,
 * NOT app.stage) and fits within `rect` (pixel rect, local origin) instead of
 * the full screen. `paneId` gates input: the window keydown handler consumes
 * movement/E ONLY when `useAppStore.getState().focusedPaneId === paneId`, so
 * input routes to the focused cell pane only. The listener itself is still
 * added once at mount + removed at teardown (no per-pane add/remove) — the
 * focused-pane guard inside the handler is the whole gate. With the default
 * single 'root' pane, focusedPaneId === paneId always ⇒ behaviour identical to
 * the pre-7-B path.
 */
export function mountCell(
  app: Application,
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  layout: CellLayout,
  books: readonly BookGame[] = [],
  seed = 0,
  memoryWriter: MemoryWriter = nullMemoryWriter,
  spriteAtlas: SpriteAtlas | null = null,
  localModel: LocalModelResult = NO_LOCAL_MODEL,
  paneId = 'root',
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const baseLayer = new Container();
  const spineLayer = new Container();
  const scatterLayer = new Container();
  // Phase 6A: local-model landmark sits between scatter and agents in
  // Z-order so it reads as a structure (above decor) but agents/player
  // draw over it when they walk past.
  const landmarkLayer = new Container();
  const markLayer = new Container();
  const agentLayer = new Container();
  container.addChild(baseLayer);
  container.addChild(spineLayer);
  container.addChild(scatterLayer);
  container.addChild(landmarkLayer);
  container.addChild(markLayer);
  container.addChild(agentLayer);

  // Phase 2E: cell-level namespace for memory writes/reads — same hash
  // the writer uses, so placedMarks written last session land here on
  // mount this session.
  const cellId = cellIdFor(seed);

  // Phase 7 / v2.x — this pane's volatile state. `pos` is the pane's stable
  // mutable player-position object (captured ONCE; mutated at frame rate).
  // `scope` is the pane's runtime + perception map (its own cohort). Both
  // default to the 'root' pane when paneId is unspecified ⇒ single-pane
  // behaviour is byte-identical. The scope registers with the cell-pane
  // registry so the sleep-reflection sweep unions over every live cell pane;
  // teardown unregisters + clears all three pane-local stores.
  const pos = getPlayerPos(paneId);
  const scope = createRuntimeScope();
  const unregisterScope = registerCellPaneScope(scope);
  // Phase 7-D — paneId-keyed registry so a NEIGHBOUR pane's cross-seam
  // perception can reach this pane's scope + interior layout by id. Separate
  // from cellPaneScopes (the sleep-sweep's paneId-less Set, untouched).
  const unregisterPane = registerPane(paneId, scope, layout);

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
  // Phase 5D: lore reweights decor frequency (computed locally; never
  // egresses). Null writer (web build) or empty corpus → undefined → no
  // dominant themes → byte-identical to pre-5D scatter.
  const loreWriter = getCurrentMemoryWriter();
  const loreProfile = loreWriter ? buildLoreProfile(loreWriter) : undefined;
  const scatterItems = scatterDecor(seed, layout, [lokiSpawn], loreProfile);
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

  // Phase 6A: local-model landmark — "Local AI lives in your world" Depth 1.
  // If a local Ollama model is present, place ONE deterministic landmark
  // glyph on a free floor cell (cottage for a small model, tower for a
  // large one) and glow it when a model is loaded. Placement is seeded +
  // keepout-aware (Loki's spawn + every scatter cell) so it never overlaps
  // decor or the agent at boot; the cell only depends on (seed, layout,
  // keepouts) — the live model state never feeds the PRNG. present:false
  // (cloud / no Ollama / web build) → no landmark, no glow, no E-status.
  const landmarkModel = pickLandmarkModel(localModel);
  let landmarkCell: CellPoint | null = null;
  let landmarkSprite: BitmapText | null = null;
  let landmarkRunning = false;
  if (landmarkModel) {
    const scatterCells: CellPoint[] = scatterItems.map((i) => ({ x: i.x, y: i.y }));
    landmarkCell = pickLandmarkCell(layout, seed, [lokiSpawn, ...scatterCells]);
    landmarkRunning = localModel.present ? localModel.running : false;
    const variant = landmarkVariantFor(landmarkModel);
    landmarkSprite = new BitmapText({
      text: landmarkGlyphFor(variant),
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[LANDMARK_FG_KEY]),
      },
    });
    landmarkSprite.x = landmarkCell.x * COZETTE_CELL_WIDTH;
    landmarkSprite.y = landmarkCell.y * COZETTE_CELL_HEIGHT;
    landmarkLayer.addChild(landmarkSprite);
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
    paneId,
    scope,
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

  // Player avatar — `@` rendered + repositioned each frame from this pane's
  // player position (`pos`). Reset to the layout's spawn point on mount
  // (last value belonged to the previous cell for this pane id).
  setPlayerPos(paneId, layout.spawnAt.x, layout.spawnAt.y);
  const playerSprite = new BitmapText({
    text: '@',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  playerSprite.x = pos.x * COZETTE_CELL_WIDTH;
  playerSprite.y = pos.y * COZETTE_CELL_HEIGHT;
  agentLayer.addChild(playerSprite);

  // Bookshelf prompt — spawned when the player walks adjacent to a
  // known-game shelf and despawned when they step away. Single handle
  // at a time; switching shelves destroys the old prompt + builds a new.
  let promptHandle: BookshelfPromptHandle | null = null;

  // Phase 6A: local-model status panel — spawned on E when the player is
  // adjacent to the landmark (and no launchable shelf takes precedence).
  // Auto-despawns when the player steps away from the landmark, matching
  // the bookshelf prompt's proximity contract.
  let statusHandle: StatusPanelHandle | null = null;

  /** True when the player stands within Chebyshev-1 of the landmark cell. */
  function isAdjacentToLandmark(): boolean {
    if (!landmarkCell) return false;
    const dx = Math.abs(pos.x - landmarkCell.x);
    const dy = Math.abs(pos.y - landmarkCell.y);
    return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
  }

  function nearestAdjacentBookshelf(): { slot: CellPoint; book: BookGame } | null {
    // Check each of the 8 Chebyshev-1 neighbours + the player tile itself.
    // (The shelf itself isn't walkable, so the player can't be ON one;
    // we still loop dx=0,dy=0 for code symmetry, the slotToBook lookup
    // will miss for a non-shelf cell.)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
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
    const px = pos.x * COZETTE_CELL_WIDTH;
    const py = pos.y * COZETTE_CELL_HEIGHT;
    if (playerSprite.x !== px) playerSprite.x = px;
    if (playerSprite.y !== py) playerSprite.y = py;

    // Phase 6A: despawn the local-model status panel once the player steps
    // out of the landmark's neighbourhood (matches the bookshelf prompt's
    // step-away contract).
    if (statusHandle && !isAdjacentToLandmark()) {
      statusHandle.destroy();
      statusHandle = null;
    }

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

  // Phase 6A: landmark glow. A gentle alpha pulse ONLY while the local
  // model is loaded (`running`); a steady, un-pulsed glyph otherwise. Driven
  // off ticker deltaMS (NOT Date.now/performance.now) so the pulse FREEZES
  // automatically under the 'paused'/'sleeping' throttle states (PixiApp
  // stops the ticker) and never logically advances while stopped — staying
  // correct on resume AND honouring the no-wall-clock spirit. This is
  // render-only (outside src/procedural), so the determinism contract is
  // untouched (CLAUDE.md explicitly encourages sub-character animation here).
  let pulsePhase = 0;
  const PULSE_PERIOD_MS = 1400; // full bright↔dim cycle
  const pulseLandmark: TickerCallback<unknown> = () => {
    if (!landmarkSprite) return;
    if (!landmarkRunning) {
      if (landmarkSprite.alpha !== 1) landmarkSprite.alpha = 1;
      return;
    }
    pulsePhase = (pulsePhase + app.ticker.deltaMS) % PULSE_PERIOD_MS;
    const t = pulsePhase / PULSE_PERIOD_MS; // 0..1
    // Sine ease between 0.55 and 1.0 alpha — visibly "alive" but not flashy.
    const a = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI));
    landmarkSprite.alpha = a;
  };
  app.ticker.add(pulseLandmark);

  // Keyboard movement — debounced per-key so holding doesn't teleport.
  // Wallpaper-mode gates: the wallpaper layer should not consume input.
  const MOVE_DEBOUNCE_MS = 100;
  const LAUNCH_DEBOUNCE_MS = 1500; // Steam dialog takes a moment; suppress repeats.
  const lastMove = new Map<string, number>();
  let lastLaunchAt = 0;
  const onKeydown = (e: KeyboardEvent) => {
    if (useAppStore.getState().wallpaperMode) return;
    // Phase 7-B — only the FOCUSED cell pane consumes movement/E. A
    // non-focused cell pane keeps its listener attached but ignores input
    // (the single guard, not listener add/remove, is the gate). With the
    // default single 'root' pane this is always true ⇒ unchanged behaviour.
    if (useAppStore.getState().focusedPaneId !== paneId) return;
    // Bookshelf launch — only fires when prompt is currently shown.
    if (e.key.toLowerCase() === 'e') {
      const target = nearestAdjacentBookshelf();
      if (target) {
        // Bookshelf-launch takes precedence over the landmark status when
        // the player is adjacent to both (preserves the shipped E behaviour).
        const now = performance.now();
        if (now - lastLaunchAt < LAUNCH_DEBOUNCE_MS) return;
        lastLaunchAt = now;
        e.preventDefault();
        void handleLaunch(target.slot, target.book);
        return;
      }
      // Phase 6A: no shelf in reach — if adjacent to the local-model
      // landmark, toggle the diegetic status panel. Presence + status only,
      // never a chatbot (CLAUDE.md).
      if (landmarkModel && landmarkCell && isAdjacentToLandmark()) {
        e.preventDefault();
        if (statusHandle) {
          statusHandle.destroy();
          statusHandle = null;
        } else {
          statusHandle = mountLocalModelStatus({
            parent: landmarkLayer,
            theme,
            anchor: landmarkCell,
            text: formatLocalModelStatus(landmarkModel, landmarkRunning),
          });
        }
      }
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
    const tx = pos.x + dx;
    const ty = pos.y + dy;
    if (tx < 0 || tx >= layout.width || ty < 0 || ty >= layout.height) return;
    if (layout.tiles[ty][tx] !== T_FLOOR) return;
    setPlayerPos(paneId, tx, ty);
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
          location: { x: pos.x, y: pos.y },
          status: 'pending',
        },
      ],
      status: 'active',
      importance: 6,
    });

    // Broadcast to every present agent in THIS pane — game launch is a
    // world event for the pane the user E-pressed in.
    broadcastGameLaunched(listRuntimesIn(scope), {
      appid: book.appid,
      name: book.name,
      at: slot,
      when: ev.when,
    });

    // Force-fire Loki's Tier 2 (direct user action override).
    const lokiDef = COHORT.find((d) => d.id === 'loki');
    const lokiRuntime = getRuntimeIn(scope, 'loki');
    if (lokiDef && lokiRuntime) {
      void routeTier2(lokiDef, lokiRuntime, performance.now(), {
        memory: memoryWriter,
        force: true,
        loreEnabled: useAppStore.getState().loreEnabled,
        loreQuote: useAppStore.getState().loreQuoteEnabled,
      });
    }
  }

  // Center + integer-scale the container to fit the pane rect (local origin).
  // Phase 7-B: PixiApp owns the resize listener now and calls the returned
  // `refit` with the recomputed pixel rect; with a single full-grid pane the
  // rect === full screen so the fit output is identical to the pre-7-B path.
  const fit = (r: PixelRect) => {
    const roomW = layout.width * COZETTE_CELL_WIDTH;
    const roomH = layout.height * COZETTE_CELL_HEIGHT;
    const sx = Math.floor(r.pw / roomW);
    const sy = Math.floor(r.ph / roomH);
    const scale = Math.max(1, Math.min(sx, sy));
    container.scale.set(scale);
    container.x = Math.floor((r.pw - roomW * scale) / 2);
    container.y = Math.floor((r.ph - roomH * scale) / 2);
  };
  fit(rect);

  return {
    refit: fit,
    teardown: () => {
      window.removeEventListener('keydown', onKeydown);
      app.ticker.remove(positionPlayer);
      app.ticker.remove(pulseLandmark);
      if (promptHandle) {
        promptHandle.destroy();
        promptHandle = null;
      }
      if (statusHandle) {
        statusHandle.destroy();
        statusHandle = null;
      }
      teardownCohort();
      // Phase 7 / v2.x — reclaim this pane's volatile state so a reused pane
      // id never inherits stale player/runtime/perception. teardownCohort
      // already cleared the scope's runtime + perception caches; unregister
      // it from the cell-pane registry + drop the player position entry.
      unregisterScope();
      unregisterPane();
      clearPlayerPos(paneId);
      container.destroy({ children: true });
    },
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
