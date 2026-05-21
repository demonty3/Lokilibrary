import { useEffect, useRef } from 'react';
import {
  getPeekAccelerator,
  getPeeking,
  getWallpaperMode,
  subscribePeek,
  subscribeWallpaperMode,
} from './api/electron';
import { tickAgent } from './api/agent';
import { useAppStore } from './state/store';
import { mountPalace } from './render/PixiApp';
import solarized from './themes/solarized.json';
import type { Theme } from './themes/types';

/**
 * Phase 0 spike — PixiJS hello-world + one Tier 1 agent round-trip on boot.
 * The full Smallville memory-stream agent runtime lands in Phase 2; this
 * just proves the renderer → worker → local Ollama (or Anthropic Haiku in
 * prod) loop closes end-to-end.
 */
export function App() {
  const loadAuth = useAppStore((s) => s.loadAuth);
  const setWallpaperMode = useAppStore((s) => s.setWallpaperMode);
  const setPeeking = useAppStore((s) => s.setPeeking);
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
    void getPeeking().then(setPeeking);
    void getPeekAccelerator();
    return subscribePeek(setPeeking);
  }, [setPeeking]);

  useEffect(() => {
    if (!canvasHost.current) return;
    let teardown: (() => void) | null = null;
    let cancelled = false;
    void mountPalace(canvasHost.current, solarized as Theme).then((fn) => {
      if (cancelled) fn();
      else teardown = fn;
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

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

  return <div ref={canvasHost} style={{ position: 'fixed', inset: 0 }} />;
}
