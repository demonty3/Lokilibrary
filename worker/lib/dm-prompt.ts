/**
 * Dungeon rung 4 — the DM's prompt, assembled server-side
 * (docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md, bar 4).
 *
 * Pure module, no Cloudflare bindings — importable by tsx smokes, the
 * agent-prompt.ts posture. The DM adjudicates INSIDE deterministic
 * bounds computed by the renderer's craft.ts before the call: it prices,
 * names and paces; balance is never its call, and its output is
 * re-validated after. Two go/no-go residues live here by design:
 * the prompt states what each verb does NOT do (fiction must not outrun
 * mechanics), and the refusal shape is defined (beyond-the-craft
 * answers with the line alone).
 */

export interface DmPromptInput {
  proposer: { id: string; name?: string };
  proposal: {
    name: string;
    verb: string;
    magnitude: number;
    modifier: string;
    /** The reflection that carried the proposal — the working's ground. */
    ground: string;
  };
  bounds: { score: number; floor: number; cap: number };
  cookbook: ReadonlyArray<{ id: string; verb: string; magnitude: number; modifier: string }>;
}

/** What each verb does — and does not do. The DM must never grant a
 *  fiction the cell cannot mechanically perform (go/no-go residue 2). */
const VERB_LAW = [
  'ward eases the death-die while a delver stands exposed. it does not stop deaths, shorten fights, or bring anyone home.',
  'press hastens the drive-off. it does not protect the exposed delver and it adds no gold.',
  'veil makes the lair likelier to stand empty. it does nothing once the creature is met.',
  'hold stands the party one round longer before it breaks. it does not make those rounds safer.',
  'break turns the party for home one round sooner. it spares lives by ending fights, never by softening them.',
  'glean lifts what each cleared step gives back. it moves no odds of survival.',
  'salvage keeps more of a fleeing party\'s sacks. it does nothing while the party stands its ground.',
].join('\n- ');

const CONDITION_LAW =
  'conditions bound when a working speaks: always; when-warded (the party venerated the shrine); '
  + 'when-few (two or fewer still standing); below (the lair sits past half depth).';

const SYSTEM = `you are the dungeon-master of a small delver colony's craft — the quiet authority that prices, names and paces new workings for the cookbook. you write in the colony's low register: unhurried, melancholy-adjacent, never grand.

the colony's own law computes every number that matters BEFORE a proposal reaches you: the working's power score and its price floor and cap arrive already decided, and your price must sit inside them. balance is never your call. your judgment is craft judgment: whether this working deserves a place in the cookbook, what it should be called, what it should cost inside the given bounds, and when the colony may first carry it.

what the verbs do — and do not do:
- ${VERB_LAW}
${CONDITION_LAW}
grant nothing a working's own verb and condition do not mechanically perform — a beautiful ground does not widen a cell.

your verdicts:
- "grant": the working joins the cookbook. give your name for it — keep the proposer's name or rename it; lowercase letters and hyphens only, never a digit — an integer price inside the given floor and cap, a pacing ("at-once": carried as soon as it is paid; "after-the-next-return": the colony waits one more homecoming), and one line in the register saying what was granted and why.
- "beyond-the-craft": the working is refused — the cookbook already holds its ground, or its story promises what its cell cannot perform, or the craft simply should not hold it. answer with the verdict and the one line alone; name, price and pacing are not yours to give on a refusal.

answer with ONLY a json object, no prose around it:
{"verdict": "grant" | "beyond-the-craft", "name": string, "price": integer, "pacing": "at-once" | "after-the-next-return", "line": string}
never put a digit in the name or the line.`;

const MAG_WORD = ['once', 'once', 'twice', 'thrice'] as const;

function magWord(n: number): string {
  return MAG_WORD[Math.max(1, Math.min(3, Math.floor(n)))];
}

export function buildDmPrompt(input: DmPromptInput): { system: string; user: string } {
  const held = input.cookbook
    .map((s) => `- ${s.id}: ${s.verb} ${magWord(s.magnitude)}, ${s.modifier}`)
    .join('\n');
  const p = input.proposal;
  const who = input.proposer.name ?? input.proposer.id;
  const user = `the cookbook as it stands:
${held || '- (nothing granted yet beyond the seed craft)'}

the proposal, from ${who}:
  name: ${p.name}
  working: ${p.verb} ${magWord(p.magnitude)}, ${p.modifier}
  ground: ${p.ground}

the colony's law has already admitted it: power score ${input.bounds.score}, price floor ${input.bounds.floor}, price cap ${input.bounds.cap}. the price must be an integer inside that floor and cap; everything else is your judgment.`;
  return { system: SYSTEM, user };
}
