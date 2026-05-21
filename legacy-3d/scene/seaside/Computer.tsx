import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useAppStore } from '../../state/store';
import { playerPosition } from '../../state/playerPos';

const COMPUTER_POSITION: [number, number, number] = [2.5, 0, 5];
const INTERACT_RANGE = 3.5;

/**
 * Diegetic master-system console — a CRT terminal mounted on a driftwood plinth.
 * Walk within range and press E to open the connector panel (Steam, Claude,
 * asset libraries). The screen is emissive so bloom carries it; a faint cyan
 * point light makes nearby surfaces feel "lit by computer glow".
 */
export function Computer() {
  const isNear = useRef(false);

  useFrame(() => {
    const dist = Math.hypot(
      playerPosition.x - COMPUTER_POSITION[0],
      playerPosition.z - COMPUTER_POSITION[2],
    );
    const near = dist < INTERACT_RANGE;
    if (near !== isNear.current) {
      isNear.current = near;
      useAppStore.getState().setPrompt(near ? '[E] open system' : null);
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return;
      if (!isNear.current) return;
      if (useAppStore.getState().menuOpen) return;
      e.preventDefault();
      useAppStore.getState().openMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <group position={COMPUTER_POSITION}>
      {/* Driftwood plinth */}
      <RigidBody type="fixed" colliders={false} position={[0, 0.55, 0]}>
        <CuboidCollider args={[0.7, 0.55, 0.5]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.4, 1.1, 1.0]} />
          <meshStandardMaterial color="#4a3a2a" roughness={0.95} flatShading />
        </mesh>
      </RigidBody>

      {/* Monitor body */}
      <group position={[0, 1.55, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.5, 0.4, 0.35]} />
          <mesh castShadow>
            <boxGeometry args={[1.0, 0.8, 0.7]} />
            <meshStandardMaterial color="#1d1d22" roughness={0.55} metalness={0.4} />
          </mesh>
        </RigidBody>

        {/* Recessed screen bezel */}
        <mesh position={[0, 0.04, 0.35]}>
          <planeGeometry args={[0.86, 0.62]} />
          <meshStandardMaterial color="#08161a" />
        </mesh>

        {/* Screen glow */}
        <mesh position={[0, 0.04, 0.351]}>
          <planeGeometry args={[0.82, 0.58]} />
          <meshStandardMaterial
            color="#0a3a30"
            emissive="#3afff0"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>

        {/* Screen text */}
        <Text
          position={[0, 0.17, 0.353]}
          fontSize={0.082}
          color="#d2fff0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.002}
          outlineColor="#01211b"
        >
          LIBRARYWORLD
        </Text>
        <Text
          position={[0, 0.05, 0.353]}
          fontSize={0.055}
          color="#7accbf"
          anchorX="center"
          anchorY="middle"
        >
          SYSTEM v0.1
        </Text>
        <Text
          position={[0, -0.12, 0.353]}
          fontSize={0.048}
          color="#5a8a82"
          anchorX="center"
          anchorY="middle"
        >
          [E] CONNECT
        </Text>

        {/* Power LED */}
        <mesh position={[-0.4, -0.3, 0.351]}>
          <circleGeometry args={[0.024, 12]} />
          <meshStandardMaterial color="#ff6655" emissive="#ff3322" emissiveIntensity={3} toneMapped={false} />
        </mesh>

        {/* Screen casts a faint cyan glow on nearby surfaces */}
        <pointLight position={[0, 0, 0.7]} intensity={1.4} distance={3.5} color="#3afff0" decay={2} />
      </group>
    </group>
  );
}
