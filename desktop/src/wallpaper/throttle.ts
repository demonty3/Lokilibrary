/**
 * Phase 4 slice 4A — three-tier wallpaper throttle controller.
 *
 * Watches the foreground window vs. the primary monitor and emits a
 * throttle state every time it changes:
 *
 *   - `full`         — desktop visible, no covering app: renderer ticks
 *                      at uncapped FPS (the agent cohort + scene animate).
 *   - `throttled-1hz`— a non-fullscreen app covers >50% of the monitor:
 *                      renderer drops to ~1 Hz; wallpaper isn't visible
 *                      enough to be worth the GPU spend, but agents
 *                      should keep doing low-rate things in the
 *                      background.
 *   - `paused`       — a fullscreen app is foreground: renderer Ticker
 *                      stops entirely. On resume, `start()` brings agents
 *                      back where they were.
 *
 * **What we deliberately DON'T do in 4A:**
 *   - EnumWindows to find background covering windows (the foreground
 *     window is the dominant cover-detection signal; corner cases like
 *     "tall non-fullscreen IDE behind a tiny terminal" come back in 4B
 *     with multi-monitor + per-window enumeration).
 *   - Per-monitor accounting (we read the primary display only — 4B
 *     adds the monitor picker and per-monitor throttle).
 *   - Steamworks cross-check for "is the foreground app a Steam game"
 *     — steamworks.js doesn't expose `IFriends::GetFriendGamePlayed`
 *     (PLAN.md's reference was aspirational). The `external_fullscreen`
 *     perception fires WITHOUT identifying the appid; if we want
 *     game-aware reactions later, the Windows registry path
 *     `HKCU\Software\Valve\Steam\RunningAppID` is the typical hack.
 *
 * Verification: pure state-machine tested in WSL via
 * scripts/smoke-4a-throttle.mts. The polling loop + koffi calls require
 * Windows-native PowerShell to exercise; the user verifies there.
 */

import { screen, type BrowserWindow } from 'electron';

interface Koffi {
  load(name: string): {
    func(signature: string): (...args: unknown[]) => unknown;
  };
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require('koffi') as Koffi;

// --- Win32 bindings ---------------------------------------------------------
// Two functions only — minimum-viable detection per the slice 4A scope cut.
// Both are well-documented and don't need the koffi struct path: we marshal
// RECT as an `_Out_` int32 array of length 4 instead. Saves one koffi.struct
// registration; the array path is what windows.ts uses for `_Out_` params
// elsewhere.

const user32 = koffi.load('user32.dll');

/** Returns the HWND that currently has keyboard focus across the system, or
 *  NULL when no window is foreground (rare — usually only during fast
 *  app switches or when the lock screen is active). */
const GetForegroundWindow = user32.func('void* GetForegroundWindow()');

/** Fills a RECT {left, top, right, bottom} with the foreground window's
 *  screen-coordinate bounds. Includes window chrome (title bar / borders),
 *  which is what we want for fullscreen detection — a "true fullscreen"
 *  game has no chrome, so window rect = monitor rect exactly. */
const GetWindowRect = user32.func(
  'bool GetWindowRect(void* hWnd, _Out_ int32_t* lpRect)',
);

/** Handle to the desktop "Program Manager" window (Progman). Returned by
 *  GetShellWindow. Progman occupies the full monitor area, so without an
 *  explicit exclude check the foreground-rect heuristic below would mark
 *  Progman as a fullscreen app the moment the user clicks the desktop in
 *  wallpaper mode — pausing the renderer before it's even shown its
 *  first frame. The shell-window check above the fullscreen detection
 *  in computeThrottleState is what prevents that. */
const GetShellWindow = user32.func('void* GetShellWindow()');

// --- Types ------------------------------------------------------------------

export type ThrottleState = 'full' | 'throttled-1hz' | 'paused';

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Single observation. The state machine is a pure function over this
 *  payload — easy to test without Win32 access. */
export interface ThrottleProbe {
  /** Are we even in wallpaper mode? When false, throttle never engages;
   *  the renderer ticks normally because the user is looking at the app
   *  as a window. */
  readonly isWallpaperMode: boolean;
  /** Our app's HWND. When the foreground equals this, the user has
   *  focused the wallpaper (e.g. via Alt+Tab in window mode); we don't
   *  throttle in that case. */
  readonly wallpaperHwnd: bigint | null;
  /** Progman's HWND from GetShellWindow, captured at controller start.
   *  When foreground equals this, the user is at the desktop and the
   *  wallpaper IS visible — render at full rate. Without this check
   *  the fullscreen-rect heuristic below mistakes Progman (which
   *  covers the full monitor) for a fullscreen app. */
  readonly shellHwnd: bigint | null;
  /** GetForegroundWindow result, unwrapped to a bigint pointer. Null
   *  when GetForegroundWindow returned NULL (no foreground app, lock
   *  screen, fast app switch in progress). */
  readonly foregroundHwnd: bigint | null;
  /** GetWindowRect on the foreground window. Null when foregroundHwnd
   *  is null OR when GetWindowRect failed (rare). */
  readonly foregroundRect: Rect | null;
  /** Primary monitor's bounds. Electron's screen.getPrimaryDisplay()
   *  returns CSS pixel bounds; this carries the same values as RECT
   *  semantics (top-left origin, right = left + width). */
  readonly monitorRect: Rect;
}

// --- Pure state machine -----------------------------------------------------

/** Coverage threshold (foreground rect area / monitor rect area) above
 *  which we drop to throttled-1hz. Below the threshold the wallpaper is
 *  still visible enough that it's worth animating. 0.5 = "more than half
 *  the screen is covered." Lively uses ~70%; we pick 50% because the
 *  cell-room aesthetic loses character fast when covered. */
const THROTTLE_COVERAGE_THRESHOLD = 0.5;

/** How close the foreground rect must be to the monitor rect (per edge,
 *  in pixels) to count as "fullscreen." 2 px tolerance absorbs scroll
 *  bar / DWM rounding without false-positives on a maximized-but-not-
 *  fullscreen window (which has at least 1 px of chrome inset). */
const FULLSCREEN_TOLERANCE_PX = 2;

function rectArea(r: Rect): number {
  return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
}

function rectMatchesMonitor(fg: Rect, mon: Rect, tol: number): boolean {
  return (
    Math.abs(fg.left - mon.left) <= tol &&
    Math.abs(fg.top - mon.top) <= tol &&
    Math.abs(fg.right - mon.right) <= tol &&
    Math.abs(fg.bottom - mon.bottom) <= tol
  );
}

/** Pure state-machine. Same probe → same state — no side effects.
 *  Tested in isolation via scripts/smoke-4a-throttle.mts. */
export function computeThrottleState(probe: ThrottleProbe): ThrottleState {
  // Not in wallpaper mode → never throttle. The renderer is a regular
  // window and the user is looking at it directly.
  if (!probe.isWallpaperMode) return 'full';

  // No foreground app or foreground IS our wallpaper → user is at the
  // desktop or has the wallpaper focused (e.g. clicked through icons).
  // Either way, render full.
  if (probe.foregroundHwnd === null) return 'full';
  if (
    probe.wallpaperHwnd !== null &&
    probe.foregroundHwnd === probe.wallpaperHwnd
  ) {
    return 'full';
  }

  // Foreground is the shell (Progman) itself — user is at the desktop,
  // wallpaper IS visible. Must check before the fullscreen-rect branch
  // below, because Progman's window rect spans the monitor and would
  // otherwise be misidentified as a fullscreen app. This is the
  // load-bearing fix for the "wallpaper renders white because the
  // ticker stopped immediately after enter" bug.
  if (
    probe.shellHwnd !== null &&
    probe.foregroundHwnd === probe.shellHwnd
  ) {
    return 'full';
  }

  if (probe.foregroundRect === null) return 'full';

  // Fullscreen — pixel-perfect match against the monitor rect. Real
  // fullscreen games have no window chrome, so their RECT matches the
  // monitor exactly (within rounding tolerance). Reached only when the
  // foreground is NOT our wallpaper and NOT the shell — i.e., a real
  // top-level app that happens to be the full size of the monitor.
  if (rectMatchesMonitor(probe.foregroundRect, probe.monitorRect, FULLSCREEN_TOLERANCE_PX)) {
    return 'paused';
  }

  // Coverage heuristic — "the foreground window occupies most of the
  // screen so the wallpaper isn't really visible." 50% is the cut.
  const monArea = rectArea(probe.monitorRect);
  if (monArea === 0) return 'full';
  const coverage = rectArea(probe.foregroundRect) / monArea;
  if (coverage > THROTTLE_COVERAGE_THRESHOLD) return 'throttled-1hz';

  // Small foreground window (terminal, calculator, music player) —
  // wallpaper is still mostly visible.
  return 'full';
}

// --- Win32 probe ------------------------------------------------------------

/** Buffer the GetWindowRect output goes into. Re-used across ticks to
 *  avoid garbage; koffi's `_Out_ int32_t*` expects a 4-int32 buffer it
 *  writes into in place. */
const rectBuf = Buffer.alloc(4 * 4);

/** Convert the koffi buffer to a Rect. Reads little-endian int32s from
 *  the four positions GetWindowRect wrote. */
function readRectFromBuffer(): Rect {
  return {
    left: rectBuf.readInt32LE(0),
    top: rectBuf.readInt32LE(4),
    right: rectBuf.readInt32LE(8),
    bottom: rectBuf.readInt32LE(12),
  };
}

/** koffi marshals `void*` returned values as Node Buffers wrapping the
 *  pointer's address. For HWND-vs-HWND comparison we need the
 *  pointer-value as a bigint — same trick as windows.ts `electronHwnd`. */
function bufferToHwnd(buf: unknown): bigint | null {
  if (!buf || !(buf instanceof Buffer) || buf.length < 8) return null;
  const v = buf.readBigInt64LE(0);
  return v === 0n ? null : v;
}

/** Snapshot the current Win32 state. Returns null when probing isn't
 *  meaningful (e.g. wallpaper mode is off — caller should pass the
 *  resulting state directly as 'full' without probing). */
function probeWin32(
  wallpaperHwnd: bigint | null,
  shellHwnd: bigint | null,
  isWallpaperMode: boolean,
): ThrottleProbe {
  const primary = screen.getPrimaryDisplay();
  const monitorRect: Rect = {
    left: primary.bounds.x,
    top: primary.bounds.y,
    right: primary.bounds.x + primary.bounds.width,
    bottom: primary.bounds.y + primary.bounds.height,
  };

  if (!isWallpaperMode) {
    // Skip the Win32 calls entirely — state machine returns 'full' on
    // !isWallpaperMode anyway, and we save two FFI hops per tick.
    return {
      isWallpaperMode,
      wallpaperHwnd,
      shellHwnd,
      foregroundHwnd: null,
      foregroundRect: null,
      monitorRect,
    };
  }

  const fgHwndRaw = GetForegroundWindow();
  const foregroundHwnd = bufferToHwnd(fgHwndRaw);

  let foregroundRect: Rect | null = null;
  if (foregroundHwnd !== null && fgHwndRaw) {
    rectBuf.fill(0);
    const ok = GetWindowRect(fgHwndRaw, rectBuf) as boolean;
    if (ok) foregroundRect = readRectFromBuffer();
  }

  return {
    isWallpaperMode,
    wallpaperHwnd,
    shellHwnd,
    foregroundHwnd,
    foregroundRect,
    monitorRect,
  };
}

// --- Controller -------------------------------------------------------------

/** Default poll interval. 1000 ms is responsive enough to feel "live"
 *  (you start a game; the wallpaper pauses within a second) and slow
 *  enough that two FFI calls per second are noise on CPU usage. */
const DEFAULT_POLL_INTERVAL_MS = 1000;

export interface ThrottleControllerOptions {
  /** How often to poll Win32. Default 1000ms. */
  readonly pollIntervalMs?: number;
  /** Callback fired only when state CHANGES. Initial state is emitted
   *  on `start()` so consumers don't need a separate get-current call.
   *  The `isInitial` flag distinguishes the boot-time emission from
   *  later transitions, useful for one-time setup in the renderer. */
  readonly onStateChange: (state: ThrottleState, isInitial: boolean) => void;
}

interface ControllerState {
  timer: NodeJS.Timeout | null;
  current: ThrottleState;
  wallpaperHwnd: bigint | null;
  /** Captured once at start() — Progman's handle doesn't change for
   *  the life of a Windows session. Null if GetShellWindow returned 0
   *  (very rare; happens before the shell finishes initialising). */
  shellHwnd: bigint | null;
  isWallpaperMode: boolean;
  /** Last foreground HWND we observed. Diagnostic logs fire only when
   *  this changes OR the computed state transitions — keeps PowerShell
   *  quiet when the user isn't doing anything, but surfaces every
   *  meaningful event so we can debug "agents didn't slow down" by
   *  reading the log. */
  lastForegroundHwnd: bigint | null;
}

const controller: ControllerState = {
  timer: null,
  current: 'full',
  wallpaperHwnd: null,
  shellHwnd: null,
  isWallpaperMode: false,
  lastForegroundHwnd: null,
};

let currentOpts: ThrottleControllerOptions | null = null;

/** Start the polling loop. Idempotent — calling start() twice does NOT
 *  stack timers. The initial state is emitted synchronously before the
 *  first poll so the renderer can configure its Ticker before any frame
 *  budget is wasted. */
export function startThrottleController(
  win: BrowserWindow,
  opts: ThrottleControllerOptions,
): void {
  stopThrottleController(); // idempotent reset

  controller.wallpaperHwnd = win.getNativeWindowHandle().readBigInt64LE(0);
  controller.shellHwnd = bufferToHwnd(GetShellWindow());
  controller.isWallpaperMode = true;
  controller.current = 'full';
  controller.lastForegroundHwnd = null;
  currentOpts = opts;

  // eslint-disable-next-line no-console
  console.log(
    `[throttle] controller started ` +
      `wallpaperHwnd=0x${controller.wallpaperHwnd.toString(16)} ` +
      `shellHwnd=${controller.shellHwnd ? '0x' + controller.shellHwnd.toString(16) : 'null'}`,
  );

  // Emit the initial state synchronously so the renderer can drop the
  // ticker to its initial throttle level BEFORE the first frame after
  // entering wallpaper mode.
  opts.onStateChange('full', true);

  const interval = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  controller.timer = setInterval(() => {
    try {
      const probe = probeWin32(
        controller.wallpaperHwnd,
        controller.shellHwnd,
        controller.isWallpaperMode,
      );
      const next = computeThrottleState(probe);

      // Diagnostic log: fire when foreground HWND changes OR when the
      // computed state transitions. Quiet during steady-state, loud
      // during anything interesting. Goes to the PowerShell terminal —
      // tail it to debug "throttle isn't engaging" by reading the
      // actual probe values vs. what the heuristic does with them.
      const fgChanged = probe.foregroundHwnd !== controller.lastForegroundHwnd;
      const stateChanged = next !== controller.current;
      if (fgChanged || stateChanged) {
        const fgHex = probe.foregroundHwnd
          ? '0x' + probe.foregroundHwnd.toString(16)
          : 'null';
        const fgRect = probe.foregroundRect
          ? `${probe.foregroundRect.right - probe.foregroundRect.left}×${probe.foregroundRect.bottom - probe.foregroundRect.top}` +
            `@(${probe.foregroundRect.left},${probe.foregroundRect.top})`
          : 'null';
        const monRect = `${probe.monitorRect.right - probe.monitorRect.left}×${probe.monitorRect.bottom - probe.monitorRect.top}`;
        const transitionTag = stateChanged ? ` ⟹ ${controller.current}→${next}` : '';
        // eslint-disable-next-line no-console
        console.log(
          `[throttle] fg=${fgHex} fgRect=${fgRect} mon=${monRect} state=${next}${transitionTag}`,
        );
        controller.lastForegroundHwnd = probe.foregroundHwnd;
      }

      if (stateChanged) {
        controller.current = next;
        currentOpts?.onStateChange(next, false);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[throttle] probe failed (continuing on previous state):',
        (e as Error).message,
      );
    }
  }, interval);
  controller.timer.unref?.(); // don't block app shutdown on this timer
}

/** Stop polling + reset to the default state. Safe to call multiple
 *  times; safe to call before start(). */
export function stopThrottleController(): void {
  if (controller.timer) {
    clearInterval(controller.timer);
    controller.timer = null;
    // eslint-disable-next-line no-console
    console.log('[throttle] controller stopped');
  }
  controller.current = 'full';
  controller.isWallpaperMode = false;
  controller.wallpaperHwnd = null;
  controller.shellHwnd = null;
  controller.lastForegroundHwnd = null;
  currentOpts = null;
}

/** Snapshot of the controller's last-emitted state. For the
 *  `throttle:getCurrent` IPC handler so a late-mounting renderer can
 *  hydrate without waiting for the next change. */
export function getCurrentThrottleState(): ThrottleState {
  return controller.current;
}

/** Test seam — re-export the bare probe-builder so the smoke can stand
 *  up synthetic probes without spinning up Electron. */
export const __testing = {
  rectArea,
  rectMatchesMonitor,
  THROTTLE_COVERAGE_THRESHOLD,
  FULLSCREEN_TOLERANCE_PX,
} as const;
