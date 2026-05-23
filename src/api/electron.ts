/**
 * Electron-renderer bridge. Mirrors desktop/src/preload.ts — the two type
 * declarations need to stay in sync (separate TS projects can't share types
 * directly). Phase 6 slice 1 added isElectron/getSteamId/isSteamworksAvailable;
 * slice 2 adds getAuthTicket + the signInWithSteamTicket exchange that runs
 * before fetchMe() on boot in the desktop wrapper.
 */

export type WallpaperMode = 'window' | 'wallpaper';

export interface ElectronAPI {
  readonly isElectron: true;
  getSteamId(): Promise<string | null>;
  isSteamworksAvailable(): Promise<boolean>;
  /** Hex-encoded Steamworks AuthSessionTicket. Pass to /api/auth/steamticket
   *  on the worker, which verifies + mints ll_session. Null on failure. */
  getAuthTicket(): Promise<string | null>;
  /** Launch a Steam game via the OS protocol handler. In the web build this
   *  path doesn't exist; use launchSteamGame() below for a surface-agnostic
   *  launcher. */
  launchGame(appid: number): Promise<boolean>;
  /** Phase 2F: absolute path to Electron's per-user app-data dir.
   *  Renderer-side memory bootstrap (bootstrap.ts) writes memory.sqlite
   *  + vaults/ underneath here. */
  getUserDataPath(): Promise<string>;
  /** Read the current wallpaper-mode state. */
  getWallpaperMode(): Promise<WallpaperMode>;
  /** Request a mode change. Tray drives the same path. */
  setWallpaperMode(mode: WallpaperMode): Promise<boolean>;
  /** Subscribe to mode changes coming from the main process (typically a
   *  tray click). Returns an unsubscribe function. */
  onWallpaperModeChanged(cb: (mode: WallpaperMode) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/** Null when running in the web build; the desktop wrapper's preload script
 *  attaches the API in slice 1. */
export function getElectronAPI(): ElectronAPI | null {
  return typeof window !== 'undefined' ? window.electronAPI ?? null : null;
}

export function isRunningInElectron(): boolean {
  return getElectronAPI() !== null;
}

/**
 * Slice 2 exchange: ticket → cookie. Called before fetchMe() on boot in the
 * Electron wrapper. Returns true if the worker set the cookie, false on any
 * failure path (Steamworks not initialised, ticket rejected by Steam, network
 * error). On failure the caller continues with the existing flow — fetchMe
 * either finds an older session cookie or returns unauthenticated.
 *
 * No-op in the web build. The function exits early via the null check.
 */
export async function signInWithSteamTicket(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  let ticket: string | null;
  try {
    ticket = await api.getAuthTicket();
  } catch {
    return false;
  }
  if (!ticket) return false;
  try {
    const res = await fetch('/api/auth/steamticket', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Slice 3 launcher. In the desktop wrapper, dispatches via IPC so
 * shell.openExternal in the main process passes the URL to the OS — keeps
 * the Electron renderer window from navigating away. In the web build,
 * falls back to window.location.href = 'steam://run/<appid>', which the
 * browser hands to its own protocol handler. Same effect either way; the
 * code path is the implementation difference.
 *
 * Fire-and-forget. Doesn't await the OS-level routing — by the time Steam
 * actually launches the game, the in-flight UI state has already started.
 */
export function launchSteamGame(appid: number): void {
  const api = getElectronAPI();
  if (api) {
    void api.launchGame(appid);
  } else {
    window.location.href = `steam://run/${appid}`;
  }
}

/**
 * Slice 4 helpers. Wallpaper mode only exists in the desktop wrapper; web
 * build callers safely no-op.
 */

export async function getWallpaperMode(): Promise<WallpaperMode> {
  const api = getElectronAPI();
  if (!api) return 'window';
  try {
    return await api.getWallpaperMode();
  } catch {
    return 'window';
  }
}

export async function setWallpaperMode(mode: WallpaperMode): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    return await api.setWallpaperMode(mode);
  } catch {
    return false;
  }
}

/** Subscribe to wallpaper-mode changes from the main process. Returns an
 *  unsubscribe function. No-op in the web build. */
export function subscribeWallpaperMode(
  cb: (mode: WallpaperMode) => void,
): () => void {
  const api = getElectronAPI();
  if (!api) return () => undefined;
  return api.onWallpaperModeChanged(cb);
}

