import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import type { Mesh, MeshStandardMaterial, PointLight } from 'three';
import { useAppStore } from '../../state/store';
import { RecognitionFace } from './RecognitionFace';
import { StateAccents } from './StateAccents';
import { styleFor } from './stateStyling';
import { useInteract } from './useInteract';
import type { ArchetypeComponentProps } from './index';

const TOWER_HEIGHT = 7.5;
const RADIUS = 1.4;
const BASE_EMISSIVE = 5;
const RITUAL_PEAK_EMISSIVE = 22;

/**
 * The seaside template's first archetype. Procedural primitives carry the v0.1
 * visual bar; PLAN.md 1.7 swaps in a Meshy GLB once curation lands.
 *
 * Recognition face: the lantern panel just below the light dome — that's where
 * the game's Steam header.jpg goes (CLAUDE.md recognition-face rule).
 */
export function Lighthouse({ appid, name, position, state }: ArchetypeComponentProps) {
  const [x, z] = position;
  const lanternRef = useRef<Mesh>(null);
  const pointRef = useRef<PointLight>(null);
  const startRitual = useAppStore((s) => s.startRitual);
  const style = styleFor(state);

  useInteract(x, z, `[E] light the lantern · ${name}`, () => {
    startRitual({ appid, archetype: 'lighthouse', startedAt: performance.now() });
  });

  // Drive the lantern emissive + point-light intensity from any active ritual
  // targeting this archetype instance. Outside a ritual: gentle flicker scaled
  // by state — `loved` lanterns burn brighter, `abandoned` ones are snuffed.
  useFrame((s) => {
    const lantern = lanternRef.current;
    const light = pointRef.current;
    if (!lantern || !light) return;
    const ritual = useAppStore.getState().activeRitual;
    const t = s.clock.elapsedTime;
    const mat = lantern.material as MeshStandardMaterial;
    if (ritual && ritual.appid === appid && ritual.archetype === 'lighthouse') {
      const dt = (performance.now() - ritual.startedAt) / 1000;
      // First 1.6s: ramp up. Last 0.4s: hold and bloom out.
      const k = dt < 1.6 ? dt / 1.6 : 1.0;
      const eased = k * k * (3 - 2 * k); // smoothstep
      mat.emissiveIntensity = BASE_EMISSIVE + (RITUAL_PEAK_EMISSIVE - BASE_EMISSIVE) * eased;
      light.intensity = 20 + 80 * eased;
    } else {
      const flicker = 1 + Math.sin(t * 6.7) * 0.08;
      mat.emissiveIntensity = BASE_EMISSIVE * flicker * style.interiorIntensity;
      light.intensity = 20 * flicker * style.interiorIntensity;
    }
  });

  return (
    <group position={[x, 0, z]} scale={style.scale}>
      <RigidBody type="fixed" colliders={false} position={[0, TOWER_HEIGHT / 2, 0]}>
        <CylinderCollider args={[TOWER_HEIGHT / 2, RADIUS]} />
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[RADIUS * 0.85, RADIUS, TOWER_HEIGHT, 20]} />
          <meshStandardMaterial color="#e8e0cf" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[RADIUS * 0.92, RADIUS * 0.92, 1.0, 20]} />
          <meshStandardMaterial color="#8e3434" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Light dome housing */}
      <mesh position={[0, TOWER_HEIGHT + 0.3, 0]} castShadow>
        <cylinderGeometry args={[RADIUS * 0.78, RADIUS * 0.78, 1.2, 16]} />
        <meshStandardMaterial color="#23232a" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* The lantern itself — drives the ritual animation */}
      <mesh ref={lanternRef} position={[0, TOWER_HEIGHT + 0.3, 0]}>
        <sphereGeometry args={[0.6, 18, 18]} />
        <meshStandardMaterial
          color="#fff0a0"
          emissive="#fff0a0"
          emissiveIntensity={BASE_EMISSIVE * style.interiorIntensity}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={pointRef}
        position={[0, TOWER_HEIGHT + 0.3, 0]}
        intensity={20 * style.interiorIntensity}
        distance={32}
        color="#ffe48a"
        decay={2}
      />

      {/* Roof cap */}
      <mesh position={[0, TOWER_HEIGHT + 1.4, 0]} castShadow>
        <coneGeometry args={[RADIUS * 0.78, 1.0, 16]} />
        <meshStandardMaterial color="#8e3434" roughness={0.7} />
      </mesh>

      {/* Recognition face: mounted on the base band where it catches the eye
          at approach height. Faces +Z (the usual approach side). */}
      <RecognitionFace
        appid={appid}
        position={[0, 2.6, RADIUS + 0.02]}
        width={1.6}
        emissive
      />

      <StateAccents state={state} topY={TOWER_HEIGHT + 1.8} radius={RADIUS} />
    </group>
  );
}
