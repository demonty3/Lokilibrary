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

**5C.2b ✅ lore drop-zone UI** (shipped 2026-05-29):
- `LoreDropZone.tsx` — DOM `.txt`/`.md` drop-zone (Ctrl+U toggle, Esc
  close), 1 MB cap, `file.text()` → `ingestLore`.
- `ingestLore` (`lore-ingest.ts`): chunk → embed (doc-prefixed) →
  `recordLore`; best-effort embed (FTS-only fallback on 501/fail).
- `will-navigate` drop-safety guard in `desktop/src/main.ts`.
- **Verified in WSL** by 19-assertion ingest smoke; full live story
  (drop a file → reflection references it) pending Windows + Ollama.

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

**5D.4 — option 1 (visible lore) shipped** (2026-05-29): lore now visibly
transforms the world LOCALLY — the whole theme palette recolors from
`buildLoreProfile().suggestedTilePaletteBias[0]` (deterministic, no opt-in;
a `loreVersion` counter remounts the world on ingest), and lore-weighted
scatter (5D.2) stands. Agent-voice egress is now actually wired: cohort live
reflection, the cell bookshelf-launch path, and the overnight sleep-reflection
sweep all pass `loreEnabled` (closing the 5D.3 gap where the gate existed but
no call site set it). TWO opt-in toggles added to the lore drop-zone (both
default off): **Theme & mood** egresses closed-vocab `{themes, tone}` only;
**Quote directly** egresses raw lore excerpts so agents can name specifics —
each gating its own independent egress path. **Deferred:** the
manifest-digest → `/api/world` half (lore_context section + cache `v3` bump) is
NOT done — the 2D renderer does not consume the Stage 1 manifest (`loadManifest`
is never called), so there is no consumer to feed; revisit if the renderer wires
the manifest.

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

## Phase 7 / v2.x — Composable panes (terminal-merging track)

> **Roadmap. Both dependency gates (Phase A scale ladder + Phase B multi-pane
> UI) are now SHIPPED (visual-only); the Depth-1 drag / Depth-2 seam-semantics
> phases below remain design-only — build NOTHING from Phase C onward yet.**
> Named "Phase 7" to avoid colliding with the existing "Phase 6 — Steam
> release" above; `docs/INDEX.md` + `CONSOLIDATION.md` file composable panes as
> **v2.x territory**. The track was gated behind TWO hard dependencies (IDEAS.md
> "Composable panes" sequencing, lines 345–347): **a real multi-pane terminal
> UI AND the scale ladder beyond `cell`/`district`** — both cleared as of
> 2026-05-30 (Phase A = `clusters.ts` + real island/continent renderers; Phase
> B = the `panes[]` store model + `Map<paneId>` router + clipped per-pane
> Containers + box-glyph seams, single-pane DEFAULT preserved). Sequence the
> prerequisites (Phase A → B → C) — it is not optional. Seam SEMANTICS / agent
> crossing / memory flow stay Depth-2 (Phase D), explicitly NOT built in 7-B.
>
> The one cheap seed IDEAS.md names (line 350) — **pane-aware agent
> perception** — was deliberately **not** taken in Phase 2 (perception.ts
> shipped FOV-only) and is **not** blocking anything until the multi-pane
> UI exists. Pick it up as **step one of the Depth-1/Depth-2 slice**, not a
> retrofit now.

### Phase A — Scale ladder beyond cell/district

**Status (2026-05-30): SHIPPED for island + continent + district; planet +
solar_system stay richer stubs.** Deterministic clustering layer
`src/procedural/clusters.ts` (`clusterLibrary` → `district → island →
continent` tree, salts `CLUSTER_SALT = 0xc1a5` + `LAYOUT_SALT = 0xc0a5`,
appid-canonicalised, no `Math.random`/wall-clock). Real renderers
`src/render/levels/{island,continent}.ts` + upgraded `district.ts` (static
3×3 → real neighbour summaries with activity glyphs), wired into
`PixiApp.ts` `mountLevel()` (threading `snapshotLibraryState().clusterGames`,
engagement-bearing when authenticated). `planet`/`solar_system` keep
`mountStubLevel` but now carry a one-line library aggregate
("{games} games · {continents} continents") — the speculative rotating-world
/ multi-source rungs are deferred (solar_system implies Year-3 multi-source
ingestion). `[`/`]` zoom transition + throttle ladder untouched. Smoke:
`smoke-7a-scale-ladder.mts` (69) locks clustering determinism + invariants +
pure layout/blob helpers. Remaining: visual verification of the new rungs on
a real Windows wallpaper setup (the PIXI render output is not unit-testable).

**Goal.** Replace the four stub levels (island, continent, planet,
solar_system) with real, deterministic, navigable renderers so there is an
actual ladder of scales to view simultaneously later. Until real higher
levels exist, a multi-pane UI has nothing distinct to put in each pane —
IDEAS.md names this the first dependency gate.

**Prerequisites.**
- Code reality today: `src/types.ts` `SCALE_ORDER` lists all 6 levels but
  `PixiApp.ts` mounts `mountStubLevel` for island/continent/planet/
  solar_system (literal "not yet built. keep playing." panel in `stub.ts`).
  Even `district.ts` is a static 3×3 ASCII minimap with 8 stubbed
  neighbours ("neighbouring cells not yet built") — it does NOT render real
  adjacent cells.
- An aggregation source: higher levels need data to summarize.
  `profile.topGames` + state tags exist but there is no
  district-grouping / clustering layer. A deterministic grouping function
  (seeded by `profileSeed`, in `src/procedural`) is a prerequisite.
- Determinism harness already in place: `mulberry32` + `profileSeed` + the
  no-`Math.random` rule. Higher levels MUST reuse these.

**Key work.**
- Define each higher level's rendering vocabulary (DESIGN.md/SPEC.md §4:
  island = neighbourhoods/clustered shapes, continent = land-masses,
  planet = orbital rotating world, solar_system = one planet per data
  source). Box-glyph only (pixel-art pipeline is a later phase per
  CLAUDE.md).
- Deterministic clustering layer in `src/procedural` grouping the library
  into districts→islands→continents from the profile seed (mirror
  cell.ts/scatter.ts namespace-isolation, e.g. `mulberry32(seed ^
  DISTRICT_SALT)`). Same profile → same map is a hard requirement.
- Replace `mountStubLevel` calls per level in `PixiApp.ts` `mountLevel()`
  with real mount functions in `src/render/levels/` (island.ts,
  continent.ts, planet.ts, solar_system.ts), each returning a teardown
  closure like mountCell/mountDistrict.
- Upgrade `district.ts` from the static 3×3 placeholder to render real
  neighbour summaries (agent-activity heatmap, per-cell state glyphs).
- Keep the existing single-pane `[` / `]` zoom transition (App.tsx) working
  throughout — this phase does NOT add panes, it fills the ladder rungs the
  current swap-one-level renderer already cycles through.

**Risks.** Aesthetic-coherence (four new vocabularies must each read as
terminal under one palette); determinism drift (clustering multiplies the
seeded-PRNG surface — any `Math.random`/wall-clock leak breaks the WFC /
share-URL contract; lock same-seed→same-map per level in the smoke suite);
scope (planet "rotating world" + solar_system "data sources" are the most
speculative rungs — solar_system implies multi-source ingestion which is
Year-3; ship island + continent for real first, keep planet/solar_system as
richer-stub until multi-source lands); no persistent map state today
(clustering must be pure-from-seed).

**Demo payoff.** Zooming out with `]` no longer hits "not yet built" — the
user sees their whole library as a coherent map at every rung. The
precondition that gives the later multi-pane UI distinct content per pane.

### Phase B — Multi-pane terminal UI (N simultaneous level Containers)

**Status (2026-05-30): SHIPPED (visual-only, store + router + pane-scoped
renderers + seams), single-pane DEFAULT behaviour-preserving.** Filed as
**Phase 7-B**. The store's single `scale: ScaleLevel` scalar is replaced by
`panes: PaneDescriptor[]` + `focusedPaneId` + `gridCols`/`gridRows`/`paneSeq`
(`src/types.ts` holds the pure `PaneRect`/`PaneDescriptor` types). `scale` +
`setScale` are RETAINED as a kept-in-sync MIRROR of the focused pane's level
(written field, via the `syncScaleToFocused` invariant) — so App.tsx's `[`/`]`
zoom + `PixiApp.subscribe`'s `state.scale !== prev.scale` diff are UNCHANGED.
DEFAULT = ONE `'root'` pane covering the whole 1×1 grid at `'cell'` —
byte-equivalent to the old scalar. Pure reducers `splitPane`/`closePane`/
`focusPane`/`cycleFocus`/`setPaneLevel`/`setArrangement('single'|'study')`
(deterministic `paneSeq` ids, NO Math.random/Date.now). `PixiApp.ts` replaces
the single `teardownLevel` with `Map<paneId, LivePane>`: per-pane `paneRoot`
Container positioned + Graphics-masked to its `computePixelRect` (mask SKIPPED
for the full-grid single pane → byte-identical render path); a `reconcilePanes`
store-subscribe diff (mount/unmount/relevel/refit); ONE app-level resize
listener; box-drawing seam glyphs (`│ ─ ┼ ├ ┤ ┬ ┴`, `fgDim`) where panes abut.
The single Application + ticker STAY (never `app.destroy` on a pane change).
`refitAll`'s `reconcileMask` reconciles each pane's clip mask against its
CURRENT full-grid status (create/redraw/destroy) — closing the single→study
gap where the kept `root` pane flips full-grid→partial via the cheap rect-only
reconcile branch and would otherwise keep its maskless single-pane mask.
Read-only level renderers (`district`/`island`/`continent`/`stub`) adapted to
`(parent, rect) → {teardown, refit}`; `cell.ts` keeps ONE player + ONE keydown
listener gated on `focusedPaneId === paneId`. App.tsx adds `Tab` (cycleFocus) +
`\` (single↔study) behind the existing wallpaper guard (no-op in wallpaper
mode). Smoke: `smoke-7b-panes.mts` (68) locks the one-pane back-compat
reduction + every reducer + rect tiling math + the single→study clip-mask
regression trigger (A12); the visual multi-pane output (masks, seams,
focus-switch) needs the Windows checklist (`TODO-USER.md` "Phase 7-B
multi-pane", check B1's clip-mask regression step). DEFERRED: seam SEMANTICS / agent seam-crossing /
memory flow (Depth-2); multiple simultaneous input-owning cell panes (the
`playerPosition` + `agentRuntime` singletons are the blocker); per-pane
throttling beyond the shared ticker; arrangement persistence across restarts;
`tour`/`voyage` presets; drag-to-reposition (Phase C).

**Goal.** Move the renderer from one-active-level-at-a-time to N
simultaneous panes, each showing a (level, viewport) independently — the
"multi-pane terminal UI" SPEC §4 names and IDEAS.md's second dependency
gate. Panes are visual only here — no seams, no joining, no cross-pane
perception.

**Prerequisites.** Phase A (real higher levels — a pane is only interesting
if different panes show different real scales). Architectural facts to
refactor: today `PixiApp.mountPalace` creates ONE Application and
`mountLevel()` adds exactly ONE level Container to `app.stage`, torn down +
remounted on the single `store.scale` change; `store.ts` holds a single
scalar `scale: ScaleLevel`. Multi-pane means N independent (level, viewport,
teardown) records — the store slice and the renderer router both change
shape. Input ownership: `cell.ts` owns window-level keydown + the bookshelf
prompt against a single `playerPos.ts` singleton; with N panes, "which pane
has focus / owns input / owns the player" becomes a real design question.
Throttle: `applyThrottle` drives one `app.ticker`; N panes still share one
Application/ticker (CLAUDE.md: don't destroy the Application) — per-pane
visibility/pause must compose with the `'full'`/`'throttled-1hz'`/`'paused'`/`'sleeping'`
ladder.

**Key work.**
- Generalize `store.scale` (single scalar) into a panes model: ordered list
  of pane descriptors `{id, level, viewport, rect}` + a `focusedPaneId`.
  Keep a back-compat path so single-pane (= current behaviour) is the
  default and the wallpaper use case is unchanged.
- Refactor the `PixiApp.ts` level router into a `Map<paneId,
  {container, teardown}>`; mount/unmount per pane; each pane gets its own
  clipped sub-Container (PIXI mask/rect). The single Application + ticker
  stays.
- Resolve input ownership: route keydown/movement/E to the focused pane
  only; make `playerPos` pane-scoped (the player lives in one pane at a
  time in Depth-1 — the seam Phase D later makes crossable). bookshelfPrompt
  + the E-key status overlays read the focused pane's coordinate space.
- Render seam glyphs as pure decoration where panes abut (U+2502 / U+2500
  borders) — NO semantics yet. The visual half, so Phase C (drag) + Phase D
  (join) build on a stable layout primitive.
- Ship a small library of curated default arrangements (IDEAS.md "Default
  arrangements": a *study* = cell+district stacked, a *tour* = three
  districts horizontal, a *voyage* = planet+cell) as named presets —
  composition stays optional so ambience/wallpaper is preserved.
- Wallpaper-mode interaction (IDEAS.md line 333): wallpaper mode shows the
  last-saved arrangement read-only; composition is window-mode only
  (Ctrl+Alt+L peek, Phase 4, brings the window UI up).

**Risks.** Largest blast radius in the track — the single-scalar `scale`
slice + single-Container assumption are load-bearing across `PixiApp.ts`,
`App.tsx` (the `[`/`]` handler), `cell.ts` (input + playerPos), and every
overlay; must ship behind a feature flag with single-pane as default.
Performance (N live panes multiply per-frame cost — per-pane throttling,
only the focused/visible pane runs `'full'`, must extend the Phase 4/5B ladder
or the thermal budget blows). Ambience-vs-composability (IDEAS.md "load-
bearing tension", line 328: if composing is mandatory the wallpaper value-
prop dies — curated defaults + composition-is-optional is a HARD constraint,
not an afterthought). Input/focus model is novel UX (tmux-like focus in a
wallpaper) with a discoverability problem (IDEAS.md line 329).

**Demo payoff.** Two terminals side by side — cell of the library room next
to the district map — both live, dropped in from a one-key preset. The
tmux-for-your-Steam-library shot.

### Phase C — Composable panes Depth 1 (drag panes, visual-only seams)

**Goal.** Make the multi-pane layout user-configurable: drag panes to
reposition, snap them adjacent, form/dissolve VISUAL seams — seams carry no
perceptual semantics yet. Exactly IDEAS.md "Composable panes Depth 1"
(line 314: *"Panes sit adjacent but don't yet merge — seams are visual only,
no perceptual flow. This is the multi-pane terminal UI already specced, made
user-configurable."*).

**Prerequisites.** Phase B (the N-pane renderer + pane descriptors + clipped
sub-Containers). A snapping/adjacency model: pane rects need a grid or
snap-target system so "these two panes are touching" is well-defined (the
adjacency fact Phase D later upgrades into a perceptual edge). Saved-layout
persistence (implied): reuse the Phase 5 persistent-state machinery (KV /
SQLite namespace) rather than inventing new storage.

**Key work.**
- Pointer drag to move a pane's rect; snap to neighbour edges; recompute
  seam-glyph borders (U+253C `┼` at cross-junctions, U+2524 `┤` at edges per
  IDEAS.md) when panes touch and fade them out when panes separate
  (sub-character fade, not snap-to-grid, per CLAUDE.md).
- Persist arrangement to per-user storage so it survives restart; expose a
  one-tap "reset to default arrangement" affordance (Townscaper lesson,
  IDEAS.md line 329: impossible to break).
- Stacking-direction semantics as METADATA only (no behaviour yet): record
  vertical-stack = scale, horizontal = parallel, corner = cross-source
  (IDEAS.md lines 308–310) on the seam so Phase D can read them. Reserve
  corner-touch for cross-source even though multi-source is Year-3.
- Pin/lock controls: pin a pane so drag/snap won't move it (groundwork for
  the IDEAS.md "leave this scope alone" panel that Sleep-mode Depth 3 needs).
- Keep seams strictly cosmetic: `perception.ts` is untouched in this phase —
  agents still see only within their own pane's FOV. The explicit Depth-1
  boundary.

**Risks.** Discoverability (nothing signals panes are draggable — needs a
first-run reveal; Loki's overnight demonstration is Phase D+/Year-2, so
Depth 1 needs an interim hint). Snapping UX is fiddly — budget iteration on
snap feel specifically. Layout persistence is USER state, not seed-derived,
so it lives OUTSIDE `src/procedural` (arrangement is a personalisation
lever, distinct from the seeded world). Wallpaper-mode read-only contract
from Phase B must hold (dragging in wallpaper mode disabled).

**Demo payoff.** The marketing artifact IDEAS.md predicts (line 337): *"my
library, the way I like to arrange it tonight"* — a one-image,
terminal-styled composition unique to the user, crisp box-drawing seams
where panes meet. Re-arrangeable, screenshot-shareable.

### Phase D — Composable panes Depth 2 (seam-crossing + memory flow + pane-aware perception)

**Goal.** Make seams MEAN something: when two panes touch, agents can
perceive across the seam, walk across it, and memory flows between the
joined places. The arrangement becomes the agent society's perceptual graph
(IDEAS.md "Composable panes Depth 2 — active merging", line 316). The
topology stops being cosmetic and becomes substrate.

**Prerequisites.** Phase C (visual seams + adjacency metadata — you can only
make a seam crossable once seams exist and record which panes they join).
**THE cheap seed, deliberately deferred (IDEAS.md line 350): pane-aware
agent perception.** Today `perception.ts:computePerception` takes a single
`WorldSnapshot` (player + agents + bookshelves in one cell coordinate
space), uses a Chebyshev FOV radius, and `void`s the layout param — there is
ZERO concept of a pane, a seam, or cross-boundary visibility. This refactor
is the heart of Phase D. Phase 5 machinery to reuse (IDEAS.md line 347): the
persistent memory stream (SQLite + sqlite-vec), Tier-2 reflection, and lore
retrieval — memory-flow-across-seam is built on these, not new infra. A
coordinate-bridging model: each pane has its own cell coordinate space + its
own `playerPos`; crossing a seam means mapping a position from pane A's
space into pane B's at the shared edge — a new spatial primitive.

**Key work.**
- Refactor `perception.ts` from single-WorldSnapshot/FOV to graph-aware: a
  perceiving agent's FOV may extend across an OPEN seam into the adjacent
  pane's snapshot. Introduce a perceptual-graph type (panes as nodes, open
  seams as edges); `computePerception` walks one hop across an open seam,
  projecting the neighbour pane's subjects into the perceiver's FOV at the
  seam offset.
- Seam-crossing movement: when the player/agent reaches a seam cell, transfer
  to the adjacent pane (translate position into the neighbour's coordinate
  space, hand input ownership to the now-focused pane). Sub-character
  animation across the boundary, not a hard snap (CLAUDE.md).
- Memory flow: when a seam is open, allow memory-stream writes/retrievals to
  reference subjects in the joined pane (reuse the cellId namespacing in
  `memory/schema.ts` so a joined pair shares retrieval scope while open, and
  re-localizes when the seam dissolves — mirrors `resetPerceptionState()` on
  teardown).
- Honour Phase C stacking semantics: vertical-stack (same place, two scales)
  means the agent is visible from multiple altitudes simultaneously (SPEC §4
  "the user sees all scales; the agent only sees its detail level") — a
  vertical seam shares observation but not necessarily walkability;
  horizontal seam = walkable parallel adjacency. Encode as edge types.
- Visitor-mode + privacy pass (IDEAS.md hard problem): decide what a
  share-viewer sees of a joined topology; ensure no cross-source corner-touch
  egresses anything without opt-in (consistent with the
  `loreEnabled`/`loreQuoteEnabled` second-opt-in pattern in `store.ts` +
  CLAUDE.md "all AI via the Worker / local-only").

**Risks.** Agent-cost: cross-seam FOV multiplies subjects per Tier-1
dispatch — can blow the ≤$1/user/month Sonnet budget; cross-seam perception
must respect the existing `isSalient` dedupe filter and probably needs a
tighter cross-seam salience window. Highest correctness risk in the track —
coordinate-bridging + input-ownership transfer + memory-namespace merging
are three interacting stateful systems; the Phase-2 "reset caches on
remount" discipline (`resetPerceptionState`) must extend to "reset/
re-localize on seam open/close" or agents leak state across dissolved seams.
Trust/diegetic risk: an agent wandering out of a pane the user thought
isolated feels like a bug — crossing must be legible (visible seam, visible
traversal), never teleportation. Forward dependency: Composable-panes Depth 3
(Loki resculpts topology overnight via Sleep-mode) sits ON TOP of this; the
pin-this-scope panel (seeded in Phase C) becomes load-bearing here. Filed
v2.x — the riskiest, latest rung; do not attempt until Depth 1 has shipped
and earned audience trust.

**Demo payoff.** Drag the district pane against the cell pane, the seam glyph
forms, and an agent walks out of the room and onto the map — memory of the
room travelling with it. The arrangement is now the network the agent
society emerges from: the user is sculpting the substrate, not configuring a
bot.

### Cheap seeds to reserve now (cost ~nothing, avoid later retrofits)
- **Pane-aware agent perception** — THE one IDEAS.md names (line 350). No
  urgency until the multi-pane UI exists; refactoring `perception.ts` into a
  pane/seam graph is the foundational move Phase D rests on.
- **Reserve corner-touch = cross-source semantics now, build never**
  (IDEAS.md line 310). Recording the seam's edge-type as metadata in Phase C
  costs nothing and avoids a retrofit when solar_system/multi-source lands.
- **Pin/lock-a-scope affordance, seeded in Phase C** — prerequisite for the
  trust ladder that Depth 3 (Loki resculpting overnight) cannot ship without.
- **Curated default arrangements as named presets** — resolves the
  ambience-vs-composability tension and gives discoverability a foothold.
- **Keep arrangement state OUTSIDE `src/procedural` from day one** —
  arrangement is a personalisation lever (the 5th, alongside library /
  profile / theme / lore), NOT seed-derived geometry. The
  `store.ts` `loreEnabled`/`loreQuoteEnabled`/`loreVersion` pattern is the
  template for user-controlled, opt-in, persisted state that doesn't touch
  the deterministic WFC / share-URL contract.

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
