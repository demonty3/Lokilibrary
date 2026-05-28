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

**Product direction.** A Steam-distributed desktop utility, ~$15–20 one-time
purchase. Designer-led, LLM-assisted, solo build. Open-source engine + default
world-pack on GitHub (credibility, dev audience); curated themed product +
Workshop / cloud sync / achievements sold on Steam. Workshop content stays
free (Wallpaper Engine's lesson).

## Current phase

**Phases 0 / 1 / 2 / 3 (partial) / 4 complete (2026-05-27). Phase 5 —
reflection completion + sleep mode + lore — next.** See
`docs/INDEX.md` for the authoritative-doc map and
`docs/pivot/CONSOLIDATION.md` for v1.0 scope.

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

**Phase 5 (next)** finishes the agent layer. Per `PLAN.md` § Phase 5:
slice 5R (docs reconciliation), 5A (reflection rate-limit + plan
output + agents execute plans → lands agent-as-marginalia Depth 1),
5B (`SLEEPING` 4th throttle state + morning dispatch per IDEAS.md
2026-05-28), 5C (text-only lore upload via `nomic-embed-text`), 5D
(lore-driven Stage 1 manifest + persona + scatter adaptation). Per
`CONSOLIDATION.md` v1.0 scope: dream sequences DEFER to v1.x; image /
URL lore ingestion + sparse-input follow-up defer to 5C-follow-ups.

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
  technique via koffi FFI.
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
target: **≤ $1/user/month at Claude Sonnet rates** for the full agent
runtime. Telemetry from day one: log `{agent_id, tier, tokens_in,
tokens_out, latency_ms, model, provider}` for every Tier 1/2 call.

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

**Desktop wrapper (third terminal — Windows-native Node, not WSL):**

```
cd desktop
npm install
npm run dev       # tsc + electron pointing at localhost:5183
```

WSL Ubuntu can build and lint `desktop/` but **cannot run the Electron
app**: WSL Linux can't reach Windows Steam (steamworks.js init fails on
`steamclient.so`), and WSLg's GPU passthrough chokes Chromium. Frontend
(Vite) + Worker (wrangler) can stay in WSL; the desktop terminal needs
to be Windows-native PowerShell/cmd with Windows Node installed.
One-time setup per `desktop/STEAMWORKS_SDK_LICENSE.txt` neighbours: drop
the Steamworks SDK's `redistributable_bin/<platform>/` into
`desktop/sdk/redistributable_bin/<platform>/`, create
`desktop/steam_appid.txt` containing `480` (SpaceWar) for dev or your
real appid post-partner-approval.

**Local LLM dev mode (optional, recommended for Tier 1 iteration):**

```
ollama pull qwen2.5:7b           # one-time
ollama serve                      # background daemon at http://localhost:11434
# Set LLM_PROVIDER=local in worker/.dev.vars
npm run worker                    # now hits Ollama instead of Anthropic
```

Phase 0 Tier 1 round-trip on CPU is ~27s; expected <1s once Ollama detects
the GPU (Phase 2 follow-up — see RETROS/phase-0-spike.md § pending
follow-ups). Anthropic Haiku 4.5 latency was ~1.7s in Phase 0 — fine for
dev work in the meantime.

## Open inputs needed from Harry

- Anthropic API key (`ANTHROPIC_API_KEY` in `worker/.dev.vars`)
- Steam Web API key (`STEAM_WEB_API_KEY`)
- Twitch Client ID + Secret for IGDB (`TWITCH_CLIENT_ID`,
  `TWITCH_CLIENT_SECRET`, from Phase 2 enrichment work)
- PixelLab.ai API key (`PIXELLAB_API_KEY`, from Phase 3 cloud fallback)
- ElevenLabs API key (`ELEVENLABS_API_KEY`, optional, from v0.8+ for
  reveal narration)
- Steamworks partner account (in progress for v1.0 launch; required
  before shipping with a real appid)

## Things to NOT do

- **Default to template-build-time generation; runtime generative API
  calls require explicit scoping.** Phase 0 has exactly one runtime AI
  call (Tier 1 agent tick). Phase 2 adds Tier 2 reflection. Phase 3
  pixel-art is *template-build-time only*. New runtime AI calls require
  an entry in this file documenting cost model, caching strategy, and
  fallback before shipping.
- **Don't ship local LLM to production.** Local is for dev iteration only.
  The Tier 1+2 quality ceiling on a 12GB-VRAM-class model is meaningfully
  below frontier; agent dialogue is the magic surface.
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
- **Don't monetize Workshop content** (when Workshop opens, v1.x).
  Workshop templates / themes / lore packs stay free, full stop.
  Wallpaper Engine tried a paid item store and shut it down over
  verification / codec-licensing / buyer-confusion problems; we don't
  repeat that. Monetization is on the base-app price and (later, if
  needed) on first-party DLC template packs we curate ourselves.
- **Don't run the Electron desktop wrapper from WSL.** Linux Electron-
  in-WSL can't reach the Windows Steam client, so `steamworks.init()`
  always fails on `steamclient.so`; WSLg's graphics passthrough also
  chokes the renderer's GPU process. Use Windows-native Node for
  `desktop/` (frontend + worker can stay in WSL).
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
