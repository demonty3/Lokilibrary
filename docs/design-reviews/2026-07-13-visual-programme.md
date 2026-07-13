# Visual improvement programme — 2026-07-13

*Produced by an 8-lens design-review panel (Fable) over a 16-shot capture
matrix (6 themes × cell, 3-frame motion burst, split, caption reveal,
district/island/continent, 2× side-on land), 64 raw findings → 32 deduped
clusters → adversarial pixel-level verification (14 verdicts landed before a
session cap; unverified items are marked). Synthesis by the controller with
its own reads of the frames.*

## The verdict

The world already wins its two hardest bets: the cell view reads as
intentional terminal-art, and the walk-over note reveal + agent cohort read
as authored, not generated. The connecting theme of everything below: **the
salience hierarchy is inverted, and the identity stops at the cell edge.**
The beings — the entire pitch — are the quietest marks on screen while
furniture owns the loudest palette slots (pixel-measured: the Archivist
renders darker than the floor in IBM-3270); and the theme system, the shade
ramp, and the beings all vanish the moment you zoom out, split, or look at
the HUD. Fixing salience and pushing the identity through every surface is
one coherent campaign, not thirty nits.

## Confirmed bugs (fix regardless of any programme)

1. **Ladder label double-draw** — `level-district/island`: third label renders
   "C0Viliza…" (id + name struck over each other); continent label overprints
   the dot field. *Pixel-confirmed corruption.* Fix: clear the label's cell
   row before stamping; drop internal ids from display.
2. **HUD hard-coded ink** — `src/App.tsx:374` `#cdd6f4` is Catppuccin Mocha's
   fg, shipped into all six themes; the panel fill never rethemes either.
   *Code + pixel confirmed.*

## Quick wins (S effort · ranked by leverage)

3. **The attention contract** (L5, 5 lenses, confirmed): beings + `@` get each
   theme's brightest reserved accents; no decor may reuse a being's hue (the
   cat is shelf-gold in every theme; Loki matches Tokyo Night decor mauve).
   `@` gets the brightest step + a terminal cursor blink — the one idle
   animation the player deserves. Files: `src/themes/*.json` (role slots),
   cohort/cell tinting.
4. **One seam dialect** (L5, 6 lenses, part-confirmed): the hard-coded orange
   cross is the highest-chroma mark in every theme; carved side openings are
   bare unmarked floor that read as broken walls. Theme-accent ‖ terminators
   on every opening, all four edges, no orange.
5. **Kill the tofu decor** (L4, unverified but unambiguous): hollow `□` reads
   as glyph-not-found to exactly this audience. Swap to ▤/▦/◘ in the same
   accent.
6. **Pane focus indicator** (L4): focused pane border one ramp step brighter,
   unfocused one dimmer. Pure shade-ramp move.
7. **Note-reveal frame dialect** (L4, 3 lenses): the marginalia box uses the
   room's exact chrome — it reads as the ENGINE talking. Double-line ╔═╗
   frame + one-cell ░ drop shadow + a Loki-accent corner tick: paper pinned
   over the world.
8. **HUD content diet** (with #2): drop `steamid: —`, wrap in the room's
   box-drawing dialect, add the missing interact hint to the key line
   (see refuted #A — the prompt exists; the HUD never mentions it).

## Medium (M effort · the campaign's core)

9. **Ambient life register** (L5, byte-identical frames confirmed: outside 4
   letters the world is pixel-frozen for 8s): seam ‖ breathes between two
   theme blues; trees get a 2-frame sway; floor cells an agent walked
   brighten one shade and decay — which also delivers the promised
   "paths wear deeper". Ticker-driven, throttle-aware.
10. **Shelves that read as books** (L5, confirmed + one caveat): compose shelf
    tiles from vertical spine strokes at 2-3 ramp brightnesses with initials
    on the brightest step; per-theme spine ink chosen for contrast (initials
    currently vanish on Catppuccin/IBM-3270). *Caveat: "only 6 shelves have
    initials" is partly the 8-game sample library — real libraries fill more
    slots. The empty-shelf treatment still needs its own (dimmer) read.*
11. **The split must read as one world** (L5, confirmed ~15-column dead void
    at the join): extend seam floors to the pane edge (fade + → · over the
    last cells), carve facing-wall openings aligned across the gutter. This
    is the hero shot of the snapping-terminals arc.
12. **Deploy the shade ramp** (L5, unverified): the medium's signature ▓▒░·
    is never rendered anywhere. Demote floor to dim `·` (also fixes the noise
    floor under the beings), worn paths, one-cell ░ shadows south-east of
    tall objects.
13. **Ladder identity pass** (2×L5 confirmed): theme accents at every rung
    (neighbourhood boxes in shelf-gold, engagement ramp in the warm accent),
    agent letters inside their neighbourhood boxes, a YOU marker, maps
    centred and scaled to the cell view's composition rule. SPEC already
    promises "district shows agents as points of activity".
14. **Phosphor is raw ANSI** (L4): commit to real CRT phosphor — 3-4 value
    steps of green/amber, one accent reserved for beings.
15. **Agents need errands** (L4, motion shows ping-pong-to-origin): bias
    Tier-0 wander toward destinations with a dwell beat on arrival; forbid
    immediate backtracking. *Also: capture a GIF to verify sub-cell easing —
    stills can't distinguish tweening from teleport (flagged, unverified).*
16. **Hades mural terminal treatment** (L5, byte-identical across themes
    confirmed = renders raw): keep the CDN art (recognition rule) but
    palette-quantize + re-render through the shade ramp at glyph resolution,
    hung in a box-drawing frame. Land view.

## Arcs (L effort · own plans)

17. **Composition/density pass**: WFC post-pass clustering shelves into 2-3
    stacks with aisles; flank voids get an ultra-dim seeded dust field or an
    integer scale bump.
18. **District ≠ island**: district shows structure inside one neighbourhood;
    island aggregates neighbourhoods; continent gets a seeded coastline
    rendered with the ramp (currently "a featureless dot rectangle").
19. **Land polish bundle** (feeds the snapping-terminals arc): monument gets
    box-drawing architecture + a door; sky gets constellations/moon/1Hz cloud
    wisps; deep strata get ore veins + caverns; site labels become signage.

## Refuted / corrected (so nothing silently disappears)

- **A. "Shelf launchability undiscoverable" — REFUTED**: `bookshelfPrompt.ts`
  ships a diegetic "[E] play {name}" one row above adjacent game shelves
  (Chebyshev-1 check). The critics never saw it because the sample library
  leaves most shelves bookless. Residue kept: the HUD key line omits the
  interact key (folded into #8).
- **B. Seam "two dialects" claim — partly wrong**; the unmarked side-gap half
  is confirmed (folded into #4).
- **C. `@` findability evidence corrected** but the mechanism confirmed: `@`
  shares `fgBright` with every spine initial (folded into #3).
- **D. Theme-capture duplicate frame** — capture-session artifact (motion-1
  reused the same moment), not a product defect; noted for future captures.

## Verification status

14 clusters adversarially pixel-verified (12 confirmed, 2 weakened, 1
refuted); 18 lower-leverage clusters ran out of session budget before their
verify pass — items above marked *(unverified)* where it matters. The full
cluster list with evidence lives in the workflow journal
(`wf_4d3a1a37-51c/journal.jsonl`).
