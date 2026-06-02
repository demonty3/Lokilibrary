# Phase 5C.2b — Lore drop-zone UI

**Shipped** 2026-05-29 on `claude/phase5c-lore`. The user-facing half of
lore ingestion — drop a `.txt`/`.md` and the agents start weaving it in.
Completes Phase 5C (lore upload, text-only MVP).

## What landed

1. **`ingestLore`** (`src/agents/lore-ingest.ts`, new). Orchestrates the
   three 5C pieces for one document: `chunkText` (5C.1) → `embedTexts`
   doc-prefixed (5C.1) → `recordLore` per chunk (5C.2a). The embed fn is
   injectable so it's smoke-testable without a browser/Ollama.
   **Best-effort embed**: 501 / failure / throw / count-mismatch all fall
   back to persisting chunks WITHOUT vectors — FTS5 keyword retrieval
   still works, only cosine relevance is lost. Uploaded lore is never
   dropped because embeddings weren't available. Returns
   `IngestResult{source, chunkCount, embeddedCount, loreIds, embedError?}`.

2. **`LoreDropZone.tsx`** (`src/render/`, new). A DOM React component —
   deliberately NOT a PIXI overlay, because HTML5 `dataTransfer` /
   `File.text()` are DOM-only. Rendered as a sibling of the canvas in
   App.tsx (the `<Hud>` precedent). Gated on `store.loreUploadOpen`.
   `.txt`/`.md`, 1 MB cap, drag-drop OR "choose file…", multi-file. Calls
   `ingestLore` against `getCurrentMemoryWriter()`; null writer (web build
   / pre-bootstrap) shows "needs the desktop app". Per-file status:
   "campaign.md: 12 chunks embedded" or "… stored (FTS-only: …)".

3. **App.tsx wiring**. Ctrl+U toggles (not Ctrl+L — adjacent to the
   desktop Ctrl+Alt+L peek hotkey + browser address-bar bind), Esc
   closes, `<LoreDropZone/>` mounted after `<Hud/>`. Store slice
   `loreUploadOpen` / `toggleLoreUpload` / `setLoreUploadOpen`.

4. **`will-navigate` guard** (`desktop/src/main.ts:createWindow`). With
   `contextIsolation:false` + `nodeIntegration:true`, a file dropped
   anywhere outside the drop-zone makes Chromium navigate to / open the
   file, killing the renderer. The drop-zone preventDefaults its own
   dragover/drop; this is the backstop — block any navigation away from
   the app URL.

5. **Smoke** (`smoke-5c2b-lore-ingest.mts`, 20 assertions): happy path
   (N chunks → N vectors → N rows, doc-prefix applied to embed inputs but
   NOT to stored text), embed 501 → FTS-only, count mismatch → FTS-only,
   embed throws → caught, empty/whitespace → no chunks/writes/embed call.

## What surprised me

- **The drop-zone is the codebase's first interactive overlay, and it had
  to be DOM.** Every prior overlay (telemetry, morning-dispatch) is a
  click-through PIXI Container (`eventMode='none'`). A file-drop target
  fundamentally can't be PIXI — the HTML5 file API is DOM-only. So this
  follows `<Hud>` (a DOM sibling of the canvas), not the overlay pattern.
  Good thing the pre-slice mapping flagged this; it would've been a dead
  end to start in PIXI.

- **Best-effort embed is the right default, not an error path.** The
  privacy contract means `/api/embed` 501s on the cloud provider, and the
  web build has no Ollama at all. If ingest hard-failed without
  embeddings, lore upload would be desktop+local-only. Instead chunks
  always persist and FTS5 indexes them immediately (the `lore_ai_fts`
  trigger), so keyword retrieval works everywhere; cosine is the bonus
  when local embeddings are available. `embeddedCount` vs `chunkCount` in
  the UI status tells the user which they got.

- **Prefix on the embed input, not the stored text.** nomic's
  `search_document:` prefix improves retrieval, but it must NOT end up in
  the stored chunk text (it'd pollute FTS + the reflect digest). The
  smoke asserts both: embed inputs start with the prefix, stored rows
  don't.

## What's deferred

- **Agent-memory embeddings** (the `memories` drain→embed→attach + cosine
  in `retrieveScored`) — still a fast-follow. Lore proved the whole
  pattern end-to-end; wiring it for observations/reflections is mechanical
  but out of 5C scope.
- **Lore management UI** (list / delete uploaded docs). MVP is
  upload-only; a "what the agent has seen" transparency panel (the
  Raycast model from CLAUDE.md) is a natural 5D+ companion.
- **Image / URL / sparse-input lore** — explicitly deferred to
  5C-follow-ups per CONSOLIDATION.md (text-only MVP).

## What the user verified (PENDING)

Live end-to-end needs Windows + `ollama pull nomic-embed-text`:
- Run desktop app, press **Ctrl+U**, drop a real `.md` (e.g. D&D notes).
  Status shows "N chunks embedded".
- Worker log: `[embed]`-style round-trip (or a 501 → "FTS-only" status if
  `LLM_PROVIDER=anthropic`).
- Wait for / trigger a Tier-2 reflection; its text should reference a
  specific term from the uploaded lore.
- `sqlite3 memory.sqlite "SELECT source, substr(text,1,60) FROM lore
  LIMIT 5"` shows the chunks.

## Files

- `src/agents/lore-ingest.ts` (new) — `ingestLore` + `IngestResult`
- `src/render/LoreDropZone.tsx` (new) — DOM drop-zone component
- `src/state/store.ts` — `loreUploadOpen` slice
- `src/App.tsx` — Ctrl+U / Esc keydown + `<LoreDropZone/>`
- `desktop/src/main.ts` — `will-navigate` guard
- `scripts/smoke-5c2b-lore-ingest.mts` (new, 20 assertions)
- `STATE.md` / `PLAN.md` — ingest + drop-zone sections, 5C.2b done, smoke
  table (+20 → 366)
