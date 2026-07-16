---
up: "[[Lokilibrary]]"
---

# VISION — what this project could become

The long view, assembled in one place. The detailed thinking lives in
[`IDEAS.md`](IDEAS.md) (parked directions, each with its own status and
dependency chain), [`docs/PRD-snapping-terminals.md`](docs/PRD-snapping-terminals.md)
(the active arc's unbuilt tiers), [`SPEC.md`](SPEC.md) §10 (the year-by-year
roadmap), and [`docs/pivot/CONSOLIDATION.md`](docs/pivot/CONSOLIDATION.md)
(pillars and scope). This file is the map, not the territory: when it
disagrees with those, they win. Everything below v1.0 is a **candidate, not a
commitment** — the point of writing it down is to protect the option, not to
promise the feature.

**Where we are:** v1.0 shipped (2026-07-16) — the living palace, the agent
cohort, themes, wallpaper mode, and the snapping-terminals join moment. What
follows is where the notes say it can go.

---

## The reframe at the centre: a world that is alive

Today the pitch is *a memory palace populated by a society of agents*. The
deeper version — the one `IDEAS.md` calls the most important reframe in the
file — is:

> **A memory palace that is alive. Its mood shifts with your week; its
> population are the dreams of the world itself.**

Two moves make that real:

**Loki is the climate, not a creature.** The agents are discrete, located,
embodied inhabitants. Loki is not one of them — Loki is the substrate they
live in: the world's drifting palette (mood as colour), glyph density and
cursor rhythm (mood as typography), the pane topology (mood as architecture),
the population's energy (mood as life). Climate doesn't *want* anything —
which dissolves the creepy agent-with-goals problem — it *responds*. The
local-AI landmark stops being a house and becomes the altar: the whole world
is Loki; that's where Loki is most concentrated.

**The society is something you visit, not something that engages you.** The
agents aren't optimised to interact with the user; they're living their
lives, and your attention happens to be the gravity those lives orbit. This
is the precise inversion of every engagement-driven product — and it's
uncopyable by anyone whose metrics demand the opposite.

## The five living systems

For the climate to have something to respond to, the society needs
world-modifying work — roughly the canonical civilisation systems:

- **Farming.** Every game is a seed: it sprouts when you start playing,
  grows with hours sunk in, wilts but never dies when you stop. Agents are
  gardeners — composting the un-played, pairing structurally-similar games
  as companion plantings.
- **Culture.** The society accrues a calendar (the Festival of Returnings
  when a long-abandoned game reopens), and names drift — the lighthouse
  becomes "the Hades shrine" because that's what it became. *(Seeded: the
  events calendar shipped 2026-07-13.)*
- **Art.** Agents accumulate a creative budget and spend it making things —
  notebooks, monuments, songs, marginalia — with your uploaded lore as raw
  material. The world grows encrusted with small artefacts. *(This is the
  one v1.0-scoped feature still unbuilt — the enrichment budget.)*
- **Science.** The most novel: agents study the world, which is to say,
  *you*. They form hypotheses ("Harry plays Stardew when he's stressed"),
  publish little papers in the archive, form competing schools of thought —
  and, deep in the trust ladder, publish verifiable predictions about what
  you'll play next. Generative anthropology with the user as subject.
- **Markets.** The scarce resource is attention. Agents earn it when you
  visit, spend it on creative budget, and — the deeper version — trade
  *observations*, compounding findings into richer hypotheses.

The compositions are the payoff: farmers notice a hybrid sprout → scientists
publish → artists write the poem → the market values it → the climate warms
because the world is engaged in itself.

## Sleep mode: how change is delivered

The world changes **while you're away**. When the app is unfocused and the
machine is idle, rendering drops to its floor and the agents' budget rises —
using the local model if one is present (free, private, on-device; the
landmark earns its keep) or one nightly cloud reflection if not. You wake to
a single terminal-styled dispatch:

> *"Last night Loki added a shelf in the lighthouse and pinned a note about
> Disco Elysium."*

A **trust ladder** gates what sleep may touch: marginalia first; structures
after you've returned enough times without flinching; topology only on
explicit opt-in. Anything can be pinned immutable. The agent never sneaks —
every change is named in the dispatch and reversible from it. *(Seeded: the
`SLEEPING` throttle state and morning dispatch shipped in Phase 5.)*

## The desk as world: where snapping terminals goes next

The join moment shipped. The PRD's remaining tiers turn it from a mechanic
into a relationship:

- **T4 — topology enters the agents' minds.** Reflections know the desk
  ("walk to the d1 terminal"); the morning dispatch narrates overnight
  movement across your windows.
- **T5 — the society proposes topology.** Opt-in only: overnight, the agents
  may propose *one* change — "open a terminal onto wing d2" — surfaced in
  the dispatch with one-tap apply/dismiss. Agents never move your windows.
- **Beyond T5 — agent-initiated world-joining.** The sharpened Depth-3 from
  `IDEAS.md`: agents from *different worlds* negotiate to open a seam — the
  join as an event the society produced, not a schedule anyone ran. This is
  where the RimWorld-grade "story you tell other people" lives.
- **Per-terminal identity.** Each window its own palette and vocabulary
  (one palette per *scene* survives — the seam is the boundary), so a join
  reads as a portal between genuinely different places.

## Beyond Steam (Year 2)

- **Dream mode.** Per-folder opt-in filesystem access — your writing, your
  music, your photos become wings, under the strictest privacy rail in
  `CLAUDE.md` (local-files mode forces the router local-only).
- **Cross-source seams.** The reserved corner-touch semantics: a Steam pane
  touching a Spotify/Letterboxd/GitHub pane, agents drawing connections
  between how you play and what you listen to.
- **Arrangement as the fifth personalisation lever** — library data →
  behavioural profile → theme → lore → *topology*. Two identical libraries,
  two incompatible worlds, because the panes route the society differently.
  Lore is what the agents read; arrangement is what they inhabit.

## Agent-native (Year 3+)

Two futures, in sequence, from `IDEAS.md`:

- **Future A — a destination agents bring users to.** An MCP server exposes
  the world's *perspective*: "the worn path leads to the lighthouse; the
  cottage hasn't been visited in three weeks." Your personal agent queries
  it and answers "what should I play tonight?" with your world's own
  vocabulary. Products will increasingly be judged by how well agents can
  describe them; the `world_manifest` becomes a public, semantically rich
  schema rather than a renderer artifact.
- **Agent-to-agent across users.** The friend-visiting feature done as
  gossip: "Sam's agent says he's really into Disco Elysium — want to see
  his lighthouse?" Permissioned, diegetic, no social UI.
- **Future B — the agent's environment.** On whatever spatial hardware wins,
  the world is the substrate your agent inhabits *with* you — it has a
  corner, it walks with you, it points at the lighthouse and tells you a
  story. Years out; Future A is the bridge.

Plus the annual moment: **Year-in-Library** — the world's own retelling of
your year, narrated from the agents' papers and the paths you wore.

## On fidelity

The visual ceiling does not get raised by swapping glyphs for sprites — it
gets raised by **accrual**:

1. **Finish the coherence campaign** (`docs/design-reviews/`): salience,
   ambient life, book-spines, the shade ramp, ladder identity.
2. **Curated fidelity where it earns its place**: the Phase 3 pipeline bakes
   candidates, a human picks *one survivor*, palette-quantized, enabled slot
   by slot via `CURATED_SLOTS`. Murals: CDN art re-rendered through the
   shade ramp, hung in a box-drawing frame.
3. **The agents make the rest.** Worn paths, notes, monuments, papers,
   songs — a world encrusted with artefacts the society made reads richer
   than any tileset, and no one else can ship it.

## The rails that don't move

Every future above is bounded by the same constraints that made the product
distinct in the first place (`CLAUDE.md`):

- The agent is never a chatbot — expression is spatial, always.
- One palette per scene; glyph vocabulary is deliberate; taste is the moat.
- Determinism in the procedural layer — same profile, same world.
- All AI behind the Worker; keys never touch a frontend; every new signal
  source is opt-in, on an explicit privacy gradient.
- Free, open source, BYO keys. No engagement metrics — the inversion *is*
  the product.

## Source map

| Direction | Where the detail lives | Status |
|---|---|---|
| Living world (Loki-as-climate, five systems) | `IDEAS.md` § The living world | committed direction; systems land incrementally |
| Sleep mode + trust ladder + dispatch | `IDEAS.md` § Sleep mode | Depth 1 shipped (5B); Depths 2–3 later |
| Agent-as-marginalia (three depths) | `IDEAS.md` § Agent-as-marginalia | Depth 1 shipped; Depth 2–3 later |
| Snapping terminals T4/T5 | `docs/PRD-snapping-terminals.md` §5 | next arc candidates |
| Agent-initiated world-joining | `IDEAS.md` § Composable panes (Depth 3, 2026-06-03) | v2.x, gated on trust rails |
| Per-terminal identity | `IDEAS.md` § Per-terminal identity | parked; after land renderer settles |
| Per-scale projection bands | `IDEAS.md` § Per-scale perspective | partially realised (terminals are side-on) |
| Local LLM in the world | `IDEAS.md` § The local LLM is visible | Depth 1 shipped (6A) |
| Enrichment/creative budget | `docs/pivot/CONSOLIDATION.md` § v1.0 MVP | unbuilt; the Art system's seed |
| Dream mode / multi-source | `SPEC.md` §10 Year 2, `CLAUDE.md` rails | year 2 |
| MCP / agent-native / agent-to-agent | `IDEAS.md` § Agent-native LibraryWorld | keep warm; revisit ~6 months post-v1.0 |
| Community content (themes/templates/lore packs) | `SPEC.md` §10 v1.x | v1.x, free only |
