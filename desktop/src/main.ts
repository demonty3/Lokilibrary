/**
 * Main process for the lokilibrary desktop wrapper.
 *
 * Scratch-rebuilt after the v0.6 inherited wrapper was archived to
 * legacy-desktop-v0.6/. Wallpaper-mode reparenting was restored in the
 * claude/wallpaper-revival branch using Lively's Win11 22H2+ Progman-
 * reparent technique (see src/wallpaper/windows.ts). Peek hotkey and
 * multi-monitor picker remain out of scope for this revival.
 *
 * What this file does:
 *   - Open an Electron BrowserWindow pointed at the renderer
 *   - Initialise steamworks.js (Steam overlay + auth ticket source)
 *   - Expose IPC for getSteamId / isAvailable / getAuthTicket /
 *     launchGame / wallpaper:getMode / wallpaper:setMode
 *   - System tray with Window/Wallpaper mode toggle + Quit
 *   - Restore the persisted wallpaper mode on startup
 *
 * What this file does NOT do (intentionally):
 *   - Hotkey peek
 *   - Multi-monitor picker
 */

import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'node:path';
import { enterWallpaper, exitWallpaper } from './wallpaper';
import { getMode, setMode, type Mode } from './config';

// steamworks.js types aren't perfectly matched to our usage so we import as
// `any` at the require boundary and contain the looseness here.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const steamworks: any = require('steamworks.js');

/** SpaceWar — Valve's public dev test appid. Swap for our real appid once
 *  the Steamworks partner application is approved. */
const DEFAULT_APP_ID = 480;

interface SteamworksClient {
  localplayer: { getSteamId: () => { steamId64: bigint; accountId: number } };
  auth?: {
    getAuthTicketForWebApi?: (
      identity: string,
      timeoutSeconds?: number | null,
    ) => Promise<{ getBytes: () => Buffer | Uint8Array }>;
  };
}

/** Shared between this file's getAuthTicket IPC and the worker's
 *  verifyAuthSessionTicket call. Both ends must use the same identity
 *  string or Steam rejects the ticket as cross-identity. */
const WEB_API_IDENTITY = 'lokilibrary';

let steamClient: SteamworksClient | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Forward-declared because applyMode references mainWindow + tray (above)
// and rebuildTrayMenu references applyMode (below). Hoisted function decls
// would let us order this however; we use function-decl-then-mutate-state
// for symmetry with the existing initSteam / createWindow pattern.

function initSteam(): void {
  const appId = Number(process.env.LOKILIBRARY_STEAM_APPID) || DEFAULT_APP_ID;
  try {
    steamClient = steamworks.init(appId);
    const id = steamClient?.localplayer.getSteamId();
    if (id) {
      // eslint-disable-next-line no-console
      console.log(`[steamworks] init OK — steamid ${id.steamId64.toString()}`);
    }
  } catch (e) {
    // Most common cause: Steam isn't running, or SDK redistributables
    // aren't in the expected path. Log and continue — the renderer can
    // still load; Steamworks-gated features just stay disabled.
    // eslint-disable-next-line no-console
    console.warn('[steamworks] init failed:', (e as Error).message);
    steamClient = null;
  }
}

function rendererUrl(): string {
  const override = process.env.LOKILIBRARY_RENDERER_URL;
  if (override) return override;
  // __dirname after tsc is desktop/dist; bundled web build sits at repo
  // root /dist/. Two levels up + into dist/index.html.
  const bundled = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
  return `file://${bundled}`;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#15121d',
    show: false, // unhide after ready-to-show to avoid white flash
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // steamworks.js requires nodeIntegration + contextIsolation: false.
      // Discipline cost: do not load untrusted remote content into this
      // window — external links go through shell.openExternal.
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

function createTray(): Tray {
  // Compiled main.js sits at desktop/dist/main.js; the asset is at
  // desktop/assets/tray-icon.png. Two levels up.
  const iconPath = path.resolve(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const sized = icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
  const t = new Tray(sized);
  t.setToolTip('lokilibrary');
  rebuildTrayMenu(t);
  return t;
}

function rebuildTrayMenu(t: Tray): void {
  const current = getMode();
  // 'checkbox' rather than 'radio' on purpose: per v0.6 retro, Electron
  // radio menu items auto-fire their click handlers when setContextMenu
  // rebuilds on Win11 (well-known issue). The applyMode no-op guard below
  // catches any stray auto-fire either way; checkbox just makes the menu
  // less weird-looking when both items happen to be unchecked momentarily.
  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Window mode',
      type: 'checkbox',
      checked: current === 'window',
      click: () => applyMode('window'),
    },
    {
      label: 'Wallpaper mode',
      type: 'checkbox',
      checked: current === 'wallpaper',
      click: () => applyMode('wallpaper'),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ];
  t.setContextMenu(Menu.buildFromTemplate(items));
}

/** Apply a mode transition. Persists the chosen mode so the next launch
 *  starts in the same state, rebuilds the tray so checkmarks stay in sync,
 *  and broadcasts to the renderer in case it has mode-gated UI. */
function applyMode(mode: Mode): void {
  if (!mainWindow) return;
  // Electron menu items can fire their click handlers when setContextMenu
  // rebuilds; without this guard a wallpaper-mode rebuild would re-fire
  // applyMode('wallpaper'), which would then re-enterWallpaper (mostly
  // idempotent but wasteful) and re-rebuild the menu, etc. Real user
  // clicks always represent a real transition because the *other* mode
  // is what they're picking.
  if (getMode() === mode) return;

  if (mode === 'wallpaper') {
    enterWallpaper(mainWindow);
  } else {
    exitWallpaper(mainWindow);
  }
  setMode(mode);
  if (tray) rebuildTrayMenu(tray);
  try {
    mainWindow.webContents.send('wallpaper:modeChanged', mode);
  } catch {
    // webContents may not be ready on early startup; the renderer can
    // poll getWallpaperMode() on mount as a backstop.
  }
}

// --- IPC bridge ----------------------------------------------------------

ipcMain.handle('steam:getSteamId', () => {
  if (!steamClient) return null;
  try {
    return steamClient.localplayer.getSteamId().steamId64.toString();
  } catch {
    return null;
  }
});

ipcMain.handle('steam:isAvailable', () => steamClient !== null);

// Launch a Steam game via the OS protocol handler. shell.openExternal
// hands the URL to the OS, which routes to the Steam client cleanly —
// in contrast, assigning window.location.href in the renderer would
// navigate the Electron window away from our app.
ipcMain.handle('steam:launchGame', (_event, appid: unknown) => {
  if (typeof appid !== 'number' || !Number.isInteger(appid) || appid <= 0) {
    return false;
  }
  void shell.openExternal(`steam://run/${appid}`);
  return true;
});

// Hex-encoded AuthSessionTicket. Renderer POSTs this to
// /api/auth/steamticket on the worker, which verifies via Steam Web API
// and mints a session cookie without the OpenID round-trip.
// Wallpaper-mode IPC. Renderer reads + sets the mode; main process handles
// the platform-specific reparent + persistence + tray sync.
// User-data path — Phase 2F renderer-side memory store bootstrap reads
// this to decide where memory.sqlite + vaults/ live. Electron's
// `app.getPath('userData')` returns the OS-appropriate per-user
// app-data dir; on Windows that's typically AppData/Roaming/lokilibrary.
ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

ipcMain.handle('wallpaper:getMode', () => getMode());
ipcMain.handle('wallpaper:setMode', (_event, mode: unknown) => {
  if (mode !== 'window' && mode !== 'wallpaper') return false;
  applyMode(mode);
  return true;
});

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

  // Steam overlay must be enabled after the BrowserWindow exists so it
  // can attach to the Chromium swap chain.
  try {
    steamworks.electronEnableSteamOverlay();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[steamworks] overlay enable failed:', (e as Error).message);
  }

  tray = createTray();
  const initialMode = getMode();
  // eslint-disable-next-line no-console
  console.log(`[startup] userData=${app.getPath('userData')} initialMode=${initialMode}`);

  // Restore persisted wallpaper mode after the window's first paint. Fresh
  // SetParent-against-Progman on a not-yet-shown window can leave it
  // invisible on some Win11 builds; ready-to-show fires after the renderer
  // has produced at least one frame.
  if (initialMode === 'wallpaper' && mainWindow) {
    mainWindow.once('ready-to-show', () => {
      // Bypass applyMode's "already in this mode" guard — config says
      // 'wallpaper' but we haven't actually entered wallpaper yet.
      if (mainWindow) enterWallpaper(mainWindow);
      if (tray) rebuildTrayMenu(tray);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  tray?.destroy();
  tray = null;
  if (steamClient) {
    try {
      steamworks.shutdown?.();
    } catch {
      /* best effort */
    }
  }
  if (process.platform !== 'darwin') app.quit();
});
