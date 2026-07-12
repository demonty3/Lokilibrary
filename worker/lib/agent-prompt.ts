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
