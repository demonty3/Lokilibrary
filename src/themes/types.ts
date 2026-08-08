/**
 * Terminal theme — palette + font binding. Each theme ships as a JSON file
 * under src/themes/ (e.g. solarized.json). Phase 1 will add Gruvbox,
 * Catppuccin, Tokyo Night, IBM-3270 alongside.
 *
 * `bg`/`fg` are the terminal foreground/background. The accent colours
 * (yellow/red/blue/...) follow the standard 16-colour terminal palette so
 * themes can be slotted in without each sprite atlas knowing the source
 * palette by name.
 */
import type { LandRole } from '../procedural/land';

/** The fx whitelist — the only flags the renderer implements. Widen this
 *  tuple (and the renderer) deliberately; the conformance smoke reads it. */
export const THEME_FX = ['scanlines', 'glow'] as const;
export type ThemeFx = (typeof THEME_FX)[number];

export interface ThemePalette {
  bg: string;
  bgAlt: string;
  fgDim: string;
  fg: string;
  fgBright: string;
  yellow: string;
  orange: string;
  red: string;
  magenta: string;
  violet: string;
  blue: string;
  cyan: string;
  green: string;
}

export type PaletteKey = keyof ThemePalette;

/** Salience campaign (spec 2026-07-13): semantic colour roles. A role
 *  resolves to an EXISTING palette key — never a new colour — so the
 *  one-palette rule stays structural. Themes may override per-role in
 *  their JSON via `roles`; src/themes/roles.ts carries the uniform
 *  defaults. */
export type ThemeRole =
  | 'player'
  | 'being.loki'
  | 'being.archivist'
  | 'being.cat'
  | 'being.visitor'
  | 'being.ghost'
  | 'mark.ghost'
  | 'seam'
  | 'decor.quiet';

export interface Theme {
  id: string;
  name: string;
  palette: ThemePalette;
  /** Optional per-theme role overrides (see ThemeRole). */
  roles?: Partial<Record<ThemeRole, PaletteKey>>;
  /** Style-pack glyph dialect (docs/blueprints/style-pack.md): per-land-role
   *  glyph overrides, applied at render time via landRoleGlyph() in
   *  src/render/levels/land.ts. Roles in LAND_GLYPH_LOCKED are never
   *  overridden; values are single Cozette-covered glyphs (conformance-
   *  smoked by scripts/smoke-style-pack.mts). The procedural model is
   *  untouched — determinism holds. */
  landGlyphs?: Partial<Record<LandRole, string>>;
  /** Style-pack fx slot: 'scanlines' lays a static CRT line field over the
   *  terminal-land window; 'glow' blooms bright glyphs via a single-pass
   *  filter on the desk's world container. String or array (combos like
   *  ["glow","scanlines"]); read through themeFxList(). Absent = no fx.
   *  Widen ThemeFx deliberately, not by prompt. */
  fx?: ThemeFx | readonly ThemeFx[];
  /** Style-pack value-ramp slot: opted-in land roles render as four
   *  luminance-stepped layers (top dim → base bright, step derived from the
   *  role's vertical extent at render time — the procedural model is
   *  untouched). `factors` scale the role's RESOLVED fill; the conformance
   *  smoke enforces darken-only (ascending, last exactly 1.0), so step 3 is
   *  byte-identical to the unramped colour and the being-salience bars stay
   *  sound. Roles in LAND_RAMP_LOCKED (src/render/levels/land.ts) cannot
   *  ramp. */
  landRamp?: {
    readonly roles: readonly LandRole[];
    /** Exactly 4 (gate-enforced; JSON modules can't carry a tuple type). */
    readonly factors?: readonly number[];
  };
  /** Style-pack omission slot: land roles the pack deletes from the drawn
   *  scene (a blank DMG sky, a stroke-only scope). Render-side only — the
   *  procedural model is untouched, so determinism, sites and intents hold
   *  (beings still path to an omitted structure; its label still reveals).
   *  Roles in LAND_OMIT_LOCKED (src/render/levels/land.ts) can never be
   *  omitted; at most OMIT_MAX roles (conformance-smoked). */
  landOmit?: readonly LandRole[];
  /** Style-pack daylight slot: the sky the pack shows at each end of the day,
   *  AUTHORED rather than computed. The world clock
   *  (`daylight()` in src/terminal/ambient.ts) interpolates night → twilight →
   *  day, so a pack expresses the hour in its own dialect — one machine
   *  brightens toward noon, another rotates hue at the same luminance, and a
   *  third does both.
   *
   *  Authored and not derived because a formula cannot answer the question
   *  that matters: the maximal hue rotation for solarized-dark is a dark red,
   *  which reads as sunset rather than midday. A person looking at the screen
   *  decides that; an engine cannot.
   *
   *  `night` MUST equal `palette.bg` exactly (conformance-smoked), which is
   *  what makes midnight byte-identical to the pre-daylight desk. The other
   *  two are free, up to what the frozen salience bars admit — every one of
   *  them re-runs against all three skies, so a pack whose noon costs more
   *  legibility than it owns fails the gate rather than the eyeball.
   *
   *  **Absent = the sky never moves**, which is legal *omission* of a shared
   *  truth rather than contradiction of one (the landOmit doctrine): some
   *  machines show the time of day, some don't. There is deliberately no
   *  global strength dial — an earlier attempt at one was killed at
   *  calibration, and the pack is now its own ceiling. */
  daySky?: DaySky;
}

/** The three authored stops of a pack's day. Interpolated on the daylight
 *  level, so `twilight` shows at dawn AND dusk — `daylight()` is symmetric and
 *  the desk is a stylised world, not an observatory. */
export interface DaySky {
  /** Must equal `palette.bg` exactly — see Theme.daySky. */
  readonly night: string;
  readonly twilight: string;
  readonly day: string;
}

/** Normalised fx list — the renderer and the conformance smoke both read fx
 *  through this, so string and array forms stay equivalent. */
export function themeFxList(theme: Theme): readonly ThemeFx[] {
  if (theme.fx === undefined) return [];
  return typeof theme.fx === 'string' ? [theme.fx] : theme.fx;
}
