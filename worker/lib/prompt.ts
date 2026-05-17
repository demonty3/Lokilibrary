/**
 * Stage 1 prompt builder. The Worker is the single AI orchestration surface
 * (CLAUDE.md / SPEC §6.1); the frontend never assembles prompts directly.
 *
 * For v0.1 the input is a hard-coded library + an effectively empty profile.
 * Phase 2 fills the profile from real Steam + HLTB data; Phase 3 adds IGDB
 * enrichment; Phase 5 drops `position` from the schema and moves placement to
 * `src/procedural/`.
 */

import { TEMPLATE_WHITELIST, type TemplateId } from './whitelist';

export interface StageOneInput {
  template: TemplateId;
  profile: {
    /** From Phase 2 — for v0.1 this stays sparse. */
    summary?: string;
  };
  games: Array<{
    appid: number;
    name: string;
    /** Phase 4 will derive this from playtime + recency; v0.1 leaves it absent. */
    state?: 'loved' | 'recent' | 'mastered' | 'abandoned' | 'dusty';
  }>;
}

const SYSTEM = `You are casting a small inhabitable 3D world for a single Steam library. Each game becomes one diegetic object — a lighthouse, a fish market, a detective's office. Your job is to pick a metaphor and cast each game.

You MUST return JSON only. No prose, no markdown fence, no commentary. The output validates against this shape:

{
  "metaphor": string,              // 1-sentence organising idea for the scene
  "casting": [
    {
      "appid": number,             // exactly matches one game in input
      "archetype": string,         // one of the template's archetype IDs
      "role": string,              // 1-2 sentence in-world role text, second person
      "position": [number, number] // [x, z] in meters, -16 to 16; y is derived
    }
  ]
}

Hard rules:
- archetype MUST be drawn from the supplied whitelist for the template. If a game doesn't fit naturally, pick the closest fit — never invent.
- Distinct games can share an archetype (two lighthouses, one for each long-loved game).
- role text is diegetic ("you tend the lantern here") — never names the game, never breaks frame.
- positions must not overlap (keep >=4 meters between any two).
- Output MUST be a single JSON object. No prefix, no suffix, no trailing comma.`;

export function buildStageOnePrompt(input: StageOneInput): { system: string; user: string } {
  const tmpl = TEMPLATE_WHITELIST[input.template];
  const user = [
    `Template: ${input.template}`,
    `Allowed archetypes: ${tmpl.archetypes.join(', ')}`,
    '',
    `Profile: ${input.profile.summary ?? '(none — v0.1 hard-coded library)'}`,
    '',
    'Games:',
    ...input.games.map((g) => `- appid ${g.appid}: ${g.name}${g.state ? ` [state: ${g.state}]` : ''}`),
    '',
    'Return the JSON manifest now.',
  ].join('\n');
  return { system: SYSTEM, user };
}
