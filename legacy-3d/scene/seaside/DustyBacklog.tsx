import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { DoubleSide } from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useAppStore } from '../../state/store';
import { profileSeed } from '../../procedural/seed';
import { sampleHeight } from '../../procedural/terrain';

const STUB_SEED = 0xc0ffee;

/**
 * The dusty backlog — every `dusty`-tagged game (owned, never opened) lives
 * here as one crate in a pile in the corner of the map. SPEC §4: "Crate,
 * sheet over it, gathering dust in the corner." Phase 4 task 3 in PLAN.md.
 *
 * Top-N can't contain `dusty` games (zero playtime = not in top playtime),
 * so the per-archetype `dusty` styling in stateStyling.ts is dead code until
 * this component lands. From here on out, `dusty` has somewhere to live.
 *
 * Cluster is mounted server-positioned at one corner of the playable area
 * (15, -15 — far from spawn at 0,8). Phase 5's procedural layer will own
 * placement properly; for v0.4 the corner is hardcoded.
 *
 * Crates are instanced — N transforms, one draw call. A 4×4×6 grid covers
 * up to 96 dusty games; beyond that we clip rather than grow (visual reads
 * the same past a certain count, and the connector panel shows the precise
 * dusty count anyway).
 */

const CLUSTER_ORIGIN: [number, number, number] = [15, 0, -15];
const CRATE_SIZE = 0.7;
const GAP = 0.06;
const LAYER_W = 4;
const LAYER_D = 4;
const MAX_LAYERS = 6;
const MAX_VISIBLE = LAYER_W * LAYER_D * MAX_LAYERS;

interface CrateInstance {
  position: [number, number, number];
  rotationY: number;
}

export function DustyBacklog() {
  const library = useAppStore((s) => s.library);
  const profile = useAppStore((s) => s.profile);
  const viewOnly = useAppStore((s) => s.viewOnly);
  const sharedSeed = useAppStore((s) => s.sharedSeed);
  const sharedDustyCount = useAppStore((s) => s.sharedDustyCount);

  const dustyCount = useMemo(() => {
    // View-only mode: the share record carries an explicit dusty count
    // without the full owned-games array — read it directly.
    if (viewOnly) return sharedDustyCount;
    if (!library) return 0;
    return library.filter((g) => g.state === 'dusty').length;
  }, [library, viewOnly, sharedDustyCount]);

  // Lift the cluster to the terrain height at its xz so the pile sits on
  // the visual ground (slice 4 — terrain now undulates by ±0.3m around
  // the cluster's corner at (15, -15)).
  const clusterY = useMemo(() => {
    const seed = viewOnly && sharedSeed !== null
      ? sharedSeed
      : profile ? profileSeed(profile) : STUB_SEED;
    return sampleHeight(seed, CLUSTER_ORIGIN[0], CLUSTER_ORIGIN[2]);
  }, [viewOnly, sharedSeed, profile]);

  const visibleCount = Math.min(dustyCount, MAX_VISIBLE);

  const crates = useMemo<CrateInstance[]>(() => {
    const step = CRATE_SIZE + GAP;
    const out: CrateInstance[] = [];
    for (let i = 0; i < visibleCount; i++) {
      const layer = Math.floor(i / (LAYER_W * LAYER_D));
      const r = i - layer * LAYER_W * LAYER_D;
      const row = Math.floor(r / LAYER_W);
      const col = r % LAYER_W;
      // Deterministic micro-jitter so the pile reads as stacked-by-hand
      // rather than a perfect grid. Multiplier picks differ per axis so x/z
      // don't drift in lockstep.
      const jx = ((i * 1597) % 100) / 1000 - 0.05;
      const jz = ((i * 7919) % 100) / 1000 - 0.05;
      const jr = (((i * 3571) % 100) / 100 - 0.5) * 0.25; // ±0.125 rad
      const x = (col - (LAYER_W - 1) / 2) * step + jx;
      const z = (row - (LAYER_D - 1) / 2) * step + jz;
      const y = layer * step + CRATE_SIZE / 2;
      out.push({ position: [x, y, z], rotationY: jr });
    }
    return out;
  }, [visibleCount]);

  if (visibleCount === 0) return null;

  const stackLayers = Math.ceil(visibleCount / (LAYER_W * LAYER_D));
  const stackHeight = stackLayers * (CRATE_SIZE + GAP);
  const footprintW = LAYER_W * (CRATE_SIZE + GAP);
  const footprintD = LAYER_D * (CRATE_SIZE + GAP);

  return (
    <group position={[CLUSTER_ORIGIN[0], CLUSTER_ORIGIN[1] + clusterY, CLUSTER_ORIGIN[2]]}>
      {/* Single static collider over the whole pile footprint — cheap, and
          stops the player walking through the stack. Phase 5's procedural
          layer might switch this to per-crate if we want more permissive
          climbability. */}
      <RigidBody type="fixed" colliders={false} position={[0, stackHeight / 2, 0]}>
        <CuboidCollider args={[footprintW / 2, stackHeight / 2, footprintD / 2]} />
      </RigidBody>

      {/* Crates — instanced. limit must equal MAX_VISIBLE so Three.js
          allocates a buffer big enough for the worst case. */}
      <Instances limit={MAX_VISIBLE} castShadow receiveShadow>
        <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
        <meshStandardMaterial color="#5a4030" roughness={0.95} flatShading />
        {crates.map((c, i) => (
          <Instance key={i} position={c.position} rotation={[0, c.rotationY, 0]} />
        ))}
      </Instances>

      {/* Sheet on top — a small flat cone covering just the top layer; the
          crates poke out below so the "pile of unread things" read is the
          dominant signal, with the sheet as the corner accent. */}
      <mesh
        position={[0, stackHeight + 0.1, 0]}
        rotation={[0, Math.PI / 7, 0]}
        castShadow
      >
        <coneGeometry args={[Math.max(footprintW, footprintD) * 0.62, 0.5, 8, 1, true]} />
        <meshStandardMaterial color="#5e574d" roughness={0.95} side={DoubleSide} />
      </mesh>
    </group>
  );
}
