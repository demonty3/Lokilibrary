# Memory Palace — Design Consolidation

*This document is the consolidated state of a long design conversation. The summary below captures the concrete decisions, the design pillars, and the open questions. If a raw conversation transcript is attached beneath this, treat **this summary as authoritative** and the transcript as supporting detail.*

**Working title:** TBD (memory-palace-flavoured; not "library"). "Loki" is the name of the default agent character, held separate from the product name.

---

## One-line concept

A terminal-aesthetic desktop application that renders your digital collections (Steam library first, other sources later) as an inhabitable **memory palace** — a 2D side-on pixel world populated by a society of semi-autonomous LLM-driven agents who explore, build, and respond to events. It lives as a live wallpaper and an alt-tab destination, and doubles as a launcher.

---

## Origin and the strategic pivot

The project began as **LibraryWorld**: a personalised *3D* world generated from a user's Steam library (Three.js + react-three-fiber, Steam OpenID, behavioural profile, LLM-chosen organising metaphor, diegetic launch rituals, share-URL contract). It reached ~v0.5 with v0.6 (Electron wrapper + wallpaper mode + Steamworks SDK) as the next major phase.

**The pivot rationale (key strategic insight to preserve):** the original 3D concept depended on AI *world-model* maturity that doesn't exist in 2026 — and crucially, *if/when* world models mature enough to deliver "a beautiful personalised 3D world from your data," the concept becomes commoditised, because anyone could then generate it trivially. The original idea sat in an innovation valley: too early for the tech, and mooted by the tech's arrival.

The terminal-aesthetic pivot replaces a **technology moat** with a **taste moat**, which is far more durable. It is also dramatically more shippable in 2026 — pixel-art generation and composition are mature where 3D-world generation is not.

---

## Core design pillars

**Memory palace, not library.** The product spatialises personal memory and identity. Steam is the first data source, not the defining one — it generalises to Spotify, Letterboxd, Goodreads, GitHub, and the local filesystem. "Memory palace" (the method of loci) carries ~2,500 years of cultural weight and matches the agent's exploratory behaviour far better than "library," which connotes a passive media container.

**Terminal aesthetic.** Stylised pixel art that *reads* as rich ASCII/terminal — sprites built from box-drawing characters, block elements, and unicode glyphs at sprite resolution, not literal TTY cells. Themeable to editor colour schemes (Solarized, Gruvbox, Catppuccin, Tokyo Night, IBM-3270). Chosen because it is: lo-fi (forgiving of generative unevenness, which reads as *style* rather than *failure*), cheap to render (viable for 24/7 wallpaper mode), aesthetically owned by an audience that reliably pays for craft, and independent of immature 3D generation tech.

**Embodied agent as a being, not a process.** The agent has:
- **Limited, spatially-bounded perception** — it only knows about parts of the world it has actually explored. (This is identified as the single highest-leverage idea: it turns the agent from a database query into a creature, makes movement meaningful, makes discovery a feature, and makes its interpretive observations feel earned.)
- **A creative budget** it accumulates and spends generating new assets via **text-to-pixel prompts** (e.g. "small wayside shrine, ASCII pixel art, fits coastal/forest transition, 32×32"). One LLM call per user per day is cheap; output cached locally. This solves "ongoing content without the developer shipping weekly."
- **A persistent character** that **recolours and re-renders** across different terminal styles — same silhouette/being, rendered in each world's artistic vocabulary (ASCII here, Stardew-style pixel art there, watercolour in dream mode). Transition across a boundary is its own visual moment.

**Agent society.** Multiple agents, tiered: one customisable "your" agent (named, with a relationship) plus NPCs of varying depth (some richly behaved and named, some ambient population) — the Animal Crossing / Stardew structure. **Pre-set social-attractor structures** (town halls, churches, beaches, cafés, festival grounds) act as behavioural infrastructure — pattern-language architecture that *causes* social texture rather than just decorating it. Agents spend budget on social infrastructure, and *how* they spend reveals character.

**Lore-seeded worlds (user-uploaded, primary lever).** Users upload **their own lore** — text (worldbuilding docs, fanfic, descriptions), images (mood boards, concept art), URLs (wiki pages) — as the *primary* personalisation input. The world's aesthetic, factions, events, naming, and antagonists all derive from it. This is distinct from (and bigger than) curated Workshop "lore packs":
- It makes the product a *medium for personal worldbuilding* (D&D campaigns, fanfic authors, novelists, hobbyist worldbuilders).
- It **defeats metaphor-convergence completely** — the user's input is the primary variance lever.
- It **sidesteps fan-IP risk** — pasting in (e.g.) Warhammer 40K lore is private personal use rendered locally, not distributed content. Workshop remains for *original* universes creators choose to share.
- Sparse input gets LLM follow-up questions; rich input is honoured; lore can be revised over time and the world re-tunes.

**Conflict / chaos.** "Chaos terminals" and lore-appropriate antagonists give the world stakes and **emergent narrative** (RimWorld / Dwarf Fortress-style story generation — *stories users want to tell other people*, the deepest retention mechanic). Chaos manifests appropriately to the uploaded lore (Warhammer → daemons; cottagecore → blight/winter; cyberpunk → corporate raids; Lovecraftian → eldritch incursions). Implementations include corrupted intrusions (visually glitching terminals the agents must seal/purge/negotiate), faction tensions, environmental decay tied to neglected library regions, and Loki-orchestrated drama. **Stakes must be tuned:** some loss possible (or conflict is hollow theatre), but nothing essential permanently destructible (or the user feels punished for living their life). Wounds heal but leave scars; the palace remembers its losses.

**Scalable zoom.** A scale ladder, each level with its own rendering vocabulary and aggregate views at higher zoom:
`cell/ASCII → district → island → continent → planet → solar system` (`→ galaxy`, year-5+ cross-user optionality).
- Detail = high-fidelity pixel art (one agent, readable documents).
- Island = cartographic (agents as points of activity, geography legible).
- Planet = orbital/photographic (your whole library as a rotating world).
- Solar system = each *planet* is a different data source (Steam, Spotify, Letterboxd…) orbiting a centre that *is* you.
**Multi-pane terminal UI** (detail + map + log), mirroring how terminal users actually work (tmux panes, multi-monitor). The **map terminal** is the killer ambient-wallpaper feature; the **detail terminal** is the focused-attention surface. Limited perception integrates here: the agent only sees its detail level; the user sees all scales (the user can watch a chaos storm approach on the map while the on-the-ground agents are oblivious).

**"Loki" personality.** Mischievous procedural reorganisation and scheduled events ("procedurally played out" — the world has a calendar and stages performances). Loki-energy scales with zoom: small daily surprises (books move, notes appear), medium island-level shifts (districts rearrange overnight), rare planetary upheavals (Ragnarok-style transformations). Constraint: mischief must be **legible and reversible** — every rearrangement carries a discoverable rationale, and users can lock things they don't want moved.

**Dream mode (year-2).** The agent enters an altered state and (a) **browses the local filesystem with permission, processed locally only** — finding old files, photo palettes, notes — and (b) **creates on the desktop itself** (ASCII bleeding onto the wallpaper, files appearing in a special folder, subtle ambient effects). This is the elegant **"beyond Steam"** mechanism: the integration surface is *the filesystem*, one mechanism for infinite sources, rather than building per-platform API integrations. Privacy/permission design is load-bearing: must feel intimate (your companion knows you), never surveillance. Explicit per-folder opt-in, a "what the agent has seen" panel, local-only processing, no network telemetry.

---

## Four-tier personalisation model

`library data (substrate) → behavioural profile (interpretation) → terminal aesthetic (vocabulary) → uploaded lore (story)`

These are orthogonal axes. Two users would need all four layers to match to get the same palace — which functionally never happens. This is the combinatorial structure that defeats convergence.

---

## Distribution

> **Superseded 2026-07-11:** the project is now free, public open source — no Steam distribution, no monetization. Authoritative wording: SPEC.md § 2.5 + CLAUDE.md “Product direction”. The hybrid model below is preserved as the pivot-era record.

**Hybrid model.** Open-source engine + default world-pack on GitHub (credibility, early audience, dev-cred — the audience *rewards* OSS positioning with trust). Curated, themed product + platform features (Steam Workshop, cloud sync, achievements, easy install) sold on **Steam at ~$15–20** (geek-coded craft audience pays more per head and retains longer; precedent: Wallpaper Engine, iA Writer, Working Copy, Obsidian, Aseprite's "source-on-GitHub, pay-for-the-binary" model). Each distribution channel does what it's good at.

**Workshop content axes:** district types, agent skins/personalities, terminal themes, social-attractor templates, lore packs (original universes). Workshop is a *natural* moat here (modular, well-defined units) rather than an afterthought. Moderation pipeline (image moderation, static-baked-assets-only for community content, kill-switch) is a prerequisite, not a follow-up.

---

## Inherited from the 3D build

**Transfers:** Steam OpenID auth; behavioural profile (Steam playtime × HowLongToBeat completion fractions, recency, achievements); deterministic seeded procedural layout (mulberry32-style, no `Math.random()`); share-URL contract; library-state model (`loved`/`recent`/`mastered`/`abandoned`/`dusty`).

**Does not transfer:** Three.js / react-three-fiber rendering; Meshy 3D-asset pipeline.

---

## Suggested v1.0 MVP

Single terminal, one district type, one main agent (limited perception + small enrichment budget), lore-input system with one default universe, scheduled Loki events. **Not in v1.0:** chaos/conflict, the scale ladder, multi-agent society, dream mode — these are the expansion roadmap. Ship the MVP to test whether the *aesthetic* and the *agent-as-being* core actually land with people, then expand.

**Roadmap shape:** Year 1 = core single-user product. Year 2 = Workshop + community content + multi-agent society + chaos. Year 3 = beyond Steam (multi-source via filesystem/dream mode). Year 5+ = optionality (spatial computing port; agent-platform / MCP-native).

---

## Open questions for research

1. **Pixel-art generation/composition pipeline** — reliable, cheap enough for daily per-user generation; tools, models, repos for sprite/tile generation constrained to a fixed palette and scale.
2. **Wallpaper-mode desktop integration** — Windows (`Progman`/`WorkerW` reparenting; Lively Wallpaper as reference) and macOS (`NSWindow.level = kCGDesktopWindowLevel`); cross-platform reference implementations; three-tier render-loop throttling.
3. **Multi-agent simulation architecture** — running a believable agent society cheaply: when to call an LLM vs. cheap behaviour-tree/FSM logic, batching strategies, local-model options (Ollama), persistent agent memory/state, generative-agents research (e.g. Stanford "Smallville" patterns).
4. **Local-only filesystem access + privacy/permission model** — patterns for sandboxed, opt-in, local-processing-only file access in a desktop app (Electron/Tauri).
5. **Terminal-aesthetic rendering tech** — TUI vs. pixel-art-that-looks-like-TUI; libraries (blessed/ink/notcurses vs. a sprite engine); achieving themeable colour schemes; performance for 24/7 operation.
6. *(retired 2026-07-11 — no Steam distribution)* **Steam Direct + AI content disclosure** — current obligations for a generative desktop app; AI Content Survey requirements; Workshop revenue share for non-game apps.
7. **Engine/wrapper choice** — Electron vs. Tauri given Steamworks SDK needs and the lighter rendering load of 2D (the 3D build had settled on Electron for `steamworks.js`; a 2D build may reopen this).
8. **Product name** — memory-palace-flavoured, brandable, not colliding with existing software (note: "Loki" alone collides with Grafana Loki).

---

## Recommended research framing

The most valuable research direction is **technical feasibility and tooling** — the design is rich, but what's actually *buildable* and *with what* is the current unknown. For each major system, the useful deliverable is: (1) existing libraries/engines/repos to build on, (2) the hardest technical risks and how comparable products solved them, (3) a realistic v1.0 MVP scope. Prioritise concrete tools, named techniques, and reference implementations over general advice. (A market/competitive-landscape scan is a *separate* research pass — worth doing, but don't ask for both in one prompt.)
