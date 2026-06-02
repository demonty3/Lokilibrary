/**
 * Tiny easing + interpolation helpers for the reveal timeline. Pure
 * functions, no state — the reveal driver advances its own phase clock and
 * calls these to shape motion. Kept separate so the choreography in index.ts
 * reads as intent, not arithmetic.
 */

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth acceleration + deceleration — the workhorse for camera moves. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Decelerate into rest — used for fades settling to their target. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
