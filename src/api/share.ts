/**
 * Share API. POST creates a record from the current session, GET reads a
 * public record without auth. Phase 5 slice 3.
 *
 * The path the share viewer follows: a visitor hits /w/:id → SPA fallback
 * serves index.html → main.tsx detects the path → fetchShare(id) → store
 * populated in view-only mode.
 */

import type { Manifest } from '../ai/manifest';
import type { LibraryGame, SteamPersona } from '../types';

export interface ShareRecord {
  v: 1;
  manifest: Manifest;
  profileSeed: number;
  topLibrary: LibraryGame[];
  dustyCount: number;
  persona?: SteamPersona;
  createdAt: number;
}

export interface CreateShareResponse {
  id: string;
  url: string;
}

export type CreateShareResult =
  | { ok: true; share: CreateShareResponse }
  | { ok: false; reason: 'unauthenticated' | 'storage' | 'upstream'; message: string };

interface ErrorBody {
  error?: string;
  message?: string;
}

export async function createShare(profileSeed: number): Promise<CreateShareResult> {
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileSeed }),
    });
    if (res.ok) {
      const share = (await res.json()) as CreateShareResponse;
      return { ok: true, share };
    }
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    const reason = res.status === 401 ? 'unauthenticated'
      : res.status === 503 ? 'storage'
      : 'upstream';
    return { ok: false, reason, message: body.message ?? body.error ?? `HTTP ${res.status}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'network error';
    return { ok: false, reason: 'upstream', message };
  }
}

export async function fetchShare(id: string): Promise<ShareRecord | null> {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as ShareRecord;
  } catch {
    return null;
  }
}
