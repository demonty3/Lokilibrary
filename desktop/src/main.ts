/**
 * Main process for the lokilibrary desktop wrapper.
 *
 * Scope: scratch-rebuilt after the v0.6 inherited wrapper was archived
 * to legacy-desktop-v0.6/. Wallpaper-mode reparenting (custom WorkerW +
 * peek + multi-monitor picker) is deferred to v1.x — Win11 22H2+ UIPI
 * restrictions block cross-process SetParent against Progman/WorkerW,
 * and the SetWindowPos HWND_BOTTOM fallback only achieves "bottom of
 * normal z-order, in front of icons," not true wallpaper layering. See
 * RETROS/phase-0-spike.md.
 *
 * What this file does:
 *   - Open an Electron BrowserWindow pointed at the renderer
 *   - Initialise steamworks.js (Steam overlay + auth ticket source)
 *   - Expose a minimal IPC surface for the renderer: getSteamId,
 *     isSteamworksAvailable, getAuthTicket, launchGame
 *   - System tray with Quit (no mode toggle, no peek, no display picker)
 *
 * What this file does NOT do (intentionally):
 *   - Wallpaper-mode reparenting / WorkerW / Progman manipulation
 *   - Hotkey peek
 *   - Multi-monitor picker
 *   - Persisted config (no mode/display to remember)
 */

import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import * as path from 'node:path';

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
  t.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  return t;
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
  // eslint-disable-next-line no-console
  console.log(`[startup] userData=${app.getPath('userData')}`);

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
