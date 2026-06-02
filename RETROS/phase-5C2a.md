# Phase 5C.2a — Lore store + retrieval + reflect injection

**Shipped** 2026-05-29 on `claude/phase5c-lore`. The data half of lore
ingestion: an agent reflection can now weave in uploaded canon. The UI to
*put* lore in is the 5C.2b follow-up.

## What landed

The full lore data path, additive — its own tables, never touching the
stable `memories` contract:

1. **`LoreRow` + tables** (`schema.ts`, `db.ts`). `lore` (TEXT PK =
   UUIDv7) + `idx_lore_library` + `lore_fts` (contentless fts5; trigger
   inserts `new.text` directly since lore.text is a real column, not
   JSON) + `lore_vec` (`vec0(embedding float[768] distance_metric=
   cosine)`). All `CREATE ... IF NOT EXISTS` → zero migration on existing
   DBs.

2. **db methods** (`db.ts`): `insertLore`, `attachLoreEmbedding`
   (lore_vec insert + FK update in one tx — mirrors `attachEmbedding`),
   `recentLore`, `searchLoreFts` (library-scoped), `searchLoreVec(embed,
   k)` → `{row, distance}[]`, `loreCount`.

3. **`retrieveLore`** (`retrieval.ts`): cosine when a query embedding +
   vec are present (over-fetch k = topK×4, JOIN-filter to the library,
   slice topK), recency fallback otherwise.

4. **Writer surface** (`writer.ts` + `router.ts` interface +
   `nullMemoryWriter`): `recordLore({text, source, embedding?})`,
   `recentLore(n, queryEmbedding?)`, `loreCount()`.

5. **Reflect injection** (`lore-context.ts` new, `router.ts`,
   `api/agent.ts`, `worker/index.ts`): `routeTier2` calls a `gatherLore`
   injectable (default skips when `loreCount===0`, else embeds a
   `search_query:`-prefixed digest of recent memories once + cosine-
   retrieves) → `ReflectInput.recentLore` → worker folds a `recent_lore:`
   block into the Tier-2 user prompt + one system-prompt line telling the
   agent to weave canon in without quoting it.

6. **Smoke** (`smoke-5c2-lore-store.mts`, 31 assertions): real
   sqlite-vec KNN — insert/FTS/attach/cosine, library isolation across
   FTS+vec+recency, `retrieveLore` both paths, writer surface, and router
   injection (with-lore / no-lore / gatherer-throws).

## What surprised me

- **sqlite-vec runs in WSL — the cosine path is NOT Windows-only.**
  Before writing anything I probed `better-sqlite3` + `sqlite-vec` in
  WSL node: cosine `distance_metric`, KNN (`MATCH ... AND k = ?`), and
  KNN+JOIN library-filtering all work. So unlike the Win32 throttle/sleep
  slices, 5C.2a's core is fully smoke-verifiable here. The 31-assertion
  smoke exercises the genuine extension, not a mock.

- **KNN is global; the library filter must come after.** `lore_vec`'s
  `k` limit applies before any JOIN predicate, so a nearer chunk from
  *another* library can crowd out this library's results. `retrieveLore`
  over-fetches (k = topK×4, min 32) then JOIN-filters by `library_id` and
  slices. The smoke proves it: l3 (library B, same axis-3 direction as
  l1) shows up in the raw global KNN but never leaks into library A's
  `retrieveLore`.

- **cosine, not L2.** nomic-embed-text vectors aren't unit-normalised, so
  the default L2 metric would rank by magnitude as much as direction.
  `lore_vec` declares `distance_metric=cosine` explicitly; `memory_vec`
  stays L2 (untouched — not in this slice's scope).

- **Library-scoped, so it sidesteps the per-agent retrieval problem.**
  The pre-slice mapping flagged that `memories` retrieval is strictly
  `WHERE agent_id=?`, so library-wide lore in `memories` would need a
  per-agent fanout. A separate library-keyed `lore` table makes "one
  upload, every agent sees it" the natural shape — no fanout, and the
  reflect gatherer reads it once per reflection regardless of which agent
  is reflecting.

## What's deferred (→ 5C.2b)

- The drop-zone itself: a DOM sibling of the canvas (file drop is a DOM
  API, not PIXI), Ctrl+U toggle, `.txt`/`.md` via `file.text()`, then
  `chunkText` → `/api/embed` → `recordLore`. Until this lands there's no
  user-facing way to add lore (only programmatic, as the smoke does).
- `will-navigate` preventDefault guard in `desktop/src/main.ts` — with
  `contextIsolation:false` a stray file drop navigates Chromium to the
  file.
- General agent-memory embedding (the `memories` drain→embed→attach +
  cosine in `retrieveScored`) stays a separate fast-follow; lore proves
  the pattern.

## What the user verified (PENDING)

The data path is WSL-verified by smoke. The live story needs the UI
(5C.2b) + Ollama. End-to-end: drop a `.md`, wait for a reflection, see it
reference an uploaded term.

## Files

- `src/agents/memory/schema.ts` — `LoreRow`
- `src/agents/memory/db.ts` — lore tables/triggers/vec + 6 methods
- `src/agents/memory/retrieval.ts` — `retrieveLore` + `LoreSnippet`
- `src/agents/memory/writer.ts` — `recordLore`/`recentLore`/`loreCount`
- `src/agents/router.ts` — `LoreSnippet` + MemoryWriter lore methods +
  null writer + `routeTier2` gather/forward + `gatherLore`/`loreCount` opts
- `src/agents/lore-context.ts` (new) — `defaultLoreGatherer`
- `src/api/agent.ts` — `ReflectInput.recentLore`
- `worker/index.ts` — `recentLore` body field + `recent_lore:` digest +
  system-prompt line
- `scripts/smoke-5c2-lore-store.mts` (new, 31 assertions)
- `STATE.md` / `PLAN.md` — lore store section, 5C.2a/5C.2b split, smoke
  table (+31 → 346), no-aggregate-runner note
