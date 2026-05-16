/**
 * Per-template whitelist of shippable assets. The Worker uses this both to
 * constrain the Stage 1 prompt and to validate the manifest after parsing —
 * if the LLM returns an archetype we don't ship, we reject it server-side and
 * the frontend falls back to a stub. CLAUDE.md: "The LLM never picks something
 * we don't have."
 *
 * Audio + skybox whitelists arrive at Phase 5 alongside the audio baking pass.
 */

export const SEASIDE_ARCHETYPES = [
  'lighthouse',
  'fish_market',
  'detectives_office',
  'harbour_masters_hut',
  'fishing_boat',
] as const;
export type SeasideArchetype = (typeof SEASIDE_ARCHETYPES)[number];

export const TEMPLATE_WHITELIST = {
  seaside_town: {
    archetypes: SEASIDE_ARCHETYPES,
  },
} as const;

export type TemplateId = keyof typeof TEMPLATE_WHITELIST;

export function isValidArchetype(template: TemplateId, archetype: string): boolean {
  return (TEMPLATE_WHITELIST[template].archetypes as readonly string[]).includes(archetype);
}
