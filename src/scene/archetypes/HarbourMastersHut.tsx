import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { useAppStore } from '../../state/store';
import { RecognitionFace } from './RecognitionFace';
import { useInteract } from './useInteract';

interface HarbourMastersHutProps {
  appid: number;
  name: string;
  position: [number, number];
}

/**
 * A wider single-storey hut, slightly squat, with a board outside listing the
 * ships in harbour. Ritual: the logbook on the wall illuminates and pages
 * riffle. v0.1 procedural; Meshy at Phase 1.7.
 */
export function HarbourMastersHut({ appid, name, position }: HarbourMastersHutProps) {
  const [x, z] = position;
  const boardRef = useRef<Group>(null);
  const startRitual = useAppStore((s) => s.startRitual);

  useInteract(x, z, `[E] sign the logbook · ${name}`, () => {
    startRitual({ appid, archetype: 'harbour_masters_hut', startedAt: performance.now() });
  });

  useFrame(() => {
    const g = boardRef.current;
    if (!g) return;
    const ritual = useAppStore.getState().activeRitual;
    if (ritual && ritual.appid === appid && ritual.archetype === 'harbour_masters_hut') {
      const dt = (performance.now() - ritual.startedAt) / 1000;
      const k = Math.min(dt / 1.6, 1);
      // Slight tilt as if a hand is lifting the board to read.
      g.rotation.z = -0.15 * k;
      g.position.y = 1.6 + 0.05 * k;
    } else {
      g.rotation.z = 0;
      g.position.y = 1.6;
    }
  });

  const w = 3.4;
  const d = 2.4;
  const h = 2.6;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false} position={[0, h / 2, 0]}>
        <CuboidCollider args={[w / 2, h / 2, d / 2]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#3a5a6a" roughness={0.85} />
        </mesh>
      </RigidBody>
      {/* Flat-ish roof with overhang */}
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[w + 0.4, 0.2, d + 0.4]} />
        <meshStandardMaterial color="#1a2a30" roughness={0.95} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.9, d / 2 + 0.01]}>
        <planeGeometry args={[0.7, 1.8]} />
        <meshStandardMaterial color="#1a1a18" roughness={0.95} />
      </mesh>
      {/* Mounted board — recognition face lives here */}
      <group ref={boardRef} position={[w / 2 - 0.6, 1.6, d / 2 + 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.5, 0.04]} />
          <meshStandardMaterial color="#1a0e08" roughness={0.95} />
        </mesh>
        <RecognitionFace appid={appid} position={[0, 0, 0.03]} width={0.78} />
      </group>
    </group>
  );
}
