/**
 * Profile → stable 32-bit seed. The share-URL contract (SPEC §10) requires
 * that the *same* profile snapshot always hashes to the *same* seed — every
 * downstream procedural step (terrain, archetype placement, paths, scatter)
 * is keyed off this value.
 *
 * What goes into the hash, in stable order:
 *   - top-N appids (the identity of the library that drives Stage 1 casting)
 *   - playtime bucket per top-N game (log2 of hours — small drift doesn't
 *     bump the bucket, so a fresh session doesn't break shareability)
 *   - engagement descriptor per top-N game (deeply_lived_in / past_main / …)
 *
 * What's deliberately NOT in the hash:
 *   - totalPlaytimeHours / totalGames / dustyGames — fluctuate per session
 *   - persona / metaphor / role text — derived, not source-of-truth
 *   - stateCounts — derived from per-game state; engagement covers similar
 *     ground without the recency dependence that would bump on every visit
 *
 * Determinism is enforced by inspection: the function takes a Profile and
 * returns a number — no IO, no Date.now(), no Math.random. Don't add any.
 */

import type { Profile } from '../types';

export function profileSeed(profile: Profile): number {
  const parts: string[] = [];
  for (const g of profile.topGames) {
    parts.push(String(g.appid));
    parts.push(playtimeBucket(g.playtimeHours));
    parts.push(g.engagement);
  }
  return fnv1a32(parts.join('|'));
}

/** Log buckets — small playtime drift doesn't change the bucket. */
function playtimeBucket(hours: number): string {
  if (hours <= 0) return '0';
  return String(Math.floor(Math.log2(hours + 1)));
}

/**
 * FNV-1a 32-bit. Cheap, deterministic, no dependencies. Good enough for
 * seeding a PRNG; not for anything cryptographic.
 */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
