/**
 * T0 spike smoke — `npx tsx scripts/smoke-t0-topology.mts`.
 *
 * Pure-Node verification of the snapping-terminals topology math
 * (desktop/src/topology.ts — no electron imports):
 *
 *   SNAP TARGET (computeSnapTarget)
 *     T1  within range right-of → snaps to exact abutment + neighbour's y
 *     T2  within range left-of  → snaps so moved.right === other.left
 *     T3  outside SNAP_PX → null
 *     T4  insufficient vertical overlap → null
 *     T5  nearest of two candidates wins
 *     T6  determinism — same inputs, same answer
 *
 *   JOINS (computeJoins / openSides / neighbourOf)
 *     J1  abutting + aligned → one join (left/right correctly assigned)
 *     J2  1px gap within eps → still joined; > eps → not joined
 *     J3  aligned x but misaligned y (> eps) → not joined
 *     J4  chain A–B–C → two joins, deterministic order
 *     J5  openSides/neighbourOf agree with the join set
 *
 *   UN-SNAP CAPTURE BAND (SNAP_Y_PX — T1 hysteresis slice)
 *     H1  nudged within the band → recaptured (magnetic hold)
 *     H2  vertical drag-out past the band, x aligned → free (THE fix)
 *     H3  the 36px boot ladder still snaps together
 *     H4  band boundary inclusive at exactly SNAP_Y_PX
 */

import { makeChecker } from './lib/smoke.ts';
import {
  computeJoins,
  computeSnapTarget,
  neighbourOf,
  openSides,
  JOIN_EPS_PX,
  SNAP_PX,
  SNAP_Y_PX,
  type TermBounds,
} from '../desktop/src/topology.ts';

const { check, report } = makeChecker('smoke t0-topology');

const W = 900;
const H = 560;
const t = (id: string, x: number, y: number): TermBounds => ({ id, x, y, width: W, height: H });

// ── Snap target ────────────────────────────────────────────────────────────
{
  // T1: t2 hovering just right of t1's right edge
  const t1 = t('t1', 100, 200);
  const t2 = t('t2', 100 + W + SNAP_PX - 4, 230);
  const snap = computeSnapTarget(t2, [t1]);
  check('T1 snaps to abutment', snap !== null && snap.x === 100 + W && snap.y === 200);

  // T2: t2 hovering just left of t1
  const t2L = t('t2', 100 - W - (SNAP_PX - 6), 190);
  const snapL = computeSnapTarget(t2L, [t1]);
  check('T2 snaps left-of', snapL !== null && snapL.x === 100 - W && snapL.y === 200);

  // T3: out of range
  check('T3 out of range → null', computeSnapTarget(t('t2', 100 + W + SNAP_PX + 10, 200), [t1]) === null);

  // T4: vertical overlap below threshold (offset by > half height)
  check(
    'T4 poor overlap → null',
    computeSnapTarget(t('t2', 100 + W + 4, 200 + H * 0.8), [t1]) === null,
  );

  // T5: two candidates — nearest edge wins (t3 is closer)
  const t3 = t('t3', 100 + W + 8 + W + 20, 200); // its LEFT edge ~28px right of moved.right
  const moved = t('t2', 100 + W + 8, 205);
  const best = computeSnapTarget(moved, [t1, t3]);
  check('T5 nearest candidate wins', best !== null && best.x === 100 + W, JSON.stringify(best));

  // T6: determinism
  check(
    'T6 deterministic',
    JSON.stringify(computeSnapTarget(t2, [t1])) === JSON.stringify(computeSnapTarget(t2, [t1])),
  );
}

// ── Un-snap vertical capture band ──────────────────────────────────────────
{
  const t1 = t('t1', 100, 200);
  // H1: nudged within the band → recaptured (the snap still "holds").
  const hold = computeSnapTarget(t('t2', 100 + W + 6, 200 + SNAP_Y_PX - 8), [t1]);
  check('H1 nudge within band recaptures', hold !== null && hold.x === 100 + W && hold.y === 200);
  // H2: dragged out vertically past the band with x still aligned → free.
  //     THE regression this locks: overlap-only capture recaptured any
  //     |dy| ≤ height/2, so a snapped window could never detach vertically.
  check(
    'H2 vertical drag-out escapes',
    computeSnapTarget(t('t2', 100 + W, 200 + SNAP_Y_PX + 1), [t1]) === null,
  );
  // H3: the boot ladder (36px y offsets) must stay snappable.
  const boot = computeSnapTarget(t('t2', 100 + W + 20, 236), [t1]);
  check('H3 boot ladder offset (36px) snaps', boot !== null && boot.y === 200);
  // H4: boundary inclusive.
  check('H4 dy == SNAP_Y_PX still snaps', computeSnapTarget(t('t2', 100 + W, 200 + SNAP_Y_PX), [t1]) !== null);
}

// ── Joins ──────────────────────────────────────────────────────────────────
{
  const a = t('t1', 100, 200);
  const b = t('t2', 100 + W, 200);
  const joins = computeJoins([a, b]);
  check('J1 abutting → one join', joins.length === 1 && joins[0].left === 't1' && joins[0].right === 't2');

  const bGap = t('t2', 100 + W + JOIN_EPS_PX, 200);
  check('J2 gap within eps joined', computeJoins([a, bGap]).length === 1);
  const bFar = t('t2', 100 + W + JOIN_EPS_PX + 1, 200);
  check('J2 gap past eps not joined', computeJoins([a, bFar]).length === 0);

  const bMisY = t('t2', 100 + W, 200 + JOIN_EPS_PX + 2);
  check('J3 misaligned y not joined', computeJoins([a, bMisY]).length === 0);

  const c = t('t3', 100 + 2 * W, 200);
  const chain = computeJoins([c, a, b]); // order-independent input
  check(
    'J4 chain → two joins, sorted',
    chain.length === 2 && chain[0].left === 't1' && chain[1].left === 't2' && chain[1].right === 't3',
    JSON.stringify(chain),
  );

  const sidesB = openSides('t2', chain);
  check('J5 openSides middle of chain', sidesB.left && sidesB.right);
  check(
    'J5 neighbourOf agrees',
    neighbourOf('t2', 'left', chain) === 't1' &&
      neighbourOf('t2', 'right', chain) === 't3' &&
      neighbourOf('t1', 'left', chain) === null,
  );
}

report();
