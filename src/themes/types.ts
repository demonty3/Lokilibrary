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

export interface Theme {
  id: string;
  name: string;
  palette: ThemePalette;
}
