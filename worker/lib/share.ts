/**
 * Share record schema and helpers. The KV-stored payload that backs every
 * `/w/:id` URL. Phase 5 slice 3.
 *
 * SPEC §10: the share viewer reconstructs the world from {manifest,
 * profile_seed} alone — no worker round-trip beyond fetching this record.
 * Anything the renderer needs at render time has to live here.
 *
 * Privacy posture: this is a user-initiated public share. The record carries
 * the per-game name + state of the top-N games (so view-only tooltips read
 * "Harry's lighthouse — Hades, 340h" instead of "lighthouse — appid 1145360")
 * and a dusty count for the backlog cluster. It does NOT carry the full owned
 * library, the full profile text, or session details — those stay
 * worker-internal.
 */

export const SHARE_TTL_S = 60 * 60 * 24 * 365; // 1 year

export const SHARE_SCHEMA_VERSION = 1;

export interface SharedManifestCasting {
  appid: number;
  archetype: string;
  role: string;
}

export interface SharedManifest {
  template: string;
  metaphor: string;
  casting: SharedManifestCasting[];
}

export interface SharedLibraryGame {
  appid: number;
  name: string;
  state?: string;
  /** Minutes — kept so view-only tooltips can read "340h" without re-fetching. */
  playtime_forever?: number;
}

export interface SharedPersona {
  steamId: string;
  name: string;
  avatarUrl: string;
}

export interface ShareRecord {
  v: typeof SHARE_SCHEMA_VERSION;
  manifest: SharedManifest;
  /** 32-bit seed from src/procedural/seed.ts on the creator's machine. The
   *  viewer feeds this directly into mulberry32 to reproduce the layout. */
  profileSeed: number;
  topLibrary: SharedLibraryGame[];
  dustyCount: number;
  persona?: SharedPersona;
  /** Unix seconds. KV TTL expires this in SHARE_TTL_S; createdAt is here for
   *  diagnostics and possible future "shared 3 days ago" UI. */
  createdAt: number;
}

/**
 * Short URL-safe ID. 12 hex chars = 48 bits of entropy = ~281T possibilities;
 * collision risk over the lifetime TTL is negligible at any plausible scale.
 */
export function newShareId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function shareKvKey(id: string): string {
  return `share:${id}`;
}
