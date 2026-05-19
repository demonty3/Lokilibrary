/**
 * macOS wallpaper-mode stub. Slice 4 ships Windows-only; the real
 * implementation (`NSWindow.level = kCGDesktopWindowLevel` via a native
 * Objective-C bridge, plus `NSWindowCollectionBehaviorStationary` so the
 * window stays put across Mission Control swipes) is a follow-up slice
 * before v1.0 ship.
 *
 * For now: log + no-op. The main process still updates persisted mode +
 * fires the renderer subscription, so the frontend correctly skips
 * pointer-lock / menu UI; the window just happens to remain a floating
 * Electron window above the desktop instead of behind it.
 */

import type { BrowserWindow } from 'electron';

export function enterWallpaper(_win: BrowserWindow): void {
  // eslint-disable-next-line no-console
  console.warn('[wallpaper:macos] not yet implemented; staying in a regular window.');
}

export function exitWallpaper(_win: BrowserWindow): void {
  // No-op — we never reparented anything, nothing to undo.
}
