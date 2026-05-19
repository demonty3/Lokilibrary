/**
 * Electron-renderer bridge. Mirrors desktop/src/preload.ts — the two type
 * declarations need to stay in sync (separate TS projects can't share types
 * directly). Phase 6 slice 1 added isElectron/getSteamId/isSteamworksAvailable;
 * slice 2 adds getAuthTicket + the signInWithSteamTicket exchange that runs
 * before fetchMe() on boot in the desktop wrapper.
 */

export type WallpaperMode = 'window' | 'wallpaper';

/** Slice 5: a display the user can pick for wallpaper rendering. */
export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

export interface ElectronAPI {
  readonly isElectron: true;
  getSteamId(): Promise<string | null>;
  isSteamworksAvailable(): Promise<boolean>;
  /** Hex-encoded Steamworks AuthSessionTicket. Pass to /api/auth/steamticket
   *  on the worker, which verifies + mints lw_session. Null on failure. */
  getAuthTicket(): Promise<string | null>;
  /** Slice 3: launch a Steam game via the OS protocol handler. In the web
   *  build this path doesn't exist; use launchSteamGame() below for a
   *  surface-agnostic launcher. */
  launchGame(appid: number): Promise<boolean>;
  /** Slice 4: read the current wallpaper-mode state. */
  getWallpaperMode(): Promise<WallpaperMode>;
  /** Slice 4: request a mode change. Tray + connector panel both call this. */
  setWallpaperMode(mode: WallpaperMode): Promise<boolean>;
  /** Slice 4: subscribe to mode changes coming from the main process
   *  (typically a tray menu click). Returns an unsubscribe function. */
  onWallpaperModeChanged(cb: (mode: WallpaperMode) => void): () => void;
  /** Slice 5: list connected displays for the in-app monitor picker. */
  getDisplays(): Promise<DisplayInfo[]>;
  /** Slice 5: the currently-persisted display id, or null for "primary". */
  getDisplayId(): Promise<number | null>;
  /** Slice 5: change the target display. null means "primary". */
  setDisplayId(id: number | null): Promise<boolean>;
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

/**
 * Slice 5 helpers. The multi-monitor picker only exists in the desktop
 * wrapper — the web build returns empty/null so the connector panel can
 * cleanly hide the picker section.
 */

export async function getDisplays(): Promise<DisplayInfo[]> {
  const api = getElectronAPI();
  if (!api) return [];
  try {
    return await api.getDisplays();
  } catch {
    return [];
  }
}

export async function getDisplayId(): Promise<number | null> {
  const api = getElectronAPI();
  if (!api) return null;
  try {
    return await api.getDisplayId();
  } catch {
    return null;
  }
}

export async function setDisplayId(id: number | null): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    return await api.setDisplayId(id);
  } catch {
    return false;
  }
}
