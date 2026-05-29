/**
 * Phase 5D.3 smoke — `npx tsx scripts/smoke-5d-persona.mts`.
 *
 * Locks the OPT-IN lore-egress gate in routeTier2:
 *   - loreEnabled OFF (default) → gatherLore is NOT called and the reflect
 *     transport input carries NEITHER recentLore NOR loreContext (nothing
 *     lore-derived leaves the device).
 *   - loreEnabled ON → gatherLore runs, recentLore is forwarded, and a
 *     closed-vocab loreContext {themes, tone} (whitelisted) is attached.
 *
 * Pure: a fake MemoryWriter + capture transport (no DB / network).
 */

import { makeChecker } from './lib/smoke.ts';
import type { ReflectInput } from '../src/api/agent.ts';
import type { MemoryWriter } from '../src/agents/router.ts';

const { routeTier2, nullMemoryWriter } = await import('../src/agents/router.ts');

const { check, report } = makeChecker('smoke 5D.3');

const NOW = 2_000_000;

function memWithLore(): MemoryWriter {
  return {
    ...nullMemoryWriter,
    recentMemories: () => [
      {
        id: 'm1',
        text: 'I keep drifting back to the lighthouse above the harbour.',
        kind: 'observation' as const,
        importance: 5,
        created_at: 1,
      },
    ],
    persona: () => ({ name: 'Loki', system_prompt: 'You are Loki.' }),
    loreCount: () => 3,
    recentLore: () => [
      { id: 'l1', text: 'The lighthouse keeper guards the harbour and the tide.', source: 'lore.md' },
      { id: 'l2', text: 'Ships and sails crowd the sea; the mariner drops anchor at the coast.', source: 'lore.md' },
      { id: 'l3', text: 'The shore and the ocean meet where the old beacon burns.', source: 'lore.md' },
    ],
  };
}

function freshRuntime(): never {
  return { id: 'loki', reflectionCounter: 999, lastReflectionAt: 0 } as never;
}

let captured: ReflectInput | null = null;
let gatherCalls = 0;
const transport = {
  tick: async () => ({ ok: false as const, error: 'unused' }),
  reflect: async (input: ReflectInput) => {
    captured = input;
    return { ok: false as const, error: 'capture-only' };
  },
};
const gatherLore = async () => {
  gatherCalls++;
  return [{ id: 'l1', text: 'the lighthouse', source: 'lore.md' }];
};

const def = { id: 'loki', name: 'Loki' } as never;

// --- OFF (default): nothing lore-derived leaves -----------------------------
captured = null;
gatherCalls = 0;
await routeTier2(def, freshRuntime(), NOW, {
  memory: memWithLore(),
  transport,
  gatherLore,
  force: true,
  // loreEnabled omitted → defaults to off
});
const off: ReflectInput | null = captured;
check('OFF: reflect transport was reached', off !== null);
check('OFF: gatherLore NOT called', gatherCalls === 0);
check('OFF: no recentLore on the wire', !off?.recentLore || off.recentLore.length === 0);
check('OFF: no loreContext on the wire', !off?.loreContext);

// --- ON (opt-in): lore + closed-vocab context flow --------------------------
captured = null;
gatherCalls = 0;
await routeTier2(def, freshRuntime(), NOW, {
  memory: memWithLore(),
  transport,
  gatherLore,
  force: true,
  loreEnabled: true,
});
const on: ReflectInput | null = captured;
check('ON: reflect transport was reached', on !== null);
check('ON: gatherLore called once', gatherCalls === 1);
check('ON: recentLore forwarded', (on?.recentLore?.length ?? 0) > 0);
check('ON: loreContext attached', !!on?.loreContext);
check('ON: loreContext.themes includes nautical', on?.loreContext?.themes.includes('nautical') === true);
check('ON: loreContext.tone is a string', typeof on?.loreContext?.tone === 'string');

report();
