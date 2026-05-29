# Phase 5C.1 — Embedding backbone

**Shipped** 2026-05-29 on `claude/phase5c-lore` (continuing the per-slice
cadence; 5C split into 5C.1 backbone + 5C.2 lore ingestion).

## What landed

The transport layer for local embeddings — everything needed to turn text
into 768-dim vectors, with nothing yet consuming them (that's 5C.2).

1. **Worker embed call** (`worker/lib/providers.ts`). `callEmbed(env,
   texts)` POSTs to Ollama `/api/embed` with `EMBED_MODEL` (default
   `nomic-embed-text`, 768-dim — matches the `memory_vec` table). New
   `EMBED_MODEL?` field on `ProviderEnv` (auto-flows to the worker `Env`
   via `interface Env extends ProviderEnv`). Validates the vector count
   matches the input count.

2. **`/api/embed` local branch** (`worker/index.ts`). Replaced the
   impl-pending 501 with the real call: parse body → validate
   `texts: string[]` (non-empty, all non-empty strings) → `callEmbed` →
   `{embeddings}`. **Kept the cloud 501 above it** — embeddings are
   local-only by privacy contract (CLAUDE.md).

3. **Pure chunker** (`src/agents/memory/chunk.ts`, new).
   `chunkText(text, {maxTokens, overlapTokens})` — default 500/50 (the
   Smallville convention). ~4-chars/token approximation over
   whitespace-split words; carries an overlap tail between windows.
   `approxTokens()` helper. Zero dependencies — see "What surprised me".

4. **Client wrapper** (`src/api/embed.ts`, new). `embedTexts(texts)` →
   `{ok, embeddings}` | `{ok:false, error}`, mirroring `reflectAgent`'s
   fetch shape. nomic task-prefix helpers `withDocumentPrefix` /
   `withQueryPrefix` (`search_document:` / `search_query:`) for retrieval
   recall parity in 5C.2.

5. **Smoke** (`scripts/smoke-5c-lore.mts`, 27 assertions). Chunker
   boundary math (empty / whitespace / sub-window / exact-fit / one-over
   / overlap carry / oversized-overlap-clamp / multi-chunk overlap),
   `approxTokens`, prefix helpers, and `embedTexts` against a mocked
   global `fetch` (request shape, success parse, empty short-circuit, 501,
   malformed body). Run via `npx tsx scripts/smoke-5c-lore.mts`.

## What surprised me

- **No `worker/package.json` — so no place to hide a tokenizer.** The
  pre-5A plan called for tiktoken as a "worker-only devDep." But the
  worker and the Vite web build share one root `package.json` / one
  `node_modules`; only tree-shaking keeps worker code out of the web
  bundle. A WASM tokenizer is exactly what tree-shaking *won't* reliably
  drop, and it'd hit the public share surface (CLAUDE.md's >500KB-gzip
  rule). Killed the dep entirely: the chunker is a pure char/word
  approximator, and `nomic-embed-text` tokenizes its own input
  server-side, so exact BPE counts never mattered for windowing.

- **The consumption side was already built and just starved.** `db.ts`
  has had the `memory_vec` vec0 table, `attachEmbedding()`, and the
  `embedding_id` FK since Phase 2D; `import.ts` has `embedQueue` /
  `drainEmbedQueue()`. Nothing ever drained the queue and `/api/embed`
  was a double-501, so every `embedding_id` is null and `memory_vec` is
  empty. 5C.1 builds the *generator*; 5C.2 wires drain→embed→attach + the
  cosine read query. Splitting here keeps 5C.1 fully WSL-testable with
  zero runtime-integration risk.

- **There is no `smoke-all.mts` / `npm run smoke` / `npm run test`.** Mid-
  slice I assumed an aggregate smoke runner existed and "registered" the
  new smoke in it — it doesn't. The actual gates are `npm run typecheck`
  (`tsc --noEmit && tsc --noEmit -p worker` — covers main + worker) and
  running each `scripts/smoke-*.mts` directly via tsx. Verified ground
  truth from `package.json` rather than trusting recalled output. Worth a
  STATE.md note for the next slice: there's no one-shot suite command.

## What's deferred (→ 5C.2)

- The `lore` table (+ `lore_fts` + `lore_vec`), `recordLore`, and the
  library-scoped lore retrieval (FTS + cosine over `lore_vec`).
- The drain→embed→`attachEmbedding` wiring + its caller, so memory rows
  actually get vectors.
- The cosine read query in `db.ts` (the `queryEmbedding` param in
  `retrieval.ts` is still a no-op).
- The renderer drop-zone (`.txt`/`.md`, Ctrl+U), the `will-navigate`
  drop-safety guard in `desktop/src/main.ts`, and the `recent_lore`
  reflect-prompt injection.

## What the user verified (PENDING)

5C.1 is transport-only; the real round-trip needs Ollama. On the Windows
box, after `ollama pull nomic-embed-text`:
- `curl -s localhost:8787/api/embed -d '{"texts":["hello"]}' -H
  'content-type: application/json'` returns a 768-length vector (with
  `LLM_PROVIDER=local`).
- With `LLM_PROVIDER=anthropic`, the same call 501s (privacy contract).

## Files

- `worker/lib/providers.ts` — `EMBED_MODEL` on `ProviderEnv` + `callEmbed`
- `worker/index.ts` — `callEmbed` import + `/api/embed` local impl + doc
- `worker/.dev.vars.example` — `EMBED_MODEL` line + pull hint
- `src/agents/memory/chunk.ts` (new) — pure chunker + `approxTokens`
- `src/api/embed.ts` (new) — `embedTexts` + nomic prefix helpers
- `scripts/smoke-5c-lore.mts` (new, 27 assertions)
- `STATE.md` — embed route status, embedding-backbone subsection, smoke
  table (+27 → 315)
- `PLAN.md` — 5C scope corrections (pure chunker, separate lore table) +
  5C.1/5C.2 status split
