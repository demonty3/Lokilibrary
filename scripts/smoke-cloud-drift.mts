/** Cloud-drift smoke — `npx tsx scripts/smoke-cloud-drift.mts`.
 *  #19 slice 2: the terminal renderer hides the baked cloud layer and
 *  re-renders the same wisps drifting on the wall clock. This smokes the
 *  pure maths (src/terminal/clouds.ts); the Pixi wiring is e2e-verified. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { extractWisps, wispAlpha, wispX } from '../src/terminal/clouds.ts';
const { check, report } = makeChecker('smoke cloud-drift');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;
const m = composeLand(7, SAMPLE_LAND, T);
const wisps = extractWisps(m, 7);

check('two wisps extracted (composer bakes two)', wisps.length === 2, String(wisps.length));
check('wisp text is the baked glyph run', wisps.every((w) => /^[~ ]+$/.test(w.text) && w.text.length >= 3));
// Band re-dialed 2026-08-06: 0.04..0.10 was humanly invisible (bar-3 re-watch);
// 0.25..0.45 gives ~3-4 cells of motion per 10 s of watching.
check('speeds within the wallpaper band', wisps.every((w) => w.speed >= 0.25 && w.speed <= 0.46),
  JSON.stringify(wisps.map((w) => w.speed)));
check('deterministic', JSON.stringify(wisps) === JSON.stringify(extractWisps(m, 7)));
check('seed varies phase', JSON.stringify(extractWisps(m, 8).map((w) => w.phase))
  !== JSON.stringify(wisps.map((w) => w.phase)));

const w0 = wisps[0];
// Drift: over one second, x advances by exactly speed (mod the wrap span).
const a = wispX(w0, 1000, m.width);
const b = wispX(w0, 1001, m.width);
const span = m.width + w0.text.length;
const step = ((b - a) % span + span) % span;
check('x advances by speed per second', Math.abs(step - w0.speed) < 1e-9, String(step));
// Wrap: x always inside [-len, width).
let wrapped = true;
for (let t = 0; t < 20000; t += 37) {
  const x = wispX(w0, t, m.width);
  if (x < -w0.text.length || x >= m.width) wrapped = false;
}
check('x stays in the wrap window', wrapped);

// Alpha: synthetic wisp with one blocked span.
const s = { row: 3, text: '~~~', speed: 0.05, phase: 0, blocked: [[50, 60]] } as const;
check('alpha 0 inside the span', wispAlpha(s, 52) === 0);
check('alpha 0 when overlapping the edge', wispAlpha(s, 48) === 0); // 48..51 overlaps 50
check('alpha 1 far away', wispAlpha(s, 10) === 1);
check('alpha ramps in the 2-cell skirt', wispAlpha(s, 46) > 0 && wispAlpha(s, 46) < 1,
  String(wispAlpha(s, 46)));

// --- Re-row (bar-3 visibility fix, 2026-08-06): every terminal window wears
// a mural, whose occlusion span covered most of both baked cloud rows — the
// drift was mechanically live but perceptually absent (Harry's eyeball).
// A wisp whose row is mostly blocked drifts on the nearest clearer sky row
// instead. Render-side only: the no-mural extraction must keep the baked
// rows byte-for-byte.
const blockedFrac = (w: { blocked: ReadonlyArray<readonly [number, number]> }, width: number) =>
  w.blocked.reduce((n, [s0, e0]) => n + (e0 - s0), 0) / width;

// No mural: rows stay exactly where the composer baked them (no re-row churn).
const bakedRows: number[] = [];
for (let y = 0; y < m.height; y++)
  if (m.role[y].some((r) => r === 'cloud') && !bakedRows.includes(y)) bakedRows.push(y);
check('no mural: wisp rows are the baked rows',
  JSON.stringify(wisps.map((w) => w.row).sort()) === JSON.stringify(bakedRows.sort()),
  JSON.stringify({ wisps: wisps.map((w) => w.row), baked: bakedRows }));

// With mural: no wisp sits on a mostly-blocked row (the defect observed live —
// pre-fix the survivor's row was ~60% blocked and it spent its crossing at
// alpha 0), rows are distinct, never row 0 (drag strip), and blocked spans
// describe the wisp's OWN row.
// Width 80 ≈ the live desk's default 640px window — the geometry where the
// mural's ~48 columns actually dominate a row (the 120-wide T above dilutes
// it below the threshold and would smoke-pass the pre-fix code).
for (const seed of [7, 41, 113]) {
  const mm = composeLand(seed, SAMPLE_LAND, { ...T, width: 80, mural: true });
  check(`seed ${seed}: mural composed (precondition)`, mm.mural !== undefined);
  const mw = extractWisps(mm, seed);
  // The composer bakes two wisps; the mural may evict them (seed 41 at this
  // width wipes BOTH), but the sky's intended weather survives: extraction
  // restores the count with synthesized wisps on clear rows.
  check(`seed ${seed}: two wisps despite the mural`, mw.length === 2, String(mw.length));
  check(`seed ${seed}: wisp texts read as wisps`,
    mw.every((w) => /^[~ ]+$/.test(w.text) && w.text.length >= 3));
  check(`seed ${seed}: no wisp on a mostly-blocked row`,
    mw.every((w) => blockedFrac(w, mm.width) <= 0.5),
    JSON.stringify(mw.map((w) => ({ row: w.row, frac: blockedFrac(w, mm.width) }))));
  check(`seed ${seed}: wisp rows distinct, never row 0`,
    new Set(mw.map((w) => w.row)).size === mw.length && mw.every((w) => w.row >= 1));
  const spansOf = (y: number): Array<[number, number]> => {
    const DRIFT = new Set(['sky', 'skyDither', 'star', 'starBright', 'cloud', 'moon']);
    const out: Array<[number, number]> = [];
    let bs = -1;
    for (let c = 0; c <= mm.width; c++) {
      const bad = c < mm.width && !DRIFT.has(mm.role[y][c]);
      if (bad && bs < 0) bs = c;
      if (!bad && bs >= 0) { out.push([bs, c]); bs = -1; }
    }
    return out;
  };
  check(`seed ${seed}: blocked spans match the wisp's own row`,
    mw.every((w) => JSON.stringify(w.blocked) === JSON.stringify(spansOf(w.row))));
  check(`seed ${seed}: re-row deterministic`,
    JSON.stringify(mw) === JSON.stringify(extractWisps(mm, seed)));
}

report();
