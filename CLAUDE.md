# Memory Palace — Claude Code rules

## What this project is

A terminal-aesthetic 2D pixel-art **memory palace** — your Steam library as
an inhabitable place populated by a society of semi-autonomous LLM-driven
agents who explore, build, and respond to events. Lives as a live wallpaper
and an alt-tab destination, doubles as a launcher. Stylised pixel art that
*reads* as rich ASCII/terminal: sprites built from box-drawing characters,
block elements, and unicode glyphs at sprite resolution, themeable to
editor colour schemes (Solarized / Gruvbox / Catppuccin / Tokyo Night /
IBM-3270).

**Origin.** This project pivoted in May 2026 from **LibraryWorld** — a
3D Three.js Steam-library visualiser that reached v0.5. The pivot rationale,
the design pillars, and the technical feasibility analysis live in
**`docs/pivot/DESIGN.md`** + **`docs/pivot/FEASIBILITY.md`** — read those
first for the full vision; **`SPEC.md`** is the consolidated long-form spec;
this file is the day-to-day rulebook. The 3D-era spec is preserved as
SPEC.md Appendix A for historical context; the 3D codebase lives in
`legacy-3d/` for reference.

**Product direction (changed 2026-07-11).** A free, public open-source
project — the aim is to make something really cool, not to make money.
Designer-led, LLM-assisted, solo build. The whole product ships on GitHub:
engine, default world-pack, themes. Users bring their own API keys
(Anthropic + Steam Web API; BYO-key). The deliverable bar: a stranger can
clone the repo and have a living palace running on their own keys in
~10 minutes, plus one killer demo moment (the snapping-terminals
crossing). No Steam distribution, no price tag, no paid channels — the
earlier Steam-at-~$15–20 hybrid model is retired (SPEC.md § 2.5 has the
supersession note). The repo is public, so licence hygiene (fonts, audio,
art, Steam-CDN recognition-surface rules) does NOT relax.

## Current phase

**Phases 0–5 + the desktop wrapper shipped; the build then ran ahead into
Phase 7 (v2.x: real scale ladder, multi-pane terminal UI, seam-walking
agents). A consolidation / verification pass is in progress (2026-06)** — the
first real on-screen verification of Phase 5D–7, most of which had only ever
been smoke-tested headlessly under WSL until the desktop app started booting
on macOS. **`STATE.md` is the present-tense source of truth** (this section
summarises; STATE.md is authoritative); `TODO-USER.md` holds the verification
backlog, `docs/INDEX.md` the authoritative-doc map, `docs/pivot/CONSOLIDATION.md`
the v1.0 scope. **Still open: finishing the visual pass + desktop-surface
QA, then demo readiness (clone-and-run README + the snapping-terminals
demo). The Steam release gate (electron-builder packaging + Steam Direct
+ AI-content disclosure) was RETIRED by the 2026-07-11 direction change,
and the ship-v1.0-vs-expand-v2.x decision resolved with it: consolidate
to demo-ready, then expand into the snapping-terminals arc.**

**Phase 0** (2026-05-22) shipped the integration spike: PixiJS v8 boot
+ Solarized theme, Electron wrapper + Steamworks SDK + wallpaper-mode
revival on Win11 22H2+ (Lively Progman-reparent port), Worker
`/api/agent/tick` Tier 1 round-trip, Mulberry32 PRNG + FNV-1a hash,
Steam OpenID + library fetch + behavioral profile. Retro at
`RETROS/phase-0-spike.md`.

**Phase 1** (2026-05-22) shipped renderer foundations: Cozette bitmap
font, multi-theme registry (Solarized/Gruvbox/Catppuccin/Tokyo
Night/IBM-3270), hand-rolled WFC, single-library-room cell renderer,
`cell → district → … → solar_system` scale-ladder (cell + district
implemented; higher levels stubbed), `playerPos.ts` + `scatter.ts`
2D rewrites.

**Phase 2** (2026-05-26) shipped the agent layer (slices 2A–2G):
SQLite + sqlite-vec + FTS5 memory stream, 5-agent cohort with
Tier-0 BT, spatially-bounded perception, Tier-1 Anthropic Haiku / local
Qwen routing, Tier-2 Sonnet reflection at threshold 150, bookshelf
launch + Loki marginalia, persona system, telemetry overlay, profile-
aware remount. Retro at `RETROS/phase-2.md`.

**Phase 3** (partial — 3A/3B/3C shipped) wired the pixel-art pipeline
scaffold: sprite-aware cell renderer, placeholder generator for all
non-floor tiles, PixelLab.ai bake script via Worker proxy. The
displayed-size question for 16×32 sprites on a 6×13 grid is unresolved
(documented in `src/render/sprites.ts:SLOT_DISPLAY` comment); resolves
when Phase 5 reveals the aesthetic requirements.

**Phase 4** (2026-05-27) shipped wallpaper polish: three-tier throttle
(`full` / `throttled-1hz` / `paused`), multi-monitor tray picker,
Ctrl+Alt+L peek hotkey. All verified end-to-end on a real Win11 raised-
desktop setup.

**Phase 5** (2026-05-28/29) finished the agent layer: 5A reflection
completion (rate-limit + plan output + agents execute plans), 5B `SLEEPING`
throttle + morning dispatch, 5C text-only lore upload (embed backbone +
store + drop-zone), 5D lore-driven palette / persona / scatter adaptation.
Retros `RETROS/phase-5*.md`.

**Phase 6 — desktop wrapper** shipped the Electron skeleton, Steam-ticket
auth, launch-via-Steamworks, wallpaper mode, multi-monitor perf, peek
hotkey. **The Steam *release* gate (packaging + Direct submission) is NOT
done.** **Phase 6A** rendered the local Ollama model as a world landmark.

**Phase 7** (2026-05-30/31, v2.x — ahead of `CONSOLIDATION.md`'s v1.0 scope)
built real island/continent renderers + scale ladder (7A), the multi-pane
terminal UI (7B), and seam-walking agents that cross pane boundaries (7D.2).

**Consolidation pass (2026-06, current)** — first on-screen verification on
macOS: cell aesthetic + agents-as-beings confirmed; carved the walkable seam
edge (`cell.ts:seamRows`) so the seam-walk is observable. Remaining:
desktop-surface QA (lore recolor / local-AI landmark / wallpaper) + the
ship-vs-expand decision. Retro at `RETROS/consolidation-2026-06.md`.

## Stack

- **PixiJS v8** (WebGL/WebGPU, falls back cleanly) — 2D sprite renderer
- **Cozette 6×13** — bitmap font baked as PNG + FNT atlas, no msdf-bake
  pipeline, ships in `public/fonts/`
- **Vite + React 19 + TypeScript** for build / dev / type-checking
- **Zustand** for app state in `src/state/` (auth, library, manifest,
  wallpaper mode, scale level)
- **Cloudflare Workers + KV** for the backend (the single AI orchestration
  surface; holds all server-side keys, caches Steam / HLTB / IGDB lookups,
  caches the Stage 1 manifest)
- **Electron + steamworks.js** for the desktop wrapper in `desktop/`
  (decided May 2026 — `steamworks.js` requires a Node host runtime; Tauri
  is rejected). Wallpaper mode ports Lively Wallpaper's Progman-reparent
  technique via koffi FFI on Windows; on macOS it sets the `NSWindow` to the
  desktop-picture window level through a koffi → Objective-C bridge
  (`desktop/src/wallpaper/macos.ts`), no reparenting.
- **HowLongToBeat** for per-game completion-time data (community endpoint,
  cached aggressively in the Worker)
- **IGDB** (Twitch credentials) for genre / theme / perspective enrichment
- **better-sqlite3 + sqlite-vec** (Phase 2) for the Smallville memory
  stream + FTS5 + vector retrieval

### Multi-model AI orchestration

Different models for different stages — all orchestrated from the Worker,
never directly from the frontend. Each provider is best-of-breed for its
stage; they are not interchangeable.

| Stage | Output | Production | Dev iteration |
|---|---|---|---|
| 0. Tier 0 agent tick | utility-AI / behaviour-tree action (no LLM) | n/a | n/a |
| 1. Tier 1 agent micro-action | structured JSON ({action, intent}) | Claude Haiku 4.5 | Qwen 2.5 7B via local Ollama |
| 2. Tier 2 reflection / planning | longer structured JSON, Smallville-style | Claude Sonnet 4.6 | same, or local Qwen 14B+ for capable users |
| 3. Pixel-art sprite gen (template-build) | PNG, palette-locked | local SDXL + `nerijs/pixel-art-xl` LoRA via diffusers; PixelLab.ai fallback if <8 GB VRAM | same |
| 4. Lore-upload embeddings | vector | `nomic-embed-text` via Ollama (local) | same |
| 5. Reveal narration TTS (optional, v0.8+) | speech audio | ElevenLabs | not used pre-v0.8 |

**Tiered router controls cost.** Tier 0 is the default tick at 1–10 Hz;
agents wander, sleep, do scheduled chores with no LLM call. Tier 1 only
fires on perception events. Tier 2 only fires on Smallville's
importance-threshold-150 reflection trigger or direct user interaction,
**AND** is per-agent rate-limited to 1 dispatch per real-world hour
(Phase 5 slice 5A; default `REFLECTION_MIN_INTERVAL_MS = 3600000`).
The rate-limit relaxes during Phase 5 5B's `SLEEPING` throttle state so
overnight reflection has room to populate the morning dispatch. Cost
discipline: users run on their own keys (BYO-key), so the router's job
is keeping the *default config* affordable — the old **≤ $1/user/month
at Claude Sonnet rates** target survives as a sanity bar, not a business
constraint; spending above it on the magic surface (richer reflection,
better models) is now a legitimate dial. Telemetry from day one: log
`{agent_id, tier, tokens_in, tokens_out, latency_ms, model, provider}`
for every Tier 1/2 call.

### Asset libraries

**Per-game art = Steam CDN, recognition surface only.** Use `headerImageUrl(appid)`
from `src/data/sampleLibrary.ts` as the recognition surface for each game
(book cover, the spine label on the shelf, eventually a small inset on
agent dialogue). This triggers the "oh I own that" beat; substituting
generated art for it weakens that beat. Same rule applies to non-Steam
games (itch.io, GOG, filesystem media in the year-2 dream-mode feature):
user-provided art only.

**Sprite tiles + agent sprites = pixel-art pipeline** (Phase 3; not in
v1.0 MVP). Generated at template-build time via local SDXL + the
`nerijs/pixel-art-xl` LoRA (OpenRAIL-M, commercial OK) or the PixelLab.ai
API fallback (commercial license on all paid plans). Outputs go through
Pillow `Image.quantize` against the active theme's palette, then
Astropulse PixelDetector for grid-snap. **Pre-v1.0 MVP renders with box-
drawing glyphs only** — pixel-art comes later.

**Tile composition = WFC** (`src/procedural/wfc.ts`) — hand-rolled
tiled-model solver seeded by `mulberry32(profileSeed)` from
`src/procedural/{prng,seed}.ts`. Tile bibles per district type in
`src/procedural/tiles/`.

## File layout

```
SPEC.md              — consolidated long-form spec (Memory Palace + 3D-era Appendix A)
CLAUDE.md            — this file (day-to-day rules)
PLAN.md              — phased build plan
IDEAS.md             — parked alternative directions (3D-era; review for porting)
docs/pivot/          — DESIGN.md + FEASIBILITY.md (authoritative pivot design)
docs/research/       — dated reference reports (historical)
RETROS/              — per-phase retros (phase-0-spike.md is the live one)

package.json         — PixiJS + Vite + React + TS
index.html           — single page; mounts React into #root
src/main.tsx         — React entry point
src/App.tsx          — top-level component; mounts PixiApp, owns keydown listeners + HUD
src/render/          — PixiJS rendering
  PixiApp.ts         — boot the Application, dispatch to level renderers
  fonts.ts           — Cozette loader + hexToInt helper
  levels/            — per-scale-level renderers (cell.ts, district.ts, stub.ts)
src/procedural/      — deterministic layout layer
  prng.ts            — Mulberry32 PRNG
  seed.ts            — FNV-1a profile-seed hash
  wfc.ts             — hand-rolled tiled-model WFC solver
  cell.ts            — cell-level layout (calls solveWfc + post-processes)
  scatter.ts         — 2D rejection-sampling scatter
  tiles/             — tile bibles per district type
src/themes/          — palette JSONs (one per theme) + Theme type + registry
src/state/           — Zustand store + module-local playerPos
src/agents/          — agent runtime (Phase 1: loki.ts test sprite; Phase 2: full Smallville)
src/api/             — fetch wrappers for the Cloudflare Worker backend
src/ai/              — types for the world manifest + Stage 1 prompt + parsing
src/data/            — hard-coded sample library, asset URL helpers
src/types.ts         — shared types
public/fonts/        — Cozette PNG + FNT + LICENSE
public/sprites/      — pixel-art sprite atlases (Phase 3+)
public/audio/        — ambient + interaction stings (Phase 5+)
worker/              — Cloudflare Worker (orchestrates Anthropic, Steam, HLTB, IGDB;
                       all keys live here; Stage 1 / Tier 1+2 LLM calls go here)
desktop/             — Electron wrapper (Steamworks SDK + wallpaper-mode revival)
legacy-3d/           — preserved 3D Three.js build (reference, not active)
legacy-desktop-v0.6/ — preserved v0.6 Electron wrapper (pre-prune; reference)
```

## How to work (general)

General coding-agent discipline (adapted from karpathy-skills). Biases
toward caution over speed; on trivial tasks, use judgment.

- **Think before coding.** State assumptions. If multiple readings of a
  request exist, surface them — don't pick one silently. If a simpler
  path exists, say so and push back. If something's unclear, stop and
  name what's confusing before implementing.
- **Simplicity first.** Minimum code that solves the stated problem — no
  speculative features, no abstractions for single-use code, no
  unrequested flexibility/config, no error handling for impossible
  scenarios. Reinforces the runtime-AI-scoping rule and "aesthetic
  coherence over scope creep" below.
- **Surgical changes.** Touch only what the request needs; don't refactor
  or reformat adjacent code, and match existing style even where you'd do
  it differently. Remove only the orphans your own change created — flag
  pre-existing dead code, don't delete it. Every changed line should
  trace to the request.
- **Goal-driven execution.** Turn the task into a verifiable goal ("fix
  the bug" → "write a failing test, then make it pass") and loop until
  it's verified. Here, typecheck + smoke are the ground truth.

## Conventions

- **Per-game art = Steam CDN, recognition surface only.** See "Asset
  libraries" above. Use `headerImageUrl(appid)` from
  `src/data/sampleLibrary.ts`. Never generate per-game art.
- **Pixel-art pipeline assets are baked at template-build time** (Phase 3+)
  with strict curation discipline: generate 5–10 candidates per asset,
  hand-curate the survivor, run through palette quantize + PixelDetector
  grid-snap, bake into `public/sprites/{template_id}/`. Stage 1's prompt
  whitelist for sprite IDs only references shipped survivors — the LLM
  never picks something we don't have.
- **All AI calls go through the Worker.** Anthropic, Ollama, PixelLab,
  ElevenLabs, embeddings — all keys live in `worker/.dev.vars`. The
  frontend never holds an API key. The Worker is the single AI
  orchestration surface.
- **Local LLM for dev iteration.** Ollama with Qwen 2.5 7B is the
  recommended dev-time Tier 1 model. Set `LLM_PROVIDER=local` in
  `worker/.dev.vars`. **Never ship local LLM to production** — local
  ceiling is meaningfully below frontier and agent dialogue is the magic
  surface.
- **Aesthetic coherence over scope creep.** One theme palette per scene
  template. Mixing palettes in a single scene reads as broken, not
  artistic. The terminal-aesthetic moat is taste, not technology.
- **Determinism in `src/procedural/`.** All randomness goes through a
  seeded PRNG. No `Math.random()` in that module. Same profile → same
  world is a hard requirement; the share-URL contract (when reintroduced)
  depends on it, and WFC reproducibility depends on it now.
- **Sub-character animation matters.** The renderer is pixel-art-that-
  looks-like-a-terminal, *not* a true TUI. Sprites can move between
  cells, fade, glow, particle. If a feature would force snap-to-cell
  movement only, push back — that loses the medium's whole advantage.
- **TypeScript strict mode.** Don't disable strict-mode flags without
  explicit reason.
- **Zustand state in `src/state/store.ts`** for app state. `playerPos.ts`
  is a *module-local singleton mutated at frame rate* — deliberately
  outside Zustand so 60Hz mutation doesn't trigger re-renders.
- **Application lifecycle:** the PIXI Application is created once per
  React mount; per-level rendering creates a Container added to
  `app.stage` and destroyed on level change. Don't destroy the
  Application on level transitions.
- **Game launching:** Electron wrapper uses Steamworks SDK directly;
  web build uses `steam://run/{appid}`. (Web build is the share-viewer
  surface; the launcher path runs in the desktop app.)

## How to run

```
npm install
npm run dev       # frontend, http://localhost:5183 (or auto-fallback)
npm run worker    # local Cloudflare Worker via wrangler, separate terminal
```

Both must be running for Tier 1+ LLM calls to work. The frontend without
the Worker still renders the scene with sample-library defaults.

You need Steam installed and running for `steam://run/{appid}` to launch
a game in the web build; the Electron wrapper goes through Steamworks
SDK directly.

**Desktop wrapper (third terminal):**

```
cd desktop
npm install
npm run dev       # tsc + electron pointing at localhost:5183
```

**macOS is the only build + verification platform (2026-07-17
direction).** The app boots Steam-less on macOS (`initSteam()` catches
the missing client and keeps running with Steam-gated features off);
the `.claude/skills/launch-desktop-app` skill encodes the verified
launch + CDP-driving recipe. The Windows/WSL setup the earlier phases
used is retired — the Win32 code paths (Progman-reparent wallpaper,
koffi throttle) stay in the tree as dormant surface for OSS
contributors, but we don't build, test, or gate on them.
One-time Steamworks setup (only needed for the launch-a-game path —
rendering + agents run without it), per
`desktop/STEAMWORKS_SDK_LICENSE.txt` neighbours: drop the Steamworks
SDK's `redistributable_bin/<platform>/` into
`desktop/sdk/redistributable_bin/<platform>/`, create
`desktop/steam_appid.txt` containing `480` (SpaceWar).

**Local LLM dev mode (optional — needs a box that can host Ollama):**

```
ollama pull qwen2.5:7b           # one-time
ollama serve                      # background daemon at http://localhost:11434
# Set LLM_PROVIDER=local in worker/.dev.vars
npm run worker                    # now hits Ollama instead of Anthropic
```

Harry's Mac can't host local models — dev iteration on this box uses the
Claude API (`LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` in
`worker/.dev.vars`; Haiku Tier-1 latency ~1.7s). The Ollama path remains
a self-hoster / contributor opt-in, never the default.

## Open inputs needed from Harry

- Anthropic API key (`ANTHROPIC_API_KEY` in `worker/.dev.vars`)
- Steam Web API key (`STEAM_WEB_API_KEY`)
- Twitch Client ID + Secret for IGDB (`TWITCH_CLIENT_ID`,
  `TWITCH_CLIENT_SECRET`, from Phase 2 enrichment work)
- PixelLab.ai API key (`PIXELLAB_API_KEY`, from Phase 3 cloud fallback)
- ElevenLabs API key (`ELEVENLABS_API_KEY`, optional, from v0.8+ for
  reveal narration)
- ~~OSS licence choice~~ — DONE 2026-07-11: **MIT**; `LICENSE` file at
  repo root; repo public since 2026-07-11 (secrets pass came back clean)
- ~~Steamworks partner account~~ — RETIRED 2026-07-11 (no Steam
  distribution; dev appid 480 covers the SDK launch path)

## Things to NOT do

- **Default to template-build-time generation; runtime generative API
  calls require explicit scoping.** Phase 0 has exactly one runtime AI
  call (Tier 1 agent tick). Phase 2 adds Tier 2 reflection. Phase 3
  pixel-art is *template-build-time only*. The T2 society migration
  (2026-07-17) adds ONE runtime AI call: Tier-1 on terminal-land
  arrival — trigger: a seam-crossing arrival queues a perception event,
  drained on the walker's re-pick cadence through the UNCHANGED
  routeTier1 (per-agent tier1ThrottleMs 30–120 s; Visitor/Ghost 0 —
  bounded by arrival-gating + crossing physics). Cost: bounded by the
  crossing rate — a few Haiku calls/hour on an active desk, zero idle,
  zero key-free. Caching: none (each call is a fresh perception).
  Fallback: the pure land intent engine; transport failure stamps the
  throttle and the walker never blocks. Telemetry: existing logTier1
  rows. New runtime AI calls require an entry in this file documenting
  cost model, caching strategy, and fallback before shipping.
- **Don't make local LLM the shipped default.** With BYO-key open source
  there is no "production", but the default config stays a frontier
  model: the Tier 1+2 quality ceiling on a 12GB-VRAM-class model is
  meaningfully below frontier, and agent dialogue is the magic surface.
  Local (Ollama) is a legitimate *explicit opt-in* for dev iteration and
  self-hosters — never the out-of-the-box path.
- **Don't conflate the AI stages.** The Tier 1 LLM (Haiku/Qwen) doesn't
  generate sprites; the pixel-art pipeline doesn't generate dialogue;
  the embedding model doesn't generate text. Each stage has its own
  specialist. If a feature seems to need image/audio/sprite generation
  at runtime, it's wrong — push it to template-build time or rework.
- **Don't try to extract assets from local Steam game files.** Copyrighted,
  sometimes encrypted, per-game integration nightmare. The recognition
  surface is Steam's published CDN art; that's it.
- **Don't put any API key in the frontend bundle.** Always proxy via the
  Worker. The Electron renderer is a frontend too — keys live in main-
  process env via `worker/.dev.vars` mirrored at deploy.
- **Don't bundle large npm packages (>500KB gzipped) into the web build
  without flagging.** The web build is the public share surface;
  bandwidth-sensitive. PixiJS v8 + React 19 + Zustand is the heavy
  baseline. Electron wrapper has more headroom but the web bundle still
  ships and the constraint applies there.
- **Don't break the Tier 1+2 whitelists.** The LLM must only pick agent
  actions / tile IDs / sprite IDs / archetype IDs we actually ship.
  Widen the whitelist deliberately, not by editing the prompt to "be
  more creative."
- **Don't reach into `legacy-3d/` or `legacy-desktop-v0.6/`.** They're
  preserved as references; not part of the active build. Lift specific
  files (already done for Mulberry32, FNV-1a, and Phase 1's `playerPos`
  + `scatter`); don't reactivate the rest.
- **Don't add `Math.random()` anywhere in `src/procedural/`.**
  Determinism is the WFC + share-URL contract. Use `mulberry32(seed)`.
- **Don't ship Suno or Udio audio in any committed build.** The legal
  situation around their training data is actively contested as of
  2025–2026 and Steam has flagged submissions using these outputs.
  Stable Audio 2.5 + ElevenLabs Music have clear commercial-use terms
  and stay our defaults for Phase 5 baking; if a track needs to come
  from anywhere else, use Epidemic Sound / Artlist (subscription, broad
  license) — never Suno/Udio.
- **Don't monetize, period** (2026-07-11 direction change). No price
  tag, no DLC, no paid channels — the project is free and open-source.
  If community content sharing ever exists (templates / themes / lore
  packs, GitHub-based now that Steam Workshop is off the table), it
  stays free too; Wallpaper Engine's paid-store lesson (verification /
  codec-licensing / buyer-confusion) still applies. What "free" does
  NOT relax: licence hygiene on fonts, audio, art, and Steam CDN usage
  — the repo is public.
- **Don't target Windows/WSL for build or verification** (2026-07-17
  direction: Mac-only). The Win32 wallpaper (Progman reparent) and
  koffi throttle paths stay in-tree as dormant OSS surface for
  contributors; don't extend them, don't gate any slice on a Windows
  pass, and don't propose WSL / Windows-native-Node setups in docs or
  TODOs.
- **Don't make the agent a chatbot.** Per IDEAS.md "agent-as-marginalia":
  the agent expresses itself through what changes in the world — what
  gets placed, what notes appear, what paths wear deeper. No floating
  speech bubbles, no summon-the-librarian chat. The agent's contribution
  is *spatial*, not conversational. This is the design moat.
- **Don't bolt on filesystem access without the per-folder opt-in
  pattern.** The year-2 dream-mode feature uses Electron's
  `dialog.showOpenDialog({ properties: ['openDirectory'] })`; never
  `fs.readdir` outside an explicit user-picked folder. When local-files
  mode is on, the LLM router MUST refuse all non-local providers
  (boolean in the provider registry, validated on every dispatch).
  Obsidian vault model for the picker; Raycast transparency-log for
  "what the agent has seen."
