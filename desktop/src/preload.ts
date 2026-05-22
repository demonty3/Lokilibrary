/**
 * Preload script — runs in the renderer's context with Node access.
 * Attaches `window.electronAPI` so the frontend can detect "running in
 * Electron" and call into the main process for Steamworks operations.
 *
 * Scratch-rebuilt alongside main.ts. Wallpaper-mode + peek + multi-
 * monitor channels are gone — they belong with the deferred v1.x
 * wallpaper revisit (see legacy-desktop-v0.6/src/preload.ts for the
 * historical surface).
 *
 * Because main.ts sets `contextIsolation: false`, the direct assignment
 * to `window.electronAPI` works. If isolation is ever re-enabled, switch
 * to `contextBridge.exposeInMainWorld`.
 */

import { ipcRenderer } from 'electron';

export interface ElectronAPI {
  /** Always true. Renderer checks for presence of window.electronAPI to
   *  switch on Electron-specific code paths (auth ticket, launch). */
  readonly isElectron: true;

  /** Local player's steamID64 as a decimal string, or null if Steamworks
   *  failed to init. */
  getSteamId(): Promise<string | null>;

  /** Whether the main process successfully initialised steamworks.js.
   *  False means Steamworks-dependent features should hide in the UI. */
  isSteamworksAvailable(): Promise<boolean>;

  /** Hex-encoded Steamworks AuthSessionTicket. Renderer POSTs this to
   *  /api/auth/steamticket on the worker, which mints the session
   *  cookie without going through OpenID. Null on failure. */
  getAuthTicket(): Promise<string | null>;

  /** Launch a Steam game via the OS protocol handler. Main process
   *  calls shell.openExternal('steam://run/<appid>') — the only safe
   *  way from Electron, since assigning window.location.href in the
   *  renderer navigates the window away. */
  launchGame(appid: number): Promise<boolean>;
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
};

window.electronAPI = api;
