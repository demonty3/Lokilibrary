import { Application, Container, Graphics } from 'pixi.js';
import type { Theme } from '../themes/types';
import type { PaneDescriptor, PaneRect, Profile, ScaleLevel } from '../types';
import { layoutCell } from '../procedural/cell';
import { profileSeed } from '../procedural/seed';
import { useAppStore } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { mountCell } from './levels/cell';
import { mountDistrict } from './levels/district';
import { mountIsland } from './levels/island';
import { mountContinent } from './levels/continent';
import { mountStubLevel } from './levels/stub';
import { clusterLibrary, type ClusterGame } from '../procedural/clusters';
import { mountTelemetryOverlay } from './overlays/telemetry';
import { BitmapText } from 'pixi.js';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
  waitForCozette,
} from './fonts';
import { loadSpriteAtlas, type SpriteAtlas } from './sprites';
import { getLocalModel, NO_LOCAL_MODEL, type LocalModelResult } from '../api/localModel';
import { nullMemoryWriter, type MemoryWriter } from '../agents/router';
import {
  getCurrentMemoryWriter,
  namespaceFor,
  rebuildNamespaceSync,
} from '../agents/memory/bootstrap';

export interface BookGame {
  appid: number;
  name: string;
}

/**
 * Phase 7-B — a pane's resolved PIXEL rectangle in app.screen space. Computed
 * by `computePixelRect` from the pane's grid-cell {@link PaneRect} against the
 * live screen size. The level renderers fit their content to {pw, ph} in their
 * OWN local space (origin 0,0) — the per-pane root Container carries the {px,
 * py} translate. Exported so the level renderers can import it without
 * importing the store (no cycle).
 */
export interface PixelRect {
  /** Pixel x of the pane's top-left, in app.screen space. */
  px: number;
  /** Pixel y of the pane's top-left. */
  py: number;
  /** Pixel width of the pane. */
  pw: number;
  /** Pixel height of the pane. */
  ph: number;
}

/** Box-drawing seam glyphs (Phase 7-B) — pure decoration drawn where panes
 *  abut. NO semantics, NO crossing. Cozette-covered (glyph-coverage smoke). */
const SEAM_GLYPHS = {
  vertical: '│', // │
  horizontal: '─', // ─
  cross: '┼', // ┼
  teeRight: '├', // ├
  teeLeft: '┤', // ┤
  teeDown: '┬', // ┬
  teeUp: '┴', // ┴
} as const;

/**
 * Phase 7-B — map a grid-cell PaneRect onto a pixel rectangle against the live
 * screen size. Pure + integer-floored (so seams land on whole pixels). With a
 * 1×1 grid and a full-grid rect this returns {0, 0, screenW, screenH} —
 * IDENTICAL to the pre-7-B single-level fit input, the back-compat anchor.
 */
export function computePixelRect(
  rect: PaneRect,
  gridCols: number,
  gridRows: number,
  screenW: number,
  screenH: number,
): PixelRect {
  const cellW = screenW / Math.max(1, gridCols);
  const cellH = screenH / Math.max(1, gridRows);
  const px = Math.floor(rect.col * cellW);
  const py = Math.floor(rect.row * cellH);
  // Right/bottom edges are floored to the next cell boundary so adjacent
  // panes share an exact seam with no 1px gap or overlap.
  const right = Math.floor((rect.col + rect.cols) * cellW);
  const bottom = Math.floor((rect.row + rect.rows) * cellH);
  return { px, py, pw: right - px, ph: bottom - py };
}

/** True when a pane covers the whole composition grid — the single-pane case.
 *  The render path skips the clip mask + the {0,0} translate is a no-op, so
 *  the result is byte-identical to the pre-7-B single-Container path. */
function isFullGrid(rect: PaneRect, gridCols: number, gridRows: number): boolean {
  return rect.col === 0 && rect.row === 0 && rect.cols === gridCols && rect.rows === gridRows;
}

/** A live pane entry in the router Map. */
interface LivePane {
  paneRoot: Container;
  mask: Graphics | null;
  teardown: () => void;
  refit: (rect: PixelRect) => void;
  /** The grid-cell rect (for resize recompute + change detection). */
  rect: PaneRect;
  level: ScaleLevel;
}

/** Seam line colour — the theme's dim foreground, so seams read as quiet
 *  terminal chrome (ONE palette per scene, CLAUDE.md). */
function hexToSeamColor(theme: Theme): number {
  return hexToInt(theme.palette.fgDim);
}

/**
 * Phase 7-B — overlay a box-drawing junction glyph (┼/├/┤/┬/┴) at each
 * INTERIOR grid intersection. The vertical/horizontal seam runs themselves are
 * drawn as Graphics strokes (drawSeams); these glyphs mark the corners with
 * the recognisable terminal vocabulary. Pure decoration; tinted to match the
 * seam lines. A grid intersection is interior when it is strictly inside the
 * screen (not on the outer border).
 */
function drawSeamGlyphs(
  layer: Container,
  theme: Theme,
  gridCols: number,
  gridRows: number,
  screenW: number,
  screenH: number,
): void {
  if (gridCols <= 1 && gridRows <= 1) return;
  const cellW = screenW / Math.max(1, gridCols);
  const cellH = screenH / Math.max(1, gridRows);
  const fill = hexToInt(theme.palette.fgDim);
  for (let c = 0; c <= gridCols; c++) {
    for (let r = 0; r <= gridRows; r++) {
      const interiorX = c > 0 && c < gridCols;
      const interiorY = r > 0 && r < gridRows;
      // Only mark true interior intersections (both axes internal) → ┼, and
      // the T-junctions where an internal seam meets the outer border.
      let glyph: string | null = null;
      if (interiorX && interiorY) glyph = SEAM_GLYPHS.cross;
      else if (interiorX && r === 0) glyph = SEAM_GLYPHS.teeDown;
      else if (interiorX && r === gridRows) glyph = SEAM_GLYPHS.teeUp;
      else if (interiorY && c === 0) glyph = SEAM_GLYPHS.teeRight;
      else if (interiorY && c === gridCols) glyph = SEAM_GLYPHS.teeLeft;
      if (!glyph) continue;
      const gx = Math.floor(c * cellW);
      const gy = Math.floor(r * cellH);
      const node = new BitmapText({
        text: glyph,
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          fill,
        },
      });
      // Center the glyph on the intersection point.
      node.x = gx - COZETTE_CELL_WIDTH / 2;
      node.y = gy - COZETTE_CELL_HEIGHT / 2;
      layer.addChild(node);
    }
  }
}

/** Phase 5B — module-local ref published by mountPalace so other
 *  modules (notably the morning-dispatch overlay triggered from
 *  App.tsx's throttle subscription) can grab the live PIXI Application
 *  + theme without having to thread them through React props /
 *  context. Cleared by mountPalace's returned teardown. Null when
 *  mountPalace hasn't run yet or has torn down. */
let currentRenderContext: { app: Application; theme: Theme } | null = null;
export function getCurrentRenderContext(): { app: Application; theme: Theme } | null {
  return currentRenderContext;
}

/**
 * Phase 1D PixiJS bootstrap + level router. Creates the PIXI.Application
 * once, awaits Cozette, mounts the level matching the Zustand `scale`
 * slice, and subscribes to slice changes to tear down + remount on
 * transition. **The Application stays alive across level changes**
 * (CLAUDE.md rule); only the per-level Container is destroyed.
 *
 * Profile + library data is read from the Zustand store at each mount;
 * if the user is anonymous (no profile yet), we fall back to
 * SAMPLE_LIBRARY + a stable demo seed so the renderer has something to
 * draw on first boot. Slice 2G wires the profile subscription so a
 * library-load-after-auth triggers a cell remount with the new seed —
 * scale changes are no longer the only remount trigger.
 *
 * On each cell remount the writer is re-resolved via
 * `getCurrentMemoryWriter()` so the namespace rebuild in App.tsx's
 * profile effect (which calls `bootstrapMemory({rebuild:true})` with
 * the profile-derived cellId + libraryId) propagates without
 * threading the writer back through React state.
 */
export interface MountPalaceOptions {
  /** Optional memory writer — Electron path passes the DB-backed
   *  writer (slice 2F bootstrap), web build passes nothing and gets
   *  the null writer. Slice 2G reads `getCurrentMemoryWriter()` at
   *  each level mount so a later namespace rebuild picks up
   *  automatically; this initial value is the seed for the first
   *  mount before bootstrap has populated the cache. */
  memoryWriter?: MemoryWriter;
}

export async function mountPalace(
  container: HTMLDivElement,
  theme: Theme,
  options: MountPalaceOptions = {},
): Promise<() => void> {
  const app = new Application();
  await app.init({
    resizeTo: container,
    background: theme.palette.bg,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  container.appendChild(app.canvas);
  currentRenderContext = { app, theme };

  // Cozette + sprite atlas can load in parallel — both are bounded by
  // the network round-trip for static assets in public/. Phase 6A: also
  // probe the local-model presence once here (one-shot at mount — never
  // per-frame, so nothing egresses on a loop and it stays consistent with
  // the "all AI via the Worker" rule). getLocalModel resolves
  // {present:false} on any failure, so this never blocks the boot.
  const [, spriteAtlas, localModel] = await Promise.all([
    waitForCozette(),
    loadSpriteAtlas(theme.id),
    getLocalModel(),
  ]);

  const initialWriter = options.memoryWriter ?? nullMemoryWriter;
  function resolveWriter(): MemoryWriter {
    return getCurrentMemoryWriter() ?? initialWriter;
  }

  // Slice 2G: profile may have loaded during App.tsx's bootstrap + this
  // mountPalace await (auth → loadLibrary races the renderer init). If
  // so, the writer cached by App.tsx is still scoped to the anonymous
  // namespace; rebuild against the current profile before the first
  // cell mount so persona / marginalia / telemetry rows land under the
  // right (cellId, libraryId).
  {
    const initialState = useAppStore.getState();
    if (initialState.profile) {
      const seed = seedFromState(initialState.profile);
      rebuildNamespaceSync(
        namespaceFor(initialState.profile, initialState.steamId, seed),
      );
    }
  }

  // Phase 7-B — composable panes. The single `teardownLevel` is replaced by
  // a Map<paneId, LivePane>. Panes mount into a dedicated `panesLayer`
  // Container so app-level overlays (telemetry, morning-dispatch) added later
  // straight to app.stage stay ABOVE every pane regardless of split order. A
  // separate `seamLayer` above the panes draws the box-drawing border glyphs
  // where panes abut (pure decoration — no semantics, no crossing).
  const panesLayer = new Container();
  const seamLayer = new Container();
  app.stage.addChild(panesLayer);
  app.stage.addChild(seamLayer);

  const livePanes = new Map<string, LivePane>();

  /** Mount one pane: build its clipped root Container + dispatch its level. */
  function mountPane(desc: PaneDescriptor, gridCols: number, gridRows: number): void {
    const pixelRect = computePixelRect(
      desc.rect,
      gridCols,
      gridRows,
      app.screen.width,
      app.screen.height,
    );
    const paneRoot = new Container();
    paneRoot.x = pixelRect.px;
    paneRoot.y = pixelRect.py;
    panesLayer.addChild(paneRoot);

    // Clip with a Graphics stencil — UNLESS this pane covers the whole grid
    // (single-pane case): skip the mask so the render path is byte-identical
    // to the pre-7-B single-Container path (one less Graphics + no stencil
    // pass). The mask is in paneRoot-LOCAL space (origin 0,0) since paneRoot
    // already carries the rect's pixel origin.
    let mask: Graphics | null = null;
    if (!isFullGrid(desc.rect, gridCols, gridRows)) {
      mask = new Graphics();
      mask.rect(0, 0, pixelRect.pw, pixelRect.ph).fill(0xffffff);
      paneRoot.addChild(mask);
      paneRoot.mask = mask;
    }

    // The renderer fits to rect-LOCAL space (origin 0,0, size pw×ph) — paneRoot
    // carries the screen-space origin.
    const localRect: PixelRect = { px: 0, py: 0, pw: pixelRect.pw, ph: pixelRect.ph };
    const mounted = mountPaneLevel(
      app,
      paneRoot,
      localRect,
      theme,
      desc.level,
      desc.id,
      resolveWriter(),
      spriteAtlas,
      localModel,
    );

    livePanes.set(desc.id, {
      paneRoot,
      mask,
      teardown: mounted.teardown,
      refit: mounted.refit,
      rect: desc.rect,
      level: desc.level,
    });
  }

  /** Tear down + remove one live pane (level teardown first so its ticker
   *  callbacks unregister BEFORE the Container is destroyed). */
  function unmountPane(id: string): void {
    const live = livePanes.get(id);
    if (!live) return;
    live.teardown();
    // Detach the mask before destroy to avoid a dangling-mask warning.
    live.paneRoot.mask = null;
    live.paneRoot.destroy({ children: true });
    livePanes.delete(id);
  }

  /** Re-fit every live pane to the current screen size + redraw the seams.
   *  Drives the resize path (one app-level listener) AND the post-reconcile
   *  refit. Recomputes each pane's pixel rect from its grid-cell rect AND
   *  reconciles the clip mask against the pane's CURRENT full-grid status — so
   *  a pane that changed full-grid↔partial-grid via a rect-only reconcile
   *  (e.g. single→study keeps the `root` id, level unchanged, takes the cheap
   *  rect path) gets its mask created/destroyed here. Without this, the
   *  now-partial `root` pane would keep its null single-pane mask and never be
   *  clipped — violating the per-pane clip contract. */
  function refitAll(gridCols: number, gridRows: number): void {
    for (const [, live] of livePanes) {
      const pr = computePixelRect(
        live.rect,
        gridCols,
        gridRows,
        app.screen.width,
        app.screen.height,
      );
      live.paneRoot.x = pr.px;
      live.paneRoot.y = pr.py;
      reconcileMask(live, gridCols, gridRows, pr);
      live.refit({ px: 0, py: 0, pw: pr.pw, ph: pr.ph });
    }
    drawSeams(gridCols, gridRows);
  }

  /** Reconcile a live pane's clip mask against its CURRENT full-grid status.
   *  - partial-grid + no mask → create + attach a mask (the single→partial
   *    case the must-fix flagged);
   *  - partial-grid + mask → redraw (not recreate — avoids GC churn on resize
   *    storms);
   *  - full-grid + mask → detach + destroy (a partial→full pane drops back to
   *    the byte-identical maskless single-pane render path).
   *  Mutates `live.mask`. The mask is in paneRoot-LOCAL space (origin 0,0)
   *  since paneRoot already carries the rect's pixel origin. */
  function reconcileMask(
    live: LivePane,
    gridCols: number,
    gridRows: number,
    pr: PixelRect,
  ): void {
    const full = isFullGrid(live.rect, gridCols, gridRows);
    if (full) {
      if (live.mask) {
        live.paneRoot.mask = null;
        live.mask.destroy();
        live.mask = null;
      }
      return;
    }
    // Partial grid — must be clipped.
    if (!live.mask) {
      const mask = new Graphics();
      mask.rect(0, 0, pr.pw, pr.ph).fill(0xffffff);
      live.paneRoot.addChild(mask);
      live.paneRoot.mask = mask;
      live.mask = mask;
      return;
    }
    live.mask.clear().rect(0, 0, pr.pw, pr.ph).fill(0xffffff);
  }

  /** Draw box-drawing seam glyphs along every internal pane border. Pure
   *  decoration; rebuilt from scratch each call (cheap — N panes small). */
  function drawSeams(gridCols: number, gridRows: number): void {
    seamLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    // With one full-grid pane there are no internal seams — skip entirely so
    // the single-pane visual is unchanged.
    if (livePanes.size <= 1) return;
    const seam = new Graphics();
    const stroke = { width: 1, color: hexToSeamColor(theme) };
    for (const [, live] of livePanes) {
      const pr = computePixelRect(
        live.rect,
        gridCols,
        gridRows,
        app.screen.width,
        app.screen.height,
      );
      // Draw the pane's right + bottom edges as seams when they are INTERNAL
      // (not on the outer screen border). Adjacent panes share the edge, so
      // drawing right+bottom per pane covers every internal seam once-ish;
      // overdraw on a shared edge is visually identical (same line).
      if (pr.px + pr.pw < app.screen.width - 1) {
        seam.moveTo(pr.px + pr.pw, pr.py).lineTo(pr.px + pr.pw, pr.py + pr.ph);
      }
      if (pr.py + pr.ph < app.screen.height - 1) {
        seam.moveTo(pr.px, pr.py + pr.ph).lineTo(pr.px + pr.pw, pr.py + pr.ph);
      }
    }
    seam.stroke(stroke);
    seamLayer.addChild(seam);
    // Box-drawing glyph junctions at internal corners — the recognisable
    // terminal seam vocabulary (│ ─ ┼ ├ ┤ ┬ ┴). One BitmapText overlay of
    // the junction glyph at each interior grid intersection.
    drawSeamGlyphs(seamLayer, theme, gridCols, gridRows, app.screen.width, app.screen.height);
  }

  // Initial mount of every pane in the current arrangement.
  {
    const s0 = useAppStore.getState();
    for (const desc of s0.panes) mountPane(desc, s0.gridCols, s0.gridRows);
    drawSeams(s0.gridCols, s0.gridRows);
  }

  // One app-level resize listener recomputes every pane's pixel rect (moving
  // the 5 per-renderer resize listeners up here) + redraws the seams.
  const onResize = (): void => {
    const s = useAppStore.getState();
    refitAll(s.gridCols, s.gridRows);
  };
  app.renderer.on('resize', onResize);

  // Phase 4 slice 4A — wallpaper throttle hookup. Phase 5B added the
  // SLEEPING state (4th: user is genuinely away — system idle > 10
  // min + no fullscreen). Adjust the Ticker based on the store's
  // throttleState slice. Applied once now from the current state and
  // then on every transition via the existing subscribe() at the
  // bottom of mountPalace.
  //
  // 'full'         → ticker uncapped (default 60 FPS effective via vsync)
  // 'throttled-1hz'→ maxFPS=1 (agents + animations still progress, just
  //                  at one step per second — wallpaper is mostly hidden)
  // 'paused'       → ticker stopped; resume on next state change. The
  //                  cohort + scene state is preserved because we don't
  //                  destroy anything, just stop the loop.
  // 'sleeping' (5B)→ ticker stopped, same as paused VISUALLY. The
  //                  difference lives in App.tsx's throttle
  //                  subscription, which schedules a one-shot
  //                  background reflection sweep on sleep-entry +
  //                  surfaces a "morning dispatch" banner on wake.
  function applyThrottle(state: import('../api/electron').ThrottleState): void {
    const before = { started: app.ticker.started, maxFPS: app.ticker.maxFPS };
    if (state === 'paused' || state === 'sleeping') {
      if (app.ticker.started) app.ticker.stop();
    } else {
      if (!app.ticker.started) app.ticker.start();
      app.ticker.maxFPS = state === 'throttled-1hz' ? 1 : 0;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[throttle/renderer] state=${state} ` +
        `ticker.started ${before.started}→${app.ticker.started} ` +
        `ticker.maxFPS ${before.maxFPS}→${app.ticker.maxFPS}`,
    );
  }
  applyThrottle(useAppStore.getState().throttleState);

  // Telemetry overlay (Phase 2F) — mounted on demand by the
  // `agentDebugOverlay` subscription. Lives at the app level (not the
  // cell level) so it stays visible across scale transitions. Overlay
  // reads telemetry via the writer, so we resolve fresh on each mount;
  // a profile-driven namespace rebuild rebuilds the writer's prepared
  // statements against the same DB.
  let teardownOverlay: (() => void) | null = null;
  function applyOverlay(on: boolean): void {
    if (on && !teardownOverlay) {
      teardownOverlay = mountTelemetryOverlay({
        app,
        theme,
        memoryWriter: resolveWriter(),
      });
    } else if (!on && teardownOverlay) {
      teardownOverlay();
      teardownOverlay = null;
    }
  }
  applyOverlay(useAppStore.getState().agentDebugOverlay);

  // Slice 2G: track the profile-derived seed so we only remount on a
  // change that actually affects the renderer. profileSeed() ignores
  // persona / avatar drift; topGames + engagement + playtime buckets
  // are what move it. Anonymous → ANONYMOUS_SEED, profile → its hash.
  let lastSeed = seedFromState(useAppStore.getState().profile);

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    const nextSeed = seedFromState(state.profile);
    const seedChanged = nextSeed !== lastSeed;
    // Rebuild the writer namespace *before* remount so a new cell mounts with
    // a writer scoped to the profile-derived (cellId, libraryId). No-op in the
    // web build (rebuildNamespaceSync returns null when no DB is cached).
    if (seedChanged) {
      rebuildNamespaceSync(
        namespaceFor(state.profile, state.steamId, nextSeed),
      );
    }

    // Phase 7-B — reconcile the panes array against the live Map. The single
    // `scale` field is still the focused pane's level (back-compat mirror), so
    // App.tsx's `[`/`]` zoom flows through here as a setPaneLevel on the
    // focused pane → that pane's descriptor.level changes → remount THAT pane,
    // exactly as the old single-Container scaleChanged path did when there is
    // one pane. focusedPaneId-only changes never touch the Map (only cell.ts's
    // input gate reads it live) — no needless teardown/remount flash.
    const panesChanged = state.panes !== prev.panes;
    if (panesChanged || (seedChanged && hasCellPane(state.panes))) {
      reconcilePanes(state.panes, state.gridCols, state.gridRows, seedChanged);
      lastSeed = nextSeed;
    } else if (seedChanged) {
      // No cell pane mounted right now; record the seed so a later cell pane
      // mounts with the right library.
      lastSeed = nextSeed;
    }

    if (state.agentDebugOverlay !== prev.agentDebugOverlay) {
      applyOverlay(state.agentDebugOverlay);
      keepOverlaysOnTop();
    }
    if (state.throttleState !== prev.throttleState) {
      applyThrottle(state.throttleState);
    }
  });

  /** Reconcile the desired panes array against the live Map: mount added,
   *  unmount removed, remount panes whose level changed (or whose cell-seed
   *  changed), re-fit panes whose only rect changed. Then refit + redraw
   *  seams. The single-pane case (one pane, level changed) reduces to exactly
   *  one teardown + one remount — byte-equivalent to the pre-7-B path. */
  function reconcilePanes(
    desired: readonly PaneDescriptor[],
    gridCols: number,
    gridRows: number,
    seedChanged: boolean,
  ): void {
    const desiredIds = new Set(desired.map((d) => d.id));
    // Remove panes no longer present.
    for (const id of [...livePanes.keys()]) {
      if (!desiredIds.has(id)) unmountPane(id);
    }
    // Add / relevel / re-rect.
    for (const desc of desired) {
      const live = livePanes.get(desc.id);
      if (!live) {
        mountPane(desc, gridCols, gridRows);
        continue;
      }
      const levelChanged = live.level !== desc.level;
      const rectChanged =
        live.rect.col !== desc.rect.col ||
        live.rect.row !== desc.rect.row ||
        live.rect.cols !== desc.rect.cols ||
        live.rect.rows !== desc.rect.rows;
      // Remount on a level change OR a cell-seed change for a cell pane (the
      // library changed). Rect-only changes are a cheap re-fit (handled by
      // refitAll below).
      if (levelChanged || (seedChanged && desc.level === 'cell')) {
        unmountPane(desc.id);
        mountPane(desc, gridCols, gridRows);
      } else if (rectChanged) {
        live.rect = desc.rect; // refitAll recomputes the pixel rect
      }
    }
    refitAll(gridCols, gridRows);
    keepOverlaysOnTop();
  }

  /** App-level overlays (telemetry, morning-dispatch) are added straight to
   *  app.stage; after a pane mount/split they must stay the top-most children
   *  so they sit above every pane + the seam layer. */
  function keepOverlaysOnTop(): void {
    // panesLayer + seamLayer should sit at the BOTTOM of the stage's child
    // list; everything added after (overlays) stays above. Re-assert their
    // index in case a later addChild reordered them.
    app.stage.setChildIndex(panesLayer, 0);
    app.stage.setChildIndex(seamLayer, 1);
  }

  return () => {
    unsubscribe();
    app.renderer.off('resize', onResize);
    if (teardownOverlay) teardownOverlay();
    for (const id of [...livePanes.keys()]) unmountPane(id);
    seamLayer.destroy({ children: true });
    panesLayer.destroy({ children: true });
    currentRenderContext = null;
    app.destroy(true, { children: true, texture: true });
  };
}

/** True when any pane in the arrangement is a cell pane (drives the seed-change
 *  remount path — only a cell pane depends on the library seed). */
function hasCellPane(panes: readonly PaneDescriptor[]): boolean {
  return panes.some((p) => p.level === 'cell');
}

function seedFromState(profile: Profile | null): number {
  return profile ? profileSeed(profile) : ANONYMOUS_SEED;
}

/**
 * Phase 7-B — mount ONE pane's level into a per-pane root Container, fitting to
 * the pane's LOCAL pixel rect (origin 0,0). Generalises the old `mountLevel`:
 * every mount* now takes (parent, rect) and returns {teardown, refit} so the
 * router can re-fit on resize without remount. `paneId` is threaded to mountCell
 * for the focused-pane input gate. With a single full-grid pane the parent is a
 * {0,0}-translated root + the rect === full screen, so the dispatch + fit are
 * identical to the pre-7-B path.
 */
function mountPaneLevel(
  app: Application,
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  level: ScaleLevel,
  paneId: string,
  memoryWriter: MemoryWriter,
  spriteAtlas: SpriteAtlas | null,
  localModel: LocalModelResult = NO_LOCAL_MODEL,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  if (level === 'cell') {
    const { books, seed } = snapshotLibraryState();
    const layout = layoutCell(seed);
    return mountCell(
      app,
      parent,
      rect,
      theme,
      layout,
      books,
      seed,
      memoryWriter,
      spriteAtlas,
      localModel,
      paneId,
    );
  }
  if (level === 'district') {
    const { clusterGames, seed } = snapshotLibraryState();
    return mountDistrict(parent, rect, theme, clusterGames, seed);
  }
  if (level === 'island') {
    const { clusterGames, seed } = snapshotLibraryState();
    return mountIsland(parent, rect, theme, clusterGames, seed);
  }
  if (level === 'continent') {
    const { clusterGames, seed } = snapshotLibraryState();
    return mountContinent(parent, rect, theme, clusterGames, seed);
  }
  // planet + solar_system stay stubs (planet = speculative rotating world;
  // solar_system implies multi-source ingestion — Year-3 per CONSOLIDATION).
  // Enrich the stub panel with an aggregate count from the cluster tree so
  // the highest rungs still say something about the library size.
  const { clusterGames, seed } = snapshotLibraryState();
  const tree = clusterLibrary(clusterGames, seed);
  return mountStubLevel(
    parent,
    rect,
    theme,
    level,
    `${tree.gameCount} games · ${tree.continentCount} continents`,
  );
}

interface LibrarySnapshot {
  profile: Profile | null;
  books: BookGame[];
  /** Phase 7-A — clustering input. Same games as `books` but carrying the
   *  per-game `engagement` activity signal when authenticated (drives the
   *  district/island/continent activity glyphs). Anonymous path has no
   *  engagement (SAMPLE_LIBRARY is GameEntry); it degrades to 'none'. */
  clusterGames: ClusterGame[];
  seed: number;
}

/** Anonymous-user seed. Picked to give a visually interesting WFC
 *  outcome on the sample library; changing this changes every
 *  not-signed-in demo. */
const ANONYMOUS_SEED = 0xa11ce11 >>> 0;

function snapshotLibraryState(): LibrarySnapshot {
  const state = useAppStore.getState();
  const profile = state.profile;
  if (profile) {
    return {
      profile,
      books: profile.topGames.map((g) => ({ appid: g.appid, name: g.name })),
      clusterGames: profile.topGames.map((g) => ({
        appid: g.appid,
        name: g.name,
        engagement: g.engagement,
      })),
      seed: profileSeed(profile),
    };
  }
  return {
    profile: null,
    books: SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name })),
    clusterGames: SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name })),
    seed: ANONYMOUS_SEED,
  };
}
