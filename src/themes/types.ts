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
}

/** Normalised fx list — the renderer and the conformance smoke both read fx
 *  through this, so string and array forms stay equivalent. */
export function themeFxList(theme: Theme): readonly ThemeFx[] {
  if (theme.fx === undefined) return [];
  return typeof theme.fx === 'string' ? [theme.fx] : theme.fx;
}
