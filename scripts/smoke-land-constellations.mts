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

// --- Mural-mode section: non-vacuous regression pin — constellation/mural collisions ----
// Regression test for 8d973ed (commit pinning constellation/mural rect collision).
// Discovery: 133 seeds (of 300 scanned) have at least one figure that lands partially
// in the mural rect and is evicted by the mural pass — with the !inMuralRect clause
// removed from clearable, those seeds drop their complete-figure count. These three
// seeds are pinned collision representatives:
//   - seed 1: broken=1, fixed=3 (2 figures blocked by collision)
//   - seed 79: broken=0, fixed=3 (all 3 blocked, most dramatic)
//   - seed 41: broken=1, fixed=2 (1 figure blocked)
// Assertions: (a) complete-figure count matches the fixed value, (b) each found
// figure's origin is outside the mural rect. These assertions fail on the pre-fix
// code (clearable without the inMuralRect check) because figures land in the rect
// and are partially evicted, changing the complete-figure count and placing origins
// where they shouldn't be.
const collisionSeeds = [1, 79, 41];
const expectedCounts: Record<number, number> = { 1: 3, 79: 3, 41: 2 };

for (const seed of collisionSeeds) {
  const m = composeLand(seed, SAMPLE_LAND, { ...T, mural: true });
  const mural = m.mural!;

  // (a) Assert exact complete-figure count with fix intact
  const isFigureAt = (fig: ReadonlyArray<readonly [number, number]>, ox: number, oy: number) =>
    fig.every(([dx, dy], i) =>
      m.char[oy + dy]?.[ox + dx] === (i === 0 ? '✦' : '·'));
  const allFigures: Array<{ fig: typeof CONSTELLATIONS[0]; ox: number; oy: number }> = [];
  for (const fig of CONSTELLATIONS)
    for (let oy = 0; oy < 8; oy++)
      for (let ox = 0; ox < m.width - 6; ox++)
        if (isFigureAt(fig, ox, oy)) allFigures.push({ fig, ox, oy });

  const expectedCount = expectedCounts[seed];
  check(
    `seed ${seed} collision: complete-figure count = ${expectedCount}`,
    allFigures.length === expectedCount,
    String(allFigures.length),
  );

  // (b) Assert each figure's origin is outside the mural rect
  const x0 = mural.x - 1;
  const x1 = mural.x + mural.w + 1;
  const y0 = mural.y - 1;
  const y1 = mural.y + mural.h + 1;
  for (let i = 0; i < allFigures.length; i++) {
    const { ox, oy } = allFigures[i];
    const outside = ox < x0 || ox >= x1 || oy < y0 || oy >= y1;
    check(`seed ${seed} figure ${i}: origin (${ox},${oy}) outside rect [${x0},${x1}) × [${y0},${y1})`, outside);
  }
}

report();
