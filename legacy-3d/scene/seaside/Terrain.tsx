import { useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useAppStore } from '../../state/store';
import { profileSeed } from '../../procedural/seed';
import { FIELD_SIZE, SEGMENTS, terrainHeights } from '../../procedural/terrain';

const STUB_SEED = 0xc0ffee; // matches src/procedural/seaside.ts

/**
 * Visual terrain mesh + physics collider.
 *
 * Visual: a 200×200m plane with 128² segments, displaced by seeded simplex
 * noise via terrainHeights(). ±0.3m inside the playable area, ramping to
 * 2.5m hills further out for framing.
 *
 * Collider: deliberately a flat CuboidCollider at y=0. With ±0.3m
 * displacement inside the playable area, the player walking on a flat
 * collider is fine visually — heroes get lifted to terrain height by
 * CastedWorld, so they sit on the visual surface; the player's feet ride
 * the flat plane and clip slightly on hills. Switching to HeightfieldCollider
 * is a Phase 7 perf-hardening pass; the simpler collider keeps slice 4
 * tractable.
 *
 * Determinism: same profile seed → same terrain, every time. The share-URL
 * viewer feeds the saved seed; anonymous viewers get a stable stub seed.
 */
export function Terrain() {
  const profile = useAppStore((s) => s.profile);
  const viewOnly = useAppStore((s) => s.viewOnly);
  const sharedSeed = useAppStore((s) => s.sharedSeed);

  const seed = viewOnly && sharedSeed !== null
    ? sharedSeed
    : profile ? profileSeed(profile) : STUB_SEED;

  const geometry = useMemo(() => {
    const heights = terrainHeights(seed);
    const geo = new PlaneGeometry(FIELD_SIZE, FIELD_SIZE, SEGMENTS, SEGMENTS);
    const position = geo.attributes.position;
    // PlaneGeometry vertices start at top-left (+y, -x in local space) and
    // run row-major to bottom-right. terrainHeights() generated row-major
    // with row 0 at -FIELD_SIZE/2 z — which after the -π/2 X rotation maps
    // to PlaneGeometry's +y row. Vertices and heights match by index.
    for (let i = 0; i < position.count; i++) {
      position.setZ(i, heights[i]);
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [seed]);

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[100, 0.1, 100]} position={[0, -0.1, 0]} />
      </RigidBody>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        geometry={geometry}
      >
        <meshStandardMaterial color="#2a2734" roughness={0.95} flatShading />
      </mesh>
    </>
  );
}
