# Land polish #19 slice 2 — monument, constellations + cloud drift, ore veins, sign posts

**Date:** 2026-08-05
**Programme item:** visual programme #19 (land polish bundle), second slice.
Slice 1 (strata material read, closed-wing skyline, stray-`*` ruling)
shipped 2026-08-02, eyeball PASSED 2026-08-05.
**Programme text:** "monument gets box-drawing architecture + a door; sky
gets constellations/moon/1Hz cloud wisps; deep strata get ore veins +
caverns; site labels become signage." Moon and caverns already exist
(raised-horizon pass / original compose); this slice carries the four
remaining legs. Harry confirmed all four, 2026-08-05.

## Architectural decision

**One deliberate compose-side upgrade + renderer-side cloud drift**
(approach A). Monument, ore, and sign posts stamp into the world model in
`composeLand`; constellations restructure the existing salted-sky star
pass. This changes composed bytes ONCE — a deliberate layout re-roll like
the raised-horizon pass — and the affected test goldens are re-frozen
once, in a commit that says so. No new `ComposeLandOptions` flags: the
skyline-style opt-in gate was slice 1's protection for a mid-round eyeball;
that round is closed, and permanent flags for always-on visuals are
plumbing we don't need (rejected approach B). Render-side redraw (the
strata trick, rejected approach C) is the wrong tool for shapes with
footprints.

Cloud drift is the exception: it is animation, so it lives in the terminal
renderer (`src/terminal/terminalLand.ts`), riding the same `tick` channel
as foliage sway. `composeLand` stays the single static-world author.

## Leg 1 — Monument architecture + door

Today (src/procedural/land.ts:479-481): a 6-tall `▐█▌` column, ` ║ ` at
the top, and a `☼` crown that **borrows the `sun` role** — which is why
gameboy-dmg's sun-omit blanks monument tops.

New monument, ~3 wide × ~7 tall, still the tallest structure class:

- **Body**: box-drawing/block architecture — a footing course, a shafted
  body with window slits, a battlement or spire crown. Exact glyph rows
  are an implementation choice, atlas-gated (every glyph must pass the
  Cozette atlas check; `☀` is the cautionary precedent — not in the
  atlas). Role stays `monument` (glyph-dialect/ramp/omit rules unchanged).
- **Crown**: new role `monumentCrown`, omit-allowed, ramp-allowed. Packs
  now choose crown visibility independently of their sky. gameboy-dmg's
  judged look (blank crown via the sun-omit) is preserved by adding
  `monumentCrown` to its `landOmit` — an explicit pack edit, recorded, not
  an accident of role-borrowing.
- **Door**: 1×1 (or 1×2) opening at ground level, new role `door`,
  glyph-locked like `label` (a door that dialects into noise stops reading
  as a door), omit NOT allowed — a monument without an entrance loses the
  point of this leg. No behaviour attaches in this slice; the role exists
  so the future launcher beat has a place to land.

Placement, slots, seam-buffer and hall-avoidance rules are untouched.

## Leg 2 — Constellations (compose) + cloud drift (renderer)

**Constellations are arrangements, not material.** 2–3 small recognisable
figures per strip (e.g. a W, a plough/dipper, a short arc — 4–6 stars
each), stamped by the existing salted sky PRNG (`skyRng`) from the
existing `star`/`starBright` roles and glyph pools. Inside each figure's
patch the scatter pass is suppressed so local density stays calm — the
sky must not get busier, figures replace scatter rather than add to it.
Because they reuse the star roles, blank-sky packs (gameboy-dmg) stay
blank with ZERO pack edits — the stray-`*` lesson applied by
construction. Figures are placed in the star band, avoiding the sun,
moon, murals rect and skyline silhouettes.

**Cloud drift.** The terminal renderer lifts `cloud`-role cells out of
the static grid into a renderer-owned drifting layer: wisps move slowly
and continuously (sub-cell, a few cells per minute — "1Hz wisps" in the
programme means visibly alive on a wallpaper timescale, not 1 cell/sec),
wrap across the strip's sky width, and only ever occlude sky-register
cells (over structures/murals/skyline they skip or pass behind —
implementation picks the cheaper of the two, the constraint is that the
world always wins). Drift rides `app.ticker` elapsed time like foliage
sway; speed/phase seeded per wisp from the wing seed so two windows on
the same wing agree. Non-animated surfaces (palace ladder, V0, any
static capture path) keep the baked static clouds — the model is
unchanged; the lift is a renderer behaviour. The drift layer respects
the pack's `landOmit`: a pack that omits `cloud` (gameboy-dmg does) gets
no wisps, static or drifting. Throttle states pause drift
with the rest of the tick; a paused sky is acceptable (precedent: the
blink freeze note in STATE.md follow-ups).

## Leg 3 — Ore veins

Short diagonal runs (2–4 cells) of a glinting glyph seeded through
`stone` and `bedrock` bands: new role `ore`, omit-allowed, ramp-allowed,
glyph-dialect-allowed. Placement rules (these are the smoke assertions):

- never in `topsoil`, never inside a cavern pocket, never over the shaft,
  relics, or buried-label rows;
- sparse: ~2–4 veins per strip, capped so the deep band reads as "rock
  with something in it", not confetti;
- deterministic from the strip's land PRNG stream (appended draws — this
  is part of the one deliberate re-roll).

Draw order: veins stamp AFTER the strata fill, and the render-side
material pass (`strataMaterialGlyph`, slice 1) must leave `ore` cells
untouched — it already only redraws undialected strata-fill roles;
`ore` is a distinct role, so this holds by construction and gets a smoke
assertion anyway.

## Leg 4 — Sign posts

Each **surface** site gains a small standing post beside its structure:
1 wide × 2 tall (head glyph over a post glyph, atlas-gated), new role
`signpost`, omit-allowed, ramp-allowed. Placement: deterministic offset
from the site's label anchor, on the surface row, skipped where the slot
would collide with a structure cell, the hall, the seam buffer, or
another site's post (collision → skip, no re-roll hunting; a missing
post is fine, a mangled one is not).

The proximity-reveal behaviour is UNTOUCHED: `model.sites`,
`siteLabels.ts`, fade rules all stay as they are — the revealed name now
visually hangs off a post that was always standing there. **Buried
relics get no post** (a sign underground reads wrong); their reveal is
unchanged.

## What does NOT change

- `composeLand`'s public shape: no new options, no signature change
  (`skyline` from slice 1 stays as-is).
- Murals (#16), marginalia, wear, knit, seam physics, broker topology.
- Site label reveal semantics and `LandSite`.
- The palace / ladder / V0 surfaces beyond receiving the same recomposed
  land (they render the new roles via existing role-default plumbing).

## Pack + theme integration

- New roles `monumentCrown`, `door`, `ore`, `signpost` enter the role
  tables: `ROLE_DEFAULTS`, style-pack schema (`src/themes/types.ts`
  landOmit / landGlyphs / ramp surfaces), and the style-pack corpus
  smoke (301 → re-counted).
- Per-pack review of the shipped packs (8 themes): each pack's landOmit /
  dialect gets a deliberate entry where its identity requires one —
  known: gameboy-dmg adds `monumentCrown` (preserves the judged blank-sky
  + blank-crown look). `door` is exempt from omission everywhere.
- Glyph-coverage smoke imports the new monument/post/ore/constellation
  glyph constants so the atlas gate is mechanical.

## Testing

- **New smokes**: monument shape + door presence + crown role
  decoupling (a sun-omit no longer blanks the crown); ore placement
  rules (band membership, cavern/topsoil/shaft exclusion, count cap,
  material-pass non-interference); signpost placement (surface-only,
  collision-skip, reveal untouched).
- **Extended smokes**: sky smoke gains constellation determinism +
  local-density (figures replace scatter) assertions; glyph-coverage
  gains the new constants; style-pack corpus over the new roles.
- **Goldens**: mural/no-mural and any compose goldens re-frozen ONCE in
  a dedicated commit ("golden re-freeze: #19 slice 2 land re-roll").
- **e2e**: cloud drift gets a readback hook alongside the existing sway
  readback (positions at two ticks differ; wrap works); `debugCellAt`
  covers the new roles.
- **Live verification** (launch-desktop-app skill): solo window, joined
  two-window desk (same-wing drift agreement), gameboy-dmg relaunch
  (blank sky, blank crown, doors present).

## Eyeball bars (frozen now, before implementation)

Shots + a live watch, `docs/design-reviews/2026-08-05-land-polish-slice2/`:

1. **Monument**: reads as built architecture with an entrance — a
   first-time viewer can point at the door. KILL: reads as a noisier
   blob than the old column → revert to the column, rethink at
   mockup level before touching compose again.
2. **Constellations**: at least one figure reads as a deliberate figure,
   and the sky reads NO busier than today's. KILL: sky reads more
   cluttered → remove figures, keep scatter (no tuning round).
3. **Cloud drift**: noticeable within ~10 s of watching; invisible at a
   glance. KILL: it draws the eye from across the room → halve speed
   once; if it still pulls focus, ship static clouds (pull the drift,
   keep the wisps).
4. **Ore**: the deep band reads as "rock with veins of something", not
   confetti. KILL: confetti → halve the count once; still confetti →
   pull the role.
5. **Sign posts**: read as site furniture; the proximity reveal feels
   unchanged. KILL: posts read as stray glyphs → pull the role (omit
   everywhere) rather than redesign in-slice.
6. **gameboy-dmg**: sky still fully blank, crowns still blank, judged
   bands unmoved, doors present.

Per bar: at most the single named iteration dial, then the kill fires.
No bar may be softened after shots exist.

## Out of scope (recorded, not scheduled)

- Door behaviour / launcher beat (walk-in-to-launch) — separate slice.
- Ore interaction (mining, being attention) — nothing attaches.
- Day/night constellation motion — blocked on the shared world-clock
  thread (STATE.md).
- Signage for buried relics.
