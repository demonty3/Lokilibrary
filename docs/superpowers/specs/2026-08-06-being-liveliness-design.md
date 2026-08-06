# Static-beings liveliness — a standing being reads as someone holding still

**Date:** 2026-08-06
**Programme item:** static-beings liveliness (STATE.md's flagged next item,
picked up the same day the launcher beat closed the T2 remainder).

## The problem, located

The entire steady-state draw of a being is two lines, `terminalLand.ts`
1462-1463:

```ts
b.text.x = Math.round(b.x * CW);
b.text.y = surfaceLocalY(b.x) + Math.sin(elapsedS * BOB_HZ * 6.283 + b.bobPhase) * BOB_PX;
```

One 1.6 Hz / 1.5 px sine, running identically whether the being is sprinting
or standing still. The bob therefore carries no information. `b.dir` is
tracked, updated by every intent branch, and never reaches the sprite: there
is no facing. There is no gait, no idle behaviour, no glyph variation.

The dead time is real and long. `INTENT_S = [6, 6]` gives 6-12 s per intent,
multiplied by `persona.intentWindowMult` (cat 1.3, ghost 1.5, so up to 18 s),
plus a 0.3-0.8 s `HESITATE_S` freeze after every re-pick. `rest` holds `vel`
at 0. `approach` walks and then stands inside `APPROACH_NEAR = 0.4` — the
code comment says "linger at the structure: stand, keep bobbing". Cat and
ghost are the worst offenders: most rest-biased *and* longest windows. A
being can be a motionless glyph for eighteen continuous seconds.

The result is that the desk's inhabitants read as props between walks, which
undercuts the whole agents-as-beings premise.

## Direction calls (taken before any code)

1. **Purely render-side.** No change to `beingIntents.ts`. Everything the
   animation needs (`moved`, `b.dir`, `b.intent.kind`, `dt`, `elapsedS`) is
   already in the being loop. An `idle` intent kind would either score —
   breaking the smoke-enforced persona dominance proof
   `0.75 + bias.watch_edge >= max(...)` — or never score, making a second
   `errand`-shaped dead union member. The fix for a long window is to make
   the window *interesting*, not to shorten it: cat's 1.3x and ghost's 1.5x
   are deliberate characterisation, not a bug.
2. **The glyph is the being.** No mirror-flip for facing (a mirrored `A`
   reads as broken lettering, not as turning), no posture-glyph swap, no
   blink. The identity glyph is written once at spawn and stays.
3. **Alpha stays the *leaving* channel.** Exit/enter juice, through-door,
   return and presence already own alpha. A resting being at 0.88 would be
   indistinguishable from one mid-fade — a legibility regression, not a gain.
   Intent legibility comes from motion.

## The moves — three, plus one hygiene fix

### M1 — Split breath from gait; drive gait by distance, not time

Standing is a slow shallow **breath** (0.5 Hz, 0.9 px, symmetric, reusing the
existing per-being `bobPhase`). Walking is a **gait** hop whose phase advances
by `|dx| * GAIT_CYCLES_PER_CELL`, shaped `-|sin|` so the body rises off the
ground line and never sinks below it. `moving` ramps between the two over
`MOVE_BLEND_S`.

Because gait phase rides *distance*, persona speed becomes visible for free
(a fast Loki trots, a slow ghost paces), `WATCH_DRIFT 0.4` reads as *slowing
down* rather than as the same bob at a lower x-rate, and arriving at an
`approach` target crossfades gait to breath in ~0.2 s — which reads as
*settling*, with no code for settling.

What a viewer reads: **that one is walking, that one is standing.**

### M2 — Facing as an eased sub-cell lean

A render-only `face: 1 | -1` eases `lean` toward `face * LEAN_PX` over
`LEAN_S`. A standing being visibly *holds* a direction; a turn is a 0.25 s
slide of the glyph across its own cell, which is exactly the sub-character
motion the medium exists for (CLAUDE.md's "sprites can move between cells").

`face` is deliberately separate from `b.dir`. `b.dir` rides the seam handoff,
the near-edge reports and `state()`; an idle turn must never perturb it.
Nothing outside the render lines reads `face`.

### M3 — Idle beats

Every `IDLE_BEAT_S` (2.2-4.8 s, seeded) of zero movement, a `IDLE_BEAT_DUR`
(0.8 s) half-sine excursion of `IDLE_BEAT_PX` in the facing direction;
`IDLE_TURN_CHANCE` (45%) of beats flip `face` first, so the excursion carries
the turn. A 6-18 s rest then contains 2-7 small events instead of nothing.
`approach`-linger and broker-`pending` inherit it free — a being waiting on
the broker fidgets, which is correct.

This is the direct answer to the dead-time problem and the highest-value move
for cat and ghost.

### Hygiene: half-pixel snap

Render x is `Math.round(b.x * CW)` — whole-pixel snapped, which would eat a
1.3 px lean at low world scale. It becomes a **half-pixel** snap of
`x * CW + lean + beat`: crisp at `WORLD_SCALE 2` (0.5 local px = 1 screen px),
still genuinely sub-cell. Total excursion caps at
`MAX_SUBCELL_PX = LEAN_PX + IDLE_BEAT_PX = 2.4 < CW / 2 = 3`, so it can never
read as a cell step. Smoke-asserted, not assumed.

## Rejected

- **Intent-legible alpha** — collides with the leaving channel (above).
- **Sparks or mark-reveals from an idling being** — `maybeMark` already fires
  `at_structure` / `mid_wander` on the re-pick clock and `pickReveal` already
  unfurls captions on proximity. A second ambient emitter double-punctuates
  the same beat and adds moving glyphs to a wallpaper. Sparks stay what they
  are: the crossing's one-shot.
- **Blink / glyph variation** — the identity rule.
- **Per-persona animation tuning tables** — speculative; persona already
  reaches the animation through `speed` (gait) and window length (beats).
- **Shortening `INTENT_S`** — fights the personas; it is bar 4's escalation
  path only, and as a separate slice.

## Architecture

New pure module `src/terminal/beingAnim.ts` in the `siteLabels.ts` / `wear.ts`
posture: PIXI-free, owns its consts, smokeable headlessly. `terminalLand.ts`
gains the `BeingAnim` fields on `Being`, seeds them in `addBeing` from the
existing `fnv1a` + `rng()` streams, runs one block in the being loop, and
changes the two render lines. The `away` / `throughSince` / `returningSince` /
`exitingSince` branches keep their own juice and their `continue`s untouched.

All animation is driven by `elapsedS` and `dt` (deltaMS-accumulated), never
wall clock — so it freezes cleanly under the wallpaper throttle, unlike the
wisps and away-timers which deliberately use `Date.now()`.

## Verification plan

**Smokes** — new `scripts/smoke-being-liveliness.mts`, each invariant with a
mutant that must make it fail (the `regression-test-must-fail-on-prefix-code`
discipline; every mutant is run before the smoke is trusted):

| Invariant | Mutant that must fail it |
|---|---|
| Gait rides distance, not time: 100 calls at `moved = 0` leave phase bit-identical; doubling `moved` doubles the delta | advance by a fixed per-call step, or by `elapsedS` |
| Throttle-safe: `stepMoving`/`stepLean` at `dt = 0` are no-ops; a full ramp takes exactly `MOVE_BLEND_S` / `LEAN_S` | drop the `dtS <= 0` guard |
| Facing legible but never a cell step: `stepLean` converges to `face * LEAN_PX` with matching sign; `MAX_SUBCELL_PX < CW / 2` | flip the sign in `stepLean`; raise `IDLE_BEAT_PX` to 2.5 |
| Standing alive, walking a gait: a 4 s idle is never flat; the gait excursion exceeds the breath excursion at `moving = 1`; the gait never dips below the ground line | `BREATH_PX = 0`; replace `-abs(sin)` with plain `sin` |
| Beats only while stationary, bounded, jittered: 12 s idle gives 2-7 beats; 12 s walking gives 0; two beings do not share a schedule | remove the `moved === 0` gate; make the cadence constant |
| Determinism: same seed gives an identical beat/turn sequence and an identical `dx`/`dy` trace | seed from `Date.now()` |

Plus the full smoke sweep and both typecheck legs green, and
`smoke-t1-being-intents` passing **unchanged** — the engine must be untouched.

**Debug hook**: `__terminal.debugBeings()` in the `debugDepth()` mould,
returning per being `{ id, x, dx, dy, face, moving, beat, intent }` where
`dx`/`dy` are the **drawn** sub-cell offsets, not the model x. `state()` and
`TerminalLandState` are unchanged.

**On screen** via `scripts/e2e/term-drive.mjs`, window frontmost (a throttled
window's ticker barely runs and would pass vacuously):

1. `debugPlace('cat', 20, 1, true)`, two `debugBeings()` samples ~700 ms
   apart: `dy` differs by >= 0.5 px and `|dx| < 3` in both.
2. An unparked Loki over ~2 s: `moving > 0.9` while `x` changes, and the `dy`
   slope changes sign at least twice (a cycling gait, not a drift).
3. Poll a parked being for <= 20 s: `face` flips at least once and `beat` is
   observed `true`.
4. After `debugPlace(id, x, -1)` plus 1 s of walking: `face === -1` and
   `sign(dx) === -1`.
5. Nothing regressed: `debugDepth()` sway offsets and `debugLaunch()`
   unchanged; a live crossing on a joined two-window desk still fires.

## Eyeball bars (frozen now, before implementation)

Shots and a live watch, `docs/design-reviews/2026-08-06-being-liveliness/`.
Per bar: at most the single named dial, then the kill fires. No bar may be
softened after shots exist.

1. **Standing life.** A parked being reads as alive and holding still —
   breathing, not vibrating. KILL (dead side): it still reads as a prop at a
   glance → raise `BREATH_PX` to 1.2 once, then cut breath entirely and let
   idle beats carry idleness alone. KILL (busy side): it reads as nervous
   jitter, or the glyph looks soft or blurred → drop `BREATH_PX` to 0.6 once,
   then revert to a static idle and keep only M2 + M3.
2. **The gait means locomotion.** A walking being reads as stepping, and a
   fast Loki visibly differs from a slow ghost. KILL (dead side): walking and
   standing still read the same → raise `GAIT_CYCLES_PER_CELL` to 1.0 once,
   then cut the split and revert to the single bob. KILL (busy side): the
   walk reads as a hopping cartoon, or strobes against the footfall wear →
   drop `GAIT_PX` to 1.0 once, then cut the gait and keep breath everywhere.
3. **Facing.** A being's held direction is readable at rest, and a turn reads
   as turning, not as sliding or glitching. KILL (dead side): you cannot tell
   which way anyone faces → raise `LEAN_PX` to 2.0 once, then cut facing
   entirely (**not** a mirrored glyph and **not** a posture glyph — the
   identity rule stands). KILL (busy side): the lean reads as the being
   sitting off-centre in its cell, or as drifting between cells → drop
   `LEAN_PX` to 0.8 once, then cut facing.
4. **The dead 6-18 s.** Watch cat and ghost on a closed-edge land for two
   full intent windows: it must read as someone loitering, not as a frozen
   prop. KILL (dead side): the wait still reads as dead → shorten
   `IDLE_BEAT_S` to `[1.4, 1.8]` once, then escalate to the rejected option
   (an idle sub-state in the intent engine) as a **separate slice**. KILL
   (busy side): the being twitches constantly, or the shuffle reads as
   failing to walk → lengthen to `[3.5, 3.5]` once, then cut the shuffle and
   keep turn-only beats.
5. **Cohesion at wallpaper distance.** Five beings on one land at glance
   distance read as a small cohort of individuals, not a carpet of jitter,
   and every identity glyph stays crisp and identifiable. KILL: they read as
   noise, or any glyph becomes hard to identify → halve every amplitude once
   (`BREATH_PX` / `GAIT_PX` / `LEAN_PX` / `IDLE_BEAT_PX`), then cut M3 and
   ship M1 + M2 only.
6. **Nothing regressed.** On a joined two-window desk: crossings (exit/enter
   fade, spark, knit), the errand walk and through-door fade, mark reveals,
   presence fades, foliage sway, wear and label proximity are all unchanged;
   no being ever appears to snap between cells; animation still freezes
   cleanly under the wallpaper throttle. KILL: any of these changed → revert
   the slice and re-land it move by move.

## Out of scope (recorded, not scheduled)

- Per-persona animation tuning tables.
- Blink or glyph variation; a facing marker glyph.
- Idle behaviour driven by an intent sub-state (bar 4's escalation path only).
- Animation for `away` or mid-crossing beings.
