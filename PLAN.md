# LibraryWorld — PLAN.md

**Status:** Build plan for the painted-3D path (SPEC §9–10), revised 2026-05-16 to reflect the Steam-distribution product direction. Annotated for an LLM-driven workflow at full-weekend cadence (~20h/week). Phase 1's retrospective is the formal moment to verify the painted-3D + LLM combination delivers the magic before the v0.2–v1.0 arc commits.

**Progress (2026-05-17):** Phases 0–2, 4, and 5 complete. v0.2 ships the full Steam → enriched library → Stage 1 LLM loop end-to-end (`RETROS/v0.2.md`). v0.4 ships per-state visual treatment + the dusty backlog cluster. v0.5 ships procedural layout + share-URL contract + terrain + worn paths + scatter (`RETROS/v0.5.md`). **Phase 6 (Electron wrapper) is next** — the v1.0 product surface. Phase 3 (IGDB + multiple templates) remains deferred until v0.6 lands.

This file sequences SPEC.md's roadmap into concrete tasks you can hand to a coding LLM (Claude Code, Cursor, Aider, etc.), with the concepts you'll want to understand at each step so you can verify what the LLM produces. You're not writing the code. You are the project lead and the verifier.

---

## How to work with this plan

You're driving, the LLM is typing. Your job isn't to write code — it's to keep the build on the rails. That means:

**Always pin context.** Before any non-trivial task, paste `SPEC.md`, `CLAUDE.md`, and the file(s) being changed into the LLM's context. The LLM's defaults will not match this project's conventions unless it sees them. Claude Code reads files automatically; in a chat LLM, paste them by hand.

**Ask for small slices.** "Add a lighthouse with a flickering light" beats "build the seaside town." Small slices let you verify in the browser before the next slice. If the LLM tries to deliver 400 lines across 8 files in one shot, push back: *"Step 1 only. Show me the smallest change that gets the lighthouse on the ground; we'll add the flicker after I see it."*

**Verify visually, not by reading code.** Run `npm run dev`, look at the browser, test the actual loop. If it looks right and feels right, commit. You don't need to understand every line — you need to know that pressing E launches Hades.

**When something breaks, paste the exact error.** Console errors, terminal stack traces, screenshots of broken visuals — copy verbatim into the LLM. Don't paraphrase. The LLM is far better than you (or me) at pattern-matching errors to causes.

**Commit at every green checkpoint.** A working build before each task means rolling back when the LLM goes sideways is free. `git commit -am "lighthouse animates on E"` between every slice. If you're not sure how to roll back, ask the LLM — `git reset --hard HEAD~1` is the one-liner, but you should understand what it does before running it.

**Catch scope creep.** LLMs love to refactor. If you asked for "make the door open" and the diff touches 11 files, stop and ask what changed and why. Often the answer is fine; sometimes it's "I also renamed your folder structure because I thought it was cleaner" — which is when you reject and re-ask.

**Use the todo system.** If you're driving Claude Code, let it maintain a todo list and check it off as it goes. If you're using a chat LLM, keep your own `TODO.md` in the repo — track exactly where you are in this plan, what's done, what's blocked.

**One more thing:** "the LLM did the coding so it'll be much faster" is half true. The typing is faster, yes. But debugging without being able to fluently read code is genuinely slower — when something breaks subtly (the game launches but the wrong one) you can't just glance at the code and spot it. Expect a 1.5–2x slowdown vs. an experienced coder on debugging-heavy phases, balanced by being much faster on scaffolding. Net: the timeline below is honest for your situation.

---

## Phase 0 — Setup (1 weekend)

**Goal:** All credentials in hand, dev server running locally, you can edit a file and see it change in the browser.

### Tasks
1. **Accounts and keys** —
   - Anthropic API key — console.anthropic.com (top up ~$20; that's enough for hundreds of dev calls)
   - Cloudflare account — free tier covers everything in this plan
   - GitHub account — for the repo
   - Meshy.ai account — for 3D asset generation; the free trial credits get you started, paid tier is ~$20/month
   - Steam Web API key — steamcommunity.com/dev/apikey (free, used from Phase 2)
   - (Optional, dev-only) Ollama installed locally with `qwen3:14b` pulled. Set `LLM_PROVIDER=local` in `worker/.dev.vars` to route Stage 1 to your local Ollama instead of Anthropic. Useful for prompt iteration without burning API credit. Never ship to production.
2. **Local tools** — Node.js LTS, Git, and an editor (VS Code with the Cursor or Claude Code extension, or Cursor as the editor). On macOS, install via Homebrew; on Windows, use the official installers.
3. **Pull and run** — Clone the repo, `npm install`, `npm run dev`. You should see the in-world computer terminal and be able to walk around with WASD + mouse.
4. **Loop test** — Edit a string in `src/ui/ConnectorPanel.tsx` (e.g. change "LIBRARYWORLD" to "TESTING"), save, confirm the browser updates instantly. Commit the change just to confirm git works, then revert.

### Concepts to learn
- **Git** — clone, commit, push, pull, branch. Get comfortable with `git status` and `git diff`. GitHub Desktop is fine if the CLI feels rough.
- **Package managers (npm)** — `npm install` reads `package.json` and downloads everything into `node_modules`. You don't read `node_modules`. Ever.
- **The dev server (Vite)** — `npm run dev` starts a local web server with hot reload. Most edits show up in <1s without a page refresh. If something gets weird, kill it (Ctrl+C in the terminal) and start it again.
- **Environment variables** — `.env` files and `worker/.dev.vars`. Secrets never live in client code. These files are git-ignored on purpose.

**Done when:** You can edit `src/App.tsx`, save, see the change in the browser. Your Anthropic key is in `worker/.dev.vars` as `ANTHROPIC_API_KEY=sk-ant-...`. Nothing is broken in the existing scene.

---

## Phase 1 — v0.1 vertical slice (4 weekends)

The end-to-end loop. After this phase, you walk up to a lighthouse, press E, and Hades launches in Steam. That's the whole pitch reduced to its smallest viable form — but it has to actually feel right, not just technically work. The visual bar is exercised here, not deferred.

I'll break SPEC §9 into ten sub-tasks. Each is its own LLM session.

### 1.1 — Scaffold check (½ day)
Verify the scaffold from the existing repo matches SPEC §9 step 1. If anything is missing (`@react-three/rapier`, `drei`), install it. Read `package.json` and `src/App.tsx` to map what's already there.

**LLM prompt suggestion:**
> Here is package.json and src/App.tsx. Compare against SPEC §9 step 1 (pasting below). Tell me what's already installed, what's missing, and what to run. Don't change anything yet.

### 1.2 — Empty 3D scene with a ground plane (½ day)
A flat ground, sky, sun. You walk around with WASD and mouse. No game-objects yet — this is the empty stage.

**Concepts:**
- **Scene graph** — the 3D world is a tree of objects (Scene → Group → Mesh). Every object has position, rotation, scale.
- **Meshes** — geometry (shape) + material (surface). A cube is `boxGeometry` + `meshStandardMaterial`.
- **Lights** — directional (sun), ambient (fill), point (lantern). A scene with no lights renders black.
- **Coordinate system** — Three.js is Y-up: X = right, Y = up, Z = toward camera. Units are meters by convention, so a 1.8m-tall player is 1.8 units tall.
- **The camera** — `PerspectiveCamera`, controlled in v0.1 by `PointerLockControls` (click to lock the mouse, WASD to walk).

**Done when:** You can run around an empty plane under a dusk sky.

### 1.3 — Rapier physics for collision (½ day)
Wrap the ground in a fixed collider. Add a placeholder cube wall and verify you can't walk through it.

**Concepts:**
- **Visual mesh vs physics collider** — they're separate. The mesh is what you see; the collider is what physics treats as solid. They usually match shape but don't have to. (Often a complex visual building has a simple box collider.)
- **Body types** — `fixed` (world, walls), `dynamic` (things that fall and respond to forces), `kinematic` (player-controlled, ignores gravity but pushes things).
- **The character controller** — your player has a capsule collider and Rapier's character controller handles step-up, slopes, gravity.

**Done when:** Walking into a wall stops you. Walking off a cliff makes you fall.

### 1.4 — One archetype: the lighthouse (1 day)
Hard-coded lighthouse model placed in the scene. Doesn't matter yet that it's tied to a game. Source it from Kenney's coastal pack for now (zero asset-pipeline drama — we upgrade to Meshy in task 1.7).

**Concepts:**
- **GLB/GLTF** — the standard 3D model format. Three.js loads it via `useGLTF` from drei.
- **Drei** — a helper library on top of react-three-fiber. `useGLTF`, `Environment`, `OrbitControls` all live there. Anytime the LLM reaches for "raw Three.js" for something common, push back — there's almost certainly a drei helper.
- **Bake the scale** — when you import a model, it's whatever size the artist exported. Wrap it in a group and scale until it looks right next to a 1.8m player. The lighthouse should be ~12–15m tall.

**Done when:** A lighthouse stands on the ground. You can walk around it and bump into it (cylinder collider works fine).

### 1.5 — Interaction prompt + key handler (½ day)
Walk within ~3m of the lighthouse and a "[E] enter" prompt appears on screen. Press E and `console.log("interact")` fires. Just the trigger — no ritual yet.

**Concepts:**
- **Distance check in `useFrame`** — every frame, measure player ↔ object distance. If under threshold, show the prompt. Look at `src/scene/seaside/Computer.tsx` — that's the existing pattern, copy its shape.
- **Zustand store** — global state lives in `src/state/store.ts`. The "is the prompt showing" flag is a store value any component can read or set. Zustand is the project's chosen state manager; don't let an LLM introduce Redux or Recoil.

**Done when:** UI prompt appears/disappears as you walk near/away. E logs to the console.

### 1.6 — Cloudflare Worker proxy (1 day)
The backend. A tiny serverless function that takes a request from the browser, forwards it to Anthropic with the API key attached, and returns the response. The key never leaves the server.

**Concepts:**
- **Why a proxy** — if Anthropic's API key were in browser code, anyone could view-source and steal it. The worker exists to hold the key. The same worker also becomes the single AI orchestration surface for the rest of the project — every model in the multi-stage pipeline (CLAUDE.md §6.1 / SPEC §6.1) goes through here, not from the frontend.
- **Cloudflare Workers** — JavaScript functions that run on Cloudflare's edge servers. Free tier is generous. `npx wrangler dev` runs them locally on a separate port (usually 8787); `npx wrangler deploy` publishes.
- **CORS** — browsers block cross-origin requests by default. The worker has to set `Access-Control-Allow-Origin` headers to let your dev page (localhost:5173) call it (localhost:8787).
- **The Anthropic Messages API** — `POST https://api.anthropic.com/v1/messages`, body is `{ model, max_tokens, messages, system }`. Returns JSON with the assistant's reply. Use `claude-opus-4-7` for Stage 1 in production; the Worker also supports `LLM_PROVIDER=local` (Ollama on `http://localhost:11434`) for dev iteration.

**LLM prompt suggestion:**
> Build a Cloudflare Worker at worker/index.ts that exposes one POST endpoint /api/world. It reads JSON `{profile, games}` from the request, forwards a prompt to the Anthropic Messages API using ANTHROPIC_API_KEY from env vars (model: claude-opus-4-7), and returns Claude's JSON response. Add a LLM_PROVIDER=local branch that hits http://localhost:11434 with qwen3:14b for dev. Include CORS for localhost:5173. Use the prompt sketch from SPEC §8. Use TypeScript. Set up wrangler.toml. Don't change anything in src/ — this is a worker-only change.

**Done when:** You can `curl -X POST http://localhost:8787/api/world -d '{...}'` (the LLM can give you a working curl) with a dummy profile and get back a JSON manifest from Claude. Flipping `LLM_PROVIDER=local` routes to Ollama and you get a manifest back from Qwen too (lower quality is fine — just confirming the switch works).

### 1.7 — Hero asset pass with Meshy (1 weekend)
The visual bar moment. Generate the seaside hero objects (lighthouse, fish market, detective's office, harbour-master's hut, fishing boat) in Meshy (or Tripo / TRELLIS-2 — same curation discipline applies) using one coherent prompt suffix. Generate 5–10 candidates per object, hand-pick the best, download as GLB. This is where most of v0.1's visual quality comes from — don't rush it.

**Concepts:**
- **Prompt suffix discipline** — every prompt ends with the same style suffix (e.g., *"low-poly, painted texture, dusk lighting, A Short Hike aesthetic, no people"*). Without that, the set won't feel cohesive.
- **Curation, not generation** — the difference between "AI assets look cheap" and "AI assets look intentional" is hand-picking 1 of 8, not accepting the first result. Be brutal.
- **Polycount and texture size** — keep models under ~10k triangles and textures at 1024px. Anything bigger is wasted on browser GPUs.

This task has no LLM in it — it's pure curation work. The LLM can't help you pick which lighthouse looks best; only you can.

**Done when:** All five hero objects are in `public/models/seaside/` as GLBs, each tested by loading in the dev scene and adjusting scale.

### 1.8 — World manifest → scene assembly (1 day)
The Stage 1 call fires on page load. The returned manifest places each of the 7 hard-coded games as one of the hero archetypes. Each archetype's recognition face is textured with that game's `header.jpg` from Steam's CDN.

**Concepts:**
- **The manifest as contract** — Stage 1 returns JSON. Your code reads that JSON and places objects. The LLM is constrained (via the system prompt) to picking from your whitelist of archetypes and models (CLAUDE.md). If it returns `model: "spaceship"` and you don't ship a spaceship, the scene breaks — so validate the manifest after parsing and fall back to defaults on bad fields.
- **Recognition-face rule** — Steam CDN art only on the *recognition face* (the lighthouse's lantern panel, the cabinet's screen, the book's cover). The rest of the object (wood grain, stone, glass, surrounding scenery) is normal template-asset territory. URL pattern lives in `src/data/sampleLibrary.ts` (`headerImageUrl(appid)`).
- **Texture loading** — Three.js loads `header.jpg` as a `Texture` and you assign it to the recognition-face material.
- **Caching the manifest** — the worker should cache the response in Cloudflare KV (TTL 24h) so repeat page loads don't burn API calls and don't ship a slightly different world every refresh. (From Phase 5, positions are deterministic from the profile seed — so even a regenerate gives a stable layout. For now, in Phase 1, the LLM picks positions too.)

**Done when:** Page loads → Stage 1 call fires → 7 hero objects appear in the seaside town, each with its game's Steam header textured onto its recognition face (lighthouse's lantern panel, fish market's signboard, etc.).

### 1.9 — Launch ritual + `steam://run` (½ day)
Press E on the lighthouse → 2-second lantern-lighting animation → `window.location.href = "steam://run/1145360"` fires → Hades opens in Steam.

**Concepts:**
- **Custom URL protocols** — `steam://` is registered on the OS by the Steam client. Browsers happily hand it off. No special permissions needed. (The v0.6 desktop wrapper later replaces this with Steamworks SDK calls for the desktop build; the web build keeps `steam://`.)
- **Animation in r3f** — `useFrame` runs ~60×/sec. Drive position/scale/material values from a time variable. For more complex tweens, `@react-spring/three` is the idiomatic answer — let the LLM use it instead of writing tween math by hand.

**Done when:** Pressing E on the lighthouse plays the lantern animation and Steam pops to the foreground starting Hades.

### 1.10 — Return ritual (½ day)
When the browser tab regains focus after Steam launched, play a brief return animation. This is the "you came home" moment SPEC §1 talks about.

**Concepts:**
- **Visibility / focus events** — the `visibilitychange` and `focus` browser events. They fire when the user alt-tabs back to the page.
- **The focus-as-return lie** — in the browser, you only know they tab-focused, not that they actually quit Steam. SPEC §2.2 notes this gets fixed at v0.6 with the desktop wrapper (Steamworks SDK gives you real launch/return signals). For v0.1 it's fine — focus-as-return is a good-enough proxy.

**Done when:** Launch Hades → close Hades → click back to the browser tab → return animation plays and you're back at the lighthouse.

### v0.1 retrospective (mandatory)
At the end of Phase 1, write a half-page note in the repo (`RETROS/v0.1.md`): *did the painted-3D + LLM combination deliver the magic the 2D version couldn't?* Per SPEC §9, this is the explicit moment to either commit to v0.2+ or step back. Be honest. If the answer is "almost, but the painted-3D bar is too expensive to maintain," pause and rework the approach before committing to the v0.2–v1.0 arc. Continuing on autopilot if the answer is weak just spends 15+ weekends polishing something that doesn't pop.

---

## Phase 2 — v0.2: Real Steam + HLTB (2 weekends) — **COMPLETE**

**Goal:** Replace the hard-coded library. You sign in with Steam, the worker fetches your real owned games, HLTB completion times come back, and the world is now made of *your* library.

**Shipped 2026-05-17** across slices 1–7 (PRs #4–#6, #8–#11, plus #7 for launch-obligations docs). Retro in `RETROS/v0.2.md`.

### Tasks
1. **Steam OpenID flow in the worker.** Standard OpenID 2.0 — Steam is one of the few major sites still on the old spec, but every guide on the web has working examples and the LLM will know the pattern cold.
2. **`GetOwnedGames` call** after login. Cache results per Steam ID, TTL ~1h.
3. **`GetRecentlyPlayedGames` and `GetPlayerAchievements`** for the top-N games (Top-N by playtime, N=15 is a sensible starting point).
4. **HLTB community endpoint.** HowLongToBeat doesn't have a real public API; community libraries (e.g. `howlongtobeat`) scrape their endpoints. Cache per-appid, TTL 30d.
5. **Behavioral profile builder.** Deterministically compute the profile (SPEC §2.3, step 1) from the combined data. This is the unit you feed Claude — and from Phase 5, also the seed for procedural layout.
6. **State tagger** (deterministic), running before the Claude call — Claude only sees `state: "loved"`, never the raw playtime numbers. SPEC §4 has the rules.
7. **Wire the new pipeline into the v0.1 scene.** The renderer doesn't need to know whether the data is hard-coded or real.

### Concepts to learn
- **OpenID 2.0** — sign-in flow where Steam vouches for you and redirects back with a signed payload. You verify the signature server-side. (It's an older protocol than modern OAuth — different shape, similar idea.) The v0.6 desktop wrapper later swaps this for Steamworks SDK; until then, OpenID is the path.
- **Sessions and cookies** — once Steam vouches, you set a session cookie so subsequent requests know who the user is. The session lives in Cloudflare KV; the cookie is just an opaque ID.
- **Caching with TTL** — Cloudflare KV stores key-value pairs with expiry. Read-through cache pattern: try cache, miss → fetch upstream → write cache → return.
- **Rate limits** — HLTB and Steam both have soft limits. Cache aggressively and add a polite retry-with-backoff for HLTB.

**Done when:** Click "Connect Steam," log in via Steam's site, return to the page, the world is built from your actual library. Refresh the page and it loads from cache (fast).

---

## Phase 3 — v0.3: IGDB + multiple templates (3 weekends)

**Goal:** Claude doesn't just place objects in the seaside town — it *picks the world*. By the end of this phase, the same library can produce a haunted seaside town for one player, a research station for another, a bookshop you live above for a third.

### Tasks
1. **IGDB integration** in the worker (Twitch credentials → OAuth token → IGDB queries). Cache per-appid, TTL 30d.
2. **Enrich the Stage 1 prompt** with genres/themes/perspectives per game (SPEC §7).
3. **Two more scene templates** from scratch with hero objects: pick from `research_station`, `overgrown_city`, `bookshop`, `forest_grove`. Each needs 4–6 hero archetypes via the same Meshy curation pass as 1.7.
4. **Whitelist refactor** — the Stage 1 prompt now offers a list of templates and the LLM picks one based on the profile. Validate against the whitelist before assembling. If it picks a template you didn't ship, fall back to seaside.
5. **Template-agnostic scene assembly** — same code reads the manifest regardless of which template was chosen.

### Concepts to learn
- **LLM prompt engineering** — JSON schema constraints, in-prompt examples, what makes Claude actually follow your structure. Anthropic's tool-use docs are worth reading once. The pattern: give explicit JSON schema, give 1–2 worked examples, tell it to return only the JSON.
- **The whitelist pattern** — never trust the LLM to pick something you can render. Always validate the manifest against your ship-list before passing to the renderer.
- **Asset organisation at scale** — naming conventions, folder structure. `public/models/{template}/{archetype}.glb`. Get this right now; refactoring later is annoying.

**Done when:** Different hand-crafted test profiles produce visibly different worlds. Your actual library still produces something coherent and not the seaside town.

---

## Phase 4 — v0.4: Library-state visual treatment (2 weekends) — **COMPLETE**

Shipped across PRs #12 (per-state styling) and #13 (dusty backlog cluster).
Worn-path decals (task 2 of this phase) absorbed into Phase 5 slice 4
because they share the ground geometry with terrain.

**Goal:** Same archetype, different state, different visual. The lighthouse that's `loved` glows and has worn paths leading to it. The lighthouse that's `dusty` is a covered ruin.

### Tasks
1. **Per-state material variants** for each archetype:
   - `loved` — emissive accents, slightly larger scale (×1.15), warm glow
   - `recent` — soft light radius, no other change
   - `mastered` — plaque + trophy underlay, stats etched on a small board
   - `abandoned` — dimmer materials, half-open/paused state where it makes sense (lighthouse with a snuffed lantern)
   - `dusty` — grey tarp overlay covering the model
2. **Worn-path system** — if the player has multiple `loved` games, generate worn-path decals on the ground between them.
3. **Backlog corner** — collect all `dusty` games into a tarped-crates cluster, position from the manifest (or, from Phase 5, from the procedural layer).

### Concepts to learn
- **Materials and material properties** — `metalness`, `roughness`, `emissive`, `emissiveIntensity`. These four properties control how a low-poly material *reads* under your lighting. Mess with them in the browser; numbers stop being abstract fast.
- **Instancing** — if you have 89 dusty crates, use `<Instances>` from drei. 89 individual meshes will tank your frame rate; one instanced mesh with 89 transforms is free for the GPU.
- **Decals or splatted ground textures** — the worn-path effect is a decal projected onto the ground plane. Drei has `Decal`; that's the right tool.

**Done when:** Your library visibly looks different from the same library belonging to someone who only plays Hades and dropped everything else.

---

## Phase 5 — v0.5: Procedural layout + first share artifacts (3 weekends) — **COMPLETE**

Shipped across PRs #14 (PRNG + seed), #15 (procedural layout / drop `position`),
#16 (share-URL + view-only), #17 (terrain + worn paths), #18 (scatter).
Stage 5 audio baking + OG meta-tag HTML route lifted out to their own
follow-up phases — see `RETROS/v0.5.md`.

**Goal:** Move position-picking out of the Stage 1 call into a deterministic procedural layer in `src/procedural/`, seeded by the behavioral profile. Same profile → same world is a hard requirement — the share-URL contract depends on it. First share artifacts (URL + screenshot) ship here, because determinism is what makes them meaningful. Stage 5 audio baking lands alongside so worlds also have ambient beds + interaction stings.

This phase is a real cutover, not a feature addition. The Stage 1 prompt stops returning positions; the renderer stops reading them. Plan for a half-day of "the world looks scrambled" while you swap one for the other.

### Tasks
1. **Seeded PRNG infrastructure** in `src/procedural/`. Pick a stable algorithm (mulberry32 or xorshift128). No `Math.random()` allowed anywhere in this module — add a lint rule or a unit test that catches it.
2. **Profile → seed hash.** Hash the behavioral profile (top-N appids + playtime buckets + state tags) to a stable 32-bit seed. The same profile must always hash to the same seed; check with a snapshot test.
3. **Procedural layout for the seaside template** — terrain undulation, archetype placement, paths between `loved` objects, dressing scatter (Kenney/Quaternius CC0 filler). All from the seed. Other templates follow the same pattern once they land.
4. **Stage 1 prompt update** — drop the `position` fields from the schema. Add `skybox_id` and `audio_id` (from the template's whitelist) to what Stage 1 picks. Update the worker's manifest validation accordingly.
5. **Stage 5 audio baking pipeline** (template-build-time, not runtime). Pick a seaside ambient bed via Stable Audio 2.5; pick 3–5 interaction stings (lantern light, page turn, case-file snap, campfire crackle, door open) via ElevenLabs Music or Stable Audio. Curate 5–10 candidates per asset, bake survivors into `public/audio/seaside/`. Same discipline as the Meshy pass in 1.7.
6. **Share-URL save + view-only mode.** A shared world URL encodes the profile seed + manifest. `librarytown.example/w/{worldId}` resolves to a stored manifest in Cloudflare KV. View-only mode: ritual triggers show a tooltip ("Harry's lighthouse — 340h in Hades") instead of firing `steam://`.
7. **Open Graph snapshot capture** for link previews — your share URL should unfurl on Discord/Twitter with a still of the world + the organising metaphor as the title.

### Concepts to learn
- **Seeded PRNGs** — mulberry32 in ~10 lines of JS, xorshift128 in ~20. Pure functions; no global state.
- **Determinism contracts** — write at least one snapshot test that asserts `layout(profile_A) === layout(profile_A)` every time. This is the contract that makes shared worlds reproducible for viewers.
- **The whitelist pattern, extended** — now also for `skybox_id` and `audio_id`. Stage 1 only picks from baked survivors; reject anything else server-side.
- **Cloudflare KV for share storage**; **nanoid** for short URL-safe IDs (don't expose internal user IDs).
- **Open Graph protocol** — the `<meta og:*>` tags that control link previews on Discord/Twitter/iMessage. The share page needs static HTML for previews because Discord's crawler doesn't run JavaScript; Cloudflare Workers can render this HTML directly.

**Done when:** Two different profiles produce visibly different worlds. The same profile, loaded twice, produces *identical* worlds (verified by a test, not just by eye). Sharing your library URL in Discord unfurls with a screenshot + your library's organising metaphor as the title; click through and your friend walks read-only through your world with ambient audio + interaction stings.

---

## Phase 6 — v0.6: Native desktop wrapper + Steamworks SDK (3 weekends) — **NEXT**

**Goal:** Move the real product onto the desktop. Live-wallpaper rendering behind the OS, multi-monitor support, Steamworks SDK integration so launches and returns are detected accurately (no more focus-event lie). This is the surface that becomes the v1.0 Steam product.

This is the biggest single phase.

### Tasks
1. **Project skeleton in `desktop/` (Electron).** The wrapper choice is settled — SPEC §6.2 ratifies Electron on 2026-05-17, driven by `steamworks.js`'s Node-runtime requirement and Chromium-rendering consistency across platforms. No spike needed; build it. Get Electron loading the existing web bundle as the embedded view, round-trip a "Hello from native" IPC call to prove both sides talk. Set `contextIsolation: false` and copy the `steam_api64.dll` / `libsteam_api.dylib` / `libsteam_api.so` redistributable into the build root — these are non-negotiable for `steamworks.js`.
2. **Wallpaper mode.** Render behind the desktop, click-through, ignored by Alt+Tab in idle mode. Different APIs on Windows (the `Progman` / `WorkerW` reparenting trick — see Lively Wallpaper's open-source source as the documented reference) vs. macOS (`NSWindow.level = kCGDesktopWindowLevel`). Expect a real chunk of platform-specific code here; the LLM will need explicit references to the Win32 / Cocoa snippets — copy them in.
3. **Steamworks SDK integration.** Steam library auth (skip the OpenID round-trip — the user is already logged into Steam, use `client.localplayer.getSteamId()`), proper launch (`IApps::LaunchGame` or `client.apps.launchGame`), proper launch/return callbacks. Replace `window.location.href = 'steam://run/...'` for desktop builds; web build keeps it for the share-viewer surface. Call `electronEnableSteamOverlay()` at the end of `main.js` so the Steam overlay attaches.
4. **Multi-monitor support.** Let the user pick which monitor the wallpaper lives on; remember the choice across restarts.
5. **Three-tier render loop** (Wallpaper Engine's most-copied feature). Three states: **full speed** when the desktop is visible and the user is interacting, **throttled** (~10–15fps, physics paused) when the wallpaper is partially occluded, **fully paused** when a fullscreen game is in the foreground. r3f's `frameloop="demand"` is the right primitive for the throttled tier; detect fullscreen game via Steamworks `IFriends::GetFriendGamePlayed` on the local player. This is the single biggest "trust signal" a wallpaper utility can ship — without it, users disable it after a week.

### Concepts to learn
- **Native wrappers** — Tauri's IPC model (Rust commands invoked from JS) vs. Electron's main/renderer split (Node.js main process vs. Chromium renderer). Both work for this; the tradeoff is mostly bundle size, binding maturity, and platform-API ergonomics.
- **Wallpaper APIs** — Windows: hijacking the `WorkerW` window behind the desktop icons. macOS: setting `NSWindow.level` to `kCGDesktopWindowLevel`. These are old, well-documented tricks; there are working open-source examples for both.
- **Steamworks SDK basics** — apps, friends, activation. The SDK is C++ with thin bindings in most ecosystems (`steamworks.js` for Node/Electron, the `steamworks-rs` crate for Tauri). You sign a Steamworks partner agreement to use the SDK on a real `appid`; for dev, you can use Steam's `480` (SpaceWar) as a stand-in.
- **Frame-rate throttling and `frameloop="demand"`** — r3f only renders on demand instead of every animation frame. Critical for wallpaper-mode where you want zero CPU/GPU when idle.

**Done when:** The desktop app runs as a live wallpaper on at least one OS (Windows or macOS — the other one can lag a phase if needed). Launching a game from the world starts that game via Steamworks (not via `steam://`). Quitting the game returns you to the world with the return ritual playing — for real this time, not on focus-event guess. Multi-monitor picks the right monitor and remembers across restarts.

---

## Phase 7 — v0.7–0.9: Polish cluster (3–4 weekends)

**Goal:** Build out the polish between native-wrapper-lands and Steam-launch-ready. Performance hardening for the v1.0 ship target, share-image / share-video export, the read-only walkable web-viewer that v1.0 makes public, more ritual variants including per-game custom rituals.

### Tasks
1. **Performance hardening.** Instancing, LOD, texture atlasing where it makes sense. Target: 60fps on a mid-range laptop with a 50-object scene; 30fps wallpaper-mode on integrated graphics with idle-mode optimisations active.
2. **Share-image + share-video export pipeline.** Click a button, get a PNG of your world + a 10-second flythrough MP4 you can share. Browser-side via `MediaRecorder` for the easy version; server-side rendering on the Worker (with headless three) if quality demands it.
3. **Web-viewer (read-only walkable view).** Same scene code, share-URL flow from Phase 5, but hardened for arbitrary inbound viewers — no payment, no Steam login required, just walk. This is what v1.0 opens up publicly.
4. **More ritual variants.** Round out the generic library to ~5 (book opens, lantern lights, case file opens, sit at campfire, plus one more) so every archetype has a fitted ritual.
5. **Per-game custom rituals** for the top 2–3 titles in your library. Hades's lighthouse re-lighting with that specific blue flame; Disco Elysium's case file opening with the cursed pencil; whatever fits *your* library specifically. These are the project's signature moments — worth disproportionate time.
6. **Audio integration in the desktop runtime.** Ambient beds change by metaphor; interaction stings on rituals; volume ducks when wallpaper-mode is idle.
7. **(Optional) Stage 6 reveal narration.** ElevenLabs TTS — first time you open a new metaphor, hear a 10-second reveal in a narrator voice describing the world ("you wake in a research station that hasn't seen its crew in years..."). Premium toggle, off by default. Skippable until v1.0 if Phase 7 is running long.

### Concepts to learn
- **Three.js instancing and LOD** — `<Instances>` for repeated objects, `<Detailed>` for distance-based mesh swaps. Drei has both.
- **Browser video capture** — `MediaRecorder` against a canvas stream. Cheap and works; quality is mid. Headless-three on the Worker is the harder path with better output.
- **Performance profiling** — Chrome DevTools "Performance" tab, the rendering panel for paint flashing, three's own `stats.js`. Frame stats + draw-call counts are the two numbers to watch.
- **Audio mixing** — Howler.js or the Web Audio API. Ducking (lowering ambient volume when a sting plays) is a few extra lines on top of either.
- **Animation polish** — `@react-spring/three` for tweens; easing curves matter as much as duration. A 2s animation with the wrong easing feels sluggish; the right easing feels weighty.

**Done when:** A v0.9 build is good enough that you'd feel comfortable showing it to a non-developer friend without caveats. Performance is the gating concern; everything else is a quality lever you can pull at your own pace before v1.0.

---

## Beyond Phase 7: v1.0 Steam launch and v1.x Workshop

These are out of scope for the build plan above, but the launch is gated by paperwork as much as code — here's what that paperwork actually is so it doesn't surprise you on the run-up.

### v1.0 Steam launch — the paperwork checklist

Surface these the moment Phase 6 starts; the Steamworks queue is the long pole and Steam Direct's 30-day clock can't be hurried.

1. **Steamworks partner application.** Start in parallel with Phase 6 (native wrapper). Onboarding includes identity verification, tax interview, bank details. Takes 1–4 weeks; cannot be parallelised with anything inside Steam.
2. **Steam Direct fee — $100 USD, non-refundable.** Recoupable as credit against your first $1,000 in adjusted gross revenue. Paid in Steam's checkout. **Triggers the 30-day mandatory wait** between fee payment and release-eligible status.
3. **Coming Soon page — must be public for ≥2 weeks** before launch. This is your wishlist-accumulation window and the algorithm signal Valve weighs heaviest. Median Steam Next Fest gains ~200 wishlists; top 5% gain ~7,000; games entering launch with <2,000 wishlists get little algorithmic lift. Plan a 6–8 week pre-launch run where every post drives wishlist clicks.
4. **AI Content Survey** (per SPEC §6.1 + §11). Disclose both **Pre-Generated** (Stages 2–6 baked assets — Blockade Labs / Midjourney-FLUX / Meshy / Stable Audio / ElevenLabs) and **Live-Generated** (Stage 1 — Claude at runtime). Live-Generated requires the guardrails description: structured-JSON-only output, server-side whitelist validation, no free-form runtime image/audio/3D generation, Anthropic's content-safety layer. Word it as a feature, not a confession.
5. **Store-page assets** — capsule images (231×87, 467×181, 616×353, 1232×706), header (460×215), library hero/capsule, screenshot set (1280×720 or 1920×1080, ≥5), trailer (≥30s), short description (~300 chars), long description (no length cap but expect skim-reading). Build these from real generated worlds; nothing screenshot-able means nothing on the store page.
6. **EULA + refund-policy review** — Steam's standard 14-day / <2-hour refund applies; nothing custom needed unless we want to layer on top.
7. **Steamworks SDK license acknowledgment.** §2.3 of the SDK license (text on file at `desktop/STEAMWORKS_SDK_LICENSE.txt`) requires the app not to imply partnership with Valve. §1.1(b) permits shipping `redistributable_bin` content alongside the Licensee Software, but the license terms travel with us. Concretely at v1.0: include the SDK license text in the app's about/credits screen, and reference it in the store-page legal text. Not a blocker; just a small text-asset item.
8. **Review process — 1–5 business days** after submission. Common rejection reasons: store assets misleading vs. actual product, build crashes on launch, undisclosed AI content. Submit at least a week before your target launch date to absorb a re-submit.

Plan ~6–8 weeks between "feature-freeze on Phase 7" and "release day" — Coming Soon clock + Steamworks queue + AI disclosure paperwork + store-page asset production all run inside that window.

### v1.x Steam Workshop — moderation pipeline is a prerequisite, not a follow-up

Workshop opening is the long-term moat (SPEC §10) but on day one it imports every UGC platform's chronic problems — NSFW content, IP-infringing fan art, malicious "application" templates, harassment via custom content. The moderation pipeline has to exist *before* Workshop opens. Specifically:

1. **Workshop templates ship as static baked assets only.** No live AI generation from community templates — that path runs only for our own first-party Stage 1 pipeline. Community templates carry pre-baked GLB / KTX2 / WAV / scene JSON; nothing executable, no prompts that run on someone else's machine.
2. **Pre-publish moderation queue.** Image-moderation API on every preview image — Cloudflare Images' built-in moderation, Hive, or AWS Rekognition. Auto-reject obvious NSFW; route ambiguous flags to a manual queue. Don't auto-publish.
3. **Polycount + file-size + asset-type validation** at submission. Reject templates over a poly/texture/audio budget (defends against perf-tanking content and against attempts to smuggle large binaries).
4. **DMCA flow on our own site**, supplementing Valve's. Valve's Workshop moderation is light-touch and slow; we need a faster path for clear infringement.
5. **Remote kill-switch.** Cloudflare Workers endpoint the desktop app checks on launch; blocked template ids refuse to load. Lets us yank a published template the moment a report lands without waiting for Valve.
6. **No revenue share for Workshop content.** Per SPEC §10, Workshop stays free — Wallpaper Engine tried a paid Workshop store and abandoned it for exactly the problems above plus codec/licensing/buyer-confusion. Don't repeat that.

The right time to design this pipeline is at the *end* of Phase 7, before Steam launch — once we have v0.9 stable enough to know what a "template" actually looks like as a payload. Building it earlier wastes work; building it later turns Workshop opening into a months-long crisis.

---

## Realistic timeline

At full-weekend pace (~20h/week), accounting for debugging time and the inevitable detours:

| Phase | Weekends |
|---|---|
| Phase 0 — Setup | 1 |
| Phase 1 — v0.1 vertical slice | 4 |
| Phase 2 — v0.2 Steam + HLTB | 2 |
| Phase 3 — v0.3 IGDB + templates | 3 |
| Phase 4 — v0.4 State treatment | 2 |
| Phase 5 — v0.5 Procedural + share | 3 |
| Phase 6 — v0.6 Native wrapper | 3 |
| Phase 7 — v0.7–0.9 Polish cluster | 3–4 |
| **Total to v0.9 (pre-Steam-launch)** | **~21–22 weekends** |

That's roughly five months at full weekend cadence. Expect the early phases (v0.1's worker setup and Meshy curation, v0.3's template work) to overrun, and Phase 6 (native wrapper) to be lumpy depending on which OS you target first. Later polish phases tend to be faster because the patterns are set.

If you hit 6 weekends on v0.1 and aren't close, that's a real signal — pause and write a retrospective before pushing through. Sunk cost is a worse advisor than honest re-evaluation.

---

## When to stop and reconsider

Hard checkpoints. If you hit one of these, pause and write a note in the repo before deciding to push through:

- **End of Phase 1.** Does the painted-3D + LLM combination actually deliver the personalisation magic? If "almost" — that's the moment to rework the approach (different aesthetic, different rendering bar, possibly a stripped-down scope), not to grind through the next 17 weekends hoping it lands. SPEC §9 explicitly names this as the re-evaluation point.
- **Mid Phase 3.** Are templates feeling samey because Meshy/Tripo can't differentiate visual identity strongly enough between them? Either budget for commissioned hero art (SPEC §12) on 1–2 hero templates, or cut scope to two strong templates instead of five. Five mediocre templates is worse than two distinctive ones.
- **End of Phase 5.** Does the share-URL flow actually drive friends to look? If you share a few worlds and nobody clicks, the share artifact isn't doing its job and Phase 6 (the paid-product native wrapper) is premature — fix the share story first, because the share surface is also the marketing channel for v1.0.
- **End of Phase 6.** Does wallpaper mode actually feel like something you'd run all day? If it's a novelty you turn off after a week, the v1.0 product premise (live wallpaper as the primary value-add) needs re-examining before Phase 7 polish goes in.

---

## Tool stack quick reference

When the LLM asks "should I use X" and you don't recognise X, this is the project's chosen kit. Push back if the LLM tries to swap any of these without good reason.

- **Three.js + react-three-fiber + drei** — the 3D scene
- **@react-three/rapier** — physics
- **Vite + React + TypeScript** — build / dev / type-checking
- **Zustand** — state management (not Redux, not Recoil, not Context-everything)
- **Cloudflare Workers + KV** — backend, cache, share storage; the single AI orchestration surface
- **Anthropic Claude Opus 4.7** — Stage 1 (world manifest: metaphor, casting, role text)
- **Ollama + Qwen 3 14B** — local LLM for dev iteration only (never production)
- **Blockade Labs Skybox AI** — Stage 2 skyboxes (template-build time)
- **Midjourney v7 / FLUX 2 Pro** — Stage 3 environment textures (template-build time); local FLUX.1 Schnell for dev
- **Meshy / Tripo / TRELLIS-2** — Stage 4 hero 3D objects (template-build time)
- **Stable Audio 2.5 + ElevenLabs Music** — Stage 5 ambient + interaction audio (template-build time)
- **ElevenLabs TTS** — Stage 6 reveal narration (optional, v0.8+)
- **Kenney, Quaternius, Poly Pizza** — CC0 filler assets (one library per template — aesthetic coherence)
- **@react-spring/three** — animations
- **Howler.js** — audio playback in the runtime
- **Tauri OR Electron — TBD at v0.6** — native desktop wrapper
- **Steamworks SDK (v0.6+)** — library auth, launch, return-trip detection; replaces `steam://` in the desktop build

---

*Last updated: 2026-05-16. Next review: end of Phase 1 retrospective.*
