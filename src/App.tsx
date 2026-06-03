import { useEffect, useRef } from 'react';
import {
  getThrottleState,
  getWallpaperMode,
  subscribeThrottle,
  subscribeWallpaperMode,
} from './api/electron';
import { tickAgent } from './api/agent';
import { useAppStore } from './state/store';
import {
  getCurrentRenderContext,
  mountPalace,
  snapshotLibraryState,
} from './render/PixiApp';
import { regionTerminals } from './procedural/regions';
import { getById } from './themes';
import { themeFromLore } from './agents/lore-theme';
import { SCALE_ORDER, type ScaleLevel } from './types';
import { bootstrapMemory, namespaceFor } from './agents/memory/bootstrap';
import { broadcastExternalFullscreen, nullMemoryWriter } from './agents/router';
import { listRuntimesIn } from './state/agentRuntime';
import { listCellPaneScopes } from './state/cellPaneScopes';
import { getPlayerPos } from './state/playerPos';
import {
  consumeSleepReflections,
  triggerSleepReflection,
} from './agents/sleep-reflection';
import { mountMorningDispatch } from './render/overlays/morning-dispatch';
import { LoreDropZone } from './render/LoreDropZone';

/**
 * Phase 1D — the React shell. Mounts the PixiJS canvas, wires the
 * Steam-auth + wallpaper-mode loaders carried over from Phase 0, owns
 * the global scale-zoom keyboard listener (`[` zooms out, `]` zooms
 * in), and renders a small HUD with the current scale + steamId so
 * level transitions are visible without DevTools.
 *
 * The cell-level WASD/arrow handler lives in the cell renderer itself
 * (mountCell registers + tears down its own listener) so it stays
 * scoped to when the cell is mounted. App.tsx only owns globals: scale
 * transitions + the Phase 0 boot diagnostic tick.
 *
 * The Phase 0 Tier 1 agent round-trip stays as a boot-time diagnostic
 * — fires once, logs to console, doesn't drive anything. Phase 2
 * replaces this with the per-agent tick loop.
 */
export function App() {
  const loadAuth = useAppStore((s) => s.loadAuth);
  const setWallpaperMode = useAppStore((s) => s.setWallpaperMode);
  const setThrottleState = useAppStore((s) => s.setThrottleState);
  const setScale = useAppStore((s) => s.setScale);
  const scale = useAppStore((s) => s.scale);
  const steamId = useAppStore((s) => s.steamId);
  const loreVersion = useAppStore((s) => s.loreVersion);
  const canvasHost = useRef<HTMLDivElement | null>(null);
  const tickFired = useRef(false);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    void getWallpaperMode().then((mode) => setWallpaperMode(mode === 'wallpaper'));
    return subscribeWallpaperMode((mode) => setWallpaperMode(mode === 'wallpaper'));
  }, [setWallpaperMode]);

  // Phase 4 slice 4A — wallpaper throttle sub. PixiApp.ts reads the
  // store value via subscribe() to adjust app.ticker; here we keep the
  // store in sync with the main-process emitter and inject perception
  // events on state transitions.
  //
  // Phase 5B added the SLEEPING state. Two side-effects on transitions:
  //   - `sleeping` (after grace) → triggerSleepReflection() fires one
  //     Tier-2 dispatch per present agent with reflectionCounter>0.
  //     Bypasses the per-hour rate-limit (this IS the budget being
  //     spent). Reflections + plans land in memory; reflection texts
  //     buffer in sleep-reflection.ts for the morning dispatch.
  //   - leaving `sleeping` for anything else → consumeSleepReflections
  //     returns the buffered texts; if non-empty, mount the
  //     morning-dispatch banner overlay above the cell.
  useEffect(() => {
    let sleepReflectTimer: ReturnType<typeof setTimeout> | null = null;
    let prevState: import('./api/electron').ThrottleState = 'full';

    void getThrottleState().then((s) => {
      setThrottleState(s);
      prevState = s;
    });

    const unsub = subscribeThrottle((event) => {
      const next = event.state;
      setThrottleState(next);

      // Phase 4A — broadcast `external_fullscreen` perception on PAUSED
      // entry. Phase 7 / v2.x: union over every live cell pane's runtimes
      // (every live world's agents should remember "the user vanished into
      // a fullscreen app"), anchored at the FOCUSED pane's player — its last
      // known cell. With the default single 'root' cell pane the union is
      // that pane's runtimes + focused === 'root', so this is byte-identical
      // to the pre-pane-scoping broadcast.
      if (next === 'paused' && !event.isInitial) {
        const focusedId = useAppStore.getState().focusedPaneId;
        const anchor = getPlayerPos(focusedId);
        const runtimes = listCellPaneScopes().flatMap((s) => listRuntimesIn(s));
        broadcastExternalFullscreen(runtimes, {
          at: { x: anchor.x, y: anchor.y },
          when: Date.now(),
        });
      }

      // Phase 5B — sleep-mode reflection sweep + morning dispatch.
      // Cancel any pending sleep-reflection if the user wakes within
      // the grace period (saves the Sonnet call for a real sleep).
      if (sleepReflectTimer !== null && next !== 'sleeping') {
        clearTimeout(sleepReflectTimer);
        sleepReflectTimer = null;
      }
      if (next === 'sleeping' && !event.isInitial) {
        sleepReflectTimer = setTimeout(() => {
          sleepReflectTimer = null;
          void triggerSleepReflection();
        }, 5000); // 5s grace before the sweep fires
      }
      // Waking from sleep — drain the buffer + display banner if any.
      // mountMorningDispatch returns null when no lines to show (no
      // reflections actually landed during sleep).
      if (prevState === 'sleeping' && next !== 'sleeping') {
        const lines = consumeSleepReflections();
        if (lines.length > 0) {
          // The overlay needs the PIXI Application + Theme; both live
          // inside PixiApp's mount closure. We use a module-local
          // ref published by PixiApp on mount. See `src/render/PixiApp.ts`
          // export `getCurrentApp`/`getCurrentTheme`.
          const ctx = getCurrentRenderContext();
          if (ctx) mountMorningDispatch({ app: ctx.app, theme: ctx.theme, lines });
        }
      }
      prevState = next;
    });

    return () => {
      unsub();
      if (sleepReflectTimer !== null) clearTimeout(sleepReflectTimer);
    };
  }, [setThrottleState]);

  useEffect(() => {
    if (!canvasHost.current) return;
    let teardown: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      // Phase 2F: bootstrap memory store before mounting the palace.
      // In Electron this opens userData/memory.sqlite + vaults/. In
      // the web build this returns the null writer. Bootstrap with the
      // anonymous namespace so the DB opens; PixiApp re-derives the
      // profile-aware namespace synchronously via rebuildNamespaceSync
      // when the profile lands (slice 2G).
      const initialState = useAppStore.getState();
      const ns = namespaceFor(initialState.profile, initialState.steamId, 0);
      let writer = nullMemoryWriter;
      try {
        const bootstrap = await bootstrapMemory({ namespace: ns });
        writer = bootstrap.writer;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[app] memory bootstrap failed: ${(e as Error).message}`);
      }

      if (cancelled || !canvasHost.current) return;
      // Phase 5D.4 — local lore palette recolor. Derive the theme
      // deterministically from the lore corpus (suggestedTilePaletteBias[0]
      // ?? DEFAULT_THEME_ID). LOCAL only: reads loreCount()/recentLore()
      // on-device, never egresses. Independent of loreEnabled (mirrors the
      // 5D.2 scatter precedent). Recomputed on each remount; the effect
      // re-runs when loreVersion bumps after a successful ingest.
      const themeId = themeFromLore(writer);
      const fn = await mountPalace(canvasHost.current, getById(themeId), {
        memoryWriter: writer,
      });
      if (cancelled) fn();
      else teardown = fn;
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [loreVersion]);

  // Profile-triggered namespace rebuild + cell remount is owned by
  // PixiApp's Zustand subscriber (slice 2G). It calls
  // rebuildNamespaceSync synchronously on the profile-set, then
  // remounts the cell so the cohort + telemetry pick up the new writer.
  // No useEffect needed here.

  // Scale-zoom keyboard: [ = out (next level in SCALE_ORDER), ] = in
  // (previous level). Gated by wallpaperMode so the wallpaper layer
  // never consumes input. Also Ctrl+` toggles the Phase-2F telemetry
  // overlay (the corner panel showing tier-1/tier-2 spend).
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (useAppStore.getState().wallpaperMode) return;
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        useAppStore.getState().toggleAgentDebug();
        return;
      }
      // Phase 5C.2b — Ctrl+U toggles the lore-upload drop-zone. (Not
      // Ctrl+L: that's mentally adjacent to the desktop-side Ctrl+Alt+L
      // peek hotkey, and browsers bind Ctrl+L to the address bar.)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        useAppStore.getState().toggleLoreUpload();
        return;
      }
      // Esc closes the drop-zone if open.
      if (e.key === 'Escape' && useAppStore.getState().loreUploadOpen) {
        e.preventDefault();
        useAppStore.getState().setLoreUploadOpen(false);
        return;
      }
      // Phase 7-B — composable panes. All composition keybinds live behind
      // the same wallpaper guard above (line ~189) so they no-op in
      // wallpaper mode (wallpaper shows the arrangement read-only). Tab
      // cycles the focused pane (preventDefault so focus never leaves the
      // canvas). Backslash toggles between the single + 'study' demo
      // arrangements — a non-letter so it never collides with cell.ts's
      // WASD/E movement keys.
      if (e.key === 'Tab') {
        // Only claim Tab when there's more than one pane to cycle — in the
        // single-pane default it's a no-op, so let the key pass through
        // normally rather than swallowing it.
        if (useAppStore.getState().panes.length > 1) {
          e.preventDefault();
          useAppStore.getState().cycleFocus();
        }
        return;
      }
      if (e.key === '\\') {
        e.preventDefault();
        const single = useAppStore.getState().panes.length === 1;
        useAppStore.getState().setArrangement(single ? 'study' : 'single');
        return;
      }
      // Phase 7 / v2.x — split the FOCUSED pane in two ('|' = shifted
      // backslash, the "split" mnemonic; a non-letter so it never collides
      // with WASD/E). Splitting a focused CELL pane yields a SECOND 'cell'
      // pane (splitPane inherits the focused pane's level) — each mounts its
      // own pane-scoped player + cohort + perception, so the two `@`s and
      // two cohorts move independently. This is the demonstrable two-cell
      // arrangement the per-pane unblock enables. No-op in the single-pane
      // default until pressed, so the default path is unchanged.
      if (e.key === '|') {
        e.preventDefault();
        useAppStore.getState().splitPane('vertical');
        return;
      }
      // Phase 7 / v2.x — region terminals. 'r' cycles the FOCUSED cell pane
      // through the library's wings (the 7-A districts): whole-library → d0 →
      // d1 → … → whole-library. Each wing is a genuinely different generated
      // world (own seed / shelves / cohort / persistent memory). Works on the
      // default single pane too (the whole world becomes one wing). The wing
      // list is derived here from the live library so the store stays free of
      // the cluster-tree math; 'r' is safe — cell.ts movement is WASD/arrows/E.
      if (e.key === 'r' || e.key === 'R') {
        const { clusterGames, seed } = snapshotLibraryState();
        const regionIds = regionTerminals(clusterGames, seed).map((rt) => rt.regionId);
        if (regionIds.length === 0) return; // empty library → nothing to cycle
        e.preventDefault();
        useAppStore.getState().cycleFocusedPaneRegion(regionIds);
        return;
      }
      if (e.key !== '[' && e.key !== ']') return;
      e.preventDefault();
      const current = useAppStore.getState().scale;
      const idx = SCALE_ORDER.indexOf(current);
      if (idx < 0) return;
      const nextIdx = e.key === '[' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= SCALE_ORDER.length) return;
      setScale(SCALE_ORDER[nextIdx]);
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [setScale]);

  // Phase 0 verification: one Tier 1 round-trip on boot. Logged to console
  // so the spike's pass/fail criterion is visible without UI plumbing. Phase
  // 2 replaces this with a per-agent tick loop driven by the simulation.
  useEffect(() => {
    if (tickFired.current) return;
    tickFired.current = true;
    void tickAgent(
      { id: 'loki', name: 'Loki', personality: 'mischievous', energy: 7 },
      {
        scene: 'the central plaza of a small terminal-aesthetic palace',
        saw: ['an old bookshelf', 'a stranger sitting by the fountain'],
        lastAction: 'wandered in from the east arch',
      },
    ).then((result) => {
      if (result.ok) {
        // eslint-disable-next-line no-console
        console.log('[phase 0] agent tick', result.tick);
      } else {
        // eslint-disable-next-line no-console
        console.warn('[phase 0] agent tick failed:', result.error);
      }
    });
  }, []);

  return (
    <>
      <div ref={canvasHost} style={{ position: 'fixed', inset: 0 }} />
      <Hud scale={scale} steamId={steamId} />
      <LoreDropZone />
    </>
  );
}

function Hud({ scale, steamId }: { scale: ScaleLevel; steamId: string | null }) {
  const label = scale.replace(/_/g, ' ');
  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 12,
        font: '12px/1.4 ui-monospace, monospace',
        color: '#cdd6f4',
        background: 'rgba(0,0,0,0.45)',
        padding: '4px 8px',
        pointerEvents: 'none',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        userSelect: 'none',
      }}
    >
      <div>level: {label}</div>
      <div>steamid: {steamId ?? '—'}</div>
      <div style={{ opacity: 0.65 }}>
        [ zoom out · ] zoom in · WASD walk · | split · \ study · Tab focus
      </div>
    </div>
  );
}
