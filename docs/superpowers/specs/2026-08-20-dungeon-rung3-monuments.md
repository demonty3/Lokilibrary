# Dungeon economy, rung 3: the shrine, the spend, and watchable veneration

Spec frozen 2026-08-20, before implementation. Context loaded per the routing
block in IDEAS.md (main ladder + Addendum 2 — monuments with teeth, watchable
veneration). Harry's four direction calls, made in the planning session: the
spend decision is PERSONA-DERIVED and zero-LLM (reflection-driven spending is
a later rung); the buff is a WARD (veneration lowers per-delver death odds);
the monument stands on the SURFACE of the delver wing's land, built in
visible construction stages; reinvestment buys a BIGGER COLONY (cap past the
founding 3-5, recruits on the existing road). One routing inference flagged
and approved with the plan: timid personas fund the monument (civic,
patient), bold ones reinvest (direct, selfish). Grading rubric for the
spec-reviewer.

Calibration note (order of operations, on the record): the ward constant,
spend reserve/tranche, and shrine thresholds named in the plan
(WARDED_ROUND_DEATH_CHANCE 0.07, reserve 40, tranche 60, stages [60,180,360])
are implementation, free to re-tune before the smokes freeze their measured
outcomes; the bars below are frozen now and are not.

## Purpose

The spend rung. Gold has only ever accrued; now the society spends it, and
who does the spending shows in what the wing becomes. A timid dispatcher's
tranches raise a shrine above ground in visible construction stages —
wealth from below made architecture; a bold one's tranches grow the colony
below. Once the shrine is complete, every expedition's dispatch walk gains a
first leg: the being visits the shrine, bows, and only then walks to the
shaft — and the party descends warded, dying less often, because the walk
happened. The buff's cause is a scene, not a stat. No LLM calls, no numbers
on screen, no user gating.

## Done means

1. The spend decision is persona-derived and pure: deterministic per
   (dispatcher, state), taking ZERO draws from any expedition prng stream
   (rung-1/2 determinism untouched by construction).
2. Ward kill test, two-sided, as a smoke: over ≥8000 runs on the SAME
   per-run seed streams, warded vs unwarded per-delver death rates differ by
   MORE THAN 1 percentage point (CONFIRM the ward is real), AND the warded
   rate stays at or above 0.5× the unwarded rate (a ward, never god-mode).
   KILL low side: the ward is statistically illegible — monuments revert to
   expression-only.
3. Watchable veneration (Addendum 2's kill condition, verbatim): if the buff
   is only legible as a modifier in a log — no watchable veneration on the
   desk — it fails the spatial rail and monuments revert to expression-only.
   The pre-expedition walk visibly visits the shrine before the shaft;
   `debugDelve` exposes the leg phases as harness ground truth.
4. Determinism regression: `smoke-delve.mts` (130) and `smoke-delve2.mts`
   (41) stay green and byte-untouched; unwarded expeditions are byte-identical
   to rung 2 — the ward changes a threshold, never the count or order of
   prng draws.
5. The shrine stands on the wing's surface near the shaft mouth, collides
   with no composed land structure, is visually distinct from the
   mastered-game monument, and rises in construction stages: `shrineStage`
   is a pure monotone function of `monumentFund`, and the fund never
   decrements — the shrine only ever grows. The `hoardStage`
   function-monotonicity bar is inherited verbatim; supersession on the
   record: spends may now shrink the rendered hoard pile by stages (rung 2's
   "stages only ever grow" described a world without a spend).
6. Reinvestment raises the effective colony cap by one per spend up to a
   hard absolute cap (`POPULATION_HARD_CAP`); recruits arrive on the
   unchanged `tickArrival` road, one at a time. Rung-2-shaped blobs load
   with defaulted fields — no schema bump, no migration.
7. No numerals: the shrine glyph rows and the shrine vocab lines carry no
   digit and only already-covered glyphs — smoke-asserted on the exports,
   eyeball-asserted on the world surface.
8. Typecheck (src+worker and desktop legs) and the full smoke sweep green;
   shrine stage, cap raises and ward eligibility survive an app relaunch for
   free (derived from the already-persisted blob — no state outside it).
9. Eyeball (Harry): the veneration walk reads as ritual, not pathing noise;
   the shrine reads as wealth-from-below made architecture. KILL: idle-game
   read — re-cut pacing, never add UI.
10. Inherited kills verbatim: a number appears — remove it, never restyle
    it; the hoard or shrine reads as a gauge or confetti — re-cut shape or
    thresholds, never animate into legibility.

## Out of scope

The rung-4 DM / skill cookbook. Pack dialects for the shrine (Addendum 2's
rung-4 constraint is noted, not built). Corruption, guilds, sponsorship.
Addendum-9 display work. Any LLM involvement or new AI call site. Memorial
for the lost and the changed dispatcher sprite (still on the ladder).
Veneration decay and persona-gated veneration. Multiple or typed monuments.
DM-priced monuments. Any `delve_state` schema bump.

## Constraints

The spend routes by `directiveBoldness` — the same temperament axis the
rung-2 directives key on, so how a being delves and how it spends agree. The
ward is a threshold swap inside `runExpedition`, never an inserted draw. The
shrine draws in the surface window's convention (direct BitmapText,
decor.quiet ink, static — no pulse, no fill animation), from a glyph set the
coverage smoke already carries, placed by a deterministic scan outward from
the shaft column over sky-only footprint. The engine stays pure and
PIXI-free; terminalLand owns wiring, and the surface window remains the sole
writer of the blob. One marginalia line per completed shrine stage, in the
spending dispatcher's voice, through the shipped recordMark surface.

## Kill conditions

- **A number appears.** Remove it, never restyle it.
- **The ward is statistically illegible** (bar 2 low side fails) — monuments
  revert to expression-only; nothing mechanical ships.
- **No watchable veneration on the desk** (bar 3) — monuments revert to
  expression-only.
- **The shrine or hoard reads as a gauge or confetti** — re-cut shape or
  thresholds, never add UI, never animate it into legibility.
- **Idle-game read at the eyeball** — re-cut pacing, never add UI.
