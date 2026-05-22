# lokilibrary — desktop wrapper

Electron + steamworks.js. Minimal scope: open a window pointed at the
renderer, init Steamworks for auth-ticket + overlay, expose a tiny IPC
surface, quit via tray.

Wallpaper mode (true Progman/WorkerW reparenting) is deferred to v1.x —
Win11 22H2+ UIPI restrictions block cross-process SetParent against
Progman/WorkerW, and SetWindowPos HWND_BOTTOM only achieves "bottom of
normal z-order, in front of icons." The v0.6 wallpaper code is archived
in `legacy-desktop-v0.6/` for reference when we revisit (probably via a
Lively-style privileged helper exe). See `RETROS/phase-0-spike.md`.

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

## One-time Steamworks SDK setup

Drop the Steamworks SDK's `redistributable_bin/<platform>/` into
`desktop/sdk/redistributable_bin/<platform>/` (license terms in
`STEAMWORKS_SDK_LICENSE.txt`). `desktop/steam_appid.txt` holds the
appid — `480` (Spacewar) for development before partner approval, the
real appid afterward.

## Verifying

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

## File layout

```
desktop/
  src/
    main.ts                 — Electron lifecycle, IPC, Steamworks init, tray
    preload.ts              — IPC bridge surfaced as window.electronAPI
  assets/
    tray-icon.png           — system tray icon
  sdk/                      — Steamworks SDK redistributable (gitignored)
  steam_appid.txt           — AppID for steamworks.js init (gitignored)
  STEAMWORKS_SDK_LICENSE.txt
```
