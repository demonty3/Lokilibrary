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
 * Pure + Pixi-free so scripts/smoke-ambient-phase.mts can run it.
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

/**
 * The cos-eased pulse shape every glow in the terminal shares — exported so
 * that a desk-global condition and a window-local pulse differ in ONE thing
 * only: which clock the caller hands it. `t` is reduced modulo the period, so
 * it takes epoch-magnitude wall-clock seconds and small accumulator seconds
 * with equal precision.
 */
export function pulse(tSeconds: number, periodS: number, [lo, hi]: readonly [number, number]): number {
  const phase = ((tSeconds % periodS) + periodS) % periodS;
  return lo + (hi - lo) * (0.5 - 0.5 * Math.cos((phase / periodS) * 2 * Math.PI));
}

/** ☼ cycle — slower than the structure glow it used to share a clock with. */
export const GLOW_SUN_PERIOD_S = 4.2;
export const GLOW_SUN_RANGE = [0.62, 1] as const;

/**
 * The desk's daylight at wall-clock time `tSeconds`. The sky's ☼ is a shared
 * truth — every window is a lens on ONE sky — so two joined terminals must
 * brighten together; on separate accumulators they read as two different suns
 * hanging over one landscape.
 *
 * Caveat worth knowing: the composer spends the `sun` role on two different
 * things — the sky's ☼ (`land.ts:367`) and the ☼ LAMP beside a loved game's
 * shelf (`land.ts:581`) — and they share a render layer, so this syncs the
 * lamps across windows too. That is benign (one light rhythm over the desk,
 * if anything more coherent) and splitting it would mean a new role in the
 * composer's vocabulary, which drags in the palette contract, the tile bibles
 * and the glyph-coverage smoke for no visible gain.
 */
export function sunGlow(tSeconds: number): number {
  return pulse(tSeconds, GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE);
}
