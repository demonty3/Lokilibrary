import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { useAppStore } from '../../state/store';
import { profileSeed } from '../../procedural/seed';
import { layoutFor, layoutForSeed } from '../../procedural/seaside';
import { lovedPaths } from '../../procedural/paths';
import { scatterFor } from '../../procedural/scatter';

const STUB_SEED = 0xc0ffee;

/**
 * Dressing scatter for the seaside template. Phase 5 slice 5.
 *
 * Two flavours of filler — small rocks and grass tufts — placed
 * deterministically by scatterFor() and rendered via two drei <Instances>
 * groups (one draw call per kind, regardless of count).
 *
 * Avoids: hero archetypes, the dusty cluster, the player spawn footprint,
 * and the worn-path strips. Same profile seed → same scatter, so a share
 * URL reproduces the exact filler layout the creator was looking at.
 */
export function Scatter() {
  const manifest = useAppStore((s) => s.manifest);
  const library = useAppStore((s) => s.library);
  const profile = useAppStore((s) => s.profile);
  const viewOnly = useAppStore((s) => s.viewOnly);
  const sharedSeed = useAppStore((s) => s.sharedSeed);

  const items = useMemo(() => {
    if (!manifest) return [];
    const seed = viewOnly && sharedSeed !== null
      ? sharedSeed
      : profile ? profileSeed(profile) : STUB_SEED;
    const layout = viewOnly && sharedSeed !== null
      ? layoutForSeed(sharedSeed, manifest.casting)
      : layoutFor(profile, manifest.casting);
    const paths = library
      ? lovedPaths(manifest.casting, library, layout.positions)
      : [];
    return scatterFor(seed, layout.positions, paths);
  }, [manifest, library, profile, viewOnly, sharedSeed]);

  const rocks = useMemo(() => items.filter((i) => i.kind === 'rock'), [items]);
  const grasses = useMemo(() => items.filter((i) => i.kind === 'grass'), [items]);

  if (items.length === 0) return null;

  return (
    <>
      {rocks.length > 0 && (
        <Instances limit={rocks.length} castShadow receiveShadow>
          {/* Low-poly icosahedron reads as a chunky rock at this scale. The
              dodecahedronGeometry args choose a small reference radius;
              per-instance scale varies it. */}
          <dodecahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial color="#52473d" roughness={0.95} flatShading />
          {rocks.map((r, i) => (
            <Instance
              key={i}
              position={r.position}
              rotation={[0, r.rotationY, 0]}
              scale={r.scale}
            />
          ))}
        </Instances>
      )}

      {grasses.length > 0 && (
        <Instances limit={grasses.length} castShadow receiveShadow>
          {/* Squat cone reads as a small grass tuft / shrub. */}
          <coneGeometry args={[0.22, 0.34, 5]} />
          <meshStandardMaterial color="#3a4a2a" roughness={1} flatShading />
          {grasses.map((g, i) => (
            <Instance
              key={i}
              // Cones bottom-pivot — push up a touch so the base sits on
              // the terrain rather than half-buried.
              position={[g.position[0], g.position[1] + 0.17, g.position[2]]}
              rotation={[0, g.rotationY, 0]}
              scale={g.scale}
            />
          ))}
        </Instances>
      )}
    </>
  );
}
