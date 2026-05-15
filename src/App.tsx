import { Canvas } from '@react-three/fiber';
import { KeyboardControls, PointerLockControls } from '@react-three/drei';
import type { KeyboardControlsEntry } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
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
    </KeyboardControls>
  );
}

function Footer() {
  const prompt = useAppStore((s) => s.prompt);
  const menuOpen = useAppStore((s) => s.menuOpen);
  if (menuOpen) return null;
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
