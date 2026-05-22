/**
 * Phase 2C Tier-1 dispatcher. The cohort renderer calls `routeTier1`
 * after each perception pass; this module decides whether to call the
 * Worker (`/api/agent/tick`), enforces the per-agent throttle, parses
 * the result, and writes the resulting `intent` back onto the agent's
 * runtime state so the Tier-0 BT picks it up on the next tick.
 *
 * Two surfaces are injected so the router is testable without a live
 * Worker or live DB:
 *
 *   - `Tier1Transport` — wraps the HTTP call. Production uses
 *     `defaultTier1Transport` (which calls `tickAgent` from api/agent.ts).
 *     Tests inject a stub returning canned `{action, intent}`.
 *   - `MemoryWriter` — wraps observation + telemetry writes. Production
 *     wraps the better-sqlite3 store; web/dev passes `nullMemoryWriter`
 *     (everything no-ops, dispatch still runs).
 *
 * Whitelist: Loki's persona forbids `speak`/`say`/`tell`/`ask`/`chat`
 * verbs. The router drops a Tier-1 response whose action starts with
 * any deny-listed verb and leaves `runtime.intent` unchanged — the BT
 * stays on its current action. Slice 2F adds a one-shot re-prompt;
 * Phase 2C just drops + logs.
 */

import type { AgentDef } from './cohort';
import type { AgentRuntimeState, PerceptionEvent } from '../state/agentRuntime';
import {
  reflectAgent,
  tickAgent,
  type AgentPerception,
  type AgentSnapshot,
  type AgentTickResult,
  type ReflectInput,
  type ReflectOutcome,
} from '../api/agent';

/** Recent-memory tuple the router sends with each Tier-1 call.
 *  `id` is required so Tier-2 reflections can populate
 *  `synthesised_from` with the ids of the memories the model drew on. */
export interface RecentMemorySummary {
  readonly id: string;
  readonly text: string;
  readonly kind: 'observation' | 'reflection' | 'plan' | 'dialogue';
  readonly created_at: number;
  readonly importance: number;
}

/** Persona snippet — Phase 2C passes this through; slice 2F finalises
 *  the per-agent persona prompt block. */
export interface PersonaSnippet {
  readonly name: string;
  readonly system_prompt: string;
}

/** Context the router builds before each Tier-1 dispatch. */
export interface Tier1Context {
  readonly recentMemories: readonly RecentMemorySummary[];
  readonly persona: PersonaSnippet | null;
}

/** Transport over the agent endpoints. Production wraps the HTTP
 *  fetches in api/agent.ts; tests inject canned responses. */
export interface AgentTransport {
  call(
    agent: AgentSnapshot,
    perception: AgentPerception,
    context: Tier1Context,
  ): Promise<AgentTickResult>;
  reflect(input: ReflectInput): Promise<ReflectOutcome>;
}

/** Back-compat alias from the 2C-era name. */
export type Tier1Transport = AgentTransport;

export const defaultAgentTransport: AgentTransport = {
  call(agent, perception, context) {
    return tickAgent(agent, perception, context);
  },
  reflect(input) {
    return reflectAgent(input);
  },
};

/** Back-compat alias. */
export const defaultTier1Transport: AgentTransport = defaultAgentTransport;

export interface MemoryWriter {
  /** Persist a `player_proximity` / `agent_meeting` / etc. as an
   *  `observation` memory. Returns the new memory id or null on no-op
   *  (tests + web build pass a no-op writer). */
  recordPerception(
    agentId: string,
    event: PerceptionEvent,
    importance: number,
  ): string | null;
  /** Persist a Tier-2 reflection. */
  recordReflection(args: {
    agentId: string;
    text: string;
    synthesisedFrom: readonly string[];
    themes: readonly string[];
    importance: number;
  }): string | null;
  /** Log one Tier-1 dispatch into `agent_telemetry`. */
  logTier1(args: {
    agentId: string;
    model: string;
    provider: string;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    costUsdEst: number;
  }): void;
  /** Log one Tier-2 reflection dispatch — separate row so cost reporting
   *  can break out Sonnet vs Haiku spend. */
  logTier2(args: {
    agentId: string;
    model: string;
    provider: string;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    costUsdEst: number;
  }): void;
  /** Fetch the N most-recent memories for an agent (router context). */
  recentMemories(agentId: string, n: number): readonly RecentMemorySummary[];
  /** Read the agent's persona row, if any. */
  persona(agentId: string): PersonaSnippet | null;
}

export const nullMemoryWriter: MemoryWriter = {
  recordPerception: () => null,
  recordReflection: () => null,
  logTier1: () => undefined,
  logTier2: () => undefined,
  recentMemories: () => [],
  persona: () => null,
};

/** Naive Haiku 4.5 cost estimate — $0.80/M input, $4.00/M output as of
 *  2026-05. Adjust in slice 2F when telemetry overlay reads from
 *  per-provider price tables. */
const PRICE_USD_PER_MTOK_IN = 0.8;
const PRICE_USD_PER_MTOK_OUT = 4.0;
/** Sonnet 4.6 cost — $3/M input, $15/M output as of 2026-05. */
const PRICE_SONNET_PER_MTOK_IN = 3.0;
const PRICE_SONNET_PER_MTOK_OUT = 15.0;

/** Smallville reflection threshold. Sum of accumulated importance values
 *  the agent has experienced since its last reflection; when this crosses
 *  the threshold, fire Tier 2. 150 is the verbatim Smallville constant;
 *  slice 2F telemetry will tell us if real-time-only cadence wants ~80–100. */
export const REFLECTION_THRESHOLD = 150;

/** Action verbs the router refuses to install into `runtime.intent`.
 *  See CLAUDE.md "don't make the agent a chatbot". */
const DENY_VERBS: readonly string[] = ['speak', 'say', 'tell', 'ask', 'chat'];

export interface RouteOptions {
  /** Override `def.tier1ThrottleMs` for tests. */
  throttleMs?: number;
  /** Inject a transport + memory writer; defaults to production HTTP +
   *  null-writer respectively. */
  transport?: AgentTransport;
  memory?: MemoryWriter;
  /** Recent-memory window size to include in context. Default 5. */
  recentMemoryCount?: number;
  /** Override reflection threshold (Smallville default = 150). */
  reflectionThreshold?: number;
  /** Recent-memory window size to ship to Tier 2. Default 25 — enough
   *  surface for the model to find a pattern without blowing the
   *  context budget. */
  reflectionMemoryCount?: number;
}

export interface RouteResult {
  /** True if this call dispatched Tier 1; false if throttled / empty. */
  dispatched: boolean;
  /** Reason for the no-dispatch decision. */
  skipReason?: 'throttled' | 'empty_queue' | 'absent' | 'rejected';
  /** Resulting tick payload — populated only when `dispatched` is true. */
  tick?: { action: string; intent: string };
}

/**
 * Drain `runtime.perceptionQueue` and (if conditions are met) dispatch
 * a Tier-1 call. Idempotent within a tick — call from the cohort
 * renderer once per agent per frame.
 */
export async function routeTier1(
  def: AgentDef,
  runtime: AgentRuntimeState,
  scene: string,
  now: number,
  opts: RouteOptions = {},
): Promise<RouteResult> {
  if (!runtime.present) {
    runtime.perceptionQueue.length = 0;
    return { dispatched: false, skipReason: 'absent' };
  }
  if (runtime.perceptionQueue.length === 0) {
    return { dispatched: false, skipReason: 'empty_queue' };
  }

  const throttle = opts.throttleMs ?? def.tier1ThrottleMs;
  // lastTier1At === 0 means this agent has never dispatched; treat as
  // "throttle window already elapsed" so the very first call goes
  // through. Without this guard a fresh runtime stays cold for the
  // entire first throttle window after cell-mount.
  if (throttle > 0 && runtime.lastTier1At > 0 && now - runtime.lastTier1At < throttle) {
    return { dispatched: false, skipReason: 'throttled' };
  }

  const transport = opts.transport ?? defaultTier1Transport;
  const memory = opts.memory ?? nullMemoryWriter;
  const recentN = opts.recentMemoryCount ?? 5;

  // Drain the queue + write observations for each salient event.
  // Each event's importance also accrues toward the Smallville
  // reflection threshold — Tier 2 fires when the sum crosses
  // REFLECTION_THRESHOLD.
  const events = runtime.perceptionQueue.splice(
    0,
    runtime.perceptionQueue.length,
  );
  for (const ev of events) {
    const imp = importanceFor(ev.kind);
    memory.recordPerception(runtime.id, ev, imp);
    runtime.reflectionCounter += imp;
  }

  // Mark the dispatch attempt up-front so a slow / failed call still
  // counts toward throttle (prevents thundering-herd on Worker outage).
  runtime.lastTier1At = now;

  const agent: AgentSnapshot = {
    id: runtime.id,
    name: def.name,
    personality: def.id, // slice 2F replaces with persona snippet
  };
  const perception: AgentPerception = {
    scene,
    saw: events.map((e) => describe(e)),
    lastAction: runtime.currentAction.kind,
  };
  const context: Tier1Context = {
    recentMemories: memory.recentMemories(runtime.id, recentN),
    persona: memory.persona(runtime.id),
  };

  const result = await transport.call(agent, perception, context);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[router] tier1 ${runtime.id} failed: ${result.error}`);
    return { dispatched: false, skipReason: 'rejected' };
  }

  // Whitelist enforcement: drop responses opening with deny-listed verbs.
  const verb = (result.tick.action.trim().split(/\s+/)[0] ?? '').toLowerCase();
  if (DENY_VERBS.includes(verb)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[router] tier1 ${runtime.id} rejected — verb "${verb}" denied; ` +
        `action="${result.tick.action}"`,
    );
    return { dispatched: false, skipReason: 'rejected' };
  }

  runtime.intent = result.tick.intent;

  // Phase 2D: token counts now flow from the worker response. Cost
  // estimate uses Haiku pricing — slice 2F will branch on result.tick.model.
  const tokensIn = (result.tick as { tokensIn?: number }).tokensIn ?? 0;
  const tokensOut = (result.tick as { tokensOut?: number }).tokensOut ?? 0;
  memory.logTier1({
    agentId: runtime.id,
    model: result.tick.model,
    provider: result.tick.provider,
    tokensIn,
    tokensOut,
    latencyMs: result.tick.latencyMs,
    costUsdEst: estimateHaikuCost(tokensIn, tokensOut),
  });

  return { dispatched: true, tick: { action: result.tick.action, intent: result.tick.intent } };
}

/**
 * Tier-2 reflection dispatcher. The cohort renderer calls this after
 * each successful Tier-1 dispatch — it fires only when
 * `runtime.reflectionCounter` has crossed `REFLECTION_THRESHOLD`. On
 * success the counter resets and a `reflection` memory lands in the
 * store (or the null writer no-ops, in tests / pure-web).
 *
 * Idempotent: a second call before the counter re-accumulates returns
 * `{dispatched: false, skipReason: 'below_threshold'}`.
 */
export interface ReflectRouteResult {
  dispatched: boolean;
  skipReason?: 'below_threshold' | 'no_memories' | 'rejected';
  reflection?: { text: string; synthesised_from: readonly string[] };
}

export async function routeTier2(
  def: AgentDef,
  runtime: AgentRuntimeState,
  now: number,
  opts: RouteOptions = {},
): Promise<ReflectRouteResult> {
  const threshold = opts.reflectionThreshold ?? REFLECTION_THRESHOLD;
  if (runtime.reflectionCounter < threshold) {
    return { dispatched: false, skipReason: 'below_threshold' };
  }
  const transport = opts.transport ?? defaultAgentTransport;
  const memory = opts.memory ?? nullMemoryWriter;
  const n = opts.reflectionMemoryCount ?? 25;

  const recent = memory.recentMemories(runtime.id, n);
  if (recent.length === 0) {
    // Counter accumulated but no rows persisted (null writer or DB
    // bootstrap pending). Reset so we don't keep retrying.
    runtime.reflectionCounter = 0;
    return { dispatched: false, skipReason: 'no_memories' };
  }

  // Mark counter consumed up-front so a slow / failed call doesn't
  // re-trigger on the next tick.
  runtime.reflectionCounter = 0;

  const outcome = await transport.reflect({
    agent: { id: def.id, name: def.name },
    recentMemories: recent,
    persona: memory.persona(def.id),
  });
  if (!outcome.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[router] tier2 ${def.id} failed: ${outcome.error}`);
    return { dispatched: false, skipReason: 'rejected' };
  }

  memory.recordReflection({
    agentId: def.id,
    text: outcome.result.reflection,
    synthesisedFrom: outcome.result.synthesised_from,
    themes: outcome.result.themes,
    importance: outcome.result.importance,
  });
  memory.logTier2({
    agentId: def.id,
    model: outcome.result.model,
    provider: outcome.result.provider,
    tokensIn: outcome.result.tokensIn,
    tokensOut: outcome.result.tokensOut,
    latencyMs: outcome.result.latencyMs,
    costUsdEst: estimateSonnetCost(outcome.result.tokensIn, outcome.result.tokensOut),
  });

  // `now` is unused at the moment — accepted for future telemetry
  // attribution (which 1-minute bucket the reflection landed in).
  void now;

  return {
    dispatched: true,
    reflection: {
      text: outcome.result.reflection,
      synthesised_from: outcome.result.synthesised_from,
    },
  };
}

// ---------- helpers ----------

function describe(ev: PerceptionEvent): string {
  switch (ev.kind) {
    case 'player_proximity':
      return `player at (${ev.at.x},${ev.at.y})`;
    case 'player_holding':
      return `player has been here for a while`;
    case 'agent_meeting':
      return `${ev.subject} nearby at (${ev.at.x},${ev.at.y})`;
    case 'bookshelf_in_reach':
      return `bookshelf at (${ev.at.x},${ev.at.y})`;
    default:
      return `${ev.kind}${ev.subject ? `:${ev.subject}` : ''}`;
  }
}

function importanceFor(kind: string): number {
  switch (kind) {
    case 'player_holding':
      return 6;
    case 'player_proximity':
      return 4;
    case 'agent_meeting':
      return 6;
    case 'bookshelf_in_reach':
      return 3;
    default:
      return 3;
  }
}

function estimateHaikuCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn * PRICE_USD_PER_MTOK_IN) / 1_000_000 +
    (tokensOut * PRICE_USD_PER_MTOK_OUT) / 1_000_000
  );
}

function estimateSonnetCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn * PRICE_SONNET_PER_MTOK_IN) / 1_000_000 +
    (tokensOut * PRICE_SONNET_PER_MTOK_OUT) / 1_000_000
  );
}
