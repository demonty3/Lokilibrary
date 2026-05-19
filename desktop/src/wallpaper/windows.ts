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

// --- Constants --------------------------------------------------------------

const SPAWN_WORKERW_MESSAGE = 0x052c;
const SMTO_NORMAL = 0x0000;
const SW_SHOW = 5;
const SM_CXSCREEN = 0;
const SM_CYSCREEN = 1;

// Remember the bounds we had before entering wallpaper mode so we can put
// the window back exactly where it was when the user toggles out.
let preWallpaperBounds: Rectangle | null = null;

function electronHwnd(win: BrowserWindow): Buffer {
  // Electron's getNativeWindowHandle returns a Buffer; on Windows it's
  // 8 bytes (HWND) on x64. koffi accepts the Buffer directly as void*.
  return win.getNativeWindowHandle();
}

function findOurWorkerW(): Buffer | null {
  const progman = FindWindowW('Progman', null) as Buffer | null;
  if (!progman) return null;

  // Step 2: ask Progman to spawn the WorkerW. Idempotent — Progman won't
  // create duplicates if one already exists for our session.
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

  // Step 3: walk the top-level WorkerW siblings to find the one Progman
  // tucked behind SHELLDLL_DefView. The standard pattern: iterate WorkerWs
  // and check each for a SHELLDLL_DefView child. The WorkerW we want is
  // the OTHER one (sibling of the WorkerW that owns the icons).
  let prev: Buffer | null = null;
  let target: Buffer | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const workerW = FindWindowExW(null as unknown as Buffer, prev as unknown as Buffer, 'WorkerW', null) as Buffer | null;
    if (!workerW) break;
    const shellView = FindWindowExW(workerW, null as unknown as Buffer, 'SHELLDLL_DefView', null) as Buffer | null;
    if (shellView) {
      // This WorkerW owns the icons; the next sibling is ours.
      target = FindWindowExW(null as unknown as Buffer, workerW, 'WorkerW', null) as Buffer | null;
      break;
    }
    prev = workerW;
  }
  return target;
}

export function enterWallpaper(win: BrowserWindow): void {
  try {
    const target = findOurWorkerW();
    if (!target) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] could not locate WorkerW; staying in window mode');
      return;
    }

    preWallpaperBounds = win.getBounds();

    // Pre-reparent window styling: frameless, ignore alt-tab/taskbar, no
    // border. Some of these must be set before SetParent for stability.
    win.setSkipTaskbar(true);
    win.setIgnoreMouseEvents(true);

    const hwnd = electronHwnd(win);
    const prevParent = SetParent(hwnd, target);
    if (!prevParent) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] SetParent returned null; reparenting may have failed');
    }

    // Resize to fill the primary monitor. Multi-monitor support is slice 5.
    const screenW = Number(GetSystemMetrics(SM_CXSCREEN)) || 1920;
    const screenH = Number(GetSystemMetrics(SM_CYSCREEN)) || 1080;
    win.setBounds({ x: 0, y: 0, width: screenW, height: screenH });

    // Show explicitly — reparenting can leave the window in a state where
    // it's drawn but not present.
    ShowWindow(hwnd, SW_SHOW);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] enter failed:', (e as Error).message);
  }
}

export function exitWallpaper(win: BrowserWindow): void {
  try {
    const hwnd = electronHwnd(win);
    SetParent(hwnd, null as unknown as Buffer);

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
