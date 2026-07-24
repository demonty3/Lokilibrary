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

Last updated: **2026-07-24** (branch prune: 45 remote branches → 2. 27 were
merged into `main`; 13 more had landed via rebase/squash so git's ancestry
check couldn't see them — verified by content, not by merge status — and
their commits are mirrored to local `refs/archive/` refs. PR #28 closed as
superseded. `claude/reveal-flythrough` is the only unmerged work left and
now has an Active item below.) Previously **2026-07-17** (evening: Harry ran the snapping-terminals
human beats + the lore-ingest leg — both PASSED, moved to Done. Earlier
same day: platform direction change: **Mac-only** — the Windows/WSL
target is retired, so every "verify on Windows" item below was either
already re-verified on macOS during the 2026-06 consolidation pass (now
in Done) or re-worded for macOS. The Win32 code paths stay in-tree as
dormant OSS-contributor surface; we don't build, test, or gate on them.)

---

## Active

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

### ⏳ Decide `claude/reveal-flythrough` (PR #34) — rebase or retire
**Status**: the last unmerged work in the repo, and the only work that
exists *solely* on a branch. Sole survivor of the 2026-07-24 branch prune
(45 remote branches → 2). One commit, `48cc0a1` (2026-06-02), 779 lines,
no new dependencies: a first-run cinematic reveal — the cell builds itself
from the player's top games, then the camera pulls back through all six
scale levels (Powers-of-Ten style) and holds on a "your library as a solar
system" poster. Skippable by key/click, honors `prefers-reduced-motion`,
auto-plays once (localStorage-gated), `R` to replay, wallpaper mode never
auto-plays. Interactive level renderers untouched.
**Why it's stuck**: branched 195 commits behind current `main` and adds
files `main` has never had (`src/procedural/macro.ts`,
`src/render/reveal/{index,ease,covers}.ts`), while its touchpoints —
`PixiApp.ts`, `state/store.ts`, `App.tsx` — have all moved under the
migration slices. This is a rebase, not a fast-forward, and it only gets
harder.
**Unblocks**: nothing — which is precisely the risk. Nothing gates on it,
so it rots quietly. Decide one of: (a) rebase onto `main` and merge #34,
or (b) close #34 and delete the branch — but first mirror it to a local
archive ref (`git update-ref refs/archive/claude/reveal-flythrough
48cc0a1`), the way the 13 pruned branches were preserved, because deleting
it on GitHub makes the commit unreachable everywhere else.
**Not related** to the Mac-only direction change — that was
`claude/mac-only-docs` (2026-07-17), long since merged. This branch is
purely a visual/UX feature.

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

- ✅ **Snapping-terminals human beats — VERIFIED by Harry 2026-07-17**:
  real-mouse glyph-strip drag + snap works, the 0.6s knit sweep was SEEN
  on a fresh join, tray "New terminal (dN)" spawns and the label disables
  at 6 terminals. (Re-enable-on-close not explicitly exercised — the
  wing-accounting path is harness-verified, low risk.) Closes the
  snapping-terminals verification column.
- ✅ **Lore ingest — VERIFIED by Harry 2026-07-17**: Ctrl+U → dropped
  `lore-samples/nautical.md` in the desktop app → world remounted in
  tokyo-night. 5D.4 is now signed off end-to-end; lore is
  shipped-and-seen. (Egress checkbox defaults remain smoke-covered.)
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
