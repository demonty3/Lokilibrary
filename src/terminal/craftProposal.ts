/**
 * Dungeon rung 4 — the proposal channel's pure half
 * (docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md, bar 3).
 *
 * The deskProposal.ts posture: pure, PIXI-free, IPC-free, so
 * scripts/smoke-delve4.mts drives it headlessly. The proposal RIDES the
 * dispatcher's next reflection through the UNCHANGED routeTier2 — the
 * T5 pattern: a pressured wing's reflection sees one extra clause on
 * the topology line (the craft clause below), and this module extracts
 * the candidate from the plan the router stored. Zero new AI calls on
 * this half.
 *
 * Empty-mailbox principle: no craft step in the plan → null → nothing
 * surfaces. The machinery never invents a proposal to have something
 * to show. Whitelisting lives in craft.ts's validateCraftProposal — an
 * extracted-but-out-of-grammar proposal is an ESCAPE, recorded, never
 * repaired (the go/no-go's rule).
 */

import type { PlanStep } from '../agents/memory/schema';
import type { OutcomeKind } from './delve';
import { CRAFT_MODIFIERS, CRAFT_VERBS, verbMagMax, type CraftSkill } from './craft';

/** As parsed off the plan step — raw strings, validated by craft.ts. */
export interface RawCraftProposal {
  name: string;
  verb: string;
  modifier: string;
  magnitude: number;
}

const MAG_WORDS: Record<string, number> = { once: 1, twice: 2, thrice: 3 };
const MAG_NAMES = ['once', 'twice', 'thrice'] as const;

/** `craft: <name>: <verb> [once|twice|thrice] <modifier>` anywhere in a
 *  step's target, any step kind (content whitelist, not verb choice —
 *  live Sonnet wraps targets in prose, the T5 lesson). Lower-cased
 *  first; a flat working may omit its strength. */
const CRAFT_STEP_RE =
  /craft:\s*([a-z][a-z-]*)\s*:\s*([a-z]+)(?:\s+(once|twice|thrice))?\s+([a-z][a-z-]*)/;

export function extractCraftProposal(steps: readonly PlanStep[]): RawCraftProposal | null {
  for (const s of steps) {
    if (typeof s.target !== 'string') continue;
    const m = CRAFT_STEP_RE.exec(s.target.toLowerCase());
    if (!m) continue;
    return { name: m[1], verb: m[2], modifier: m[4], magnitude: m[3] ? MAG_WORDS[m[3]] : 1 };
  }
  return null;
}

/** What the notable delve was, in the clause's register. */
const PRESSURE_PHRASE: Record<OutcomeKind, string> = {
  lost: 'the party that never came back',
  loss: 'the delvers the deep kept',
  hollow: 'the empty-handed returns',
  rich: 'the haul the deep gave up',
};

/** Plain-words verb effects — mechanical, flavour-neutral (Addendum 2).
 *  What a verb does NOT do is the DM prompt's job (residue 2). */
const VERB_WORDS: Record<(typeof CRAFT_VERBS)[number], string> = {
  ward: 'ward eases the death-die while a delver stands exposed',
  press: 'press hastens the drive-off',
  veil: 'veil makes the lair likelier to stand empty',
  hold: 'hold stands the party one round longer before it breaks',
  break: 'break turns the party for home one round sooner',
  glean: 'glean lifts what each cleared step gives back',
  salvage: 'salvage keeps more of a fleeing party\'s sacks',
};

const MODIFIER_WORDS: Record<(typeof CRAFT_MODIFIERS)[number], string> = {
  always: 'always',
  'when-warded': 'when-warded (the party venerated the shrine)',
  'when-few': 'when-few (two or fewer still standing)',
  below: 'below (the lair sits past half depth)',
};

const EXEMPLAR_NAMES = ['grey-knot', 'last-lantern', 'low-oath', 'still-water'] as const;

/**
 * The craft clause — appended to the topology string when the wing
 * carries unconsumed proposal pressure for this being. The exemplar
 * rotates with the pressure's expedition seq (residue 3: vary the
 * exemplars so the engine doesn't reproduce the go/no-go's
 * magnitude/pacing monoculture). Numeral-free like everything in the
 * register.
 */
export function craftClause(
  kind: OutcomeKind,
  cookbook: readonly CraftSkill[],
  seq: number,
): string {
  const verbs = CRAFT_VERBS.map((v) => VERB_WORDS[v]).join('; ');
  const mods = CRAFT_MODIFIERS.map((m) => MODIFIER_WORDS[m]).join(', ');
  const held = cookbook.map((s) => s.id).join(', ');
  const exVerb = CRAFT_VERBS[seq % CRAFT_VERBS.length];
  const exMag = MAG_NAMES[Math.min(seq % MAG_NAMES.length, verbMagMax(exVerb) - 1)];
  const exMod = CRAFT_MODIFIERS[seq % CRAFT_MODIFIERS.length];
  const exName = EXEMPLAR_NAMES[seq % EXEMPLAR_NAMES.length];
  return (
    `the colony's craft is compositions: a working joins one verb (${verbs}), `
    + `a strength (once, twice, or thrice — never past what the verb can carry), `
    + `and a condition (${mods}). the cookbook already holds: ${held}. `
    + `after ${PRESSURE_PHRASE[kind]}, if the craft wants a working the cookbook lacks, `
    + `put one plan step whose target reads exactly like "craft: ${exName}: ${exVerb} ${exMag} ${exMod}" `
    + `— your own name for it (lowercase letters and hyphens), one verb, one strength, one condition. `
    + `if nothing is missing, propose none.`
  );
}
