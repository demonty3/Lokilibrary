import { useMemo, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import { headerImageUrl } from '../../data/sampleLibrary';

interface RecognitionFaceProps {
  appid: number;
  /** Local-space position relative to the archetype root. */
  position: [number, number, number];
  /** Rotation around y. Most faces want to face the player approach line. */
  rotationY?: number;
  /** World width of the panel (Steam header.jpg is 460x215, so ratio ~2.14:1). */
  width?: number;
  /** Slight emissive glow so the recognition face reads at night. */
  emissive?: boolean;
}

/**
 * The "oh I own that" beat. Per CLAUDE.md: Steam CDN art ONLY on the
 * recognition face. Surrounding object surfaces stay normal template-asset
 * territory. Substituting generated art here weakens the recognition moment.
 *
 * Aspect ratio matches Steam's header.jpg (460x215 ≈ 2.14:1).
 */
function Inner({ appid, position, rotationY = 0, width = 1.2, emissive = false }: RecognitionFaceProps) {
  const url = headerImageUrl(appid);
  const texture = useLoader(TextureLoader, url) as Texture;
  // Steam CDN images are sRGB-encoded; without this they look washed-out under
  // the ACES tonemap.
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  const height = width / 2.14;
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={emissive ? texture : undefined}
        emissive={emissive ? '#ffffff' : '#000000'}
        emissiveIntensity={emissive ? 0.45 : 0}
        toneMapped
      />
    </mesh>
  );
}

export function RecognitionFace(props: RecognitionFaceProps) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
