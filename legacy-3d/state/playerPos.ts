import { Vector3 } from 'three';

/**
 * Live player position, mutated by Player.tsx each frame and read by interactive
 * world objects (Computer, future archetypes) to do distance checks without
 * triggering React re-renders.
 */
export const playerPosition = new Vector3();
