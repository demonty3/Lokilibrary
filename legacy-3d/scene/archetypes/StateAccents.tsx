import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, type PointLight } from 'three';
import type { LibraryState } from '../../types';
import { styleFor } from './stateStyling';

interface StateAccentsProps {
  state?: LibraryState;
  /** Approximate vertical extent of the archetype — anchor for aura + tarp. */
  topY: number;
  /** Footprint radius — sizes the tarp drape and the plaque offset. */
  radius: number;
}

/**
 * Shared per-state accents that all 5 archetypes share — the universal
 * "loved games pulse with warm light, mastered games have a gold plaque,
 * dusty games wear a tarp." Archetype-specific styling (lighthouse lantern
 * dims when abandoned; cabinet screen goes dark) stays in each archetype
 * via `style.interiorIntensity` from stateStyling.ts.
 */
export function StateAccents({ state, topY, radius }: StateAccentsProps) {
  const style = styleFor(state);
  const auraRef = useRef<PointLight>(null);

  useFrame((s) => {
    if (style.aura?.pulse && auraRef.current) {
      // Slow heartbeat pulse for `loved` — period ~3s, ±20% intensity.
      const t = s.clock.elapsedTime;
      auraRef.current.intensity = style.aura.intensity * (1 + Math.sin(t * 2.1) * 0.2);
    }
  });

  return (
    <>
      {style.aura && (
        <pointLight
          ref={auraRef}
          position={[0, topY * 0.7, 0]}
          color={style.aura.color}
          intensity={style.aura.intensity}
          distance={style.aura.distance}
          decay={2}
        />
      )}

      {style.plaque && (
        <group position={[0, 0, radius + 0.55]}>
          {/* Stone-coloured base — a wood-and-brass placeholder that reads as
              "museum exhibit" without needing a curated asset. */}
          <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
            <boxGeometry args={[0.75, 0.1, 0.5]} />
            <meshStandardMaterial color="#3d2f22" roughness={0.85} />
          </mesh>
          {/* Gold cone — placeholder trophy. */}
          <mesh position={[0, 0.32, 0]} castShadow>
            <coneGeometry args={[0.12, 0.42, 14]} />
            <meshStandardMaterial
              color="#f0c050"
              metalness={0.7}
              roughness={0.25}
              emissive="#5a3f10"
              emissiveIntensity={0.4}
            />
          </mesh>
        </group>
      )}

      {style.tarp && (
        // Procedural drape: open-bottom cone sitting on top of the archetype.
        // Cheap, no asset; the matte grey + high roughness reads "covered."
        <mesh position={[0, topY * 0.92, 0]} castShadow rotation={[0, Math.PI / 8, 0]}>
          <coneGeometry args={[radius * 1.35, topY * 0.55, 8, 1, true]} />
          <meshStandardMaterial color="#605a52" roughness={0.95} side={DoubleSide} />
        </mesh>
      )}
    </>
  );
}
