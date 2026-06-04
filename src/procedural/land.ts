/**
 * Side-on "wide land" composer (2026-06 perspective realignment).
 *
 * The memory palace as a LAND you cross, not a building you face: a horizontal
 * world (wider than the screen; scrolls L<->R) with a rolling horizon, the
 * library's games as surface structures keyed to engagement state, and
 * underground strata you descend into where ABANDONED games rest deep.
 *
 * Library-state -> place (the memory-palace thesis, made spatial):
 *   loved / recent -> tended structure on the surface
 *   mastered       -> a monument/tower (the tallest things)
 *   dusty          -> overgrown surface structure (vines)
 *   abandoned      -> a relic resting in the caverns below
 *
 * PURE + deterministic (mulberry32; Math.sin for the horizon is deterministic —
 * the `src/procedural` no-Math.random rule is about reproducibility, which sin
 * preserves). Emits a ROLE-TAGGED grid so the renderer tints each layer from
 * the active theme palette; this module is glyph + role only, never colour.
 */

import { mulberry32 } from './prng';

export type EngagementState = 'loved' | 'recent' | 'mastered' | 'dusty' | 'abandoned';

export interface LandGame {
  name: string;
  state: EngagementState;
}

/** Every cell carries a role; the renderer maps role -> palette key. */
export type LandRole =
  | 'sky'
  | 'star'
  | 'sun'
  | 'cloud'
  | 'crust'
  | 'topsoil'
  | 'stone'
  | 'deep'
  | 'cavern'
  | 'shelf'
  | 'roof'
  | 'monument'
  | 'cottage'
  | 'foliage'
  | 'relic'
  | 'being'
  | 'player'
  | 'label'
  | 'shaft'
  | 'edge';

export interface LandModel {
  readonly width: number;
  readonly height: number;
  /** Glyph per cell (' ' = nothing drawn). */
  readonly char: ReadonlyArray<ReadonlyArray<string>>;
  /** Role per cell, parallel to `char` ('sky' = background, not drawn). */
  readonly role: ReadonlyArray<ReadonlyArray<LandRole>>;
}

export interface ComposeLandOptions {
  readonly width?: number; // visible slice width in cells
  readonly skyH?: number;
  readonly surfaceBand?: number;
  readonly underH?: number;
}

const BEINGS = ['L', 'A', 'M', 'C', 'V'];

/** A small built-in library so the renderer/harness can preview with no
 *  profile. Real callers pass the profile's engagement-tagged games. */
export const SAMPLE_LAND: LandGame[] = [
  { name: 'hades', state: 'loved' },
  { name: 'stardew', state: 'recent' },
  { name: 'hollow', state: 'mastered' },
  { name: 'disco', state: 'dusty' },
  { name: 'wilds', state: 'abandoned' },
  { name: 'spire', state: 'recent' },
  { name: 'civ', state: 'dusty' },
  { name: 'celeste', state: 'abandoned' },
];

export function composeLand(
  seed: number,
  games: readonly LandGame[] = SAMPLE_LAND,
  opts: ComposeLandOptions = {},
): LandModel {
  const W = opts.width ?? 92;
  const SKY_H = opts.skyH ?? 5;
  const SURFACE_BAND = opts.surfaceBand ?? 4;
  const UNDER_H = opts.underH ?? 9;

  const rng = mulberry32(seed >>> 0);
  const rows = SKY_H + SURFACE_BAND + 1 + UNDER_H;
  const cols = W;
  const groundLine = SKY_H + SURFACE_BAND;

  const char: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
  const role: LandRole[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'sky' as LandRole));
  const set = (x: number, y: number, c: string, r: LandRole) => {
    if (y >= 0 && y < rows && x >= 0 && x < cols) {
      char[y][x] = c;
      role[y][x] = r;
    }
  };
  const put = (x: number, y: number, s: string, r: LandRole) => {
    for (let i = 0; i < s.length; i++) set(x + i, y, s[i], r);
  };

  // Rolling horizon — deterministic height field.
  const phase = rng.rangeFloat(0, 6.283);
  const surfaceY = (x: number) =>
    groundLine - Math.round(1.3 * Math.sin(x * 0.1 + phase) + 0.7 * Math.sin(x * 0.23 + phase * 2));

  // --- Sky: sparse stars, drifting cloud, one sun --------------------------
  for (let y = 0; y < SKY_H; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rng.next();
      if (y <= 1 && r < 0.03) set(x, y, '·', 'star');
      else if (y >= 1 && y <= 2 && r < 0.012) set(x, y, '~', 'cloud');
    }
  }
  set(rng.range(8, cols - 12), rng.range(0, 2), '☼', 'sun');
  put(rng.range(20, cols - 24), 2, '~ ~~~ ~', 'cloud');

  // --- Terrain: calm strata with carved caverns ----------------------------
  const caverns = Array.from({ length: 4 }, () => ({
    cx: rng.range(8, cols - 8),
    cy: groundLine + 5 + rng.range(0, Math.max(1, UNDER_H - 4)),
    rx: 4 + rng.range(0, 4),
    ry: 1 + rng.range(0, 2),
  }));
  const inCavern = (x: number, y: number) =>
    caverns.some((c) => ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 < 1);
  for (let x = 0; x < cols; x++) {
    const sy = surfaceY(x);
    set(x, sy, '▀', 'crust');
    for (let y = sy + 1; y < rows; y++) {
      const depth = y - sy;
      if (inCavern(x, y)) {
        if (rng.next() < 0.06) set(x, y, '░', 'cavern');
        continue;
      }
      const r = rng.next();
      if (depth <= 2) set(x, y, r < 0.4 ? '▒' : '░', 'topsoil');
      else if (depth <= 5) set(x, y, r < 0.82 ? '▓' : '▒', 'stone');
      else if (r < 0.62) set(x, y, r < 0.5 ? '▓' : '░', 'deep');
    }
  }

  // --- Surface structures, keyed to engagement -----------------------------
  const labels: Array<{ x: number; y: number; text: string }> = [];
  const surface = games.filter((p) => p.state !== 'abandoned');
  const slot = Math.floor(cols / (surface.length + 1));
  surface.forEach((p, i) => {
    const x = slot * (i + 1) + rng.range(-3, 4);
    const gy = surfaceY(x);
    if (p.state === 'mastered') {
      for (let h = 1; h <= 4; h++) set(x, gy - h, '║', 'monument');
      set(x, gy - 5, '☼', 'sun');
    } else if (p.state === 'loved') {
      put(x - 1, gy - 2, '▄▄▄', 'roof');
      put(x - 1, gy - 1, '▓≡▓', 'shelf');
      set(x + 3, gy - 1, '☼', 'sun');
    } else if (p.state === 'recent') {
      set(x - 1, gy - 1, '⌂', 'cottage');
    } else {
      set(x - 1, gy - 1, '⌂', 'cottage');
      set(x, gy - 2, '♣', 'foliage');
      set(x + 1, gy - 1, '♣', 'foliage');
    }
    labels.push({ x, y: gy, text: p.name });
  });

  // --- A descent shaft into the caverns ------------------------------------
  const shaftX = slot * 2 + 2;
  for (let y = surfaceY(shaftX); y < rows; y++) set(shaftX, y, y % 2 ? '‖' : '╫', 'shaft');

  // --- Abandoned games rest DEEP (relics) ----------------------------------
  games
    .filter((p) => p.state === 'abandoned')
    .forEach((p, i) => {
      const x = slot * (2 + i * 2) + rng.range(0, 6);
      const y = rows - 2 - rng.range(0, 2);
      set(x - 1, y, '≡', 'relic');
      labels.push({ x, y: Math.min(y + 1, rows - 1), text: p.name });
    });

  // --- Beings walk the surface; player @ near centre -----------------------
  for (let k = 0; k < 4; k++) {
    const x = rng.range(6, cols - 6);
    set(x, surfaceY(x) - 1, rng.pick(BEINGS), 'being');
  }
  const px = Math.floor(cols / 2);
  set(px, surfaceY(px) - 1, '@', 'player');

  // --- Edges: open scrolling world (carets), trees soften the top ----------
  set(0, surfaceY(0) - 1, '‹', 'edge');
  set(cols - 1, surfaceY(cols - 1) - 1, '›', 'edge');
  for (let t = 0; t < 3; t++) {
    const x = rng.range(4, cols - 4);
    const gy = surfaceY(x);
    set(x, gy - 1, '♣', 'foliage');
    set(x, gy - 2, '♣', 'foliage');
  }

  // --- Labels last, on a cleared strip so they read ------------------------
  for (const { x, y, text } of labels) {
    const s = text.slice(0, 7);
    const start = x - Math.floor(s.length / 2);
    for (let i = -1; i <= s.length; i++) set(start + i, y, ' ', 'sky');
    for (let i = 0; i < s.length; i++) set(start + i, y, s[i], 'label');
  }

  return { width: cols, height: rows, char, role };
}
