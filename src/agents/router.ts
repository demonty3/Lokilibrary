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
  tickAgent,
  type AgentPerception,
  type AgentSnapshot,
  type AgentTickResult,
} from '../api/agent';

/** Recent-memory tuple the router sends with each Tier-1 call. */
export interface RecentMemorySummary {
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

export interface Tier1Transport {
  call(
    agent: AgentSnapshot,
    perception: AgentPerception,
    context: Tier1Context,
  ): Promise<AgentTickResult>;
}

export const defaultTier1Transport: Tier1Transport = {
  call(agent, perception, context) {
    return tickAgent(agent, perception, context);
  },
};

export interface MemoryWriter {
  /** Persist a `player_proximity` / `agent_meeting` / etc. as an
   *  `observation` memory. Returns the new memory id or null on no-op
   *  (tests + web build pass a no-op writer). */
  recordPerception(
    agentId: string,
    event: PerceptionEvent,
    importance: number,
  ): string | null;
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
  /** Fetch the N most-recent memories for an agent (router context). */
  recentMemories(agentId: string, n: number): readonly RecentMemorySummary[];
  /** Read the agent's persona row, if any. */
  persona(agentId: string): PersonaSnippet | null;
}

export const nullMemoryWriter: MemoryWriter = {
  recordPerception: () => null,
  logTier1: () => undefined,
  recentMemories: () => [],
  persona: () => null,
};

/** Naive Haiku 4.5 cost estimate — $0.80/M input, $4.00/M output as of
 *  2026-05. Adjust in slice 2F when telemetry overlay reads from
 *  per-provider price tables. */
const PRICE_USD_PER_MTOK_IN = 0.8;
const PRICE_USD_PER_MTOK_OUT = 4.0;

/** Action verbs the router refuses to install into `runtime.intent`.
 *  See CLAUDE.md "don't make the agent a chatbot". */
const DENY_VERBS: readonly string[] = ['speak', 'say', 'tell', 'ask', 'chat'];

export interface RouteOptions {
  /** Override `def.tier1ThrottleMs` for tests. */
  throttleMs?: number;
  /** Inject a transport + memory writer; defaults to production HTTP +
   *  null-writer respectively. */
  transport?: Tier1Transport;
  memory?: MemoryWriter;
  /** Recent-memory window size to include in context. Default 5. */
  recentMemoryCount?: number;
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
  const events = runtime.perceptionQueue.splice(
    0,
    runtime.perceptionQueue.length,
  );
  for (const ev of events) {
    memory.recordPerception(runtime.id, ev, importanceFor(ev.kind));
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

  memory.logTier1({
    agentId: runtime.id,
    model: result.tick.model,
    provider: result.tick.provider,
    // Phase 2C: we don't get token counts back from the Worker yet
    // (the existing /api/agent/tick response shape doesn't include them).
    // Stub with zeros; slice 2F extends the worker response + reads here.
    tokensIn: 0,
    tokensOut: 0,
    latencyMs: result.tick.latencyMs,
    costUsdEst: estimateCost(0, 0),
  });

  return { dispatched: true, tick: { action: result.tick.action, intent: result.tick.intent } };
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

function estimateCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn * PRICE_USD_PER_MTOK_IN) / 1_000_000 +
    (tokensOut * PRICE_USD_PER_MTOK_OUT) / 1_000_000
  );
}
