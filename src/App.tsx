import { useEffect, useRef } from 'react';
import {
  getThrottleState,
  getWallpaperMode,
  subscribeThrottle,
  subscribeWallpaperMode,
} from './api/electron';
import { tickAgent } from './api/agent';
import { useAppStore } from './state/store';
import { mountPalace } from './render/PixiApp';
import { DEFAULT_THEME_ID, getById } from './themes';
import { SCALE_ORDER, type ScaleLevel } from './types';
import { bootstrapMemory, namespaceFor } from './agents/memory/bootstrap';
import { broadcastExternalFullscreen, nullMemoryWriter } from './agents/router';
import { listRuntimes } from './state/agentRuntime';
import { playerPosition } from './state/playerPos';

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
  // store value via subscribe() to adjust app.ticker; here we just keep
  // the store in sync with the main-process emitter and inject an
  // `external_fullscreen` perception when the renderer transitions to
  // PAUSED. In the web build both calls short-circuit and the store
  // stays 'full' (so the broadcast effectively never fires).
  useEffect(() => {
    void getThrottleState().then(setThrottleState);
    return subscribeThrottle((event) => {
      setThrottleState(event.state);
      if (event.state === 'paused' && !event.isInitial) {
        // Anchor the perception at the player's last known cell so
        // agents whose FOV happens to cover the player can flag it as
        // "user disappeared from where they were standing." The cohort
        // doesn't actually FOV-filter broadcasts (every present agent
        // gets it) but the location is still recorded on the memory
        // row for Tier-2 reflections to reason about later.
        broadcastExternalFullscreen(listRuntimes(), {
          at: { x: playerPosition.x, y: playerPosition.y },
          when: Date.now(),
        });
      }
    });
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
      const fn = await mountPalace(canvasHost.current, getById(DEFAULT_THEME_ID), {
        memoryWriter: writer,
      });
      if (cancelled) fn();
      else teardown = fn;
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

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
      <div style={{ opacity: 0.65 }}>[ zoom out · ] zoom in · WASD walk</div>
    </div>
  );
}
