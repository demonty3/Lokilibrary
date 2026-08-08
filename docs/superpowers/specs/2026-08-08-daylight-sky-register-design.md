# The daylight sky register — the background becomes its own environment

**Date:** 2026-08-08
**Programme item:** IDEAS.md § Shared rules across terminals → the
conditions-vs-content ladder, the daylight-**colour** rung — **third attempt,
third mechanism.**
**Builds on:** `2026-08-07-hour-without-colour-design.md` (shipped, eyeball
PASSED all six bars, `37c7a92`). That rung released the world clock without
colour; this one adds the colour it deliberately did without.
**Supersedes:** `2026-08-07-daylight-colour-design.md`, killed at calibration
(`e97a458`). Its bars are dead with it; the ones below are new and frozen here,
before implementation.

## Why

Harry, 2026-08-08: *"make the background a separate environment which changes
colour with the time of day relative to the style of the terminal."*

Three clauses. Two are already answered and the third is the mechanism:

- **"a separate environment"** — a drawn sky layer. Built already, in
  `git stash@{0}`, and recorded in IDEAS.md as a **prerequisite for both
  surviving axes, not as one of them.** On its own it changes nothing that
  killed the last attempt: contrast is a property of two colours meeting, not of
  which container they sit in. Reviving it is necessary and insufficient.
- **"changes colour with the time of day"** — `daylight(hour)` → 0..1 has been
  live in `src/terminal/ambient.ts` since the arc rung. It drives alphas today
  and `skyNow()` already reports `day` separately from `sun` for exactly this.
- **"relative to the style of the terminal"** — **the fix.** What died was one
  *global* mix strength measured across the ten-pack corpus. Per pack it lives.

### What the kill actually established

Restated because it governs this spec. **The desk's sky is not a background; it
is the primary drawing surface.** Twenty-two land roles can sit above the
surface line, plus every being (drawn at `surface - 1`, a sky cell) and the site
labels carrying the game names. The corpus clears the frozen
`BEING_MIN_CONTRAST 3.0` by 8%; a global mix spends that by ~0.06, where
midnight→noon separation is 1.03 and invisible; daylight needs ~0.3. At 0.5,
209 of 210 role × theme pairs fall below baseline and the labels hit **1.08:1**.

That is a finding about a **single global constant**, and it does not generalise
to a per-pack contract. Measured the following day, on the same corpus:

| axis | result |
|---|---|
| Luminance lift, per pack, each choosing its own key and ceiling | **7 of 10** clear separation ≥ 1.5 while holding every frozen bar |
| Hue rotation at constant luminance | **rescues the other three**, best of all on `solarized-dark` (ΔE 46.1) — the `DEFAULT_THEME_ID` and the README desk |

They fail on complementary sets, so between them every shipped pack has an axis
it can afford. And the second is bar-neutral **by construction rather than by
tuning**: every check in `scripts/smoke-style-pack.mts` is computed from WCAG
relative luminance (`lumOfInt`, line 68), which is blind to hue.

## Direction calls (taken before any code)

### 1. The pack authors its skies; the engine does not compute them

Harry's call, 2026-08-08, and it is an **authoring-contract change** — which the
kill doc named as the unpark precondition and explicitly left to him.

The engine-computed alternative (pack names a key + a strength, engine rotates
hue at fixed luminance) was rejected for the reason IDEAS.md already recorded
against it: *hue direction is an unsolved authoring question, not a measured
one.* The probe maximised ΔE rather than plausibility, and solarized's maximal
answer is `#4c1110` — a dark red that reads as **sunset, not midday**. No
formula fixes that. A person looking at the screen does.

Authoring also subsumes both axes at once: an authored noon may rotate hue,
lift luminance, or do both, up to whatever the frozen bars admit.

The idiom is ordinary and deliberately so — Solarized itself ships light and
dark, so every pack author already knows how to write a second register.
**Nothing here is claimed as novel.** What is specific is that the register is
*gated*, so a glyph world stays legible at every hour it can reach.

### 2. Three stops, and midnight is nailed to `bg`

```jsonc
"daySky": { "night": "#002b36", "twilight": "#3a2233", "day": "#12414f" }
```

Interpolated on the existing `day` level: 0 → `night`, 0.5 → `twilight`,
1 → `day`. No new time concept — `daylight()` is symmetric, so `twilight` shows
at both dawn and dusk, and the curve's existing gain already makes that band
brief (~1.7 h either side).

**`daySky.night` must equal `palette.bg` exactly**, asserted in the smoke rather
than left as convention. It makes "midnight is unchanged from today" a
*contract*: any regression bisects trivially, and a pack really only authors two
colours.

Absent `daySky` = today's behaviour, byte-identical. That keeps the seven
un-authored packs green and makes opting out legal by the same doctrine as
`gameboy-dmg`'s deleted sky: **some machines show the time of day, some don't.**

Because the pack is now its own ceiling, the global `DAY_SKY_MIX` constant that
died at calibration **does not come back in any form.** There is no strength
dial to tune.

### 3. The far planes belong to the environment

If the background is an *environment*, the ridges and the mural backing are part
of it. `landRoleFill` currently fades `FAR_FADE` roles toward
`theme.palette.bg`; at a lit noon they would be receding into a colour the sky
no longer is, so the farthest plane would **gain** contrast with distance — the
depth cue inverted. Far planes track the live sky. `GROUND_DEMOTE` roles (crust,
foliage) sit below the surface line, are seen against the ground, and must not.

### 4. The sky hangs outside the glow filter

`src/render/fx/glow.ts` is a bright-pass bloom, `THRESHOLD = 0.2`, whose whole
design assumes the only bright thing in its input is glyph ink. The land's
backdrop panel is currently *inside* `world.filters` and escapes only because
every shipped `bg` is dark. A sky lit toward noon clears 0.2 on every theme, and
the entire band would bloom on a glow pack.

This is a **latent bug independent of this slice** and provably a no-op today:
`amber-crt` is the only pack with `glow` and its `bg` sits at 0.078.

### 5. The gate follows the denominator

`smoke-style-pack.mts` computes every check against `bgLum = lumOfHex(pal.bg)` —
an assumption that holds only because the sky is never drawn (`land.ts:277`).
Once the sky is drawn and moves, the sky is the denominator.

> For a pack declaring `daySky`, checks 2 (dark ground), 3 (register order),
> 4 (being accents clear the ground registers) and the ramp step-0 floor
> re-run **against each of the three authored skies**, not against `bg` alone.

`BG_LUM_MAX 0.35`, `BEING_CLEAR 0.85`, `BEING_MIN_CONTRAST 3.0`,
`RAMP_STEP0_MIN 1.1` are copied **verbatim**. No threshold is introduced, none
is retuned; the same bar is evaluated three times instead of once. A pack whose
authored noon is unaffordable **fails the smoke** — which is exactly what the
killed attempt lacked. The gate tells the author what their machine can afford,
before anything reaches a screen.

### 6. Seam hygiene — the sky bleeds past the land's edge

`cols = floor(640 / 12) = 53`, so `contentW × WORLD_SCALE = 636` in a 640 px
window and `world.x = 2` leaves a 2 px `bg` sliver down each edge. Invisible
today (land panel, sky and stage background are all `bg`); at noon it becomes a
dark line down both edges and **4 px of dark line at every join** — a direct hit
on the shipped "the ground continues across the join" pillar.

The sky bleeds one cell past each edge in local space, terminal-path only
(absent-is-identical option, so the V0 preview and the palace are untouched).
Widening `cols` instead was rejected: it changes every composed land and would
break both determinism and bar 2.

## The six bars (frozen — Harry's eyeball, on screen)

1. **Noon reads as a different hour, not a different colour scheme.** Checked on
   `solarized-dark` (hue axis) and `catppuccin-mocha` (lift axis).
   **KILL, inherited verbatim from IDEAS.md:** *if a hue shift with no
   brightness change reads as "someone recoloured my terminal" rather than "it
   is a different hour", the axis is decoration, not time* — drop the hue axis,
   and daylight colour rests on the luminance axis at 7/10, with the default
   desk staying colourless. That cost is accepted in advance, not renegotiated
   after the screenshot.
2. **Midnight is byte-identical to today.** Arithmetic, not taste: forced 00:00
   pixel-compares against a pre-slice build.
3. **The beings still own the screen at noon**, read at wallpaper distance. The
   bars guarantee the ratio; this bar asks whether the ratio still *reads*.
4. **The game labels are still legible at noon.** The recognition surface — the
   thing that hit 1.08:1 and killed the last attempt.
5. **The far ridges still recede at noon.** Atmospheric perspective survives the
   sky moving.
6. **Two joined terminals agree, with no seam line.** Same sky with no broker
   (both derive from the wall clock), and no stripe at the join at any hour.

## Amendments during the build (appended, nothing above edited)

Two things the spec got wrong or under-specified. Both make the work **stricter**
than frozen; neither relaxes a bar. Recorded here rather than by editing the
text above, per the never-soften-after-observation rule.

### A · The gate samples the whole curve, not the three stops

Direction call 5 said the bars "re-run against each of the three authored
skies". That has a hole, and it is arithmetic: **contrast against a fixed ink is
not monotone in the sky's luminance.** It collapses to 1.0 where the two match
and rises on both sides, so an interior hour can be worse than either endpoint —
a pack could author a legal night and a legal noon with an illegal 4pm between
them. The gate therefore samples `day` at 101 points, evaluates each bar across
all of them, and asserts the worst. Strictly stronger than the frozen wording.

### B · The desk boots `phosphor`, not `DEFAULT_THEME_ID`

The spec (and the plan) called `solarized-dark` "the default and the README
desk". That is true of the **palace**; the terminals desk hard-codes
`TERMINAL_THEME = 'phosphor'` (`src/terminal/TerminalApp.tsx:16`), and the
Electron shell blocks `?theme=` navigation on desk windows (the `will-navigate`
guard in `desktop/src/terminals.ts`). So as specced, the pack Harry actually
boots would have shown **no daylight at all**.

`phosphor` is therefore authored as a third pack. Measured headroom put it on
the lift axis (max sky relLum 0.0147 vs bg 0.0030 — ×4.86), which matches
IDEAS.md's 7/10 finding, and its skies stay monochrome green because that is the
machine: for a phosphor CRT, "day" is the tube warmed up.

**Bar 1 gains phosphor as a subject; it does not lose solarized-dark.** The
kill condition is about the hue axis and solarized-dark is still that axis's
subject — adding the boot pack makes the bar cover more, not less.

## Out of scope

- The other seven packs. Three are authored here — `solarized-dark` (hue),
  `catppuccin-mocha` (lift), and `gameboy-dmg` authoring **nothing**, which
  proves the opt-out path costs zero. The rest follow later or never.
- Cloud density, weather, seasons. Separate rungs on the same ladder.
- The desk *surround* — the ~55% of screen that is still the user's own macOS
  wallpaper between the terminal windows. Considered and deferred: it is a
  constraint-free surface, but a lit surround beside terminals that still read
  as night is a contradiction, so it can only ever follow this rung, never
  substitute for it.
