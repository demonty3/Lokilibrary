# T3 slice 2 — the masthead and the parting frame

**Date:** 2026-08-09
**Arc:** snapping terminals, `docs/PRD-snapping-terminals.md` § T3 ("per-terminal
theming hooks, **wing label, status row (who's here, engagement summary)**" +
"joined-edge treatment becomes a crafted moment: **frame glyphs part like
undergrowth**, ground knits across").
**Status:** bars frozen 2026-08-09 BEFORE any code. Slice 1 (per-terminal packs)
shipped 2026-08-08; this is the remainder of T3.

## What is actually missing (observed, on a running two-window desk)

Shot: `docs/design-reviews/2026-08-09-t3-slice2/desk-before.png`, t1=`d0`/phosphor joined to t2=`d1`/solarized-dark.

**1 · The one surface slice 1 did not reach.** Every window's title is a DOM
strip — `TerminalApp.tsx:29-45`, `#8a8a8a` 12 px *system* monospace on a
`rgba(0,0,0,0.35)` band reading `┤ d0 ├`. It is byte-identical in every window
regardless of pack. Slice 1 gave each terminal its own palette and its own sky
ink; the strip above them stayed the same grey in both, in a font the world
never uses, over a black band that cuts a foreign horizontal line across the top
of whatever sky the pack authored. It is the only remaining piece of chrome that
denies the window its identity.

**2 · Nothing says who is here.** The roster moves between windows — that is the
arc's whole premise — and the movement is invisible unless you happen to be
watching the seam at the moment someone crosses. Two of the five cohort members
are intermittently absent by design (Visitor 90 s in 15 min, Ghost rare), so
"look for the glyph" is not a reliable read even when you do look.

**3 · The frame does not part; it is cut.** `drawEdges()`
(`terminalLand.ts:855-889`) is binary. Closed: a full-height wall, `║` with `╎`
every fourth row, `▌`/`▐` at the ground. Open: the wall is *destroyed in one
frame* and a single pulsing `‹`/`›` is placed at the ground line. The join's
craft is carried entirely by the ground (knit sweep, hermite blend, both shipped
long ago); the thing that was literally in the way just disappears between two
frames. On screen the seam reads as two windows abutting, not as an opening.

## The two moves

### M1 — The masthead: the title row becomes world-rendered

The DOM element stays (a frameless window needs an `WebkitAppRegion: drag`
region) but is emptied: no text, no background, height raised 20 → 26 px to
match one Cozette row at `WORLD_SCALE`. The row is redrawn in Cozette at 2×,
themed from *this window's* pack, in a stage-level container — chrome, so
outside `world`'s glow filter (a bloomed status row is mush) and under the
scanline field (correct CRT layering).

Left to right, one row:

- `┤ d0 ├` — the wing, in `fg`.
- **who is here** — one glyph per resident, each in its own cohort accent
  (`theme.palette[def.paletteKey]`, the exact expression `addBeing` uses at
  `terminalLand.ts:984`), so the `c` in the row is the same orange as the `c` on
  the ground. Absent (`!mind.present`) and away (out playing, `b.away`) beings
  are not drawn: the row is who is HERE, not who lives here.
- **the holdings** — the wing's five games as a 5-step engagement ramp in
  `fgDim`: `█` mastered · `▓` loved · `▒` recent · `░` dusty · `·` abandoned.
  This extends the scale ladder's already-shipped 4-step legend
  (`▓ loved · ▒ engaged · ░ tried · · dusty`, `ladderCompose.ts:42`) by one step
  for `mastered`, which the land expresses as a monument.

**Why a ramp and not a histogram or a sentence.** Engagement is already rendered
spatially — `land.ts:577-599` builds a monument for `mastered`, a lamp-lit shelf
for `loved`, a cottage for `recent`, foliage for `dusty`, a buried relic for
`abandoned`. Restating that in words would be HUD bloat and would duplicate what
the architecture says. Five shade cells say something the architecture cannot:
the wing's shape *as a collection*, at a glance, in the width of five characters.

**Backing behind the ink only** — the caption's unframed-soft-backing pattern
(`terminalLand.ts:1796-1800`: `bg` fill, alpha < 1, no border), sized to each
run. A full-width band is the thing being removed; a border would read as a
title bar, which is the other thing being removed.

### M2 — The parting frame

The wall stops being one multi-line text and becomes **one text per row**, so
rows can be lit independently. Two glyph sets per edge, one alpha channel each,
both driven by a single travelling front:

- **wall rows** — today's glyphs exactly (`▌`/`▐` at the ground row, `╎` where
  `y % 4 === 2`, else `║`), full height.
- **jamb rows** — `JAMB_H = 3` rows sitting directly above the threshold row.
  The bottom one is the bend, turning *away* from the opening: `╰` on a left
  edge, `╯` on a right edge. Above it, thin `╎`. Alpha falls with height.

The front travels from `-FEATHER` to `span` on opening and back on closing, so
one formula covers both directions and both rest states. A wall row's alpha is
`clamp((dist - front) / FEATHER, 0, 1)` where `dist` is rows from the ground
line; a jamb row's is its base alpha times `clamp((front - dist) / FEATHER, 0, 1)`.
Rest-closed (`front = -FEATHER`) gives a solid wall and no jamb; rest-open
(`front = span`) gives no wall and a lit jamb. The front runs over
`EDGE_PART_S = 0.45 s`, easing out — the wall parts from the ground line
outward, upward into the sky and downward into the strata, and the jamb lights
behind it.

Across a joined seam the two windows' jambs are adjacent columns, so the seam
draws `╯` `╰` over `›` `‹` over the knitted ground: the frame has parted around
the crossing point and left two jambs.

**What stays off the seam column when open**: everything else. No ink in the sky
band, none in the strata. The two-pack spike measured terrain continuity across
a differently-packed seam (`t1` col 52 crust at row 16 = `t2` col 0 crust at row
16); a residual wall would re-cut exactly what that measured.

The maths goes in a new pure, PIXI-free `src/terminal/edgePart.ts` — the
`wear.ts` / `knit.ts` / `siteLabels.ts` / `packAssignment.ts` posture, driven
headlessly by a smoke.

## What this slice does NOT do

- No new IPC, no config field, no desktop-process change. The masthead reads the
  local being map and the local model; the parting reads the topology the broker
  already sends.
- No change to the closed-edge look. An unjoined terminal must render exactly as
  it does today — that is half of the PRD's own acceptance ("a third, unjoined
  terminal reads as deliberately apart") and it is a bar below.
- No new runtime AI call.
- Does not touch the known caption-over-skyline defect (logged 2026-08-08,
  pre-existing, different surface).

## Bars, frozen before code

Two-sided. Measurements come from `__terminal` debug hooks driven over CDP on a
real two-window desk, except bar 7 which is Harry's look.

**Masthead**

1. **It wears the window's own pack.** In two joined windows on different packs,
   the masthead's label ink is a palette key of *that window's* theme and the two
   differ. **KILL:** the ink is equal across the two windows, or is not a value in
   the window's palette (i.e. it is still a constant grey).
2. **It says who is here, and it moves when they do.** Force a crossing; after
   the roster changes, the crosser's glyph is gone from the origin window's row
   and present in the destination's. A being that is absent (`!mind.present`) or
   away is not in the row. **KILL:** the row is static across a crossing, or lists
   someone the land is not currently drawing.
3. **It gives the sky back.** No full-width band and no border: backing exists
   only behind the ink runs, and the DOM strip contributes no pixels of its own.
   **KILL:** any opaque element spanning the window width, or any box glyph
   enclosing the row.

**Parting frame**

4. **The frame parts rather than being cut.** Sample the edge's wall alpha at
   0.10 s and at 0.25 s after a join fires: both are strictly between 0 and 1 for
   at least one row, and the row nearest the ground is dimmer than a row far from
   it (the front is travelling outward, not fading uniformly). **KILL:** every
   wall row is at 0 on the first frame after the join (still a cut), or all rows
   share one alpha (a crossfade, not a parting).
5. **What is left is a threshold, not a wall.** Fully open, every wall row on the
   edge column is at alpha 0 and exactly `JAMB_H` jamb rows are lit, all of them
   above the threshold row and below the ground line's neighbourhood — nothing in
   the sky band, nothing in the strata. **KILL:** any lit wall row when open.
6. **A closed edge is untouched.** On an unjoined terminal the edge column's
   drawn glyph at every row equals what today's `drawEdges` writes, at alpha 1,
   for the full height, and no jamb is lit. **KILL:** any drawn difference in the
   closed state.

**Taste (Harry's, on the running desk — not measurable here)**

7. The joined seam reads as **a doorway in one continuous place**, and an
   unjoined third terminal reads as **deliberately apart** (the PRD's own
   acceptance line). The masthead reads as part of the world's furniture, not as
   a HUD bolted over it.

## After the shots — one design change, and what forced it

*Appended 2026-08-09 after building and capturing. The bars above are frozen and
were not touched; this records an implementation that failed its own intent.*

**The holdings ramp shipped as bar HEIGHTS (`█▆▄▂▁`), not shade densities
(`█▓▒░·`).** The shade form was built as specified and shot: at `fgDim`, five
adjacent dither cells read as a patch of texture, not as five measures —
indistinguishable from a fragment of the crust that had wandered into the sky.
That is the pinned crust-legibility finding (2026-08-01, diorama-neighbour
probe) resurfacing on a new surface. Evidence, 5× nearest-neighbour:
`docs/design-reviews/2026-08-09-t3-slice2/t3-ramp1.png` (shade) beside
`t3-ramp2.png` (heights) in the same folder.

The spec's argument for the shade form was vocabulary reuse — the scale
ladder's own legend. That argument is weaker than it looked: the ladder's
glyphs are read *beside a legend naming them*, and this row has no legend, so
the reuse bought internal consistency and cost the read. Heights carry the same
five ordered steps with no dither at all and are orderable without a legend.
`smoke-masthead` now guards the replacement in both directions — no `▓▒░` may
re-enter the ramp, and the five steps must stay monotone in height.

No bar changed. Bars 1-6 were measured on the running desk after the swap.

## The strongest argument against, stated before building

**The masthead is a HUD, and this project has spent a year removing HUDs.**
Always-on site labels were killed for breaking the world up (2026-07-30); the
labels that survived reveal on proximity. `#8 HUD content diet` is a live
backlog item. A persistent row of status text at the top of every window is
exactly the shape of the thing that got cut.

The distinction being relied on: the site labels were *in the world*, competing
with the landscape they annotated. This row is *the window's title bar* — a
surface that already exists, is already always-on, and today is a grey band in
the wrong font. The slice does not add chrome; it makes the chrome that is
already there belong to the world. If Harry's look says otherwise, the fix is to
delete the row and keep the parting frame — the two moves are independent and
either can ship without the other.
