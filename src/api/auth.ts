/**
 * Auth API thin wrapper. With Vite's /api proxy (vite.config.ts) the worker
 * is same-origin in dev, so the HttpOnly session cookie travels on every
 * request without `credentials: 'include'` ceremony. `same-origin` is still
 * the right setting — if production ever splits the worker onto a separate
 * host this module is the one place that needs to know.
 */

import type { SteamPersona } from '../types';

export interface MeResponse {
  authenticated: boolean;
  steamId?: string;
  /** Cached server-side (24h TTL) — surfaces the moment auth resolves. */
  persona?: SteamPersona;
}

/** Full URL for the "Connect Steam" button. Top-level navigation, not fetch. */
export const STEAM_LOGIN_PATH = '/api/auth/steam/login';

export async function fetchMe(): Promise<MeResponse> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return { authenticated: false };
    return (await res.json()) as MeResponse;
  } catch {
    return { authenticated: false };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // best-effort — cookie still expires server-side eventually
  }
}
