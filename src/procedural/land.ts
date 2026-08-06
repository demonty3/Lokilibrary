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
import { fnv1a32 } from './seed';

// ── V0 spike knobs (PRD: Terminal Terraria visual direction) ──────────────
// The tuning dials Harry iterates between screenshot rounds.
const HALL_GLYPH_RAMP = '.:-=+*#%░▒▓█'; // luminance-field vocabulary, sparse → dense
const HALL_JITTER = 0.45; // noise mixed into the field (0 = clean bands)
const SKY_SCATTER_TIER2 = 0.1; // fraction of scatter in the bright tier
const SKY_SCATTER_DIM = ['·', '.', "'", ','];
const SKY_SCATTER_BRIGHT = ['✦', '*'];
const HALL_W = 50; // mural-bearing hall; poster is 46×14, so 2-cell inset each side
const HALL_H = 24;
const POSTER_W = 46;
const POSTER_H = 14;

// Land polish #19 slice 2: the mastered-game monument — real architecture
// (cap course, window slits, block body, ground-level door) instead of the
// old bare column. 3 wide × 7 tall + crown: still the tallest structure
// class. Exported for smoke-land-monument + smoke-glyph-coverage.
export const MONUMENT_BODY = ['╔═╗', '║▪║', '║ ║', '║▪║', '▐█▌', '▐█▌', '▐█▌'] as const;
export const MONUMENT_CROWN = '☼';
export const MONUMENT_DOOR = '▯';

/** #19 slice 2 constellation figures — [dx, dy] offsets; point 0 is the
 *  bright anchor (`✦`), the rest dim (`·`). Arrangements of the existing
 *  star roles, so blank-sky packs stay blank by construction. Exported for
 *  scripts/smoke-land-constellations.mts. */
export const CONSTELLATIONS = [
  [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1]],         // the W
  [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [4, 2]], // the plough
  [[0, 2], [1, 1], [2, 0], [3, 1]],                 // the arc
] as const; // as const, NOT an explicit annotation — bare [0, 1] literals widen to number[] and break the [dx, dy] destructuring

export type EngagementState = 'loved' | 'recent' | 'mastered' | 'dusty' | 'abandoned';

export interface LandGame {
  name: string;
  state: EngagementState;
  /** Steam appid for the CDN recognition surface (mural). Absent = no mural. */
  appid?: number;
}

/** Every cell carries a role; the renderer maps role -> palette key. */
export type LandRole =
  | 'sky'
  | 'star'
  | 'starBright'
  | 'skyDither'
  | 'hall'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'ridge'
  | 'ridgeFar'
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
  | 'edge'
  | 'mural'       // reserved interior of the framed mural (blank in the model; pixels are render-side)
  | 'muralFrame'  // the box-drawing frame + name cartouche
  | 'wingSil'     // skyline silhouette of a wing with no open terminal (land polish #19)
  | 'wingMark'      // the faint wing id under its silhouette
  | 'monumentCrown' // the monument's ☼ finial (#19 slice 2 — own role, so packs choose crown visibility independently of their sky)
  | 'door'          // the monument's ground-level opening (glyph-locked; the future launcher beat lands here)
  | 'ore'           // mineral glints in stone/bedrock (#19 slice 2)
  | 'signpost';     // standing post at a surface site — the proximity label's furniture (#19 slice 2)

/** A labelled site: where a game's name is drawn, for renderers that manage
 *  label visibility themselves (the terminal land's proximity reveal). */
export interface LandSite {
  /** Centre column — the same x `structureColumns` derives for intents. */
  readonly x: number;
  /** The row the (possibly truncated) label text is drawn on. */
  readonly y: number;
  /** The drawn text (≤7 chars). */
  readonly text: string;
  readonly kind: 'surface' | 'buried';
}

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
  /** Labelled sites (surface structures + buried relics), in draw order. */
  readonly sites: ReadonlyArray<LandSite>;
  /** V0 spike: per-cell luminance step (0 dim … 3 bright) for SHADED roles
   *  (the hall's vertical gradient), parallel to `char`. Only present when
   *  composed with `hall: true`. */
  readonly shade?: ReadonlyArray<ReadonlyArray<0 | 1 | 2 | 3>>;
  /** V0 spike: cell rect on the hall face where the renderer mounts the ANSI
   *  capsule mural. Only present when composed with `hall: true`. */
  readonly poster?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Murals #16: INTERIOR cell rect + the flagship's identity. Present only
   *  when composed with `mural: true` and the window fits. */
  readonly mural?: {
    readonly x: number; readonly y: number; readonly w: number; readonly h: number;
    readonly appid: number; readonly name: string;
  };
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
  /** Murals #16: stamp the flagship game's framed mural rect into the sky
   *  (frame + cartouche in the model; PIXELS are render-side). Default
   *  absent = byte-identical output to pre-slice. */
  readonly mural?: boolean;
  /** When terminal wings are JOINED, ramp the named edge(s)'s last
   *  SEAM_BLEND_COLS columns to a boundary height shared with the neighbour
   *  (its wing seed). Absent / {} = today's independent silhouette (single
   *  window / outer edges / web preview). Both edges may be set (a middle
   *  terminal in a chain); the two ramp regions never overlap. */
  readonly join?: { readonly left?: number; readonly right?: number };
  /** Land polish #19: wings that EXIST but have no open terminal window —
   *  each gets a faint far-ridge silhouette + wing-id mark, so the desk shows
   *  the library's unexplored extent. Absent / [] = byte-identical output.
   *  Placement is per-wing deterministic (own salted PRNG per wing id), so a
   *  silhouette never moves when a DIFFERENT wing opens or closes. */
  readonly skyline?: readonly string[];
}

const BEINGS = ['L', 'A', 'M', 'C', 'V'];

/** A small built-in library so the renderer/harness can preview with no
 *  profile. Real callers pass the profile's engagement-tagged games. */
export const SAMPLE_LAND: LandGame[] = [
  { name: 'hades', state: 'loved', appid: 1145360 },
  { name: 'stardew', state: 'recent', appid: 413150 },
  { name: 'hollow', state: 'mastered', appid: 367520 },
  { name: 'disco', state: 'dusty', appid: 632470 },
  { name: 'wilds', state: 'abandoned', appid: 753640 },
  { name: 'spire', state: 'recent', appid: 646570 },
  { name: 'civ', state: 'dusty', appid: 289070 },
  { name: 'celeste', state: 'abandoned' },
];

/** PRNG namespace for the shared land-seam boundary — distinct from every
 *  other src/procedural salt (cell 0xce11 · scatter 0x5ca7 · loki 0x10ce ·
 *  landmark 0x1a4d · clusters 0xc1a5/0xc0a5 · cell-seam 0x5ea3). */
const LAND_SEAM_SALT = 0x5a11;
/** Columns over which a joined edge ramps to the shared seam height. */
const SEAM_BLEND_COLS = 6;

/** PRNG namespace for the far ridge plane — distinct from every other
 *  src/procedural salt (cell 0xce11 · scatter 0x5ca7 · loki 0x10ce ·
 *  landmark 0x1a4d · clusters 0xc1a5/0xc0a5 · cell-seam 0x5ea3 ·
 *  land-seam 0x5a11). */
const RIDGE_FAR_SALT = 0xfa42;

/** PRNG namespace for the sky dither field (reserved-salt list as above,
 *  plus 0xfa42). */
const SKY_DITHER_SALT = 0xd174;

/** PRNG namespace for the celestial pass — stars, sun, moon, clouds — so sky
 *  tuning never reshuffles the terrain stream again (reserved-salt list as
 *  above, plus 0xfa42 and 0xd174). */
const SKY_SALT = 0x57a5;

/** PRNG namespace for the closed-wing skyline — folded per WING ID, not the
 *  land seed, so every window agrees where wing dN's silhouette stands
 *  (reserved-salt list as above, plus 0x57a5). */
const WING_SIL_SALT = 0x5117;
/** Silhouette vocabulary — small far-structure masses from block + quadrant
 *  elements. Exported for scripts/smoke-glyph-coverage.mts (atlas gate). */
export const WING_SIL_SHAPES = ['▟█▙', '▄██▄', '▟██▄', '▄█▙'] as const;

export const MURAL_INTERIOR_W = 22;
export const MURAL_INTERIOR_H = 5;
const MURAL_MIN_COLS = 32;
const MURAL_MIN_SKY = 9;
const MURAL_NAME_MAX = 16;

/** The one moon (celestial pass). U+263E — atlas-verified; `☀` is NOT in the
 *  Cozette atlas, never swap to it. Enumerated in smoke-glyph-coverage.mts. */
export const MOON_GLYPH = '☾';

/** Star probability for a sky row: densest at the zenith, quadratically
 *  fading to 0 by the ridge line — the inverse shape of skyDitherDensity.
 *  PURE — the smokeable band function. */
export function starDensity(row: number, skyH: number): number {
  if (skyH <= 1 || row < 0 || row >= skyH - 1) return 0;
  const t = row / (skyH - 1);
  return 0.08 * (1 - t) * (1 - t);
}

/** Dither vocabulary, light → heavy (all long-covered by the Cozette atlas;
 *  enumerated in scripts/smoke-glyph-coverage.mts). */
export const SKY_DITHER_GLYPHS = ['.', '·', '░'] as const;

/** Scatter probability for a sky row: 0 at the zenith, ramping quadratically
 *  to ~0.22 at the horizon row. PURE — the smokeable band function. */
export function skyDitherDensity(row: number, skyH: number): number {
  if (skyH <= 1 || row <= 0 || row >= skyH) return 0;
  const t = row / (skyH - 1);
  return 0.22 * t * t;
}

/** Glyph for sky-depth t∈[0,1] (0 zenith → 1 horizon): light → heavy. */
export function skyDitherGlyph(t: number): string {
  return t < 0.45 ? SKY_DITHER_GLYPHS[0] : t < 0.8 ? SKY_DITHER_GLYPHS[1] : SKY_DITHER_GLYPHS[2];
}

/** Cubic Hermite on t∈[0,1]: endpoint values p0,p1 and tangents m0,m1
 *  (already scaled to the [0,1] parameter interval). */
function hermite(t: number, p0: number, m0: number, p1: number, m1: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

/** The shared ground boundary two joined wings agree on. PURE + SYMMETRIC —
 *  landSeamBoundary(a,b) === landSeamBoundary(b,a) (canonical seed order), so
 *  each window computes the identical seam height + slope independently at
 *  snap, with no negotiation. Returned in RELIEF units (offset above the
 *  ground line, same ±2.4 scale as the surface sine field). */
export function landSeamBoundary(seedA: number, seedB: number): { height: number; slope: number } {
  const lo = Math.min(seedA >>> 0, seedB >>> 0);
  const hi = Math.max(seedA >>> 0, seedB >>> 0);
  const rng = mulberry32((fnv1a32(`${lo}:${hi}`) ^ LAND_SEAM_SALT) >>> 0);
  return {
    height: rng.rangeFloat(-1.8, 1.8), // within the surface-relief band
    slope: rng.rangeFloat(-0.5, 0.5), // gentle tangent (relief units / column)
  };
}

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
  const baseRelief = (x: number): number =>
    1.6 * Math.sin(x * 0.09 + phase) + 0.8 * Math.sin(x * 0.21 + phase * 2);
  const baseSlope = (x: number): number =>
    0.144 * Math.cos(x * 0.09 + phase) + 0.168 * Math.cos(x * 0.21 + phase * 2);

  // Joined edges ramp to a boundary shared with the neighbour so the two
  // silhouettes meet at the same height + slope (Terrain-Diffusion's shared-
  // coordinate idea, folded from both wing seeds — see landSeamBoundary).
  const K = SEAM_BLEND_COLS;
  const rightJoin = opts.join?.right !== undefined ? landSeamBoundary(seed, opts.join.right) : null;
  const leftJoin = opts.join?.left !== undefined ? landSeamBoundary(seed, opts.join.left) : null;
  const reliefAt = (x: number): number => {
    if (rightJoin && x > cols - 1 - K) {
      const t = (x - (cols - 1 - K)) / K; // 0 at ramp start → 1 at the seam col
      return hermite(t, baseRelief(cols - 1 - K), baseSlope(cols - 1 - K) * K, rightJoin.height, rightJoin.slope * K);
    }
    if (leftJoin && x < K) {
      const t = x / K; // 0 at the seam col → 1 at ramp end
      return hermite(t, leftJoin.height, leftJoin.slope * K, baseRelief(K), baseSlope(K) * K);
    }
    return baseRelief(x);
  };
  const surfaceY = (x: number) => groundLine - Math.round(reliefAt(x));
  const surfaceRows: number[] = Array.from({ length: cols }, (_, x) => surfaceY(x));

  /** Suppress structures/labels in the blend columns so only ground + fill move. */
  const inJoinBuffer = (x: number): boolean =>
    (rightJoin !== null && x >= cols - 1 - K) || (leftJoin !== null && x <= K);

  // --- Celestial pass: stars, sun, moon, clouds — its own salted PRNG so
  // sky tuning never touches the terrain stream. Star density is zenith-
  // heavy (inverse of the dither ramp); sun/cloud rows are PROPORTIONAL to
  // SKY_H (at the walkLand default SKY_H=7 they reproduce the old rows 2/4).
  // Two luminance tiers: dim punctuation everywhere, the odd bright ✦/*.
  const skyRng = mulberry32((seed ^ SKY_SALT) >>> 0);
  for (let y = 0; y < SKY_H - 1; y++) {
    for (let x = 0; x < cols; x++) {
      if (skyRng.next() < starDensity(y, SKY_H)) {
        if (skyRng.next() < SKY_SCATTER_TIER2) set(x, y, skyRng.pick(SKY_SCATTER_BRIGHT), 'starBright');
        else set(x, y, skyRng.pick(SKY_SCATTER_DIM), 'star');
      }
    }
  }
  const sunX = skyRng.range(8, cols - 12);
  set(sunX, skyRng.range(0, Math.max(1, Math.floor(SKY_H / 3))), '☼', 'sun');
  // Moon row starts at 1: the terminal drag strip overlays most of row 0.
  const moonY = skyRng.range(1, Math.max(2, Math.floor(SKY_H / 4) + 1));
  let moonX = skyRng.range(2, cols - 2);
  if (Math.abs(moonX - sunX) < 8) moonX = 2 + ((moonX + Math.floor(cols / 2)) % Math.max(1, cols - 4));
  set(moonX, moonY, MOON_GLYPH, 'moon');
  const cloudRow1 = Math.max(1, Math.round(SKY_H * 0.3));
  const cloudRow2 = Math.min(SKY_H - 1, Math.max(cloudRow1 + 1, Math.round(SKY_H * 0.55)));
  put(skyRng.range(6, cols - 24), cloudRow1, '~ ~~~~ ~', 'cloud');
  put(skyRng.range(6, cols - 18), cloudRow2, '~~ ~~~', 'cloud');

  // Constellations (#19 slice 2): 2–3 recognisable figures stamped from the
  // star roles — arrangements, not material. Each figure clears the scatter
  // in its patch first (figures REPLACE scatter; local density stays calm)
  // and only lands where every point sits on a sky-register cell, so the
  // sun, moon and clouds always survive. ≤8 placement re-rolls (the skyline
  // precedent); a crowded sky keeps its scatter — a missing figure is fine.
  const clearable = (r: LandRole | undefined): boolean =>
    r === 'sky' || r === 'star' || r === 'starBright' || r === 'skyDither';
  const figureCount = skyRng.next() < 0.5 ? 2 : 3;
  for (let f = 0; f < figureCount; f++) {
    const fig = CONSTELLATIONS[f % CONSTELLATIONS.length];
    const fw = Math.max(...fig.map(([dx]) => dx)) + 1;
    const fh = Math.max(...fig.map(([, dy]) => dy)) + 1;
    let ox = 0;
    let oy = 0;
    let ok = false;
    for (let tries = 0; tries < 8 && !ok; tries++) {
      ox = skyRng.range(2, Math.max(3, cols - fw - 2));
      oy = skyRng.range(1, Math.max(2, Math.floor(SKY_H / 2)));
      ok = fig.every(([dx, dy]) => clearable(role[oy + dy]?.[ox + dx]));
    }
    if (!ok) continue;
    for (let yy = oy - 1; yy <= oy + fh; yy++)
      for (let xx = ox - 1; xx <= ox + fw; xx++)
        if (role[yy]?.[xx] === 'star' || role[yy]?.[xx] === 'starBright') set(xx, yy, ' ', 'sky');
    fig.forEach(([dx, dy], i) =>
      set(ox + dx, oy + dy, i === 0 ? '✦' : '·', i === 0 ? 'starBright' : 'star'));
  }

  // --- Far ridge plane (Tier 2 atmospheric perspective): a THIRD plane, one
  // faint ▁ hilltop line well above the near ridge, tinted nearest the sky
  // by the renderer's FAR_FADE. Its own salted PRNG so the main `rng`
  // sequence (silhouette, structures, caverns, seam ramp) is byte-untouched.
  const farRng = mulberry32((seed ^ RIDGE_FAR_SALT) >>> 0);
  const farPhase = farRng.rangeFloat(0, 6.283);
  for (let x = 0; x < cols; x++) {
    const fy = groundLine - 4 - Math.round(0.9 * Math.sin(x * 0.05 + farPhase) + 0.8);
    if (role[fy]?.[x] === 'sky') set(x, fy, '▁', 'ridgeFar');
  }

  // --- Parallax ridge: a distant hill silhouette behind the structures -----
  // A second, gentler height field a couple rows above the true ground line,
  // drawn dim — gives the sky depth + kills the dead-air letterbox feel.
  // A THIN silhouette (hilltop line + one row of body) so sky shows above it
  // and it never smears into the surface band behind the structures. The
  // NEARER plane wins where it meets the far ridge.
  const ridgePhase = rng.rangeFloat(0, 6.283);
  const behindRidge = (r: LandRole | undefined): boolean => r === 'sky' || r === 'ridgeFar';
  for (let x = 0; x < cols; x++) {
    const ry = groundLine - 2 - Math.round(1.1 * Math.sin(x * 0.07 + ridgePhase) + 0.6);
    if (behindRidge(role[ry]?.[x])) set(x, ry, '▁', 'ridge');
    if (behindRidge(role[ry + 1]?.[x])) set(x, ry + 1, '░', 'ridge');
  }

  // --- Dithered sky gradient (Tier 2): density-ramped ░·. scatter so the sky
  // reads as a gradient toward the horizon. Own salted PRNG (main rng
  // untouched); fills only cells still empty sky, so scatter stars, sun,
  // clouds and both ridge planes always sit in front. Structures drawn later
  // overwrite it, which is correct — they're nearer than the sky.
  // The ramp spans the FULL air column (down to the ground line), not just
  // the star band — with the raised horizon's tall sky, stopping at SKY_H
  // left a fog shelf floating over clean air (2026-07-30 eyeball).
  const ditherRng = mulberry32((seed ^ SKY_DITHER_SALT) >>> 0);
  for (let y = 0; y < groundLine; y++) {
    const d = skyDitherDensity(y, groundLine);
    if (d <= 0) continue;
    const tRow = groundLine > 1 ? y / (groundLine - 1) : 1;
    for (let x = 0; x < cols; x++) {
      if (ditherRng.next() < d && role[y][x] === 'sky') set(x, y, skyDitherGlyph(tRow), 'skyDither');
    }
  }

  // --- Terrain: clear bands + big carved caverns (calm, legible) -----------
  // Band maths are UNDER_H-relative so shallow bands (the terminal desk's
  // underH=4 raised horizon) keep all three strata; at underH=14 the
  // thresholds are byte-equivalent to the historical 2/7. Shallow bands
  // (underH<=5) pack denser and carve 1-row cavern pockets so what remains
  // below reads dense, not vestigial.
  const topsoilD = Math.max(1, Math.round(UNDER_H * 0.15));
  const stoneD = Math.max(topsoilD + 1, Math.round(UNDER_H * 0.5));
  const shallow = UNDER_H <= 5;
  const stoneFill = shallow ? 0.75 : 0.6;
  const stoneHeavy = shallow ? 0.5 : 0.4;
  const bedrockFill = shallow ? 0.5 : 0.4;
  const bedrockHeavy = shallow ? 0.35 : 0.28;
  const cavTop = groundLine + Math.max(2, Math.round(UNDER_H * 0.45));
  const caverns = Array.from({ length: 6 }, () => ({
    cx: rng.range(8, cols - 8),
    cy: cavTop + rng.range(0, Math.max(1, groundLine + UNDER_H - 1 - cavTop)),
    rx: 5 + rng.range(0, 6),
    ry: shallow ? 1 : 2 + rng.range(0, 2),
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
      if (depth <= topsoilD) set(x, y, r < 0.45 ? '▒' : '░', 'topsoil'); // thin, light
      else if (depth <= stoneD) {
        if (r < stoneFill) set(x, y, r < stoneHeavy ? '▓' : '▒', 'stone'); // mostly solid, some gaps
      } else {
        if (r < bedrockFill) set(x, y, r < bedrockHeavy ? '▓' : '░', 'bedrock'); // dark, sparse
      }
    }
  }

  // --- Surface structures, keyed to engagement (bigger, more presence) -----
  const labels: Array<{ x: number; y: number; text: string; kind: 'surface' | 'buried' }> = [];
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
      labels.push({ x: hallCx, y: surfaceY(hallCx), text: p.name, kind: 'surface' }); // the hall stands here
      return;
    }
    if (hallSpan && x >= hallSpan[0] - 3 && x <= hallSpan[1] + 3) return; // don't draw into the hall
    if (inJoinBuffer(x)) return; // structure-free seam buffer
    if (p.state === 'mastered') {
      // #19 slice 2: architecture rows top→bottom, door punched into the
      // bottom-centre cell, crown on its OWN role (a pack's sun-omit no
      // longer blanks it — gameboy-dmg omits monumentCrown explicitly).
      MONUMENT_BODY.forEach((row, i) => put(x - 1, gy - MONUMENT_BODY.length + i, row, 'monument'));
      set(x, gy - 1, MONUMENT_DOOR, 'door');
      set(x, gy - MONUMENT_BODY.length - 1, MONUMENT_CROWN, 'monumentCrown');
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
    labels.push({ x, y: gy, text: p.name, kind: 'surface' });
  });

  // --- A descent shaft into the caverns ------------------------------------
  const shaftX = slot * 2 + 2;
  for (let y = surfaceY(shaftX); y < rows; y++) set(shaftX, y, y % 2 ? '‖' : '╫', 'shaft');

  // --- Abandoned games rest DEEP (relics) ----------------------------------
  // Depth is UNDER_H-relative: byte-identical to the historical rows-3-r at
  // underH=14, and clamped strictly below any crust cell (surface reaches at
  // most groundLine+2) at shallow bands.
  games
    .filter((p) => p.state === 'abandoned')
    .forEach((p, i) => {
      const x = slot * (2 + i * 2) + rng.range(0, 6);
      const y = Math.max(groundLine + 3, groundLine + UNDER_H - 2 - rng.range(0, 3));
      set(x - 1, y, '≡', 'relic');
      labels.push({ x, y: Math.min(y + 1, rows - 1), text: p.name, kind: 'buried' });
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
    if (inJoinBuffer(x)) continue; // no trees in the seam buffer
    const gy = surfaceY(x);
    set(x, gy - 1, '♣', 'foliage');
    set(x, gy - 2, '♣', 'foliage');
  }

  // --- Labels last, on a cleared strip so they read ------------------------
  // Surface labels sit in the FIRST ROW BELOW the strip's deepest crust cell
  // (the surface varies ±2 across a strip, so a fixed row could eat a
  // neighbouring column's crust) — the ground line stays continuous at every
  // labelled column. Buried labels keep their relic-adjacent row. Each drawn
  // label is exported on `model.sites` so a renderer can manage visibility
  // (the terminal land's proximity reveal) without re-deriving placement.
  const sites: LandSite[] = [];
  for (const { x, y, text, kind } of labels) {
    const s = text.slice(0, 7);
    const start = x - Math.floor(s.length / 2);
    let ly = y;
    if (kind === 'surface') {
      let maxSy = 0;
      for (let i = -1; i <= s.length; i++) {
        const cx = Math.min(cols - 1, Math.max(0, start + i));
        maxSy = Math.max(maxSy, surfaceY(cx));
      }
      ly = Math.min(rows - 1, maxSy + 1);
    }
    for (let i = -1; i <= s.length; i++) set(start + i, ly, ' ', 'sky');
    for (let i = 0; i < s.length; i++) set(start + i, ly, s[i], 'label');
    sites.push({ x, y: ly, text: s, kind });
  }

  // --- Skyline of closed wings (land polish #19 slice 1) -------------------
  // Faint silhouettes on the far-ridge plane for wings with no open terminal.
  // Zero draws from the main/sky streams (per-wing salted PRNG — no stream
  // shift; opts.skyline absent is byte-identical). Draws only over sky-plane
  // cells (sky / skyDither / ridgeFar) so structures, labels and terrain
  // always win; the mural pass runs after and mechanically evicts anything
  // inside its cleared rect.
  if (opts.skyline !== undefined && opts.skyline.length > 0) {
    const skyPlane = (x: number, y: number): boolean => {
      const r = role[y]?.[x];
      // Scatter stars sit BEHIND a horizon mass (a star shining through a
      // silhouette reads broken); clouds/moon/sun stay in front — nearer sky.
      return r === 'sky' || r === 'skyDither' || r === 'ridgeFar' || r === 'star' || r === 'starBright';
    };
    const lo = K + 2;
    const hi = cols - 2 - K;
    // Placement fit: every shape + mark cell must be sky-plane or an EARLIER
    // wing's silhouette (masses may merge; the world never yields). Re-rolled
    // deterministically per wing, so a tall structure at the hashed column
    // can't leave a wing unrepresented — and other wings' cells count as
    // passable, so each wing's final spot is independent of the closed set.
    const passable = (x: number, y: number): boolean => {
      const r = role[y]?.[x];
      return skyPlane(x, y) || r === 'wingSil' || r === 'wingMark';
    };
    for (const w of opts.skyline) {
      const silRng = mulberry32((fnv1a32(w) ^ WING_SIL_SALT) >>> 0);
      const shape = silRng.pick(WING_SIL_SHAPES);
      const mark = w.slice(0, 4);
      if (hi - lo < shape.length + 2) continue; // window too narrow for a skyline
      let cx = 0;
      let sy = 0;
      let fits = false;
      for (let attempt = 0; attempt < 8 && !fits; attempt++) {
        cx = lo + silRng.range(0, hi - lo - shape.length);
        sy = groundLine - 5 - silRng.range(0, 2); // on/above the far-ridge band
        const mx0 = cx + Math.floor((shape.length - mark.length) / 2);
        fits = sy >= 1;
        for (let i = 0; fits && i < shape.length; i++) fits = passable(cx + i, sy);
        for (let i = 0; fits && i < mark.length; i++) fits = passable(mx0 + i, sy + 1);
      }
      if (sy < 1) continue; // keep clear of the drag-strip row on tiny skies
      // No clean spot after 8 rolls: draw best-effort at the last candidate
      // (clipped by whatever is nearer — the pre-fit behaviour).
      for (let i = 0; i < shape.length; i++)
        if (skyPlane(cx + i, sy)) set(cx + i, sy, shape[i], 'wingSil');
      const mx = cx + Math.floor((shape.length - mark.length) / 2);
      for (let i = 0; i < mark.length; i++)
        if (skyPlane(mx + i, sy + 1)) set(mx + i, sy + 1, mark[i], 'wingMark');
    }
  }

  // --- Mural frame + cartouche (Murals #16) --------------------------------
  let mural: LandModel['mural'];
  if (opts.mural) {
    const flagship = games.find((g) => g.state !== 'abandoned');
    if (flagship?.appid !== undefined && cols >= MURAL_MIN_COLS && SKY_H >= MURAL_MIN_SKY) {
      const name = flagship.name.slice(0, MURAL_NAME_MAX);
      const ox = Math.floor((cols - (MURAL_INTERIOR_W + 2)) / 2); // outer left col
      const oy = 2; // outer top row (sky row 2 — clear of the drag strip)
      // Clear the outer rect (sky decorations mechanically evicted), then frame.
      for (let y = oy; y < oy + MURAL_INTERIOR_H + 2; y++)
        for (let x = ox; x < ox + MURAL_INTERIOR_W + 2; x++) set(x, y, ' ', 'sky');
      put(ox, oy, '╔' + '═'.repeat(MURAL_INTERIOR_W) + '╗', 'muralFrame');
      for (let y = oy + 1; y <= oy + MURAL_INTERIOR_H; y++) {
        set(ox, y, '║', 'muralFrame');
        set(ox + MURAL_INTERIOR_W + 1, y, '║', 'muralFrame');
        for (let x = ox + 1; x <= ox + MURAL_INTERIOR_W; x++) set(x, y, ' ', 'mural');
      }
      const cart = `╡ ${name} ╞`; // ╡ U+2561 / ╞ U+255E — atlas-verified (coverage smoke)
      const pad = MURAL_INTERIOR_W - cart.length;
      const left = Math.floor(pad / 2);
      put(ox, oy + MURAL_INTERIOR_H + 1,
        '╚' + '═'.repeat(left) + cart + '═'.repeat(pad - left) + '╝', 'muralFrame');
      mural = { x: ox + 1, y: oy + 1, w: MURAL_INTERIOR_W, h: MURAL_INTERIOR_H, appid: flagship.appid, name };
    }
  }

  return {
    width: cols,
    height: rows,
    char,
    role,
    surface: surfaceRows,
    sites,
    ...(shade ? { shade } : {}),
    ...(poster ? { poster } : {}),
    ...(mural ? { mural } : {}),
  };
}
