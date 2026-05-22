/**
 * Wallpaper-mode platform dispatch.
 *
 * Two operations:
 *   - enterWallpaper(win): reparent the BrowserWindow behind the desktop
 *     (Windows: SetParent to Progman on Win11 22H2+, or to a WorkerW on
 *     older builds; macOS: stubbed, see macos.ts).
 *   - exitWallpaper(win): unparent + restore normal window state.
 *
 * Each implementation is best-effort and idempotent. If the underlying
 * platform call fails (Win32 reparenting timing edge cases, elevated
 * process refusing SetParent, macOS not yet implemented), the window is
 * left in a usable-but-not-wallpaper state and a warning is logged. The
 * caller (main.ts) updates the persisted mode either way so the user can
 * flip back via the tray.
 */

import type { BrowserWindow } from 'electron';
import * as windowsImpl from './windows';
import * as macosImpl from './macos';

export function enterWallpaper(win: BrowserWindow): void {
  if (process.platform === 'win32') return windowsImpl.enterWallpaper(win);
  if (process.platform === 'darwin') return macosImpl.enterWallpaper(win);
  // eslint-disable-next-line no-console
  console.warn(`[wallpaper] platform ${process.platform} not supported; window mode only.`);
}

export function exitWallpaper(win: BrowserWindow): void {
  if (process.platform === 'win32') return windowsImpl.exitWallpaper(win);
  if (process.platform === 'darwin') return macosImpl.exitWallpaper(win);
}
