# Consolidation / verification pass — 2026-06

First real on-screen verification of the project, run on macOS. Not a feature
phase: the goal was to *render everything that had only ever been smoke-tested
headlessly under WSL*, walk the design checkpoints the build skipped, fix what
broke, and produce a go-forward decision.

## Why this pass existed

The build ran ~10 days deep into **v2.x** (Phase 7: real scale ladder, 5-agent
society, multi-pane terminal UI, seam-walking agents) — all "Not in v1.0" per
`CONSOLIDATION.md`. Two liabilities: (1) `PLAN.md`'s "when to stop and
reconsider" checkpoints (aesthetic / agents-as-beings / wallpaper-all-day /
lore-personal) were **all blown past unseen** because nothing rendered under
WSL; (2) the Steam release gate (Phase 6) is undone while feature surface kept
widening. The dev box moving to a Mac unblocked it.

## Environment unlock (prerequisite work)

- **Node 26 → 22 (fnm + `.nvmrc`)**: `better-sqlite3@11` can't compile against
  Node 26; pinned the repo + `desktop/` to Node 22 LTS.
- **Desktop boots on macOS** (PR #33): fixed **two** import-time boot crashes
  (eager `koffi.load('user32.dll')` in `wallpaper/index.ts` *and*
  `wallpaper/throttle.ts`), implemented real macOS wallpaper mode
  (`NSWindow` desktop level via koffi→objc), and electron-rebuilt
  `better-sqlite3` for Electron's ABI (128).
- Result: `[memory/bootstrap] db ready (hasVec=true)` — the SQLite + sqlite-vec
  memory stream runs in Electron on macOS, a first.

## Regression floor (headless) — GREEN

`npm run typecheck` clean (both legs); **28/28 `scripts/smoke-*.mts` pass**;
`smoke-glyph-coverage` 19/19 (no tofu). Re-confirmed after every in-pass change.

## Verdicts per surface

| Surface | Verdict | Notes |
|---|---|---|
| Cell render (aesthetic) | ✅ **Checkpoint ① PASS** | Reads as intentional terminal-art (Harry). Sharpened: dropped the placeholder bookshelf sprites (rainbow noise) → themed glyph shelves, full palette coherence. |
| 5-agent cohort (agents-as-beings) | ✅ **Checkpoint ② PASS** | The hardest, riskiest checkpoint — it landed. |
| Seam-walk (7D.2) | ✅ now **observable** | Was invisible (solid perimeter); built the walkable seam edge → agents cross panes on screen. |
| Scale ladder (7A island/continent) | 🟡 broad-approved | Serves/compiles + transform-fix confirmed; not individually eyeballed. |
| Multi-pane split (7B) | 🟡 broad-approved | Split works; not stress-tested. |
| Desktop surfaces (V2) | ⏳ pending | Lore recolor / local-AI landmark / macOS wallpaper / sleep — need Ollama + lore file + Steam + Harry's eyes. |

**Design checkpoints:** ① aesthetic **PASS** · ② agents-as-beings **PASS** ·
③ wallpaper-all-day **PENDING (V2)** · ④ lore-feels-personal **PENDING (V2)**.

## Built in-pass

- **Walkable seam edge** (`feat(cell)`): `layoutCell` carves a deterministic
  3-cell doorway in both side walls (`CellLayout.seamRows`), so a vertical pane
  split has a crossable seam. `smoke-7d2-walk` F1 updated (old solid-perimeter
  "zero exits" → "openings are exactly the crossable rows"). 59 assertions.
- **Glyph-only shelves** (`feat(render)`): on the first real on-screen pass the
  ~20 bookshelves dominated the frame as off-palette colour-NOISE — the
  auto-generated placeholder PNGs from `gen-placeholder-sprites.mts` rendered as
  rainbow static against the themed terminal scene, fighting the palette
  coherence the rest of the cell already had. The renderer already supported the
  intended fallback (`▓` shelf + bright spine letter, themed walls), so a new
  `CURATED_SLOTS` allow-list in `sprites.ts` (EMPTY today) gates *loading* to
  hand-curated survivors only — placeholders never load, the whole sprite
  pipeline stays wired for when a real Phase-3D bake lands (add the slot id,
  one survivor at a time). This is `CLAUDE.md`'s "glyphs-only MVP" made real on
  screen. Before/after A/B'd in the headless e2e harness; typecheck clean,
  `smoke-3a-sprites` 64 + `smoke-glyph-coverage` 19 still green (both test pure
  fns + the KNOWN_SLOTS↔generator cross-check, neither touched).

## Punch-list (prioritized)

1. **Finish V2 desktop verification** — the two remaining checkpoints (③, ④)
   live here, and lore is the product's most distinctive feature. Needs Harry:
   `ollama serve` + `qwen2.5:7b` + `nomic-embed-text`, a nautical/pastoral
   `.md`, Steam running.
2. **Steam release gate (Phase 6)** — electron-builder packaging, Steam Direct,
   AI-content disclosure. Calendar-bound; nothing else ships without it.
3. *(optional)* **Wander-bias toward seam exits** in `behavior.ts` — agents
   cross only when they happen onto a doorway today, so the join reads as
   passive. One-function tweak; deferred (a behaviour change, not a fix).
4. **Reveal (#34) is superseded** — Phase 7A shipped real island/continent
   renderers, so its "fake the upper levels" premise is moot; rework against the
   real renderers (salvage `macro.ts` + the cinematic) or close.
5. Scale-ladder / multi-pane deserve a proper individual eyeball before relying
   on them.

## Parked design directions (captured, not built)

- **Per-scale perspective** — top-down interior, side-on exterior (PR #36).
- **Agent-initiated world-joining** — Composable-Panes Depth 3 sharpened with a
  bottom-up/agent-negotiated framing; the walkable seam edge is its on-screen
  step zero. Lead "expand" candidate.

## Recommendation: lean **ship v1.0**, after V2

The two hardest checkpoints — *does the aesthetic land* and *do the agents feel
like beings* — **passed**. That's the core product thesis de-risked; it's the
signal `PLAN.md` says to act on. The v2.x features (panes, seams, perspective,
agent-joining) are genuinely good but the build already overshot v1.0 scope
*before validating with a single real user*. So: **finish V2** (confirm ③ + ④,
especially lore — the distinctive lever); if they pass, **pivot to the Phase 6
Steam release gate scoped to `CONSOLIDATION.md`'s v1.0 MVP** (single terminal,
one district, one agent, lore, Loki events) and **hold the v2.x surface as the
post-launch expansion** — exactly the sequence `CONSOLIDATION.md` already drew.
Ship to learn whether the aesthetic + agent-as-being magic lands with people,
*then* expand into the panes/seams/joining vision.
