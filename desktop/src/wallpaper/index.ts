/**
 * Wallpaper-mode platform dispatch. Phase 6 slice 4.
 *
 * Two operations:
 *   - enterWallpaper(win): reparent the BrowserWindow behind the desktop
 *     (Windows: under WorkerW; macOS: NSWindow.level → kCGDesktopWindowLevel,
 *     stubbed in slice 4).
 *   - exitWallpaper(win): unparent + restore normal window state.
 *
 * Each implementation is best-effort and idempotent. If the underlying
 * platform call fails (Win32 reparenting timing edge cases, macOS not yet
 * implemented), the window is left in a usable-but-not-wallpaper state and
 * a warning is logged. The caller (main.ts) updates the persisted mode
 * either way so the user can flip back via the tray.
 */

import type { BrowserWindow, Display } from 'electron';
import * as windowsImpl from './windows';
import * as macosImpl from './macos';

export function enterWallpaper(win: BrowserWindow, display?: Display): void {
  if (process.platform === 'win32') return windowsImpl.enterWallpaper(win, display);
  if (process.platform === 'darwin') return macosImpl.enterWallpaper(win, display);
  // eslint-disable-next-line no-console
  console.warn(`[wallpaper] platform ${process.platform} not supported; window mode only.`);
}

export function exitWallpaper(win: BrowserWindow): void {
  if (process.platform === 'win32') return windowsImpl.exitWallpaper(win);
  if (process.platform === 'darwin') return macosImpl.exitWallpaper(win);
}
