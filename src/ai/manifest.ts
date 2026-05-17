/**
 * Stage 1 world manifest — the contract the renderer reads.
 *
 * Server-side validation lives in worker/lib/manifest.ts. By the time the
 * frontend sees a Manifest it has already been validated against the template
 * whitelist; we trust the shape here and treat unexpected fields defensively
 * only at parse time.
 *
 * Phase 5 slice 2: `position` is gone. Positions are derived deterministically
 * client-side from the behavioral profile via src/procedural/seaside.ts. The
 * share-URL contract depends on the renderer NOT trusting position data from
 * the manifest — same profile must give the same world, every time.
 */

export type TemplateId = 'seaside_town';

export type SeasideArchetype =
  | 'lighthouse'
  | 'fish_market'
  | 'detectives_office'
  | 'harbour_masters_hut'
  | 'fishing_boat';

export interface ManifestCastingEntry {
  appid: number;
  archetype: SeasideArchetype;
  role: string;
}

export interface Manifest {
  template: TemplateId;
  metaphor: string;
  casting: ManifestCastingEntry[];
}
