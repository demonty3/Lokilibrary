---
up: "[[Lokilibrary]]"
---

# Live state snapshot

The current shape of the data structures and modules that change
between slices. Updated at the end of each slice — `git log STATE.md`
shows when each shape last moved. **Read this once at session start;
re-grep only when this is stale.**

For "what's authoritative" → `docs/INDEX.md`. For day-to-day rules →
`CLAUDE.md`. For the phase plan → `PLAN.md`. For the current
blocked-on-Harry list → `TODO-USER.md`. This file is *the present
tense* of those.

**Direction 2026-07-17 — terminals-first.** Harry deprioritized the
top-down palace view: effort goes to the snappable-terminals version
(docs/PRD-snapping-terminals.md). The palace stays working (v1.0.0
surface, smokes green) but gets no new investment; palace-facing
visual-programme items (#12 shade ramp, phosphor, density) are parked,
land-facing ones (murals #16, land polish #19) stay live. Next slices
draw from the PRD's remaining column: T2-completion runtime (real
cohort + LLM rails in terminal lands), T3 chrome remainder, T4
topology→reflection, T5 orchestration, terminals-as-wallpaper.

**Style-pack surface SHIPPED + cold-tested 2026-07-31** (commit `6676111`).
Themes now carry the three pack slots — 13-key palette, optional
`landGlyphs` glyph dialect (render-side `landRoleGlyph` in
`src/render/levels/land.ts`; label/being/player/crust/edge locked),
optional `fx: 'scanlines'` — gated by `scripts/smoke-style-pack.mts`
(bars calibrated on the six shipped themes, then frozen).
`docs/blueprints/style-pack.md` is the agent-facing authoring spec. The
first cold stranger-agent run (fake synthwave/DOOM feed data) produced
the `night-drive` pack first-try green with zero hand-fixes; Harry's
eyeball passed 2026-07-31 and it is MERGED as the seventh shipped theme
(unedited stranger output). Kill condition ("needs hand-fixing every
run") not triggered; stays armed for future pack runs. **Run 2
(2026-07-31, HAIKU 4.5** — the weak-model floor test): `cozy-autumn`,
gates green with ZERO maintainer hand-fixes; one self-recovered failure
(the smoke named a non-Cozette glyph, the weak agent fixed it from the
error message — the gates work as recovery rails, not just filters).
Harry's eyeball passed same day: cozy-autumn is MERGED as the eighth
shipped theme (unedited stranger output). Tally 2/2; no model-floor
caveat needed in README copy. Next open thread: whether the blueprint
gets top-level README billing (never claim the mechanism novel —
Deephaven 2026-02; scope the claim to the smoke-gated version).

**Ceiling-widening round SHIPPED 2026-07-31 (eyeball gate pending).**
Harry's verdict session: packs should be able to read as *different
machines*, not recolours — the in-medium ceiling (style round 01–08) is
PURSUE; the out-of-medium provocations (09 diorama / 10 manuscript) stay
killed. Two new engine axes shipped as style-pack slots with gates:
**value ramp** (`landRamp` — per-role 4-step shading, step derived
render-side from the role's row extent, top dim → base bright;
`src/procedural/` byte-untouched, proven by a byte-identical V0-preview
screenshot across the hall-path unification) and **glow fx** (`fx` now
string-or-array over `['scanlines','glow']`; single-pass bright-pass
bloom filter on the desk's `world` — `src/render/fx/glow.ts`; gotcha: the
fragment must declare `uInputSize` **highp** or the cross-stage precision
mismatch fails the GL link and the world renders nothing). Darken-only
factor contract (last exactly 1.0) keeps the frozen being-salience bars
sound; new `RAMP_STEP0_MIN 1.1` bar calibrated on the 10-theme corpus and
frozen. Probe packs REGISTERED: `gameboy-dmg` (ramp axis) + `amber-crt`
(fx axis; the blueprint's worked example, now shipped). All gates green
(225 style-pack assertions); scanline probe passes (row dim ratio 0.83);
glow proven by same-theme A/B pixel probe (dark floor beside bright
glyphs: bg-exact 20 without the filter, 48 with). Shots for the eyeball
gate: `docs/design-reviews/2026-07-31-ceiling-widening/`. **Kill
condition (frozen in the plan): if gameboy-dmg at wallpaper distance
reads as "default with a green filter" rather than a different machine,
iterate the pack, never the gates.** Follow-on axes deliberately NOT
built: glyph deletion (08 oscilloscope), light ground (07 e-ink), cold
run 3 over the new slots.

**Omission axis + gameboy-dmg re-cut SHIPPED 2026-07-31, same day
(eyeball pending).** The kill condition above FIRED on gameboy-dmg's
first cut — Harry's eyeball read it as "another reshade". Clean negative
result, two causes: the pack used none of the existing `landGlyphs` slot
(ramp only), and the identity axis of *omission* did not exist (sky
decorations were drawn unconditionally). Shipped: **style-pack slot 5,
`landOmit`** — render-side role deletion in `buildLandContainer`
(`src/procedural/` byte-untouched, mirroring the ramp);
`LAND_OMIT_LOCKED` = glyph-locked ∪ `sky`; strata/structures/celestials
stay omittable by design (this slot IS the deferred 08 "glyph deletion"
axis); `OMIT_MAX 12` emptiness bound set and frozen BEFORE any omitting
pack shipped (12 of the 21 omittable roles — headroom for the maximal 08
stroke-only cut, ~11 fills). gameboy-dmg re-cut to the full slot set:
`landOmit` deletes star/starBright/skyDither/cloud/ridgeFar/moon (blank
LCD sky; every omitted role was a `mixToward` blend diluting the 4-green
read), eleven chunky block/quadrant `landGlyphs` so the ramp's bands read
as solid quantised masses, ramp kept byte-identical, `fx` deliberately
absent (DMG is an LCD, not a CRT). All gates green — style-pack corpus
now **284 assertions** (was 225; the omit checks + the re-cut's glyph
checks); land-atmosphere / land-bands / knit-glow regression trio green.
Shots: `docs/design-reviews/2026-07-31-dmg-recut/` — `gameboy-dmg-before.png`
is the JUDGED artifact copied from the ceiling-widening folder, never
retaken. **Kill condition inherited verbatim from the round above:** if
the re-cut still reads as "default with a green filter" rather than a
different machine, iterate the pack, never the gates. The amber-crt glow
leg of the previous eyeball stays open, unchanged.

**Diorama-neighbour probe OPENED 2026-07-31 (mockup only, no engine
work).** Harry asked a NEW question, distinct from the killed 09: can a
hi-bit diorama world coexist as a *neighbour* — its own terminal window
snapped to the glyph desk, beings re-embodied by each side's renderer as
they cross? The 09-as-replacement kill stands untouched; every prior
sprite kill was about pixels *inside or instead of* the glyph scene, and
VISION.md's per-terminal-identity principle ("the seam is the boundary
… a portal between genuinely different places") already blesses the
neighbour shape. New document with the inherited bars quoted verbatim:
`docs/design-reviews/2026-07-31-diorama-neighbour.md`. **Kill condition
frozen before the mockup was viewed**: if the glyph window reads as
downgraded beside the diorama window — the eye refuses to return to it —
coexistence fails and the diorama stays dead at every scope.
Preconditions for ANY engine work, both unmet: the in-medium round
resolved, and one Phase 3 sprite surviving curation. Probe artefact: a
static joined-pair mockup (same hand-authored technique as the style
page), `2026-07-31-diorama-neighbour.html`. 09/10 collapsed to
tombstones on the style page per its own round-2 protocol.

**Widening round CLOSED 2026-07-31, late evening — eyeballs judged,
track PARKED (depth over breadth).** Harry's verdicts, each against its
bar frozen before viewing: (1) **gameboy-dmg re-cut PASSED** — reads as
a different machine; the omission axis + chunky dialect flipped the read
that fired the first kill. (2) **amber-crt glow leg PASSED** — glows,
not blurred, text stays sharp. Both legs of the ceiling-widening round
are closed green. (3) **diorama-neighbour mockup: MUTATE** — kill did
NOT fire (coexistence unrefuted, unconfirmed); element PINNED 2026-08-01:
the glyph desk's shade-dither crust band reads as rows of unreadable
letterforms ("all of those ae's") to a first-time viewer — and since the
mockup reproduces the shipped desk faithfully, this is a first-contact
legibility finding about the DESK, not the mockup; the fix lives on the
depth track (land legibility), and any re-mock waits for the improved
desk, inheriting the frozen bar. Bars inherit verbatim; both engine
preconditions remain unmet. Full verdict + pin in the decision doc.
**Depth-track input (2026-08-01, from the pin): the crust register fails
first-contact READ** — a stranger can't tell what the dense dither band
IS (Harry: "if i couldn't understand the world I would be confused";
his caveat: live context may teach it — the risk is the clone-and-run
first minute). Concrete evidence for sequencing land-legibility work
(murals / crust material read / labels) inside the depth column. **Direction call (Harry, this session): depth over
breadth.** The remaining widening axes — oscilloscope 08 stroke-only
cut, light-ground 07 e-ink, cold run 3 over the new slots — are
**PARKED** with their kill conditions frozen where they stand; unpark
precondition: *a real pack author needs a slot that does not exist, or
the depth track reaches its bar*. Effort redirects to the
terminals-first column and the land-facing depth items —
marginalia-on-land is the first candidate (spec approved 2026-07-17),
then murals #16, land polish #19, static-beings liveliness. The one
style-track survivor: README billing for the pack blueprint (claim
scoped to the smoke-gated version, mechanism credited to Deephaven).
**New design thread (Harry, same session): shared rules across
terminals.** Joined terminals are lenses on ONE shared world: shared
truths (time of day first; salient events when they exist) should be
*conformed* across windows — a pack may compress or omit a shared truth
(the lossy lens IS pack identity; DMG's blank sky is legal) but may
never contradict it (a sunny sky beside a midnight neighbour breaks the
join). No world clock exists today — the sky is static ambience — so
this is a candidate depth-track slice, recorded, not scheduled (canonical
write-up now at `IDEAS.md` § Shared rules across terminals). The DMG
stray-`*` one-liner is RESOLVED (2026-08-02, land-polish slice 1): the
painter is the celestial **sun** — `☼` role `sun` misread as `*` at desk
scale. Headless survivorship over the composed d0 model showed exactly one
star-like glyph surviving DMG's omit set, `(24,1) ☼ sun` — the pack's
blank-sky omit list never covered `sun`. RULING: pack gap, NOT an engine
leak (`landOmit` filtering works — an omitted role cannot reach a layer);
fixed by adding `sun` to gameboy-dmg's landOmit (blanks monument-top `☼`
too — same role; confirmed blank on screen, flagged for the eyeball). The
mural-frame-edge `*` sighting on a non-omitting theme is a legal
`starBright` beside the frame's cleared rect — FEATURE.

**The hour without colour SHIPPED 2026-08-07 — CODE-COMPLETE, eyeball PENDING.**
The world clock, held since 2026-08-06, is RELEASED. What released it is not the
sky's colour: that rung was specced (`2026-08-07-daylight-colour-design.md`,
bars frozen `fd260df`), built to three tasks, and **killed at calibration the
same day** (`e97a458`) — beings are drawn at `surface - 1`, a SKY cell, so the
sky is the contrast denominator for nearly everything, the corpus clears the
frozen `BEING_MIN_CONTRAST 3.0` by only 8%, that budget is gone by a mix of
~0.06 where midnight→noon separation is 1.03 (invisible), and visible daylight
needs ~0.3. At mix 0.5, 209/210 role×theme pairs fall below baseline and the
site LABELS hit 1.08:1. Implementation reverted to `git stash@{0}`; the
glow-filter trap it found (a lit sky inside the bloom's `THRESHOLD 0.2` input
blooms the whole band) is worth reviving for any successor. **Harry's
correction the same day rescued the idea at a different scope**: the engine is
per-pack slots and every style-pack bar is per-theme, so the *strength* should
be a slot — re-measured, **7 of 10 packs clear separation ≥ 1.5 while holding
every bar** (catppuccin cyan 2.40, amber-crt orange 1.88, phosphor fgDim 1.79,
night-drive green 1.78, tokyo-night cyan 1.71, cozy-autumn orange 1.71,
ibm-3270 magenta 1.53); solarized and gruvbox bind on a being accent already at
~2.98, and DMG has no sky. That is PARKED as slice 2 in IDEAS.md — it sequences
*after* this because `DEFAULT_THEME_ID` is solarized-dark, one of the three.

Shape of what shipped: **position and state, never colour** — the ☼ climbs to
its peak at noon and sinks toward the horizon at dawn and dusk, the ☾
counter-arcs, and the shelf lamps light through the night. Contrast-neutral by
construction. Spec: `docs/superpowers/specs/2026-08-07-hour-without-colour-design.md`
(six bars frozen before code). Leg 1, the only model change: the shelf lamp
splits out of `sun` into its own `lamp` role (the `monumentCrown` split three
days earlier is the same move) — `set()` takes no RNG draw, so no stream moved,
proven by the other 67 smokes staying green while only `smoke-land-mural`'s
whole-model golden saw it (a PAYLOAD re-freeze). gameboy-dmg takes `lamp` in
`landOmit`. New `src/terminal/skyArc.ts` (pure, Pixi-free, the `clouds.ts`
posture) + `smoke-sky-arc` (157 assertions), mutant-checked six ways — five died,
and **the sixth earned its keep by NOT dying**: narrowing `PASSABLE` stayed
green because every occlusion bar used a synthetic `blocked` and nothing checked
what the model actually puts in one.

**Three defects were found ON SCREEN with every smoke green**, which is the
record worth keeping: (1) the body occluded ITSELF — the composer stamps the ☼
into the grid, so its own cell was in its own blocked set and it sat at alpha 0
at every hour; (2) the arc floor used `min(surface)`, the land's HIGHEST point,
so one tall hill collapsed travel to zero; (3) **measured over 60 seeds at real
desk options, the mural evicts the ☼ outright in 42% of lands and the median
survivor is visible over just 33% of its travel** — the mural composes last and
clears its rect, and at desk geometry it dominates the sky, so an arc bound to
the composed cell is simply missing most of the time. The terminal path now
hides the baked sun/moon layers and draws its own, re-placed into the clearest
column — the same answer the drifting wisps shipped for the same cause on
2026-08-06. Two smoke lessons: the suite composed `{width, height}` while the
product composes `skyH/surfaceBand/underH/mural`, so it reproduced none of
these; and "visible over most of its travel" was the wrong measure, since the
bottom of the arc is dawn and dusk where the body is faded out anyway.

VERIFIED ON SCREEN (macOS, two-window desk, frontmost — **the first three
attempts were vacuous**: a shell round-trip between the `debugClock` call and
the `debugSky` read let the window fall behind, and macOS suspends rAF outright
on an occluded window, so only the in-page sequenced run counts). t1: sun
1→10, moon 2→12, counter-arcing. t2: noon sun at peak alpha 0.999 / moon 0 /
**lamp 0**; midnight sun 0 / moon 1 / **lamp 0.632**. Both windows agree in
phase on the real clock with no broker. gameboy-dmg relaunch (`?theme=`): every
body null at both hours. Nothing regressed — mural `ready`, knits
`glowStale 0`, 12 marks, monument pulsing, stars correctly gone at noon. New
`__terminal.debugSky()`. 69 smokes, both typecheck legs and the desktop build
green. Shots: `docs/design-reviews/2026-08-07-hour-without-colour/` — **context
only; a still cannot show an arc, so bars 1-5 are a live watch.**

**Land polish #19 slice 1 SHIPPED 2026-08-02, eyeball PASSED 2026-08-05**
("the shots look right — eyeball passed on all three": strata, skyline,
and the DMG blank sky judged against the pre-frozen bars; neither kill
condition fired, no tuning requested — the slice is fully closed) — the
evidence-first cut: crust material read + closed-wing skyline + the stray-`*`
ruling (plan `~/.claude/plans/let-s-do-the-next-encapsulated-marble.md`; bars
frozen there before implementation). (1) **Strata material read** — the
"unreadable ae's" band was the strata FILL (topsoil/stone/bedrock per-cell
`░▒▓` noise, `src/procedural/land.ts:400-404`), not the `crust` role; fixed
render-side: `strataMaterialGlyph` (land.ts render module, pure, exported)
redraws undialected strata cells in 6-col horizontal runs (per-role two-glyph
class, fnv1a over `(role,y,run)`) so the bands read as quantised masses —
`composeLand` byte-untouched (mural goldens are the proof), pack `landGlyphs`
dialects keep priority so DMG's judged bands never moved; `GROUND_DEMOTE`
topsoil extension reserved as the pre-authorised iteration dial. (2)
**Closed-wing skyline** — `ComposeLandOptions.skyline` (absent = byte-identical,
murals-opt pattern) stamps per closed wing a 3–4-glyph far silhouette
(`WING_SIL_SHAPES`, atlas-gated) + faint wing-id mark, roles `wingSil`
(glyph/ramp/omit-allowed) / `wingMark` (glyph-locked like label, omit-ALLOWED
with its silhouette); placement per-wing deterministic (`fnv1a(wing) ^
0x5117`, zero main/sky-stream draws) with ≤8 fit re-rolls so a tall structure
can't leave a wing unrepresented (other wings' cells count passable → the
final spot is closed-set-independent); draws only over sky/skyDither/ridgeFar
/star cells — the world always wins, the mural rect evicts mechanically.
Broker: topology payloads carry `allWings`; **two live-found broker gaps
fixed** — `broadcastTopology`'s change gate keyed on joins only (a spawn/close
changes the WINGS map without changing joins → skyline never updated) now
keys on joins+wings, and `spawnNext` never broadcast at all. Renderer:
`applyJoins` derives the closed set, folds it into the recompose key.
VERIFIED LIVE (macOS, 2-window RESET desk): d0 shows silhouettes+marks for
exactly d2–d5; tray-parity spawn (d2) lifts its silhouette on the broadcast,
close returns it; joined desk recomposes with seam/knit/murals/marks intact
(`glowStale` 0); DMG relaunch = blank sky, no skyline, judged bands unmoved.
(3) **Stray-`*` RULED, thread closed** (see the widening-round paragraph).
New smokes `smoke-land-material` (9) + `smoke-land-skyline` (11); style-pack
corpus 301; glyph-coverage imports `WING_SIL_SHAPES`; broker-handoff expects
`allWings`; full 58-smoke sweep + both typecheck legs green. New e2e hook
`debugCellAt(x,y) → {char, role}`. Shots for the eyeball:
`docs/design-reviews/2026-08-02-land-polish-slice1/` (solo d0, joined desk,
DMG). **Frozen bars for Harry's eyeball:** strata — a first-time viewer can
say what the band IS, no letters (kill: 2 failed render-side iterations →
route to compose-side strata rework, stop dialing); skyline — reads as
distant structures with faint marks (kill: reads as sky clutter → pull the
feature, don't tune it in); DMG — blank sky confirmed on screen. Remaining
#19 legs (monument architecture + door, constellations/clouds, ore veins/
caverns, signage) are the next slice.

**Land polish #19 slice 2 SHIPPED 2026-08-06** (spec
`docs/superpowers/specs/2026-08-05-land-polish-slice2-design.md`, plan
`docs/superpowers/plans/2026-08-06-land-polish-slice2.md`; eyeball PASSED
2026-08-06, all six bars — see the closing paragraph below) — the four
remaining #19 legs, closing the
programme item. Architectural decision: **one deliberate compose-side
upgrade + renderer-side cloud drift**, changing composed bytes ONCE (a
re-roll like the raised-horizon pass), with two approaches explicitly
rejected — per-leg `ComposeLandOptions` flags (the skyline opt-in gate was
slice 1's mid-round eyeball protection; that round is closed, and permanent
flags for always-on visuals are plumbing not needed) and render-side
redraw (the strata trick — wrong tool for shapes with footprints). (1)
**Monument architecture + door** — the old 6-tall column + sun-borrowed
crown becomes real box-drawing architecture: `MONUMENT_BODY` (footing,
window-slit rows, shafted body, `land.ts`), a ground-level `▯` door (new
role `door`, glyph-locked, omit NOT allowed — the future launcher beat's
landing spot), and the crown moved to its OWN role `monumentCrown`
(omit-allowed, so gameboy-dmg's blank-crown look is now an explicit pack
edit, not sun-role borrowing). Placement/slots/seam-buffer/hall-avoidance
unchanged. (2) **Constellations + cloud drift** — 2–3 recognisable figures
(`CONSTELLATIONS`: the W, the plough, the arc) stamped from the existing
salted sky PRNG, replacing scatter in their patch rather than adding to
it (blank-sky packs stay blank with zero edits — reuses `star`/
`starBright`). Cloud drift is the renderer-side exception (`src/terminal/
clouds.ts`, pure + Pixi-free): wisps lift out of the static grid and drift
continuously on `app.ticker` elapsed time, wrapping across the strip,
fading to 0 approaching a mural/skyline/structure and back in past it
("the world always wins" — never pops). (3) **Ore veins** — short
diagonal `◆` glints seeded through stone/bedrock, role `ore` (omit-
allowed, ramp-allowed), role-guarded at stamp time so caverns/topsoil/
shaft/relics are excluded by construction. (4) **Sign posts** — site
furniture, reveal untouched. **Live-found and fixed, both during Task 8
verification, not caught by any smoke:** (a) during Task 6's golden
re-freeze, unguarded beings/trees scatter could overwrite the monument
door (seed 41) — fixed by guarding decorative stamps to sky-only cells
(built world always wins), commit `c211f84`, then a complete re-freeze;
(b) constellations' design promised figures "avoid... the murals rect",
but the placement fit check had no knowledge of the mural (which composes
LATER and unconditionally clears its rect) — a figure could pass its fit
check then lose points once the mural evicted them, seen live on the
default t1/d0 desk (a W-figure's two points blanked under "stardew"'s
mural). Fixed by precomputing the mural rect's pure-arithmetic geometry
ahead of the constellation loop and folding it into the fit check —
no RNG-stream change on the no-mural path — commit `8d973ed`. **Known,
UNFIXED, out-of-scope interaction:** the monument's placement rules were
explicitly left untouched this slice (per the design doc) and have no
equivalent mural-avoidance; on the default library's `d0` wing the
monument's cap + first window-slit row sit inside "stardew"'s mural rect
and are evicted the same way the old (pre-slice-2) monument's crown would
have been — pre-existing since Murals #16, not a slice-2 regression, the
door (the locked invariant) is unaffected. New smokes:
`smoke-land-monument` (18), `smoke-land-constellations` (23, re-run
after the mural-rect fix), `smoke-land-ore`, `smoke-land-signpost`,
`smoke-cloud-drift` (11); style-pack corpus 301→303 (Task 1); full sweep
+ both typecheck legs green. VERIFIED LIVE (macOS, `LOKILIBRARY_TERMINALS=2`
desk): solo d0 shows the door + 5 of 7 monument body rows (cap/crown
mural-evicted per above), ≥1 constellation figure clear of the mural,
ore glints in the deep band, posts at sites; drift readback
(`debugClouds()`, two reads 5 s apart) on both windows: t1 x
45.26→45.74 (Δ0.48 ≈ 5×0.096 cells/s), t2 x 50.61→50.98 (Δ0.37 ≈
5×0.074 cells/s), alpha 0.9 both reads both windows (the design's
`*0.9` render cap) — a separate reading on the mural-adjacent wisp
correctly showed alpha 0 while mid-transit behind the mural, confirming
the fade-to-occluded behaviour is live, not just smoke-tested; joined
two-window desk: seam/knit(`fired:1, glowStale:0`)/murals/marks intact,
both windows' murals `ready`; DMG relaunch: sky fully blank (no figures,
no wisps), crowns blank, judged strata bands unmoved (smoke-land-material
still green), door present (`debugCellAt` confirms `{char:'▯',
role:'door'}` at (22,13)), ore confirmed via `debugCellAt` → `{char:'◆',
role:'ore'}` at (38,17). Shots:
`docs/design-reviews/2026-08-06-land-polish-slice2/` (`desk-t1-d0.png`,
`desk-joined.png`, `desk-dmg.png`). **Frozen bars for Harry's eyeball
(copied verbatim, frozen 2026-08-05 before implementation):** (1)
Monument: reads as built architecture with an entrance. KILL: noisier
blob → revert to the column, rethink at mockup level. (2) Constellations:
≥1 figure reads as deliberate; sky NO busier. KILL: more cluttered →
remove figures, keep scatter. (3) Cloud drift: noticeable in ~10 s,
invisible at a glance. KILL: draws the eye from across the room → halve
speed once; still pulls focus → ship static. (4) Ore: "rock with veins",
not confetti. KILL: confetti → halve count once; still confetti → pull
the role. (5) Sign posts: site furniture; reveal feels unchanged. KILL:
stray glyphs → omit everywhere. (6) gameboy-dmg: sky blank, crowns
blank, judged bands unmoved, doors present.

**Static-beings liveliness SHIPPED 2026-08-06 — CODE-COMPLETE, eyeball
PENDING (Harry's live watch against six frozen bars).** The desk's flagged
next item after the launcher beat. Before this, a being's entire steady-state
draw was two lines: `x = round(b.x*CW)` and one 1.6 Hz / 1.5 px sine on y that
ran identically whether the being was sprinting or standing still, so the bob
carried no information; `b.dir` was tracked by every intent branch and **never
reached the sprite**, so there was no facing at all. With `INTENT_S [6,6]` ×
`intentWindowMult` (cat 1.3, ghost 1.5) plus the `HESITATE_S` freeze, a being
could be a motionless glyph for **18 continuous seconds** — props, not
inhabitants. Spec:
`docs/superpowers/specs/2026-08-06-being-liveliness-design.md` (three
direction calls + the six bars frozen before any code). Shape: **breath vs
gait, an eased facing lean, and seeded idle beats**. New
`src/terminal/beingAnim.ts` (~115 lines, pure, PIXI-free, the
`siteLabels.ts`/`wear.ts` posture) + ~35 lines in `terminalLand.ts`.
Rules that fell out: **gait phase rides DISTANCE walked, not time** — it takes
no time argument at all, which is what makes persona speed visible for free,
makes `WATCH_DRIFT 0.4` read as *slowing down* rather than as the same bob at
a lower x-rate, and crossfades gait→breath on arrival so `approach`-linger
reads as *settling* with no code for settling; the hop is shaped `-|sin|` so
the body rises off the ground line and never sinks below it; the drawn facing
is a render-only `face`, **deliberately not `b.dir`** (dir rides the seam
handoff, near-edge reports and `state()`, so an idle turn must never perturb a
crossing); the anim block sits OUTSIDE the `!b.pending` guard on purpose, so a
being waiting on the broker fidgets; render x moved from a whole-pixel to a
**half-pixel** snap, because `Math.round` would have eaten the 1.3 px lean
entirely (0.5 local px = 1 screen px at `WORLD_SCALE 2`). Zero intent-engine
change — an `idle` kind would either score (breaking the smoke-enforced
persona dominance proof) or never score (a second `errand`-shaped dead union
member); `smoke-t1-being-intents` passes **unchanged**, which is the proof.
No new AI calls, no wall clock (all `elapsedS`/`dt`, so it freezes cleanly
under the wallpaper throttle). One dial moved pre-observation: `GAIT_PX`
1.5 → 2.0, because the hop is one-sided and 1.5 px peak-to-peak would have
made a *walking* being read as less alive than a standing one (breath is
±0.9 = 1.8 swing) — caught by the smoke, not by eye. New
`smoke-being-liveliness` (42 assertions), **mutant-checked seven ways** (fixed
per-call gait step → red; `dtS <= 0` guards dropped → red; `stepLean` sign
flipped → red; `IDLE_BEAT_PX` 2.5 → red on the sub-cell cap; `BREATH_PX = 0`
→ red; plain `sin` gait → red; beat ignoring the `moving` blend → red).
**The mutants found a real hole in the smoke**: the "a 4 s idle is never flat"
bar was written as `>= BREATH_PX * 1.8`, so `BREATH_PX = 0` satisfied it
vacuously — rewritten as an absolute 1.5 px floor. A bar expressed in terms of
the constant it guards is not a bar. Full 65-smoke sweep + both typecheck legs
green. New debug hook `__terminal.debugBeings()` (drawn sub-cell `dx`/`dy`,
not the model x — the `debugDepth()` mould). VERIFIED ON SCREEN (macOS desk,
t2 frontmost): a parked being holds `moving 0` with a **1.797 px breath swing**
(≈ 2 × `BREATH_PX`), **20 of 60 sampled frames inside an idle beat**, and
`face` observed flipping both ways (turn-in-place); a walker holds
`moving 1` over 3.53 cells with `dy` spanning **-1.999 … -0.02** (full
`GAIT_PX`, never above the ground line) and **10 gait slope reversals** (a
cycling gait, not a drift), `face` and lean sign both tracking the walk
direction; worst observed `|dx|` 2.5 < CW/2 = 3. Nothing regressed: monument
+ sun glow still pulsing, foliage sway still moving, mural `ready`, knits
`glowStale 0`, and a real click still ran the full errand (`archivist` →
door 39, `ok:true surface:electron`). Shots:
`docs/design-reviews/2026-08-06-being-liveliness/` — **context only; a still
cannot show motion, so all six bars are a live watch.** Note the t1 window
read as frozen mid-session (`xMoved 0`, stale `dy`) — the occluded-window
vacuous pass; the readings above are all from the frontmost window.

**Launcher beat SHIPPED 2026-08-06, eyeball PASSED same day — all six bars,
no kill fired, no dial spent.** Harry watched it live on the two-window desk
("bars 1-6 all pass"): the hover affordance read, the click read as sending
someone, the step through the door read as entering, the absence read as
someone being out, the return-with-a-note read as a payoff, and nothing
regressed. The T2-remainder
item deferred since 2026-07-17; the `door` role (#19 slice 2) now has
behaviour. Spec: `docs/superpowers/specs/2026-08-06-launcher-beat-design.md`
(Harry's three direction calls frozen in it before any code). **The desk's
first user input**: it had no player, no keyboard handler and no pointer
handler until this slice. Shape: **click any site → the door lights → the
nearest being walks to it → Steam fires → they step through and are gone
until you come back**. Architecture: renderer-side only. `src/procedural/`
gains ONE additive metadata field (`LandSite.name` + `.appid` — a truncated
7-char display string cannot address Steam); grid parity proven against the
pre-change composer (char/role/surface/mural/shade/poster + every site's
x/y/text/kind byte-identical across 4 seeds × 4 option sets), so the
`smoke-land-mural` golden re-freeze is a PAYLOAD change, not a re-roll — the
golden hashes the whole model on purpose and the re-freeze comment says so.
New: `src/terminal/launchTargets.ts` (pure hotspot geometry + `doorColumn`),
`errand` BeingIntent (in the union, NEVER scored by `pickIntent` and never
reached by `resumeIntent` — smoke-enforced over 10k draws, so the world can
never launch a game on its own), launch vocab in `marks.ts`,
`recordLaunch`/`recordReturn` in `terminalMemory.ts`. Zero new AI calls (the
palace's version force-fires Tier-2; this deliberately does not) — the
CLAUDE.md runtime-AI ledger is unchanged. Rules that fell out: the errand
walks to the monument door, or to the clicked site when the wing's slice has
no `mastered` game (not every land has a monument); Steam fires at
`ERRAND_CAP_S` 2.5 s whether or not the runner arrived, but **the walk
continues and they still step through the door** (Steam's own cold start is
5-20 s, so the world finishes its beat while the game loads); a land with
nobody home degrades to a plain launch; one runner at a time. **Away time is
WALL CLOCK, not `elapsedS`** — found live, not by review: a being is away
precisely while the game holds the screen and this window is occluded, and an
occluded Chromium window throttles or stops rAF *and* Pixi clamps `deltaMS`
to 100 ms, so a backgrounded desk accrues elapsed time ~10× slower than the
wall; measured in `elapsedS` the 20 s floor had not expired after 24 s of
wall time and the 30-min ceiling could have taken most of a day. **The return
signal is attention, not process state**, and the spec says so plainly: macOS
has no game-exit signal available here (the throttle's fullscreen probe is
Win32-only and its IPC only ever reaches the palace's `mainWindow`), so a
runner re-emerges on the first focus/pointer event past a 20 s floor, and
unconditionally at a 30-min ceiling. A real exit signal drops straight into
that one call site. New smoke `smoke-launch-targets` (37 assertions),
**mutant-checked three ways** (appid-less sites included → red; hit-test row
band removed → red; `errand` added to the scoring ladder → red). Full
64-smoke sweep + both typecheck legs green. New e2e tooling:
`scripts/e2e/term-drive.mjs` (the launch-desktop-app skill's driver targets
the palace's `mainWindow`; the desk's windows are separate CDP targets), with
real `Input.dispatchMouseEvent` support — a synthetic `PointerEvent`'s
`offsetX` is not the page's own, and the hover affordance only tested
honestly under real input. VERIFIED ON SCREEN (macOS desk, window frontmost —
a throttled window passes vacuously): real mouse click on a site → errand
created for the nearest being → launch fired (`ok:true surface:electron`) →
runner continued walking → stepped through at the door → `away` →
mark at the door column carrying the game's name → return on the LATE poke
only (early poke inside the floor correctly did nothing, and 19 s of no
attention correctly did nothing); a second real click during a live errand
was ignored (errand still named the first game); hover pinned the hovered
site's label to alpha 1 with `cursor:pointer`; joined desk unchanged
(`knits.glowStale 0`, mural `ready`, right edge open). Shots:
`docs/design-reviews/2026-08-06-launcher-beat/`. **Frozen eyeball bars (six,
in the spec, frozen before implementation)**: discoverability, the beat
reads as sending someone, stepping through reads as entering, absence reads
as "someone is out", the return reads as a payoff, nothing regressed. **Known
and NOT fixed (pre-existing, seen in both shots): the marginalia reveal's
caption box has no opaque backing, so a caption whose mark sits under a mural
renders over the mural's frame and is harder to read.** It is not
launcher-specific (the second shot's colliding caption is an ordinary
`at_edge` mark), but the launcher makes it reproducible on demand, because
every launch mark lands on the same door column.

**#19 slice 2 eyeball PASSED 2026-08-06 — all six bars; the #19
programme item is CLOSED.** Two rounds on the live desk. Round 1: bars
1/2/4/5/6 passed; bar 3 (drift) failed as "not sure it's working" — NOT
the frozen kill (that leg was for too-salient) but a visibility defect:
every window wears a mural whose occlusion span covered ~60% of both
cloud rows at desk widths (one seed wiped both wisps outright). Fixed
render-side (`d21fc3b`): starved wisps re-row to the clearest free sky
row; mural-evicted wisps re-synthesize from the canonical shapes so
every window keeps two; smoke pinned at width 80 (width 120 dilutes the
mural below the 0.5 threshold and would pass pre-fix code — geometry
matters when pinning occlusion defects). Round 2 revealed the second
half: the seeded speed band 0.04–0.10 cells/s (my dial) moved under a
cell per 15 s — mechanically alive, humanly invisible; re-dialed to
0.25–0.45 cells/s (`905c3b6`, a window crossing every ~3–5 min).
Harry: "yes that's much better — bar 3 passes." No kill fired on any
bar. **Same session, direction repair (`8ec7ee4`): a plain desktop
launch now boots the terminals desk** (2 windows + broker) — Harry saw
the palace boot and called it ("I thought we've moved past that");
the palace stays one env var away (`LOKILIBRARY_TERMINALS=0`) as the
reference implementation. Wallpaper mode + peek remain palace-only
until the terminals-as-wallpaper migration item lands; the desk has its
own tray. README launch instructions updated. **(That gap CLOSED the same
day — see the terminals-as-wallpaper entry below.)**

**Terminals-as-wallpaper SHIPPED 2026-08-06, eyeball PASSED same day — all
six bars, no kill fired, no dial spent.** Harry watched it live on the joined
two-window desk: bars 1+2 first ("wallpaper looks right"), then the rest
("yea they all look good"). The last missing product pillar for the shipped
surface:
CLAUDE.md's first line promises a thing that "lives as a live wallpaper and
an alt-tab destination, doubles as a launcher", and the desk had two of
three. Spec:
`docs/superpowers/specs/2026-08-06-terminals-as-wallpaper-design.md` (three
direction calls + six bars frozen before code). Six legs, each shipped
independently: per-window wallpaper state → broadcast registry → throttle
into the desk renderer → desk wallpaper mode → desk peek → docs.

**SPIKE-A ran first and returned a clean negative that made the direction
call a measurement instead of an argument.** The plan reasoned that
`kCGDesktopWindowLevel` sits below Finder's click-eating desktop window. The
spike tested the alternative's *best* case — `CGWindowLevelForKey(3) + 1 =
-19`, one level ABOVE the desktop icons, click-through OFF, activation policy
left at `'regular'` — and the WindowServer still routed nothing: a real
CGEvent click dead centre on a site returned `{last:null, errand:null,
hoverX:null}`, and a real CGEvent drag across the 20px strip left bounds
byte-identical. **Method mattered**: a CDP `Input.dispatchMouseEvent` is
delivered straight into the renderer and never touches the WindowServer, so
it would have "passed" while proving nothing; both answers used real
`CGEvent`s posted to `.cghidEventTap` with every visible app hidden. So
"interactive wallpaper" is not a dial we declined to turn — there is no
negative window level where the desk is both behind apps and clickable. The
third tier is **dead, not deferred**.

Shape: **wallpapered ⇒ click-through read-only ambience; PEEK (Cmd+Alt+L) is
the interaction path**, lifting all N windows together with the arrangement
intact. Rules that fell out: the DESK is the unit, not the window (one
app-wide `config.mode`, zero config diff — `config.ts:76-78` warns an
unparsed field is erased by the next read-modify-write); terminals enter with
`bounds:'keep'` because their snapped 640×520 IS the arrangement; **no
re-snap on either edge**, because nothing moved and re-running `settle()`
could pull together windows the user deliberately left apart — and join
invariance across the round-trip is *provable* (`computeJoins` is bounds-pure)
so it is a smoke assertion, not a hope; peek does ONE `app.focus({steal:true})`
then focuses the FIRST window only (focusing N in a loop fights the
WindowServer); a mode change clears peek first, or a peeked desk carries
`alwaysOnTop` into window mode; **no desk Display submenu, deliberately** —
for individually positioned windows that means MOVING N windows to another
monitor. Latent bug fixed *for the palace too*: `macos.ts` held ONE module-
level `state` whose `priorLevel === null` capture guard silently swallowed the
second window's capture, so N-window exits corrupted each other; now keyed per
window in `wallpaper/wallpaperState.ts` with an activation-policy refcount
(`app.setActivationPolicy` is process-scoped). The **`mainWindow` / peek /
throttle singleton refactor that `PRD:200` assigned to T1 and T1 never did**
is done here (`broadcast.ts`; `startThrottleController(win | null)`);
`mainWindow` deliberately survives as the palace's own handle. The peek
accelerator sat AFTER the terminals early-return, so the desk had never
registered it at all.

The away consequence, and why the fix is better than what it replaces: with
click-through AND `accessory`, all three of the launcher beat's return
triggers die at once (pointermove, pointerdown, focus — an accessory app's
window is never key), leaving the 30-minute ceiling as the only way back. Two
new signals, both through `broadcast('desk:attention')`: **peek-ON** (not
peek-off, which is you leaving), and a **gated `throttled-1hz → full`** wake.
A wake can only follow a real idle period, so unlike a mousemove it cannot
fire spuriously; it is honestly "you came back to the machine", not "to the
desk", which is *better* — the payoff lands next time you glance at the
wallpaper. **The gate: `isInitial` never counts**, or every mode toggle snaps
everyone back and the ceiling becomes decorative.

New: `desktop/src/wallpaper/wallpaperState.ts`, `desktop/src/broadcast.ts`,
`src/terminal/deskThrottle.ts`, smokes `smoke-desk-wallpaper` (41) +
`smoke-broadcast` (20), debug IPC `terminal:debugSetMode` /
`debugTogglePeek` / `debugDeskState` and `__terminal.debugThrottle()`.
**Mutant-checked twelve ways.** Two mutants earned their keep by NOT going
red: the broadcast idempotence guard (a `Set` dedupes membership on its own —
what the guard actually protects is a second `'closed'` listener, so an
assertion on the listener count was added), and the `resetForTests` seam,
which zeroed the count but could not clear a `WeakMap`, so stale entries drove
it to −1.

VERIFIED ON SCREEN (joined two-window desk): both windows to level
−2147483623 and back to 0; bounds byte-identical (60,160 / 700,160) and the
`t1|t2` join intact across the transition; four round-trips with `entered
1→2` on enter and `2→1→0` on exit; 76 s of real idle → ladder fires →
**both** renderers report `{state:'throttled-1hz', maxFPS:1}` and return to
`{full, 0}` on wake (that fan-out reaching two windows is exactly what was a
silent no-op before); peek lifts both to layer 3 with the arrangement intact;
**a real CGEvent click DURING peek created an errand** (`archivist` →
`stardew`) where the identical click at desktop level produced nothing; and
attention three-sided — a being stays away across an EARLY peek, stays away
after 22 s of waiting with NO peek, and returns on a LATE peek. **Two earlier
attempts at that last test were vacuous and are not counted**: shell
round-trips took 56 s where I estimated 14 s, and a later run stamped
DETECTION rather than the actual away start, so the "early" peek was really
well past the floor. Only the in-page, click-from-t0 run is evidence.

67 smokes and all three typecheck legs green (`npm run typecheck` covers
`src` + `worker` only — **`desktop/src` needs `cd desktop && npm run build`**,
and `scripts/*.mts` are covered by neither). Persisted mode left at `window`.
Shot: `docs/design-reviews/2026-08-06-terminals-as-wallpaper/`.

**Eyeball finding, raised by Harry and NOT a defect: flicking from a
fullscreen Space back to the desktop leaves the desk blank for ~½ second.**
Measured while covered: `document.visibilityState === 'hidden'` and a being
moved **0 cells in 2.3 s of wall time**, while our own throttle was asking
for `{state:'full', maxFPS:0}`. So macOS/Chromium suspends rAF outright on a
fully-occluded window — the desk behind a fullscreen app is not slow, it is
STOPPED — and the blank is the compositor waking plus the first repaint (the
Space-transition animation adds some; that split is inferred, the suspension
is observed). **Kept deliberately, because it beats our own ladder:** the
idle controller is driven by system idle, so while you actively use a
fullscreen app it holds `full` and would render the desk at 60fps behind an
opaque window forever. Occlusion suspension is what makes a covered desk cost
nothing. The dial if it ever matters is `backgroundThrottling: false` on the
terminal windows (instant reveal, continuous GPU/CPU behind every fullscreen
app) — a direct trade against bar 5, so not taken. This is the same mechanism
behind [[a-passing-check-on-a-throttled-window-proves-nothing]], now with a
number on it.

**Murals #16 SHIPPED 2026-08-01, eyeball PASSED same day** ("looks good" on the live two-window desk + the DMG re-quantise) (spec
`docs/superpowers/specs/2026-08-01-murals-on-land-design.md`, plan
`docs/superpowers/plans/2026-08-01-murals-on-land.md`, commits
`ad3ac9f..ecc1dd3` — the depth track's second slice; Harry's ruling on
the palette-quantise question: full-RGB exemption RETIRED). Every
terminal window now wears its wing's flagship as a framed,
palette-quantised mural, mid-sky: `composeLand` stamps frame + `╡ name ╞`
cartouche into the model as new roles `mural`/`muralFrame` (pure
arithmetic, stamped last — no RNG shift; `opts.mural` absent is
byte-identical, LOCKED by a frozen fnv1a golden in `smoke-land-mural`),
interior pixels arrive render-side: `src/render/muralCells.ts` (pure
quantiser — Rec.709 luminance → ` ░▒▓█`, chroma → nearest theme palette
key, `bg/bgAlt/fgBright` excluded so the being-salience contract holds
by construction) + `src/render/mural.ts` (session pixel cache per appid,
one BitmapText per palette key, backing from `theme.palette.bg` — the
ansiSpike `0x050505` debt does not propagate; ansiSpike untouched for
the V0 preview). Lock contract: both roles glyph+ramp-locked;
`muralFrame` omit-locked; `mural` omit-ALLOWED (lossy-lens doctrine).
`LandGame.appid?` added (celeste bare → no mural, no empty frame).
Dead-guards both legs of the async mount (`.then` AND `.catch`).
Verified live (macOS, 2 windows): both murals `ready` with DIFFERENT
appids (d0 stardew 413150 / d1 civ 289070), gameboy-dmg relaunch
re-quantises to the 4-green LCD palette, join recompose survives from
cache (no refetch), bogus-appid load rejects → `failed-load`, frame
stands alone. Shots: `/tmp/loki-murals/{desk-two-windows,desk-dmg,desk-joined}.png`.
Smokes: `smoke-land-mural` 21, `smoke-mural-cells` 16, style-pack 290,
glyph-coverage extended (`╡╞` atlas-verified); full 15-smoke sweep +
both typecheck legs green. SDD run: 6 tasks, all task reviews clean,
final whole-branch review clean after one fix wave (golden + catch
guard + comment). DEFERRED (follow-ups, parked in the final review):
negative-cache failed loads (offline desk re-fetches per recompose,
console-only cost); box-average right-edge crop (~4% of the 460px
header — revisit only if the identity read seems off-centre). The
stray-`*` painter (open thread above) was seen ON a mural frame edge —
same unidentified overlay, not a mural defect. Eyeball PASSED 2026-08-01 — the
slice is closed; the kill condition never fired.

**Marginalia on land SHIPPED 2026-08-01, eyeball PASSED same day**
(Harry watched the live beat on the terminals build — a driven reveal
plus the ambient surface — and called it: "this feels right") — the depth
track's first slice, plan `docs/superpowers/plans/2026-08-01-marginalia-on-land.md`
against the approved 2026-07-17 spec, commits `0ad9f6a..` this date.
Shape: pure `src/terminal/marks.ts` — `maybeMark` rides the intent
re-pick clock (NO new BeingIntent kind; ladder byte-identical):
FNV-staggered 90–180 s per-being cooldown, 2-col dedupe, per-context
odds (`at_structure`/`after_crossing` likeliest, `mid_wander` 0.06
tail); vocab total over 5 beings × 4 contexts in the persona [MARKS]
voices; the `{thought}` slot folds `b.mind.intent` in lowercased —
ZERO new AI calls, key-free rail gets everything but the garnish.
Storage = palace parity: `recordMark` (terminalMemory.ts) writes the
exact plan-row shape (`active` + step `pending` + importance 6);
`placedMarksForCell` unchanged; render cap 12, display rows re-derived
from the live surface (stored y advisory). Shared extractions:
`src/agents/markStyles.ts` + `src/render/noteBox.ts` (cell.ts imports,
palace behaviour unchanged; glyph smoke derives the mark-glyph run from
the export). Reveal: one slot per land, 1.5-col being proximity, 60 s
per-mark cooldown, fade–hold–fade on `elapsedS`. Wear: persists per
wing in the additive `land_wear` table (schema v4), lazy half-life
decay (halve/day), seeded at mount (worn from frame one when the
bootstrap cache is warm), dirty-gated 30 s flush + teardown flush;
`createFootfall` crossing is worn-guarded `>=` because decayed seeds
are fractional. e2e: `state().marks` + `debugMark`. New smokes:
`smoke-t2-marks` (43) + `smoke-land-wear-persist` (21); full 52-smoke
sweep + both typecheck legs green. **Verified live on the terminals
build** (2 windows, key-free rail — no worker running): organic
placement within the first minute, cap eviction 14→12, reveal
on-screen (shot in the session record), relaunch restores 12 marks +
worn columns before any being moves, `land_wear` rows confirmed in the
real userData DB. Harry's eyeball: PASSED 2026-08-01 — the slice is
closed; no tuning requested.

**Tier-2 depth review RECOVERED + LANDED 2026-07-30** (commits
`a47c1d2..6945474`). The 2026-07-16 `tier2-depth-review` workflow returned
its results *after* that session hit its usage limit, so nothing was ever
read or recorded; the findings were reconstructed from the transcript and
the live ones fixed. **The review is PARTIAL — 34 agents ran and 18 errored
on the same usage limit**, so an absent finding is not evidence of absence,
and two entries sat in its `rejected` bucket with an EMPTY `reasons` list
because their verifiers died: unverified, never refuted. Both were checked
by hand and both held. Landed: (1) `smoke-sky-dither` asserted nothing about
its own "never over scatter/sun/cloud/ridge" claim — dropping the
`role === 'sky'` guard in `composeLand` left all 11 assertions passing (the
RNG draw precedes the guard, so even determinism survived) while 10/88 stars
and 9/43 ridgeFar were clobbered; now locked by golden per-role band counts
plus a five-seed survival sweep. (2) The knit glow baked its glyph + x/y at
knit time, stranding up to six bright ▀ off the ground through a mid-knit
unjoin; placement moved to pure `src/terminal/knit.ts`, `wear.ts`'s new
`crustGlyphAt` is the single ▀→▔ authority, and `anchorKnitGlow` is the
single writer (startKnit + tick + **recompose** — the on-screen check showed
tick-only re-anchoring still read `glowStale` 6 for ~1s on a throttled
window). (3) The glow assumed the seam column is crust: measured over widths
40-60 × 60 seeds, 1.7–7.4% of seam-span columns are non-crust in the joined
states (20.4% solo) — game-title strips reach within 1 column of a seam and
those columns have no crust at all — so it was brightening a letter of a
title; those columns now yield no glyph. (4) `debugPlace` scored a footfall
at the teleport destination (`lastCol` never re-based), inflating every
teleport-driven e2e wear read. The wear half of finding (3) does NOT hold —
`crustLayerText` was already role-guarded. New `state().knits.glowStale` is
the live invariant (must read 0); new smoke `smoke-knit-glow` (13). Verified
two-sided throughout — every fix was run against a mutant that made it fail
first, on-screen at 60fps and throttled. Full sweep 49 smokes + both
typecheck legs green.

**T2 society migration SHIPPED 2026-07-17** (spec+plan
`docs/superpowers/*/2026-07-17-t2-society-migration*`; commits
`732c8d7..481dda6` on `claude/t2-society-migration`). The real cohort
moved into the terminal lands: beings are `AgentDef`-driven (glyph +
paletteKey accents — L magenta, A violet, c orange, V cyan, G dim —
`filterByTheme` keeps cell parity, so Ghost never walks a phosphor
desk), land personas bias `pickIntent` + presence runs through
`tickPresence` (Visitor's 90s-per-15min visits, Archivist's morning
window), minds are REAL `AgentRuntimeState` — a seam-crossing arrival
queues a perception event drained on the walker's re-pick through the
unchanged `routeTier1` (per-agent throttle 30–120s; the `approach-x,y`
steering parse gives the LLM a spatial verb; CLAUDE.md runtime-AI
ledger has the cost entry), crossings/arrivals are schema-v3
first-class `ObservationSource` tokens (`terminal_crossing` /
`terminal_arrival`), the mind rides the seam as `CarriedMind` over the
broker IPC, and the broker OWNS society homes (round-robin assignment,
re-home on crossing, `config.json` persistence + `getSociety` IPC).
VERIFIED ON SCREEN (real Electron desk, 2-terminal RESET boot): roster
holds cohort ids only (no `t1-…` native ids, no ghost on phosphor),
society round-robins d0/d1, glyphs walk the lands wearing their real
accents (`.superpowers/sdd/t2-society-*.png`); loki crossed the joined
t1|t2 seam — roster `t2`, `society.loki` re-homed `d1`, `present:true`
in the destination's `state()`; the desktop sqlite carries the v3 rows
("crossed from the d0 terminal into d1", importance 5) and Tier-1
fired on arrival at the per-agent cadence (loki ~30s / archivist ~60s
/ cat ~120s `[router] tier1 … failed: 500` on the key-free rail — the
pump dispatched, the walker kept walking); relaunch WITHOUT RESET
restored the joined desk and spawned every being on its persisted home
(loki's first arrival row: "arrived in the d1 land"). Smokes:
t2-society 18, t2-broker-homes 3, t1-society-memory 19,
t1-being-intents 48, t1-broker-handoff 28; full sweep + both typecheck
legs green. DEFERRED: Tier-2 / topology reflection (T4 arc);
marginalia on land; the launcher beat.

**Ladder identity SHIPPED 2026-07-17** (spec+plan
`docs/superpowers/*/2026-07-17-ladder-identity*`; programme #13 + the
salience follow-up register's MARK_STYLES re-key + ladder pane-awareness).
The rungs speak the world's dialect. Architecture: pure tint-layer
composition — `tintPanel.ts` `TintCanvas` (every glyph cell OWNED by
exactly one named layer; one BitmapText per layer; the ladder overstrike
bug is impossible by construction) + `ladderCompose.ts` (headless, pixi-free
per-rung composition — smoke-pinned); district/island/continent renderers
are now thin PIXI shells (`ladderLayerTint` maps layer→palette key,
`fitGrid` = the cell room's fill rule, so maps inhabit the pane). Identity:
gold card frames + gold continent land (shelf-gold dialect), orange
engagement ramp, YOU COMPOSED into the home card's top border
(`┌─ YOU ───┐`) / a `YOU · ` label prefix at continent, being letters
(`AgentDef.glyph`, role-accented) on the cards where agents live
(`presenceByDistrict` ← `registerCellPaneScope(scope, wingId)` +
`listCellPaneWings()`; NO live cell pane → theme-filtered cohort renders on
home, so the default zoom-out is never lifeless), and home FOLLOWS THE
PANE'S WING (raw `regionId` → `homeDistrictId`, island shows the continent
CONTAINING home via `findContinentOf`, header names the wing). Layout v2
from the eyeball round: grid first + centred, info+legend at the BOTTOM
(the old top header collided with the HUD once panels filled the pane).
MARK_STYLES re-keyed through `roleKey` — a mark wears its AUTHOR's accent;
ghost marks take the new `'mark.ghost'` role, default `fg` (Harry's
dim-but-distinct call, 2026-07-17); `BEING_ROLE_KEYS` now DERIVES from
`ROLE_DEFAULTS` (value unchanged). VERIFIED ON SCREEN (headless e2e,
single-pane per protocol): `/tmp/loki-ladder/{district,island,continent}-
solarized.png`, `district-wing-d1.png` (YOU + letters follow d1, header
"wing d1"), `district-3270.png` (amber phosphor hierarchy holds),
`marks.png` (ghost `°` legible fg, cat `⌐` orange).
`smoke-ladder-identity` 44; full smoke sweep + both typecheck legs green.
Programme arcs remaining: shade-ramp deployment (#12), murals, phosphor,
density pass, land polish.

**Platform direction 2026-07-17 — Mac-only.** Harry retired the
Windows/PC target: macOS is the sole build + verification platform. The
Windows verification column in TODO-USER.md is retired (most surfaces
were re-verified on macOS in the 2026-06 consolidation; the residue is
re-worded for macOS), CLAUDE.md's How-to-run + not-do rules and PLAN.md
carry the banner, README's status note reflects it. Win32 code paths
(Progman-reparent wallpaper, koffi throttle) stay in-tree as dormant
OSS-contributor surface. (Doc-only change; no code moved.)

**Ambient-salience bundle SHIPPED 2026-07-17** (spec+plan
`docs/superpowers/*/2026-07-16-ambient-salience-bundle*`; commits
`d107cf0..fe4bb99` on `claude/ambient-salience`; programme items #9 + #10 +
the land-register salience fix from the 2026-07-16 design chat). Three
surfaces, one contract: LAND — `GROUND_DEMOTE` (crust/foliage scaled 0.6
via the new pure `landRoleFill()`, land.ts; smoke-land-atmosphere 13) so
grass reads as ground, and land beings tint through `roleKey()` with
`beingAccentRole(id)` (pure, beingIntents.ts — FNV pick over the four
being roles; smoke-salience) so the creatures are the most distinct marks.
CELL SHELVES — `T_BOOKSHELF` no longer draws the flat ▓: three sub-cell
`│` strokes per cell (renderer pass AFTER the events-calendar moves;
tints via pure `shelfStrokeTints(hash, stocked)` in the tile bible).
GOLD-CASE TUNE (deviation from the spec's all-dim empties, recorded here):
stroke 0 is ALWAYS shelf-gold — the CASE is gold, the books vary — because
the 8-game sample library stocks ~8/40 cells and all-dim empties turned
the room cold on screen; bookless = gold case + dim books + no initial.
CELL AMBIENT — one `ambientTick` (deltaMS, freezes under throttle): seam
caps breathe (alpha 0.7↔1.0, 4s sine), `♠` sways ±0.5px (1.6s, FNV
per-instance phase), and walk wear (`wearLayer`: floor glyph one step up
under player+agents, 8s decay, 64-cap oldest-evicted, pane-volatile).
VERIFIED ON SCREEN: land before/after vs `docs/demo/join-2-joined.png`
(muted ground, accented beings, both windows agree); cell shelves read as
book rows with initials brightest (`/tmp/loki-bundle/cell-after.png`);
two captures 2s apart are NO LONGER byte-identical (the 8s pixel-frozen
finding reversed); wear gradient pixel-sampled fading behind a paced walk
(384→351→318→315 baseline). smoke-salience 21, smoke-land-atmosphere 13,
full sweep + both typecheck legs green. Programme arcs remaining: ladder
identity, shade-ramp floor demotion (#12), murals, land polish.

**v1.0.0 RELEASED 2026-07-16** — the free-OSS deliverable bar is MET:
README leads with the join-moment GIF + a snapping-terminals section (the
documented `LOKILIBRARY_TERMINALS=2 npm run dev` path verified live before
publishing), package.json → 1.0.0, tag `v1.0.0` + GitHub release with the
demo GIF/stills as assets
(github.com/demonty3/Lokilibrary/releases/tag/v1.0.0). Remaining beyond the
bar: the TODO-USER human beats, a Windows pass for terminals mode, and the
CONSOLIDATION.md enrichment-budget feature (core vision, not release-gated).

**Depth/atmosphere + chains/persistence/demo SHIPPED 2026-07-16** (plans
`docs/superpowers/plans/2026-07-16-tier2-depth-atmosphere.md` +
`…-tier3-chains-persistence-demo.md`; commits `ea15640..c75bfa2` (T2) +
`58ea077..59e25f4` (T3) — Tiers 2+3 close the living-joined-world plan
ladder). T2 — wings read DEEP and ALIVE with no camera scroll: far ridge
plane + density-ramped sky dither (own salted PRNGs in land.ts, main rng
byte-untouched — smoke-land-atmosphere 8, smoke-sky-dither 11), `mixToward`
bg-fade palette math + per-role `layers` handles, monument/sun glow pulse,
counter-phased foliage sway, worn paths (`src/terminal/wear.ts`,
session-scoped ▀→▔ crust packing — smoke-worn-paths), knit glyph trail +
seam ground glow. T3 — the arc graduates to a small product: `SNAP_Y_PX=48`
vertical capture band (a snapped window dragged past 48px vertically ESCAPES
instead of being yanked back — smoke-t0-topology 17), boot spread fits the
work area for 3+ chains, `scripts/e2e/join-demo.sh` → committed
`docs/demo/join-moment.gif` + 3 keyframe stills (the README artifact), desk
persistence (`TerminalSlot[]` via config.ts — `readConfig` PARSES the field
so its read-modify-write can't strip it, smoke-t3-desk 7; persisted on
settle/close/spawn; `quitting` flag stops the app-quit close cascade saving
a shrinking desk; `LOKILIBRARY_TERMINALS_RESET=1` keeps harness layouts
reproducible), and a terminals-mode-only tray ("New terminal (dN)" onto the
next unused wing; `terminal:debugSpawn` IPC + t0-drive `spawn` verb share
the tray's exact spawn path). VERIFIED LIVE (macOS): t1+t2 snapped → quit →
relaunch restores identical bounds ALREADY-JOINED (both edges open, knit
fired); spawn fills d0–d5 in order, the 7th returns null, closing t3 frees
d2 and a respawn mints FRESH id t7 onto it; the enlarged desk persists. The
broker-driving smokes (t1-broker-handoff / t1-cross-edge) now mock
app/Tray/Menu/nativeImage. Human beats PASSED (Harry, 2026-07-17): tray
spawn + label disables at 6, real-mouse glyph-strip drag + snap, knit
sweep seen on a fresh join. Next: the clone-and-run README + release
pass (the free-OSS deliverable bar).

**Living society SHIPPED 2026-07-16** (plan
`docs/superpowers/plans/2026-07-16-tier1-living-society.md`; commits
`9a9e320..b3b02e4`; Tier 1 of the living-joined-world run; PRD-T2 core,
key-free). Land beings are a SOCIETY, not walkers: pure intent engine
`src/terminal/beingIntents.ts` (utility-AI ladder — wander/rest/approach-a-
structure/watch_edge; rest deliberately dominated at an OPEN edge;
`resumeIntent` continues a handed-off intent; `structureColumns` from label
runs — smoke-t1-being-intents, 21). Handoffs CARRY runtime state
(`TerminalBeingState {speed,dir,intent,bobPhase}` — broker forwards opaquely
+ `from:{terminalId,wing}`; beings RESUME, not respawn; `CROSS_COOLDOWN_S=4`
anti-ping-pong; smoke-t1-broker-handoff, 18, drives the REAL broker via
mockElectronModule). Crossings + arrivals write the Smallville stream
(`src/terminal/terminalMemory.ts` → `recordPerception` kinds
`terminal_crossing`/`terminal_arrival`, mapped to the FROZEN
`'self_perception'` source — no schema bump; prose via writer.ts
describeEvent; `busy_timeout=3000` for multi-renderer WAL sharing;
smoke-t1-society-memory, 15 — VERIFIED in the real desktop sqlite: "crossed
from the d0 terminal into d1" rows both directions). Cross-edge perception:
`src/terminal/crossEdge.ts` (`nearEdgeSummary` cap 4/side radius 10 +
`projectAcrossEdge` just-outside-the-land; ≤1 Hz change-gated
`terminal:nearEdge` report → broker relays side-flipped
`terminal:neighbourSummary`; non-empty summary = DECISIVE watch_edge pull;
smoke-t1-cross-edge, 15). VERIFIED LIVE (macOS): the roster fully swapped
homes organically (all 3 t1-natives in t2 + vice versa), perception symmetric
(t1 sees 2 across its right seam, t2 sees 3 across its left), and BOTH
windows had a being in watch_edge pulled to the populated join — the PRD-T2
acceptance verbatim; gallery `/tmp/loki-join/gallery/tier1-society.png`.
`__terminal.state()` now exposes intent per being + `neighbours` per side.
Full smoke sweep green. DEFERRED (per plan): real 5-agent cohort defs /
migrateRuntime-over-IPC, Tier-1 LLM dispatch on arrival (no-LLM rail), new
ObservationSource token, relaunch persistence.

**Join moment SHIPPED 2026-07-16** (spec+plan
`docs/superpowers/*/2026-07-16-join-moment*`; commits `3c8f639..9ba90b4`;
Tier 0 of the living-joined-world run). Two snapped terminals now read as ONE
continuous land: `landSeamBoundary(seedA,seedB)` (land.ts; symmetric
canonical-order FNV fold, salt `0x5a11`) gives both windows the identical seam
height+slope with no negotiation; `composeLand` gains
`join?: {left?,right?}` (neighbour wing seed) and Hermite-ramps the edge's
last 6 cols to it (structure-free buffer; no-join byte-identical —
`smoke-land-seam.mts`, 6). Topology IPC carries `wings` (terminalId→wing);
`terminalLand` recomposes the joined edge as a swappable scene child on join
change. Terminal windows are FRAMELESS (`frame:false` alone — `titleBarStyle:
'hidden'` re-adds macOS traffic lights; `hasShadow:false` +
`roundedCorners:false` kill the false seam line) with an in-world `┤ wing ├`
drag strip. A one-shot knit sweep (0.6s, ticker-driven) fires per newly-opened
edge (`__terminal.state().knits` = e2e ground truth). VERIFIED ON SCREEN
(macOS, occlusion-proof `scripts/e2e/join-shot.py` composite — new tooling,
`screencapture -l` per window + PIL): ground line continuous across the seam,
carets on the same row, a being at the threshold; hero shot
`/tmp/loki-join/gallery/tier0-hero.png`. Both human leftovers PASSED (Harry,
2026-07-17): real-mouse glyph-strip drag + snap, knit sweep seen live on a
fresh join (0.6s). The lore-ingest desktop leg also passed the same evening
(Ctrl+U → nautical.md → tokyo-night remount) — 5D.4 signed off. Next tiers: living
society (T2 runtime) → depth/atmosphere → chains/persistence → demo GIF.

**Salience campaign SHIPPED 2026-07-13** (spec+plan
`docs/superpowers/*/2026-07-13-salience-campaign*`; commits
`b293c96..8d9f88e`; source: the 8-lens visual programme in
`docs/design-reviews/2026-07-13-visual-programme.md`). The glance
hierarchy is fixed: semantic role layer (`src/themes/roles.ts` —
roles→palette keys, reserved being accents smoke-enforced), beings
re-tinted (cat orange, archivist violet), blue aperture dialect
(door/window/seam-caps; the old orange door cross is dead), `@`
phase-modulo cursor blink (76/24 duty at any tick rate incl. 1Hz
throttle), themed HUD + LoreDropZone, wall-layer focus alpha in
splits, double-line marginalia frames with L· tick, ladder label
double-draw bug fixed (was the YOU marker; home card now restamped
brighter). Follow-ups on record: MARK_STYLES re-key (design decision —
ghost marks), ladder pane-awareness (ladder-identity arc). Programme
arcs remaining: ambient life register, book-spine shelves, ladder
identity, shade-ramp deployment, land polish.

**Events calendar SHIPPED 2026-07-13** (spec+plan `docs/superpowers/*/2026-07-12-events-calendar*`;
commits `844fb94..bc79d95`). The world has a clock: pure seeded `eventForDay`
(0.4/day, notes/moves) in `src/procedural/calendar.ts`, `world_events` ledger
(day PK), staging via cell-registered closures (whole-library panes only,
profile seed, union broadcast), shelf overlay (adjacent-index moves, 10-day
expiry, max 3), rationale marks through the trace system, morning-dispatch
banner (staged-callback delivery). Zero new AI calls. Null-writer/web: no
events (library-empty walks skipped — protects the global ledger from anon
boots). One of CONSOLIDATION.md's two missing v1.0 features; the enrichment
budget remains.

**Direction change 2026-07-11 — free, public open source.** No Steam
distribution, no monetization; users bring their own API keys. The Steam
release gate is RETIRED and ship-vs-expand resolves to: consolidate to
demo-ready (clone-and-run README + the snapping-terminals demo), then
expand into the snapping-terminals arc. Authoritative wording: CLAUDE.md
"Product direction" + SPEC.md § 2.5. (Doc-only change; no code moved.)

Last updated: **2026-06-04** (SEAM-SEEKING / the observable walk, Increment 2 —
agents now DELIBERATELY walk to a seam and cross, instead of waiting on a random
wander onto an exit cell. `behavior.ts:maybeSeekSeam` latches the nearest open
walkable `SeamExit` as `runtime.seamGoal` (multi-pane only — empty `ctx.seamExits`
clears it, so single-pane is byte-identical), the BT scores an `approach` toward
it at 0.6 (above wander/idle, BELOW plan-step/intent/schedule peaks so a character
schedule still wins — loki, near its anchor, keeps to its room by design), and on
arrival writes `pendingCross` + arms a per-agent FNV-staggered cooldown
(`seamCooldownMs`, 6–12s) so agents DRIFT across one-at-a-time rather than
stampede/oscillate. `seamGoal`+`seamCooldownUntil` added to `AgentRuntimeState`
(cleared on `migrateRuntime`; cooldown travels with the agent). VERIFIED ON SCREEN
(macOS, e2e harness): a `|`-split of two whole-library cell panes shows the roster
fluidly cross both directions (cat/archivist/visitor each crossed multiple times;
the new `window.__loki.agentRoster()` reads each pane's live scope). smoke-7d2-walk
now 71 (S1–S5: latch/approach/cross, nearest-selection, cooldown gate, single-pane
reduction, stale-goal re-latch). ALIGNED SEAMS (2026-06-04) — the walkable seam
opening is now carved from a SHARED seed (the PROFILE seed, threaded as
`layoutCell(seed, seamSeed)` via a dedicated `SEAM_SALT=0x5ea3` prng, room stays
byte-identical) so EVERY wing of a profile opens at the SAME row even though the
rooms differ — VERIFIED ON SCREEN: a `|`-split with p2 set to a DIFFERENT wing
(d0) shows loki cross repeatedly between the whole-library room and the
different-looking d0 room (smoke-regions=24, +A-section alignment/floor/distinct).
BFS SEAM PATHING (2026-06-04) — seam-seeking now routes with a dedicated
`seek_seam` Tier0Action + `bfsNextStep` (4-connected floor BFS, deterministic,
greedy fallback if the opening is a disconnected pocket) so agents route AROUND
shelves to the opening instead of stalling against a wall as the GREEDY
`stepTowardTarget` did (kept unchanged for plan/schedule movement). VERIFIED ON
SCREEN: with p2=d0, loki/visitor/archivist all cross both ways (at one tick all
4 were in p2); cat rests near its ☼ anchor (schedule 1.1 > seam-seek 0.6 — by
design, not a stall). smoke-7d2-walk=74 (+S6/S6b: BFS routes around a barrier
where a greedy control provably stalls). REMAINING: a carved opening is not
GUARANTEED connected to all interior floor (rare disconnected pocket → that agent
stays put); changing a live pane's region REMOUNTS it and DROPS agents that had
walked in (known split-teardown behavior). NEXT ARC: orchestration / Composable-
Panes Depth 3 — the society decides WHICH terminals exist. —— REGION TERMINALS (2026-06-03) — a
cell pane can render ONE
wing of the library (a 7-A district) with its own seed / shelves / cohort /
seed-keyed memory instead of the whole-library cell; `regionId?` on
`PaneDescriptor`, resolved in `mountPaneLevel` via the new pure
`src/procedural/regions.ts`, cycled by `cycleFocusedPaneRegion` + the `r` key.
Default panes byte-identical. Foundation for Composable-Panes Depth 3. See
"Region terminals" below + `smoke-regions.mts`. Prior 7-D.2 LIVE SEAM WALK — single roaming roster: the 5-agent COHORT exists ONCE across the world (spawned into ROOT only; split panes start EMPTY), each agent in exactly ONE pane's `RuntimeScope`, roaming by crossing seams. `mountCohort` is now a renderer+ticker that per-tick RECONCILES sprites to scope (create-on-arrive / destroy-on-depart; allocation-free in the single-pane no-churn case). Real `CrossSeamDeps` + `seamExits` built from `buildSeams(live panes)`+`paneRegistry` and threaded `PixiApp→cell→cohort` (single pane short-circuits to [] before `buildSeams` → enricher returns base by reference). `behavior.ts` emits `runtime.pendingCross` at an open walkable seam-exit edge (fixed-position PRNG candidate; clamp when no seam); the cohort tick consumes it via `migrateRuntime` (exactly-once, no dup/leak/vanish, deterministic `justArrivedAt` anti-ping-pong, teardown-safe via live-neighbour check). The `migrateRuntime` duplicate guard is now a BACKSTOP. The root-gate is ROSTER-AWARE (skips re-spawning any agent already live in a sibling pane — no dup on a partial root relevel), and `seamExitsForPane` is FLOOR-GATED (offers a cross only when both exit + bridged-entry cells are floor — never strands an agent in a wall). RUNTIME walk + sprite-handoff logic LANDED + smoke-locked (smoke-7d2-walk=58, incl. C1/C2 roster-aware-remount + F1/F2 floor-gate). NOTE: today's cell layout has a solid-wall E/W perimeter, so a `|`-split shows roster-once but NO live left↔right crossing yet (the wall, not broken wiring — a walkable seam edge is a DEFERRED follow-up); the crossing MECHANISM is proven headlessly. On-screen sprite VISUAL is Windows-pending. Cross-level crossing + close-seam control + arrangement persistence DEFERRED. All 27 prior smokes green; typecheck clean both legs. Earlier 7-D.1 + 7-B notes below.).

---

## Renderer state

### `useAppStore` (`src/state/store.ts`)
Zustand slices:
- `menuOpen: boolean` / `openMenu` / `closeMenu`
- `prompt: string | null` / `setPrompt`
- **Auth**: `authStatus: 'idle' | 'loading' | 'authenticated' | 'anonymous'`, `steamId`, `persona`, `loadAuth()`, `signOut()`
- **Library**: `library`, `libraryStatus`, `libraryError`, `totalGames`, `topN`, `profile`, `loadLibrary()`
- **Manifest**: `manifest`, `manifestStatus`, `manifestSource`, `manifestError`, `loadManifest()`
- **Wallpaper mode**: `wallpaperMode: boolean`, `setWallpaperMode`
- **Throttle (4A + 5B)**: `throttleState: 'full' | 'throttled-1hz' | 'paused' | 'sleeping'`, `setThrottleState`
- **Composable panes (7-B)**: `panes: PaneDescriptor[]`, `focusedPaneId: string`, `gridCols`, `gridRows`, `paneSeq` + pure reducers `splitPane(axis)`, `closePane(id)`, `focusPane(id)`, `cycleFocus()`, `setPaneLevel(id, level)`, `setArrangement('single' | 'study')`.
  - **Scale-mirror back-compat**: `scale: ScaleLevel` + `setScale` are RETAINED as a kept-in-sync MIRROR of the FOCUSED pane's level (a real WRITTEN field, not a selector — so `PixiApp.subscribe`'s `state.scale !== prev.scale` diff still fires; App.tsx's `[`/`]` zoom is unchanged and zooms the focused pane via `setScale`). The `syncScaleToFocused(panes, focusedPaneId)` helper writes `scale` in the SAME `set()` as every focus/level mutation, so the invariant `scale === focused pane level` can never drift. DEFAULT = ONE `'root'` pane, level `'cell'`, rect `{col:0,row:0,cols:1,rows:1}` on a 1×1 grid — byte-equivalent to the pre-7-B scalar. Pane ids come from `paneSeq` only (`root`, `p2`, …) — deterministic, NO Math.random/Date.now. `PaneRect`/`PaneDescriptor` live in `src/types.ts` (pure types; importable by both store + renderer with no cycle). Smoke: `scripts/smoke-7b-panes.mts` (68 assertions; A1–A11 lock the one-pane reduction + every reducer + rect math; A12 locks the single→study clip-mask regression trigger).
- **Telemetry overlay (2F)**: `agentDebugOverlay: boolean`, `toggleAgentDebug`
- **Lore upload (5C.2b)**: `loreUploadOpen: boolean`, `toggleLoreUpload`, `setLoreUploadOpen` (Ctrl+U / Esc; read by `LoreDropZone`)

### `playerPosition` (`src/state/playerPos.ts`) — PANE-SCOPED (Phase 7 / v2.x)
Frame-rate module-local, deliberately OUTSIDE Zustand (60Hz mutation must not
re-render React). Cell-grid coords, not pixels. Now a `Map<paneId, {x,y}>`
behind:
- `getPlayerPos(paneId)` → the STABLE mutable `{x,y}` for that pane (lazily
  created + cached, default `{0,0}`; the cell renderer captures it ONCE at
  mount and mutates `.x/.y` in place — zero realloc, zero re-render).
- `setPlayerPos(paneId, x, y)` — mutate that cached object in place.
- `clearPlayerPos(paneId)` — drop the entry on pane teardown (clearing one
  pane never affects another).
- **Single-pane reduction**: `playerPosition` + `setPlayerPosition(x,y)` are
  retained as thin aliases bound to the `'root'` pane — `playerPosition` IS the
  same cached object `getPlayerPos('root')` returns (identity, no lag). With
  the default single 'root' cell pane every read/write is byte-identical to the
  pre-pane-scoping singleton.

### `AgentRuntimeState` (`src/state/agentRuntime.ts`) — PANE-SCOPED (Phase 7 / v2.x)
Per-agent volatile state. Each cell pane owns its own `RuntimeScope`
(`{ runtimes: Map<id,state>; perception: PerceptionScope }`, from
`createRuntimeScope()`), so two cell panes run independent cohorts with no key
collision. Cleared on cell unmount.
- `id`, `x`, `y`, `present`, `intent`, `currentAction`, `actionEndsAt`
- **Phase 2C perception**: `perceptionQueue: PerceptionEvent[]`
- **Phase 2D reflection trigger**: `reflectionCounter: number`
- **Phase 2C throttle**: `lastTier1At: number`
- **Phase 5A reflection rate-limit**: `lastReflectionAt: number`
- **Phase 5A plan execution**: `activePlan: PlanPayload | null`, `activePlanStepIndex: number`

`Tier0Action` discriminated union: `wander | idle | approach | scheduled`.

**Scope API** — `setRuntimeIn / getRuntimeIn / deleteRuntimeIn / listRuntimesIn
/ clearRuntimesIn(scope, …)` operate on one pane. The module-globals
(`setRuntime/getRuntime/deleteRuntime/listRuntimes/clearRuntimes`) are retained
as thin delegates over a module-local eager `DEFAULT_SCOPE`, so single-pane and
all existing smokes (2b/2c/2e/4a/5a) are byte-identical. `initialRuntime` is a
PURE constructor (touches no scope) — unchanged.

**`migrateRuntime(from, to, id, newX, newY): MigrateResult` (Phase 7-D)** —
the same-level seam-crossing PRIMITIVE. SINGLE `from.runtimes.delete(id)` +
reposition the SAME `AgentRuntimeState` object + `to.runtimes.set(id, rt)` (no
copy — preserves an in-flight `activePlan`/`perceptionQueue`/`reflectionCounter`
across the seam). Result: `'ok'` | `'absent'` (no such runtime in `from`) |
`'duplicate'` (target ALREADY has the id). Under 7-D.2's SINGLE ROAMING ROSTER
an agent lives in exactly ONE scope, so `'duplicate'` is now a BACKSTOP /
bug-signal (logged), NOT the expected path it was under the 7-D.1 per-pane model.
The cross is REFUSED — agent stays in `from`, unchanged (no vanish). On `'ok'` it
clears the departed agent's `proximitySince`/`holdFired` entries in
`from.perception` (no stale FOV hold timer), CLEARS `rt.pendingCross` (a stale
intent in the destination would re-fire = ping-pong) and STAMPS `rt.justArrivedAt`
at the entry cell (anti-ping-pong guard behavior.ts reads). This is the
no-dup/no-leak chokepoint. The LIVE wiring (behavior.ts cross-intent + cohort
sprite handoff) LANDED in 7-D.2 (see "Live seam walk" below); only the on-screen
sprite VISUAL is Windows-pending.

**Perception caches** (`src/agents/perception.ts`) — `proximitySince /
holdFired / lastSeen` were module-global singletons keyed by `runtime.id`
(two panes' 'loki' would clobber). Now bundled onto the scope as
`PerceptionScope` (`scope.perception`); `computePerception` +
`resetPerceptionState` take a trailing optional `PerceptionScope`. Scopeless
callers fall back to the module globals → unchanged.

**Scope wiring + decisions (Phase 7 / v2.x)**
- `cell.ts` creates `const pos = getPlayerPos(paneId)` + `const scope =
  createRuntimeScope()` at mount, threads them into `mountCohort` (which gains
  required `paneId` + `scope`), uses them in `handleLaunch`
  (`broadcastGameLaunched(listRuntimesIn(scope))`, `getRuntimeIn(scope,'loki')`),
  registers the scope via `registerCellPaneScope` (`src/state/cellPaneScopes.ts`),
  and clears all three (`teardownCohort` clears runtime+perception, then
  `unregisterScope()` + `clearPlayerPos(paneId)`) in teardown.
- **Sleep-reflection** sweeps the UNION of all live cell panes'
  runtimes (`listCellPaneScopes().flatMap(listRuntimesIn)`) — every live world
  reflects overnight. Single 'root' pane → that one scope → unchanged.
- **App.tsx `external_fullscreen`** broadcast: union over all live cell panes'
  runtimes, anchored at the FOCUSED pane's player. Single-pane identical
  (`focusedPaneId === 'root'`).
- **Telemetry overlay** (`telemetry.ts`): pane-AGNOSTIC. It reads the
  persistent cell-keyed DB (`aggregateTelemetry`) + process-global
  `getRouterStats()` — it never reads `listRuntimes()`. So it aggregates across
  panes "for free" via the persistent store (the union answer); no scoping
  change. `routerStats` deny-verb counters stay process-global (debug counter).
- **Persistent memory stays cell-keyed by seed** (`cellIdFor(seed)`), NOT
  pane-scoped. Two panes of the SAME cell (the only thing `splitPane` yields
  today) correctly SHARE persistent memory (marks/reflections/telemetry); only
  the VOLATILE player + runtime + perception is pane-scoped. This is intended —
  persistent memory is about the PLACE, volatile runtime about the live agents
  in a pane. Do not "fix" the shared marks as a leak.

---

## Agent runtime

### Tier-0 BT scoring (`src/agents/behavior.ts:tickBehavior`)
Candidates (in evaluation order):
| Source | Score | When |
|---|---|---|
| baseline `wander` | 0.4 | always |
| baseline `idle` | 0.2 | always |
| intent → `approach` | 0.7 | when `runtime.intent` parseable |
| **plan-step (5A)** | **0.75** | when `runtime.activePlan` has pending steps |
| schedule rule | 0.3-0.8 | per-agent `def.schedule` rules |

`tryAdvancePlanStep` runs at top: advances location-bearing steps when agent
is at target. No-location steps advance via post-pick handler.

### Tier-1 dispatch (`src/agents/router.ts:routeTier1`)
- Drains `perceptionQueue`; each event accrues importance to `reflectionCounter`
- Throttle: `def.tier1ThrottleMs` (per-agent, e.g. Loki 30s)
- One-shot reprompt on deny-verb rejection
- Telemetry row per dispatch via `memory.logTier1`

### Tier-2 reflection (`src/agents/router.ts:routeTier2`)
- Threshold: `REFLECTION_THRESHOLD = 150` (Smallville constant)
- **Rate-limit (5A)**: `REFLECTION_MIN_INTERVAL_MS = 3600000` (1 hour). `force=true` bypasses.
- Output parsed for optional `plan` field (5A) → `memory.recordPlan` + `runtime.activePlan`
- Telemetry row via `memory.logTier2`

### `MemoryWriter` (`src/agents/router.ts:MemoryWriter`)
Production: `desktop/src/agents/memory/writer.ts` (better-sqlite3-backed).
Web build / tests: `nullMemoryWriter` (no-ops).
- `recordPerception(agentId, event, importance) → id | null`
- `recordReflection({agentId, text, synthesisedFrom, themes, importance}) → id | null`
- `recordPlan({agentId, text, steps, status, importance}) → id | null`
- `placedMarksForCell(cellId) → mark[]`
- `aggregateTelemetry(windowMs, nowMs?) → TelemetrySummary` — Ctrl+\` overlay data
- `logTier1(args) / logTier2(args)` — telemetry rows
- `recentMemories(agentId, n) → RecentMemorySummary[]`
- `persona(agentId) → PersonaSnippet | null`

### Perception kinds
Defined inline in router.ts `importanceFor`:
| Kind | Importance | Notes |
|---|---|---|
| `game_launched` | 8 | bookshelf E-key fires this + Tier-2 force |
| `external_fullscreen` | 7 | 4A pause-state perception (NOT shipped to schema yet) |
| `player_holding` | 6 | player lingering near agent |
| `agent_meeting` | 6 | two agents close to each other |
| `player_proximity` | 4 | player entered FOV |
| `bookshelf_in_reach` | 3 | agent adjacent to a shelf |
| (default) | 3 | unknown kinds |

### Memory schema (`src/agents/memory/schema.ts`)
`MemoryKind = 'observation' | 'reflection' | 'plan' | 'dialogue'`

`LoreRow` (5C.2): `{id, library_id, text, source, created_at, embedding_id}`
— uploaded canon in its OWN `lore` table (NOT `memories`); additive, no
migration, **library-scoped** (one upload → all agents in the library).

`PlanStep`: `{kind: 'move_to' | 'inspect' | 'place_mark' | 'linger' | 'withdraw', target?: string, location?: CellPoint, status: 'pending' | 'done'}`

`ObservationSource`: `'self_perception' | 'agent_meeting' | 'player_proximity' | 'bookshelf_e' | 'game_launched' | 'external_fullscreen' | 'cell_mount'`

### Embedding backbone (5C.1)
Transport only — not yet wired into the write/read lifecycle (that's 5C.2).
- **Worker** `worker/lib/providers.ts:callEmbed(env, texts)` → Ollama
  `/api/embed` with `EMBED_MODEL` (default `nomic-embed-text`, 768-dim).
  `POST /api/embed` `{texts}`→`{embeddings:number[][]}`; **local-only**
  (cloud 501, privacy contract).
- **Client** `src/api/embed.ts:embedTexts(texts)` → `{ok,embeddings}` |
  `{ok:false,error}`; nomic `withDocumentPrefix` / `withQueryPrefix`
  (`search_document:` / `search_query:`).
- **Chunker** `src/agents/memory/chunk.ts:chunkText(text, {maxTokens,
  overlapTokens})` — pure, zero-dep (~4 chars/token; default 500/50). No
  tiktoken: worker + web share one `package.json`, so a WASM tokenizer
  would hit the web bundle for no gain (nomic tokenizes server-side).
- **Storage path already exists** (`db.ts`): `memory_vec` vec0 768-dim +
  `attachEmbedding()` + `embedding_id` FK; `import.ts` `embedQueue` /
  `drainEmbedQueue()`. Still unpopulated for *agent memories* — the
  drain→embed→attach wiring for those is a later fast-follow. Lore uses
  its own attach path (below), populated now.

### Lore store + retrieval (5C.2a)
Library-scoped uploaded canon. Additive — own tables, never touches the
`memories` contract. **Cosine path verified in WSL** (sqlite-vec loads
here; `smoke-5c2-lore-store.mts` exercises the real KNN).
- **Tables** (`db.ts` bootstrap): `lore` (TEXT PK = UUIDv7) +
  `idx_lore_library` + `lore_fts` (contentless fts5, trigger inserts
  `new.text` directly — not json_extract) + `lore_vec`
  (`vec0(embedding float[768] distance_metric=cosine)` — nomic vectors
  aren't unit-normalised, so cosine not L2).
- **db methods**: `insertLore`, `attachLoreEmbedding` (lore_vec insert +
  FK, one tx), `recentLore`, `searchLoreFts` (library-scoped),
  `searchLoreVec(embedding, k)` (global cosine KNN → `{row, distance}[]`),
  `loreCount`.
- **`retrieval.ts:retrieveLore(db, libraryId, {topK, queryEmbedding})`** —
  cosine when a query embedding + vec present (over-fetch k=topK×4,
  JOIN-filter to library, slice topK), else recency. Returns
  `LoreSnippet{id,text,source}`.
- **Writer** (`writer.ts`): `recordLore({text,source,embedding?})`
  (mints UUIDv7, inserts, attaches embedding if supplied),
  `recentLore(n, queryEmbedding?)`, `loreCount()`. On `MemoryWriter`
  interface + `nullMemoryWriter` (router.ts).
- **Reflect injection**: `routeTier2` calls `gatherLore` (default
  `src/agents/lore-context.ts:defaultLoreGatherer` — skips when
  `loreCount===0`, else embeds a `search_query:`-prefixed digest of recent
  memories once, cosine-retrieves) → forwards `recentLore` into
  `ReflectInput` → worker folds a `recent_lore:` block into the Tier-2
  user prompt + one system-prompt line. Best-effort: gatherer throw/fail
  → reflection still runs without lore.
### Lore ingestion + drop-zone (5C.2b)
- **`src/agents/lore-ingest.ts:ingestLore(text, source, writer, opts?)`** —
  chunk (`chunkText`) → embed (`embedTexts`, doc-prefixed) → `recordLore`
  per chunk. Best-effort: embed 501/fail/throw/count-mismatch → chunks
  still persist (FTS-only), `embedError` surfaced, `embeddedCount=0`.
  Embed fn injectable for the smoke. Returns `IngestResult{source,
  chunkCount, embeddedCount, loreIds, embedError?}`.
- **`src/render/LoreDropZone.tsx`** — DOM React component (sibling of the
  canvas, like `<Hud>` — file drop is a DOM API, not PIXI). Gated on
  `store.loreUploadOpen`. `.txt`/`.md`, 1 MB cap, `file.text()` →
  `ingestLore` against `getCurrentMemoryWriter()`. Null writer (web /
  pre-bootstrap) → "needs the desktop app". Hardcoded terminal palette.
- **App.tsx**: Ctrl+U toggles, Esc closes; `<LoreDropZone/>` mounted
  after `<Hud/>`.
- **`desktop/src/main.ts`**: `will-navigate` guard in `createWindow` —
  blocks navigation away from the app URL so a stray file-drop can't make
  Chromium open the file (contextIsolation:false footgun).

### Lore profile (5D.1)
- **`src/agents/lore-profile.ts:buildLoreProfile(writer, opts?)`** — pure,
  sync, deterministic. `Pick<MemoryWriter,'recentLore'|'loreCount'>` →
  `LoreProfile {dominantThemes: ThemeTag[]; tone: LoreTone; keywords: string[];
  suggestedTilePaletteBias: ThemeId[]; suggestedDistrictHints:
  SeasideArchetype[]; sourceCount; corpusHash}`. Term-frequency over a SHIPPED
  closed-vocab whitelist (`THEME_TAGS` ×14, tone lexicon, keyword→
  theme/district/palette tables); unmatched terms DROPPED (never echoed).
  `loreCount()===0` → `emptyLoreProfile()`. No network/LLM/embeddings; no
  Date.now/Math.random (inlined FNV-1a `corpusHash`). **`keywords` is
  LOCAL-ONLY (raw vocab) — never egress;** `dominantThemes`+`tone` are the only
  egress-safe (closed-vocab) fields (the 5D.4 digest draws from these).
- `src/themes/index.ts` now exports `THEME_IDS` (literal tuple) + `ThemeId` —
  the palette-whitelist single-source (`keyof typeof THEMES` widens to
  `string`). 5D.1 smoke asserts `THEME_IDS` == `Object.keys(THEMES)`.

### Lore-weighted scatter (5D.2)
- **`src/procedural/scatter.ts`** — `SCATTER_BIBLE` entries now carry
  `themes: string[]`; new exported `buildScatterTable(loreProfile?)` reweights
  candidates by matching dominant themes (`LORE_BOOST_PER_MATCH=2`, integer →
  no float drift). `scatterDecor(seed, layout, extraKeepouts, loreProfile?)`
  gains an optional 4th arg. **Lore reweights glyph WEIGHTS only — never adds/
  removes/reorders/zeroes a candidate, never touches position sampling.** No
  lore / empty `dominantThemes` → byte-identical to pre-5D (verified vs HEAD
  across 6 seeds; base total 13, order ♠∩≡☼). loreProfile is a 2nd
  deterministic input: same (seed + loreProfile) → same scatter. (Share-URL,
  when revived, must encode the lore digest to reproduce a lore'd world
  remotely — noted for that slice.)
- **`src/render/levels/cell.ts`** computes the profile at mount via
  `getCurrentMemoryWriter()` (null writer / web → undefined → base scatter) and
  threads it into `scatterDecor`. Per-mount compute; caching is a 5D.4 job.

### Lore opt-in toggle + persona/reflect egress (5D.3)
- **Privacy model: opt-in, default OFF** (`store.loreEnabled` /
  `setLoreEnabled`). Gates whether ANY lore-derived signal LEAVES the device.
  Local lore-weighted scatter (5D.2) is independent — never egresses.
- **`router.ts:routeTier2`** gates lore egress behind TWO independent opt-ins
  (5D.4; see "two-flag model" below): `RouteOptions.loreEnabled?` →
  CLOSED-VOCAB `loreContext = {themes, tone}` from `buildLoreProfile(memory)`;
  `RouteOptions.loreQuote?` → RAW lore excerpts (`recentLore`, text + source)
  via `gatherLore`. Both default off; either/both/neither may be on. With both
  off, NOTHING lore-derived egresses (reflection still runs).
- **`ReflectInput.loreContext`** (api/agent.ts) → worker `/api/agent/reflect`
  appends ONE closed-vocab system line after the persona block ("This
  library's lore leans toward: …"); `ReflectInput.recentLore` (when `loreQuote`
  is on) → the worker folds raw excerpts into a `recent_lore:` prompt block.
- **Egress wiring landed in 5D.4** (see below). 5D.3 added the
  `RouteOptions.loreEnabled` gate to `routeTier2` but did NOT thread it through
  any call site — cohort/cell/sleep-reflection all ran lore-free regardless of
  the toggle. 5D.4 wires all three.
- Smokes: `smoke-5d-persona.mts` (10) asserts the closed-vocab gate both
  directions (still valid — `loreEnabled` alone never ships raw lore);
  `smoke-5c2` (34) exercises both flags: `loreEnabled`-only ships no raw lore,
  `loreQuote` ships raw excerpts, both-off ships nothing.

### Lore makes the world visible (5D.4)
- **Palette recolor (LOCAL, no opt-in).** When a lore corpus exists, the whole
  world theme is `buildLoreProfile(writer).suggestedTilePaletteBias[0] ??
  DEFAULT_THEME_ID` (deterministic; same corpus → same ThemeId).
  `agents/lore-theme.ts:themeFromLore` is the single derivation point; `App.tsx`
  derives it at mount and passes `getById(themeId)` to `mountPalace`.
  Independent of `loreEnabled` (mirrors 5D.2 scatter — local theming needs no
  egress opt-in).
- **`loreVersion` remount counter** (`store.ts`): `loreVersion: number` +
  `bumpLoreVersion()`. `LoreDropZone` bumps it once after a successful ingest;
  the `App.tsx` mount effect depends on `loreVersion` so the world cleanly
  tears down + remounts with the recomputed theme.
- **Agent-voice egress wired (the 5D.3 gap, now closed) — TWO-FLAG MODEL.**
  All three `routeTier2` call sites pass BOTH opt-ins from the store:
  `loreEnabled: …loreEnabled` + `loreQuote: …loreQuoteEnabled` —
  `render/agents/cohort.ts` (live reflection), `render/levels/cell.ts`
  (bookshelf launch), `agents/sleep-reflection.ts` (overnight sweep — one
  destructured read above the per-agent `Promise.allSettled` so the whole
  sweep shares one policy). The two flags gate independent egress paths:
  `loreEnabled` → closed-vocab `loreContext {themes, tone}` (whitelisted; raw
  text/keywords NEVER on this path); `loreQuote` → raw lore excerpts
  (`recentLore`, text + source) so agents can name specific people/places.
  Both default OFF → nothing lore-derived egresses.
- **Opt-in toggle UI** in `LoreDropZone.tsx`: TWO checkboxes, both default off.
  **"Theme & mood"** → `store.loreEnabled` (copy: sends only abstract theme
  tags, never your text). **"Quote directly"** → `store.loreQuoteEnabled`
  (copy: sends relevant excerpts of your uploaded text + filename so agents can
  reference specifics). Both gate EGRESS only — NOT the local palette recolor
  or scatter.
- **Deferred:** the manifest-digest → `/api/world` half of 5D is NOT done — the
  2D renderer does not consume the Stage 1 manifest (`loadManifest` is never
  called), so there is nothing to feed. Revisit if/when the renderer wires the
  manifest.
- Smoke: `smoke-5d4-lore-visible.mts` (33) — deterministic theme-from-lore
  incl. no-lore → DEFAULT fallback; the two-flag egress gate (`loreEnabled`
  ships closed-vocab {themes,tone} with no raw-keyword leak; `loreQuote` ships
  raw excerpts; both/neither); and the `loreVersion` + `loreEnabled` +
  `loreQuoteEnabled` store actions.

### Local model presence (6A) — "Local AI lives in your world" Depth 1
The user's local Ollama model manifests as ONE landmark in the cell —
presence only (IDEAS.md "The local LLM is visible in the world", Depth 1).
No dialogue (CLAUDE.md "don't make the agent a chatbot").
- **Detection (via the Worker).** `worker/lib/providers.ts:detectLocalModel(env)`
  — never-throws, local-only. `LLM_PROVIDER !== 'local'` → `{present:false}`.
  Local path: `GET ${OLLAMA_URL}/api/tags` (installed catalog → name /
  sizeBytes / paramClass) + `GET /api/ps` (≥1 loaded model → `running`).
  Pure exported `paramClassFromName(parameter_size)` normalises the token.
  Route `GET /api/local-model` (`worker/index.ts`) just `json()`s the
  snapshot — 200 `{present:false}` on cloud/no-Ollama (NOT 501: absence is a
  normal state, unlike `/api/embed`).
- **Client** `src/api/localModel.ts:getLocalModel()` →
  `{present:true,models,running} | {present:false}`; never rejects (network /
  non-ok / cloud → `{present:false}`, same defensive posture as `embedTexts`).
  Pure exported `parseLocalModelBody(data)` (body→result transform, smoke
  surface) + `NO_LOCAL_MODEL` default. Reads ONLY local model metadata;
  nothing egresses to a third party.
- **Deterministic placement + appearance** `src/procedural/localLandmark.ts`
  (pure, src/procedural determinism domain):
  - `pickLandmarkModel(result)` — largest by sizeBytes, paramClass, then
    name tiebreak → ONE landmark (multiple models = a village is a LATER depth).
  - `landmarkVariantFor(model)` → `'cottage' | 'tower'`. Cutoff:
    `paramClass` billions ≥ `TOWER_PARAM_THRESHOLD_B` (30) → tower, else
    cottage; sizeBytes fallback (`TOWER_SIZE_THRESHOLD_BYTES` = 18 GiB);
    unknown size → cottage. `landmarkGlyphFor` → whitelisted glyphs only
    (`⌂` cottage / `║` tower — both confirmed in the Cozette atlas), tinted
    `LANDMARK_FG_KEY` (`cyan`).
  - `pickLandmarkCell(layout, seed, keepouts)` — `mulberry32((seed ^
    0x1a4d)>>>0)` (namespace `0x1a4d`, distinct from cell `0xce11` / scatter
    `0x5ca7` / Loki `0x10ce`). Picks a T_FLOOR cell that is not a keepout /
    not the spawn AND has a free floor neighbour (so the player can stand
    adjacent to press E). NO wall-clock / Math.random. The live `running`
    state is kept OUT of placement — position depends only on
    (seed, layout, keepouts).
  - `formatLocalModelStatus(model, running)` → `"Qwen 2.5 7B · idle ·
    localhost"` / `"· running ·"`.
- **Renderer** (`src/render/levels/cell.ts`): new `landmarkLayer` (Z between
  scatter + agents). After the scatter pass, `pickLandmarkCell` runs with
  `[lokiSpawn, ...scatterCells]` as keepouts and renders one BitmapText
  glyph. `pulseLandmark` ticker (sibling of `positionPlayer`, removed in the
  same teardown) modulates `alpha` 0.55↔1.0 ONLY when `running` — driven off
  `app.ticker.deltaMS` so it freezes under `paused`/`sleeping` and never uses
  a wall clock. Press-E on a landmark (when no launchable shelf is adjacent —
  bookshelf-launch wins) toggles a diegetic status panel
  (`mountLocalModelStatus` in `bookshelfPrompt.ts`, same Container+BitmapText
  pattern, tinted `cyan`); auto-despawns on step-away. `localModel` threads
  `mountPalace` (one-shot `getLocalModel()` in the boot `Promise.all`) →
  `mountLevel` → `mountCell`, all optional/defaulted to `NO_LOCAL_MODEL`.
- **Production follow-up (documented, NOT built):** a deployed remote Worker
  / frontend cannot reach the user's `localhost:11434`. The production path
  is the Electron main process probing localhost directly and exposing it
  over IPC (`src/api/electron.ts` + desktop preload), the way the v0.6
  wrapper checked Ollama. The local wrangler→Ollama path wired here is the
  dev/WSL-testable equivalent that proves the contract.
- Smoke: `smoke-6a-local-model.mts` (42) — size→variant thresholds + glyph
  whitelist, deterministic model selection + placement (same seed → same
  cell; 200 seeds all land on a valid free floor cell; keepout/spawn
  avoidance; walkable-neighbour guarantee), the `{present:false}` parse path,
  and the status formatter.

### Scale ladder beyond cell/district (Phase 7-A)
- **Clustering layer** `src/procedural/clusters.ts` — NEW pure module. Groups
  the library into a `district → island → continent` tree seeded by the
  profile seed. Two PRNG namespaces, both isolated from cell `0xce11` /
  scatter `0x5ca7` / Loki `0x10ce` / landmark `0x1a4d`:
  `CLUSTER_SALT = 0xc1a5` (bucketing; districts/islands/continents use
  `CLUSTER_SALT`, `+1`, `+2`) and `LAYOUT_SALT = 0xc0a5` (2D box / blob
  placement). NO `Math.random`/`Date.now`; games are appid-canonicalised
  before bucketing so input order (`profile.topGames` vs `SAMPLE_LIBRARY`)
  never moves the tree.
  - Input `ClusterGame {appid, name, engagement?}` — decoupled from `Profile`
    so the anonymous `SAMPLE_LIBRARY` path (no engagement) and the
    authenticated `profile.topGames` path (carries engagement) both feed it.
  - `clusterLibrary(games, seed): ClusterTree` — `ClusterTree {continents:
    Continent[], districtCount, islandCount, continentCount, gameCount}`;
    `Continent {id, islands}` → `Island {id, districts}` → `District {id,
    games, activity}`. Fan-out: `districtCountFor(n) = clamp(ceil(sqrt n), 1,
    8)`, then island = `clamp(ceil(d/2),1,4)`, continent =
    `clamp(ceil(i/2),1,2)`. Bucketing first-fills one game/district then
    PRNG-distributes the remainder, so **every district is non-empty + every
    game lands in exactly one district**. n==0 → empty-but-valid; n==1 → 1/1/1.
  - Pure helpers (smoke-pinned): `layoutClusterPositions(ids, seed, salt,
    cols)` (deterministic **collision-free** canonical-grid box placement:
    box `idx` → `(idx % cols, floor(idx / cols))`, every (x,y) distinct;
    seed/salt accepted for signature stability but unused — per-seed variety
    lives in the cluster TREE, not the layout. An earlier row-jitter could
    land two boxes on one cell, silently overwriting a card; removed in the
    7-A must-fix), `blobCells(cx, cy,
    area, w, h, seed, salt)` (continent land-mass raster — diamond footprint,
    seeded edge erosion, core always emitted, in-bounds), `activityGlyphFor`
    (engagement → shade ramp `▓ ▒ ░ ·`, the cell/tiles vocabulary),
    `flattenDistricts`/`flattenIslands`/`islandGameCount`/`continentGameCount`/
    `aggregateActivity` (aggregation), `truncateLabel`/`districtLabel`.
- **Real renderers** — `mountStubLevel` for island/continent and the static
  3×3 district placeholder are replaced:
  - `src/render/levels/district.ts` `mountDistrict(app, theme, games, seed)` —
    home district d0 as the centre card + up to 8 real neighbour cards (name +
    count + activity glyph); empty slots render as floor-dot terrain. YOU
    marker on the centre. Read-only (no ticker/keydown). Same fit/teardown.
  - `src/render/levels/island.ts` `mountIsland(app, theme, games, seed)` —
    the neighbourhood-cards of the primary continent (largest by game count);
    bordered card per district placed by `layoutClusterPositions`; YOU marker
    on the home district's card.
  - `src/render/levels/continent.ts` `mountContinent(app, theme, games, seed)`
    — continents as filled `blobCells` land-masses on a `·` dot sea, blob size
    ~ game count; centroid labels (home continent tints `fgBright`).
  - All three compose a character grid → ONE BitmapText panel (district.ts
    style, not per-glyph), tint via `hexToInt(theme.palette[key])` with ONE
    palette + the shared box-glyph vocabulary. Teardown = `off('resize')` +
    `container.destroy({children:true})`; NEVER `app.destroy()`.
- **planet + solar_system STAY stubs** — `mountStubLevel(app, theme, level,
  aggregateNote?)` gained an optional 4th arg; the router passes
  `"{gameCount} games · {continentCount} continents"` so the highest rungs
  carry a library aggregate instead of a bare "keep playing".
- **Router** `src/render/PixiApp.ts` `mountLevel()` — island/continent/district
  branches added before the `mountStubLevel` fallthrough, each calling
  `snapshotLibraryState()` (now also returns `clusterGames: ClusterGame[]` —
  `topGames` with engagement when authenticated, `SAMPLE_LIBRARY` without) →
  `mount*(app, theme, clusterGames, seed)`. The `[`/`]` zoom transition +
  `subscribe()` remount loop are untouched (every renderer returns a correct
  teardown closure).
- Smoke: `smoke-7a-scale-ladder.mts` (73) — clustering determinism (same
  games+seed → byte-identical tree; input order invariance), exactly-one-
  district membership + aggregation, sample/empty/single/15-game edges,
  fan-out formula, activity-glyph whitelist, `layoutClusterPositions`
  determinism/bounds/one-box-per-id + **all-distinct positions across 2000
  seeds × n=1..16 × cols=1..5** + the anonymous demo seed `0xa11ce11`
  collision-free (the 7-A must-fix regression) + seed-independence,
  `blobCells` determinism/core/bounds, label helpers.

### Composable panes — multi-pane router (Phase 7-B, VISUAL-ONLY)
The renderer moved from one-active-level-at-a-time to N simultaneous panes,
each showing a `(level, rect)`. **Single-pane is the DEFAULT + behaviour-
preserving**; multi-pane is opt-in (`\` toggles single↔study, `Tab` cycles
focus — both window-mode only). Seam SEMANTICS / agent crossing / memory flow
are NOT here (Depth-2, deferred).
- **Pure types** `src/types.ts` — `PaneRect {col,row,cols,rows}` (a cell on a
  uniform integer composition grid) + `PaneDescriptor {id, level, rect}`. Zero
  runtime; both the store + the renderer import them with no cycle.
- **Router** `src/render/PixiApp.ts` — the single `let teardownLevel` is
  replaced by `const livePanes = new Map<paneId, LivePane>` where `LivePane =
  {paneRoot: Container, mask: Graphics|null, teardown, refit, rect, level}`.
  - `computePixelRect(rect, gridCols, gridRows, screenW, screenH): PixelRect
    {px,py,pw,ph}` — pure, integer-floored grid-cell → pixel mapping. A 1×1
    grid + full-grid rect returns `{0,0,screenW,screenH}` — IDENTICAL to the
    pre-7-B single-level fit input (the back-compat anchor).
  - `mountPane(desc, cols, rows)` builds a per-pane `paneRoot` Container,
    positioned at the rect's pixel origin, added to a dedicated `panesLayer`.
    Clipped by a `Graphics().rect(0,0,pw,ph).fill()` assigned as `paneRoot.mask`
    — UNLESS `isFullGrid(rect)` (single-pane case): mask stays `null`, skipping
    the stencil so the render path is byte-identical to today. The level
    renderer fits to rect-LOCAL space (origin 0,0) because `paneRoot` carries
    the screen origin.
  - `mountPaneLevel(app, parent, rect, theme, level, paneId, writer, atlas,
    model)` — generalises the old `mountLevel`; dispatches to `mount{Cell,
    District,Island,Continent,Stub}` with `(parent, rect)` and returns
    `{teardown, refit}`.
  - `reconcilePanes(panes, cols, rows, seedChanged)` — the store-subscribe diff:
    mount added, unmount removed, remount on level/cell-seed change, re-fit on
    rect-only change. A focusedPaneId-only change never touches the Map (no
    remount flash). With ONE pane + a level change this reduces to exactly one
    teardown + one remount — byte-equivalent to the old `scaleChanged` path.
  - ONE app-level `app.renderer.on('resize')` listener recomputes every pane's
    pixel rect + drives each pane's `refit` (the 5 per-renderer resize
    listeners were removed). The single shared Application + ticker STAY — NEVER
    `app.destroy` on a pane change (only `paneRoot.destroy`; mask detached
    first to avoid a dangling-mask warning).
  - `refitAll` → `reconcileMask(live, cols, rows, pr)` reconciles each pane's
    clip mask against its CURRENT full-grid status (NOT just redrawing an
    existing one): partial-grid + no mask → CREATE + attach; partial-grid +
    mask → redraw (no GC churn); full-grid + mask → detach + destroy → null.
    This closes the single→study clip gap: `\` toggles the `root` pane's rect
    full-grid→partial WITHOUT changing its id/level, so `reconcilePanes` takes
    the cheap rect-only branch (`live.rect = desc.rect`) and never re-runs
    `mountPane` (the only OTHER place a mask is created) — `reconcileMask` in
    the subsequent `refitAll` is what creates the now-required mask, so every
    partial-grid pane is genuinely clipped. The full-grid↔partial reconcile is
    locked at the model layer by `smoke-7b-panes` A12 (id kept + rect flips
    full→partial); the mask geometry itself is PIXI → Windows checklist B1.
  - **Seam glyphs** — `seamLayer` (above panes) draws box-drawing decoration
    where panes abut: Graphics strokes for the seam runs + `drawSeamGlyphs`
    BitmapText junctions (`│ ─ ┼ ├ ┤ ┬ ┴`, `fgDim`). Pure decoration, NO
    semantics, NO crossing. Skipped entirely with one pane. Glyph-coverage
    smoke verifies the codepoints are Cozette-covered.
  - **Overlay z-order** — telemetry + morning-dispatch still `app.stage.
    addChild` (top); `keepOverlaysOnTop()` re-asserts `panesLayer`/`seamLayer`
    at the bottom after every reconcile so overlays stay above all panes.
- **Pane-scoped renderers** — `mount{District,Island,Continent,Stub}` signatures
  changed to `(parent: Container, rect: PixelRect, …)` → `{teardown, refit}`;
  they `parent.addChild` (NOT `app.stage`) and fit to `rect.pw/ph` (not
  `app.screen`). Mechanical; read-only (no input/ticker).
- **Cell input gate** — `mountCell(app, parent, rect, theme, layout, …, paneId
  = 'root')` → `{teardown, refit}`. ONE window keydown listener per pane (added
  once at mount, removed at teardown — NO per-pane add/remove). The handler
  gains ONE guard after the wallpaper guard: `if (getState().focusedPaneId !==
  paneId) return;` so only the FOCUSED cell pane consumes WASD/arrows/E. Default
  single 'root' pane ⇒ always focused ⇒ unchanged.
- **Per-pane player + runtime UNBLOCK (Phase 7 / v2.x)** — the 7-B deferred
  "two cell panes collide on the shared `playerPosition` + `agentRuntime`
  singletons" limitation is REMOVED. `playerPos`/`agentRuntime`/`perception`
  are now pane-scoped (see those sections above); each `mountCell` captures its
  own `getPlayerPos(paneId)` + `createRuntimeScope()`, so splitting a focused
  cell pane (`|` key → `splitPane`, which inherits the focused pane's `cell`
  level) yields a SECOND independent cell pane with its own `@` + cohort +
  perception — no collision. Input still routes to the focused pane only (the
  gate above). This GATES the Depth-2 seam-crossing / cross-pane memory flow
  work (NOT built here). The live two-`@` visual is PIXI-only (Windows
  checklist B4); the pure pane-isolation logic is smoke-locked
  (`smoke-pane-runtime.mts`, 19 assertions).
- **Input ownership (App.tsx)** — the globals keydown handler gained `Tab`
  (`cycleFocus`, `preventDefault` so focus stays on canvas), `\`
  (`setArrangement` single↔study), and `|` (Phase 7 / v2.x — `splitPane
  ('vertical')`; splitting a focused CELL pane yields a SECOND independent cell
  pane). ALL behind the existing `if (getState().wallpaperMode) return` guard so
  they no-op in wallpaper mode. `|` is a no-op in the single-pane default until
  pressed, so the default path is unchanged.
  The `[`/`]` zoom branch is UNCHANGED — it still reads `scale`/calls `setScale`,
  which the store redirects to the focused pane.
- Smoke: `smoke-7b-panes.mts` (68) — A1–A11 lock the one-pane reduction
  (`scale === focused pane level`; `setScale` mutates the focused pane;
  replaying App.tsx's `[`/`]` algorithm walks `SCALE_ORDER` identically),
  splitPane/closePane/focusPane/cycleFocus/setPaneLevel/setArrangement reducers,
  the pane-grid rect tiling (no overlap, full coverage), deterministic
  split-twice-from-reset ids, zero-pane guard, dangling-focus refocus, all rects
  in-bounds. A12 locks the single→study clip-mask regression trigger (the `root`
  pane KEEPS its id + flips full-grid→partial, which is what makes
  `reconcileMask` create the now-needed mask). The PIXI router (Container Map,
  masks, seam glyphs) is VISUAL → Windows checklist (`TODO-USER.md`).

### Seam graph + coordinate bridge (Phase 7-D — Depth-2 foundation)

**`src/state/seams.ts`** — PURE, PIXI-free, store-free (imports ONLY
`PaneDescriptor`/`ScaleLevel` from `../types`, the leaf). Derives the seam GRAPH
in INTEGER grid space, the SAME abutment fact `PixiApp.drawSeams` used to derive
implicitly — but as DATA so the two cannot diverge.
- `buildSeams(panes, gridCols, gridRows): Seam[]` — O(n²) pairwise. Two panes
  A,B share a VERTICAL seam iff `A.col+A.cols === B.col` AND their row-spans
  overlap (segment = grid col `B.col` over `[max(A.row,B.row), min(...))`);
  symmetric HORIZONTAL. `paneA` is ALWAYS the lower-coord pane (one canonical
  form). Deduped by `canonicalSeamId` (order-independent), sorted by id
  (deterministic; no Math.random — mirrors the src/procedural contract).
  Returns `[]` for <2 panes AND the lone full-grid pane → `PixiApp`'s
  `livePanes.size<=1` early-return is preserved exactly.
- `Seam`: `{ id, paneA, edgeA:'right'|'bottom', paneB, edgeB:'left'|'top',
  levelA, levelB, segment:{axis,line,start,end}, open, edgeType }`. **open/closed
  model: default OPEN, toggle RESERVED** (`open` ships always-true; `edgeType`
  reserved `null`) — a future locked pane flips them WITHOUT changing
  `buildSeams`/`bridgeCoord` signatures.
- `bridgeCoord(seam, from, dimsA, dimsB): BridgeResult` — same-level open seam →
  `{kind:'same-level', paneId, cell}` (entry on the shared edge's first interior
  col/row, along-edge coord proportionally projected dest↔src interior dims,
  round+clamp; round-trip within ±1, lossy by design). Cross-level seam
  (`levelA!==levelB`) → `{kind:'cross-level'}` NO cell (focus-transfer/zoom hint,
  not a literal walk — cell vs district are different coord spaces). Closed seam
  → `{kind:'closed'}`. `dimsA/dimsB` = each pane's INTERIOR `layout.width/height`
  (passed by the caller — NEVER looked up in the pure module).
- **`PixiApp.drawSeams` refactor (no-divergence)**: now iterates
  `buildSeams(<live pane descriptors>)` and projects each seam to pixels via
  `projectSeamToPixels` (exported; SAME float-floor `cellW/cellH` as
  `computePixelRect`) instead of the old per-pane right/bottom-edge loop. Smoke
  D1 asserts the load-bearing invariant: the projected PAINTED-PIXEL set equals
  the OLD per-pane edge painted-pixel set, across clean AND asymmetric tilings.
  On a clean tiling the stroke SETS also match (old loop OVER-drew shared edges
  twice → graph dedups → ONE stroke each). On an ASYMMETRIC tiling (a full-height
  pane abutting two stacked half-height panes) the graph SPLITS the shared edge
  into two collinear segments — so the stroke SETS differ from the old single
  full-span line, but the painted pixels are identical (collinear opaque 1px
  segments rasterise to the same line). D1 pins both: pixel-coverage equality
  AND that the asymmetric stroke sets genuinely differ (so the split path can't
  silently stop being exercised). `seams.ts` stays pixel-free; ALL float math
  stays in `PixiApp` at draw time → no 1px gap introduced. `drawSeamGlyphs` still
  runs whenever `livePanes.size > 1` (gated only by the early-return, NOT by seam
  count) → junction-glyph path byte-identical to pre-7-D. The actual PIXI render
  is Windows-checklist (the pixel-coverage equivalence is smoke-locked).

### Cross-seam perception (Phase 7-D — the cheap seed)

**`src/agents/crossSeam.ts`** — PURE enricher. `enrichSnapshotAcrossSeams(base,
paneId, deps): WorldSnapshot` splices a neighbour's player + agents (within
`maxFov` Chebyshev of the shared edge) into a COPY of `base.agents`, projected
into THIS pane's cell space via `deps.openSeamsFor(paneId)[].bridge.toLocal`
(neighbour space → this pane). **Returns `base` BY REFERENCE when
`openSeamsFor` is empty** → no-open-seam path allocates nothing, byte-identical.
Neighbour subjects are namespaced `${neighbourPaneId}:${id}` (own `loki` and
neighbour `loki` never collide; perception.ts's `otherId===runtime.id`
self-skip never drops a neighbour). Neighbour PLAYER → synthetic
`${neighbourPaneId}:player` agent (never overwrites `world.player` → THIS pane's
own player_proximity/hold-timer intact). Refuses a non-walkable / non-flat-cell
seam (vertical/scale) and an unregistered (non-cell) neighbour. `perception.ts`
is UNTOUCHED — the enriched snapshot is the only new input.
- **`src/state/paneRegistry.ts`** — NEW leaf (imports only types):
  `Map<paneId,{scope,layout}>` + `registerPane(paneId,scope,layout)→unregister`
  + `getPane(paneId)`. `cell.ts` registers at mount / unregisters at teardown
  (alongside `registerCellPaneScope`). SEPARATE from `cellPaneScopes.ts` (the
  paneId-less sleep-sweep Set, left byte-identical).
- **`cohort.ts` wiring**: `MountCohortOptions.crossSeamDeps?` (optional). When
  omitted → `noCrossSeamDeps(maxFov)` (no open seams ever) → enricher returns the
  snapshot by reference → single-pane / multi-pane-unjoined paths byte-identical.
  `maxFov` = max `def.fov` across the cohort, computed once at mount. The tick
  wraps `baseWorld` through the enricher before the perception loop.
- Smoke: `smoke-7d-seams.mts` (69) — S1–S10 seam graph + bridge, D1 draw
  no-divergence (pixel-coverage equality across clean + asymmetric tilings),
  X1–X6 cross-seam perception (sees-across-open /
  not-across-closed-by-reference / not-across-non-adjacent / no-seam-identical /
  id-namespacing / unregistered-neighbour), M1–M5 the migrate primitive
  (ok/no-leak/no-dup/duplicate-guard/cache-cleanup/plan-preserved).

### Live seam walk — single roaming roster (Phase 7-D.2)

The "terminal merging" payoff: an agent WALKS from one pane into the neighbour
— its runtime migrates and its sprite follows. **IDENTITY MODEL = SINGLE
ROAMING ROSTER** (Harry's call): the 5-agent COHORT exists ONCE across the whole
world; each agent is in exactly ONE pane's `RuntimeScope` at a time and roams by
crossing seams. This REPLACES the per-pane model (every pane spawned the full
COHORT). The `migrateRuntime` duplicate guard is now a BACKSTOP, not the norm.

- **Roster-once + per-tick sprite reconcile** (`src/render/agents/cohort.ts`) —
  the roster spawns ONCE, into ROOT's scope only (gated `paneId==='root' && scope
  empty`; `clearRuntimesIn` also root-only). A split pane mounts EMPTY and gains
  agents solely as they walk in. **ROSTER-AWARE GATE (must-fix):** the root-gate
  is IDEMPOTENT against a PARTIAL root remount — when root relevels (zoom `]`/`[`)
  while a sibling cell pane still holds an agent that walked out of root,
  reconcilePanes tears down + remounts ONLY root. The gate now SKIPS any id
  `isAgentLiveElsewhere(id, 'root')` (paneRegistry-backed) reports as live in
  another pane, so the remount re-adopts the distributed roster instead of
  cloning it (without this, root would re-create `loki` while p2 still held it =
  duplicate runtime + two sprites + doubled Tier-1; `migrateRuntime`'s dup guard
  only backstops the NEXT cross, never repairs an existing dup). Single-pane: no
  other registered pane ⇒ always false ⇒ full roster seeds, byte-identical. A
  split pane mounts EMPTY and gains agents solely as they walk in. `mountCohort`
  is a renderer+ticker: each tick
  `reconcileSprites()` diffs the sprite Map against `listRuntimesIn(scope)` —
  create a BitmapText for a newly-present id (positioned at `runtime.x/y`, NOT
  0,0; def-glyph via `defById`; skipped if no def — a theme-filtered id must not
  migrate in), destroy+drop a sprite whose id left. **The destroy pass + its
  `keys()` snapshot are skipped when `sprites.size <= scope.runtimes.size`** (no
  orphan) → the single-pane no-churn path is allocation-free at 60Hz. Spawn
  determinism is byte-identical (same `mulberry32((seed^fnv(id)))` +
  `resolveSpawn`, insertion order = defs order = Z-order).
- **Live wiring** (`src/render/PixiApp.ts`) — `CohortCrossWiring` (lazy:
  `crossSeamDepsFor(maxFov)` + `seamExitsFor()`) built from `buildSeams(live
  panes)` + `paneRegistry` interior dims, threaded
  `mountPaneLevel→mountCell→mountCohort`. `liveSeamGraph()` short-circuits to
  empty for `livePanes.size<=1` BEFORE `buildSeams` (no alloc; `openSeamsFor`
  returns [] → enricher returns base by reference). The deps closures re-derive
  each call so split/close keeps a mounted cohort current WITHOUT a remount.
- **Seam→edge/exit projection** (PURE, smoke-importable):
  `crossSeam.buildSeamEdgesForPane(seams, paneId, dims)` → `SeamEdge[]` for
  PERCEPTION (`toLocal` maps neighbour→this, just-past-edge, paneA→E/S edge /
  paneB→W/N). `seams.seamExitsForPane(seams, paneId, dims, isWalkable?)` →
  `Map<"x,y", SeamExit>` for CROSSING (`bridgeCoord` maps this→neighbour
  in-bounds). The two are INVERSE directions, authored independently so
  perception ≠ crossing can't silently swap. **FLOOR GATE (must-fix):**
  `seamExitsForPane` now takes an optional `isWalkable(paneId,x,y)` oracle and
  emits an exit ONLY when BOTH the exit cell (this pane) AND the bridged ENTRY
  cell (neighbour) are walkable (T_FLOOR) — mirroring behavior.ts:
  `walkableNeighbours`, which only steps onto floor. Without it an agent could be
  offered a cross that lands it INSIDE a wall (where it has no walkable neighbour
  out = stuck). PixiApp wires the live oracle off each pane's registered
  `CellLayout.tiles` (`isWalkableInPane`). **Consequence with TODAY's geometry:**
  the library cell fills its WHOLE perimeter with wall (`boundaryAt`: E/W = `│`,
  N/S = `─`; only a SOUTH door), so an E/W (vertical-split) seam yields ZERO
  crossable exits — an HONEST empty result, not a stranding. A VISIBLE crossing
  needs a walkable seam edge cell, which does not exist yet (DEFERRED follow-up:
  a doorway in the shared wall, or an N/S split aligned to the south door). The
  crossing MECHANISM is fully proven headlessly regardless (smoke builds floor
  exits by construction).
- **Cross-intent** (`src/agents/behavior.ts`) — `BehaviorContext.seamExits?`
  threaded from the cohort tick (only built when non-empty, so single-pane uses
  the static `baseCtx`). A `wander` step on a seam-exit edge cell offers "step
  off the edge" as ONE fixed-position candidate appended after the in-bounds
  floor neighbours (PRNG pick reproducible). When picked → set
  `runtime.pendingCross = {paneId, x, y}`, do NOT mutate x/y. No seam exit ⇒
  clamp exactly as today.
- **Runtime fields** (`src/state/agentRuntime.ts`) — `AgentRuntimeState` gains
  `pendingCross: {paneId,x,y} | null` (the intent) + `justArrivedAt: {x,y} |
  null` (anti-ping-pong guard); both default `null` in `initialRuntime`.
  `migrateRuntime` 'ok' path now CLEARS `pendingCross` (a stale intent in the
  destination would re-fire) and STAMPS `justArrivedAt` at the entry cell.
  behavior.ts suppresses emitting a fresh cross while the agent sits on
  `justArrivedAt` and clears it once the agent steps off (deterministic, no
  wall-clock → share-URL safe).
- **Consume** (cohort tick) — after `tickBehavior`, if `pendingCross` set,
  resolve the neighbour scope via `crossSeamDeps.getNeighbourScope` (a
  torn-down/non-cell neighbour → undefined → clear intent, stay put: the
  teardown-race / vanish guard) and `migrateRuntime`; on 'ok' `continue` (the
  agent left — its sprite reconciles away here, the neighbour reconciles it in).
  'duplicate' is logged as an anomaly (single-roaming-roster invariant breach).
- **Memory** — unchanged. Volatile runtime migrates with the agent (same
  object); persistent memory is library-scoped + already shared. No cross-pane
  merge.
- **DEFERRED**: a WALKABLE seam edge cell (today's solid-wall perimeter means an
  E/W split has no floor edge to cross — the floor gate correctly returns no
  exits; a doorway in the shared wall / a south-door-aligned N/S split is the
  follow-up that makes a live crossing VISIBLE); cross-LEVEL crossing
  (cell→district — `bridgeCoord` returns `cross-level`, no agent coord space
  yet); user open/close-seam control; per-pane throttling; arrangement
  persistence; closing-split-pane agent disposition (they DROP on teardown — root
  re-adopts/reseeds on remount; migrate-home deferred); visitor-mode/privacy on
  joined topology.
- **Windows-pending (NOT WSL-verifiable)**: the on-screen WALK + sprite handoff
  are PIXI-visual; they follow mechanically from the smoke-locked reconcile +
  migration AND require a walkable seam edge (deferred) to be observable. The
  certifiable-now visual checks are single-pane unchanged (W-2) + roster-once /
  no-dup-across-zoom (W-3). See `TODO-USER.md` "Phase 7-D.2 live walk".
- Smoke: `smoke-7d2-walk.mts` (58) — A1/A2 roster-once + determinism, W0–W3
  Seam→edge/exit projection + single-pane reduction (vs the 7d-seams eastEdge
  oracle), B1/B2 cross-intent emit / clamp, M1 migrate A→B exactly-once +
  activePlan preserved + pendingCross cleared + justArrivedAt stamped, D1/D2 no
  ping-pong, **C1/C2 roster-aware remount (no dup loki on a partial root relevel
  while p2 holds it; exclude-self so the first mount still seeds)**, **F1/F2
  floor-gated exits (real wall-perimeter layout ⇒ ZERO E/W crossable exits;
  entry-cell-wall refused; both-floor control restores them)**, R1 single-pane
  end-to-end (roster present, openSeamsFor [], migrate never invoked).

### Region terminals — per-wing cell panes (Phase 7 / v2.x)

A cell pane can render ONE *wing* (a 7-A cluster-tree district) of the library
instead of the whole-library cell — its own seed, shelves, agent cohort +
(seed-keyed) persistent memory, so a split pane becomes a genuinely DIFFERENT
generated world. This is the foundation for Composable-Panes Depth 3
(agent-initiated world-joining, IDEAS.md). **Default panes are unaffected**
(`regionId` absent ⇒ whole-library cell, byte-identical).
- **`src/procedural/regions.ts`** — PURE, determinism-domain. `regionTerminals
  (games, profileSeed): RegionTerminal[]` delegates bucketing to `clusterLibrary`
  (appid-canonical → input-order-invariant) + `flattenDistricts`, mapping each
  district to `{regionId, seed, label, games}`. `regionSeed(profileSeed,
  regionId)` mixes the district id into `profileSeed ^ REGION_SALT` via FNV-1a →
  a uint32 distinct per wing AND distinct from the bare profile seed (a wing
  never aliases the root pane). `REGION_SALT = 0x7e44` — a fresh PRNG namespace
  (no collision with cell `0xce11` / scatter `0x5ca7` / Loki `0x10ce` / landmark
  `0x1a4d` / cluster `0xc1a5` / layout `0xc0a5`). No Math.random/Date.now.
- **`PaneDescriptor.regionId?: string`** (`src/types.ts`) — OPTIONAL, only
  meaningful for a cell pane. Absent ⇒ whole-library cell.
- **Renderer** (`src/render/PixiApp.ts`) — `mountPaneLevel` gains a trailing
  `regionId?`; the cell branch, when set, resolves the matching `RegionTerminal`
  from `regionTerminals(snap.clusterGames, snap.seed)` and feeds the wing's
  `seed` + `games` (as `BookGame[]`) to `mountCell` instead of the snapshot.
  An unresolvable regionId (library shrank) falls back to the whole-library
  cell. `LivePane.regionId` is tracked + `reconcilePanes` REMOUNTS on a region
  change (alongside level/seed change). `snapshotLibraryState` is now EXPORTED
  so App.tsx can derive the live wing list without re-deriving games+seed.
- **Store** (`src/state/store.ts`) — `cycleFocusedPaneRegion(regionIds)`: walks
  the FOCUSED cell pane through `[undefined, …regionIds]` (whole-lib → d0 → … →
  wrap); no-op on a non-cell pane; never re-syncs `scale` (a wing swap keeps the
  level). The wing list is passed in by the caller (App.tsx) so the store stays
  free of the cluster-tree math. A stale regionId (not in the live list) →
  indexOf -1 → resets to whole-library.
- **Input** (`src/App.tsx`) — `r`/`R` (behind the wallpaper guard, alongside
  Tab/`\`/`|`) derives the wings via `snapshotLibraryState()` + `regionTerminals`
  and calls `cycleFocusedPaneRegion`. Safe — cell.ts movement is WASD/arrows/E.
  Works on the default single pane too (the whole world becomes one wing).
- **Windows-pending**: the on-screen per-wing room/shelves/cohort is PIXI-visual;
  it follows mechanically from the smoke-locked region logic + the existing
  cell-mount path.
- Smoke: `smoke-regions.mts` (20) — determinism, exactly-one-wing membership,
  unique regionId/seed, wing-seed ≠ profile-seed, REGION_SALT namespace
  isolation, input-order invariance, 0/1-game edges. Reducer coverage in
  `smoke-7b-panes.mts` R1–R5 (cycle undefined→d0→…→wrap, stale-region fallback,
  non-cell no-op, focused-only assignment).

---

## Desktop wrapper

### `Config` (`desktop/src/config.ts`)
On-disk JSON at `<userData>/config.json`.
- `mode: 'window' | 'wallpaper'` — 4A
- `displayId?: number` — 4B (undefined = primary)

### Wallpaper-mode state (`desktop/src/wallpaper/windows.ts`)
Internal module state:
- `attaching, trackedWorkerW, preWallpaper{Bounds,Style,ExStyle}, raisedDesktopOnEnter, watchdog, lastDisplay`

Exports: `enterWallpaper(win, display)`, `exitWallpaper(win)`.

### Throttle pipeline (`desktop/src/wallpaper/throttle.ts`)
`ThrottleState = 'full' | 'throttled-1hz' | 'paused' | 'sleeping'` (5B)

Controller state: `{timer, current, wallpaperHwnd, shellHwnd, display, isWallpaperMode, lastForegroundHwnd}`.

Probe now includes `idleDurationMs` from Win32 `GetLastInputInfo` +
`GetTickCount` (5B). Default `SLEEP_THRESHOLD_MS = 600000` (10 min).

Pure state machine: `computeThrottleState(probe)`. SLEEPING gate sits
ABOVE the fullscreen check (idle > threshold + no fullscreen →
sleeping); fullscreen still wins over sleeping. Testable in WSL via
mirror in `scripts/smoke-{4a-throttle,5b-sleep}.mts`.

**macOS/Linux idle ladder (consolidation 2026-06)**: the Win32 probe
(`getWin32()`) returns null off-Windows, so `startThrottleController`
now branches to `startIdleController(opts)` instead of degrading to a
permanent `full`. It polls Electron `powerMonitor.getSystemIdleTime()`
(whole-OS idle seconds — the macOS analogue of `GetLastInputInfo`) and
maps via the pure `computeIdleThrottleState(idleMs, isWallpaperMode,
sleepMs?, throttleMs?)`: `full` → `throttled-1hz` (`IDLE_THROTTLE_MS`
60s) → `sleeping` (`SLEEP_THRESHOLD_MS` 10min, same as Win32; drives
sleep-reflection + morning dispatch). NO `paused` (no window probe;
the wallpaper is behind everything, so a covering app hides it for
free). Shares `controller.timer` + the emit-on-change + IPC path;
Win32 path untouched. Pure ladder mirrored in `smoke-5b-sleep.mts`
(idle-ladder block). Verified live on macOS:
`[throttle] idle controller started (darwin) idle-throttle=60s sleep=600s`.

### Sleep reflection (`src/agents/sleep-reflection.ts`, 5B)
On SLEEPING entry (after 5s grace), App.tsx fires
`triggerSleepReflection()` which iterates present agents with
`reflectionCounter > 0`, calls `routeTier2` per agent with
`reflectionMinIntervalMs: 0` (bypass per-real-hour cap — this IS
the budget). Reflection texts + plan summaries buffer in a
module-local array; `consumeSleepReflections()` drains it for the
morning-dispatch overlay on SLEEPING → other transition.

### Morning dispatch (`src/render/overlays/morning-dispatch.ts`, 5B)
Terminal-styled BitmapText banner pinned to top-center. Shows on wake
when `consumeSleepReflections()` returns non-empty. Auto-dismisses
after 30s via PIXI ticker delta (NOT setTimeout — ticker is stopped
during sleep so setTimeout would fire too early). No interactive
dismiss in v1 (wallpaper mode is click-through + keydown gated).

### Peek state (`desktop/src/main.ts`)
Module-local `let peeking = false;` (4C). Bypasses persisted Mode.
`togglePeek()` flow: exitWallpaper → setAlwaysOnTop(true) → focus. Inverse on toggle-off.

### IPC channels
| Direction | Channel | Payload |
|---|---|---|
| renderer → main | `steam:getSteamId / isAvailable / launchGame / getAuthTicket` | various |
| renderer → main | `app:getUserDataPath` | — |
| renderer → main | `wallpaper:getMode / setMode` | Mode |
| renderer → main | `throttle:getCurrent` | — |
| renderer → main | `wallpaper:getPeeking / togglePeek` | — |
| main → renderer | `wallpaper:modeChanged` | Mode |
| main → renderer | `throttle:state-change` | `{state, isInitial}` |
| main → renderer | `wallpaper:peekChanged` | boolean |

Renderer side: `src/api/electron.ts` mirrors with defensive guards (`warnStalePreload` when bridge method missing).

---

## Worker routes (`worker/index.ts`)

| Method + Path | Phase | Notes |
|---|---|---|
| `GET /healthz` | 0 | Provider config + Ollama GPU status |
| `GET /api/auth/steam/{login,return}` | 2.1 | Web OpenID flow |
| `POST /api/auth/steamticket` | 6.2 | Desktop Steamworks ticket → cookie |
| `GET /api/auth/me / logout` | 2.1 | Session check |
| `GET /api/library` | 2 | Enriched + tagged library + profile |
| `GET /api/world` | 2.7 | Stage 1 manifest (cached 24h) |
| `POST /api/agent/tick` | 0 / 2C | Tier-1 micro-action |
| `POST /api/agent/reflect` | 2D + 5A | Tier-2 reflection + plan (5A added plan output) |
| `POST /api/embed` | 5C.1 | `{texts}`→`{embeddings}` 768-dim via local Ollama nomic-embed-text; cloud path 501 (privacy contract) |
| `GET /api/local-model` | 6A | `{present, models:[{name,sizeBytes?,paramClass?}], running}` via local Ollama `/api/tags`+`/api/ps`; cloud / no-Ollama → 200 `{present:false}` (NOT 501 — absence is a normal state). Reads ONLY local model metadata; never egresses |
| `POST /api/bake/sprite` | 3C | PixelLab.ai proxy for bake tooling |

---

## Smoke tests (`scripts/smoke-*.mts`)
Assertion counts as of 2026-05-30:
| Slice | File | Count |
|---|---|---|
| 2B | smoke-2b-cohort.mts | 13 |
| 2C | smoke-2c-perception.mts | 15 |
| 3A/3B/3C-β | smoke-3a-sprites.mts | 64 |
| 3C PixelLab | smoke-3c-pixellab.mts | 55 |
| 4A throttle | smoke-4a-throttle.mts | 23 |
| 4B monitors | smoke-4b-monitors.mts | 31 |
| 4C peek | smoke-4c-peek.mts | 24 |
| 5A reflection | smoke-5a-reflection.mts | 41 |
| 5B sleep | smoke-5b-sleep.mts | 22 |
| 5C lore (backbone) | smoke-5c-lore.mts | 27 |
| 5C.2a lore store | smoke-5c2-lore-store.mts | 34 |
| 5C.2b lore ingest | smoke-5c2b-lore-ingest.mts | 20 |
| 5D.1 lore profile | smoke-5d-lore-profile.mts | 17 |
| 5D.2 lore scatter | smoke-5d-scatter.mts | 16 |
| 5D.3 lore persona/gate | smoke-5d-persona.mts | 10 |
| 5D.4 lore visible | smoke-5d4-lore-visible.mts | 33 |
| 6A local model | smoke-6a-local-model.mts | 42 |
| 7A scale ladder | smoke-7a-scale-ladder.mts | 73 |
| 7B composable panes | smoke-7b-panes.mts | 68 |
| 7 per-pane runtime | smoke-pane-runtime.mts | 21 |
| 7D seam-crossing | smoke-7d-seams.mts | 69 |
| 7D.2 live seam walk | smoke-7d2-walk.mts | 58 |
| glyph coverage | smoke-glyph-coverage.mts | 19 |
| marginalia marks | smoke-t2-marks.mts | 43 |
| marginalia wear | smoke-land-wear-persist.mts | 21 |
| (others) | 2a/2d/2e/2f/2g | print "cleaned /tmp/..." |
| **Total numeric** | | **782** |

**No aggregate runner** — there is no `smoke-all.mts` / `npm run smoke` /
`npm run test`. Gates: `npm run typecheck` (`tsc --noEmit` ×2, main +
worker) and each `npx tsx scripts/smoke-*.mts` directly.

Shared helpers live in `scripts/lib/smoke.ts` (5H): `makeChecker()`,
`mockElectronModule()`.

Pattern: pure functions tested directly. Win32/Electron parts deferred
to user verification on Windows (logged in commit messages + TODO-USER.md).

---

**Wind phase + ☼ FIXED 2026-08-06 — the first rung of the conditions ladder.**
Foliage sway ran off each window's own ticker accumulator (`elapsedS`, zeroed
at mount), so two terminals opened at different times leant their trees in
opposite directions across a shared seam — the join's most visible
contradiction, since the seam blend places foliage from both wings side by
side. Found while writing up IDEAS.md § Shared rules across terminals (the
conditions-vs-content ladder), not from an eyeball.

`src/terminal/ambient.ts` is the new home for wall-clock-phased ambient
oscillators — the desk-global CONDITIONS, whose job is to agree across windows
opened at different times. `foliageSway(tSeconds)` is the first; `SWAY_PX` /
`SWAY_HZ` moved there from `terminalLand.ts`. The tick now reads the wall clock
ONCE and feeds both sway and cloud drift from it (clouds were already
wall-clock — `src/terminal/clouds.ts` had the pattern and the reasoning; this
just brings foliage onto it).

**The ☼ followed the same day** (Harry: "fix the sun glow pulse too"). Same
class, and the split is the ladder's whole point: the ☼ is SHARED SKY and now
takes the wall clock (`sunGlow`), while the monument/hall glow is WING-OWNED
content and deliberately stays on `elapsedS` — neighbours hold different
buildings, so their glows agreeing would mean nothing, and local keeps the
"freezes cleanly under throttle" property. The cos-ease shape moved into
ambient.ts as `pulse()` and both call it, so a condition and a local pulse now
differ in exactly ONE thing: which clock the caller hands it.

Known and accepted: the composer spends the `sun` ROLE on two things — the
sky's ☼ (`land.ts:367`) and the ☼ lamp beside a loved game's shelf
(`land.ts:581`) — sharing one render layer, so this syncs the lamps across
windows too. Benign (one light rhythm over the desk); splitting the role would
drag in the palette contract, the tile bibles and the glyph-coverage smoke for
no visible gain.

Gated by `scripts/smoke-ambient-phase.mts` (31 assertions), which carries both
old accumulators as live **negative controls** — if the pre-fix maths ever
stops diverging, the smoke has stopped testing anything. Three calibration
notes worth keeping. `SWAY_HZ = 0.35` makes the sway period exactly 20/7 s, so
mount gaps of 60 s and 3600 s are whole periods and the BROKEN code agreed at
precisely those (the control's first draft used them and proved nothing) — the
☼'s 4.2 s period has its OWN degenerate gaps, so its control derives them
separately and asserts non-degeneracy before asserting divergence. And the
phase tolerance is set by double precision, not by the maths: one ulp at epoch
magnitude is ~4e-7 s, worth ~6e-7 px of a 1.2 px sway. The transferable half is
in the brain as [[a-negative-control-needs-non-degenerate-inputs]].

**Verified live on the two-window desk** (not just in smoke), both fixes: four
samples across t1 and t2 — including a freshly RELOADED t2, the exact defect
condition with its accumulator zeroed — all tracked one shared phase. Worst ☼
deviation 0.006 alpha (range 0.62..1), worst sway deviation 0.044 px
(amplitude 1.2); both are frame lag between the last tick and the `Date.now()`
read, not phase error. The same reads carry the **inverse control**: monument
alphas in those samples missed a shared-clock prediction by 0.036–0.061, i.e.
window-local exactly as intended, so the conditions/content split is real and
not over-synced. Readback via `__terminal.debugDepth()` +
`scripts/e2e/term-drive.mjs`.

**World clock SHIPPED 2026-08-06** — the rung IDEAS.md named ("no world clock
exists today; the sky is static ambience"). `localHour` / `daylight(hour)` /
`skyPresence()` in `src/terminal/ambient.ts`, wired in the terminal tick.

- **Real LOCAL time**, deliberately, and the one place the UTC convention does
  not apply: the desk is a wallpaper you sit in front of all day and the point
  is that your 9pm looks like night. UTC still governs anything we *stamp*;
  this is something we *render*.
- **No broker channel.** Every window derives the hour from the same wall
  clock, so N terminals agree by construction — nothing to broadcast, no join
  event to handle, and a terminal opened at midnight matches its neighbours the
  instant it mounts. Third condition in a row where the wall clock removed the
  IPC rather than needing it.
- **Presence, not colour.** The composer bakes ☼, ☾ AND stars into every sky
  unconditionally (`land.ts:366-372`), so every terminal has shown all three at
  once at every hour since the desk existed. The clock decides which are out:
  `sun` multiplies the ☼ pulse (the pulse is the breath, the clock the
  envelope — at night it still breathes, at zero), `night` drives ☾, `star` and
  `starBright` together. Packs keep colour, so the ruling holds: a pack whose
  landOmit drops the sky roles has nothing to fade, which is legal omission.
- Stylised day, NOT an ephemeris: sine of solar elevation, sunrise 06:00,
  sunset 18:00, gained ×2.5 so twilight is ~1.7 h a side instead of the six a
  raw sine gives, smoothstepped so dawn eases rather than switching. Latitude
  and season would need a location and are out of scope.
- `src/procedural/` is untouched — the clock is render-side only, so the
  determinism contract is unaffected.
- e2e hook `__terminal.debugClock(hour|null)`; ☾/★ alphas added to
  `debugDepth()`. They are deliberately split: the first draft returned drawn
  alphas from `debugClock` and reported the sky it had just REPLACED (forcing
  noon read back the 06:30 sky), because the override does not reach the layers
  until the next tick. Command and readback are now separate calls.

Gated by `scripts/smoke-ambient-phase.mts` (71 assertions). The clock's failure
modes are not the oscillators' — nothing accumulates — so its bars are
different: no hard cut anywhere in the day (largest step per 30 s of world
time), twilight is a band of hours rather than a switch, monotone up all
morning and down all evening, continuous across midnight, sun and night
complementary, no ☼ at midnight, no stars at noon, and the ☼ still breathing
under a noon envelope (an envelope must not freeze the oscillator).

**Verified live on the two-window desk at forced hours** (you cannot verify
midnight by waiting for it): 00:00 → ☼ 0, ☾/★ 1; 06:30 → ☼ 0.18, ☾/★ 0.75,
both partly out; 08:00 and 12:00 → ☼ pulsing 0.72, ☾/★ 0; 17:30 → the mirror of
dawn; 18:30 → night. Both windows moved together at every step, and the
unforced clock read the true local hour (22.9, night) in both. Screenshots at
noon and midnight composited across the joined seam
(`scripts/e2e/join-shot.py`): midnight is a full starfield with the ☾ up,
across BOTH windows; noon has neither, in both. t1 composed no ☾ at all — its
readback is `null`, not 0, which is why that distinction is now in the hook.

**The honest limit, visible in those shots:** the sky's *colour* is a pack
constant, so noon reads as "night with the stars taken away" rather than as
daylight. Alphas-only was the right first rung — it respects packs owning
colour — but a bright day needs the pack contract to gain a second sky
register. That is now the top item on the ladder (IDEAS.md § Shared rules
across terminals, "Daylight colour"), and it is an authoring-spec change, not
a tweak.

**HELD 2026-08-06 — Harry's ruling after seeing it side by side.** The clock
stays built, smoked and verified, but the desk holds a fixed sky until the
daylight-colour rung lands. `CLOCK_HELD` in `src/terminal/ambient.ts` is the
whole switch; flipping it turns the live clock back on.

- **The hold is deliberately OFF the daylight curve.** There `sun + night = 1`,
  so every value on it trades one body for the other — and holding at night
  would drop the ☼, which (per the role caveat above) also carries the LAMPS
  beside loved shelves, darkening ground furniture that has nothing to do with
  the sky. `HELD_SKY = {sun: 1, night: 1}` is the PRE-clock sky: everything the
  composer baked, present. Holding therefore changes nothing already eyeballed.
  Smoked both ways — that no hour on the curve is neutral, and that the held
  sky is identical at every real hour.
- **A forced hour still runs the live curve** (`skyNow(forced, real)`), so the
  clock stays demonstrable while held rather than rotting behind a flag. That
  is its own bar in the smoke: it fails if someone "simplifies" the hold by
  deleting the machinery. `debugClock` reports `held` so a reader can tell a
  held sky from a computed one.
- Verified live after the hold: unforced reads `held: true` with ☼ 0.99 / ☾ 1 /
  ★ 1 (the pre-clock sky) at a real 23:12 whose curve says daylight 0; forced
  noon still empties the night sky; forced midnight still darkens the ☼;
  releasing the override returns to the held sky. Screenshot on file.

Smoke is 81 assertions with the hold's own bars. Comparison artifact (the
noon/midnight swap Harry ruled on):
https://claude.ai/code/artifact/1545b0a8-cdfa-442d-b4fd-06000f81b13d

Remaining rungs (daylight colour, then light direction and weather) are in
IDEAS.md § Shared rules across terminals.

---

## What this file is NOT

- Not the architecture doc (that's SPEC.md)
- Not the rule book (CLAUDE.md)
- Not the parked-ideas list (IDEAS.md)
- Not the slice sequence (PLAN.md)
- Not the per-phase narrative (RETROS/)
- Not the v1.0 scope (docs/pivot/CONSOLIDATION.md)
- Not the user-blocked list (TODO-USER.md)

It's just the present-tense shape of the moving parts. When a slice
changes a shape, the slice's commit should touch this file too.
