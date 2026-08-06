/**
 * Sub-cell liveliness maths for the terminal land's beings (pure, no PIXI —
 * the siteLabels.ts/wear.ts precedent, smokeable in
 * scripts/smoke-being-liveliness.mts).
 *
 * Before this, a being's whole draw was one 1.6 Hz sine on y that ran
 * identically whether it was sprinting or standing still, and b.dir never
 * reached the sprite. So a 6-18 s `rest` (cat/ghost windows) was a motionless
 * glyph, and nothing told you which way anyone faced.
 *
 * Three channels replace that bob (spec:
 * docs/superpowers/specs/2026-08-06-being-liveliness-design.md):
 *
 *  - BREATH vs GAIT — standing breathes slowly and shallowly; walking hops on
 *    a phase that advances by DISTANCE walked, not by time. Riding distance is
 *    what makes persona speed visible for free and makes WATCH_DRIFT read as
 *    slowing down rather than as the same bob at a lower x-rate. `moving`
 *    crossfades the two, so arriving at an approach target reads as settling.
 *  - LEAN — the drawn facing. An eased sub-cell x offset, never a mirrored or
 *    swapped glyph (the glyph is the being's identity). Deliberately driven by
 *    a render-only `face`, NOT b.dir: b.dir rides the seam handoff, near-edge
 *    reports and state(), so an idle turn must not perturb it.
 *  - IDLE BEATS — a seeded half-sine shuffle every few seconds of standing
 *    still, sometimes carrying a turn, so a long rest is loitering rather than
 *    dead time.
 *
 * All of it is stepped by the caller's deltaMS-derived dt and elapsedS
 * (throttle-safe: dt = 0 is a no-op, and elapsedS stops accumulating when the
 * window is occluded) — never wall clock. Total sub-cell excursion is capped
 * below CW/2 so a being can never appear to snap between cells.
 */

const TAU = Math.PI * 2;

/** Standing: slow shallow breath (local px amplitude + Hz). */
export const BREATH_PX = 0.9;
export const BREATH_HZ = 0.5;
/** Walking: hop amplitude (local px) and gait cycles per cell travelled. The
 *  hop is one-sided (-|sin|), so 2.0 here is a 2.0 px peak-to-peak swing — it
 *  must beat the breath's 2 * BREATH_PX or a walking being would read as LESS
 *  alive than a standing one. Smoke-asserted. */
export const GAIT_PX = 2;
export const GAIT_CYCLES_PER_CELL = 0.75;
/** Facing: the drawn sub-cell lean (local px) and its ease duration. */
export const LEAN_PX = 1.3;
export const LEAN_S = 0.25;
/** Walk/stand crossfade (seconds for a full swing either way). */
export const MOVE_BLEND_S = 0.18;
/** Idle beat cadence: min + seeded extra (seconds of standing still). */
export const IDLE_BEAT_S: [number, number] = [2.2, 2.6];
/** Idle beat duration (seconds) and excursion (local px). */
export const IDLE_BEAT_DUR = 0.8;
export const IDLE_BEAT_PX = 1.1;
/** Odds an idle beat carries a turn-in-place. */
export const IDLE_TURN_CHANCE = 0.45;
/** Worst-case sub-cell excursion — asserted under CW/2 by the smoke. */
export const MAX_SUBCELL_PX = LEAN_PX + IDLE_BEAT_PX;

/** The animation channels carried per being (Being satisfies this). */
export interface BeingAnim {
  /** Drawn facing. Render-only — NOT the behaviour dir. */
  face: 1 | -1;
  /** Current eased lean (local px), converging on face * LEAN_PX. */
  lean: number;
  /** 0 = standing, 1 = walking; crossfades breath into gait. */
  moving: number;
  /** Gait phase (radians), advanced by distance walked. */
  gaitPhase: number;
  /** Per-being breath phase (radians) — seeded, so nobody breathes in sync. */
  bobPhase: number;
  /** Live idle beat, or null while none is running. */
  idleBeat: { startedS: number; turn: boolean } | null;
}

/** Advance the gait by the cells walked this frame. Takes NO time argument on
 *  purpose: a being that isn't moving must not accumulate gait. */
export function stepGait(phase: number, movedCells: number): number {
  if (movedCells <= 0) return phase;
  return (phase + movedCells * GAIT_CYCLES_PER_CELL * TAU) % TAU;
}

/** Ramp the walk/stand blend toward `walking`. dt <= 0 is a no-op. */
export function stepMoving(current: number, walking: boolean, dtS: number): number {
  if (dtS <= 0) return current;
  const step = dtS / MOVE_BLEND_S;
  const next = walking ? current + step : current - step;
  return Math.min(1, Math.max(0, next));
}

/** Ease the lean toward the drawn facing. dt <= 0 is a no-op. */
export function stepLean(current: number, face: 1 | -1, dtS: number): number {
  if (dtS <= 0) return current;
  const target = face * LEAN_PX;
  const step = (dtS / LEAN_S) * LEAN_PX * 2;
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/** Vertical offset (local px): breath while standing, gait hop while walking.
 *  The gait is shaped -|sin| so the body rises off the ground line and never
 *  sinks below it. */
export function bobOffset(a: BeingAnim, elapsedS: number): number {
  const breath = Math.sin(elapsedS * BREATH_HZ * TAU + a.bobPhase) * BREATH_PX;
  const gait = -Math.abs(Math.sin(a.gaitPhase)) * GAIT_PX;
  return breath * (1 - a.moving) + gait * a.moving;
}

/** Horizontal offset (local px) of a live idle beat — a half-sine excursion in
 *  the facing direction, faded out by any movement. */
export function beatOffset(a: BeingAnim, elapsedS: number): number {
  if (a.idleBeat === null) return 0;
  const p = Math.min(1, Math.max(0, (elapsedS - a.idleBeat.startedS) / IDLE_BEAT_DUR));
  return Math.sin(p * Math.PI) * IDLE_BEAT_PX * a.face * (1 - a.moving);
}
