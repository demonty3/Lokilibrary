---
up: "[[Lokilibrary]]"
---

# Memory Palace — Spec

**One-line pitch:** A terminal-aesthetic desktop application that renders
your digital collections (Steam library first, other sources later) as an
inhabitable **memory palace** — a 2D pixel world populated by a society
of semi-autonomous LLM-driven agents who explore, build, and respond to
events. It lives as a live wallpaper and an alt-tab destination, and
doubles as a launcher.

**Status (2026-05-22).** Committed project, post-pivot. Phase 0 spike
complete (`RETROS/phase-0-spike.md`); Phase 1 (renderer foundations) in
progress. The pivot from LibraryWorld (3D Three.js Steam-library
visualiser) happened in May 2026 — full pivot rationale in
`docs/pivot/DESIGN.md`, technical feasibility analysis in
`docs/pivot/FEASIBILITY.md`. The 3D-era spec is preserved as Appendix A
below for context; the 3D codebase lives in `legacy-3d/` for reference.

**Working title:** TBD (Memory-Palace-flavoured; not "library"). "Loki"
is the name of the default agent character, held separate from the
product name.

---

## 1. Vision

The product spatialises personal memory and identity. Steam is the first
data source, not the defining one — the substrate generalises to Spotify,
Letterboxd, Goodreads, GitHub, the local filesystem. "Memory palace"
(the method of loci) carries ~2,500 years of cultural weight and matches
the agent's exploratory behaviour far better than "library," which
connotes a passive media container.

Four design pillars hold the product together:

**1. Terminal aesthetic.** Stylised pixel art that *reads* as rich
ASCII/terminal — sprites built from box-drawing characters, block
elements, and unicode glyphs at sprite resolution, *not* a literal TTY.
Themeable to editor colour schemes (Solarized, Gruvbox, Catppuccin,
Tokyo Night, IBM-3270). Chosen because: lo-fi (generative unevenness
reads as *style* rather than *failure*), cheap to render (viable for
24/7 wallpaper mode), aesthetically owned by an audience that reliably
pays for craft, independent of immature 3D-world-generation tech.
**Replaces a technology moat with a taste moat — far more durable.**

**2. Embodied agent as a being, not a process.** The agent has
spatially-bounded perception (only knows about parts of the world it
has actually explored); a creative budget it accumulates and spends
generating new assets via text-to-pixel prompts; and a persistent
character that recolours and re-renders across different terminal
styles (same silhouette/being, rendered in each world's vocabulary).
Limited perception is the single highest-leverage design idea: it
turns the agent from a database query into a creature, makes movement
meaningful, makes discovery a feature, and makes its interpretive
observations feel earned.

**3. Agent society.** Multiple agents, tiered — one customisable "your"
agent (named, with a relationship) plus NPCs of varying depth (some
richly behaved and named, some ambient population) — the Animal
Crossing / Stardew structure. Pre-set social-attractor structures
(town halls, churches, beaches, cafés, festival grounds) act as
behavioural infrastructure — pattern-language architecture that
*causes* social texture rather than just decorating it.

**4. Lore-seeded worlds (user-uploaded, primary lever).** Users upload
their own lore — text (worldbuilding docs, fanfic, descriptions), images
(mood boards, concept art), URLs (wiki pages) — as the *primary*
personalisation input. The world's aesthetic, factions, events, naming,
and antagonists all derive from it. This is distinct from (and bigger
than) curated Workshop "lore packs": it makes the product a *medium
for personal worldbuilding* (D&D campaigns, fanfic authors, novelists,
hobbyist worldbuilders); it defeats metaphor-convergence completely
(user input is the primary variance lever); and it sidesteps fan-IP
risk (pasting in Warhammer 40K lore is private personal use rendered
locally, not distributed content).

A four-tier personalisation model emerges from these:

```
library data (substrate)
   → behavioural profile (interpretation)
      → terminal aesthetic (vocabulary)
         → uploaded lore (story)
```

These are orthogonal axes. Two users would need all four layers to match
to get the same palace — which functionally never happens. **This is the
combinatorial structure that defeats convergence.**

---

## 2. Decisions

### 2.1 Rendering medium → **2D pixel-art-that-looks-like-a-terminal (PixiJS v8 + Cozette bitmap font)**

Decided post-LibraryWorld-pivot, May 2026. The 3D build (Three.js +
r3f + Meshy) reached v0.5 then pivoted because the original 3D concept
depended on AI world-model maturity that doesn't exist in 2026 — and
*if/when* world models mature enough to deliver "a beautiful personalised
3D world from your data," the concept becomes commoditised, because
anyone could then generate it trivially.

The terminal-aesthetic pivot replaces the technology moat with a taste
moat. It is dramatically more shippable in 2026 — pixel-art generation
and composition are mature where 3D-world generation is not. Box-drawing
characters (U+2500–U+257F) and Unicode glyphs render beautifully as
bitmap-font sprites in PixiJS using a bitmap font (Cozette 6×13 is
Phase 1's pick) baked to an atlas.

**Why not a true TUI** (Ratatui, blessed, notcurses)? Sub-character
animation (an agent walking *between* cells, particles, glow, palette
gradients) is impossible in a true terminal. The terminal *aesthetic*
gets the credibility; the underlying renderer is a sprite engine.

### 2.2 Platform → **Steam-distributed desktop app, Electron + steamworks.js**

Engine choice settled by Steam + wallpaper + dev-ergonomics, not by raw
performance. Electron is the only stack that combines a mature
Steamworks binding (`ceifa/steamworks.js`, ~570+ stars), a documented
wallpaper-mode plugin pattern (Lively Wallpaper port), and the largest
LLM-assisted-coding training corpus. Tauri's measured advantages are
real — Electron installers 80–200 MB vs Tauri's 2–10 MB, idle RAM
200–300 MB vs 30–40 MB — but Tauri forces Rust for every Win32
Progman/WorkerW call and has no drop-in wallpaper crate. **Godot 4 is
the escape hatch** if PixiJS pixel-art quality proves insufficient.

The web build is the public **share-viewer surface** (anyone can view
a shared world URL in their browser; making your own requires the
desktop app). Phase 0 dropped the share-URL pipeline in the prune;
Phase 5+ reintroduces it once the renderer is stable.

### 2.3 Agent layer → **Stanford Smallville architecture, ported verbatim, with a tiered cost router**

Decided in `docs/pivot/FEASIBILITY.md`. The Stanford
`joonspk-research/generative_agents` architecture (memory stream →
recency × relevance × importance retrieval → reflection at importance
threshold 150 → top-down recursive planning) is fully open-source,
reproducible, and battle-tested. **The shipping pattern that controls
cost is tiering:**

- **Tier 0 — utility AI / behaviour tree** (no LLM): default tick at
  1–10 Hz; agents wander, sleep, do scheduled chores.
- **Tier 1 — templated micro-LLM call** (small local model, ~50–200
  tokens): triggered on perception events ("agent sees a new book on
  the shelf"). Qwen 2.5 7B at Q4 on a 6 GB GPU; Claude Haiku 4.5
  cloud fallback.
- **Tier 2 — full reflection / planning** (large local model OR
  cloud): triggered on Smallville's 150-importance threshold or
  direct user interaction. Claude Sonnet 4.6.

Cost target: **≤ $1/user/month at Claude Sonnet rates** for the full
agent runtime. Telemetry from day one.

### 2.4 Pixel-art pipeline → **Hybrid local SDXL + cloud PixelLab fallback (template-build time only)**

Local Stable Diffusion via `diffusers` + `nerijs/pixel-art-xl` SDXL
LoRA (CreativeML OpenRAIL-M, commercial-permitted) for users with
≥8 GB VRAM, falling back to the PixelLab.ai API (~$0.007–$0.013/image,
commercial license on all paid plans) for everyone else.
Astropulse PixelDetector + Pillow `Image.quantize` for palette
enforcement. Wave Function Collapse (hand-rolled tiled-model solver
in Phase 1; `mxgmn/WaveFunctionCollapse` / `BorisTheBrave/DeBroglie`
patterns reserved as escape hatches for richer constraints) for tile
composition.

**Pre-v1.0 MVP renders with box-drawing glyphs only.** Pixel-art is
Phase 3 work; the renderer foundation in Phase 1 ships with no
generated art at all.

### 2.5 Distribution → **Free & open source on GitHub** *(changed 2026-07-11)*

**Direction change (2026-07-11): the project no longer aims to make
money — the aim is to make something really cool.** The hybrid model
this section previously specified (open-source engine on GitHub +
curated product sold on Steam at ~$15–20) is retired. The whole product
— engine, default world-pack, themes — ships free on GitHub, and users
bring their own API keys (Anthropic + Steam Web API). The deliverable
bar replaces the storefront: **a stranger clones the repo and has a
living palace running on their own keys in ~10 minutes, plus one killer
demo moment** (the snapping-terminals crossing). Dropping Steam
distribution retires the entire release gate — Steam Direct, partner
onboarding, the AI Content Survey, packaging-for-Steam (see § 8.1 and
§ 11). Licence hygiene does *not* relax: the repo is public, so fonts,
audio, art, and Steam-CDN usage still need clean licences.

**Community content axes** (formerly "Workshop content axes"): district
types, agent skins/personalities, terminal themes, social-attractor
templates, lore packs (original universes). Modular, well-defined units
— now shared GitHub-style (repos / releases / a curated index) rather
than via Steam Workshop. **Community content stays free** — Wallpaper
Engine tried a paid Workshop store and abandoned it for
verification/codec-licensing/buyer-confusion problems; the lesson
outlives the storefront.

---

## 3. Architecture

```
┌──────────────────────────────────┐    ┌──────────────────────────────┐
│  Electron desktop app (Windows)  │    │  Template-build pipeline     │
│  - PixiJS v8 + Cozette renderer  │    │  (offline, curated, baked,   │
│  - WFC tile composition           │    │   Phase 3+)                  │
│  - Tiered agent runtime           │    │  - Python sidecar:           │
│  - Steamworks SDK (auth, launch,  │    │      diffusers + SDXL +      │
│      Workshop, overlay)           │    │      nerijs/pixel-art-xl     │
│  - Wallpaper mode (Lively port)   │    │      LoRA                    │
│  - SQLite memory stream + FTS5 +  │    │  - PixelLab.ai API fallback  │
│      sqlite-vec                   │    │  - Pillow palette quantize   │
└────────┬──────────────────────────┘    │  - PixelDetector grid-snap   │
         │ HTTPS                          │  - WFC tile-bible curation   │
         ▼                                │  Survivors baked to          │
┌──────────────────────────────────┐    │  public/sprites/{template_id}│
│  Backend (Cloudflare Worker)     │    └──────────────────────────────┘
│  - Steam OpenID (web fallback)    │
│  - Steamworks ticket verify       │     Pipeline NEVER runs at runtime.
│      (desktop primary path)       │
│  - Profile build                  │
│  - HLTB / IGDB enrichment         │
│  - Tier 1 / Tier 2 LLM dispatch   │
│  - Holds every server key         │
└────────┬──────────────────────────┘
         │
         ├─▶ Steam Web API     (library, recency, achievements)
         ├─▶ HowLongToBeat     (per-game completion hours, cached)
         ├─▶ IGDB (Twitch)     (rich metadata, cached)
         └─▶ Anthropic API     (Tier 1: Haiku 4.5; Tier 2: Sonnet 4.6.
                                Switchable to local Ollama / Qwen 2.5 7B
                                for dev iteration via LLM_PROVIDER=local.)
```

**Web build** is the public share-viewer surface (Phase 5+). Same
PixiJS renderer + the WFC layout reconstructed deterministically from
a profile-seed URL parameter; no launcher, no agent runtime. Bandwidth-
sensitive — keep the web bundle under the same constraints as the
3D-era build had for Three.js + r3f.

### Data flow on first boot (desktop app)

1. User launches the app → Electron main process inits Steamworks SDK
   against the configured appid (480 / SpaceWar in dev; real appid
   post-partner-approval). Logs `steamworks initialised against appid …`.
2. Renderer calls `getAuthTicket()` via the preload bridge → main
   process gets a Steamworks `AuthSessionTicket` → renderer POSTs
   `/api/auth/steamticket` to the Worker → Worker verifies the ticket
   with Steam → mints `ll_session` HttpOnly cookie.
3. Renderer calls `GET /api/library` → Worker reads cached library or
   fetches `GetOwnedGames` + `GetRecentlyPlayedGames` +
   `GetPlayerAchievements` from Steam Web API + enriches top-N with
   HLTB completion times + IGDB metadata + builds the deterministic
   behavioural profile + computes per-game state tags → caches → returns.
4. Renderer hashes the profile to a 32-bit seed via
   `src/procedural/seed.ts` (FNV-1a). PRNG is `mulberry32(seed)` from
   `src/procedural/prng.ts`.
5. Renderer dispatches to the active scale level (Phase 1: `cell`).
   The cell renderer runs WFC against the library tile bible with the
   seeded PRNG to produce a deterministic room layout, places
   bookshelf slots from `profile.topGames`, scatters decorative
   objects via Mitchell-style rejection sampling.
6. Tier 0 agent loop ticks at 1–10 Hz; agents wander on the floor
   tiles. Loki (Phase 1 test sprite) does a deterministic random walk.
7. Player interacts: WASD moves the avatar; `[ ` / `]` zooms the scale
   ladder; `E` near an interactable triggers a brief diegetic moment
   (Phase 2+).
8. From Phase 2: agent perception events fire Tier 1 LLM calls; the
   Smallville reflection threshold (cumulative importance > 150 of
   recent events) fires Tier 2 reflections.

### Re-visit flow

- Library cached worker-side (TTL ~1h for Steam, ~30d for HLTB/IGDB).
- WFC layout recomputed client-side from the cached profile seed — no
  extra call, deterministic, fast.
- Agent memory stream persisted in `userData/memory.sqlite` via
  `better-sqlite3` (Phase 2). Continues from where the last session
  left off; agents *remember*.
- Wallpaper mode persisted in `userData/config.json` — desktop app
  restarts in the last-active mode.

### Wallpaper mode

Phase 0 revival ported Lively Wallpaper's Progman-reparent technique on
Win11 22H2+ via koffi FFI bindings; works at normal `asInvoker`
integrity. Tray toggle (Window mode / Wallpaper mode). Wallpaper
renders behind desktop icons; icons remain clickable; not in Alt+Tab.
macOS port (`NSWindow.level = kCGDesktopWindowLevel`) deferred to v1.x.

---

## 4. Scale ladder

A scale ladder, each level with its own rendering vocabulary and
aggregate views at higher zoom:

```
cell  →  district  →  island  →  continent  →  planet  →  solar system
```

Optional eventual `galaxy` level for year-5+ cross-user features.

- **cell** — high-fidelity pixel art (one agent visible, one room
  legible, readable documents). The player walks the floor; agents
  visible as sprites. Phase 1's only fully-implemented level.
- **district** — cartographic; agents as points of activity, geography
  legible. Phase 1's second implemented level (static for now).
- **island** — neighbourhoods; districts as clustered shapes.
- **continent** — your whole library as land-masses.
- **planet** — orbital/photographic; the whole library as a rotating
  world.
- **solar system** — each *planet* is a different data source (Steam,
  Spotify, Letterboxd…) orbiting a centre that *is* you.

**Multi-pane terminal UI** (detail + map + log, mirroring how terminal
users actually work — tmux panes, multi-monitor). The **map terminal**
is the killer ambient-wallpaper feature; the **detail terminal** is
the focused-attention surface. Limited agent perception integrates
here: the agent only sees its detail level; the user sees all scales
(the user can watch a chaos storm approach on the map while the
on-the-ground agents are oblivious).

Phase 1 ships the scale-ladder state machine (`scale: ScaleLevel` in
Zustand) for all 6 levels but implements `cell` + `district` only.
The other four mount a stub panel: *"{level} — not yet built. keep
playing."*

---

## 5. Library-state mapping

The behavioral state of each game shapes its in-world appearance
independent of its archetype. **Transferred verbatim from the 3D build
— the state model is engine-agnostic.** State is computed from Steam
playtime + HLTB cross-reference + last-played decay + achievement %:

| State | Trigger | Visual treatment |
|---|---|---|
| `loved` | Top decile by playtime, played within last 30 days, completion fraction > 1.0 (past HLTB main) | Larger sprite, glowing accents, worn paths leading to it |
| `recent` | Played within last 7 days | Soft light, fresh state |
| `mastered` | Completion / achievement % > 80, or HLTB completionist hours met | Plaque, trophy, museum-case treatment with stats etched in |
| `abandoned` | Played 1–5h then dropped > 90 days ago AND completion fraction < 0.3 | Mid-sentence state: half-open book, paused screen, dimmed |
| `dusty` | Owned, never played (zero Steam playtime) | Crate, sheet over it, gathering dust in the corner |
| `default` | Anything else | Normal in-world object |

The HLTB completion fraction is what makes this layer honest. The same
Hades is the *brightest book on the shelf* when `loved`, a *covered
crate in the corner* when `dusty`. Same library member; the state is
the diff.

---

## 6. Behavioural profile

Built deterministically in the Worker from the Steam + HLTB + IGDB data
(`worker/lib/profile.ts`). The unit fed to the Tier 1+2 LLMs and the
PRNG seed for procedural layout. **Transferred from the 3D build.**

Fields the `Profile` type carries (see `src/types.ts`):

```ts
interface Profile {
  totalGames: number;
  playedGames: number;
  dustyGames: number;
  totalPlaytimeHours: number;
  topGames: ProfileGameSummary[];
  bingeRatio: number;
  completionRateAvg?: number;
  recentlyActiveCount: number;
  stateCounts?: Record<LibraryState, number>;
  summary: string;  // prompt-ready text, feeds LLM calls
}
```

`profileSeed(profile: Profile): number` in `src/procedural/seed.ts`
hashes a stable subset of these fields (top-game appids + playtime
buckets + engagement tags) to a 32-bit seed via FNV-1a. The hash is
*intentionally stable across cosmetic profile changes* — adding a new
game to the library doesn't reshuffle the world if it doesn't enter
the top-N.

---

## 7. Tiered agent runtime (Phase 2+)

Phase 1's Loki is a Tier 0 random walk only — no LLM call. Phase 2
lands the full Smallville architecture per `docs/pivot/FEASIBILITY.md` §3.

**Per-agent state:**
- Memory stream (SQLite FTS5 + sqlite-vec embeddings, capped at N=1,000
  entries per agent, aged out via importance × recency decay).
- Spatially-bounded perception (2D circular FOV radius around each
  agent; the simulation only feeds the LLM events from inside that
  radius — exactly Smallville's pattern, Section 3 of the paper).
- Creative-budget accumulator (integer ticks up each in-game day;
  spending it triggers a Tier 2 build/creation LLM call — *not* a Tier 1
  per-event call).
- Reflection threshold (cumulative importance of recent events > 150
  triggers a Tier 2 reflection that produces multi-step plans and
  character introspection).

**System prompt prefix:** Loki's personality — mischievous, procedural,
"played out" — is a system-prompt fragment injected on every Tier 1/2
call. Per IDEAS.md "agent-as-marginalia": the agent has *aesthetic*
preferences, not instrumental goals. The agent "likes" certain kinds of
games; it's "curious about" patterns it sees. **No engagement / retention
objectives in the prompt** — the persona is creepy if the agent has
agendas.

**Loki-energy scales with zoom:** small daily surprises at cell level
(books move, notes appear), medium island-level shifts (districts
rearrange overnight), rare planetary upheavals (Ragnarok-style
transformations). Constraint: mischief must be **legible and
reversible** — every rearrangement carries a discoverable rationale,
and users can lock things they don't want moved.

---

## 8. Tech stack

| Layer | Pick | Why |
|---|---|---|
| 2D renderer | **PixiJS v8** | WebGL/WebGPU sprite batching; BitmapText for bitmap fonts; smallest viable for the terminal aesthetic; cleanly falls back WebGPU → WebGL |
| Bitmap font (Phase 1) | **Cozette 6×13** | Ships PNG + FNT directly (no msdf-bake pipeline); free, commercial-OK; designed for terminal UIs |
| Build / dev / type-checking | **Vite + React 19 + TypeScript** | Fast HMR; React composes naturally with the imperative PixiJS app via a thin mount/teardown hook; largest LLM-coding training corpus |
| Procedural layout | **`src/procedural/`** with `mulberry32` PRNG + FNV-1a profile-seed hash | Determinism is the WFC + share-URL contract; no `Math.random()` in this module |
| Tile composition | **Hand-rolled tiled-model WFC** in `src/procedural/wfc.ts` (~150 LOC) | Repo convention is TS strict + ESM; the only JS WFC option is 2018 CJS without PRNG injection. DeBroglie-via-WASM is the Phase 3+ escape hatch |
| State (client) | **Zustand** in `src/state/store.ts` (`scale`, `auth`, `library`, `manifest`, `wallpaperMode`) | Frame-level mutations (player position, agent positions) live *outside* Zustand as module-local singletons |
| Backend | **Cloudflare Workers + KV** | Single AI orchestration surface for every provider + Steam + HLTB + IGDB; all keys server-side; free tier covers expected scale |
| Auth | **Steamworks SDK ticket** (desktop primary) / **Steam OpenID 2.0** (web fallback) | Desktop skips the OpenID round-trip per `ceifa/steamworks.js`; OpenID stays for the web share-viewer surface |
| Completion-time data | **HowLongToBeat** (community-reverse-engineered JSON endpoint, cached aggressively in Worker) | Crossed against Steam playtime gives a completion fraction — the signal that separates "lived in" from "tutorial abandoned" |
| Game metadata | **IGDB** (Twitch developer credentials) | Genres, themes, perspectives, franchises; feeds Tier 2 reflection prompts |
| Native wrapper | **Electron** + **`ceifa/steamworks.js`** + **koffi** (Win32 FFI for wallpaper mode) | Steamworks.js requires a Node host runtime — Tauri can't host it. Lively Wallpaper port for wallpaper mode |
| Pixel-art pipeline (Phase 3+) | **Python sidecar**: `diffusers` + `nerijs/pixel-art-xl` LoRA, with **PixelLab.ai** cloud fallback if <8 GB VRAM | OpenRAIL-M (local) + commercial-OK (cloud); both licensing-clean for Steam |
| Pixel-art post-processing | **Pillow `Image.quantize`** + **Astropulse PixelDetector** | Palette enforcement + grid-snap; the difference between "AI slop" and "intentional pixel art" |
| Persistence (client, Phase 2) | **`better-sqlite3`** + **sqlite-vec** + FTS5 in `userData/memory.sqlite` | Smallville memory stream + retrieval; local-only, no network egress of agent memory |
| LLM hosts | **Anthropic** (production: Haiku 4.5 Tier 1, Sonnet 4.6 Tier 2); **Ollama + Qwen 2.5 7B** (dev) | Tiered router; provider switchable via `LLM_PROVIDER` config |
| Embeddings (Phase 5) | **`nomic-embed-text` via Ollama** | Local-only embeddings for lore upload + memory retrieval; never sends user lore over the network |
| Audio (Phase 5+) | **Stable Audio 2.5** + **ElevenLabs Music** (template-build time only) | Clear commercial-use terms; legally safer than Suno/Udio |
| Distribution (v1.0) | **GitHub** — free, open source, BYO API keys *(2026-07-11 direction change; was Steam ~$15–20)* | The product is the repo + the demo. Community templates share GitHub-style, free, per § 2.5. |

### 8.1 Multi-model AI orchestration

Different models for different stages — all orchestrated from the
Worker, never directly from the frontend.

| Stage | Output | Production | Dev iteration |
|---|---|---|---|
| 0 — Tier 0 agent tick | BT/utility-AI action (no LLM) | n/a | n/a |
| 1 — Tier 1 micro-action | structured JSON `{action, intent}` | Claude Haiku 4.5 | Qwen 2.5 7B via local Ollama |
| 2 — Tier 2 reflection / planning | longer Smallville-style JSON | Claude Sonnet 4.6 | Qwen 14B+ local (capable users) |
| 3 — Pixel-art sprite (template-build) | PNG, palette-locked | Local SDXL + `nerijs/pixel-art-xl` LoRA / PixelLab.ai fallback | same |
| 4 — Lore embeddings | vector | `nomic-embed-text` (Ollama) | same |
| 5 — Reveal narration TTS (optional, v0.8+) | speech audio | ElevenLabs | not used pre-v0.8 |

**Stage 3 is template-build-time only.** Runtime calls Tier 1+2 only.
Premium-tier features in later versions (custom-prompt remix, narrated
reveal, on-demand template variations) may add scoped runtime calls —
each one requires a CLAUDE.md entry documenting cost model, caching
strategy, and fallback before shipping.

**Valve AI disclosure (Jan 2026 policy) — RETIRED 2026-07-11.** With no
Steam distribution there is no Steam Direct Content Survey to file and
no disclosure copy to maintain. The substance survives as good practice
rather than obligation: live LLM calls pass through provider-side
safety filters, generated sprites stay constrained to a fixed palette
and a 32×32 grid, and template-build assets stay curated. (The original
disclosure copy is preserved in git history should a storefront ever
return.)

---

## 9. Data integrations

**Transferred largely intact from the 3D build.** See Appendix A § 7
for the verbatim 3D-era spec; the integrations themselves haven't
changed — Steam OpenID + ticket auth, GetOwnedGames /
GetRecentlyPlayedGames / GetPlayerAchievements, HLTB community endpoint
caching, IGDB OAuth + per-appid enrichment, all unchanged from the v0.2
implementation in `worker/`.

What's new in Memory Palace:
- **Lore upload** (Phase 5): a drop-zone in the interactive window
  accepts `.txt` / `.md` / images / URLs; chunks into ~500-token
  windows; embeds via `nomic-embed-text` in Ollama (local-only);
  writes into the same SQLite memory stream that NPCs query — so user
  lore competes for retrieval on equal footing with Smallville-style
  observations. Per IDEAS.md and the design pillars: this is the
  primary personalisation lever.
- **Local filesystem dream-mode** (year 2): per-folder opt-in via
  `dialog.showOpenDialog({ properties: ['openDirectory'] })`. Network
  egress lockout: in Electron, `session.defaultSession.webRequest.
  onBeforeRequest` blocks all non-allowlisted hosts when in
  "local-processing only" mode. UX model: Obsidian for vault picker,
  Raycast for the transparency log ("what the agent has seen" with
  a per-item "forget" button).

---

## 10. Roadmap

Lifted from `docs/pivot/FEASIBILITY.md` § Phased v1.0 MVP Build Plan
+ this project's actual cadence.

- **Phase 0 — Spike (complete, 2026-05-22).** PixiJS hello-world,
  Electron + Steamworks ticket auth + wallpaper-mode revival on
  Win11 22H2+ (Lively port), Worker Tier 1 agent round-trip, all
  five integration checks green. (The "file the Steam Direct paperwork
  now" step was never filed and is retired — 2026-07-11 direction
  change, no Steam distribution.)
- **Phase 1 — Renderer foundations (in progress).** Cozette bitmap
  font, 5 themes (Solarized + Gruvbox + Catppuccin + Tokyo Night +
  IBM-3270), hand-rolled WFC + library-room tile bible, scale-ladder
  state machine (cell + district implemented; higher 4 stubbed),
  `playerPos.ts` revival, `scatter.ts` 2D rewrite, doc rewrites.
- **Phase 2 — Agent v0.** 4–6 agents with BT/utility-AI default
  (wander, sleep, idle). Spatially-bounded perception (radius FOV).
  Memory stream + SQLite + sentence-embedding retrieval. Tier 1 LLM
  calls on perception events. Loki personality system prompt.
- **Phase 3 — Pixel-art pipeline.** Python sidecar with `diffusers` +
  `nerijs/pixel-art-xl` LoRA; spawned on demand. VRAM detection →
  fall back to PixelLab.ai if < 8 GB. Pillow palette quantize to
  the active theme palette. Cache by `(appid, theme, prompt-template)`.
  Pre-generate a sprite set for the user's top 20 games on first run.
- **Phase 4 — Wallpaper polish (SHIPPED 2026-05-27).** Three-tier
  throttling (`full` / `throttled-1hz` / `paused`) via foreground-
  window poll every 1000ms (Steamworks `GetFriendGamePlayed` is NOT
  exposed by `steamworks.js` 0.4 per the 4A retro; foreground-rect
  matching against monitor bounds is the surrogate). Multi-monitor
  picker via tray submenu (4B). Ctrl+Alt+L peek hotkey via Electron
  `globalShortcut` (4C). `WorkerW destroyed` watchdog already shipped
  in Phase 0 revival.
- **Phase 5 — Reflection completion + sleep mode + lore.** See PLAN.md
  § Phase 5 for the slice breakdown (5R / 5A / 5B / 5C / 5D). 5A
  finishes what Phase 2D started — adds per-real-hour rate-limit,
  reflection-emits-plan, agents-execute-plans (lands agent-as-
  marginalia Depth 1 robustly). 5B adds the `SLEEPING` 4th throttle
  state per IDEAS.md's 2026-05-28 entry, with a morning-dispatch
  banner surfacing overnight reflections. 5C ships the text-only lore
  upload (`.txt`/`.md` → tiktoken chunking → local Ollama
  `nomic-embed-text` embeddings → memory store). 5D wires lore
  context into the Stage 1 manifest + persona prompts + scatter
  palette. **Per `docs/pivot/CONSOLIDATION.md`, weekly dream
  sequences DEFER to v1.x** — sleep mode's morning dispatch is the
  Depth-1 surface for v1.0. Share-URL revival is post-launch.
- **Phase 6 — Public release (REDEFINED 2026-07-11; was "Steam
  release").** No storefront: pick an OSS licence, flip the repo
  public, write the clone-and-run README (a stranger running on their
  own keys in ~10 minutes), record the demo (snapping-terminals
  crossing + wallpaper mode), tag a release. Store-page assets, the
  Content Survey, and the 30-day Steam Direct clock are all retired.
- **v1.x — Community content sharing (was "Steam Workshop
  integration").** Community-built templates, themes, lore packs
  (original universes) — shared GitHub-style, not via Workshop.
  **Free content only.** Static-baked-assets-only + curation before
  anything gets indexed; the heavyweight Workshop moderation pipeline
  scales down to match the venue. Per DESIGN.md "Workshop content
  axes" (now "community content axes", § 2.5).
- **Year 2** — Beyond Steam (multi-source via filesystem dream mode,
  Spotify / Letterboxd / GitHub / Goodreads integrations).
- **Year 3** — Year-in-Library annual moment, agent-to-agent across
  users (with permission), MCP server for agent-readability.
- **Year 5+** — Optionality (spatial computing port; agent-platform /
  MCP-native).

---

## 11. Open questions / risks

- **Output style drift between days** (pixel-art pipeline) — solved
  by IP-Adapter conditioning on a frozen reference image + a small
  custom LoRA per template, as documented in Scenario's Multi-LoRA
  guidance.
- **Per-user pixel-art cost at scale** — solved by tiered offload
  (local SDXL if VRAM detected, PixelLab cloud fallback if not) +
  aggressive caching (regenerate only when library state changes).
  (2026-07-11: users run on their own keys, so scale cost is
  self-funded per user; the old ≤ $1/user/month figure survives as the
  default-config sanity bar.)
- **WorkerW destroyed on Windows insider builds** — solved by the
  Lively-port watchdog pattern (2-second `IsWindow` poll; on
  destruction, re-`SendMessageTimeout 0x052C` to Progman and re-run
  the full enterWallpaper sequence). Already wired in
  `desktop/src/wallpaper/windows.ts` from Phase 0 revival.
- **Persistent agent memory bloat** — cap memory stream at N=1,000
  entries per agent; age out via importance × recency decay; FTS5 +
  sqlite-vec keep retrieval fast at that cap.
- **Local LLM ceiling** — Qwen 2.5 7B is fine for prompt iteration
  but ships below frontier on Tier 1+2 quality. The shipped default
  stays a frontier model; never default `LLM_PROVIDER=local` in any
  deployed Worker (local is an explicit self-hoster opt-in).
- **Determinism** — any `Math.random()` in `src/procedural/` silently
  breaks the WFC + share-URL contract. Lint or test-enforced.
- **Valve AI policy — Live-Generated guardrails** — RETIRED 2026-07-11
  (no Steam distribution; see § 8.1). Still worth keeping regardless
  of storefront: the ability to run without any runtime AI (curated
  default-template pool as fallback) is good resilience.
- **Community-content moderation** (v1.x; was "Workshop moderation
  timebomb" — Steam Workshop retired 2026-07-11). The rule that
  survives: community templates are static baked assets only — no
  live AI generation from community content. The storefront-scale
  pipeline (image-moderation API, pre-publish queue, DMCA flow,
  remote kill-switch) scales down to curation-before-indexing for
  GitHub-style sharing.
- **Steam Direct launch logistics** — RETIRED 2026-07-11 (no Steam
  distribution; the $100 fee, 30-day wait, Coming Soon window, AI
  Content Survey, and partner onboarding all fall away).
- **Privacy / dream mode** (year 2). Filesystem access through
  per-folder opt-in only. When local-files mode is on, the LLM
  router MUST refuse all non-local providers (boolean in the
  provider registry, validated on every dispatch). Transparency
  log as a first-class UI surface, not a settings page.

---

## 12. Art direction

**The terminal aesthetic is the moat.** Visual coherence is craft (one
palette per template, one font, one tile-bible style), with pixel-art
generation as a curated input to the asset side at template-build time,
never at runtime.

- **One theme per scene template.** Solarized's blue/orange accents
  fight Catppuccin's pastel-everything in the same scene. Per-template,
  one palette. Users pick the active theme; the renderer doesn't mix.
- **Generate 5–10 candidates per asset, hand-pick the best, throw the
  rest out.** AI quality is variable — the curation pass is what
  turns "AI slop" into "custom art." Same discipline that worked for
  Meshy in the 3D-era survives unchanged.
- **Bake survivors statically** into `public/sprites/{template_id}/`.
  No runtime generation; everything is paid for once at template-build
  time and shipped as static assets.
- **The template's sprite whitelist** (passed to Tier 1+2 prompts) only
  contains survivors. The LLM cannot pick a sprite we haven't shipped.
- **Sub-character animation is the medium's advantage** over true TUI.
  Walk between cells, fade, glow, particle. The renderer is a sprite
  engine pretending to be a terminal; lean on that.
- **Cozette ships permissive; future fonts must too.** Berkeley Mono
  is paid commercial; Cascadia Mono + Iosevka are free + .ttf and need
  msdf-bake. Whichever ships in v1.0 must carry a licence compatible
  with public open-source redistribution (the repo is public —
  2026-07-11 direction change).

Past Phase 3, commissioned custom hero sprites from paid pixel artists
become the polish move for hero templates on the most-loved themes.
The pipeline gets us to "every template ships with custom art" cheaply;
commissioned art is the v1.0+ tier above that.

---

## 13. What's needed to keep building

All keys live in `worker/.dev.vars` — the Worker is the single AI
orchestration surface; the frontend never holds an API key.

1. **Anthropic API key.** Required for Tier 1+2 LLM. Set as
   `ANTHROPIC_API_KEY`.
2. **Steam Web API key.** Free at https://steamcommunity.com/dev/apikey.
   Set as `STEAM_WEB_API_KEY`.
3. **Twitch developer credentials** (Client ID + Client Secret) for
   IGDB. Free at dev.twitch.tv. Set as `TWITCH_CLIENT_ID` and
   `TWITCH_CLIENT_SECRET`.
4. **PixelLab.ai API key.** Cloud fallback for the pixel-art pipeline
   (Phase 3+). Set as `PIXELLAB_API_KEY`.
5. **(Optional) Stable Audio + ElevenLabs API keys** for Phase 5+
   audio + optional reveal narration.
6. **(Optional, dev) Ollama running locally** with `qwen2.5:7b` pulled.
   Set `LLM_PROVIDER=local` in `worker/.dev.vars`. Never the shipped
   default (explicit self-hoster opt-in only).
7. **Cloudflare account** for Workers + Pages + KV. Free tier is plenty.
8. ~~**Steamworks partner account**~~ — RETIRED 2026-07-11 (no Steam
   distribution; the dev appid 480 covers the SDK launch path). The
   replacement release-gating input, the OSS licence choice, resolved
   same day: **MIT** (`LICENSE` at repo root). Remaining: flip the
   repo public.
9. **Harry's Steam ID** for the dev loop and permission to use his
   library as the first real test case.
10. **A starting theme + lore default.** Phase 1 ships Solarized Dark
    as the default; Phase 5's lore-upload pipeline needs a sensible
    "no lore uploaded" default world for first-run UX.

---

# Appendix A — 3D-era SPEC (archived 2026-05-22)

Historical context for the 3D LibraryWorld build that reached v0.5 before
the May 2026 pivot to Memory Palace. The decisions below were ratified
at the dates shown; many remain load-bearing for Memory Palace (Steam
auth flow, behavioural profile, library-state mapping, deterministic
procedural layout — all transferred). Others were superseded by the
pivot (Three.js + r3f rendering, Meshy 3D-asset pipeline, diegetic
launch rituals). Preserved verbatim for Phase 2's "what survived the
pivot" framing and for the launch-obligations narrative.

> # LibraryWorld — Spec
>
> **One-line pitch:** A small inhabitable 3D world that *is* your Steam library. The world is AI-generated from a behavioral profile of how you actually play — not from genre tags. Games are launched diegetically by interacting with objects in the world; the launch animation *is* the loading screen.
>
> **Status (2026-05-17):** Committed project, post-pivot, with a revised product direction. An earlier 2D Phaser prototype was retired after walking it made clear the LLM-personalisation layer, not the rendering medium, was the missing piece. The active build is 3D + LLM-personalised, on Three.js + react-three-fiber. The 2026-05-17 revision ratifies Electron as the native wrapper (§2.2, §6.2) and expands v0.5 scope to include the share-URL contract as a first-class deliverable, not a v0.6+ deferral (§10).
>
> **Product direction (revised 2026-05-16):** the destination is a Steam-distributed desktop utility — one-time purchase (~$7–10), distributed via Steam, lives as a live wallpaper / alt-tab destination, walkable in full-screen explore mode, launcher when you want it. The web version (current build) becomes the public-share surface (anyone can view a shared world URL in their browser; making your own requires the Steam app). Steam Workshop for community-built templates is the post-v1.0 long-term moat. The roadmap in §10 reflects this revision; §2.2 (Platform) and §6 (Tech stack) are revised accordingly.
>
> ## 1. Vision
>
> Steam's library is a grid. This is its opposite — a small inhabitable place that reflects how you actually *relate* to games. Three layered ideas held it together:
>
> **1. Library as spatial self-portrait.** The world reflects your *relationship* to games, not just their genre. Most-played titles were big, lived-in structures with worn paths between them. The backlog sat as unopened crates collecting dust in a corner. Completed games became museum pieces with stats etched in. Recently-played glowed. Long-abandoned gathered cobwebs.
>
> **2. AI as world-author, seeded by behavior.** Procedural generation read a *behavioral profile*: completion fraction (Steam playtime crossed against HLTB), binge vs sample patterns, session timing, replay behavior, achievement chase rate, IGDB metadata. From that, Claude picked one organising metaphor for the whole library — a city, forest, research institute, pre-war seaside town — and translated every significant game into that metaphor's vocabulary.
>
> **3. Diegetic launch rituals.** Loading screens became transitions, not waits. Walk up to a game-object and the launch was a per-game animation: a book opens and the world inside bleeds outward; a lantern lights and the screen darkens to its color; a case file opens; you sit at a campfire. The return trip mattered as much as the launch.
>
> It should feel like the start screen to a JRPG that knows you.
>
> ## 2. Decisions
>
> ### 2.1 Dimensionality → 3D, low-poly (Three.js + react-three-fiber)
>
> Decided 2026-05-12 after walking the 2D pixel-art prototype and finding that, even fully polished, the 2D medium couldn't deliver "visually striking" without art investment we didn't have. **Superseded 2026-05 by the Memory Palace pivot** — see this spec's §2.1 for the rationale.
>
> ### 2.2 Platform → Web for share; native desktop for the real product
>
> Two surfaces, two jobs. Web build is the public share surface (any browser + Steam installed = launchable). Native desktop app is the real product, Electron-wrapped from v0.6, distributed on Steam at v1.0. **Memory Palace inherits this two-surface model unchanged.**
>
> ### 2.3 AI approach → Claude picks metaphor + casting; procedural code picks positions; Steam CDN art skins the recognition face
>
> The LLM piece was the core of v0.1 of the 3D build. Pipeline: behavioural profile (deterministic) → Stage 1 Claude call (metaphor + per-game casting + role text) → procedural layout (deterministic, v0.5+) → state tagging (deterministic) → texturing from Steam CDN. **Transferred to Memory Palace, modulo the renderer:** the behavioural profile + state tags + deterministic procedural layout all survive; the Stage 1 "metaphor + casting" prompt is retired in favour of Phase 2's Smallville agent reflection (the metaphor becomes Loki's perspective on the library, not a placement contract).
>
> ## 3. Architecture (3D-era)
>
> Web client OR desktop app (Three.js + r3f + Rapier) → Backend (Cloudflare Worker) → Steam Web API + HLTB + IGDB + Anthropic. Template-build pipeline (offline, curated, baked): Stages 2–6 (Blockade Labs skyboxes, Midjourney / FLUX textures, Meshy / Tripo / TRELLIS-2 hero 3D, Stable Audio + ElevenLabs Music, optional ElevenLabs TTS narration).
>
> Data flow on first load: Steam OpenID → GetOwnedGames → enrichment (HLTB + IGDB, cached) → behavioural profile → Stage 1 Claude call returning world_manifest → state tagging → client receives manifest + runs procedural layout from v0.5+ → loads Three.js + baked template assets + Steam header.jpg per game → WASD/PointerLockControls walking with Rapier physics → interact triggers per-archetype ritual + `steam://run/{appid}`.
>
> Share-URL flow: a shared world URL encoded the profile seed + manifest. Any browser could open it via the web viewer and walk through the world (read-only).
>
> ## 4. Library-state mapping (3D-era)
>
> | State | Trigger | Visual treatment |
> |---|---|---|
> | `loved` | Top decile playtime, recent (≤30d), completion fraction > 1.0 | Larger scale, glowing accents, worn paths |
> | `recent` | Played within last 7 days | Soft light, fresh state |
> | `mastered` | Completion / achievement % > 80, or HLTB completionist hours met | Plaque, trophy, museum-case |
> | `abandoned` | 1–5h then dropped > 90 days ago AND completion fraction < 0.3 | Mid-sentence state, dimmed |
> | `dusty` | Owned, never played | Crate, sheet, gathering dust |
>
> **Transferred verbatim to Memory Palace** (this spec §5).
>
> ## 5. Diegetic launch rituals (3D-era — retired)
>
> | Archetype | Fits | Launch ritual | Return ritual |
> |---|---|---|---|
> | Lantern / brazier | Hollow Knight | Lantern lights; flame engulfs view; fade to game | Lantern remains lit nearby |
> | Case file | Disco Elysium | File opens; pages turn; fill screen | New bookmark in file |
> | Campfire | Outer Wilds | Sit down; fire crackles; fade to dusk | Campfire still warm |
> | Arcade cabinet | Hades, Slay the Spire | Insert coin; CRT flicker; screen fills | Cabinet shows attract-mode loop |
> | Workbench | Factorio, Terraria | Wipe sawdust; pick up tool; zoom in on hands | New sketches pinned to it |
> | Door | Generic fallback | Door opens; corridor of light | Door closes behind you |
>
> Rituals were short (1.5–3s) and served as the loading screen. **Retired in the pivot** — Memory Palace's interaction model is agent-mediated (Phase 2+), not per-game-archetype.
>
> ## 6. Tech stack (3D-era — superseded)
>
> Three.js + react-three-fiber + drei + @react-three/rapier + Vite + React + TS + Cloudflare Workers + KV + Steam OpenID (web) / Steamworks SDK (desktop v0.6+) + HLTB + IGDB + Cloudflare Pages + Zustand + Electron (v0.6 decision) + Anthropic Claude Opus 4.7 (Stage 1) + Qwen 3 14B local (dev) + Blockade Labs Skybox (Stage 2) + Midjourney/FLUX (Stage 3) + Meshy/Tripo/TRELLIS-2 (Stage 4) + Stable Audio + ElevenLabs Music (Stage 5) + ElevenLabs TTS (Stage 6 optional) + Kenney/Quaternius/Poly Pizza CC0 (3D filler).
>
> **Memory Palace inherits:** Cloudflare Workers + KV, Zustand, Anthropic, Ollama dev mode, Steamworks SDK via Electron + steamworks.js, HLTB, IGDB, Steam OpenID fallback. **Memory Palace replaces:** Three.js → PixiJS, Meshy → pixel-art SDXL+LoRA pipeline (Phase 3+), Blockade Labs skyboxes / Midjourney+FLUX textures / Kenney+Quaternius+PolyPizza 3D filler → bitmap-font + WFC tile composition.
>
> ## 7. Data integrations (transferred verbatim)
>
> ### 7.1 Steam
>
> OpenID 2.0 at `https://steamcommunity.com/openid/login`. With Steam Web API key:
> - GET /IPlayerService/GetOwnedGames/v1/        ← playtime, names, icons
> - GET /IPlayerService/GetRecentlyPlayedGames/  ← last-played, recency
> - GET /ISteamUserStats/GetPlayerAchievements/  ← completion % (per-game, where public)
>
> Artwork URLs (free to hotlink):
> - Header (460×215): `https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg`
> - Library hero (1920×620): `.../apps/{appid}/library_hero.jpg`
> - Capsule (231×87): `.../apps/{appid}/capsule_231x87.jpg`
>
> Launching: `window.location.href = steam://run/${appid}` (web) or Steamworks SDK launch (desktop v0.6+).
>
> ### 7.2 HowLongToBeat
>
> No official API. Community-reverse-engineered JSON endpoint. Worker-side calls with aggressive caching. `completion_fraction = playtime_hours / main_story_hours` feeds state tagging.
>
> ### 7.3 IGDB
>
> Twitch developer credentials → OAuth Client Credentials → IGDB REST. Per-appid enrichment: genres, themes, perspectives, franchises, summary, game_modes. Cached per-appid, TTL ~30 days.
>
> ## 8. The AI prompt (3D-era — retired)
>
> System: *"You are a world designer for a personalised library world... pick one organising metaphor... cast each significant game as an archetype in that metaphor's vocabulary... return strict JSON..."* User prompt enumerated behavioural profile + top-N enriched games; expected output included `organising_metaphor`, `metaphor_rationale`, `atmosphere`, `scene_template` (whitelisted), `skybox_id`, `audio_id`, `object_archetypes`, `scene_layout`, `backlog_treatment`. **Retired** — Memory Palace's Tier 1+2 prompts target agent dialogue / reflection, not world casting.
>
> ## 9. v0.1 — 3D vertical slice (shipped)
>
> Seaside town template, Meshy-curated hero objects (lighthouse, fish market, detective's office, harbour-master's hut, fishing boats), hard-coded library of 7 games, one Claude call returning the world manifest, scene assembled with Steam header.jpg textured onto recognition faces, WASD + PointerLockControls + Rapier physics, walk-up-and-press-E ritual, `steam://run`, return ritual on tab-focus.
>
> ## 10. Roadmap (3D-era — superseded)
>
> v0.1 → v0.2 (Steam OpenID + HLTB) → v0.3 (IGDB + multiple templates) → v0.4 (library-state visual treatment) → v0.5 (procedural layout + share-URL) → v0.6 (Electron wrapper + Steamworks + wallpaper mode) → v0.7–0.9 (polish cluster) → v1.0 (Steam launch, 3–5 templates) → v1.x (Steam Workshop). v0.5 shipped 2026-05; v0.6 was next when the pivot happened.
>
> ## 11. Open questions / risks (3D-era; many transferred)
>
> Steam ToS, HLTB unofficial endpoint, IGDB rate limits, `steam://` browser warnings, large libraries (top-N + dusty backlog), NSFW artwork in headers, performance (~50 textured low-poly objects fine on desktop; web bundle bandwidth-sensitive), Rapier WASM size, cost (~one Stage 1 LLM call per regenerate runtime + bounded template-build costs), local LLM ceiling, procedural determinism, return-trip-detection lie (focus event in web), Valve AI policy guardrails for Live-Generated, Workshop moderation timebomb, Steam Direct launch logistics ($100 fee, 30-day wait, Coming Soon ≥2 weeks, AI Content Survey).
>
> **All transferred to Memory Palace** modulo the rendering medium. The Steam Direct paperwork is the long pole regardless of build.
>
> ## 12. Art direction (3D-era — superseded)
>
> AI asset generation allowed at template-build time with strict curation. Per-game art from Steam CDN. One coherent direction per template via shared prompt suffix. Generate 5–10 candidates per asset, hand-pick. Bake survivors. Whitelist constrains the LLM. Cost ceiling: Meshy free tier ~200 credits/month, enough per template.
>
> Four levers: one style per template, lighting (HDRI + real-time shadows + time-of-day), post-processing (bloom + ACES + DOF + fog), camera and composition.
>
> **Superseded by Memory Palace §12** — terminal-aesthetic taste moat replaces 3D-aesthetic technology bar.
>
> ## 13. What's needed to keep building (3D-era)
>
> Anthropic, Steam Web API, Twitch (IGDB), Stable Audio, ElevenLabs, Blockade Labs Skybox, (optional) Gemini/OpenAI keys for Stage 1 eval, (optional dev) Ollama with qwen3:14b, Cloudflare account, Steamworks partner account (v0.6+), Harry's Steam ID, scene-template aesthetic pick. **Memory Palace's input list (§13) is the active version**; the 3D-era list is preserved here for completeness.

---

*End of 3D-era SPEC archive.*
