/**
 * E2E debug hook — a deliberate, build-gated `window.__loki` surface for the
 * deterministic test harness (`scripts/e2e/`). It exists so the harness can
 * read + drive the REAL app singletons instead of `import('/src/…')` from a
 * CDP eval, which Vite's dev server resolves to a SEPARATE module instance
 * (the source of every contradictory reading during multi-pane debugging).
 *
 * Because this module is part of the app's own bundle (imported from main.tsx),
 * the `useAppStore` / `getCurrentRenderContext` / `getPlayerPos` it captures are
 * the exact instances the running app uses — so reads + calls through
 * `window.__loki` can never disagree with the app.
 *
 * GATING: installed only when `import.meta.env.DEV` (dev) or
 * `import.meta.env.VITE_E2E` (a `VITE_E2E=1 vite build`). The shipped Steam
 * build sets neither, so the install call is dead-code-eliminated and this
 * surface never reaches users.
 */

import { useAppStore } from '../state/store';
import { getCurrentRenderContext } from '../render/PixiApp';
import { getPlayerPos, setPlayerPos } from '../state/playerPos';
import { getPane } from '../state/paneRegistry';
import { getLandMuralState, mountLandPreview, mountLandView } from '../render/levels/land';
import { e2ePlaceMarkIn } from '../render/levels/cell';

export interface LokiE2EHook {
  /** The real Zustand store singleton (getState / setState / actions). */
  store: typeof useAppStore;
  /** Per-pane player position (pane-scoped module singleton). */
  getPlayerPos: typeof getPlayerPos;
  /** A compact, JSON-safe snapshot of the live PIXI pane scene-graph: one entry
   *  per mounted pane root (screen origin + pixel size + child count). This is
   *  ground truth for "did reconcilePanes actually mount N panes", independent
   *  of the store's intent. */
  paneScene(): Array<{ x: number; y: number; w: number; h: number; children: number }> | null;
  /** Per-pane agent roster read straight from each pane's live RuntimeScope (via
   *  the pane registry). Ground truth for the single-roaming-roster + seam-walk:
   *  an agent leaving one pane's array and appearing in another's IS a crossing,
   *  independent of any sprite. Keyed by paneId. */
  agentRoster(): Record<string, Array<{ id: string; x: number; y: number; seamGoal: boolean }>>;
  /** Store + per-pane player + scene in one call — the harness's `state` verb. */
  snapshot(): unknown;
  /** PROTOTYPE — mount the side-on "wide land" full-screen over the stage for
   *  screenshot iteration (DEV/E2E only). Optional seed. Call previewLand again
   *  to reseed; clearLand() to remove. Not wired into the pane system yet. */
  previewLand(seed?: number): void;
  /** PROTOTYPE — mount the WALKABLE land (wide world + scrolling camera; a/d or
   *  arrows walk the surface). DEV/E2E only. clearLand() removes it. */
  walkLand(seed?: number): void;
  clearLand(): void;
  /** V0 spike — the land preview's ANSI capsule-mural lifecycle
   *  ('idle' | 'loading' | 'ready' | 'failed-cors' | 'failed-load'), so the
   *  harness can poll readiness before screenshotting. */
  landMuralState(): string;
  /** Force the world palette to a theme id, exercising the REAL lore-recolor
   *  path (App.tsx derives `e2eThemeOverrideId() ?? themeFromLore(writer)` and
   *  remounts on a `loreVersion` bump). Lets the harness prove the on-screen
   *  repaint a lore drop would trigger, without a SQLite-backed writer. Pass
   *  null to clear and fall back to the derived theme. DEV/E2E only. */
  setTheme(themeId: string | null): void;
  /** Agent-mind pass — inject a trace mark into the live cell (DEV/E2E
   *  only). Returns false when no cell is mounted. */
  placeMark(x: number, y: number, agentId: string, text: string): boolean;
  /** Agent-mind pass — teleport a pane's player (DEV/E2E only; bypasses
   *  floor checks, harness use only). */
  setPlayerPos: typeof setPlayerPos;
}

/** Build-gated theme override read by App.tsx's mount effect. Only ever set via
 *  `window.__loki.setTheme` (installed under DEV/E2E), so in the shipped Steam
 *  build this is permanently null and the world theme stays lore-derived. */
let e2eThemeOverride: string | null = null;
export function e2eThemeOverrideId(): string | null {
  return e2eThemeOverride;
}

/** Teardown for the land preview (prototype), so a re-mount or clear is clean. */
let landTeardown: (() => void) | null = null;

export function installE2EHook(): void {
  const hook: LokiE2EHook = {
    store: useAppStore,
    getPlayerPos,
    paneScene() {
      const ctx = getCurrentRenderContext();
      if (!ctx) return null;
      // panesLayer is pinned to stage child index 0 (keepOverlaysOnTop).
      const panesLayer = ctx.app.stage.children[0] as { children?: unknown[] } | undefined;
      const kids = (panesLayer?.children ?? []) as Array<{
        x: number; y: number; width: number; height: number; children?: unknown[];
      }>;
      return kids.map((c) => ({
        x: Math.round(c.x),
        y: Math.round(c.y),
        w: Math.round(c.width),
        h: Math.round(c.height),
        children: c.children?.length ?? 0,
      }));
    },
    agentRoster() {
      const out: Record<string, Array<{ id: string; x: number; y: number; seamGoal: boolean }>> = {};
      for (const p of useAppStore.getState().panes) {
        const scope = getPane(p.id)?.scope;
        if (!scope) continue;
        out[p.id] = Array.from(scope.runtimes.values()).map((rt) => ({
          id: rt.id,
          x: rt.x,
          y: rt.y,
          seamGoal: rt.seamGoal !== null,
        }));
      }
      return out;
    },
    snapshot() {
      const s = useAppStore.getState();
      return {
        panes: s.panes.map((p) => ({ id: p.id, level: p.level, region: p.regionId ?? null, rect: p.rect })),
        focusedPaneId: s.focusedPaneId,
        grid: `${s.gridCols}x${s.gridRows}`,
        wallpaper: s.wallpaperMode,
        players: s.panes.map((p) => ({ id: p.id, pos: getPlayerPos(p.id) })),
        roster: this.agentRoster(),
        scene: this.paneScene(),
        theme: e2eThemeOverride,
      };
    },
    setTheme(themeId: string | null) {
      e2eThemeOverride = themeId;
      useAppStore.getState().bumpLoreVersion();
    },
    previewLand(seed?: number) {
      landTeardown?.();
      landTeardown = null;
      const ctx = getCurrentRenderContext();
      if (!ctx) return;
      landTeardown = mountLandPreview(ctx.app, ctx.theme, seed === undefined ? {} : { seed });
    },
    walkLand(seed?: number) {
      landTeardown?.();
      landTeardown = null;
      const ctx = getCurrentRenderContext();
      if (!ctx) return;
      landTeardown = mountLandView(ctx.app, ctx.theme, seed === undefined ? {} : { seed });
    },
    clearLand() {
      landTeardown?.();
      landTeardown = null;
    },
    landMuralState() {
      return getLandMuralState();
    },
    placeMark(x, y, agentId, text) {
      return e2ePlaceMarkIn(x, y, agentId, text);
    },
    setPlayerPos,
  };
  (window as unknown as { __loki: LokiE2EHook }).__loki = hook;
}
