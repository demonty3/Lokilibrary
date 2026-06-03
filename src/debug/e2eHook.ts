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
import { getPlayerPos } from '../state/playerPos';

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
  /** Store + per-pane player + scene in one call — the harness's `state` verb. */
  snapshot(): unknown;
}

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
    snapshot() {
      const s = useAppStore.getState();
      return {
        panes: s.panes.map((p) => ({ id: p.id, level: p.level, region: p.regionId ?? null, rect: p.rect })),
        focusedPaneId: s.focusedPaneId,
        grid: `${s.gridCols}x${s.gridRows}`,
        wallpaper: s.wallpaperMode,
        players: s.panes.map((p) => ({ id: p.id, pos: getPlayerPos(p.id) })),
        scene: this.paneScene(),
      };
    },
  };
  (window as unknown as { __loki: LokiE2EHook }).__loki = hook;
}
