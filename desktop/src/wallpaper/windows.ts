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
 * Locate candidate windows for wallpaper reparenting. Three fallback
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
 * Returns ALL viable candidates in priority order. The caller tries each
 * in turn until SetParent actually succeeds — locating an HWND isn't the
 * same as Win32 accepting it as a parent. On some Win11 builds the chosen
 * WorkerW disallows reparenting and only Progman works.
 */
function findWallpaperParents(): Array<{ hwnd: Buffer; via: string }> {
  const progman = FindWindowW('Progman', null) as Buffer | null;
  if (!progman) return [];

  // Ask Explorer to spawn the WorkerW that sits between the wallpaper layer
  // and the icons. Windows builds disagree about the right wParam — 0x0D is
  // the most-documented value (Lively, Wallpaper-Engine teardowns), 0x0A is
  // the second-most. Sending BOTH (and previously 0, which is what we did
  // and which silently no-ops on some builds) maximises coverage. The call
  // is idempotent: Explorer reuses the spawned WorkerW if it already exists.
  const result = [BigInt(0)];
  for (const wparam of [BigInt(0x0d), BigInt(0x0a)]) {
    SendMessageTimeoutW(
      progman,
      SPAWN_WORKERW_MESSAGE,
      wparam,
      BigInt(0),
      SMTO_NORMAL,
      1000,
      result,
    );
  }

  const candidates: Array<{ hwnd: Buffer; via: string }> = [];

  // Strategy 1: WorkerW that owns SHELLDLL_DefView → use its next sibling.
  // Walk the full WorkerW chain, logging each so we can diagnose which
  // build we're on if reparenting still goes wrong.
  let prev: Buffer | null = null;
  let lastTopLevel: Buffer | null = null;
  let count = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const wW = FindWindowExW(null, prev, 'WorkerW', null) as Buffer | null;
    if (!wW) break;
    count += 1;
    lastTopLevel = wW;
    const shellView = FindWindowExW(wW, null, 'SHELLDLL_DefView', null) as Buffer | null;
    // eslint-disable-next-line no-console
    console.log(
      `[wallpaper:windows]   WorkerW #${count}${shellView ? ' (owns SHELLDLL_DefView)' : ''}`,
    );
    if (shellView) {
      const next = FindWindowExW(null, wW, 'WorkerW', null) as Buffer | null;
      if (next) candidates.push({ hwnd: next, via: 'WorkerW-after-DefView' });
    }
    prev = wW;
  }
  // eslint-disable-next-line no-console
  console.log(`[wallpaper:windows] enumerated ${count} top-level WorkerW(s)`);

  // Strategy 2: the last top-level WorkerW we saw above. Different HWND
  // from strategy 1's pick (strategy 1 returns the *sibling* of the DefView
  // owner). Has caused false positives on some Win11 builds where the last
  // WorkerW is a foreground animation surface rather than the wallpaper
  // layer — SetParent succeeds but you end up on top of icons. We try it
  // anyway so the retry loop can fall through to Progman if it goes wrong.
  if (lastTopLevel) candidates.push({ hwnd: lastTopLevel, via: 'last-top-level-WorkerW' });

  // Strategy 3: Progman itself. Always exists; last resort.
  candidates.push({ hwnd: progman, via: 'Progman-fallback' });

  return candidates;
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

export function enterWallpaper(win: BrowserWindow, display?: Display): void {
  try {
    const candidates = findWallpaperParents();
    if (candidates.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] could not locate Progman; staying in window mode');
      return;
    }

    preWallpaperBounds = win.getBounds();

    win.setSkipTaskbar(true);
    win.setIgnoreMouseEvents(true);

    const hwnd = electronHwnd(win);

    // Try each candidate parent in priority order. SetParent can return
    // null even when the candidate HWND is valid (Win11 has tightened
    // parent-window restrictions on certain WorkerW instances), so locating
    // is necessary but not sufficient — we need to actually verify the
    // reparent took. The previous code committed to whichever candidate
    // findWallpaperParent picked first and ate the failure.
    let success: { via: string } | null = null;
    for (const target of candidates) {
      const prevParent = SetParent(hwnd, target.hwnd);
      if (prevParent) {
        success = target;
        // eslint-disable-next-line no-console
        console.log(`[wallpaper:windows] reparented via ${target.via}`);
        break;
      }
      // eslint-disable-next-line no-console
      console.warn(`[wallpaper:windows] SetParent failed for ${target.via}; trying next`);
    }
    if (!success) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] all reparent strategies failed; staying in window mode');
      win.setSkipTaskbar(false);
      win.setIgnoreMouseEvents(false);
      preWallpaperBounds = null;
      return;
    }

    // Critical: flip WS_POPUP → WS_CHILD. Without this the reparented
    // window stays a popup logically and floats on top of WorkerW siblings.
    // This is the Lively/Wallpaper-Engine step most "just call SetParent"
    // tutorials skip — and the most likely cause of "tray toggled but
    // window didn't move."
    flipToChildStyle(hwnd);

    // Use Electron's screen API (DIPs, DPI-aware) instead of
    // GetSystemMetrics(SM_CXSCREEN) which returns physical pixels and
    // gives wrong sizes on scaled displays (most modern laptops run at
    // 125%/150%). Bounds applied twice — once immediately, once after
    // 100ms — because some Windows builds defer the WorkerW reparent and
    // the first setBounds doesn't take effect.
    //
    // Slice 5: target display is whichever the caller picked (multi-
    // monitor). null/undefined falls back to the primary display so
    // single-monitor users keep the old behavior unchanged.
    const targetDisplay = display ?? screen.getPrimaryDisplay();
    const { x, y, width, height } = targetDisplay.bounds;
    // eslint-disable-next-line no-console
    console.log(
      `[wallpaper:windows] sizing to ${width}×${height} at (${x}, ${y}); ` +
        `scale ${targetDisplay.scaleFactor}; display id ${targetDisplay.id}`,
    );
    win.setBounds({ x, y, width, height });
    setTimeout(() => {
      if (!win.isDestroyed()) win.setBounds({ x, y, width, height });
    }, 100);

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
