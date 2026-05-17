import type { LibraryState } from '../../types';

/**
 * State-keyed styling parameters for archetype components. SPEC §4 maps
 * library state to visual treatment; this module is the one place where
 * those mappings live so the 5 archetype components share a consistent
 * read of "loved looks warm-and-glowing, abandoned looks unlit."
 *
 * - Outer-group `scale` is applied at the archetype root.
 * - `interiorIntensity` multiplies the archetype's own internal emissive
 *   surfaces (lantern, screen, signboard, …). 0 = lights off, 1 = normal,
 *   >1 = boosted (loved games glow more than default).
 * - `aura`, `plaque`, `tarp` are the universal accents StateAccents renders.
 *
 * `dusty` styling exists for the v0.4+ backlog-cluster slice — `dusty`
 * by definition means zero playtime, so it cannot appear in the top-N
 * manifest casting. The styling is intentional dead code until the
 * dusty cluster lands.
 */
export interface StateStyleParams {
  scale: number;
  interiorIntensity: number;
  aura: { color: string; intensity: number; distance: number; pulse: boolean } | null;
  plaque: boolean;
  tarp: boolean;
}

const DEFAULT: StateStyleParams = {
  scale: 1.0,
  interiorIntensity: 1.0,
  aura: null,
  plaque: false,
  tarp: false,
};

export function styleFor(state: LibraryState | undefined): StateStyleParams {
  switch (state) {
    case 'loved':
      // Top decile + recently played + past main. Worn paths lead here.
      return {
        scale: 1.08,
        interiorIntensity: 1.35,
        aura: { color: '#ffba6a', intensity: 14, distance: 11, pulse: true },
        plaque: false,
        tarp: false,
      };
    case 'mastered':
      // >80% achievements or HLTB completionist met. Museum-case treatment.
      return {
        scale: 1.0,
        interiorIntensity: 1.0,
        aura: null,
        plaque: true,
        tarp: false,
      };
    case 'recent':
      // Played in last 7 days; not (yet) loved. Soft fresh glow.
      return {
        scale: 1.0,
        interiorIntensity: 1.05,
        aura: { color: '#a0c8ff', intensity: 5, distance: 7, pulse: false },
        plaque: false,
        tarp: false,
      };
    case 'abandoned':
      // 1–5h then dropped >90d ago, < 0.3 of main story. Mid-sentence, unlit.
      return {
        scale: 0.97,
        interiorIntensity: 0,
        aura: null,
        plaque: false,
        tarp: false,
      };
    case 'dusty':
      // Owned, never opened. Tarped — see "dead code" caveat above.
      return {
        scale: 0.9,
        interiorIntensity: 0,
        aura: null,
        plaque: false,
        tarp: true,
      };
    case 'default':
    case undefined:
    default:
      return DEFAULT;
  }
}
