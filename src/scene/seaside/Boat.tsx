import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Group } from 'three';

const BOAT_URL = '/models/seaside/boat.glb';

interface BoatProps {
  /** World position of the boat's *center* (collider centred here). */
  position: [number, number, number];
  /** y-axis rotation in radians */
  rotation?: number;
  /** uniform scale multiplier — adjust if Meshy output is too big/small */
  scale?: number;
  /** half-extents of the collision box, tune to roughly match the visible hull */
  collider?: [number, number, number];
  /** Vertical offset for the visible mesh inside the group. Use if Meshy's
   *  exported origin doesn't match the boat's geometric centre. */
  visualYOffset?: number;
}

/**
 * Meshy-generated boat. Loaded async via drei's useGLTF; cloned so future copies
 * don't share state. The visible mesh bobs and sways gently each frame; the
 * Rapier collider stays static (sized generously to cover the bob extent so the
 * player can't walk through the space the boat occupies).
 */
function BoatInner({
  position,
  rotation = 0,
  scale = 1,
  collider = [1.6, 0.6, 0.8],
  visualYOffset = 0,
}: BoatProps) {
  const { scene } = useGLTF(BOAT_URL);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const visualRef = useRef<Group>(null);

  useFrame((state) => {
    const g = visualRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = Math.sin(t * 1.2) * 0.05;
    g.rotation.z = Math.sin(t * 0.8) * 0.04;
    g.rotation.x = Math.sin(t * 1.0 + 0.6) * 0.025;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={collider} />
      </RigidBody>
      <group ref={visualRef} position={[0, visualYOffset, 0]}>
        <primitive object={cloned} scale={scale} castShadow receiveShadow />
      </group>
    </group>
  );
}

export function Boat(props: BoatProps) {
  return (
    <Suspense fallback={null}>
      <BoatInner {...props} />
    </Suspense>
  );
}

useGLTF.preload(BOAT_URL);
