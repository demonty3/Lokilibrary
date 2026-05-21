import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { useAppStore } from '../../state/store';
import { RecognitionFace } from './RecognitionFace';
import { StateAccents } from './StateAccents';
import { styleFor } from './stateStyling';
import { useInteract } from './useInteract';
import type { ArchetypeComponentProps } from './index';

/**
 * Moored fishing boat with a sail. Ritual: the sail catches a sudden wind and
 * fills. v0.1 procedural; Meshy at Phase 1.7. (The existing public/models/seaside/boat.glb
 * is decoration — different archetype role.)
 */
export function FishingBoat({ appid, name, position, state }: ArchetypeComponentProps) {
  const [x, z] = position;
  const sailRef = useRef<Group>(null);
  const startRitual = useAppStore((s) => s.startRitual);
  const style = styleFor(state);

  useInteract(x, z, `[E] cast off · ${name}`, () => {
    startRitual({ appid, archetype: 'fishing_boat', startedAt: performance.now() });
  }, appid);

  useFrame((s) => {
    const sail = sailRef.current;
    if (!sail) return;
    const ritual = useAppStore.getState().activeRitual;
    const t = s.clock.elapsedTime;
    if (ritual && ritual.appid === appid && ritual.archetype === 'fishing_boat') {
      const dt = (performance.now() - ritual.startedAt) / 1000;
      const k = Math.min(dt / 1.6, 1);
      const eased = k * k * (3 - 2 * k);
      // Fill the sail (scale-x grows) and tilt with the wind.
      sail.scale.x = 0.85 + 0.4 * eased;
      sail.rotation.z = -0.15 * eased;
    } else {
      // `abandoned` boats sit slack with no breeze.
      const slackFactor = style.interiorIntensity === 0 ? 0 : 1;
      sail.scale.x = 0.85 + Math.sin(t * 1.4) * 0.04 * slackFactor;
      sail.rotation.z = Math.sin(t * 1.0) * 0.025 * slackFactor;
    }
  });

  return (
    <group position={[x, 0, z]} scale={style.scale}>
      {/* Hull */}
      <RigidBody type="fixed" colliders={false} position={[0, 0.5, 0]}>
        <CuboidCollider args={[1.6, 0.5, 0.7]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.9, 1.2]} />
          <meshStandardMaterial color="#4a2a18" roughness={0.95} flatShading />
        </mesh>
      </RigidBody>
      {/* Inner deck */}
      <mesh position={[0, 0.95, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.1, 0.9]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.95} />
      </mesh>
      {/* Mast */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 3.0, 8]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      {/* Sail — recognition face lives on it */}
      <group ref={sailRef} position={[0.3, 2.3, 0]}>
        <mesh castShadow>
          <planeGeometry args={[1.6, 2.0]} />
          <meshStandardMaterial color="#f0e8d0" roughness={0.85} />
        </mesh>
        <RecognitionFace appid={appid} position={[0, 0, 0.01]} width={1.35} />
      </group>

      <StateAccents state={state} topY={3.6} radius={1.7} />
    </group>
  );
}
