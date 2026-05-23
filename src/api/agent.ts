/**
 * Agent API. Phase 0 spike: a single endpoint, /api/agent/tick, that takes
 * a snapshot of one agent + its perception payload and returns the Tier 1
 * micro-action the model picks. The full Smallville-style memory stream +
 * reflection runtime lands in Phase 2.
 */

export interface AgentSnapshot {
  id: string;
  name: string;
  personality?: string;
  /** 0–10 budget for whatever drives this agent's autonomy. Wider semantics
   *  arrive in Phase 2; for now it just decorates the Tier 1 prompt. */
  energy?: number;
}

export interface AgentPerception {
  /** Free-text scene label — e.g. "the cracked plaza in front of the library". */
  scene: string;
  /** Things the agent can currently perceive within its FOV / hearing range. */
  saw: string[];
  /** The agent's most recent committed action, if any. */
  lastAction?: string;
}

/**
 * Context block introduced in Phase 2C (slice 2C.3). The router gathers
 * recent memories + persona from the SQLite store and ships them with
 * each tick so the model has Smallville-style grounding. Optional for
 * back-compat — the Phase 0 hello-world call shape still works.
 */
export interface AgentTickContext {
  recentMemories?: ReadonlyArray<{
    text: string;
    kind: 'observation' | 'reflection' | 'plan' | 'dialogue';
    created_at: number;
    importance: number;
  }>;
  persona?: { name: string; system_prompt: string } | null;
  /** Phase 2F: when true, worker prepends a corrective "your last
   *  action used a forbidden verb, try again" preamble to the system
   *  prompt. The router sets this on the one allowed retry attempt. */
  reprompt?: boolean;
  /** Optional list of verbs the LLM should avoid this turn. Passed
   *  through to the worker's reprompt preamble for clarity. */
  denyVerbs?: readonly string[];
}

export interface AgentTick {
  action: string;
  intent: string;
  model: string;
  provider: string;
  latencyMs: number;
}

export type AgentTickResult =
  | { ok: true; tick: AgentTick }
  | { ok: false; error: string };

export async function tickAgent(
  agent: AgentSnapshot,
  perception: AgentPerception,
  context?: AgentTickContext,
): Promise<AgentTickResult> {
  let res: Response;
  try {
    res = await fetch('/api/agent/tick', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent, perception, ...(context && { context }) }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `${res.status} ${body.slice(0, 200)}` };
  }
  const tick = (await res.json()) as AgentTick;
  return { ok: true, tick };
}

/** Tier-2 reflection input: the agent identity, the memories we're asking
 *  the model to synthesise across, and (optionally) the agent's persona. */
export interface ReflectInput {
  agent: { id: string; name: string };
  recentMemories: ReadonlyArray<{
    id: string;
    text: string;
    kind: 'observation' | 'reflection' | 'plan' | 'dialogue';
    importance: number;
    created_at: number;
  }>;
  persona?: { name: string; system_prompt: string } | null;
}

export interface ReflectResult {
  reflection: string;
  synthesised_from: readonly string[];
  themes: readonly string[];
  importance: number;
  model: string;
  provider: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
}

export type ReflectOutcome =
  | { ok: true; result: ReflectResult }
  | { ok: false; error: string };

export async function reflectAgent(input: ReflectInput): Promise<ReflectOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/agent/reflect', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `${res.status} ${body.slice(0, 200)}` };
  }
  const result = (await res.json()) as ReflectResult;
  return { ok: true, result };
}
