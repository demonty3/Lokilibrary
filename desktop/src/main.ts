/**
 * Main process for the LibraryWorld desktop wrapper.
 *
 * Phase 6 slice 1 scope:
 *   - Open an Electron window pointed at the existing Vite-served renderer
 *   - Initialise steamworks.js so subsequent slices can call its API
 *   - Expose a minimal IPC surface (getSteamId, isSteamworksAvailable) so
 *     the renderer can verify the bridge works
 *   - Enable the Steam overlay via electronEnableSteamOverlay()
 *
 * Not in this slice: wallpaper-mode rendering, auth ticketing to the worker,
 * Steamworks-driven game launch, multi-monitor. Those land in slices 2–5.
 *
 * The renderer URL comes from LIBRARYWORLD_RENDERER_URL when set (dev: point
 * at Vite at localhost:5183) and otherwise falls back to the bundled
 * production build at `../../dist/index.html`. Slice 6's build pipeline
 * will pack that dist alongside the desktop binary.
 */

import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell } from 'electron';
import * as path from 'node:path';
import { enterWallpaper, exitWallpaper } from './wallpaper';
import { createTray, type TrayHandle } from './tray';
import { getDisplayId, getMode, setDisplayId, setMode, type Mode } from './config';

// steamworks.js types aren't perfectly matched to our usage so we import as
// `any` at the require boundary and contain the looseness here.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const steamworks: any = require('steamworks.js');

/** SpaceWar — Valve's public dev test appid. Swap for our real appid once the
 *  Steamworks partner application is approved. */
const DEFAULT_APP_ID = 480;

interface SteamworksClient {
  localplayer: { getSteamId: () => { steamId64: bigint; accountId: number } };
  auth?: {
    /** Web-API-verifiable auth ticket. The identity string must match the
     *  `identity` param the worker sends to Steam's AuthenticateUserTicket
     *  endpoint, or Steam rejects the ticket as cross-identity. */
    getAuthTicketForWebApi?: (
      identity: string,
      timeoutSeconds?: number | null,
    ) => Promise<{ getBytes: () => Buffer | Uint8Array }>;
  };
}

/** Shared between this file's getAuthTicket IPC and the worker's
 *  verifyAuthSessionTicket call. Keep both ends in sync. */
const WEB_API_IDENTITY = 'libraryworld';

let steamClient: SteamworksClient | null = null;

function initSteam(): void {
  const appId = Number(process.env.LIBRARYWORLD_STEAM_APPID) || DEFAULT_APP_ID;
  try {
    steamClient = steamworks.init(appId);
    const id = steamClient?.localplayer.getSteamId();
    if (id) {
      // eslint-disable-next-line no-console
      console.log(`[steamworks] init OK — steamid ${id.steamId64.toString()}`);
    }
  } catch (e) {
    // Most common cause: Steam isn't running locally, or the SDK
    // redistributables aren't present in the expected location. Log and
    // continue — the renderer can still load; it just won't have a Steam
    // session until the user fixes their setup.
    // eslint-disable-next-line no-console
    console.warn('[steamworks] init failed:', (e as Error).message);
    steamClient = null;
  }
}

function rendererUrl(): string {
  const override = process.env.LIBRARYWORLD_RENDERER_URL;
  if (override) return override;
  // __dirname after tsc is desktop/dist; bundled web build sits at repo
  // root /dist/. Two levels up + into dist/index.html.
  const bundled = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
  return `file://${bundled}`;
}

/**
 * The active main window. Module-scoped so applyMode() (mode transitions)
 * and the tray menu can act on it without passing it around. Set by
 * createWindow(); cleared in window-all-closed.
 */
let mainWindow: BrowserWindow | null = null;
let trayHandle: TrayHandle | null = null;

/** Slice 6: "peek" — the user hit the global hotkey to temporarily lift the
 *  wallpaper into an interactive, foreground window without changing the
 *  persisted mode. Reset when applyMode() runs (real mode change should
 *  always win over a transient peek). */
let peeking = false;

/** Slice 6: global shortcut for the peek toggle. Ctrl+Alt+L on Win/Linux,
 *  Cmd+Alt+L on macOS. Three-key combinations are unlikely to clash with
 *  game keybinds or the OS. Configurable in a later slice if needed. */
const PEEK_ACCELERATOR = 'CmdOrCtrl+Alt+L';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#15121d',
    show: false, // unhide after the renderer signals first paint to avoid white flash
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // steamworks.js requires nodeIntegration + contextIsolation: false
      // (SPEC §6.2). Discipline cost: don't load untrusted remote content
      // into this window — share-URL previews stay in the system browser.
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  void win.loadURL(rendererUrl());
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

/**
 * Apply a mode transition: reparent under WorkerW (or platform equivalent)
 * for wallpaper mode, or restore the normal floating window for window mode.
 * Persists the chosen mode so the next launch starts in the same state.
 * Broadcasts the change to the renderer so the UI can hide/show its
 * interaction layer.
 */
/**
 * Resolve the user's chosen display, falling back to primary if the
 * persisted id no longer matches a connected monitor (unplugged, swapped).
 * Slice 5.
 */
function resolveTargetDisplay(): Electron.Display {
  const id = getDisplayId();
  if (id !== undefined) {
    const match = screen.getAllDisplays().find((d) => d.id === id);
    if (match) return match;
    // eslint-disable-next-line no-console
    console.warn(`[wallpaper] saved displayId ${id} not found; using primary`);
  }
  return screen.getPrimaryDisplay();
}

function applyMode(mode: Mode): void {
  if (!mainWindow) return;
  // An explicit mode change always wins over a transient peek. Clear the
  // flag + drop alwaysOnTop before re-entering so we don't leave the window
  // pinned above other apps after the user toggles back to wallpaper.
  if (peeking) {
    peeking = false;
    mainWindow.setAlwaysOnTop(false);
    notifyPeek();
  }
  if (mode === 'wallpaper') {
    enterWallpaper(mainWindow, resolveTargetDisplay());
  } else {
    exitWallpaper(mainWindow);
  }
  setMode(mode);
  trayHandle?.rebuild();
  // Broadcast to the renderer so the frontend store can flip its
  // wallpaperMode flag (which gates PointerLockControls / ConnectorPanel /
  // Footer rendering in App.tsx).
  try {
    mainWindow.webContents.send('wallpaper:modeChanged', mode);
  } catch {
    // webContents may not be ready on very early startup; the renderer
    // calls getWallpaperMode() on mount as a backstop.
  }
}

/**
 * Slice 6: lift wallpaper into a foreground interactive window, or restore
 * it. Persisted mode stays 'wallpaper' the whole time — peek is a transient
 * UI affordance, not a real mode change. No-op when the persisted mode is
 * 'window' (the window is already interactive; nothing to peek into).
 */
function togglePeek(): void {
  if (!mainWindow) return;
  if (getMode() !== 'wallpaper') return;
  peeking = !peeking;
  if (peeking) {
    exitWallpaper(mainWindow);
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
  } else {
    mainWindow.setAlwaysOnTop(false);
    enterWallpaper(mainWindow, resolveTargetDisplay());
  }
  trayHandle?.rebuild();
  notifyPeek();
}

function notifyPeek(): void {
  if (!mainWindow) return;
  try {
    mainWindow.webContents.send('wallpaper:peekChanged', peeking);
  } catch {
    // pre-load: renderer reads getPeeking() on mount as a backstop.
  }
}

/**
 * Move the wallpaper to a different monitor without leaving wallpaper mode.
 * Persists the choice immediately so the next launch lands on the same
 * display. No-op if we're currently in window mode — the new id is still
 * saved and will be honored next time the user flips to wallpaper.
 */
function applyDisplay(displayId: number | undefined): void {
  setDisplayId(displayId);
  trayHandle?.rebuild();
  if (!mainWindow) return;
  if (getMode() !== 'wallpaper') return;
  // Re-enter to pick up the new bounds. exit-then-enter is heavier than a
  // bare setBounds, but it also re-runs the SetParent/style-flip path,
  // which is the right reset if the WorkerW situation changed under us
  // (display hot-plug, Explorer restart).
  exitWallpaper(mainWindow);
  enterWallpaper(mainWindow, resolveTargetDisplay());
}

// --- IPC bridge ----------------------------------------------------------
// Slice 1's surface is intentionally minimal. Slices 2+ will add
// launchGame, auth-ticket retrieval, overlay-event subscription, etc.

ipcMain.handle('steam:getSteamId', () => {
  if (!steamClient) return null;
  try {
    return steamClient.localplayer.getSteamId().steamId64.toString();
  } catch {
    return null;
  }
});

ipcMain.handle('steam:isAvailable', () => steamClient !== null);

// Phase 6 slice 3: launch a Steam game via the OS protocol handler instead
// of letting the renderer set window.location.href (which would navigate
// the Electron window AWAY from our app to a steam:// URL — Chromium
// handles that awkwardly). shell.openExternal hands the URL to the OS,
// which routes to the Steam client cleanly.
//
// Return-trip detection stays focus-event-based for now (App.tsx). Steamworks
// proper game-launch/quit callbacks aren't exposed by steamworks.js v0.4 —
// re-evaluate at Phase 7 polish if a polling-based detection is worth it.
ipcMain.handle('steam:launchGame', (_event, appid: unknown) => {
  if (typeof appid !== 'number' || !Number.isInteger(appid) || appid <= 0) {
    return false;
  }
  void shell.openExternal(`steam://run/${appid}`);
  return true;
});

// Phase 6 slice 2: hand the renderer a hex-encoded AuthSessionTicket so it
// can POST /api/auth/steamticket to the worker and get an lw_session cookie
// without going through the OpenID flow the web build uses.
// Phase 6 slice 4: wallpaper mode bridge. Renderer reads + sets the mode;
// main process handles the platform-specific reparenting + persistence.
ipcMain.handle('wallpaper:getMode', () => getMode());
ipcMain.handle('wallpaper:setMode', (_event, mode: unknown) => {
  if (mode !== 'window' && mode !== 'wallpaper') return false;
  applyMode(mode);
  return true;
});

// Slice 5: multi-monitor picker. The renderer reads the display list to
// show a chooser in the connector panel; both renderer and tray can change
// the chosen display.
ipcMain.handle('wallpaper:getDisplays', () =>
  screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
  })),
);
ipcMain.handle('wallpaper:getDisplayId', () => getDisplayId() ?? null);
ipcMain.handle('wallpaper:setDisplayId', (_event, id: unknown) => {
  if (id !== null && id !== undefined && typeof id !== 'number') return false;
  applyDisplay(typeof id === 'number' ? id : undefined);
  return true;
});

// Slice 6: peek bridge. The renderer rarely needs to drive this — the
// hotkey + tray cover it — but exposing the toggle makes it possible for
// the connector panel to surface a "press Ctrl+Alt+L to peek" hint and to
// dismiss peek with a click.
ipcMain.handle('wallpaper:getPeeking', () => peeking);
ipcMain.handle('wallpaper:togglePeek', () => {
  togglePeek();
  return peeking;
});
ipcMain.handle('wallpaper:getPeekAccelerator', () => PEEK_ACCELERATOR);

ipcMain.handle('steam:getAuthTicket', async () => {
  if (!steamClient || !steamClient.auth?.getAuthTicketForWebApi) return null;
  try {
    const ticket = await steamClient.auth.getAuthTicketForWebApi(WEB_API_IDENTITY);
    const bytes = ticket.getBytes();
    return Buffer.from(bytes).toString('hex');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[steamworks] getAuthTicket failed:', (e as Error).message);
    return null;
  }
});

// --- Lifecycle -----------------------------------------------------------

void app.whenReady().then(() => {
  initSteam();
  createWindow();

  // Steam overlay must be enabled *after* the BrowserWindow exists so it
  // can attach to the Chromium swap chain.
  try {
    steamworks.electronEnableSteamOverlay();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[steamworks] overlay enable failed:', (e as Error).message);
  }

  // Tray + initial mode application. Tray gives the user a way out of
  // wallpaper mode (in-world UI is unreachable when the window is
  // click-through). Initial mode comes from persisted config.
  trayHandle = createTray({
    getMode,
    applyMode,
    getDisplayId: () => getDisplayId() ?? null,
    applyDisplay,
    getPeeking: () => peeking,
    togglePeek,
    peekAccelerator: PEEK_ACCELERATOR,
  });

  // Slice 6: register the peek hotkey. Returns false when another app
  // already owns the combo — log and continue so the tray item still works.
  const ok = globalShortcut.register(PEEK_ACCELERATOR, togglePeek);
  if (!ok) {
    // eslint-disable-next-line no-console
    console.warn(`[peek] global shortcut ${PEEK_ACCELERATOR} already claimed; use the tray to peek`);
  }

  const initialMode = getMode();
  // eslint-disable-next-line no-console
  console.log(
    `[startup] userData=${app.getPath('userData')} initialMode=${initialMode}`,
  );
  if (initialMode === 'wallpaper') {
    // Wait for the renderer to be ready before reparenting — fresh WorkerW
    // SetParent on a not-yet-shown window can leave it invisible.
    mainWindow?.once('ready-to-show', () => applyMode('wallpaper'));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Slice 6: globalShortcut bindings persist until Electron explicitly tears
// them down — leaving the combo registered after quit would prevent the
// next launch from re-registering cleanly. unregisterAll is safe to call
// even if nothing was registered.
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  trayHandle?.destroy();
  trayHandle = null;
  if (steamClient) {
    try {
      steamworks.shutdown?.();
    } catch {
      /* best effort */
    }
  }
  if (process.platform !== 'darwin') app.quit();
});
