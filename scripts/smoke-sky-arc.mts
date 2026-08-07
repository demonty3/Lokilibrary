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
/** The options terminalLand ACTUALLY composes with (terminalLand.ts:438) at a
 *  640x520 window, WORLD_SCALE 2, Cozette 6x13. The first live run used
 *  `{width, height}` instead and reproduced neither of the two defects the
 *  screen found — a smoke that composes a different world from the product is
 *  testing a world nobody ships. */
const DESK = { width: 53, skyH: 12, surfaceBand: 5, underH: 7, withPlayer: false, mural: true } as const;
const SEEDS = [1, 7, 41, 113, 1234, 20260807];

for (const seed of SEEDS) {
  const m = composeLand(seed, GAMES, DESK);
  const sun = extractArc(m, 'sun');
  const moon = extractArc(m, 'moon');
  const tag = `seed ${seed}`;

  // Every land composes a ☼. A ☾ is optional in practice — at real desk
  // options the mural clears its rect last and can evict the moon outright,
  // which is the `extractArc → null` path the renderer already handles by
  // leaving the layer as composed. Assert the sun, tolerate the moon.
  check(`${tag}: the land composed a ☼`, sun !== null);
  if (!sun) continue;

  // --- Travel. The whole bet is that a body somewhere ELSE reads as the hour,
  // so an arc that barely moves is the feature failing silently.
  const travel = sun.floorY - sun.peakY;
  check(`${tag}: the ☼ travels at least 5 rows`, travel >= 5, `${travel}`);
  check(`${tag}: the ☼ peaks at its composed row`, arcY(sun, 1) === sun.peakY, `${arcY(sun, 1)}`);
  check(`${tag}: the ☼ bottoms at the floor`, arcY(sun, 0) === sun.floorY, `${arcY(sun, 0)}`);
  if (moon) check(`${tag}: the ☾ counter-arcs (high when the ☼ is low)`,
    arcY(moon, 1 - 1) === moon.floorY && arcY(moon, 1 - 0) === moon.peakY);

  // --- Clearance. Beings stand at `surface - 1`; a body must never contend
  // for that cell. Measured in the body's OWN column — the first cut used the
  // land's global high point, so a single tall hill anywhere collapsed the arc
  // to zero travel, which is what the live desk showed and no seed here did.
  const beingRow = m.surface[sun.col] - 1;
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

  // --- Visibility. The bar the first cut did NOT have, and the screen did:
  // the composer stamps the ☼ into the grid, so its own cell landed in its own
  // blocked set and it sat at alpha 0 at every hour with every other bar green.
  // An occlusion rule that hides the thing it is protecting is not a rule.
  check(`${tag}: the ☼ is DRAWN at its peak`, arcAlpha(sun, arcY(sun, 1)) > 0,
    `${arcAlpha(sun, arcY(sun, 1))}`);
  if (moon) check(`${tag}: the ☾ is DRAWN at its peak`, arcAlpha(moon, arcY(moon, 1)) > 0,
    `${arcAlpha(moon, arcY(moon, 1))}`);
  // Visible where it is LIT. "Fraction of travel" was the wrong measure — the
  // bottom of the arc is dawn and dusk, where `sky.sun` fades the body out
  // anyway, so hidden rows down there cost nothing. What must hold is that the
  // ☼ can be seen through the part of the day it is actually shining.
  const litHidden = Array.from({ length: 51 }, (_, i) => 0.5 + i / 100)
    .filter((d) => arcAlpha(sun, arcY(sun, d)) === 0);
  check(`${tag}: the ☼ is never hidden while the day is half-lit or brighter`,
    litHidden.length === 0, `${litHidden.length} of 51 daylight steps`);

  // --- Occlusion: the world always wins.
  check(`${tag}: a body over composed content is fully hidden`,
    sun.blocked.length === 0 || arcAlpha(sun, sun.blocked[0][0]) === 0);
  check(`${tag}: a body clear of everything is fully drawn`,
    arcAlpha({ ...sun, blocked: [] }, 3) === 1);
  // Adjacent is already fully hidden (a body touching the mural IS occluded);
  // the skirt lives one row further out, so approaching reads as a fade.
  check(`${tag}: a body INSIDE composed content is gone`,
    arcAlpha({ ...sun, blocked: [[10, 12]] }, 10) === 0);
  check(`${tag}: a body abutting composed content is half-lit, not gone`,
    arcAlpha({ ...sun, blocked: [[10, 12]] }, 9) === 0.5,
    `${arcAlpha({ ...sun, blocked: [[10, 12]] }, 9)}`);
  check(`${tag}: one clear row is fully drawn`,
    arcAlpha({ ...sun, blocked: [[10, 12]] }, 8) === 1,
    `${arcAlpha({ ...sun, blocked: [[10, 12]] }, 8)}`);
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
    // ...except the body's OWN cell, which must be passable or it occludes itself.
    if (!SKY_REGISTER.has(role) && role !== 'sun' && !covered(y)) solidUnblocked++;
  }
  check(`${tag}: sky decoration never blocks the arc`, decorBlocked === 0, `${decorBlocked} rows`);
  check(`${tag}: every solid row in the column does block it`, solidUnblocked === 0, `${solidUnblocked} rows`);

  // --- The arc rides the SAME clock as presence, so a joined neighbour agrees
  // without a broker: both are pure functions of the hour.
  check(`${tag}: two windows at one instant place the ☼ identically`,
    arcY(sun, skyNow(null, 14.25).day) === arcY(sun, skyNow(null, 14.25).day));
  check(`${tag}: noon is the ☼'s peak`, arcY(sun, daylight(12)) === sun.peakY);
  check(`${tag}: midnight is the ☼'s floor`, arcY(sun, daylight(0)) === sun.floorY);
  if (moon) check(`${tag}: noon is the ☾'s floor, midnight its peak`,
    arcY(moon, 1 - daylight(12)) === moon.floorY && arcY(moon, 1 - daylight(0)) === moon.peakY);
}

// --- A body the composer never placed (or the mural ate) is RE-PLACED into
// clear sky rather than lost: that is the whole point of the fix, and the
// contract changed here deliberately — 42% of lands at desk options have no
// composed ☼ at all. Suppressing a body is the PACK's job (landOmit, checked
// in terminalLand.buildBodies), never the geometry's.
const blank = composeLand(7, GAMES, DESK);
for (let y = 0; y < blank.height; y++)
  for (let x = 0; x < blank.width; x++)
    if (blank.role[y][x] === 'sun' || blank.role[y][x] === 'moon') (blank.role[y] as string[])[x] = 'sky';
const reSun = extractArc(blank, 'sun');
check('an evicted ☼ is re-placed, not lost', reSun !== null);
check('the re-placed ☼ lands in clear sky', reSun !== null && arcAlpha(reSun, arcY(reSun, 1)) > 0,
  `${reSun ? arcAlpha(reSun, arcY(reSun, 1)) : 'null'}`);
check('the re-placed ☼ still travels', reSun !== null && reSun.floorY - reSun.peakY >= 5,
  `${reSun ? reSun.floorY - reSun.peakY : 'null'}`);

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
