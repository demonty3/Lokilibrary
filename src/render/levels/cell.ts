import { BitmapText, Container, Graphics, Sprite } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { CellLayout, CellPoint } from '../../procedural/cell';
import {
  T_BOOKSHELF,
  T_CORNER_BL,
  T_CORNER_BR,
  T_CORNER_TL,
  T_CORNER_TR,
  T_DOOR,
  T_FLOOR,
  T_TEE,
  T_WALL_H,
  T_WALL_V,
  T_WINDOW,
  TILE_BY_ID,
  SHELF_STROKE_OFFSETS_PX,
  shelfStrokeTints,
} from '../../procedural/tiles/library';
import { fnv1a32 } from '../../procedural/seed';
import type { Theme, ThemePalette } from '../../themes/types';
import { roleKey } from '../../themes/roles';
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
import { buildLibraryContext } from '../../agents/library-context';
import { launchGame } from '../../agents/launch';
import {
  createRuntimeScope,
  listRuntimesIn,
  getRuntimeIn,
} from '../../state/agentRuntime';
import { registerCellPaneScope, listCellPaneScopes } from '../../state/cellPaneScopes';
import { registerPane } from '../../state/paneRegistry';
import { COHORT } from '../../agents/cohort';
import { cellIdFor } from '../../agents/memory/schema';
import { registerStageNow, stageMissedDays } from '../../agents/events/stage';
import { dayKey } from '../../procedural/calendar';
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
import type { BookGame, CohortCrossWiring, PixelRect } from '../PixiApp';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/** Agent-mind pass — per-agent trace vocabulary. The mark's glyph + tint
 *  identify WHO left it before you read a word: Loki dog-ears, the
 *  Archivist files, the cat topples, the ghost chills, the visitor drops.
 *  Every glyph is enumerated in smoke-glyph-coverage RENDERER_LITERALS. */
const MARK_STYLES: Record<string, { glyph: string; palette: 'magenta' | 'blue' | 'yellow' | 'cyan' | 'green' }> = {
  loki: { glyph: '’', palette: 'magenta' },
  archivist: { glyph: '≡', palette: 'blue' },
  cat: { glyph: '⌐', palette: 'yellow' },
  ghost: { glyph: '°', palette: 'cyan' },
  visitor: { glyph: ',', palette: 'green' },
};
const DEFAULT_MARK_STYLE = { glyph: '·', palette: 'magenta' as const };

/** Swap books so a move's pair sits at consecutive bookshelfSlots
 *  indices: the second book moves to index(first)+1; the displaced book
 *  takes the vacated slot. Skips defensively when either appid is not
 *  currently shelved (library changed since staging) or first is the
 *  last slot. */
function applyShelfMove(
  slotToBook: Map<string, BookGame>,
  slots: readonly CellPoint[],
  move: { pair: [{ appid: number }, { appid: number }] },
): void {
  const keyOf = (p: CellPoint): string => `${p.x},${p.y}`;
  const indexOfAppid = (appid: number): number =>
    slots.findIndex((s) => slotToBook.get(keyOf(s))?.appid === appid);
  const i = indexOfAppid(move.pair[0].appid);
  const j = indexOfAppid(move.pair[1].appid);
  if (i < 0 || j < 0 || i + 1 >= slots.length || j === i + 1) return;
  const destKey = keyOf(slots[i + 1]);
  const srcKey = keyOf(slots[j]);
  const displaced = slotToBook.get(destKey);
  const moving = slotToBook.get(srcKey);
  if (!moving) return;
  slotToBook.set(destKey, moving);
  if (displaced) slotToBook.set(srcKey, displaced);
  else slotToBook.delete(srcKey);
}

/** DEV/E2E move injection (mirrors e2ePlaceMark). */
let e2eCalendarMoves: Array<{ pair: [{ appid: number }, { appid: number }] }> = [];
export function setE2ECalendarMoves(moves: typeof e2eCalendarMoves): void {
  e2eCalendarMoves = moves;
}
function getE2ECalendarMoves(): typeof e2eCalendarMoves {
  return e2eCalendarMoves;
}

/** Boxed caption for a found note, word-wrapped to `maxWidth` columns of
 *  interior text so the box fits inside rooms narrower than a single
 *  unwrapped line (rooms run ~24 tiles wide; authored notes run 40-90
 *  chars — an unwrapped line would blow straight through the room wall
 *  and off the screen). Monospace framing works because the whole
 *  surface is one bitmap font. Capped at 90 chars total before wrapping. */
function captionFor(text: string, maxWidth: number): string {
  const capped = text.length > 90 ? `${text.slice(0, 89)}…` : text;
  const width = Math.max(4, maxWidth);
  const words = capped.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (w.length > width) {
      // Hard-break: a single token wider than the interior can't fit on
      // any line, wrapped or not — flush what's pending and slice the
      // token into width-sized chunks so the box never exceeds the
      // room-width clamp (`maxWidth`).
      if (line) {
        lines.push(line);
        line = '';
      }
      let i = 0;
      while (w.length - i > width) {
        lines.push(w.slice(i, i + width));
        i += width;
      }
      line = w.slice(i);
      continue;
    }
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  const boxWidth = Math.max(...lines.map((l) => l.length));
  const bar = '═'.repeat(boxWidth + 2);
  const body = lines.map((l) => `║ ${l.padEnd(boxWidth)} ║`).join('\n');
  return `╔${bar}╗\n${body}\n╚${bar}╝`;
}

/** Agent-mind pass — Loki's launch-path notes. This path fires without
 *  an LLM (the plan write is deterministic), so the note must already
 *  be in-voice. Picked by appid so each game keeps its line. */
const LAUNCH_MARK_NOTES: ReadonlyArray<(name: string) => string> = [
  (n) => `${n.toLowerCase()} again. the shelf has a lean now.`,
  (n) => `left a dog-ear where ${n.toLowerCase()} was pulled. habit.`,
  (n) => `the ${n.toLowerCase()} spot stays warm longer than the others.`,
  (n) => `marked the gap ${n.toLowerCase()} leaves. it is a specific gap.`,
  (n) => `${n.toLowerCase()} goes out more than it comes back. noted.`,
  (n) => `dusted around ${n.toLowerCase()}. not the rest. reasons.`,
];

/** Build-gated e2e mark injection (agent-mind pass). The last-mounted
 *  cell registers its closure here; the harness drives single-pane, so
 *  last-wins is correct. Cleared at teardown. */
let e2ePlaceMark: ((x: number, y: number, agentId: string, text: string) => void) | null = null;
export function e2ePlaceMarkIn(x: number, y: number, agentId: string, text: string): boolean {
  if (!e2ePlaceMark) return false;
  e2ePlaceMark(x, y, agentId, text);
  return true;
}

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
 *
 * Whole-arc review fix — `isWholeLibraryPane` gates the events-calendar
 * staging closure (see the "Events calendar" block below). The calendar is a
 * WORLD property, not a pane property: a wing/region pane's `seed` is that
 * wing's own seed, not the profile-level world seed the ledger is keyed
 * against, so it must never register staging. PixiApp's mountPaneLevel is
 * the only caller and threads this from whether a regionId genuinely
 * resolved to a wing this mount.
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
  crossWiring?: CohortCrossWiring,
  isWholeLibraryPane = true,
  regionWingId: string | null = null,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const baseLayer = new Container();
  // Walk wear (#9): brightened floor glyphs where someone recently stood.
  // Above the floor text, below walls/spines/marks.
  const wearLayer = new Container();
  // Salience: walls/frame/apertures split out of baseLayer into their own
  // layer so the pane-focus indicator can dim the room's shell without
  // touching furniture (shelves/tables/floor stay in baseLayer, always
  // full alpha). Added right after baseLayer so the STACKING ORDER is
  // unchanged (both sit under spineLayer/scatterLayer/etc, same as the old
  // single-baseLayer wall+furniture paint). NOTE: pre-split, row-major add
  // order let a multi-cell sprite overflow OVER the wall band above it;
  // post-split, wallLayer draws over ALL of baseLayer — Phase 3D's sprite
  // bake must re-solve overflow z-order (CURATED_SLOTS is empty today, so
  // nothing renders differently yet).
  const wallLayer = new Container();
  const spineLayer = new Container();
  const scatterLayer = new Container();
  // Phase 6A: local-model landmark sits between scatter and agents in
  // Z-order so it reads as a structure (above decor) but agents/player
  // draw over it when they walk past.
  const landmarkLayer = new Container();
  const markLayer = new Container();
  const agentLayer = new Container();
  // Final-review fix — the walk-over caption reveal must draw ABOVE agents
  // (an agent sprite crossing the note tile was rendering over the caption
  // text). Mark GLYPHS stay in markLayer (agents may walk over marks); only
  // the caption + its opaque backing live here, added after agentLayer.
  const captionLayer = new Container();
  container.addChild(baseLayer);
  container.addChild(wearLayer);
  container.addChild(wallLayer);
  container.addChild(spineLayer);
  container.addChild(scatterLayer);
  container.addChild(landmarkLayer);
  container.addChild(markLayer);
  container.addChild(agentLayer);
  container.addChild(captionLayer);

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
  const unregisterScope = registerCellPaneScope(scope, regionWingId);
  // Phase 7-D — paneId-keyed registry so a NEIGHBOUR pane's cross-seam
  // perception can reach this pane's scope + interior layout by id. Separate
  // from cellPaneScopes (the sleep-sweep's paneId-less Set, untouched).
  const unregisterPane = registerPane(paneId, scope, layout);

  // Salience: wall/frame/aperture tile ids — routed to wallLayer instead
  // of baseLayer so the pane-focus indicator (wallLayer.alpha) dims only
  // the room's shell.
  const WALL_TILE_IDS = new Set([
    T_WALL_H, T_WALL_V, T_CORNER_TL, T_CORNER_TR, T_CORNER_BL, T_CORNER_BR,
    T_TEE, T_DOOR, T_WINDOW,
  ]);

  // Base tile layer — one PIXI.Sprite per cell when a sprite is baked
  // for that tile id (Phase 3A; bookshelf only today), else one
  // BitmapText glyph (current Phase 1 path). Sprite + glyph go into
  // baseLayer for furniture/floor, wallLayer for walls/frame/apertures
  // (salience pane-focus split) — Z-order vs spineLayer / scatterLayer /
  // etc. stays unchanged since wallLayer sits immediately after baseLayer.
  // Ambient-salience bundle (#10): shelf cells are composed as sub-cell
  // spine strokes AFTER the events-calendar moves land (the stroke read
  // needs the FINAL stocked/empty state) — the tile loop collects them
  // and draws nothing.
  const shelfCells: CellPoint[] = [];
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
        (WALL_TILE_IDS.has(tileId) ? wallLayer : baseLayer).addChild(sprite);
      } else if (tileId === T_BOOKSHELF) {
        shelfCells.push({ x, y });
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
        (WALL_TILE_IDS.has(tileId) ? wallLayer : baseLayer).addChild(glyph);
      }
    }
  }

  // Salience: cap carved seam openings with the aperture dialect (the
  // window's ╫ in blue) so side gaps read as doorways, not broken walls.
  // Derived from the tiles: any floor cell on column 0 / width-1 is a
  // carved opening; the wall cells immediately above/below the opening
  // run get the cap. Caps go to wallLayer (not baseLayer) so they dim
  // with the walls they cap under the pane-focus indicator.
  // Ambient-salience bundle (#9): handles for the idle registers.
  const seamCapSprites: BitmapText[] = [];
  const SWAY_PERIOD_MS = 1600;
  const swaySprites: Array<{ sprite: BitmapText; baseX: number; phaseMs: number }> = [];

  const seamCapColour = hexToInt(theme.palette[roleKey(theme, 'seam', 'blue')]);
  for (const col of [0, layout.width - 1]) {
    for (let y = 0; y < layout.height; y++) {
      const isOpen = layout.tiles[y][col] === T_FLOOR;
      const above = y > 0 ? layout.tiles[y - 1][col] : -1;
      const below = y < layout.height - 1 ? layout.tiles[y + 1][col] : -1;
      const capAbove = isOpen && above !== T_FLOOR && above !== -1;
      const capBelow = isOpen && below !== T_FLOOR && below !== -1;
      for (const [cap, cy] of [[capAbove, y - 1], [capBelow, y + 1]] as Array<[boolean, number]>) {
        if (!cap) continue;
        const capSprite = new BitmapText({
          text: '╫',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: seamCapColour },
        });
        capSprite.x = col * COZETTE_CELL_WIDTH;
        capSprite.y = cy * COZETTE_CELL_HEIGHT;
        wallLayer.addChild(capSprite);
        seamCapSprites.push(capSprite);
      }
    }
  }

  // Salience: focused pane reads bright, unfocused recedes — pure alpha,
  // no new chrome. Single pane: always focused → alpha 1 → identical to
  // today.
  const applyFocusAlpha = (): void => {
    const focused = useAppStore.getState().focusedPaneId === paneId;
    wallLayer.alpha = focused ? 1.0 : 0.55;
  };
  applyFocusAlpha();
  const unsubFocus = useAppStore.subscribe(applyFocusAlpha);

  // Base slot → BookGame assignment, in bookshelfSlots reading order.
  // The spine GLYPHS are painted later (after the events-calendar overlay
  // moves below), so a moved book's letter actually reflects the swap —
  // painting here, before the moves are applied, would bake the pre-move
  // arrangement into the BitmapText objects and the shelf would never
  // visibly reorder even though slotToBook itself is correct underneath.
  const usableBooks = books.slice(0, layout.bookshelfSlots.length);
  const slotToBook = new Map<string, BookGame>();
  for (let i = 0; i < usableBooks.length; i++) {
    const slot = layout.bookshelfSlots[i];
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
    // Foliage sways (#9): ♠ gets a 2-frame sub-pixel nudge; per-instance
    // phase from position hash so the room never moves in lockstep.
    if (item.glyph === '♠') {
      swaySprites.push({ sprite, baseX: sprite.x, phaseMs: fnv1a32(`sway:${item.x},${item.y}`) % SWAY_PERIOD_MS });
    }
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
    // Phase 7-D.2 — live cross-seam wiring (perception deps + crossing exits),
    // threaded from PixiApp which owns the live pane set. Omitted in the
    // single-pane / non-PixiApp callers ⇒ cohort falls back to the no-op deps
    // + no exits ⇒ byte-identical no-seam path.
    crossWiring,
  });

  // Events calendar (spec 2026-07-12): stage elapsed days FIRST (so a
  // note staged today renders in this very mount's marks loop below),
  // then apply active moves to the base assignment. slotForAppid
  // resolves against the BASE map — a mark anchors to where the book
  // lives before today's shuffle.
  const slotOfAppid = new Map<number, CellPoint>();
  for (const [key, book] of slotToBook) {
    const [sx, sy] = key.split(',').map(Number);
    slotOfAppid.set(book.appid, { x: sx, y: sy });
  }
  // Whole-arc review fix — only whole-library panes stage (see the
  // isWholeLibraryPane doc above `mountCell`). Because only whole-library
  // panes ever reach this branch, `seed` here IS already the profile-level
  // world seed the ledger's day-PK is keyed against — PixiApp's
  // mountPaneLevel only overwrites `seed` with a wing's own seed on the
  // branch where it also flips isWholeLibraryPane to false. Asserting that
  // invariant here (rather than re-threading a separate "world seed" param)
  // keeps the single-pane default byte-identical.
  let unregisterStageNow: () => void = () => {};
  if (isWholeLibraryPane) {
    const runStageNow = () => {
      // Facts must only ever reflect what's actually on the shelf — an
      // event targeting an unshelved book would file a ledger row + bump
      // the banner's "N things changed" count with nothing on the floor to
      // show for it (violates "mischief must be legible"). Filter the
      // store's full library down to shelved appids.
      const storeLibrary = useAppStore.getState().library;
      // Re-review Critical: no library yet (anon boot / web) → the
      // calendar waits; the profile remount stages the day properly.
      // Never stage from sample books — a real writer would burn the
      // day's global ledger slot with an invisible event.
      if (!storeLibrary || storeLibrary.length === 0) return;
      const shelvedGames = storeLibrary.filter((g) => slotOfAppid.has(g.appid));
      stageMissedDays({
        writer: memoryWriter,
        games: shelvedGames,
        profileSeed: seed,
        slotForAppid: (appid) => slotOfAppid.get(appid) ?? null,
        // World event — every live pane's cohort should perceive it, not
        // just this pane's own (closes the recorded single-cohort-fanout
        // gap). Same union-over-live-cell-panes pattern as App.tsx's
        // broadcastExternalFullscreen call.
        runtimes: listCellPaneScopes().flatMap((s) => listRuntimesIn(s)),
        now: new Date(),
      });
    };
    unregisterStageNow = registerStageNow(runStageNow);
    try {
      runStageNow(); // boot path — idempotent per day via the ledger PK (or
      // the session guard); invoke directly so mounting a new pane doesn't
      // also re-run OTHER live panes' closures via callStageNow().
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[cell] boot staging failed: ${(e as Error).message}`);
    }
  }

  // Apply active moves: pairwise swaps on the ordered slot assignment.
  // Adjacency = consecutive indices in bookshelfSlots order (spec § 3).
  const e2eMoves = getE2ECalendarMoves(); // DEV/E2E only; [] in prod
  const movesToApply = [
    ...memoryWriter.activeShelfMoves(dayKey(new Date())),
    ...e2eMoves,
  ];
  for (const move of movesToApply) {
    applyShelfMove(slotToBook, layout.bookshelfSlots, move);
  }

  // Ambient-salience bundle (#10): three '│' strokes per shelf cell at
  // ±1px height variance — books, not slabs. Deterministic per
  // (seed, cell) via fnv1a32; strokes join baseLayer (the ▓ slab's old
  // home, same Z under the spine initials).
  for (const cell of shelfCells) {
    const stocked = slotToBook.has(`${cell.x},${cell.y}`);
    const h = fnv1a32(`shelf:${seed}:${cell.x},${cell.y}`);
    const tints = shelfStrokeTints(h, stocked);
    for (let i = 0; i < 3; i++) {
      const stroke = new BitmapText({
        text: '│',
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          fill: hexToInt(theme.palette[tints[i]]),
        },
      });
      stroke.x = cell.x * COZETTE_CELL_WIDTH + SHELF_STROKE_OFFSETS_PX[i];
      stroke.y = cell.y * COZETTE_CELL_HEIGHT - ((h >>> (10 + i * 2)) % 2);
      baseLayer.addChild(stroke);
    }
  }

  // Spine overlay — first character of each (possibly moved) game name on
  // its bookshelf slot, in reading order. Tinted bright so it pops against
  // the base bookshelf glyph. Painted from the FINAL slotToBook (after the
  // moves above) so a shuffled book's spine actually shows in its new slot.
  const spineColour = hexToInt(theme.palette.fgBright);
  for (const slot of layout.bookshelfSlots) {
    const book = slotToBook.get(`${slot.x},${slot.y}`);
    if (!book) continue;
    const ch = book.name.slice(0, 1).toUpperCase() || '?';
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

  // Phase 2E marginalia: render any placed-mark glyphs from prior
  // Plans for this cell. These persist across restart because they
  // live in the SQLite memory store; the null writer just returns []
  // here so the web build is a no-op.
  const markRecords: Array<{ tileX: number; tileY: number; text: string }> = [];
  for (const mark of memoryWriter.placedMarksForCell(cellId)) {
    const style = MARK_STYLES[mark.agentId] ?? DEFAULT_MARK_STYLE;
    const markSprite = new BitmapText({
      text: style.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[style.palette]),
      },
    });
    markSprite.x = mark.location.x * COZETTE_CELL_WIDTH;
    markSprite.y = mark.location.y * COZETTE_CELL_HEIGHT;
    markLayer.addChild(markSprite);
    markRecords.push({ tileX: mark.location.x, tileY: mark.location.y, text: mark.text });
  }

  // Agent-mind pass — walking onto a mark reveals its note: the found-
  // writing surface. One caption at a time (first record wins a shared
  // tile); hidden the frame the player leaves the tile. In-canvas
  // BitmapText, no DOM — the caption is part of the world. An opaque
  // theme-bg backing rect sits UNDER the text (same key PixiApp paints
  // the app background with) so the note reads over shelves/scatter
  // instead of bleeding through them. Both live in captionLayer (added
  // after agentLayer) so the reveal draws above agent sprites, not under.
  //
  // Marginalia dialect (salience): the note's double-line frame (captionFor)
  // gets a one-cell drop shadow — a Graphics UNDER the backing, offset one
  // cell right + down — and an 'L·' corner tick in Loki's accent, so found
  // notes read as paper pinned over the world rather than engine chrome.
  // Draw order in captionLayer: shadow, backing, text, tick (added last).
  const markCaptionShadow = new Graphics();
  markCaptionShadow.visible = false;
  captionLayer.addChild(markCaptionShadow); // added FIRST → renders under backing + text
  const markCaptionBacking = new Graphics();
  markCaptionBacking.visible = false;
  captionLayer.addChild(markCaptionBacking);
  const markCaption = new BitmapText({
    text: '',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  markCaption.visible = false;
  captionLayer.addChild(markCaption);
  const markCaptionTick = new BitmapText({
    text: 'L·',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette[roleKey(theme, 'being.loki', 'magenta')]),
    },
  });
  markCaptionTick.visible = false;
  captionLayer.addChild(markCaptionTick); // added LAST → renders above backing/shadow/text
  let captionTile: string | null = null;
  const updateMarkCaption = (): void => {
    const hit = markRecords.find((m) => m.tileX === pos.x && m.tileY === pos.y);
    if (!hit) {
      if (markCaption.visible) {
        markCaption.visible = false;
        markCaptionBacking.visible = false;
        markCaptionShadow.visible = false;
        markCaptionTick.visible = false;
      }
      captionTile = null;
      return;
    }
    const key = `${hit.tileX},${hit.tileY}`;
    if (captionTile !== key) {
      // Interior text width bounded by the room itself (minus border +
      // padding columns) so the wrapped box never spills past the walls.
      const maxWidth = Math.max(8, layout.width - 4);
      markCaption.text = captionFor(hit.text, maxWidth);
      const lines = markCaption.text.split('\n');
      const boxCols = Math.max(...lines.map((l) => l.length));
      const boxRows = lines.length;
      // Above the mark, clamped on both axes so the box stays inside the room.
      const tx = Math.max(0, Math.min(hit.tileX - Math.floor(boxCols / 2), layout.width - boxCols));
      const ty = Math.max(0, Math.min(hit.tileY - boxRows - 1, layout.height - boxRows));
      markCaption.x = tx * COZETTE_CELL_WIDTH;
      markCaption.y = ty * COZETTE_CELL_HEIGHT;
      // Redraw the opaque backing to the new box's bounds + half-cell pad.
      const padX = COZETTE_CELL_WIDTH / 2;
      const padY = COZETTE_CELL_HEIGHT / 2;
      const bx = markCaption.x - padX;
      const by = markCaption.y - padY;
      const bw = boxCols * COZETTE_CELL_WIDTH + padX * 2;
      const bh = boxRows * COZETTE_CELL_HEIGHT + padY * 2;
      markCaptionBacking.clear();
      markCaptionBacking.rect(bx, by, bw, bh).fill(hexToInt(theme.palette.bg));
      // Drop shadow: same rect, one cell right + down, translucent.
      markCaptionShadow
        .clear()
        .rect(bx + COZETTE_CELL_WIDTH, by + COZETTE_CELL_HEIGHT, bw, bh)
        .fill({ color: hexToInt(theme.palette.bg), alpha: 0.6 });
      // Loki tick — bottom-right corner cell of the frame, derived from the
      // caption's own bounds (two glyph-widths in from the right edge, on
      // the bottom border row).
      markCaptionTick.x = markCaption.x + (boxCols - 2) * COZETTE_CELL_WIDTH;
      markCaptionTick.y = markCaption.y + (boxRows - 1) * COZETTE_CELL_HEIGHT;
      captionTile = key;
    }
    markCaption.visible = true;
    markCaptionBacking.visible = true;
    markCaptionShadow.visible = true;
    markCaptionTick.visible = true;
  };
  app.ticker.add(updateMarkCaption);

  // Agent-mind pass — e2e debug mark injection. See `e2ePlaceMarkIn` above;
  // this closure is what it dispatches to while this cell is mounted.
  e2ePlaceMark = (x, y, agentId, text) => {
    const style = MARK_STYLES[agentId] ?? DEFAULT_MARK_STYLE;
    const s = new BitmapText({
      text: style.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[style.palette]),
      },
    });
    s.x = x * COZETTE_CELL_WIDTH;
    s.y = y * COZETTE_CELL_HEIGHT;
    markLayer.addChild(s);
    markRecords.push({ tileX: x, tileY: y, text });
  };

  // Player avatar — `@` rendered + repositioned each frame from this pane's
  // player position (`pos`). Reset to the layout's spawn point on mount
  // (last value belonged to the previous cell for this pane id).
  setPlayerPos(paneId, layout.spawnAt.x, layout.spawnAt.y);
  const playerOn = hexToInt(theme.palette[roleKey(theme, 'player', 'fgBright')]);
  const playerOff = hexToInt(theme.palette.fgDim);
  const playerSprite = new BitmapText({
    text: '@',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: 0xffffff,
    },
  });
  playerSprite.tint = playerOn;
  playerSprite.x = pos.x * COZETTE_CELL_WIDTH;
  playerSprite.y = pos.y * COZETTE_CELL_HEIGHT;
  agentLayer.addChild(playerSprite);

  // Salience: cursor blink via phase-modulo — a coarse-tick throttle
  // (1Hz wallpaper mode: deltaMS≈1000) keeps the ~76/24 duty cycle
  // instead of inverting to 50/50 the way a toggle-on-limit would, and
  // the phase check runs fresh every tick so a resume never continues a
  // stale dim stretch. Period 1050ms = 800 on + 250 off.
  let blinkPhaseMs = 0;
  const BLINK_PERIOD_MS = 1050;
  const BLINK_ON_MS = 800;
  const blinkPlayer = (): void => {
    blinkPhaseMs = (blinkPhaseMs + app.ticker.deltaMS) % BLINK_PERIOD_MS;
    playerSprite.tint = blinkPhaseMs < BLINK_ON_MS ? playerOn : playerOff;
  };
  app.ticker.add(blinkPlayer);

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

  // Ambient-salience bundle (#9): the cell's idle registers. One ticker,
  // deltaMS-driven (freezes under paused/sleeping, no wall clock — the
  // pulseLandmark contract): seam caps breathe, foliage sways, and the
  // walk-wear trail (bundle Task 5) stamps + decays.
  let ambientMs = 0;

  // Walk wear (#9): Map of "x,y" → live mark. Stamped every ambient tick
  // from the player + each present agent runtime; decays over
  // WEAR_FADE_MS; capped (oldest evicted) so churn stays bounded.
  const WEAR_FADE_MS = 8000;
  const WEAR_CAP = 64;
  const wearMarks = new Map<string, { sprite: BitmapText; stampedAtMs: number }>();
  const wearGlyph = TILE_BY_ID.get(T_FLOOR)?.glyph ?? '·';
  const wearFill = hexToInt(theme.palette.fg); // one step up from the floor's fgDim
  const stampWear = (x: number, y: number): void => {
    if (x < 0 || y < 0 || y >= layout.height || x >= layout.width) return;
    if (layout.tiles[y][x] !== T_FLOOR) return;
    const key = `${x},${y}`;
    const existing = wearMarks.get(key);
    if (existing) {
      existing.stampedAtMs = ambientMs;
      return;
    }
    if (wearMarks.size >= WEAR_CAP) {
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      for (const [k, v] of wearMarks) {
        if (v.stampedAtMs < oldestAt) {
          oldestAt = v.stampedAtMs;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        wearMarks.get(oldestKey)!.sprite.destroy();
        wearMarks.delete(oldestKey);
      }
    }
    const sprite = new BitmapText({
      text: wearGlyph,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: wearFill },
    });
    sprite.x = x * COZETTE_CELL_WIDTH;
    sprite.y = y * COZETTE_CELL_HEIGHT;
    wearLayer.addChild(sprite);
    wearMarks.set(key, { sprite, stampedAtMs: ambientMs });
  };

  const BREATHE_PERIOD_MS = 4000;
  const ambientTick: TickerCallback<unknown> = () => {
    ambientMs += app.ticker.deltaMS;
    const bt = (ambientMs % BREATHE_PERIOD_MS) / BREATHE_PERIOD_MS;
    const breatheAlpha = 0.7 + 0.3 * (0.5 - 0.5 * Math.cos(bt * 2 * Math.PI));
    for (const cap of seamCapSprites) cap.alpha = breatheAlpha;
    for (const sw of swaySprites) {
      const local = (ambientMs + sw.phaseMs) % SWAY_PERIOD_MS;
      sw.sprite.x = sw.baseX + (local < SWAY_PERIOD_MS / 2 ? -0.5 : 0.5);
    }
    // Walk wear (#9): stamp whoever is standing, fade the trail.
    stampWear(pos.x, pos.y);
    for (const rt of listRuntimesIn(scope)) if (rt.present) stampWear(rt.x, rt.y);
    for (const [key, mark] of wearMarks) {
      const age = ambientMs - mark.stampedAtMs;
      if (age >= WEAR_FADE_MS) {
        mark.sprite.destroy();
        wearMarks.delete(key);
        continue;
      }
      mark.sprite.alpha = 0.9 * (1 - age / WEAR_FADE_MS);
    }
  };
  app.ticker.add(ambientTick);

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
      text: LAUNCH_MARK_NOTES[book.appid % LAUNCH_MARK_NOTES.length](book.name),
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
        library: buildLibraryContext(useAppStore.getState().library) ?? undefined,
        roomDims: { width: layout.width, height: layout.height },
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
      app.ticker.remove(ambientTick);
      wearMarks.clear(); // sprites die with container.destroy(children:true)
      app.ticker.remove(updateMarkCaption);
      app.ticker.remove(blinkPlayer);
      unsubFocus();
      e2ePlaceMark = null;
      unregisterStageNow();
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
