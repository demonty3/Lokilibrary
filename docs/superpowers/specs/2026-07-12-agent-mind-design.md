# Agent-mind pass — design

*2026-07-12 · approved approach: B ("persona architecture + curated context")*
*Decisions locked with Harry: voice = **contrast per agent under a shared
restraint rule**; trace scope = **text + walk-over reveal**.*

## Why this pass

The agent layer's authored text is the product's magic surface, and it was
never finished: the four NPC personas are explicit stubs, the worker's
Tier-1 base prompt breaks its own fiction ("2D memory palace populated by
short-lived sprites"), models receive raw `JSON.stringify` blobs as
context, the Tier-2 reflection prompt hardcodes stale room coordinates
(`x: 0-23, y: 0-15`), per-agent denylists in `persona/npc.ts` are
**decorative** (the router enforces only a global 5-verb list), Loki's
"taste" never sees the actual library, and the entire visible output of
agent-as-marginalia renders as a single `·` with its note text unreadable.

## Voice — the register contract

One shared restraint rule, five contrasting characters. The restraint rule
(house rules, worker-owned): understatement; never cute; never addresses
the user; never explains itself; no engagement goals; every action
placeable; one action per event.

Register anchors (approved samples — implementation must hit this bar):

- **Loki** (wry trickster): *"three unfinished detective games, shelved
  apart. moved them together."*
- **Archivist** (dry, factual): *"re-sorted: 2 misfiled. dust on the
  strategy wing."*
- **Cat** (wordless — traces only): a knocked-over bookend, a warm dent.
- **Ghost** (uncanny, sparse): *"someone read this once, all night."*
- **Visitor** (mundane, passing): *"left a bus ticket as a bookmark."*

## 1 · Persona architecture

**House rules move to the worker.** One `HOUSE_RULES` block in a new
`worker/lib/agent-prompt.ts` (index.ts is 1071 lines; the prompt assembly
for both tiers moves there too), prepended to
every Tier-1/Tier-2 dispatch: restraint rule + placeability + one-action
limit + output shape. Stated once — personas stop duplicating the
`[OUTPUT SHAPE]` boilerplate.

**Personas become pure character.** Rewrite all five in
`src/agents/persona/{loki,npc}.ts`: identity, taste, what-it-notices,
verb palette, 1–2 relationship lines (Cat sits on what the Archivist just
sorted; Ghost avoids Loki; Archivist tolerates Loki's rearrangements and
logs them). Loki's taste section references the injected library-context
line ("your taste binds to what the library actually holds — its loved
things, its dusty things"). Storage unchanged: `agent_personas.
system_prompt` seeded idempotently by the writer, as today.

**Personas reach the model even without a DB.** When
`memory.persona()` returns null (the null writer: web build, dev
without SQLite), the router falls back to the persona modules — the
model never sees a characterless agent. (Added during planning; the
pre-pass behaviour shipped persona-less prompts on that path.)

**Denylists become real.** Source of truth stays the persona modules
(`LOKI_DENY_VERBS`, `NpcPersona.denylist`); wire them through the cohort's
`AgentDef` into `routeTier1`, where the effective deny set = global base
(`DENY_VERBS`) ∪ per-agent list. Same drop + one-reprompt behaviour,
reprompt preamble lists the merged set. Wiring (resolved 2026-07-12):
`AgentDef` in `cohort.ts` gains a `denyVerbs?: readonly string[]` field
populated from the persona modules — `AgentDef` is pure runtime config
today (glyph/fov/spawn/schedule/throttles), this fits, and the DB stays
a prompt-only store.

## 2 · Runtime prompts (worker/index.ts)

**Tier-1 tick** — assembly: `[house rules] + [character] + [task]`.
Context rendered as legible lines, not JSON:

- perception → one line per event kind (map over the existing
  `PerceptionEvent` kinds): `- you notice: the player lingering near the
  strategy shelf`
- recent memories → `- 14m ago (reflection, importance 7): <text>`
- library context → single line (see § 3)

Task text: "choose your next small action; the `intent` sentence is what
steers your body — make it concrete and placeable." Output shape
unchanged: `{"action": …, "intent": …}` with the same length caps.
Tier-1 input budget target: **≤ ~600 tokens** (measured, see § 5).

**Tier-2 reflect** — same assembly. Changes: room coordinates injected
from the live layout (`location: {x: 0-<w-1>, y: 0-<h-1>}` — `roomDims`
threaded `cohort tick / sleep-reflection → routeTier2 → ReflectInput →
worker body`; when absent, worker falls back to today's constants). The
five plan verbs are unchanged (`move_to · inspect · place_mark · linger ·
withdraw`). New instruction: **a `place_mark` step's plan text is the
note a user may later find — one line, in-character, ≤ 90 chars.**
Closed-vocab lore nudge (5D) kept verbatim; library-context line added.
Reflection sentence remains the morning-dispatch banner copy — the house
rules govern its register.

**Stage 1 correction only:** `worker/lib/prompt.ts`'s "casting a small
inhabitable 3D world" line becomes 2D framing ("a small inhabitable
pixel-art world rendered in terminal glyphs"). Nothing else in Stage 1
changes this pass.

## 3 · Library context snippet

New `src/agents/library-context.ts`:
`buildLibraryContext(games) → string | null` — one capped line
(~40 tokens): total count, counts by state
(`loved/recent/mastered/abandoned/dusty`), up to 4 named "poles" chosen
deterministically (top loved/mastered by playtime + top dusty/abandoned
by playtime, appid tie-break so the line doesn't churn between calls).
Genres are not available client-side (`LibraryGame` carries none) — the
named poles carry the specificity instead. Threaded through the
existing `Tier1Context` and `ReflectInput` as an optional `library`
field; worker renders it as its own context line. Null when the library
is empty → line omitted. No new egress class (game names already flow to
the worker for Stage 1 casting).

## 4 · Traces — per-agent glyphs + walk-over reveal (src/render/levels/cell.ts)

**Glyph map by `agentId`** (no schema change — `placedMarksForCell`
already returns `agentId`): Loki `’` (dog-ear), Archivist `≡`, Cat `⌐`
(knocked bookend), Ghost `°` (cold spot), Visitor `,` (something
dropped). All five glyphs — and the caption's `┌─┐│└┘` + `…` set — are
verified present in `scripts/lib/cozette-coverage.json` (checked
2026-07-12); `smoke-glyph-coverage` guards them permanently once they
ship.
Marks tint from the active theme (dim accent), not hardcoded colour.

**Walk-over reveal:** when the player's tile equals a mark's tile, render
one in-canvas caption (BitmapText framed with the proven box-drawing set
`┌─┐│└┘`): the mark's note text, ≤ 90 chars, ellipsis-truncated,
positioned above the mark and clamped to room bounds; nearest mark wins
if several share the tile; hidden on tile-leave. No DOM, no HUD line.

**Launch-path fallback marginalia** (`cell.ts` bookshelf-launch path,
today hardcoded "place a small mark near the X shelf for next time"):
replace with a small authored pool (~6 Loki-register lines templated with
the game name), picked by FNV-1a hash of `appid` — stable per game,
varied across a library. This path fires without an LLM and must read
in-character anyway.

## 5 · Verification

1. **Existing smokes stay green** — all 27 suites, most sensitively
   `smoke-5d-persona` (closed-vocab egress gate), `smoke-7d2-walk`,
   `smoke-glyph-coverage`. Typecheck clean both legs.
2. **New smoke: prompt assembly** — house rules + character + context
   render to the expected shapes; per-agent denylist actually rejects a
   denied verb for an NPC (this fails against today's code); `roomDims`
   reaches the reflect prompt; library line present/absent correctly.
3. **New e2e step** — via the existing harness: place a mark through the
   debug hook, walk the player onto it, screenshot shows the caption;
   walk away, caption gone.
4. **Cost check** — telemetry overlay before/after on the same perception
   script; curated rendering should roughly offset added
   character/library tokens. Regression bar: Tier-1 input ≤ ~600 tokens.
5. **The taste gate (Harry)** — live-fire the worker on the real key;
   collect Tier-1 + Tier-2 outputs for all five agents; paste against the
   register anchors above. The pass isn't done until the voice passes.

## Out of scope (later arcs)

Trace decay/wear · relationship *mechanics* (text-only relationships are
in) · any dialogue system (no-chatbot rail holds; Archivist/Visitor
`mayDialogue` metadata is untouched but unused) · events calendar ·
enrichment budget · Stage 1 rewrite beyond the one-line 2D correction ·
new plan verbs (the queued `shelve/dust/dog-ear` stay Tier-1-intent-only).

## Files touched

`src/agents/persona/loki.ts` · `src/agents/persona/npc.ts` ·
`src/agents/cohort.ts` (denylist/def wiring) · `src/agents/router.ts`
(deny-set merge, `library` + `roomDims` threading) ·
`src/agents/library-context.ts` (new) · `src/agents/sleep-reflection.ts`
(dims threading) · `worker/lib/agent-prompt.ts` (new — house rules +
both prompt assemblies + context rendering) · `worker/index.ts` (routes
delegate to it) · `worker/lib/prompt.ts` (2D line) ·
`src/render/levels/cell.ts` (glyph map, reveal, fallback pool) · new
smoke script + e2e step.
