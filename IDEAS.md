---
up: "[[Lokilibrary]]"
---

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

*Update 2026-08-01:* Depth 1 is SHIPPED on both surfaces — the palace (Phase 5A reflection-driven marks) and the terminals desk (marginalia-on-land, eyeball passed 2026-08-01). Depths 2–3 stay parked; the depth-track queue in `PLAN.md` owns sequencing.

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

*Update 2026-08-01:* Depth 1 CODE SHIPPED as slice 6A (landmark + press-E status panel, smoke-locked; STATE.md § Local model presence) but never verified live — this Mac can't host Ollama (parked in `TODO-USER.md`), and the production path (Electron main-process probe; a deployed Worker can't reach `localhost:11434`) is documented, not built. Depths 2–3 unchanged.

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

*Update 2026-08-01:* Depth 1 SHIPPED as Phase 5 slice 5B (the `SLEEPING` throttle state + morning dispatch; retro `RETROS/phase-5B.md`). Depths 2–3 unchanged.

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

## Per-scale perspective: top-down interior, side-on exterior

*Captured 2026-06-03.*

A camera-angle decision the scale ladder has never actually pinned down. `SPEC.md`
§4 gives each level its own *rendering vocabulary* but never its *projection*, and
the implementation quietly drifted top-down everywhere: the `cell` is an overhead
room, and the `island`/`continent` renderers (Phase 7A) draw overhead map
silhouettes. Meanwhile the headline aesthetic is stated as **"a 2D side-on pixel
world"** (`docs/pivot/DESIGN.md` + `CONSOLIDATION.md`, opening line). So *side-on is
currently realised nowhere* — a real inconsistency between the stated vibe and the
built renderers.

**The proposal:** keep the `cell` **top-down** (it's an *interior* — a library room;
overhead reads as "you're inside it"), and flip to **side-on, Terraria-style** the
moment you leave it for the *exterior* landscape levels. Interior-top-down /
exterior-side-on is a coherent, established split, not a novelty.

### Why it's the right shape, not just a style whim

- **It makes the seam metaphor literal.** Under *Composable panes*, panes snap and
  agents cross seams. In a side-on world a **horizontal seam = walk across into the
  next biome** (exactly Terraria's biome adjacency) and a **vertical stack =
  surface→underground strata** (also Terraria). Top-down panes snapping is abstract;
  side-on panes snapping is physical. The *cube-world-toy* image gets a body.
- **The perspective flip *is* the boundary moment the design already wants.**
  `DESIGN.md`: *"Transition across a boundary is its own visual moment."* Leaving the
  top-down room and watching the world tilt to side-on IS that beat, rendered as a
  camera move rather than just a palette change.

### The nuance: it's not a global flip, it's three projection bands

A planet can't be side-on. The honest mapping is a gradient, not a switch:

- **`cell`** — top-down **interior** (the room you inhabit).
- **`district` / `island`** — **side-on landscape** (the Terraria band — walkable
  exterior, biome seams, surface/underground).
- **`continent` / `planet` / `solar_system`** — back to **map / orbital** (you zoom
  out far enough that side-on stops making sense and aggregate/overhead returns).

So the ladder reads: *inhabit (top-down) → traverse (side-on) → survey (orbital)*.
Each transition between bands is a "boundary moment."

### Cost / open questions

- The Phase 7A `island`/`continent` renderers + the 7D seam-walk assume a roughly
  top-down/map projection. Adopting the side-on band rethinks the mid-levels as
  landscape strata rather than overhead maps — not enormous, but not free, and it
  touches code that currently only ever ran headlessly (see `TODO-USER.md` visual
  verification backlog). Worth doing *as part of* that first real visual pass, not
  as a separate retrofit.
- Where exactly does the flip fire — at the `cell`→`district` zoom, or on physically
  walking out the room's door? (The latter is more diegetic and pairs with the
  existing door/`spawnAt`.)
- Does the agent's sprite re-render across the projection change the way the persona
  already "recolours across terminal styles" (`DESIGN.md`)? A side-on Loki vs a
  top-down Loki is the same being in two projections — a natural extension of the
  recolour-across-boundaries rule.

**Depends on / extends:** *Composable panes* (this gives the seams a projection that
makes crossing them physical), the scale-ladder renderers (`src/render/levels/`,
Phase 7A). **Status:** post-v1.0 design direction; the right time to decide it is the
first real visual pass on the higher levels, since that's when those renderers get
touched anyway.

---

## The hundred-terminal desk: a fleet managed by a meta-agent

*Captured 2026-07-16 (Harry, mid-conversation, right after v1.0 shipped the
snapping-terminals arc).*

Harry's frame, verbatim in spirit: *"I see this scaling up to 100 terminals
which are managed by a meta-agent — or they can open what they need on
command."* The desk stops being a handful of windows and becomes a **fleet**:
the world's topology grows to dozens-to-hundreds of lands, and which of them
are *materialised as OS windows* at any moment is managed — by the society,
by a meta-agent, or by a one-keystroke user command ("open the wing where
the cat is").

### What already exists (the seeds)

- The programmatic spawn path IS the tray path: `spawnNext()` /
  `terminal:debugSpawn` (T3 tier, 2026-07-16) — a meta-agent would be *a new
  caller of the same API*, exactly the pattern the Composable-Panes Depth-3
  entry established for pane topology ("no new substrate, just a new
  caller").
- Desk persistence (`TerminalSlot[]`) already separates *the desk's state*
  from *live windows* — the config is a tiny prototype of "topology that
  exists while windows don't."
- PRD T5 (unbuilt) is the trust-shaped v0: the society proposes ONE
  topology change per night, morning-dispatch surfaced, one-tap apply.

### The hard physics (why 100 real windows is the wrong build)

Each terminal is a full Chromium renderer process (tens of MB + a GL
context). A hundred live windows is infeasible and — worse — illegible.
The resolution is **virtual terminals**: the broker holds N lands as pure
simulation state (cheap — beings + wear + memory writes, no renderer), and
only the working set materialises as windows. An LOD ladder, mirroring the
wallpaper throttle: **live window → throttled window → headless simulation
→ cold state**. Windows become a *viewport cache* over a larger living
topology; the meta-agent pages lands in and out of view.

### The meta-agent is Loki given hands

Per the Living-world entry, Loki is the climate. A fleet-manager
"meta-agent" shouldn't be a new chatbot commander (CLAUDE.md's no-chatbot
rail binds) — it's the climate acquiring topology authority: what surfaces
on your desk is the world's *mood expressed as architecture*, plus explicit
user commands as the override. "On command" stays diegetic: a keystroke or
palette action ("open d7"), never a conversation.

### Guardrails (bind harder at fleet scale)

A desk that reshuffles constantly kills ambience and trust. The Sleep-mode
rails apply with interest: changes on the sleep cadence, named in the
morning dispatch, reversible, lock-list honoured. The user's own windows
are sacred — agents propose and open; they never move or close what the
user placed (T5's rule, kept at scale).

### Smallest steps toward it

1. Lift the 6-wing cap (`WINGS` in `desktop/src/terminals.ts`) — regions
   are already enumerable beyond d5.
2. Headless land simulation in the broker (a land ticking without a
   window) — the virtual-terminal substrate.
3. T4/T5 as specced (topology in reflections; one nightly proposal).
4. Only then: the pager (materialise/dematerialise on attention) and the
   climate-driven working set.

### Sharpened — the meta-agent as DIRECTOR, the world as broadcast (added 2026-07-16, same day)

Harry's second pass on the idea reframes it: *"the world opens up and more
terminals get added as the agents explore it — not all loaded at once; a
meta-agent opens terminals for the other agents for interesting events."*
Two moves fall out:

- **Windows are attention, not the world.** The world runs mostly unseen
  (headless lands); the meta-agent manages which slice *materialises on the
  desk*. A director cutting to the interesting camera — it solves the
  100-land UX problem (the user can't know where the life is; the
  meta-agent's job IS knowing where to look).
- **Exploration births terminals.** The world graph is implied by the seed
  (the `clusters.ts` district/island tree); agents wandering past the known
  edge *discover* the next wing and its terminal materialises at the desk
  edge. Determinism survives — discovery reveals, never invents. Discovery
  events feed the culture system ("the archivist found the strategy
  district").

**Event broadcasts are the v0** and need no LLM in the loop: the events
calendar already stages deterministic events, Smallville importance already
scores "interesting," and `spawnNext()` is the API. Rule: an event stages in
an unopened wing → the meta-agent opens a terminal onto it for the event's
duration, dispatch line names why, window folds away after. Smallest demo:
two open terminals + one headless wing; a festival fires there; a window
opens itself; agents walk to it through the joins.

**Rails, hardest here:** self-opening windows are the most invasive act
this product can perform. Director mode is opt-in; every opened window is
named in the dispatch and instantly dismissable; cadence hard-capped; the
meta-agent stays Tier-0 rules over existing signals (LLM judgment only at
existing reflection cadence). And it is NOT a character — it's Loki-as-
climate given hands (see *The living world*), never a chat surface.

**Status.** Parked; the natural far end of the desk-as-world arc. Event
broadcasts (the sharpened v0) are buildable directly after PRD T4/T5 +
headless-land simulation in the broker. Referenced from `VISION.md` § The
desk as world.

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
Also recorded at: `VISION.md` § The desk as world; `docs/PRD-snapping-terminals.md`
T3 (the buildable first rung); quoted as doctrine in
`docs/design-reviews/2026-07-31-diorama-neighbour.md`. This entry is canonical.

---

## Layout directions round 1 — nine unactioned directions

*Captured 2026-08-01 (from the 2026-07-30 mockup round; consolidation pass).*

The round-1 desk-layout page
(`docs/design-reviews/2026-07-30-layout-directions.html`) proposed ten named
directions for the terminals desk. Only **Raised Horizon** was actioned
(shipped with proximity labels, commit `fb4913e`, 2026-07-30). The page's own
round-2 keep/kill/mutate pass never ran for layouts (only the style page got
its tombstone round), so the other nine were never judged — parked here so
they survive outside the mockup HTML. One line each, from the page's theses:

- **Reliquary Strata** — keep all ten underground rows, but make every one
  earn its place.
- **Ledger Frame** — real box-drawing window chrome; the frame parts where
  two terminals join. (Natural neighbour of PRD T3 chrome.)
- **Quiet Surface** — every element gets its own lane; names move into the
  architecture, the promenade belongs to the beings.
- **Mural Anchor** — one framed, palette-quantised mural per window; each
  terminal gets a recognisable face. (Concretises murals #16.)
- **Archipelago Desk** — the desk itself as composition: themed mainland, a
  strait of desktop, a deliberate outpost. (Concretises the parked
  hundred-terminal desk / T3.)
- **Terrace Join** — snap a window *underneath* and it becomes the
  underground. **Invariant break:** violates horizontal-joins-only
  (`desktop/src/topology.ts`).
- **Ribbon Shelf** — a wide, short landscape ribbon with no underground.
  **Invariant break:** violates the fixed 640×520 window contract that
  ground-line continuity depends on.
- **Skyline of Closed Wings** — the horizon is the rest of your desk;
  unopened wings stand as silhouettes on the ridge.
- **Cutaway Interiors** — loved structures become dollhouses: rooms you see
  into, beings living inside.

**Status.** Round 2 JUDGED 2026-08-01 (verdicts on the page, same session):
**05 Mural Anchor KEPT** — design input to the murals #16 slice, not a
separate build. **09 Skyline FOLDED into #19** — unopened-wing silhouettes
join the land-polish scope. **07 Terrace Join + 08 Ribbon Shelf KILLED** —
both invariant-breakers (vertical snapping / the 640×520 contract); opening
those engine questions was judged not worth it against the depth queue;
tombstones on the page. **Still open, no verdict:** 02 Reliquary Strata,
03 Ledger Frame, 04 Quiet Surface, 06 Archipelago Desk, 10 Cutaway
Interiors — parked awaiting a future round; not implicitly killed. Note before building any
of them: Terrace Join and Ribbon Shelf require engine-invariant changes, and
several (Mural Anchor, Quiet Surface, Reliquary Strata) may be absorbed
naturally by depth-track work (murals #16, land polish #19) rather than built
as layouts.

---

## Shared rules across terminals — conformed truths across the desk

*Captured 2026-08-01 (Harry's design thread from the 2026-07-31 widening-round
session; canonical home moved here from STATE.md).*

Joined terminals are lenses on ONE shared world, so shared truths must be
*conformed* across windows — time of day first, then salient events when they
exist. A pack may **compress or omit** a shared truth (the lossy lens IS pack
identity; DMG's blank sky is legal) but may never **contradict** it (a sunny
sky beside a midnight neighbour breaks the join). No world clock exists today
— the sky is static ambience — so the first buildable rung is a world clock
that packs render through their own vocabulary.

### The conditions-vs-content ladder (added 2026-08-06)

*Harry, same day as § Terminals of different sizes: "the setting should be
continual, like landscape that makes sense and synchronised time."*

Two kinds of continuity, needing different machinery. Conflating them is how
this sprawls.

**Conditions — desk-global.** Time of day, weather, light direction, wind. One
scalar world-state ticked in the MAIN process and broadcast; each window
renders it through its own pack vocabulary (compress or omit, never
contradict). Build the tick once and the whole rung falls out of one pipe.

**Content — wing-owned.** Terrain, biome character, distant horizon, worn
paths. Making these continuous means making them a function of a shared desk
coordinate, i.e. of *where the user dragged the window*.

Ordered by payoff over cost:

| Rung | State | Note |
|---|---|---|
| Terrain height at the seam | **SHIPPED** | `landSeamBoundary` (`src/procedural/land.ts:279`) folds both wing seeds in canonical order, so both windows compute the same boundary independently and hermite-blend their last 6 columns into it. No talking required. |
| World clock / time of day | **RELEASED 2026-08-07 (the arc), and given its COLOUR 2026-08-08 (the daylight sky register, `d9244b5`). `CLOCK_HELD` / `HELD_SKY` are gone** — history kept below for the reasoning. *(was)* **BUILT + HELD 2026-08-06** — shipped, verified, then held to a fixed sky by Harry's ruling once he saw noon beside midnight; `CLOCK_HELD` in `ambient.ts` is the switch and the hold is the PRE-clock sky (everything present), deliberately off the daylight curve because every point on it trades the ☼ for the stars. Release it when the colour rung lands. | `daylight(hour)` + `skyPresence()` in `src/terminal/ambient.ts`. Real LOCAL time (the desk is a wallpaper you live in front of; your 9pm should look like night — UTC stays the rule for anything we *stamp*). Needs no broker channel: every window derives it from the same wall clock, so a terminal opened at midnight matches its neighbours the instant it mounts. Drives **presence, not colour** — the composer already bakes ☼, ☾ and stars into every sky unconditionally, so until now every terminal showed all three at once at every hour; the clock decides which are out. Packs keep colour, so a pack that omits sky roles simply has nothing to fade. **Known limit:** the sky's *colour* is a pack constant, so noon currently reads as "night with the stars taken away" rather than as daylight. Fixing that is the next rung, not this one. |
| **Wind phase** | live defect, ~an hour | Sway is `sin(elapsedS × SWAY_HZ)` where `elapsedS` counts from each window's OWN mount (`src/terminal/terminalLand.ts:1256`, `:798`). Terminals opened seconds apart sway counter to each other across a seam. Drive phase from shared world-time and one breeze crosses the desk. Highest payoff per line on the list. |
| **Daylight colour** | **SHIPPED 2026-08-08 as a per-pack AUTHORED register (`d9244b5`), eyeball pending.** Global mechanism stays KILLED; the two rows below are the axes it ships on, and both are now buildable rather than proposed. Harry's framing: "make the background a separate environment which changes colour with the time of day relative to the style of the terminal" — the last clause was the mechanism. A pack authors three stops (night/twilight/day), `night` pinned to `bg` so midnight is byte-identical, absent = the sky never moves. The gate followed the denominator: every frozen contrast bar now re-runs against the sky the pack draws, sampled across the whole daylight curve (contrast is not monotone in sky luminance, so an interior hour can beat both endpoints). No threshold added or retuned. Three packs authored: `phosphor` (the desk's boot pack, lift ×4.3), `catppuccin-mocha` (lift ×6.4), `solarized-dark` (hue, ×1.2 luminance and ΔE 24.6). Spec + six bars: `docs/superpowers/specs/2026-08-08-daylight-sky-register-design.md`. | The clock ships but drives alphas only, so noon is an empty black sky rather than a bright one. One global mix strength cannot work: beings are drawn at `surface - 1`, a SKY cell, so the sky is their contrast denominator, and the corpus clears the frozen `BEING_MIN_CONTRAST 3.0` by only 8% — spent at a mix of ~0.06, where midnight→noon separation is 1.03 and invisible. Full numbers: `docs/superpowers/plans/2026-08-07-daylight-colour.md` § Result. |
| **Daylight colour, hue axis (constant luminance)** | **BUILT + FIRST TEST PASSED 2026-08-08. The kill did not fire — it INVERTED, and the argument-against below is REFUTED.** Harry, on the side-by-side: *"solarized looks way better because it actually looks like a time of day."* Solarized moves ×1.2 in luminance (essentially none) and reads as an hour; the first phosphor cut moved ×4.3 and read less like one. **Hue is the stronger axis for telling time, not the fallback** — so the recorded worry ("a hue rotation cannot make noon brighter, and brighter may be irreducible to what day means") had it backwards. Two candidate explanations, NOT separated by this test: brightness change may read as a *display* artifact where hue reads as a *world* event, or navy may simply be what "sky" means and green was fighting a hard-wired association. Both predicted the same fix, so phosphor was re-cut on it — luminance held at exactly ×4.3, hue rotated 154° → 185° (cyan noon, amber dawn/dusk), which isolates the variable for the next eyeball. **Consequence for pack authors: lead with hue, treat luminance as the supporting axis** — the blueprint's guidance was written the other way round and has been corrected.** The reasoning below stands and is what made the axis buildable; what changed is that the pack AUTHORS the rotation by eye instead of the engine maximising ΔE, which is exactly the unsolved-authoring-question the argument-against named. Shipped answer: `#002b36` → `#0e2a55` (ΔE 24.6 at ×1.2 luminance), a teal night draining to a navy midday, with a `#402015` ember at dawn/dusk. | Harry, 2026-08-07: "change the colour of the sky when blue doesn't work." Naming a different *key* was already the per-pack slot below; the stronger reading is a different **axis**. WCAG contrast is a function of relative luminance ONLY, so a sky that rotates hue while holding its luminance fixed leaves **every frozen bar in scripts/smoke-style-pack.mts numerically unchanged** — not calibrated, constructed. Measured per pack (full commitment to a palette key, then rescaled back to the pack's own `bg` luminance; drift ≤ 2e-4, i.e. four decimal places): ΔE **solarized-dark 46.1** (`#002b36` → `#4c1110`), **gruvbox-dark 30.2**, night-drive 24.5, catppuccin 19.8, tokyo-night 18.8, gameboy-dmg 13.6, cozy-autumn 6.8, phosphor 5.7, amber-crt 3.5, ibm-3270 1.2 (ΔE 2.3 ≈ just-noticeable, 10 ≈ obviously different). **The finding is the COMPLEMENTARITY**: this axis fails on the near-black monochrome packs, which are exactly the ones the luminance-lift axis suits, and it succeeds on the saturated ones that no key could rescue — so between the two, **all ten packs have an axis they can afford**, and `solarized-dark`, the `DEFAULT_THEME_ID` whose failure deflated the per-pack plan, is the single best case here. A pack would then choose not merely a colour but *which way its sky moves*, brighten or rotate, which is a property of the machine rather than a setting. **Argument against, recorded**: a hue rotation cannot make noon *brighter*, and "brighter" may be irreducible to what "day" means; the probe also maximised ΔE rather than plausibility, and solarized's maximal answer is dark red, which reads as sunset, not noon — so hue *direction* is an unsolved authoring question, not a measured one. **First test**: hand-author solarized-dark's own night→noon pair (by eye, not by ΔE) and watch it. **Kill**: if a hue shift with no brightness change reads as "someone recoloured my terminal" rather than "it is a different hour", the axis is decoration, not time — drop it, and daylight colour rests on the luminance axis at 7/10. **Sequencing: not before the hour-without-colour eyeball** (TODO-USER.md) — the arc already tells the hour, and if its bar 1 passes, colour is a bonus rather than a necessity. **Prerequisite, already built**: the sky as its own drawn layer, in `git stash@{0}` — including the trap that a lit sky inside the `glow` fx bloom (`src/render/fx/glow.ts` THRESHOLD 0.2) blooms the entire band, so the backdrop must hang outside the filtered container. Both axes need it. |
| **Daylight colour, per-pack** | **SHIPPED 2026-08-08 — this is the mechanism that landed.** One correction to the note below: it says `DEFAULT_THEME_ID` is `solarized-dark` and calls that the out-of-the-box desk. That is the PALACE's default; the terminals desk hard-codes `TERMINAL_THEME = 'phosphor'` (`src/terminal/TerminalApp.tsx:16`) and the Electron shell blocks `?theme=` on desk windows, so phosphor is what a stranger actually boots — it was authored too (lift axis, measured headroom ×4.9). The per-pack *strength* did not become a slot in the end: authoring the colours directly subsumes it, and the pack is its own ceiling. | Harry's correction, 2026-08-07: the engine is built from per-pack slots and the style-pack bars are per-theme, so the *strength* should be a slot too, not one global constant. Measured with each pack free to choose its own key and its own ceiling: **7 of 10 clear separation ≥ 1.5 while holding every frozen bar** — catppuccin-mocha (cyan, 2.40), amber-crt (orange, 1.88), phosphor (fgDim, 1.79), night-drive (green, 1.78), tokyo-night (cyan, 1.71), cozy-autumn (orange, 1.71), ibm-3270 (magenta, 1.53). Three cannot: solarized-dark (1.09) and gruvbox-dark (1.16) bind on a being accent already sitting at ~2.98 against the 3.0 floor, and gameboy-dmg has deleted its sky outright. **A pack that cannot simply does not** — `daySky: null`, legal omission, the same doctrine as DMG's blank sky, and [[style-identity-lives-in-omission-not-palette]] says omission IS identity: some machines show the time of day, some don't. **The deflating fact, recorded: `DEFAULT_THEME_ID` is `solarized-dark`**, one of the three — so this alone leaves the out-of-the-box desk (and the README's desk) with no daylight, which is why it sequences *after* the contrast-neutral rung rather than instead of it. Caveat for whoever builds it: four of the seven bind on a sky-role floor of 1.1 that was borrowed from `RAMP_STEP0_MIN` and chosen before the sweep — freeze it deliberately, do not tune it upward after seeing which packs it admits. |
| Light direction | cheap rider on the clock | One sun-azimuth scalar into the existing shade channel. This is what makes it read as one *place* rather than N places agreeing on the hour. |
| Weather | cheap rider on the clock | Rain stopping at a window edge is the worst available break. Hooks § The living world (Loki as climate). |
| Far-layer parallax | **NEEDS-CHECK** | Each window scrolls its camera independently; if the distant plane isn't anchored to a shared world-x the horizon jumps at every seam. At a glance the far layer is the strongest "one place" cue, so a break there costs more than a near break. Check = screenshot two joined terminals scrolled apart. |
| Worn paths across seams | later | Trail wear dead-ending at a frame edge undoes the crossing beat. |
| Ambience as one field | no audio yet | Fix the per-window-loop assumption before any audio work starts, not after. |

**The ruling: conditions are desk-global, content stays wing-owned.** The
strong reading of "landscape that makes sense" — biome character interpolating
along the desk so a desert never abuts a forest — requires terrain to be a
function of where the window was dragged, which contradicts two shipped
commitments at once: content seeds from wing id (determinism), and each
terminal owns its own pack identity (§ Per-terminal identity, a shipped
pillar). You cannot have both "this is the d0 wing with its own look" and
"terrain is a pure function of desk position". The seam blend already covers
the local lie; widening the blend band is the cheap version of the want,
re-seeding on arrangement is the version that eats the identity model.

**Status.** Candidate depth-track slice; recorded, not scheduled (Harry,
2026-07-31). Sequencing lives in `PLAN.md` § Open decisions. Related: the
stray-`*` painter question was the same conformance surface seen from the
leak side — RESOLVED 2026-08-02 (the `☼` sun, a pack-list gap, not an
engine leak; `landOmit` filtering held — STATE.md has the ruling).
Verdicts 2026-08-06: conditions bus (clock → light → wind → weather on one
channel) **PURSUE**, first test = force one joined terminal to dusk, the
neighbour follows within a frame; wind phase **PURSUE** (confirmed defect);
far-layer parallax **NEEDS-CHECK**; biome-as-desk-position **KILLED** by the
ruling above.

---

## Passive crossing — beings only cross when they happen onto a doorway

*Captured 2026-08-01 (from `RETROS/consolidation-2026-06.md` § parked design
directions; consolidation pass).*

Seam-crossing today is passive: a being crosses only when its wander happens
to reach a doorway cell. A one-function tweak to the intent engine could make
crossing *sought* — a being that wants the neighbour wing walks toward the
doorway deliberately. Deferred in June 2026 as not-yet-needed; the T1 society
work (watch_edge pull) has since given beings edge-directed intent, so check
whether this is already effectively delivered before building.

**Status.** Loose one-function tweak, parked. Verify against
`src/terminal/beingIntents.ts` (watch_edge) first — it may be moot.

---

## Terminals of different sizes — a big one with small ones hung off its edge

*Captured 2026-08-06 (Harry, unprompted): "different size terminals which can
join together — a bigger terminal with four smaller ones joined on its left
side, with a unique continuous environment."*

Today every terminal is the same window size and the desk reads as a row of
identical tiles. Harry's picture is an **arrangement with a shape**: one large
terminal as the anchor, smaller ones hung off its edge, still one continuous
environment. That is three separate changes, and they are not the same size.

### 1 — Different WIDTHS already work (nearly free)

`land.ts` derives its integer scale from window HEIGHT only
(`scale = max(1, floor(screen.height / contentH))`, `src/render/levels/land.ts:446`)
and the camera scrolls horizontally. Two terminals of equal height but
different widths therefore share a glyph scale and a ground row already; the
wider one simply shows more horizon. `computeSnapTarget` snaps `y` to the
neighbour's `y` regardless of width, so the join maths is untouched.

### 2 — Different HEIGHTS need scale decoupled from height (small, load-bearing)

Height drives the integer scale AND vertical centring, so a taller neighbour
gets bigger glyphs and a lower ground row: the join looks broken. The fix is
one change with a good independent reason — **lock a desk-wide cell scale and
anchor the ground line to a fixed offset from the window TOP instead of
centring it.** Then a taller window shows more sky above and more underground
below rather than a magnified copy of the same land, and the desk reads as one
world seen through differently-sized apertures instead of N zoomed views.
(`docs/PRD-snapping-terminals.md` § 6 already names "lock land scale across
terminals" as the mitigation; this is that, made concrete.)

### 3 — Four small ones on one edge: multi-seam edges, and it stops being a landscape

`openSides`/`neighbourOf` (`desktop/src/topology.ts`) assume **one neighbour
per side** (`joins.find`), and `computeJoins` requires aligned tops. Four
windows stacked along the big one's left edge means several joins on one edge
at different vertical offsets — new machinery: per-seam vertical bands, and a
crossing being picking the seam whose band contains its own ground row.

The design consequence is the interesting part. Four stacked neighbours cannot
all share one ground line, so this is not a landscape join at all: the tall
terminal becomes a **hall or shaft**, and each small terminal is a **storey**
opening onto it at its own floor. That dissolves the PRD's "no vertical joins"
non-goal without giving up side-on legibility, because you never join two
ground lines at mismatched heights — you join a small land's ground line to a
*floor* inside the tall one.

Determinism survives if the tall land generates a deterministic **ladder of
candidate floor rows** (seeded, like the surface field), and snapping quantises
the small window's `y` to the nearest candidate. Arrangement then *selects*
which floors become doors; it never invents geometry.

### The argument against

The desk's whole vocabulary is landscape: sky band, horizon relief, buried
underground. A four-storey shaft standing next to a horizon mixes landscape
and building on one desk, and each stacked storey brings its own sky band —
sky appearing at mid-elevation beside a hall interior is the "mixing palettes
reads as broken" failure at the layout level. The risk here is aesthetic, not
technical, and it will not be settled by making the joins work.

**Status.** (1) and (2) PURSUE, small, and (2) unblocks everything else.
(3) PARKED on one precondition: an eyeball of a tall terminal with two
neighbours at different rows that reads as one place rather than two broken
lands. Sits alongside `docs/PRD-snapping-terminals.md` T3 (join-edge craft),
which is where the glyph treatment for a floor-into-hall join would live.
