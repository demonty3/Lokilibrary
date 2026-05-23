/**
 * Game launch wrapper. Bridges renderer → Steam: in Electron the
 * preload's `electronAPI.launchGame(appid)` calls
 * `shell.openExternal('steam://run/<appid>')` from the main process
 * (CLAUDE.md "Game launching: Electron wrapper uses Steamworks SDK
 * directly; web build uses steam://run/{appid}"). In the web build —
 * the share-viewer surface — we open the same protocol URL via
 * `window.open(..., '_self')`; if Steam isn't installed the browser
 * just no-ops.
 *
 * Returns a `LaunchEvent` so the caller (cell.ts E-key handler) can
 * broadcast it to the cohort's perception layer + log telemetry.
 */

import { getElectronAPI } from '../api/electron';

export interface LaunchEvent {
  ok: boolean;
  appid: number;
  /** Human-readable name (used for prompt text + Plan memory text). */
  name: string;
  /** Which transport actually fired. `electron` is the desktop path;
   *  `protocol` is the web `steam://` fallback; `none` means the
   *  caller skipped (e.g., no name supplied, missing appid). */
  surface: 'electron' | 'protocol' | 'none';
  /** Wall-clock ms when the launch was issued. */
  when: number;
}

export interface LaunchOptions {
  appid: number;
  name: string;
}

export async function launchGame(opts: LaunchOptions): Promise<LaunchEvent> {
  const when = Date.now();
  if (!opts.appid || !opts.name) {
    return { ok: false, appid: opts.appid, name: opts.name, surface: 'none', when };
  }

  const api = getElectronAPI();
  if (api) {
    try {
      const ok = await api.launchGame(opts.appid);
      return { ok, appid: opts.appid, name: opts.name, surface: 'electron', when };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[launch] electron launchGame failed for appid=${opts.appid}: ${(e as Error).message}`,
      );
      return { ok: false, appid: opts.appid, name: opts.name, surface: 'electron', when };
    }
  }

  // Web build: steam://run/<appid>. Assigning to window.location.href
  // navigates the current tab away in some browsers; using window.open
  // with `_self` is the safer pattern for a protocol handler.
  if (typeof window !== 'undefined') {
    try {
      window.open(`steam://run/${opts.appid}`, '_self');
      return { ok: true, appid: opts.appid, name: opts.name, surface: 'protocol', when };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[launch] steam:// protocol failed for appid=${opts.appid}: ${(e as Error).message}`,
      );
      return { ok: false, appid: opts.appid, name: opts.name, surface: 'protocol', when };
    }
  }

  return { ok: false, appid: opts.appid, name: opts.name, surface: 'none', when };
}
