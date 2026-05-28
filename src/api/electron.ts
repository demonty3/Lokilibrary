/**
 * Electron-renderer bridge. Mirrors desktop/src/preload.ts — the two type
 * declarations need to stay in sync (separate TS projects can't share types
 * directly). Phase 6 slice 1 added isElectron/getSteamId/isSteamworksAvailable;
 * slice 2 adds getAuthTicket + the signInWithSteamTicket exchange that runs
 * before fetchMe() on boot in the desktop wrapper.
 */

export type WallpaperMode = 'window' | 'wallpaper';

/** Phase 4 slice 4A + 5B — wallpaper throttle state. Mirrors
 *  ThrottleState in desktop/src/preload.ts.
 *
 *  Four states:
 *    - 'full'         (default): ticker uncapped, agents active
 *    - 'throttled-1hz' (4A): a window covers >50% of monitor; ticker at 1Hz
 *    - 'paused'       (4A): fullscreen app foreground; ticker stopped
 *    - 'sleeping'     (5B): system idle > 10 min, no fullscreen;
 *                     ticker stopped + sleep-reflection sweep fires
 */
export type ThrottleState = 'full' | 'throttled-1hz' | 'paused' | 'sleeping';

export interface ThrottleChangeEvent {
  readonly state: ThrottleState;
  readonly isInitial: boolean;
}

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

  /** Phase 4 slice 4A: current wallpaper throttle state. 'full' in the
   *  web build (no throttling — the user is looking at the canvas
   *  directly). */
  getThrottleState(): Promise<ThrottleState>;

  /** Subscribe to throttle transitions. Returns an unsubscribe function.
   *  In the web build, the helper below short-circuits this so the
   *  renderer code can subscribe unconditionally. */
  onThrottleChange(cb: (event: ThrottleChangeEvent) => void): () => void;

  /** Phase 4C — wallpaper peek state (transient overlay on wallpaper
   *  mode). Always false in the web build. */
  getPeeking(): Promise<boolean>;
  togglePeek(): Promise<boolean>;
  onPeekChanged(cb: (peeking: boolean) => void): () => void;
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
 * Phase 4 slice 4A — wallpaper throttle helpers. Web build never throttles
 * (the canvas is the foreground window the user is looking at), so the
 * helpers return 'full' and the subscription is a no-op. The renderer can
 * call these unconditionally and gets sensible defaults in both worlds.
 *
 * Both helpers also defensively check that the bridge method *exists* —
 * not just that an ElectronAPI object is present. This catches the
 * "stale preload" dev-iteration footgun: the renderer bundle hot-reloads
 * any time you save a source file, but Electron preload scripts only
 * reload when you restart the Electron process. If you add a new bridge
 * method (like onThrottleChange) and the renderer picks up the new
 * subscription call before you've restarted Electron, the old preload's
 * api object won't have the method and calling it would throw an
 * uncaught TypeError into React's render loop, killing the whole app.
 * The guards below degrade silently to 'no-throttle' instead — once you
 * restart Electron the bridge surface catches up and throttling starts
 * working without any further renderer change.
 */

/** Logged once per bridge-mismatch detection so the dev console doesn't
 *  spam on every render of a stale-preload component. */
let warnedStalePreload = false;
function warnStalePreload(missing: string): void {
  if (warnedStalePreload) return;
  warnedStalePreload = true;
  // eslint-disable-next-line no-console
  console.warn(
    `[electron] window.electronAPI is missing "${missing}" — your preload ` +
      'bridge is older than the renderer bundle. Restart the desktop ' +
      'terminal (Ctrl+C, then `npm run dev` in desktop/) to recompile ' +
      'preload.js. Renderer continues with throttle disabled.',
  );
}

export async function getThrottleState(): Promise<ThrottleState> {
  const api = getElectronAPI();
  if (!api) return 'full';
  if (typeof api.getThrottleState !== 'function') {
    warnStalePreload('getThrottleState');
    return 'full';
  }
  try {
    return await api.getThrottleState();
  } catch {
    return 'full';
  }
}

export function subscribeThrottle(
  cb: (event: ThrottleChangeEvent) => void,
): () => void {
  const api = getElectronAPI();
  if (!api) return () => undefined;
  if (typeof api.onThrottleChange !== 'function') {
    warnStalePreload('onThrottleChange');
    return () => undefined;
  }
  return api.onThrottleChange(cb);
}

/**
 * Phase 4C — peek helpers. Mirrors the throttle helpers above: same
 * defensive guards (warnStalePreload when the bridge surface is older
 * than the renderer bundle), same web-build degradation (always
 * returns false / no-op).
 */

export async function getPeeking(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  if (typeof api.getPeeking !== 'function') {
    warnStalePreload('getPeeking');
    return false;
  }
  try {
    return await api.getPeeking();
  } catch {
    return false;
  }
}

export async function togglePeek(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  if (typeof api.togglePeek !== 'function') {
    warnStalePreload('togglePeek');
    return false;
  }
  try {
    return await api.togglePeek();
  } catch {
    return false;
  }
}

export function subscribePeek(
  cb: (peeking: boolean) => void,
): () => void {
  const api = getElectronAPI();
  if (!api) return () => undefined;
  if (typeof api.onPeekChanged !== 'function') {
    warnStalePreload('onPeekChanged');
    return () => undefined;
  }
  return api.onPeekChanged(cb);
}

