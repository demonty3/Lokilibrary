# Plan — daylight colour

Spec: `docs/superpowers/specs/2026-08-07-daylight-colour-design.md` (bars frozen
`fd260df`, before implementation). This plan carries the tasks; the spec carries
the reasoning and the six eyeball bars.

> **OUTCOME 2026-08-07: the mechanism is KILLED by its own calibration, before
> anything reached a screen.** Tasks 1–3 were built and are green; task 5's
> calibration pass then measured direction call 1's mix against the frozen
> being-salience bar and it fails at every visible strength. The implementation
> is reverted; `git stash@{0}` holds it. The desk is byte-identical to
> `3babdc4`, the world clock stays HELD, and its precondition has NOT landed.
> Numbers and the disposition are in **§ Result** at the foot of this file.

## Task 1 — NEEDS-CHECK: hard-coded dark sites in the sky band · RESOLVED

The spec's one open question, answered before anything was drawn.

**Found: one, and it is in the sky path.** `src/render/fx/glow.ts:31` —
`const float THRESHOLD = 0.2;`, a bright-pass bloom that "keeps only what clears
a brightness threshold". Its whole design assumes the only bright things in the
filtered container are glyph ink ("dim texture never blooms"; "Beings own the
brightest accents, so they get the loudest halo").

The land container's background panel (`land.ts:261`) is already **inside** the
filtered container — `world.addChildAt(sceneContainer, 0)` (`terminalLand.ts:464`),
`world.filters = [glowFilter]` (`:452`). It does not bloom today only because
every shipped `bg` is dark. A sky lifted toward `blue` at noon would clear 0.2 in
at least one channel on every theme, and **the entire sky would bloom** on a glow
pack. That is not a dial; it is a category error — sky is not ink.

The other dark-assuming sites were checked and are all outside the sky band or
harmless: `ansiSpike.ts:90` (`0x050505`) is the V0 preview surface and does not
reach the desk; `terminalLand.ts:457` (`0x000000` @ alpha 0.16) is the scanline
overlay, which darkens by design; `cell.ts:664` is a palace note box; `shadeOf`
is darken-only and the ramp's last factor is frozen at exactly 1.0.

**Resolution — the sky is drawn OUTSIDE the filter, not dimmed to fit it.**
`world` is statically positioned: `world.scale.set(WORLD_SCALE)` once
(`:433`), `world.x` / `world.y` assigned at mount and resize only (`:469-470`),
with no per-frame camera. So an unfiltered sibling in `viewport` costs two
assignments at two existing sites and needs no per-frame transform sync.

**This is provably a no-op on every shipped theme**, which is why it is safe to
do as part of a visual slice:

| theme | bg | max channel | fx |
|---|---|---|---|
| amber-crt | `#140a00` | **0.078** | glow, scanlines |
| gameboy-dmg | `#0f380f` | 0.220 | — |
| solarized | `#002b36` | 0.212 | — |
| night-drive | `#150d26` | 0.149 | scanlines |
| *(others)* | | ≤ 0.180 | — |

`amber-crt` is the only pack with `glow`, and its backdrop sits at 0.078 —
far below `THRESHOLD 0.2`, so it contributes exactly zero to the bloom today.
Moving it outside the filter changes no pixel. (gameboy-dmg and solarized clear
0.2, but neither has glow; noted as a latent trap for any future pack that pairs
a lifted `bg` with glow.)

Rejected alternative: bounding `DAY_SKY_MIX` under the threshold instead. For
amber-crt that caps the mix at ~0.196 — a daylight almost nobody would see —
and it would cap it globally for the sake of one pack's filter.

## Task 2 — Curve, palette maths, pack slot

- `ambient.ts`: `daySkyMix(daylightLevel)` — pure, Pixi-free, smoke-reachable.
- `land.ts`: `skyInkOf(theme, daylightLevel)` beside `mixToward`. **Returns
  `palette.bg` exactly at 0** (eyeball bar 2 is arithmetic, not taste).
- `types.ts`: `daySky?: PaletteKey | null`, default `'blue'`, `null` = opt out.

## Task 3 — Sky as an unfiltered backdrop

`buildLandContainer` draws the sky per column (rows `0 … surface[x] - 1`, from
`model.surface`, already on `LandModel`) as a white-filled `Graphics` carrying
its colour in `.tint`; it stays a child of `container` by default, so the V0
preview and the palace are byte-identical. It is also returned, so
`terminalLand` re-parents it into an unfiltered sibling of `world`.

Per column, not one flat rect: the surface undulates, and a flat rect at the
topmost ground row leaves un-skied dark patches over every valley.

## Task 4 — Far planes and mural track the sky

`landRoleFill` gains an optional `skyInk` defaulting to `theme.palette.bg`, so
every existing caller — including the frozen smoke bars — is byte-identical
(the `opts.mural` / `opts.skyline` absent-is-identical pattern). `FAR_FADE`
roles bake white and carry colour via `.tint`, initialised to today's exact
value, so they can track the hour without a rebuild. Mural backing follows
`skyInk`.

## Task 5 — Calibrate, freeze, mutant-check

New bars per the spec. Calibrate on the ten-theme corpus, freeze, and write
each threshold as an **absolute value, never in terms of the constant it
guards**.

## Task 6 — Release the clock, author the packs

`CLOCK_HELD = false`; `HELD_SKY` out; `debugClock` stops reporting `held`.
`gameboy-dmg` takes `daySky: null` (protects a judged artifact). Packs whose
`blue` breaks their identity name another key — **phosphor is the known case**:
its terminal registers are monochrome green but its `blue` is a real `#4f8cff`,
so the default would put a blue sky over a green world.

## Result — the mix mechanism is dead, measured not eyeballed

Tasks 1–3 built clean (typecheck green, `smoke-ambient-phase` 81 → 85). Task 5
then calibrated `DAY_SKY_MIX` on the ten-theme corpus, which is where the
mechanism died. **No screenshot was involved and none was needed**: the frozen
bar is arithmetic, so the kill is arithmetic.

### The exchange rate, and why nothing survives it

`BEING_MIN_CONTRAST = 3.0`, and beings are drawn one row above the ground —
a sky cell — so the sky is their contrast denominator.

| sky mix | worst being vs sky | worst midnight→noon separation |
|---|---|---|
| 0.00 (today) | **3.258** (solarized/orange) | — |
| 0.05 | 3.049 | 1.03 |
| 0.10 | **2.843 — BREAKS 3.0** | 1.06 |
| 0.15 | 2.681 | 1.09 |
| 0.30 | 2.044 | 1.20 |
| 0.50 | 1.415 | 1.35 |

The shipped desk clears the frozen floor by **8%** (3.258 vs 3.0). That entire
budget is spent by a mix of **~0.06**, where the midnight→noon separation is
about **1.03** — a sky nobody can tell has changed. A separation that reads as
daylight needs roughly **0.3**. The budget is five times too small, and the
shortfall is not a dial away.

### The rescue was measured too, and also fails

Holding the sky's bottom rows at `bg` (a horizon band) exempts beings by
construction and frees the cap. It does not help: the next binding constraint is
the far planes, which cap the mix at **0.15** — separation 1.09, still invisible.

### The finding underneath both

**The desk's sky is not a background; it is the primary drawing surface of the
whole world.** Twenty-two land roles can occupy a cell above the surface line,
plus every being, plus the site labels that carry the game names. Its colour is
therefore the contrast denominator for nearly everything on screen, which is
exactly why the original design made `ROLE_KEY.sky = 'bg'` and never drew it.

Measured across the corpus, at mix 0.50, **209 of 210 role × theme pairs fall
below their own baseline contrast**, including `label` and `signpost` at
**1.08:1** — the game names, the recognition surface, effectively gone. At 0.30
it is 206/210 with ten roles under 1.5:1.

Any mechanism that raises the sky without raising the ink drawn on it trades
legibility for daylight at a fixed rate, and the frozen contracts spend the
whole budget before the change becomes visible. **This is eyeball bar 1's KILL
condition firing at calibration time rather than on screen** — "the mix is the
wrong mechanism; stop dialing and go back to the day/night register".

### Disposition

- **Sky-lifts-toward-an-existing-palette-key: KILL.** Two-sided, measured, on the
  full corpus. Do not re-attempt by dialing.
- **Daylight colour as a rung: PARK.** Not refuted — unbuilt. Precondition, and
  it is a decision about the *authoring contract* rather than an implementation
  choice: a mechanism that moves sky and ink together (a day/night palette
  register), or a mechanism that expresses the hour without touching the
  contrast denominator at all.
- **The world clock stays HELD.** `CLOCK_HELD` was released during task 3 and
  is now restored. The thing it was waiting for did not land.
- **Worth reviving from `stash@{0}` for any successor**: the glow-filter trap
  and the backdrop fix (task 1). That is a real latent bug for *any* bright-sky
  work and it is independent of which mechanism wins.

### Two-sided bars, honoured

The confirming result would have been: a mix exists at which every frozen bar
holds and the midnight→noon separation reads as daylight. The killing result
would have been: the bar breaks before the change is visible. The second
happened, on the first corpus sweep, with no criterion touched after the fact.

## Task 7 — Sweep and verify live

Full smoke sweep, both typecheck legs, `cd desktop && npm run build`. Then on
the joined two-window desk **with the window frontmost** (a throttled or
occluded window passes vacuously): forced noon / dusk / midnight via the
existing `__terminal.debugClock(hour)`, both windows agreeing with no broker,
beings legible at noon, far planes still receding, DMG unmoved. Shots to
`docs/design-reviews/2026-08-07-daylight-colour/`.
