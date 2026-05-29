/**
 * Phase 5D.4 smoke — `npx tsx scripts/smoke-5d4-lore-visible.mts`.
 *
 * "Make lore visibly transform the world." Three sections:
 *
 *  (a) Theme-from-lore is deterministic over the shipped whitelist, with the
 *      no-lore corpus falling back to DEFAULT_THEME_ID. This is the LOCAL
 *      palette recolor — App.tsx derives the world theme via themeFromLore
 *      and passes getById(themeId) to mountPalace.
 *  (b) The closed-vocab egress gate in routeTier2: a loreContext {themes,
 *      tone} is attached ONLY when loreEnabled is true, and (with loreQuote
 *      off) NEVER carries raw keywords / uploaded text. (Reuses the 5D.3
 *      transport-stub pattern.)
 *  (c) loreVersion is a pure, monotonic store action; loreEnabled +
 *      loreQuoteEnabled default OFF and their setters flip them independently.
 *  (d) The SECOND, INDEPENDENT opt-in: loreQuote gathers + ships RAW lore
 *      excerpts (text + source) so agents can reference specifics — distinct
 *      from loreEnabled. Either, both, or neither may be on.
 *
 * Pure: fake MemoryWriter + capture transport (no DB / network). The store
 * imports cleanly (api/* + types only; no PIXI / DOM).
 */

import { makeChecker } from './lib/smoke.ts';
import type { ReflectInput } from '../src/api/agent.ts';
import type { MemoryWriter } from '../src/agents/router.ts';

const { themeFromLore } = await import('../src/agents/lore-theme.ts');
const { buildLoreProfile, THEME_TAGS } = await import('../src/agents/lore-profile.ts');
const { DEFAULT_THEME_ID, THEME_IDS } = await import('../src/themes/index.ts');
const { routeTier2, nullMemoryWriter } = await import('../src/agents/router.ts');
const { useAppStore } = await import('../src/state/store.ts');

const { check, report } = makeChecker('smoke 5D.4');

// ===========================================================================
// (a) Deterministic theme-from-lore over the whitelist, incl. no-lore fallback
// ===========================================================================

/** Minimal fake of the two writer accessors themeFromLore/buildLoreProfile read. */
function fakeWriter(texts: readonly string[]): Pick<MemoryWriter, 'recentLore' | 'loreCount'> {
  const rows = texts.map((text, i) => ({ id: `lore-${i}`, text, source: 'test' }));
  return {
    loreCount: () => rows.length,
    recentLore: (n: number) => rows.slice(0, n),
  };
}

const NAUTICAL = [
  'The lighthouse keeper watched the tide roll over the harbour as the ship set sail.',
  'Every mariner knows the sea; the coast and the shore mark the edge of the ocean.',
];

const themeFor = (texts: readonly string[]) => themeFromLore(fakeWriter(texts));

check('no-lore -> DEFAULT_THEME_ID fallback', themeFor([]) === DEFAULT_THEME_ID);
check('nautical -> tokyo-night', themeFor(NAUTICAL) === 'tokyo-night');
check(
  'derived theme differs from default for a themed corpus',
  themeFor(NAUTICAL) !== DEFAULT_THEME_ID,
);
check(
  'derived theme is whitelisted',
  (THEME_IDS as readonly string[]).includes(themeFor(NAUTICAL)),
);
check('deterministic theme across runs', themeFor(NAUTICAL) === themeFor(NAUTICAL));
check(
  'themeFromLore matches buildLoreProfile.suggestedTilePaletteBias[0]',
  themeFor(NAUTICAL) === buildLoreProfile(fakeWriter(NAUTICAL)).suggestedTilePaletteBias[0],
);

// ===========================================================================
// (b) Egress gate: closed-vocab loreContext {themes, tone} ONLY when enabled
//     (transport-stub pattern, mirrors smoke-5d-persona)
// ===========================================================================

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

// --- OFF (default / omitted): nothing lore-derived leaves -------------------
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
check('OFF: reflect transport reached', off !== null);
check('OFF: gatherLore NOT called', gatherCalls === 0);
check('OFF: no recentLore on the wire', !off?.recentLore || off.recentLore.length === 0);
check('OFF: no loreContext on the wire', !off?.loreContext);

// --- ON (opt-in): closed-vocab context flows, but no raw text --------------
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
check('ON: loreContext attached', !!on?.loreContext);
check(
  'ON: loreContext.themes is closed-vocab',
  on?.loreContext?.themes.every((t) => (THEME_TAGS as readonly string[]).includes(t)) === true,
);
check(
  'ON: loreContext.tone is one of the closed tone set',
  ['neutral', 'dark', 'whimsical', 'melancholic', 'heroic', 'cozy'].includes(
    on?.loreContext?.tone ?? '',
  ),
);
// PRIVACY (load-bearing): the egress field must NOT carry raw keywords / text.
const wire = JSON.stringify(on?.loreContext ?? {});
check(
  'ON: loreContext carries NO raw keyword',
  !wire.includes('lighthouse') && !wire.includes('harbour'),
);
check(
  'ON: loreContext has ONLY themes+tone keys',
  JSON.stringify(Object.keys(on?.loreContext ?? {}).sort()) === JSON.stringify(['themes', 'tone']),
);
// PRIVACY (load-bearing): with ONLY loreEnabled on (loreQuote off), the
// closed-vocab context is the ONLY lore egress. Raw lore snippets (text +
// source filename) must NEVER reach the wire on this flag — not in recentLore,
// not anywhere in ReflectInput. (The separate loreQuote opt-in, exercised in
// section (d) below, is what deliberately ships raw excerpts.)
check(
  'ON (loreEnabled only): no recentLore on the wire',
  !on?.recentLore || on.recentLore.length === 0,
);
check('ON (loreEnabled only): gatherLore NOT called', gatherCalls === 0);
// Scan the ENTIRE ReflectInput, not just loreContext: the raw lore text and
// its source filename must appear nowhere on the wire. (recentMemories text
// is the agent's own memory, not uploaded lore — distinct strings here.)
const fullWire = JSON.stringify(on ?? {});
check(
  'ON: raw uploaded lore text absent from full ReflectInput',
  !fullWire.includes('guards the harbour') &&
    !fullWire.includes('mariner drops anchor') &&
    !fullWire.includes('old beacon burns'),
);
check(
  'ON: lore source filename absent from full ReflectInput',
  !fullWire.includes('lore.md'),
);

// ===========================================================================
// (d) The SECOND, INDEPENDENT opt-in: loreQuote ships RAW excerpts
// ===========================================================================

// loreQuote ON (loreEnabled omitted) → gatherLore IS invoked and the raw
// excerpts (text + source) ARE shipped, so agents can reference specifics.
// loreContext must be ABSENT — that path is gated by loreEnabled (still off).
captured = null;
gatherCalls = 0;
await routeTier2(def, freshRuntime(), NOW, {
  memory: memWithLore(),
  transport,
  gatherLore,
  force: true,
  loreQuote: true,
});
const quoted: ReflectInput | null = captured;
check('QUOTE: gatherLore invoked', gatherCalls === 1);
check('QUOTE: recentLore shipped on the wire', (quoted?.recentLore?.length ?? 0) > 0);
check(
  'QUOTE: raw excerpt text + source DO reach the wire (the opt-in promise)',
  JSON.stringify(quoted ?? {}).includes('the lighthouse') &&
    JSON.stringify(quoted ?? {}).includes('lore.md'),
);
check('QUOTE: loreContext NOT attached (gated by the other flag)', !quoted?.loreContext);

// Both flags ON → both egress paths fire (closed-vocab context AND raw quotes).
captured = null;
gatherCalls = 0;
await routeTier2(def, freshRuntime(), NOW, {
  memory: memWithLore(),
  transport,
  gatherLore,
  force: true,
  loreEnabled: true,
  loreQuote: true,
});
const both: ReflectInput | null = captured;
check('BOTH: loreContext attached', !!both?.loreContext);
check('BOTH: recentLore shipped', (both?.recentLore?.length ?? 0) > 0);

// ===========================================================================
// (c) loreVersion bump + lore toggles as pure store actions
// ===========================================================================

const v0 = useAppStore.getState().loreVersion;
check('loreVersion starts at 0', v0 === 0);
useAppStore.getState().bumpLoreVersion();
check('bump increments loreVersion', useAppStore.getState().loreVersion === v0 + 1);
useAppStore.getState().bumpLoreVersion();
check('bump is monotonic', useAppStore.getState().loreVersion === v0 + 2);

const e0 = useAppStore.getState().loreEnabled;
check('loreEnabled default OFF', e0 === false);
useAppStore.getState().setLoreEnabled(true);
check('setLoreEnabled flips egress flag', useAppStore.getState().loreEnabled === true);

const q0 = useAppStore.getState().loreQuoteEnabled;
check('loreQuoteEnabled default OFF', q0 === false);
useAppStore.getState().setLoreQuoteEnabled(true);
check('setLoreQuoteEnabled flips the quote flag', useAppStore.getState().loreQuoteEnabled === true);
check('the two lore opt-ins are independent flags', useAppStore.getState().loreEnabled === true);

report();
