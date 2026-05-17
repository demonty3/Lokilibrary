import type { Manifest } from '../ai/manifest';

/**
 * Stage 1 fetch wrapper. Slice 7 of Phase 2: /api/world now reads everything
 * from the session — the request body is gone. Authed users get a manifest
 * built from their real library; everyone else (no session yet, expired
 * session, private profile) falls through to the stub manifest so the scene
 * always renders.
 *
 * Same-origin via Vite proxy in dev; production needs both surfaces behind a
 * single domain or a Workers route. credentials: 'same-origin' carries the
 * HttpOnly session cookie.
 */

export interface FetchWorldResult {
  manifest: Manifest;
  /** Where the manifest came from — drives a UI hint in the connector panel. */
  source: 'worker' | 'stub';
  /** When source === 'stub', why we fell back (network down, unauth, etc.). */
  fallbackReason?: string;
}

export async function fetchWorld(options: { force?: boolean } = {}): Promise<FetchWorldResult> {
  const qs = options.force ? '?force=1' : '';
  try {
    const res = await fetch(`/api/world${qs}`, { credentials: 'same-origin' });
    if (!res.ok) return fallback(await briefError(res));
    const manifest = (await res.json()) as Manifest;
    return { manifest, source: 'worker' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    return fallback(`network: ${message}`);
  }
}

async function briefError(res: Response): Promise<string> {
  if (res.status === 401) return 'sign in to generate your world';
  if (res.status === 403) return 'profile private — flip game details to public';
  if (res.status === 429) return 'rate limited by upstream — try again shortly';
  const text = await res.text().catch(() => '');
  return `worker ${res.status}: ${text.slice(0, 120)}`;
}

async function fallback(reason: string): Promise<FetchWorldResult> {
  const { STUB_MANIFEST } = await import('../ai/stubManifest');
  return { manifest: STUB_MANIFEST, source: 'stub', fallbackReason: reason };
}
