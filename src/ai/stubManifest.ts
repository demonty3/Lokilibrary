import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import type { Manifest, SeasideArchetype } from './manifest';

/**
 * Offline fallback. Used when the Worker isn't running or Stage 1 fails — the
 * scene still renders so you can iterate on visuals without burning API credits
 * (CLAUDE.md: "The frontend without the Worker still renders the scene with a
 * stub manifest").
 *
 * Phase 5 slice 2: positions are no longer here. The procedural layer in
 * src/procedural/seaside.ts assigns positions from a stub seed when no
 * profile is present (anonymous viewer), so every anonymous visitor sees the
 * same demo layout deterministically.
 */
const STUB_CASTING: Array<{ archetype: SeasideArchetype; role: string }> = [
  { archetype: 'lighthouse',          role: 'You tend the lantern here on the longest nights.' },
  { archetype: 'fish_market',         role: "The stalls reopen at dawn; you've memorised every catch." },
  { archetype: 'detectives_office',   role: 'The case file on the desk has your handwriting on it.' },
  { archetype: 'harbour_masters_hut', role: 'The logbook is yours. Every ship in the harbour passes through it.' },
  { archetype: 'fishing_boat',        role: 'The boat is rigged, the tide is right.' },
  { archetype: 'lighthouse',          role: 'A second beacon — fewer ships find this one, but the ones that do never leave.' },
  { archetype: 'fish_market',         role: 'The far stall: rarer catches, longer wagers.' },
];

export const STUB_MANIFEST: Manifest = {
  template: 'seaside_town',
  metaphor: 'A weather-worn harbour town where each light in the windows is a game you keep coming back to.',
  casting: SAMPLE_LIBRARY.slice(0, STUB_CASTING.length).map((game, i) => ({
    appid: game.appid,
    archetype: STUB_CASTING[i].archetype,
    role: STUB_CASTING[i].role,
  })),
};
