# LibraryWorld — Claude Code rules

## What this project is

A small inhabitable 3D world that *is* your Steam library — personalised by an LLM from the user's actual playing behavior, not from genre tags. Each significant game appears as an archetype-cast object in the world (a lighthouse, a campfire, a bookshelf, a workbench, an arcade cabinet, etc.). Walking up to an object and pressing E — or clicking — triggers a brief diegetic "launch ritual" animation, then fires `steam://run/{appid}` to launch the game in Steam.

**Product direction (revised 2026-05-16):** the destination is a Steam-distributed desktop utility — one-time purchase (~$7–10), distributed via Steam, lives as a live wallpaper / alt-tab destination, walkable in full-screen explore mode, launcher when you want it. The web version (current build) becomes the public-share surface (anyone can view a shared world URL in their browser; making your own requires the Steam app). Steam Workshop for community-built templates is the post-v1.0 long-term moat.

The full design doc is **`SPEC.md`** — read it for the broader vision (behavior-driven AI metaphor, diegetic launch rituals, library-state mapping). **This file is the day-to-day rulebook.**

## Current phase

**v0.2–v0.5 done. v0.6 (Electron wrapper) is the next major.** v0.1 shipped the painted-3D + LLM slice on a hard-coded library. v0.2 swapped in the player's real Steam library (OpenID + GetOwnedGames + recency + achievements + HLTB + behavioral profile + SPEC §4 state tags + session-driven `/api/world`). v0.4 added per-state visual treatment + the dusty backlog cluster. v0.5 moved position-picking out of the LLM into a deterministic seeded procedural layer (`src/procedural/`), shipped the share-URL contract via `/w/:id`, and layered terrain undulation + worn paths between `loved` games + scatter on top. **Same profile → same world** — the share-URL contract holds across browsers, devices, and time.

**Immediate next work — v0.6: Electron wrapper.** Native desktop app, wallpaper-mode rendering, Steamworks SDK for library auth + accurate launch/return-trip detection. PLAN.md Phase 6 has the task list; SPEC §6.2 has the architectural decisions (Electron, not Tauri — settled 2026-05-17 over `steamworks.js`'s Node-runtime requirement). Start the Steamworks partner application early — the review queue is the long pole, per the launch-obligations checklist in PLAN.md "Beyond Phase 7."

**v0.3 (IGDB + multiple templates) stays deferred** behind v0.6. Multiple templates each need their own Meshy curation pass; better to land Electron + wallpaper mode on the one template before duplicating.

**Stage 5 audio baking + OG meta-tag HTML route are lifted out of Phase 5.** Both are small phases of their own — audio when ready to spend Stable Audio / ElevenLabs credit, OG HTML when first prod deployment lands. Neither blocks v0.6.

**Outstanding from v0.1: the Meshy hero-asset curation pass.** Five seaside archetypes still ship as procedural primitives. All the v0.4/v0.5 polish (state styling, terrain, paths, scatter) layers on top of cubes-pretending-to-be-lighthouses. The visual ceiling is genuinely capped until Meshy lands. Right before v1.0 is when those credits pay off most.

**Beyond v0.5 (trajectory toward Steam launch):**

- **v0.6** — native desktop wrapper (**Electron** — decided 2026-05-17, see SPEC §6.2), wallpaper mode rendering, Steamworks SDK for library auth.
- **v0.7–0.9** — performance hardening, multi-monitor support, idle-mode optimisation, audio integration, share-image / share-video export pipeline, web-viewer (read-only walkable view of shared worlds).
- **v1.0 — Steam launch.** 3–5 hand-built templates, share artifacts, "Year in Library" annual moment. No Workshop yet. Steam Direct paperwork checklist in PLAN.md "Beyond Phase 7."
- **v1.x** — Steam Workshop integration (free content only — Wallpaper Engine's lesson), template authoring tool, friend-comparison feature. Moderation pipeline is a v1.x prerequisite — see SPEC §11.

## Stack

- **Three.js + react-three-fiber + drei** for the 3D scene
- **@react-three/rapier** for physics (real walking, collision, weight)
- **Vite + React + TypeScript** for build / dev server (web build)
- **Cloudflare Workers** for the backend (orchestrates all AI providers + Steam + HLTB + IGDB; holds all server-side keys)
- **Native wrapper: Electron** (decided 2026-05-17; see SPEC §6.2) — lands at v0.6. Adds wallpaper rendering + Steamworks SDK integration via `steamworks.js`.
- **HowLongToBeat** for per-game completion-time data (community endpoint; lands at v0.2)
- **IGDB** (Twitch credentials) for rich game metadata — genres, themes, perspectives, franchises (lands at v0.3)

### Multi-model AI orchestration

The pipeline uses different models for different stages — all orchestrated from the Worker, never directly from the frontend. Each provider is best-of-breed for its stage; they are not interchangeable.

| Stage | Output | Production | Dev iteration |
|---|---|---|---|
| 1. Metaphor + casting + role text | Structured JSON (creative + schema) | Claude Opus 4.7 (eval pending — see `eval/`) | Qwen 3 14B via local Ollama, or Claude Sonnet 4.6 |
| 2. Skyboxes (360° HDR) | HDRI | Blockade Labs Skybox AI | same (template-build time only) |
| 3. Environment textures + decorative 2D | Image | Midjourney v7 or FLUX 2 Pro (curated, baked) | local FLUX.1 Schnell on the 4070 |
| 4. Hero 3D objects | GLB mesh | Meshy / Tripo / TRELLIS-2 (curated, baked) | same |
| 5. Ambient audio + interaction stings | WAV/OGG | Stable Audio 2.5 + ElevenLabs Music (curated, baked) | same |
| 6. Reveal narration TTS (optional) | Speech audio | ElevenLabs | not used until v0.8+ |

**Stages 2–6 are template-build-time only** — runtime never calls a generative API except Stage 1. Same curation discipline as the existing 3D pipeline: generate 5–10 candidates per asset, hand-pick the survivor, bake to `public/`.

### Asset libraries (CC0 filler)

**Kenney 3D**, **Quaternius**, **Poly Pizza** — bundled under `public/models/` for ground tiles, vegetation, generic clutter. Aesthetic-coherence rule still applies (one library per template).

## File layout

```
SPEC.md              — full design doc (read once for context)
CLAUDE.md            — this file (day-to-day rules)
IDEAS.md             — parked alternative directions (not on roadmap)
package.json         — Three.js + r3f + Vite + React + TS
index.html           — single page; mounts React into #root
src/main.tsx         — React entry point
src/App.tsx          — top-level component
src/scene/           — react-three-fiber scene composition
src/scene/archetypes/  — per-archetype components (lighthouse, campfire, cabinet, ...)
src/scene/rituals/   — diegetic launch/return ritual components
src/procedural/      — deterministic layout layer (v0.5 — terrain, placement, paths, scatter, share-URL encoder; seeded by profile)
src/data/            — hard-coded library, asset URL helpers
src/ai/              — types for the world manifest + Stage 1 prompt + parsing
src/api/             — fetch wrappers for the Cloudflare Worker backend
src/state/           — Zustand store (manifest, layout, player position, ritual state)
src/types.ts         — shared types
public/models/       — Kenney/Quaternius/curated AI .glb files (per template)
public/textures/     — baked environment textures + skybox HDRIs (per template)
public/audio/        — baked ambient beds + interaction stings (per template)
worker/              — Cloudflare Worker (orchestrates Anthropic, Steam, HLTB, IGDB, audio/image/3D providers; all keys live here)
eval/                — Stage 1 model eval framework (synthetic profiles, runner, blind comparison UI, results)
desktop/             — Electron wrapper — lands at v0.6
docs/research/       — dated reference reports (not active rulebook; see SPEC for what became decisions)
legacy-2d/           — preserved 2D Phaser prototype (reference, not active)
```

## Conventions

- **Per-game art = Steam CDN, recognition face only.** Use `headerImageUrl(appid)` from `src/data/sampleLibrary.ts` for the *recognition face* of each archetype (the screen of a cabinet, the cover of a book, the photo in a locket, the light of a lighthouse). The rest of the object — wood grain, stone, glass, surrounding scenery — is normal template-asset territory per the whitelist. The recognition face triggers the "oh I own that" beat; substituting generated art for it weakens that beat. For games without usable Steam CDN art (rare), fall back to a neutral placeholder — don't generate a substitute that could mislead recognition. Same rule applies if non-Steam games (itch.io, GOG) are imported in later versions: user-provided art only on the recognition face.
- **Template assets — 3D, textures, audio, skyboxes — are baked at template-build time** with strict curation discipline. Pipeline: generate 5–10 candidates per asset via the relevant API (Meshy/Tripo/TRELLIS-2 for 3D, Midjourney/FLUX for 2D, Stable Audio/ElevenLabs for audio, Blockade Labs for skyboxes), hand-curate the survivor, bake into `public/{models,textures,audio}/{template_id}/`. The Stage 1 prompt's whitelists for `model`, `ritual`, `audio_id`, and `skybox_id` only reference shipped survivors — the LLM never picks something we don't have.
- **All AI calls go through the Worker.** Anthropic, Stable Audio, ElevenLabs, Blockade Labs, Meshy, Midjourney — all keys live in `worker/.dev.vars`. The frontend never holds an API key. The Worker is the single AI orchestration surface; new models are added there, not in `src/`.
- **Local LLM for dev iteration.** [Ollama](https://ollama.com/) with Qwen 3 14B is the recommended dev-time orchestrator for Stage 1. Set `LLM_PROVIDER=local` in `worker/.dev.vars` and the Worker hits `http://localhost:11434` instead of Anthropic. Useful for prompt iteration and running `eval/` offline. **Never ship local LLM to production** — Stage 1 quality is the magic surface and the local ceiling is meaningfully below frontier.
- **Aesthetic coherence over scope creep.** Pick one asset-library style per scene template and stick to it. Mixing libraries in a single scene looks like a stapled-together asset pack.
- **Rituals are short — 1.5 to 3 seconds max.** They serve as the loading screen, not a cutscene. First 80% is full-power animation; last 20% is the moment Steam is actually launching.
- **Game launching is `window.location.href = 'steam://run/' + appid`** in the web build; the Electron wrapper (v0.6+) uses Steamworks SDK directly. Don't try to detect Steam install state — fire and let the platform handle the fallback.
- **Return-trip detection in the web build = `window.addEventListener('focus', …)`.** A small lie (focus fires for any tab-switch). Accepted through v0.5; the Electron wrapper at v0.6 handles this properly.
- **Determinism in `src/procedural/`.** All randomness goes through a seeded PRNG. No `Math.random()` in that module. Same profile → same world is a hard requirement — the share-URL contract depends on it.
- **TypeScript strict mode.** Don't disable strict-mode flags without explicit reason.
- **State machine in `src/state/`** (Zustand) for world manifest, procedural layout, player position, ritual state. Don't put scene state in component-local `useState` past a trivial size.

## How to run

```
npm install
npm run dev       # frontend, http://localhost:5183 (or auto-fallback)
npm run worker    # local Cloudflare Worker via wrangler, separate terminal
```

Both must be running for the Stage 1 call to work. The frontend without the Worker still renders the scene with a stub manifest (useful while iterating on scene visuals).

You need Steam installed and running for `steam://run/{appid}` to launch a game; otherwise it's a no-op in the browser.

**Local LLM dev mode (optional, recommended for prompt iteration):**

```
ollama pull qwen3:14b          # one-time, ~9GB
ollama serve                    # background daemon at http://localhost:11434
# Set LLM_PROVIDER=local in worker/.dev.vars
npm run worker                  # now hits Ollama instead of Anthropic
```

**Running the Stage 1 eval (when `eval/` lands):**

```
npm run eval -- --models claude-opus,claude-sonnet,gemini-3-pro,qwen3-14b-local
# Outputs eval/results/{date}/ — open results.html for blind comparison UI
```

## Open inputs needed from Harry

- Anthropic API key (`ANTHROPIC_API_KEY` in `worker/.dev.vars`)
- Steam Web API key (`STEAM_WEB_API_KEY`, from v0.2)
- Twitch Client ID + Secret for IGDB (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, from v0.3)
- Stable Audio API key (`STABLE_AUDIO_API_KEY`, from v0.5 for audio baking)
- ElevenLabs API key (`ELEVENLABS_API_KEY`, from v0.5 for short stings)
- Blockade Labs Skybox API key (`SKYBOX_API_KEY`, from v0.5 for template-build skies)
- (Optional) Gemini and OpenAI keys if including them in the Stage 1 eval
- Choice of v0.1 scene template — one of: `seaside_town`, `research_station`, `overgrown_city`, `bookshop`, `forest_grove`

## Things to NOT do

- **Default to template-build-time generation; runtime generative API calls require explicit scoping.** Each runtime AI call introduces cost variance, latency variance, and quality variance that have to be designed for. v0.1–v0.5 has exactly one runtime AI call — Stage 1 (Claude, world manifest). Premium-tier features in later versions (custom-prompt remix, narrated reveal, annual moments, on-demand template variations) may add scoped runtime calls — but each one requires its own entry in this file documenting cost model, caching strategy, and fallback before shipping. The principle: don't add runtime AI on instinct or convenience; add it on design.
- **Don't ship local LLM to production.** Local is for dev iteration only. The Stage 1 quality ceiling on a 12GB-VRAM-class model is meaningfully below frontier; the role text is the magic surface.
- **Don't conflate the AI stages.** The Stage 1 LLM (Claude) doesn't generate audio, images, or 3D meshes. Each stage has its own specialist model called from the Worker. If a feature seems to need image/audio/3D generation at runtime, it's wrong — push it to template-build time or rework the feature.
- Don't try to extract assets from local Steam game files. Copyrighted, sometimes encrypted, a per-game integration nightmare.
- Don't put any API key in the frontend bundle. Always proxy via the Worker.
- Don't bundle large npm packages (>500KB gzipped) into the web build without flagging — the web viewer (share surface) is bandwidth-sensitive. Three.js + r3f + drei is the heavy budget. The Electron wrapper (v0.6+) has more headroom, but the web bundle still ships and the constraint applies there.
- Don't break the asset whitelist in the Stage 1 prompt. The LLM must only pick models, rituals, audio, and skyboxes we actually ship; widen the whitelist deliberately, not by editing the prompt to "be more creative."
- Don't reach into `legacy-2d/`. It's preserved as a reference; not part of the active build. Leave it alone unless we explicitly resurrect a pattern from it.
- Don't add `Math.random()` anywhere in `src/procedural/`. Determinism is the share-URL contract.
- **Don't ship Suno or Udio audio in any committed build.** The legal situation around their training data is actively contested as of 2025–2026 and Steam has flagged submissions using these outputs. Stable Audio 2.5 + ElevenLabs Music both have clear commercial-use terms and stay our defaults for Stage 5 baking; if a track needs to come from anywhere else, use Epidemic Sound / Artlist (subscription, broad license) — never Suno/Udio.
- **Don't monetize Workshop content** (when v1.x lands). Workshop templates stay free, full stop. Wallpaper Engine tried a paid item store and shut it down over verification / codec-licensing / buyer-confusion problems; we don't repeat that. Monetization is on the base-app price and (later, if needed) on first-party DLC template packs we curate ourselves — not on community content.
