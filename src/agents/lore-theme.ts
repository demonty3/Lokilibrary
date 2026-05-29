import { buildLoreProfile } from './lore-profile';
import { DEFAULT_THEME_ID, type ThemeId } from '../themes';
import type { MemoryWriter } from './router';

/**
 * Phase 5D.4 — local lore palette recolor.
 *
 * Resolves the world's theme palette deterministically from the lore
 * corpus: the top-ranked suggestedTilePaletteBias entry, or the boot
 * default when there is no lore. Pure + sync: delegates to
 * buildLoreProfile (which forbids Date.now / Math.random), so the
 * same corpus always yields the same ThemeId. LOCAL only — reads the
 * writer's loreCount()/recentLore() on-device; nothing egresses.
 * Independent of loreEnabled (palette recolor needs no opt-in).
 */
export function themeFromLore(
  writer: Pick<MemoryWriter, 'recentLore' | 'loreCount'>,
): ThemeId {
  return buildLoreProfile(writer).suggestedTilePaletteBias[0] ?? DEFAULT_THEME_ID;
}
