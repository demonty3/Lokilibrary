/**
 * Windows wallpaper mode — Progman/WorkerW reparenting, Lively-style.
 *
 * Ported from rocksdanister/lively's WinDesktopCore.cs (open-source,
 * `asInvoker` integrity). Two code paths, branched on whether Win11
 * 22H2+'s "raised desktop" (HDR wallpaper refactor) is active:
 *
 *   - Raised-desktop branch (Win11 22H2+ when Progman has
 *     WS_EX_NOREDIRECTIONBITMAP): SetParent target is **Progman itself**,
 *     not any WorkerW. Apply WS_EX_LAYERED + SetLayeredWindowAttributes
 *     BEFORE SetParent (Godot-quirk per Lively source — also fires on
 *     Chromium). Then SetWindowPos(hwnd, SHELLDLL_DefView, …) slots us
 *     between DefView (icons, on top) and WorkerW (under).
 *
 *   - Classic branch (pre-22H2 or no raised desktop): enumerate top-
 *     level windows, find the WorkerW whose next sibling has
 *     SHELLDLL_DefView as a child, SetParent to that WorkerW.
 *
 * Both branches:
 *   - Refuse to enter wallpaper mode if running as administrator —
 *     elevated Electron's SetParent against Progman still 1400s on
 *     22H2+. Lively documents the same gotcha.
 *   - 2-second polling watchdog re-attaches if WorkerW gets destroyed
 *     (DWM does this on HDR / Copilot / display-mode changes on 22H2+;
 *     does NOT auto-recreate, so we re-SendMessage Progman before re-
 *     SetParent). SetWinEventHook does not work from Node because
 *     WINEVENT_OUTOFCONTEXT dispatches via the target thread's message
 *     queue and Node doesn't pump one.
 *
 * koffi handles the FFI. It ships prebuilt binaries for win32-x64 so
 * `npm install` doesn't need MSVC build tools.
 */

import { screen, type BrowserWindow, type Display, type Rectangle } from 'electron';

interface Koffi {
  load(name: string): {
    func(signature: string): (...args: unknown[]) => unknown;
  };
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require('koffi') as Koffi;

// --- Win32 bindings ---------------------------------------------------------

const user32 = koffi.load('user32.dll');
const shell32 = koffi.load('shell32.dll');
const kernel32 = koffi.load('kernel32.dll');

// hWndInsertAfter is void* not intptr: we always pass a real HWND
// (SHELLDLL_DefView) here, which comes back from FindWindowExW as a
// Buffer wrapping the pointer. koffi marshals Buffer→void* but not
// Buffer→intptr, hence the explicit void*. Sentinel values like
// HWND_BOTTOM=1 / HWND_NOTOPMOST=-2 would need a different binding;
// we don't use them in this revival.
const SetWindowPos = user32.func(
  'bool SetWindowPos(void* hWnd, void* hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)',
);
const SetWindowLongPtrW = user32.func(
  'intptr SetWindowLongPtrW(void* hWnd, int nIndex, intptr dwNewLong)',
);
const GetWindowLongPtrW = user32.func(
  'intptr GetWindowLongPtrW(void* hWnd, int nIndex)',
);
// EXSTYLE fits in 32 bits; the W variant is simpler than the LongPtr form
// for the WS_EX_NOREDIRECTIONBITMAP probe on Progman.
const GetWindowLongW = user32.func('long GetWindowLongW(void* hWnd, int nIndex)');
const SendMessageTimeoutW = user32.func(
  'void* SendMessageTimeoutW(void* hWnd, uint Msg, uintptr wParam, intptr lParam, uint fuFlags, uint uTimeout, _Out_ uintptr* lpdwResult)',
);
const FindWindowExW = user32.func(
  'void* FindWindowExW(void* hWndParent, void* hWndChildAfter, str16 lpszClass, str16 lpszWindow)',
);
const SetParent = user32.func('void* SetParent(void* hWndChild, void* hWndNewParent)');
const GetShellWindow = user32.func('void* GetShellWindow()');
const IsWindow = user32.func('bool IsWindow(void* hWnd)');
const IsUserAnAdmin = shell32.func('bool IsUserAnAdmin()');
const GetLastError = kernel32.func('uint GetLastError()');

// --- Constants --------------------------------------------------------------

// Progman magic message — causes Progman to spawn a fresh WorkerW between
// the static wallpaper and the icon layer. wParam 0xD has been the canonical
// value since Win8; Lively also tries 0xA on some builds, but 0xD is fine
// on Win10 + Win11 in our testing.
const WM_SPAWN_WORKER = 0x052c;
const WM_SPAWN_WPARAM = 0xd;
const WM_SPAWN_LPARAM = 0x1;
const SMTO_NORMAL = 0;
const SPAWN_TIMEOUT_MS = 1000;

const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;

// Window styles (winuser.h)
const WS_CHILD = 0x40000000n;
const WS_POPUP = 0x80000000n;
const WS_CAPTION = 0x00c00000n;
const WS_THICKFRAME = 0x00040000n;
const WS_MINIMIZEBOX = 0x00020000n;
const WS_MAXIMIZEBOX = 0x00010000n;
const WS_SYSMENU = 0x00080000n;
const WS_EX_APPWINDOW = 0x00040000n;
const WS_EX_TOOLWINDOW = 0x00000080n;
// Raised-desktop flag — Microsoft set this on Progman starting with the
// Win11 22H2 HDR-wallpaper refactor. Authoritative check for the new
// reparent topology; don't rely on build number alone (some Insider builds
// toggle it independently of the displayed version string).
const WS_EX_NOREDIRECTIONBITMAP = 0x00200000;

// SetWindowPos flags
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
// Forces Windows to send WM_NCCALCSIZE and apply pending GWL_STYLE
// changes. Without it, SetWindowLong-style changes can be invisible
// to subsequent SetParent calls — explains why our WS_CHILD set is
// silently no-op'd in earlier runs.
const SWP_FRAMECHANGED = 0x0020;

// Polling interval for WorkerW liveness check. 2s is frequent enough to
// recover ~one display-mode-change before the user notices a black wallpaper,
// rare enough that IsWindow overhead is negligible.
const WATCHDOG_INTERVAL_MS = 2000;

// --- Module state -----------------------------------------------------------

interface WallpaperState {
  /** Re-entrant guard so a watchdog re-attach doesn't race with a user toggle. */
  attaching: boolean;
  /** The WorkerW handle we're tracking — for IsWindow watchdog. Null when in
   *  raised-desktop mode (we target Progman directly, not a WorkerW). */
  trackedWorkerW: Buffer | null;
  /** Window bounds at the moment we entered wallpaper mode — restored on exit. */
  preWallpaperBounds: Rectangle | null;
  /** GWL_STYLE on entry — restored on exit. WS_CHILD has to be set manually
   *  before SetParent (MSDN docs) and unset on exit; the rest of the bits
   *  go back to what Electron originally configured. */
  preWallpaperStyle: bigint | null;
  /** GWL_EXSTYLE on entry — restored on exit so window mode comes back clean. */
  preWallpaperExStyle: bigint | null;
  /** Whether the raised-desktop (Win11 22H2+) branch was taken on enter. */
  raisedDesktopOnEnter: boolean;
  watchdog: NodeJS.Timeout | null;
  /** Phase 4B: the display we entered wallpaper mode on. The watchdog
   *  re-attaches to the SAME display on WorkerW destruction (no
   *  surprise jumps to the primary mid-session). Null when not in
   *  wallpaper mode. Cleared by exitWallpaper. */
  lastDisplay: Display | null;
}

const state: WallpaperState = {
  attaching: false,
  trackedWorkerW: null,
  preWallpaperBounds: null,
  preWallpaperStyle: null,
  preWallpaperExStyle: null,
  raisedDesktopOnEnter: false,
  watchdog: null,
  lastDisplay: null,
};

// --- Helpers ----------------------------------------------------------------

/** Electron returns the HWND as a Buffer wrapping 8 raw bytes (on x64).
 *
 * koffi marshals Node Buffers passed for `void*` as "pointer to the
 * buffer's memory" — i.e. it passes the buffer's heap address, NOT the
 * pointer value stored inside. That's correct for output buffers
 * (WriteFile lpBuffer etc.) but completely wrong for HWND-as-handle.
 *
 * On Windows, HWND is a pointer-sized opaque handle. The buffer's first
 * 8 bytes ARE the HWND value (little-endian on x64). We read those bytes
 * and pass the resulting bigint — koffi accepts bigint for `void*`
 * Win32 handle parameters per its docs. This is why our SetWindowPos,
 * SetParent, and SetWindowLong calls on our own window were failing
 * with ERROR_INVALID_WINDOW_HANDLE (1400) even though GetWindowLong on
 * Progman worked: Progman came from a koffi-returned `void*` (which
 * koffi unwraps transparently), but Electron's hwnd was a foreign
 * Buffer that got its address passed by mistake.
 */
function electronHwnd(win: BrowserWindow): bigint {
  return win.getNativeWindowHandle().readBigInt64LE(0);
}

/** Spawn the "live wallpaper" WorkerW by poking Progman with the magic
 *  message. Idempotent — repeat calls don't stack WorkerWs because Progman
 *  recognises the spawn request and either spawns once or returns the
 *  existing one. */
function spawnWorkerW(progman: Buffer): void {
  // koffi `_Out_` params expect a 1-element array we read back; we discard
  // the result here (only used for synchronisation).
  const result: bigint[] = [0n];
  SendMessageTimeoutW(
    progman,
    WM_SPAWN_WORKER,
    WM_SPAWN_WPARAM,
    WM_SPAWN_LPARAM,
    SMTO_NORMAL,
    SPAWN_TIMEOUT_MS,
    result,
  );
}

/** Returns true if Progman has WS_EX_NOREDIRECTIONBITMAP set — the
 *  authoritative signal that we're on the Win11 22H2+ raised-desktop
 *  topology where the wallpaper WorkerW is a CHILD of Progman, not a
 *  top-level sibling, and where SetParent must target Progman. */
function isRaisedDesktop(progman: Buffer): boolean {
  const exStyle = GetWindowLongW(progman, GWL_EXSTYLE) as number;
  return (exStyle & WS_EX_NOREDIRECTIONBITMAP) !== 0;
}

/** Classic (pre-22H2) reparent target: find the WorkerW that sits behind
 *  SHELLDLL_DefView (the icon layer). On older Windows the topology is
 *  Progman → WorkerW(icons via SHELLDLL_DefView), WorkerW(wallpaper) at
 *  top-level; we want the latter. Walk top-level WorkerWs; for each, check
 *  if its sibling has SHELLDLL_DefView. The one whose sibling DOES is the
 *  one we want — Lively walks the same path. */
function findClassicWorkerW(): Buffer | null {
  let prev: Buffer | null = null;
  // FindWindowExW returns NULL when exhausted. Caps at 50 to avoid an
  // infinite loop if something goes very wrong.
  for (let i = 0; i < 50; i++) {
    const next = FindWindowExW(null, prev, 'WorkerW', null) as Buffer | null;
    if (!next) break;
    // Does THIS workerW host the icon DefView? If so, the previous one we
    // saw is the wallpaper-host (or there isn't one yet — caller should
    // spawnWorkerW first).
    const defView = FindWindowExW(next, null, 'SHELLDLL_DefView', null) as Buffer | null;
    if (defView && prev) {
      return prev;
    }
    prev = next;
  }
  return null;
}

/** Raised-desktop child WorkerW — for diagnostic logging only. On Win11
 *  22H2+ the wallpaper WorkerW is a child of Progman; we don't reparent
 *  to it, but we do watchdog its liveness. */
function findRaisedWorkerW(progman: Buffer): Buffer | null {
  return (FindWindowExW(progman, null, 'WorkerW', null) as Buffer | null) ?? null;
}

function applyToolWindowExStyle(hwnd: bigint): bigint {
  // WS_EX_LAYERED is in Lively's flow for Godot wallpapers, but Chromium
  // doesn't paint correctly through a layered child window (compositor
  // assumes WM_PAINT semantics, which layered windows hijack). Without
  // WS_EX_LAYERED the window renders black for us. We don't need it
  // (alpha=1, no transparency requirement), so we skip it entirely.
  const exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as bigint;
  const newExStyle = (BigInt(exStyle) & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, newExStyle);
  return exStyle;
}

/** Flip the window from "top-level overlapped" to "child" style.
 *
 * Per MSDN SetParent docs: "if hWndNewParent is not NULL and the window
 * was previously a child of the desktop, you should clear the WS_POPUP
 * style and set the WS_CHILD style before the window becomes a child of
 * the new window." Skipping this step is why our first wallpaper-mode
 * attempts on Win11 22H2+ ended up with SetParent succeeding-but-not-
 * really and SetWindowPos failing to z-order against a sibling.
 *
 * Also strips the chrome bits (caption, thick frame, min/max/sysmenu)
 * so the window doesn't render its title bar inside the wallpaper layer. */
function applyChildStyle(hwnd: bigint): bigint {
  const style = GetWindowLongPtrW(hwnd, GWL_STYLE) as bigint;
  const stripped =
    BigInt(style) &
    ~WS_POPUP &
    ~WS_CAPTION &
    ~WS_THICKFRAME &
    ~WS_MINIMIZEBOX &
    ~WS_MAXIMIZEBOX &
    ~WS_SYSMENU;
  const newStyle = stripped | WS_CHILD;
  SetWindowLongPtrW(hwnd, GWL_STYLE, newStyle);
  return style;
}

function restoreStyle(hwnd: bigint, original: bigint): void {
  SetWindowLongPtrW(hwnd, GWL_STYLE, original);
}

function restoreExStyle(hwnd: bigint, original: bigint): void {
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, original);
}

// --- Public API -------------------------------------------------------------

export function enterWallpaper(win: BrowserWindow, display: Display): void {
  // Re-entrant guard against concurrent user-toggle and watchdog re-attach.
  if (state.attaching) {
    // eslint-disable-next-line no-console
    console.log('[wallpaper:windows] enter skipped — attach in progress');
    return;
  }
  state.attaching = true;
  state.lastDisplay = display;
  try {
    // Lively gotcha: SetParent against Progman returns ERROR_INVALID_WINDOW_HANDLE
    // (1400) when the caller process is elevated, even on the raised-desktop
    // path. Refuse and keep the user in window mode — better than a silently
    // broken wallpaper.
    const elevated = IsUserAnAdmin() as boolean;
    // eslint-disable-next-line no-console
    console.log(`[wallpaper:windows] IsUserAnAdmin = ${elevated}`);
    if (elevated) {
      // eslint-disable-next-line no-console
      console.warn(
        '[wallpaper:windows] running as administrator — SetParent against Progman ' +
          'fails under UIPI for elevated processes. Restart without admin to enable ' +
          'wallpaper mode.',
      );
      return;
    }

    const progman = GetShellWindow() as Buffer | null;
    if (!progman) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:windows] GetShellWindow returned null — Progman unreachable');
      return;
    }

    spawnWorkerW(progman);
    const raised = isRaisedDesktop(progman);
    state.raisedDesktopOnEnter = raised;
    // eslint-disable-next-line no-console
    console.log(`[wallpaper:windows] raised-desktop = ${raised}`);

    state.preWallpaperBounds = win.getBounds();
    win.setSkipTaskbar(true);
    win.setIgnoreMouseEvents(true);

    const hwnd = electronHwnd(win);

    // Pre-size the window to the *chosen* display while it's still
    // top-level. Phase 4B: this used to be hard-coded to the primary
    // display; the picker passes whichever monitor the user selected
    // (or the primary as fallback when no id is persisted / the
    // persisted id no longer matches a connected monitor — see
    // `resolveTargetDisplay` in main.ts / display-picker.ts).
    //
    // Matches Lively's order (sizing first, then style flips, then
    // SetParent) and gives Windows a chance to settle before we change
    // the style. Progman/SetParent positioning is virtual-screen-
    // relative, so the same setBounds() call works for any monitor —
    // the (x, y) in display.bounds is the monitor's origin in the
    // virtual desktop coordinate space.
    const { x, y, width, height } = display.bounds;
    // eslint-disable-next-line no-console
    console.log(
      `[wallpaper:windows] sizing to ${width}×${height} at (${x}, ${y}); ` +
        `scale ${display.scaleFactor} (display ${display.id}` +
        `${display.id === screen.getPrimaryDisplay().id ? ', primary' : ''})`,
    );
    win.setBounds({ x, y, width, height });

    // Style flips, BEFORE SetParent:
    //   - GWL_STYLE: clear WS_POPUP + chrome bits, set WS_CHILD. MSDN
    //     SetParent docs require this manually; without it SetParent
    //     succeeds-but-not-really and subsequent SetWindowPos against a
    //     sibling fails because we're not actually a sibling yet.
    //   - GWL_EXSTYLE: tool-window style so we don't appear in Alt+Tab
    //     or the taskbar. (Not strictly required for child windows but
    //     belt-and-braces.)
    state.preWallpaperStyle = applyChildStyle(hwnd);
    state.preWallpaperExStyle = applyToolWindowExStyle(hwnd);

    // SetWindowLong-style changes don't fully take effect until a
    // SetWindowPos with SWP_FRAMECHANGED triggers WM_NCCALCSIZE. Without
    // this, SetParent sees the OLD style bits (WS_POPUP still set, no
    // WS_CHILD), rejects the reparent with ERROR_INVALID_WINDOW_HANDLE
    // (1400). This was the root cause of the first run failures even
    // after the WS_CHILD code was correct.
    const propOk = SetWindowPos(
      hwnd,
      null,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
    ) as boolean;
    // eslint-disable-next-line no-console
    console.log(`[wallpaper:windows] SetWindowPos(FRAMECHANGED) → ${propOk ? 'ok' : 'FAILED'}`);

    let parent: Buffer | null = null;
    if (raised) {
      parent = progman;
      state.trackedWorkerW = findRaisedWorkerW(progman);
    } else {
      parent = findClassicWorkerW();
      state.trackedWorkerW = parent; // we're reparenting to it, watchdog tracks it
    }

    if (!parent) {
      // eslint-disable-next-line no-console
      console.warn(
        '[wallpaper:windows] no reparent target found ' +
          `(raised=${raised}); leaving window in normal z-order`,
      );
      // Roll back the style flips so window mode comes back clean.
      restoreStyle(hwnd, state.preWallpaperStyle as bigint);
      restoreExStyle(hwnd, state.preWallpaperExStyle);
      state.preWallpaperStyle = null;
      state.preWallpaperExStyle = null;
      win.setSkipTaskbar(false);
      win.setIgnoreMouseEvents(false);
      return;
    }

    // SetParent — MSDN return value is ambiguous (null both on failure
    // and on "no prior parent"), so we check GetLastError immediately.
    // 0 = success, nonzero = the actual failure reason.
    const setParentResult = SetParent(hwnd, parent) as Buffer | null;
    const setParentErr = GetLastError() as number;
    // eslint-disable-next-line no-console
    console.log(
      `[wallpaper:windows] SetParent → ${
        setParentResult ? 'ok (prior parent returned)' : 'null'
      }, GetLastError=${setParentErr}`,
    );

    // After SetParent, X/Y become parent-relative. Progman spans the
    // virtual screen at (0,0), so re-asserting the display bounds works
    // unchanged — but we re-apply because some Win11 builds reset child
    // bounds during the SetParent transition.
    win.setBounds({ x, y, width, height });
    setTimeout(() => {
      if (!win.isDestroyed()) win.setBounds({ x, y, width, height });
    }, 100);

    // Raised-desktop only: z-order between DefView and WorkerW so desktop
    // icons stay on top of our content. Without this, the wallpaper renders
    // ABOVE the icons (broken).
    if (raised) {
      const defView = FindWindowExW(progman, null, 'SHELLDLL_DefView', null) as Buffer | null;
      if (defView) {
        const zOrderOk = SetWindowPos(
          hwnd,
          defView,
          0,
          0,
          0,
          0,
          SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        ) as boolean;
        const zOrderErr = GetLastError() as number;
        // eslint-disable-next-line no-console
        console.log(
          `[wallpaper:windows] SetWindowPos(after DefView) → ${
            zOrderOk ? 'ok' : 'FAILED'
          }, GetLastError=${zOrderErr}`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn('[wallpaper:windows] SHELLDLL_DefView not found — icons may overlay incorrectly');
      }
    }

    startWatchdog(win);

    // eslint-disable-next-line no-console
    console.log(`[wallpaper:windows] attached to ${raised ? 'Progman (raised)' : 'WorkerW (classic)'}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] enter failed:', (e as Error).message);
  } finally {
    state.attaching = false;
  }
}

export function exitWallpaper(win: BrowserWindow): void {
  try {
    stopWatchdog();
    if (win.isDestroyed()) return;

    const hwnd = electronHwnd(win);
    SetParent(hwnd, null);

    // Restore styles AFTER SetParent (mirror of enter order). Per MSDN
    // SetParent docs, if hWndNewParent is NULL you should also clear
    // WS_CHILD; restoring the saved pre-wallpaper style covers that.
    if (state.preWallpaperStyle !== null) {
      restoreStyle(hwnd, state.preWallpaperStyle);
      state.preWallpaperStyle = null;
    }
    if (state.preWallpaperExStyle !== null) {
      restoreExStyle(hwnd, state.preWallpaperExStyle);
      state.preWallpaperExStyle = null;
    }

    win.setIgnoreMouseEvents(false);
    win.setSkipTaskbar(false);
    if (state.preWallpaperBounds) {
      win.setBounds(state.preWallpaperBounds);
      state.preWallpaperBounds = null;
    }

    state.trackedWorkerW = null;
    state.raisedDesktopOnEnter = false;
    state.lastDisplay = null;
    // eslint-disable-next-line no-console
    console.log('[wallpaper:windows] detached');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:windows] exit failed:', (e as Error).message);
  }
}

// --- Watchdog ---------------------------------------------------------------

/** 2-second polling watchdog. If the WorkerW we attached to disappears
 *  (DWM destroys it on HDR / Copilot / Win+P display-mode change on Win11
 *  22H2+), re-spawn Progman's WorkerW and re-run the full enterWallpaper
 *  flow. SetWinEventHook doesn't work from Node — WINEVENT_OUTOFCONTEXT
 *  delivers via the target thread's message queue and Node doesn't pump. */
function startWatchdog(win: BrowserWindow): void {
  stopWatchdog();
  state.watchdog = setInterval(() => {
    if (win.isDestroyed()) {
      stopWatchdog();
      return;
    }
    // Don't race with a user-initiated toggle that's mid-flight.
    if (state.attaching) return;
    if (!state.trackedWorkerW) return;
    const alive = IsWindow(state.trackedWorkerW) as boolean;
    if (alive) return;
    // eslint-disable-next-line no-console
    console.log('[wallpaper:windows] WorkerW destroyed — re-attaching');
    // Full re-attach. exitWallpaper clears tracked handle + state; the
    // following enterWallpaper re-runs the whole detection + reparent.
    // Phase 4B: re-attach to the SAME display the user chose, not
    // necessarily the primary. lastDisplay is cleared by exitWallpaper
    // so we capture it before the exit call.
    const display = state.lastDisplay ?? screen.getPrimaryDisplay();
    exitWallpaper(win);
    enterWallpaper(win, display);
  }, WATCHDOG_INTERVAL_MS);
}

function stopWatchdog(): void {
  if (state.watchdog) {
    clearInterval(state.watchdog);
    state.watchdog = null;
  }
}
