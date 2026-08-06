/**
 * Being-liveliness smoke — `npx tsx scripts/smoke-being-liveliness.mts`.
 * Locks the pure sub-cell animation maths (src/terminal/beingAnim.ts), which
 * replaced the single time-driven bob so that standing reads as breathing,
 * walking reads as stepping, and a 6-18 s rest is loitering rather than dead
 * time. Spec: docs/superpowers/specs/2026-08-06-being-liveliness-design.md.
 *
 * The invariants, and the mutant each one exists to catch (every one was run
 * red before this smoke was trusted — the regression-test-must-fail-on-
 * prefix-code discipline):
 *   - gait rides DISTANCE, not time     ← a fixed per-call or elapsedS step
 *   - dt <= 0 is a no-op (throttle-safe) ← dropping the dtS <= 0 guard (only
 *                                         the negative-dt leg catches it; at
 *                                         dt = 0 the ramp maths is inert
 *                                         anyway, so that leg is belt-and-
 *                                         braces, not the catcher)
 *   - lean converges, excursion < CW/2  ← a sign flip; IDLE_BEAT_PX at 2.5
 *   - standing alive, walking a gait    ← BREATH_PX = 0; plain sin (dips below
 *                                         the ground line)
 *   - beats only while stationary       ← removing the moved === 0 gate
 *   - determinism from the seed         ← seeding from Date.now()
 *
 * The idle-beat scheduler lives in the terminalLand.ts being loop (it needs
 * that loop's rng + elapsedS clock), so this smoke reimplements it in eight
 * lines below and asserts the CONTRACT — cadence bounds, the stationary gate,
 * per-being jitter. The loop's copy is verified live via debugBeings().
 */
import { makeChecker } from './lib/smoke.ts';
import { COZETTE_CELL_WIDTH as CW } from '../src/render/fonts.ts';
import {
  beatOffset,
  bobOffset,
  BREATH_PX,
  GAIT_CYCLES_PER_CELL,
  GAIT_PX,
  IDLE_BEAT_DUR,
  IDLE_BEAT_PX,
  IDLE_BEAT_S,
  IDLE_TURN_CHANCE,
  LEAN_PX,
  LEAN_S,
  MAX_SUBCELL_PX,
  MOVE_BLEND_S,
  stepGait,
  stepLean,
  stepMoving,
  type BeingAnim,
} from '../src/terminal/beingAnim.ts';

const { check, report } = makeChecker('smoke being-liveliness');

/** Deterministic LCG, the smoke-t1-being-intents posture. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function anim(over: Partial<BeingAnim> = {}): BeingAnim {
  return { face: 1, lean: LEAN_PX, moving: 0, gaitPhase: 0, bobPhase: 0, idleBeat: null, ...over };
}

// 1 · Gait rides DISTANCE, not time. This is the invariant that makes the
//     walk mean locomotion; a time-driven gait would bob a standing being.
let phase = 1.234;
for (let i = 0; i < 100; i++) phase = stepGait(phase, 0);
check('standing accumulates NO gait over 100 calls', phase === 1.234);
check('negative movement accumulates no gait', stepGait(0.5, -1) === 0.5);
// Sub-wrap steps, so the doubling is visible without the modulo folding it.
const oneStep = stepGait(0, 0.1);
const twoSteps = stepGait(stepGait(0, 0.1), 0.1);
check(
  'doubling the distance doubles the phase delta',
  Math.abs(twoSteps - oneStep * 2) < 1e-9,
);
check(
  'a cell of travel advances GAIT_CYCLES_PER_CELL cycles',
  Math.abs(oneStep * 10 - GAIT_CYCLES_PER_CELL * Math.PI * 2) < 1e-9,
);
check('gait phase stays wrapped in [0, TAU)', stepGait(0, 100) < Math.PI * 2);

// 2 · Throttle safety — dt <= 0 freezes every eased channel. elapsedS stops
//     accumulating under the wallpaper throttle; the steppers must agree.
check('stepMoving dt=0 is a no-op', stepMoving(0.4, true, 0) === 0.4);
check('stepMoving negative dt is a no-op', stepMoving(0.4, true, -1) === 0.4);
check('stepLean dt=0 is a no-op', stepLean(0.7, -1, 0) === 0.7);
check('stepLean negative dt is a no-op', stepLean(0.7, -1, -1) === 0.7);
check('full move blend takes MOVE_BLEND_S', stepMoving(0, true, MOVE_BLEND_S) === 1);
check('blend swings back in MOVE_BLEND_S', stepMoving(1, false, MOVE_BLEND_S) === 0);
check('blend clamps at 1', stepMoving(0.9, true, MOVE_BLEND_S) === 1);
check('blend clamps at 0', stepMoving(0.1, false, MOVE_BLEND_S) === 0);

// 3 · Facing: the lean converges on the drawn facing, with the matching sign,
//     and the whole sub-cell budget stays under half a cell so a lean can
//     never be misread as a cell step.
check('lean converges to +LEAN_PX', stepLean(-LEAN_PX, 1, LEAN_S) === LEAN_PX);
check('lean converges to -LEAN_PX', stepLean(LEAN_PX, -1, LEAN_S) === -LEAN_PX);
check('a full turn takes exactly LEAN_S', stepLean(-LEAN_PX, 1, LEAN_S * 0.999) < LEAN_PX);
check('lean never overshoots the target', stepLean(0, 1, LEAN_S * 10) === LEAN_PX);
check('lean sign follows face (right)', stepLean(0, 1, 0.01) > 0);
check('lean sign follows face (left)', stepLean(0, -1, 0.01) < 0);
check(
  'worst-case sub-cell excursion stays under CW/2 (never reads as a cell step)',
  MAX_SUBCELL_PX < CW / 2,
  `${MAX_SUBCELL_PX} vs ${CW / 2}`,
);

// 4 · Standing is alive; walking is a gait that never sinks below the ground.
const standing = anim({ bobPhase: 0.7 });
let lo = Infinity;
let hi = -Infinity;
for (let t = 0; t < 4; t += 1 / 60) {
  const y = bobOffset(standing, t);
  lo = Math.min(lo, y);
  hi = Math.max(hi, y);
}
// An ABSOLUTE px floor, deliberately not a multiple of BREATH_PX: expressing
// the bar in terms of the constant it guards makes BREATH_PX = 0 satisfy it
// vacuously (found by running that mutant). 1.5 local px = 3 screen px at
// WORLD_SCALE 2 — the least motion that reads as breathing rather than frozen.
check(
  'a 4 s idle is never flat (>= 1.5 local px of swing)',
  hi - lo >= 1.5,
  `swing ${(hi - lo).toFixed(3)}`,
);
check('breath is shallower than a full cell', BREATH_PX * 2 < CW);
const walking = anim({ moving: 1 });
let gaitLo = Infinity;
let gaitHi = -Infinity;
for (let i = 0; i < 200; i++) {
  walking.gaitPhase = stepGait(walking.gaitPhase, 0.05);
  const y = bobOffset(walking, i / 60);
  gaitLo = Math.min(gaitLo, y);
  gaitHi = Math.max(gaitHi, y);
}
check(
  'the gait excursion exceeds the breath excursion',
  gaitHi - gaitLo > hi - lo,
  `gait ${(gaitHi - gaitLo).toFixed(3)} vs breath ${(hi - lo).toFixed(3)}`,
);
check(
  'the gait never dips below the ground line (plain sin would)',
  gaitHi <= 1e-9,
  `max ${gaitHi.toFixed(3)}`,
);
check('the gait reaches its full amplitude', Math.abs(gaitLo + GAIT_PX) < 1e-3);
check(
  'a standing being gets no gait offset at moving=0',
  Math.abs(bobOffset(anim({ gaitPhase: Math.PI / 2 }), 0)) < 1e-9,
);

// 5 · Idle beats — the half-sine excursion, and its gates.
const beating = anim({ idleBeat: { startedS: 10, turn: false } });
check('no beat, no offset', beatOffset(anim(), 5) === 0);
check('beat starts at zero', Math.abs(beatOffset(beating, 10)) < 1e-9);
check(
  'beat peaks at IDLE_BEAT_PX mid-way',
  Math.abs(beatOffset(beating, 10 + IDLE_BEAT_DUR / 2) - IDLE_BEAT_PX) < 1e-9,
);
check('beat returns to zero', Math.abs(beatOffset(beating, 10 + IDLE_BEAT_DUR)) < 1e-9);
check('beat clamps past its duration', Math.abs(beatOffset(beating, 999)) < 1e-9);
check(
  'the beat carries the facing',
  beatOffset({ ...beating, face: -1 }, 10 + IDLE_BEAT_DUR / 2) < 0,
);
check(
  'a walking being gets no beat offset',
  beatOffset({ ...beating, moving: 1 }, 10 + IDLE_BEAT_DUR / 2) === 0,
);

// 6 · The scheduler contract: beats fire only while stationary, at a bounded
//     jittered cadence, and two beings do not share a schedule.
interface Sim { beats: number; turns: number; faces: number[] }
function simulate(seed: number, moving: boolean, seconds: number): Sim {
  const rng = lcg(seed);
  const a = anim();
  let nextAt = IDLE_BEAT_S[0] + rng() * IDLE_BEAT_S[1];
  const out: Sim = { beats: 0, turns: 0, faces: [] };
  for (let t = 0; t < seconds; t += 1 / 60) {
    const moved = moving ? 0.02 : 0;
    if (moved === 0 && a.idleBeat === null && t >= nextAt) {
      const turn = rng() < IDLE_TURN_CHANCE;
      if (turn) a.face = a.face === 1 ? -1 : 1;
      a.idleBeat = { startedS: t, turn };
      nextAt = t + IDLE_BEAT_S[0] + rng() * IDLE_BEAT_S[1];
      out.beats++;
      if (turn) out.turns++;
      out.faces.push(a.face);
    } else if (a.idleBeat !== null && t - a.idleBeat.startedS >= IDLE_BEAT_DUR) {
      a.idleBeat = null;
    }
  }
  return out;
}
const idle12 = simulate(12345, false, 12);
check(
  '12 s of standing still yields 2-7 idle beats',
  idle12.beats >= 2 && idle12.beats <= 7,
  `${idle12.beats}`,
);
check('12 s of walking yields no idle beats', simulate(12345, true, 12).beats === 0);
check(
  'a full 18 s rest (ghost window) is punctuated at least 3 times',
  simulate(999, false, 18).beats >= 3,
);
check('some beats carry a turn', idle12.turns > 0);
check('not every beat is a turn', idle12.turns < idle12.beats);
const other = simulate(777, false, 12);
check(
  'two beings do not share a beat schedule',
  JSON.stringify(other.faces) !== JSON.stringify(idle12.faces) || other.beats !== idle12.beats,
);
check(
  'same seed reproduces the beat sequence exactly',
  JSON.stringify(simulate(12345, false, 12)) === JSON.stringify(idle12),
);

// 7 · Determinism of the drawn trace: same inputs, byte-identical offsets.
function trace(seed: number): string {
  const rng = lcg(seed);
  const a = anim({ bobPhase: rng() * Math.PI * 2 });
  const out: number[] = [];
  for (let i = 0; i < 600; i++) {
    const t = i / 60;
    const moved = i % 120 < 60 ? 0.03 : 0;
    a.gaitPhase = stepGait(a.gaitPhase, moved);
    a.moving = stepMoving(a.moving, moved > 0, 1 / 60);
    a.lean = stepLean(a.lean, a.face, 1 / 60);
    out.push(Number((bobOffset(a, t) + beatOffset(a, t)).toFixed(6)));
  }
  return out.join(',');
}
check('the drawn trace is deterministic', trace(42) === trace(42));
check('a different seed gives a different trace', trace(42) !== trace(43));

report();
