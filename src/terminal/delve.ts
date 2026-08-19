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

/** What a being's directive will move at rung 2 — engine defaults now. */
export interface ExpeditionParams {
  /** Steps of descent attempted (deeper pays more, risks more). */
  depth: number;
  /** Fight rounds endured before fleeing the creature. */
  retreatThreshold: number;
  /** Delvers sent (capped by the living population at dispatch). */
  partySize: number;
}

export const DEFAULT_EXPEDITION_PARAMS: ExpeditionParams = {
  depth: 6,
  retreatThreshold: 2,
  partySize: 3,
};

// Creature-hazard dice (spec bar 3: ONE creature, dice-driven). The
// creature lairs at a drawn step; meeting it starts rounds of danger.
const LAIR_STEP_MIN = 2;
/** Chance the creature is home when the party passes its lair. */
const ENCOUNTER_CHANCE = 0.35;
/** Per-round chance the exposed delver dies. */
const ROUND_DEATH_CHANCE = 0.1;
/** Per-round chance the party drives the creature off, plus a hand each. */
const DRIVE_OFF_BASE = 0.2;
const DRIVE_OFF_PER_DELVER = 0.08;
/** Gold per step cleared: BASE + step (deeper pays more). Halved on a
 *  flight — dropped sacks are part of the melancholy. */
const GOLD_STEP_BASE = 2;

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
  let encountered = false;
  let fled = false;
  let stepsCleared = 0;
  for (let step = 0; step < depth; step++) {
    if (step === lairStep && prng.next() < ENCOUNTER_CHANCE) {
      encountered = true;
      let rounds = 0;
      while (alive.size > 0) {
        rounds += 1;
        // One delver stands exposed this round.
        const exposed = [...alive][prng.range(0, alive.size)];
        if (prng.next() < ROUND_DEATH_CHANCE) alive.delete(exposed);
        if (alive.size === 0) break;
        if (prng.next() < DRIVE_OFF_BASE + DRIVE_OFF_PER_DELVER * alive.size) break;
        if (rounds >= Math.max(1, params.retreatThreshold)) {
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
    for (let s = 0; s < stepsCleared; s++) gold += GOLD_STEP_BASE + s;
    if (fled) gold = Math.floor(gold / 2);
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
}

/**
 * The expedition's hour is up: apply the precomputed outcome — the dead
 * leave the roster forever, gold joins the invisible hoard, a
 * replacement (at most one on the road at a time) starts the slow walk
 * from elsewhere. Returns what the marginalia needs, or null if nothing
 * was due.
 */
export function resolveExpedition(state: DelveState, nowMs: number): Resolution | null {
  const a = state.active;
  if (!a || nowMs < a.resolveAtMs) return null;
  const deadIds = a.outcome.deadIndices
    .map((i) => a.partyIds[i])
    .filter((id): id is string => id !== undefined);
  const deadNames = state.delvers.filter((d) => deadIds.includes(d.id)).map((d) => d.name);
  state.delvers = state.delvers.filter((d) => !deadIds.includes(d.id));
  state.hoardGold += a.outcome.gold;
  state.active = null;
  const prng = mulberry32(delveHash(`delve-sched:${state.wing}:${a.seq}`));
  state.uptimeMs = 0;
  state.nextDispatchAtUptimeMs = prng.range(DISPATCH_GAP_MS[0], DISPATCH_GAP_MS[0] + DISPATCH_GAP_MS[1]);
  if (state.delvers.length < state.targetPop && state.nextArrivalAtMs === null) {
    state.nextArrivalAtMs = nowMs + prng.range(ARRIVAL_GAP_MS[0], ARRIVAL_GAP_MS[0] + ARRIVAL_GAP_MS[1]);
  }
  return {
    kind: outcomeKind(a.outcome, a.partyIds.length),
    dispatcherId: a.dispatcherId,
    deadName: deadNames[0] ?? '',
    deadCount: deadIds.length,
    gold: a.outcome.gold,
  };
}

/** A replacement reaches the colony (wall clock — they travel while the
 *  desk sleeps). Returns the newcomer, or null if none was due. */
export function tickArrival(state: DelveState, nowMs: number): Delver | null {
  if (state.nextArrivalAtMs === null || nowMs < state.nextArrivalAtMs) return null;
  const d = recruit(state);
  state.delvers.push(d);
  if (state.delvers.length < state.targetPop) {
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
