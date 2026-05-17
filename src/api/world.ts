import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import type { Manifest } from '../ai/manifest';

/**
 * Stage 1 fetch wrapper. Hits the local Worker by default; override via
 * VITE_WORKER_URL for staging/prod. All AI key handling happens server-side —
 * this module only knows about the URL.
 */
const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'http://localhost:8787';

export interface FetchWorldResult {
  manifest: Manifest;
  /** Where the manifest came from — drives a UI hint in the connector panel. */
  source: 'worker' | 'stub';
  /** When source === 'stub', why we fell back (network down, validation, etc.). */
  fallbackReason?: string;
}

export async function fetchWorld(): Promise<FetchWorldResult> {
  const body = {
    template: 'seaside_town' as const,
    profile: { summary: 'v0.1 hard-coded library — no Steam data yet' },
    games: SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name })),
  };
  try {
    const res = await fetch(`${WORKER_URL}/api/world`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return fallback(`worker ${res.status}: ${text.slice(0, 120)}`);
    }
    const manifest = (await res.json()) as Manifest;
    return { manifest, source: 'worker' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    return fallback(`network: ${message}`);
  }
}

async function fallback(reason: string): Promise<FetchWorldResult> {
  const { STUB_MANIFEST } = await import('../ai/stubManifest');
  return { manifest: STUB_MANIFEST, source: 'stub', fallbackReason: reason };
}
