import type { ComponentType } from 'react';
import type { SeasideArchetype } from '../../ai/manifest';
import type { LibraryState } from '../../types';
import { Lighthouse } from './Lighthouse';
import { FishMarket } from './FishMarket';
import { DetectivesOffice } from './DetectivesOffice';
import { HarbourMastersHut } from './HarbourMastersHut';
import { FishingBoat } from './FishingBoat';

export interface ArchetypeComponentProps {
  appid: number;
  name: string;
  position: [number, number];
  /** SPEC §4 library state. Drives the per-archetype visual treatment
   *  introduced in Phase 4 — loved games glow, abandoned ones go dark,
   *  mastered games get a plaque. */
  state?: LibraryState;
}

/**
 * Registry mapping archetype IDs (from the manifest whitelist) to React
 * components. The whitelist is enforced server-side (worker/lib/whitelist.ts),
 * but we also fail loud here if a new archetype lands in the schema before its
 * component does.
 */
export const ARCHETYPE_COMPONENTS: Record<SeasideArchetype, ComponentType<ArchetypeComponentProps>> = {
  lighthouse: Lighthouse,
  fish_market: FishMarket,
  detectives_office: DetectivesOffice,
  harbour_masters_hut: HarbourMastersHut,
  fishing_boat: FishingBoat,
};
