# Phase 4A — Wallpaper throttle pipeline

**Shipped** 2026-05-27 across 5 commits on `claude/phase3-pixelart`:
`1d5365f` initial, `33043b1` defensive bridge guards, `b7e35de` Progman
exclude, `ecb3a9f` diagnostic logs, `e1b87d5` koffi.address fix.

## What landed

Three-tier wallpaper throttle: `full` / `throttled-1hz` / `paused`.
Polling controller in `desktop/src/wallpaper/throttle.ts` runs every
1000ms, calls `GetForegroundWindow` + `GetWindowRect` via koffi,
computes the state via a pure state machine, emits transitions to the
renderer via IPC `throttle:state-change`. PixiApp's applyThrottle reads
the Zustand store slice and calls `app.ticker.stop()` / `maxFPS = 1` /
`maxFPS = 0` accordingly.

Stretch: `external_fullscreen` perception event fires on paused-entry
(non-initial), pushed to every present agent's queue via
`broadcastExternalFullscreen` (router.ts). Importance 7. Agent cohort
reacts in Tier-2 reflection.

## What surprised me

Three real bugs surfaced during user verification on Windows, all
documented in fix commit messages:

1. **Stale preload bridge crashed the renderer**. Renderer hot-reloads
   on save; Electron preload only reloads on full process restart. New
   bridge method calls hit `undefined` on the old preload's api
   object, threw an uncaught TypeError into React's render loop,
   killed the whole component tree. Fix: `typeof api.X !== 'function'`
   defensive guard + `warnStalePreload()` one-time warn (see
   `src/api/electron.ts`).

2. **Progman misclassified as fullscreen app**. `GetForegroundWindow`
   returns Progman (the desktop window) when the user clicks the
   desktop. Progman's rect spans the monitor. My fullscreen heuristic
   matched and emitted `paused` within 1 second of entering wallpaper
   mode — renderer ticker stopped before mountCell painted its first
   frame, BrowserWindow default color (white) showed through. Fix:
   `findShellHwnd()` with `GetShellWindow` + `FindWindowExW("Progman")`
   fallback (for raised-desktop Win11 setups where GetShellWindow
   returns NULL despite Progman existing); short-circuit state machine
   to `full` when foreground === shell.

3. **koffi `void*` returns aren't Node Buffers**. My original
   `bufferToHwnd` did `buf.readBigInt64LE(0)` assuming Node Buffer
   bytes. koffi returns an opaque wrapper whose memory layout isn't
   "first 8 bytes ARE the HWND value." Fix: `koffi.address(value)`
   returns the actual pointer value as bigint (documented in
   `koffi/index.d.ts:130`). Distinct from Electron's
   `getNativeWindowHandle()` which IS a real Node Buffer where bytes
   are the HWND — two extraction paths for two runtime types, both
   needed.

## What's deferred

- `WorkerW` destruction watchdog (PLAN.md Phase 4 task 4) — already
  shipped in Phase 0 form; current 4A watchdog re-attaches but doesn't
  re-fetch shellHwnd on hot-plug. Phase 4 follow-up if needed.
- Multi-monitor support — landed in slice 4B.
- Sleep mode (4th SLEEPING state per IDEAS.md 2026-05-28) — planned as
  slice 5B per PLAN.md § Phase 5.
- `external_fullscreen` perception currently fires without identifying
  the appid (steamworks.js doesn't expose `IFriends::GetFriendGamePlayed`).
  Windows registry read at `HKCU\Software\Valve\Steam\RunningAppID` is
  the typical hack if game identification matters later.

## What the user verified

All three states fired correctly on Win11 raised-desktop (2560×1440):
- `paused` on F11 / borderless-fullscreen apps (foreground rect ===
  monitor)
- `throttled-1hz` on Win+↑ maximize (rect 2576×1408 — the classic
  Win11 -8 px maximize overflow; my 2-px tolerance rejected as
  fullscreen, coverage 98.4% triggered throttled)
- `full` returning when foreground moved to a normal-sized app or
  Progman

PowerShell + DevTools log pattern is the load-bearing diagnostic
surface for the whole pipeline.

## Files

- `desktop/src/wallpaper/throttle.ts` (new, ~400 LOC) — pure state
  machine + polling controller + koffi bindings
- `desktop/src/main.ts` — emitThrottleChange + IPC handlers + lifecycle
- `desktop/src/preload.ts` — bridge surface
- `src/api/electron.ts` — renderer-side helpers with defensive guards
- `src/state/store.ts` — throttleState slice
- `src/App.tsx` — subscription + broadcastExternalFullscreen stretch
- `src/render/PixiApp.ts` — applyThrottle implementation
- `src/agents/router.ts` — broadcastExternalFullscreen + importanceFor
- `src/agents/memory/schema.ts` — external_fullscreen observation source
- `scripts/smoke-4a-throttle.mts` (new, 23 assertions) — pure state
  machine mirror
