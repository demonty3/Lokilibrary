import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Mesh, MeshStandardMaterial } from 'three';
import { useAppStore } from '../../state/store';
import { RecognitionFace } from './RecognitionFace';
import { useInteract } from './useInteract';

interface DetectivesOfficeProps {
  appid: number;
  name: string;
  position: [number, number];
}

/**
 * Small two-storey building with a single window glowing through case-file
 * smoke. Ritual: the window brightens; the door creaks open. v0.1 procedural
 * placeholder; Meshy GLB at Phase 1.7.
 */
export function DetectivesOffice({ appid, name, position }: DetectivesOfficeProps) {
  const [x, z] = position;
  const windowRef = useRef<Mesh>(null);
  const startRitual = useAppStore((s) => s.startRitual);

  useInteract(x, z, `[E] open the case file · ${name}`, () => {
    startRitual({ appid, archetype: 'detectives_office', startedAt: performance.now() });
  });

  useFrame(() => {
    const w = windowRef.current;
    if (!w) return;
    const ritual = useAppStore.getState().activeRitual;
    const mat = w.material as MeshStandardMaterial;
    if (ritual && ritual.appid === appid && ritual.archetype === 'detectives_office') {
      const dt = (performance.now() - ritual.startedAt) / 1000;
      const k = Math.min(dt / 1.6, 1);
      mat.emissiveIntensity = 2 + 6 * (k * k * (3 - 2 * k));
    } else {
      mat.emissiveIntensity = 2;
    }
  });

  const w = 2.6;
  const d = 2.2;
  const h = 4.0;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false} position={[0, h / 2, 0]}>
        <CuboidCollider args={[w / 2, h / 2, d / 2]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.9} />
        </mesh>
      </RigidBody>
      {/* Pitched roof */}
      <mesh position={[0, h + 0.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[w * 0.8, 1.2, 4]} />
        <meshStandardMaterial color="#2a1a14" roughness={0.95} flatShading />
      </mesh>
      {/* Glowing upstairs window — the silhouette of someone at the desk */}
      <mesh ref={windowRef} position={[0, h * 0.65, d / 2 + 0.01]}>
        <planeGeometry args={[0.9, 1.0]} />
        <meshStandardMaterial
          color="#ffe0a0"
          emissive="#ffce6a"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.0, d / 2 + 0.01]}>
        <planeGeometry args={[0.8, 2.0]} />
        <meshStandardMaterial color="#1a0e08" roughness={0.95} />
      </mesh>
      {/* Plaque beside the door — recognition face goes here */}
      <RecognitionFace
        appid={appid}
        position={[w / 2 - 0.05, 1.4, d / 2 + 0.02]}
        width={0.9}
      />
    </group>
  );
}
