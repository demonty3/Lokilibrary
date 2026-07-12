/**
 * Agent-mind taste-gate transcript — `npx tsx scripts/agent-mind-livefire.mts`.
 * Requires `npm run worker` running with a real ANTHROPIC_API_KEY.
 * Fires one Tier-1 tick and one Tier-2 reflection per cohort agent with
 * canned-but-realistic context, printing the outputs for the register
 * judgment (spec § 5 gate 5). NOT a smoke — costs ~10 paid calls.
 */
import { LOKI_SYSTEM_PROMPT, LOKI_NAME, LOKI_AGENT_ID } from '../src/agents/persona/loki.ts';
import { NPC_PERSONAS } from '../src/agents/persona/npc.ts';

const WORKER = process.env.WORKER_URL ?? 'http://localhost:8787';
const LIBRARY =
  '214 games: 12 loved, 3 mastered, 5 abandoned, 38 dusty. its poles: Elden Ring (loved, 140h) · Hades (loved, 91h) · Crusader Kings III (dusty, 210h) · Celeste (abandoned, 12h).';

const personas = [
  { agentId: LOKI_AGENT_ID, name: LOKI_NAME, systemPrompt: LOKI_SYSTEM_PROMPT },
  ...NPC_PERSONAS.map((p) => ({ agentId: p.agentId, name: p.name, systemPrompt: p.systemPrompt })),
];

const NOW = Date.now();
const memories = (id: string) => [
  { id: `${id}-m1`, text: 'player lingered near the strategy shelf', kind: 'observation', created_at: NOW - 40 * 60_000, importance: 6 },
  { id: `${id}-m2`, text: 'game_launched appid:1158310 at (14,6)', kind: 'observation', created_at: NOW - 32 * 60_000, importance: 8 },
  { id: `${id}-m3`, text: 'player has been here for a while', kind: 'observation', created_at: NOW - 5 * 60_000, importance: 6 },
];

// Parse a fetch Response as JSON, tolerating non-2xx worker error bodies
// (ProviderError responses are still valid JSON: `{error: "..."}`) so a
// keyless/misconfigured worker prints one clear line per agent instead of
// crashing the whole transcript on an unhandled rejection.
async function safeJson(res: Response, label: string): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    return { __error: `${label}: non-JSON response (${res.status}): ${(e as Error).message}` };
  }
  if (!res.ok) {
    const msg = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : JSON.stringify(body);
    return { __error: `${label}: ${res.status} ${msg}` };
  }
  return body as Record<string, unknown>;
}

for (const p of personas) {
  let tick: Record<string, unknown>;
  let refl: Record<string, unknown>;
  try {
    const tickRes = await fetch(`${WORKER}/api/agent/tick`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: { id: p.agentId, name: p.name },
        perception: { scene: 'the library room', saw: ['player at (12,7)', 'bookshelf at (13,7)'], lastAction: 'wander' },
        context: {
          recentMemories: memories(p.agentId).map(({ id: _id, ...m }) => m),
          persona: { name: p.name, system_prompt: p.systemPrompt },
          library: LIBRARY,
        },
      }),
    });
    tick = await safeJson(tickRes, 'tick');

    const reflRes = await fetch(`${WORKER}/api/agent/reflect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: { id: p.agentId, name: p.name },
        recentMemories: memories(p.agentId),
        persona: { name: p.name, system_prompt: p.systemPrompt },
        library: LIBRARY,
        roomDims: { width: 30, height: 20 },
      }),
    });
    refl = await safeJson(reflRes, 'reflect');
  } catch (e) {
    console.log(`\n═══ ${p.name} ═══`);
    console.log(`error  → request failed: ${(e as Error).message}`);
    continue;
  }

  console.log(`\n═══ ${p.name} ═══`);
  if (tick.__error) {
    console.log(`tick   → error: ${tick.__error}`);
  } else {
    console.log(`tick   → action: ${tick.action}\n       → intent: ${tick.intent}`);
  }
  if (refl.__error) {
    console.log(`reflect→ error: ${refl.__error}`);
  } else {
    console.log(`reflect→ ${refl.reflection}`);
    const plan = refl.plan as { text?: string; steps?: Array<{ kind: string; target?: string; location?: { x: number; y: number } }> } | undefined;
    if (plan?.steps?.length) {
      console.log(`plan   → ${plan.text}`);
      for (const s of plan.steps) console.log(`         - ${s.kind}${s.target ? ` ${s.target}` : ''}${s.location ? ` @(${s.location.x},${s.location.y})` : ''}`);
    }
  }
  if (!tick.__error && !refl.__error) {
    console.log(`tokens → tick in≈${tick.tokensIn} out≈${tick.tokensOut} · reflect in≈${refl.tokensIn} out≈${refl.tokensOut}`);
  }
}
