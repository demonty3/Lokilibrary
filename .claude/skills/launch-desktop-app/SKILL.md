---
name: launch-desktop-app
description: >-
  Launch and drive the Lokilibrary Electron desktop app (the memory-palace
  wrapper in desktop/) on macOS, with CDP attached for screenshots and
  keyboard/state driving. Use this WHENEVER the user wants to run, start, boot,
  open, launch, demo, screenshot, or verify-a-change-in the DESKTOP / Electron
  app — phrasings like "launch the app", "run the desktop app", "start
  Lokilibrary", "boot the wrapper", "show me the app", "screenshot the desktop
  build", "does this work in the real app", or "open the memory palace". Prefer
  this over an ad-hoc `npm run dev` because the desktop app has macOS-specific
  boot gotchas (graceful Steam-less init, wallpaper-vs-window mode, and a CDP
  screenshot stall) that this skill already solves. For the plain WEB build in a
  browser (localhost:5183, no Electron), a lighter `npm run dev` + headless
  Chrome is enough — this skill is specifically the Electron desktop wrapper.
---

# Launch the Lokilibrary desktop app (macOS)

Boots the Electron wrapper in `desktop/` pointed at the Vite renderer, with the
Chrome DevTools Protocol exposed so you can screenshot it and drive it
(keystrokes, read live store state). This is the verified macOS path — it
encodes the boot quirks so you don't rediscover them.

## TL;DR

```bash
SK=.claude/skills/launch-desktop-app/scripts
bash $SK/launch.sh                 # Vite + Electron + CDP on :9222 → prints READY
node $SK/drive.mjs window          # flip to window mode (enables keybinds + clean capture)
node $SK/drive.mjs state           # read live store state
node $SK/drive.mjs key r 1         # press a key (e.g. 'r' to cycle region terminals)
node $SK/drive.mjs shot /tmp/x.png # screenshot the window (see "Capturing" caveat)
```

## What the app is

A PixiJS (WebGL) memory-palace renderer hosted in an Electron shell
(`desktop/src/main.ts`). The shell adds Steam auth, launch-via-Steamworks, a
system-tray window/wallpaper toggle, and the macOS desktop-wallpaper window
level. The renderer is the same code served by Vite at `localhost:5183`; the
desktop app just loads that URL into a `BrowserWindow` (via the
`LOKILIBRARY_RENDERER_URL` env, which `launch.sh` sets).

Without a signed-in Steam profile the renderer falls back to the bundled sample
library — so it renders a full world with **no Steam, no Worker, no API keys**.

## Launching — `scripts/launch.sh`

The script is idempotent and does three things:

1. **Vite renderer** — starts `npm run dev` (repo root → `localhost:5183`) only
   if it isn't already serving. Log: `/tmp/loki-vite.log`.
2. **Build the main process** — `npx tsc` in `desktop/` (emits `dist/`).
3. **Electron** — relaunches with `--remote-debugging-port=9222` and the
   renderer URL. Log: `/tmp/loki-electron.log`.

Then it waits for CDP + a rendered canvas and prints `READY`.

A healthy boot log looks like this (the Steam failure is EXPECTED and harmless):

```
[steamworks] init failed: Could not determine Steam client install directory.
[startup] userData=…/lokilibrary-desktop initialMode=window
DevTools listening on ws://127.0.0.1:9222/devtools/browser/…
```

`initSteam()` catches a missing/closed Steam client and keeps running with
Steam-gated features disabled — you do NOT need Steam open, the Steamworks SDK
redistributables, or a partner appid to launch and render.

## Window mode vs wallpaper mode (READ THIS before driving)

The app restores a **persisted** mode (`desktop/src/config.ts`,
`<userData>/config.json`). It boots into one of:

- **window** — a normal on-screen window. **You want this for driving:**
  keybinds work and the window is cleanly screenshot-able.
- **wallpaper** — the renderer is pinned to the macOS desktop-picture window
  level. In this mode App.tsx **ignores all keyboard input** (`if
  (wallpaperMode) return` — the wallpaper layer never consumes input), so
  `drive.mjs key …` does nothing.

So after launch, run `node drive.mjs window` once. It calls the
`wallpaper:setMode` IPC (the renderer has `nodeIntegration`, so the driver can
reach `ipcRenderer`). This also flips the store's `wallpaperMode` to `false`,
re-enabling keybinds. Note it **persists** `window` to config; flip back with
`node drive.mjs wallpaper` if you want the saved preference restored.

## Driving — `scripts/drive.mjs`

All verbs connect to the renderer over CDP on `:9222`.

| Verb | Effect |
|---|---|
| `state` | print live store: `{wallpaper, throttle, level, region, focusedPane, panes}` |
| `eval "<expr>"` | evaluate a JS expression in the page (awaits promises) |
| `key <Key> [n]` | dispatch a key `n` times (2.2 s apart, so a remount settles) |
| `window` / `wallpaper` | flip the desktop window mode via IPC |
| `shot <out.png>` | `screencapture -l<id>` of the app's own window (occlusion-proof) |

**Reading store state** works by dynamically `import()`-ing the Vite-served ES
source (`/src/state/store.ts`) *inside the page* — no need to expose the store on
`window`. Extend `state`/`eval` the same way to inspect anything the store or
renderer holds.

**Keys** map to App.tsx's handlers (all gated on window mode): `r` cycles the
focused cell pane through library wings (region terminals), `[` / `]` zoom the
scale ladder, `|` splits the focused pane, `Tab` cycles focus, `\` toggles the
study arrangement.

### Example: verify region terminals end-to-end

```bash
bash $SK/launch.sh
node $SK/drive.mjs window
node $SK/drive.mjs state            # → region:null, level:cell
node $SK/drive.mjs key r 1
node $SK/drive.mjs state            # → region:"d0"  (a different generated world)
node $SK/drive.mjs key r 1
node $SK/drive.mjs state            # → region:"d1"
```

The `region` field flipping `null → d0 → d1 → …` is hard proof the keypress
reached the real handler and mutated the store — independent of any screenshot.

## Capturing a screenshot (the one fiddly part)

`drive.mjs shot` captures the app's **own window by CGWindowID**
(`screencapture -l<id>`, with the id resolved by the bundled `winid.swift`).
Two dead ends it deliberately avoids — don't reach for them:

- **CDP `Page.captureScreenshot` hangs indefinitely** against this app — the
  Electron-on-macOS hardware-GPU surface doesn't yield a capture frame for an
  off-active-display window. `fromSurface:false` / `captureBeyondViewport` /
  `Page.bringToFront` (which only raises the web tab, not the OS window) don't
  help. Launching with `--disable-gpu` or `--use-angle=swiftshader` unsticks it
  but **breaks PixiJS's WebGL context** (`Failed to create context`) → blank
  canvas. So CDP capture is out; render with the real GPU and grab via the OS.
- **`screencapture -R<x,y,w,h>` (region) grabs the wrong window** — it captures
  whatever is frontmost in that screen rectangle, so any window overlapping the
  app ends up in the shot. Capturing by window id avoids this: `-l<id>` reads
  the target window's backing store regardless of z-order, even occluded.

**One-time setup it needs:** Screen Recording permission for the host
terminal/app (System Settings → Privacy & Security → Screen Recording), then
relaunch that app. Without it, `screencapture` errors `could not create image
from display`. (CDP driving + state reads need NO such permission — only image
capture does.) The app must also be in **window mode** so it has a normal
on-screen window for `winid.swift` to find — run `drive.mjs window` first.

If the app isn't the only Electron app running, set `LOKI_APP_OWNER` to
disambiguate (the dev build's owner name is `Electron`).

## Teardown

```bash
pkill -f "remote-debugging-port=9222"   # the Electron app
pkill -f vite                           # the renderer (optional)
```

## Status of this recipe

Verified end-to-end on macOS: launch, Steam-less boot, CDP attach, window-mode
flip, live state reads, key-driving (region terminals cycled `null → d0 → d1` in
the desktop build), and window-id `screencapture` producing a real frame of the
"Memory Palace" window. The only external requirement is the one-time Screen
Recording grant for image capture.
