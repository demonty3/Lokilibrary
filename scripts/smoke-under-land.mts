/** Undercroft compose smoke (Phase B, B1p) — `npx tsx scripts/smoke-under-land.mts`.
 *
 *  Pins the vertical-seam determinism contract from the 2026-08-18 Phase B
 *  spec: an under window and its surface window agree on the relief-derived
 *  depth profile, the strata role bands at the seam, and the shaft column +
 *  glyph parity — computed INDEPENDENTLY (no broker), from the wing seed
 *  alone. Also pins composeUnderLand's own goldens, and a composeLand desk
 *  golden as a tripwire: the helper extraction must never move a surface
 *  draw. */
import { makeChecker } from './lib/smoke.ts';
import {
  composeLand,
  composeUnderLand,
  landReliefProfile,
  shaftColumn,
  strataRoleAtDepth,
  SAMPLE_LAND,
  type LandGame,
  type LandModel,
  type LandRole,
} from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke under-land');

/** FNV-1a 32-bit — local copy (golden compression + wing seeds, matching
 *  src/terminal/terminalLand.ts's canonical derivation). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const hash = (v: unknown): string => fnv1a(JSON.stringify(v)).toString(16);

// The desk's exact geometry: 640×520 surface (53×20 cells, skyH 11) over a
// 640×260 undercroft (53×10 cells), WORLD_SCALE 2.
const T = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false, mural: false } as const;
const U = { width: 53, rows: 10, yOffset: 20, surface: { skyH: 11, surfaceBand: 4, underH: 4 } } as const;
const GROUND_LINE = T.skyH + T.surfaceBand;

const WINGS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'] as const;
const wingSeed = (w: string): number => fnv1a(`terminal:${w}`);
/** terminalLand.ts's wing slice: 5 games, rotation by wing hash. */
const wingGames = (w: string): LandGame[] => {
  const rot = fnv1a(w) % SAMPLE_LAND.length;
  return Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);
};

const STRATA: ReadonlySet<LandRole> = new Set<LandRole>(['topsoil', 'stone', 'bedrock', 'deep']);

// 1 — determinism: two composes are byte-identical.
{
  const a = composeUnderLand(wingSeed('d0'), wingGames('d0'), U);
  const b = composeUnderLand(wingSeed('d0'), wingGames('d0'), U);
  check('determinism: two calls byte-identical', JSON.stringify(a) === JSON.stringify(b));
}

// 2 — goldens, one per wing (frozen 2026-08-18 at slice B1p).
const UNDER_GOLDEN: Record<string, string> = {
  d0: 'd7e9b2b1',
  d1: 'db31574e',
  d2: 'f405c7bc',
  d3: 'b0cd8428',
  d4: '49b0c715',
  d5: '9cdd6ce8',
};
for (const w of WINGS) {
  const h = hash(composeUnderLand(wingSeed(w), wingGames(w), U));
  check(`golden: ${w}`, h === UNDER_GOLDEN[w], h);
}

// 3 — composeLand tripwire: the reliefSurfaceY/shaftColumn extraction must
// never move a surface draw (frozen 2026-08-18; smoke-land-mural pins seeds
// 7/41 — this pins the live desk wing).
{
  const h = hash(composeLand(wingSeed('d0'), wingGames('d0'), T));
  check('composeLand desk golden (d0)', h === '6b5125c2', h);
}

// 4 — profile agreement: landReliefProfile reproduces composeLand's surface
// rows exactly, across seeds and join permutations. This is the load-bearing
// claim: the under window continues the profile the window above actually
// composed.
{
  const joins = [
    undefined,
    { left: wingSeed('d1') },
    { right: wingSeed('d2') },
    { left: wingSeed('d1'), right: wingSeed('d2') },
  ];
  for (const w of WINGS) {
    for (const join of joins) {
      const m = composeLand(wingSeed(w), wingGames(w), { ...T, ...(join ? { join } : {}) });
      const p = landReliefProfile(wingSeed(w), T.width, GROUND_LINE, join);
      check(
        `profile agreement: ${w} join=${JSON.stringify(join ?? null)}`,
        JSON.stringify(p) === JSON.stringify(m.surface),
      );
    }
  }
}

// 5 — band agreement at the seam, both directions:
//     (a) strataRoleAtDepth reproduces composeLand's OWN band assignment on
//         the surface window's bottom row (behavioural agreement — the
//         thresholds were mirrored, not shared);
//     (b) the under window's top row continues those bands at depth+1.
{
  for (const w of WINGS) {
    const seed = wingSeed(w);
    const games = wingGames(w);
    const sm = composeLand(seed, games, T);
    const um = composeUnderLand(seed, games, U);
    let surfaceAgree = true;
    let underAgree = true;
    for (let x = 0; x < T.width; x++) {
      const sy = sm.surface[x];
      const sr = sm.role[19][x];
      if (STRATA.has(sr) && sr !== strataRoleAtDepth(19 - sy, T.underH)) surfaceAgree = false;
      const ur = um.role[0][x];
      if (STRATA.has(ur) && ur !== strataRoleAtDepth(20 - sy, T.underH)) underAgree = false;
    }
    check(`surface bottom-row bands match strataRoleAtDepth: ${w}`, surfaceAgree);
    check(`under top-row bands continue the profile: ${w}`, underAgree);
  }
}

// 6 — shaft: shared column, unbroken glyph parity through the seam.
{
  for (const w of WINGS) {
    const seed = wingSeed(w);
    const games = wingGames(w);
    const sm = composeLand(seed, games, T);
    const um = composeUnderLand(seed, games, U);
    const sx = shaftColumn(T.width, games.filter((g) => g.state !== 'abandoned').length);
    // Both models put their shaft in exactly the shared column. (Individual
    // CELLS on it may be overwritten by later passes — a buried relic's label
    // row, a being — exactly as on the surface today; the column is the
    // contract, not every cell.)
    const shaftCols = (m: { role: ReadonlyArray<ReadonlyArray<LandRole>> }): number[] => {
      const s = new Set<number>();
      m.role.forEach((row) => row.forEach((r, x) => { if (r === 'shaft') s.add(x); }));
      return [...s];
    };
    check(`shaft column shared: ${w}`,
      JSON.stringify(shaftCols(sm)) === JSON.stringify([sx]) &&
      JSON.stringify(shaftCols(um)) === JSON.stringify([sx]));
    // Parity is GLOBAL-y on every cell the shaft owns, so the alternation
    // runs unbroken through the seam (surface y ≡ global y; under y + 20).
    const parityOk = (m: LandModel, off: number): boolean => {
      for (let y = 0; y < m.height; y++)
        if (m.role[y][sx] === 'shaft' && m.char[y][sx] !== ((y + off) % 2 ? '‖' : '╫')) return false;
      return true;
    };
    check(`shaft parity unbroken: ${w}`, parityOk(sm, 0) && parityOk(um, U.yOffset));
    // The shaft reaches the undercroft floor (descent lands somewhere real).
    check(`shaft reaches the floor: ${w}`, um.role[U.rows - 1][sx] === 'shaft');
  }
}

// 7 — floor + gallery invariants: the surface-keyed machinery's ground truth.
{
  for (const w of WINGS) {
    const um = composeUnderLand(wingSeed(w), wingGames(w), U);
    check(`surface[] is the floor row: ${w}`, um.surface.every((s) => s === U.rows - 1));
    const floorOk = um.role[U.rows - 1].every((r, x) => r === 'crust' || r === 'shaft');
    check(`floor row is crust (shaft excepted): ${w}`, floorOk);
    const gallery = um.role[U.rows - 2];
    const open = gallery.filter((r) => r === 'sky' || r === 'cavern' || r === 'shaft').length;
    check(`gallery row is walkable: ${w}`, open === U.width);
    check(`no sites in the undercroft: ${w}`, um.sites.length === 0);
    check(`no sky-band roles below ground: ${w}`,
      !um.role.some((row) => row.some((r) =>
        r === 'star' || r === 'starBright' || r === 'skyDither' || r === 'sun' || r === 'moon' || r === 'cloud')));
  }
}

report();
