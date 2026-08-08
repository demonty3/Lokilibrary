/**
 * Which style pack a terminal wears (T3 slice 1, PRD § T3 "per-terminal
 * theming hooks — one theme per terminal scene, themes may differ BETWEEN
 * terminals; the join edge is the boundary").
 *
 * Before this, `TerminalApp.tsx` hard-coded `phosphor` for every window and
 * the spawn URL never carried a theme, so ten authored packs, five style
 * slots, a 370-assertion gate and a published blueprint were unreachable from
 * the product: every terminal on the desk looked identical.
 *
 * **Assignment is renderer-side and derived from the wing id**, which is why
 * this needs no config field, no IPC and no broker round-trip. A wing already
 * seeds its own terrain the same way (`terminalLand.ts:440`), so "same wing →
 * same land" and "same wing → same pack" come from one idea; the choice
 * survives quit/relaunch for free, and a terminal opened at any time matches
 * what its neighbours already believe about it. `?theme=` still overrides, for
 * side-by-side comparisons and for picking a pack deliberately.
 *
 * Pure + Pixi-free so scripts/smoke-pack-assignment.mts can run it.
 */

import { THEMES, THEME_IDS } from '../themes';
import type { Theme } from '../themes/types';

/** The pack a fresh desk's FIRST wing wears. Pinned rather than hashed: every
 *  judged shot, the README's demo GIF and the daylight-register authoring all
 *  show `phosphor`, so a stranger's first window keeps the look the project
 *  has actually been eyeballed on. Variety starts at the second wing. */
export const FIRST_WING_PACK = 'phosphor';

/**
 * Two packs may share a desk only if their `landOmit` sets are identical.
 *
 * From the two-pack seam spike (docs/design-reviews/2026-08-08-two-pack-seam.md):
 * four pairings against `phosphor` — `amber-crt` at 1.2× sky luminance,
 * `catppuccin-mocha` at 4.7× and `gruvbox-dark` at 7.1× all read as one world
 * seen through two machines; `gameboy-dmg` at 9.9× read as broken. `gruvbox`
 * was run to separate the variables and passes despite being nearly as bright
 * as DMG, so **shared content is the discriminator, not brightness**: DMG
 * deletes `star`/`moon`/`cloud` and eight more, so at a seam one side carries a
 * starfield and the other an empty field, at the same instant, in one
 * continuous space.
 *
 * **Deliberately stricter than the measured finding.** The evidence is about
 * SKY content specifically; this compares the whole `landOmit`, which would
 * also exclude a pack that omitted only ground furniture. No shipped pack
 * distinguishes the two cases (DMG is the only pack with any omission at all),
 * and the strict form needs no sky/ground taxonomy to maintain. If a
 * ground-only omitting pack ever ships, relax this with that pack in hand
 * rather than inventing the category now.
 */
export function packsCompatible(a: Theme, b: Theme): boolean {
  const key = (t: Theme): string => [...(t.landOmit ?? [])].sort().join(',');
  return key(a) === key(b);
}

/**
 * The packs a multi-window desk draws from, in assignment order: everything
 * compatible with `FIRST_WING_PACK`, that pack first. Derived from the
 * registry rather than listed, so a new pack joins the rotation by existing —
 * and an omitting one stays out of it without anyone remembering to.
 */
export const DESK_PACK_POOL: readonly string[] = (() => {
  const first = THEMES[FIRST_WING_PACK];
  const rest = THEME_IDS.filter((id) => id !== FIRST_WING_PACK && packsCompatible(THEMES[id], first));
  return Object.freeze([FIRST_WING_PACK, ...rest]);
})();

/** FNV-1a over the wing id — the fallback ordering for a wing that is not
 *  `d<number>`. terminalLand.ts:396 keeps its own identical copy for seeds;
 *  this module stays dependency-light for the same reason. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The pack for `wing`. Deterministic and total.
 *
 * The desk names its wings `d0`…`d5` (`WINGS` in desktop/src/terminals.ts), so
 * the numeric suffix indexes the pool directly — `d0` gets `FIRST_WING_PACK`
 * and the rest step through it in registry order, which makes the desk's look
 * predictable rather than merely deterministic (a hash would scatter, and
 * "which pack is d3?" should be answerable without running the hash). Any other
 * wing id falls back to the hash so the function is total.
 */
export function deskPackFor(wing: string): string {
  const m = /^d(\d+)$/.exec(wing);
  const i = m ? Number(m[1]) : fnv1a(wing);
  return DESK_PACK_POOL[i % DESK_PACK_POOL.length];
}
