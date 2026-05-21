import { useEffect } from 'react';
import {
  getPeekAccelerator,
  getPeeking,
  getWallpaperMode,
  subscribePeek,
  subscribeWallpaperMode,
} from './api/electron';
import { useAppStore } from './state/store';

/**
 * Phase 0 stub. PixiJS bootstrap lands in Commit 2; this just keeps the
 * Electron IPC + auth wiring alive so `npm run dev` boots green and the
 * desktop wrapper can still toggle wallpaper mode + peek hotkey.
 */
export function App() {
  const loadAuth = useAppStore((s) => s.loadAuth);
  const wallpaperMode = useAppStore((s) => s.wallpaperMode);
  const peeking = useAppStore((s) => s.peeking);
  const setWallpaperMode = useAppStore((s) => s.setWallpaperMode);
  const setPeeking = useAppStore((s) => s.setPeeking);

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

  return (
    <div
      id="palace-root"
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-monospace, monospace',
        color: '#b58900',
      }}
    >
      <pre style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
{`  ╔══════════════════════════════════════╗
  ║   Memory Palace — Phase 0 spike     ║
  ║                                      ║
  ║   wallpaper: ${wallpaperMode ? 'on ' : 'off'}                     ║
  ║   peek:      ${peeking ? 'on ' : 'off'}                     ║
  ╚══════════════════════════════════════╝`}
      </pre>
    </div>
  );
}
