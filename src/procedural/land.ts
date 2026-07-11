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

// ── V0 spike knobs (PRD: Terminal Terraria visual direction) ──────────────
// The tuning dials Harry iterates between screenshot rounds.
const HALL_GLYPH_RAMP = '.:-=+*#%░▒▓█'; // luminance-field vocabulary, sparse → dense
const HALL_JITTER = 0.45; // noise mixed into the field (0 = clean bands)
const SKY_SCATTER_DENSITY = 0.04; // PRD ~4% of sky cells
const SKY_SCATTER_TIER2 = 0.1; // fraction of scatter in the bright tier
const SKY_SCATTER_DIM = ['·', '.', "'", ','];
const SKY_SCATTER_BRIGHT = ['✦', '*'];
const HALL_W = 50; // mural-bearing hall; poster is 46×14, so 2-cell inset each side
const HALL_H = 24;
const POSTER_W = 46;
const POSTER_H = 14;

export type EngagementState = 'loved' | 'recent' | 'mastered' | 'dusty' | 'abandoned';

export interface LandGame {
  name: string;
  state: EngagementState;
}

/** Every cell carries a role; the renderer maps role -> palette key. */
export type LandRole =
  | 'sky'
  | 'star'
  | 'starBright'
  | 'hall'
  | 'sun'
  | 'cloud'
  | 'ridge'
  | 'crust'
  | 'topsoil'
  | 'stone'
  | 'deep'
  | 'bedrock'
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
  /** Surface row (the crust `▀`) per column — where a being stands is row-1.
   *  Lets a movable player walk the terrain without re-deriving the field. */
  readonly surface: ReadonlyArray<number>;
  /** V0 spike: per-cell luminance step (0 dim … 3 bright) for SHADED roles
   *  (the hall's vertical gradient), parallel to `char`. Only present when
   *  composed with `hall: true`. */
  readonly shade?: ReadonlyArray<ReadonlyArray<0 | 1 | 2 | 3>>;
  /** V0 spike: cell rect on the hall face where the renderer mounts the ANSI
   *  capsule mural. Only present when composed with `hall: true`. */
  readonly poster?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export interface ComposeLandOptions {
  readonly width?: number; // world width in cells (may exceed the viewport — scrolls)
  readonly skyH?: number;
  readonly surfaceBand?: number;
  readonly underH?: number;
  /** Bake a static `@` into the scene (default true). A movable LandView passes
   *  false and owns its own player sprite. */
  readonly withPlayer?: boolean;
  /** V0 spike: replace the first surface game's structure with the mural-
   *  bearing HALL — a glyph luminance field with a vertical gradient and a
   *  poster rect for the ANSI capsule. Default false (walkLand untouched). */
  readonly hall?: boolean;
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
  // Proportions tuned so the viewport fills a screen rather than letterboxing:
  // deeper sky (parallax) + deeper strata, a moderate width that scrolls.
  const W = opts.width ?? 80;
  const SKY_H = opts.skyH ?? 7;
  const SURFACE_BAND = opts.surfaceBand ?? 5;
  const UNDER_H = opts.underH ?? 14;

  const rng = mulberry32(seed >>> 0);
  const rows = SKY_H + SURFACE_BAND + 1 + UNDER_H;
  const cols = W;
  const groundLine = SKY_H + SURFACE_BAND;

  const char: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
  const role: LandRole[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'sky' as LandRole));
  const shade: Array<Array<0 | 1 | 2 | 3>> | undefined = opts.hall
    ? Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as 0 | 1 | 2 | 3))
    : undefined;
  const set = (x: number, y: number, c: string, r: LandRole) => {
    if (y >= 0 && y < rows && x >= 0 && x < cols) {
      char[y][x] = c;
      role[y][x] = r;
    }
  };
  const put = (x: number, y: number, s: string, r: LandRole) => {
    for (let i = 0; i < s.length; i++) set(x + i, y, s[i], r);
  };

  // Rolling horizon — deterministic height field (a touch more relief).
  const phase = rng.rangeFloat(0, 6.283);
  const surfaceY = (x: number) =>
    groundLine - Math.round(1.6 * Math.sin(x * 0.09 + phase) + 0.8 * Math.sin(x * 0.21 + phase * 2));
  const surfaceRows: number[] = Array.from({ length: cols }, (_, x) => surfaceY(x));

  // --- Sky: seeded scatter (PRD V0 — no dead cells), two cloud bands, a sun.
  // Two luminance tiers: dim punctuation everywhere, the odd bright ✦/*.
  for (let y = 0; y < SKY_H - 1; y++) {
    for (let x = 0; x < cols; x++) {
      if (rng.next() < SKY_SCATTER_DENSITY) {
        if (rng.next() < SKY_SCATTER_TIER2) set(x, y, rng.pick(SKY_SCATTER_BRIGHT), 'starBright');
        else set(x, y, rng.pick(SKY_SCATTER_DIM), 'star');
      }
    }
  }
  set(rng.range(8, cols - 12), rng.range(0, 2), '☼', 'sun');
  put(rng.range(6, cols - 24), 2, '~ ~~~~ ~', 'cloud');
  put(rng.range(6, cols - 18), 4, '~~ ~~~', 'cloud');

  // --- Parallax ridge: a distant hill silhouette behind the structures -----
  // A second, gentler height field a couple rows above the true ground line,
  // drawn dim — gives the sky depth + kills the dead-air letterbox feel.
  // A THIN silhouette (hilltop line + one row of body) so sky shows above it
  // and it never smears into the surface band behind the structures.
  const ridgePhase = rng.rangeFloat(0, 6.283);
  for (let x = 0; x < cols; x++) {
    const ry = groundLine - 2 - Math.round(1.1 * Math.sin(x * 0.07 + ridgePhase) + 0.6);
    if (role[ry]?.[x] === 'sky') set(x, ry, '▁', 'ridge');
    if (role[ry + 1]?.[x] === 'sky') set(x, ry + 1, '░', 'ridge');
  }

  // --- Terrain: clear bands + big carved caverns (calm, legible) -----------
  const caverns = Array.from({ length: 6 }, () => ({
    cx: rng.range(8, cols - 8),
    cy: groundLine + 6 + rng.range(0, Math.max(1, UNDER_H - 5)),
    rx: 5 + rng.range(0, 6),
    ry: 2 + rng.range(0, 2),
  }));
  const inCavern = (x: number, y: number) =>
    caverns.some((c) => ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 < 1);
  for (let x = 0; x < cols; x++) {
    const sy = surfaceY(x);
    set(x, sy, '▀', 'crust');
    for (let y = sy + 1; y < rows; y++) {
      const depth = y - sy;
      if (inCavern(x, y)) {
        if (rng.next() < 0.05) set(x, y, '░', 'cavern');
        continue;
      }
      const r = rng.next();
      if (depth <= 2) set(x, y, r < 0.45 ? '▒' : '░', 'topsoil'); // thin, light
      else if (depth <= 7) {
        if (r < 0.6) set(x, y, r < 0.4 ? '▓' : '▒', 'stone'); // mostly solid, some gaps
      } else {
        if (r < 0.4) set(x, y, r < 0.28 ? '▓' : '░', 'bedrock'); // dark, sparse
      }
    }
  }

  // --- Surface structures, keyed to engagement (bigger, more presence) -----
  const labels: Array<{ x: number; y: number; text: string }> = [];
  const surface = games.filter((p) => p.state !== 'abandoned');
  const slot = Math.floor(cols / (surface.length + 1));

  // --- V0 spike: the mural-bearing HALL — a glyph LUMINANCE FIELD, not an
  // outline. Dense glyphs low / sparse high; `shade` carries the vertical
  // gradient (0 dim at the top → 3 bright at the base) for the renderer's
  // per-step tint. Centred on the strip (the hero-shot anchor; the static
  // player stands at its base); represents the first surface game, whose
  // poster rect receives that game's ANSI capsule mural.
  let hallSpan: readonly [number, number] | null = null;
  let hallCx = 0;
  let poster: LandModel['poster'];
  if (opts.hall && shade && surface.length > 0) {
    hallCx = Math.floor(cols / 2);
    const x0 = Math.max(1, hallCx - Math.floor(HALL_W / 2));
    const x1 = Math.min(cols - 2, x0 + HALL_W - 1);
    hallSpan = [x0, x1];
    let minSurface = rows;
    for (let x = x0; x <= x1; x++) minSurface = Math.min(minSurface, surfaceY(x));
    const top = Math.max(1, minSurface - HALL_H);
    const span = Math.max(1, minSurface - top - 1);
    for (let x = x0; x <= x1; x++) {
      for (let y = top; y < surfaceY(x); y++) {
        const fromTop = (y - top) / span; // 0 top → 1 base
        const t = Math.min(1, Math.max(0, fromTop + (rng.next() - 0.5) * HALL_JITTER));
        const idx = Math.min(HALL_GLYPH_RAMP.length - 1, Math.floor(t * HALL_GLYPH_RAMP.length));
        set(x, y, HALL_GLYPH_RAMP[idx], 'hall');
        shade[y][x] = Math.min(3, Math.floor(fromTop * 4)) as 0 | 1 | 2 | 3;
      }
    }
    // Poster slot, centred on the face: a dim placeholder fill so the scene
    // reads before (or without) the capsule image.
    const px0 = x0 + Math.floor((x1 - x0 + 1 - POSTER_W) / 2);
    const py0 = top + 3;
    poster = { x: px0, y: py0, w: POSTER_W, h: POSTER_H };
    for (let y = py0; y < py0 + POSTER_H; y++) {
      for (let x = px0; x < px0 + POSTER_W; x++) {
        set(x, y, HALL_GLYPH_RAMP[0], 'hall');
        shade[y][x] = 0;
      }
    }
  }

  surface.forEach((p, i) => {
    const x = slot * (i + 1) + rng.range(-2, 3);
    const gy = surfaceY(x);
    if (hallSpan && i === 0) {
      labels.push({ x: hallCx, y: surfaceY(hallCx), text: p.name }); // the hall stands here
      return;
    }
    if (hallSpan && x >= hallSpan[0] - 3 && x <= hallSpan[1] + 3) return; // don't draw into the hall
    if (p.state === 'mastered') {
      for (let h = 1; h <= 6; h++) put(x - 1, gy - h, h === 6 ? ' ║ ' : '▐█▌', 'monument');
      set(x, gy - 7, '☼', 'sun');
    } else if (p.state === 'loved') {
      put(x - 2, gy - 3, '▗▄▄▄▖', 'roof');
      put(x - 2, gy - 2, '▌▓≡▓▐', 'shelf');
      put(x - 2, gy - 1, '▌▓≡▓▐', 'shelf');
      set(x + 4, gy - 1, '☼', 'sun');
    } else if (p.state === 'recent') {
      put(x - 1, gy - 2, '▟▙', 'roof');
      put(x - 1, gy - 1, '⌂', 'cottage');
    } else {
      put(x - 1, gy - 2, '♣♣', 'foliage');
      set(x, gy - 1, '⌂', 'cottage');
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
      const y = rows - 3 - rng.range(0, 3);
      set(x - 1, y, '≡', 'relic');
      labels.push({ x, y: Math.min(y + 1, rows - 1), text: p.name });
    });

  // --- Beings walk the surface; player @ near centre -----------------------
  for (let k = 0; k < 5; k++) {
    const x = rng.range(6, cols - 6);
    set(x, surfaceY(x) - 1, rng.pick(BEINGS), 'being');
  }
  if (opts.withPlayer !== false) {
    const px = Math.floor(cols / 2);
    set(px, surfaceY(px) - 1, '@', 'player');
  }

  // --- Edges: open scrolling world (carets), trees soften the top ----------
  set(0, surfaceY(0) - 1, '‹', 'edge');
  set(cols - 1, surfaceY(cols - 1) - 1, '›', 'edge');
  for (let t = 0; t < 4; t++) {
    const x = rng.range(4, cols - 4);
    if (hallSpan && x >= hallSpan[0] && x <= hallSpan[1]) continue; // not inside the hall
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

  return {
    width: cols,
    height: rows,
    char,
    role,
    surface: surfaceRows,
    ...(shade ? { shade } : {}),
    ...(poster ? { poster } : {}),
  };
}
