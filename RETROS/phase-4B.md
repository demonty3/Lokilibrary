# Phase 4B — Multi-monitor wallpaper picker

**Shipped** 2026-05-27 as commit `d0dddb7` on `claude/phase3-pixelart`.

## What landed

Tray gains a "Display" submenu listing connected monitors. Picking one
re-enters wallpaper mode on that monitor; persists in
`<userData>/config.json` so the choice survives restart. Stale
persisted ids (monitor unplugged between sessions) fall back to
primary with a console warn.

New module `desktop/src/display-picker.ts` extracts the pure functions
(`resolveTargetDisplay`, `formatDisplayLabel`, `buildDisplaySubmenu`)
so the smoke can test them with mock displays arrays without standing
up Electron's `screen`.

Wallpaper plumbing: `enterWallpaper(win, display)` signature gained
the display param; `startThrottleController({display, ...})` likewise.
`WallpaperState.lastDisplay` captures the chosen monitor so the
WorkerW destruction watchdog re-attaches to the same display (no
surprise jumps to primary mid-session).

## What surprised me

- The 3D-era reference implementation at
  `origin/claude/phase6-slice5-perf-multimonitor` (PR #25, MERGED
  2026-05-19) is **directly portable** — the desktop wrapper layer is
  identical between the 3D era and Memory Palace (it doesn't care
  what renderer it hosts). Lifted patterns nearly verbatim. CLAUDE.md
  rule against reaching into `legacy-3d/` applies to renderer code,
  not desktop code.
- Single-display setups need a graceful UX: the submenu collapses to a
  disabled "Only one display detected" hint instead of a useless
  one-item submenu. Same pattern in the 3D-era code; preserved.
- Win11 maximize overflow (-8 px on each side) interacts with the
  throttle's 2-px fullscreen tolerance correctly — coverage of 98.4%
  triggers `throttled-1hz` not `paused`. Verified during slice 4A
  testing; 4B doesn't change this.
- `electron` package isn't installed at the repo root (only under
  `desktop/`), so the smoke can't `require.resolve('electron')`. Used
  Module._load hijack to mock — extracted as `mockElectronModule()`
  helper in slice 5H since 4C + 5A had the same need.

## What's deferred

- **Display hot-plug** detection mid-session (Electron's
  `screen.on('display-added' | 'display-removed', ...)` → rebuild
  tray + re-validate persisted id). Tagged as polish item; not
  load-bearing for v1.0.

## What the user verified

User has a single-monitor setup so the picker shows "Only one display
detected" as designed. Throttle controller logs include
`display=<id> <W>×<H>@(<x>,<y>)` confirming the chosen-display
plumbing is alive on the controller side. Full multi-monitor
verification (pick a non-primary, re-enter, throttle uses the chosen
monitor's bounds, restart honors persistence) pending a second display
or test machine.

## Files

- `desktop/src/config.ts` — `displayId?` field + getter/setter
- `desktop/src/display-picker.ts` (new) — pure picker helpers
- `desktop/src/main.ts` — `resolveDisplay()`, `applyDisplay()`, tray
  Display submenu, display threading into enterWallpaper +
  startThrottleController
- `desktop/src/wallpaper/index.ts` + `windows.ts` + `macos.ts` —
  `enterWallpaper(win, display)` signature
- `desktop/src/wallpaper/throttle.ts` — controller.display + probeWin32
  reads the chosen monitor
- `scripts/smoke-4b-monitors.mts` (new, 31 assertions) —
  `resolveTargetDisplay` matrix + submenu builder + config round-trip
