# Live state snapshot

The current shape of the data structures and modules that change
between slices. Updated at the end of each slice — `git log STATE.md`
shows when each shape last moved. **Read this once at session start;
re-grep only when this is stale.**

For "what's authoritative" → `docs/INDEX.md`. For day-to-day rules →
`CLAUDE.md`. For the phase plan → `PLAN.md`. For the current
to-fix-on-Windows list → `TODO-USER.md`. This file is *the present
tense* of those.

Last updated: **2026-05-30** (Phase 7-B: composable panes — multi-pane renderer router replacing the single-active-level model; `panes[]`/`focusedPaneId` + scale-mirror back-compat in the store; per-pane clipped Container Map + pane-scoped level renderers + cell focused-pane input gate + box-glyph seams; SINGLE-PANE DEFAULT behaviour-preserving. Visual-only — seam SEMANTICS/agent crossing/memory flow are Depth-2 deferred).

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
| 7 per-pane runtime | smoke-pane-runtime.mts | 19 |
| glyph coverage | smoke-glyph-coverage.mts | 19 |
| (others) | 2a/2d/2e/2f/2g | print "cleaned /tmp/..." |
| **Total numeric** | | **666** |

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
