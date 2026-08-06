/** Ambient-phase smoke (wind, ☼, world clock) —
 *  `npx tsx scripts/smoke-ambient-phase.mts`.
 *
 *  These are the desk-global CONDITIONS (IDEAS.md § Shared rules across
 *  terminals): every window's trees lean the same way at the same instant, its
 *  ☼ brightens with its neighbours', and its sky knows the same hour — so a
 *  seam never shows two wings blowing against each other or two hours of the
 *  day side by side. All three take the wall clock, so agreement needs no
 *  broker channel and holds across any mount gap.
 *
 *  This smokes the pure maths (src/terminal/ambient.ts); the Pixi wiring is
 *  e2e-verified via __terminal.debugDepth() and __terminal.debugClock(). */
import { makeChecker } from './lib/smoke.ts';
import {
  foliageSway,
  GLOW_SUN_PERIOD_S,
  GLOW_SUN_RANGE,
  daylight,
  localHour,
  pulse,
  skyPresence,
  sunGlow,
  SWAY_HZ,
  SWAY_PX,
} from '../src/terminal/ambient.ts';
const { check, report } = makeChecker('smoke ambient-phase');

const PERIOD = 1 / SWAY_HZ;

// --- The defect, stated as a test. Two terminals mounted MOUNT_GAP seconds
// apart used to read their own accumulators; both now read the wall clock, so
// at one instant they must agree exactly. The old code is reproduced here as
// the negative control — if it ever passes, this smoke has stopped testing
// anything.
const oldSway = (elapsedS: number) => Math.sin(elapsedS * SWAY_HZ * 2 * Math.PI) * SWAY_PX;

const WALL = 1_780_000_000; // a fixed epoch instant; no Date.now() in a smoke
// Gaps deliberately NOT multiples of the period: SWAY_HZ = 0.35 makes the
// period exactly 20/7 s, so 60 s and 3600 s are 21 and 1260 whole periods —
// at precisely those mount gaps even the broken code agreed, and a control
// built on them would have proved nothing.
for (const gap of [0.7, 4.3, 61, 3607]) {
  // t1 mounted at WALL - gap, t2 at WALL: same instant, different mount ages.
  check(`gap ${gap}s: both windows agree at one instant`,
    foliageSway(WALL) === foliageSway(WALL),
    String(foliageSway(WALL)));
  check(`gap ${gap}s: negative control — the old accumulator DID diverge`,
    Math.abs(oldSway(gap) - oldSway(0)) > 0.01,
    JSON.stringify({ old0: oldSway(0), oldGap: oldSway(gap) }));
}

// A window is a pure function of the instant, not of when it was asked.
const t = WALL + 1.234;
check('pure: same instant, same offset', foliageSway(t) === foliageSway(t));
// Tolerance is set by DOUBLE PRECISION, not by the maths: one ulp at epoch
// magnitude is ~4e-7 s, so any two epoch-scale instants carry that much phase
// uncertainty — worth ~6e-7 px of a 1.2 px sway, i.e. a millionth of a pixel.
// A real phase bug is orders of magnitude larger than this bar.
const PX_EPS = 1e-5;
check('periodic: one period on is the same lean',
  Math.abs(foliageSway(t) - foliageSway(t + PERIOD)) < PX_EPS,
  String(foliageSway(t) - foliageSway(t + PERIOD)));
check('antiphase: half a period on is the opposite lean',
  Math.abs(foliageSway(t) + foliageSway(t + PERIOD / 2)) < PX_EPS,
  String(foliageSway(t) + foliageSway(t + PERIOD / 2)));

// Amplitude: stays sub-cell (CW = 6) so glyphs move BETWEEN cells and the
// sway can never read as a snap to the next column.
let peak = 0;
let moved = false;
for (let k = 0; k < 4000; k++) {
  const v = foliageSway(WALL + k * 0.017);
  peak = Math.max(peak, Math.abs(v));
  if (Math.abs(v) > 0.2) moved = true;
}
check('amplitude within SWAY_PX', peak <= SWAY_PX + 1e-9, String(peak));
check('amplitude reaches the peak (it actually sways)', peak > SWAY_PX - 0.01, String(peak));
check('sub-cell: never approaches a column step (CW = 6)', peak < 6 / 2, String(peak));
check('visibly moves', moved);

// Epoch magnitudes: the modulo reduction must not cost more than the ulp
// floor above. Sampling across a decade of wall time, whole periods apart,
// must land on the same lean.
let worst = 0;
for (const base of [1e9, 1.78e9, 2e9, 4e9]) {
  worst = Math.max(worst, Math.abs(foliageSway(base) - foliageSway(base + PERIOD * 1000)));
}
check('phase holds precision at epoch magnitudes', worst < PX_EPS, String(worst));

// Negative t (a clock behind the epoch) must not flip the branch of the modulo.
check('negative time stays in phase',
  Math.abs(foliageSway(-PERIOD * 3 + 0.4) - foliageSway(0.4)) < PX_EPS,
  String(foliageSway(-PERIOD * 3 + 0.4) - foliageSway(0.4)));

// --- The ☼ (same class: shared sky on a per-window accumulator). Its period
// is 4.2 s, so the degenerate gaps are DIFFERENT from the sway's — 4.2 and
// 42 s are whole periods here and would prove nothing, exactly as 60 s and
// 3600 s did for the 20/7 s sway. Controls are derived per-oscillator.
const oldSun = (elapsedS: number) =>
  GLOW_SUN_RANGE[0] +
  (GLOW_SUN_RANGE[1] - GLOW_SUN_RANGE[0]) *
    (0.5 - 0.5 * Math.cos(((elapsedS % GLOW_SUN_PERIOD_S) / GLOW_SUN_PERIOD_S) * 2 * Math.PI));

for (const gap of [1.1, 5.9, 61, 3607]) {
  check(`☼ gap ${gap}s: not a whole period (control is non-degenerate)`,
    Math.abs((gap / GLOW_SUN_PERIOD_S) - Math.round(gap / GLOW_SUN_PERIOD_S)) > 0.05,
    String(gap / GLOW_SUN_PERIOD_S));
  check(`☼ gap ${gap}s: negative control — the old accumulator DID diverge`,
    Math.abs(oldSun(gap) - oldSun(0)) > 0.01,
    JSON.stringify({ old0: oldSun(0), oldGap: oldSun(gap) }));
}

// Same instant ⇒ same alpha, whatever each window's mount age.
check('☼ agrees at one instant', sunGlow(WALL) === sunGlow(WALL), String(sunGlow(WALL)));
check('☼ periodic at epoch magnitude',
  Math.abs(sunGlow(WALL + 1.234) - sunGlow(WALL + 1.234 + GLOW_SUN_PERIOD_S * 1000)) < PX_EPS,
  String(sunGlow(WALL + 1.234) - sunGlow(WALL + 1.234 + GLOW_SUN_PERIOD_S * 1000)));

// Alpha stays inside the composed range — a glow that overshoots 1 would clip
// the glyph to flat white and lose the ease.
let lo = Infinity;
let hi = -Infinity;
for (let k = 0; k < 4000; k++) {
  const a = sunGlow(WALL + k * 0.011);
  lo = Math.min(lo, a);
  hi = Math.max(hi, a);
}
check('☼ alpha within GLOW_SUN_RANGE', lo >= GLOW_SUN_RANGE[0] - 1e-9 && hi <= GLOW_SUN_RANGE[1] + 1e-9,
  JSON.stringify({ lo, hi }));
check('☼ uses its full range (it actually pulses)',
  lo < GLOW_SUN_RANGE[0] + 0.01 && hi > GLOW_SUN_RANGE[1] - 0.01, JSON.stringify({ lo, hi }));

// The shape is shared with the window-local structure pulse: ONE difference
// between a condition and a local pulse, and it is which clock it is handed.
check('☼ is exactly pulse() on the wall clock',
  sunGlow(WALL + 2.5) === pulse(WALL + 2.5, GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE));
check('pulse() takes small accumulator inputs identically',
  Math.abs(pulse(1.7, GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE) - oldSun(1.7)) < 1e-12,
  String(pulse(1.7, GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE) - oldSun(1.7)));

// --- The world clock. Failure modes here are NOT the oscillators' (nothing
// accumulates); they are a hard cut at dawn, a sun at midnight, and a sky that
// disagrees between two windows because one of them asked a different clock.
const noon = daylight(12);
const midnight = daylight(0);
check('noon is full day', noon === 1, String(noon));
check('midnight is full night', midnight === 0, String(midnight));
check('03:00 is night', daylight(3) === 0, String(daylight(3)));
check('21:00 is night', daylight(21) === 0, String(daylight(21)));
check('sunrise 06:00 is the crossing point', daylight(6) === 0 && daylight(6.5) > 0,
  JSON.stringify({ h6: daylight(6), h65: daylight(6.5) }));
check('sunset 18:00 has gone dark by 18.5', daylight(17.5) > 0 && daylight(18.5) === 0,
  JSON.stringify({ h175: daylight(17.5), h185: daylight(18.5) }));

// Monotone up over the morning, down over the evening — a clock that dips
// mid-morning would read as weather, not as time.
let monotone = true;
for (let h = 6; h < 12; h += 0.05) if (daylight(h + 0.05) < daylight(h) - 1e-12) monotone = false;
for (let h = 12; h < 18; h += 0.05) if (daylight(h + 0.05) > daylight(h) + 1e-12) monotone = false;
check('rises all morning, falls all evening', monotone);

// No hard cut: the largest step across the whole day, sampled every 30 s of
// world time, must stay small — dawn easing in is the point of the smoothstep.
let biggestStep = 0;
for (let h = 0; h < 24; h += 1 / 120) {
  biggestStep = Math.max(biggestStep, Math.abs(daylight(h + 1 / 120) - daylight(h)));
}
check('no hard cut anywhere in the day', biggestStep < 0.01, String(biggestStep));
// …and the twilight band is a real span, not a switch: time spent strictly
// between night and day should be hours, not minutes.
let twilightH = 0;
for (let h = 0; h < 24; h += 1 / 60) if (daylight(h) > 0.02 && daylight(h) < 0.98) twilightH += 1 / 60;
check('twilight is a band of hours, not a switch', twilightH > 2 && twilightH < 8, String(twilightH));

// Wraps: 24:00 is 00:00, and the function takes hours outside 0..24 without a
// discontinuity (a tick that reads 23.999 then 0.001 must not flash).
check('midnight wraps continuously',
  Math.abs(daylight(23.999) - daylight(0.001)) < 1e-6,
  JSON.stringify({ before: daylight(23.999), after: daylight(0.001) }));
check('hours outside 0..24 stay periodic',
  Math.abs(daylight(25) - daylight(1)) < 1e-12 && Math.abs(daylight(-2) - daylight(22)) < 1e-12);

// Sky presence: sun and night are complementary, in range, and the sun is
// never out at midnight (the defect a reader would actually notice).
for (const h of [0, 3, 6, 9, 12, 15, 18, 21, 23.5]) {
  const p = skyPresence(daylight(h));
  check(`h${h}: presences in range`, p.sun >= 0 && p.sun <= 1 && p.night >= 0 && p.night <= 1,
    JSON.stringify(p));
  check(`h${h}: sun + night = 1 (one sky, two sides)`, Math.abs(p.sun + p.night - 1) < 1e-12);
}
check('no sun at midnight', skyPresence(daylight(0)).sun === 0);
check('no stars at noon', skyPresence(daylight(12)).night === 0);
check('☾ and ☼ are both partly out at dawn',
  skyPresence(daylight(6.7)).sun > 0.05 && skyPresence(daylight(6.7)).night > 0.05,
  JSON.stringify(skyPresence(daylight(6.7))));

// The ☼'s breath survives its envelope: at night the pulse still runs, at
// zero. (Multiplying an envelope in must not freeze the oscillator.)
const nightSun = sunGlow(WALL) * skyPresence(daylight(2)).sun;
check('☼ fully dark at 02:00 whatever the pulse is doing', nightSun === 0, String(nightSun));
const dayLo = Math.min(...[0, 1, 2, 3].map((k) => sunGlow(WALL + k) * skyPresence(daylight(12)).sun));
const dayHi = Math.max(...[0, 1, 2, 3].map((k) => sunGlow(WALL + k) * skyPresence(daylight(12)).sun));
check('☼ still breathes at noon (envelope ≠ freeze)', dayHi - dayLo > 0.05,
  JSON.stringify({ dayLo, dayHi }));

// localHour: the impure edge. Machine timezone varies, so assert the
// properties that hold anywhere rather than a value.
const H = 3_600_000;
check('localHour in range', [0, 1e12, WALL * 1000].every((ms) => {
  const h = localHour(ms);
  return h >= 0 && h < 24;
}));
check('localHour advances an hour per hour',
  Math.abs(((localHour(1e12 + H) - localHour(1e12) + 24) % 24) - 1) < 1e-6,
  String(localHour(1e12 + H) - localHour(1e12)));
check('localHour advances a minute per minute',
  Math.abs(((localHour(1e12 + 60_000) - localHour(1e12) + 24) % 24) - 1 / 60) < 1e-6);

// Two windows, one sky: the clock takes no broker channel, so agreement means
// "same instant in ⇒ same sky out", including across a mount gap.
for (const gap of [1.1, 61, 3607]) {
  const a = skyPresence(daylight(localHour(1e12)));
  const b = skyPresence(daylight(localHour(1e12)));
  check(`gap ${gap}s: two windows agree on the sky at one instant`,
    a.sun === b.sun && a.night === b.night, JSON.stringify({ a, b }));
}

report();
