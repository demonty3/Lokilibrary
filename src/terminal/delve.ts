/**
 * Dungeon economy, rung 1 — the pure Tier-0 delve engine
 * (docs/superpowers/specs/2026-08-19-dungeon-rung1-delvers.md).
 *
 * The wear.ts / beingIntents.ts posture: no PIXI, no IPC, no wall-clock
 * reads — every `nowMs` is passed in, every random draw comes through a
 * seeded mulberry32 Prng, so scripts/smoke-delve.mts drives the whole
 * loop headlessly. terminalLand.ts owns the render + persistence wiring.
 *
 * Determinism (spec bar 6): expedition N of a wing draws from
 * mulberry32(fnv1a(`delve:${wing}:${N}`)) — same seed + same dispatch
 * sequence reproduces the same outcomes by construction. Scheduling
 * jitter draws from the same per-dispatch stream AFTER the outcome
 * dice, so the odds never depend on when the desk was awake.
 *
 * Consequentiality (spec bar 7, Addendum 1): `runExpedition` is a pure
 * function of (ExpeditionParams, Prng). At rung 1 the params are the
 * engine defaults below; rung 2's being-directives will move them, and
 * the smoke proves moving them moves survival odds — the "dungeon as
 * benchmark" principle is dead on arrival if it can't.
 *
 * No numbers reach a screen from here: gold is engine state, outcomes
 * leave as an OutcomeKind the marginalia vocab renders in words.
 */

import { mulberry32, type Prng } from '../procedural/prng';

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Dispatch cadence: one expedition per this window of DESK UPTIME —
 *  [6h, 12h) → 2-4 per 24h of uptime (spec bar 2). Uptime, not wall
 *  clock: a wallpaper desk sleeps most of the wall day, and "a few
 *  times a day" means days the desk is actually lived with. */
export const DISPATCH_GAP_MS: [number, number] = [6 * 3_600_000, 6 * 3_600_000];
/** A dispatch that found nobody home (or stalled) retries after this
 *  much further uptime. */
export const DISPATCH_RETRY_MS = 10 * 60_000;
/** Replacement delvers arrive slowly — days of WALL clock (spec bar 3:
 *  they walk in from elsewhere whether the desk is watched or not). */
export const ARRIVAL_GAP_MS: [number, number] = [2 * 86_400_000, 2 * 86_400_000];
/** Per-tick uptime accrual clamp: gaps longer than this (occlusion,
 *  sleep, quit) are not uptime. Generous against the 1 Hz throttle. */
export const UPTIME_CLAMP_MS = 10_000;
/** Founding population bounds (spec bar 1: 3 to 5). */
export const POPULATION_MIN = 3;
export const POPULATION_MAX = 5;
/** Rung 3: reinvestment can raise the colony past its founding size, but
 *  never past this — the camp must stay readable (rung-3 spec bar 6). */
export const POPULATION_HARD_CAP = 8;

/** What a being's directive will move at rung 2 — engine defaults now. */
export interface ExpeditionParams {
  /** Steps of descent attempted (deeper pays more, risks more). */
  depth: number;
  /** Fight rounds endured before fleeing the creature. */
  retreatThreshold: number;
  /** Delvers sent (capped by the living population at dispatch). */
  partySize: number;
  /** Rung 3: the party venerated the completed shrine before descending.
   *  A threshold swap on the death die — never an inserted draw, so
   *  unwarded runs are byte-identical to rung 2 (rung-3 spec bar 4). */
  warded?: boolean;
  /** Rung 4: the loadout's resolved lever deltas (craft.ts). Absent or
   *  empty ⇒ byte-identical to rung 3 by construction. */
  mods?: readonly CraftMod[];
  /** Rung 4: the carried skills' ids — engine-inert lore for marginalia
   *  and the debug fingerprint; the mechanics ride `mods` alone. */
  loadout?: readonly string[];
}

export const DEFAULT_EXPEDITION_PARAMS: ExpeditionParams = {
  depth: 6,
  retreatThreshold: 2,
  partySize: 3,
};

// ── Rung 2: persona-derived directives ─────────────────────────────────────
// (docs/superpowers/specs/2026-08-20-dungeon-rung2-directives-hoard.md)

/** Structural mirror of beingIntents' LandPersona — delve.ts stays
 *  dependency-free; the land persona satisfies this shape as-is. */
export interface DirectiveTraits {
  bias: Partial<Record<string, number>>;
  /** Walk speed range, cells/sec [min, max). */
  speed: [number, number];
  intentWindowMult: number;
}

/**
 * Temperament in [0,1]: resty/slow/patient personas read timid, fast
 * wandering quick-thinkers read bold. DEFAULT_LAND_PERSONA (empty bias,
 * speed mid 1.9, mult 1) lands at exactly 0.5 by construction, so
 * unknown dispatchers get near-default expeditions (spec bar 6).
 */
export function directiveBoldness(traits: DirectiveTraits): number {
  const wander = traits.bias['wander'] ?? 0;
  const rest = traits.bias['rest'] ?? 0;
  const midSpeed = (traits.speed[0] + traits.speed[1]) / 2;
  const b = 0.5 + 2 * wander - 2 * rest + 0.4 * (midSpeed - 1.9) + 0.5 * (1 - traits.intentWindowMult);
  return Math.max(0, Math.min(1, b));
}

/**
 * The dispatcher's directive (spec bars 1-3): timid = larger party,
 * shallower, early retreat; bold = smaller party, deeper, holds longer.
 * Ranges chosen by calibration against the frozen odds bars — depth
 * moves gold not death, retreat 2-5 x party 4-3 spans >1pp of per-delver
 * death rate while staying under the 2.5x spread cap. Pure and
 * prng-free: the ±1 depth flavour comes from a hash of the agent id, so
 * rung 1's expedition streams cannot move (spec bar 1).
 */
export function directiveParams(agentId: string, traits: DirectiveTraits): ExpeditionParams {
  const b = directiveBoldness(traits);
  const jitter = (delveHash(`directive:${agentId}`) % 3) - 1;
  return {
    depth: Math.max(4, Math.min(8, 4 + Math.round(b * 4) + jitter)),
    retreatThreshold: 2 + Math.floor(b * 3.999),
    partySize: 4 - Math.round(b),
  };
}

// ── Rung 2: the hoard made visible ─────────────────────────────────────────

export const HOARD_STAGE_MAX = 5;
/** Gold thresholds per stage — geometric, tuned to the accrual rate
 *  (roughly 2-4 expeditions x ~10-30 gold per day of desk uptime):
 *  first glint within a day, never done inside a month (spec bar 4). */
const HOARD_THRESHOLDS = [1, 40, 160, 480, 1200] as const;

/** 0 = nothing yet. Pure, monotone non-decreasing in hoardGold. */
export function hoardStage(hoardGold: number): number {
  let stage = 0;
  for (const t of HOARD_THRESHOLDS) {
    if (hoardGold >= t) stage += 1;
  }
  return stage;
}

/** What the undercroft draws per stage 1..HOARD_STAGE_MAX, verbatim —
 *  rows top-to-bottom, glyphs from the rung-1 undercroft vocabulary
 *  only, numeral-free (smoke-asserted). A low heap that widens, then
 *  rises. Static by design: animation reads as a gauge (spec bar 8). */
export const HOARD_GLYPH_ROWS: readonly (readonly string[])[] = [
  ['▪'],
  ['▪▪'],
  ['░▪▪'],
  ['  ▪ ', '░▒▪▪'],
  [' ▪▪▪ ', '░▒▪▪▒'],
];

// ── Rung 3: the spend, and the shrine ──────────────────────────────────────
// (docs/superpowers/specs/2026-08-20-dungeon-rung3-monuments.md)

/** The hoard keeps this much back — the colony never spends to zero. */
export const SPEND_RESERVE = 40;
/** One spend moves exactly this much out of the hoard. */
export const SPEND_TRANCHE = 60;

export const SHRINE_STAGE_MAX = 3;
/** Monument-fund thresholds per stage. Tranches arrive one per timid
 *  resolution, so the shrine rises over weeks of lived-with desk. */
const SHRINE_THRESHOLDS = [60, 180, 360] as const;

/** 0 = no shrine yet. Pure, monotone non-decreasing in monumentFund
 *  (rung-3 spec bar 5; the fund itself never decrements). */
export function shrineStage(monumentFund: number): number {
  let stage = 0;
  for (const t of SHRINE_THRESHOLDS) {
    if (monumentFund >= t) stage += 1;
  }
  return stage;
}

/** Veneration (and the ward) begin only once the shrine is finished. */
export function shrineComplete(monumentFund: number): boolean {
  return shrineStage(monumentFund) >= SHRINE_STAGE_MAX;
}

/** What the surface draws per stage 1..SHRINE_STAGE_MAX, verbatim —
 *  rows top-to-bottom, a low 3-wide shrine deliberately unlike the
 *  mastered-game monument (no crown, no box-drawing walls), numeral-free
 *  and glyph-allowlisted (smoke-asserted). Static by design. */
export const SHRINE_GLYPH_ROWS: readonly (readonly string[])[] = [
  ['░▒░'],
  [' ▪ ', '▌▒▐'],
  ['▐▪▌', '▌▒▐', '█░█'],
];

/** The colony the roster refills toward: founding size plus reinvested
 *  raises, hard-capped (rung-3 spec bar 6). */
export function effectiveTargetPop(state: DelveState): number {
  return Math.min(POPULATION_HARD_CAP, state.targetPop + state.capRaises);
}

// Creature-hazard dice (spec bar 3: ONE creature, dice-driven). The
// creature lairs at a drawn step; meeting it starts rounds of danger.
const LAIR_STEP_MIN = 2;
/** Chance the creature is home when the party passes its lair. */
const ENCOUNTER_CHANCE = 0.35;
/** Per-round chance the exposed delver dies. Exported for rung 4's
 *  death-floor guard (craft.ts computes 0.4× this as the hard floor). */
export const ROUND_DEATH_CHANCE = 0.1;
/** Rung 3: the same die when the party walks in warded — the shrine is a
 *  ward, never god-mode (rung-3 spec bar 2 bounds the gap two-sidedly).
 *  Calibrated 2026-08-20 on the bold-most probe (20k runs, identical
 *  streams): 0.055 → gap 1.11pp (bar > 1pp) at ratio 0.562 (bar ≥ 0.5);
 *  0.07 fails the gap bar, 0.05 crowds the god-mode floor. */
export const WARDED_ROUND_DEATH_CHANCE = 0.055;
/** Per-round chance the party drives the creature off, plus a hand each. */
const DRIVE_OFF_BASE = 0.2;
const DRIVE_OFF_PER_DELVER = 0.08;
/** Gold per step cleared: BASE + step (deeper pays more). A flight keeps
 *  this fraction — dropped sacks are part of the melancholy. */
const GOLD_STEP_BASE = 2;
const SALVAGE_BASE_KEPT = 0.5;

// ── Rung 4: craft levers ───────────────────────────────────────────────────
// (docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md)
// The engine's half of the grammar: mechanics in dice-language, so
// delve.ts stays dependency-free. craft.ts owns verbs, scoring and the
// cookbook, and resolves a loadout down to these levers at dispatch.

/** When a lever delta applies — all checkable from run state in scope
 *  at the draw site, so no draw is ever inserted (bar 2). */
export type ModWhen = 'always' | 'when-warded' | 'when-few' | 'below';

export interface CraftMod {
  lever: 'death' | 'driveOff' | 'encounter' | 'retreat' | 'goldStep' | 'salvageKept';
  when: ModWhen;
  /** Signed, in the lever's own units (chance, rounds, gold, fraction). */
  delta: number;
}

/** Sum of the active deltas on one lever. Empty/absent mods ⇒ exactly 0
 *  ⇒ every threshold computes to its rung-3 value ⇒ the no-loadout path
 *  is byte-identical by construction (smoke-asserted). */
function modDelta(
  mods: readonly CraftMod[] | undefined,
  lever: CraftMod['lever'],
  ctx: { warded: boolean; few: boolean; below: boolean },
): number {
  if (!mods || mods.length === 0) return 0;
  let d = 0;
  for (const m of mods) {
    if (m.lever !== lever) continue;
    if (m.when === 'when-warded' && !ctx.warded) continue;
    if (m.when === 'when-few' && !ctx.few) continue;
    if (m.when === 'below' && !ctx.below) continue;
    d += m.delta;
  }
  return d;
}

/** A granted working in the colony's cookbook — persisted verbatim in
 *  the delve blob. Structural (verb as string): the grammar lives in
 *  craft.ts, which narrows on read; a foreign composition is skipped,
 *  never a broken tick. */
export interface GrantedSkill {
  id: string;
  composition: { verb: string; modifier: ModWhen; magnitude: number };
  /** The DM's diegetic line — lore, never rendered with numerals. */
  line: string;
  price: number;
  pacing: 'at-once' | 'after-the-next-return';
  /** expeditionSeq at grant time — pacing's "next return" boundary. */
  grantedAtSeq: number;
  /** The colony buys a working before it is carried. */
  paid: boolean;
  proposedBy: string;
  /** The being's own coined name, when the DM renamed it (lore). */
  proposedName?: string;
}

/** Addendum 8: deeds-only aspect counts (war/death/harvest/craft/faith),
 *  sparse. Accrued ONLY at Tier-0-observable events — never from LLM
 *  text (the addendum's kill, verbatim). */
export type AspectTally = Partial<Record<string, number>>;

export function accrueAspect(state: DelveState, agentId: string, aspect: string): void {
  const t = state.aspects[agentId] ?? (state.aspects[agentId] = {});
  t[aspect] = (t[aspect] ?? 0) + 1;
}

/** Notable-delve dials (bar 3): what marks the dispatcher's mind. */
export const NOTABLE_DEAD_MIN = 2;
export const NOTABLE_GOLD_MIN = 40;

export type OutcomeKind = 'rich' | 'hollow' | 'loss' | 'lost';

export interface ExpeditionOutcome {
  /** Party indices (0..partySize-1) that died below. Permanent. */
  deadIndices: number[];
  /** Gold brought back (0 when nobody returned). */
  gold: number;
  /** Steps cleared before turning for home. */
  stepsCleared: number;
  /** The creature was met. */
  encountered: boolean;
  /** The party broke off the fight at the retreat threshold. */
  fled: boolean;
  /** Watchability timeline: total below-ground seconds, and where in
   *  [0,1] the hazard beat falls (null = the lair was empty). */
  durationS: number;
  hazardAtFrac: number | null;
}

/**
 * One expedition, pure. The party descends step by step; at the
 * creature's lair the dice decide who comes home. Retreat semantics:
 * after `retreatThreshold` fight rounds the survivors flee — earlier
 * retreat means fewer rounds exposed, so the threshold measurably moves
 * survival odds (the bar-7 harness varies exactly this).
 */
export function runExpedition(params: ExpeditionParams, prng: Prng): ExpeditionOutcome {
  const depth = Math.max(1, Math.floor(params.depth));
  const party = Math.max(1, Math.floor(params.partySize));
  const lairStep = Math.min(depth - 1, prng.range(LAIR_STEP_MIN, Math.max(LAIR_STEP_MIN + 1, depth)));
  const alive = new Set<number>(Array.from({ length: party }, (_, i) => i));
  // Rung 4: lever deltas ride the SAME draws — conditions read run state
  // already in scope at each draw site, so the draw count and order only
  // ever change the way the base thresholds could change them.
  const mods = params.mods;
  const warded = params.warded === true;
  const below = lairStep > depth / 2;
  let encountered = false;
  let fled = false;
  let stepsCleared = 0;
  for (let step = 0; step < depth; step++) {
    if (
      step === lairStep
      && prng.next() < ENCOUNTER_CHANCE + modDelta(mods, 'encounter', { warded, few: alive.size <= 2, below })
    ) {
      encountered = true;
      let rounds = 0;
      while (alive.size > 0) {
        rounds += 1;
        const ctx = { warded, few: alive.size <= 2, below };
        // One delver stands exposed this round.
        const exposed = [...alive][prng.range(0, alive.size)];
        const deathChance = (params.warded ? WARDED_ROUND_DEATH_CHANCE : ROUND_DEATH_CHANCE)
          + modDelta(mods, 'death', ctx);
        if (prng.next() < deathChance) alive.delete(exposed);
        if (alive.size === 0) break;
        if (prng.next() < DRIVE_OFF_BASE + DRIVE_OFF_PER_DELVER * alive.size + modDelta(mods, 'driveOff', ctx)) break;
        const retreatAt = params.retreatThreshold
          + modDelta(mods, 'retreat', { warded, few: alive.size <= 2, below });
        if (rounds >= Math.max(1, retreatAt)) {
          fled = true;
          break;
        }
      }
      if (alive.size === 0 || fled) break;
    }
    stepsCleared += 1;
  }
  let gold = 0;
  if (alive.size > 0) {
    const goldCtx = { warded, few: alive.size <= 2, below };
    const perStep = GOLD_STEP_BASE + modDelta(mods, 'goldStep', goldCtx);
    for (let s = 0; s < stepsCleared; s++) gold += perStep + s;
    if (fled) gold = Math.floor(gold * (SALVAGE_BASE_KEPT + modDelta(mods, 'salvageKept', goldCtx)));
  }
  const deadIndices = Array.from({ length: party }, (_, i) => i).filter((i) => !alive.has(i));
  // Timeline AFTER the dice — scheduling jitter must never shift odds.
  const durationS = 90 + stepsCleared * 45 + prng.range(0, 60);
  return {
    deadIndices,
    gold,
    stepsCleared,
    encountered,
    fled,
    durationS,
    hazardAtFrac: encountered ? Math.min(0.9, Math.max(0.15, lairStep / depth)) : null,
  };
}

/** The outcome, classified for the marginalia vocab (words, never numbers). */
export function outcomeKind(o: ExpeditionOutcome, partySize: number): OutcomeKind {
  if (o.deadIndices.length >= partySize) return 'lost';
  if (o.deadIndices.length > 0) return 'loss';
  if (o.fled || o.gold === 0) return 'hollow';
  return 'rich';
}

// ── The persistent colony state ────────────────────────────────────────────

export interface Delver {
  id: string;
  name: string;
}

export interface ActiveExpedition {
  seq: number;
  /** The being whose walk to the shaft mouth dispatched it (bar 4's
   *  marginalia attribution). */
  dispatcherId: string;
  partyIds: string[];
  startedAtMs: number;
  resolveAtMs: number;
  /** Wall-ms of the hazard beat, or null (lair was empty). */
  hazardAtMs: number | null;
  /** Precomputed at dispatch (deterministic per seq) — the undercroft
   *  presenter and the resolver both read the same truth. */
  outcome: ExpeditionOutcome;
  params: ExpeditionParams;
}

export interface DelveState {
  wing: string;
  delvers: Delver[];
  /** Founding headcount — deaths are replaced back toward this, slowly. */
  targetPop: number;
  /** The invisible hoard (spec bar 5: rendered nowhere). */
  hoardGold: number;
  /** Dispatches ever begun — the determinism counter (seeds expedition seq). */
  expeditionSeq: number;
  /** Delvers ever recruited — names/ids never reuse a dead delver's. */
  recruitSeq: number;
  /** Desk uptime accrued toward the next dispatch. */
  uptimeMs: number;
  /** Uptime threshold at which the next expedition dispatches. */
  nextDispatchAtUptimeMs: number;
  /** Wall-ms a replacement delver arrives, when one is on the road. */
  nextArrivalAtMs: number | null;
  active: ActiveExpedition | null;
  /** Rung 3: gold spent toward the shrine, ever. Never decrements —
   *  the shrine only grows (spec bar 5). */
  monumentFund: number;
  /** Rung 3: reinvested colony-cap raises (see effectiveTargetPop). */
  capRaises: number;
  /** Rung 4: granted workings, in grant order (seeds live in craft.ts). */
  cookbook: GrantedSkill[];
  /** Rung 4: per-being deed tallies (Addendum 8) — deeds only, ever. */
  aspects: Record<string, AspectTally>;
  /** Rung 4: an unconsumed notable delve — the dispatcher's next
   *  reflection at this wing carries the craft clause. Latest wins. */
  proposalPressure: { dispatcherId: string; seq: number; kind: OutcomeKind } | null;
  /** Rung 4: high-water mark of steps cleared — makes "first-clear"
   *  computable. The founding run sets the baseline quietly; only a
   *  bettered mark is notable. */
  deepestCleared: number;
}

/** FNV-1a 32-bit (the terminalLand.ts local-copy pattern). */
export function delveHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The per-dispatch stream — outcome dice first, then timeline jitter. */
export function expeditionPrng(wing: string, seq: number): Prng {
  return mulberry32(delveHash(`delve:${wing}:${seq}`));
}

/** Small folk get small names — no numerals anywhere near the surface. */
const DELVER_NAMES = [
  'hob', 'marrow', 'tansy', 'grike', 'fen', 'ossel', 'pyrite', 'sedge',
  'cham', 'dob', 'ilka', 'murrel', 'nix', 'orpin', 'quill', 'scree',
] as const;

function recruit(state: DelveState): Delver {
  const n = state.recruitSeq;
  state.recruitSeq += 1;
  return {
    id: `delver:${state.wing}:${n}`,
    name: DELVER_NAMES[delveHash(`${state.wing}:name:${n}`) % DELVER_NAMES.length],
  };
}

/** Found the colony: population drawn 3-5 from the wing's own stream. */
export function initialDelveState(wing: string): DelveState {
  const prng = mulberry32(delveHash(`delve-colony:${wing}`));
  const state: DelveState = {
    wing,
    delvers: [],
    targetPop: prng.range(POPULATION_MIN, POPULATION_MAX + 1),
    hoardGold: 0,
    expeditionSeq: 0,
    recruitSeq: 0,
    uptimeMs: 0,
    nextDispatchAtUptimeMs: prng.range(DISPATCH_GAP_MS[0], DISPATCH_GAP_MS[0] + DISPATCH_GAP_MS[1]),
    nextArrivalAtMs: null,
    active: null,
    monumentFund: 0,
    capRaises: 0,
    cookbook: [],
    aspects: {},
    proposalPressure: null,
    deepestCleared: 0,
  };
  for (let i = 0; i < state.targetPop; i++) state.delvers.push(recruit(state));
  return state;
}

/** Parse a persisted blob; null on anything unrecognisable (caller
 *  re-founds — a lost colony beats a broken tick). */
export function parseDelveState(json: string | null, wing: string): DelveState | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as DelveState;
    if (s.wing !== wing || !Array.isArray(s.delvers)) return null;
    // Rung-2-shaped blobs predate the spend — default, never reject
    // (rung-3 spec bar 6: no schema bump, no migration).
    if (typeof s.monumentFund !== 'number') s.monumentFund = 0;
    if (typeof s.capRaises !== 'number') s.capRaises = 0;
    // Rung-3-shaped blobs predate the craft (rung-4 spec bar 8).
    if (!Array.isArray(s.cookbook)) s.cookbook = [];
    if (typeof s.aspects !== 'object' || s.aspects === null) s.aspects = {};
    if (typeof s.proposalPressure !== 'object') s.proposalPressure = null;
    if (typeof s.deepestCleared !== 'number') s.deepestCleared = 0;
    return s;
  } catch {
    return null;
  }
}

/** Accrue desk uptime (clamped — sleep/occlusion gaps are not uptime). */
export function accrueUptime(state: DelveState, deltaMs: number): void {
  state.uptimeMs += Math.max(0, Math.min(UPTIME_CLAMP_MS, deltaMs));
}

export function dispatchDue(state: DelveState): boolean {
  return state.active === null
    && state.delvers.length > 0
    && state.uptimeMs >= state.nextDispatchAtUptimeMs;
}

/** Nobody could walk the dispatch — try again after a short while. */
export function deferDispatch(state: DelveState): void {
  state.nextDispatchAtUptimeMs = state.uptimeMs + DISPATCH_RETRY_MS;
}

/**
 * The dispatching being reached the shaft mouth: draw the whole
 * expedition (outcome + timeline) from the seq-seeded stream and put it
 * below ground. The outcome is decided here; the minutes that follow
 * are theatre for the undercroft window.
 */
export function beginExpedition(
  state: DelveState,
  dispatcherId: string,
  params: ExpeditionParams,
  nowMs: number,
): ActiveExpedition {
  const seq = state.expeditionSeq;
  state.expeditionSeq += 1;
  const prng = expeditionPrng(state.wing, seq);
  const size = Math.min(Math.max(1, params.partySize), state.delvers.length);
  const effective: ExpeditionParams = { ...params, partySize: size };
  // Rung 4: a warded dispatch is a veneration — the dispatcher's faith
  // deed (Addendum 8: Tier-0-observable, zero draws).
  if (effective.warded) accrueAspect(state, dispatcherId, 'faith');
  const outcome = runExpedition(effective, prng);
  // Party = the first `size` of the roster, rotated by seq so the same
  // few don't shoulder every delve. Deterministic given the roster.
  const partyIds = Array.from(
    { length: size },
    (_, i) => state.delvers[(seq + i) % state.delvers.length].id,
  );
  const active: ActiveExpedition = {
    seq,
    dispatcherId,
    partyIds,
    startedAtMs: nowMs,
    resolveAtMs: nowMs + outcome.durationS * 1000,
    hazardAtMs: outcome.hazardAtFrac === null
      ? null
      : nowMs + outcome.durationS * 1000 * outcome.hazardAtFrac,
    outcome,
    params: effective,
  };
  state.active = active;
  return active;
}

export interface Resolution {
  kind: OutcomeKind;
  dispatcherId: string;
  /** Name of the first delver lost, when any were ('' otherwise). */
  deadName: string;
  deadCount: number;
  gold: number;
  /** Rung 3: where this resolution's tranche went, if one was due. */
  spent: 'monument' | 'colony' | null;
  /** Shrine stage after the spend — the caller marks stage crossings. */
  shrineStageAfter: number;
  /** Rung 4: this delve marked the dispatcher's mind — the caller
   *  queues the perception that accrues reflection pressure. */
  notable: boolean;
}

/**
 * The expedition's hour is up: apply the precomputed outcome — the dead
 * leave the roster forever, gold joins the invisible hoard, a
 * replacement (at most one on the road at a time) starts the slow walk
 * from elsewhere. Returns what the marginalia needs, or null if nothing
 * was due.
 *
 * Rung 3: after the gold banks, one tranche may leave the hoard —
 * routed by the DISPATCHER's temperament (timid builds the shrine, bold
 * grows the colony; a full cap ladder routes everything to the shrine).
 * Pure in (state, boldness): zero prng draws, so no expedition stream
 * can move (rung-3 spec bar 1). Unknown dispatchers pass 0.5 (bold side
 * of the split — reinvest — matching DEFAULT_LAND_PERSONA's directive).
 */
export function resolveExpedition(
  state: DelveState,
  nowMs: number,
  dispatcherBoldness = 0.5,
): Resolution | null {
  const a = state.active;
  if (!a || nowMs < a.resolveAtMs) return null;
  const deadIds = a.outcome.deadIndices
    .map((i) => a.partyIds[i])
    .filter((id): id is string => id !== undefined);
  const deadNames = state.delvers.filter((d) => deadIds.includes(d.id)).map((d) => d.name);
  state.delvers = state.delvers.filter((d) => !deadIds.includes(d.id));
  state.hoardGold += a.outcome.gold;
  // Rung 4: the colony buys granted workings — after the gold banks,
  // BEFORE the tranche. Pure, zero draws; pacing gates the earliest
  // payment, the reserve is never spent into, unpaid grants retry at
  // every resolution until affordable.
  for (const g of state.cookbook) {
    if (g.paid) continue;
    if (g.pacing === 'after-the-next-return' && a.seq < g.grantedAtSeq) continue;
    if (state.hoardGold >= SPEND_RESERVE + g.price) {
      state.hoardGold -= g.price;
      g.paid = true;
    }
  }
  let spent: 'monument' | 'colony' | null = null;
  if (state.hoardGold >= SPEND_RESERVE + SPEND_TRANCHE) {
    state.hoardGold -= SPEND_TRANCHE;
    const capFull = state.targetPop + state.capRaises >= POPULATION_HARD_CAP;
    if (dispatcherBoldness >= 0.5 && !capFull) {
      state.capRaises += 1;
      spent = 'colony';
    } else {
      state.monumentFund += SPEND_TRANCHE;
      spent = 'monument';
    }
  }
  state.active = null;
  const prng = mulberry32(delveHash(`delve-sched:${state.wing}:${a.seq}`));
  state.uptimeMs = 0;
  state.nextDispatchAtUptimeMs = prng.range(DISPATCH_GAP_MS[0], DISPATCH_GAP_MS[0] + DISPATCH_GAP_MS[1]);
  if (state.delvers.length < effectiveTargetPop(state) && state.nextArrivalAtMs === null) {
    state.nextArrivalAtMs = nowMs + prng.range(ARRIVAL_GAP_MS[0], ARRIVAL_GAP_MS[0] + ARRIVAL_GAP_MS[1]);
  }
  const kind = outcomeKind(a.outcome, a.partyIds.length);
  // Rung 4: the dispatcher's deeds (Addendum 8 — Tier-0-observable
  // outcomes only, zero draws). A drive-off survived is a war deed.
  if (kind === 'rich') accrueAspect(state, a.dispatcherId, 'harvest');
  if (deadIds.length > 0) accrueAspect(state, a.dispatcherId, 'death');
  if (a.outcome.encountered && !a.outcome.fled && kind !== 'lost') {
    accrueAspect(state, a.dispatcherId, 'war');
  }
  // Rung 4: a notable delve marks the dispatcher's mind (bar 3). The
  // founding run sets the depth baseline quietly; only a bettered mark
  // counts as a first-clear.
  const firstClear = state.deepestCleared > 0 && a.outcome.stepsCleared > state.deepestCleared;
  state.deepestCleared = Math.max(state.deepestCleared, a.outcome.stepsCleared);
  const notable = kind === 'lost'
    || deadIds.length >= NOTABLE_DEAD_MIN
    || firstClear
    || a.outcome.gold >= NOTABLE_GOLD_MIN;
  if (notable) {
    state.proposalPressure = { dispatcherId: a.dispatcherId, seq: a.seq, kind };
  }
  return {
    kind,
    dispatcherId: a.dispatcherId,
    deadName: deadNames[0] ?? '',
    deadCount: deadIds.length,
    gold: a.outcome.gold,
    spent,
    shrineStageAfter: shrineStage(state.monumentFund),
    notable,
  };
}

/** A replacement reaches the colony (wall clock — they travel while the
 *  desk sleeps). Returns the newcomer, or null if none was due. */
export function tickArrival(state: DelveState, nowMs: number): Delver | null {
  if (state.nextArrivalAtMs === null || nowMs < state.nextArrivalAtMs) return null;
  const d = recruit(state);
  state.delvers.push(d);
  if (state.delvers.length < effectiveTargetPop(state)) {
    const prng = mulberry32(delveHash(`delve-arrive:${state.wing}:${state.recruitSeq}`));
    state.nextArrivalAtMs = nowMs + prng.range(ARRIVAL_GAP_MS[0], ARRIVAL_GAP_MS[0] + ARRIVAL_GAP_MS[1]);
  } else {
    state.nextArrivalAtMs = null;
  }
  return d;
}

/**
 * The one wing that keeps delvers (spec: exactly one). First of the
 * profile's known wings, sorted — stable across sessions because
 * allWings is profile-derived; open wings are the fallback for payloads
 * without it. Every window computes the same answer from the same
 * topology broadcast, so nobody has to talk.
 */
export function delverWingOf(
  allWings: readonly string[],
  openWings: readonly string[],
): string | null {
  const pool = allWings.length > 0 ? allWings : openWings;
  if (pool.length === 0) return null;
  return [...pool].sort()[0];
}
