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
  | 'seam'
  | 'decor.quiet';

export interface Theme {
  id: string;
  name: string;
  palette: ThemePalette;
  /** Optional per-theme role overrides (see ThemeRole). */
  roles?: Partial<Record<ThemeRole, PaletteKey>>;
}
