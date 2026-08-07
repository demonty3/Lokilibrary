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

// --- The world clock ---------------------------------------------------
// The rung IDEAS.md § Shared rules across terminals named: "no world clock
// exists today — the sky is static ambience". The composer bakes ☼, ☾ AND
// stars into every sky unconditionally (land.ts:366-372), so every terminal
// has shown all three at once, at every hour, since the desk existed. The
// clock does not add sky; it decides which of the baked sky is OUT.
//
// It needs no broker channel. Like sway and the ☼ pulse, every window derives
// it from the same wall clock, so N terminals agree by construction — there is
// no tick to broadcast, no join event to handle, and a window opened at noon
// agrees with one opened at dawn the instant it mounts.

/**
 * Local hour as a fraction, 0..24 (13:30 → 13.5).
 *
 * LOCAL time, deliberately, and this is the one place in the project where
 * that is right: the desk is a wallpaper you live in front of all day, and the
 * whole point is that your 9pm looks like night. The UTC-everywhere convention
 * governs logs and pipelines — anything we STAMP stays UTC; this is something
 * we RENDER.
 */
export function localHour(nowMs: number): number {
  const d = new Date(nowMs);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Dawn and dusk sit either side of these; full night ≤ 5.5, full day ≥ 7.7. */
const SUNRISE_H = 6;
const DAY_GAIN = 2.5;

/**
 * Daylight at `hour`, 0 (full night) → 1 (full day).
 *
 * A stylised day, NOT an ephemeris: a sine of solar elevation with sunrise at
 * 06:00 and sunset at 18:00, gained so the twilight band is ~1.7 h either side
 * rather than the six hours a raw sine gives. Latitude, season and the user's
 * actual sunset are all out of scope — they would need a location, and the
 * desk is a stylised world, not an observatory.
 *
 * Smoothstepped at the ends so dawn and dusk ease in and out; a linear ramp
 * reads as a dimmer switch being turned.
 */
export function daylight(hour: number): number {
  const elevation = Math.sin(((hour - SUNRISE_H) / 24) * 2 * Math.PI);
  const t = Math.min(1, Math.max(0, elevation * DAY_GAIN));
  return t * t * (3 - 2 * t);
}

/**
 * How present each baked celestial body is at this daylight level. Alphas
 * only: **packs own colour**, and the ruling is that a pack may compress or
 * omit a shared truth but never contradict it — so the clock says how much
 * sun and how much night, never what colour either is. A pack whose landOmit
 * drops the sky roles (DMG's blank sky) simply has nothing to fade, which is
 * legal omission and needs no special case here.
 *
 * `sun` multiplies the ☼ pulse; `night` drives ☾ and the stars together.
 */
export function skyPresence(daylightLevel: number): { sun: number; night: number } {
  return { sun: daylightLevel, night: 1 - daylightLevel };
}

/**
 * How far the sky is mixed from the pack's `bg` toward its `daySky` key at this
 * daylight level — the colour half of the clock, and the rung that let the hold
 * come off.
 *
 * A CEILING rather than a free dial, and the reason is arithmetic rather than
 * taste: `terminalLand.ts` draws a being at `(model.surface[x] - 1)`, one row
 * ABOVE the ground, which is a sky cell. Every being on the desk is seen
 * against the sky, so the sky's colour is the denominator of the being-salience
 * contract — `BEING_MIN_CONTRAST` in scripts/smoke-style-pack.mts, calibrated
 * against `bg` and frozen. Lifting the sky past this point makes beings harder
 * to find at noon than at midnight, which is eyeball bar 4's kill condition.
 *
 * The mix stays linear on top of `daylight()`, which is already smoothstepped —
 * a second ease would flatten the middle of the day into a plateau.
 */
export const DAY_SKY_MIX = 0.5;

export function daySkyMix(daylightLevel: number): number {
  return DAY_SKY_MIX * Math.min(1, Math.max(0, daylightLevel));
}

/**
 * The sky to draw right now — presence AND the level that drives colour.
 *
 * The clock shipped 2026-08-06 and was HELD the same day: it moved presence but
 * not colour, colour was a pack constant, and noon read as "night with the
 * stars taken away". `CLOCK_HELD` / `HELD_SKY` are gone because the thing they
 * were waiting for is here — `daySkyMix` above, plus `skyInkOf` in
 * src/render/levels/land.ts. A hold whose precondition has landed is dead
 * surface, not a safety net.
 *
 * `day` is returned rather than re-derived by the caller from `sun`. They are
 * numerically equal today (skyPresence passes the level straight through), and
 * that is exactly the coupling worth refusing: `sun` means "how much ☼ is out"
 * and also lights the ground LAMPS that share the role, so the day a presence
 * curve stops being the identity the sky's colour would silently follow it.
 */
export function skyNow(forcedHour: number | null, realHour: number): { sun: number; night: number; day: number } {
  const day = daylight(forcedHour ?? realHour);
  return { ...skyPresence(day), day };
}
