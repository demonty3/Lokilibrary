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

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';

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

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#15121d',
    show: false, // unhide after the renderer signals first paint to avoid white flash
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
  return win;
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

// Phase 6 slice 2: hand the renderer a hex-encoded AuthSessionTicket so it
// can POST /api/auth/steamticket to the worker and get an lw_session cookie
// without going through the OpenID flow the web build uses.
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (steamClient) {
    try {
      steamworks.shutdown?.();
    } catch {
      /* best effort */
    }
  }
  if (process.platform !== 'darwin') app.quit();
});
