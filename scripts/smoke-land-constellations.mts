/** Constellation smoke — `npx tsx scripts/smoke-land-constellations.mts`.
 *  #19 slice 2: figures are ARRANGEMENTS of the existing star roles — the
 *  patch loses its scatter (figures replace, never add), sun and moon always
 *  survive, and blank-sky packs need zero edits because no new role exists. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, CONSTELLATIONS, SAMPLE_LAND } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-constellations');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;

check('figure library has 3 figures', CONSTELLATIONS.length === 3);
check('figures are 4–6 points', CONSTELLATIONS.every((f) => f.length >= 4 && f.length <= 6));

let found = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, T);
  // A stamped figure = some origin where point 0 is '✦' and every other
  // point is '·' at exactly the figure's offsets.
  const isFigureAt = (fig: ReadonlyArray<readonly [number, number]>, ox: number, oy: number) =>
    fig.every(([dx, dy], i) =>
      m.char[oy + dy]?.[ox + dx] === (i === 0 ? '✦' : '·'));
  let hits = 0;
  for (const fig of CONSTELLATIONS)
    for (let oy = 0; oy < 8; oy++)
      for (let ox = 0; ox < m.width - 6; ox++)
        if (isFigureAt(fig, ox, oy)) hits++;
  if (hits > 0) found++;

  const roleCount = (r: string) => {
    let n = 0;
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) if (m.role[y][x] === r) n++;
    return n;
  };
  check(`seed ${seed}: sun survives`, roleCount('sun') >= 1);
  check(`seed ${seed}: moon survives`, roleCount('moon') === 1);
  check(`seed ${seed}: scatter still exists`, roleCount('star') + roleCount('starBright') > 10);
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, SAMPLE_LAND, T)));
}
// Placement re-rolls may legitimately fail on a crowded strip — but across
// 5 seeds at width 120, figures must land most of the time.
check('figures found on >= 4 of 5 seeds', found >= 4, String(found));

// --- Mural-mode section: constellation figures must avoid the mural rect ----
// Regression test for 8d973ed: the mural pass (which runs LATER in composeLand)
// clears its rect unconditionally. Figures placed without knowing the rect's
// geometry could land inside and get evicted. The fix precomputes muralRect and
// feeds it into the figure fit-check. Observable: no star or starBright role
// anywhere inside the mural rect (frame + interior).
let muralFound = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, { ...T, mural: true });
  if (!m.mural) continue;

  const mural = m.mural;
  let violationCount = 0;
  // mural.x/y is interior position; frame extends 1 unit outward on all sides
  const x0 = mural.x - 1;
  const x1 = mural.x + mural.w + 1;
  const y0 = mural.y - 1;
  const y1 = mural.y + mural.h + 1;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (m.role[y]?.[x] === 'star' || m.role[y]?.[x] === 'starBright') violationCount++;

  check(`seed ${seed} mural: no stars inside rect`, violationCount === 0, String(violationCount));

  // Figures still appear somewhere in the sky on ≥3 seeds (reuse existing search).
  const isFigureAt = (fig: ReadonlyArray<readonly [number, number]>, ox: number, oy: number) =>
    fig.every(([dx, dy], i) =>
      m.char[oy + dy]?.[ox + dx] === (i === 0 ? '✦' : '·'));
  let hits = 0;
  for (const fig of CONSTELLATIONS)
    for (let oy = 0; oy < 8; oy++)
      for (let ox = 0; ox < m.width - 6; ox++)
        if (isFigureAt(fig, ox, oy)) hits++;
  if (hits > 0) muralFound++;
}
check('figures found on >= 3 of 5 mural-mode seeds', muralFound >= 3, String(muralFound));

report();
