# Daylight colour — the sky gets a colour, and the clock comes off hold

**Date:** 2026-08-07
**Programme item:** IDEAS.md § Shared rules across terminals → the
conditions-vs-content ladder, rung 4 ("Daylight colour | NEXT — and now the
blocker, not just the gap").
**Releases:** `CLOCK_HELD` (`src/terminal/ambient.ts:143`), held by Harry's
ruling on 2026-08-06.

## Why

The world clock shipped, was verified on the joined desk, and was then held the
same day. The reason is recorded verbatim in `ambient.ts:136-142`: it drives
*presence* but not *colour*, and colour is a pack constant, so noon read as
"night with the stars taken away" rather than as daylight. The hold is
`HELD_SKY = {sun: 1, night: 1}` — deliberately off the daylight curve, because
every point on that curve trades the ☼ for the stars and the `sun` role also
carries the ground lamps.

So the desk currently ships a verified, gated, smoke-covered clock that nobody
can see. This is the one rung that turns it back on, and it is the only item in
the tree that is *built and switched off*.

It is also the rung the ladder itself names as the blocker: light direction and
weather are both listed as "cheap rider on the clock", and neither can ride a
clock that is held.

## The structural finding this slice is actually about

`theme.palette.bg` is doing **four jobs at once**, and the slice is the split.

1. **The stage and land background.** `terminalLand.ts:388` sets the Pixi
   Application background to `theme.palette.bg`; `land.ts:261` fills the land
   container's whole content rect with it.
2. **The sky's colour.** `ROLE_KEY.sky = 'bg'` (`land.ts:115`), and
   `land.ts:276` deletes the role from the draw set outright — `roles.delete('sky');
   // background, never drawn`. The sky is not a thing the renderer draws. It is
   the absence of drawing. **That is the whole reason noon looks like night.**
3. **The atmospheric-perspective mix target.** `FAR_FADE` (`land.ts:60-74`)
   is documented as "how far each DISTANT role's ink is pulled toward the sky
   (bg) colour — farther planes lose contrast". `ridgeFar` 0.72, `skyDither`
   0.55, `wingSil` 0.6, `cloud` 0.4, `star` 0.35.
4. **The salience denominator.** Every frozen bar in
   `scripts/smoke-style-pack.mts` is a contrast ratio *against bg*: the register
   ordering (fgBright > fg > fgDim), `BEING_MIN_CONTRAST = 3.0`,
   `RAMP_STEP0_MIN = 1.1`, and the dark-ground ceiling (bg relative luminance
   < 0.35, which the smoke enforces because "light backgrounds hit six
   hard-coded dark sites + the darken-only shadeOf — a known v1 engine limit").

Jobs 2 and 3 must move with the hour. Jobs 1 and 4 must not. Doing this without
naming the split is how a "just tint the background" change silently invalidates
a calibrated, frozen contract.

### The bound, and it is not a taste question

`terminalLand.ts:836` positions a being at `(model.surface[cx] - 1) * CH` —
**one row above the surface, which is a sky cell.** Every being on every desk is
drawn against the sky, not against the ground.

So lifting the sky lifts the denominator of the being-salience contract for
every being on the desk. `BEING_MIN_CONTRAST = 3.0` was calibrated on the
shipped corpus against `bg` and frozen; at noon the beings would be measured
against something the bar has never seen. This is not a risk to watch for on
screen — it is an arithmetic constraint that **sets the maximum daylight
excursion**, and it is checkable over all ten shipped themes before anything is
drawn.

The mural does not have this problem: its backing is `theme.palette.bg` and its
quantiser already excludes `bg`/`bgAlt`/`fgBright` "so the being-salience
contract holds by construction". It is self-contained. It does, however, become
a *visible dark rectangle* against a lifted sky where today it blends — see
leg 5.

## Direction calls (taken before any code)

### 1. The clock steers a mix between colours the pack already owns. No second palette register.

`skyInk = mixToward(bg, palette[daySky], DAY_SKY_MIX × daylight(hour))`.

The alternative IDEAS.md names — a day/night pair of palette keys — widens the
authoring contract, requires all ten shipped packs to be re-authored, and dents
the one-palette rule that `types.ts:36-40` calls structural ("A role resolves to
an EXISTING palette key — never a new colour — so the one-palette rule stays
structural"). The style-pack blueprint is gated on that rule. A mix between
existing keys means **every shipped pack gets a day/night sky with zero
re-authoring**, and each expresses it in its own dialect: amber-crt's blue is
amber, phosphor's is green, so each machine lifts toward its own idea of a
bright sky. That is the lossy-lens doctrine working rather than being worked
around.

**The argument against, recorded because it is real.** A mix cannot produce a
colour the pack does not contain, so a pack whose `blue` sits close to its `bg`
gets a daylight that barely reads. For a monochrome pack that may be most of
them. The doctrine says compression is legal — but a feature that compresses to
nothing in eight of ten packs is a feature nobody sees. Leg 6 turns this into a
measured bar rather than a hope: any pack that does not opt out must clear a
frozen midnight-to-noon separation, and a pack that cannot clear it with `blue`
names a different key. That is what the slot is for.

### 2. `bg` keeps the ground, the stage, and the salience maths. Only the sky moves.

The terminal's own background stays `theme.palette.bg`. A terminal is a window
onto a world; its frame is the *machine's* colour, not the world's, and the
stage background is chrome. The ground, the strata and everything below the
surface line keep `bg` too.

This is what keeps the frozen bars sound **by construction** rather than by
re-calibration — the same argument the ramp made when it froze its last factor
at exactly 1.0. Nothing that the style-pack smoke measures changes value. The
one contract genuinely exposed is the being one (beings are sky-backed), and
leg 6 extends that bar to the new denominator rather than moving it.

### 3. A pack may opt out entirely: `daySky: null` is legal omission.

The doctrine is that a pack may **compress or omit** a shared truth but never
**contradict** it. A machine whose sky does not change colour is omitting the
daylight truth, exactly as gameboy-dmg's blank sky omits the celestials.

This is not a hypothetical. `sky` sits in `LAND_OMIT_LOCKED` (`land.ts:204`) —
it is the background, so `landOmit` cannot reach it — which means **gameboy-dmg
would be tinted by default**, and its blank LCD sky is a judged artifact that
passed an eyeball against a frozen kill condition on 2026-07-31. Retinting it
would move a settled result as a side effect. DMG sets `daySky: null` and stays
byte-identical; that is leg 7 and eyeball bar 6.

### 4. No broker channel, and this is a correction to the ladder's own plan.

IDEAS.md describes conditions as "one scalar world-state ticked in the MAIN
process and broadcast". Every condition shipped so far — sway, the ☼ pulse, the
clock — derives from the wall clock in each window instead, so N terminals agree
by construction with no IPC at all. Daylight colour is the same shape: it is a
pure function of `localHour(Date.now())`, which every window already reads once
per tick (`terminalLand.ts:1250`). Adding a channel would add a failure mode
(a window that missed a broadcast) to something that currently cannot fail.

## Shape — seven legs

**1 · The sky becomes a drawn thing.** A `Graphics` in `buildLandContainer`,
before the role layers, filled per column from row 0 down to `model.surface[x]`
(already on `LandModel`). Per column, not one flat rect: the surface undulates,
so a flat rect at the topmost ground row leaves dark patches of un-skied sky
over every valley — precisely where the terrain is most interesting. Filled
**white once and tinted per tick**, so the per-frame cost is one property write
and it freezes cleanly under the wallpaper throttle, matching how `layers` is
already animated ("so the terminal renderer can animate a layer … without
rebuilding the scene", `land.ts:246-248`).

**2 · The curve.** `daySkyMix(daylightLevel)` in `ambient.ts` — pure, Pixi-free,
reachable from `smoke-ambient-phase.mts`. `skyInkOf(theme, daylightLevel)` in
`land.ts`, next to `mixToward`, because ambient owns the clock and land owns the
palette. At `daylightLevel = 0` it returns `palette.bg` **exactly**, so midnight
is byte-identical to today.

**3 · Pack slot 6: `daySky?: PaletteKey | null`.** Default `'blue'`; `null`
opts out. Same optional-slot posture as `landGlyphs` / `landRamp` / `landOmit` /
`fx`, validated by the same smoke.

**4 · `FAR_FADE` mixes toward the current sky, not toward `bg`.** Without this,
atmospheric perspective **inverts at noon**: distant ridges would be blended
toward a dark colour while the sky behind them brightened, so the farthest plane
would gain contrast with distance instead of losing it. `landRoleFill` takes an
optional sky-ink argument that **defaults to `theme.palette.bg`**, so every
existing caller — including the frozen smoke bars — is byte-identical
(the `opts.mural` / `opts.skyline` absent-is-identical pattern). The sky-plane
layers are re-tinted per tick from the same `layers` map.

**5 · The mural backing follows the sky.** Its backing is `theme.palette.bg`;
against a lifted sky that becomes a dark halo around the frame. The backing is a
separate fill behind the quantised text, so following the sky does not touch the
quantiser's palette exclusions and the being-salience-by-construction argument is
untouched.

**6 · Bars into the smokes.** `smoke-style-pack` gains: every being accent keeps
≥ `BEING_MIN_CONTRAST` against the **noon** sky ink as well as against `bg`;
every sky-plane role keeps a frozen minimum contrast against the sky ink at
every hour on the curve (the `RAMP_STEP0_MIN` precedent — "a band that vanishes
reads as a hole in the world"); `daySky` is a real palette key or `null`; and
a non-opted-out pack clears a frozen midnight-to-noon separation.
`smoke-ambient-phase` gains the curve's own bars (monotone with daylight,
exactly `bg` at 0, bounded at 1). **All thresholds calibrated on the ten-theme
corpus and frozen before any pack is authored against them** — the discipline
that `RAMP_STEP0_MIN` and `OMIT_MAX` both followed.

**7 · `CLOCK_HELD = false`,** plus `daySky: null` on gameboy-dmg. The hold
comment and `HELD_SKY` come out; `debugClock` stops reporting `held`.

## What must not move

- Every frozen style-pack bar, by construction (direction call 2). If any
  measured value in `--values` moves except the new ones, the split is wrong.
- `src/procedural/` — byte-untouched. This is render-side only, like the ramp,
  the omit slot and the strata material read. No golden re-freeze.
- gameboy-dmg's judged sky and bands (leg 7).
- The intent engine, the launcher beat, marginalia, murals, liveliness — no
  new AI calls, no new IPC, no wall-clock semantics beyond the hour already
  being read.

## Risks, and the pre-authorised dials

| Risk | Dial, authorised in advance |
|---|---|
| Beings lose legibility at noon | `DAY_SKY_MIX` down, calibrated against the ten-theme corpus. This is the bound, so the smoke fixes it before the screen does. |
| A pack's daylight is invisible (monochrome `blue` ≈ `bg`) | That pack names a different `daySky` key. Second failure → it opts out with `null`. |
| The dim sky registers (`fgDim` stars, cloud, skyDither, wingSil) wash out | Leg 4 preserves the *relationship* by construction; if the absolute still fails, the frozen sky-plane floor is the bar and `DAY_SKY_MIX` is the dial. |
| The lifted sky trips one of the six hard-coded dark sites the dark-ground bar exists for | **NEEDS-CHECK, first task in the plan**: enumerate the six sites and confirm none is in the sky band. If one is, it bounds `DAY_SKY_MIX` and that bound is frozen before anything is drawn. |

## Verification

Smokes are the ground truth for the arithmetic; the screen is the ground truth
for the read. Mutant-check every new bar — in particular, **write each threshold
as an absolute value, never in terms of the constant it guards**
(`a-bar-written-in-terms-of-what-it-guards-is-not-a-bar`: a `>= BREATH_PX * 1.8`
bar stayed green when `BREATH_PX` was mutated to 0).

On screen, on the joined two-window desk, **with the window frontmost** — a
throttled or occluded window passes vacuously
(`a-passing-check-on-a-throttled-window-proves-nothing`). `__terminal.debugClock(hour)`
already exists and runs the live curve, so noon, dusk and midnight are all
drivable on demand; nothing here needs waiting twelve hours.

Both windows must show the *same* sky at the same instant with no broker
involved — that is direction call 4's own falsification, and the ladder's stated
first test ("force one joined terminal to dusk, the neighbour follows within a
frame").

## Frozen eyeball bars

**Frozen 2026-08-07, before implementation. Inherited verbatim by any re-cut.**

1. **Noon reads as day.** At forced hour 12 the desk reads as a lit world, not
   as a dark world with the stars removed. **KILL:** it still reads as night
   with something missing → the mix is the wrong mechanism; stop dialing and
   go back to the day/night register alternative in direction call 1.

2. **Midnight is unchanged.** At forced hour 0 the desk is the desk you have
   already eyeballed — no visible difference from today. **KILL:** anything
   moved at midnight → leg 2's "exactly `bg` at daylight 0" is broken; fix
   that, do not compensate elsewhere.

3. **Dawn and dusk are a transition, not a switch.** Sweeping the forced hour
   from 4 to 9 reads as the light coming up. **KILL:** a visible step or a
   colour that passes through something wrong → halve the excursion once; still
   wrong → ship day and night only, drop the crossfade.

4. **Beings stay the most legible thing on screen at every hour.** Watch a
   being at forced noon: it out-reads the terrain, the sky and the far planes,
   exactly as it does at night. **KILL:** a being is harder to find at noon than
   at midnight → `DAY_SKY_MIX` down once, re-run the corpus, re-watch; still
   failing → the sky does not lift behind beings at all (ground-band only) and
   the slice ships smaller.

5. **The far planes still recede.** At noon, distant ridges and the closed-wing
   skyline read as *farther away* than the near terrain, not as sharper.
   **KILL:** the far plane gains contrast with distance → leg 4 is wrong;
   revert `FAR_FADE` to `bg` and accept a flat noon horizon.

6. **gameboy-dmg is untouched.** Relaunch on DMG at forced noon and forced
   midnight: the sky is the same blank LCD field at both, the judged strata
   bands have not moved, doors and murals present. **KILL:** anything moved →
   `daySky: null` is not doing its job; fix the opt-out, never the pack.

## Out of scope

Light direction, weather, far-layer parallax (still NEEDS-CHECK — needs the
two-joined-terminals-scrolled-apart screenshot), worn paths across seams, and
audio. All are later rungs on the same ladder and all get cheaper once the
clock is off hold. Biome-as-desk-position stays KILLED by the
conditions-vs-content ruling. Latitude, season and the user's real sunset stay
out: they need a location, and the desk is a stylised world, not an observatory
(`ambient.ts:105-110`).
