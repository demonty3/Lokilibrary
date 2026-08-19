/** Launcher-beat smoke — `npx tsx scripts/smoke-launch-targets.mts`.
 *  The pure half of the beat: which sites are launchable, where their
 *  hotspots are, where the door is, and the two invariants that keep the
 *  world from launching games on its own. The Pixi/pointer wiring is
 *  e2e-verified (`__terminal.debugLaunch` / `debugClick`).
 *  Spec: docs/superpowers/specs/2026-08-06-launcher-beat-design.md. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, type LandGame } from '../src/procedural/land.ts';
import {
  doorColumn,
  hitLaunchTarget,
  launchTargets,
  LAUNCH_HIT_COLS,
  LAUNCH_HIT_ROWS_ABOVE,
  LAUNCH_HIT_ROWS_BELOW,
} from '../src/terminal/launchTargets.ts';
import { pickIntent, resumeIntent, structureColumns } from '../src/terminal/beingIntents.ts';
import { launchNote } from '../src/terminal/marks.ts';
import { mulberry32 } from '../src/procedural/prng.ts';

const { check, report } = makeChecker('smoke launch-targets');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;
const m = composeLand(7, SAMPLE_LAND, T);

// --- Site identity rides the model (the one src/procedural change) ---------
check('every site carries its full game name',
  m.sites.every((s) => typeof s.name === 'string' && s.name.length > 0),
  JSON.stringify(m.sites.map((s) => s.name)));
check('the drawn text is still the truncated name',
  m.sites.every((s) => s.text === s.name.slice(0, 7)));
check('sites carry appids where the game has one',
  m.sites.some((s) => s.appid !== undefined));

// SAMPLE_LAND's `celeste` has no appid — the un-launchable case must survive
// end to end, since a real library will be full of them.
const noAppid: LandGame[] = [
  { name: 'alpha', state: 'loved', appid: 111 },
  { name: 'beta', state: 'mastered' }, // no appid
  { name: 'gamma', state: 'abandoned' }, // no appid, buried
];
const mNo = composeLand(3, noAppid, T);
const tNo = launchTargets(mNo);
check('sites with no appid produce NO hotspot',
  tNo.every((t) => t.appid !== undefined) && tNo.length < mNo.sites.length,
  `${tNo.length} targets / ${mNo.sites.length} sites`);
check('the appid-bearing site still does', tNo.some((t) => t.name === 'alpha'));

// --- Hotspot geometry -----------------------------------------------------
const targets = launchTargets(m);
check('targets are launchable sites only', targets.every((t) => Number.isFinite(t.appid)));
check('at least two launchable sites on the sample land', targets.length >= 2, String(targets.length));

const t0 = targets[0];
check('a click on the site centre hits', hitLaunchTarget(targets, t0.x, t0.y) === t0);
check('a click on the structure above hits',
  hitLaunchTarget(targets, t0.x, t0.y - LAUNCH_HIT_ROWS_ABOVE) === t0);
check('a click one row below hits',
  hitLaunchTarget(targets, t0.x, t0.y + LAUNCH_HIT_ROWS_BELOW) === t0);
check('a click at the column edge of the box hits',
  hitLaunchTarget(targets, t0.x + LAUNCH_HIT_COLS, t0.y) === t0);
check('one column past the box misses',
  hitLaunchTarget(targets, t0.x + LAUNCH_HIT_COLS + 1, t0.y) !== t0);
check('one row above the box misses',
  hitLaunchTarget(targets, t0.x, t0.y - LAUNCH_HIT_ROWS_ABOVE - 1) !== t0);
check('one row below the box misses',
  hitLaunchTarget(targets, t0.x, t0.y + LAUNCH_HIT_ROWS_BELOW + 1) !== t0);
check('empty sky is not a target', hitLaunchTarget(targets, t0.x, 0) === null);
check('a click outside every site is null',
  hitLaunchTarget(targets, -50, t0.y) === null);

// Overlap: two hotspots sharing columns — the nearer centre wins.
const near = [
  { x: 20, y: 10, name: 'left', appid: 1, kind: 'surface' as const },
  { x: 23, y: 10, name: 'right', appid: 2, kind: 'surface' as const },
];
check('overlapping hotspots: nearest centre wins (left)',
  hitLaunchTarget(near, 21, 10)?.name === 'left');
check('overlapping hotspots: nearest centre wins (right)',
  hitLaunchTarget(near, 22, 10)?.name === 'right');
check('an exact tie breaks by model order',
  hitLaunchTarget([...near], 21.5 as unknown as number, 10)?.name === 'left');

// --- The door -------------------------------------------------------------
const doorX = doorColumn(m.role);
check('the sample land has a door', doorX !== null, String(doorX));
if (doorX !== null) {
  check('doorColumn points at an actual door cell',
    m.role.some((row) => row[doorX] === 'door'));
  check('the door is inside the land', doorX > 0 && doorX < m.width - 1);
}
// A land with no `mastered` game has no monument, so no door — the errand's
// documented fallback path (walk to the clicked site instead).
const mNoDoor = composeLand(5, [
  { name: 'alpha', state: 'loved', appid: 111 },
  { name: 'beta', state: 'recent', appid: 222 },
], T);
check('a land with no monument has no door', doorColumn(mNoDoor.role) === null);
check('…and still has launchable sites', launchTargets(mNoDoor).length > 0);

// --- The invariant: the world never launches a game on its own -------------
// `errand` is in the BeingIntent union but must be unreachable from both
// engine paths. This is the assertion that keeps the beat user-driven.
const prng = mulberry32(1234);
const rand = (): number => prng.next();
const ctx = {
  width: m.width,
  x: 40,
  structureCols: structureColumns(m.role),
  edges: { left: true, right: true },
  neighbourNear: { left: 2, right: 1 },
};
let sawErrand = false;
let sawDispatch = false;
for (let i = 0; i < 10000; i++) {
  const k = pickIntent(rand, { ...ctx, x: rand() * m.width }, { approach: 0.2, wander: 0.1 }).kind;
  if (k === 'errand') sawErrand = true;
  if (k === 'dispatch') sawDispatch = true;
}
check('pickIntent NEVER returns errand (10k draws)', !sawErrand);
check('pickIntent NEVER returns dispatch (10k draws)', !sawDispatch);

let sawResumed = false;
let sawResumedDispatch = false;
for (const kind of ['wander', 'rest', 'approach', 'watch_edge', 'errand', 'dispatch', 'nonsense']) {
  for (const side of ['left', 'right'] as const) {
    const k = resumeIntent(kind, side, ctx).kind;
    if (k === 'errand') sawResumed = true;
    if (k === 'dispatch') sawResumedDispatch = true;
  }
}
check('resumeIntent NEVER decays to errand — including from a carried "errand"',
  !sawResumed);
check('resumeIntent NEVER decays to dispatch — including from a carried "dispatch"',
  !sawResumedDispatch);

// --- Launch vocab ---------------------------------------------------------
const vprng = mulberry32(9);
const vr = (): number => vprng.next();
for (const id of ['loki', 'archivist', 'cat', 'visitor', 'ghost']) {
  const note = launchNote(id, 'stardew', vr);
  check(`${id}: launch note names the game`, note.includes('stardew'), note);
  check(`${id}: no unfilled slot`, !note.includes('{game}'));
}
check('an unknown id falls back rather than throwing',
  launchNote('nobody', 'hades', () => mulberry32(2).next()).includes('hades'));

report();
