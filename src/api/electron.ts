/**
 * Electron-renderer bridge. Mirrors desktop/src/preload.ts — the two type
 * declarations need to stay in sync (separate TS projects can't share types
 * directly). Phase 6 slice 1 added isElectron/getSteamId/isSteamworksAvailable;
 * slice 2 adds getAuthTicket + the signInWithSteamTicket exchange that runs
 * before fetchMe() on boot in the desktop wrapper.
 */

export interface ElectronAPI {
  readonly isElectron: true;
  getSteamId(): Promise<string | null>;
  isSteamworksAvailable(): Promise<boolean>;
  /** Hex-encoded Steamworks AuthSessionTicket. Pass to /api/auth/steamticket
   *  on the worker, which verifies + mints lw_session. Null on failure. */
  getAuthTicket(): Promise<string | null>;
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
