/** Aperture-extension smoke (scale/anchor slice) — `npx tsx scripts/smoke-land-aperture.mts`.
 *
 *  Pins the 2026-08-18 scale/anchor spec's frozen bars: the anchor-identity
 *  arithmetic (at shipped sizes content exactly fills the window, so the
 *  top-anchor is pixel-identical to the old bottom-anchor), the row-agreement
 *  contract (every extension row is a pure function of (seed, width,
 *  globalRow) — two window heights agree on all shared rows byte-for-byte),
 *  strata-band and shaft-parity continuity across the row-20 boundary, and
 *  a per-wing aperture golden. Also double-pins the canonical composeLand
 *  desk golden as the "canonical model untouched" tripwire. */
import { makeChecker } from './lib/smoke.ts';
import {
  composeLand,
  composeLandExtension,
  shaftColumn,
  strataRoleAtDepth,
  landReliefProfile,
  DESK_SURFACE,
  SAMPLE_LAND,
  type LandGame,
  type LandRole,
} from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke land-aperture');

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const hash = (v: unknown): string => fnv1a(JSON.stringify(v)).toString(16);

const T = {
  width: 53,
  skyH: DESK_SURFACE.skyH,
  surfaceBand: DESK_SURFACE.surfaceBand,
  underH: DESK_SURFACE.underH,
  withPlayer: false,
  mural: false,
} as const;

const WINGS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'] as const;
const wingSeed = (w: string): number => fnv1a(`terminal:${w}`);
const wingGames = (w: string): LandGame[] => {
  const rot = fnv1a(w) % SAMPLE_LAND.length;
  return Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);
};

// 1 — anchor identity: at shipped sizes contentH * WORLD_SCALE === window
// height exactly, so world.y = 0 under top- OR bottom-anchor (CH 13, scale 2).
{
  check('anchor identity: surface 20 rows fill 520px', DESK_SURFACE.rows * 13 * 2 === 520);
  check('anchor identity: under 10 rows fill 260px', 10 * 13 * 2 === 260);
  check(
    'geometry self-consistency: groundRow = skyH + surfaceBand',
    DESK_SURFACE.groundRow === DESK_SURFACE.skyH + DESK_SURFACE.surfaceBand,
  );
  check(
    'geometry self-consistency: rows = skyH + band + 1 + underH',
    DESK_SURFACE.rows ===
      DESK_SURFACE.skyH + DESK_SURFACE.surfaceBand + 1 + DESK_SURFACE.underH,
  );
}

// 2 — canonical-model tripwire: this slice must never move a composeLand draw
// (same golden smoke-under-land pins; double-pinned here deliberately).
{
  const h = hash(composeLand(wingSeed('d0'), wingGames('d0'), T));
  check('composeLand desk golden (d0) untouched', h === '6b5125c2', h);
}

// 3 — determinism + row agreement: extraRows 5 vs 12 byte-identical on every
// shared row, per wing (the load-bearing bar: any two window heights agree).
for (const w of WINGS) {
  const seed = wingSeed(w);
  const games = wingGames(w);
  const a = composeLandExtension(seed, games, { width: 53, extraRows: 5 });
  const a2 = composeLandExtension(seed, games, { width: 53, extraRows: 5 });
  check(`determinism: ${w}`, JSON.stringify(a) === JSON.stringify(a2));
  const b = composeLandExtension(seed, games, { width: 53, extraRows: 12 });
  const shared = { char: b.char.slice(0, 5), role: b.role.slice(0, 5) };
  check(`row agreement (5 vs 12): ${w}`, JSON.stringify(a) === JSON.stringify(shared));
}

// 4 — band + parity continuity across the row-20 boundary (d0, extraRows 5).
{
  const seed = wingSeed('d0');
  const games = wingGames('d0');
  const ext = composeLandExtension(seed, games, { width: 53, extraRows: 5 });
  const profile = landReliefProfile(seed, 53, DESK_SURFACE.groundRow);
  const shaftX = shaftColumn(53, games.filter((p) => p.state !== 'abandoned').length);
  const STRATA: ReadonlySet<LandRole> = new Set<LandRole>(['topsoil', 'stone', 'bedrock', 'deep']);
  let bandsOk = true;
  for (let i = 0; i < 5; i++) {
    const g = DESK_SURFACE.rows + i;
    for (let x = 0; x < 53; x++) {
      const r = ext.role[i][x];
      if (!STRATA.has(r)) continue; // blanks, ore, shaft
      if (r !== strataRoleAtDepth(g - profile[x], DESK_SURFACE.underH)) bandsOk = false;
    }
  }
  check('strata bands match strataRoleAtDepth per column', bandsOk);
  // composeLand's shaft alternates y % 2 in rows 0–19 (site labels may
  // overwrite individual cells); the extension must continue the same global
  // parity so the alternation runs unbroken.
  const surface = composeLand(seed, games, T);
  let deepestShaft = -1;
  for (let y = 0; y < DESK_SURFACE.rows; y++) if (surface.role[y][shaftX] === 'shaft') deepestShaft = y;
  check(
    'shaft parity unbroken through row 20',
    deepestShaft >= 0 &&
      surface.char[deepestShaft][shaftX] === (deepestShaft % 2 ? '‖' : '╫') &&
      ext.char.every((row, i) => row[shaftX] === ((DESK_SURFACE.rows + i) % 2 ? '‖' : '╫')),
  );
  // Join seeds move seam-column depth: the extension honours the surface
  // window's join relief exactly (same landReliefProfile contract as the
  // undercroft).
  const join = { right: wingSeed('d2') } as const;
  const extJ = composeLandExtension(seed, games, { width: 53, extraRows: 5, join });
  const profJ = landReliefProfile(seed, 53, DESK_SURFACE.groundRow, join);
  let joinOk = true;
  for (let i = 0; i < 5; i++) {
    const g = DESK_SURFACE.rows + i;
    for (let x = 48; x < 53; x++) {
      const r = extJ.role[i][x];
      if (!STRATA.has(r)) continue;
      if (r !== strataRoleAtDepth(g - profJ[x], DESK_SURFACE.underH)) joinOk = false;
    }
  }
  check('joined seam columns use the join relief profile', joinOk);
}

// 5 — aperture goldens, one per wing (canonical 20 rows + 5 extension rows;
// frozen 2026-08-18 at slice close).
const APERTURE_GOLDEN: Record<string, string> = {
  d0: '992baff8',
  d1: 'ad5667de',
  d2: 'f97ae408',
  d3: 'ac96b04d',
  d4: '49914b3a',
  d5: '5efe8600',
};
for (const w of WINGS) {
  const seed = wingSeed(w);
  const games = wingGames(w);
  const m = composeLand(seed, games, T);
  const ext = composeLandExtension(seed, games, { width: 53, extraRows: 5 });
  const h = hash({ char: [...m.char, ...ext.char], role: [...m.role, ...ext.role] });
  check(`aperture golden: ${w}`, h === APERTURE_GOLDEN[w], h);
}

report();
