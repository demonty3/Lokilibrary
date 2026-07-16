---
up: "[[Lokilibrary]]"
---

# Live state snapshot

The current shape of the data structures and modules that change
between slices. Updated at the end of each slice — `git log STATE.md`
shows when each shape last moved. **Read this once at session start;
re-grep only when this is stale.**

For "what's authoritative" → `docs/INDEX.md`. For day-to-day rules →
`CLAUDE.md`. For the phase plan → `PLAN.md`. For the current
to-fix-on-Windows list → `TODO-USER.md`. This file is *the present
tense* of those.

**Living society SHIPPED 2026-07-16** (plan
`docs/superpowers/plans/2026-07-16-tier1-living-society.md`; commits
`9a9e320..b3b02e4`; Tier 1 of the living-joined-world run; PRD-T2 core,
key-free). Land beings are a SOCIETY, not walkers: pure intent engine
`src/terminal/beingIntents.ts` (utility-AI ladder — wander/rest/approach-a-
structure/watch_edge; rest deliberately dominated at an OPEN edge;
`resumeIntent` continues a handed-off intent; `structureColumns` from label
runs — smoke-t1-being-intents, 21). Handoffs CARRY runtime state
(`TerminalBeingState {speed,dir,intent,bobPhase}` — broker forwards opaquely
+ `from:{terminalId,wing}`; beings RESUME, not respawn; `CROSS_COOLDOWN_S=4`
anti-ping-pong; smoke-t1-broker-handoff, 18, drives the REAL broker via
mockElectronModule). Crossings + arrivals write the Smallville stream
(`src/terminal/terminalMemory.ts` → `recordPerception` kinds
`terminal_crossing`/`terminal_arrival`, mapped to the FROZEN
`'self_perception'` source — no schema bump; prose via writer.ts
describeEvent; `busy_timeout=3000` for multi-renderer WAL sharing;
smoke-t1-society-memory, 15 — VERIFIED in the real desktop sqlite: "crossed
from the d0 terminal into d1" rows both directions). Cross-edge perception:
`src/terminal/crossEdge.ts` (`nearEdgeSummary` cap 4/side radius 10 +
`projectAcrossEdge` just-outside-the-land; ≤1 Hz change-gated
`terminal:nearEdge` report → broker relays side-flipped
`terminal:neighbourSummary`; non-empty summary = DECISIVE watch_edge pull;
smoke-t1-cross-edge, 15). VERIFIED LIVE (macOS): the roster fully swapped
homes organically (all 3 t1-natives in t2 + vice versa), perception symmetric
(t1 sees 2 across its right seam, t2 sees 3 across its left), and BOTH
windows had a being in watch_edge pulled to the populated join — the PRD-T2
acceptance verbatim; gallery `/tmp/loki-join/gallery/tier1-society.png`.
`__terminal.state()` now exposes intent per being + `neighbours` per side.
Full smoke sweep green. DEFERRED (per plan): real 5-agent cohort defs /
migrateRuntime-over-IPC, Tier-1 LLM dispatch on arrival (no-LLM rail), new
ObservationSource token, relaunch persistence.

**Join moment SHIPPED 2026-07-16** (spec+plan
`docs/superpowers/*/2026-07-16-join-moment*`; commits `3c8f639..9ba90b4`;
Tier 0 of the living-joined-world run). Two snapped terminals now read as ONE
continuous land: `landSeamBoundary(seedA,seedB)` (land.ts; symmetric
canonical-order FNV fold, salt `0x5a11`) gives both windows the identical seam
height+slope with no negotiation; `composeLand` gains
`join?: {left?,right?}` (neighbour wing seed) and Hermite-ramps the edge's
last 6 cols to it (structure-free buffer; no-join byte-identical —
`smoke-land-seam.mts`, 6). Topology IPC carries `wings` (terminalId→wing);
`terminalLand` recomposes the joined edge as a swappable scene child on join
change. Terminal windows are FRAMELESS (`frame:false` alone — `titleBarStyle:
'hidden'` re-adds macOS traffic lights; `hasShadow:false` +
`roundedCorners:false` kill the false seam line) with an in-world `┤ wing ├`
drag strip. A one-shot knit sweep (0.6s, ticker-driven) fires per newly-opened
edge (`__terminal.state().knits` = e2e ground truth). VERIFIED ON SCREEN
(macOS, occlusion-proof `scripts/e2e/join-shot.py` composite — new tooling,
`screencapture -l` per window + PIL): ground line continuous across the seam,
carets on the same row, a being at the threshold; hero shot
`/tmp/loki-join/gallery/tier0-hero.png`. PENDING HARRY: real-mouse drag of the
glyph strip (drag-region can't be driven via CDP); knit sweep eyeball (0.6s —
ground truth proven, capture kept missing the window). Next tiers: living
society (T2 runtime) → depth/atmosphere → chains/persistence → demo GIF.

**Salience campaign SHIPPED 2026-07-13** (spec+plan
`docs/superpowers/*/2026-07-13-salience-campaign*`; commits
`b293c96..8d9f88e`; source: the 8-lens visual programme in
`docs/design-reviews/2026-07-13-visual-programme.md`). The glance
hierarchy is fixed: semantic role layer (`src/themes/roles.ts` —
roles→palette keys, reserved being accents smoke-enforced), beings
re-tinted (cat orange, archivist violet), blue aperture dialect
(door/window/seam-caps; the old orange door cross is dead), `@`
phase-modulo cursor blink (76/24 duty at any tick rate incl. 1Hz
throttle), themed HUD + LoreDropZone, wall-layer focus alpha in
splits, double-line marginalia frames with L· tick, ladder label
double-draw bug fixed (was the YOU marker; home card now restamped
brighter). Follow-ups on record: MARK_STYLES re-key (design decision —
ghost marks), ladder pane-awareness (ladder-identity arc). Programme
arcs remaining: ambient life register, book-spine shelves, ladder
identity, shade-ramp deployment, land polish.

**Events calendar SHIPPED 2026-07-13** (spec+plan `docs/superpowers/*/2026-07-12-events-calendar*`;
commits `844fb94..bc79d95`). The world has a clock: pure seeded `eventForDay`
(0.4/day, notes/moves) in `src/procedural/calendar.ts`, `world_events` ledger
(day PK), staging via cell-registered closures (whole-library panes only,
profile seed, union broadcast), shelf overlay (adjacent-index moves, 10-day
expiry, max 3), rationale marks through the trace system, morning-dispatch
banner (staged-callback delivery). Zero new AI calls. Null-writer/web: no
events (library-empty walks skipped — protects the global ledger from anon
boots). One of CONSOLIDATION.md's two missing v1.0 features; the enrichment
budget remains.

**Direction change 2026-07-11 — free, public open source.** No Steam
distribution, no monetization; users bring their own API keys. The Steam
release gate is RETIRED and ship-vs-expand resolves to: consolidate to
demo-ready (clone-and-run README + the snapping-terminals demo), then
expand into the snapping-terminals arc. Authoritative wording: CLAUDE.md
"Product direction" + SPEC.md § 2.5. (Doc-only change; no code moved.)

Last updated: **2026-06-04** (SEAM-SEEKING / the observable walk, Increment 2 —
agents now DELIBERATELY walk to a seam and cross, instead of waiting on a random
wander onto an exit cell. `behavior.ts:maybeSeekSeam` latches the nearest open
walkable `SeamExit` as `runtime.seamGoal` (multi-pane only — empty `ctx.seamExits`
clears it, so single-pane is byte-identical), the BT scores an `approach` toward
it at 0.6 (above wander/idle, BELOW plan-step/intent/schedule peaks so a character
schedule still wins — loki, near its anchor, keeps to its room by design), and on
arrival writes `pendingCross` + arms a per-agent FNV-staggered cooldown
(`seamCooldownMs`, 6–12s) so agents DRIFT across one-at-a-time rather than
stampede/oscillate. `seamGoal`+`seamCooldownUntil` added to `AgentRuntimeState`
(cleared on `migrateRuntime`; cooldown travels with the agent). VERIFIED ON SCREEN
(macOS, e2e harness): a `|`-split of two whole-library cell panes shows the roster
fluidly cross both directions (cat/archivist/visitor each crossed multiple times;
the new `window.__loki.agentRoster()` reads each pane's live scope). smoke-7d2-walk
now 71 (S1–S5: latch/approach/cross, nearest-selection, cooldown gate, single-pane
reduction, stale-goal re-latch). ALIGNED SEAMS (2026-06-04) — the walkable seam
opening is now carved from a SHARED seed (the PROFILE seed, threaded as
`layoutCell(seed, seamSeed)` via a dedicated `SEAM_SALT=0x5ea3` prng, room stays
byte-identical) so EVERY wing of a profile opens at the SAME row even though the
rooms differ — VERIFIED ON SCREEN: a `|`-split with p2 set to a DIFFERENT wing
(d0) shows loki cross repeatedly between the whole-library room and the
different-looking d0 room (smoke-regions=24, +A-section alignment/floor/distinct).
BFS SEAM PATHING (2026-06-04) — seam-seeking now routes with a dedicated
`seek_seam` Tier0Action + `bfsNextStep` (4-connected floor BFS, deterministic,
greedy fallback if the opening is a disconnected pocket) so agents route AROUND
shelves to the opening instead of stalling against a wall as the GREEDY
`stepTowardTarget` did (kept unchanged for plan/schedule movement). VERIFIED ON
SCREEN: with p2=d0, loki/visitor/archivist all cross both ways (at one tick all
4 were in p2); cat rests near its ☼ anchor (schedule 1.1 > seam-seek 0.6 — by
design, not a stall). smoke-7d2-walk=74 (+S6/S6b: BFS routes around a barrier
where a greedy control provably stalls). REMAINING: a carved opening is not
GUARANTEED connected to all interior floor (rare disconnected pocket → that agent
stays put); changing a live pane's region REMOUNTS it and DROPS agents that had
walked in (known split-teardown behavior). NEXT ARC: orchestration / Composable-
Panes Depth 3 — the society decides WHICH terminals exist. —— REGION TERMINALS (2026-06-03) — a
cell pane can render ONE
wing of the library (a 7-A district) with its own seed / shelves / cohort /
seed-keyed memory instead of the whole-library cell; `regionId?` on
`PaneDescriptor`, resolved in `mountPaneLevel` via the new pure
`src/procedural/regions.ts`, cycled by `cycleFocusedPaneRegion` + the `r` key.
Default panes byte-identical. Foundation for Composable-Panes Depth 3. See
"Region terminals" below + `smoke-regions.mts`. Prior 7-D.2 LIVE SEAM WALK — single roaming roster: the 5-agent COHORT exists ONCE across the world (spawned into ROOT only; split panes start EMPTY), each agent in exactly ONE pane's `RuntimeScope`, roaming by crossing seams. `mountCohort` is now a renderer+ticker that per-tick RECONCILES sprites to scope (create-on-arrive / destroy-on-depart; allocation-free in the single-pane no-churn case). Real `CrossSeamDeps` + `seamExits` built from `buildSeams(live panes)`+`paneRegistry` and threaded `PixiApp→cell→cohort` (single pane short-circuits to [] before `buildSeams` → enricher returns base by reference). `behavior.ts` emits `runtime.pendingCross` at an open walkable seam-exit edge (fixed-position PRNG candidate; clamp when no seam); the cohort tick consumes it via `migrateRuntime` (exactly-once, no dup/leak/vanish, deterministic `justArrivedAt` anti-ping-pong, teardown-safe via live-neighbour check). The `migrateRuntime` duplicate guard is now a BACKSTOP. The root-gate is ROSTER-AWARE (skips re-spawning any agent already live in a sibling pane — no dup on a partial root relevel), and `seamExitsForPane` is FLOOR-GATED (offers a cross only when both exit + bridged-entry cells are floor — never strands an agent in a wall). RUNTIME walk + sprite-handoff logic LANDED + smoke-locked (smoke-7d2-walk=58, incl. C1/C2 roster-aware-remount + F1/F2 floor-gate). NOTE: today's cell layout has a solid-wall E/W perimeter, so a `|`-split shows roster-once but NO live left↔right crossing yet (the wall, not broken wiring — a walkable seam edge is a DEFERRED follow-up); the crossing MECHANISM is proven headlessly. On-screen sprite VISUAL is Windows-pending. Cross-level crossing + close-seam control + arrangement persistence DEFERRED. All 27 prior smokes green; typecheck clean both legs. Earlier 7-D.1 + 7-B notes below.).

---

## Renderer state

### `useAppStore` (`src/state/store.ts`)
Zustand slices:
- `menuOpen: boolean` / `openMenu` / `closeMenu`
- `prompt: string | null` / `setPrompt`
- **Auth**: `authStatus: 'idle' | 'loading' | 'authenticated' | 'anonymous'`, `steamId`, `persona`, `loadAuth()`, `signOut()`
- **Library**: `library`, `libraryStatus`, `libraryError`, `totalGames`, `topN`, `profile`, `loadLibrary()`
- **Manifest**: `manifest`, `manifestStatus`, `manifestSource`, `manifestError`, `loadManifest()`
- **Wallpaper mode**: `wallpaperMode: boolean`, `setWallpaperMode`
- **Throttle (4A + 5B)**: `throttleState: 'full' | 'throttled-1hz' | 'paused' | 'sleeping'`, `setThrottleState`
- **Composable panes (7-B)**: `panes: PaneDescriptor[]`, `focusedPaneId: string`, `gridCols`, `gridRows`, `paneSeq` + pure reducers `splitPane(axis)`, `closePane(id)`, `focusPane(id)`, `cycleFocus()`, `setPaneLevel(id, level)`, `setArrangement('single' | 'study')`.
  - **Scale-mirror back-compat**: `scale: ScaleLevel` + `setScale` are RETAINED as a kept-in-sync MIRROR of the FOCUSED pane's level (a real WRITTEN field, not a selector — so `PixiApp.subscribe`'s `state.scale !== prev.scale` diff still fires; App.tsx's `[`/`]` zoom is unchanged and zooms the focused pane via `setScale`). The `syncScaleToFocused(panes, focusedPaneId)` helper writes `scale` in the SAME `set()` as every focus/level mutation, so the invariant `scale === focused pane level` can never drift. DEFAULT = ONE `'root'` pane, level `'cell'`, rect `{col:0,row:0,cols:1,rows:1}` on a 1×1 grid — byte-equivalent to the pre-7-B scalar. Pane ids come from `paneSeq` only (`root`, `p2`, …) — deterministic, NO Math.random/Date.now. `PaneRect`/`PaneDescriptor` live in `src/types.ts` (pure types; importable by both store + renderer with no cycle). Smoke: `scripts/smoke-7b-panes.mts` (68 assertions; A1–A11 lock the one-pane reduction + every reducer + rect math; A12 locks the single→study clip-mask regression trigger).
- **Telemetry overlay (2F)**: `agentDebugOverlay: boolean`, `toggleAgentDebug`
- **Lore upload (5C.2b)**: `loreUploadOpen: boolean`, `toggleLoreUpload`, `setLoreUploadOpen` (Ctrl+U / Esc; read by `LoreDropZone`)

### `playerPosition` (`src/state/playerPos.ts`) — PANE-SCOPED (Phase 7 / v2.x)
Frame-rate module-local, deliberately OUTSIDE Zustand (60Hz mutation must not
re-render React). Cell-grid coords, not pixels. Now a `Map<paneId, {x,y}>`
behind:
- `getPlayerPos(paneId)` → the STABLE mutable `{x,y}` for that pane (lazily
  created + cached, default `{0,0}`; the cell renderer captures it ONCE at
  mount and mutates `.x/.y` in place — zero realloc, zero re-render).
- `setPlayerPos(paneId, x, y)` — mutate that cached object in place.
- `clearPlayerPos(paneId)` — drop the entry on pane teardown (clearing one
  pane never affects another).
- **Single-pane reduction**: `playerPosition` + `setPlayerPosition(x,y)` are
  retained as thin aliases bound to the `'root'` pane — `playerPosition` IS the
  same cached object `getPlayerPos('root')` returns (identity, no lag). With
  the default single 'root' cell pane every read/write is byte-identical to the
  pre-pane-scoping singleton.

### `AgentRuntimeState` (`src/state/agentRuntime.ts`) — PANE-SCOPED (Phase 7 / v2.x)
Per-agent volatile state. Each cell pane owns its own `RuntimeScope`
(`{ runtimes: Map<id,state>; perception: PerceptionScope }`, from
`createRuntimeScope()`), so two cell panes run independent cohorts with no key
collision. Cleared on cell unmount.
- `id`, `x`, `y`, `present`, `intent`, `currentAction`, `actionEndsAt`
- **Phase 2C perception**: `perceptionQueue: PerceptionEvent[]`
- **Phase 2D reflection trigger**: `reflectionCounter: number`
- **Phase 2C throttle**: `lastTier1At: number`
- **Phase 5A reflection rate-limit**: `lastReflectionAt: number`
- **Phase 5A plan execution**: `activePlan: PlanPayload | null`, `activePlanStepIndex: number`

`Tier0Action` discriminated union: `wander | idle | approach | scheduled`.

**Scope API** — `setRuntimeIn / getRuntimeIn / deleteRuntimeIn / listRuntimesIn
/ clearRuntimesIn(scope, …)` operate on one pane. The module-globals
(`setRuntime/getRuntime/deleteRuntime/listRuntimes/clearRuntimes`) are retained
as thin delegates over a module-local eager `DEFAULT_SCOPE`, so single-pane and
all existing smokes (2b/2c/2e/4a/5a) are byte-identical. `initialRuntime` is a
PURE constructor (touches no scope) — unchanged.

**`migrateRuntime(from, to, id, newX, newY): MigrateResult` (Phase 7-D)** —
the same-level seam-crossing PRIMITIVE. SINGLE `from.runtimes.delete(id)` +
reposition the SAME `AgentRuntimeState` object + `to.runtimes.set(id, rt)` (no
copy — preserves an in-flight `activePlan`/`perceptionQueue`/`reflectionCounter`
across the seam). Result: `'ok'` | `'absent'` (no such runtime in `from`) |
`'duplicate'` (target ALREADY has the id). Under 7-D.2's SINGLE ROAMING ROSTER
an agent lives in exactly ONE scope, so `'duplicate'` is now a BACKSTOP /
bug-signal (logged), NOT the expected path it was under the 7-D.1 per-pane model.
The cross is REFUSED — agent stays in `from`, unchanged (no vanish). On `'ok'` it
clears the departed agent's `proximitySince`/`holdFired` entries in
`from.perception` (no stale FOV hold timer), CLEARS `rt.pendingCross` (a stale
intent in the destination would re-fire = ping-pong) and STAMPS `rt.justArrivedAt`
at the entry cell (anti-ping-pong guard behavior.ts reads). This is the
no-dup/no-leak chokepoint. The LIVE wiring (behavior.ts cross-intent + cohort
sprite handoff) LANDED in 7-D.2 (see "Live seam walk" below); only the on-screen
sprite VISUAL is Windows-pending.

**Perception caches** (`src/agents/perception.ts`) — `proximitySince /
holdFired / lastSeen` were module-global singletons keyed by `runtime.id`
(two panes' 'loki' would clobber). Now bundled onto the scope as
`PerceptionScope` (`scope.perception`); `computePerception` +
`resetPerceptionState` take a trailing optional `PerceptionScope`. Scopeless
callers fall back to the module globals → unchanged.

**Scope wiring + decisions (Phase 7 / v2.x)**
- `cell.ts` creates `const pos = getPlayerPos(paneId)` + `const scope =
  createRuntimeScope()` at mount, threads them into `mountCohort` (which gains
  required `paneId` + `scope`), uses them in `handleLaunch`
  (`broadcastGameLaunched(listRuntimesIn(scope))`, `getRuntimeIn(scope,'loki')`),
  registers the scope via `registerCellPaneScope` (`src/state/cellPaneScopes.ts`),
  and clears all three (`teardownCohort` clears runtime+perception, then
  `unregisterScope()` + `clearPlayerPos(paneId)`) in teardown.
- **Sleep-reflection** sweeps the UNION of all live cell panes'
  runtimes (`listCellPaneScopes().flatMap(listRuntimesIn)`) — every live world
  reflects overnight. Single 'root' pane → that one scope → unchanged.
- **App.tsx `external_fullscreen`** broadcast: union over all live cell panes'
  runtimes, anchored at the FOCUSED pane's player. Single-pane identical
  (`focusedPaneId === 'root'`).
- **Telemetry overlay** (`telemetry.ts`): pane-AGNOSTIC. It reads the
  persistent cell-keyed DB (`aggregateTelemetry`) + process-global
  `getRouterStats()` — it never reads `listRuntimes()`. So it aggregates across
  panes "for free" via the persistent store (the union answer); no scoping
  change. `routerStats` deny-verb counters stay process-global (debug counter).
- **Persistent memory stays cell-keyed by seed** (`cellIdFor(seed)`), NOT
  pane-scoped. Two panes of the SAME cell (the only thing `splitPane` yields
  today) correctly SHARE persistent memory (marks/reflections/telemetry); only
  the VOLATILE player + runtime + perception is pane-scoped. This is intended —
  persistent memory is about the PLACE, volatile runtime about the live agents
  in a pane. Do not "fix" the shared marks as a leak.

---

## Agent runtime

### Tier-0 BT scoring (`src/agents/behavior.ts:tickBehavior`)
Candidates (in evaluation order):
| Source | Score | When |
|---|---|---|
| baseline `wander` | 0.4 | always |
| baseline `idle` | 0.2 | always |
| intent → `approach` | 0.7 | when `runtime.intent` parseable |
| **plan-step (5A)** | **0.75** | when `runtime.activePlan` has pending steps |
| schedule rule | 0.3-0.8 | per-agent `def.schedule` rules |

`tryAdvancePlanStep` runs at top: advances location-bearing steps when agent
is at target. No-location steps advance via post-pick handler.

### Tier-1 dispatch (`src/agents/router.ts:routeTier1`)
- Drains `perceptionQueue`; each event accrues importance to `reflectionCounter`
- Throttle: `def.tier1ThrottleMs` (per-agent, e.g. Loki 30s)
- One-shot reprompt on deny-verb rejection
- Telemetry row per dispatch via `memory.logTier1`

### Tier-2 reflection (`src/agents/router.ts:routeTier2`)
- Threshold: `REFLECTION_THRESHOLD = 150` (Smallville constant)
- **Rate-limit (5A)**: `REFLECTION_MIN_INTERVAL_MS = 3600000` (1 hour). `force=true` bypasses.
- Output parsed for optional `plan` field (5A) → `memory.recordPlan` + `runtime.activePlan`
- Telemetry row via `memory.logTier2`

### `MemoryWriter` (`src/agents/router.ts:MemoryWriter`)
Production: `desktop/src/agents/memory/writer.ts` (better-sqlite3-backed).
Web build / tests: `nullMemoryWriter` (no-ops).
- `recordPerception(agentId, event, importance) → id | null`
- `recordReflection({agentId, text, synthesisedFrom, themes, importance}) → id | null`
- `recordPlan({agentId, text, steps, status, importance}) → id | null`
- `placedMarksForCell(cellId) → mark[]`
- `aggregateTelemetry(windowMs, nowMs?) → TelemetrySummary` — Ctrl+\` overlay data
- `logTier1(args) / logTier2(args)` — telemetry rows
- `recentMemories(agentId, n) → RecentMemorySummary[]`
- `persona(agentId) → PersonaSnippet | null`

### Perception kinds
Defined inline in router.ts `importanceFor`:
| Kind | Importance | Notes |
|---|---|---|
| `game_launched` | 8 | bookshelf E-key fires this + Tier-2 force |
| `external_fullscreen` | 7 | 4A pause-state perception (NOT shipped to schema yet) |
| `player_holding` | 6 | player lingering near agent |
| `agent_meeting` | 6 | two agents close to each other |
| `player_proximity` | 4 | player entered FOV |
| `bookshelf_in_reach` | 3 | agent adjacent to a shelf |
| (default) | 3 | unknown kinds |

### Memory schema (`src/agents/memory/schema.ts`)
`MemoryKind = 'observation' | 'reflection' | 'plan' | 'dialogue'`

`LoreRow` (5C.2): `{id, library_id, text, source, created_at, embedding_id}`
— uploaded canon in its OWN `lore` table (NOT `memories`); additive, no
migration, **library-scoped** (one upload → all agents in the library).

`PlanStep`: `{kind: 'move_to' | 'inspect' | 'place_mark' | 'linger' | 'withdraw', target?: string, location?: CellPoint, status: 'pending' | 'done'}`

`ObservationSource`: `'self_perception' | 'agent_meeting' | 'player_proximity' | 'bookshelf_e' | 'game_launched' | 'external_fullscreen' | 'cell_mount'`

### Embedding backbone (5C.1)
Transport only — not yet wired into the write/read lifecycle (that's 5C.2).
- **Worker** `worker/lib/providers.ts:callEmbed(env, texts)` → Ollama
  `/api/embed` with `EMBED_MODEL` (default `nomic-embed-text`, 768-dim).
  `POST /api/embed` `{texts}`→`{embeddings:number[][]}`; **local-only**
  (cloud 501, privacy contract).
- **Client** `src/api/embed.ts:embedTexts(texts)` → `{ok,embeddings}` |
  `{ok:false,error}`; nomic `withDocumentPrefix` / `withQueryPrefix`
  (`search_document:` / `search_query:`).
- **Chunker** `src/agents/memory/chunk.ts:chunkText(text, {maxTokens,
  overlapTokens})` — pure, zero-dep (~4 chars/token; default 500/50). No
  tiktoken: worker + web share one `package.json`, so a WASM tokenizer
  would hit the web bundle for no gain (nomic tokenizes server-side).
- **Storage path already exists** (`db.ts`): `memory_vec` vec0 768-dim +
  `attachEmbedding()` + `embedding_id` FK; `import.ts` `embedQueue` /
  `drainEmbedQueue()`. Still unpopulated for *agent memories* — the
  drain→embed→attach wiring for those is a later fast-follow. Lore uses
  its own attach path (below), populated now.

### Lore store + retrieval (5C.2a)
Library-scoped uploaded canon. Additive — own tables, never touches the
`memories` contract. **Cosine path verified in WSL** (sqlite-vec loads
here; `smoke-5c2-lore-store.mts` exercises the real KNN).
- **Tables** (`db.ts` bootstrap): `lore` (TEXT PK = UUIDv7) +
  `idx_lore_library` + `lore_fts` (contentless fts5, trigger inserts
  `new.text` directly — not json_extract) + `lore_vec`
  (`vec0(embedding float[768] distance_metric=cosine)` — nomic vectors
  aren't unit-normalised, so cosine not L2).
- **db methods**: `insertLore`, `attachLoreEmbedding` (lore_vec insert +
  FK, one tx), `recentLore`, `searchLoreFts` (library-scoped),
  `searchLoreVec(embedding, k)` (global cosine KNN → `{row, distance}[]`),
  `loreCount`.
- **`retrieval.ts:retrieveLore(db, libraryId, {topK, queryEmbedding})`** —
  cosine when a query embedding + vec present (over-fetch k=topK×4,
  JOIN-filter to library, slice topK), else recency. Returns
  `LoreSnippet{id,text,source}`.
- **Writer** (`writer.ts`): `recordLore({text,source,embedding?})`
  (mints UUIDv7, inserts, attaches embedding if supplied),
  `recentLore(n, queryEmbedding?)`, `loreCount()`. On `MemoryWriter`
  interface + `nullMemoryWriter` (router.ts).
- **Reflect injection**: `routeTier2` calls `gatherLore` (default
  `src/agents/lore-context.ts:defaultLoreGatherer` — skips when
  `loreCount===0`, else embeds a `search_query:`-prefixed digest of recent
  memories once, cosine-retrieves) → forwards `recentLore` into
  `ReflectInput` → worker folds a `recent_lore:` block into the Tier-2
  user prompt + one system-prompt line. Best-effort: gatherer throw/fail
  → reflection still runs without lore.
### Lore ingestion + drop-zone (5C.2b)
- **`src/agents/lore-ingest.ts:ingestLore(text, source, writer, opts?)`** —
  chunk (`chunkText`) → embed (`embedTexts`, doc-prefixed) → `recordLore`
  per chunk. Best-effort: embed 501/fail/throw/count-mismatch → chunks
  still persist (FTS-only), `embedError` surfaced, `embeddedCount=0`.
  Embed fn injectable for the smoke. Returns `IngestResult{source,
  chunkCount, embeddedCount, loreIds, embedError?}`.
- **`src/render/LoreDropZone.tsx`** — DOM React component (sibling of the
  canvas, like `<Hud>` — file drop is a DOM API, not PIXI). Gated on
  `store.loreUploadOpen`. `.txt`/`.md`, 1 MB cap, `file.text()` →
  `ingestLore` against `getCurrentMemoryWriter()`. Null writer (web /
  pre-bootstrap) → "needs the desktop app". Hardcoded terminal palette.
- **App.tsx**: Ctrl+U toggles, Esc closes; `<LoreDropZone/>` mounted
  after `<Hud/>`.
- **`desktop/src/main.ts`**: `will-navigate` guard in `createWindow` —
  blocks navigation away from the app URL so a stray file-drop can't make
  Chromium open the file (contextIsolation:false footgun).

### Lore profile (5D.1)
- **`src/agents/lore-profile.ts:buildLoreProfile(writer, opts?)`** — pure,
  sync, deterministic. `Pick<MemoryWriter,'recentLore'|'loreCount'>` →
  `LoreProfile {dominantThemes: ThemeTag[]; tone: LoreTone; keywords: string[];
  suggestedTilePaletteBias: ThemeId[]; suggestedDistrictHints:
  SeasideArchetype[]; sourceCount; corpusHash}`. Term-frequency over a SHIPPED
  closed-vocab whitelist (`THEME_TAGS` ×14, tone lexicon, keyword→
  theme/district/palette tables); unmatched terms DROPPED (never echoed).
  `loreCount()===0` → `emptyLoreProfile()`. No network/LLM/embeddings; no
  Date.now/Math.random (inlined FNV-1a `corpusHash`). **`keywords` is
  LOCAL-ONLY (raw vocab) — never egress;** `dominantThemes`+`tone` are the only
  egress-safe (closed-vocab) fields (the 5D.4 digest draws from these).
- `src/themes/index.ts` now exports `THEME_IDS` (literal tuple) + `ThemeId` —
  the palette-whitelist single-source (`keyof typeof THEMES` widens to
  `string`). 5D.1 smoke asserts `THEME_IDS` == `Object.keys(THEMES)`.

### Lore-weighted scatter (5D.2)
- **`src/procedural/scatter.ts`** — `SCATTER_BIBLE` entries now carry
  `themes: string[]`; new exported `buildScatterTable(loreProfile?)` reweights
  candidates by matching dominant themes (`LORE_BOOST_PER_MATCH=2`, integer →
  no float drift). `scatterDecor(seed, layout, extraKeepouts, loreProfile?)`
  gains an optional 4th arg. **Lore reweights glyph WEIGHTS only — never adds/
  removes/reorders/zeroes a candidate, never touches position sampling.** No
  lore / empty `dominantThemes` → byte-identical to pre-5D (verified vs HEAD
  across 6 seeds; base total 13, order ♠∩≡☼). loreProfile is a 2nd
  deterministic input: same (seed + loreProfile) → same scatter. (Share-URL,
  when revived, must encode the lore digest to reproduce a lore'd world
  remotely — noted for that slice.)
- **`src/render/levels/cell.ts`** computes the profile at mount via
  `getCurrentMemoryWriter()` (null writer / web → undefined → base scatter) and
  threads it into `scatterDecor`. Per-mount compute; caching is a 5D.4 job.

### Lore opt-in toggle + persona/reflect egress (5D.3)
- **Privacy model: opt-in, default OFF** (`store.loreEnabled` /
  `setLoreEnabled`). Gates whether ANY lore-derived signal LEAVES the device.
  Local lore-weighted scatter (5D.2) is independent — never egresses.
- **`router.ts:routeTier2`** gates lore egress behind TWO independent opt-ins
  (5D.4; see "two-flag model" below): `RouteOptions.loreEnabled?` →
  CLOSED-VOCAB `loreContext = {themes, tone}` from `buildLoreProfile(memory)`;
  `RouteOptions.loreQuote?` → RAW lore excerpts (`recentLore`, text + source)
  via `gatherLore`. Both default off; either/both/neither may be on. With both
  off, NOTHING lore-derived egresses (reflection still runs).
- **`ReflectInput.loreContext`** (api/agent.ts) → worker `/api/agent/reflect`
  appends ONE closed-vocab system line after the persona block ("This
  library's lore leans toward: …"); `ReflectInput.recentLore` (when `loreQuote`
  is on) → the worker folds raw excerpts into a `recent_lore:` prompt block.
- **Egress wiring landed in 5D.4** (see below). 5D.3 added the
  `RouteOptions.loreEnabled` gate to `routeTier2` but did NOT thread it through
  any call site — cohort/cell/sleep-reflection all ran lore-free regardless of
  the toggle. 5D.4 wires all three.
- Smokes: `smoke-5d-persona.mts` (10) asserts the closed-vocab gate both
  directions (still valid — `loreEnabled` alone never ships raw lore);
  `smoke-5c2` (34) exercises both flags: `loreEnabled`-only ships no raw lore,
  `loreQuote` ships raw excerpts, both-off ships nothing.

### Lore makes the world visible (5D.4)
- **Palette recolor (LOCAL, no opt-in).** When a lore corpus exists, the whole
  world theme is `buildLoreProfile(writer).suggestedTilePaletteBias[0] ??
  DEFAULT_THEME_ID` (deterministic; same corpus → same ThemeId).
  `agents/lore-theme.ts:themeFromLore` is the single derivation point; `App.tsx`
  derives it at mount and passes `getById(themeId)` to `mountPalace`.
  Independent of `loreEnabled` (mirrors 5D.2 scatter — local theming needs no
  egress opt-in).
- **`loreVersion` remount counter** (`store.ts`): `loreVersion: number` +
  `bumpLoreVersion()`. `LoreDropZone` bumps it once after a successful ingest;
  the `App.tsx` mount effect depends on `loreVersion` so the world cleanly
  tears down + remounts with the recomputed theme.
- **Agent-voice egress wired (the 5D.3 gap, now closed) — TWO-FLAG MODEL.**
  All three `routeTier2` call sites pass BOTH opt-ins from the store:
  `loreEnabled: …loreEnabled` + `loreQuote: …loreQuoteEnabled` —
  `render/agents/cohort.ts` (live reflection), `render/levels/cell.ts`
  (bookshelf launch), `agents/sleep-reflection.ts` (overnight sweep — one
  destructured read above the per-agent `Promise.allSettled` so the whole
  sweep shares one policy). The two flags gate independent egress paths:
  `loreEnabled` → closed-vocab `loreContext {themes, tone}` (whitelisted; raw
  text/keywords NEVER on this path); `loreQuote` → raw lore excerpts
  (`recentLore`, text + source) so agents can name specific people/places.
  Both default OFF → nothing lore-derived egresses.
- **Opt-in toggle UI** in `LoreDropZone.tsx`: TWO checkboxes, both default off.
  **"Theme & mood"** → `store.loreEnabled` (copy: sends only abstract theme
  tags, never your text). **"Quote directly"** → `store.loreQuoteEnabled`
  (copy: sends relevant excerpts of your uploaded text + filename so agents can
  reference specifics). Both gate EGRESS only — NOT the local palette recolor
  or scatter.
- **Deferred:** the manifest-digest → `/api/world` half of 5D is NOT done — the
  2D renderer does not consume the Stage 1 manifest (`loadManifest` is never
  called), so there is nothing to feed. Revisit if/when the renderer wires the
  manifest.
- Smoke: `smoke-5d4-lore-visible.mts` (33) — deterministic theme-from-lore
  incl. no-lore → DEFAULT fallback; the two-flag egress gate (`loreEnabled`
  ships closed-vocab {themes,tone} with no raw-keyword leak; `loreQuote` ships
  raw excerpts; both/neither); and the `loreVersion` + `loreEnabled` +
  `loreQuoteEnabled` store actions.

### Local model presence (6A) — "Local AI lives in your world" Depth 1
The user's local Ollama model manifests as ONE landmark in the cell —
presence only (IDEAS.md "The local LLM is visible in the world", Depth 1).
No dialogue (CLAUDE.md "don't make the agent a chatbot").
- **Detection (via the Worker).** `worker/lib/providers.ts:detectLocalModel(env)`
  — never-throws, local-only. `LLM_PROVIDER !== 'local'` → `{present:false}`.
  Local path: `GET ${OLLAMA_URL}/api/tags` (installed catalog → name /
  sizeBytes / paramClass) + `GET /api/ps` (≥1 loaded model → `running`).
  Pure exported `paramClassFromName(parameter_size)` normalises the token.
  Route `GET /api/local-model` (`worker/index.ts`) just `json()`s the
  snapshot — 200 `{present:false}` on cloud/no-Ollama (NOT 501: absence is a
  normal state, unlike `/api/embed`).
- **Client** `src/api/localModel.ts:getLocalModel()` →
  `{present:true,models,running} | {present:false}`; never rejects (network /
  non-ok / cloud → `{present:false}`, same defensive posture as `embedTexts`).
  Pure exported `parseLocalModelBody(data)` (body→result transform, smoke
  surface) + `NO_LOCAL_MODEL` default. Reads ONLY local model metadata;
  nothing egresses to a third party.
- **Deterministic placement + appearance** `src/procedural/localLandmark.ts`
  (pure, src/procedural determinism domain):
  - `pickLandmarkModel(result)` — largest by sizeBytes, paramClass, then
    name tiebreak → ONE landmark (multiple models = a village is a LATER depth).
  - `landmarkVariantFor(model)` → `'cottage' | 'tower'`. Cutoff:
    `paramClass` billions ≥ `TOWER_PARAM_THRESHOLD_B` (30) → tower, else
    cottage; sizeBytes fallback (`TOWER_SIZE_THRESHOLD_BYTES` = 18 GiB);
    unknown size → cottage. `landmarkGlyphFor` → whitelisted glyphs only
    (`⌂` cottage / `║` tower — both confirmed in the Cozette atlas), tinted
    `LANDMARK_FG_KEY` (`cyan`).
  - `pickLandmarkCell(layout, seed, keepouts)` — `mulberry32((seed ^
    0x1a4d)>>>0)` (namespace `0x1a4d`, distinct from cell `0xce11` / scatter
    `0x5ca7` / Loki `0x10ce`). Picks a T_FLOOR cell that is not a keepout /
    not the spawn AND has a free floor neighbour (so the player can stand
    adjacent to press E). NO wall-clock / Math.random. The live `running`
    state is kept OUT of placement — position depends only on
    (seed, layout, keepouts).
  - `formatLocalModelStatus(model, running)` → `"Qwen 2.5 7B · idle ·
    localhost"` / `"· running ·"`.
- **Renderer** (`src/render/levels/cell.ts`): new `landmarkLayer` (Z between
  scatter + agents). After the scatter pass, `pickLandmarkCell` runs with
  `[lokiSpawn, ...scatterCells]` as keepouts and renders one BitmapText
  glyph. `pulseLandmark` ticker (sibling of `positionPlayer`, removed in the
  same teardown) modulates `alpha` 0.55↔1.0 ONLY when `running` — driven off
  `app.ticker.deltaMS` so it freezes under `paused`/`sleeping` and never uses
  a wall clock. Press-E on a landmark (when no launchable shelf is adjacent —
  bookshelf-launch wins) toggles a diegetic status panel
  (`mountLocalModelStatus` in `bookshelfPrompt.ts`, same Container+BitmapText
  pattern, tinted `cyan`); auto-despawns on step-away. `localModel` threads
  `mountPalace` (one-shot `getLocalModel()` in the boot `Promise.all`) →
  `mountLevel` → `mountCell`, all optional/defaulted to `NO_LOCAL_MODEL`.
- **Production follow-up (documented, NOT built):** a deployed remote Worker
  / frontend cannot reach the user's `localhost:11434`. The production path
  is the Electron main process probing localhost directly and exposing it
  over IPC (`src/api/electron.ts` + desktop preload), the way the v0.6
  wrapper checked Ollama. The local wrangler→Ollama path wired here is the
  dev/WSL-testable equivalent that proves the contract.
- Smoke: `smoke-6a-local-model.mts` (42) — size→variant thresholds + glyph
  whitelist, deterministic model selection + placement (same seed → same
  cell; 200 seeds all land on a valid free floor cell; keepout/spawn
  avoidance; walkable-neighbour guarantee), the `{present:false}` parse path,
  and the status formatter.

### Scale ladder beyond cell/district (Phase 7-A)
- **Clustering layer** `src/procedural/clusters.ts` — NEW pure module. Groups
  the library into a `district → island → continent` tree seeded by the
  profile seed. Two PRNG namespaces, both isolated from cell `0xce11` /
  scatter `0x5ca7` / Loki `0x10ce` / landmark `0x1a4d`:
  `CLUSTER_SALT = 0xc1a5` (bucketing; districts/islands/continents use
  `CLUSTER_SALT`, `+1`, `+2`) and `LAYOUT_SALT = 0xc0a5` (2D box / blob
  placement). NO `Math.random`/`Date.now`; games are appid-canonicalised
  before bucketing so input order (`profile.topGames` vs `SAMPLE_LIBRARY`)
  never moves the tree.
  - Input `ClusterGame {appid, name, engagement?}` — decoupled from `Profile`
    so the anonymous `SAMPLE_LIBRARY` path (no engagement) and the
    authenticated `profile.topGames` path (carries engagement) both feed it.
  - `clusterLibrary(games, seed): ClusterTree` — `ClusterTree {continents:
    Continent[], districtCount, islandCount, continentCount, gameCount}`;
    `Continent {id, islands}` → `Island {id, districts}` → `District {id,
    games, activity}`. Fan-out: `districtCountFor(n) = clamp(ceil(sqrt n), 1,
    8)`, then island = `clamp(ceil(d/2),1,4)`, continent =
    `clamp(ceil(i/2),1,2)`. Bucketing first-fills one game/district then
    PRNG-distributes the remainder, so **every district is non-empty + every
    game lands in exactly one district**. n==0 → empty-but-valid; n==1 → 1/1/1.
  - Pure helpers (smoke-pinned): `layoutClusterPositions(ids, seed, salt,
    cols)` (deterministic **collision-free** canonical-grid box placement:
    box `idx` → `(idx % cols, floor(idx / cols))`, every (x,y) distinct;
    seed/salt accepted for signature stability but unused — per-seed variety
    lives in the cluster TREE, not the layout. An earlier row-jitter could
    land two boxes on one cell, silently overwriting a card; removed in the
    7-A must-fix), `blobCells(cx, cy,
    area, w, h, seed, salt)` (continent land-mass raster — diamond footprint,
    seeded edge erosion, core always emitted, in-bounds), `activityGlyphFor`
    (engagement → shade ramp `▓ ▒ ░ ·`, the cell/tiles vocabulary),
    `flattenDistricts`/`flattenIslands`/`islandGameCount`/`continentGameCount`/
    `aggregateActivity` (aggregation), `truncateLabel`/`districtLabel`.
- **Real renderers** — `mountStubLevel` for island/continent and the static
  3×3 district placeholder are replaced:
  - `src/render/levels/district.ts` `mountDistrict(app, theme, games, seed)` —
    home district d0 as the centre card + up to 8 real neighbour cards (name +
    count + activity glyph); empty slots render as floor-dot terrain. YOU
    marker on the centre. Read-only (no ticker/keydown). Same fit/teardown.
  - `src/render/levels/island.ts` `mountIsland(app, theme, games, seed)` —
    the neighbourhood-cards of the primary continent (largest by game count);
    bordered card per district placed by `layoutClusterPositions`; YOU marker
    on the home district's card.
  - `src/render/levels/continent.ts` `mountContinent(app, theme, games, seed)`
    — continents as filled `blobCells` land-masses on a `·` dot sea, blob size
    ~ game count; centroid labels (home continent tints `fgBright`).
  - All three compose a character grid → ONE BitmapText panel (district.ts
    style, not per-glyph), tint via `hexToInt(theme.palette[key])` with ONE
    palette + the shared box-glyph vocabulary. Teardown = `off('resize')` +
    `container.destroy({children:true})`; NEVER `app.destroy()`.
- **planet + solar_system STAY stubs** — `mountStubLevel(app, theme, level,
  aggregateNote?)` gained an optional 4th arg; the router passes
  `"{gameCount} games · {continentCount} continents"` so the highest rungs
  carry a library aggregate instead of a bare "keep playing".
- **Router** `src/render/PixiApp.ts` `mountLevel()` — island/continent/district
  branches added before the `mountStubLevel` fallthrough, each calling
  `snapshotLibraryState()` (now also returns `clusterGames: ClusterGame[]` —
  `topGames` with engagement when authenticated, `SAMPLE_LIBRARY` without) →
  `mount*(app, theme, clusterGames, seed)`. The `[`/`]` zoom transition +
  `subscribe()` remount loop are untouched (every renderer returns a correct
  teardown closure).
- Smoke: `smoke-7a-scale-ladder.mts` (73) — clustering determinism (same
  games+seed → byte-identical tree; input order invariance), exactly-one-
  district membership + aggregation, sample/empty/single/15-game edges,
  fan-out formula, activity-glyph whitelist, `layoutClusterPositions`
  determinism/bounds/one-box-per-id + **all-distinct positions across 2000
  seeds × n=1..16 × cols=1..5** + the anonymous demo seed `0xa11ce11`
  collision-free (the 7-A must-fix regression) + seed-independence,
  `blobCells` determinism/core/bounds, label helpers.

### Composable panes — multi-pane router (Phase 7-B, VISUAL-ONLY)
The renderer moved from one-active-level-at-a-time to N simultaneous panes,
each showing a `(level, rect)`. **Single-pane is the DEFAULT + behaviour-
preserving**; multi-pane is opt-in (`\` toggles single↔study, `Tab` cycles
focus — both window-mode only). Seam SEMANTICS / agent crossing / memory flow
are NOT here (Depth-2, deferred).
- **Pure types** `src/types.ts` — `PaneRect {col,row,cols,rows}` (a cell on a
  uniform integer composition grid) + `PaneDescriptor {id, level, rect}`. Zero
  runtime; both the store + the renderer import them with no cycle.
- **Router** `src/render/PixiApp.ts` — the single `let teardownLevel` is
  replaced by `const livePanes = new Map<paneId, LivePane>` where `LivePane =
  {paneRoot: Container, mask: Graphics|null, teardown, refit, rect, level}`.
  - `computePixelRect(rect, gridCols, gridRows, screenW, screenH): PixelRect
    {px,py,pw,ph}` — pure, integer-floored grid-cell → pixel mapping. A 1×1
    grid + full-grid rect returns `{0,0,screenW,screenH}` — IDENTICAL to the
    pre-7-B single-level fit input (the back-compat anchor).
  - `mountPane(desc, cols, rows)` builds a per-pane `paneRoot` Container,
    positioned at the rect's pixel origin, added to a dedicated `panesLayer`.
    Clipped by a `Graphics().rect(0,0,pw,ph).fill()` assigned as `paneRoot.mask`
    — UNLESS `isFullGrid(rect)` (single-pane case): mask stays `null`, skipping
    the stencil so the render path is byte-identical to today. The level
    renderer fits to rect-LOCAL space (origin 0,0) because `paneRoot` carries
    the screen origin.
  - `mountPaneLevel(app, parent, rect, theme, level, paneId, writer, atlas,
    model)` — generalises the old `mountLevel`; dispatches to `mount{Cell,
    District,Island,Continent,Stub}` with `(parent, rect)` and returns
    `{teardown, refit}`.
  - `reconcilePanes(panes, cols, rows, seedChanged)` — the store-subscribe diff:
    mount added, unmount removed, remount on level/cell-seed change, re-fit on
    rect-only change. A focusedPaneId-only change never touches the Map (no
    remount flash). With ONE pane + a level change this reduces to exactly one
    teardown + one remount — byte-equivalent to the old `scaleChanged` path.
  - ONE app-level `app.renderer.on('resize')` listener recomputes every pane's
    pixel rect + drives each pane's `refit` (the 5 per-renderer resize
    listeners were removed). The single shared Application + ticker STAY — NEVER
    `app.destroy` on a pane change (only `paneRoot.destroy`; mask detached
    first to avoid a dangling-mask warning).
  - `refitAll` → `reconcileMask(live, cols, rows, pr)` reconciles each pane's
    clip mask against its CURRENT full-grid status (NOT just redrawing an
    existing one): partial-grid + no mask → CREATE + attach; partial-grid +
    mask → redraw (no GC churn); full-grid + mask → detach + destroy → null.
    This closes the single→study clip gap: `\` toggles the `root` pane's rect
    full-grid→partial WITHOUT changing its id/level, so `reconcilePanes` takes
    the cheap rect-only branch (`live.rect = desc.rect`) and never re-runs
    `mountPane` (the only OTHER place a mask is created) — `reconcileMask` in
    the subsequent `refitAll` is what creates the now-required mask, so every
    partial-grid pane is genuinely clipped. The full-grid↔partial reconcile is
    locked at the model layer by `smoke-7b-panes` A12 (id kept + rect flips
    full→partial); the mask geometry itself is PIXI → Windows checklist B1.
  - **Seam glyphs** — `seamLayer` (above panes) draws box-drawing decoration
    where panes abut: Graphics strokes for the seam runs + `drawSeamGlyphs`
    BitmapText junctions (`│ ─ ┼ ├ ┤ ┬ ┴`, `fgDim`). Pure decoration, NO
    semantics, NO crossing. Skipped entirely with one pane. Glyph-coverage
    smoke verifies the codepoints are Cozette-covered.
  - **Overlay z-order** — telemetry + morning-dispatch still `app.stage.
    addChild` (top); `keepOverlaysOnTop()` re-asserts `panesLayer`/`seamLayer`
    at the bottom after every reconcile so overlays stay above all panes.
- **Pane-scoped renderers** — `mount{District,Island,Continent,Stub}` signatures
  changed to `(parent: Container, rect: PixelRect, …)` → `{teardown, refit}`;
  they `parent.addChild` (NOT `app.stage`) and fit to `rect.pw/ph` (not
  `app.screen`). Mechanical; read-only (no input/ticker).
- **Cell input gate** — `mountCell(app, parent, rect, theme, layout, …, paneId
  = 'root')` → `{teardown, refit}`. ONE window keydown listener per pane (added
  once at mount, removed at teardown — NO per-pane add/remove). The handler
  gains ONE guard after the wallpaper guard: `if (getState().focusedPaneId !==
  paneId) return;` so only the FOCUSED cell pane consumes WASD/arrows/E. Default
  single 'root' pane ⇒ always focused ⇒ unchanged.
- **Per-pane player + runtime UNBLOCK (Phase 7 / v2.x)** — the 7-B deferred
  "two cell panes collide on the shared `playerPosition` + `agentRuntime`
  singletons" limitation is REMOVED. `playerPos`/`agentRuntime`/`perception`
  are now pane-scoped (see those sections above); each `mountCell` captures its
  own `getPlayerPos(paneId)` + `createRuntimeScope()`, so splitting a focused
  cell pane (`|` key → `splitPane`, which inherits the focused pane's `cell`
  level) yields a SECOND independent cell pane with its own `@` + cohort +
  perception — no collision. Input still routes to the focused pane only (the
  gate above). This GATES the Depth-2 seam-crossing / cross-pane memory flow
  work (NOT built here). The live two-`@` visual is PIXI-only (Windows
  checklist B4); the pure pane-isolation logic is smoke-locked
  (`smoke-pane-runtime.mts`, 19 assertions).
- **Input ownership (App.tsx)** — the globals keydown handler gained `Tab`
  (`cycleFocus`, `preventDefault` so focus stays on canvas), `\`
  (`setArrangement` single↔study), and `|` (Phase 7 / v2.x — `splitPane
  ('vertical')`; splitting a focused CELL pane yields a SECOND independent cell
  pane). ALL behind the existing `if (getState().wallpaperMode) return` guard so
  they no-op in wallpaper mode. `|` is a no-op in the single-pane default until
  pressed, so the default path is unchanged.
  The `[`/`]` zoom branch is UNCHANGED — it still reads `scale`/calls `setScale`,
  which the store redirects to the focused pane.
- Smoke: `smoke-7b-panes.mts` (68) — A1–A11 lock the one-pane reduction
  (`scale === focused pane level`; `setScale` mutates the focused pane;
  replaying App.tsx's `[`/`]` algorithm walks `SCALE_ORDER` identically),
  splitPane/closePane/focusPane/cycleFocus/setPaneLevel/setArrangement reducers,
  the pane-grid rect tiling (no overlap, full coverage), deterministic
  split-twice-from-reset ids, zero-pane guard, dangling-focus refocus, all rects
  in-bounds. A12 locks the single→study clip-mask regression trigger (the `root`
  pane KEEPS its id + flips full-grid→partial, which is what makes
  `reconcileMask` create the now-needed mask). The PIXI router (Container Map,
  masks, seam glyphs) is VISUAL → Windows checklist (`TODO-USER.md`).

### Seam graph + coordinate bridge (Phase 7-D — Depth-2 foundation)

**`src/state/seams.ts`** — PURE, PIXI-free, store-free (imports ONLY
`PaneDescriptor`/`ScaleLevel` from `../types`, the leaf). Derives the seam GRAPH
in INTEGER grid space, the SAME abutment fact `PixiApp.drawSeams` used to derive
implicitly — but as DATA so the two cannot diverge.
- `buildSeams(panes, gridCols, gridRows): Seam[]` — O(n²) pairwise. Two panes
  A,B share a VERTICAL seam iff `A.col+A.cols === B.col` AND their row-spans
  overlap (segment = grid col `B.col` over `[max(A.row,B.row), min(...))`);
  symmetric HORIZONTAL. `paneA` is ALWAYS the lower-coord pane (one canonical
  form). Deduped by `canonicalSeamId` (order-independent), sorted by id
  (deterministic; no Math.random — mirrors the src/procedural contract).
  Returns `[]` for <2 panes AND the lone full-grid pane → `PixiApp`'s
  `livePanes.size<=1` early-return is preserved exactly.
- `Seam`: `{ id, paneA, edgeA:'right'|'bottom', paneB, edgeB:'left'|'top',
  levelA, levelB, segment:{axis,line,start,end}, open, edgeType }`. **open/closed
  model: default OPEN, toggle RESERVED** (`open` ships always-true; `edgeType`
  reserved `null`) — a future locked pane flips them WITHOUT changing
  `buildSeams`/`bridgeCoord` signatures.
- `bridgeCoord(seam, from, dimsA, dimsB): BridgeResult` — same-level open seam →
  `{kind:'same-level', paneId, cell}` (entry on the shared edge's first interior
  col/row, along-edge coord proportionally projected dest↔src interior dims,
  round+clamp; round-trip within ±1, lossy by design). Cross-level seam
  (`levelA!==levelB`) → `{kind:'cross-level'}` NO cell (focus-transfer/zoom hint,
  not a literal walk — cell vs district are different coord spaces). Closed seam
  → `{kind:'closed'}`. `dimsA/dimsB` = each pane's INTERIOR `layout.width/height`
  (passed by the caller — NEVER looked up in the pure module).
- **`PixiApp.drawSeams` refactor (no-divergence)**: now iterates
  `buildSeams(<live pane descriptors>)` and projects each seam to pixels via
  `projectSeamToPixels` (exported; SAME float-floor `cellW/cellH` as
  `computePixelRect`) instead of the old per-pane right/bottom-edge loop. Smoke
  D1 asserts the load-bearing invariant: the projected PAINTED-PIXEL set equals
  the OLD per-pane edge painted-pixel set, across clean AND asymmetric tilings.
  On a clean tiling the stroke SETS also match (old loop OVER-drew shared edges
  twice → graph dedups → ONE stroke each). On an ASYMMETRIC tiling (a full-height
  pane abutting two stacked half-height panes) the graph SPLITS the shared edge
  into two collinear segments — so the stroke SETS differ from the old single
  full-span line, but the painted pixels are identical (collinear opaque 1px
  segments rasterise to the same line). D1 pins both: pixel-coverage equality
  AND that the asymmetric stroke sets genuinely differ (so the split path can't
  silently stop being exercised). `seams.ts` stays pixel-free; ALL float math
  stays in `PixiApp` at draw time → no 1px gap introduced. `drawSeamGlyphs` still
  runs whenever `livePanes.size > 1` (gated only by the early-return, NOT by seam
  count) → junction-glyph path byte-identical to pre-7-D. The actual PIXI render
  is Windows-checklist (the pixel-coverage equivalence is smoke-locked).

### Cross-seam perception (Phase 7-D — the cheap seed)

**`src/agents/crossSeam.ts`** — PURE enricher. `enrichSnapshotAcrossSeams(base,
paneId, deps): WorldSnapshot` splices a neighbour's player + agents (within
`maxFov` Chebyshev of the shared edge) into a COPY of `base.agents`, projected
into THIS pane's cell space via `deps.openSeamsFor(paneId)[].bridge.toLocal`
(neighbour space → this pane). **Returns `base` BY REFERENCE when
`openSeamsFor` is empty** → no-open-seam path allocates nothing, byte-identical.
Neighbour subjects are namespaced `${neighbourPaneId}:${id}` (own `loki` and
neighbour `loki` never collide; perception.ts's `otherId===runtime.id`
self-skip never drops a neighbour). Neighbour PLAYER → synthetic
`${neighbourPaneId}:player` agent (never overwrites `world.player` → THIS pane's
own player_proximity/hold-timer intact). Refuses a non-walkable / non-flat-cell
seam (vertical/scale) and an unregistered (non-cell) neighbour. `perception.ts`
is UNTOUCHED — the enriched snapshot is the only new input.
- **`src/state/paneRegistry.ts`** — NEW leaf (imports only types):
  `Map<paneId,{scope,layout}>` + `registerPane(paneId,scope,layout)→unregister`
  + `getPane(paneId)`. `cell.ts` registers at mount / unregisters at teardown
  (alongside `registerCellPaneScope`). SEPARATE from `cellPaneScopes.ts` (the
  paneId-less sleep-sweep Set, left byte-identical).
- **`cohort.ts` wiring**: `MountCohortOptions.crossSeamDeps?` (optional). When
  omitted → `noCrossSeamDeps(maxFov)` (no open seams ever) → enricher returns the
  snapshot by reference → single-pane / multi-pane-unjoined paths byte-identical.
  `maxFov` = max `def.fov` across the cohort, computed once at mount. The tick
  wraps `baseWorld` through the enricher before the perception loop.
- Smoke: `smoke-7d-seams.mts` (69) — S1–S10 seam graph + bridge, D1 draw
  no-divergence (pixel-coverage equality across clean + asymmetric tilings),
  X1–X6 cross-seam perception (sees-across-open /
  not-across-closed-by-reference / not-across-non-adjacent / no-seam-identical /
  id-namespacing / unregistered-neighbour), M1–M5 the migrate primitive
  (ok/no-leak/no-dup/duplicate-guard/cache-cleanup/plan-preserved).

### Live seam walk — single roaming roster (Phase 7-D.2)

The "terminal merging" payoff: an agent WALKS from one pane into the neighbour
— its runtime migrates and its sprite follows. **IDENTITY MODEL = SINGLE
ROAMING ROSTER** (Harry's call): the 5-agent COHORT exists ONCE across the whole
world; each agent is in exactly ONE pane's `RuntimeScope` at a time and roams by
crossing seams. This REPLACES the per-pane model (every pane spawned the full
COHORT). The `migrateRuntime` duplicate guard is now a BACKSTOP, not the norm.

- **Roster-once + per-tick sprite reconcile** (`src/render/agents/cohort.ts`) —
  the roster spawns ONCE, into ROOT's scope only (gated `paneId==='root' && scope
  empty`; `clearRuntimesIn` also root-only). A split pane mounts EMPTY and gains
  agents solely as they walk in. **ROSTER-AWARE GATE (must-fix):** the root-gate
  is IDEMPOTENT against a PARTIAL root remount — when root relevels (zoom `]`/`[`)
  while a sibling cell pane still holds an agent that walked out of root,
  reconcilePanes tears down + remounts ONLY root. The gate now SKIPS any id
  `isAgentLiveElsewhere(id, 'root')` (paneRegistry-backed) reports as live in
  another pane, so the remount re-adopts the distributed roster instead of
  cloning it (without this, root would re-create `loki` while p2 still held it =
  duplicate runtime + two sprites + doubled Tier-1; `migrateRuntime`'s dup guard
  only backstops the NEXT cross, never repairs an existing dup). Single-pane: no
  other registered pane ⇒ always false ⇒ full roster seeds, byte-identical. A
  split pane mounts EMPTY and gains agents solely as they walk in. `mountCohort`
  is a renderer+ticker: each tick
  `reconcileSprites()` diffs the sprite Map against `listRuntimesIn(scope)` —
  create a BitmapText for a newly-present id (positioned at `runtime.x/y`, NOT
  0,0; def-glyph via `defById`; skipped if no def — a theme-filtered id must not
  migrate in), destroy+drop a sprite whose id left. **The destroy pass + its
  `keys()` snapshot are skipped when `sprites.size <= scope.runtimes.size`** (no
  orphan) → the single-pane no-churn path is allocation-free at 60Hz. Spawn
  determinism is byte-identical (same `mulberry32((seed^fnv(id)))` +
  `resolveSpawn`, insertion order = defs order = Z-order).
- **Live wiring** (`src/render/PixiApp.ts`) — `CohortCrossWiring` (lazy:
  `crossSeamDepsFor(maxFov)` + `seamExitsFor()`) built from `buildSeams(live
  panes)` + `paneRegistry` interior dims, threaded
  `mountPaneLevel→mountCell→mountCohort`. `liveSeamGraph()` short-circuits to
  empty for `livePanes.size<=1` BEFORE `buildSeams` (no alloc; `openSeamsFor`
  returns [] → enricher returns base by reference). The deps closures re-derive
  each call so split/close keeps a mounted cohort current WITHOUT a remount.
- **Seam→edge/exit projection** (PURE, smoke-importable):
  `crossSeam.buildSeamEdgesForPane(seams, paneId, dims)` → `SeamEdge[]` for
  PERCEPTION (`toLocal` maps neighbour→this, just-past-edge, paneA→E/S edge /
  paneB→W/N). `seams.seamExitsForPane(seams, paneId, dims, isWalkable?)` →
  `Map<"x,y", SeamExit>` for CROSSING (`bridgeCoord` maps this→neighbour
  in-bounds). The two are INVERSE directions, authored independently so
  perception ≠ crossing can't silently swap. **FLOOR GATE (must-fix):**
  `seamExitsForPane` now takes an optional `isWalkable(paneId,x,y)` oracle and
  emits an exit ONLY when BOTH the exit cell (this pane) AND the bridged ENTRY
  cell (neighbour) are walkable (T_FLOOR) — mirroring behavior.ts:
  `walkableNeighbours`, which only steps onto floor. Without it an agent could be
  offered a cross that lands it INSIDE a wall (where it has no walkable neighbour
  out = stuck). PixiApp wires the live oracle off each pane's registered
  `CellLayout.tiles` (`isWalkableInPane`). **Consequence with TODAY's geometry:**
  the library cell fills its WHOLE perimeter with wall (`boundaryAt`: E/W = `│`,
  N/S = `─`; only a SOUTH door), so an E/W (vertical-split) seam yields ZERO
  crossable exits — an HONEST empty result, not a stranding. A VISIBLE crossing
  needs a walkable seam edge cell, which does not exist yet (DEFERRED follow-up:
  a doorway in the shared wall, or an N/S split aligned to the south door). The
  crossing MECHANISM is fully proven headlessly regardless (smoke builds floor
  exits by construction).
- **Cross-intent** (`src/agents/behavior.ts`) — `BehaviorContext.seamExits?`
  threaded from the cohort tick (only built when non-empty, so single-pane uses
  the static `baseCtx`). A `wander` step on a seam-exit edge cell offers "step
  off the edge" as ONE fixed-position candidate appended after the in-bounds
  floor neighbours (PRNG pick reproducible). When picked → set
  `runtime.pendingCross = {paneId, x, y}`, do NOT mutate x/y. No seam exit ⇒
  clamp exactly as today.
- **Runtime fields** (`src/state/agentRuntime.ts`) — `AgentRuntimeState` gains
  `pendingCross: {paneId,x,y} | null` (the intent) + `justArrivedAt: {x,y} |
  null` (anti-ping-pong guard); both default `null` in `initialRuntime`.
  `migrateRuntime` 'ok' path now CLEARS `pendingCross` (a stale intent in the
  destination would re-fire) and STAMPS `justArrivedAt` at the entry cell.
  behavior.ts suppresses emitting a fresh cross while the agent sits on
  `justArrivedAt` and clears it once the agent steps off (deterministic, no
  wall-clock → share-URL safe).
- **Consume** (cohort tick) — after `tickBehavior`, if `pendingCross` set,
  resolve the neighbour scope via `crossSeamDeps.getNeighbourScope` (a
  torn-down/non-cell neighbour → undefined → clear intent, stay put: the
  teardown-race / vanish guard) and `migrateRuntime`; on 'ok' `continue` (the
  agent left — its sprite reconciles away here, the neighbour reconciles it in).
  'duplicate' is logged as an anomaly (single-roaming-roster invariant breach).
- **Memory** — unchanged. Volatile runtime migrates with the agent (same
  object); persistent memory is library-scoped + already shared. No cross-pane
  merge.
- **DEFERRED**: a WALKABLE seam edge cell (today's solid-wall perimeter means an
  E/W split has no floor edge to cross — the floor gate correctly returns no
  exits; a doorway in the shared wall / a south-door-aligned N/S split is the
  follow-up that makes a live crossing VISIBLE); cross-LEVEL crossing
  (cell→district — `bridgeCoord` returns `cross-level`, no agent coord space
  yet); user open/close-seam control; per-pane throttling; arrangement
  persistence; closing-split-pane agent disposition (they DROP on teardown — root
  re-adopts/reseeds on remount; migrate-home deferred); visitor-mode/privacy on
  joined topology.
- **Windows-pending (NOT WSL-verifiable)**: the on-screen WALK + sprite handoff
  are PIXI-visual; they follow mechanically from the smoke-locked reconcile +
  migration AND require a walkable seam edge (deferred) to be observable. The
  certifiable-now visual checks are single-pane unchanged (W-2) + roster-once /
  no-dup-across-zoom (W-3). See `TODO-USER.md` "Phase 7-D.2 live walk".
- Smoke: `smoke-7d2-walk.mts` (58) — A1/A2 roster-once + determinism, W0–W3
  Seam→edge/exit projection + single-pane reduction (vs the 7d-seams eastEdge
  oracle), B1/B2 cross-intent emit / clamp, M1 migrate A→B exactly-once +
  activePlan preserved + pendingCross cleared + justArrivedAt stamped, D1/D2 no
  ping-pong, **C1/C2 roster-aware remount (no dup loki on a partial root relevel
  while p2 holds it; exclude-self so the first mount still seeds)**, **F1/F2
  floor-gated exits (real wall-perimeter layout ⇒ ZERO E/W crossable exits;
  entry-cell-wall refused; both-floor control restores them)**, R1 single-pane
  end-to-end (roster present, openSeamsFor [], migrate never invoked).

### Region terminals — per-wing cell panes (Phase 7 / v2.x)

A cell pane can render ONE *wing* (a 7-A cluster-tree district) of the library
instead of the whole-library cell — its own seed, shelves, agent cohort +
(seed-keyed) persistent memory, so a split pane becomes a genuinely DIFFERENT
generated world. This is the foundation for Composable-Panes Depth 3
(agent-initiated world-joining, IDEAS.md). **Default panes are unaffected**
(`regionId` absent ⇒ whole-library cell, byte-identical).
- **`src/procedural/regions.ts`** — PURE, determinism-domain. `regionTerminals
  (games, profileSeed): RegionTerminal[]` delegates bucketing to `clusterLibrary`
  (appid-canonical → input-order-invariant) + `flattenDistricts`, mapping each
  district to `{regionId, seed, label, games}`. `regionSeed(profileSeed,
  regionId)` mixes the district id into `profileSeed ^ REGION_SALT` via FNV-1a →
  a uint32 distinct per wing AND distinct from the bare profile seed (a wing
  never aliases the root pane). `REGION_SALT = 0x7e44` — a fresh PRNG namespace
  (no collision with cell `0xce11` / scatter `0x5ca7` / Loki `0x10ce` / landmark
  `0x1a4d` / cluster `0xc1a5` / layout `0xc0a5`). No Math.random/Date.now.
- **`PaneDescriptor.regionId?: string`** (`src/types.ts`) — OPTIONAL, only
  meaningful for a cell pane. Absent ⇒ whole-library cell.
- **Renderer** (`src/render/PixiApp.ts`) — `mountPaneLevel` gains a trailing
  `regionId?`; the cell branch, when set, resolves the matching `RegionTerminal`
  from `regionTerminals(snap.clusterGames, snap.seed)` and feeds the wing's
  `seed` + `games` (as `BookGame[]`) to `mountCell` instead of the snapshot.
  An unresolvable regionId (library shrank) falls back to the whole-library
  cell. `LivePane.regionId` is tracked + `reconcilePanes` REMOUNTS on a region
  change (alongside level/seed change). `snapshotLibraryState` is now EXPORTED
  so App.tsx can derive the live wing list without re-deriving games+seed.
- **Store** (`src/state/store.ts`) — `cycleFocusedPaneRegion(regionIds)`: walks
  the FOCUSED cell pane through `[undefined, …regionIds]` (whole-lib → d0 → … →
  wrap); no-op on a non-cell pane; never re-syncs `scale` (a wing swap keeps the
  level). The wing list is passed in by the caller (App.tsx) so the store stays
  free of the cluster-tree math. A stale regionId (not in the live list) →
  indexOf -1 → resets to whole-library.
- **Input** (`src/App.tsx`) — `r`/`R` (behind the wallpaper guard, alongside
  Tab/`\`/`|`) derives the wings via `snapshotLibraryState()` + `regionTerminals`
  and calls `cycleFocusedPaneRegion`. Safe — cell.ts movement is WASD/arrows/E.
  Works on the default single pane too (the whole world becomes one wing).
- **Windows-pending**: the on-screen per-wing room/shelves/cohort is PIXI-visual;
  it follows mechanically from the smoke-locked region logic + the existing
  cell-mount path.
- Smoke: `smoke-regions.mts` (20) — determinism, exactly-one-wing membership,
  unique regionId/seed, wing-seed ≠ profile-seed, REGION_SALT namespace
  isolation, input-order invariance, 0/1-game edges. Reducer coverage in
  `smoke-7b-panes.mts` R1–R5 (cycle undefined→d0→…→wrap, stale-region fallback,
  non-cell no-op, focused-only assignment).

---

## Desktop wrapper

### `Config` (`desktop/src/config.ts`)
On-disk JSON at `<userData>/config.json`.
- `mode: 'window' | 'wallpaper'` — 4A
- `displayId?: number` — 4B (undefined = primary)

### Wallpaper-mode state (`desktop/src/wallpaper/windows.ts`)
Internal module state:
- `attaching, trackedWorkerW, preWallpaper{Bounds,Style,ExStyle}, raisedDesktopOnEnter, watchdog, lastDisplay`

Exports: `enterWallpaper(win, display)`, `exitWallpaper(win)`.

### Throttle pipeline (`desktop/src/wallpaper/throttle.ts`)
`ThrottleState = 'full' | 'throttled-1hz' | 'paused' | 'sleeping'` (5B)

Controller state: `{timer, current, wallpaperHwnd, shellHwnd, display, isWallpaperMode, lastForegroundHwnd}`.

Probe now includes `idleDurationMs` from Win32 `GetLastInputInfo` +
`GetTickCount` (5B). Default `SLEEP_THRESHOLD_MS = 600000` (10 min).

Pure state machine: `computeThrottleState(probe)`. SLEEPING gate sits
ABOVE the fullscreen check (idle > threshold + no fullscreen →
sleeping); fullscreen still wins over sleeping. Testable in WSL via
mirror in `scripts/smoke-{4a-throttle,5b-sleep}.mts`.

**macOS/Linux idle ladder (consolidation 2026-06)**: the Win32 probe
(`getWin32()`) returns null off-Windows, so `startThrottleController`
now branches to `startIdleController(opts)` instead of degrading to a
permanent `full`. It polls Electron `powerMonitor.getSystemIdleTime()`
(whole-OS idle seconds — the macOS analogue of `GetLastInputInfo`) and
maps via the pure `computeIdleThrottleState(idleMs, isWallpaperMode,
sleepMs?, throttleMs?)`: `full` → `throttled-1hz` (`IDLE_THROTTLE_MS`
60s) → `sleeping` (`SLEEP_THRESHOLD_MS` 10min, same as Win32; drives
sleep-reflection + morning dispatch). NO `paused` (no window probe;
the wallpaper is behind everything, so a covering app hides it for
free). Shares `controller.timer` + the emit-on-change + IPC path;
Win32 path untouched. Pure ladder mirrored in `smoke-5b-sleep.mts`
(idle-ladder block). Verified live on macOS:
`[throttle] idle controller started (darwin) idle-throttle=60s sleep=600s`.

### Sleep reflection (`src/agents/sleep-reflection.ts`, 5B)
On SLEEPING entry (after 5s grace), App.tsx fires
`triggerSleepReflection()` which iterates present agents with
`reflectionCounter > 0`, calls `routeTier2` per agent with
`reflectionMinIntervalMs: 0` (bypass per-real-hour cap — this IS
the budget). Reflection texts + plan summaries buffer in a
module-local array; `consumeSleepReflections()` drains it for the
morning-dispatch overlay on SLEEPING → other transition.

### Morning dispatch (`src/render/overlays/morning-dispatch.ts`, 5B)
Terminal-styled BitmapText banner pinned to top-center. Shows on wake
when `consumeSleepReflections()` returns non-empty. Auto-dismisses
after 30s via PIXI ticker delta (NOT setTimeout — ticker is stopped
during sleep so setTimeout would fire too early). No interactive
dismiss in v1 (wallpaper mode is click-through + keydown gated).

### Peek state (`desktop/src/main.ts`)
Module-local `let peeking = false;` (4C). Bypasses persisted Mode.
`togglePeek()` flow: exitWallpaper → setAlwaysOnTop(true) → focus. Inverse on toggle-off.

### IPC channels
| Direction | Channel | Payload |
|---|---|---|
| renderer → main | `steam:getSteamId / isAvailable / launchGame / getAuthTicket` | various |
| renderer → main | `app:getUserDataPath` | — |
| renderer → main | `wallpaper:getMode / setMode` | Mode |
| renderer → main | `throttle:getCurrent` | — |
| renderer → main | `wallpaper:getPeeking / togglePeek` | — |
| main → renderer | `wallpaper:modeChanged` | Mode |
| main → renderer | `throttle:state-change` | `{state, isInitial}` |
| main → renderer | `wallpaper:peekChanged` | boolean |

Renderer side: `src/api/electron.ts` mirrors with defensive guards (`warnStalePreload` when bridge method missing).

---

## Worker routes (`worker/index.ts`)

| Method + Path | Phase | Notes |
|---|---|---|
| `GET /healthz` | 0 | Provider config + Ollama GPU status |
| `GET /api/auth/steam/{login,return}` | 2.1 | Web OpenID flow |
| `POST /api/auth/steamticket` | 6.2 | Desktop Steamworks ticket → cookie |
| `GET /api/auth/me / logout` | 2.1 | Session check |
| `GET /api/library` | 2 | Enriched + tagged library + profile |
| `GET /api/world` | 2.7 | Stage 1 manifest (cached 24h) |
| `POST /api/agent/tick` | 0 / 2C | Tier-1 micro-action |
| `POST /api/agent/reflect` | 2D + 5A | Tier-2 reflection + plan (5A added plan output) |
| `POST /api/embed` | 5C.1 | `{texts}`→`{embeddings}` 768-dim via local Ollama nomic-embed-text; cloud path 501 (privacy contract) |
| `GET /api/local-model` | 6A | `{present, models:[{name,sizeBytes?,paramClass?}], running}` via local Ollama `/api/tags`+`/api/ps`; cloud / no-Ollama → 200 `{present:false}` (NOT 501 — absence is a normal state). Reads ONLY local model metadata; never egresses |
| `POST /api/bake/sprite` | 3C | PixelLab.ai proxy for bake tooling |

---

## Smoke tests (`scripts/smoke-*.mts`)
Assertion counts as of 2026-05-30:
| Slice | File | Count |
|---|---|---|
| 2B | smoke-2b-cohort.mts | 13 |
| 2C | smoke-2c-perception.mts | 15 |
| 3A/3B/3C-β | smoke-3a-sprites.mts | 64 |
| 3C PixelLab | smoke-3c-pixellab.mts | 55 |
| 4A throttle | smoke-4a-throttle.mts | 23 |
| 4B monitors | smoke-4b-monitors.mts | 31 |
| 4C peek | smoke-4c-peek.mts | 24 |
| 5A reflection | smoke-5a-reflection.mts | 41 |
| 5B sleep | smoke-5b-sleep.mts | 22 |
| 5C lore (backbone) | smoke-5c-lore.mts | 27 |
| 5C.2a lore store | smoke-5c2-lore-store.mts | 34 |
| 5C.2b lore ingest | smoke-5c2b-lore-ingest.mts | 20 |
| 5D.1 lore profile | smoke-5d-lore-profile.mts | 17 |
| 5D.2 lore scatter | smoke-5d-scatter.mts | 16 |
| 5D.3 lore persona/gate | smoke-5d-persona.mts | 10 |
| 5D.4 lore visible | smoke-5d4-lore-visible.mts | 33 |
| 6A local model | smoke-6a-local-model.mts | 42 |
| 7A scale ladder | smoke-7a-scale-ladder.mts | 73 |
| 7B composable panes | smoke-7b-panes.mts | 68 |
| 7 per-pane runtime | smoke-pane-runtime.mts | 21 |
| 7D seam-crossing | smoke-7d-seams.mts | 69 |
| 7D.2 live seam walk | smoke-7d2-walk.mts | 58 |
| glyph coverage | smoke-glyph-coverage.mts | 19 |
| (others) | 2a/2d/2e/2f/2g | print "cleaned /tmp/..." |
| **Total numeric** | | **782** |

**No aggregate runner** — there is no `smoke-all.mts` / `npm run smoke` /
`npm run test`. Gates: `npm run typecheck` (`tsc --noEmit` ×2, main +
worker) and each `npx tsx scripts/smoke-*.mts` directly.

Shared helpers live in `scripts/lib/smoke.ts` (5H): `makeChecker()`,
`mockElectronModule()`.

Pattern: pure functions tested directly. Win32/Electron parts deferred
to user verification on Windows (logged in commit messages + TODO-USER.md).

---

## What this file is NOT

- Not the architecture doc (that's SPEC.md)
- Not the rule book (CLAUDE.md)
- Not the parked-ideas list (IDEAS.md)
- Not the slice sequence (PLAN.md)
- Not the per-phase narrative (RETROS/)
- Not the v1.0 scope (docs/pivot/CONSOLIDATION.md)
- Not the user-blocked list (TODO-USER.md)

It's just the present-tense shape of the moving parts. When a slice
changes a shape, the slice's commit should touch this file too.
