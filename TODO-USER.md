---
up: "[[Lokilibrary]]"
---

# TODO — things only you can do

Accreting list of items blocked on user action. When I (Claude)
identify something the user has to do — provide a key, run a build
script on Windows-native, verify something visually, decide a
strategic question — it lands here so it doesn't get buried in
chat messages that scroll out of context.

**Format**: each item has a status tag, a one-line summary, what
unblocks me, and a pointer to where the blocked work lives. Mark
items DONE / SKIP and I'll prune them on the next slice.

Last updated: **2026-07-11** (direction change: free, public open source —
no Steam distribution, no monetization. New decide-item below: OSS licence
+ flipping the repo public. The prior note below still describes the open
verification work.)

Prior update: **2026-05-31** (Phase 7-D.2 LIVE SEAM WALK: single roaming roster
— the seam-walk MECHANISM (runtime migrates + sprite follows) is smoke-locked
(`smoke-7d2-walk.mts`, 58 — now incl. roster-aware-remount C1/C2 + floor-gated
exits F1/F2). GEOMETRY CAVEAT: today's cell layout has a solid-wall E/W edge, so
a `|`-split shows roster-once (all agents on the LEFT, none on the right) but NO
live left↔right crossing yet — that is the wall, NOT broken wiring (a walkable
seam edge is a deferred follow-up). The on-screen items to certify now are W-2
(single-pane unchanged) + W-3 (roster-once / no dup across a root zoom) — see
"Phase 7-D.2 live walk" below. Single-pane must look unchanged.).

---

## Active

### 🔔 DECIDE — OSS licence + flip the repo public (2026-07-11 direction change)
**Status**: pending decision. The project is now free, public open source
(no Steam distribution, no monetization — CLAUDE.md "Product direction" +
SPEC.md § 2.5). Two things only you can do:
1. **Pick the licence** — MIT / Apache-2.0 (permissive, maximum reach) vs
   GPL / AGPL (copyleft, forks must stay open). A `LICENSE` file must land
   before the repo flips public.
2. **Flip the repo public** on GitHub once the licence lands — after a
   final secrets sanity pass over history (`worker/.dev.vars` is
   gitignored, but confirm no key ever landed in a commit).
**Unblocks**: Phase 6 "public release" (redefined in PLAN.md). README +
demo capture can proceed without this; the flip itself is the release.

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
> **NOTE (2026-06, consolidation):** the lore→theme *derivation* is now
> headless-confirmed against the real shipped code via
> `npx tsx scripts/lore-preview.mts lore-samples/*.md`
> (`pastoral.md → gruvbox-dark`, `nautical.md → tokyo-night`). **The on-screen
> PIXI *repaint* is now ALSO proven** (2026-06): the e2e harness drives the
> EXACT recolor path (`window.__loki.setTheme(id)` → `loreVersion` bump →
> `mountPalace` with the new theme) and captured a clean full-palette repaint
> in solarized (default) → gruvbox (pastoral) → tokyo-night (nautical), one
> canvas, no artifacts. So the ONLY thing this desktop check still adds is the
> real ingest leg — the SQLite writer actually persisting a dropped `.md` so
> `themeFromLore(writer)` reads a non-empty corpus (the harness forces the
> theme; it doesn't exercise `ingestLore` → `recordLore`). If the recolor
> fails on desktop after the repaint is proven, suspect the WRITER (null
> fallback / db-not-ready), not the repaint. Ready-to-drop sample files +
> **macOS** run/verify steps live in `lore-samples/README.md`.
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

### ⏳ Phase 7-B multi-pane — visual QA (Windows + PIXI required)
**Status**: pending. The composable-panes store model + reducers are
smoke-covered HEADLESSLY (`npx tsx scripts/smoke-7b-panes.mts`, 64 assertions —
back-compat one-pane reduction + every reducer + rect tiling math; both
typecheck legs pass). But the multi-pane CONTAINER/MASK/SEAM-GLYPH output is
VISUAL and unverifiable from WSL (no Electron/PIXI). The single-pane DEFAULT
must be pixel-identical to today; everything below needs a human eyeball on a
real Windows window-mode session. **The single-pane regression check (B0) is the
load-bearing one — do it first.**

**Launch**: pull this branch on Windows. `npm run dev` (repo root) +
`npm run worker` + `cd desktop; npm run dev` (Windows-native Node). Keep WINDOW
mode for these checks (the new keybinds are wallpaper-gated; `\`/`Tab`/`[`/`]`/
WASD all need keydown).

**B0 — single-pane back-compat (MUST NOT REGRESS).** On boot the app opens at
`cell` with EXACTLY ONE pane covering the whole screen. It must look
pixel-identical to the pre-7-B build: the room centred + integer-scaled, the
`@` player, the cohort, scatter, bookshelf prompts, the local-model landmark —
all exactly as before. WASD/arrows move the player; `E` launches/opens the
status panel; `[`/`]` zoom through the scale ladder. **There must be NO seam
glyphs and NO visible clip border** (the full-grid pane skips the mask). One
canvas only. If anything here differs from the old build, STOP — the back-compat
anchor regressed.

**B1 — split into the study arrangement.** Press `\`. The view splits into TWO
abutting panes: the cell room (left, focused) + the district map (right). A
box-drawing seam (`│` with `┬`/`┴` junctions) draws on the shared border. Each
pane's content is CLIPPED to its half (nothing bleeds across the seam). Press
`\` again → back to the single full-grid cell pane (no seam, no border).
- **CLIP-MASK regression check (was a must-fix):** the LEFT cell pane keeps the
  `root` id across `\` (its level is unchanged cell→cell), so the renderer takes
  the cheap rect-only reconcile branch and does NOT remount it. The fix
  (`reconcileMask` in `refitAll`) must CREATE the clip mask for that now-half-
  width pane even though it was mounted maskless as a full-grid single pane.
  Verify the cell room is genuinely clipped to its left half — draw your eye to
  the seam: NO room content (sprites, glow, proximity-prompt text, agent
  marginalia) may spill into the right/district half. Then `\` back to single
  and confirm the cell room re-fills the whole window with NO leftover clip
  border (the mask is detached + destroyed on the partial→full return). If room
  content bleeds past the seam on the FIRST `\`, the mask-reconcile fix
  regressed.

**B2 — focus switching (`Tab`).** In the study arrangement, `Tab` cycles the
focused pane (cell → district → cell …). Confirm:
- `[`/`]` zoom only the FOCUSED pane (zoom the cell pane, the district pane is
  unchanged; `Tab` to the district pane, `[`/`]` now changes IT).
- WASD/arrows/`E` drive the player ONLY when a cell pane is focused. Focus the
  district pane → WASD does nothing (district has no movement). Focus back →
  movement resumes (no player jump — the guard just re-enables).
- NOTE: the shared-`playerPosition` quirk is GONE — per-pane player + cohort
  state landed (the per-pane runtime unblock). The two-cell QA below (B5) is the
  visual check for it. (The study arrangement is cell+district, so B2 only has
  one cell pane; B5 covers two cell panes.)

**B3 — resize.** Resize the window. Both panes re-fit to the new split (the seam
tracks the grid boundary, masks redraw, no content escapes its pane, no double
canvas). On a HiDPI monitor confirm the clip rect aligns to the pane border
(the Graphics mask is in stage/local coords under `autoDensity` — the one thing
only verifiable here).

**B4 — wallpaper mode read-only.** Toggle to wallpaper mode. The current
arrangement shows read-only; `\` / `Tab` no-op (composition is window-mode
only). The throttle ladder still freezes/animates all panes uniformly (shared
ticker — per-pane throttling is deferred).

**B5 — TWO CELL PANES, independent player + cohort (per-pane runtime unblock).**
This is the visual check for the per-pane `playerPos` + `agentRuntime` +
`perception` scoping (smoke-locked headlessly by `smoke-pane-runtime.mts`, 19
assertions; both typecheck legs pass — but the two-`@` on-screen behaviour is
PIXI-only). From the SINGLE-pane default (boot), focus the cell pane and press
`|` (shifted backslash, the "split" key) → the cell pane splits into TWO cell
panes side by side, each rendering the same library room (same seed) with its
OWN `@` + its OWN 5-agent cohort. Confirm:
- **Two independent `@`s.** WASD/arrows move ONLY the focused pane's `@`; the
  other pane's `@` stays put (the shared-singleton drag from 7-B is GONE). `Tab`
  to the other pane → WASD now moves ITS `@`, the first is now frozen.
- **Two independent cohorts.** Each pane's 5 agents wander/idle on their own;
  walking your `@` near a shelf or agent in ONE pane drives THAT pane's
  perception/prompt only — the other pane's agents don't react to it.
- **Bookshelf `E` is pane-local.** Focus one pane, walk adjacent to a known-game
  shelf, press `E` → the launch + Loki marginalia fire for THAT pane; the other
  pane is unaffected. (Both panes share the same seed, so the persistent magenta
  mark from a launch shows in BOTH on next mount — that is CORRECT: persistent
  memory is cell-keyed by seed and shared by design; only the live volatile
  state is per-pane.)
- **Single-pane default still identical.** Before any `|`, the boot single 'root'
  cell pane behaves exactly as today (one `@`, one cohort, WASD/E unchanged) —
  the `|` key is a no-op until pressed.
- **Broken looks like**: moving in one pane drags the OTHER pane's `@` (scoping
  didn't take — the unblock regressed); a split cell pane shows no `@` or no
  agents (scope/pos not captured at mount); the single 'root' pane behaving
  differently after pressing `|` then closing back to one pane.

**Broken looks like**: a blank pane after a split (mask geometry wrong); content
spilling across the seam (mask not applied / wrong rect); the WHOLE app blank
after `\` then `\` back (reconcile destroyed the wrong Container); `[`/`]` doing
nothing in single-pane (the scale-mirror back-compat broke — the headless smoke
A4 should have caught this, so this would be a render-only regression); two
stacked canvases (Application destroyed/recreated on a pane change — it must
NOT be).

**Unblocks**: certifies the visual half of Phase 7-B (the store/reducer half is
smoke-locked) so composable-panes Depth-1 (drag) can build on a verified layout
primitive.

### ⏳ Phase 7-D Depth-2 foundation — seam-graph draw no-divergence (Windows + PIXI)
**Status**: pending. Phase 7-D landed the pure, headless Depth-2 foundation —
the seam GRAPH + coordinate bridge (`src/state/seams.ts`), cross-seam perception
enricher (`src/agents/crossSeam.ts`), paneId registry (`src/state/paneRegistry.ts`),
and the `migrateRuntime` crossing primitive — all smoke-locked
(`npx tsx scripts/smoke-7d-seams.mts`, 69 assertions; typecheck clean both legs;
all 26 prior smokes green). The ONE thing that needs a human eyeball is the
`drawSeams` refactor: I rewrote it to derive seam strokes from the pure
`buildSeams()` graph instead of the old implicit per-pane right/bottom-edge loop
(so the data model and the strokes can't diverge). The projected PAINTED-PIXEL
set is proven byte-identical to the old loop HEADLESSLY (smoke D1, across clean
AND asymmetric tilings). NOTE: the seam graph splits a shared edge into collinear
SEGMENTS, so on an asymmetric tiling the stroke SETS differ from the old loop
(one full-span line → two abutting segments) while the PAINTED PIXELS are
identical — the pixel-coverage check is the real lock, and D1 asserts it. The
actual PIXI render is WSL-unseeable. **This sits ON TOP of the still-unverified
7-B multi-pane visuals — do the 7-B pass (above) first; this is a small delta on it.**

**D-1 — seams look IDENTICAL to before the refactor.** With the 7-B study /
split arrangements (press `\` then `|`), the box-drawing seams must look exactly
as they did pre-7-D: the same `│`/`─` runs on every internal pane border, the
same `┼`/`┬`/`┴`/`├`/`┤` junction glyphs at internal corners, same dim-foreground
tint, same 1px stroke. The refactor changes HOW the strokes are derived (graph,
not per-pane loop): on a clean tiling it DEDUPS a shared edge the old loop drew
twice (harmless opaque overdraw), and on an asymmetric tiling (a tall pane next
to two stacked half-height panes) it SPLITS the shared edge into two collinear
abutting segments instead of one full-span line. With the opaque `fgDim` stroke
both cases paint the identical pixels — visually identical. **Broken looks like**: a missing internal seam (the graph
dropped an edge), a seam drawn in the wrong place (projection mismatch), or a
1px gap between abutting panes at the seam (the float-floor math diverged — it
must NOT, seams.ts stays integer-grid and PixiApp does the SAME `computePixelRect`
floor). If a seam is missing or shifted vs the pre-7-D build, the graph→pixel
projection regressed.

**D-2 — single-pane still has NO seams.** From the boot single 'root' pane,
confirm there are STILL zero seam strokes and no clip border (the
`livePanes.size<=1` early-return + `buildSeams` returning `[]` for the lone
full-grid pane both fire — belt-and-suspenders). This is the byte-identical
no-seam anchor; if a seam line appears in single-pane, the early-return
regressed.

**Unblocks**: certifies the no-divergence draw refactor so the seam GRAPH is the
single abutment truth that the LIVE agent-crossing wiring (7-D.2) builds on. The
cross-seam perception + migrate primitive are pure/headless and need NO Windows
check (smoke-locked) — only the seam STROKE rendering does.

### ⏳ Phase 7-D.2 live walk — agent crosses a seam on screen (Windows + PIXI)
**Status**: pending. Phase 7-D.2 landed the LIVE seam-walk MECHANISM: an agent's
runtime migrates across a seam and its sprite follows (single roaming roster,
cross-intent, `migrateRuntime` consume, per-tick sprite-to-scope reconcile,
no-dup/leak/vanish/ping-pong guards) — fully smoke-locked
(`npx tsx scripts/smoke-7d2-walk.mts`, 58 assertions; typecheck clean both legs;
all 27 prior smokes green). **Do the 7-B + 7-D foundation passes (above) first;
this rides on a live split.**

> **GEOMETRY CAVEAT — read before you split (W-1).** A library cell's
> layout fills its WHOLE perimeter with solid wall (`boundaryAt`: the E/W edge
> columns are `│` wall, the N/S edge rows are `─` wall) with the ONLY opening a
> door on the SOUTH wall. Agents only step on FLOOR (`·`). So with TODAY's
> geometry an agent can never REACH an E/W (left↔right, `|`-split) edge cell —
> the edge is wall — and the floor-gated crossing wiring (must-fix) correctly
> offers ZERO crossable exits there. **You will NOT see a left↔right crossing
> yet, and that is NOT a bug** — it's the wall, not broken wiring. Making a seam
> edge cell walkable (a doorway in the shared wall, or an N/S split aligned to
> the south door) is a small DEFERRED follow-up. Until then, the on-screen
> things to certify are W-2 (single-pane unchanged) + W-3 (roster-once / no
> ghost copy), NOT a live crossing. The crossing MECHANISM itself is proven
> headlessly by the smoke (cross-intent emit → `migrateRuntime` A→B exactly
> once, no dup/leak/vanish/ping-pong); only its on-screen reveal waits on a
> walkable edge.

**W-1 (DEFERRED until a walkable seam edge exists) — the roster lives ONCE, and
an agent walks across.** From the boot single 'root' pane, split with `|`
(shifted backslash) into TWO cell panes. The 5 agents (Loki `L`, the archivist,
Cat, Visitor, Ghost-if-theme) all start in the LEFT (root) pane; the RIGHT (p2)
pane starts EMPTY of agents (it has its own `@` player + decor, but no cohort
sprites yet). **That much (roster-once: all agents on the left, none on the
right) you CAN verify now — it is the observable part of W-1.** The actual
walk-through is gated on the geometry caveat above: with the solid-wall E/W edge
no agent can reach the shared edge, so none will cross left↔right yet. When a
follow-up opens a walkable seam edge, the payoff to watch for is: an agent
wandering against the shared edge WALKS THROUGH the seam — its glyph leaves the
left pane and APPEARS in the right pane at the seam edge, then resumes wandering.
**Broken (once a walkable edge exists) looks like**: an agent that vanishes at
the edge and never reappears (vanish — migrate fired but the destination cohort
didn't reconcile a sprite); an agent that shows in BOTH panes at once (dup — the
single-delete-then-set or the sprite reconcile broke); an agent that flickers
back and forth across the seam every tick (ping-pong — the `justArrivedAt` guard
regressed). Until a walkable edge lands, "no agent crosses" is EXPECTED (wall),
not broken.

**W-2 — single-pane is UNCHANGED.** From the boot single 'root' pane (NO split),
confirm all 5 agents are present and wandering exactly as before — same spawn
spots, same wander, no flicker, no agent ever leaving. This is the load-bearing
safety constraint (the roster spawns once into root, sprites are created once
and never reconciled away, no seam ever opens). If single-pane looks different
from a pre-7-D.2 build, the roster-once gate or the sprite reconcile regressed.

**W-3 — no leak / no dup across a split (and across a root zoom).** The
load-bearing invariant: the total agent count across ALL panes stays 5 (4 if
Ghost is theme-filtered), NEVER 6+. Two checks once a walkable edge exists so
agents actually move between panes:
- **After a crossing**, the source pane must NOT keep a ghost copy (its sprite is
  destroyed once its runtime left that scope) — count glyphs, total stays 5.
- **After a root ZOOM with a split live (must-fix regression check)**: split with
  `|`, let (or drive) an agent into the right pane, then focus the LEFT (root)
  pane and zoom it out + back in (`]` then `[`). The remounted root must NOT
  re-spawn the agent that is living in the right pane — total agent count stays
  5, never 6. (The roster-aware root gate skips re-seeding any agent already live
  in a sibling pane; without it the zoom would clone that agent into root while
  the right pane still held it = a duplicate runtime + two sprites + doubled
  Tier-1 cost. Headlessly smoke-locked as C1/C2 in `smoke-7d2-walk.mts`.) Until a
  walkable edge exists you can't move an agent over to test this on-screen, but
  the roster-once split (all 5 on the left, none on the right) must survive a
  root zoom: `]`/`[` on root must NOT make a 6th agent appear anywhere.

**Unblocks**: certifies the on-screen half of the "terminal merging" payoff.
The runtime migration + sprite reconcile + roster-aware-remount logic is
smoke-locked; this is purely the PIXI-visual confirmation that the handoff reads
as a continuous walk (and that no zoom/split re-clones an agent).

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

### ✅ Sample lore file for slice 5C testing
**Status**: RESOLVED (2026-06, consolidation). Two ready-to-drop files now
live in `lore-samples/` (`pastoral.md`, `nautical.md`) with known expected
recolors, plus `lore-samples/README.md` and the `scripts/lore-preview.mts`
predictor. Drop your own `.md` (D&D campaign, fanfic, worldbuilding doc,
2-10 KB, consistent vocab) anytime for a richer test — run it through
`lore-preview.mts` first to see which palette it will pick.

**Unblocks**: 5C "drop a real file, watch Loki reference it" verify step.

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
