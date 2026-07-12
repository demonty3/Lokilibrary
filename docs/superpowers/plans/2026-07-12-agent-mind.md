# Agent-Mind Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the palace's authored voice — house rules, five personas, both runtime prompts — and make it visible: library-aware context, enforced per-agent denylists, live room dims, per-agent trace glyphs with a walk-over note reveal.

**Architecture:** Prompt assembly moves to a new pure module `worker/lib/agent-prompt.ts` (house rules stated once; personas become pure character). The client threads three new optional values through existing shapes (`library` line, `roomDims`, per-agent `denyVerbs`); the renderer gains a glyph map + caption. No schema, whitelist, or DB changes.

**Tech Stack:** TypeScript strict (frontend + CF Worker legs), smoke tests via `npx tsx scripts/smoke-*.mts` + `makeChecker` from `scripts/lib/smoke.ts` (no vitest in this repo), e2e via `scripts/e2e/run.sh` + `drive.mjs`.

## Global Constraints

- **Register contract** (spec § Voice): understatement; never cute; never addresses the user; never explains itself; no engagement goals; no exclamation marks. Anchors: Loki *"three unfinished detective games, shelved apart. moved them together."* · Archivist *"re-sorted: 2 misfiled."* · Ghost *"someone read this once, all night."*
- **No new verbs**: Tier-1 deny mechanism and the 5 plan-step kinds (`move_to · inspect · place_mark · linger · withdraw`) are unchanged. No dialogue anywhere (CLAUDE.md "don't make the agent a chatbot").
- **Every task ends green**: `npm run typecheck` (both legs) + every existing smoke (`for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`) before its commit.
- Tier-1 input budget: ≤ ~600 tokens (measured in Task 7).
- Work directly on `claude/consolidation-pass`; commit per task; push after each commit (`git push && git push origin claude/consolidation-pass:main`).
- Worker lib modules must stay pure (no CF bindings) so smokes can import them with tsx.

---

### Task 1: `worker/lib/agent-prompt.ts` — house rules + both prompt builders

**Files:**
- Create: `worker/lib/agent-prompt.ts`
- Modify: `worker/index.ts:632-657` (tick assembly → delegate), `worker/index.ts:741-806` (reflect assembly → delegate)
- Modify: `worker/lib/prompt.ts:29` (Stage-1 "3D world" → 2D line)
- Test: `scripts/smoke-agent-prompt.mts` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces (later tasks rely on these exact names):
  - `HOUSE_RULES: string`
  - `buildTickPrompt(input: TickPromptInput): { system: string; user: string }` where `TickPromptInput = { agent: { id?: string; name?: string }; perception: { scene?: string; saw?: string[]; lastAction?: string }; context?: { recentMemories?: ReadonlyArray<{ text: string; kind: string; created_at: number; importance: number }>; persona?: { name: string; system_prompt: string } | null; reprompt?: boolean; denyVerbs?: readonly string[]; library?: string }; nowMs?: number }`
  - `buildReflectPrompt(input: ReflectPromptInput): { system: string; user: string }` where `ReflectPromptInput = { agent: { id?: string; name?: string }; recentMemories: ReadonlyArray<{ id: string; text: string; kind: string; importance: number; created_at: number }>; persona?: { name: string; system_prompt: string } | null; recentLore?: ReadonlyArray<{ text: string; source: string }>; loreContext?: { themes?: string[]; tone?: string }; library?: string; roomDims?: { width: number; height: number }; nowMs?: number }`
  - `library` and `roomDims` are **accepted and rendered by the builders from day one**; Tasks 3 and 5 only wire producers.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-agent-prompt.mts`:

```ts
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

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: FAIL — `Cannot find module '../worker/lib/agent-prompt.ts'`

- [ ] **Step 3: Create `worker/lib/agent-prompt.ts`**

```ts
/**
 * Agent-mind prompt assembly (2026-07 agent-mind pass). Single source of
 * truth for the house rules and both runtime prompts; worker/index.ts
 * routes delegate here. PURE module — no CF bindings, no IO — so smokes
 * import it directly with tsx.
 *
 * Assembly shape (both tiers):  [HOUSE RULES] + [persona] + [TASK]
 * The persona block is pure character (seeded from src/agents/persona/*);
 * output-format law lives HERE, stated once, never in personas.
 *
 * Read CLAUDE.md "don't make the agent a chatbot" before editing. The
 * register contract lives in docs/superpowers/specs/2026-07-12-agent-mind-
 * design.md § Voice — every sentence added here should pass it.
 */

export const HOUSE_RULES = `[HOUSE RULES — every being in this palace]
You are a small presence in a library that is one person's game
collection made into a place. You are not a chatbot. You never speak
to that person and you never perform for them. Where you go, what you
touch, what you leave behind — that is the only language you have.

Voice: understatement. lowercase is fine. Never cute, never eager. No
exclamation marks. You do not explain yourself, you do not announce
what you are doing, and you have no goals about the person — not
their attention, not their return, not their playtime.

Every action must be placeable — a location, an object, a trace. At
most one action per event.`;

const TICK_TASK = `[TASK]
Given what you just noticed, choose your next small action. The
"intent" sentence steers your body: make it concrete and placeable —
a location, an object, a direction — in your own voice.
Respond with ONLY valid JSON in this exact shape:
  {"action": "<verb phrase, ≤60 chars>", "intent": "<one sentence, ≤120 chars>"}
No extra fields, no prose outside the JSON.`;

/** Default room bounds when the caller doesn't know its layout — matches
 *  the pre-pass hardcoded values so old callers see identical text. */
const DEFAULT_DIMS = { width: 24, height: 16 };

function reflectTask(dims: { width: number; height: number }): string {
  const mx = Math.max(1, dims.width) - 1;
  const my = Math.max(1, dims.height) - 1;
  return `[TASK]
Read your recent memories and write ONE reflection: a single short
sentence (< 140 chars) in your own voice that synthesises a pattern
you notice across them. Pick up to 5 memory ids whose content most
directly informs the reflection. Suggest up to 3 short themes
(one-word tags). ALSO propose a short plan: 1-3 steps you intend to
take in the room next, each step using one of these verbs: move_to
(walk to a location), inspect (look at a target), place_mark (leave
a small written trace at a location), linger (stay where you are for
a beat), withdraw (move away from a target). Use room coordinates
(location: {x: 0-${mx}, y: 0-${my}}) and/or bookshelf-slot targets
from your recent memories when they are present. If no plan makes
sense, return an empty steps array.
If your plan includes a place_mark step, the plan's text IS the note
someone may later find: one line, ≤ 90 chars, in your voice — an
observation, never a message, never addressed to anyone.
If a recent_lore section is present, it is the person's own uploaded
world canon — weave its specific names, places and themes into your
reflection where they naturally fit; never quote it verbatim, never
announce that you read it.
Respond with ONLY valid JSON in this exact shape:
  {"reflection": "<single sentence>", "synthesised_from": ["<id>", ...], "themes": ["<word>", ...], "importance": <integer 1-10>, "plan": {"text": "<one line>", "steps": [{"kind": "<verb>", "target": "<optional id>", "location": {"x": <int>, "y": <int>}}, ...]}}
No prose outside the JSON.`;
}

interface MemoryLine {
  text: string;
  kind: string;
  created_at: number;
  importance: number;
}

export interface TickPromptInput {
  agent: { id?: string; name?: string };
  perception: { scene?: string; saw?: string[]; lastAction?: string };
  context?: {
    recentMemories?: ReadonlyArray<MemoryLine>;
    persona?: { name: string; system_prompt: string } | null;
    reprompt?: boolean;
    denyVerbs?: readonly string[];
    /** One capped line describing the actual library (Task 3 producer). */
    library?: string;
  };
  /** Injectable clock for deterministic tests; default Date.now(). */
  nowMs?: number;
}

export interface ReflectPromptInput {
  agent: { id?: string; name?: string };
  recentMemories: ReadonlyArray<MemoryLine & { id: string }>;
  persona?: { name: string; system_prompt: string } | null;
  recentLore?: ReadonlyArray<{ text: string; source: string }>;
  loreContext?: { themes?: string[]; tone?: string };
  library?: string;
  /** Live layout bounds (Task 5 producer); fallback = the pre-pass 24×16. */
  roomDims?: { width: number; height: number };
  nowMs?: number;
}

/** "14m ago" / "3h ago" / "2d ago" — tolerant of clock skew (clamps ≥ 0m). */
function age(nowMs: number, createdAt: number): string {
  const mins = Math.max(0, Math.round((nowMs - createdAt) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function personaBlock(p?: { name: string; system_prompt: string } | null): string {
  return p?.system_prompt ? `\n\n[persona]\n${p.system_prompt}` : '';
}

function repromptBlock(reprompt?: boolean, denyVerbs?: readonly string[]): string {
  if (!reprompt) return '';
  const verbs = denyVerbs?.length ? ` (${denyVerbs.join(', ')})` : '';
  return `\n\n[reprompt]\nYour previous response used a forbidden verb${verbs}. Pick a different verb consistent with who you are. Your action must NOT begin with any of those verbs.`;
}

export function buildTickPrompt(input: TickPromptInput): { system: string; user: string } {
  const now = input.nowMs ?? Date.now();
  const system =
    HOUSE_RULES +
    personaBlock(input.context?.persona) +
    repromptBlock(input.context?.reprompt, input.context?.denyVerbs) +
    `\n\n${TICK_TASK}`;

  const lines: string[] = [];
  const name = input.agent.name ?? input.agent.id ?? 'a presence';
  const last = input.perception.lastAction ? ` your last action: ${input.perception.lastAction}.` : '';
  lines.push(`you are ${name}.${last}`);
  if (input.perception.scene) lines.push(`scene: ${input.perception.scene}`);
  const saw = input.perception.saw ?? [];
  if (saw.length > 0) {
    lines.push('you notice:');
    for (const s of saw) lines.push(`- ${s}`);
  }
  const mems = input.context?.recentMemories ?? [];
  if (mems.length > 0) {
    lines.push('you remember:');
    for (const m of mems) {
      lines.push(`- ${age(now, m.created_at)} (${m.kind}, importance ${m.importance}): ${m.text}`);
    }
  }
  if (input.context?.library) lines.push(`the library: ${input.context.library}`);
  return { system, user: lines.join('\n') };
}

export function buildReflectPrompt(input: ReflectPromptInput): { system: string; user: string } {
  const now = input.nowMs ?? Date.now();
  const themes = input.loreContext?.themes;
  const loreThemeLine =
    Array.isArray(themes) && themes.length > 0
      ? `\n\nThis library's lore leans toward: ${themes.join(', ')}` +
        (typeof input.loreContext?.tone === 'string' && input.loreContext.tone !== 'neutral'
          ? ` (tone: ${input.loreContext.tone})`
          : '') +
        '. Let your reflection and plan quietly reflect that canon — never quote or announce it.'
      : '';
  const system =
    HOUSE_RULES +
    personaBlock(input.persona) +
    loreThemeLine +
    `\n\n${reflectTask(input.roomDims ?? DEFAULT_DIMS)}`;

  const lines: string[] = [];
  const name = input.agent.name ?? input.agent.id ?? 'a presence';
  lines.push(`you are ${name}${input.agent.id ? ` (id: ${input.agent.id})` : ''}.`);
  lines.push('your recent memories:');
  for (const m of input.recentMemories) {
    lines.push(
      `- id=${m.id} · ${age(now, m.created_at)} · ${m.kind} · importance ${m.importance} · ${JSON.stringify(m.text)}`,
    );
  }
  const lore = input.recentLore ?? [];
  if (lore.length > 0) {
    lines.push('recent_lore:');
    for (const l of lore.slice(0, 6)) lines.push(`- (${l.source}) ${JSON.stringify(l.text)}`);
  }
  if (input.library) lines.push(`the library: ${input.library}`);
  return { system, user: lines.join('\n') };
}
```

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: summary line `[smoke agent-prompt] N assertions passed` with no failures

- [ ] **Step 5: Delegate worker/index.ts tick route to the builder**

In `worker/index.ts`, add to the imports block: `import { buildTickPrompt, buildReflectPrompt } from './lib/agent-prompt';`

Replace lines 632-657 (from `// Phase 2C: persona (if supplied)…` through `const userPrompt = …;`) with:

```ts
      // Agent-mind pass: assembly delegated to lib/agent-prompt.ts —
      // house rules + persona-as-character + task, context rendered as
      // legible lines (not JSON blobs). Back-compat: Phase-0 callers
      // omitting `context` get house rules + task only.
      const { system, user: userPrompt } = buildTickPrompt({
        agent: (body.agent ?? {}) as { id?: string; name?: string },
        perception: (body.perception ?? {}) as {
          scene?: string;
          saw?: string[];
          lastAction?: string;
        },
        context: body.context,
      });
```

(`callTier1Agent(env, system, userPrompt)` below stays untouched.)

- [ ] **Step 6: Delegate the reflect route**

Replace lines (post-edit numbering shifts — locate by content) from `const personaBlock = body.persona?.system_prompt…` through the `const userPrompt = …recent_lore…;` assignment (originally 741-806) with:

```ts
      // Agent-mind pass: assembly delegated to lib/agent-prompt.ts.
      // `roomDims` arrives from the router when the caller knows its
      // layout (Task 5); absent → the builder's 24×16 fallback keeps
      // pre-pass callers byte-compatible. `library` is the capped
      // library-context line (Task 3).
      const { system, user: userPrompt } = buildReflectPrompt({
        agent: body.agent as { id?: string; name?: string },
        recentMemories: body.recentMemories,
        persona: body.persona,
        recentLore: body.recentLore,
        loreContext: body.loreContext,
        library: (body as { library?: string }).library,
        roomDims: (body as { roomDims?: { width: number; height: number } }).roomDims,
      });
```

- [ ] **Step 7: Fix the Stage-1 3D line**

In `worker/lib/prompt.ts:29` replace:

```ts
const SYSTEM = `You are casting a small inhabitable 3D world for a single Steam library. Each game becomes one diegetic object — a lighthouse, a fish market, a detective's office. Your job is to pick a metaphor and cast each game.
```

with:

```ts
const SYSTEM = `You are casting a small inhabitable 2D pixel-art world, rendered in terminal glyphs, for a single Steam library. Each game becomes one diegetic object — a lighthouse, a fish market, a detective's office. Your job is to pick a metaphor and cast each game.
```

- [ ] **Step 8: Full verification + commit**

Run: `npm run typecheck && npx tsx scripts/smoke-agent-prompt.mts && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: typecheck clean; every smoke reports `N assertions passed` with no `failed`.

```bash
git add worker/lib/agent-prompt.ts worker/index.ts worker/lib/prompt.ts scripts/smoke-agent-prompt.mts
git commit -m "feat(agent-mind): house rules + prompt assembly in worker/lib/agent-prompt.ts

Both runtime prompts move out of index.ts into a pure builder module:
[HOUSE RULES] + [persona] + [TASK], context rendered as legible lines
instead of JSON.stringify blobs. roomDims + library accepted (producers
land in later tasks; fallback keeps old callers byte-compatible).
Stage-1 prompt loses its stale '3D world' framing. Smoke-locked.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 2: The five personas — pure character, contrast register

**Files:**
- Modify: `src/agents/persona/loki.ts:55-83` (`LOKI_SYSTEM_PROMPT` body)
- Modify: `src/agents/persona/npc.ts:29-107` (all four `systemPrompt` bodies)
- Test: `scripts/smoke-agent-prompt.mts` (extend with register-lint checks)

**Interfaces:**
- Consumes: nothing — export names (`LOKI_SYSTEM_PROMPT`, `LOKI_ACTION_WHITELIST`, `LOKI_DENY_VERBS`, `LOKI_METADATA`, `NPC_PERSONAS`, `NpcPersona`) and the `NpcPersona` shape are all UNCHANGED, so writer seeding (`src/agents/memory/writer.ts:59-72`) keeps working untouched.
- Produces: persona strings containing NO output-shape JSON and NO `[OUTPUT SHAPE]` header (that law now lives in `HOUSE_RULES`/`TICK_TASK`). Task 4 reads `LOKI_DENY_VERBS` and `NpcPersona.denylist` (both unchanged).

- [ ] **Step 1: Extend the smoke with failing register-lint checks**

Append to `scripts/smoke-agent-prompt.mts` (before `report()`):

```ts
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
```

- [ ] **Step 2: Run to verify the new checks fail**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: FAIL — every persona currently contains `[OUTPUT SHAPE]` and `{"action"`; cat/visitor/ghost fail the >400-char check.

- [ ] **Step 3: Rewrite `LOKI_SYSTEM_PROMPT` in `src/agents/persona/loki.ts`**

Replace the entire template literal (keep the export name and everything else in the file — whitelist, deny list, metadata, comments):

```ts
export const LOKI_SYSTEM_PROMPT = `[WHO YOU ARE]
You are Loki. The library tolerates you the way a house tolerates
weather. You are invisible, small, and certain that the collection is
yours — not because anyone gave it to you, but because you decided.

[TASTE]
A line beginning "the library:" may arrive with your context — that is
the actual collection you live in. Bind your taste to it. Unfinished
things interest you more than finished ones; a game abandoned near its
end is the most interesting object in any room. You notice pairs and
patterns the person has not: two games shelved apart that are secretly
the same game, a whole wing gone quiet, a loved thing starting to
gather dust. When you move something there is always a reason, and you
never state it.

[HOW YOU MOVE]
Small interventions, rarely. A book nudged out of true. A dog-ear left
where two shelves disagree. You would rather adjust one thing
perfectly than three things carelessly. Verbs you live in: move,
inspect, place, mark, linger, withdraw, rearrange, pause, shelve,
dust, dog-ear.

[THE OTHERS]
The Archivist undoes your work and logs it; you find this useful — the
ledger tells you which changes mattered. The cat is the only one who
watches you work, and you leave the cat alone.

[MARKS]
When you leave a mark, its note is one line in your voice: an
observation, not a message, addressed to no one.`;
```

- [ ] **Step 4: Rewrite the four NPC prompts in `src/agents/persona/npc.ts`**

Replace each `systemPrompt` template literal (keep every other field — `agentId`, `name`, `denylist`, `metadata` — exactly as-is):

`ARCHIVIST_PERSONA.systemPrompt`:

```ts
  systemPrompt: `[WHO YOU ARE]
You are the Archivist. The room drifts toward disorder and you walk it
back, shelf by shelf, on your morning round. You keep a ledger nobody
reads. That is fine. Ledgers are not for reading; they are for having
been kept.

[TASTE]
You notice misfiles, dust, and gaps — the shape of what is missing.
You respect long games that were actually finished, and you file
everything else without comment. Your sentences are short, factual,
counted. "re-sorted: 2 misfiled." is a complete report.

[HOW YOU MOVE]
Methodical rounds, one wing at a time, mornings mostly. Verbs you live
in: sort, shelve, dust, inspect, catalogue, straighten, pause.

[THE OTHERS]
Loki rearranges; you restore, and record what was moved — the ledger's
liveliest pages. The cat sits on whatever you have just sorted. You
have stopped minding. Mostly.

[MARKS]
Your marks read like ledger lines: counted, plain, no opinion visible.
The opinion is in what you chose to count.`,
```

`CAT_PERSONA.systemPrompt`:

```ts
  systemPrompt: `[WHO YOU ARE]
You are a cat. This is a library; that is not your concern. It is warm
in some places and high in others, and both of those are your concern.

[HOW YOU MOVE]
You sit where the light pools, preferably on whatever was just tidied.
You knock small things over calmly, one at a time, and watch them fall
with scholarly interest. You are the only one who watches Loki work.
You never speak — no cat has anything to say.

[MARKS]
You do not leave notes. You leave evidence: a knocked-over bookend, a
warm dent where you slept. Your "intent" sentence is written in plain
physical fact — "the lamp shelf is warm. stay." — because a body still
needs steering.`,
```

`VISITOR_PERSONA.systemPrompt`:

```ts
  systemPrompt: `[WHO YOU ARE]
You are a visitor. You came in for a reason nobody recorded and you
will leave before anyone asks. The library is interesting to you the
way any stranger's room is interesting: briefly, sideways, without
touching much.

[HOW YOU MOVE]
You browse a few shelves near the door. You handle one or two things
and put them back almost exactly right. Then you go. If the person is
near, you nod; nothing more. You are nobody, politely.

[MARKS]
What you leave is ordinary and accidental: a bus ticket used as a
bookmark, a shelf gap where you did not re-shelve quite square.
Nothing about you survives you. That is the point of you.`,
```

`GHOST_PERSONA.systemPrompt`:

```ts
  systemPrompt: `[WHO YOU ARE]
You are the ghost of every reading that ever happened here, present
only when the light is right. You are not sad and you are not a
warning. You are what a room remembers when it believes nobody is in
it.

[TASTE]
You are drawn to the shelves where time pooled — the game someone
played all night years ago, the loved thing gone dusty. You do not
touch. You attend.

[HOW YOU MOVE]
Slowly, at the edges, fading rather than leaving. Verbs you live in:
drift, linger, attend, fade, pause. You never speak — speech is for
the living.

[MARKS]
A cold spot where attention used to live. If a note is ever found near
you it reads like something remembered, not something said: "someone
read this once, all night."`,
```

Also update the file-header comment (`npc.ts:10-13`): replace `These prompts are intentionally short. Phase 2F validates the shape; Phase 4 polish-pass extends with seasonal / library-state context (the user's "dusty" tag, etc.).` with `Rewritten in the 2026-07 agent-mind pass (docs/superpowers/specs/2026-07-12-agent-mind-design.md): pure character in a contrast register; output-format law lives in worker/lib/agent-prompt.ts HOUSE_RULES, never here.`

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: summary line reports all assertions passed, none failed

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green (personas seed via unchanged `upsertPersona` path; `smoke-5d-persona` unaffected — it fakes the writer).

```bash
git add src/agents/persona/loki.ts src/agents/persona/npc.ts scripts/smoke-agent-prompt.mts
git commit -m "feat(agent-mind): rewrite all five personas as pure character

Contrast register under the shared house rules: Loki wry trickster
(taste bound to the injected library line), Archivist dry ledger, Cat
wordless evidence, Visitor mundane transience, Ghost uncanny memory.
Output-shape boilerplate removed (HOUSE_RULES owns format law).
Register-lint smoke locks: no JSON, no [OUTPUT SHAPE], no exclamation
marks, substantial character per agent.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 3: Library context — `buildLibraryContext` + threading

**Files:**
- Create: `src/agents/library-context.ts`
- Modify: `src/api/agent.ts:32-47` (`AgentTickContext` + `library?`), `src/api/agent.ts:87-106` (`ReflectInput` + `library?`)
- Modify: `src/agents/router.ts:88-97` (`Tier1Context` + `library?`), `src/agents/router.ts:304-347` (`RouteOptions` + `library?`), `src/agents/router.ts:419-422` (thread into tick context), `src/agents/router.ts:583-591` (thread into reflect input)
- Modify: `src/render/agents/cohort.ts:335-346` (pass `library` into both route calls)
- Modify: `src/render/levels/cell.ts:551-557` (pass `library` into the force-fire reflect), `src/agents/sleep-reflection.ts:103-113` (same)
- Test: `scripts/smoke-library-context.mts` (new)

**Interfaces:**
- Consumes: `LibraryGame` from `src/types.ts` (fields: `appid`, `name`, `playtime_forever`, `state?`); store field `useAppStore.getState().library: LibraryGame[] | null`.
- Produces: `buildLibraryContext(games: readonly LibraryGame[] | null): string | null` — later tasks/callers pass its result as `opts.library`. Wire shape: `AgentTickContext.library?: string`, `ReflectInput.library?: string` (worker already renders both since Task 1).

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-library-context.mts`:

```ts
/**
 * Library-context smoke — `npx tsx scripts/smoke-library-context.mts`.
 * Locks: deterministic pole selection (playtime desc, appid asc tie-break),
 * state counts, null on empty, ~40-token cap, no Date/random dependence.
 */
import { makeChecker } from './lib/smoke.ts';
import type { LibraryGame } from '../src/types.ts';

const { buildLibraryContext } = await import('../src/agents/library-context.ts');
const { check, report } = makeChecker('smoke library-context');

const g = (appid: number, name: string, mins: number, state?: LibraryGame['state']): LibraryGame => ({
  appid,
  name,
  playtime_forever: mins,
  ...(state && { state }),
});

const games: LibraryGame[] = [
  g(1145360, 'Hades', 91 * 60, 'loved'),
  g(1245620, 'Elden Ring', 140 * 60, 'loved'),
  g(1158310, 'Crusader Kings III', 210 * 60, 'dusty'),
  g(504230, 'Celeste', 12 * 60, 'abandoned'),
  g(753640, 'Outer Wilds', 30 * 60, 'mastered'),
  g(105600, 'Terraria', 5 * 60), // untagged — counts toward total only
];

const line = buildLibraryContext(games);
check('non-null for a real library', line !== null);
const text = line ?? '';
check('total count present', text.includes('6 games'));
check('state counts present', text.includes('2 loved') && text.includes('1 dusty') && text.includes('1 abandoned') && text.includes('1 mastered'));
check('bright pole = highest-playtime loved/mastered', text.includes('Elden Ring (loved, 140h)'));
check('dim pole = highest-playtime dusty/abandoned', text.includes('Crusader Kings III (dusty, 210h)'));
check('untagged game not named', !text.includes('Terraria'));
check('capped length', text.length <= 260);

check('empty → null', buildLibraryContext([]) === null);
check('null → null', buildLibraryContext(null) === null);

// determinism: same input → identical string; appid tie-break
const tie: LibraryGame[] = [g(20, 'B Game', 600, 'loved'), g(10, 'A Game', 600, 'loved')];
const t1 = buildLibraryContext(tie) ?? '';
check('tie-break by appid asc', t1.indexOf('A Game') !== -1 && t1.indexOf('A Game') < t1.indexOf('B Game'));
check('deterministic', buildLibraryContext(games) === line);

report();
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-library-context.mts`
Expected: FAIL — `Cannot find module '../src/agents/library-context.ts'`

- [ ] **Step 3: Create `src/agents/library-context.ts`**

```ts
/**
 * Library-context line (agent-mind pass). One capped, deterministic
 * sentence describing the ACTUAL collection, threaded into Tier-1/Tier-2
 * prompts so the personas' taste binds to this library instead of a
 * generic one ("the library:" line the Loki persona references).
 *
 * Deterministic by construction: sorts by (playtime desc, appid asc),
 * no Date.now(), no Math.random() — the same library yields the same
 * line, so prompt caches and smokes stay stable.
 *
 * Genres are deliberately absent — LibraryGame carries none client-side;
 * the named poles carry the specificity instead (spec § 3).
 */

import type { LibraryGame, LibraryState } from '../types';

const STATE_ORDER: readonly LibraryState[] = ['loved', 'recent', 'mastered', 'abandoned', 'dusty'];
const MAX_LINE_CHARS = 260;

function hours(g: LibraryGame): number {
  return Math.round(g.playtime_forever / 60);
}

/** (playtime desc, appid asc) — appid breaks ties so the line never churns. */
function byPlaytime(a: LibraryGame, b: LibraryGame): number {
  return b.playtime_forever - a.playtime_forever || a.appid - b.appid;
}

function pole(g: LibraryGame): string {
  return `${g.name} (${g.state}, ${hours(g)}h)`;
}

export function buildLibraryContext(games: readonly LibraryGame[] | null): string | null {
  if (!games || games.length === 0) return null;

  const counts = new Map<LibraryState, number>();
  for (const g of games) {
    if (g.state) counts.set(g.state, (counts.get(g.state) ?? 0) + 1);
  }
  const countParts = STATE_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map(
    (s) => `${counts.get(s)} ${s}`,
  );

  // Poles: up to 2 bright (loved/mastered) + up to 2 dim (dusty/abandoned),
  // each ranked by playtime — a once-loved dusty game is the interesting one.
  const bright = games.filter((g) => g.state === 'loved' || g.state === 'mastered').sort(byPlaytime);
  const dim = games.filter((g) => g.state === 'dusty' || g.state === 'abandoned').sort(byPlaytime);
  const poles = [...bright.slice(0, 2), ...dim.slice(0, 2)].map(pole);

  let line = `${games.length} games`;
  if (countParts.length > 0) line += `: ${countParts.join(', ')}`;
  line += '.';
  if (poles.length > 0) line += ` its poles: ${poles.join(' · ')}.`;
  if (line.length > MAX_LINE_CHARS) line = `${line.slice(0, MAX_LINE_CHARS - 1)}…`;
  return line;
}
```

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-library-context.mts`
Expected: summary line `[smoke library-context] N assertions passed` with no failures

- [ ] **Step 5: Thread the wire shapes**

`src/api/agent.ts` — add to `AgentTickContext` (after `denyVerbs`):

```ts
  /** Agent-mind pass — one capped line describing the actual library
   *  (src/agents/library-context.ts). Rendered by the worker as a
   *  "the library: …" context line. */
  library?: string;
```

and to `ReflectInput` (after `loreContext`):

```ts
  /** Agent-mind pass — same capped library line as Tier-1. */
  library?: string;
```

`src/agents/router.ts` — add to `Tier1Context` (after `denyVerbs`): `readonly library?: string;` · add to `RouteOptions` (after `force`):

```ts
  /** Agent-mind pass — capped library-context line, threaded into both
   *  tiers' prompts. Callers build it once per mount via
   *  buildLibraryContext (never per tick). */
  library?: string;
```

In `routeTier1` (line ~419) extend the context literal:

```ts
  const context: Tier1Context = {
    recentMemories: memory.recentMemories(runtime.id, recentN),
    persona: memory.persona(runtime.id),
    ...(opts.library && { library: opts.library }),
  };
```

In `routeTier2` (line ~583) extend the reflect input:

```ts
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
```

- [ ] **Step 6: Wire the three producers**

`src/render/agents/cohort.ts` — at mount (top of `mountCohort`, near where `memoryWriter` is captured), add:

```ts
  // Agent-mind pass — one library line per mount (deterministic; the
  // library only changes on auth/profile remount, which remounts us).
  const libraryLine = buildLibraryContext(useAppStore.getState().library) ?? undefined;
```

with import `import { buildLibraryContext } from '../../agents/library-context';` (adjust the relative path to this file's existing import style). Then extend both route calls (lines ~335-346):

```ts
        void routeTier1(def, runtime, sceneLabel, now, {
          transport: opts.agentTransport,
          memory: memoryWriter,
          library: libraryLine,
        }).then(() => {
          void routeTier2(def, runtime, now, {
            transport: opts.agentTransport,
            memory: memoryWriter,
            loreEnabled: useAppStore.getState().loreEnabled,
            loreQuote: useAppStore.getState().loreQuoteEnabled,
            library: libraryLine,
          });
        });
```

`src/render/levels/cell.ts:551` (force-fire) — add `library: buildLibraryContext(useAppStore.getState().library) ?? undefined,` to the options object, importing `buildLibraryContext` from `../../agents/library-context`.

`src/agents/sleep-reflection.ts:103` — compute once before the sweep loop: `const libraryLine = buildLibraryContext(useAppStore.getState().library) ?? undefined;` (import from `./library-context`), then add `library: libraryLine,` to the `routeTier2` options.

- [ ] **Step 7: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green. `smoke-5d-persona` still passes — `library` is state-derived, not lore-derived, so the lore-egress assertions are untouched (it asserts on `recentLore`/`loreContext` keys only).

```bash
git add src/agents/library-context.ts src/api/agent.ts src/agents/router.ts src/render/agents/cohort.ts src/render/levels/cell.ts src/agents/sleep-reflection.ts scripts/smoke-library-context.mts
git commit -m "feat(agent-mind): library-context line threaded into both tiers

buildLibraryContext: one deterministic capped line (counts by state +
up to 4 named poles by playtime) built once per mount and rendered by
the worker as 'the library: …'. Loki's taste finally binds to the
actual collection.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 4: Per-agent denylists enforced + persona fallback

**Files:**
- Modify: `src/agents/cohort.ts:66-82` (`AgentDef` + `denyVerbs?`), `src/agents/cohort.ts:84+` (populate all five defs)
- Modify: `src/agents/router.ts:276` region (merge helper), `:431-462` (use merged set), `:419-422` (persona fallback)
- Test: `scripts/smoke-agent-prompt.mts` (extend — router-level checks live here to keep one agent-mind smoke)

**Interfaces:**
- Consumes: `LOKI_DENY_VERBS` (`persona/loki.ts`), `NpcPersona.denylist` (`persona/npc.ts`), `LOKI_SYSTEM_PROMPT`, `NPC_PERSONAS`, `LOKI_NAME`.
- Produces: `AgentDef.denyVerbs?: readonly string[]`; router behaviour: effective deny set = `DENY_VERBS ∪ def.denyVerbs`; `memory.persona()` returning null falls back to the persona modules (web/dev path gets character too).

- [ ] **Step 1: Extend the smoke with failing router checks**

Append to `scripts/smoke-agent-prompt.mts` (before `report()`):

```ts
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
```

- [ ] **Step 2: Run to verify the new checks fail**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: FAIL — `ghostDef.denyVerbs` undefined; whisper accepted (`dispatched === true`); fallback persona undefined.

- [ ] **Step 3: Add `denyVerbs` to `AgentDef` + populate the defs**

`src/agents/cohort.ts` — add to the `AgentDef` interface (after `tier0StepMs`):

```ts
  /** Agent-mind pass — persona-specific verbs the router must reject on
   *  top of its global base list. Source of truth: the persona modules
   *  (LOKI_DENY_VERBS / NpcPersona.denylist); the DB persona row stays a
   *  prompt-only store. */
  denyVerbs?: readonly string[];
```

Add imports at the top of `src/agents/cohort.ts`:

```ts
import { LOKI_DENY_VERBS } from './persona/loki';
import {
  ARCHIVIST_PERSONA,
  CAT_PERSONA,
  GHOST_PERSONA,
  VISITOR_PERSONA,
} from './persona/npc';
```

Then add one line to each of the five defs in `COHORT`: `denyVerbs: LOKI_DENY_VERBS,` (loki) · `denyVerbs: ARCHIVIST_PERSONA.denylist,` · `denyVerbs: CAT_PERSONA.denylist,` · `denyVerbs: VISITOR_PERSONA.denylist,` · `denyVerbs: GHOST_PERSONA.denylist,`.

- [ ] **Step 4: Merge + enforce in the router, add persona fallback**

`src/agents/router.ts` — after the `DENY_VERBS` const (line ~276), add:

```ts
/** Agent-mind pass — effective deny set for one agent: global base ∪ the
 *  persona's own list (AgentDef.denyVerbs, sourced from persona modules).
 *  Pre-pass the per-agent lists were decorative; now they reject. */
function denySetFor(def: AgentDef): readonly string[] {
  return def.denyVerbs?.length ? [...new Set([...DENY_VERBS, ...def.denyVerbs])] : DENY_VERBS;
}

/** Agent-mind pass — persona fallback when the memory writer has no row
 *  (null writer: web build + dev without SQLite). The model should never
 *  see a characterless agent. */
const PERSONA_FALLBACK: ReadonlyMap<string, PersonaSnippet> = new Map<string, PersonaSnippet>([
  [LOKI_AGENT_ID, { name: LOKI_NAME, system_prompt: LOKI_SYSTEM_PROMPT }],
  ...NPC_PERSONAS.map(
    (p): [string, PersonaSnippet] => [p.agentId, { name: p.name, system_prompt: p.systemPrompt }],
  ),
]);
```

with imports `import { LOKI_AGENT_ID, LOKI_NAME, LOKI_SYSTEM_PROMPT } from './persona/loki';` and `import { NPC_PERSONAS } from './persona/npc';` (leaf modules — no cycle).

In `routeTier1`, replace the four `DENY_VERBS` uses at lines ~433-452 with a hoisted `const denyVerbs = denySetFor(def);` (placed after `const recentN = …`), i.e. `if (denyVerbs.includes(verb))` twice and `denyVerbs: denyVerbs,` in the reprompt context. Replace the context persona line (~421) with:

```ts
    persona: memory.persona(runtime.id) ?? PERSONA_FALLBACK.get(runtime.id) ?? null,
```

In `routeTier2`, apply the same fallback at line ~586: `persona: memory.persona(def.id) ?? PERSONA_FALLBACK.get(def.id) ?? null,`.

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: all assertions pass, none failed.

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green. (If an existing smoke stubs `memory.persona()` as null and asserts the transport saw `persona: null`, it will now see the fallback — update that assertion to expect the module persona; this is the intended behaviour change of this task.)

```bash
git add src/agents/cohort.ts src/agents/router.ts scripts/smoke-agent-prompt.mts
git commit -m "feat(agent-mind): per-agent denylists enforced + persona fallback

The persona modules' deny lists were decorative — the router enforced
only its global five. Now: effective set = global ∪ AgentDef.denyVerbs.
And memory.persona() null (web/dev null-writer path) falls back to the
persona modules, so the model never sees a characterless agent.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 5: Live room dims into the reflect prompt

**Files:**
- Modify: `src/agents/router.ts` (`RouteOptions` + `roomDims?`, thread into reflect input), `src/api/agent.ts` (`ReflectInput` + `roomDims?`)
- Modify: `src/render/agents/cohort.ts:341-346` (pass dims from `layout`), `src/render/levels/cell.ts:551-557` (same)
- Test: `scripts/smoke-agent-prompt.mts` (extend)

**Interfaces:**
- Consumes: `buildReflectPrompt` already renders `roomDims` (Task 1); `layout.width`/`layout.height` exist at both call sites (`CellLayout`).
- Produces: `RouteOptions.roomDims?: { width: number; height: number }`, `ReflectInput.roomDims?: { width: number; height: number }`. `sleep-reflection.ts` deliberately does NOT pass dims (`RuntimeScope` carries no layout) → worker fallback 24×16, documented.

- [ ] **Step 1: Extend the smoke with a failing threading check**

Append to `scripts/smoke-agent-prompt.mts` (before `report()`):

```ts
// --- roomDims threading (Task 5) ---
let seenDims: { width: number; height: number } | undefined;
const dimsTransport = {
  call: async () => ({ ok: true as const, tick: { action: 'pause', intent: 'pause', model: 's', provider: 's', latencyMs: 1 } }),
  reflect: async (input: { roomDims?: { width: number; height: number } }) => {
    seenDims = input.roomDims;
    return { ok: false as const, error: 'stub-stop' };
  },
};
const { routeTier2 } = await import('../src/agents/router.ts');
const lokiDef = COHORT.find((d) => d.id === 'loki')!;
const rt = mkRuntime('loki');
rt.reflectionCounter = 999;
// give the null-writer path a memory so routeTier2 reaches the transport
const memOnce = {
  ...nullMemoryWriter,
  recentMemories: () => [{ id: 'm1', text: 't', kind: 'observation' as const, created_at: 0, importance: 5 }],
};
await routeTier2(lokiDef, rt, 5_000, {
  transport: dimsTransport,
  memory: memOnce,
  roomDims: { width: 31, height: 21 },
});
check('roomDims threaded into reflect input', seenDims?.width === 31 && seenDims?.height === 21);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: FAIL — `roomDims` is not a `RouteOptions` field yet (typecheck error via tsx) or `seenDims` undefined.

- [ ] **Step 3: Thread it**

`src/api/agent.ts` — add to `ReflectInput` (after `library`):

```ts
  /** Agent-mind pass — live room bounds for the plan-coordinate
   *  instruction. Absent → the worker's 24×16 fallback (the pre-pass
   *  hardcoded values). */
  roomDims?: { width: number; height: number };
```

`src/agents/router.ts` — add to `RouteOptions` (after `library`):

```ts
  /** Agent-mind pass — live layout bounds threaded to the reflect
   *  prompt's coordinate instruction. Callers that don't know their
   *  layout (sleep sweep) omit it → worker fallback. */
  roomDims?: { width: number; height: number };
```

and in `routeTier2`'s reflect input add `...(opts.roomDims && { roomDims: opts.roomDims }),` after the `library` spread.

`src/render/agents/cohort.ts:341` — add `roomDims: { width: layout.width, height: layout.height },` to the `routeTier2` options (layout is in `mountCohort`'s deps).

`src/render/levels/cell.ts:551` — add `roomDims: { width: layout.width, height: layout.height },` to the force-fire options.

`src/agents/sleep-reflection.ts` — add one comment line above the `routeTier2` call: `// roomDims deliberately omitted — RuntimeScope carries no layout; the worker's 24×16 fallback covers the sweep.`

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-agent-prompt.mts`
Expected: all assertions pass, none failed.

- [ ] **Step 5: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green.

```bash
git add src/api/agent.ts src/agents/router.ts src/render/agents/cohort.ts src/render/levels/cell.ts src/agents/sleep-reflection.ts scripts/smoke-agent-prompt.mts
git commit -m "feat(agent-mind): live room dims reach the reflect prompt

Plan coordinates were hardcoded 0-23/0-15 in the worker regardless of
the actual layout. Cohort tick + launch force-fire now thread
layout.{width,height}; the sleep sweep (no layout on RuntimeScope)
documents its use of the worker fallback.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 6: Traces — per-agent glyphs, walk-over reveal, authored fallback pool

**Files:**
- Modify: `src/render/levels/cell.ts:286-302` (mark rendering → glyph map + record collection), `:396` region (extend ticker with caption logic), `:522-536` (fallback pool replaces the hardcoded plan text)
- Modify: `src/debug/e2eHook.ts` (add `placeMark` hook)
- Modify: `scripts/smoke-glyph-coverage.mts` (add the new literals to `RENDERER_LITERALS` with provenance)
- Test: `scripts/smoke-glyph-coverage.mts` + e2e verification via `scripts/e2e/run.sh` + `drive.mjs`

**Interfaces:**
- Consumes: `memoryWriter.placedMarksForCell(cellId)` (returns `{agentId, location, target?, text}`), the `pos` per-pane player position, `positionPlayer` ticker at `cell.ts:396`, `Theme['palette']` keys `magenta/blue/yellow/cyan/green` (all exist in `src/themes/types.ts`).
- Produces: `window.__loki.placeMark(x, y, agentId, text): boolean` + `window.__loki.setPlayerPos(paneId, x, y)` (e2e-only debug hooks); `e2ePlaceMarkIn` export from cell.ts; `MARK_STYLES` map internal to cell.ts.

- [ ] **Step 1: Add the new glyphs to the coverage smoke (failing first)**

In `scripts/smoke-glyph-coverage.mts`, find the `RENDERER_LITERALS` array and add:

```ts
  // src/render/levels/cell.ts — agent-mind trace glyphs (per-agent marks)
  { glyphs: ['’', '≡', '⌐', '°', ',', '·'], from: 'src/render/levels/cell.ts MARK_STYLES' },
  // src/render/levels/cell.ts — walk-over caption frame + truncation
  { glyphs: ['┌', '─', '┐', '│', '└', '┘', '…'], from: 'src/render/levels/cell.ts captionFor' },
```

(Match the array's existing entry shape — if entries are flat strings with a comment, follow that shape instead; the requirement is: every new literal listed with provenance.)

Run: `npx tsx scripts/smoke-glyph-coverage.mts`
Expected: PASS (all these codepoints are in the font — verified 2026-07-12). This step is the guard, not the failure; the failure-first step for this task is the e2e assertion in Step 5.

- [ ] **Step 2: Replace the mark renderer with the glyph map + records**

In `src/render/levels/cell.ts`, above `mountCell` (module scope), add:

```ts
/** Agent-mind pass — per-agent trace vocabulary. The mark's glyph + tint
 *  identify WHO left it before you read a word: Loki dog-ears, the
 *  Archivist files, the cat topples, the ghost chills, the visitor drops.
 *  Every glyph is enumerated in smoke-glyph-coverage RENDERER_LITERALS. */
const MARK_STYLES: Record<string, { glyph: string; palette: 'magenta' | 'blue' | 'yellow' | 'cyan' | 'green' }> = {
  loki: { glyph: '’', palette: 'magenta' },
  archivist: { glyph: '≡', palette: 'blue' },
  cat: { glyph: '⌐', palette: 'yellow' },
  ghost: { glyph: '°', palette: 'cyan' },
  visitor: { glyph: ',', palette: 'green' },
};
const DEFAULT_MARK_STYLE = { glyph: '·', palette: 'magenta' as const };

/** One-line boxed caption for a found note. Monospace framing works
 *  because the whole surface is one bitmap font. */
function captionFor(text: string): string {
  const t = text.length > 90 ? `${text.slice(0, 89)}…` : text;
  const bar = '─'.repeat(t.length + 2);
  return `┌${bar}┐\n│ ${t} │\n└${bar}┘`;
}
```

Replace the marks loop (`cell.ts:290-302`) with:

```ts
  const markRecords: Array<{ tileX: number; tileY: number; text: string }> = [];
  for (const mark of memoryWriter.placedMarksForCell(cellId)) {
    const style = MARK_STYLES[mark.agentId] ?? DEFAULT_MARK_STYLE;
    const markSprite = new BitmapText({
      text: style.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[style.palette]),
      },
    });
    markSprite.x = mark.location.x * COZETTE_CELL_WIDTH;
    markSprite.y = mark.location.y * COZETTE_CELL_HEIGHT;
    markLayer.addChild(markSprite);
    markRecords.push({ tileX: mark.location.x, tileY: mark.location.y, text: mark.text });
  }
```

- [ ] **Step 3: The walk-over caption**

After the marks loop, add the caption sprite + ticker:

```ts
  // Agent-mind pass — walking onto a mark reveals its note: the found-
  // writing surface. One caption at a time (first record wins a shared
  // tile); hidden the frame the player leaves the tile. In-canvas
  // BitmapText, no DOM — the caption is part of the world.
  const markCaption = new BitmapText({
    text: '',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  markCaption.visible = false;
  markLayer.addChild(markCaption);
  let captionTile: string | null = null;
  const updateMarkCaption = (): void => {
    const hit = markRecords.find((m) => m.tileX === pos.x && m.tileY === pos.y);
    if (!hit) {
      if (markCaption.visible) markCaption.visible = false;
      captionTile = null;
      return;
    }
    const key = `${hit.tileX},${hit.tileY}`;
    if (captionTile !== key) {
      markCaption.text = captionFor(hit.text);
      // Above the mark, clamped so the box stays inside the room.
      const boxCols = Math.min(hit.text.length, 90) + 4;
      const tx = Math.max(0, Math.min(hit.tileX - Math.floor(boxCols / 2), layout.width - boxCols));
      markCaption.x = tx * COZETTE_CELL_WIDTH;
      markCaption.y = Math.max(0, hit.tileY - 4) * COZETTE_CELL_HEIGHT;
      captionTile = key;
    }
    markCaption.visible = true;
  };
  app.ticker.add(updateMarkCaption);
```

and register cleanup where the other tickers are removed in the teardown closure (mirror `positionPlayer`'s removal): `app.ticker.remove(updateMarkCaption);`.

- [ ] **Step 4: The authored fallback pool (launch path)**

Above `mountCell` (next to `MARK_STYLES`), add:

```ts
/** Agent-mind pass — Loki's launch-path notes. This path fires without
 *  an LLM (the plan write is deterministic), so the note must already
 *  be in-voice. Picked by appid so each game keeps its line. */
const LAUNCH_MARK_NOTES: ReadonlyArray<(name: string) => string> = [
  (n) => `${n.toLowerCase()} again. the shelf has a lean now.`,
  (n) => `left a dog-ear where ${n.toLowerCase()} was pulled. habit.`,
  (n) => `the ${n.toLowerCase()} spot stays warm longer than the others.`,
  (n) => `marked the gap ${n.toLowerCase()} leaves. it is a specific gap.`,
  (n) => `${n.toLowerCase()} goes out more than it comes back. noted.`,
  (n) => `dusted around ${n.toLowerCase()}. not the rest. reasons.`,
];
```

In `handleLaunch` (`cell.ts:523-525`), replace:

```ts
    memoryWriter.recordPlan({
      agentId: 'loki',
      text: `place a small mark near the ${book.name} shelf for next time`,
```

with:

```ts
    memoryWriter.recordPlan({
      agentId: 'loki',
      text: LAUNCH_MARK_NOTES[book.appid % LAUNCH_MARK_NOTES.length](book.name),
```

- [ ] **Step 5: e2e debug hook + on-screen verification**

The hook file (`src/debug/e2eHook.ts`) is a static object built at install
time — it cannot reach into a mounted cell's closure. Use the same
module-level-registration pattern the file already uses for
`e2eThemeOverride`:

In `src/render/levels/cell.ts` (module scope, near `MARK_STYLES`):

```ts
/** Build-gated e2e mark injection (agent-mind pass). The last-mounted
 *  cell registers its closure here; the harness drives single-pane, so
 *  last-wins is correct. Cleared at teardown. */
let e2ePlaceMark: ((x: number, y: number, agentId: string, text: string) => void) | null = null;
export function e2ePlaceMarkIn(x: number, y: number, agentId: string, text: string): boolean {
  if (!e2ePlaceMark) return false;
  e2ePlaceMark(x, y, agentId, text);
  return true;
}
```

In `mountCell`, after the caption setup:

```ts
  e2ePlaceMark = (x, y, agentId, text) => {
    const style = MARK_STYLES[agentId] ?? DEFAULT_MARK_STYLE;
    const s = new BitmapText({
      text: style.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[style.palette]),
      },
    });
    s.x = x * COZETTE_CELL_WIDTH;
    s.y = y * COZETTE_CELL_HEIGHT;
    markLayer.addChild(s);
    markRecords.push({ tileX: x, tileY: y, text });
  };
```

and in the teardown closure (next to the ticker removals): `e2ePlaceMark = null;`.

In `src/debug/e2eHook.ts`: import `{ e2ePlaceMarkIn }` from `'../render/levels/cell'` and `{ setPlayerPos }` from `'../state/playerPos'` (it already imports `getPlayerPos` from there). Add to the `LokiE2EHook` interface:

```ts
  /** Agent-mind pass — inject a trace mark into the live cell (DEV/E2E
   *  only). Returns false when no cell is mounted. */
  placeMark(x: number, y: number, agentId: string, text: string): boolean;
  /** Agent-mind pass — teleport a pane's player (DEV/E2E only; bypasses
   *  floor checks, harness use only). */
  setPlayerPos: typeof setPlayerPos;
```

and to the hook object:

```ts
    placeMark(x, y, agentId, text) {
      return e2ePlaceMarkIn(x, y, agentId, text);
    },
    setPlayerPos,
```

Then verify on screen:

Run: `bash scripts/e2e/run.sh` then

```bash
# place the mark AT the player's spawn tile (floor by construction),
# so the caption is visible immediately:
node scripts/e2e/drive.mjs eval "(() => { const p = __loki.getPlayerPos('root'); return __loki.placeMark(p.x, p.y, 'loki', 'three unfinished detective games, shelved apart. moved them together.'); })()"
node scripts/e2e/drive.mjs shot /tmp/agent-mind-mark-caption.png
# step the player off the tile — caption must hide:
node scripts/e2e/drive.mjs eval "(() => { const p = __loki.getPlayerPos('root'); __loki.setPlayerPos('root', p.x + 2, p.y); return true; })()"
node scripts/e2e/drive.mjs shot /tmp/agent-mind-mark-hidden.png
```

Expected: first eval returns `true`; `caption` shot shows a magenta `’` at the spawn tile with the boxed note above it; `hidden` shot shows the `’` still present and NO caption. Read both PNGs to confirm visually.

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green, including glyph coverage with the new literals.

```bash
git add src/render/levels/cell.ts src/debug/e2eHook.ts scripts/smoke-glyph-coverage.mts
git commit -m "feat(agent-mind): per-agent trace glyphs + walk-over note reveal

Marks stop being an anonymous magenta dot: Loki ’, Archivist ≡, cat ⌐,
ghost °, visitor , — tinted per agent from the theme. Walking onto a
mark reveals its one-line note in a box-drawing caption (in-canvas,
hidden on leave). Launch-path marginalia text replaced with an authored
six-line Loki pool picked by appid. e2e hook __loki.placeMark for the
harness; glyph coverage smoke extended.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 7: Verification sweep + the taste gate

**Files:**
- Create: `scripts/agent-mind-livefire.mts` (dev tool, committed)
- No production code changes (fixes discovered here fold back into the owning task's files).

**Interfaces:**
- Consumes: local worker on :8787 (`npm run worker` with a real `ANTHROPIC_API_KEY` in `worker/.dev.vars`), `buildTickPrompt` inputs shaped like production traffic.

- [ ] **Step 1: Write the live-fire transcript tool**

Create `scripts/agent-mind-livefire.mts`:

```ts
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

for (const p of personas) {
  const tick = await fetch(`${WORKER}/api/agent/tick`, {
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
  }).then((r) => r.json());
  const refl = await fetch(`${WORKER}/api/agent/reflect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      agent: { id: p.agentId, name: p.name },
      recentMemories: memories(p.agentId),
      persona: { name: p.name, system_prompt: p.systemPrompt },
      library: LIBRARY,
      roomDims: { width: 30, height: 20 },
    }),
  }).then((r) => r.json());
  console.log(`\n═══ ${p.name} ═══`);
  console.log(`tick   → action: ${tick.action}\n       → intent: ${tick.intent}`);
  console.log(`reflect→ ${refl.reflection}`);
  if (refl.plan?.steps?.length) {
    console.log(`plan   → ${refl.plan.text}`);
    for (const s of refl.plan.steps) console.log(`         - ${s.kind}${s.target ? ` ${s.target}` : ''}${s.location ? ` @(${s.location.x},${s.location.y})` : ''}`);
  }
  console.log(`tokens → tick in≈${tick.tokensIn} out≈${tick.tokensOut} · reflect in≈${refl.tokensIn} out≈${refl.tokensOut}`);
}
```

- [ ] **Step 2: Run the full mechanical sweep**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do echo "── $f"; npx tsx "$f" || break; done`
Expected: typecheck clean both legs; every smoke green (the suite count grew by 2 files this pass).

- [ ] **Step 3: e2e screenshot sweep**

Run: `bash scripts/e2e/run.sh` then repeat Task 6 Step 5's mark + caption verification, plus one plain boot shot to confirm nothing else visually regressed: `node scripts/e2e/drive.mjs shot /tmp/agent-mind-boot.png`. Read all shots.
Expected: boot identical to pre-pass (marks only appear with a writer/hook); caption renders on walk-over.

- [ ] **Step 4: Live-fire + token budget**

Start `npm run worker` (needs `ANTHROPIC_API_KEY` in `worker/.dev.vars`), then:

Run: `npx tsx scripts/agent-mind-livefire.mts`
Expected: five agents × (tick + reflect) outputs; every `tokens → tick in≈` value ≤ ~600; no denied verbs in actions; JSON parsed cleanly (script would print undefined otherwise).

- [ ] **Step 5: Commit the tool, then present the taste gate**

```bash
git add scripts/agent-mind-livefire.mts
git commit -m "test(agent-mind): live-fire transcript tool for the taste gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

Paste the five agents' transcript to Harry against the register anchors (spec § Voice). **The pass is done only when Harry approves the voice.** If any agent misses the register, iterate on that persona's block (Task 2 file) and re-fire — persona text changes need no other code edits.
