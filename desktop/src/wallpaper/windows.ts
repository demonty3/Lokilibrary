/**
 * Windows WorkerW reparenting — the "draw behind desktop icons" trick.
 *
 * The canonical pattern (used by Wallpaper Engine, Lively Wallpaper, every
 * open-source live-wallpaper tool):
 *
 *   1. FindWindow("Progman", null) — the desktop shell's root window.
 *   2. SendMessageTimeout(Progman, 0x052C, 0, 0, ...) — the magic message
 *      that asks Progman to spawn a new WorkerW positioned between the
 *      wallpaper layer and the icons. Undocumented officially but stable
 *      across Windows 10/11.
 *   3. Enumerate top-level WorkerW siblings. The one we want is the WorkerW
 *      that comes immediately AFTER a WorkerW whose child is SHELLDLL_DefView.
 *      (Progman owns SHELLDLL_DefView, which contains the icons. The new
 *      WorkerW from step 2 is its sibling.)
 *   4. SetParent(electronHwnd, workerW) — reparent our Electron window.
 *   5. Resize the window to fill the primary monitor.
 *
 * Exiting is simpler: SetParent(electronHwnd, NULL) re-attaches our window
 * to the desktop, then we restore the window's pre-wallpaper bounds.
 *
 * koffi handles the FFI. It ships prebuilt binaries for win32-x64 so
 * `npm install` doesn't need MSVC build tools.
 */

import type { BrowserWindow, Rectangle } from 'electron';

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
// koffi's syntax: types are strings or `koffi.pointer(...)`. We model HWND
// as an opaque void pointer.

const user32 = koffi.load('user32.dll');

const FindWindowW = user32.func(
  'void* FindWindowW(str16 lpClassName, str16 lpWindowName)',
);
const FindWindowExW = user32.func(
  'void* FindWindowExW(void* hWndParent, void* hWndChildAfter, str16 lpClassName, str16 lpWindowName)',
);
const SendMessageTimeoutW = user32.func(
  'long SendMessageTimeoutW(void* hWnd, uint Msg, uintptr wParam, intptr lParam, uint fuFlags, uint uTimeout, _Out_ uintptr* lpdwResult)',
);
const SetParent = user32.func('void* SetParent(void* hWndChild, void* hWndNewParent)');
const ShowWindow = user32.func('bool ShowWindow(void* hWnd, int nCmdShow)');
const GetSystemMetrics = user32.func('int GetSystemMetrics(int nIndex)');
// Window styles need to flip from WS_POPUP → WS_CHILD after SetParent so
// the reparented Electron window actually behaves as a child of WorkerW.
// SetWindowLongPtrW is the 64-bit-safe variant of SetWindowLongW.
const SetWindowLongPtrW = user32.func(
  'intptr SetWindowLongPtrW(void* hWnd, int nIndex, intptr dwNewLong)',
);
const GetWindowLongPtrW = user32.func(
  'intptr GetWindowLongPtrW(void* hWnd, int nIndex)',
);

// --- Constants --------------------------------------------------------------

const SPAWN_WORKERW_MESSAGE = 0x052c;
const SMTO_NORMAL = 0x0000;
const SW_SHOW = 5;
const SM_CXSCREEN = 0;
const SM_CYSCREEN = 1;

// Window style constants (winuser.h).
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_POPUP = 0x80000000n;
const WS_CHILD = 0x40000000n;
const WS_EX_APPWINDOW = 0x00040000n;
const WS_EX_TOOLWINDOW = 0x00000080n;

// Remember the bounds we had before entering wallpaper mode so we can put
// the window back exactly where it was when the user toggles out.
let preWallpaperBounds: Rectangle | null = null;

function electronHwnd(win: BrowserWindow): Buffer {
  // Electron's getNativeWindowHandle returns a Buffer; on Windows it's
  // 8 bytes (HWND) on x64. koffi accepts the Buffer directly as void*.
  return win.getNativeWindowHandle();
}

/**
 * Locate a window suitable to be our wallpaper parent. Three fallback
 * strategies — Windows builds disagree about where SHELLDLL_DefView lives:
 *
 *   1. The canonical Lively pattern: find a top-level WorkerW that owns
 *      SHELLDLL_DefView, and use the NEXT WorkerW sibling. This works on
 *      Win10 + most Win11 builds.
 *   2. If no DefView-owning WorkerW exists, pick the LAST top-level WorkerW
 *      that exists after the SendMessage. On some Win11 configs DefView
 *      stays a direct child of Progman, but Explorer still spawns a fresh
 *      WorkerW we can reparent under.
 *   3. Fall back to Progman itself. Reparenting under Progman puts us
 *      behind the icons but in front of the wallpaper. Less clean (icons
 *      will composite on top of us only because they're a higher child of
 *      Progman) but reliable: Progman always exists on a shelled session.
 *
 * Returns the picked HWND + a label for diagnostic logging.
 */
function findWallpaperParent(): { hwnd: Buffer; via: string } | null {
  const progman = FindWindowW('Progman', null) as Buffer | null;
  if (!progman) return null;

  // Send the magic message asking Explorer to spawn the WorkerW that sits
  // between the wallpaper layer and the icons. Idempotent across calls.
  const result = [BigInt(0)];
  SendMessageTimeoutW(
    progman,
    SPAWN_WORKERW_MESSAGE,
    BigInt(0),
    BigInt(0),
    SMTO_NORMAL,
    1000,
    result,
  );

  // Strategy 1: WorkerW that owns SHELLDLL_DefView → use its next sibling.
  let prev: Buffer | null = null;
  let lastTopLevel: Buffer | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const wW = FindWindowExW(null, prev, 'WorkerW', null) as Buffer | null;
    if (!wW) break;
    lastTopLevel = wW;
    const shellView = FindWindowExW(wW, null, 'SHELLDLL_DefView', null) as Buffer | null;
    if (shellView) {
      const next = FindWindowExW(null, wW, 'WorkerW', null) as Buffer | null;
      if (next) return { hwnd: next, via: 'WorkerW-after-DefView' };
    }
    prev = wW;
  }

  // Strategy 2: just pick the last top-level WorkerW we saw above.
  if (lastTopLevel) return { hwnd: lastTopLevel, via: 'last-top-level-WorkerW' };

  // Strategy 3: fall back to Progman.
  return { hwnd: progman, via: 'Progman-fallback' };
}

/**
 * After SetParent, the window needs WS_CHILD style (was WS_POPUP). Also
 * remove WS_EX_APPWINDOW (otherwise it still appears in Alt-Tab/taskbar)
 * and set WS_EX_TOOLWINDOW (hides from taskbar). This is the canonical
 * Electron + WorkerW gotcha — SetParent alone doesn't flip these styles.
 */
function flipToChildStyle(hwnd: Buffer): void {
  const style = GetWindowLongPtrW(hwnd, GWL_STYLE) as bigint;
  const newStyle = (BigInt(style) & ~WS_POPUP) | WS_CHILD;
  SetWindowLongPtrW(hwnd, GWL_STYLE, newStyle);

  const exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as bigint;
  const newExStyle = (BigInt(exStyle) & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, newExStyle);
}

function flipToPopupStyle(hwnd: Buffer): void {
  const style = GetWindowLongPtrW(hwnd, GWL_STYLE) as bigint;
  const newStyle = (BigInt(style) & ~WS_CHILD) | WS_POPUP;
  SetWindowLongPtrW(hwnd, GWL_STYLE, newStyle);

  const exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as bigint;
  const newExStyle = (BigInt(exStyle) & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW;
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, newExStyle);
}

export function enterWallpaper(win: BrowserWindow): void {
  try {
    const target = findWallpaperParent();
    if (!target) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] could not locate Progman; staying in window mode');
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[wallpaper:windows] reparenting via ${target.via}`);

    preWallpaperBounds = win.getBounds();

    win.setSkipTaskbar(true);
    win.setIgnoreMouseEvents(true);

    const hwnd = electronHwnd(win);
    const prevParent = SetParent(hwnd, target.hwnd);
    if (!prevParent) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] SetParent returned null; reparenting likely failed');
    }

    // Critical: flip WS_POPUP → WS_CHILD. Without this the reparented
    // window stays a popup logically and floats on top of WorkerW siblings.
    // This is the Lively/Wallpaper-Engine step most "just call SetParent"
    // tutorials skip — and the most likely cause of "tray toggled but
    // window didn't move."
    flipToChildStyle(hwnd);

    const screenW = Number(GetSystemMetrics(SM_CXSCREEN)) || 1920;
    const screenH = Number(GetSystemMetrics(SM_CYSCREEN)) || 1080;
    win.setBounds({ x: 0, y: 0, width: screenW, height: screenH });

    ShowWindow(hwnd, SW_SHOW);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] enter failed:', (e as Error).message);
  }
}

export function exitWallpaper(win: BrowserWindow): void {
  try {
    const hwnd = electronHwnd(win);

    // Restore WS_POPUP before unparenting so the window is a proper
    // standalone again after SetParent(NULL).
    flipToPopupStyle(hwnd);
    SetParent(hwnd, null);

    win.setIgnoreMouseEvents(false);
    win.setSkipTaskbar(false);
    if (preWallpaperBounds) {
      win.setBounds(preWallpaperBounds);
      preWallpaperBounds = null;
    }

    ShowWindow(hwnd, SW_SHOW);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] exit failed:', (e as Error).message);
  }
}
