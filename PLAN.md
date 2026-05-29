# Memory Palace — PLAN.md

**Status:** Build plan for the Memory Palace 2D pixel-art terminal-aesthetic
agent simulation, post-pivot from LibraryWorld 3D (May 2026). Annotated
for an LLM-driven workflow at full-weekend cadence (~20h/week). Phase 0
spike complete (2026-05-22, `RETROS/phase-0-spike.md`); Phase 1
(renderer foundations) in progress.

**Pivot context.** Phases 1–5 of the 3D LibraryWorld build shipped before
the May 2026 pivot to Memory Palace (full rationale in
`docs/pivot/DESIGN.md` + `docs/pivot/FEASIBILITY.md`; SPEC.md Appendix A
preserves the 3D-era spec verbatim). Substantial pieces transferred —
Steam OpenID auth, behavioural profile, library-state model, deterministic
seeded procedural layout (mulberry32 + FNV-1a), the Cloudflare Worker
backend, the Electron wrapper with Steamworks SDK + wallpaper-mode revival.
The phase numbering below is the **Memory Palace numbering**, not a
continuation of the 3D-era numbering.

---

## How to work with this plan

You're driving, the LLM is typing. Your job isn't to write code — it's to keep the build on the rails. That means:

**Always pin context.** Before any non-trivial task, paste `SPEC.md`, `CLAUDE.md`, and the file(s) being changed into the LLM's context. The LLM's defaults will not match this project's conventions unless it sees them. Claude Code reads files automatically; in a chat LLM, paste them by hand.

**Ask for small slices.** "Render the cell room with WFC and bookshelf sprites" beats "build the whole renderer." Small slices let you verify in the browser before the next slice. If the LLM tries to deliver 400 lines across 8 files in one shot, push back: *"Step 1 only. Show me the smallest change that gets the WFC room rendering; we'll add bookshelves after I see it."*

**Verify visually, not by reading code.** Run `npm run dev`, look at the browser, test the actual loop. If it looks right and feels right, commit. You don't need to understand every line — you need to know that the room renders, the agent walks, the theme swaps.

**When something breaks, paste the exact error.** Console errors, terminal stack traces, screenshots of broken visuals — copy verbatim into the LLM. Don't paraphrase. The LLM is far better than you (or me) at pattern-matching errors to causes.

**Commit at every green checkpoint.** A working build before each task means rolling back when the LLM goes sideways is free. `git commit -am "WFC renders enclosed room"` between every slice. If you're not sure how to roll back, ask the LLM — `git reset --hard HEAD~1` is the one-liner, but you should understand what it does before running it.

**Catch scope creep.** LLMs love to refactor. If you asked for "render the WFC room" and the diff touches 11 files, stop and ask what changed and why. Often the answer is fine; sometimes it's "I also renamed your folder structure because I thought it was cleaner" — which is when you reject and re-ask.

**Use the todo system.** If you're driving Claude Code, let it maintain a todo list and check it off as it goes. If you're using a chat LLM, keep your own `TODO.md` in the repo — track exactly where you are in this plan, what's done, what's blocked.

**One more thing:** "the LLM did the coding so it'll be much faster" is half true. The typing is faster, yes. But debugging without being able to fluently read code is genuinely slower — when something breaks subtly (the room renders but the agent walks through walls) you can't just glance at the code and spot it. Expect a 1.5–2x slowdown vs. an experienced coder on debugging-heavy phases, balanced by being much faster on scaffolding. Net: the timeline below is honest for your situation.

---

## Phase 0 — Spike (COMPLETE, 2026-05-22)

**Goal:** prove the stack closes end-to-end before committing to the
v1.0 arc. Five integration checks; all green.

Shipped:
1. **PixiJS v8 hello-world** rendering Solarized Dark with box-drawing
   panel. HMR + clean teardown.
2. **Electron + PixiJS in wallpaper mode** on Win11 22H2+. Initially
   deferred to v1.x after `ERROR_INVALID_WINDOW_HANDLE (1400)`;
   revived same-day on `claude/wallpaper-revival` after reading Lively
   Wallpaper's actual C# source. Real bugs: wrong reparent target on
   raised-desktop topology (Progman not WorkerW), WS_CHILD must be set
   manually before SetParent per MSDN, SWP_FRAMECHANGED needed to
   propagate style changes, **koffi marshals Node Buffers passed for
   `void*` as buffer addresses not contents** (the load-bearing fix:
   `buffer.readBigInt64LE(0)` → bigint).
3. **Steamworks.js init + Steam overlay** against SpaceWar appid 480.
   Overlay renders over PixiJS canvas on Shift+Tab. Ticket auth path
   intact from v0.6 slice 2.
4. **Worker on its own.** `/healthz` ok; `/api/share` drop didn't
   regress compilation; all routes serve.
5. **Tier 1 agent round-trip.** Renderer → worker → Ollama (local Qwen
   2.5 7B) or Anthropic Haiku 4.5 → coherent JSON `{action, intent}`
   back to renderer console. Local CPU latency 27s (Phase 2 follow-up:
   GPU detection); Anthropic Haiku latency 1.7s.

**Post-spike cleanup (prune commits A–E):** repo renamed to
`lokilibrary`; v0.6 `desktop/` archived to `legacy-desktop-v0.6/`;
minimal new `desktop/` (Electron + Steamworks + IPC, no wallpaper
initially). Wallpaper revival landed on `claude/wallpaper-revival` on
top of the minimal base.

**Filed during Phase 0 (long-pole paperwork):**
- ⬜ Steam Direct partner application (30-day clock — confirm filing
  status; FEASIBILITY says file during Phase 0 so the clock runs
  parallel to Phases 1–5)
- ⬜ Tax interview / identity verification

---

## Phase 1 — Renderer foundations (IN PROGRESS)

**Goal:** turn the empty Solarized canvas into a deterministic,
themeable, bitmap-fonted single-library-room with the test agent Loki
walking around. Scaffold the scale-ladder state machine. Doc rewrites.

The active plan for Phase 1 lives at
`/home/henrydemontfort/.claude/plans/i-m-pivoting-this-project-cozy-newell.md`.

### Tasks (5 sub-slices)

**1A — Doc rewrites (½ day).** Rewrite root `CLAUDE.md`, `SPEC.md`,
`PLAN.md` from LibraryWorld to Memory Palace. 3D-era SPEC archived as
SPEC.md Appendix A. **(this file is the 1A output.)**

**1B — Bitmap font + multi-theme (½ day).** Cozette 6×13 PNG + FNT
into `public/fonts/`. `src/render/fonts.ts` loader + `hexToInt`
helper. Four new theme JSONs (Gruvbox Dark, Catppuccin Mocha, Tokyo
Night, IBM-3270) matching the existing `Theme` shape. `src/themes/
index.ts` registry. Swap system Text → BitmapText in PixiApp.

**1C — WFC + tile bible + cell renderer (1 weekend).** Hand-rolled
tiled-model WFC in `src/procedural/wfc.ts` (~150 LOC,
Mulberry32-seeded, backtracking budget + floor fallback). 12-tile
library-room bible in `src/procedural/tiles/library.ts`. `layoutCell`
+ `mountCell` rendering a 24×16 enclosed room with bookshelf rows.
Bookshelf slots map to `profile.topGames` deterministically.

**1D — Scale ladder + playerPos + Loki sprite (1 day).** `scale:
ScaleLevel` Zustand slice (cell/district/island/continent/planet/
solar_system). `playerPos.ts` revived as vec2 module-local singleton
(not in Zustand — 60Hz mutation would re-render). `mountDistrict` +
`mountStubLevel`. PixiApp subscribes to scale, tears down/remounts the
level Container (not the Application). `[ / ]` zoom; WASD/arrows
movement with floor-only collision. Loki random-walk sprite (Tier 0
BT, no LLM call).

**1E — Scatter + integration polish (½ day).** 2D rewrite of
`legacy-3d/procedural/scatter.ts` — Mitchell-style rejection sampling
against the tile grid + new keepouts (walls, bookshelves, doors,
player spawn, Loki spawn). Scatter glyphs decorate floor (chairs,
plants, lamps, book stacks); they do NOT block movement.

### Concepts to learn (if newer to the stack)

- **PixiJS v8 BitmapText.** Subclass of Text, face-name string
  reference. Tinted per-theme via numeric `0xRRGGBB`. v8 API differs
  from v7 — reference the v8 docs, not StackOverflow.
- **Wave Function Collapse (tiled model).** Min-entropy heuristic;
  each cell collapses to one tile based on weighted random pick over
  the still-valid options. Adjacency rules propagate constraints to
  neighbours. Backtracking on conflict. ~150 LOC is enough for a
  12-tile bible.
- **Zustand `subscribe` vs `useStore`.** Inside React components, use
  the `useStore` hook (re-renders on change). Inside imperative code
  (the PixiApp lifecycle, the level routers), use `subscribe` to
  register a callback without React involvement.
- **Module-local singletons for frame-rate mutation.** `playerPos.ts`
  is `export const playerPosition = { x: 0, y: 0 }`. Mutated by
  keyboard handlers; read by the Ticker each frame. NEVER put this
  in Zustand — 60Hz mutation triggers 60 re-renders per second.

**Done when:** the dev server shows a Cozette-rendered library room
in Solarized Dark; WASD moves the `@` player with wall collision;
`[ / ]` cycles scale levels through cell → district → 4 stubs; theme
swap (edit `DEFAULT_THEME_ID` and reload) changes palette without
changing layout (determinism); Loki wanders the floor deterministically;
the Phase 0 Tier 1 round-trip still logs to console. Five Phase 0
integration checks re-run green.

---

## Phase 2 — Agent v0: Smallville on the cell level (4–6 weeks)

**Goal:** the cell room is no longer empty. 4–6 agents (including a
proper Loki) inhabit it, with spatially-bounded perception, persistent
memory, and Tier 1 LLM calls firing on perception events. The agent
society is the product's emotional core; this is the phase that proves
or breaks it.

### Tasks

1. **Tiered router scaffold** (`src/agents/router.ts`). Tier 0 BT/utility-AI
   default tick (1–10 Hz, no LLM). Tier 1 dispatcher (Anthropic Haiku
   or Ollama Qwen 2.5 7B via `LLM_PROVIDER`). Tier 2 dispatcher
   (Anthropic Sonnet). Telemetry from day one: log `{agent_id, tier,
   tokens_in, tokens_out, latency_ms, model, provider}` to a SQLite
   table; surface as a debug overlay.
2. **Memory stream + SQLite + sqlite-vec** (`src/agents/memory.ts`).
   `better-sqlite3` for the memory store, FTS5 for keyword retrieval,
   `sqlite-vec` for vector retrieval, `nomic-embed-text` via local
   Ollama for embeddings. Smallville-style triplet: recency × relevance
   × importance. Cap N=1,000 entries per agent; age out via importance
   × recency decay. Persist in `userData/memory.sqlite`.
3. **Spatially-bounded perception** (`src/agents/perception.ts`). 2D
   circular FOV radius around each agent. The simulation only feeds
   the LLM events from inside that radius. The agent only knows about
   parts of the world it has actually explored.
4. **Loki personality system prompt** (`src/agents/persona/loki.ts`).
   Mischievous procedural reorganisation; small daily surprises at
   cell level (books move, notes appear). **No engagement /
   retention objectives in the prompt** — the persona is creepy if the
   agent has agendas. Aesthetic preferences, not instrumental goals.
5. **4–6 NPCs.** Tiered: one named "your" agent (Loki by default),
   plus ambient NPCs with shallower behaviour. Animal Crossing / Stardew
   structure. Each NPC gets a personality fragment, a starting position,
   a schedule.
6. **Bookshelf interaction (deferred to Phase 2; was OUT of Phase 1).**
   Walk up to a bookshelf, press E → small interaction prompt → option
   to launch the game via Steamworks SDK (desktop) or `steam://run`
   (web). Loki notices when you launch a game ("you went to play
   Hades again"); this is the agent's first observable response to
   user action.
7. **GPU detection for Ollama** (carryover from Phase 0). Tier 1
   latency on CPU is 27s; expected <1s once Ollama detects the 4070.
   Without this, local dev with Qwen is impractical; we'd default to
   Anthropic Haiku for everything.

### Concepts to learn

- **Stanford Smallville architecture.** Read the paper
  (`dl.acm.org/doi/fullHtml/10.1145/3586183.3606763`) and the reference
  implementation (`joonspk-research/generative_agents`). The reflection
  threshold of 150 importance and the recency × relevance × importance
  retrieval formula are not invented; they're load-bearing constants.
- **Cost discipline via tiering.** Tier 0 default + batched Tier 2
  reflections (queue events, fire one reflection per agent per
  real-world hour, not per game-time hour). Cost target: ≤
  $1/user/month at Claude Sonnet rates. Telemetry tells you the truth.
- **Vector retrieval in SQLite.** `sqlite-vec` is a pragma-loaded
  extension; embeddings stored as BLOB. Nearest-neighbour search via
  cosine similarity. FTS5 covers keyword retrieval. Combine for
  hybrid retrieval per the Smallville pattern.
- **Embeddings.** `nomic-embed-text` is 137M params, ~270 MB, runs
  locally via Ollama. Latency is sub-100ms per chunk on CPU. Output
  dimension 768. Local-only is the privacy contract: user lore + agent
  memories never leave the machine.

**Done when:** 4–6 agents inhabit the cell room. Loki notices when
you walk near a bookshelf and leaves a small marginalia note nearby
(per IDEAS.md "agent-as-marginalia" Depth 1). Memory persists across
restarts. Cost-per-user-hour telemetry confirms ≤$1/user/month
trajectory. Pressing E on a bookshelf launches the game in Steam.

---

## Phase 3 — Pixel-art pipeline (3–4 weeks)

**Goal:** swap pure-glyph rendering for actual pixel-art sprites where
they add value. Hero objects (bookshelves, agents, key landmarks) get
generated sprites; floor + walls + scatter can stay glyphs if that
reads better.

### Tasks

1. **Python sidecar process** spawned by Electron. `diffusers` +
   `nerijs/pixel-art-xl` LoRA + base SDXL. Spawned on demand; killed
   after a quiet period.
2. **VRAM detection** → fall back to **PixelLab.ai API** if <8 GB.
   Behind a `PixelArtProvider` interface in `src/agents/pixelart.ts`.
   Both providers wrapped identically; the dispatcher reads from a
   `PIXELART_PROVIDER` config or auto-detects.
3. **Palette enforcement.** Pillow `Image.quantize(palette=palette_image,
   dither=Image.Dither.FLOYDSTEINBERG)` against the active theme's
   32-colour palette. Then **Astropulse PixelDetector** for grid-snap.
4. **Cache key:** `(appid, theme_id, prompt_template_hash)`. Cached
   sprites live in `public/sprites/{template_id}/`. Pre-generate the
   user's top-20 sprite set on first run after Phase 3 ships.
5. **Sprite-aware cell renderer.** Where a sprite exists for a tile,
   render it; else fall back to the glyph. This is the visible
   upgrade.

### Concepts to learn

- **SDXL fine-tuning ecosystem.** LoRA = Low-Rank Adaptation, small
  additional weights (~163 MB for `nerijs/pixel-art-xl`) loaded on top
  of base SDXL. Trigger word `pixel art` in the prompt activates the
  LoRA. Pair with **LCM-LoRA** for 8-step generation at guidance 1.5
  for ~4× speed-up.
- **IP-Adapter style anchoring.** Anchor every per-user generation to
  a single reference sprite sheet so the style stays consistent across
  days/sessions. Avoids "output style drift" — the cardinal sin of
  generative pipelines.
- **Palette quantize.** `Image.quantize` against a 1×N PNG of the
  target palette is deterministic. Floyd-Steinberg dithering is
  default; Atkinson dithering (via `pyxelate`) is the trendier choice
  for tighter pixel-art look.

**Done when:** the top-20 games in your library have generated
bookshelf sprites in the active theme's palette. Style is consistent
across sessions (refresh produces visually-similar sprites for the
same game). VRAM-detection branch works on both ≥8 GB and <8 GB
machines. Cache-hit rate after first run is >95%.

---

## Phase 4 — Wallpaper polish (2–3 weeks)

**Goal:** the wallpaper feels like Wallpaper Engine, not a tech demo.
Three-tier throttling, multi-monitor, peek, fullscreen-game detection.

### Tasks

1. **Three-tier throttling** (`desktop/src/wallpaper/throttle.ts`).
   - **FULL** when desktop visible, no fullscreen foreground app.
   - **THROTTLED_1HZ** when a non-fullscreen window covers the
     wallpaper. Detect via `EnumWindows` + `GetWindowRect` pixel-perfect
     size comparison against the screen.
   - **PAUSED** when a fullscreen game is foreground. Detect via
     `GetForegroundWindow` + `GetWindowRect` matching monitor full
     resolution. Cross-check with Steamworks `IFriends::GetFriendGamePlayed`.
2. **Multi-monitor picker.** Tray → Display submenu lists connected
   monitors; pick one for the wallpaper. Persist the choice in
   `userData/config.json`.
3. **Peek hotkey** (Ctrl+Alt+L). Global hotkey via Electron
   `globalShortcut`. Lifts the wallpaper window into the foreground
   temporarily; same hotkey (or tray "Exit peek") returns it.
4. **WorkerW destroyed watchdog.** Phase 0 revival wired a 2-second
   `IsWindow(workerW)` poll. Extend it to fully re-attach
   (`SendMessageTimeout 0x052C` + `SetParent` + `SetWindowPos`) on
   destruction. Test against Win11 26xx insider builds where the
   hierarchy resets on explorer.exe restarts and dwm.exe updates.
5. **macOS wallpaper port** (`desktop/src/wallpaper/macos.ts`).
   `NSWindow.level = CGWindowLevelForKey(kCGDesktopWindowLevel)`.
   Equivalent single-call. Confirm Steamworks runs on macOS — if not,
   ship the wallpaper without the launcher path on Mac.

### Concepts to learn

- **Wallpaper Engine's heuristic.** Pixel-perfect window-size comparison
  is fragile but works in practice. Source-engine games and
  Chromium-based borderless windows are the historical edge cases;
  expect to tune.
- **Electron `globalShortcut`.** Registered in the main process;
  delivered to the renderer via IPC. Must be unregistered on app
  quit to avoid system-wide hotkey leaks.
- **macOS NSWindow.level.** The window manager assigns levels;
  `kCGDesktopWindowLevel` is below all normal windows. No need to
  reparent like Windows.

**Done when:** the wallpaper runs at FULL while you're working at
the desktop, drops to 1Hz when you maximise a window over it, pauses
entirely when you launch a game from your library. Multi-monitor
picks the right monitor and remembers across restarts. Ctrl+Alt+L
peeks reliably. macOS wallpaper at least renders.

---

## Phase 5 — Reflection completion + sleep mode + lore (4–6 weekends)

**Goal:** the agent layer goes from "responds to perception" to
"reflects + plans + acts on plans" — and the user can upload their own
lore that the agents reference. This is the phase that lands
**agent-as-marginalia Depth 1 robustly** (the agent expresses itself
through what changes in the world; reflections drive placement) and
the "feels yours" jump from lore-seeded worlds.

**Scope reconciled against `docs/pivot/CONSOLIDATION.md`** (the
authoritative v1.0 strategy doc, 2026-05-28). PLAN.md's earlier Phase
5 had six tasks lifted from the 3D-era plan; this Phase 5 prunes them
to four slices aligned with CONSOLIDATION.md's v1.0 scope and the
2026-05-28 IDEAS.md Sleep mode entry.

### Slices

**5R — Docs reconciliation (no code, single commit).** Establish
CONSOLIDATION.md as the authoritative strategy doc; bring it onto the
working branch; rewrite this Phase 5 section; create `docs/INDEX.md`
mapping each doc to its scope; minor CLAUDE.md amendment for the
per-real-hour reflection rate-limit added in 5A.

**5A — Reflection completion (~1.5 weekends).** Finishes what Phase 2D
shipped (threshold-150 + Sonnet reflection rows). Adds three coupled
pieces:
- Per-agent real-hour rate-limit on Tier-2 dispatch
  (`REFLECTION_MIN_INTERVAL_MS = 3600000`). The cost cap per CLAUDE.md.
- Worker `/api/agent/reflect` extended to emit a `plan` field
  (multi-step plan using existing `PlanPayload` schema). Router
  parses + persists via `memory.recordPlan` (already wired from
  Phase 2E place_mark). Sets `runtime.activePlan`.
- Tier-0 BT (`src/agents/behavior.ts`) scores a new
  `execute_plan_step` candidate between intent-driven approach (0.7)
  and schedule rules. Agents *walk to the target* and *place the
  mark* — the marginalia rendering from `src/render/levels/cell.ts:179`
  already absorbs the new plan rows.

**5B — Sleep mode + morning dispatch (~1 weekend).** Per the IDEAS.md
2026-05-28 entry; completes the Phase 4 throttle ladder.
- `ThrottleState` gains `'sleeping'` (4th state: unfocused + no
  fullscreen game + system idle > 10 min, via Win32 `GetLastInputInfo`).
- During SLEEPING, the rate-limit relaxes (≈5 min instead of 1 hour)
  so each agent fires one Tier-2 to populate the overnight memory.
- On SLEEPING → FULL transition, a terminal-styled "morning dispatch"
  banner surfaces what the agents did overnight (reflection text +
  placed-mark summaries). This IS the Depth-1 marginalia output the
  user explicitly framed in IDEAS.md — NOT a separate dream-sequences
  feature.

**5C — Lore upload (text-only MVP) (~1.5 weekends).** Per
CONSOLIDATION.md "lore-seeded worlds = the primary personalisation
lever." Split into two commits:

**5C.1 ✅ embedding backbone** (shipped 2026-05-29):
- Worker `/api/embed` (was a 501 stub from Phase 2D) implemented for the
  local provider only — `{texts}`→`{embeddings}` 768-dim via
  `nomic-embed-text` through local Ollama (CLAUDE.md privacy contract,
  embeddings never leave the machine). Cloud path stays 501.
- Pure zero-dep chunker (500-token windows, 50-token overlap) — **no
  tiktoken**: worker + web share one `package.json`, so a WASM tokenizer
  would hit the web bundle for no gain (nomic tokenizes server-side).
- Client `embedTexts()` wrapper + nomic task prefixes.

**5C.2a ✅ lore store + retrieval + reflect injection** (shipped
2026-05-29):
- Separate `lore` / `lore_fts` / `lore_vec` tables (additive, no
  migration, library-scoped). `lore_vec` uses `distance_metric=cosine`.
- db methods (insert/attach/recent/searchFts/searchVec/count) +
  `retrieveLore` (cosine KNN with recency fallback) + writer surface
  (`recordLore`/`recentLore`/`loreCount`).
- `routeTier2` gathers lore (`lore-context.ts`, best-effort, skips when
  empty) → `ReflectInput.recentLore` → worker `recent_lore:` prompt
  block + system-prompt line. **Cosine path verified in WSL** (sqlite-vec
  loads; 31-assertion smoke exercises real KNN + library isolation).

**5C.2b ⏳ lore drop-zone UI** (next):
- `.txt` / `.md` drop-zone in the renderer (DOM sibling of the canvas,
  not a PIXI overlay — file drop is a DOM API; toggle via Ctrl+U).
- chunk (`chunkText`) → embed (`/api/embed`) → `recordLore` wiring — the
  only thing missing before a user can actually *put* lore in.
- `will-navigate` drop-safety guard in `desktop/src/main.ts` (with
  `contextIsolation:false`, a stray drop navigates Chromium to the file).

**5D — Lore-driven world adaptation (~1-2 weekends).** Per
CONSOLIDATION.md "the world's aesthetic, factions, events, naming
derive from lore."
- Stage 1 `/api/world` manifest prompt gains a "lore_context" section
  when lore exists; bumps manifest cache to `v3`.
- Persona prompts gain a `loreContext` slot — Loki's voice adapts to
  uploaded lore's vocabulary.
- Bookshelf labels + scatter glyph palette pick from lore-themed
  weighted tables (LLM picks from a renderer-shipped whitelist; never
  emits arbitrary tokens).

### Deferred from the original Phase 5 (per CONSOLIDATION.md v1.0 scope)

- **Weekly dream sequences** — CONSOLIDATION.md explicitly excludes
  dream mode from v1.0. The "while you were away" surface lands in
  5B's morning dispatch instead; full dream sequences are v1.x.
- **Image + URL ingestion** for lore upload — text-only MVP first;
  follow-up slice for `.png` / `.jpg` mood boards (needs CLIP or
  multimodal embeddings) + URL fetch (Worker-side readability
  extraction).
- **Sparse-input follow-up questions** — needs a separate LLM call to
  ask the user clarifying questions when uploaded lore is thin. Bigger
  scope; follow-up slice.
- **Share-URL revival** — post-v1.0. Workshop may do the same job;
  revisit after launch.

### Concepts to learn

- **Smallville reflection mechanics.** The 150-importance threshold
  is the load-bearing constant — already shipped in Phase 2D. 5A adds
  the rate-limit (Smallville's "real-time bucketing") and the
  plan-output decomposition Smallville's reflection produces.
- **Chunked embedding.** ~500-token windows with 50-token overlap
  (standard). Each chunk embedded independently via
  `nomic-embed-text`. Retrieval returns top-K; LLM sees them as
  context.
- **Lore as embedded memory.** The user's lore competes for retrieval
  on equal footing with the agent's observations. This is what makes
  the agent feel like it "knows" the lore rather than referencing it.
- **Win32 `GetLastInputInfo`.** Returns ms since the last system-wide
  keyboard/mouse input. The right primitive for "user is idle" — fires
  during games + IDEs + browsers alike, not just our app's focus.

**Done when:** Loki produces a reflection-driven plan, walks to a
bookshelf, and leaves a marginalia mark — *without* a hardcoded
trigger like Phase 2E's bookshelf-launch path (5A). Leave the
wallpaper running overnight; wake to a terminal banner summarising
what the agents did + see new marks in the cell (5B). Drop a `.txt`
of your D&D campaign notes; within minutes Loki's next reflection
references a faction or character from the notes (5C). Force-refresh
the world manifest; bookshelf labels + agent voice adapt to the
lore's themes (5D).

---

## Phase 6 — Steam release (2 weeks)

**Goal:** ship on Steam. Store page polish, build review, release-day.

### Tasks

1. **Store page assets.** Capsule images (231×87, 467×181, 616×353,
   1232×706), header (460×215), library hero/capsule, screenshot set
   (1280×720 or 1920×1080, ≥5), trailer (≥30s), short description
   (~300 chars), long description. Build these from real generated
   palaces — nothing screenshot-able means nothing on the store page.
2. **AI Content Survey.** Disclose **Pre-Generated** (Phase 3 baked
   sprites) and **Live-Generated** (Tier 1+2 LLM calls). Guardrails
   text per CLAUDE.md / SPEC.md § 8.1: provider-side safety filters,
   palette + grid constraints, in-app report channel, Steam Overlay
   "illegal AI generation" report support.
3. **EULA + refund-policy review.** Steam's standard 14-day / <2-hour
   refund applies; nothing custom needed.
4. **Steamworks SDK license acknowledgment.** Per
   `desktop/STEAMWORKS_SDK_LICENSE.txt`: include the SDK license text
   in the app's about/credits screen, reference it in the store-page
   legal text.
5. **Build review** (1–5 business days). Common rejection reasons:
   store assets misleading vs. actual product, build crashes on
   launch, undisclosed AI content. Submit at least a week before
   target launch date to absorb a re-submit.
6. **30-day mandatory wait** between Steam Direct fee payment and
   release-eligible status. Should already be elapsed if Phase 0
   paperwork was filed on time.
7. **Coming Soon page ≥ 2 weeks public.** Wishlist accumulation
   window; the algorithm signal Valve weighs heaviest. Median Steam
   Next Fest gains ~200 wishlists; top 5% gain ~7,000; games entering
   launch with <2,000 wishlists get little algorithmic lift. Plan a
   6–8 week pre-launch run where every post drives wishlist clicks.

**Done when:** Memory Palace is live on Steam, the AI Content Survey
is filed accurately, and the first ten purchases have landed in your
Steamworks dashboard.

---

## Beyond Phase 6: v1.x Steam Workshop

These are out of scope for the build plan above, but Workshop is the
long-term moat — and on day one it imports every UGC platform's chronic
problems. The moderation pipeline must exist *before* Workshop opens,
not after.

### Workshop pipeline prerequisites

1. **Workshop templates ship as static baked assets only.** No live
   AI generation from community templates — that path runs only for
   our own first-party Tier 1+2 pipeline. Community templates carry
   pre-baked PNG sprite atlases + WAV + scene JSON; nothing executable,
   no prompts that run on someone else's machine.
2. **Pre-publish moderation queue.** Image-moderation API on every
   preview image — Cloudflare Images' built-in moderation, Hive, or
   AWS Rekognition. Auto-reject obvious NSFW; route ambiguous flags
   to a manual queue. Don't auto-publish.
3. **Polycount + file-size + asset-type validation** at submission.
   Reject templates over a sprite/audio/atlas budget (defends against
   perf-tanking content and against attempts to smuggle large binaries).
4. **DMCA flow on our own site**, supplementing Valve's. Valve's
   Workshop moderation is light-touch and slow; we need a faster path
   for clear infringement.
5. **Remote kill-switch.** Cloudflare Workers endpoint the desktop
   app checks on launch; blocked template ids refuse to load. Lets us
   yank a published template the moment a report lands without waiting
   for Valve.
6. **No revenue share for Workshop content.** Workshop stays free —
   Wallpaper Engine tried a paid Workshop store and abandoned it for
   the problems above plus codec/licensing/buyer-confusion. Don't
   repeat that.

The right time to design this pipeline is at the *end* of Phase 5,
before Steam launch — once we have v0.9 stable enough to know what
a "template" actually looks like as a payload. Building it earlier
wastes work; building it later turns Workshop opening into a
months-long crisis.

---

## Realistic timeline

At full-weekend pace (~20h/week), accounting for debugging time and
the inevitable detours:

| Phase | Weekends |
|---|---|
| Phase 0 — Spike | 1 (complete) |
| Phase 1 — Renderer foundations | 1–2 |
| Phase 2 — Agent v0 | 4–6 |
| Phase 3 — Pixel-art pipeline | 3–4 |
| Phase 4 — Wallpaper polish | 2–3 |
| Phase 5 — Reflection + lore | 3–4 |
| Phase 6 — Steam release | 2 |
| **Total to v1.0 (Steam launch)** | **~16–21 weekends** |

That's roughly four to five months at full weekend cadence. Phase 2
(agent layer) is the biggest single phase and the most likely to
overrun; everything downstream gets cleaner once the Smallville
architecture is in place. Phase 6 (Steam release) is calendar-bound
by the 30-day Steam Direct clock + Coming Soon page ≥ 2 weeks; it
can't be compressed by working harder.

If you hit 5 weekends on Phase 2 and the agents still feel like
canned-response bots rather than beings, that's a real signal — pause
and write a retrospective before pushing through. Sunk cost is a
worse advisor than honest re-evaluation.

---

## When to stop and reconsider

Hard checkpoints. If you hit one of these, pause and write a note in
`RETROS/` before deciding to push through:

- **End of Phase 1.** Does the WFC + bitmap-font + theme combination
  actually deliver the terminal-aesthetic magic the design pillar
  promises? If "almost" — that's the moment to rework the approach
  (different font, different glyphs, different palette tuning), not
  to grind through the next 15+ weekends hoping it lands. The
  aesthetic *is* the moat.
- **Mid Phase 2.** Are the agents feeling like beings or like
  canned-response bots? Smallville's architecture is well-validated
  but the persona depends on prompt craft. If "bots," budget a real
  prompt-engineering pass — Loki's system prompt is the single
  highest-leverage piece of writing in the project. Bad agent dialogue
  cannot be fixed by adding more agents.
- **End of Phase 3.** Does pixel-art actually add value over pure
  glyphs, or did the rendered sprites *lose* the terminal-aesthetic
  charm? Some games look better as glyphs. The right answer might be
  "sprites for heroes, glyphs for everything else" — be willing to
  walk back from pixel-art on the entire scene if the sprites read
  as off-brand.
- **End of Phase 4.** Does wallpaper mode actually feel like something
  you'd run all day? If it's a novelty you turn off after a week, the
  v1.0 product premise (live wallpaper as the primary value-add) needs
  re-examining before Phase 5–6 polish goes in. Watch for: thermal
  output (laptop fans spin up), battery drain in idle (>5% per hour
  is too much), visual fatigue (does the same room get boring fast?).
- **End of Phase 5.** Does lore-upload actually drive personalisation
  that feels like *yours*? If the world re-tunes but it still feels
  generic, the prompt-engineering needs another pass. Lore-upload is
  the product's most distinctive feature; if it doesn't land, the
  metaphor-convergence problem the pivot was meant to solve isn't
  solved.

---

## Tool stack quick reference

When the LLM asks "should I use X" and you don't recognise X, this is
the project's chosen kit. Push back if the LLM tries to swap any of
these without good reason.

- **PixiJS v8** — 2D sprite renderer (WebGL/WebGPU)
- **Cozette 6×13** — bitmap font for Phase 1 (later fonts must clear
  Steam Direct licensing review)
- **Vite + React 19 + TypeScript** — build / dev / type-checking
- **Zustand** — app state (not Redux, not Recoil, not Context-everything)
- **Cloudflare Workers + KV** — backend, cache, share storage; the
  single AI orchestration surface
- **Electron + steamworks.js + koffi** — native wrapper; koffi FFI for
  Win32 wallpaper-mode calls
- **Anthropic Claude Haiku 4.5** — Tier 1 agent micro-action LLM
- **Anthropic Claude Sonnet 4.6** — Tier 2 reflection / planning LLM
- **Ollama + Qwen 2.5 7B** — local Tier 1 for dev iteration (never
  production)
- **better-sqlite3 + sqlite-vec + FTS5** — Phase 2 memory stream
- **nomic-embed-text via Ollama** — local-only embeddings for memory
  + lore upload
- **diffusers + nerijs/pixel-art-xl LoRA** — local pixel-art pipeline
  (Phase 3)
- **PixelLab.ai** — cloud pixel-art fallback (<8 GB VRAM users)
- **Pillow + Astropulse PixelDetector** — palette quantize + grid-snap
- **mxgmn/WaveFunctionCollapse** (pattern; hand-rolled solver in Phase 1) /
  **BorisTheBrave/DeBroglie** (Phase 3+ escape hatch via WASM)
- **Stable Audio 2.5 + ElevenLabs Music** — Phase 5+ audio
  (template-build time only)
- **ElevenLabs TTS** — optional reveal narration (v0.8+)
- **Steam Direct + Steamworks SDK** — distribution

---

*Last updated: 2026-05-22 (Phase 1A doc rewrite). Next review: end of
Phase 1 retrospective.*
