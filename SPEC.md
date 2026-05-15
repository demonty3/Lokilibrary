# LibraryWorld — Spec

**One-line pitch:** A small inhabitable 3D world that *is* your Steam library. The world is AI-generated from a behavioral profile of how you actually play — not from genre tags. Games are launched diegetically by interacting with objects in the world; the launch animation *is* the loading screen.

**Status (2026-05-12):** Committed project, post-pivot. An earlier 2D Phaser prototype was retired after walking it made clear the LLM-personalisation layer, not the rendering medium, was the missing piece. The active build is 3D + LLM-personalised, on Three.js + react-three-fiber.

---

## 1. Vision

Steam's library is a grid. This is its opposite — a small inhabitable place that reflects how you actually *relate* to games. Three layered ideas hold it together:

**1. Library as spatial self-portrait.** The world reflects your *relationship* to games, not just their genre. Most-played titles are big, lived-in structures with worn paths between them. The backlog sits as unopened crates collecting dust in a corner. Completed games become museum pieces with stats etched in. Recently-played glows. Long-abandoned gathers cobwebs. The same library on two different players produces two different worlds, because the state — not the contents — is the portrait.

**2. AI as world-author, seeded by behavior.** Procedural generation reads a *behavioral profile*: completion *fraction* (Steam playtime crossed against HowLongToBeat completion times), binge vs. sample patterns, session timing, replay behavior, achievement chase rate, plus rich genre/theme metadata from IGDB. From that, Claude picks one organising metaphor for the *whole* library — a city, a forest, a research institute, a pre-war seaside town — and translates every significant game into that metaphor's vocabulary. The metaphor itself is the personalisation. A completionist binge-player gets a different organising world than a serial sampler, even with the same games installed.

**3. Diegetic launch rituals.** Loading screens become transitions, not waits. You walk up to a game-object and the launch is a per-game animation: a book opens and the world inside bleeds outward; a lantern lights and the screen darkens to its color; a case file opens; you sit at a campfire. The *return trip* matters as much as the launch — quitting back to the world closes the loop in a way the OS-level Steam launcher structurally can't.

It should feel like the start screen to a JRPG that knows you.

---

## 2. Decisions

### 2.1 Dimensionality → **3D, low-poly (Three.js + react-three-fiber)**

Decided 2026-05-12 after walking the 2D pixel-art prototype and finding that, even fully polished, the 2D medium couldn't deliver "visually striking" without art investment we don't have. The 2D scaffold has been retired; the new build is 3D from the ground up.

Reference aesthetic: *A Short Hike*, *Alba*, *Townscaper*. Striking on a tiny budget because the medium does most of the heavy lifting — low-poly tolerates rough geometry; lighting, palette, and silhouette do the work. See §12 (Art direction) for how that quality bar actually gets met.

### 2.2 Platform → **Web app first; Tauri desktop wrapper at v1.0**

Web app is the right primitive for shareability — "send your library world to a friend" is one of the things that makes this project worth doing. `steam://run/{appid}` works from any web page on a machine with Steam installed. The Tauri desktop wrapper at v1.0 fixes one real limitation: proper return-trip detection (the browser only knows you tab-focused, not that you quit Steam).

### 2.3 AI approach → **Claude picks the organising metaphor; Steam's CDN art skins the objects**

The LLM piece is no longer deferred — it's the core of v0.1. Walking the polished 2D prototype made clear that without this layer there's nothing personal to test; the rendering medium is downstream of the LLM piece, not upstream of it.

The pipeline:

1. **Behavioral profile build (deterministic).** From `GetOwnedGames` + `GetRecentlyPlayedGames` + `GetPlayerAchievements`, enriched with HowLongToBeat completion times and IGDB metadata, compute: completion *fraction* per game (Steam playtime ÷ HLTB main-story hours), top-N by playtime, last-played decay, binge ratio, session pattern (where available), achievement-chase tendency, and a genre/theme/perspective summary per game. The HLTB cross-reference is what separates "lived in" from "tutorial abandoned" — 210h Civ VI is *well past* the 33h main story; 1.5h Hollow Knight is *still on the first boss*. Steam's playtime alone can't tell you that.
2. **Organising metaphor (Claude).** Given the profile, pick *one* metaphor for the whole world (e.g. "haunted seaside town," "research station," "overgrown city," "bookshop you live above"). Justify briefly.
3. **Per-game casting (Claude, same call).** Each top-N game gets cast as an archetype in that metaphor's vocabulary. Hades in a research station = a contained experiment that keeps resetting. Hades in a haunted seaside town = the lighthouse that keeps relighting itself. IGDB's genre + theme summary helps Claude cast intelligently rather than guessing from the name.
4. **State tagging (deterministic).** Each object gets a state: `loved`, `recent`, `mastered`, `abandoned`, `dusty`. Drives visual treatment.
5. **Texturing.** Each game-object's "face" — the screen of an arcade cabinet, the cover of a book, the photo in a locket — uses Steam's published `header.jpg` (per-game art is never AI-generated; see §12). Environment textures and decorative 2D are AI-generated and baked at template-build time.

Cost ceiling: ~one Claude call per regenerate. Plus HLTB + IGDB lookups (free), cached aggressively by appid. Sub-cent per user.

---

## 3. Architecture

```
┌────────────────────────┐
│  Browser (3D app)      │
│  Three.js + r3f scene  │
│  Rapier physics        │
│  Diegetic rituals      │
└────────┬───────────────┘
         │ steam://run/<appid>   ← launches games
         │
         ▼ (HTTPS)
┌────────────────────────┐    ┌─────────────────────┐
│  Backend (Cloudflare   │ ─▶ │ Steam Web API       │
│  Worker)               │    │ (library, recency,  │
│  - Steam OpenID        │    │  achievements)      │
│  - Profile build       │    └─────────────────────┘
│  - HLTB lookup         │    ┌─────────────────────┐
│  - IGDB enrichment     │ ─▶ │ HowLongToBeat       │
│  - Claude proxy        │    │ (per-game finish)   │
│  (all API keys live    │    └─────────────────────┘
│   server-side)         │    ┌─────────────────────┐
└────────┬───────────────┘ ─▶ │ IGDB (Twitch)       │
         │                    │ (rich metadata)     │
         ▼                    └─────────────────────┘
┌────────────────────────┐
│  Anthropic API         │
│  Claude Sonnet         │
│  metaphor + casting    │
└────────────────────────┘
```

**Data flow on first load:**

1. User signs in with Steam OpenID → backend gets `steamid64`.
2. Backend calls Steam Web API for owned games, recent activity, achievements.
3. Backend enriches: for each top-N game, fetch HLTB completion times and IGDB metadata. Cache by appid; these rarely change.
4. Backend builds the *behavioral profile* deterministically from the combined dataset.
5. Backend sends profile + enriched top-N games to Claude. Claude returns a `world_manifest`: organising metaphor, atmosphere, object archetypes, game-to-object mapping with per-object role.
6. Backend tags each object with a `state`.
7. Browser fetches the manifest, loads Three.js, fetches low-poly models from our static asset host, fetches game header images directly from Steam's CDN, builds the scene.
8. User explores with WASD + mouse (PointerLockControls). Rapier physics handles collision and weight. Interacting with an object triggers the per-archetype diegetic ritual, then fires `steam://run/{appid}`.

**Re-visit flow:** manifest cached server-side, TTL ~24h. HLTB + IGDB lookups cached separately (per-appid, TTL ~30 days). "Regenerate world" button forces a fresh Claude call.

---

## 4. Library-state mapping

The behavioral state of each game shapes its in-world appearance independent of which archetype it gets cast as. State is computed from Steam playtime + HLTB cross-reference + last-played decay + achievement %:

| State | Trigger | Visual treatment |
|---|---|---|
| `loved` | Top decile by playtime, played within last 30 days, completion fraction > 1.0 (past HLTB main) | Larger scale, glowing accents, worn paths leading to it |
| `recent` | Played within last 7 days | Soft light, fresh state |
| `mastered` | Completion / achievement % > 80, or HLTB completionist hours met | Plaque, trophy, museum-case treatment with stats etched in |
| `abandoned` | Played 1–5h then dropped > 90 days ago AND completion fraction < 0.3 | Mid-sentence state: half-open book, paused screen, dimmed |
| `dusty` | Owned, never played (zero Steam playtime) | Crate, sheet over it, gathering dust in the corner |
| `default` | Anything else | Normal in-world object |

The HLTB completion fraction is what makes this layer honest. The same Hades is a *lighthouse* in a haunted seaside town. The `loved` state makes the lighthouse the tallest, brightest thing on the headland. The `dusty` state would make it a covered ruin. Same archetype; the state is the diff.

---

## 5. Diegetic launch rituals

This is the part that turns the project from "cute" into memorable. Each archetype has a launch animation and a return animation. The launch animation also serves as the loading screen — by the time the ritual completes, Steam has launched or visibly failed.

A starter library of rituals, mapped to archetypes:

| Archetype | Fits games like | Launch ritual | Return ritual |
|---|---|---|---|
| Lantern / brazier | Atmospheric, exploratory (Hollow Knight) | Lantern lights; flame engulfs view; fade to game | Lantern remains lit nearby |
| Case file | Detective / RPG-with-text (Disco Elysium) | File opens; pages turn; fill the screen | New bookmark in the file |
| Campfire | Slow / introspective (Outer Wilds) | Sit down; fire crackles; fade to dusk | Campfire still warm; logs partially burned |
| Arcade cabinet | Fast / replayable (Hades, Slay the Spire) | Insert coin; CRT flicker; screen fills | Cabinet shows attract-mode loop |
| Workbench | Crafting / building (Factorio, Terraria) | Wipe sawdust; pick up a tool; zoom in on hands | New sketches pinned to it |
| Door | Generic fallback | Door opens; corridor of light | Door closes behind you |

Rituals are *short* — 1.5 to 3 seconds — and reuse common animation primitives. The starter library is enough through v0.5; per-game custom rituals come later.

**Return-trip detection.** In the web build, when the browser tab regains focus after `steam://run/` fired, *assume* a return and play the return animation. Good enough early on; the Tauri wrapper at v1.0 fixes it properly.

---

## 6. Tech stack

| Layer | Pick | Why |
|---|---|---|
| 3D engine | **Three.js** | Mature, every low-poly asset pack ships compatible formats |
| 3D bindings | **react-three-fiber** + **drei** | Declarative scene composition; trivial to compose rituals; massive helper library |
| Physics | **@react-three/rapier** | Canonical r3f physics integration. Real walking and collision rather than vector math by hand. WASM-backed, fast, free. |
| Build / dev server | **Vite + React + TypeScript** | Fast HMR; React composes well with r3f |
| Asset library (3D models) | **Kenney 3D** + **Quaternius** + **Poly Pizza** (all CC0) | Free libraries for prototyping; paid/custom assets become an option past v0.4 — see §12 |
| Asset library (per-game art) | **Steam CDN** (`header.jpg`, library_hero, trading cards) | Already-published, hotlinkable, recognisable per-game art |
| Controls | r3f `PointerLockControls` for WASD + mouse | "Walk around" feel is core to the spatial-self-portrait pitch |
| Backend | **Cloudflare Workers** | All API keys (Anthropic, Steam Web, Twitch/IGDB) stay server-side; free tier is plenty at this scale |
| Auth | **Steam OpenID 2.0** | Standard; no API key from the user |
| Completion-time data | **HowLongToBeat** (community-reverse-engineered JSON endpoint) | Crossed against Steam playtime gives a *completion fraction* — the signal that separates "lived in" from "tutorial abandoned" |
| Game metadata | **IGDB** (via Twitch developer credentials) | Richer than Steam: genres, themes, perspectives, franchises, narrative. Helps Claude cast each game into the metaphor intelligently. |
| AI | **Claude Sonnet** via Anthropic API, structured JSON output | Strong at structured creative-with-constraints tasks |
| Hosting | **Cloudflare Pages** (frontend) + **Workers** (backend) | Same platform; zero-ops; generous free tier |
| State | Worker-issued JWT, manifest cached in Cloudflare KV | Avoid re-pulling library every visit |
| Desktop wrapper (v1.0+) | **Tauri** | Rust+web hybrid; much lighter than Electron; real OS integration for return-trip detection |

---

## 7. Data integrations

### 7.1 Steam

**Authentication.** Steam OpenID 2.0 at `https://steamcommunity.com/openid/login`. Standard handshake. We end up with the user's `steamid64`.

**Library + behavior fetch.** With our Steam Web API key (free at https://steamcommunity.com/dev/apikey):

```
GET /IPlayerService/GetOwnedGames/v1/        ← playtime, names, icons
GET /IPlayerService/GetRecentlyPlayedGames/  ← last-played, recency
GET /ISteamUserStats/GetPlayerAchievements/  ← completion % (per-game, where public)
```

Achievements are per-game and need an extra call each, so only fetch them for the top-N games surfaced in the world.

**Artwork URLs (free to hotlink):**

- Header (460×215): `https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg`
- Library hero (1920×620): `.../apps/{appid}/library_hero.jpg`
- Capsule (231×87): `.../apps/{appid}/capsule_231x87.jpg`
- Icon: from `img_icon_url` in `GetOwnedGames`

**Launching a game.**

```js
window.location.href = `steam://run/${appid}`;
```

**Privacy gotcha.** `GetOwnedGames` and `GetPlayerAchievements` need the user's profile *game details* to be public. Most are. For private profiles, show a one-screen instruction to flip the setting.

### 7.2 HowLongToBeat

HLTB has no official API. The community has reverse-engineered a JSON endpoint (`POST https://howlongtobeat.com/api/search/...` with a session-derived hash) and the libraries `howlongtobeat-api` (npm) and a few similar packages wrap it. We call from the Worker (browser CORS would fail anyway) and **cache aggressively** — HLTB data per game changes rarely.

For each top-N game, we fetch:
- `main_story` hours
- `main_extras` hours
- `completionist` hours

Crossed against the user's Steam playtime:
- `completion_fraction = playtime_hours / main_story_hours`
  - `> 1.0` → past the main story, leans `loved`/`mastered`
  - `0.3–1.0` → engaged but unfinished, leans `default` or `loved`
  - `< 0.3` and not played in 90+ days → leans `abandoned`
  - `0` → leans `dusty`

**Failure mode.** HLTB is unofficial — if they change the endpoint, our calls fail. Worker should fall back gracefully to playtime-only signals (no completion fraction; loved/abandoned heuristics become coarser). Don't let an HLTB outage break the world generation.

### 7.3 IGDB

[IGDB](https://www.igdb.com/) is owned by Twitch and has a clean REST API + OAuth (Client Credentials flow) via the Twitch developer portal. Free for non-commercial use within rate limits.

Worker holds the Client ID + Client Secret, refreshes the OAuth token, and for each top-N game (by `appid` → IGDB external_games lookup) fetches:
- `genres[].name`
- `themes[].name`
- `player_perspectives[].name`
- `franchises[].name`
- `summary` (short)
- `game_modes[].name`

Cached per-appid, TTL ~30 days. Goes into the Claude prompt as enrichment so the LLM has more than the game name to work with.

---

## 8. The AI prompt (world design)

The core Claude call. Profile + enriched top-N games go in; world manifest comes out.

**System prompt (sketch):**

> You are a world designer for a personalised "library world" — a small interactive 3D scene built from a user's Steam library. You pick *one* organising metaphor for the whole world based on the user's behavioral profile, then cast each significant game as an archetype within that metaphor's vocabulary. Return strict JSON. Be specific and evocative, not generic. The metaphor should reflect *how the user engages with games*, not just which games they own.

**User prompt (sketch):**

> Behavioral profile:
> - Total owned games: 187
> - Top 5 by playtime:
>   - Hades — 340h played, HLTB main 21h → completion fraction 16.2 (deeply lived-in), genres: action / roguelike, themes: mythology, perspective: isometric
>   - Civilization VI — 210h, HLTB main 33h → fraction 6.4 (well past main), genres: 4X / turn-based-strategy, themes: historical
>   - Disco Elysium — 95h, HLTB main 21h → fraction 4.5 (multiple playthroughs), genres: CRPG, themes: politics / detective
>   - Stardew Valley — 88h, HLTB main 53h → fraction 1.7 (past main, ongoing)
>   - Outer Wilds — 62h, HLTB main 15h → fraction 4.1 (loops, replays)
> - Completion rate (avg over played games): 64% — high; this is a finisher
> - Binge ratio: high (top 3 games = 71% of total playtime)
> - Recent activity: last 30 days dominated by Hades and a new Pentiment playthrough
> - Session pattern: most sessions start after 22:00 — late-night player
> - Dusty backlog (owned, never opened): 89 titles
>
> Return:
> ```
> {
>   "organising_metaphor": "<2-4 word title>",
>   "metaphor_rationale": "<one sentence on why this profile fits this metaphor>",
>   "atmosphere": { "time_of_day": "...", "weather": "...", "palette": ["#hex", ...] },
>   "scene_template": "<one of: seaside_town | research_station | overgrown_city | bookshop | forest_grove>",
>   "object_archetypes": [
>     { "id": "lighthouse", "model": "kenney/lighthouse", "ritual": "lantern" },
>     ...
>   ],
>   "scene_layout": [
>     { "archetype_id": "lighthouse", "appid": 1145360, "role": "the lighthouse that keeps relighting itself", "position": [x,y,z] },
>     ...
>   ],
>   "backlog_treatment": { "container": "crates_under_tarp", "position": [x,y,z] }
> }
> ```

`scene_template`, `model`, and `ritual` are constrained to whitelists of assets and rituals we actually ship. This is how we keep the AI's creativity bounded by what we can render.

---

## 9. v0.1 — first vertical slice of the committed build

The goal of v0.1 is the smallest *end-to-end committed-build slice* that exercises every architectural box: 3D scene, Rapier physics, LLM call, archetype library, ritual.

Concretely:

1. Vite + React + react-three-fiber + drei + **@react-three/rapier** + TypeScript scaffold at the repo root.
2. One scene template — `seaside_town` — built by hand with **hero objects generated via Meshy or Tripo** (lighthouse, fish market, detective's office, harbour-master's hut, a few lit fishing boats — one coherent prompt suffix, hand-curated). Filler / ground tiles can come from Kenney coastal pack to keep budget in check. drei `Environment` HDRI for dusk lighting, real-time shadows on the hero objects, `EffectComposer` with bloom + ACES + atmospheric fog. The visual bar is exercised in v0.1, not deferred.
3. Hard-coded library (the same 7-game list from the 2D prototype) and a hard-coded behavioral profile. *No Steam API call, no HLTB call, no IGDB call yet — those land in v0.2+.*
4. One Claude call (via a Cloudflare Worker proxy) given the profile, returning the world manifest. The first version can map 7 archetypes 1:1 onto 7 games; intelligence comes later.
5. Scene assembled from the manifest: each game placed in the seaside town as its assigned archetype, with Steam's `header.jpg` textured onto the relevant face.
6. WASD + mouse-look to walk around (PointerLockControls), Rapier physics for collision so you can't walk through walls or buildings.
7. Walk up to an object, press E → 2-second ritual → `steam://run/{appid}`.
8. Tab regains focus → return ritual → back in the world.

If that lands, v0.2 onwards is layering. If it doesn't land — meaning the 3D + LLM combination doesn't deliver the magic the 2D version couldn't — that's the moment to step back and rethink.

---

## 10. Roadmap

Each version is roughly a week or two of evenings.

- **v0.1** — first vertical slice (above). One template, one ritual, one Claude call, hard-coded library, Rapier physics, working `steam://run`.
- **v0.2** — Real Steam OpenID login + real `GetOwnedGames` fetch. HLTB enrichment lands here too — completion fraction starts feeding the state-tagging logic.
- **v0.3** — IGDB enrichment + multiple scene templates (3–5 hand-built); Claude picks one based on the profile + metadata. Multiple object archetypes per template.
- **v0.4** — Library-state visual treatment (loved / recent / mastered / abandoned / dusty). Same archetype rendered differently based on state.
- **v0.5** — Full ritual library — at least 5 ritual variants, mapped from archetypes. Per-game custom rituals for top-played titles.
- **v0.6** — Shareable world URLs (friends can walk through your world, can't launch your games).
- **v0.7** — Mobile fallback (probably just a 2D grid view; mobile WebGL is too risky to commit to).
- **v1.0** — Tauri desktop wrapper. Proper return-trip detection. Real "behind the OS" presence.
- **Later** — Friend visiting (multiplayer presence). Per-game custom rituals at scale. Controller support. VR mode (cool, not v1).

---

## 11. Open questions / risks

- **Steam ToS.** Reading public library data with the user's OpenID + Steam Web API is squarely within ToS. Worth a final sanity check before public launch.
- **HLTB API is unofficial.** Reverse-engineered endpoint; could break if HLTB changes their internals. Cache aggressively (per-game data changes rarely) and fall back gracefully to playtime-only signals if it 503s. Don't let an HLTB outage break the world generation.
- **IGDB rate limits.** Free tier is 4 requests/sec, plenty for normal use. Cache per-appid aggressively (TTL ~30 days). Batch where the API allows.
- **`steam://` browser warnings.** Firefox sometimes confirms protocol handlers. Plan for an inline explanation.
- **Large libraries.** A 2000-game library won't fit in one scene. Claude picks a top-N; long tail goes into the "dusty crates" backlog treatment.
- **NSFW artwork in headers.** Filter or fallback to family-friendly capsule.
- **Performance.** ~50 textured low-poly objects in Three.js is fine on desktop, sketchy on low-end mobile. Plan for instancing and LOD; mobile gets a 2D grid fallback.
- **Rapier WASM size.** ~250KB gzipped — within budget but worth noting as the biggest single dep after Three.js.
- **Cost.** ~1 Claude call per regenerate at runtime. HLTB + IGDB free. AI image-gen + 3D-gen are template-build costs paid once (a few dollars per template). Runtime cost stays sub-cent per user.
- **The return-trip lie.** In the web build, we infer return from tab-focus. Acceptable through v0.9; properly fixed in the Tauri wrapper.

---

## 12. Art direction

The pivot's stated goal is "looks like a game, not like an asset-flip prototype." How we get there:

**AI asset generation IS allowed — at template-build time, with strict curation discipline.** Both 2D (skyboxes, environment textures, decorative imagery, UI textures) and 3D (hero objects — the lighthouse, the case file, the workbench) are fair game. Tools like [Meshy AI](https://www.meshy.ai/) and [Tripo](https://www.tripo3d.ai/) for 3D; any standard image-gen API (Anthropic image gen, Imagen, Flux, SDXL) for 2D. Used to author custom assets per scene template rather than relying on CC0 mashups that read as "asset-flip."

**Per-game art is the one exception** — it always comes from Steam's CDN (`header.jpg`, `library_hero.jpg`). Steam's published per-game art is already recognisable and canonical; a generated alternative is strictly worse for the "oh I own that game" recognition beat the rituals depend on. Hotlink, don't generate.

The same discipline applies whether the asset is 2D or 3D:

- **One coherent art direction per template**, expressed as a shared prompt suffix. E.g. `seaside_town` → `"stylised, low-poly, oil-painted texture, dusk light, palette: weathered teal / wet sand / amber lamplight."` Every generation prompt for this template ends with that suffix.
- **Generate 5–10 candidates per asset, hand-pick the best, throw the rest out.** AI quality is variable — the curation pass is what turns "AI slop" into "custom art."
- **Bake survivors statically** — 3D into `public/models/{template_id}/` as GLB, 2D into `public/textures/{template_id}/` as PNG/EXR. No runtime generation; everything is paid for once at template-build time and shipped as static assets.
- **The template's asset whitelist** (passed to the Claude scene-composition prompt) only contains survivors. The world-design AI cannot pick a model or texture we haven't curated and shipped.
- **Cost ceiling.** Meshy free tier is ~200 credits/month, enough for one template's hero objects. Image-gen for 2D assets is similarly cheap — a few dollars per template at most. Build-time cost is bounded; runtime cost stays sub-cent per user.

On top of the assets, the four levers for "looks like a game" quality:

1. **One style per scene template.** Custom AI-generated hero objects + AI-generated environment textures + curated CC0 dressing all share one art direction. Mixing styles within a scene reads as "asset flip" instantly.
2. **Lighting.** Real-time shadows, HDR environment lighting (drei's `Environment` with an HDRI), time-of-day matched to the metaphor (dusk for haunted seaside, midday for forest grove). The single biggest lever for low-poly looking *cinematic* vs. *flat*. Reference: how *A Short Hike* looks at golden hour.
3. **Post-processing.** Bloom on light sources, tone-mapping (ACES is the default), subtle vignette, depth-of-field on close objects, atmospheric fog for distance. drei's `EffectComposer` wrapper makes this declarative. This is what turns "raw models" into "stylised game."
4. **Camera and composition.** First-person works for "inhabit"; tight 3rd-person follow works for "explore." Pick one per template and frame the world for that camera — don't just drop the player into a model viewer.

Past v0.4, when we know which templates land, *commissioned* custom assets from paid 3D artists become the polish move for hero objects on the most-loved templates. Meshy/Tripo gets us to "every template ships with custom art" cheaply; commissioned art is the v1.0+ tier above that. The full-environment generation tools coming from Google (Project Genie 3, Gemini 3D scenes) are a *re-evaluate at v0.5* item — by then they may be production-API; today they are research-grade.

The principle stays: visual quality is craft (curation + lighting + composition + post-FX) — with AI generation (2D and 3D) as a curated input to the asset side at template-build time, never at runtime.

---

## 13. What's needed to keep building

1. **Anthropic API key.** Free to create at console.anthropic.com. Required before the LLM piece can do anything real. Set in `worker/.dev.vars` as `ANTHROPIC_API_KEY`.
2. **Steam Web API key.** Free at https://steamcommunity.com/dev/apikey. Needed from v0.2 onwards. Set as `STEAM_WEB_API_KEY`.
3. **Twitch developer credentials** (Client ID + Client Secret) for IGDB. Free at dev.twitch.tv. Needed from v0.3 onwards. Set as `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.
4. **Cloudflare account** for Workers + Pages + KV. Free tier is plenty.
5. **Harry's Steam ID** for the dev loop and permission to use his library as the first real test case.
6. **A scene-template aesthetic to start with.** Pick one of: `seaside_town`, `research_station`, `overgrown_city`, `bookshop`, `forest_grove` — whichever feels most evocative as the v0.1 single template.
