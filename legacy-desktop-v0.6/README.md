# Memory Palace — desktop wrapper

Electron + steamworks.js + custom Win32 wallpaper-mode reparenting.
Carried forward from the LibraryWorld v0.6 work (slices 1–6); the
renderer it hosts is now the Phase 0 PixiJS spike, not the 3D scene.

## Running on Windows (required for Electron)

**Must be Windows-native Node**, not WSL. WSL's Linux Electron can't
reach the Windows Steam client (`steamclient.so` init fails), and
WSLg's GPU passthrough chokes Chromium's renderer process. The Vite
dev server + Cloudflare Worker can stay in WSL; only this Electron
terminal needs Windows-native.

```powershell
# In one terminal — Vite dev server (WSL or Windows, either works)
cd C:\path\to\libraryworld
npm install
npm run dev               # localhost:5183, the PixiJS renderer

# In another terminal — Cloudflare Worker (WSL or Windows)
npm run worker            # localhost:8787, Steam OpenID + AI orchestration

# In a third terminal — Electron desktop wrapper (Windows-native only)
cd desktop
npm install
npm run dev               # Electron points at localhost:5183
```

## One-time Steamworks SDK setup

Drop the Steamworks SDK's `redistributable_bin/<platform>/` into
`desktop/sdk/redistributable_bin/<platform>/` (license terms in
`STEAMWORKS_SDK_LICENSE.txt`). `desktop/steam_appid.txt` holds the
appid — `480` (Spacewar) for development before partner approval,
the real appid afterward.

## Verifying the Phase 0 spike

In wallpaper mode the Electron window reparents behind the desktop
icons via WorkerW. The PixiJS canvas should render the Solarized box-
drawing-glyph panel as the live wallpaper.

- **Tray menu** → "Wallpaper mode" toggle reparents the window.
- **Ctrl+Alt+L** (CmdOrCtrl+Alt+L on macOS) lifts the wallpaper into
  the foreground temporarily without changing the persisted mode.
- **Shift+Tab** while the Electron window is focused brings up the
  Steam overlay over the PixiJS canvas (only if launched via Steam or
  with steamworks.js initialised against a running Steam client).
- **Tray → Display submenu** picks which monitor hosts the wallpaper.

If any of these regress vs the LibraryWorld v0.6 build, the suspect
is renderer-coupled wallpaper code — but the Win32 reparenting in
`src/wallpaper/windows.ts` is library-agnostic so the failure is more
likely in PixiJS canvas lifecycle (e.g. resize handler timing during
the WorkerW reparent settle).

## File layout

```
desktop/
  src/
    main.ts                 — Electron app lifecycle, IPC, Steamworks
                              init, tray + display + peek orchestration
    preload.ts              — IPC bridge surfaced to the renderer
    tray.ts                 — system tray menu + display submenu
    config.ts               — persisted wallpaper mode + displayId
    wallpaper/
      index.ts              — platform dispatch
      windows.ts            — Progman/WorkerW reparenting, WS_POPUP →
                              WS_CHILD flip, DPI-aware sizing, fallbacks
      macos.ts              — NSWindow.level = kCGDesktopWindowLevel
  sdk/                      — Steamworks SDK redistributable (gitignored)
  steam_appid.txt           — AppID for steamworks.js init
  STEAMWORKS_SDK_LICENSE.txt — Valve's SDK license text
```
