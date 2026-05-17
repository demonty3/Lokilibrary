/**
 * Library API thin wrapper. Calls /api/library on the worker — session cookie
 * is HttpOnly + same-origin via Vite proxy, so it just rides along.
 *
 * The renderer still consumes the hard-coded SAMPLE_LIBRARY in v0.1; slice 7
 * wires this data through to Stage 1. Until then, the connector panel surfaces
 * what's here as a visible side-effect of sign-in.
 */

import type { LibraryGame, SteamPersona } from '../types';

export interface LibraryResponse {
  steamId: string;
  persona?: SteamPersona;
  totalGames: number;
  /** Number of top-played games downstream slices will enrich. */
  topN: number;
  /** All owned games, sorted by playtime_forever desc. */
  games: LibraryGame[];
}

export type LibraryFailureReason =
  | 'unauthenticated'
  | 'private_profile'
  | 'rate_limited'
  | 'upstream';

export type FetchLibraryResult =
  | { ok: true; library: LibraryResponse }
  | { ok: false; reason: LibraryFailureReason; message: string };

interface ErrorBody {
  error?: string;
  message?: string;
}

function reasonFromStatus(status: number): LibraryFailureReason {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'private_profile';
  if (status === 429) return 'rate_limited';
  return 'upstream';
}

export async function fetchLibrary(options: { force?: boolean } = {}): Promise<FetchLibraryResult> {
  const qs = options.force ? '?force=1' : '';
  try {
    const res = await fetch(`/api/library${qs}`, { credentials: 'same-origin' });
    if (res.ok) {
      return { ok: true, library: (await res.json()) as LibraryResponse };
    }
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    return {
      ok: false,
      reason: reasonFromStatus(res.status),
      message: body.message ?? body.error ?? `HTTP ${res.status}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'network error';
    return { ok: false, reason: 'upstream', message };
  }
}
