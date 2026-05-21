import { Environment } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Suspense } from 'react';
import { Player } from './Player';
import { SeasideTown } from './seaside/Town';
import { Terrain } from './seaside/Terrain';
import { Paths } from './seaside/Paths';
import { Scatter } from './seaside/Scatter';
import { DustyBacklog } from './seaside/DustyBacklog';
import { CastedWorld } from './CastedWorld';

/**
 * v0.1 seaside_town scene. Per SPEC §12, four levers carry the visual bar:
 *   1. one pack throughout — procedural primitives for now (Kenney swap is a
 *      separate next step); style coherence enforced by shared palette + materials.
 *   2. lighting — drei <Environment> sunset HDRI for IBL, low ambient, warm
 *      directional sunlight, point lights on lamps + lighthouse top.
 *   3. post-FX — EffectComposer with bloom on emissives, ACES tonemap, vignette.
 *   4. camera — first-person with PointerLockControls (mounted in App).
 *
 * Ground (slice 4): undulating terrain via Terrain; worn paths between
 * `loved` archetypes via Paths. Both seed off the profile so the share-URL
 * contract reaches the ground plane too.
 */
export function Scene() {
  return (
    <>
      <fog attach="fog" args={['#3a2845', 8, 55]} />

      <ambientLight intensity={0.18} color="#6a5878" />
      <directionalLight
        position={[18, 22, 8]}
        intensity={1.6}
        color="#ffc890"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
      />

      <Suspense fallback={null}>
        <Environment
          preset="sunset"
          background
          backgroundBlurriness={0.35}
          backgroundIntensity={0.55}
          environmentIntensity={0.5}
        />
      </Suspense>

      <Terrain />
      <Paths />
      <Scatter />

      <SeasideTown />
      <CastedWorld />
      <DustyBacklog />
      <Player />

      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
