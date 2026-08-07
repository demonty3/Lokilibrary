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
  /** Style-pack daylight slot: the palette key the sky lifts TOWARD at noon.
   *  The world clock (src/terminal/ambient.ts) mixes bg → this key, so a pack
   *  expresses daylight in its own dialect — amber-crt's `blue` is amber, so
   *  its noon is an amber sky. An existing key, never a new colour, so the
   *  one-palette rule stays structural (see ThemeRole above).
   *
   *  Absent = 'blue' (every palette has one). **`null` opts out**: the sky
   *  holds its `bg` at every hour. That is legal *omission* of a shared truth,
   *  not contradiction of one — the same doctrine as landOmit — and it is what
   *  keeps gameboy-dmg's judged blank LCD sky fixed, since `sky` sits in
   *  LAND_OMIT_LOCKED and landOmit cannot reach it. */
  daySky?: PaletteKey | null;
}

/** Normalised fx list — the renderer and the conformance smoke both read fx
 *  through this, so string and array forms stay equivalent. */
export function themeFxList(theme: Theme): readonly ThemeFx[] {
  if (theme.fx === undefined) return [];
  return typeof theme.fx === 'string' ? [theme.fx] : theme.fx;
}
