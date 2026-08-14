/**
 * T5 placement smoke (broker's pure half) —
 * `npx tsx scripts/smoke-t5-placement.mts`.
 *
 * Locks bar 4's geometry: an applied proposal spawns at exact abutment on
 * the anchor's join chain, same y — and the load-bearing cross-check is that
 * `computeJoins` (the REAL join derivation) reports a join for the returned
 * position. Plus bar 3's gate function, all five verdicts.
 *
 * Spec: docs/superpowers/specs/2026-08-14-t5-orchestration-design.md
 */
import { makeChecker } from './lib/smoke.ts';
import { proposalSpawnBounds, validateProposal } from '../desktop/src/proposalPlacement.ts';
import { computeJoins, type TermBounds } from '../desktop/src/topology.ts';

const { check, report } = makeChecker('smoke t5-placement');

const W = 640;
const H = 520;
const WA = { x: 0, y: 0, width: 2560, height: 1440 };
const win = (id: string, x: number, y: number): TermBounds => ({ id, x, y, width: W, height: H });

// --- validateProposal: all five verdicts, in precedence order --------------
{
  const base = { optIn: true, openWings: ['d0', 'd1'], allWings: ['d0', 'd1', 'd2', 'd3'], accepted: null };
  check('ok', validateProposal(base, 'd2') === 'ok');
  check('opted_out beats everything', validateProposal({ ...base, optIn: false }, 'd2') === 'opted_out');
  check('unknown_wing', validateProposal(base, 'd9') === 'unknown_wing');
  check('wing_open', validateProposal(base, 'd1') === 'wing_open');
  check('already_proposed (one per desk per night)',
    validateProposal({ ...base, accepted: 'd3' }, 'd2') === 'already_proposed');
  check('a re-submission of the SAME wing is also already_proposed — first writer won',
    validateProposal({ ...base, accepted: 'd2' }, 'd2') === 'already_proposed');
}

// --- lone anchor: right abutment, and computeJoins agrees ------------------
{
  const anchor = win('t1', 400, 200);
  const pos = proposalSpawnBounds(anchor, [], WA);
  check('right of the anchor, exactly flush', pos?.x === 400 + W && pos?.y === 200, JSON.stringify(pos));
  const joins = computeJoins([anchor, win('t9', pos!.x, pos!.y)]);
  check('computeJoins REPORTS the join at that position (the whole point)',
    JSON.stringify(joins) === JSON.stringify([{ left: 't1', right: 't9' }]), JSON.stringify(joins));
}

// --- join chain: the new window abuts the chain's END, not the anchor ------
{
  const anchor = win('t1', 400, 200);
  const rightNb = win('t2', 400 + W, 200); // joined to t1's right
  const pos = proposalSpawnBounds(anchor, [rightNb], WA);
  check('chain-walk: flush against the chain end', pos?.x === 400 + 2 * W && pos?.y === 200, JSON.stringify(pos));
  const joins = computeJoins([anchor, rightNb, win('t9', pos!.x, pos!.y)]);
  check('the applied window joins the chain end',
    joins.some((j) => j.left === 't2' && j.right === 't9'), JSON.stringify(joins));
}

// --- left fallback when the right runs off the display ---------------------
{
  const anchor = win('t1', WA.width - W, 200); // flush to the right display edge
  const pos = proposalSpawnBounds(anchor, [], WA);
  check('no room right → flush LEFT instead', pos?.x === WA.width - 2 * W && pos?.y === 200, JSON.stringify(pos));
  check('…which also joins', computeJoins([anchor, win('t9', pos!.x, pos!.y)]).length === 1);
}

// --- overlap rejection ------------------------------------------------------
{
  // A stray (unjoined, y-offset beyond JOIN_EPS) window squats where the
  // right candidate would land; the left is clear.
  const anchor = win('t1', 1000, 200);
  const squatter = win('tX', 1000 + W + 10, 300);
  const pos = proposalSpawnBounds(anchor, [squatter], WA);
  check('an overlapped side is rejected, the clear side wins',
    pos?.x === 1000 - W && pos?.y === 200, JSON.stringify(pos));
}

// --- both sides blocked → null (the quiet no-op) ---------------------------
{
  // Work area exactly one window wide: neither side has room.
  const anchor = win('t1', 0, 200);
  check('no legal placement → null, never a forced spawn',
    proposalSpawnBounds(anchor, [], { x: 0, y: 0, width: W, height: 1440 }) === null);
  // Or both sides physically occupied by unjoined squatters.
  const boxed = proposalSpawnBounds(
    win('t1', 1000, 200),
    [win('tL', 1000 - W + 5, 250), win('tR', 1000 + W - 5, 250)],
    WA,
  );
  check('boxed in on both sides → null', boxed === null, JSON.stringify(boxed));
}

// --- the PRD's hard rule, structurally -------------------------------------
{
  // The function's OUTPUT is only ever a position for the new window; feed it
  // a desk and prove the inputs are untouched (no hidden mutation).
  const anchor = win('t1', 400, 200);
  const others = [win('t2', 400 + W, 200)];
  const before = JSON.stringify([anchor, ...others]);
  proposalSpawnBounds(anchor, others, WA);
  check('no existing window\'s bounds are ever an output — inputs unmutated',
    JSON.stringify([anchor, ...others]) === before);
}

report();
