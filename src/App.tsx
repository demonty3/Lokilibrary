import { useEffect, useRef } from 'react';
import { getWallpaperMode, subscribeWallpaperMode } from './api/electron';
import { tickAgent } from './api/agent';
import { useAppStore } from './state/store';
import { mountPalace } from './render/PixiApp';
import { DEFAULT_THEME_ID, getById } from './themes';
import { SCALE_ORDER, type ScaleLevel } from './types';

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

  useEffect(() => {
    if (!canvasHost.current) return;
    let teardown: (() => void) | null = null;
    let cancelled = false;
    void mountPalace(canvasHost.current, getById(DEFAULT_THEME_ID)).then((fn) => {
      if (cancelled) fn();
      else teardown = fn;
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  // Scale-zoom keyboard: [ = out (next level in SCALE_ORDER), ] = in
  // (previous level). Gated by wallpaperMode so the wallpaper layer
  // never consumes input.
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (useAppStore.getState().wallpaperMode) return;
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
