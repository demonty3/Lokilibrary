# lokilibrary — desktop wrapper

Electron + steamworks.js + wallpaper mode (Win11 22H2+ reparenting on Windows /
desktop-level `NSWindow` on macOS).

Scope: open a window pointed at the renderer, init Steamworks for auth-
ticket + overlay, expose a tiny IPC surface, system tray with
Window/Wallpaper toggle + Quit, persist the wallpaper-mode setting.

Wallpaper mode reparents the window behind desktop icons via Progman
on Win11 22H2+ (raised-desktop topology) or via WorkerW on older
builds. Technique ported from [Lively](https://github.com/rocksdanister/lively)
(`src/Lively/Lively/Core/WinDesktopCore.cs`). The v0.6 wallpaper attempt
that targeted WorkerW directly is archived in `legacy-desktop-v0.6/`
for historical reference. **Don't run as administrator** — Lively
documents and we replicate the same gotcha: elevated processes can't
`SetParent` against Progman even on the raised-desktop path.

## Running on Windows (required for Electron)

**Must be Windows-native Node**, not WSL. WSL's Linux Electron can't
reach the Windows Steam client (`steamclient.so` init fails), and
WSLg's GPU passthrough chokes Chromium's renderer process. Vite + the
Cloudflare Worker can stay in WSL; only this Electron terminal needs
Windows-native Node.

```powershell
# Terminal 1 — Vite dev server (WSL or Windows)
cd C:\path\to\lokilibrary
npm install
npm run dev               # localhost:5183, the PixiJS renderer

# Terminal 2 — Cloudflare Worker (WSL or Windows)
npm run worker            # localhost:8787

# Terminal 3 — Electron desktop wrapper (Windows-native only)
cd desktop
npm install
npm run dev               # Electron points at localhost:5183
```

## Running on macOS

No WSL caveat — the Mac build runs from any terminal. You need Steam running for
`steamworks.js` to init (the app still loads without it; Steam-gated features
just stay disabled).

```bash
# Terminal 1 — Vite dev server
npm install
npm run dev               # localhost:5183, the PixiJS renderer

# Terminal 2 — Cloudflare Worker (optional, for Tier 1+ LLM calls)
npm run worker

# Terminal 3 — Electron desktop wrapper
cd desktop
npm install
echo 480 > steam_appid.txt   # one-time; SpaceWar dev appid
npm run dev               # Electron points at localhost:5183
```

Wallpaper mode drops the window to the macOS desktop-picture window level
(`-[NSWindow setLevel:]` + an all-Spaces/stationary collection behavior, via a
koffi → Objective-C bridge — see `src/wallpaper/macos.ts`). No reparenting, so
the live PixiJS renderer keeps its state across a toggle.

## One-time Steamworks SDK setup

Drop the Steamworks SDK's `redistributable_bin/<platform>/` into
`desktop/sdk/redistributable_bin/<platform>/` (license terms in
`STEAMWORKS_SDK_LICENSE.txt`). `desktop/steam_appid.txt` holds the
appid — `480` (Spacewar) for development before partner approval, the
real appid afterward.

## Verifying

### Steamworks

- **Steamworks init** — console log `[steamworks] init OK — steamid ...`
  on app startup. If Steam isn't running, the log is a warn and the app
  still loads; Steamworks-gated features just stay disabled.
- **Auth ticket** — renderer can call `window.electronAPI.getAuthTicket()`
  and POST the hex string to `/api/auth/steamticket` on the worker.
- **Launch** — renderer calls `window.electronAPI.launchGame(appid)`;
  Steam should open the game (or the install dialog).
- **Overlay** — Shift+Tab while the Electron window has focus should
  bring up the Steam overlay over the PixiJS canvas (requires Steam
  running and Steamworks init succeeding).

### Wallpaper mode (Windows)

**Startup logs to look for:**

- `[wallpaper:windows] IsUserAnAdmin = false` — must be false. If true,
  wallpaper mode refuses to enter; restart without admin.
- `[wallpaper:windows] raised-desktop = true` on Win11 22H2+, `false`
  on older builds. Confirms the right reparent branch is chosen.

**Acceptance protocol** (after tray → Wallpaper mode):

1. **Alt+Tab does not list the Electron window.** Confirms `WS_CHILD`
   propagated + `setSkipTaskbar(true)`.
2. **Right-click desktop → View → "Show desktop icons" off then on.**
   Icons should re-render *over* the renderer canvas. Confirms
   `SHELLDLL_DefView` is z-ordered above us (raised-desktop path).
3. **Win+D shows desktop, content stays visible.** We *are* the
   desktop — unlike the v0.6 HWND_BOTTOM fallback which got covered.
4. **Drag a File Explorer window across.** No flicker, window doesn't
   pop forward.
5. **Win+P → switch display mode** (or unplug/replug a monitor). The
   wallpaper re-attaches within ~2–3 s — confirms the WorkerW liveness
   watchdog + Progman re-spawn path.

**Tray-toggle round-trip:**

- Tray → Wallpaper mode → window disappears from taskbar
- Tray → Window mode → window returns to normal floating + taskbar
- Quit + restart → window opens in the last-persisted mode

**Troubleshooting:**

- If step (3) fails but (1) passes: `SetParent` worked but z-order is
  wrong. Look for `SHELLDLL_DefView not found` in the console — it
  means the FindWindowEx for the icon container failed.
- If (1) fails: `SetParent` was rejected. Check the
  `IsUserAnAdmin` log line. If false, also check that `GetShellWindow`
  returned a non-null handle (logged as the parent in attach success
  message).

### Wallpaper mode (macOS)

**Startup logs:** `[wallpaper:macos] entered — level …` on tray → Wallpaper,
`[wallpaper:macos] exited` on the way back. `objc bridge init failed` or
`no NSWindow for handle` means it fell back to a normal window.

**Acceptance protocol** (after tray → Wallpaper mode):

1. Window drops **behind the desktop icons**; icons stay clickable.
2. Content stays visible across a Mission Control swipe and on every Space
   (CanJoinAllSpaces + Stationary collection behavior).
3. Survives a resolution / display-mode change (System Settings → Displays).
4. **Cmd-Tab does not list the window**, and the Dock icon disappears while the
   menu-bar tray stays (activation policy → `accessory`).
5. Tray → Window mode restores a normal floating window + Dock icon.
6. Quit + relaunch reopens in the last-persisted mode.

**Known rough edge:** the window is created `frame: true`; wallpaper mode hides
the traffic lights and relies on click-through, but a fully chromeless look
would want a frameless window (a later change). Desktop level may need a ±1
nudge on some display setups — see the comment in `macos.ts`.

## File layout

```
desktop/
  src/
    main.ts                 — Electron lifecycle, IPC, Steamworks init,
                              tray, applyMode wallpaper orchestrator
    preload.ts              — IPC bridge surfaced as window.electronAPI
    config.ts               — persisted wallpaper-mode (JSON in userData)
    wallpaper/
      index.ts              — platform dispatch (win32 vs darwin)
      windows.ts            — Lively-style Progman/WorkerW reparent,
                              raised-desktop + classic branches, koffi FFI
      macos.ts              — desktop-level NSWindow via koffi→objc bridge
  assets/
    tray-icon.png           — system tray icon
  sdk/                      — Steamworks SDK redistributable (gitignored)
  steam_appid.txt           — AppID for steamworks.js init (gitignored)
  STEAMWORKS_SDK_LICENSE.txt
```
