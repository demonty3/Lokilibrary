/**
 * Throttle-to-attention gate for the terminals desk (pure, no PIXI, no
 * electron — the siteLabels.ts/beingAnim.ts posture, smokeable headlessly).
 *
 * In wallpaper mode the desk is click-through and the app is 'accessory', so
 * ALL THREE of the launcher beat's return-from-away triggers are dead:
 * pointermove, pointerdown, and window focus (an accessory app's window is
 * never key). Without a replacement, AWAY_CEIL_MS — thirty minutes — becomes
 * the only way a being who went into a game ever comes back.
 *
 * The replacement is the idle ladder. A `throttled-1hz -> full` transition can
 * only follow a real idle period, so unlike a stray mousemove it cannot fire
 * spuriously: it means the user physically came back to the machine. That is
 * honestly "you came back to the machine", not "you came back to the desk" —
 * you might have come back to Slack — and that is fine, arguably better: a
 * being re-emerging while you are elsewhere costs nothing, and the payoff
 * lands the next time you glance at the wallpaper, which is when it is
 * supposed to land.
 *
 * THE GATE: `isInitial` transitions must never count. They fire on every
 * enterWallpaper, every peek-off and at startup; without the gate any mode
 * toggle snaps every away being back and the 30-minute ceiling becomes
 * decorative.
 */

import type { ThrottleState } from '../api/electron';

/**
 * Should this throttle transition count as the user returning?
 *
 * True only for a genuine wake: a non-initial transition INTO 'full' from
 * some other state. Re-emitting 'full' while already 'full' is not a wake.
 */
export function shouldFireAttention(
  prev: ThrottleState,
  next: ThrottleState,
  isInitial: boolean,
): boolean {
  if (isInitial) return false;
  return next === 'full' && prev !== 'full';
}

/**
 * Ticker settings for a throttle state — the PixiApp.ts:628-650 ladder,
 * expressed as data so it can be asserted without a PIXI Application.
 *
 * 'full'          -> uncapped (maxFPS 0 means "no cap" in PIXI)
 * 'throttled-1hz' -> one step per second; the world still lives, cheaply
 * 'paused'/'sleeping' -> stopped. Nothing is destroyed, so the cohort, the
 *                    marks and the wear survive; the loop just stops.
 */
export function tickerFor(state: ThrottleState): { started: boolean; maxFPS: number } {
  if (state === 'paused' || state === 'sleeping') return { started: false, maxFPS: 0 };
  return { started: true, maxFPS: state === 'throttled-1hz' ? 1 : 0 };
}
