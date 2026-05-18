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

import { ipcRenderer } from 'electron';

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
};

window.electronAPI = api;
