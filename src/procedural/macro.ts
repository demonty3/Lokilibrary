/**
 * Deterministic "macro" field generators for the reveal flythrough's
 * impressionistic upper scale levels (district → solar_system). These are NOT
 * the real interactive level renderers — they are cheap, seeded glyph point-
 * clouds that read as an escalating zoom-out ("Powers of Ten for your Steam
 * library"). The art is intentionally promotable: when the real district /
 * island / … renderers land, they can consume the same stat-driven shapes.
 *
 * Determinism (CLAUDE.md hard rule — this file lives in src/procedural/):
 * every draw goes through `mulberry32(seed ^ <namespace>)`. Same profile seed →
 * same fields. No `Math.random()`. The Math.* trig used for shaping is pure.
 *
 * Each generator returns centered coords (origin = the spot the previous level
 * collapses into), so the reveal camera can nest level K at the centre of
 * level K+1.
 */

import { mulberry32, type Prng } from './prng';
import type { Profile, ScaleLevel } from '../types';
import type { ThemePalette } from '../themes/types';

/** One placed glyph in abstract, centered grid coords. The renderer multiplies
 *  (x, y) by a per-level spacing and tints by `tintKey`; `weight` (0..1) maps to
 *  alpha/emphasis so hero + centre nodes read brighter than filler. */
export interface MacroCell {
  x: number;
  y: number;
  glyph: string;
  tintKey: keyof ThemePalette;
  weight: number;
}

/** The handful of library signals the macro shapes are parameterized by. Kept
 *  minimal + always-derivable so anonymous (sample-library) reveals still work. */
export interface LibraryStats {
  gameCount: number;
  playedCount: number;
  dustyCount: number;
  playHours: number;
  topCount: number;
}

/** Derive macro stats from a profile, or from a bare sample-library count when
 *  anonymous. Pure — no IO, safe in src/procedural. */
export function deriveStats(profile: Profile | null, fallbackGameCount: number): LibraryStats {
  if (profile) {
    return {
      gameCount: Math.max(1, profile.totalGames),
      playedCount: Math.max(0, profile.playedGames),
      dustyCount: Math.max(0, profile.dustyGames),
      playHours: Math.max(0, profile.totalPlaytimeHours),
      topCount: Math.max(1, profile.topGames.length),
    };
  }
  const n = Math.max(1, fallbackGameCount);
  return { gameCount: n, playedCount: n, dustyCount: 0, playHours: n * 12, topCount: n };
}

// Per-level PRNG namespaces — keep each field's stream independent so adding
// a level doesn't shift the others (mirrors `seed ^ 0xce11` in cell.ts).
const NS_DISTRICT = 0x0d15;
const NS_ISLAND = 0x0015;
const NS_CONTINENT = 0x0c07;
const NS_PLANET = 0x009a;
const NS_SOLAR = 0x501a2;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Filled irregular disc, centered on (0,0). `irregular` warps the radius by
 *  angle to give organic coastlines; `edge` flags rim cells for shore tinting. */
function blob(
  prng: Prng,
  maxR: number,
  lobes: number,
  irregular: number,
): Array<{ x: number; y: number; edge: boolean }> {
  const phase = prng.rangeFloat(0, Math.PI * 2);
  const pts: Array<{ x: number; y: number; edge: boolean }> = [];
  for (let y = -maxR; y <= maxR; y++) {
    for (let x = -maxR; x <= maxR; x++) {
      const d = Math.hypot(x, y);
      if (d > maxR) continue;
      const ang = Math.atan2(y, x);
      const r = maxR * (1 - irregular * (0.5 - 0.5 * Math.sin(ang * lobes + phase)));
      if (d <= r) pts.push({ x, y, edge: d > r - 1.4 });
    }
  }
  return pts;
}

/** Level 1 — a neighbourhood lattice of rooms around the player's cell. */
export function districtField(seed: number, stats: LibraryStats): MacroCell[] {
  const prng = mulberry32((seed ^ NS_DISTRICT) >>> 0);
  const cells: MacroCell[] = [{ x: 0, y: 0, glyph: '█', tintKey: 'fgBright', weight: 1 }];
  const accents: Array<keyof ThemePalette> = ['yellow', 'blue', 'violet', 'green', 'cyan', 'orange'];
  const rooms: string[] = ['▒', '▓', '■'];
  const count = clamp(Math.round(stats.gameCount / 4), 8, 56);
  const taken = new Set<string>(['0,0']);
  let placed = 0;
  for (let i = 0; placed < count && i < count * 8; i++) {
    const radius = 1 + Math.floor(placed / 7);
    const ang = prng.rangeFloat(0, Math.PI * 2);
    const rr = radius + prng.rangeFloat(-0.35, 0.35);
    const x = Math.round(Math.cos(ang) * rr * 1.7);
    const y = Math.round(Math.sin(ang) * rr);
    const k = `${x},${y}`;
    if (taken.has(k)) continue;
    taken.add(k);
    cells.push({ x, y, glyph: prng.pick(rooms), tintKey: prng.pick(accents), weight: 0.45 + prng.next() * 0.35 });
    placed++;
  }
  return cells;
}

/** Level 2 — an island silhouette; the district we came from is the beacon. */
export function islandField(seed: number, stats: LibraryStats): MacroCell[] {
  const prng = mulberry32((seed ^ NS_ISLAND) >>> 0);
  const maxR = clamp(Math.round(Math.sqrt(stats.gameCount)) + 3, 5, 16);
  const pts = blob(prng, maxR, 5, 0.4);
  const cells: MacroCell[] = pts.map((p) => ({
    x: p.x,
    y: p.y,
    glyph: p.edge ? '░' : '▒',
    tintKey: p.edge ? ('cyan' as const) : ('green' as const),
    weight: p.edge ? 0.4 : 0.6,
  }));
  const markers = clamp(Math.round(stats.gameCount / 12), 4, 18);
  const markerTints: Array<keyof ThemePalette> = ['yellow', 'orange', 'violet'];
  for (let m = 0; m < markers && pts.length > 0; m++) {
    const pick = pts[prng.range(0, pts.length)];
    cells.push({ x: pick.x, y: pick.y, glyph: '■', tintKey: prng.pick(markerTints), weight: 0.85 });
  }
  cells.push({ x: 0, y: 0, glyph: '▓', tintKey: 'fgBright', weight: 1 });
  return cells;
}

/** Level 3 — a continent: several islands merged into a landmass. */
export function continentField(seed: number, stats: LibraryStats): MacroCell[] {
  const prng = mulberry32((seed ^ NS_CONTINENT) >>> 0);
  const lobes = clamp(2 + Math.round(stats.gameCount / 60), 3, 6);
  const islands = clamp(Math.round(stats.playedCount / 30) + 3, 3, 7);
  const baseR = clamp(Math.round(Math.sqrt(stats.gameCount)) + 4, 7, 18);
  const cells: MacroCell[] = [];
  const seen = new Set<string>();
  for (let isl = 0; isl < islands; isl++) {
    const ox = isl === 0 ? 0 : Math.round(prng.rangeFloat(-baseR, baseR));
    const oy = isl === 0 ? 0 : Math.round(prng.rangeFloat(-baseR * 0.7, baseR * 0.7));
    const r = isl === 0 ? baseR : clamp(Math.round(baseR * prng.rangeFloat(0.4, 0.8)), 3, baseR);
    for (const p of blob(prng, r, lobes, 0.45)) {
      const x = p.x + ox;
      const y = p.y + oy;
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      cells.push({ x, y, glyph: p.edge ? '░' : '▒', tintKey: p.edge ? 'cyan' : 'green', weight: p.edge ? 0.35 : 0.55 });
    }
  }
  const regionTints: Array<keyof ThemePalette> = ['yellow', 'orange', 'violet', 'blue'];
  const regions = clamp(islands * 2, 4, 14);
  for (let m = 0; m < regions; m++) {
    const ang = prng.rangeFloat(0, Math.PI * 2);
    const rr = prng.rangeFloat(0, baseR);
    cells.push({
      x: Math.round(Math.cos(ang) * rr),
      y: Math.round(Math.sin(ang) * rr),
      glyph: '◆',
      tintKey: prng.pick(regionTints),
      weight: 0.8,
    });
  }
  cells.push({ x: 0, y: 0, glyph: '★', tintKey: 'fgBright', weight: 1 });
  return cells;
}

/** Level 4 — the continent wrapped into a lit glyph-sphere with a terminator. */
export function planetField(seed: number, stats: LibraryStats): MacroCell[] {
  const prng = mulberry32((seed ^ NS_PLANET) >>> 0);
  const R = clamp(Math.round(Math.sqrt(stats.gameCount)) + 6, 9, 20);
  const termPhase = prng.rangeFloat(-0.6, 0.6);
  const bands: Array<keyof ThemePalette> = ['green', 'cyan', 'blue', 'violet', 'yellow'];
  const cells: MacroCell[] = [];
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y);
      if (d > R) continue;
      const edge = d > R - 1.3;
      const light = (x / R) * Math.cos(termPhase) + (y / R) * Math.sin(termPhase);
      const lit = light > -0.15;
      const band = bands[clamp(Math.floor(((y + R) / (2 * R)) * bands.length), 0, bands.length - 1)];
      cells.push({
        x,
        y,
        glyph: edge ? '░' : lit ? '▓' : '▒',
        tintKey: edge ? 'cyan' : lit ? band : 'fgDim',
        weight: lit ? 0.7 : 0.35,
      });
    }
  }
  return cells;
}

/** Level 5 — the poster backdrop: your planet among siblings orbiting a sun. */
export function solarField(seed: number, stats: LibraryStats): MacroCell[] {
  const prng = mulberry32((seed ^ NS_SOLAR) >>> 0);
  const cells: MacroCell[] = [{ x: 0, y: 0, glyph: '★', tintKey: 'yellow', weight: 1 }];
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    cells.push({ x: dx, y: dy, glyph: '●', tintKey: 'orange', weight: 0.9 });
  }
  const planets = clamp(Math.round(Math.log2(stats.gameCount + 1)) + 1, 3, 7);
  const accents: Array<keyof ThemePalette> = ['green', 'cyan', 'blue', 'violet', 'red', 'yellow', 'orange'];
  const playerPlanet = prng.range(0, planets);
  let orbit = 4;
  for (let p = 0; p < planets; p++) {
    orbit += 3 + p;
    const steps = Math.max(16, Math.round(orbit * 2.2));
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      cells.push({
        x: Math.round(Math.cos(a) * orbit * 1.7),
        y: Math.round(Math.sin(a) * orbit),
        glyph: '·',
        tintKey: 'fgDim',
        weight: 0.18,
      });
    }
    const pa = prng.rangeFloat(0, Math.PI * 2);
    const px = Math.round(Math.cos(pa) * orbit * 1.7);
    const py = Math.round(Math.sin(pa) * orbit);
    if (p === playerPlanet) {
      cells.push({ x: px, y: py, glyph: '◆', tintKey: 'fgBright', weight: 1 });
    } else {
      cells.push({ x: px, y: py, glyph: '●', tintKey: accents[p % accents.length], weight: 0.8 });
    }
  }
  return cells;
}

/** Dispatch for the reveal: the impressionistic field for a given upper level.
 *  `cell` has its own real renderer and returns []. */
export function macroFieldFor(level: ScaleLevel, seed: number, stats: LibraryStats): MacroCell[] {
  switch (level) {
    case 'district':
      return districtField(seed, stats);
    case 'island':
      return islandField(seed, stats);
    case 'continent':
      return continentField(seed, stats);
    case 'planet':
      return planetField(seed, stats);
    case 'solar_system':
      return solarField(seed, stats);
    default:
      return [];
  }
}
