/** Closed-wing skyline smoke — `npx tsx scripts/smoke-land-skyline.mts`.
 *  Land polish #19 slice 1: opts.skyline stamps a faint silhouette + wing-id
 *  mark per CLOSED wing onto the sky plane; absent/empty is byte-identical
 *  (the murals-#16 opt pattern). */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, type LandRole } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-skyline');

// The terminal desk's shape (terminalLand.ts: raised horizon underH=4).
const T = { width: 60, skyH: 14, surfaceBand: 4, underH: 4, withPlayer: false, mural: true } as const;
const CLOSED = ['d2', 'd3', 'd4', 'd5'];

const cells = (m: ReturnType<typeof composeLand>, r: LandRole): Array<{ x: number; y: number; c: string }> => {
  const out: Array<{ x: number; y: number; c: string }> = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) if (m.role[y][x] === r) out.push({ x, y, c: m.char[y][x] });
  return out;
};

// 1 — absent / empty opt: byte-identical, no skyline roles.
const plain = composeLand(7, SAMPLE_LAND, T);
const empty = composeLand(7, SAMPLE_LAND, { ...T, skyline: [] });
check('skyline absent: no wing roles', cells(plain, 'wingSil').length === 0 && cells(plain, 'wingMark').length === 0);
check('empty list ≡ absent (byte-identical)', JSON.stringify(plain) === JSON.stringify(empty));

// 2 — deterministic: same inputs → same output.
const a = composeLand(7, SAMPLE_LAND, { ...T, skyline: CLOSED });
const b = composeLand(7, SAMPLE_LAND, { ...T, skyline: CLOSED });
check('deterministic with skyline', JSON.stringify(a) === JSON.stringify(b));

// 3 — every closed wing gets a silhouette and its id mark.
check('silhouette cells present', cells(a, 'wingSil').length >= CLOSED.length * 2, String(cells(a, 'wingSil').length));
const markText = cells(a, 'wingMark').map((c) => c.c).join('');
check('every wing id appears in the marks', CLOSED.every((w) => {
  // both chars of e.g. "d2" present — the mark may be clipped by non-sky
  // cells, so require the digit (the identifying char) at minimum
  return markText.includes(w[1]);
}), markText);

// 4 — the skyline never overwrites the world: recompose WITHOUT the skyline
// and check every non-skyline cell is untouched (the stamp only ever covers
// sky / skyDither / ridgeFar cells).
let untouched = true;
const SKY_PLANE = new Set<LandRole>(['sky', 'skyDither', 'ridgeFar', 'star', 'starBright']);
for (let y = 0; y < plain.height; y++)
  for (let x = 0; x < plain.width; x++) {
    const r = a.role[y][x];
    if (r === 'wingSil' || r === 'wingMark') {
      if (!SKY_PLANE.has(plain.role[y][x])) untouched = false; // stamped over a world cell
    } else if (a.char[y][x] !== plain.char[y][x] || r !== plain.role[y][x]) untouched = false;
  }
check('stamps only over sky-plane cells; everything else byte-identical', untouched);

// 5 — position independence: a wing's silhouette stands in the SAME cells
// whichever other wings are closed (per-wing salted PRNG, no shared stream).
const solo = composeLand(7, SAMPLE_LAND, { ...T, skyline: ['d3'] });
const soloCells = JSON.stringify(cells(solo, 'wingSil').filter((c) => true));
const d3InFull = cells(a, 'wingSil');
// d3's solo cells must be a subset of the full set's silhouette cells
const fullSet = new Set(d3InFull.map((c) => `${c.x},${c.y},${c.c}`));
check('per-wing placement independent of the closed set',
  cells(solo, 'wingSil').every((c) => fullSet.has(`${c.x},${c.y},${c.c}`)), soloCells);

// 6 — join: the seam-blend buffer stays skyline-free on the joined edge.
const joined = composeLand(7, SAMPLE_LAND, { ...T, skyline: CLOSED, join: { right: 99 } });
check('seam buffer clear of skyline', cells(joined, 'wingSil').concat(cells(joined, 'wingMark'))
  .every((c) => c.x >= 2 && c.x <= T.width - 3));

// 7 — mural eviction: no skyline cell inside the mural's cleared outer rect.
const m = a.mural;
check('mural composed in the fixture', m !== undefined);
if (m) {
  const inRect = (c: { x: number; y: number }): boolean =>
    c.x >= m.x - 1 && c.x <= m.x + m.w && c.y >= m.y - 1 && c.y <= m.y + m.h;
  check('mural rect evicts skyline', !cells(a, 'wingSil').concat(cells(a, 'wingMark')).some(inRect));
}

// 8 — tiny sky: no crash, skyline suppressed rather than misplaced.
const tiny = composeLand(7, SAMPLE_LAND, { width: 40, skyH: 3, surfaceBand: 4, underH: 4, withPlayer: false, skyline: CLOSED });
check('tiny sky composes without skyline overflow',
  cells(tiny, 'wingSil').concat(cells(tiny, 'wingMark')).every((c) => c.y >= 1));

report();
