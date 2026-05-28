# TODO — things only you can do

Accreting list of items blocked on user action. When I (Claude)
identify something the user has to do — provide a key, run a build
script on Windows-native, verify something visually, decide a
strategic question — it lands here so it doesn't get buried in
chat messages that scroll out of context.

**Format**: each item has a status tag, a one-line summary, what
unblocks me, and a pointer to where the blocked work lives. Mark
items DONE / SKIP and I'll prune them on the next slice.

Last updated: **2026-05-28** (slice 5H housekeeping).

---

## Active

### ⏳ Verify 5B sleep mode on Windows
**Status**: pending, fresh out of slice 5B (on branch
`claude/phase5b-sleep-mode`).
**What**: pull on Windows, restart `npm run dev` in `desktop/` +
`npm run worker` in repo root. Toggle to wallpaper mode. **Don't
touch the keyboard or mouse for 11+ minutes**. PowerShell logs
should show:
- `[throttle] ... idle=Ns state=sleeping ⟹ full→sleeping` (at 10 min)
- `[sleep-reflection] firing for N agent(s)` (~5s after sleep entry)
- Per-agent `[sleep-reflection] <name> reflected (M plan steps)` lines
- Move mouse to wake → `[throttle] state=full` transition + a
  terminal-styled banner appears at top of the cell with the
  overnight reflections + auto-dismisses after 30s

**Unblocks**: Phase 5C (lore upload) — the sleep cadence has to feel
right before lore-driven reflections compound.

### ⏳ Verify 5A reflection completion on Windows
**Status**: pending, fresh out of slice 5A (commit `6d9c952`).
**What**: pull on Windows, restart `npm run dev` in `desktop/` +
`npm run worker` in repo root. Wallpaper mode for ~15 min. Observe:
- `[router] tier2 loki ... dispatched, plan_steps=N` in PowerShell
- Loki visibly walks to specific cells (not just wander)
- `sqlite3 "$env:APPDATA\lokilibrary-desktop\memory.sqlite" "SELECT
  json_extract(payload_json, '$.text'), json_extract(payload_json,
  '$.steps') FROM memories WHERE kind='plan' ORDER BY created_at
  DESC LIMIT 5"` returns recent plan rows.

**Unblocks**: phase 2 retro aesthetic question + sleep mode (5B)
design refinement.

### ⏳ Decide phase3-pixelart → main PR merge
**Status**: PR opened in slice 5H. Branch carries 4A+4B+4C+5R+5A+5H —
much more than the original 3C scope, but everything is verified or
ready to verify. You can:
- (a) Squash-merge the whole branch to main (cleanest history; one
  commit per phase loses but the per-slice commits are recoverable
  via the PR's commit list)
- (b) Merge with full commit history preserved (longer log but slice
  boundaries stay visible)
- (c) Leave open until 5A user-verification lands, then merge

**Unblocks**: future slices land on short-lived branches per the 5R
PR-cadence note.

### ⏳ Sample lore file for slice 5C testing
**Status**: not yet started, but 5C needs a real `.md` lore file
(your D&D campaign, fanfic, worldbuilding doc) for end-to-end
verification. Anything 2-10 KB of text with consistent vocabulary +
character/place names works.

**Unblocks**: 5C "drop a real file, watch Loki reference it" verify
step.

### ⏳ Bake real PixelLab sprites (Phase 3 follow-up, deferred)
**Status**: open since slice 3C. Needs `PIXELLAB_API_KEY` in
`worker/.dev.vars` + `cd <repo>; npx tsx scripts/bake-sprites.mts
--slot=bookshelf --theme=solarized-dark --n=5`. Eyeball the 5
staging PNGs, pick the survivor, copy to
`public/sprites/solarized-dark/bookshelf.png`.

**Unblocks**: Phase 3 aesthetic gate ("do sprites add value over
glyphs?"). Until verified, slice 3D (local SDXL) is parked.

### ⏳ Install `nomic-embed-text` model via Ollama (for slice 5C)
**Status**: prereq for slice 5C (lore upload). Run `ollama pull
nomic-embed-text` on the machine that runs Wrangler (Windows or
WSL, wherever `npm run worker` lives). One-time, ~270 MB.

**Unblocks**: slice 5C lore upload + retrieval. Until done, lore
won't embed.

---

## Periodic checks worth doing

These don't block any specific slice but earn their place in the
session if convenient:

- **Telemetry overlay (Ctrl+\`)** after each meaningful session.
  Confirms cost trajectory ≤$1/user/month per CLAUDE.md target.
  Particularly relevant after 5A (rate-limit) and 5B (sleep mode).
- **`RETROS/phase-2.md`** has two `___` open items (aesthetic
  question + cost envelope). 5A's "agents execute plans" gives
  evidence to answer the aesthetic question; the telemetry overlay
  answers the cost envelope. Once both have evidence, fill in.

---

## Done / skipped (kept for posterity until next slice prunes)

- ✅ `better-sqlite3` install + electron-rebuild (resolved 2026-05-28
  in slice 4A debugging — needed VS 2022 Build Tools install on
  Windows; `npm install better-sqlite3 --save --ignore-scripts &&
  npm run rebuild` worked once VS was present).
- ✅ Close draft PR #29 — closed in slice 5R (cherry-picked the
  content into our branch with authorship preserved).
- ✅ Phase 4A/4B/4C verification on Windows — all three transitions
  fired correctly on Win11 raised-desktop 2560×1440 (4A); peek
  toggles work cleanly (4C); multi-monitor pending second display
  (4B partial).
