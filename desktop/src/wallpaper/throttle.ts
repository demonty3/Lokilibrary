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

import { screen, type BrowserWindow, type Display } from 'electron';

interface Koffi {
  load(name: string): {
    func(signature: string): (...args: unknown[]) => unknown;
  };
  /** koffi.address(v) returns the pointer value of any koffi-managed
   *  reference as a bigint. The critical helper for void*-return
   *  unwrapping: koffi doesn't hand back a Node Buffer wrapping the
   *  pointer bytes, it hands back its own opaque reference type whose
   *  identity IS the pointer. `instanceof Buffer` returns false for
   *  these, which is what broke the previous bufferToHwnd path. */
  address(value: unknown): bigint;
}

// --- Win32 bindings (lazy) --------------------------------------------------
// Slice 4A: minimum-viable detection — GetForegroundWindow + GetWindowRect +
// GetShellWindow + FindWindowExW. Slice 5B adds GetLastInputInfo +
// GetTickCount for system-wide idle detection (SLEEPING state).
//
// Bound LAZILY on first controller start, NOT at module load. `koffi.load(
// 'user32.dll')` is a dlopen that throws on macOS/Linux; main.ts imports this
// module statically, so an eager load would crash the whole app at boot on
// non-Windows hosts (the same trap windows.ts/index.ts avoid). On those
// platforms getWin32() returns null and the controller degrades to a permanent
// 'full' state — correct, since the throttle is a Windows wallpaper-mode
// feature and the renderer should just animate normally elsewhere.
//
// Both function signatures avoid the koffi struct path: RECT marshals via
// `_Out_ int32_t*` (4-int array); LASTINPUTINFO marshals via `_Inout_
// uint32_t*` (caller sets cbSize=8, GetLastInputInfo fills dwTime in the same
// buffer). Saves two koffi.struct registrations.

type KoffiFn = (...args: unknown[]) => unknown;

interface Win32 {
  koffi: Koffi;
  /** HWND with system keyboard focus, or NULL during fast app switches / lock. */
  GetForegroundWindow: KoffiFn;
  /** Fills a RECT (incl. chrome) for fullscreen detection — a true-fullscreen
   *  game has no chrome, so its rect == monitor rect exactly. */
  GetWindowRect: KoffiFn;
  /** Progman (desktop) HWND. Excluded from fullscreen detection so clicking
   *  the desktop in wallpaper mode doesn't pause the renderer. */
  GetShellWindow: KoffiFn;
  /** Class-name fallback when GetShellWindow returns NULL (raised-desktop
   *  Win11 quirk). FindWindowExW(class="Progman") finds it regardless. */
  FindWindowExW: KoffiFn;
  /** Phase 5B idle detection — fills LASTINPUTINFO.dwTime (ms-since-boot of the
   *  last OS-wide keyboard/mouse/touch input). Idle = GetTickCount() - dwTime. */
  GetLastInputInfo: KoffiFn;
  /** Phase 5B — ms since boot; pairs with GetLastInputInfo for idle ms. Wraps
   *  at 49.7 days (uint32); queryIdleDurationMs handles the wrap modularly. */
  GetTickCount: KoffiFn;
}

let win32: Win32 | null = null;
let win32Tried = false;

/** Bind (once) the Win32 FFI surface. Returns null on non-Windows or if koffi /
 *  user32 can't load — callers then skip Win32 probing entirely. */
function getWin32(): Win32 | null {
  if (win32Tried) return win32;
  win32Tried = true;
  if (process.platform !== 'win32') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi') as Koffi;
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    win32 = {
      koffi,
      GetForegroundWindow: user32.func('void* GetForegroundWindow()'),
      GetWindowRect: user32.func('bool GetWindowRect(void* hWnd, _Out_ int32_t* lpRect)'),
      GetShellWindow: user32.func('void* GetShellWindow()'),
      FindWindowExW: user32.func(
        'void* FindWindowExW(void* hWndParent, void* hWndChildAfter, str16 lpszClass, str16 lpszWindow)',
      ),
      GetLastInputInfo: user32.func('bool GetLastInputInfo(_Inout_ uint32_t* plii)'),
      GetTickCount: kernel32.func('uint32_t GetTickCount()'),
    };
    return win32;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[throttle] Win32 bindings unavailable; throttle disabled:', (e as Error).message);
    win32 = null;
    return null;
  }
}

// --- Types ------------------------------------------------------------------

export type ThrottleState = 'full' | 'throttled-1hz' | 'paused' | 'sleeping';

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
  /** Phase 5B — milliseconds since the last system-wide input
   *  (keyboard / mouse / touch / pen). From Win32 `GetLastInputInfo`
   *  + `GetTickCount`. Long values (>10 min default) trigger the
   *  SLEEPING state when the wallpaper isn't covered by a fullscreen
   *  app — the user is genuinely away, agents can use the freed
   *  compute for autonomous reflection. */
  readonly idleDurationMs: number;
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

/** Phase 5B — system-wide idle duration above which we enter the
 *  SLEEPING state. 10 minutes by default. Long enough to avoid
 *  triggering on bathroom breaks; short enough that the morning
 *  dispatch has reasonable freshness when the user returns from
 *  even short stretches of unfocused work. IDEAS.md 2026-05-28
 *  Sleep mode entry: "When the app has been unfocused for ~X minutes
 *  AND the PC isn't in active gaming." */
const SLEEP_THRESHOLD_MS = 10 * 60 * 1000;

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

  // Phase 5B — SLEEPING wins above everything else (except mode-off
  // above). The semantic: system has been idle for >10 minutes
  // (whole-OS idle from GetLastInputInfo, not just our app's focus),
  // AND nothing's fullscreen-pinning the screen. User is genuinely
  // away. Renderer drops; agents get freed compute for autonomous
  // reflection via the sleep-reflection path in App.tsx.
  //
  // Why above fullscreen detection: a user might leave a fullscreen
  // video paused at lunch break — that should be SLEEPING, not
  // PAUSED, because we want to let agents work in the background.
  // BUT if a fullscreen app is foreground AND idle is short (user
  // is actively playing), PAUSED still wins. The order check below
  // handles this: idle long AND no fullscreen → sleeping; fullscreen
  // (any idle) → paused; otherwise foreground-rect heuristic.
  const isFullscreenForeground =
    probe.foregroundRect !== null &&
    probe.foregroundHwnd !== null &&
    probe.foregroundHwnd !== probe.wallpaperHwnd &&
    (probe.shellHwnd === null || probe.foregroundHwnd !== probe.shellHwnd) &&
    rectMatchesMonitor(probe.foregroundRect, probe.monitorRect, FULLSCREEN_TOLERANCE_PX);
  if (probe.idleDurationMs >= SLEEP_THRESHOLD_MS && !isFullscreenForeground) {
    return 'sleeping';
  }

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

/** Phase 5B — buffer the LASTINPUTINFO struct lives in. Layout: 8
 *  bytes total. Bytes 0-3 = cbSize (uint32, must equal 8 — we set it
 *  on every call since GetLastInputInfo overwrites the buffer with
 *  cbSize unchanged + dwTime overwritten). Bytes 4-7 = dwTime
 *  (uint32, ms since system boot of last input). */
const lastInputBuf = Buffer.alloc(8);
lastInputBuf.writeUInt32LE(8, 0); // cbSize = sizeof(LASTINPUTINFO)

/** Query system idle duration in ms (since the last keyboard / mouse /
 *  touch / pen input across the OS). Returns -1 if the Win32 call
 *  failed — caller treats that as "unknown idle" and falls back to
 *  the safest behavior (don't trigger SLEEPING). */
function queryIdleDurationMs(w: Win32): number {
  // Re-set cbSize each call — the spec says it must be set by the
  // caller before each call, and our buffer is shared across calls.
  lastInputBuf.writeUInt32LE(8, 0);
  const ok = w.GetLastInputInfo(lastInputBuf) as boolean;
  if (!ok) return -1;
  const lastInputTick = lastInputBuf.readUInt32LE(4);
  const nowTick = w.GetTickCount() as number;
  // uint32 modular subtraction handles the 49.7-day wrap correctly:
  // if nowTick wrapped past 0 while lastInputTick is still pre-wrap,
  // (nowTick - lastInputTick) & 0xFFFFFFFF gives the right delta.
  return (nowTick - lastInputTick) >>> 0;
}

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

/** Extract the HWND value (as bigint) from a koffi-returned `void*`.
 *  Cannot use the original `buf.readBigInt64LE(0)` approach — koffi
 *  doesn't return a Node Buffer for void*-return functions; it returns
 *  its own opaque reference object whose memory layout we don't control.
 *  `koffi.address()` is the documented unwrap path: returns the pointer
 *  value as a bigint, suitable for HWND-vs-HWND comparison.
 *
 *  Distinct from `win.getNativeWindowHandle().readBigInt64LE(0)` used for
 *  the wallpaper HWND — that one IS a real Node Buffer whose first 8
 *  bytes are the HWND value (Electron's encoding). Two different
 *  extraction paths because they're two different runtime types,
 *  documented in detail in windows.ts:160. */
function koffiHwnd(w: Win32, value: unknown): bigint | null {
  if (!value) return null;
  try {
    const addr = w.koffi.address(value);
    return addr === 0n ? null : addr;
  } catch {
    return null;
  }
}

/** Resolve Progman's HWND with a two-step fallback. Captured once at
 *  controller start and cached for the life of wallpaper mode —
 *  Progman's handle is stable for the Windows session. The phase-0
 *  WorkerW watchdog in windows.ts handles re-attach if Progman gets
 *  destroyed (DWM does this on display-mode changes); a future slice
 *  would re-fetch this on the same trigger. */
function findShellHwnd(w: Win32): bigint | null {
  // Path 1: the documented API. Returns NULL on shells that didn't
  // register their desktop window — observed on at least one
  // raised-desktop Win11 user setup despite Progman existing.
  const fromGetShell = koffiHwnd(w, w.GetShellWindow());
  if (fromGetShell !== null) return fromGetShell;

  // Path 2: class-name lookup. Progman is created by explorer.exe and
  // its class is always "Progman" regardless of shell registration
  // state. This is what windows.ts already does for WorkerW lookup;
  // applying the same trick here.
  const fromFindWindow = koffiHwnd(w, w.FindWindowExW(null, null, 'Progman', null));
  if (fromFindWindow !== null) {
    // eslint-disable-next-line no-console
    console.warn(
      '[throttle] GetShellWindow() returned NULL; FindWindowExW("Progman") found it as ' +
        `0x${fromFindWindow.toString(16)} (raised-desktop Win11 quirk — known good fallback).`,
    );
    return fromFindWindow;
  }

  // Path 3: give up. Without shellHwnd the state machine falls back to
  // its pre-fix behavior — Progman-shaped foreground gets misclassified
  // as a fullscreen app the moment the user clicks the desktop in
  // wallpaper mode, pausing the renderer. Loud warn so this isn't a
  // silent regression.
  // eslint-disable-next-line no-console
  console.warn(
    '[throttle] BOTH GetShellWindow() and FindWindowExW("Progman") returned NULL. ' +
      'Wallpaper-mode throttle will incorrectly treat the desktop as a fullscreen ' +
      'app — agents will freeze whenever the user is at the desktop. File a bug ' +
      'with the user\'s Windows version + custom shell info (if any).',
  );
  return null;
}

/** Snapshot the current Win32 state. Returns null when probing isn't
 *  meaningful (e.g. wallpaper mode is off — caller should pass the
 *  resulting state directly as 'full' without probing). */
function probeWin32(
  w: Win32,
  wallpaperHwnd: bigint | null,
  shellHwnd: bigint | null,
  isWallpaperMode: boolean,
  display: Display | null,
): ThrottleProbe {
  // Phase 4B: use the chosen display, not the primary, so the
  // throttle's fullscreen + coverage detection applies to the
  // monitor the wallpaper is actually on. Fallback to primary if
  // somehow not set — defensive; shouldn't happen because
  // startThrottleController always sets controller.display.
  const target = display ?? screen.getPrimaryDisplay();
  const monitorRect: Rect = {
    left: target.bounds.x,
    top: target.bounds.y,
    right: target.bounds.x + target.bounds.width,
    bottom: target.bounds.y + target.bounds.height,
  };

  if (!isWallpaperMode) {
    // Skip the Win32 calls entirely — state machine returns 'full' on
    // !isWallpaperMode anyway, and we save three FFI hops per tick
    // (now including GetLastInputInfo + GetTickCount for 5B).
    return {
      isWallpaperMode,
      wallpaperHwnd,
      shellHwnd,
      foregroundHwnd: null,
      foregroundRect: null,
      monitorRect,
      idleDurationMs: 0,
    };
  }

  const fgHwndRaw = w.GetForegroundWindow();
  const foregroundHwnd = koffiHwnd(w, fgHwndRaw);

  let foregroundRect: Rect | null = null;
  if (foregroundHwnd !== null && fgHwndRaw) {
    rectBuf.fill(0);
    // Pass the koffi-returned reference directly back to GetWindowRect
    // (koffi unwraps it transparently — same pattern windows.ts uses
    // for Progman → SetParent). Passing the bigint pointer value would
    // require a separate cast.
    const ok = w.GetWindowRect(fgHwndRaw, rectBuf) as boolean;
    if (ok) foregroundRect = readRectFromBuffer();
  }

  // Phase 5B — idle duration from GetLastInputInfo. Negative means
  // the call failed; we coerce to 0 so the SLEEPING gate never fires
  // on a Win32 failure (safer to render than to silently sleep).
  const rawIdle = queryIdleDurationMs(w);
  const idleDurationMs = rawIdle < 0 ? 0 : rawIdle;

  return {
    isWallpaperMode,
    wallpaperHwnd,
    shellHwnd,
    foregroundHwnd,
    foregroundRect,
    monitorRect,
    idleDurationMs,
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
  /** Phase 4B — the display the wallpaper is rendered on. Used for the
   *  monitorRect that the foreground-rect heuristic compares against.
   *  Without this, throttling would use the *primary* display's bounds
   *  even when the user pinned the wallpaper to a secondary monitor —
   *  fullscreen + coverage detection would fire on the wrong monitor.
   *  Stop + restart the controller (with a new display) when the user
   *  picks a different monitor; main.ts's applyDisplay does this. */
  readonly display: Display;
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
  /** Phase 4B — the display the throttle is monitoring. Captured once
   *  at start(); changes require a stop + restart. probeWin32 reads
   *  bounds from this rather than re-querying screen each tick. */
  display: Display | null;
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
  display: null,
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

  // Win32 throttle is Windows-only. On macOS/Linux (or if koffi can't load)
  // degrade to a permanent 'full' state: emit it once so the renderer
  // configures its ticker, then skip the polling loop entirely.
  const w = getWin32();
  if (!w) {
    controller.current = 'full';
    opts.onStateChange('full', true);
    return;
  }

  controller.wallpaperHwnd = win.getNativeWindowHandle().readBigInt64LE(0);
  controller.shellHwnd = findShellHwnd(w);
  controller.isWallpaperMode = true;
  controller.display = opts.display;
  controller.current = 'full';
  controller.lastForegroundHwnd = null;
  currentOpts = opts;

  // eslint-disable-next-line no-console
  console.log(
    `[throttle] controller started ` +
      `wallpaperHwnd=0x${controller.wallpaperHwnd.toString(16)} ` +
      `shellHwnd=${controller.shellHwnd ? '0x' + controller.shellHwnd.toString(16) : 'null'} ` +
      `display=${opts.display.id} ${opts.display.bounds.width}×${opts.display.bounds.height}` +
      `@(${opts.display.bounds.x},${opts.display.bounds.y})`,
  );

  // Emit the initial state synchronously so the renderer can drop the
  // ticker to its initial throttle level BEFORE the first frame after
  // entering wallpaper mode.
  opts.onStateChange('full', true);

  const interval = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  controller.timer = setInterval(() => {
    try {
      const probe = probeWin32(
        w,
        controller.wallpaperHwnd,
        controller.shellHwnd,
        controller.isWallpaperMode,
        controller.display,
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
        const idleSec = Math.round(probe.idleDurationMs / 1000);
        const transitionTag = stateChanged ? ` ⟹ ${controller.current}→${next}` : '';
        // eslint-disable-next-line no-console
        console.log(
          `[throttle] fg=${fgHex} fgRect=${fgRect} mon=${monRect} idle=${idleSec}s state=${next}${transitionTag}`,
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
  controller.display = null;
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
  SLEEP_THRESHOLD_MS,
} as const;
