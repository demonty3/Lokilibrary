/**
 * Procedurally-unique "region terminals" (v2.x composable-panes expansion).
 *
 * A region terminal renders an ordinary cell, but seeded from one *wing* of
 * the library — a district of the 7-A cluster tree — instead of the
 * whole-library profile seed. Because `mountCell` already takes both a seed
 * (layout / cohort / scatter / memory key) and the shelf `books`, feeding a
 * district's own seed + its own games makes each spawned terminal a genuinely
 * different generated world: different room, different shelves, its own agent
 * cohort and its own persistent memory.
 *
 * Determinism (CLAUDE.md hard rule): same (games, profileSeed) → the same
 * ordered regions, the same per-region seeds. Bucketing is delegated to
 * `clusterLibrary` (which canonicalises by appid, so input order never
 * matters); the per-region seed mixes the district id into the profile seed
 * via FNV-1a under a private namespace. No `Math.random`, no `Date.now`.
 */

import {
  clusterLibrary,
  flattenDistricts,
  districtLabel,
  type ClusterGame,
} from './clusters';

/** PRNG namespace for region-terminal seeds. Distinct from cell `0xce11`,
 *  scatter `0x5ca7`, Loki `0x10ce`, landmark `0x1a4d`, cluster `0xc1a5`,
 *  layout `0xc0a5` — so a region seed never correlates with any other
 *  src/procedural consumer keyed off the same profile seed. */
export const REGION_SALT = 0x7e44;

export interface RegionTerminal {
  /** District id this region came from (`d0`, `d1`, … — stable, canonical). */
  regionId: string;
  /** Deterministic cell seed — drives layout / cohort / scatter / memory. */
  seed: number;
  /** Wing label (the district's dominant game), for the terminal header. */
  label: string;
  /** The games that live in this wing — become the cell's bookshelves. */
  games: ClusterGame[];
}

/**
 * Derive the ordered list of region terminals (one per district) for a
 * library. Empty library → `[]`. Same (games, profileSeed) → identical result.
 */
export function regionTerminals(
  games: readonly ClusterGame[],
  profileSeed: number,
): RegionTerminal[] {
  const tree = clusterLibrary(games, profileSeed);
  return flattenDistricts(tree).map((d) => ({
    regionId: d.id,
    seed: regionSeed(profileSeed, d.id),
    label: districtLabel(d),
    games: d.games,
  }));
}

/**
 * Deterministic cell seed for one region. FNV-1a mixes the district id into
 * `profileSeed ^ REGION_SALT`, so every district gets a distinct uint32 that
 * also differs from the bare profile seed (the root pane). Pure, no clock.
 */
export function regionSeed(profileSeed: number, regionId: string): number {
  let h = (profileSeed ^ REGION_SALT) >>> 0;
  for (let i = 0; i < regionId.length; i++) {
    h ^= regionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
