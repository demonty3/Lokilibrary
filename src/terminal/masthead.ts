/**
 * T3 slice 2 — the masthead's content, pure and PIXI-free
 * (docs/superpowers/specs/2026-08-09-t3-slice2-design.md). Same posture as
 * edgePart.ts; scripts/smoke-masthead.mts drives it headlessly.
 *
 * The wing label used to be a DOM strip in system monospace on a black band,
 * byte-identical in every window after slice 1 had given each one its own
 * palette. This module answers what the row SAYS; terminalLand.ts draws it in
 * Cozette in the window's own pack.
 *
 * Three runs: the wing, who is here, and what the wing holds.
 */

import type { EngagementState, LandGame } from '../procedural/land';
import { SOCIETY_IDS } from './society';

/** Columns of margin at each end of the row. */
export const MAST_PAD_COLS = 1;
/** Columns between the wing label and the residents run. */
export const MAST_GAP_COLS = 2;

/** `┤ d0 ├` — the land's own edge vocabulary, so the title is written in the
 *  same glyphs the world is. */
export function wingLabel(wing: string): string {
  return `┤ ${wing} ├`;
}

/**
 * Engagement as a ramp of BAR HEIGHTS, not shade densities.
 *
 * The spec proposed the scale ladder's shade vocabulary (`▓ loved · ▒ engaged
 * · ░ tried · · dusty`, render/levels/ladderCompose.ts) plus a step for
 * `mastered`. Built and shot, it failed on the desk: five adjacent dither
 * cells at `fgDim` read as a patch of texture — the pinned crust-legibility
 * finding (a shade-dither band reads as letter-noise) resurfacing on a new
 * surface. Evidence: `t3-ramp1.png` beside `t3-ramp2.png` in
 * `docs/design-reviews/2026-08-09-t3-slice2/`. The ladder's glyphs earn their
 * keep beside a legend that names them; this row has no legend, so the reuse
 * bought consistency and cost the read.
 *
 * Heights carry the same five steps with no dither at all, and a row of them
 * reads as a bar chart at a glance rather than as terrain that wandered into
 * the sky.
 *
 * Deliberately NOT a restatement of the architecture: land.ts already gives
 * every state a structure. Five cells say the one thing the structures cannot
 * — the wing's shape as a collection, in five characters.
 */
export const ENGAGEMENT_GLYPH: Record<EngagementState, string> = {
  mastered: '█',
  loved: '▆',
  recent: '▄',
  dusty: '▂',
  abandoned: '▁',
};

export function holdingsRamp(games: readonly LandGame[]): string {
  return games.map((g) => ENGAGEMENT_GLYPH[g.state]).join('');
}

/** Who the row draws: present, not away, in COHORT order so an arrival never
 *  reshuffles the glyphs already standing there. */
export function mastheadResidents(
  beings: ReadonlyArray<{ id: string; present: boolean; away: boolean }>,
): string[] {
  const here = new Set(beings.filter((b) => b.present && !b.away).map((b) => b.id));
  return SOCIETY_IDS.filter((id) => here.has(id));
}
