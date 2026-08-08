---
up: "[[Lokilibrary]]"
---

# The being lift — separating an agent from furniture its own colour

**Status**: bars frozen 2026-08-08 BEFORE calibration. Nothing built yet.

## The defect

`src/render/levels/land.ts` `ROLE_KEY` spends reserved being accents on
terrain. Measured over all six desk wings at real desk geometry, two of the
five cohort members collide on the product surface:

| Being | Key | Terrain it shares the key with |
|---|---|---|
| `cat` (`c`) | `orange` | cottage, roof, topsoil, shaft |
| `visitor` (`V`) | `cyan` | monument |

`loki` (magenta) and `archivist` (violet) are clean on the desk — `relic` is
magenta but buried, `hall` is violet but the desk composes no hall. The
collision is identical in all ten packs because `ROLE_KEY` and the cohort's
accents are both global.

**Proven on screen**, on `phosphor`, the pack the desk boots. Moving the cyan
Visitor off the cyan monument changed the vacated cell by **max 2/255 per
channel** (noise); the same being on clear ground changed **41/255**. It is
not drawn faintly — it is not drawn.

**Second hole, same gate**: `smoke-salience.mts` asserts the reservation
through `beingAccentRole(id)`, which `terminalLand.ts:983` uses only as the
fallback for ids outside the cohort. Every drawn being takes
`def.paletteKey` from `cohort.ts`. The gate guards a path production never
runs, and the two disagree about which agent gets which colour.

## Why the obvious fixes are out

Established by measurement, before this spec:

- **Move the being to a free key** — there is none. Of the five keys no
  adjacent terrain uses, `bg`/`bgAlt` fail the frozen being bars in all ten
  packs; `red` fails in four (gameboy-dmg 1.59, cozy-autumn 2.90,
  catppuccin-mocha 3.23, night-drive 3.68); `fgBright` is the player's and
  `fg` is a register inside the gate-enforced `fgBright > fg > fgDim`
  ordering.
- **Per-theme `roles` overrides** — only help if *some* themes fail. All ten
  fail identically.
- **Demote the furniture** (`GROUND_DEMOTE`, the shipped idiom) — tops out at
  **2.72** even at factor 0.45, and darkens terrain in ten judged packs.
- **Transplant `BEING_MIN_CONTRAST 3.0` to the being-vs-terrain pair** —
  rejects 470/588 pairs including obviously distinguishable ones. WCAG is
  luminance-only and one palette's accents are all tuned to similar luminance
  against one dark bg; their separation is hue. Recorded as a negative, not
  adopted.

## The mechanism under test

When a being is drawn into a cell whose role resolves to the being's own
palette key, tint the being by a lift factor > 1 instead of the flat palette
value. Render-side only: no key moves, no `ROLE_KEY` edit, every pack's
terrain byte-identical, `src/procedural/` untouched.

Note `shadeOfInt` (`land.ts:32`) does **not** clamp — `Math.round(255 * 1.3)`
overflows into the neighbouring channel. A lift needs a clamped sibling.

## Bars, frozen before calibration

**Bar A — separation.** The lifted being must reach **≥ 1.5:1** against the
furniture cell it is drawn in, in all ten packs. Inherited verbatim from the
daylight-colour rung, where 1.5 was the project's own measured threshold for
a perceptible change to the same surface ("7 of 10 packs clear separation
≥ 1.5 while holding every bar", STATE.md). Not invented for this slice, and
not to be moved after the numbers are in.

**Bar B — palette integrity.** No channel may clip to 255 that was not
already 255. Clipping shifts hue toward white, which is what
[[style-identity-lives-in-omission-not-palette]] and the gameboy-dmg kill
were about: a pack's identity is the read, and a washed accent breaks it.

**KILL.** If no single lift factor satisfies A and B simultaneously across all
ten packs, the lift is refuted. The fix then has to come from re-keying the
monument + the orange structure roles, or demoting them — both of which
re-open ten judged eyeballs, and that is Harry's call, not a dial.

## First test

The move-and-diff that proved the defect: place the colliding being on the
furniture, capture, move it to clear ground, capture, diff. The vacated cell
must change by **more than noise** — the pre-fix reading was max 2/255.

---

## RESULT — the lift is KILLED at calibration, before any code (2026-08-08)

The frozen kill fired. No lift factor satisfies A and B in any pack, let alone
all ten, and the reason is structural rather than a matter of tuning.

**Bar A fails at every factor, and it plateaus:** worst separation is 1.27 at
×1.28 and still 1.31 at ×2.5. **Bar B fails everywhere too.** The two are the
same fact — the accents are already at or near channel maximum, so clamping
eats the lift and ×2.5 resolves to the same colour as ×1.8.

Headroom before clipping, per pack, at each colliding accent:

| Pack | archivist | cat | visitor |
|---|---|---|---|
| solarized-dark | ×1.30 | ×1.26 | ×1.58 |
| gruvbox-dark | ×1.44 | **×1.00** | ×1.33 |
| catppuccin-mocha | ×1.03 | ×1.02 | ×1.13 |
| tokyo-night | ×1.18 | **×1.00** | **×1.00** |
| ibm-3270 | ×1.25 | **×1.00** | ×1.50 |
| phosphor | **×1.00** | **×1.00** | ×1.11 |
| night-drive | **×1.00** | **×1.00** | **×1.00** |
| cozy-autumn | ×1.52 | ×1.19 | ×1.29 |
| amber-crt | ×1.25 | **×1.00** | **×1.00** |
| gameboy-dmg | ×1.48 | ×1.48 | ×1.36 |

`night-drive` has no headroom on any accent; `phosphor`, the pack the desk
boots, has none on two of three. An accent like `#ff9f40` is already `R=255`.
**A being cannot be made brighter, because it is already the brightest thing
its palette can say in that hue.** That is what "beings own the loud register"
bought, and it is why the lift is not a dial that was set wrong.

## What replaces it — the same separation, applied to the side with headroom

Beings are pinned at the palette value; furniture is not. Measured against the
**same two bars, inherited verbatim, not retuned**, plus the `RAMP_STEP0_MIN
1.1` a darkened role still has to keep:

| Factor | Bar A (≥1.5) | Ramp step 0 (≥1.1) |
|---|---|---|
| ×0.78 — literally "one ramp step" | **1.47 FAIL** (ibm-3270 visitor/monument) | **1.01 FAIL** (gameboy-dmg monument) |
| **×0.6 — the shipped `GROUND_DEMOTE`** | **2.06 PASS** (solarized cat/cottage) | **1.16 PASS** (gameboy-dmg monument) |
| ×0.5 | 2.47 PASS | 1.26 PASS |

So "one ramp step" is too small on *either* side, and the factor that works is
the one already in the tree for `crust` and `foliage`. Bar B is satisfied by
construction: darkening never clips.

**Trigger set, from the measurement rather than from the earlier
8-neighbourhood count.** The proven defect is a being drawn *into* a cell — the
own-cell role at `surface[x] - 1`. Over six wings, 318 columns, that is only
**`cottage` (5.0%) and `monument` (2.5%)**. `roof`, `topsoil` and `shaft` share
the orange key but never occupy a being's own cell. `fgDim` roles (ridge,
skyDither, edge, signpost — 47.8% of columns) are excluded on purpose: `fgDim`
is the **ghost's** key, and the ghost is a documented exception, deliberately
barely-there. `being` is excluded because `hideBakedLayers()` means the desk
never draws it.

**Change of shape recorded, not hidden:** this slice was specced as a change to
how beings are drawn and became a change to how two furniture roles are drawn.
The cost moves with it — `cottage` and `monument` get darker in all ten packs,
which is judged terrain, and it goes on Harry's eyeball.

---

## SHIPPED 2026-08-08

**One more thing the calibration got wrong, caught by the real gate.** The
sweep above predicted gameboy-dmg's ramp step-0 at 1.16 PASS; the style-pack
smoke measured **1.01 FAIL** on `monument` and 1.08 on `cottage`. The
calibration had used the *default* `GRADIENT_FACTORS` and `bg`, where the
product uses the pack's own `landRamp.factors` and its drawn sky. DMG ramps
both roles (factors `[0.45, 0.6, 0.78, 1.0]`) and does not omit them, so
demote × ramp compounded two darkenings past a frozen bar.

`RAMP_STEP0_MIN 1.1` was **not** touched. Instead `landRoleFill` now **caps**
rather than multiplies: for a role that is both demoted and ramped, the step
factor becomes `min(f, demote)`. The collision lives at the role's BRIGHT end —
a being's flat accent against the brightest step — and `RAMP_STEP0_MIN` guards
the DIM end, so capping darkens exactly the end that needs it and leaves the
pack's authored floor untouched (DMG step 0 stays `min(0.45, 0.6) = 0.45`,
byte-identical). No-op for the two roles the demote already shipped for:
`crust` and `foliage` are in `LAND_RAMP_LOCKED`, so they are never handed a
step and never reach the new branch.

**Gate.** `smoke-salience.mts` 21 → 28 assertions, covering both holes:
- The **primary tint path** — every `COHORT` accent is a reserved key or the
  ghost's documented `fgDim`. The four pre-existing checks resolve through
  `beingAccentRole()`, which `terminalLand.ts:983` uses only for ids outside
  the cohort; they were guarding a branch production never runs.
- The **separation bar** — ≥ 1.5:1 between every being and any role its own
  cell can hold, in all ten packs. The own-cell role set is *derived* by
  composing the desk's six wings at two widths, not hard-coded, so a new
  structure role joins the bar for free; and the hidden-layer exclusion is
  **parsed out of `hideBakedLayers()`** rather than restated, so un-hiding a
  layer re-arms the bar instead of leaving this gate stale.
- Vacuity guards on both derivations (`cohort is non-empty`, `own-cell role set
  derived`, `hideBakedLayers parsed`), because a gate that silently derives an
  empty set is the exact failure this slice exists to fix.

**Mutant-checked four ways, all red:** demote reverted → the bar names all ten
packs at 1.00; demote at 0.78 (literally one ramp step) → 1.47/1.48, which is
the calibration's predicted margin and proves the bar discriminates at the
tenth; `hideBakedLayers` parse broken → three checks fail together; a cohort
accent moved off the reserved pool → the primary-path check fails.

**First test PASSED on the running desk** (macOS, two-window desk, frontmost —
an occluded window renders nothing and would pass vacuously). Same experiment
as the one that proved the defect, same being, same cell: moving the cyan
Visitor off the cyan monument now changes the vacated cell by **max 76/255 per
channel**, against **2/255** before the fix. The `V` reads as a bright figure
against a muted teal column.

69 smokes, `npm run typecheck` (src + worker) and `cd desktop && npm run build`
all green. Shots: `fix-on.png` / `fix-off.png`.

**Open for Harry's eyeball — the cost, stated plainly:** `cottage` and
`monument` are darker in all ten packs. On screen they still read as a building
and a tower, and the darkening is the same 0.6 the lawn has worn since the
salience campaign — but this is terrain that has been through judged eyeballs
(gameboy-dmg's bands, cozy-autumn, night-drive, amber-crt), and if a monument
now reads as sunken rather than muted, the dial is the two entries in
`GROUND_DEMOTE` and 0.5 / 0.78 are both measured (0.78 fails the separation
bar; 0.5 passes with more margin).
