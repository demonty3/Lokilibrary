import solarizedDark from './solarized.json';
import gruvboxDark from './gruvbox-dark.json';
import catppuccinMocha from './catppuccin-mocha.json';
import tokyoNight from './tokyo-night.json';
import ibm3270 from './ibm-3270.json';
import phosphor from './phosphor.json';
import type { Theme } from './types';

/**
 * Theme registry. Add new theme JSONs to the THEMES object below; the
 * JSON's `id` is the public key. DEFAULT_THEME_ID is the boot palette;
 * Phase 1 has no user-facing picker yet, so swap this constant + reload
 * to compare themes during dev.
 */

export const THEMES: Readonly<Record<string, Theme>> = Object.freeze({
  'solarized-dark':   solarizedDark as Theme,
  'gruvbox-dark':     gruvboxDark as Theme,
  'catppuccin-mocha': catppuccinMocha as Theme,
  'tokyo-night':      tokyoNight as Theme,
  'ibm-3270':         ibm3270 as Theme,
  'phosphor':         phosphor as Theme,
});

/**
 * Theme ids as a literal tuple — the single source of truth for the
 * theme-palette whitelist. `THEMES` is typed as `Record<string, Theme>`, so
 * `keyof typeof THEMES` widens to `string`; this tuple keeps the literal
 * union for whitelist checks (Phase 5D lore palette bias). Kept in lockstep
 * with `THEMES` above — the 5D lore smoke asserts `THEME_IDS` deep-equals
 * `Object.keys(THEMES)` to catch drift.
 */
export const THEME_IDS = [
  'solarized-dark',
  'gruvbox-dark',
  'catppuccin-mocha',
  'tokyo-night',
  'ibm-3270',
  'phosphor',
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID = 'solarized-dark';

export function getById(id: string): Theme {
  const theme = THEMES[id];
  if (!theme) {
    throw new Error(
      `[themes] unknown theme id "${id}" — available: ${Object.keys(THEMES).join(', ')}`,
    );
  }
  return theme;
}
