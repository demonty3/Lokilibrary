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
 * The prompt label is set by the caller so each archetype can read in-world
 * (e.g. "[E] tend the lantern" vs "[E] open case file").
 *
 * Phase 5 slice 3: when the store's `viewOnly` flag is set (someone walking
 * a shared world), the prompt switches to a peek-style tooltip pulled from
 * the shared manifest + library, and E is a no-op — you can read about
 * Harry's lighthouse but you can't launch his Hades.
 */
export function useInteract(
  worldX: number,
  worldZ: number,
  promptLabel: string,
  onInteract: () => void,
  appid?: number,
) {
  const isNear = useRef(false);
  const lastSetLabel = useRef<string | null>(null);

  useFrame(() => {
    const dist = Math.hypot(playerPosition.x - worldX, playerPosition.z - worldZ);
    const near = dist < INTERACT_RANGE;
    if (near !== isNear.current) {
      isNear.current = near;
      const st = useAppStore.getState();
      // Suppress the prompt during active rituals or while the menu is open;
      // both signal "interaction is taken over by something else right now".
      if (near && !st.activeRitual && !st.menuOpen) {
        const label = st.viewOnly && appid !== undefined
          ? viewOnlyLabel(appid, st) ?? promptLabel
          : promptLabel;
        st.setPrompt(label);
        lastSetLabel.current = label;
      } else if (!near && st.prompt === lastSetLabel.current) {
        st.setPrompt(null);
        lastSetLabel.current = null;
      }
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return;
      if (!isNear.current) return;
      const st = useAppStore.getState();
      if (st.menuOpen || st.activeRitual) return;
      // View-only mode: pressing E is a no-op. The tooltip is already showing
      // via the prompt; pressing E would otherwise launch the creator's game
      // on the viewer's machine, which is the wrong thing.
      if (st.viewOnly) return;
      e.preventDefault();
      onInteract();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onInteract]);

  return isNear;
}

/**
 * Build the view-only peek label from the shared manifest + library +
 * persona. Returns null if any required piece is missing — caller falls
 * back to the normal prompt label in that case.
 */
function viewOnlyLabel(
  appid: number,
  st: ReturnType<typeof useAppStore.getState>,
): string | null {
  const role = st.manifest?.casting.find((c) => c.appid === appid)?.role;
  const game = st.library?.find((g) => g.appid === appid);
  if (!role || !game) return null;
  const hours = game.playtime_forever
    ? ` (${Math.round(game.playtime_forever / 60)}h)`
    : '';
  const owner = st.persona?.name ? `${st.persona.name}'s · ` : '';
  return `${owner}${game.name}${hours} — "${role}"`;
}
