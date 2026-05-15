import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Boat } from './Boat';
import { Computer } from './Computer';

/**
 * v0.1 placeholder geometry for the seaside_town template. Procedural primitives
 * carrying the §12 visual stack (HDRI + bloom + ACES) for now. Swap to a real
 * Kenney coastal pack when we commit further — same composition, real meshes.
 */

interface HouseProps {
  position: [number, number, number];
  footprint: number;
  height: number;
  wallColor: string;
  roofColor: string;
  windowLit?: boolean;
}

function House({ position, footprint, height, wallColor, roofColor, windowLit = false }: HouseProps) {
  const half = footprint / 2;
  const roofRadius = footprint * Math.SQRT1_2;
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false} position={[0, height / 2, 0]}>
        <CuboidCollider args={[half, height / 2, half]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[footprint, height, footprint]} />
          <meshStandardMaterial color={wallColor} roughness={0.85} />
        </mesh>
      </RigidBody>
      <mesh position={[0, height + 0.7, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[roofRadius, 1.4, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.9} flatShading />
      </mesh>
      {windowLit && (
        <>
          <mesh position={[0, height * 0.55, half + 0.01]}>
            <planeGeometry args={[0.55, 0.65]} />
            <meshStandardMaterial
              color="#fff0c0"
              emissive="#ffe48a"
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[0, height * 0.55, half + 0.4]}
            intensity={2}
            distance={4}
            color="#ffe48a"
            decay={2}
          />
        </>
      )}
    </group>
  );
}

interface LighthouseProps {
  position: [number, number, number];
}

function Lighthouse({ position }: LighthouseProps) {
  const towerHeight = 7.5;
  const radius = 1.4;
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false} position={[0, towerHeight / 2, 0]}>
        <CylinderCollider args={[towerHeight / 2, radius]} />
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.85, radius, towerHeight, 20]} />
          <meshStandardMaterial color="#e8e0cf" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[radius * 0.92, radius * 0.92, 1.0, 20]} />
          <meshStandardMaterial color="#8e3434" roughness={0.7} />
        </mesh>
      </RigidBody>
      <mesh position={[0, towerHeight + 0.3, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.78, radius * 0.78, 1.2, 16]} />
        <meshStandardMaterial color="#23232a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, towerHeight + 0.3, 0]}>
        <sphereGeometry args={[0.6, 18, 18]} />
        <meshStandardMaterial
          color="#fff0a0"
          emissive="#fff0a0"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, towerHeight + 0.3, 0]}
        intensity={20}
        distance={28}
        color="#ffe48a"
        decay={2}
      />
      <mesh position={[0, towerHeight + 1.4, 0]} castShadow>
        <coneGeometry args={[radius * 0.78, 1.0, 16]} />
        <meshStandardMaterial color="#8e3434" roughness={0.7} />
      </mesh>
    </group>
  );
}

interface LampPostProps {
  position: [number, number, number];
}

function LampPost({ position }: LampPostProps) {
  const height = 2.8;
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, height, 8]} />
        <meshStandardMaterial color="#1a1410" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#ffd47a"
          emissive="#ffd47a"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, height, 0]}
        intensity={8}
        distance={9}
        color="#ffd47a"
        decay={2}
      />
    </group>
  );
}

interface PierProps {
  start: [number, number, number];
  end: [number, number, number];
  width?: number;
}

function Pier({ start, end, width = 1.8 }: PierProps) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[2] + end[2]) / 2;
  return (
    <group position={[cx, 0, cz]} rotation={[0, -angle, 0]}>
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[length, 0.15, width]} />
        <meshStandardMaterial color="#5a3f28" roughness={0.95} flatShading />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const t = (i / 4 - 0.5) * length * 0.9;
        return (
          <mesh key={i} position={[t, -0.05, 0]} castShadow>
            <boxGeometry args={[0.22, 1.0, 0.22]} />
            <meshStandardMaterial color="#2c1d10" roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

function Water() {
  // Sits a hair above the ground plane to avoid z-fighting. No collider —
  // the player walks on ground; the pier reads as "going out into the water".
  return (
    <mesh position={[6, 0.01, 14]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[44, 32]} />
      <meshStandardMaterial
        color="#0f1a2e"
        roughness={0.25}
        metalness={0.7}
      />
    </mesh>
  );
}

export function SeasideTown() {
  return (
    <>
      <House position={[-4, 0, -3]} footprint={3.0} height={2.6} wallColor="#cbb18a" roofColor="#7a3a2a" windowLit />
      <House position={[ 4, 0, -5]} footprint={3.6} height={3.0} wallColor="#b08868" roofColor="#5a3a2a" />
      <House position={[-8, 0, -8]} footprint={3.2} height={2.8} wallColor="#a89878" roofColor="#7a3a2a" windowLit />
      <House position={[ 6, 0,-10]} footprint={3.0} height={3.2} wallColor="#c4a888" roofColor="#5a3a2a" />
      <House position={[-2, 0,-12]} footprint={3.4} height={2.5} wallColor="#b8a080" roofColor="#7a3a2a" windowLit />

      <Lighthouse position={[-14, 0, -7]} />

      <LampPost position={[ 0, 0, -1]} />
      <LampPost position={[-5, 0, -6]} />
      <LampPost position={[ 6, 0, -3]} />
      <LampPost position={[ 4, 0,  6]} />

      <Pier start={[4, 0, 6]} end={[10, 0, 14]} />

      <Water />

      <Boat
        position={[11.5, 3.0, 14]}
        rotation={Math.PI / 5}
        scale={30}
        collider={[9.5, 3.0, 4.5]}
      />

      <Computer />
    </>
  );
}
