# Live state snapshot

The current shape of the data structures and modules that change
between slices. Updated at the end of each slice — `git log STATE.md`
shows when each shape last moved. **Read this once at session start;
re-grep only when this is stale.**

For "what's authoritative" → `docs/INDEX.md`. For day-to-day rules →
`CLAUDE.md`. For the phase plan → `PLAN.md`. For the current
to-fix-on-Windows list → `TODO-USER.md`. This file is *the present
tense* of those.

Last updated: **2026-05-28** (slice 5H, after 5A reflection completion).

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
- **Scale ladder**: `scale: ScaleLevel`, `setScale`
- **Telemetry overlay (2F)**: `agentDebugOverlay: boolean`, `toggleAgentDebug`

### `playerPosition` (`src/state/playerPos.ts`)
Module-local singleton mutated at frame rate. Cell-grid coords, not pixels.
`{x: number, y: number}` + `setPlayerPosition(x, y)`.

### `AgentRuntimeState` (`src/state/agentRuntime.ts`)
Per-agent volatile state. Module-local `Map<id, state>`, cleared on cell unmount.
- `id`, `x`, `y`, `present`, `intent`, `currentAction`, `actionEndsAt`
- **Phase 2C perception**: `perceptionQueue: PerceptionEvent[]`
- **Phase 2D reflection trigger**: `reflectionCounter: number`
- **Phase 2C throttle**: `lastTier1At: number`
- **Phase 5A reflection rate-limit**: `lastReflectionAt: number`
- **Phase 5A plan execution**: `activePlan: PlanPayload | null`, `activePlanStepIndex: number`

`Tier0Action` discriminated union: `wander | idle | approach | scheduled`.

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
- **Still TODO (5C.2b)**: the drop-zone UI (chunk→embed→recordLore) — no
  way to *put* lore in yet except programmatically.

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
| `POST /api/bake/sprite` | 3C | PixelLab.ai proxy for bake tooling |

---

## Smoke tests (`scripts/smoke-*.mts`)
Assertion counts as of 2026-05-28:
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
| 5C.2a lore store | smoke-5c2-lore-store.mts | 31 |
| (others) | 2a/2d/2e/2f/2g | print "cleaned /tmp/..." |
| **Total numeric** | | **346** |

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
