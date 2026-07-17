/**
 * Semantic colour roles (salience campaign, spec 2026-07-13).
 *
 * The visual-programme's pixel-verified finding: beings rendered at or
 * below furniture salience in every theme (the Archivist was darker than
 * the floor in IBM-3270). The fix is structural: beings own reserved
 * accent keys no decor may use (smoke-salience enforces it), and every
 * being/player/seam tint resolves through roleKey().
 *
 * Resolution order: theme.roles override → ROLE_DEFAULTS → caller
 * fallback. Roles map to palette KEYS, never colours — the one-palette
 * rule stays intact by construction.
 */

import type { PaletteKey, Theme, ThemeRole } from './types';

export const ROLE_DEFAULTS: Partial<Record<ThemeRole, PaletteKey>> = {
  player: 'fgBright',
  'being.loki': 'magenta',
  'being.archivist': 'violet',
  'being.cat': 'orange',
  'being.visitor': 'cyan',
  // The ghost is DELIBERATELY barely-there — a documented exception to
  // the beings-are-loud rule, not an oversight.
  'being.ghost': 'fgDim',
  // Ghost MARKS are a dim-but-distinct step (Harry, 2026-07-17): no accent
  // hue (dim), one ramp step above both the ghost's fgDim body and the
  // fgDim floor dust it sits on (distinct). Per-theme overridable.
  'mark.ghost': 'fg',
  // Apertures: door + window + seam caps share one dialect. (The
  // panel's admired "north seam marker" was the window tile, already
  // blue.)
  seam: 'blue',
  'decor.quiet': 'fgDim',
};

/** The reserved being accents: no tile-bible or scatter entry may use
 *  these keys (smoke-enforced). DERIVED from ROLE_DEFAULTS (being.*
 *  entries minus fgDim — shared infrastructure, the ghost's deliberate
 *  dimness, so NOT reserved). Value is unchanged from the hand-kept list
 *  the salience campaign shipped. */
export const BEING_ROLE_KEYS: readonly PaletteKey[] = Object.entries(ROLE_DEFAULTS)
  .filter(([role, key]) => role.startsWith('being.') && key !== 'fgDim')
  .map(([, key]) => key);

export function roleKey(theme: Theme, role: ThemeRole, fallback: PaletteKey): PaletteKey {
  return theme.roles?.[role] ?? ROLE_DEFAULTS[role] ?? fallback;
}
