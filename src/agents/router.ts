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
import { defaultLoreGatherer, type LoreGatherer } from './lore-context';
import { buildLoreProfile } from './lore-profile';

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

/** Shape returned by MemoryWriter.aggregateTelemetry — re-exported
 *  from telemetry.ts as a type so the interface stays stand-alone. */
export interface TelemetrySummary {
  windowMs: number;
  total: {
    tier1Count: number;
    tier2Count: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    meanLatencyMs: number;
  };
  byModel: Map<string, {
    tier1Count: number;
    tier2Count: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    meanLatencyMs: number;
  }>;
}

/** Persona snippet — Phase 2C passes this through; slice 2F finalises
 *  the per-agent persona prompt block. */
export interface PersonaSnippet {
  readonly name: string;
  readonly system_prompt: string;
}

/** Lore chunk surfaced to the reflection prompt (Phase 5C). Library-
 *  scoped uploaded canon the agent can weave into its reflection. */
export interface LoreSnippet {
  readonly id: string;
  readonly text: string;
  readonly source: string;
}

/** Context the router builds before each Tier-1 dispatch. */
export interface Tier1Context {
  readonly recentMemories: readonly RecentMemorySummary[];
  readonly persona: PersonaSnippet | null;
  /** Phase 2F: set on the one allowed retry after a deny-verb
   *  rejection. Worker prepends a corrective preamble. */
  readonly reprompt?: boolean;
  /** Verbs the LLM should avoid this turn. Worker passes through to
   *  the reprompt preamble. */
  readonly denyVerbs?: readonly string[];
  /** Agent-mind pass — capped library-context line (see RouteOptions). */
  readonly library?: string;
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
  /** Persist a Plan. Used by the bookshelf launch path: Loki's plan
   *  carries a `place_mark` step the cell renderer picks up on next
   *  mount to draw a marginalia glyph. */
  recordPlan(args: {
    agentId: string;
    text: string;
    steps: ReadonlyArray<{
      kind: 'move_to' | 'inspect' | 'place_mark' | 'linger' | 'withdraw';
      target?: string;
      location?: { x: number; y: number };
      status: 'pending' | 'done';
    }>;
    status: 'active' | 'completed' | 'abandoned';
    importance: number;
  }): string | null;
  /** Read place_mark steps the agent has previously written for this
   *  cell. Cell renderer uses this at mount to render marginalia
   *  glyphs that survive restart. */
  placedMarksForCell(cellId: string): ReadonlyArray<{
    agentId: string;
    location: { x: number; y: number };
    target?: string;
    text: string;
  }>;
  /** Aggregate the last `windowMs` of agent_telemetry into a CostSummary.
   *  Used by the Phase 2F debug overlay (Ctrl+\`). Null writer returns
   *  an empty zero summary so the overlay can render "no data" without
   *  branching. */
  aggregateTelemetry(windowMs: number, nowMs?: number): TelemetrySummary;
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

  // ---- Lore (Phase 5C) — library-scoped, not per-agent ----
  /** Persist one uploaded lore chunk. `embedding` (768-dim, from the
   *  worker /api/embed route) is attached when present; FTS5 indexes the
   *  text regardless. Returns the new lore id or null (null writer). */
  recordLore(args: {
    text: string;
    source: string;
    embedding?: readonly number[];
  }): string | null;
  /** Retrieve top-N lore for the writer's library. With a query
   *  embedding (and sqlite-vec loaded) ranks by cosine; otherwise by
   *  recency. */
  recentLore(n: number, queryEmbedding?: Float32Array): readonly LoreSnippet[];
  /** Count lore chunks in the writer's library (gates the reflect-time
   *  query-embed: skip the embed call entirely when there's no lore). */
  loreCount(): number;
}

export const nullMemoryWriter: MemoryWriter = {
  recordPerception: () => null,
  recordReflection: () => null,
  recordPlan: () => null,
  placedMarksForCell: () => [],
  logTier1: () => undefined,
  logTier2: () => undefined,
  recentMemories: () => [],
  persona: () => null,
  recordLore: () => null,
  recentLore: () => [],
  loreCount: () => 0,
  aggregateTelemetry: (windowMs) => ({
    windowMs,
    total: {
      tier1Count: 0,
      tier2Count: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      meanLatencyMs: 0,
    },
    byModel: new Map(),
  }),
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

/** Phase 5 5A — minimum wall-clock interval between Tier-2 dispatches
 *  per agent. PLAN.md § Phase 5: "Batched: queue events, fire one
 *  reflection per agent per real-world hour." Even when the importance
 *  counter crosses threshold, the dispatch is gated — the counter
 *  keeps accumulating (no reset on rate-limited skip) so the
 *  next-eligible reflection has full context, but the Sonnet call is
 *  suppressed until the interval elapses.
 *
 *  Default 3,600,000 ms = 1 hour. CLAUDE.md cost math: 5 agents × 12
 *  wake hours × 30 days = 1800 calls/month ≈ $0.30/month at Sonnet
 *  rates. Well under the ≤ $1/user/month target.
 *
 *  Phase 5 5B's SLEEPING throttle state relaxes this to a shorter
 *  interval (~5 min) for the duration of sleep, so overnight
 *  reflection has room to populate the morning dispatch. */
export const REFLECTION_MIN_INTERVAL_MS = 60 * 60 * 1000;

/** Action verbs the router refuses to install into `runtime.intent`.
 *  See CLAUDE.md "don't make the agent a chatbot". Loki's persona file
 *  has its own narrower whitelist; this is the global fallback. */
const DENY_VERBS: readonly string[] = ['speak', 'say', 'tell', 'ask', 'chat'];

/** Process-local rejection / reprompt counters — Phase 2F overlay
 *  surfaces these alongside cost telemetry. Reset on cell mount (cohort
 *  renderer teardown clears via `resetRouterStats()`). */
const routerStats = {
  rejections: 0,
  reprompts: 0,
  repromptRecovered: 0,
};

export interface RouterStatsSnapshot {
  rejections: number;
  reprompts: number;
  /** Number of reprompts that successfully produced a non-rejected verb. */
  repromptRecovered: number;
}

export function getRouterStats(): RouterStatsSnapshot {
  return { ...routerStats };
}

export function resetRouterStats(): void {
  routerStats.rejections = 0;
  routerStats.reprompts = 0;
  routerStats.repromptRecovered = 0;
}

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
  /** Phase 5 5A — override the per-real-hour rate-limit interval (ms).
   *  Default `REFLECTION_MIN_INTERVAL_MS` = 1 hour. Phase 5 5B passes
   *  a shorter interval during SLEEPING; tests override to verify
   *  the throttle. */
  reflectionMinIntervalMs?: number;
  /** Recent-memory window size to ship to Tier 2. Default 25 — enough
   *  surface for the model to find a pattern without blowing the
   *  context budget. */
  reflectionMemoryCount?: number;
  /** Phase 5C — top-K lore chunks the gatherer retrieves when raw-lore
   *  quoting is enabled (see `loreQuote`). Default 4. */
  loreCount?: number;
  /** Phase 5C — inject the lore gatherer (embed + retrieve). Defaults to
   *  `defaultLoreGatherer`; tests pass a deterministic stub. Only invoked
   *  when `loreQuote` is true. */
  gatherLore?: LoreGatherer;
  /** Phase 5D — OPT-IN closed-vocab lore egress (default off). When true,
   *  routeTier2 attaches a CLOSED-VOCAB loreContext {themes, tone} only —
   *  never raw lore text or keywords. Local theming (palette recolor +
   *  scatter) is independent of this flag. */
  loreEnabled?: boolean;
  /** Phase 5D.4 — SECOND, INDEPENDENT opt-in (default off). When true,
   *  routeTier2 retrieves raw lore excerpts via `gatherLore` and ships them
   *  (text + source filename) to the model so the agent can reference
   *  specific names/places. Distinct from `loreEnabled`; either, both, or
   *  neither may be on. Off → no raw lore is gathered or egressed. */
  loreQuote?: boolean;
  /** Force Tier-2 dispatch even when below threshold AND ignore the
   *  per-real-hour rate-limit. Used by direct user actions (game
   *  launch) per CLAUDE.md "Tier 2 fires only on reflection threshold
   *  or direct user action". */
  force?: boolean;
  /** Agent-mind pass — capped library-context line, threaded into both
   *  tiers' prompts. Callers build it once per mount via
   *  buildLibraryContext (never per tick). */
  library?: string;
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
    ...(opts.library && { library: opts.library }),
  };

  let result = await transport.call(agent, perception, context);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[router] tier1 ${runtime.id} failed: ${result.error}`);
    return { dispatched: false, skipReason: 'rejected' };
  }

  // Whitelist enforcement: drop responses opening with deny-listed verbs.
  let verb = (result.tick.action.trim().split(/\s+/)[0] ?? '').toLowerCase();
  if (DENY_VERBS.includes(verb)) {
    // Phase 2F: one-shot re-prompt before giving up. The worker
    // prepends a corrective preamble; if the model still produces a
    // banned verb we drop + bump the rejection counter.
    routerStats.reprompts++;
    result = await transport.call(agent, perception, {
      ...context,
      reprompt: true,
      denyVerbs: DENY_VERBS,
    });
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[router] tier1 ${runtime.id} reprompt failed: ${result.error}`,
      );
      routerStats.rejections++;
      return { dispatched: false, skipReason: 'rejected' };
    }
    verb = (result.tick.action.trim().split(/\s+/)[0] ?? '').toLowerCase();
    if (DENY_VERBS.includes(verb)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[router] tier1 ${runtime.id} rejected after reprompt — verb "${verb}" still denied; ` +
          `action="${result.tick.action}"`,
      );
      routerStats.rejections++;
      return { dispatched: false, skipReason: 'rejected' };
    }
    routerStats.repromptRecovered++;
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
  skipReason?: 'below_threshold' | 'rate_limited' | 'no_memories' | 'rejected';
  reflection?: { text: string; synthesised_from: readonly string[] };
  /** Phase 5 5A — the plan parsed from the reflection response (when
   *  present). Caller is the cohort renderer; it doesn't need the
   *  plan separately because `runtime.activePlan` is set as a
   *  side-effect of dispatch, but surfacing it here makes the
   *  dispatch outcome self-describing for the smoke. */
  plan?: { text: string; stepCount: number };
}

export async function routeTier2(
  def: AgentDef,
  runtime: AgentRuntimeState,
  now: number,
  opts: RouteOptions = {},
): Promise<ReflectRouteResult> {
  const threshold = opts.reflectionThreshold ?? REFLECTION_THRESHOLD;
  if (!opts.force && runtime.reflectionCounter < threshold) {
    return { dispatched: false, skipReason: 'below_threshold' };
  }

  // Phase 5 5A — per-agent real-hour rate-limit. The importance
  // counter has crossed threshold (or `force` is set), but we still
  // suppress the Sonnet call if this agent dispatched recently. The
  // counter is NOT reset on rate-limited skip — it keeps accumulating
  // so the next-eligible reflection has full context. `force=true`
  // (direct user actions like game launch) bypasses both the
  // threshold AND the rate-limit per CLAUDE.md.
  const minIntervalMs = opts.reflectionMinIntervalMs ?? REFLECTION_MIN_INTERVAL_MS;
  if (
    !opts.force &&
    minIntervalMs > 0 &&
    runtime.lastReflectionAt > 0 &&
    now - runtime.lastReflectionAt < minIntervalMs
  ) {
    return { dispatched: false, skipReason: 'rate_limited' };
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

  // Phase 5C/5D — lore egress is OPT-IN via two INDEPENDENT flags (both
  // default off). Each gates a distinct egress path:
  //   - loreEnabled → a CLOSED-VOCAB loreContext {themes, tone} (whitelisted
  //     tags + tone; never raw text or user vocabulary).
  //   - loreQuote   → RAW lore excerpts (uploaded text + source filename),
  //     retrieved via gatherLore, so the agent can reference specific
  //     names/places. This deliberately puts uploaded text on the wire and is
  //     gated behind its own opt-in whose UI copy says exactly that.
  // With both off, NOTHING lore-derived egresses (the reflection still runs).
  let recentLore: readonly LoreSnippet[] = [];
  if (opts.loreQuote) {
    const gatherLore = opts.gatherLore ?? defaultLoreGatherer;
    try {
      recentLore = await gatherLore(memory, recent, opts.loreCount ?? 4);
    } catch (e) {
      // best-effort: a gather failure must not break the reflection
      // eslint-disable-next-line no-console
      console.warn(`[router] tier2 ${def.id} lore gather failed: ${(e as Error).message}`);
    }
  }
  let loreContext: { themes: string[]; tone: string } | undefined;
  if (opts.loreEnabled) {
    try {
      const profile = buildLoreProfile(memory);
      if (profile.dominantThemes.length > 0) {
        loreContext = { themes: profile.dominantThemes, tone: profile.tone };
      }
    } catch (e) {
      // best-effort: a malformed/partial writer must not break the reflection
      // eslint-disable-next-line no-console
      console.warn(`[router] tier2 ${def.id} lore profile failed: ${(e as Error).message}`);
    }
  }

  const outcome = await transport.reflect({
    agent: { id: def.id, name: def.name },
    recentMemories: recent,
    persona: memory.persona(def.id),
    ...(opts.library && { library: opts.library }),
    ...(recentLore.length > 0 && {
      recentLore: recentLore.map((l) => ({ text: l.text, source: l.source })),
    }),
    ...(loreContext && { loreContext }),
  });
  if (!outcome.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[router] tier2 ${def.id} failed: ${outcome.error}`);
    return { dispatched: false, skipReason: 'rejected' };
  }

  // Phase 5 5A — successful dispatch consumes the rate-limit budget
  // (lastReflectionAt = now) AND the reflection counter (already
  // reset above). Failures leave both intact so the next tick can
  // retry.
  runtime.lastReflectionAt = now;

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

  // Phase 5 5A — if the reflection came with a plan, persist it +
  // install on the runtime so the Tier-0 BT picks up plan-step
  // candidates on next tick. Plan is optional — older Worker
  // versions / models that don't emit one still work, just without
  // the plan-execution surface.
  let planSummary: { text: string; stepCount: number } | undefined;
  const planFromWorker = outcome.result.plan;
  if (planFromWorker && planFromWorker.steps.length > 0) {
    const planPayload = {
      text: planFromWorker.text,
      steps: planFromWorker.steps.map((s) => ({
        kind: s.kind,
        target: s.target,
        location: s.location,
        status: 'pending' as const,
      })),
      status: 'active' as const,
    };
    memory.recordPlan({
      agentId: def.id,
      text: planPayload.text,
      steps: planPayload.steps,
      status: planPayload.status,
      importance: outcome.result.importance,
    });
    runtime.activePlan = planPayload;
    runtime.activePlanStepIndex = 0;
    planSummary = { text: planPayload.text, stepCount: planPayload.steps.length };
  }

  return {
    dispatched: true,
    reflection: {
      text: outcome.result.reflection,
      synthesised_from: outcome.result.synthesised_from,
    },
    ...(planSummary && { plan: planSummary }),
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
    case 'game_launched':
      return 8;
    // Phase 4 slice 4A: lower than `game_launched` because we don't
    // know which game (or that it's a game at all — could be any
    // fullscreen app), but high enough to feed Tier-2 reflections
    // since "user disappeared" is a noteworthy event the agents
    // should remember between sessions.
    case 'external_fullscreen':
      return 7;
    case 'player_holding':
      return 6;
    case 'agent_meeting':
      return 6;
    case 'player_proximity':
      return 4;
    case 'bookshelf_in_reach':
      return 3;
    default:
      return 3;
  }
}

/**
 * Inject a `game_launched` perception event into every present
 * agent's queue. Used by the bookshelf E-key handler — the launch is
 * a shared world event the cohort can react to, not a private signal
 * to one agent. The router will pick these up on next tick the same
 * way it handles the polled perception events.
 */
export function broadcastGameLaunched(
  runtimes: readonly AgentRuntimeState[],
  args: { appid: number; name: string; at: { x: number; y: number }; when: number },
): void {
  for (const rt of runtimes) {
    if (!rt.present) continue;
    rt.perceptionQueue.push({
      kind: 'game_launched',
      subject: `appid:${args.appid}`,
      at: { x: args.at.x, y: args.at.y },
      when: args.when,
    });
  }
}

/**
 * Phase 4 slice 4A — inject an `external_fullscreen` perception event
 * into every present agent's queue. Fired by the wallpaper throttle
 * controller (via App.tsx) when the renderer transitions to PAUSED
 * because a fullscreen app appeared on the desktop. Distinct from
 * `game_launched`: we can't identify the appid (steamworks.js doesn't
 * expose `IFriends::GetFriendGamePlayed`), so the agent receives a
 * generic "user disappeared into a fullscreen app" signal.
 *
 * Loki + the cohort handle this as a high-importance observation; the
 * Tier-2 reflection that fires at threshold 150 will often pick this
 * one up because importanceFor('external_fullscreen') is 7.
 */
export function broadcastExternalFullscreen(
  runtimes: readonly AgentRuntimeState[],
  args: { at: { x: number; y: number }; when: number },
): void {
  for (const rt of runtimes) {
    if (!rt.present) continue;
    rt.perceptionQueue.push({
      kind: 'external_fullscreen',
      at: { x: args.at.x, y: args.at.y },
      when: args.when,
    });
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
