/**
 * Preload script — runs in the renderer's context with Node access. Attaches
 * `window.electronAPI` so the frontend can detect "running in Electron" and
 * call into the main process for Steamworks operations.
 *
 * Phase 6 slice 1: minimal surface — getSteamId, isSteamworksAvailable.
 * Slices 2+ will add auth ticket retrieval (slice 2), game launch + return
 * callbacks (slice 3), wallpaper-mode toggles (slice 4), monitor picking
 * (slice 5).
 *
 * Because main.ts sets `contextIsolation: false`, the assignment to
 * `window.electronAPI` works directly. If we ever flip isolation back on,
 * switch to `contextBridge.exposeInMainWorld`.
 */

import { ipcRenderer, type IpcRendererEvent } from 'electron';

export type WallpaperMode = 'window' | 'wallpaper';

export interface ElectronAPI {
  /** Always true. The renderer checks for presence of window.electronAPI
   *  to switch on Electron-specific code paths (auth, launch). */
  readonly isElectron: true;

  /** Returns the local player's steamID64 as a decimal string, or null if
   *  Steamworks failed to init (Steam not running, SDK binaries missing,
   *  no valid steam_appid.txt). */
  getSteamId(): Promise<string | null>;

  /** Whether the main process successfully initialised steamworks.js.
   *  False means Steamworks-dependent features should be hidden in the UI. */
  isSteamworksAvailable(): Promise<boolean>;

  /** Phase 6 slice 2: hex-encoded Steamworks AuthSessionTicket. The renderer
   *  POSTs this to /api/auth/steamticket on the worker, which verifies it
   *  via Steam Web API and mints the same lw_session cookie the OpenID flow
   *  uses. Null if Steamworks isn't available or the ticket call failed. */
  getAuthTicket(): Promise<string | null>;

  /** Phase 6 slice 3: launch a Steam game via the OS protocol handler.
   *  The main process calls shell.openExternal('steam://run/<appid>'), which
   *  is the only safe way to do this from Electron — assigning
   *  window.location.href in the renderer navigates the window away. Returns
   *  true on a well-formed request; the launch itself is fire-and-forget. */
  launchGame(appid: number): Promise<boolean>;

  /** Phase 6 slice 4: read the current wallpaper-mode state. Either
   *  'window' (regular floating BrowserWindow) or 'wallpaper' (reparented
   *  behind the desktop, click-through, hidden from Alt-Tab). The renderer
   *  uses this to gate PointerLockControls / ConnectorPanel / Footer. */
  getWallpaperMode(): Promise<WallpaperMode>;

  /** Slice 4: request a mode change. Main process performs the platform-
   *  specific reparent, persists the new mode, and broadcasts via
   *  onWallpaperModeChanged so the renderer's state flips too. Tray menu
   *  drives this same path. */
  setWallpaperMode(mode: WallpaperMode): Promise<boolean>;

  /** Slice 4: subscribe to mode changes coming from the main process
   *  (tray menu click, or another renderer if multi-window ever lands).
   *  Returns an unsubscribe function. */
  onWallpaperModeChanged(cb: (mode: WallpaperMode) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const api: ElectronAPI = {
  isElectron: true,
  getSteamId: () => ipcRenderer.invoke('steam:getSteamId') as Promise<string | null>,
  isSteamworksAvailable: () => ipcRenderer.invoke('steam:isAvailable') as Promise<boolean>,
  getAuthTicket: () => ipcRenderer.invoke('steam:getAuthTicket') as Promise<string | null>,
  launchGame: (appid: number) => ipcRenderer.invoke('steam:launchGame', appid) as Promise<boolean>,
  getWallpaperMode: () => ipcRenderer.invoke('wallpaper:getMode') as Promise<WallpaperMode>,
  setWallpaperMode: (mode) =>
    ipcRenderer.invoke('wallpaper:setMode', mode) as Promise<boolean>,
  onWallpaperModeChanged: (cb) => {
    const handler = (_e: IpcRendererEvent, mode: WallpaperMode): void => cb(mode);
    ipcRenderer.on('wallpaper:modeChanged', handler);
    return () => ipcRenderer.off('wallpaper:modeChanged', handler);
  },
};

window.electronAPI = api;
