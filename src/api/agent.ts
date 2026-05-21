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
): Promise<AgentTickResult> {
  let res: Response;
  try {
    res = await fetch('/api/agent/tick', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent, perception }),
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
