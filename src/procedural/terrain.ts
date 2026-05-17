/**
 * Terrain heightfield for the seaside template. Phase 5 slice 4.
 *
 * Seeded simplex noise lays a gentle ±0.3m undulation across the playable
 * area and ramps up to bigger hills in the distance for visual depth. Same
 * profile → same terrain — the share-URL contract reaches the ground plane
 * as well as the archetype positions.
 *
 * Determinism: `simplex-noise` v4 takes a `() => number` constructor arg
 * and consumes a fixed number of samples to seed its permutation table.
 * Paired with a fresh `mulberry32(seed)` per call, the same seed always
 * builds the same noise2D. No Math.random anywhere — lints against that
 * are enforced in src/procedural/.
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { mulberry32 } from './prng';

/** Total ground area (square). Larger than the playable bounds so distant
 *  hills frame the scene. */
export const FIELD_SIZE = 200;

/** Grid resolution for the visual mesh + heightfield. (SEGMENTS+1)² vertices.
 *  128 gives a smooth read at the playable scale without bloating geometry. */
export const SEGMENTS = 128;

/** xz radius of the playable area — must match the archetype placement
 *  bounds in seaside.ts so heroes stay inside the calm zone. */
const PLAYABLE_RADIUS = 16;

/** Amplitude inside the playable area. Gentle enough that the player walking
 *  on a flat collider doesn't visibly clip the visual terrain. */
const PLAYABLE_AMPLITUDE = 0.3;

/** Amplitude in the distant area. Hills frame the scene from beyond the
 *  playable bounds. */
const DISTANT_AMPLITUDE = 2.5;

/** Noise frequency — small number → wide rolling features. 0.04 ≈ 25m
 *  wavelength. */
const NOISE_FREQUENCY = 0.04;

/** Falloff distance from PLAYABLE_RADIUS over which the amplitude ramps
 *  from PLAYABLE_AMPLITUDE to DISTANT_AMPLITUDE. */
const FALLOFF_DISTANCE = 20;

function noise2D(seed: number): NoiseFunction2D {
  const prng = mulberry32(seed);
  return createNoise2D(prng.next);
}

function amplitudeAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  if (dist <= PLAYABLE_RADIUS) return PLAYABLE_AMPLITUDE;
  const t = Math.min(1, (dist - PLAYABLE_RADIUS) / FALLOFF_DISTANCE);
  return PLAYABLE_AMPLITUDE + (DISTANT_AMPLITUDE - PLAYABLE_AMPLITUDE) * t;
}

/**
 * Sample height at an arbitrary world (x, z). Used by archetype placement
 * to lift each archetype to the terrain surface and by the paths module to
 * conform path strips to the bumps they cross.
 *
 * Allocates a noise2D per call — cheap at slice-4 scale (~15 archetype
 * lifts + a handful of path endpoints per layout). Cache later if hot.
 */
export function sampleHeight(seed: number, x: number, z: number): number {
  const n = noise2D(seed);
  return n(x * NOISE_FREQUENCY, z * NOISE_FREQUENCY) * amplitudeAt(x, z);
}

/**
 * Build the full height grid for the visual mesh. Returns a Float32Array of
 * `(SEGMENTS + 1)²` values in row-major order — same ordering as the
 * vertices THREE.PlaneGeometry produces with the same segment counts, so
 * setting each vertex's `z` from this array displaces the mesh correctly
 * (before the -π/2 X rotation that lays it flat).
 */
export function terrainHeights(seed: number): Float32Array {
  const n = noise2D(seed);
  const verts = SEGMENTS + 1;
  const heights = new Float32Array(verts * verts);
  const step = FIELD_SIZE / SEGMENTS;
  const half = FIELD_SIZE / 2;
  for (let row = 0; row < verts; row++) {
    for (let col = 0; col < verts; col++) {
      const x = -half + col * step;
      const z = -half + row * step;
      heights[row * verts + col] = n(x * NOISE_FREQUENCY, z * NOISE_FREQUENCY) * amplitudeAt(x, z);
    }
  }
  return heights;
}
