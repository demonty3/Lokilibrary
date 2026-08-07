/** Sky-arc smoke (hour without colour) — `npx tsx scripts/smoke-sky-arc.mts`.
 *
 *  The rung that released the world clock, after giving the sky a COLOUR was
 *  killed at calibration: beings are drawn at `surface - 1`, a sky cell, so the
 *  sky is the contrast denominator for nearly everything and the corpus clears
 *  the frozen 3.0 being floor by only 8%. Position and alpha spend none of it.
 *
 *  Thresholds here are ABSOLUTE numbers, never expressions in the constants
 *  they guard — a bar written as `>= ARC_CLEARANCE * k` moves with the mutant
 *  and stays green (the BREATH_PX lesson, brain:
 *  a-bar-written-in-terms-of-what-it-guards-is-not-a-bar).
 *
 *  The Pixi wiring is e2e-verified via __terminal.debugSky(); this is the maths. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, type LandGame } from '../src/procedural/land.ts';
import { arcAlpha, arcY, extractArc, ARC_CLEARANCE } from '../src/terminal/skyArc.ts';
import { daylight, skyNow } from '../src/terminal/ambient.ts';

const { check, report } = makeChecker('smoke sky-arc');

const GAMES: LandGame[] = [
  { name: 'hades', state: 'mastered', appid: 1145360 },
  { name: 'celeste', state: 'loved' },
  { name: 'stardew', state: 'recent', appid: 413150 },
  { name: 'civ', state: 'dusty', appid: 289070 },
];
/** Real desk geometry: a 640x520 window at WORLD_SCALE 2 with Cozette 6x13. */
const DESK = { width: 53, height: 20 } as const;
const SEEDS = [1, 7, 41, 1234];

for (const seed of SEEDS) {
  const m = composeLand(seed, GAMES, DESK);
  const sun = extractArc(m, 'sun');
  const moon = extractArc(m, 'moon');
  const tag = `seed ${seed}`;

  check(`${tag}: the land composed a ☼ and a ☾`, sun !== null && moon !== null);
  if (!sun || !moon) continue;

  // --- Travel. The whole bet is that a body somewhere ELSE reads as the hour,
  // so an arc that barely moves is the feature failing silently.
  const travel = sun.floorY - sun.peakY;
  check(`${tag}: the ☼ travels at least 5 rows`, travel >= 5, `${travel}`);
  check(`${tag}: the ☼ peaks at its composed row`, arcY(sun, 1) === sun.peakY, `${arcY(sun, 1)}`);
  check(`${tag}: the ☼ bottoms at the floor`, arcY(sun, 0) === sun.floorY, `${arcY(sun, 0)}`);
  check(`${tag}: the ☾ counter-arcs (high when the ☼ is low)`,
    arcY(moon, 1 - 1) === moon.floorY && arcY(moon, 1 - 0) === moon.peakY);

  // --- Clearance. Beings stand at `surface - 1`; a body must never contend
  // for that cell. Absolute row arithmetic, not a restatement of the constant.
  const beingRow = Math.min(...m.surface) - 1;
  check(`${tag}: the arc floor stays 2+ rows above the being row`,
    beingRow - sun.floorY >= 2, `being ${beingRow}, floor ${sun.floorY}`);
  check(`${tag}: no drawn row ever reaches the being row`,
    Array.from({ length: 101 }, (_, i) => arcY(sun, i / 100)).every((y) => y + 1 <= beingRow),
    `max ${arcY(sun, 0)}`);

  // --- Monotone and sub-cell. A stepped climb reads as a glyph on rails.
  const ys = Array.from({ length: 101 }, (_, i) => arcY(sun, i / 100));
  check(`${tag}: the ☼ rises monotonically with daylight`,
    ys.every((y, i) => i === 0 || y <= ys[i - 1] + 1e-12));
  check(`${tag}: the climb is sub-cell (fractional rows exist)`,
    ys.some((y) => Math.abs(y - Math.round(y)) > 0.01));
  const biggestStep = Math.max(...ys.slice(1).map((y, i) => Math.abs(y - ys[i])));
  check(`${tag}: no jump larger than 0.2 rows per 1% of daylight`, biggestStep < 0.2, `${biggestStep}`);

  // --- Occlusion: the world always wins.
  check(`${tag}: a body over composed content is fully hidden`,
    sun.blocked.length === 0 || arcAlpha(sun, sun.blocked[0][0]) === 0);
  check(`${tag}: a body clear of everything is fully drawn`,
    arcAlpha({ ...sun, blocked: [] }, 3) === 1);
  // Adjacent is already fully hidden (a body touching the mural IS occluded);
  // the skirt lives one row further out, so approaching reads as a fade.
  check(`${tag}: a body abutting composed content is hidden`,
    arcAlpha({ ...sun, blocked: [[10, 12]] }, 9) === 0);
  check(`${tag}: the fade is a skirt, never a pop`,
    arcAlpha({ ...sun, blocked: [[10, 12]] }, 8) === 0.5,
    `${arcAlpha({ ...sun, blocked: [[10, 12]] }, 8)}`);
  check(`${tag}: two rows clear is fully drawn`,
    arcAlpha({ ...sun, blocked: [[10, 12]] }, 7) === 1,
    `${arcAlpha({ ...sun, blocked: [[10, 12]] }, 7)}`);
  check(`${tag}: alpha never leaves [0,1]`,
    Array.from({ length: 101 }, (_, i) => arcAlpha(sun, arcY(sun, i / 100)))
      .every((a) => a >= 0 && a <= 1));

  // A body passes IN FRONT of sky decoration — a ☼ behind a star is not an
  // occlusion, and treating it as one makes the arc flicker its way down a
  // scattered sky. Found by a mutant that narrowed PASSABLE and stayed green:
  // every other occlusion bar used a synthetic `blocked`, so nothing checked
  // what the model actually puts in it.
  const SKY_REGISTER = new Set(['sky', 'skyDither', 'star', 'starBright', 'cloud']);
  const covered = (y: number): boolean => sun.blocked.some(([s, e]) => y >= s && y < e);
  let decorBlocked = 0;
  let solidUnblocked = 0;
  for (let y = 0; y < m.height; y++) {
    const role = m.role[y][sun.col];
    if (SKY_REGISTER.has(role) && covered(y)) decorBlocked++;
    if (!SKY_REGISTER.has(role) && !covered(y)) solidUnblocked++;
  }
  check(`${tag}: sky decoration never blocks the arc`, decorBlocked === 0, `${decorBlocked} rows`);
  check(`${tag}: every solid row in the column does block it`, solidUnblocked === 0, `${solidUnblocked} rows`);

  // --- The arc rides the SAME clock as presence, so a joined neighbour agrees
  // without a broker: both are pure functions of the hour.
  check(`${tag}: two windows at one instant place the ☼ identically`,
    arcY(sun, skyNow(null, 14.25).day) === arcY(sun, skyNow(null, 14.25).day));
  check(`${tag}: noon is the ☼'s peak and the ☾'s floor`,
    arcY(sun, daylight(12)) === sun.peakY && arcY(moon, 1 - daylight(12)) === moon.floorY);
  check(`${tag}: midnight is the ☾'s peak and the ☼'s floor`,
    arcY(moon, 1 - daylight(0)) === moon.peakY && arcY(sun, daylight(0)) === sun.floorY);
}

// --- A pack that deleted its sky has no arc to run, and that must be a clean
// null rather than a crash or a body pinned at row 0 (gameboy-dmg's blank LCD).
const blank = composeLand(7, GAMES, DESK);
for (let y = 0; y < blank.height; y++)
  for (let x = 0; x < blank.width; x++)
    if (blank.role[y][x] === 'sun' || blank.role[y][x] === 'moon') blank.role[y][x] = 'sky';
check('a sky with no bodies yields no arc', extractArc(blank, 'sun') === null && extractArc(blank, 'moon') === null);

// --- The lamp split: the ground light is its own role, so it can run opposite
// the sky body it used to share one with.
const lit = composeLand(1, GAMES, DESK);
let lampCells = 0;
let skySunCells = 0;
const surf = Math.min(...lit.surface);
for (let y = 0; y < lit.height; y++)
  for (let x = 0; x < lit.width; x++) {
    if (lit.role[y][x] === 'lamp') lampCells++;
    if (lit.role[y][x] === 'sun') { skySunCells++; check('every ☼ cell is in the sky band', y < surf, `y ${y}`); }
  }
check('the shelf lamp has its own role', lampCells >= 1, `${lampCells}`);
check('the sky keeps exactly one ☼', skySunCells === 1, `${skySunCells}`);
check('ARC_CLEARANCE is 2 rows', ARC_CLEARANCE === 2, `${ARC_CLEARANCE}`);

report();
