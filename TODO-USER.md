---
up: "[[Lokilibrary]]"
---

# TODO — things only you can do

Accreting list of items blocked on user action. When I (Claude)
identify something the user has to do — provide a key, verify
something visually, decide a strategic question — it lands here so it
doesn't get buried in chat messages that scroll out of context.

**Format**: each item has a status tag, a one-line summary, what
unblocks me, and a pointer to where the blocked work lives. Mark
items DONE / SKIP and I'll prune them on the next slice.

Last updated: **2026-07-17** (platform direction change: **Mac-only** —
the Windows/WSL target is retired, so every "verify on Windows" item
below was either already re-verified on macOS during the 2026-06
consolidation pass (now in Done) or re-worded for macOS. The Win32 code
paths stay in-tree as dormant OSS-contributor surface; we don't build,
test, or gate on them.)

---

## Active

### 👁 Snapping-terminals human beats — tray click + glyph-strip drag (2026-07-16)
**Status**: Tier 3 landed (desk persistence + tray; STATE.md top entry). The
spawn path, wing accounting, and persistence are harness-verified; three beats
need a human hand: (1) click the tray "New terminal (dN)" item — label should
disable at 6 terminals and re-enable with the freed wing after closing a
window; (2) drag a terminal by its in-world `┤ wing ├` glyph strip with a real
mouse; (3) eyeball the 0.6s knit sweep on a fresh join.
**Unblocks**: closing the snapping-terminals verification column; nothing
code-side is waiting.
**Where**: `cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_RENDERER_URL=http://localhost:5183 ./node_modules/.bin/electron .` (vite serving 5183).
Add `LOKILIBRARY_TERMINALS_RESET=1` for a fresh unsnapped desk (best for the
knit-sweep test — a persisted desk restores already-joined).

### ⏳ Lore ingest — the one desktop leg still unseen (was S1 of the 5D.4 check)
**Status**: everything around it is proven — the lore→theme derivation is
headless-confirmed (`npx tsx scripts/lore-preview.mts lore-samples/*.md`:
`pastoral.md → gruvbox-dark`, `nautical.md → tokyo-night`), the on-screen PIXI
repaint is proven via the e2e harness, and the desktop SQLite writer is proven
live (the T1 society work verified real rows in the desktop DB). The ONE
untested join is the ingest path itself: a real file drop persisting through
`ingestLore → recordLore` so `themeFromLore` reads a non-empty corpus.
**What**: launch the desktop app (window mode), press **Ctrl+U**, drop
`lore-samples/nautical.md`. After the chunk-count status, the whole world
should tear down and remount in **tokyo-night**. Also confirm the two egress
checkboxes ("Theme & mood", "Quote directly") default UNCHECKED — the recolor
must happen with both OFF. If the palette never changes, check the console for
`[memory/bootstrap] db ready` (a null-writer fallback silently no-ops ingest).
NOTE: on this Mac there's no Ollama, so embeddings 501 and chunks persist
FTS-only — that's the designed degradation, not a failure; the recolor is
embedding-free.
**Unblocks**: signs off 5D.4 end-to-end; lore is then shipped-and-seen.

### ⏳ Sleep mode on macOS — 11 idle minutes (was "verify 5B on Windows")
**Status**: the macOS idle-throttle ladder landed via `powerMonitor`
(desktop commit `7926a64`); the sleep→reflect→morning-banner chain has never
been watched end-to-end on this box.
**What**: desktop app in wallpaper mode, hands off keyboard/mouse for 11+
minutes. Logs should show `⟹ full→sleeping` (at 10 min) then
`[sleep-reflection] firing for N agent(s)`; on wake, a terminal-styled
morning banner with the overnight reflections, auto-dismissing after ~30s.
Needs `ANTHROPIC_API_KEY` in `worker/.dev.vars` + `npm run worker` running.
**Unblocks**: nothing code-side; it's the last unwatched Phase-5 surface.

### ⏳ Bake real PixelLab sprites (Phase 3 follow-up, deferred)
**Status**: open since slice 3C. Needs `PIXELLAB_API_KEY` in
`worker/.dev.vars` + `cd <repo>; npx tsx scripts/bake-sprites.mts
--slot=bookshelf --theme=solarized-dark --n=5`. Eyeball the 5
staging PNGs, pick the survivor, copy to
`public/sprites/solarized-dark/bookshelf.png`.
**Unblocks**: Phase 3 aesthetic gate ("do sprites add value over
glyphs?"). Until verified, slice 3D (local SDXL) is parked.

### 🔔 OPTIONAL — agent-mind frontier re-run (post-Aug-1)
**Status**: the agent-mind taste gate RAN (local models on harryspc; voices
landed per Harry, 2026-07). An optional re-run against frontier Claude
models is on record for after Aug 1 if you want to hear the registers at
full quality: `npm run worker` + `npx tsx scripts/agent-mind-livefire.mts`
(~10 paid calls, pennies) with `ANTHROPIC_API_KEY` in `worker/.dev.vars`.
**Note for later** (final-review RIDE item): `scripts/*.mts` aren't covered
by `npm run typecheck` — pre-existing gap, worth its own slice someday.

---

## Periodic checks worth doing

These don't block any specific slice but earn their place in the
session if convenient:

- **Telemetry overlay (Ctrl+\`)** after each meaningful session.
  Confirms the cost trajectory against the ≤$1/user/month sanity bar
  (a dial now, not a constraint — see CLAUDE.md).
- **`RETROS/phase-2.md`** has two `___` open items (aesthetic
  question + cost envelope). The agent-mind pass gives evidence for the
  aesthetic question; the telemetry overlay answers the cost envelope.
  Once both have evidence, fill in.

---

## Done / skipped (kept for posterity until next slice prunes)

- ✅ **Windows verification column — RETIRED 2026-07-17** (Mac-only
  direction). Everything it gated was re-verified on macOS during the
  2026-06 consolidation + later arcs, or re-worded above:
  - **7-B multi-pane visual QA** — verified on macOS via the e2e harness
    (multi-pane renders, masks clip, single-pane byte-identical).
  - **7-D seam-graph draw + 7-D.2 live seam walk** — VERIFIED ON SCREEN
    macOS 2026-06-04: walkable seam edge carved, roster crossing both
    directions with BFS pathing (STATE.md has the record).
  - **5D.4 / 7-A visual pass** — lore repaint proven via e2e; ladder rungs
    eyeballed during the salience campaign (which found + fixed the ladder
    label double-draw on screen). The ladder identity slice reworks those
    surfaces next anyway. Residual: the lore-ingest leg, kept Active above.
  - **6A local-AI landmark** — PARKED: needs a local Ollama, which this Mac
    can't host. The absence is graceful (`{present:false}` → no landmark).
    Dormant contributor surface; revisit only if a local-inference box
    re-enters the picture.
  - **5A reflection verify** — superseded by the agent-mind livefire (real
    tick + reflection outputs judged against the register anchors).
  - **nomic-embed-text install** — retired on this box (no Ollama); lore
    retrieval degrades to FTS/recency by design.
- ✅ **phase3-pixelart → main merge decision** — resolved: the branch is
  merged to main with history preserved (v1.0.0 shipped from main).
- ✅ **Repo is PUBLIC** (2026-07-11): MIT licence, full-history secrets scan
  clean, https://github.com/demonty3/Lokilibrary. (Optional polish:
  GitHub About description + topics for discoverability.)
- ✅ **Sample lore files** — `lore-samples/{pastoral,nautical}.md` +
  README + `scripts/lore-preview.mts` predictor (2026-06 consolidation).
- ✅ `better-sqlite3` install + electron-rebuild (2026-05-28, Windows-era;
  kept for OSS contributors hitting the same wall: needs VS 2022 Build
  Tools, then `npm install better-sqlite3 --save --ignore-scripts &&
  npm run rebuild`).
- ✅ Phase 4A/4B/4C wallpaper verification (2026-05, Windows-era raised
  desktop, 2560×1440).
