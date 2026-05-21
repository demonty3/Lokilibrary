import { useEffect, useRef } from 'react';
import {
  getPeekAccelerator,
  getPeeking,
  getWallpaperMode,
  subscribePeek,
  subscribeWallpaperMode,
} from './api/electron';
import { useAppStore } from './state/store';
import { mountPalace } from './render/PixiApp';
import solarized from './themes/solarized.json';
import type { Theme } from './themes/types';

/**
 * Phase 0 spike — PixiJS hello-world. The PixiJS canvas mounts into a
 * container ref; React is the host shell but doesn't drive frame content.
 * Phase 1 layers the agent simulation + scale-ladder controller on top.
 */
export function App() {
  const loadAuth = useAppStore((s) => s.loadAuth);
  const setWallpaperMode = useAppStore((s) => s.setWallpaperMode);
  const setPeeking = useAppStore((s) => s.setPeeking);
  const canvasHost = useRef<HTMLDivElement | null>(null);

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

  return <div ref={canvasHost} style={{ position: 'fixed', inset: 0 }} />;
}
