/**
 * Dungeon economy, rung 4 — the craft grammar and the colony cookbook
 * (docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md, bars
 * 1, 2, 4, 7; grammar v0 frozen in draft by the go/no-go doc).
 *
 * The delve.ts posture: pure, PIXI-free, IPC-free, prng-free — every
 * function is a plain computation so scripts/smoke-delve4.mts drives it
 * headlessly. delve.ts owns the LEVERS (CraftMod — mechanics in its own
 * dice-language, dependency-free); this module owns the VERBS: the
 * grammar lattice, the deterministic power score and price bounds, the
 * seed cookbook, proposal + DM-output validation, and the
 * temperament-picked loadout. Plain code here is the balance authority —
 * a jailbroken DM can only misprice, never break the game (bar 4).
 *
 * Addendum 2, verbatim: verbs stay MECHANICAL (flavour-neutral); how a
 * verb renders in words and glyphs is a future pack-dialect surface —
 * packs reskin names, never numbers. The grammar widens deliberately,
 * in code, never by prompt wording.
 */

import {
  ROUND_DEATH_CHANCE,
  WARDED_ROUND_DEATH_CHANCE,
  SPEND_RESERVE,
  accrueAspect,
  type AspectTally,
  type CraftMod,
  type DelveState,
  type GrantedSkill,
  type ModWhen,
} from './delve';

// ── The grammar lattice ────────────────────────────────────────────────────

/** Seven mechanical verbs. `break` is the go/no-go's residue-1 widening
 *  (2026-08-21, on the plan's record): the retreat-side working the five
 *  proposals could not say — "a party that will not break dies whole". */
export const CRAFT_VERBS = ['ward', 'press', 'veil', 'hold', 'break', 'glean', 'salvage'] as const;
export type CraftVerb = (typeof CRAFT_VERBS)[number];

/** Modifiers, all mechanically checkable from existing run state —
 *  no aliases of `always` (go/no-go grammar v0). */
export const CRAFT_MODIFIERS = ['always', 'when-warded', 'when-few', 'below'] as const;
export type CraftModifier = (typeof CRAFT_MODIFIERS)[number];

export interface CraftComposition {
  verb: CraftVerb;
  modifier: CraftModifier;
  /** 1..magMax(verb). Flat verbs (hold/break) take exactly 1. */
  magnitude: number;
}

/** A cookbook entry: a named point on the lattice, optionally gated by
 *  an aspect requirement (Addendum 8, schema-complete). */
export interface CraftSkill {
  /** Numeral-free name (desk register); packs may reskin later. */
  id: string;
  composition: CraftComposition;
  requires?: { aspect: Aspect; share: number };
}

interface VerbSpec {
  lever: CraftMod['lever'];
  magMax: number;
  /** Power-score points — per magnitude, or flat when `flat`. */
  points: number;
  flat?: true;
  /** Lever delta — per magnitude, or flat when `flat`. Signed, in the
   *  lever's own units (chances, rounds, gold, kept-fraction). */
  delta: number;
}

/** Every verb is a threshold or parameter swap on a draw the expedition
 *  already makes — never an inserted draw (bar 2's byte-identity). */
const VERB_SPECS: Record<CraftVerb, VerbSpec> = {
  ward: { lever: 'death', magMax: 3, points: 3, delta: -0.005 },
  press: { lever: 'driveOff', magMax: 3, points: 2, delta: 0.02 },
  veil: { lever: 'encounter', magMax: 3, points: 2, delta: -0.03 },
  hold: { lever: 'retreat', magMax: 1, points: 2, flat: true, delta: 1 },
  break: { lever: 'retreat', magMax: 1, points: 2, flat: true, delta: -1 },
  glean: { lever: 'goldStep', magMax: 2, points: 2, delta: 1 },
  salvage: { lever: 'salvageKept', magMax: 2, points: 2, delta: 0.125 },
};

export function verbMagMax(verb: CraftVerb): number {
  return VERB_SPECS[verb].magMax;
}

// ── Power score and price bounds (deterministic, pre-DM) ───────────────────

const SCOPE_FACTOR: Record<CraftModifier, number> = {
  always: 1.0,
  'when-warded': 0.7,
  'when-few': 0.5,
  below: 0.7,
};

/** Hard cap: no admissible composition scores above this (bar 4). */
export const CRAFT_SCORE_CAP = 9;
/** Price bounds scale with score; the ceiling 225 stays inside what a
 *  stage-4 hoard can ever pay (go/no-go). */
export const PRICE_FLOOR_PER_SCORE = 10;
export const PRICE_CAP_PER_SCORE = 25;

/** Verb points × magnitude (flat verbs ignore magnitude) × scope factor,
 *  rounded, min 1. Frozen against the go/no-go's worked examples. */
export function craftScore(c: CraftComposition): number {
  const v = VERB_SPECS[c.verb];
  const base = v.flat ? v.points : v.points * c.magnitude;
  return Math.max(1, Math.round(base * SCOPE_FACTOR[c.modifier]));
}

export interface ProposalBounds {
  score: number;
  floor: number;
  cap: number;
}

export function proposalBounds(c: CraftComposition): ProposalBounds {
  const score = craftScore(c);
  return { score, floor: PRICE_FLOOR_PER_SCORE * score, cap: PRICE_CAP_PER_SCORE * score };
}

// ── The death floor (bar 2, two-sided) ─────────────────────────────────────

/** Craft, never god-mode: no composition stack may take the warded death
 *  die below 0.4× the unwarded baseline. Stacked shrine ward + `ward`
 *  three may reach the floor exactly — on it, never below it. */
export const CRAFT_DEATH_FLOOR = 0.4 * ROUND_DEATH_CHANCE;
const FLOOR_EPSILON = 1e-9;

/** Worst-case check: every death-lever delta assumed active at once
 *  (modifiers ignored — the guard must hold in the party's best hour). */
export function respectsDeathFloor(comps: readonly CraftComposition[]): boolean {
  let delta = 0;
  for (const c of comps) {
    const v = VERB_SPECS[c.verb];
    if (v.lever !== 'death') continue;
    delta += v.flat ? v.delta : v.delta * c.magnitude;
  }
  return WARDED_ROUND_DEATH_CHANCE + delta >= CRAFT_DEATH_FLOOR - FLOOR_EPSILON;
}

// ── Aspects (Addendum 8: deeds-only, schema-complete, lightly used) ────────

export const ASPECTS = ['war', 'death', 'harvest', 'craft', 'faith'] as const;
export type Aspect = (typeof ASPECTS)[number];

/** Share of an agent's deeds under one aspect; 0 until any deed lands.
 *  The requirement field gates by arithmetic on this — never a HUD. */
export function aspectShare(tally: AspectTally | undefined, aspect: Aspect): number {
  if (!tally) return 0;
  let total = 0;
  for (const k of ASPECTS) total += tally[k] ?? 0;
  return total > 0 ? (tally[aspect] ?? 0) / total : 0;
}

export function requirementMet(
  tally: AspectTally | undefined,
  req: { aspect: Aspect; share: number } | undefined,
): boolean {
  if (!req) return true;
  return aspectShare(tally, req.aspect) >= req.share;
}

// ── The seed cookbook (8 entries, frozen by the go/no-go draft) ────────────

export const SEED_COOKBOOK: readonly CraftSkill[] = [
  { id: 'ember-line', composition: { verb: 'ward', magnitude: 1, modifier: 'always' } },
  { id: 'loud-iron', composition: { verb: 'press', magnitude: 2, modifier: 'always' } },
  { id: 'soft-step', composition: { verb: 'veil', magnitude: 2, modifier: 'always' } },
  { id: 'long-breath', composition: { verb: 'hold', magnitude: 1, modifier: 'always' } },
  { id: 'keen-eye', composition: { verb: 'glean', magnitude: 1, modifier: 'below' } },
  { id: 'knot-of-sacks', composition: { verb: 'salvage', magnitude: 1, modifier: 'always' } },
  {
    id: 'saints-shadow',
    composition: { verb: 'ward', magnitude: 2, modifier: 'when-warded' },
    requires: { aspect: 'faith', share: 0.4 },
  },
  {
    id: 'red-remembrance',
    composition: { verb: 'press', magnitude: 3, modifier: 'when-few' },
    requires: { aspect: 'war', share: 0.4 },
  },
];

/** Seed + granted, the colony's whole craft. Granted entries must be
 *  PAID to count — the colony buys a working before it is carried. */
export function effectiveCookbook(state: Pick<DelveState, 'cookbook'>): CraftSkill[] {
  const granted = state.cookbook
    .filter((g) => g.paid)
    .map((g) => grantedAsSkill(g))
    .filter((s): s is CraftSkill => s !== null);
  return [...SEED_COOKBOOK, ...granted];
}

/** Narrow a persisted granted entry back onto the lattice; null if the
 *  blob holds a composition this build's grammar doesn't (a foreign or
 *  future blob) — skipped, never a broken tick. */
export function grantedAsSkill(g: GrantedSkill): CraftSkill | null {
  const verb = CRAFT_VERBS.find((v) => v === g.composition.verb);
  const modifier = CRAFT_MODIFIERS.find((m) => m === g.composition.modifier);
  if (!verb || !modifier) return null;
  const magnitude = Math.floor(g.composition.magnitude);
  if (magnitude < 1 || magnitude > VERB_SPECS[verb].magMax) return null;
  return { id: g.id, composition: { verb, modifier, magnitude } };
}

/** Every name the cookbook holds (seed + granted, paid or pending) —
 *  the DM's no-collision gate checks against all of them. */
export function cookbookIds(state: Pick<DelveState, 'cookbook'>): string[] {
  return [...SEED_COOKBOOK.map((s) => s.id), ...state.cookbook.map((g) => g.id)];
}

// ── The temperament-picked loadout (bar 2: pure, prng-free, ≤k) ────────────

export const CRAFT_LOADOUT_MAX = 2;

/** Bold reads aggression and profit; timid reads self-preservation —
 *  the rung-2 directive split carried into craft. One skill per verb
 *  (keeps the death-floor guard simple and stacking honest). */
const BOLD_VERB_ORDER: readonly CraftVerb[] = ['press', 'glean', 'hold', 'salvage', 'veil', 'break', 'ward'];
const TIMID_VERB_ORDER: readonly CraftVerb[] = ['ward', 'veil', 'break', 'salvage', 'glean', 'hold', 'press'];

export function pickLoadout(
  boldness: number,
  cookbook: readonly CraftSkill[],
  tally: AspectTally | undefined,
): CraftSkill[] {
  const order = boldness >= 0.5 ? BOLD_VERB_ORDER : TIMID_VERB_ORDER;
  const eligible = cookbook.filter((s) => requirementMet(tally, s.requires));
  const ranked = [...eligible].sort((a, b) => {
    const byVerb = order.indexOf(a.composition.verb) - order.indexOf(b.composition.verb);
    if (byVerb !== 0) return byVerb;
    const byScore = craftScore(b.composition) - craftScore(a.composition);
    if (byScore !== 0) return byScore;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const picked: CraftSkill[] = [];
  const verbs = new Set<CraftVerb>();
  for (const s of ranked) {
    if (picked.length >= CRAFT_LOADOUT_MAX) break;
    if (verbs.has(s.composition.verb)) continue;
    if (!respectsDeathFloor([...picked.map((p) => p.composition), s.composition])) continue;
    picked.push(s);
    verbs.add(s.composition.verb);
  }
  return picked;
}

/** Skills → levers, for ExpeditionParams.mods. Pure resolution; the
 *  engine never learns what a verb is called. */
export function resolveMods(skills: readonly CraftSkill[]): CraftMod[] {
  return skills.map((s) => {
    const v = VERB_SPECS[s.composition.verb];
    return {
      lever: v.lever,
      when: s.composition.modifier as ModWhen,
      delta: v.flat ? v.delta : v.delta * s.composition.magnitude,
    };
  });
}

// ── Proposal validation (bar 4: deterministic, BEFORE the DM) ──────────────

/** Numeral-free by construction: lowercase letters and hyphens only. */
export const CRAFT_NAME_RE = /^[a-z][a-z-]{2,19}$/;

export interface CraftProposal {
  /** The being's coined name for the working (lore; the DM may rename). */
  name: string;
  composition: CraftComposition;
}

export type ProposalCheck =
  | { ok: true; bounds: ProposalBounds; composition: CraftComposition }
  | { ok: false; reason: string };

/** Schema, grammar membership, magnitude bounds, score cap, death-floor
 *  guard. A failure here is an ESCAPE — recorded, never repaired. */
export function validateCraftProposal(p: {
  name: string;
  verb: string;
  modifier: string;
  magnitude: number;
}): ProposalCheck {
  const verb = CRAFT_VERBS.find((v) => v === p.verb);
  if (!verb) return { ok: false, reason: `verb outside the grammar: ${p.verb}` };
  const modifier = CRAFT_MODIFIERS.find((m) => m === p.modifier);
  if (!modifier) return { ok: false, reason: `modifier outside the grammar: ${p.modifier}` };
  if (!Number.isInteger(p.magnitude) || p.magnitude < 1 || p.magnitude > VERB_SPECS[verb].magMax) {
    return { ok: false, reason: `magnitude out of bounds for ${verb}: ${p.magnitude}` };
  }
  if (!CRAFT_NAME_RE.test(p.name)) return { ok: false, reason: 'name fails the register' };
  const composition: CraftComposition = { verb, modifier, magnitude: p.magnitude };
  const bounds = proposalBounds(composition);
  if (bounds.score > CRAFT_SCORE_CAP) return { ok: false, reason: 'score over the hard cap' };
  if (!respectsDeathFloor([composition])) return { ok: false, reason: 'crosses the death floor' };
  return { ok: true, bounds, composition };
}

// ── DM output validation (bar 4: re-validated AFTER, never trusted) ────────

export type DmPacing = 'at-once' | 'after-the-next-return';

export interface DmGrant {
  verdict: 'grant';
  name: string;
  price: number;
  pacing: DmPacing;
  line: string;
}

export interface DmRefusal {
  verdict: 'beyond-the-craft';
  line: string;
}

export type DmVerdict = DmGrant | DmRefusal;

const DM_LINE_MAX = 200;

function cleanLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const line = raw.trim();
  if (line.length === 0 || line.length > DM_LINE_MAX) return null;
  if (/\d/.test(line)) return null;
  return line;
}

/**
 * The go/no-go residue-4 shape: name/price/pacing are checked ONLY on
 * grants — a refusal returns line alone (the probe's refusal carried an
 * empty name and price zero, and that is in-contract). Null = the DM
 * output fails validation = a consumed rejection, nothing retries.
 */
export function validateDmVerdict(
  raw: unknown,
  bounds: ProposalBounds,
  takenIds: readonly string[],
): DmVerdict | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const line = cleanLine(o.line);
  if (line === null) return null;
  if (o.verdict === 'beyond-the-craft') return { verdict: 'beyond-the-craft', line };
  if (o.verdict !== 'grant') return null;
  if (typeof o.name !== 'string' || !CRAFT_NAME_RE.test(o.name)) return null;
  if (takenIds.includes(o.name)) return null;
  if (typeof o.price !== 'number' || !Number.isInteger(o.price)) return null;
  if (o.price < bounds.floor || o.price > bounds.cap) return null;
  if (o.pacing !== 'at-once' && o.pacing !== 'after-the-next-return') return null;
  return { verdict: 'grant', name: o.name, price: o.price, pacing: o.pacing, line };
}

// ── Applying a grant ───────────────────────────────────────────────────────

/**
 * A validated grant enters the colony's cookbook unpaid (at-once may pay
 * immediately if the hoard covers it over the reserve; the resolution
 * loop retries the rest). Accrues the proposer's `craft` deed — the one
 * aspect a being earns by invention, still a Tier-0-observable event.
 */
export function applyGrant(
  state: DelveState,
  proposal: CraftProposal,
  grant: DmGrant,
  proposedBy: string,
): GrantedSkill {
  const g: GrantedSkill = {
    id: grant.name,
    composition: { ...proposal.composition },
    line: grant.line,
    price: grant.price,
    pacing: grant.pacing,
    grantedAtSeq: state.expeditionSeq,
    paid: false,
    proposedBy,
    ...(proposal.name !== grant.name && { proposedName: proposal.name }),
  };
  state.cookbook.push(g);
  accrueAspect(state, proposedBy, 'craft');
  if (g.pacing === 'at-once' && state.hoardGold >= SPEND_RESERVE + g.price) {
    state.hoardGold -= g.price;
    g.paid = true;
  }
  return g;
}
