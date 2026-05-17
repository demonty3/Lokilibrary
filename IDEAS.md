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

*Add new parked ideas below as separate `##` sections, dated.*
