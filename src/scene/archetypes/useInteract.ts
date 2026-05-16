import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { playerPosition } from '../../state/playerPos';
import { useAppStore } from '../../state/store';

const INTERACT_RANGE = 4;

/**
 * Shared interact behavior for archetype components. Each frame, measure the
 * player ↔ object distance; when close, show the prompt and bind E to fire the
 * onInteract callback.
 *
 * Originally extracted from Computer.tsx's pattern, generalised across all
 * archetypes. The prompt label is set by the caller so each archetype can read
 * in-world (e.g. "[E] tend the lantern" vs "[E] open case file").
 */
export function useInteract(
  worldX: number,
  worldZ: number,
  promptLabel: string,
  onInteract: () => void,
) {
  const isNear = useRef(false);

  useFrame(() => {
    const dist = Math.hypot(playerPosition.x - worldX, playerPosition.z - worldZ);
    const near = dist < INTERACT_RANGE;
    if (near !== isNear.current) {
      isNear.current = near;
      // Hide the prompt while a ritual is active or the menu is open — both
      // signal "interaction is taken over by something else right now".
      const st = useAppStore.getState();
      if (near && !st.activeRitual && !st.menuOpen) {
        st.setPrompt(promptLabel);
      } else if (!near && st.prompt === promptLabel) {
        st.setPrompt(null);
      }
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return;
      if (!isNear.current) return;
      const st = useAppStore.getState();
      if (st.menuOpen || st.activeRitual) return;
      e.preventDefault();
      onInteract();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onInteract]);

  return isNear;
}
