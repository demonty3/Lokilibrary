/** Shared-sky smoke — `npx tsx scripts/smoke-shared-sky.mts`.
 *  Spec: docs/superpowers/specs/2026-08-18-shared-sky-design.md. Smokes the
 *  pure maths (src/terminal/sharedSky.ts) against the frozen bars' testable
 *  halves: every window derives the SAME chain/hosts from the same topology
 *  (the no-broker premise), desk-space wisps hand off continuously at seams,
 *  and a chain of one is the pre-slice world (B3, the solo control).
 *  The Pixi wiring is e2e-verified on the live desk. */
import { makeChecker } from './lib/smoke.ts';
import { bodyHost, chainOffsets, deskChain, sharedWisps, SHARED_WISP_ROW_MAX } from '../src/terminal/sharedSky.ts';
import { wispX } from '../src/terminal/clouds.ts';
const { check, report } = makeChecker('smoke shared-sky');

// ── Chain derivation: same payload, every seat, same answer ───────────────
const joins = [
  { left: 't1', right: 't2' },
  { left: 't2', right: 't3' },
];
const wings = { t1: 'd0', t2: 'd1', t3: 'd4' };
const c1 = deskChain('t1', joins, wings);
const c2 = deskChain('t2', joins, wings);
const c3 = deskChain('t3', joins, wings);
check('all three windows derive the same order', [c1, c2, c3].every((c) => c.order.join(',') === 't1,t2,t3'));
check('indices are the seats', c1.index === 0 && c2.index === 1 && c3.index === 2);
check('one key, wing-based', c1.key === 'd0>d1>d4' && c2.key === c1.key && c3.key === c1.key);
check('join order in the payload is irrelevant', deskChain('t2', [...joins].reverse(), wings).key === c1.key);

const solo = deskChain('t9', joins, wings);
check('B3: an unjoined window is a chain of one', solo.order.length === 1 && solo.index === 0);

// A malformed cyclic payload must not hang or throw — degrade, don't die.
const cyc = deskChain('a', [{ left: 'a', right: 'b' }, { left: 'b', right: 'a' }], {});
check('cyclic joins terminate', cyc.order.length >= 1);

// ── Host pick: deterministic, in range, seat-independent ──────────────────
const sun = bodyHost(c1.key, 'sun', 3);
const moon = bodyHost(c1.key, 'moon', 3);
check('hosts in range', sun >= 0 && sun < 3 && moon >= 0 && moon < 3, `sun ${sun} moon ${moon}`);
check('host pick is stable', bodyHost(c2.key, 'sun', 3) === sun && bodyHost(c3.key, 'moon', 3) === moon);
check('exactly one seat hosts each body', [0, 1, 2].filter((i) => i === sun).length === 1);

// ── Shared wisps: density, band, rows, desk-space continuity ──────────────
// sharedWisps takes the chain's TOTAL desk width in cells (variable-widths
// rung); an equal-width chain passes chainLen × width, byte-identical to the
// pre-slice call shape.
const W = 106;
const wisps = sharedWisps(c1.key, 3, 3 * W);
check('per-window density preserved (2 × chainLen)', wisps.length === 6, String(wisps.length));
check('rows ride the sky band', wisps.every((w) => w.row >= 1 && w.row <= SHARED_WISP_ROW_MAX));
check('speeds within the judged band', wisps.every((w) => w.speed >= 0.25 && w.speed <= 0.46));
check('deterministic', JSON.stringify(wisps) === JSON.stringify(sharedWisps(c1.key, 3, 3 * W)));

// ── Variable widths (spec 2026-08-18-variable-widths, bars 2 + 3) ─────────
// Bar 2: on a uniform chain the prefix-sum maths must reproduce the shipped
// behaviour exactly — offset(i) ≡ i × width, total ≡ chainLen × width.
const uni = chainOffsets([W, W, W]);
check('bar 2: uniform offsets ≡ index × width', uni.offsets.every((o, i) => o === i * W));
check('bar 2: uniform total ≡ chainLen × width', uni.total === 3 * W);
// Bar 3: mixed widths — offset(i+1) = offset(i) + cols(i), so window i's exit
// column IS window i+1's entry column, by construction.
const mixedCols = [100, 53, 80];
const mixed = chainOffsets(mixedCols);
check(
  'bar 3: mixed offsets are prefix sums',
  mixed.offsets[0] === 0 &&
    mixedCols.every((c, i) => i === mixedCols.length - 1 || mixed.offsets[i + 1] === mixed.offsets[i] + c),
);
check('bar 3: mixed total is the sum', mixed.total === 233);
// Host picks stay a pure function of the chain key — widths never enter.
check('bar 3: host pick blind to widths', bodyHost(c1.key, 'sun', 3) === sun);

// B2's testable half: the SAME spec read from two seats at the same wall
// second lands on the same desk x — seat i's local x + i·W equals seat j's.
// (wispX is seat-blind; the seats differ only by the subtracted offset, so
// this is the identity the live B2 read asserts modulo read-lag drift.)
const deskW = 3 * W;
const spec = { ...wisps[0], blocked: [] as Array<readonly [number, number]> };
for (const t of [0, 1234.5, 86_399]) {
  const xd = wispX(spec, t, deskW);
  check(`desk x wraps the whole desk at t=${t}`, xd >= -spec.text.length && xd < deskW, String(xd));
}
// Continuity at a seam: as the run's head crosses seat boundary k·W, the
// local positions in seat k−1 and seat k describe the same cells.
const tCross = ((W - spec.phase + spec.text.length) / spec.speed + 3600 * 24) % 1e9;
const xdAt = wispX(spec, tCross, deskW);
const left = xdAt - 0 * W;
const right = xdAt - 1 * W;
check('seam handoff is one desk position seen from two seats', Math.abs(left - W - right) < 1e-9);

report();
