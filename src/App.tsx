import { Canvas } from '@react-three/fiber';
import { KeyboardControls, PointerLockControls } from '@react-three/drei';
import type { KeyboardControlsEntry } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useEffect } from 'react';
import { Scene } from './scene/Scene';
import { ConnectorPanel } from './ui/ConnectorPanel';
import { useAppStore } from './state/store';

export type Movement = 'forward' | 'backward' | 'left' | 'right';

const keyMap: KeyboardControlsEntry<Movement>[] = [
  { name: 'forward',  keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward', keys: ['ArrowDown',  'KeyS'] },
  { name: 'left',     keys: ['ArrowLeft',  'KeyA'] },
  { name: 'right',    keys: ['ArrowRight', 'KeyD'] },
];

/** Pre-launch animation length. The first 80% is full animation, the last 20%
 *  is the moment steam:// fires (CLAUDE.md: rituals 1.5-3s, last 20% is when
 *  Steam actually launches). */
const LAUNCH_MS = 1800;
const RITUAL_TOTAL_MS = 2200;
const RETURN_MS = 1200;

export function App() {
  const loadManifest = useAppStore((s) => s.loadManifest);
  const markReturnPending = useAppStore((s) => s.markReturnPending);
  const setInFlight = useAppStore((s) => s.setInFlight);
  const clearRitual = useAppStore((s) => s.clearRitual);
  const clearReturn = useAppStore((s) => s.clearReturn);
  const activeRitual = useAppStore((s) => s.activeRitual);
  const inFlight = useAppStore((s) => s.inFlight);
  const returnPending = useAppStore((s) => s.returnPending);

  // Phase 1.8: fire the Stage 1 call on first mount. Falls back to the stub
  // manifest if the worker isn't reachable.
  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  // Phase 1.9: launch ritual orchestration. When activeRitual flips on, schedule
  // steam://run at LAUNCH_MS and clear the ritual at RITUAL_TOTAL_MS. The
  // archetype components animate against the ritual.startedAt timestamp
  // themselves; this effect only handles state transitions + the steam:// fire.
  useEffect(() => {
    if (!activeRitual) return;
    const appid = activeRitual.appid;
    const launchTimer = window.setTimeout(() => {
      window.location.href = `steam://run/${appid}`;
      setInFlight(true);
    }, LAUNCH_MS);
    const clearTimer = window.setTimeout(() => clearRitual(), RITUAL_TOTAL_MS);
    return () => {
      window.clearTimeout(launchTimer);
      window.clearTimeout(clearTimer);
    };
  }, [activeRitual, setInFlight, clearRitual]);

  // Phase 1.10: return ritual. After a launch fires steam://run, the tab loses
  // focus; we listen for it to come back and surface a "you came home" beat.
  // CLAUDE.md flags this as a small lie (focus fires on any tab-switch) —
  // accepted through v0.5; the native wrapper at v0.6 swaps in real signals.
  useEffect(() => {
    const onFocus = () => {
      if (useAppStore.getState().inFlight) {
        setInFlight(false);
        markReturnPending();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [markReturnPending, setInFlight]);

  // Auto-clear the return animation after its tween length.
  useEffect(() => {
    if (!returnPending) return;
    const t = window.setTimeout(() => clearReturn(), RETURN_MS);
    return () => window.clearTimeout(t);
  }, [returnPending, clearReturn]);

  return (
    <KeyboardControls map={keyMap}>
      <Canvas shadows camera={{ position: [0, 1.7, 6], fov: 70 }}>
        <Physics>
          <Scene />
        </Physics>
        <PointerLockControls />
      </Canvas>
      <Footer />
      <ConnectorPanel />
      {(activeRitual || inFlight || returnPending) && (
        <RitualOverlay
          phase={returnPending ? 'returning' : inFlight ? 'in-flight' : 'launching'}
        />
      )}
    </KeyboardControls>
  );
}

function Footer() {
  const prompt = useAppStore((s) => s.prompt);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const activeRitual = useAppStore((s) => s.activeRitual);
  const inFlight = useAppStore((s) => s.inFlight);
  if (menuOpen || activeRitual || inFlight) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: prompt ? '#ffe6a8' : '#888',
        fontSize: 12,
        letterSpacing: 0.5,
        pointerEvents: 'none',
      }}
    >
      {prompt ?? 'click to capture mouse · WASD to walk · esc to release'}
    </div>
  );
}

// Diegetic dimming layer drawn over the canvas. The 3D-side archetype
// animations live in src/scene/archetypes/* — this is just the surrounding
// vignette that signals "the world is paying attention to one thing."
type RitualPhase = 'launching' | 'in-flight' | 'returning';

function RitualOverlay({ phase }: { phase: RitualPhase }) {
  const background =
    phase === 'launching'
      ? 'radial-gradient(circle at 50% 60%, transparent 0%, rgba(0,0,0,0.6) 90%)'
      : phase === 'in-flight'
      ? 'rgba(0,0,0,0.85)'
      : 'radial-gradient(circle at 50% 50%, rgba(255, 230, 168, 0.05) 0%, rgba(0,0,0,0.45) 100%)';
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background,
        transition: 'background 600ms ease-out',
        zIndex: 50,
      }}
    />
  );
}
