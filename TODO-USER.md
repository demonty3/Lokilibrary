# TODO — things only you can do

Accreting list of items blocked on user action. When I (Claude)
identify something the user has to do — provide a key, run a build
script on Windows-native, verify something visually, decide a
strategic question — it lands here so it doesn't get buried in
chat messages that scroll out of context.

**Format**: each item has a status tag, a one-line summary, what
unblocks me, and a pointer to where the blocked work lives. Mark
items DONE / SKIP and I'll prune them on the next slice.

Last updated: **2026-05-30** (static visual-correctness audit of 5D.4 /
6A / 7-A surfaces — see "Visual verification" below).

---

## Active

### ⏳ Visual verification (5D.4 / 6A / 7-A) — first real render of these surfaces
**Status**: pending. These three surfaces shipped but were NEVER rendered
(WSL can't run the Electron/PIXI app). A static audit (read the render code,
verified every emitted glyph against the actual `CozetteVector.woff2`
codepoint set, reasoned about transforms/teardown) found **one must-fix
transform bug, now fixed in this branch** (the scale-map YOU marker + the
continent labels were positioned in global space while parented under the
already-scaled+offset container — double transform flung them off-screen;
fixed in `src/render/levels/{district,island,continent}.ts`). Glyph
coverage is CLEAN — every box-drawing / shade / scatter / landmark glyph
the renderers emit is present in the font, so no tofu (blank □) risk from
the static vocabulary. This is now CI-guarded:
`npx tsx scripts/smoke-glyph-coverage.mts` enumerates every emitted glyph
(tile bible, scatter bible, landmark, activity ramp, renderer-literal
frames) against the exact `CozetteVector.woff2` cmap snapshot
(`scripts/lib/cozette-coverage.json`, regenerable from the real woff2 via
`scripts/gen-cozette-coverage.py` if the font is ever re-baked) — it FAILS
if any renderer adds an off-atlas glyph. What still needs a human eyeball:

**Launch (do this first):**
1. Pull this branch on Windows. `npm run dev` (repo root) + `npm run worker`
   (separate terminal) + `cd desktop; npm run dev` (Windows-native Node).
2. App opens at the `cell` level. Keep it in WINDOW mode for these checks
   (wallpaper mode gates keyboard input, and `[`/`]` zoom + WASD + Ctrl+U
   all need keydown).

**S1 — Lore palette recolor (5D.4). DESKTOP-ONLY** (web build has the null
writer → `loreCount()===0` → always the default theme + the drop-zone
refuses ingest with "needs the desktop app"):
- Note the boot palette: it should be **Solarized dark** (`DEFAULT_THEME_ID`)
  on a fresh corpus.
- Press **Ctrl+U** → the lore drop-zone appears. Drop a `.md`/`.txt` whose
  vocabulary leans on a known theme — e.g. lots of "harbour / tide / ship /
  lighthouse" (nautical → `tokyo-night`, blue) or "meadow / farm / harvest /
  orchard / field" (pastoral → `gruvbox-dark`, gold-brown). 2-10 KB,
  consistent vocab. (Avoid tone words like "dread"/"cottage" for a first
  test — a tone cue prepends its own palette and muddies the expected
  result; `themeFromLore` ranks tone-palette before theme-palette.)
- Expected: after the ingest finishes (status shows chunk/embed counts),
  the **whole world tears down and remounts in the new palette** — the
  background colour + every glyph tint shifts. One brief black flash during
  the remount is normal (new PIXI Application + font/atlas re-await), but
  there must be exactly ONE canvas afterward (not two stacked).
- Broken looks like: palette never changes after a clearly-nautical/pastoral
  drop (recolor not observable) → check the desktop console for
  `[memory/bootstrap] db ready`; if the writer fell back to null, ingest
  silently no-ops and there's nothing for `themeFromLore` to read.
- Also confirm: the **two egress checkboxes** ("Theme & mood", "Quote
  directly") in the drop-zone both default UNCHECKED. The recolor must
  happen with both OFF (palette recolor is local, never gated on egress).

**S2 — Local-AI landmark (6A). Needs `LLM_PROVIDER=local` + Ollama running
with ≥1 model installed** (`ollama pull qwen2.5:7b`; `ollama serve`):
- At the `cell` level, look for ONE **cyan** landmark glyph among the
  floor: a `⌂` (cottage, for a <30B model) or `║` (tower, for a 30B+ /
  ≥18 GiB model). It must sit on a floor cell, NOT permanently overlapping a
  bookshelf, the player `@`, or a scatter decoration (plant ♠ / chair ∩ /
  books ≡ / lamp ☼) — those are all kept out of its placement. NOTE: the
  placement keepout covers Loki's spawn + every scatter cell but NOT the
  other 4 cohort agents (archivist / cat / visitor / ghost). So at BOOT one
  of those agents can momentarily share the landmark's cell and draw over the
  glyph (agents are above it in z-order); they wander off within a tick and
  the glyph re-appears. A landmark that's covered for one frame at boot then
  visible is EXPECTED, not broken — only a permanently-hidden landmark is a
  bug.
- If a model is actively LOADED (`ollama ps` shows it), the landmark should
  **gently pulse** (alpha 0.55↔1.0 on a ~1.4s cycle). If only installed but
  not loaded, it's a steady, non-pulsing glyph.
- Walk the `@` adjacent to the landmark and press **E**: a **cyan** status
  line appears one row above it, e.g. `Qwen 2.5 7B · running · localhost`.
  Press E again to toggle off; walk away and it auto-despawns.
- Broken looks like: the landmark glyph renders as a blank/□ box (would mean
  a font gap — but the audit confirmed `⌂` U+2302 and `║` U+2551 are both
  in the font, so this should NOT happen; if it does, report it). Or: the
  status line spills far past the right room wall — the status string (~33
  chars) is WIDER than the 24-cell room, so on a narrow window it can clip
  at the canvas edge. Cosmetic; note it if it bothers you (a future slice
  could wrap/clamp the panel).
- Also confirm pressing E next to a BOOKSHELF still launches the game
  (bookshelf-launch wins over the landmark status when adjacent to both).

**S3 — Scale maps (7-A): district / island / continent.** Press **`[`** to
zoom out from `cell` → `district` → `island` → `continent` → `planet` →
`solar_system`; **`]`** zooms back in. For each REAL map rung:
- **district**: a 3×3 of bordered cards (`┌─┐│└┘`), the CENTRE card is YOU
  (bright tint + a **YOU** label just inside its top border). Each card
  shows a game name, an `N games` count, and an activity fill using the
  shade ramp `▓ ▒ ░ ·`. Empty neighbour slots render as dotted `·` terrain.
- **island**: bordered neighbourhood cards laid out in a square-ish grid;
  the home district's card carries the **YOU** marker.
- **continent**: filled land-mass blobs (`▓`/`▒`/`░`) on a `·` dot sea,
  each with a small label (`Name 12g/4i` = name · games · islands) near its
  centroid; the home continent's label is the bright tint, others dim. NOTE:
  continent has NO separate "YOU" marker glyph — the only "you are here"
  signal at this rung is the **brighter home label**. At a 1-continent
  library (anything up to ~3 continents-worth of games → usually just 1) there
  is no second continent to contrast against, so "home" reads only as "the
  single bright label". Working as designed; flag only if it feels ambiguous.
- **THE KEY THING TO CONFIRM (two bugs fixed in this branch)**:
  1. **YOU-marker double-transform (district + island)** — the **YOU** marker
     must land ON the home card (just inside its top-left border), NOT floating
     off in a corner / off-screen. It was previously positioned in global space
     while parented under the already-scaled+offset container (double
     transform). Verify correct placement at every integer zoom scale, and
     **resize the window** — it must re-place correctly on resize.
  2. **Continent-label right-edge overflow (continent)** — each land-mass label
     must sit centered on/over its blob, fully inside the map panel. Previously
     the label was left-anchored at the blob's centroid column and ran 3–4
     glyph-columns (~18–24px pre-scale, ×4–8 after the integer fit-scale =
     ~100–190px on a 1080p screen) PAST the map's right edge — on a
     single-continent library (the common case) the label spilled onto the
     bare background to the right of the blob, and on a narrow window could
     clip at the screen edge. Now center-anchored on the centroid and clamped
     into the panel width. Verify: at n=1 / your real top-N, the lone
     continent's label sits OVER its blob, not trailing off to the right;
     at a 2-continent library (needs a large library) BOTH labels stay over
     their respective blobs with neither running off the right side.
- Check the four library sizes if you can (anonymous demo = 7-game
  SAMPLE_LIBRARY → 3 districts / 2 islands / 1 continent; signed-in = your
  real top-N — 15 games → 4 districts, 100+ → the 8-district / 4-island /
  2-continent caps). The cards/blobs must stay inside the panel with no two
  cards overwriting each other and no glyph overflow past the panel frame.
  (Static sim confirmed: card grids collision-free + in-bounds, blobs
  in-bounds + non-overlapping, at sizes 0/1/5/15/100 — but eyeball it.)
  `planet`/`solar_system` stay "not yet built" stub panels carrying a
  `N games · M continents` aggregate line.
- **island home-district picking**: the island rung shows the LARGEST
  continent's districts; the home/YOU card is that continent's first district
  (canonical d-id order), NOT necessarily your most-played game's district if
  that game landed in a smaller continent. So the **YOU** card on the island
  rung may not be the same game you'd expect from the cell rung. Working as
  designed (no persistent player-district state yet); note if confusing.
- Broken looks like: any blank/□ box where a frame/shade glyph should be
  (font gap — audit says NONE expected; all of `┌─┐│└┘ ▓▒░· …` + the double
  frame `╔═╗║╚╝` for the empty-library panel are confirmed in the woff2);
  two cards colliding; the YOU marker or a continent label off the panel.
- **Empty / anonymous-edge**: sign OUT (or run before sign-in). With 0 games
  the district/island/continent rungs show a single double-bordered
  `no library loaded yet.` panel (dim tint), NOT a crash or an empty black
  screen. With the 7-game sample (signed out but sample loaded) you get the
  full 3-card-ish maps above.

**Regression guard (optional, run after ANY future renderer change):**
`npx tsx scripts/smoke-glyph-coverage.mts` should print
`[smoke glyph-coverage] 19 assertions passed`. It enumerates every literal
glyph emitted by the tile bible, scatter bible, landmark, activity ramp, the
scale-map card/blob/footer frames, AND the morning-dispatch banner (`──`
rule + `↳` plan arrow) against the exact `CozetteVector.woff2` cmap. If it
prints `TOFU RISK: U+XXXX … is NOT in the font`, a renderer added an
off-atlas glyph that would render as a blank □ box — pick a covered
substitute from the same box/shade vocabulary. Regenerate the cmap snapshot
with `python3 scripts/gen-cozette-coverage.py` only if the font in
`public/fonts/` is ever re-baked.

**Unblocks**: signs off the 5D.4 / 6A / 7-A visual surfaces so the lore +
local-model + scale-ladder work can be considered shipped-and-seen, not
just shipped-and-typechecked.

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
