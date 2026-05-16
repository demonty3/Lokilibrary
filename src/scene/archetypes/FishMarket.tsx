import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { PointLight } from 'three';
import { useAppStore } from '../../state/store';
import { RecognitionFace } from './RecognitionFace';
import { useInteract } from './useInteract';

interface FishMarketProps {
  appid: number;
  name: string;
  position: [number, number];
}

/**
 * Open-air stall with a signboard. Ritual: lanterns string up and the boards
 * flip from "closed" to "open". v0.1 placeholder geometry — Meshy GLB swap at
 * Phase 1.7.
 */
export function FishMarket({ appid, name, position }: FishMarketProps) {
  const [x, z] = position;
  const lightRef = useRef<PointLight>(null);
  const startRitual = useAppStore((s) => s.startRitual);

  useInteract(x, z, `[E] open the stall · ${name}`, () => {
    startRitual({ appid, archetype: 'fish_market', startedAt: performance.now() });
  });

  useFrame((state) => {
    const light = lightRef.current;
    if (!light) return;
    const ritual = useAppStore.getState().activeRitual;
    if (ritual && ritual.appid === appid && ritual.archetype === 'fish_market') {
      const dt = (performance.now() - ritual.startedAt) / 1000;
      const k = Math.min(dt / 1.6, 1);
      light.intensity = 3 + 25 * (k * k * (3 - 2 * k));
    } else {
      light.intensity = 3 + Math.sin(state.clock.elapsedTime * 2.0) * 0.4;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Counter / table */}
      <RigidBody type="fixed" colliders={false} position={[0, 0.55, 0]}>
        <CuboidCollider args={[1.4, 0.55, 0.7]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.8, 1.1, 1.4]} />
          <meshStandardMaterial color="#7a5a3a" roughness={0.95} flatShading />
        </mesh>
      </RigidBody>
      {/* Awning posts */}
      {[-1.2, 1.2].map((px) =>
        [-0.5, 0.5].map((pz) => (
          <mesh key={`${px},${pz}`} position={[px, 1.4, pz]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 2.0, 8]} />
            <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* Awning */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[2.8, 0.1, 1.6]} />
        <meshStandardMaterial color="#9c3a3a" roughness={0.85} />
      </mesh>
      {/* Signboard above the awning — recognition face faces +Z */}
      <group position={[0, 3.0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2.0, 0.9, 0.08]} />
          <meshStandardMaterial color="#2a1810" roughness={0.95} />
        </mesh>
        <RecognitionFace appid={appid} position={[0, 0, 0.05]} width={1.7} emissive />
      </group>
      {/* Warm pendant light hung from the awning */}
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#ffd47a" emissive="#ffd47a" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 2.3, 0]} intensity={3} distance={8} color="#ffd47a" decay={2} />
    </group>
  );
}
