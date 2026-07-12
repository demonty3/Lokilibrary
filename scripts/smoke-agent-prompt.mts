/**
 * Agent-mind smoke — `npx tsx scripts/smoke-agent-prompt.mts`.
 * Locks the prompt-assembly contract: house rules once, persona as pure
 * character, legible context lines (no JSON.stringify blobs), library
 * line + roomDims interpolation, reprompt preamble with the merged verbs.
 */
import { makeChecker } from './lib/smoke.ts';

const { HOUSE_RULES, buildTickPrompt, buildReflectPrompt } = await import(
  '../worker/lib/agent-prompt.ts'
);

const { check, report } = makeChecker('smoke agent-prompt');

const NOW = 1_752_300_000_000; // fixed ms epoch for deterministic ages
const persona = { name: 'Loki', system_prompt: '[WHO YOU ARE]\nYou are Loki.' };
const mems = [
  { text: 'player at (12,7)', kind: 'observation', created_at: NOW - 14 * 60_000, importance: 4 },
];

// --- tick assembly ---
const tick = buildTickPrompt({
  agent: { id: 'loki', name: 'Loki' },
  perception: { scene: 'the library room', saw: ['player at (12,7)'], lastAction: 'wander' },
  context: { recentMemories: mems, persona, library: '12 loved, 38 dusty.' },
  nowMs: NOW,
});
check('tick: house rules present exactly once', tick.system.split('[HOUSE RULES').length === 2);
check('tick: persona block included', tick.system.includes('You are Loki.'));
check('tick: task block present', tick.system.includes('[TASK]'));
check('tick: output shape stated in system', tick.system.includes('{"action"'));
check('tick: user has scene line', tick.user.includes('scene: the library room'));
check('tick: user has notice line', tick.user.includes('- player at (12,7)'));
check('tick: memory rendered with relative age', tick.user.includes('- 14m ago (observation, importance 4): player at (12,7)'));
check('tick: library line rendered', tick.user.includes('the library: 12 loved, 38 dusty.'));
check('tick: no raw JSON blobs in user turn', !tick.user.includes('"kind":'));

// --- back-compat: no context at all (Phase-0 caller shape) ---
const bare = buildTickPrompt({ agent: { name: 'X' }, perception: { scene: 's', saw: [] } });
check('tick bare: still has house rules + task', bare.system.includes('[HOUSE RULES') && bare.system.includes('[TASK]'));
check('tick bare: no persona header emitted', !bare.system.includes('[persona]'));

// --- reprompt preamble ---
const re = buildTickPrompt({
  agent: { name: 'Cat' },
  perception: { scene: 's', saw: ['x'] },
  context: { reprompt: true, denyVerbs: ['speak', 'say', 'purr-formatively'] },
});
check('reprompt: preamble present', re.system.includes('forbidden verb'));
check('reprompt: merged verbs listed', re.system.includes('purr-formatively'));

// --- reflect assembly ---
const refl = buildReflectPrompt({
  agent: { id: 'loki', name: 'Loki' },
  recentMemories: [
    { id: 'm1', text: 'saw the player linger', kind: 'observation', importance: 6, created_at: NOW - 60_000 },
  ],
  persona,
  loreContext: { themes: ['tide', 'salt'], tone: 'melancholy' },
  library: '12 loved, 38 dusty.',
  roomDims: { width: 30, height: 20 },
  nowMs: NOW,
});
check('reflect: dims interpolated', refl.system.includes('x: 0-29') && refl.system.includes('y: 0-19'));
check('reflect: place_mark note instruction present', refl.system.includes('≤ 90 chars'));
check('reflect: lore themes line present', refl.system.includes('tide, salt'));
check('reflect: memory digest carries id', refl.user.includes('id=m1'));
check('reflect: library line rendered', refl.user.includes('the library: 12 loved, 38 dusty.'));

// dims fallback = today's constants
const reflDefault = buildReflectPrompt({
  agent: { id: 'a', name: 'A' },
  recentMemories: [{ id: 'm', text: 't', kind: 'observation', importance: 1, created_at: NOW }],
  nowMs: NOW,
});
check('reflect: dims fallback 24×16', reflDefault.system.includes('x: 0-23') && reflDefault.system.includes('y: 0-15'));

// lore gating: absent input → absent output
check('reflect: no lore line when absent', !reflDefault.system.includes('lore leans toward'));
check('reflect: no recent_lore block when absent', !reflDefault.user.includes('recent_lore'));

check('house rules: restraint present', HOUSE_RULES.includes('understatement'));
check('house rules: no exclamation marks', !HOUSE_RULES.includes('!'));

// --- persona register lint (Task 2) ---
const { LOKI_SYSTEM_PROMPT } = await import('../src/agents/persona/loki.ts');
const { NPC_PERSONAS } = await import('../src/agents/persona/npc.ts');
const allPersonas: Array<[string, string]> = [
  ['loki', LOKI_SYSTEM_PROMPT],
  ...NPC_PERSONAS.map((p): [string, string] => [p.agentId, p.systemPrompt]),
];
for (const [id, text] of allPersonas) {
  check(`persona ${id}: no output-shape JSON (house rules own the format)`, !text.includes('{"action"'));
  check(`persona ${id}: no [OUTPUT SHAPE] header`, !text.includes('[OUTPUT SHAPE]'));
  check(`persona ${id}: no exclamation marks`, !text.includes('!'));
  check(`persona ${id}: substantial character (> 400 chars)`, text.length > 400);
}
check('loki: knows the library context arrives', LOKI_SYSTEM_PROMPT.includes('the library:'));

// --- per-agent denylist enforcement + persona fallback (Task 4) ---
const { routeTier1, nullMemoryWriter } = await import('../src/agents/router.ts');
const { COHORT } = await import('../src/agents/cohort.ts');

const ghostDef = COHORT.find((d) => d.id === 'ghost')!;
check('ghost def carries its persona denylist', (ghostDef.denyVerbs ?? []).includes('whisper'));

const mkRuntime = (id: string) => ({
  id,
  present: true,
  x: 1,
  y: 1,
  perceptionQueue: [{ kind: 'player_proximity', at: { x: 1, y: 2 }, when: 0 }],
  reflectionCounter: 0,
  lastTier1At: 0,
  lastReflectionAt: 0,
  currentAction: { kind: 'idle' },
  intent: null,
  activePlan: null,
  activePlanStepIndex: 0,
}) as unknown as import('../src/state/agentRuntime.ts').AgentRuntimeState;

// 'whisper' is in the Ghost's persona denylist but NOT the global five —
// this dispatch must be rejected (drop after the one reprompt). Fails
// against pre-pass router (global-only enforcement accepts it).
let calls = 0;
const whisperTransport = {
  call: async () => {
    calls++;
    return { ok: true as const, tick: { action: 'whisper at the shelf', intent: 'whisper', model: 'stub', provider: 'stub', latencyMs: 1 } };
  },
  reflect: async () => ({ ok: false as const, error: 'unused' }),
};
const ghostRes = await routeTier1(ghostDef, mkRuntime('ghost'), 'room', 1_000, {
  transport: whisperTransport,
  memory: nullMemoryWriter,
});
check('ghost whisper rejected via per-agent denylist', ghostRes.dispatched === false && ghostRes.skipReason === 'rejected');
check('ghost whisper got the one reprompt', calls === 2);

// persona fallback: null-writer path still ships character to the model
let seenPersona: string | undefined;
const captureTransport = {
  call: async (_a: unknown, _p: unknown, ctx: { persona?: { system_prompt: string } | null }) => {
    seenPersona = ctx.persona?.system_prompt;
    return { ok: true as const, tick: { action: 'drift to the cold shelf', intent: 'drift', model: 'stub', provider: 'stub', latencyMs: 1 } };
  },
  reflect: async () => ({ ok: false as const, error: 'unused' }),
};
await routeTier1(ghostDef, mkRuntime('ghost'), 'room', 2_000, {
  transport: captureTransport,
  memory: nullMemoryWriter,
});
check('null-writer persona falls back to persona module', (seenPersona ?? '').includes('ghost of every reading'));

report();
