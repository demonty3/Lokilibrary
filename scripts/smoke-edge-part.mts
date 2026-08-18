/**
 * Parting-frame smoke (T3 slice 2) — `npx tsx scripts/smoke-edge-part.mts`.
 *
 * The frame parting at a join is a ~0.45 s event; no screenshot can hold it,
 * so its whole shape is pinned here. Locks the four properties the spec's
 * bars 4-6 rest on: the two rest states are exact, the front travels outward
 * from the ground line (rather than the wall crossfading uniformly), the open
 * state leaves NOTHING on the seam column but the jamb, and the close is the
 * part run backwards.
 *
 * Spec: docs/superpowers/specs/2026-08-09-t3-slice2-design.md
 */
import { makeChecker } from './lib/smoke.ts';
import {
  EDGE_FEATHER,
  EDGE_PART_S,
  JAMB_H,
  JAMB_ROW0,
  edgeSpan,
  jambAlpha,
  jambBase,
  jambGlyph,
  partDone,
  partEase,
  partEaseInv,
  partFront,
  restFront,
  rowSpan,
  wallAlpha,
} from '../src/terminal/edgePart.ts';
import { vKnitCols } from '../src/terminal/knit.ts';

const { check, report } = makeChecker('smoke edge-part');

// Desk geometry: a 640x520 window at WORLD_SCALE 2 composes 20 rows with the
// ground line around row 16 (the raised horizon: 4 surface + 1 + 4 under).
const HEIGHT = 20;
const GROUND = 16;
const SPAN = edgeSpan(HEIGHT, GROUND);
check('span clears the tallest run off the ground line', SPAN === 16, `${SPAN}`);
check('span is the FARTHER of the two runs, not one of them',
  edgeSpan(HEIGHT, 3) === HEIGHT - 1 - 3, `${edgeSpan(HEIGHT, 3)}`);

// --- rest states are exact ------------------------------------------------
const closed = restFront(false, SPAN);
const open = restFront(true, SPAN);
/** The real column's rows, read in the front's own axis: every land row's
 *  distance from the ground line, nearest first. Distances above `span` do
 *  not exist on the column, so enumerating 0..height-1 would test rows the
 *  renderer never draws. */
const DISTS = Array.from({ length: HEIGHT }, (_, y) => Math.abs(y - GROUND)).sort((a, b) => a - b);
const wallAt = (front: number): number[] => DISTS.map((d) => wallAlpha(d, front));
const jambAt = (front: number): number[] =>
  Array.from({ length: JAMB_H }, (_, j) => jambAlpha(j, front));

check('rest CLOSED lights every wall row at full',
  wallAt(closed).every((a) => a === 1), wallAt(closed).join(','));
check('rest CLOSED lights no jamb row',
  jambAt(closed).every((a) => a === 0), jambAt(closed).join(','));
check('rest OPEN extinguishes EVERY wall row — nothing in the sky band, nothing in the strata',
  wallAt(open).every((a) => a === 0), wallAt(open).join(','));
check('rest OPEN lights every jamb row at its base',
  jambAt(open).every((a, j) => a === jambBase(j)), jambAt(open).join(','));
check('the jamb fades upward — the remnant ends in sky, not on a hard row',
  jambBase(0) > jambBase(1) && jambBase(1) > jambBase(JAMB_H - 1),
  jambAt(open).join(','));
check('the jamb clears the threshold row (the pulsing ‹ / › owns row 1)', JAMB_ROW0 >= 2);

// --- the front travels OUTWARD, and that is what makes it a parting -------
// Bar 4's shape: sampled mid-part, rows near the ground must be dimmer than
// rows far from it. A uniform crossfade would pass "some row is partial" and
// fail this.
for (const t of [0.1, 0.2, 0.25, 0.3]) {
  const f = partFront(t, SPAN, true);
  const w = wallAt(f);
  check(`t=${t}s: at least one wall row is mid-hand-over (a part, not a cut)`,
    w.some((a) => a > 0 && a < 1), w.join(','));
  check(`t=${t}s: the ground line is dimmer than the far end (the front runs OUTWARD)`,
    w[0] < w[w.length - 1], `d0 ${w[0]} vs d${SPAN} ${w[w.length - 1]}`);
  check(`t=${t}s: wall alpha never decreases with distance (a travelling front, not noise)`,
    w.every((a, i) => i === 0 || a >= w[i - 1] - 1e-9), w.join(','));
}

// The first frame after the join must NOT already be open — that was the old
// behaviour (the wall destroyed in one frame) and is the kill for bar 4.
const firstFrame = wallAt(partFront(1 / 60, SPAN, true));
check('one frame in, the wall is still substantially there (not the old cut)',
  firstFrame.filter((a) => a === 1).length >= firstFrame.length - 3,
  `${firstFrame.filter((a) => a === 1).length}/${firstFrame.length} rows still full`);

// --- the part completes, and lands exactly on the rest state --------------
check('partDone fires at EDGE_PART_S, not before', !partDone(EDGE_PART_S - 1e-6) && partDone(EDGE_PART_S));
check('a completed part equals rest OPEN', partFront(EDGE_PART_S, SPAN, true) === open);
check('a completed close equals rest CLOSED', partFront(EDGE_PART_S, SPAN, false) === closed);
check('an overrun tick does not carry the front past rest',
  partFront(5, SPAN, true) === open && partFront(5, SPAN, false) === closed);

// --- closing is the part run backwards ------------------------------------
for (const t of [0.05, 0.15, 0.3, 0.4]) {
  const a = partFront(t, SPAN, true);
  const b = partFront(EDGE_PART_S - t, SPAN, false);
  check(`close at ${EDGE_PART_S - t}s mirrors open at ${t}s`, Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
}
check('closing walks the front back toward the ground line',
  partFront(0.1, SPAN, false) > partFront(0.3, SPAN, false));

// --- the ease, and its inverse (mid-flight reversals resume, never snap) ---
check('ease is pinned at both ends', partEase(0) === 0 && partEase(1) === 1);
check('ease is clamped outside [0,1]', partEase(-3) === 0 && partEase(9) === 1);
check('ease starts and ends slow — a beat of resistance, then a settle',
  partEase(0.1) < 0.1 && partEase(0.9) > 0.9, `${partEase(0.1)} / ${partEase(0.9)}`);
for (const y of [0, 0.13, 0.5, 0.87, 1]) {
  check(`partEaseInv round-trips at ${y}`, Math.abs(partEase(partEaseInv(y)) - y) < 1e-9,
    `${partEase(partEaseInv(y))}`);
}

// --- the feather is real, and the glyphs are the parted frame's -----------
check('the hand-over is soft, not a per-row pop', EDGE_FEATHER > 1);
check('a row exactly on the front is dark', wallAlpha(8, 8) === 0);
check('a row one feather ahead of the front is full', wallAlpha(8 + EDGE_FEATHER, 8) === 1);
check('the bend leans AWAY from the opening on a left edge', jambGlyph('left', 0) === '╰');
check('…and away from it on a right edge', jambGlyph('right', 0) === '╯');
check('above the bend the remnant is the wall’s own thin rule',
  jambGlyph('left', 1) === '╎' && jambGlyph('right', 2) === '╎');
check('the two sides of one seam bend apart, not the same way',
  jambGlyph('left', 0) !== jambGlyph('right', 0));

// --- Phase B: the vertical seam's row front (rowSpan + reused maths) --------
// The front travels in COLUMNS outward from the shaft; wallAlpha/partFront
// are reused as-is, so only the span derivation is new.
check('rowSpan reaches the far end from a left-of-centre shaft', rowSpan(53, 22) === 30);
check('rowSpan is the shaft column itself when the shaft sits right of centre', rowSpan(53, 40) === 40);
check('rowSpan at the row edges degenerates to the full row',
  rowSpan(53, 0) === 52 && rowSpan(53, 52) === 52);
check('a shaft-adjacent column clears before the outermost one',
  wallAlpha(1, partFront(0.2, 30, true)) <= wallAlpha(30, partFront(0.2, 30, true)));
check('the row front comes to rest at rowSpan when open',
  partFront(EDGE_PART_S, rowSpan(53, 22), true) === rowSpan(53, 22));

// --- Phase B: vKnitCols — the outward column pairs of the vertical knit ----
check('vKnitCols index 0 is the shaft alone', JSON.stringify(vKnitCols(22, 53, 0)) === '[22]');
check('vKnitCols steps outward in pairs', JSON.stringify(vKnitCols(22, 53, 3)) === '[19,25]');
check('vKnitCols clamps at the left end', JSON.stringify(vKnitCols(2, 53, 5)) === '[7]');
check('vKnitCols clamps at the right end', JSON.stringify(vKnitCols(50, 53, 4)) === '[46]');

report();
