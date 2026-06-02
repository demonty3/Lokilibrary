/**
 * Wallpaper-mode platform dispatch.
 *
 * Two operations:
 *   - enterWallpaper(win, display): reparent the BrowserWindow behind the
 *     desktop on the given display (Windows: SetParent to Progman on Win11
 *     22H2+, or to a WorkerW on older builds; macOS: desktop-level NSWindow,
 *     see macos.ts).
 *   - exitWallpaper(win): unparent + restore normal window state.
 *
 * Each implementation is best-effort and idempotent. If the underlying
 * platform call fails (Win32 reparenting timing edge cases, elevated
 * process refusing SetParent, macOS bridge unavailable), the window is
 * left in a usable-but-not-wallpaper state and a warning is logged. The
 * caller (main.ts) updates the persisted mode either way so the user can
 * flip back via the tray.
 *
 * The platform implementations are loaded LAZILY, behind the
 * process.platform check, rather than via static top-level imports. This
 * matters: windows.ts runs `koffi.load('user32.dll')` at module-load time,
 * which is a dlopen that throws on macOS/Linux. A static `import` of
 * windows.ts would execute that side effect during this module's import —
 * before any platform branch runs — and crash the main process at boot on
 * non-Windows hosts. Lazy require keeps each impl's load-time side effects
 * scoped to the platform that can satisfy them. (macos.ts loads koffi too,
 * for the Objective-C bridge — same reasoning in the other direction.)
 */

import type { BrowserWindow, Display } from 'electron';

interface WallpaperImpl {
  enterWallpaper(win: BrowserWindow, display: Display): void;
  exitWallpaper(win: BrowserWindow): void;
}

let cachedImpl: WallpaperImpl | null = null;
let resolved = false;

/** Resolve (and memoize) the platform impl. Returns null on platforms with
 *  no wallpaper support (Linux), in which case the caller stays in window
 *  mode. The require is deferred so windows.ts's Win32 DLL loads only run
 *  on win32 (and macos.ts's libobjc load only on darwin). */
function platformImpl(): WallpaperImpl | null {
  if (resolved) return cachedImpl;
  resolved = true;
  if (process.platform === 'win32') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedImpl = require('./windows') as WallpaperImpl;
  } else if (process.platform === 'darwin') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedImpl = require('./macos') as WallpaperImpl;
  }
  return cachedImpl;
}

export function enterWallpaper(win: BrowserWindow, display: Display): void {
  const impl = platformImpl();
  if (impl) return impl.enterWallpaper(win, display);
  // eslint-disable-next-line no-console
  console.warn(`[wallpaper] platform ${process.platform} not supported; window mode only.`);
}

export function exitWallpaper(win: BrowserWindow): void {
  platformImpl()?.exitWallpaper(win);
}
