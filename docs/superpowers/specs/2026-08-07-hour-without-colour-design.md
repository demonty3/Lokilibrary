# The hour without colour — the sun arcs, the lamps come on

**Date:** 2026-08-07
**Programme item:** IDEAS.md § Shared rules across terminals → the
conditions-vs-content ladder, the daylight rung — **second attempt, different
mechanism.**
**Supersedes:** `2026-08-07-daylight-colour-design.md`, whose mechanism was
killed at calibration the same day (`e97a458`). That spec's six bars are dead
with it; the ones below are new and are frozen here, before implementation.
**Releases:** `CLOCK_HELD` (`src/terminal/ambient.ts:143`) — if and only if the
eyeball passes.

## Why

The world clock has been built, verified and held since 2026-08-06. The hold
exists because the clock moved *presence* and nothing else, so noon read as
"night with the stars taken away".

The obvious fix — give the sky a colour — was specced, built to three tasks, and
then killed by its own calibration. The finding is worth restating because it
governs this spec: **the desk's sky is not a background, it is the primary
drawing surface.** Twenty-two land roles can sit above the surface line, plus
every being (drawn at `surface - 1`, a sky cell) and the site labels carrying the
game names. Its colour is therefore the contrast denominator for nearly
everything on screen, and the frozen `BEING_MIN_CONTRAST 3.0` leaves only 8%
headroom — spent at a mix of 0.06, five times before the change becomes visible.

So this attempt spends **no** contrast budget at all. Every cue here is
**position and alpha**, which move nothing any bar measures.

## Feasibility, measured before the design

The lesson from the previous attempt was that the killing computation is cheaper
than the mechanism, so it goes first
([[calibrate-the-dial-before-building-the-mechanism]]). Composed at real desk
geometry (640×520 window, `WORLD_SCALE` 2, Cozette 6×13 → **53 × 20 cells**),
over seeds 1 / 7 / 41 / 1234:

| | measured | consequence |
|---|---|---|
| Sky band | rows **0–9**, 10 tall (relief to row 14) | the arc has room |
| Sky ☼ | **always y = 0**, x seeded 17–39 | already at the ceiling: the arc goes *down* toward dawn/dusk, which is also the correct physics |
| ☾ moon | **always y = 1**, x seeded 8–41 | counter-arcs in the same band |
| `sun`-role cells | exactly **2** — one sky ☼, one ground lamp beside the loved game's shelf (y 9–12) | the split is one stamp site, not a refactor |
| `monumentCrown` | its own role since #19 slice 2, glyph ☼, y 2–6 | the precedent for splitting a ☼ out of `sun` is three days old |
| cloud / star / moon counts | 13–14 / 15–19 / 1 | ample, but see "out of scope" |

**Arc travel: 8 rows** (y 0 → 7, holding 2 rows clear of the being row at
`surface - 1` = y 9). At `WORLD_SCALE` 2 that is 8 × 13 × 2 = **208 screen
pixels**. The previous mechanism's entire visible budget was a contrast ratio of
1.03. This one moves a glyph a fifth of the window's height.

## Direction calls (taken before any code)

### 1. Time is told by position and state, never by colour.

The sun climbs and sets, the moon counter-arcs, the lamps light at night and go
out by day. No palette key moves, no fill changes, no tint is introduced.

This is not merely a way to dodge the frozen bars — it is how a side-on pixel
world has always told the time, and it is the reading the previous attempt was
reaching for by the wrong means. It also makes the whole slice
**contrast-neutral by construction**, which turns eyeball bar 4 from a judgement
into an assertion: if any contrast number moves, that is a bug, not a trade.

**The argument against, and it is the serious one.** *Presence-only already
failed this exact eyeball.* On 2026-08-06 Harry watched the clock drive ☼/☾/star
alphas and called it "night with the stars taken away", which is why the hold
exists. This spec bets that **a body that is somewhere else reads differently
from a body that is gone**, and that a lit window at midnight reads as night in
a way an absent star does not. That bet is not evidence. If bar 1 fails, the
honest conclusion is that this world cannot say "day" without colour, and the
only remaining path is the day/night palette register — an authoring-contract
change across ten shipped packs. **That is the fork this slice resolves.**

### 2. The lamp gets its own role. `sun` keeps the sky.

`ambient.ts:61-67` records the coupling and declines to fix it: the `sun` role is
spent on both the sky ☼ and the shelf lamp, they share a render layer, and
splitting "would mean a new role in the composer's vocabulary, which drags in
the palette contract, the tile bibles and the glyph-coverage smoke for no visible
gain."

There is visible gain now, and it is the point of the slice: the two must move in
**opposite** directions with the hour. Coupled, releasing the clock would light
the lamps at noon and douse them at midnight — backwards, and worse than the
hold. The measurement above says the cost is one stamp site and one cell.

The new role is **`lamp`**, leaving `sun` as the sky body, because `sun` is what
every pack's `landOmit` already names and what `skyPresence().sun` already
drives. Inverting that would silently repoint ten packs' omit lists at a
different object.

*Consequence, stated rather than discovered:* gameboy-dmg omits `sun` to get its
blank LCD sky, and after the split that no longer covers the lamp. DMG takes
`lamp` in its `landOmit` as part of this slice — a one-key pack edit, exactly as
when `monumentCrown` split out.

### 3. The world always wins, and the arc obeys the rule already shipped.

A sun descending from row 0 crosses the mural, the skyline and structure tops.
`src/terminal/clouds.ts` already solved this shape for drifting wisps: fade to 0
approaching composed content and back in past it, never pop. The arc reuses that
rule rather than inventing an avoidance path, and the arc's floor is bounded 2
rows above the being row so the sun can never contend with an inhabitant.

### 4. Still no broker channel.

Same as every condition shipped so far: position and alpha are pure functions of
`localHour(Date.now())`, so N terminals agree by construction. A window opened at
dusk shows the same sun height as its neighbours the instant it mounts. The
ladder's written plan to broadcast a world-state scalar stays wrong for the same
reason it was wrong for sway and the ☼ pulse.

## Shape — five legs

**1 · Split `lamp` out of `sun`.** One stamp site in `src/procedural/land.ts`,
one entry in `ROLE_KEY` (`yellow`, unchanged look), the omit/glyph/ramp lock sets
reviewed, `gameboy-dmg.json` takes `lamp`. This is a composed-model change, so
the `smoke-land-mural` golden re-freezes — a **payload** re-freeze like the
launcher beat's, not a re-roll, and the commit says so.

**2 · The arc.** `skyArc(daylightLevel)` in `ambient.ts` — pure, Pixi-free,
smoke-reachable: returns the sun's and moon's row offsets from their composed
positions. Applied as `.y` on the `sun` / `moon` layers, which is exactly how
foliage sway already animates a layer (`scene.layers.foliage`, `.x` per tick),
and sub-cell so the climb is smooth rather than snapping between rows — the
sub-character-animation rule in CLAUDE.md.

**3 · The lamps invert.** `lamp` alpha rides `1 - day` against the sun's `day`,
keeping the existing `sunGlow` pulse as its breath. Lit through the night, out
by noon.

**4 · Occlusion.** The arc fades approaching composed content, per direction
call 3, reusing the wisp rule.

**5 · Release the hold.** `CLOCK_HELD` / `HELD_SKY` out, `debugClock` stops
reporting `held`, gated on the eyeball. New readback: `debugSky()` returning the
drawn `{sunY, moonY, sunAlpha, lampAlpha}` — a still cannot show an arc, and a
screenshot cannot tell a high sun from a composed one.

## What must not move

- **Every contrast number in `smoke-style-pack` (303 assertions), exactly.** This
  slice touches no fill, so any movement is a defect. The bar is byte-equality of
  the `--values` output, not "within tolerance".
- gameboy-dmg's judged sky and bands (leg 1's pack edit is the mechanism that
  keeps this true, and bar 6 is the check).
- The intent engine, launcher beat, marginalia, murals, liveliness, wallpaper.
  No new AI calls, no new IPC.

## Risks and pre-authorised dials

| Risk | Dial |
|---|---|
| The arc reads mechanical (a glyph sliding on rails) | Ease the ends once — the `daylight()` smoothstep precedent. Still mechanical → ship high/low positions with no travel. |
| A lit lamp at midnight reads as decoration, not as light | Drop leg 3, keep the arc. The legs are independent by construction. |
| The sun fades so often behind content that the arc is rarely seen whole | Bound the arc's floor higher (fewer rows, less crossing) before widening the fade band. |
| The composed-model change perturbs an RNG stream | Leg 1 is a role *rename* at an existing stamp, no new draws. Proven by grid parity against the pre-change composer, the launcher beat's method. |

## Verification

Smokes for the pure maths; the screen for the read. Mutant-check each new bar,
and **write every threshold as an absolute value, never in terms of the constant
it guards**. On screen: the joined two-window desk, **window frontmost** — a
throttled or occluded window passes vacuously. `__terminal.debugClock(hour)`
already forces the hour; `debugSky()` reads back what was drawn one frame later.
Both windows must show the same sun height at the same instant with no broker
running — direction call 4's own falsification.

## Frozen eyeball bars

**Frozen 2026-08-07, before implementation. Inherited verbatim by any re-cut.**

1. **Noon reads as day.** At forced hour 12 the sun is high and the lamps are
   out, and the desk reads as daytime. **KILL:** it still reads as "night with a
   sun added" → position cannot carry this, and the only remaining path is the
   day/night palette register. Do not dial; report and stop.

2. **Midnight reads as night.** At forced hour 0 the moon is up, the lamps are
   lit, the sun is gone. **KILL:** the lamps read as decoration rather than as
   light → drop leg 3, keep the arc, re-watch.

3. **Dawn is a climb.** Sweeping forced hours 4 → 9, the sun rises from low and
   the lamps go out as it does. **KILL:** the sun jumps between rows or slides
   mechanically → ease once; still mechanical → ship high/low with no travel.

4. **Nothing became harder to read.** Beings, site labels, far planes and murals
   are exactly as legible at noon as at midnight. **KILL:** anything degraded →
   a leg is touching colour when it must not; that leg comes out.

5. **The world still wins.** The sun and moon never draw over a mural, a
   structure or an inhabitant at any hour. **KILL:** an overlap → widen the fade
   band once, then bound the arc higher.

6. **gameboy-dmg is untouched.** Blank sky at every hour, judged strata bands
   unmoved, doors and murals present, no stray lamp. **KILL:** anything moved →
   the `lamp` split's omit mapping is wrong; fix the pack list, never the engine.

## Out of scope

**Cloud density by hour** — considered and cut: clouds are composed, so
render-side modulation can only fade cells, never add them, which makes it a
weak cue, and the wisps already drift. **Weather, light direction, far-layer
parallax** — later rungs; all cheaper once the hold is off. **Daylight colour** —
PARKED behind the palette-register question, and bar 1's kill is the thing that
would force it. **Sun azimuth into the shade channel** — the `shade` grid exists
for `hall` only; a real light-direction pass is its own slice.
