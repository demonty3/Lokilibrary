import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, DoubleSide } from 'three';
import { useAppStore } from '../../state/store';
import { profileSeed } from '../../procedural/seed';
import { layoutFor, layoutForSeed } from '../../procedural/seaside';
import { lovedPaths } from '../../procedural/paths';
import { sampleHeight } from '../../procedural/terrain';

const PATH_WIDTH = 0.7;
const PATH_LIFT = 0.04; // above terrain surface to avoid z-fighting
const STUB_SEED = 0xc0ffee;

/**
 * Worn paths between `loved` archetypes. PLAN.md Phase 4 task 2, finally
 * landing here in slice 4 alongside the terrain that they sit on.
 *
 * Geometry: one shared BufferGeometry holds every path segment as a thin
 * strip (4 verts, 2 triangles per pair). Vertex positions are computed in
 * world space — we sample terrain height at each endpoint so the strips
 * conform to the bumps under them.
 *
 * For 2 loved games → 1 strip; for 4 → 6 strips; capped at MAX_PATHS=8 in
 * lovedPaths(). All-pairs in casting order, so the geometry is stable
 * across viewers of the same share.
 */
export function Paths() {
  const manifest = useAppStore((s) => s.manifest);
  const library = useAppStore((s) => s.library);
  const profile = useAppStore((s) => s.profile);
  const viewOnly = useAppStore((s) => s.viewOnly);
  const sharedSeed = useAppStore((s) => s.sharedSeed);

  const geometry = useMemo(() => {
    if (!manifest || !library) return null;

    // Use the same seed the terrain and archetype layout used, otherwise
    // paths land on the wrong heights / connect the wrong xy positions.
    const seed = viewOnly && sharedSeed !== null
      ? sharedSeed
      : profile ? profileSeed(profile) : STUB_SEED;

    const layout = viewOnly && sharedSeed !== null
      ? layoutForSeed(sharedSeed, manifest.casting)
      : layoutFor(profile, manifest.casting);

    const segments = lovedPaths(manifest.casting, library, layout.positions);
    if (segments.length === 0) return null;

    const positions: number[] = [];
    const indices: number[] = [];

    for (const { from, to } of segments) {
      const dx = to[0] - from[0];
      const dz = to[1] - from[1];
      const length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      // Unit perpendicular in the XZ plane — the strip extrudes ±width/2
      // from the from→to line.
      const perpX = -dz / length;
      const perpZ = dx / length;
      const w = PATH_WIDTH / 2;
      const yFrom = sampleHeight(seed, from[0], from[1]) + PATH_LIFT;
      const yTo = sampleHeight(seed, to[0], to[1]) + PATH_LIFT;
      const base = positions.length / 3;
      positions.push(
        from[0] + perpX * w, yFrom, from[1] + perpZ * w,
        from[0] - perpX * w, yFrom, from[1] - perpZ * w,
        to[0] + perpX * w,   yTo,   to[1] + perpZ * w,
        to[0] - perpX * w,   yTo,   to[1] - perpZ * w,
      );
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }

    if (positions.length === 0) return null;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [manifest, library, profile, viewOnly, sharedSeed]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow renderOrder={1}>
      <meshStandardMaterial
        color="#1f1814"
        roughness={1}
        transparent
        opacity={0.6}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
