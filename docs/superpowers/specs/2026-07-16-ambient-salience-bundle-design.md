# Ambient-salience bundle — land salience + book-spines + cell ambient life

*Design spec, 2026-07-16. Sources: visual-programme items #9 + #10
(`docs/design-reviews/2026-07-13-visual-programme.md`), the land-register
salience finding from the 2026-07-16 design chat, and the sprite-fidelity
test verdict (`docs/design-reviews/2026-07-16-sprite-fidelity-test.md`),
whose "tuned 6×13 ≈ custom glyph" conclusion this bundle implements in
glyph vocabulary. Approved in conversation with Harry 2026-07-16.*

**Goal:** three surfaces, one coherent move — the attention contract reaches
the land register (beings brightest, decor demoted), cell shelves read as
*books* instead of texture slabs, and the cell stops being pixel-frozen
between agent steps. No new palette entries, no sprites, no new glyph
dialects; everything resolves through `theme.palette` + `roles.ts` and rides
`app.ticker.deltaMS`.

---

## 1 — Land salience

**Current state (verified in code + the joined-terminals capture):**
`src/render/levels/land.ts` maps `crust: 'green'` and `foliage: 'green'` at
full accent strength — the surface grass bars are the brightest marks on the
flagship surface. `src/terminal/terminalLand.ts:addBeing` tints every being
flat `theme.palette.fgBright`. The pitch (the beings) is quieter than the
lawn.

**Changes:**

- **Demote crust + foliage two ramp steps.** Keep the `green` hue; scale its
  RGB via the file's existing `scaleRGB` helper when building those roles'
  layer fills (exact factor tuned on screen; start at `0.6`). Exported as a
  named constant so the smoke can assert it. Site labels (`fgDim`), strata,
  and the structure-glow pulse are untouched.
- **Beings get reserved accents.** `addBeing` resolves its fill through
  `roleKey()` using one of the four existing being roles
  (`being.loki` / `being.archivist` / `being.cat` / `being.visitor`),
  picked deterministically by `fnv1a(id) % 4` (the function already computes
  `fnv1a(id)` for `bobPhase`). Land beings thus draw from the same reserved
  accent pool as the cell cohort — `BEING_ROLE_KEYS` stays the single
  authority, theme overrides keep working, and no decor may use those keys
  (existing smoke-enforced rule now visibly true on land too).
- **Crossing juice keeps its own colours** (knit sweep, ✦ spark, caret) —
  out of scope, already correct.

## 2 — Book-spine shelves (programme #10)

**Current state:** the tile bible (`src/procedural/tiles/library.ts`) gives
`T_BOOKSHELF` `glyph: '▓', fgKey: 'yellow'`; the cell renderer draws one
BitmapText per shelf cell, and `spineLayer` overlays the first letter of
each game (`bookSpines`, `fgBright`) in reading order until games run out.

**Change — renderer-side composition (the bible entry stays untouched as
the fallback vocabulary):** the cell renderer special-cases `T_BOOKSHELF`
(it already special-cases shelves for the spine overlay). Instead of one
`▓`, each shelf cell draws **three 1-cell-tall vertical strokes** at
sub-cell x-offsets (≈ 0 / 2 / 4 px within the 6 px cell), with per-stroke
±1 px top-offset variance — books of slightly different heights.

- **Glyph:** `│` (U+2502) — already in the Cozette atlas and the wall
  vocabulary. If on-screen it reads too thin at fit scale, the fallback
  candidates are `▌`/`▐` (half blocks), gated by the glyph-coverage smoke
  before use. No new dialect either way.
- **Tints (occupied shelf):** deterministic per (cell x, y, stroke index)
  via FNV pick from `[yellow, fg, fgDim]`, with **at least one `yellow`
  stroke guaranteed** per cell — the room keeps its shelf-gold identity at
  a glance. Never a reserved being key (`smoke-salience` extended to cover
  the stroke palette).
- **Empty shelves** (cells beyond the `bookSpines` list): all strokes
  `fgDim`, no initial — the programme's "dimmer read" for unstocked cases.
- **Initials + interaction unchanged:** the `fgBright` initial still sits
  on top (now the unambiguous brightest step in the cell); the launch
  prompt keys off tile adjacency, not glyphs.
- **Budget:** ~40 shelf cells × 3 strokes ≈ +80 BitmapTexts over today —
  noise next to the land renderer's hundreds.
- **Determinism:** stroke pattern is a pure function of (profile seed, cell
  position); no `Math.random` (renderer uses `fnv1a`, same as marks).

## 3 — Cell ambient life (programme #9)

The pixel-verified finding: outside the four beings, the cell is
byte-identical for 8+ seconds. Three registers, all driven from one ambient
ticker in `cell.ts` that accumulates `app.ticker.deltaMS` (the
`pulseLandmark` pattern) — so everything freezes cleanly under
`paused` / `sleeping` and never touches a wall clock:

- **Seam caps breathe.** The blue `‖` aperture caps (cell.ts seam-cap pass)
  keep their BitmapText handles; the ticker oscillates their alpha
  0.7 ↔ 1.0 on a ~4 s sine. Alpha, not tint — one colour, one dialect,
  cheapest possible per-frame write.
- **Trees sway.** Scatter glyphs whose entry is foliage (`♠` potted plant)
  get a ±0.5 px x nudge on a ~1.6 s square wave — the 2-frame sway the
  programme specified — with per-instance phase from `fnv1a(x, y)` so the
  room never moves in lockstep.
- **Paths wear.** A `wearLayer` overlay (Z between floor text and marks):
  the ambient ticker samples the player position + each live agent runtime
  each frame and stamps `Map<"x,y", lastSteppedS>` for `T_FLOOR` cells. A
  stamped cell shows the floor glyph one brightness step up (`fg` over the
  floor's `fgDim`), alpha-fading back to nothing over ~8 s. Capped at 64
  live entries, oldest evicted — bounded churn, no allocation in the
  steady state. Volatile and per-pane (lives with the cell mount, cleared
  on teardown); the persistent flavour of worn paths stays the land's.

## Success criteria (all judged on captures, not code)

1. **Land:** in a joined-terminals capture, the brightest marks are the
   beings (each in a reserved accent); grass reads as ground, not
   highlight. Both windows agree (the demotion is theme-math, not state).
2. **Cell:** at glance distance the shelf wall reads as *rows of books*;
   initials remain the brightest step; empty shelves visibly dimmer.
   The room keeps its warm shelf-gold identity (≥1 gold stroke per cell).
3. **Motion:** two harness captures ~2 s apart are **no longer
   byte-identical** — seam-cap alpha and tree offsets differ; a capture
   taken behind a walking agent shows the brightened trail fading.
4. **Discipline:** typecheck both legs + full smoke sweep green;
   glyph-coverage green (any new glyph enumerated first);
   `smoke-salience` extended (land demotion constant, stroke palette
   excludes reserved keys); no `Math.random` introduced anywhere; all
   animation frozen under `paused`/`sleeping` by construction.

## Verification harnesses

- **Cell legs:** `bash scripts/e2e/run.sh` + `drive.mjs shot` — before/after
  at the same seed; a 2-shot motion diff; a walk sequence via `key` for the
  wear trail.
- **Land legs:** the T0 harness (`LOKILIBRARY_TERMINALS=2` +
  `t0-drive.mjs move/shot`, occlusion-proof `join-shot.py` if windows
  overlap) — before/after of the same joined desk.

## Out of scope

Floor `·` demotion + object shadows (programme #12 — touches every cell,
own slice), ladder identity (#13), murals (#16), the sprite pipeline
(parked per the fidelity verdict), land site-label changes, any new
palette keys or glyph dialects, wallpaper-mode QA beyond throttle-freeze
correctness.
