# LibraryWorld — Parked ideas

A place for template directions and creative concepts that aren't on the v0.1–v1.0 roadmap but are worth not forgetting. Anything here is a candidate, not a commitment.

Each section is dated and ends with a clear `Status` line so future-Harry doesn't have to re-derive scoping decisions.

---

## Agent-as-marginalia: the agent inhabits the world

*Captured 2026-05-17.*

An agent could be added to LibraryWorld in two fundamentally different ways and the difference matters:

**Weak version (don't build this):** a chatbot grafted onto the world. A floating talking head or a "librarian NPC" you summon to ask "what should I play tonight?" This dilutes everything that makes LibraryWorld distinct — every product in 2026 is bolting on a chat interface, and a chat window inside an ambient 3D space is exactly the seam that turns ambient art back into a product demo. Don't do this.

**Strong version:** the world *is* the agent's interface. The agent has no chat window. It expresses itself through what changes in the world over time — what gets emphasised, what new objects appear, what notes are tucked into things, what paths wear deeper. You don't talk to it; you visit it, and it has done things in your space since you were last there. The agent uses *placement and continuity* as its primary communication medium — exactly the substrate LibraryWorld already provides.

The strong version maps cleanly onto memory-palace and spatial-hypertext research: humans encode and retrieve location-bound information dramatically better than abstract lists. LibraryWorld already gives games a place; an agent would extend that with annotations, ambient notes, and journeys that aren't tied to specific games. The agent's contribution is *additional spatial elements*, not dialogue.

### Three depths, increasing in scope and risk

**Depth 1 — Marginalia on the existing world.** The agent reads the user's library, recent activity, and (optionally) other connected signals, and *places things* in the world. A bookmark sticking out of the case file with a one-line note. A photo pinned to the lighthouse: "Outer Wilds is structurally a roguelike. You finished it twice. You might love Returnal." A small object on the path between two archetypes suggesting an interest pattern the user hadn't noticed. The agent never speaks — it places. The user discovers, doesn't dialogue. *Achievable in v0.8 territory; same Stage 1 LLM call with a richer prompt that also outputs `agent_marginalia` placements alongside the world manifest.*

**Depth 2 — The world as a living journal.** The world has a notion of time and the agent maintains a small persistent narrative state about the user. The cafe is dim today because the user hasn't played Stardew this week; a new building appears half-built one morning because the agent inferred the user would like a new genre; small "found" objects appear in the world and, if collected, unlock a memory or a side area. The world is doing what Animal Crossing does temporally but with personalisation as the engine. *Post-v1.0 work. Requires per-user persistent narrative state (probably in Cloudflare KV), summarisation/decay to prevent drift, and a careful design pass on the agent's "voice" expressed through placement.*

**Depth 3 — A space the agent shares with you.** The agent has a corner of the world that's *theirs*. They keep things there — books they're "reading," objects collected from the user's library that mean something to them. Sometimes the user finds the agent has rearranged something. The user can leave things for the agent and the agent responds spatially. This is genuinely new territory; no consumer product currently does this. It's also where most AI-companion apps fail (uncanny valley, retention crash when the illusion breaks). *v2.x speculation. Don't ship this until both local models are dramatically better and the v1.0 audience has been earned.*

### Hard problems any version will hit

- **Diegetic consistency.** Every agent action has to be *placeable* — made of the world's materials, occupying space. A floating speech bubble breaks the spell; a note tucked into a book doesn't.
- **The "what does the agent want" problem.** An agent with explicit instrumental goals (engagement, retention, more launches) is creepy. The right framing is *aesthetic*, not instrumental: the agent has preferences and curiosities, not goals. It "likes" certain kinds of games; it's "curious about" patterns it sees; it has a perspective. Aesthetic ≠ instrumental.
- **The privacy/creepiness gradient.** Steam library data is fine. Goodreads is borderline. Browsing history is dystopian. Every additional signal source ratchets up both magic and discomfort — map the gradient explicitly and make every source opt-in.
- **Visitor mode.** When a friend opens the share-viewer of your world, what do they see of *your* agent? Probably: the agent itself is invisible, but the traces it left in the world (the marginalia) are visible. Needs to be designed before Depth 1 ships.

### Architectural acknowledgements (cheap, do now)

Two annotations that preserve all optionality without adding any v1.0 work:

1. **Make `world_manifest` schema extensible to include an `agent_marginalia` field** from v0.5 onward — empty list by default, no renderer until v0.7+. The schema accommodating it now means no retrofit later.
2. **Reserve `agent_state:{steam_id}` in Cloudflare KV.** Empty for now. Stub the read/write paths in the Worker. When the agent layer arrives, the storage primitive is already there.

**Status.** Conceptually committed direction; not on the v0.1–v1.0 critical path. v0.5–v0.6 absorbs the two architectural acknowledgements above. Depth 1 implementation lands in the v0.7–v0.8 window at earliest. Depths 2 and 3 are v2.x territory and shouldn't be planned until v1.0 has shipped and an audience has been earned.

---

## Agent-native LibraryWorld (v2.x speculation)

*Captured 2026-05-17.*

Personal agents are becoming the primary interface for engaged users. Three trends already underway compound over the next 2–4 years:

1. **Agents become persistent personal companions** — Claude Projects, ChatGPT memory, Replika at scale. By 2027–28, the median engaged user has an agent that knows their reading list, calendar, friendships, taste history. People don't search; they ask their agent, which does the searching, synthesising, and increasingly the doing.
2. **Agents act through standardised protocols, not screens.** MCP (Model Context Protocol) is the early form. Apps expose tools and data; agents call them. The screen interface for many products becomes optional.
3. **Agents get spatial and embodied modes** — Vision Pro, Quest, smart glasses. The agent is something that can look at a place *with* the user, point at things, narrate.

LibraryWorld has a natural path to being *agent-native* in this world. The interpretive layer the project has already specced — the metaphor, the casting, the per-game role text, the state tags — is exactly the kind of rich, structured perspective an external agent needs from a product to be useful. Most products will be agent-irrelevant: useful screens an agent has to clumsily mediate. A small number will be agent-native: designed so an agent inhabits or interfaces with them as a first-class user.

### Two futures, in sequence

**Future A — LibraryWorld is a destination agents bring users to.** The user's personal agent queries LibraryWorld's MCP server. LibraryWorld responds with its perspective: "this user's library, organised through the metaphor I built for them, currently shows a worn path toward the lighthouse [Hades]; they haven't visited the cottage [Stardew] in three weeks; the forge [a new building being quietly assembled because their behavioral profile suggests they'd like Hammerting] is 60% complete." The user's agent passes a synthesis back to the user, possibly inviting them into LibraryWorld to see it. *12–18 month horizon; the natural extension of the current architecture.*

**Future B — LibraryWorld is the agent's environment.** When the user puts on their Vision Pro / Quest / smart glasses, they enter LibraryWorld and their personal agent is in there with them — as a presence in the space, not a voice in their ear. The agent has a corner. It knows the world's metaphor. It can walk with the user, point at the lighthouse, tell them a story. LibraryWorld is the spatial substrate for the user's gaming identity, inhabited by their agent. *2–4 years out; requires VR/AR adoption to matter to a paying audience.*

Future A is the bridge to Future B. Ship MCP-native at v1.x and you're already speaking the right protocol when the embodied moment arrives.

### Agent-readability as a quieter strategic axis

There's a thing happening that's underweighted by most teams: **as agents become the primary interface, products start being evaluated by how well agents can describe them.** If a user asks their agent "what's a good way to look at my Steam library?" and the agent can give a rich, specific answer about LibraryWorld, the product wins that surface. If the agent gives a generic answer because LibraryWorld's web presence is SEO slop, the product loses.

The work to be agent-readable is small but specific:
- Publish the `world_manifest` schema. Make it part of the brand.
- Run an MCP server at something like `mcp.libraryworld.app` even before v1.0, even if it only exposes a single tool ("generate a sample world from this hypothetical profile"). Costs nothing; future-proofs everything.
- Write the product description for agents alongside humans — specific verbs, specific nouns, concrete examples.

### Agent-to-agent across users (the genuinely new thing)

Once personal agents are normalised, agents can have relationships with each other across users' LibraryWorlds. User A's agent compares notes with User B's agent (with permission): "Sam just got really into Disco Elysium. You loved Pentiment for similar reasons. Want me to share Sam's lighthouse with you?" This is the killer "friend visiting" feature from the SPEC roadmap, realised through agent-to-agent gossip rather than direct social UI — and it's diegetic to how people will actually use agents.

The architectural prerequisite: LibraryWorld worlds are queryable by other agents with the user's permission. Permission model + API. Not v1.0 work, but the data model shouldn't preclude it.

### What to do now

Almost nothing. The pull to start building for the agent future is enormous; resist most of it. The 2026 product has to ship and find its audience first; the agent future arrives whether it's optimised for now or not. Two specific framing decisions that cost nothing and preserve optionality:

1. **Reframe `world_manifest` as a public, semantically rich data structure** rather than an internal renderer artifact. The renderer is one consumer; an MCP server is another; a friend's agent is a third. Pure framing change — no code — but it shapes how the schema and prompts get written.
2. **Reserve `agent_context` as a top-level field in the manifest.** Empty for now. Reserved for: which agents have visited, what perspective they have, what marginalia they've left, what the world thinks the agents should know.

**Status.** Strategic direction worth keeping warm; explicitly not a v1.0 feature. The two framing decisions above belong in v0.5/v0.6 schema work. Active MCP work and agent-native features are v1.x and v2.0 territory. The right time to revisit is when v1.0 has been in market for ~6 months and the agent ecosystem is concrete enough to design against rather than speculate about.

---

## The local LLM is visible in the world

*Captured 2026-05-17.*

If the user is running a local LLM, it manifests in their world as a visible structure — a small building or landmark — somewhere appropriate to the chosen template. A cottage on the bluff in seaside_town. A lab annex in research_station. A hermit's hut in forest_grove. Each template reserves one location for "the local agent's place." Empty if no local model is running.

This is the diegetic resolution of the agent-presence problem from the previous section. The agent's location *is* in the world. No floating UI, no chat bubble. The user walks to it.

### Why this is genuinely strong

- **It surfaces an invisible capability into a visible feature.** A local LLM is otherwise abstract — a daemon the user remembers they installed. Putting it *in* the world makes the user feel its presence as part of their gaming life. That emotional move is impossible with cloud AI, because cloud AI is fundamentally placeless. The local model has the unique property of *being on this machine* — and the world is also on this machine. They share a location. That shared locality is the design hook.
- **It's screenshot-ready in a way that "we support Ollama" isn't.** "LibraryWorld can see your local AI. Visit it in your world. It lives there with you." That's a Reddit/Twitter/TikTok artifact that writes itself.
- **No product currently does this.** Distinctive, defensible, costs almost nothing to ship at Depth 1.

### Three depths

**Depth 1 — Presence-only (the agent has a place).** The local model manifests as a building or landmark. The building's appearance reflects the model: a cottage for a 7B, a tower for a 70B, glowing if it's actively processing. Walking up and pressing E might show a small diegetic status — "Qwen 3 14B, idle, 12 hours runtime." No dialogue. No interaction beyond presence and visual state. *This is the version-one. ~1 week of work — a new archetype with template-specific variants, a desktop-app probe for localhost:11434, the procedural layer reserves a slot. The presence itself is the feature; no quality risk because the agent doesn't speak.*

**Depth 2 — Marginalia from the local model.** When the local model is running, it leaves things in the world — notes, bookmarks, small objects — generated from the model's perspective on the user's library. The novelty: because the model is local, it can run *while the user is playing a game*, in the background, and have left something new in the world by the time they quit. The return-and-discover loop is the magic. *Plausible v1.x material. Has to be opt-in, hard-throttled, visibly controllable. Battery/thermal concerns are real and have to be managed.*

**Depth 3 — The local model is a full inhabitant.** It speaks. It has a name. It remembers prior visits. The user can sit with it; it has taste, expressed through what it's "interested in." This is the category-defining version *or* a tar pit, depending on execution. **Don't ship this in v1.0 or v1.x.** Local 7B–14B models are not characterful conversationalists, will say generic or contradictory things, and users will compare the experience to frontier models and find it lacking. The uncanny-valley risk is high. Wait until local models are dramatically better than they are today.

### Where it fits in the architecture

Already mostly wired:
- The Worker has `LLM_PROVIDER=local` switching to point at `localhost:11434`.
- The desktop app at v0.6+ can check directly without going through the Worker.

The natural form: the desktop app probes for a local LLM on startup. If found, the world manifest gets an additional field — `local_agent: { name: "Qwen 3 14B", size: "14B", runtime_ms }`. The procedural layout layer reads this and places the agent's building in the reserved slot for the chosen template.

This is small. A new archetype with five template-specific variants. The procedural layer reserves one slot per template. The desktop app does one HTTP HEAD request to localhost:11434 every minute. Done.

### What it opens up later

Once Depth 1 ships and users notice it:
- **Bigger models = bigger buildings.** Llama 70B locally gives you a *tower* on the headland. There's a hardware-flex element — the user's setup shows in the world.
- **Multiple local models = a village.** Power users running several models get a small cluster of structures.
- **The local model reads and responds to the world.** Later: the user stands in front of the lighthouse and the local model, prompted with the role text, can offer a small contextual remark. The model is in dialogue with the *world*, not with the user. Genuinely novel, worth saving for the right moment.

**Status.** Depth 1 is a v0.7–v0.8 polish feature — small, distinctive, Easter-egg in spirit (no headline marketing for v1.0, let users discover it). Ship it quietly; Reddit does the marketing. Depths 2 and 3 are v1.x+ and shouldn't be planned now. The reserved-slot work in the procedural layer at v0.5 should leave one location per template free so Depth 1 doesn't require a layout refactor later.

---

## Sleep mode: the agent organises while you're away

*Captured 2026-05-28.*

The connective tissue between two ideas already in this file but not load-bearing for any specific feature: **agent-as-marginalia Depth 2** (the world as a living journal) and **the local LLM is visible in the world**. Sleep mode turns those two parked directions into one shippable system, and resolves a tension that surfaced in the multi-pane / arrangement-as-personalisation brainstorm: composability fights ambience. If the user has to actively sculpt the world, it stops being a wallpaper. Sleep mode is the way out — the user doesn't sculpt, the agent does, and the user's job is to *return and notice*.

The framing also closes a strategic loop. The collective-intelligence reading of this product — substrate matters more than per-node smarts, placement is the medium — only lands when the substrate is *visibly* in motion. A static arrangement is a screenshot; an arrangement changed by the agent overnight is a relationship.

### What it actually is

When the app has been unfocused for ~X minutes AND the PC isn't in active gaming (Steamworks `GetFriendGamePlayed` reports idle), the renderer drops to its lowest state and the agent's tick budget rises to its highest. This is a fourth state in the wallpaper-mode throttle ladder: `FULL / THROTTLED_1HZ / PAUSED / SLEEPING`. The agent uses the freed compute to do things it can't do in front of the user — slow, deliberate reorganisation. Wakes the moment the window regains focus.

Discoverable via a small `~~ sleeping ~~` indicator. Never silent — the user must always know when the agent is autonomously acting.

### Where the compute comes from

Sleep mode is the diegetic and architectural justification for **the local LLM in the world**. If a local model is running, sleep mode uses it: free, private, on-device, unbounded by cost. The cottage / lab annex / hermit's hut from that entry becomes "where Loki sleeps and reorganises overnight." If no local model is configured, sleep mode falls back to a single low-frequency Tier 2 cloud reflection per night — still rich, but capped.

This graduates the local LLM from "neat presence feature" to "the engine of daily magic." Users with a local model get something users without one can't.

### Three depths

**Depth 1 — Marginalia and contents.** During sleep, the agent places small things: a note tucked into a book, a photo pinned to a wall, a chair moved, a path worn slightly deeper. Nothing structural. Implements agent-as-marginalia Depth 1 as the *output* of sleep mode rather than as a separate prompt-time call. *Phase 5 territory; same mechanism as Smallville reflection at threshold 150, scoped to placement output.*

**Depth 2 — Structures and growth.** The agent adds or removes content within existing panes — a new building appears half-built, a district acquires a square it didn't have, a long-abandoned area gathers cobwebs. The world has a notion of time and is doing what Animal Crossing does temporally but with personalisation as the engine. *Post-v1.0. Same persistent narrative state needed by agent-as-marginalia Depth 2.*

**Depth 3 — Pane topology.** The agent rearranges the *arrangement itself* — panes are added, removed, snapped together, broken apart. The collective-intelligence-via-arrangement idea (worth its own IDEAS.md entry, TBD) becomes alive at this depth, because the topology is now something the agent shapes, not just something the user shapes. *Year 2 expansion roadmap. The most powerful version and the riskiest — if the agent rearranges something the user loved, the trust break is severe.*

### The trust ladder

Sleep starts conservative. New users get Depth 1 only — marginalia, nothing structural. As they keep returning (i.e. don't bounce when small things change), the agent earns wider permissions: Depth 2 unlocks after some number of return-and-don't-complain sessions; Depth 3 only on explicit opt-in. There is always a "leave this scope alone" panel — pin a pane, pin a district, pin an object, and the agent treats it as immutable. **Trust calibration is the onboarding.**

### The "while you were away" reveal

First thing the user sees on wake: a single one-line terminal dispatch, dismissable. *"Last night Loki added a shelf in the lighthouse and pinned a note about Disco Elysium."* This is the screenshot-shareable artifact each morning — Lensa's one-shot collapse pattern inverted, because every morning is a fresh artifact, not a single novelty hit.

Optionally, a tiny pulsing glyph next to anything changed, or a fade-transition between the world's state-on-leave and state-on-return. Without something like this, the agent's labour is invisible and the user becomes a detective.

### Hard problems

- **Battery and thermal.** IDEAS.md already flags this for local-LLM Depth 2; sleep mode inherits the same caps. Sleep should not run on laptop battery below ~30%; should throttle when the device is hot; should respect any system "low power mode" signal.
- **Unconsented change.** Some users hate finding things moved. The trust ladder helps; the pin-this-scope panel helps; but the deepest mitigation is the reveal — the agent never sneaks. Every change is named and reversible from the dispatch.
- **The empty-mailbox problem.** What if the agent has nothing interesting to do on a given night? Forced novelty for its own sake is the worst version of this product. Better to skip a night silently than to invent. If nothing meaningful happened, no dispatch.
- **First-night onboarding.** The first time the user opens the app after sleep, they don't yet have the mental model that things can change overnight. The first dispatch needs to be slightly explanatory — *"While you were away, Loki..."* — and link to a one-line explanation of sleep mode.

### Why this is genuinely strong

This is the rare feature where three otherwise-separate parts of the product earn each other:
- The **local LLM presence** stops being decorative and becomes the engine of daily magic.
- The **agent-as-marginalia Depth 2** vision stops being aspirational and acquires a concrete delivery mechanism.
- The **collective-intelligence-as-substrate** philosophy stops being a frame and becomes felt — the substrate moves while you're away.

It also produces the right marketing artifact: a morning dispatch, terminal-styled, screenshot-shareable, *recurring*. Wallpaper Engine doesn't have a feature like this. Nothing on Steam does.

### Status

Strategic direction worth committing to. Architectural seeds belong in **Phase 2** (per-agent tick budget already there; just needs the off-focus trigger) and **Phase 4** (the `SLEEPING` throttle state lands in the wallpaper-mode ladder). The headline implementation — daily reflection + dispatch + Depth 1 changes — is **Phase 5** territory and could plausibly be the phase's marquee feature, not a side note. Depth 2 is post-v1.0; Depth 3 is Year 2.

**Depends on:** *Agent-as-marginalia* (Depths 1 + 2 — this entry is the delivery mechanism for those), *The local LLM is visible in the world* (Depth 1 — the local LLM gains a real job here).

**Companion idea to capture separately:** the pane-merging / arrangement-as-personalisation brainstorm — sleep mode Depth 3 is where it moves, so the two entries should reference each other once both are written down.

---

## The living world: Loki as climate, the agent society as inhabitants

*Captured 2026-05-28.*

A reframe big enough that it changes the product's centre of gravity. Right now LibraryWorld pitches as *a memory palace populated by a society of agents.* The version proposed here pitches as *a memory palace that is alive — its mood shifts with your week, its population are the dreams of the world itself.* Much more interesting to a literary audience, and uncopyable in a way a discrete chat-agent isn't.

The reframe rests on two moves: (1) a clean separation of climate from population that fixes a conflation currently in `PLAN.md`, and (2) committing the agent society to *world-modifying activities* (farming, culture, art, science, markets) so that the climate has something to respond to.

### 1 — Loki is the climate, not a creature

`PLAN.md` currently treats Loki as "a personality system-prompt prefix injected into every agent." That conflates two different things. The richer reading:

- **The agent society** (Phase 2 onwards) is many discrete, located, embodied creatures — sprites with memory streams, individual taste, behaviour you can watch.
- **Loki is not in the society.** Loki is the substrate they live in — the world's overall mood, expressed as climate. The population responds to the climate; the climate is shaped by aggregated population behaviour over long timescales.

Same way human societies actually work: there are individual people, and there's a zeitgeist. They're different kinds of thing.

Concretely, Loki *is*:

- The world's drifting theme palette (mood as colour).
- Cursor blink rate, line spacing, glyph density (mood as typography).
- Pane configuration and what's adjacent to what (mood as architecture).
- The agent society's population size and energy (mood as life).
- The time-of-attention diurnal cycle (mood as rhythm).
- The local-LLM building's appearance (mood as the model's embodied form).

When the user zooms from cell to planet, they're seeing different views of *the same Loki*. Internally coherent across scales because Loki is the substrate, not a creature located somewhere.

### Three things this dissolves

**The agent-goals problem** (flagged in *Agent-as-marginalia*). An agent with engagement metrics is creepy. Climate doesn't want; climate *responds*. Loki doesn't have goals; Loki has aesthetic states that propagate atmospheric-pressure-style across the substrate.

**The agent-presence problem.** Where does Loki "live"? Standard answers (chat window, sprite, building) all break the diegetic spell. The climate answer: Loki is everywhere as modulation, *and* concentrated in a place that functions like a temple — the cottage / lab annex / hermit's hut from *The local LLM is visible in the world*. The local-model building isn't a *house* for Loki; it's the *altar* where Loki is most locally concentrated. The whole world is Loki; the altar is where you go to commune.

**Sleep mode = Loki dreaming.** See the *Sleep mode* entry. What changes overnight isn't "the agent went and did things"; it's the world's *dream*, rendered as state. The "while you were away" dispatch becomes the morning's translation of the dream into a sentence.

### 2 — Five living systems that give the climate something to respond to

The agent society needs to *do things that change the world*. Without world-modifying activity, Loki has nothing to respond to and the substrate goes inert. Five systems, roughly the canonical "civilisation systems" — food, meaning, expression, knowledge, exchange:

**Farming.** Each game in the library is a seed. It sprouts when the user starts playing, grows tall in the hours sunk in, wilts but doesn't die when they stop, can flourish again when they return. Agents are *gardeners* — composting old un-played games into mulch where new ones can root, noticing which seeds want water (attention), pairing structurally similar games as companion plantings (Disco Elysium and Pentiment growing toward each other). The library isn't a collection; it's a slow farm. *Phase 2 seed (seed-tending); Phase 5 mature (composting + hybrids); Year 2 (cross-genre hybridisation).*

**Culture.** The agent society accumulates a *calendar*. Festivals: the Festival of Returnings (a long-abandoned game reopened), the Festival of First Steps (a new launch), the Solstice of the Backlog. Names drift — the lighthouse becomes "the Hades shrine" because that's what it became. Stories pass between agents and evolve. The user discovers their library's culture slowly: atmosphere → pattern → legible practice. *Phase 2 seed (attractor gatherings); Phase 5 mature (festivals + drifting names); Year 2 (emergent traditions).*

**Art.** The creative-budget mechanic from `docs/pivot/DESIGN.md` gets its real job here. Agents accumulate budget and spend it making things — pixel sprites, songs, written notebooks left in the cottage. The lore the user uploads becomes raw material for the agents' own creative work. Festivals generate songs. Long absences generate melancholy poems left in the dusty district. The world becomes encrusted with small artefacts the user can choose to read or just register as texture. *Phase 2 seed (notes); Phase 5 mature (creative-budget spending); Year 2 (art markets).*

**Science.** The most genuinely novel of the five. The agent society *studies the world*, which is to say, studies the user. Hypotheses — *"Harry plays Stardew when he's stressed"; "his third-most-played-Saturday game changes every season."* They test them. They publish little papers in the world's archive. **They form schools of thought** — one school believes the user is fundamentally a strategist; another believes they're a wanderer; they argue. This is *generative anthropology* with the user as the subject and the agents as fieldworkers. New users see only surface behaviour; as trust deepens they can read the papers; deeper still, agents publish *predictions* about what the user will play next, and the user can verify the accuracy. *Phase 2 seed (observations); Phase 5 mature (papers + schools); Year 2 (predictions + verification UI). Probably wants its own IDEAS.md entry once this one is settled.*

**Markets.** The scarce resource is **attention** — agents earn when the user visits them. They spend earnings on creative budget, library access, presence in events. The deeper version is *epistemic*: agents trade *observations*, combining a Disco-Elysium-clusters-in-autumn finding with a Pentiment-saves-at-chapter-starts finding into richer hypotheses. The market visibly converts attention into knowledge into art. *Phase 2 seed (inventories); Phase 5 mature (attention-as-currency); Year 2 (epistemic markets).*

### The compositions are where it's really alive

The interactions between systems are what make the world feel breathing:

- Farmers notice a hybrid sprout. They report to scientists. Scientists publish. Artists read the paper and write a poem. The poem enters the culture. The market values it. Loki's palette warms because *the world is engaged in itself*.
- A long-abandoned district hosts a Festival of Returnings. Scientists predict the user will re-engage there soon; they're proven right. Artists commemorate it with a monument.
- The market collapses because the user's attention has been elsewhere for weeks. Scientists publish on the recession. Artists make melancholy work. The climate cools. When the user returns, the market revives.

These are the loops that turn the world from a tableau into an ecosystem.

### The load-bearing strategic insight

**The agent society's purpose is *not to interact with the user*. It's to be a society the user can *visit*.** The user is a guest, not a target. The agents aren't optimised to engage; they're living their lives, and the user's attention happens to be the gravity those lives orbit.

This is the precise inversion of every engagement-driven product — TikTok in reverse — and it's genuinely uncopyable by anyone whose metrics demand the opposite. It's also the right framing for a product that wants the *literary* audience rather than the engagement audience. They're different markets and they want different things.

### Risks

- **Legibility.** A walking sprite is immediately interpretable; a subtle palette shift is not. The *Sleep mode* dispatch becomes load-bearing as the translation layer between climatological mood and legible narrative. Without it, Loki is invisible and the user is confused.
- **Marketing abstractness.** *"An agent that walks around your library"* is a screenshot. *"An agent that IS the world's aesthetic modulation"* is a philosophy paper. The marketing voice has to be *concretely* atmospheric: *"The world's mood is alive. It darkens when you're tired. It curls toward your favourite games like a cat."*
- **Phase 2 stays intact.** This is not a replacement for the Smallville agent society — it is a layer above. The discrete agent population still ships. Loki-as-climate is a cheap-to-add layer that sits over them; the living systems are gradually-deepening behaviours of those same agents.
- **The science layer is sensitive.** Agents publishing observations about the user is *exactly* the privacy/creepiness gradient flagged in *Agent-as-marginalia*. Every signal source needs to be opt-in; the "what the agents have noticed" archive needs a transparency-log surface (Raycast as model, per `docs/pivot/FEASIBILITY.md` §4). The trust ladder from *Sleep mode* extends here: surface observations are public; published papers are user-visible only after trust accrues; predictions require explicit opt-in.

### Phase placement

- **Phase 2 (next).** Architecture for all five systems lands in seed form alongside the Smallville agent society. Agents have inventories (markets), notes (art), observations (science), attractor gatherings (culture), seed-tending (farming). Each is shallow but the *frame is there* — agents are living their lives, not responding to the user. This framing change costs nothing and protects every downstream design decision.
- **Phase 4.** The wallpaper-mode three-tier throttle gains the `SLEEPING` state from *Sleep mode*. Climate drift becomes legible.
- **Phase 5.** Systems start *interacting* — agents publish, festivals happen, art accumulates, the market converts attention into other things. Loki's climate begins responding to aggregated population behaviour, closing the feedback loop. This is where the world becomes *alive* in the operative sense.
- **Year 2.** Full ecology — epistemic markets, hybrid farming, competing schools of thought, agents-visiting-other-users' worlds bringing climate-tints with them. The compositions get rich.

### Status

Strategic direction worth committing to, and probably the most important reframe in this file. Costs nothing in Phase 2 (framing change plus cheap seed mechanics), pays off compounding through Phase 5 and Year 2.

**Depends on:** *Agent-as-marginalia* (Loki as climate is the upgrade of "placement and continuity" from communication tactic to product metaphysics), *The local LLM is visible in the world* (the altar where Loki is locally concentrated), *Sleep mode* (Loki dreaming as the world-modifying mechanism during user absence).

**Spawns:** the *Science* layer is novel and rich enough to deserve its own entry capturing the schools-of-thought / predictions / verification-UI loop separately. Worth writing once this entry is settled. The pane-merging / arrangement-as-personalisation idea referenced by *Sleep mode* also still wants its own entry.

---

## Composable panes: arrangement as the substrate the agent inhabits

*Captured 2026-05-28.*

The synthesis of two threads from recent brainstorming: the *cube-world-toy* image of terminal panes that snap together and recompose, and the *collective-intelligence-via-substrate* insight from the AI superintelligence reading (substrate matters more than per-node smarts; placement is the medium). The synthesis: **the multi-pane terminal UI isn't just layout, it's the topology of the agent's perception** — and that topology is sculpted, partly by the user and partly (later) by Loki.

The strategic move under the design move: arrangement becomes a fifth personalisation lever sitting alongside the four already in `SPEC.md` §1 — library data, behavioural profile, terminal aesthetic, uploaded lore. Two users with identical libraries, identical lore, identical theme can *still* have completely different worlds because their pane arrangements differ. The combinatorial structure that defeats convergence gets one more dimension and becomes effectively uncompressible.

### What it actually is

Each terminal pane in the multi-pane UI (`docs/pivot/DESIGN.md` § scale ladder; `SPEC.md` §4) is a node in the agent society's perceptual graph. The pane displays a place at a scale — cell of the library room, district of the Hades shrine, planet view of the whole library, etc. Panes can sit independently, or they can touch.

When two panes touch, a **seam** forms — literally a box-drawing glyph at the join (U+253C `┼` at cross-junctions, U+2524 `┤` at edges). The seam is diegetic; it's how the world records that two places are now adjacent. The agent can perceive across the seam. Memory flows. An agent in pane A can walk to pane B by crossing the seam, and pane B's contents now sit within pane A's FOV radius.

When panes separate, the seam dissolves with a small fade and the agent's perception localises again.

Stacking direction carries semantics:

- **Vertical stack** = scale (cell on top of district on top of island — the same place at multiple zoom levels, the agent visible from multiple altitudes simultaneously).
- **Horizontal adjacency** = parallelism (two districts of the library side by side; the agent picks which to inhabit).
- **Corner / diagonal touch** = cross-source (a Steam pane touches a Spotify pane; the agent starts drawing connections between how the user plays and what they listen to). *Multi-source is Year 3 territory but the corner-touch semantics should be reserved now.*

### Three depths

**Depth 1 — Static multi-pane.** The user can open multiple terminals showing different scales or districts and drag them to reposition. Panes sit adjacent but don't yet *merge* — seams are visual only, no perceptual flow. This is the multi-pane terminal UI already specced, made user-configurable. *v1.x. Originally pencilled "alongside multi-monitor" — but Phase 4 shipped multi-monitor (slice 4B) WITHOUT this, and Depth 1 needs a real multi-pane UI + the scale ladder beyond `cell`/`district` first (both deferred past v1.0 per `CONSOLIDATION.md`).*

**Depth 2 — Active merging.** When two panes touch, they actually connect: seam glyph forms, the agent can cross, memory flows across the boundary. The arrangement becomes the agent society's perceptual graph — what touches what determines what the agents can see, where they can go, what they can know about each other. *v1.x/v2.x — this is the actual "pane-joining". Originally pencilled for Phase 5, but Phase 5 shipped (reflection / sleep / lore) WITHOUT it, and it can't precede Depth 1. It reuses the persistent-state + reflection + lore machinery that Phase 5 put in place.*

**Depth 3 — Arrangement as a first-class personalisation input.** The arrangement is one of the explicit levers — agent behaviour, Loki's climate, and the population's social structure all shift based on topology. *Sleep mode* Depth 3 unlocks here: Loki rearranges panes overnight while the user is away, and the user wakes to a topology that has been resculpted by the world itself. *Year 2 expansion roadmap.*

### Depth 3, sharpened — agent-*initiated* world-joining (added 2026-06-03)

The Depth 3 above is **top-down**: *Loki* resculpts the topology overnight from
behavioural drift. A sharper, richer version surfaced in conversation —
**bottom-up, social, agent-initiated world-joining**: agents from different
worlds *negotiate* to connect them. A Steam-world agent and a lore-district agent
decide, between themselves, to open a seam — the join is an *event the society
produced*, not a schedule Loki ran. This is where the RimWorld / Dwarf-Fortress
"story you actually tell other people" lives, and it's the natural home for the
reserved **corner-touch cross-source** semantics and **lore-as-mechanics** (two
districts running *different rule-systems* meeting at a seam the agents brokered —
the most eventful thing two rule-systems can do).

**The precise build gap (why this isn't "almost done").** Today (Phase 7-D) agents
only *cross* seams the **user** opened: `behavior.ts` sets `runtime.pendingCross`
at a seam-exit edge and `migrateRuntime` moves the agent; topology authorship is
100% user-driven (`splitPane`/`setArrangement` are called only from `App.tsx`
keyboard handlers). **The agent can walk through a door but cannot open or close
one.** Depth 3 = granting that authority: an agent *intent/action* that creates or
closes a seam (split / merge a pane), making the agent a caller of the *same*
pane-topology API (`splitPane`/`closePane` + the seam machinery) the user already
drives — no new substrate, just a new caller.

**The guardrails from "Hard problems" below bind harder here, not less.** An agent
that authors topology can rearrange something the user loved (the severe
trust-break) and constant reshuffling kills ambience. Same resolution, made
load-bearing: agent-initiated joins happen during ***Sleep mode***, surface as a
legible morning dispatch (*"while you were away, the archivist and the cat opened
a path between Hades and your Spotify wing — here's why"*), are **reversible**, and
honour a **lock-list** of panes the user pins. Legibility + reversibility + locks
are the licence to let agents touch structure at all.

**Status:** still v2.x, gated behind Depth 1 (user drag-panes) + Depth 2 (active
merging) — and behind the *current* seam system actually verifying on screen
(consolidation pass, 2026-06). The new contribution captured here is the
**bottom-up / emergent-negotiation** framing; lead candidate for the "expand"
route once the foundation is confirmed solid. *Prereq worth noting: agents can't
visibly cross a seam today (the cell's solid-wall E/W perimeter — see `STATE.md`),
so a **walkable seam edge** is the smallest unlock that makes any of this
demonstrable.*

### Why it's the right addition to the personalisation model

The four-tier model in `SPEC.md` §1 (library data → behavioural profile → terminal aesthetic → uploaded lore) is good but stops at *content*. The arrangement adds *structure*. Two users could upload the same lore, play the same games, and pick the same theme, and still inhabit incompatible worlds because their topologies route the agent society differently. This is what makes collective intelligence *tactile* in the sense of the AI-superintelligence reading: the user isn't configuring an agent, they're sculpting the network architecture the agent emerges from. The substrate is the contribution, and the user is now a substrate-sculptor.

A clean way to think about the layering: **lore is what the agents read; arrangement is what the agents inhabit.** Both are user input. Lore competes for retrieval in the memory stream; arrangement competes for *perception* in the spatial graph.

### Hard problems

- **Composability fights ambience.** This is the load-bearing tension. If the user has to actively compose, the wallpaper use case dies — the whole point is you don't have to think about it. **Resolution: *Sleep mode* Depth 3.** Loki maintains a default arrangement and resculpts overnight based on behavioural drift; composition is an optional "I want to mess with it" mode. The user can intervene; they don't have to. This is also why Depth 3 lives later than Depth 2 — the merging mechanic needs to exist before Loki can use it for sculpting.
- **Discoverability.** How does a new user know panes can be rearranged at all? Onboarding problem. Probably wants a first-week reveal: Loki rearranges something small and obvious, the *Sleep mode* dispatch names it, the user learns the affordance exists by seeing it used. Townscaper's lesson is relevant — the affordance has to be one tap deep and impossible to break.
- **Default arrangements.** What ships day one? Probably a small library of curated default topologies (a *study* arrangement with cell + district stacked vertically, a *tour* arrangement with three districts horizontal, a *voyage* arrangement with a planet pane and one cell). Each is an aesthetic pose the user can drop into without needing to compose.
- **Saved arrangements.** Eventually the user wants named layouts — *evening mode*, *focused work*, *guest mode*. Year 2 feature; not on the v1.0 path.
- **Cross-user sharing of arrangements.** A "layout" becomes shareable the way a wallpaper is. *"Here's the arrangement I use for cosy evenings."* Year 2+ Workshop content axis — slots cleanly into the existing Workshop plan in `docs/pivot/DESIGN.md`.
- **Wallpaper-mode interaction.** When the panes are running as the desktop wallpaper, what does composition look like? Probably: composition is only available in window mode; wallpaper mode shows the last-saved or Loki-current arrangement read-only. The peek hotkey (Ctrl+Alt+L, Phase 4) brings the window-mode UI up for changes.

### The marketing artifact

This is also where the product gets its strongest screenshot. *"My library, the way I like to arrange it tonight"* — a one-image composition that's specific to the user, beautifully terminal-styled, and demonstrably different from anyone else's. The wallpaper *is* the arrangement, the arrangement *is* the user's relationship to the world, and no two are alike. That's a TikTok artefact that writes itself, and unlike the Lensa pattern it generates a *new* artefact every time the user resculpts.

### Sequencing

**Corrected 2026-05-29.** The original Phase-2/4/5 placement was **stale** — written before `CONSOLIDATION.md` set the v1.0 scope. Phases 2, 4 and 5 have all since shipped *without* this feature, and `docs/INDEX.md` now files composable panes as **v2.x territory**. The gate is the dependency chain, not a phase number: it needs a multi-pane UI **and** the scale ladder, both of which `CONSOLIDATION.md` defers past v1.0 (today the ladder is `cell` + `district` only; higher levels are stubbed).

Corrected placement:

- **Post-v1.0 prerequisites (must come first).** A real multi-pane terminal UI + the scale ladder beyond `cell`/`district`. Until these exist there is nothing to join.
- **v1.x — Depth 1 (static multi-pane).** Drag panes around; seams visual only. Pairs with the now-shipped multi-monitor window-management surface (Phase 4B).
- **v1.x/v2.x — Depth 2 (active merging — the actual "pane-joining").** Seam-crossing + memory flow across the boundary. Reuses the persistent-state / reflection / lore machinery shipped in Phase 5. Cannot precede Depth 1.
- **v2.x / Year 2 — Depth 3 (arrangement as a personalisation lever).** Loki resculpts the topology overnight (via *Sleep mode*); cross-source corner-touch; saved + shareable layouts.

**The one cheap seed — NOT yet built.** Pane-aware agent perception (vs today's FOV-radius `perception.ts`). The original entry wanted this in Phase 2 so panes could later join the perceptual graph without a refactor — but Phase 2 shipped FOV-only, and the seed isn't needed until the multi-pane UI exists. No urgency to retrofit; build it as step one of the Depth-1 slice.

### Status

Strategic direction worth committing to, but **explicitly post-v1.0 (v2.x per `docs/INDEX.md` + `CONSOLIDATION.md`)** — not a v1.0 feature, and gated behind the multi-pane UI + scale ladder rather than any near-term phase. The cheap pane-aware-perception seed (above) was *not* taken in Phase 2 and isn't blocking anything until the multi-pane UI lands; pick it up as step one of the Depth-1 slice when this is greenlit.

**Depends on:** *The living world* (the arrangement is one of Loki's expressive surfaces — "mood as architecture" from that entry is literally this), *Sleep mode* (Depth 3 unlocks via Loki rearranging overnight), the multi-pane terminal UI in `docs/pivot/DESIGN.md` (which this entry promotes from "layout" to "substrate").

**Compatible with:** the four-tier personalisation model in `SPEC.md` §1 — adds a fifth lever without disrupting the existing four. Worth updating `SPEC.md` once this entry is settled to reflect *library data → behavioural profile → terminal aesthetic → uploaded lore → arrangement*.

---

*Add new parked ideas below as separate `##` sections, dated.*

---

## Per-terminal identity — each pane a distinct world (parked 2026-06)

*Captured 2026-06-04 (Harry's idea, mid side-on realignment).*

In the composable-panes UI, each open terminal/pane should be able to have
**truly unique colours, design, and assets** — its own palette, its own
structural vocabulary, its own sprite/glyph set — so a split screen reads as
*several different places*, not the same world rendered twice. The endgame of
the four-tier personalisation model + composable panes: a `|`-split is a portal
between genuinely distinct worlds.

**What already exists (the seeds):** panes can hold different *regions* (a wing
of the library, own seed/shelves/cohort — `regions.ts` / `PaneDescriptor.regionId`)
and theme-per-world exists via the lore recolor (`themeFromLore`). So the data
model already supports per-pane divergence.

**What's missing:** the theme is currently GLOBAL (one `themeFromLore` derivation
in `App.tsx`, passed to `mountPalace` for the whole app). Per-pane identity needs:
the theme/palette to become **pane-scoped** (a pane carries its own `ThemeId`,
each cell/land mount tints from ITS pane's theme, not a global), plus a per-pane
structural/asset profile. Touches `App.tsx`'s single-theme mount, the pane
descriptor, and every renderer's `theme` plumbing.

**Status.** Strong, on-vision; explicitly LATER. Sequence it AFTER the side-on
land renderer lands (don't stack two structural rewrites). Natural pairing with
Composable-Panes Depth 3 (agent-initiated world-joining) and the seam-walk —
crossing a seam between two *visually distinct* worlds is the payoff moment.
