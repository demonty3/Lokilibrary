# Phase 4C — Ctrl+Alt+L peek hotkey

**Shipped** 2026-05-27 as commit `0d1f05a` on `claude/phase3-pixelart`.

## What landed

Global hotkey (`CmdOrCtrl+Alt+L`) toggles a transient "peek" state on
top of wallpaper mode. Peek-on: full exit-then-alwaysOnTop — wallpaper
becomes a normal interactive window above other apps. Peek-off:
inverse, returns to behind-desktop on the chosen display (4B).

**Architectural choice**: peeking is a module-local boolean in
`desktop/src/main.ts`, NOT a third value in `Config.mode`. Per the
3D-era precedent + the four reasons documented in the slice's commit:
peek is transient (doesn't persist), the existing `getMode() === mode`
guard works unchanged, and the persisted-state contract stays simple.

Throttle controller stops on peek-on (wallpaper IS the foreground;
nothing to throttle for). Restarts on peek-off with the same chosen
display.

## What surprised me

- The 3D-era reference at `origin/claude/phase6-slice6-hotkey-peek`
  (PR #26) uses **full exit + alwaysOnTop** instead of just z-order
  lifting. Heavier but proven — pure z-order lift on a Progman-
  parented window is flakier across Win11 builds, so input handling
  (alt-tab, click, keyboard focus) isn't reliable without the
  full unparent.
- `globalShortcut.unregisterAll()` in `window-all-closed` is
  load-bearing — without it the hotkey lingers system-wide for the
  next process. PLAN.md Phase 4 task 3 callout I almost missed.
- The throttle controller restart on peek-off cleanly reuses
  `resolveDisplay()` from 4B — peek doesn't need to know about
  monitor pinning; 4B's existing path handles it.

## What's deferred

- Renderer-side peek-aware HUD (e.g. "Press Ctrl+Alt+L to dismiss
  peek" banner). The hotkey + tray "Exit peek" item work without it;
  HUD is a polish slice.
- Hotkey customization (currently fixed `CmdOrCtrl+Alt+L`). Future
  slice could expose it in `config.json`.

## What the user verified

User confirmed (PowerShell + visual): peek toggles work; tray "Peek"
↔ "Exit peek" item flips correctly; window mode hotkey-press is a
no-op (logs the skip); explicit mode change cancels peek per the
3D-era precedent. PowerShell shows `[peek] registered ...` at boot +
`[peek] toggled on/off` on each press.

## Files

- `desktop/src/main.ts` — globalShortcut.register/unregister, peeking
  module state, togglePeek, notifyPeek, applyMode peek-cancel, IPC
  handlers, tray Peek item
- `desktop/src/preload.ts` — `getPeeking / togglePeek / onPeekChanged`
- `src/api/electron.ts` — renderer-side helpers w/ defensive guards
- `scripts/smoke-4c-peek.mts` (new, 24 assertions) — togglePeek state
  machine, peek-cancel-on-mode-change, defensive bridge guards
