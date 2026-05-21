/**
 * Dressing scatter — Phase 5 slice 5, PLAN.md Phase 5 task 4.
 *
 * Deterministic placement of CC0-style filler (rocks, grass tufts) across
 * the playable area. Mitchell-style rejection sampling off the profile seed:
 * uniformly drawn (x, z) candidates are accepted only if they clear every
 * exclusion zone — hero archetypes, the dusty cluster, the player spawn,
 * and the worn paths from slice 4. Same seed → same scatter.
 *
 * The geometry itself stays primitive (per the v0.1 procedural convention)
 * until the Meshy curation pass lands. Rock = chamfered icosahedron,
 * grass tuft = small cone — gives enough silhouette variety to read as
 * "natural scatter" without an asset library yet.
 */

import { mulberry32 } from './prng';
import { sampleHeight } from './terrain';
import type { PathSegment } from './paths';
import { SEASIDE_TOWN_KEEPOUTS } from '../scene/seaside/Town';

export type ScatterKind = 'rock' | 'grass';

export interface ScatterItem {
  kind: ScatterKind;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

const BOUNDS_MIN = -16;
const BOUNDS_MAX = 16;

/** Minimum centre-to-centre between any two scatter items. Sparse enough
 *  that the scatter reads as natural, not asset-pack vomit. */
const MIN_SPACING = 1.4;
const MIN_SPACING_SQ = MIN_SPACING * MIN_SPACING;

/** Skirt distance from each hero archetype. The archetypes themselves take
 *  ~2-3m of footprint plus state-styling scale; 3.5m keeps scatter clear of
 *  their visual edges. */
const ARCHETYPE_SKIRT_SQ = 3.5 * 3.5;

/** Dusty cluster at (15, -15) has a ~3m footprint + tarp overhang. */
const DUSTY_CLUSTER_XZ: [number, number] = [15, -15];
const DUSTY_SKIRT_SQ = 5 * 5;

/** Player spawn at (0, _, 8) — don't pin a rock to the player's spawn pose. */
const SPAWN_XZ: [number, number] = [0, 8];
const SPAWN_SKIRT_SQ = 3 * 3;

/** Half-width of the keep-out zone around each worn-path segment. Slightly
 *  wider than the visible strip (PATH_WIDTH=0.7m in Paths.tsx) so scatter
 *  doesn't crowd the path edges. */
const PATH_SKIRT = 0.75;
const PATH_SKIRT_SQ = PATH_SKIRT * PATH_SKIRT;

/** Target population — combined across rock + grass. Bounded area / spacing
 *  caps the realistic max around ~250; 140 gives a populated-but-not-dense
 *  read. Tunable. */
const TARGET_COUNT = 140;

/** Stop trying once attempts exceed N × TARGET. Avoids pathological loops
 *  if exclusions get pathological — we'd rather have fewer items than spin. */
const MAX_ATTEMPTS_PER_TARGET = 6;

const ROCK_RATIO = 0.55; // ~55% rocks, ~45% grass

export function scatterFor(
  seed: number,
  archetypePositions: ReadonlyMap<number, [number, number]>,
  pathSegments: readonly PathSegment[],
): ScatterItem[] {
  // Fresh PRNG keyed off (seed + offset) so scatter doesn't share state with
  // other procedural consumers. XOR with a tag stops accidental correlation
  // with layoutFor() picking the same values.
  const prng = mulberry32(seed ^ 0x5ca77e8);
  const archetypePts: Array<[number, number]> = Array.from(archetypePositions.values());

  const accepted: ScatterItem[] = [];
  const maxAttempts = TARGET_COUNT * MAX_ATTEMPTS_PER_TARGET;
  let attempts = 0;

  while (accepted.length < TARGET_COUNT && attempts < maxAttempts) {
    attempts++;
    const x = prng.rangeFloat(BOUNDS_MIN, BOUNDS_MAX);
    const z = prng.rangeFloat(BOUNDS_MIN, BOUNDS_MAX);

    if (distSqXZ(x, z, SPAWN_XZ[0], SPAWN_XZ[1]) < SPAWN_SKIRT_SQ) continue;
    if (distSqXZ(x, z, DUSTY_CLUSTER_XZ[0], DUSTY_CLUSTER_XZ[1]) < DUSTY_SKIRT_SQ) continue;

    let conflict = false;
    for (let i = 0; i < archetypePts.length; i++) {
      if (distSqXZ(x, z, archetypePts[i][0], archetypePts[i][1]) < ARCHETYPE_SKIRT_SQ) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    // Seaside-template fixed dressing — houses, lamp posts, the pier.
    for (let i = 0; i < SEASIDE_TOWN_KEEPOUTS.length; i++) {
      const k = SEASIDE_TOWN_KEEPOUTS[i];
      if (distSqXZ(x, z, k.x, k.z) < k.r * k.r) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    for (let i = 0; i < pathSegments.length; i++) {
      const d2 = pointToSegmentDistSq(x, z, pathSegments[i]);
      if (d2 < PATH_SKIRT_SQ) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    for (let i = 0; i < accepted.length; i++) {
      const p = accepted[i].position;
      if (distSqXZ(x, z, p[0], p[2]) < MIN_SPACING_SQ) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    const kind: ScatterKind = prng.next() < ROCK_RATIO ? 'rock' : 'grass';
    const rotationY = prng.rangeFloat(0, Math.PI * 2);
    const scale = kind === 'rock'
      ? prng.rangeFloat(0.55, 1.15)
      : prng.rangeFloat(0.7, 1.25);
    const y = sampleHeight(seed, x, z);
    accepted.push({ kind, position: [x, y, z], rotationY, scale });
  }

  return accepted;
}

function distSqXZ(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Squared minimum distance from point (px, pz) to a segment in the XZ
 *  plane. Used by the path-skirt exclusion above. */
function pointToSegmentDistSq(px: number, pz: number, seg: PathSegment): number {
  const ax = seg.from[0];
  const az = seg.from[1];
  const bx = seg.to[0];
  const bz = seg.to[1];
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return distSqXZ(px, pz, ax, az);
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return distSqXZ(px, pz, cx, cz);
}
