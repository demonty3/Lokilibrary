/**
 * Ambient oscillators phased on the WALL CLOCK — the conditions every joined
 * terminal has to agree on (IDEAS.md § Shared rules across terminals, the
 * conditions-vs-content ladder). Same reasoning as cloud drift
 * (src/terminal/clouds.ts): windows opened minutes apart must render the same
 * weather, and a throttled renderer that wakes snaps to where the world has
 * got to instead of resuming a stale accumulator.
 *
 * The defect this module fixes: foliage sway ran off each window's OWN ticker
 * accumulator (`elapsedS`, zeroed at mount), so two terminals opened seconds
 * apart leant their trees in opposite directions across a shared seam — the
 * join's most visible contradiction, since the seam blend puts foliage from
 * both wings side by side.
 *
 * Pure + Pixi-free so scripts/smoke-wind-phase.mts can run it.
 */

/** Tier-2 foliage sway: sub-cell x oscillation in local px (× WORLD_SCALE on
 *  screen), the parity planes counter-phased. Stays well under CW = 6 —
 *  glyphs move BETWEEN cells, they never snap to one. */
export const SWAY_PX = 1.2;
export const SWAY_HZ = 0.35;

/**
 * The desk's wind at wall-clock time `tSeconds` — one breeze crossing every
 * window, whatever each was mounted. The caller negates it for the odd parity
 * plane so the two planes stay in antiphase.
 *
 * `t` is reduced modulo the period before scaling: at epoch magnitudes
 * (~1.8e9) a double keeps ~1e-7 s of resolution, and the reduction restores
 * full precision to the phase without changing the value (sin is periodic).
 */
export function foliageSway(tSeconds: number): number {
  const period = 1 / SWAY_HZ;
  const phase = ((tSeconds % period) + period) % period;
  return Math.sin(phase * SWAY_HZ * 2 * Math.PI) * SWAY_PX;
}
