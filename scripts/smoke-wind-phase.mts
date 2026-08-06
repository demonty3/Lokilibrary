/** Wind-phase smoke — `npx tsx scripts/smoke-wind-phase.mts`.
 *  Foliage sway is a desk-global CONDITION (IDEAS.md § Shared rules across
 *  terminals): every window's trees lean the same way at the same instant, so
 *  a seam never shows two wings blowing against each other. This smokes the
 *  pure maths (src/terminal/ambient.ts); the Pixi wiring is e2e-verified via
 *  __terminal.debugDepth().foliageX. */
import { makeChecker } from './lib/smoke.ts';
import { foliageSway, SWAY_HZ, SWAY_PX } from '../src/terminal/ambient.ts';
const { check, report } = makeChecker('smoke wind-phase');

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

report();
