/**
 * Windows wallpaper mode — bottom-of-z-order strategy.
 *
 * The "canonical" approach (Wallpaper Engine, Lively, slice-4 of this
 * project) is Progman/WorkerW reparenting via SetParent. That fails with
 * ERROR_INVALID_WINDOW_HANDLE (1400) on Win11 22H2+ where cross-process
 * SetParent against Progman/WorkerW is blocked by tightened UIPI
 * restrictions. We confirmed this on the developer's machine: SetParent
 * rejected both WorkerW and Progman as invalid even after restarting
 * Explorer to clear zombie WorkerWs.
 *
 * This implementation skips reparenting entirely and uses the always-
 * available `SetWindowPos(hwnd, HWND_BOTTOM, …, SWP_NOACTIVATE)` to push
 * the Electron window to the BOTTOM of the regular z-order. A 2-second
 * watchdog re-applies the bottom-pin so apps that grab the foreground
 * don't permanently float above us.
 *
 * Tradeoffs vs true WorkerW reparenting:
 *   - Not in the actual wallpaper layer. Minimised windows briefly cover
 *     us during the minimise animation. Apps that explicitly set
 *     HWND_TOPMOST stay above us until they release topmost.
 *   - No desktop-transparency compositing — taskbar transparency etc.
 *     looks through to a regular window, not the wallpaper, so the visual
 *     stack is slightly different.
 *   - On the upside: works on any Windows version, no Win32 hacks, no
 *     cross-process restrictions.
 *
 * WS_EX_TOOLWINDOW is applied to hide the window from Alt+Tab and the
 * taskbar (in addition to Electron's `setSkipTaskbar(true)`, which only
 * affects the taskbar layer in some configurations).
 *
 * koffi handles the FFI. It ships prebuilt binaries for win32-x64 so
 * `npm install` doesn't need MSVC build tools.
 */

import { screen, type BrowserWindow, type Display, type Rectangle } from 'electron';

// koffi doesn't ship a .d.ts; we use a minimal shape that covers the calls
// we actually make. The runtime contract is stable across koffi 3.x.
interface Koffi {
  load(name: string): {
    func(signature: string): (...args: unknown[]) => unknown;
  };
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require('koffi') as Koffi;

// --- Win32 type bindings ----------------------------------------------------

const user32 = koffi.load('user32.dll');

// `hWndInsertAfter` is intptr because the API uses sentinel values
// (HWND_BOTTOM = 1, HWND_TOP = 0, HWND_TOPMOST = -1, HWND_NOTOPMOST = -2).
// `hWnd` stays void* because we always pass a real Buffer-wrapped HWND there.
const SetWindowPos = user32.func(
  'bool SetWindowPos(void* hWnd, intptr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)',
);
const SetWindowLongPtrW = user32.func(
  'intptr SetWindowLongPtrW(void* hWnd, int nIndex, intptr dwNewLong)',
);
const GetWindowLongPtrW = user32.func(
  'intptr GetWindowLongPtrW(void* hWnd, int nIndex)',
);

// --- Constants --------------------------------------------------------------

// SetWindowPos sentinels (winuser.h)
const HWND_BOTTOM = 1n;
const HWND_NOTOPMOST = -2n;

// SetWindowPos flags
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;

// Window style constants (winuser.h)
const GWL_EXSTYLE = -20;
const WS_EX_APPWINDOW = 0x00040000n;
const WS_EX_TOOLWINDOW = 0x00000080n;

// 2 seconds — frequent enough to recover quickly when another app pushes
// us up the z-order, rare enough that SetWindowPos overhead is negligible.
const REPIN_INTERVAL_MS = 2000;

// --- Module state -----------------------------------------------------------

let preWallpaperBounds: Rectangle | null = null;
let repinInterval: NodeJS.Timeout | null = null;

// --- Helpers ----------------------------------------------------------------

function electronHwnd(win: BrowserWindow): Buffer {
  // Electron's getNativeWindowHandle returns a Buffer; on Windows it's
  // 8 bytes (HWND) on x64. koffi accepts the Buffer directly as void*.
  return win.getNativeWindowHandle();
}

/** WS_EX_APPWINDOW → WS_EX_TOOLWINDOW removes the window from Alt+Tab and
 *  the taskbar via the window's extended style, complementing Electron's
 *  setSkipTaskbar(true). The two together are belt-and-braces. */
function applyToolWindowStyle(hwnd: Buffer): void {
  const exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as bigint;
  const newExStyle = (BigInt(exStyle) & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, newExStyle);
}

function restoreAppWindowStyle(hwnd: Buffer): void {
  const exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as bigint;
  const newExStyle = (BigInt(exStyle) & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW;
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, newExStyle);
}

function pinToBottom(hwnd: Buffer): void {
  // X/Y/cx/cy are ignored because SWP_NOMOVE + SWP_NOSIZE are set; we just
  // shuffle the z-order without disturbing position or size. SWP_NOACTIVATE
  // is critical: without it, pinning to bottom would steal focus from the
  // user's actual foreground app every time the watchdog ticks.
  SetWindowPos(
    hwnd,
    HWND_BOTTOM,
    0,
    0,
    0,
    0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
  );
}

// --- Public API -------------------------------------------------------------

export function enterWallpaper(win: BrowserWindow, display?: Display): void {
  try {
    preWallpaperBounds = win.getBounds();
    win.setSkipTaskbar(true);
    win.setIgnoreMouseEvents(true);

    const hwnd = electronHwnd(win);
    applyToolWindowStyle(hwnd);

    // Slice 5: target display is whichever the caller picked (multi-
    // monitor). null/undefined falls back to the primary display so
    // single-monitor users keep the old behaviour unchanged.
    const targetDisplay = display ?? screen.getPrimaryDisplay();
    const { x, y, width, height } = targetDisplay.bounds;
    // eslint-disable-next-line no-console
    console.log(
      `[wallpaper:windows] sizing to ${width}×${height} at (${x}, ${y}); ` +
        `scale ${targetDisplay.scaleFactor}; display id ${targetDisplay.id}`,
    );
    win.setBounds({ x, y, width, height });
    // Apply bounds twice — once now, once after 100ms — because some
    // Windows builds defer the style change and the first setBounds gets
    // discarded if it lands during the WM_STYLECHANGED propagation.
    setTimeout(() => {
      if (!win.isDestroyed()) win.setBounds({ x, y, width, height });
    }, 100);

    pinToBottom(hwnd);
    // eslint-disable-next-line no-console
    console.log('[wallpaper:windows] pinned to bottom of z-order');

    // Watchdog: re-pin every REPIN_INTERVAL_MS. When the user clicks
    // another app, Windows promotes that app's window up the z-order
    // without affecting ours, so this is usually a no-op. But when the
    // foreground app explicitly raises z-order (e.g. some installers,
    // some games' fullscreen-borderless), our window can end up not at
    // bottom; the next tick re-asserts bottom-pin without stealing focus.
    if (repinInterval) clearInterval(repinInterval);
    repinInterval = setInterval(() => {
      if (win.isDestroyed()) {
        if (repinInterval) clearInterval(repinInterval);
        repinInterval = null;
        return;
      }
      pinToBottom(hwnd);
    }, REPIN_INTERVAL_MS);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] enter failed:', (e as Error).message);
  }
}

export function exitWallpaper(win: BrowserWindow): void {
  try {
    if (repinInterval) {
      clearInterval(repinInterval);
      repinInterval = null;
    }

    const hwnd = electronHwnd(win);
    restoreAppWindowStyle(hwnd);

    // HWND_NOTOPMOST lifts the window OUT of bottom-pin into normal z-order.
    // The window doesn't gain focus (SWP_NOACTIVATE) — togglePeek calls
    // setAlwaysOnTop(true) + focus() afterwards if it wants foreground.
    SetWindowPos(
      hwnd,
      HWND_NOTOPMOST,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
    );

    win.setIgnoreMouseEvents(false);
    win.setSkipTaskbar(false);
    if (preWallpaperBounds) {
      win.setBounds(preWallpaperBounds);
      preWallpaperBounds = null;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] exit failed:', (e as Error).message);
  }
}
