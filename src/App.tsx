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

export function App() {
  const loadManifest = useAppStore((s) => s.loadManifest);
  const markReturnPending = useAppStore((s) => s.markReturnPending);
  const activeRitual = useAppStore((s) => s.activeRitual);

  // Phase 1.8: fire the Stage 1 call on first mount. Falls back to the stub
  // manifest if the worker isn't reachable.
  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  // Phase 1.10: return ritual. After a launch fires steam://run, the tab loses
  // focus; we listen for it to come back and surface a "you came home" beat.
  // CLAUDE.md flags this as a small lie (focus fires on any tab-switch) —
  // accepted through v0.5; the native wrapper at v0.6 swaps in real signals.
  useEffect(() => {
    const onFocus = () => {
      if (useAppStore.getState().activeRitual?.appid != null) markReturnPending();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [markReturnPending]);

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
      {activeRitual && <RitualOverlay />}
    </KeyboardControls>
  );
}

function Footer() {
  const prompt = useAppStore((s) => s.prompt);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const activeRitual = useAppStore((s) => s.activeRitual);
  if (menuOpen || activeRitual) return null;
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

// Diegetic dimming layer drawn over the canvas while a ritual is playing.
// The 3D-side animation is in src/scene/rituals/; this is just the overlay.
function RitualOverlay() {
  const returnPending = useAppStore((s) => s.returnPending);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: returnPending
          ? 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.7) 100%)'
          : 'radial-gradient(circle at 50% 60%, transparent 0%, rgba(0,0,0,0.55) 80%)',
        transition: 'background 600ms ease-out',
        zIndex: 50,
      }}
    />
  );
}
