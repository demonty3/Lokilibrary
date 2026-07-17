import { Application, Container, Graphics } from 'pixi.js';
import type { Theme } from '../themes/types';
import type { PaneDescriptor, PaneRect, Profile, ScaleLevel } from '../types';
import { layoutCell } from '../procedural/cell';
import { T_FLOOR } from '../procedural/tiles/library';
import { profileSeed } from '../procedural/seed';
import { useAppStore } from '../state/store';
import {
  buildSeams,
  seamExitsForPane,
  type PaneDims,
  type Seam,
  type SeamExit,
} from '../state/seams';
import { getPane } from '../state/paneRegistry';
import { getPlayerPos } from '../state/playerPos';
import {
  buildSeamEdgesForPane,
  type CrossSeamDeps,
} from '../agents/crossSeam';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { mountCell } from './levels/cell';
import { mountDistrict } from './levels/district';
import { mountIsland } from './levels/island';
import { mountContinent } from './levels/continent';
import { mountStubLevel } from './levels/stub';
import { clusterLibrary, type ClusterGame } from '../procedural/clusters';
import { regionTerminals } from '../procedural/regions';
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

/**
 * Phase 7-D.2 — the live cross-seam wiring threaded from `mountPalace` (the one
 * place that knows the live pane set + seam graph) down to a cell pane's cohort.
 * Both are LAZY (re-derived from the live graph each call) so a split/close
 * keeps a mounted cohort current without a remount. `crossSeamDepsFor(maxFov)`
 * yields the perception deps (the cohort computes maxFov from its themed defs);
 * `seamExitsFor()` yields the crossing exits for the BehaviorContext. Single
 * pane ⇒ both empty.
 */
export interface CohortCrossWiring {
  crossSeamDepsFor: (maxFov: number) => CrossSeamDeps;
  seamExitsFor: () => ReadonlyMap<string, SeamExit>;
}

/** Shared empty exits map — avoids per-call allocation on the single-pane hot
 *  path (seamExitsFor returns THIS when there are no seams). */
const EMPTY_SEAM_EXITS: ReadonlyMap<string, SeamExit> = new Map();

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

/**
 * Phase 7-D — project a seam's INTEGER grid segment to a pixel line, using the
 * SAME float-floor cellW/cellH math as `computePixelRect` (so a seam lands on
 * the exact pixel column/row the abutting panes' edges land on — no 1px gap,
 * no divergence). Exported so the pure smoke can assert the projection matches
 * the old per-pane right/bottom-edge stroke math byte-for-byte.
 *
 * Returns the two endpoints {x1,y1}→{x2,y2} of the stroke in screen pixels.
 */
export function projectSeamToPixels(
  seam: Seam,
  gridCols: number,
  gridRows: number,
  screenW: number,
  screenH: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const cellW = screenW / Math.max(1, gridCols);
  const cellH = screenH / Math.max(1, gridRows);
  if (seam.segment.axis === 'vertical') {
    const x = Math.floor(seam.segment.line * cellW);
    const y1 = Math.floor(seam.segment.start * cellH);
    const y2 = Math.floor(seam.segment.end * cellH);
    return { x1: x, y1, x2: x, y2 };
  }
  const y = Math.floor(seam.segment.line * cellH);
  const x1 = Math.floor(seam.segment.start * cellW);
  const x2 = Math.floor(seam.segment.end * cellW);
  return { x1, y1: y, x2, y2: y };
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
  /** Phase 7 / v2.x — region terminal this cell pane renders (undefined =
   *  whole-library cell). Tracked so a region change triggers a remount. */
  regionId?: string;
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
    // Phase 7-D.2 — the live cross-seam wiring for THIS pane. The cohort reads
    // these lazily each tick so a split/close keeps it current without remount.
    // Single pane ⇒ both resolve empty (liveSeamGraph short-circuits) ⇒
    // byte-identical no-seam path.
    const crossWiring: CohortCrossWiring = {
      crossSeamDepsFor: (maxFov: number) => crossSeamDepsFor(maxFov),
      seamExitsFor: () => seamExitsFor(desc.id),
    };
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
      crossWiring,
      desc.regionId,
    );

    livePanes.set(desc.id, {
      paneRoot,
      mask,
      teardown: mounted.teardown,
      refit: mounted.refit,
      rect: desc.rect,
      level: desc.level,
      regionId: desc.regionId,
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
   *  decoration; rebuilt from scratch each call (cheap — N panes small).
   *
   *  Phase 7-D — abutment is now derived from the pure seam graph
   *  (`buildSeams`) instead of an implicit per-pane right/bottom-edge loop, so
   *  the data model and the strokes CANNOT diverge. `buildSeams` returns [] for
   *  <2 panes (and the lone full-grid pane), so the `livePanes.size <= 1` guard
   *  is belt-and-suspenders. Each seam is projected to pixels via
   *  `projectSeamToPixels` (the SAME float-floor cellW/cellH as
   *  `computePixelRect`), and seams are deduped by canonical id so a shared edge
   *  is stroked ONCE (the old loop over-drew it twice — visually identical with
   *  the opaque fgDim stroke, fewer draw calls now). */
  function drawSeams(gridCols: number, gridRows: number): void {
    seamLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    // With one full-grid pane there are no internal seams — skip entirely so
    // the single-pane visual is unchanged.
    if (livePanes.size <= 1) return;
    // Build the seam graph from the LIVE pane rects (the exact same data the
    // old per-pane edge loop read), not the store, so seams track precisely
    // what is currently mounted — no store/live skew during a reconcile.
    const descriptors: PaneDescriptor[] = [];
    for (const [id, live] of livePanes) {
      descriptors.push({ id, level: live.level, rect: live.rect });
    }
    const seams = buildSeams(descriptors, gridCols, gridRows);
    // Stroke the seam lines only when there are seams — but DON'T early-return,
    // because `drawSeamGlyphs` below must still run for >1 pane to keep the
    // junction-glyph path byte-identical to the pre-7-D behaviour (which gated
    // glyphs on `livePanes.size <= 1` ONLY, never on seam count). In the
    // uniform integer-grid tiling, >1 pane always yields >=1 seam, so this is a
    // defensive belt only.
    if (seams.length > 0) {
      const seam = new Graphics();
      const stroke = { width: 1, color: hexToSeamColor(theme) };
      for (const s of seams) {
        const { x1, y1, x2, y2 } = projectSeamToPixels(
          s,
          gridCols,
          gridRows,
          app.screen.width,
          app.screen.height,
        );
        seam.moveTo(x1, y1).lineTo(x2, y2);
      }
      seam.stroke(stroke);
      seamLayer.addChild(seam);
    }
    // Box-drawing glyph junctions at internal corners — the recognisable
    // terminal seam vocabulary (│ ─ ┼ ├ ┤ ┬ ┴). One BitmapText overlay of
    // the junction glyph at each interior grid intersection. Gated on
    // livePanes.size > 1 (the early-return above), exactly as pre-7-D.
    drawSeamGlyphs(seamLayer, theme, gridCols, gridRows, app.screen.width, app.screen.height);
  }

  /** Phase 7-D.2 — build the LIVE seam graph + per-pane interior dims from the
   *  CURRENTLY-mounted panes. The dims come from the paneRegistry (only CELL
   *  panes register, so only walkable same-level neighbours appear). Returns an
   *  empty graph for <=1 pane — the load-bearing single-pane short-circuit (no
   *  buildSeams call, no allocation churn on the cohort tick). */
  function liveSeamGraph(): { seams: Seam[]; dims: Map<string, PaneDims> } {
    if (livePanes.size <= 1) return { seams: [], dims: new Map() };
    const s = useAppStore.getState();
    const descriptors: PaneDescriptor[] = [];
    for (const [id, live] of livePanes) {
      descriptors.push({ id, level: live.level, rect: live.rect });
    }
    const seams = buildSeams(descriptors, s.gridCols, s.gridRows);
    const dims = new Map<string, PaneDims>();
    for (const [id] of livePanes) {
      const reg = getPane(id);
      if (reg) dims.set(id, { width: reg.layout.width, height: reg.layout.height });
    }
    return { seams, dims };
  }

  /** Phase 7-D.2 (must-fix) — walkability oracle for the seam-exit floor gate.
   *  Reads pane `pid`'s registered CellLayout.tiles; a cell is stand-on-able iff
   *  it is T_FLOOR (mirrors behavior.ts:walkableNeighbours). An unregistered /
   *  non-cell pane (no tiles) is treated as non-walkable so no cross is offered
   *  into it. Out-of-bounds → false. */
  function isWalkableInPane(pid: string, x: number, y: number): boolean {
    const reg = getPane(pid);
    if (!reg) return false;
    const tiles = reg.layout.tiles;
    const row = tiles[y];
    if (!row) return false;
    return row[x] === T_FLOOR;
  }

  /** Build the REAL CrossSeamDeps for a pane. The closures re-derive from the
   *  live graph each call so split/close keeps a mounted cohort's perception +
   *  crossing current WITHOUT a remount. Single pane ⇒ liveSeamGraph() is
   *  empty ⇒ openSeamsFor returns [] ⇒ enrichSnapshotAcrossSeams returns base
   *  BY REFERENCE (the byte-identical no-seam guarantee). */
  function crossSeamDepsFor(maxFov: number): CrossSeamDeps {
    return {
      openSeamsFor: (pid: string) => {
        const { seams, dims } = liveSeamGraph();
        if (seams.length === 0) return [];
        return buildSeamEdgesForPane(seams, pid, dims);
      },
      getNeighbourScope: (pid: string) => getPane(pid)?.scope,
      getNeighbourPlayer: (pid: string) => getPlayerPos(pid),
      maxFov,
    };
  }

  /** Build the live seam-EXITS lookup for a pane (the crossing path). Re-read
   *  each cohort tick. Empty for a single pane.
   *
   *  Phase 7-D.2 (must-fix) — passes a walkability oracle so an exit is offered
   *  ONLY when BOTH the exit cell (this pane) and the bridged entry cell
   *  (neighbour) are FLOOR (T_FLOOR). Without it an agent could be offered a
   *  cross that lands it in a wall (where it has no walkable neighbour out =
   *  stuck). Under the real cell layout the whole perimeter is wall, so an E/W
   *  (vertical-split) seam correctly yields ZERO crossable exits today — an
   *  honest empty result, not a stranding. The oracle reads each pane's
   *  registered CellLayout.tiles by id from the paneRegistry. */
  function seamExitsFor(paneId: string): ReadonlyMap<string, SeamExit> {
    const { seams, dims } = liveSeamGraph();
    if (seams.length === 0) return EMPTY_SEAM_EXITS;
    return seamExitsForPane(seams, paneId, dims, isWalkableInPane);
  }

  // Initial mount of every pane in the current arrangement. ROOT mounts FIRST
  // (store's panes array lists 'root' first; split appends p2+) so the single
  // roaming roster is seeded into root's scope BEFORE any split pane mounts
  // empty — the single-roaming-roster precondition.
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
      const regionChanged = live.regionId !== desc.regionId;
      const rectChanged =
        live.rect.col !== desc.rect.col ||
        live.rect.row !== desc.rect.row ||
        live.rect.cols !== desc.rect.cols ||
        live.rect.rows !== desc.rect.rows;
      // Remount on a level change, a region (wing) change, OR a cell-seed change
      // for a cell pane (the library changed). Rect-only changes are a cheap
      // re-fit (handled by refitAll below).
      if (levelChanged || regionChanged || (seedChanged && desc.level === 'cell')) {
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
  crossWiring?: CohortCrossWiring,
  regionId?: string,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  if (level === 'cell') {
    const snap = snapshotLibraryState();
    // Region terminal (Phase 7 / v2.x): when this pane is bound to a wing,
    // render that district's OWN seed + games instead of the whole library, so
    // the pane is a genuinely different generated world (room / shelves / cohort
    // / persistent memory, all seed-keyed). A regionId that no longer resolves
    // (the library shrank) falls back to the whole-library cell.
    let { books, seed } = snap;
    // Whole-arc review fix — events-calendar staging is a WORLD property
    // (see cell.ts's `isWholeLibraryPane` doc): starts true and flips false
    // ONLY when a regionId genuinely resolves to a wing below. A stale
    // regionId (the library shrank since the pane was bound) still renders
    // — and still stages — as the whole-library pane, which is correct: it
    // IS rendering the whole library in that case.
    let isWholeLibraryPane = true;
    if (regionId) {
      const region = regionTerminals(snap.clusterGames, snap.seed).find(
        (r) => r.regionId === regionId,
      );
      if (region) {
        seed = region.seed;
        books = region.games.map((g) => ({ appid: g.appid, name: g.name }));
        isWholeLibraryPane = false;
      }
    }
    // Carve the walkable seam opening from the SHARED profile seed (snap.seed),
    // not the per-region `seed` — so every wing of this profile opens at the same
    // row and an agent can cross from one terminal into a DIFFERENT-looking
    // neighbour (the floor-gate needs the openings aligned). The whole-library
    // pane has seed === snap.seed, so it is unaffected.
    const layout = layoutCell(seed, snap.seed);
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
      crossWiring,
      isWholeLibraryPane,
      isWholeLibraryPane ? null : regionId ?? null,
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

export function snapshotLibraryState(): LibrarySnapshot {
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
