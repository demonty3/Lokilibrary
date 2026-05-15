# LibraryWorld — Claude Code rules

## What this project is

A web-based interactive loader that replaces Steam's library grid with a small inhabitable 3D world, personalised by an LLM based on the user's actual playing behavior. Each significant game in the user's library appears as an archetype-cast object in the world (a lighthouse, a campfire, a bookshelf, a workbench, an arcade cabinet, etc.). Walking up to an object and pressing E — or clicking — triggers a brief diegetic "launch ritual" animation, then fires `steam://run/{appid}` to launch the game in Steam. When the user quits Steam and the browser tab regains focus, a return ritual plays.

The full design doc is **`SPEC.md`** — read it for the broader vision (behavior-driven AI metaphor, diegetic launch rituals, library-state mapping). **This file is the day-to-day rulebook.**

## Current phase

**v0.1 of the committed build — first vertical slice.** The 2D Phaser prototype (preserved in `legacy-2d/`) proved that the loop needs the LLM personalisation piece to feel magical, not just polished visuals. The 3D + LLM combination is what v0.1 is now testing.

v0.1 scope: one scene template, one ritual variant, one Claude call, hard-coded library, working `steam://run`. Real Steam auth comes at v0.2.

## Stack

- **Three.js + react-three-fiber + drei** for the 3D scene
- **@react-three/rapier** for physics (real walking, collision, weight)
- **Vite + React + TypeScript** for build / dev server
- **Cloudflare Workers** for the backend (proxies Anthropic + Steam + HLTB + IGDB; keeps all keys server-side)
- **Anthropic Claude Sonnet** for the world-design call
- **HowLongToBeat** for per-game completion-time data (community endpoint; lands at v0.2)
- **IGDB** (Twitch credentials) for rich game metadata — genres, themes, perspectives, franchises (lands at v0.3)
- Asset libraries: **Meshy AI** / **Tripo** for custom hero objects per template (baked at build time, hand-curated); **Kenney 3D**, **Quaternius**, **Poly Pizza** (all CC0) for filler dressing

## File layout

```
SPEC.md              — full design doc (read once for context)
CLAUDE.md            — this file (day-to-day rules)
package.json         — Three.js + r3f + Vite + React + TS
index.html           — single page; mounts React into #root
src/main.tsx         — React entry point
src/App.tsx          — top-level component
src/scene/           — react-three-fiber scene composition
src/scene/archetypes/  — per-archetype components (lighthouse, campfire, cabinet, ...)
src/scene/rituals/   — diegetic launch/return ritual components
src/data/            — hard-coded library, asset URL helpers
src/ai/              — types for the world manifest + Claude prompt + parsing
src/api/             — fetch wrappers for the Cloudflare Worker backend
src/types.ts         — shared types
public/models/       — Kenney/Quaternius .glb files
worker/              — Cloudflare Worker (proxies Anthropic, Steam Web API, HLTB, IGDB; holds all server-side keys)
legacy-2d/           — preserved 2D Phaser prototype (reference, not active)
```

## Conventions

- **Per-game art comes from Steam's CDN.** Use `headerImageUrl(appid)` from `src/data/sampleLibrary.ts`. Never generate or commit per-game artwork. Header images are textured onto the relevant face of each archetype object (the screen of an arcade cabinet, the cover of a book, the photo in a locket).
- **3D models come from CC0 libraries** (Kenney, Quaternius, Poly Pizza), bundled under `public/models/`. The Claude prompt constrains `model` and `ritual` fields to a whitelist of assets we actually ship — never let the AI pick a model we don't have.
- **The AI never sees real API keys.** Anthropic + Steam Web API calls are made from the Cloudflare Worker in `worker/`. The frontend talks to the Worker; the Worker talks to upstream APIs. Never embed keys in client code.
- **Aesthetic coherence over scope creep.** Kenney + Quaternius + Poly Pizza ship in different styles. Pick one style per scene template and stick to it. Mixing assets from different libraries in a single scene looks like a stapled-together asset pack.
- **Rituals are short — 1.5 to 3 seconds max.** They serve as the loading screen, not a cutscene. The first 80% of the ritual is full-power animation; the last 20% is the moment Steam is actually launching.
- **Game launching is always `window.location.href = 'steam://run/' + appid`.** Don't try to detect Steam install state — fire and let the browser handle the fallback.
- **Return-trip detection in the web build = `window.addEventListener('focus', …)`.** A small lie (focus fires for any tab-switch). Accepted through v0.9; properly fixed in the v1.0 Tauri wrapper.
- **TypeScript strict mode.** Don't disable strict-mode flags without explicit reason.
- **WebGL is fine.** The 2D-era CANVAS constraint no longer applies. If Steam CDN textures hit cross-origin issues in WebGL, route them through the Worker as a proxy rather than falling back to Canvas.
- **State machine in `src/state/`** (Zustand or similar) for world manifest, player position, ritual state. Don't put scene state in component-local `useState` past a trivial size.

## Things to NOT do

- **AI asset generation IS allowed at template-build time** — both 2D (skyboxes, environment textures, decorative 2D, UI textures) and 3D (custom hero objects per scene template). Use Meshy/Tripo for 3D, any standard image-gen API for 2D. Generate 5–10 candidates per asset, hand-curate down to one, bake the survivor into `public/models/{template_id}/` (GLB) or `public/textures/{template_id}/` (PNG/EXR). The template's asset whitelist (passed to the scene-composition Claude call) only includes survivors. **Never call Meshy/Tripo/image-gen APIs at runtime** — assets are baked at template-build time only. See SPEC §12 for the full discipline.
- **Per-game art is the one exception** — it stays Steam CDN (`headerImageUrl(appid)`), never generated. Steam's published per-game art is already recognisable; a generated alternative weakens the "oh I own that game" beat the rituals depend on.
- Don't try to extract assets from local Steam game files. Copyrighted, sometimes encrypted, a per-game integration nightmare.
- Don't put API keys (Anthropic, Steam Web) in the frontend bundle. Always proxy via the Worker.
- Don't bundle large npm packages (>500KB gzipped) without flagging. Three.js + r3f + drei is the heavy budget; pushing past that should be a conscious call.
- Don't break the asset whitelist in the Claude prompt. The AI must only pick models and rituals we actually ship; widen the whitelist deliberately, not by editing the prompt to "be more creative."
- Don't reach into `legacy-2d/`. It's preserved as a reference; not part of the active build. Leave it alone unless we explicitly resurrect a pattern from it.

## How to run

```
npm install
npm run dev       # frontend, http://localhost:5183 (or auto-fallback)
npm run worker    # local Cloudflare Worker via wrangler, separate terminal
```

Both must be running for the LLM call to work. The frontend without the Worker still renders the scene with a stub manifest (useful while iterating on scene visuals).

You need Steam installed and running for `steam://run/{appid}` to launch a game; otherwise it's a no-op in the browser.

## Open inputs needed from Harry

- Anthropic API key (set in `worker/.dev.vars` as `ANTHROPIC_API_KEY`)
- Steam Web API key (set as `STEAM_WEB_API_KEY`, needed from v0.2)
- Choice of v0.1 scene template — one of: `seaside_town`, `research_station`, `overgrown_city`, `bookshop`, `forest_grove`
