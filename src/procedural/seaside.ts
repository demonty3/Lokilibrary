/**
 * Seaside template procedural layout. Phase 5 slice 2 — replaces the
 * Stage-1-LLM-picks-positions approach with a deterministic seeded layer.
 *
 * Contract: same profile → same positions. SPEC §10's share-URL feature
 * depends on this; any non-determinism here silently breaks it for viewers.
 *
 * Algorithm: Mitchell's-flavor Poisson-disk placement. For each manifest
 * casting entry, draw candidate points from a seeded PRNG until one meets:
 *   - within scene bounds
 *   - >= MIN_DISTANCE away from previously-placed archetypes (per the LLM's
 *     historical "non-overlapping" prompt rule)
 *   - outside the player-spawn exclusion zone (avoid spawning inside an
 *     archetype's footprint)
 *   - outside the dusty backlog cluster footprint at (15, -15)
 *
 * Stub manifest (anonymous viewer with no profile) gets a fixed seed so the
 * sample seaside town renders the same for every anonymous visitor.
 */

import { mulberry32 } from './prng';
import { profileSeed } from './seed';
import type { Profile } from '../types';
import type { ManifestCastingEntry } from '../ai/manifest';

/** Playable XZ bounds for archetype placement. */
const BOUNDS_MIN = -15;
const BOUNDS_MAX = 15;

/** Minimum centre-to-centre between any two archetypes. Matches the
 *  historical prompt rule (>=4m), bumped slightly so the procedural
 *  version has a little more breathing room than the LLM allowed itself. */
const MIN_DISTANCE = 4.5;
const MIN_DISTANCE_SQ = MIN_DISTANCE * MIN_DISTANCE;

/** Player spawns at [0, _, 8] (src/scene/Player.tsx). Avoid placing archetypes
 *  inside that footprint or the player wakes up clipping into geometry. */
const SPAWN_XZ: [number, number] = [0, 8];
const SPAWN_EXCLUSION_SQ = 4 * 4;

/** Dusty backlog cluster lives at (15, -15) with ~3m footprint plus tarp
 *  overhang. Skirt it by 6m to keep the hero archetypes visually distinct. */
const DUSTY_CLUSTER_XZ: [number, number] = [15, -15];
const DUSTY_EXCLUSION_SQ = 6 * 6;

/** When the stub manifest renders (no profile), use this seed so anonymous
 *  visitors see a stable demo world rather than one that shifts on refresh. */
const STUB_SEED = 0xc0ffee;

/** Hard cap on placement retries per archetype. The bounded area + ~7–15
 *  archetypes means we almost never approach this; the cap exists so a
 *  pathological future config can't infinite-loop the renderer. */
const MAX_ATTEMPTS = 1000;

export interface LayoutResult {
  /** Position lookup by appid. Same shape the manifest used to carry. */
  positions: Map<number, [number, number]>;
  /** Appids the placer gave up on after exhausting attempts. Should be empty
   *  in normal operation; logged in dev so a regression is visible. */
  dropped: number[];
}

export function layoutFor(
  profile: Profile | null,
  casting: readonly ManifestCastingEntry[],
): LayoutResult {
  const seed = profile ? profileSeed(profile) : STUB_SEED;
  return layoutForSeed(seed, casting);
}

/**
 * Same layout algorithm, but seeded directly. Used by the share-URL viewer,
 * which carries a precomputed seed in the share record (the creator's machine
 * computed it from their profile at share time, and the viewer feeds it
 * here verbatim to reproduce the exact world the creator was looking at).
 */
export function layoutForSeed(
  seed: number,
  casting: readonly ManifestCastingEntry[],
): LayoutResult {
  const prng = mulberry32(seed);
  const positions = new Map<number, [number, number]>();
  const placed: Array<[number, number]> = [];
  const dropped: number[] = [];

  for (const entry of casting) {
    let placedThis = false;
    for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
      const x = prng.rangeFloat(BOUNDS_MIN, BOUNDS_MAX);
      const z = prng.rangeFloat(BOUNDS_MIN, BOUNDS_MAX);

      const dxs = x - SPAWN_XZ[0];
      const dzs = z - SPAWN_XZ[1];
      if (dxs * dxs + dzs * dzs < SPAWN_EXCLUSION_SQ) continue;

      const dxd = x - DUSTY_CLUSTER_XZ[0];
      const dzd = z - DUSTY_CLUSTER_XZ[1];
      if (dxd * dxd + dzd * dzd < DUSTY_EXCLUSION_SQ) continue;

      let conflict = false;
      for (let i = 0; i < placed.length; i++) {
        const dx = x - placed[i][0];
        const dz = z - placed[i][1];
        if (dx * dx + dz * dz < MIN_DISTANCE_SQ) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      placed.push([x, z]);
      positions.set(entry.appid, [x, z]);
      placedThis = true;
      break;
    }
    if (!placedThis) dropped.push(entry.appid);
  }

  return { positions, dropped };
}
