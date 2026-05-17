import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import type { Manifest, SeasideArchetype } from './manifest';

/**
 * Offline fallback. Used when the Worker isn't running or Stage 1 fails — the
 * scene still renders so you can iterate on visuals without burning API credits
 * (CLAUDE.md: "The frontend without the Worker still renders the scene with a
 * stub manifest").
 *
 * Casting is hard-mapped by index for deterministic v0.1 behavior. Phase 5's
 * procedural layer replaces these positions with a seeded layout.
 */
const STUB_CASTING: Array<{
  archetype: SeasideArchetype;
  role: string;
  position: [number, number];
}> = [
  { archetype: 'lighthouse',           role: 'You tend the lantern here on the longest nights.',          position: [-12, -6] },
  { archetype: 'fish_market',          role: "The stalls reopen at dawn; you've memorised every catch.", position: [  5, -4] },
  { archetype: 'detectives_office',    role: 'The case file on the desk has your handwriting on it.',     position: [-3, -10] },
  { archetype: 'harbour_masters_hut',  role: 'The logbook is yours. Every ship in the harbour passes through it.', position: [10, -2] },
  { archetype: 'fishing_boat',         role: 'The boat is rigged, the tide is right.',                    position: [11,  6] },
  { archetype: 'lighthouse',           role: 'A second beacon — fewer ships find this one, but the ones that do never leave.', position: [-14, 4] },
  { archetype: 'fish_market',          role: 'The far stall: rarer catches, longer wagers.',              position: [ 7,  3] },
];

export const STUB_MANIFEST: Manifest = {
  template: 'seaside_town',
  metaphor: 'A weather-worn harbour town where each light in the windows is a game you keep coming back to.',
  casting: SAMPLE_LIBRARY.slice(0, STUB_CASTING.length).map((game, i) => ({
    appid: game.appid,
    archetype: STUB_CASTING[i].archetype,
    role: STUB_CASTING[i].role,
    position: STUB_CASTING[i].position,
  })),
};
