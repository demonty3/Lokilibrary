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

**Direction 2026-08-14 — single-surface focus.** Harry paused the web
build as a per-slice build/verify target: he only actually lives with
the Electron desk on the MacBook, and maintaining + testing two apps
doubles the verification cost for one used surface. The desktop app
(wallpaper, peek, launcher) is the sole active build-and-test surface;
the web/share build stays in the tree as the future share surface but
gets no per-slice verification, no bundle-size policing, and no new
investment until unpaused. Slices verify via the launch-desktop-app
skill (CDP-driven Electron) plus smokes; scripts/e2e harness runs that
target the browser build are no longer a gate.

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

**The daylight sky register SHIPPED 2026-08-08 (`d9244b5`), EYEBALL PASSED all
six bars the same day, and the rung is CLOSED — with bar 1's kill INVERTED. The
optional axis below stopped being optional the day after it was written.**
Harry's close: *"bars 3-5 pass, ship it"*, after passing bar 1 on the
side-by-side and accepting the re-cut phosphor on its four-hour frame. Bars 2
and 6 were settled by measurement rather than by eye. No dial was left
outstanding. Harry, on the side-by-side: *"solarized
looks way better because it actually looks like a time of day."* The frozen kill
was that a hue shift with no brightness change would read as a recolour rather
than an hour; it did the opposite. **Solarized moves ×1.2 in luminance —
essentially none — and reads as time; phosphor's first cut moved ×4.3 in pure
green and read less like one. Hue is the stronger axis for telling time, not the
fallback**, which refutes the argument-against recorded in IDEAS.md the day
before ("a hue rotation cannot make noon brighter, and brighter may be
irreducible to what day means"). Two explanations survive and this test does not
separate them: a brightness change may read as a *display* artifact where a hue
change reads as a *world* event, or a sky-plausible hue may simply beat one that
isn't. Both predicted the same fix, so **phosphor was re-cut (`15cdf4c`) with its
luminance held at exactly ×4.3 and only the hue rotated, 154° → 185°** — cyan
noon, amber dawn and dusk — which isolates the variable for the next eyeball.
**Bars 2–6 ran the same day; every measurable component passes.** Bar 2 is
settled outright: the V0 preview is static, so a pixel diff there means
something a live-desk diff cannot — pre-slice (`37c7a92`) vs current at seed
`0xca11ed` is **zero differing pixels on both authored packs**, which covers the
drawn-sky layer, the white-bake-plus-tint far layers, the mural backing and the
glow-filter re-parent in one measurement. Bar 6 likewise: three windows agree on
`skyInk` and `farInk` with no broker, and 16 px across each of the two joins is
one colour at every sampled sky row. Bars 3/5 clear their floors at every hour
(quietest being vs the drawn noon sky: solarized orange 3.08 against the frozen
3.0; ridge → ridgeFar ordering preserved). **Bar 4 produced the one finding
worth carrying:** measuring the `label` role against the sky gives 1.53 on
catppuccin at noon, which looks exactly like the 1.08:1 collapse that killed the
previous mechanism — and it is a false alarm. **Labels are ground-drawn (0 of
109 label cells sit in the sky band across four seeds at real desk geometry),**
so the recognition surface's denominator is the ground body, which the register
never moves; label contrast is invariant across the day. Marginalia and captions
*are* on the sky and hold at 4.48–9.15. What remains is taste only: the glance
half of bars 3/4/5, and bar 1 on the re-cut phosphor.

The blueprint's authoring guidance was written the other way round (brightness
first) and has been corrected to lead with hue.

**All ten packs swept 2026-08-08 (`51bacc1`): nine have a day, `ibm-3270`
omits and cannot do otherwise.** The spread is the point — `gruvbox-dark` ×1.0
(its `bg` is neutral grey, so its entire day is hue, iso-luminant to 1%),
`solarized-dark` ×1.2, `gameboy-dmg` ×1.4, `tokyo-night` ×3.8, `cozy-autumn`
×3.9, `phosphor` ×4.5, `night-drive` ×4.7, `catppuccin-mocha` ×6.4, `amber-crt`
×10.6. **`ibm-3270` is a measured negative rather than a preference**: its
ceiling is relLum 0.0028 over a `bg` of 0.0017, and the best colour reachable in
*any* hue direction has chroma 3.1–7.4 — the one above noise is a blue nowhere
near its monochrome amber. Nothing to author; omission is what the doctrine is
for. **Two defects the gate is blind to by construction, both found by
looking**: gruvbox's first cut peaked at midnight (its dusk sat 22% *below* its
own night — legible, gate-green and wrong), and gameboy-dmg's first cut at ×2.0
inverted the pack's figure/ground so the horizon flattened on a machine whose
judged identity is a dark blank field. Both re-cut. A contrast gate cannot see
"the sky got darker toward noon" or "the sky is now the brightest thing";
those need an eye and a plausibility check. Contact sheet:
`docs/design-reviews/2026-08-08-daylight-sky-register/all-packs-noon.png`.
`amber-crt` is where the glow-filter fix pays off visibly — its noon clears
`THRESHOLD 0.2`, so the whole sky would have bloomed before the backdrop moved
outside the filter.

Harry: *"make the background a separate environment which changes colour with
the time of day relative to the style of the terminal."* The first two clauses
were already answered (a drawn sky layer sat unbuilt in `git stash@{0}`; the
`daylight()` curve had been live since the arc); the third was the mechanism.
What died in August was **one global mix strength**, not per-pack colour. So a
pack now AUTHORS three stops — `daySky: {night, twilight, day}` — and the clock
interpolates them. `night` is pinned to `palette.bg` by the gate, so midnight is
byte-identical; absent means the sky never moves, which is legal omission.
Authored, not computed, because the maximal hue rotation for solarized-dark is a
dark red that reads as sunset rather than midday — a person decides that.

**The gate followed the denominator.** `smoke-style-pack.mts` measured
everything against `bg`, which was only true because the sky was never drawn. It
now re-runs the frozen bars against the sky the pack actually draws, **sampled
across the whole daylight curve** — contrast against a fixed ink is not monotone
in the sky's luminance, so an interior hour can be worse than either endpoint.
`BEING_MIN_CONTRAST 3.0`, `BEING_CLEAR 0.85`, `BG_LUM_MAX 0.35`,
`RAMP_STEP0_MIN 1.1` copied verbatim; nothing added, nothing retuned, and every
un-authored pack's measured values diff byte-identical against the parent commit.
340 assertions (was 305). Three packs authored, and the measured headroom splits
exactly as the two-axis finding predicted: `phosphor` ×4.9 and
`catppuccin-mocha` ×7.0 can brighten (lift axis), `solarized-dark` ×1.3 cannot
and rotates hue instead (`#002b36` → `#0e2a55`, ΔE 24.6). Seven packs opt out.
**Correction worth carrying: the desk boots `phosphor`, not `DEFAULT_THEME_ID`**
(`TerminalApp.tsx:16`; the Electron shell blocks `?theme=` on desk windows), so
the "solarized-dark is the out-of-the-box desk" line in IDEAS.md is true of the
palace only. Two latent bugs fixed alongside: the backdrop sat inside the `glow`
bright-pass filter (a lit sky would have bloomed the whole band on amber-crt),
and the 2px `bg` sliver either side of a 636px land in a 640px window would have
become 4px of dark line at a join. Spec + six frozen bars:
`docs/superpowers/specs/2026-08-08-daylight-sky-register-design.md`; shots in
`docs/design-reviews/2026-08-08-daylight-sky-register/`.

**The hour without colour SHIPPED 2026-08-07, eyeball PASSED same day — all six bars ("bar 1 passes, noon reads as day", then "bars 2-6 all pass"), no kill fired, no dial spent. The rung is CLOSED and the world clock is RELEASED.** That pass settles the fork the slice existed to resolve: **this world can say "day" by position and state alone, with no colour at all.** Both daylight-colour axes (per-pack luminance lift, 7/10; constant-luminance hue, which rescues solarized) therefore stop being the only path left and become an optional expressive axis for pack authors — captured in IDEAS.md with their own first tests and kills, nothing scheduled.
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

**Anatomy pass 2026-08-08 — the mural CUT, the reveal unframed.** Harry:
"the terminal aesthetic is a bit busy", then sharpened it — *"I'm not sure
what that big block in the centre is, as well as the d(number) things"*. So
the complaint was **naming, not density**. An annotated component breakdown
was built from the shipped source (Cozette + phosphor + real crops) and
marked up:
https://claude.ai/code/artifact/01ec38fa-92fe-4313-a48a-efc1c6e68876

The marks came back **16 reads / 1 too-loud / 1 cut, and nothing at all under
"can't name it" or "needs a name"** — including `wings`, the `d(number)`
skyline that prompted the question. That is the finding: the components were
legible once named, so no renaming or density work was warranted, and the
tidy collapsed to two items.

- **`mural: false`** (`terminalLand.ts` composeOpts). The composer keeps the
  entire mural path — every mural smoke still drives it with `mural: true`,
  and the branch the desk now takes is the one `smoke-land-mural.mts` already
  pins with a golden hash — so this is one word, reversible. Immediate
  consequence, visible in the shots: the sky is whole. The mural cleared its
  own rect last and unconditionally, which is why it *evicted the ☼ outright
  in 42% of lands* (`skyArc.ts:92-97`); both windows now carry a full
  starfield with the ☾ up. **Cost, recorded rather than argued away:** the
  land loses its per-game recognition surface (CLAUDE.md's "oh I own that"
  beat). Game names survive on the proximity labels, and the play-state
  ladder still encodes the relationship — but the artwork is gone, and if the
  beat is missed, the one word comes back.
- **The marginalia reveal no longer flashes.** Harry: *"I like the idea but I
  don't like how the message flashes up on the screen."* It did: 0.4 s of
  LINEAR ramp to full opacity, inside a `╔═╗` box, forced topmost. The box is
  also the shape CLAUDE.md rules out ("no floating speech bubbles") — a
  boxed pop-up is a chatbot surface, and the notes are meant to be marginalia.
  Now: unframed text (`wrapNote`, split out of `captionFor` so the palace
  cell's framed found-note box is byte-identical), a soft backing that rides
  the same envelope at 0.88× (which also closes the logged caption-backing
  defect), and `revealAlpha` — smoothstepped in and out over 1.4 s to a peak
  of 0.74, never full.

The ease is the fix, so the ease is what is locked. `smoke-t2-marks.mts` is
54 assertions (was 43), and **linear is a live negative control**: the onset
bar asserts the envelope covers <5% of its travel in the first 10% of the
fade, where linear covers exactly 10%. Mutation-checked three ways — reverting
the ease, the duration, or the peak each fails a distinct named bar.

**Verified on the running two-window desk, not just in smoke.** New e2e hook
`__terminal.debugReveal()` (the `debugClouds` pattern) sampled two complete
reveals at ~100 ms: onset 0.003 at 3.5% of the fade where linear predicts
0.027, peak exactly 0.740, backing exactly 0.651 = 0.740 × 0.88, `framed`
false throughout, total dwell 6.78 s = 1.4 + 4 + 1.4. A foliage glyph under
the backing measures (51, 67, 55) against a predicted green of 52.7 while the
same role outside the rect stays (76, 151, 91) — so the backing dims rather
than punches out, as intended. All 69 smoke files green; typecheck clean.

**Not done, deliberately:** no bars were frozen before this one. It was a
directly-instructed two-line tidy off a marked-up inventory, not a
speculative slice, and bars written after the shots exist are not bars.
Harry's on-screen look is the gate.

The standing colour finding from the same pass was recorded and unacted; it is
now **FIXED — see the entry below.**

---

**T4 SHIPPED 2026-08-09 — topology → reflection. The desk now has a Tier-2
mind, and it knows the shape of the desk it lives on.** Spec + frozen bars:
`docs/superpowers/specs/2026-08-09-t4-topology-reflection-design.md`.

**The precondition the PRD did not know it had: the desk had never dispatched
Tier-2 at all.** `routeTier2` had exactly three call sites, all on the palace
cell surface; `src/terminal/` never referenced it and `activePlan` appears
nowhere in the terminal path. So "rides existing reflection dispatch" was true
of the router and false of the desk — T4 owned standing the pump up, not just
the context. STATE.md's own T2 entry had recorded this ("DEFERRED: Tier-2 /
topology reflection (T4 arc)"); it was found by reading, not by surprise.

**The half already built and waiting:** `routeTier1` has been accruing
`reflectionCounter` on every seam arrival all along (importance 3), and
`carriedFromMind` carries it ACROSS seams — so a counter measures a being's
whole journey over the desk, not one window's. Counters climbed; nothing
consumed them. That also sets the natural cost: 150/3 = **~50 crossings** per
organic dispatch, so the threshold binds long before the router's 1-per-hour
limit ever does.

New pure `src/terminal/deskTopology.ts` (the edgePart/masthead posture) renders
the desk as one prompt line. **The roster is PULLED at dispatch time, not
pushed** — a new `terminal:getRoster` invoke rather than a field on
`terminal:topology`, because that broadcast is change-gated on `{joins, wings}`
to stay bounded and the roster moves on every crossing. `topology?: string`
threads ReflectInput → RouteOptions → `buildReflectPrompt`, beside `library`.

**One vocabulary widened, deliberately:** a wing id is now a legal `move_to`
target. No new verb, no change to the plan JSON. The line names ONLY wings with
a window actually open, and only the joined neighbours are offered as walk
targets — a being can only walk to a land it shares an edge with.

New `smoke-desk-topology` (35 assertions), **mutant-checked two ways**:
occupancy reading the local wing instead of the live roster → 5 red including
the crossing discriminator; offering any wing as a walk target → 8 red
including every closed wing. 73 smokes and all three typecheck legs green.

VERIFIED ON SCREEN (macOS, joined two-window desk, Worker up, real Sonnet):

- **Bars 1+2** — t1 reads "…yours shows d0. d1 joins you on the right…", t2 the
  mirror ("d0 joins you on the left"); both agree on open/closed. Occupancy was
  sampled **atomically against the broker roster 12 times while beings crossed:
  0 mismatches**, roster moved during the window. (Sequential before/after reads
  are useless here — the desk re-rosters every few seconds.)
- **Bar 5, the PRD's own acceptance** — a forced reflection returned
  `"the terminals beckon like warm spots."` with plan steps
  `[{kind:"move_to", target:"d1"}, {kind:"inspect"}, {kind:"place_mark"}]`. The
  model targeted the neighbour terminal using an existing whitelisted verb.
- **Bar 4** — a `plain` call immediately after was refused by the router's own
  gate (`skipReason: "below_threshold"`, counter consumed). `rate_limited` was
  NOT observed live and is not claimed: reaching it needs counter ≥ 150, i.e.
  ~50 staged crossings; that path is covered by the existing
  `smoke-5a-reflection`, and the pump passes no threshold/interval override
  except in the sleep pass.
- **Bar 6** — every call site drops the promise; the desk kept rendering and
  walking across dozens of dispatches.

**Bar 7 is CONFIRMED (2026-08-10). There was never a render defect — the
INSTRUMENT was measuring a bystander.** The banner had been auto-dismissed
before every capture, and `bannerRect()` then silently measured whatever was
left at the top of the stage.

Two faults, both in the measuring apparatus, both now fixed:

1. `mountMorningDispatch` returned a bare teardown; its 30 s auto-dismiss
   called that teardown INTERNALLY and never told the caller. So
   `dispatchBanner` stayed non-null forever after the first banner and
   `bannerOpen` reported `true` against a destroyed container.
2. `bannerRect()` read `app.stage.children[last]` — the banner only by luck.
   Once auto-dismissed, `last` is the **masthead**: a static overlay that
   yields a plausible rect, identical bounds on every re-read ("persists"),
   and real ink that tracks its own text length. On an `amber-crt` terminal
   it would have measured the scanline field instead, always.

Every symptom follows: the "valid rect" and the "5.5k-20k opaque pixels" were
the masthead's; "identical bounds 1.2 s later" is what a static overlay does;
and the capture was right all along — by then there was no banner to show.
The contrast, stage-order, render-group and inside-`world` hypotheses were all
chasing a phantom; none of them needed to be true.

The fix: `mountMorningDispatch` now returns a `MorningDispatchHandle`
(`{view, dismiss}`) plus an `onDismiss` callback, so the caller's handle dies
with the banner and the probe measures the overlay's OWN container. `debugBanner(n)`
mounts the banner from canned lines — bar 7 is a render question and routing
it through a live Sonnet dispatch made every look cost a call and a wait.
Third fix, unrelated to the phantom but real: the auto-dismiss counted
`performance.now()` while its own comment claimed ticker time, so the 30 s
burned down on a stopped/throttled ticker exactly as the comment warned a
`setTimeout` would; it now accumulates `ticker.deltaMS`.

VERIFIED ON SCREEN (macOS, joined two-window desk, fresh boot): the banner
composites at 179,24 (282×65 in a 640×520 window) over the phosphor sky, all
four lines legible — header, `Loki: …`, `↳ and made a plan`, `Archivist: …`.
Held at `debugClock(12)` (daylight 1.0) it stays legible, so it needs no
masthead-style backing: every shipped pack is dark-ground and phosphor's noon
sky is still a dark teal. Independently reproduced in headless Chrome at
dpr 1, so it is not a Retina or an Electron-surface effect. The instrument's
own two-sided check: 30 s after mount it now reports `bannerOpen: false` with
no rect, where before it reported `bannerOpen: true` with a 616×30 rect and
ink 6000.

The buffer half of bar 7 was already confirmed: `buffered: 1` → after the night
pass `buffered: 0`, so a second wake with nothing new shows nothing.

**The banner is ON THE GRID (2026-08-14).** It was the only surface still drawn
at 1× while the land, the masthead and the marginalia are all at `WORLD_SCALE`,
so it read as pasted on rather than as part of the terminal. Now:

- **Scaled** by setting `container.scale` to an integer (the masthead's own
  pattern) rather than raising `fontSize` — the baked Cozette atlas stays
  pixel-exact instead of being resampled.
- **Wrapped** to the columns that fit, with continuations indented two
  columns — the same two the `↳` decoration already sits at, so a reflection
  that runs on stays visibly owned by its agent line. An over-wide single word
  is hard-broken; on a grid an overhanging row is the thing that reads broken.
- **Snapped** to a cell origin at row 2, leaving the masthead its row 0 and one
  blank row between. Measured: x 24, y 52 — both exact multiples of the 12×26
  cell.
- **Bounded** to the rows below `topRow`, dropping WHOLE agents (half a
  reflection reads worse than an omitted one) and saying so in the footer rule.
  This bound is the scale-up's own debt — the reflect prompt caps a reflection
  at 140 chars, so a six-agent cohort is ~32 rows, which fitted at 1× and would
  have run off the bottom at 2×.
- **Ruled across the block**: header and footer span the widest row actually
  shown, so the dispatch reads as one panel rather than as two stubs floating
  above and below it. The header opens at the left (`── overnight ────…`), the
  footer closes at the right (`────… +2 more ──`) — the drop count is the one
  thing the footer has to say, so it sits where a reader lands. Width floors at
  the header's own label length, so a one-line dispatch still gets a rule long
  enough to carry it.

`renderDispatch(lines, maxCols?, maxRows?)` carries all of it and stays pure;
the palace passes neither for scale/wrap and is untouched apart from inheriting
the spanning rules, which suit its centred block too. `smoke-5b-sleep` is at 44
assertions, **mutant-checked three ways**: ignoring the row budget → 3 red
including the whole-agents discriminator; capping silently → 1 red; sizing the
rules off the last body row instead of the widest → 3 red.

VERIFIED ON SCREEN, both terminals, both packs: four agents at a realistic
reflection length sit entirely in the sky above the ground line; the six-agent
worst case stops inside the window and states `+2 more`.

**Second way to get a false negative here, hit during this very verification:**
an unfocused terminal window stops compositing, so `screencapture -l` returns a
frame from before the banner mounted — and the desk's own beings stop moving in
it too, which is how to tell. `osascript -e 'tell application "Electron" to
activate'` first, and confirm a being's `x` actually changes between two
`state()` reads before believing any capture.

**Session hygiene note:** repeated HMR reloads during verification make the
desk's `__terminal` and the composited frame disagree in confusing ways; a
`location.reload()` before any screenshot-based check is worth the 8 seconds.

---

**T3 slice 2 SHIPPED 2026-08-09 — the masthead and the parting frame; T3 is
code-complete.** Eyeball open. Spec + frozen bars:
`docs/superpowers/specs/2026-08-09-t3-slice2-design.md`. Two independent moves,
either of which can be cut without the other.

**The masthead.** The wing label was a DOM strip (`TerminalApp.tsx:29-45`) —
`#8a8a8a` 12 px *system* monospace on a `rgba(0,0,0,0.35)` band, byte-identical
in every window. Slice 1 gave each terminal its own palette and this sat above
them in the same grey, in a font the world never uses, over a black band cutting
across the pack's sky. It is now a Cozette row at `WORLD_SCALE`, a stage sibling
of `world` (chrome: outside the glow filter, under the scanline field), reading
`┤ d0 ├` + who is here + the wing's holdings. The DOM element stays, emptied, as
the drag region a frameless window needs. New pure `src/terminal/masthead.ts`.

The residents run is **who is HERE, not who lives here** — `mind.present` and
`away` both gate it, in COHORT order so an arrival never reshuffles the glyphs
already standing. Each glyph wears `theme.palette[def.paletteKey]`, the exact
expression `addBeing` uses, so the row's `c` is the ground's `c`.

**The holdings ramp changed after the shots, and that is the slice's one real
finding.** Built as specified — the scale ladder's shade vocabulary
(`▓▒░·`) plus a step for `mastered` — it failed on the desk: five adjacent
dither cells at `fgDim` read as a patch of texture, not five measures. That is
the **crust-legibility finding** (2026-08-01) resurfacing on a new surface. The
reuse argument was weaker than it looked — the ladder's glyphs are read *beside
a legend naming them*, and this row has no legend. Shipped as bar HEIGHTS
`█▆▄▂▁`: same five ordered steps, no dither, orderable without a legend.
Evidence at 5×: `t3-ramp1.png` (shade) beside `t3-ramp2.png` (heights), same folder. The
smoke now guards it both ways — no `▓▒░` may re-enter, and the steps must stay
monotone in height.

**The parting frame.** `drawEdges` was binary: a full-height wall, then the wall
*destroyed in one frame* and a `‹`/`›` placed at the ground. The join's craft was
carried entirely by the ground (knit sweep, hermite blend); the thing actually in
the way just vanished. The wall is now one text PER ROW, and a front travels
outward from the ground line over `EDGE_PART_S = 0.45 s`, upward into the sky and
downward into the strata, with a 3-row **jamb** lighting behind it — bottom glyph
bent away from the opening (`╰` left, `╯` right). Across a seam the two windows
draw `╯` `╰` over `›` `‹`: the frame has parted around the crossing. New pure
`src/terminal/edgePart.ts` — one front covers both directions and both rest
states, so the caller holds one number per side and no per-row state.

New `smoke-edge-part` (45 assertions) + `smoke-masthead` (27), **both
mutant-checked two ways**: restoring the old instant cut → 12 red including "one
frame in, the wall is still substantially there"; a uniform crossfade → 9 red
including "the front runs OUTWARD"; dropping the presence filter → 3 red;
colliding two ramp steps → 2 red. 72 smokes and both typecheck legs green.

VERIFIED ON SCREEN (macOS, joined two-window desk, frontmost). Shots in `docs/design-reviews/2026-08-09-t3-slice2/`:
`t3-slice2b.png`, `t3-jamb.png` (9× NN), `t3-mast2.png`, and the before/after
ramp pair.

- **Bar 1** — t1 label ink `0xb8c4b8` = phosphor `fg`; t2 `0x839496` =
  solarized-dark `fg`. Different, each its own pack's key; every resident ink
  matched that pack's cohort accent exactly (Loki reads `0xff5fd2` in t1 and
  `0xd33682` in t2 — one being, two packs).
- **Bar 2** — forced crossing: before, t1 `[archivist, cat]` / t2 `[]`; after,
  t1 `[archivist]` / t2 `[archivist, cat]`. Throughout, t2 carried
  `visitor(absent)` on its land and NOT in its row.
- **Bar 3** — backing 14 cols of 53 (26%), no border. The grey band is gone.
- **Bar 4** — per-frame recording of a real re-join: first parting frame at
  wall alpha **0.952** (not the old cut), still travelling at 0.10 s
  (front 3.04) and 0.25 s (front 11.5), at rest 467 ms in. At every sampled
  frame `wall@d0 ≤ wall@d4 ≤ wall@d10 ≤ wall@d16` — the front runs outward, it
  is not a crossfade. The jamb lights only *behind* the front (0 → 0.081 →
  0.415 → 0.6).
- **Bar 5** — both open edges: every wall row 0, exactly 3 jamb rows lit
  (0.6 / 0.45 / 0.3). Nothing on the seam column in the sky or the strata, so
  the spike's measured terrain continuity is untouched.
- **Bar 6** — both closed edges: every wall row 1, full height, no jamb.

**Bar 7 is Harry's** and is not measurable here. Observed and NOT introduced by
this slice: the caption-over-skyline defect (logged 2026-08-08) still fires.
Also observed and NOT a defect: a being can appear in both windows' rows for a
beat mid-handoff — the broker acks before despawn by design, and the roster
reconciled exactly on every settled read.

---

**T3 slice 1 SHIPPED 2026-08-08 — per-terminal packs; the ten authored packs
reach the product.** Eyeball open. Before this,
`TerminalApp.tsx:16` hard-coded `phosphor` for every window and the spawn URL
never carried a theme, so five style slots, a 370-assertion gate, two cold-run
stranger packs and a published blueprint were invisible on the shipped surface:
every terminal looked identical.

New `src/terminal/packAssignment.ts` (pure, Pixi-free — the `skyArc.ts` /
`clouds.ts` posture). **Assignment is renderer-side and derived from the wing
id**, which is why the slice needs no config field, no IPC and no desktop
change at all: a wing already seeds its own terrain from its id
(`terminalLand.ts:440`), so "same wing → same land" and "same wing → same pack"
are one idea, the choice survives quit/relaunch for free, and a window opened
at any moment matches what its neighbours already assume. `?theme=` still
overrides — that is how an omitting pack is reached deliberately.

**The pool is derived, not listed**: every pack compatible with `phosphor`,
that pack first, so a new pack joins the rotation by existing and an omitting
one stays out without anyone remembering. `d0`→phosphor (pinned: every judged
shot, the README GIF and the daylight authoring use it, so first boot keeps the
look the project has been eyeballed on), then `d1`→solarized-dark,
`d2`→gruvbox-dark, `d3`→catppuccin-mocha, `d4`→tokyo-night, `d5`→ibm-3270.

**The compatibility rule is the spike's constraint, deliberately stated
stricter than its evidence**: packs share a desk only if their `landOmit` sets
are identical. The measured finding is about SKY content specifically; whole-set
equality would also exclude a pack omitting only ground furniture. No shipped
pack distinguishes the two — `gameboy-dmg` is the only pack with any omission
at all — and the strict form needs no sky/ground taxonomy to maintain. Recorded
so a future ground-only omitter relaxes it with evidence in hand.

New `smoke-pack-assignment` (24 assertions), **mutant-checked two ways**:
dropping the compatibility filter → three checks red including "the rule
bites"; a constant assignment → three red including "the desk actually VARIES".
The gate deliberately asserts the pool is a *proper* subset, so a regression
that silently admitted everything cannot pass. 70 smokes and both typecheck legs
green.

VERIFIED ON SCREEN (macOS, joined two-window desk, frontmost): `d0` phosphor
(`skyInk 0x0a0a0a`) beside `d1` solarized-dark (`0x002b36`) — **and both windows
agree on the HOUR** (`moonAlpha 1`, `sunAlpha 0`), which is the daylight
register's bar 6 restated correctly: windows conform on the hour, not on the
ink. That bar was originally verified with identical themes and this slice
breaks ink-equality by construction, legally. Join intact across the
differently-packed seam (`edges` open both sides, `knits.fired 1`,
`glowStale 0`); terrain continuous — t1 col 52 crust at row 16, t2 col 0 crust
at row 16; beings visible across (`neighbours.right` carries three). Shot:
`t3-slice1.png`.

**No bars were frozen for this slice, and they are not being written now.** It
implements a shape whose bars were frozen and judged in the spike below; bars
invented after the shots exist are not bars (the anatomy pass set that
precedent). Harry's look is the gate. Observed and NOT introduced by this
slice: a marginalia caption can draw over the closed-wing skyline marks in the
sky band — both live there, and the reveal's soft backing does not fully clear
the wing ids.

---

**Two-pack seam spike 2026-08-08 — CONFIRMED with a constraint; T3's identity
half is viable.** Full write-up + the four shots:
`docs/design-reviews/2026-08-08-two-pack-seam.md`. No engine work — a throwaway
per-wing pack map in `TerminalApp.tsx`, reverted; the tree is unchanged.

Ran before T3's plumbing because per-terminal packs collides with CLAUDE.md's
standing "one theme palette per scene" rule, and building the config/spawn-URL
path first would have meant learning the answer after paying for it.

Four pairings, all against `phosphor`, joined, same hour: `amber-crt` (1.2× sky
luminance) fine, `catppuccin-mocha` (4.7×) fine, **`gruvbox-dark` (7.1×) fine**,
`gameboy-dmg` (9.9×) **broken**. The frozen kill fired on exactly one — and
**brightness is not what fired it**. `gruvbox-dark` was run specifically to
separate the variables, prediction recorded before the capture: nearly as bright
as DMG, but it omits nothing, and it passes. DMG's `landOmit` deletes star /
starBright / moon / cloud / sun / lamp and five more, so at the seam one side
carries a starfield and a moon and the other an empty field, at the same
instant, in one continuous space. **Shared content is the discriminator.**

Doctrine refined in `IDEAS.md` § Shared rules across terminals (seam clause):
the omit permission holds for a pack seen ALONE; **at a join, omitting a shared
truth IS contradicting it.**

Measured rather than judged: **terrain is continuous across a two-pack seam** —
`t1` col 52 crust at row 16, `t2` col 0 crust at row 16, each window computing
`landSeamBoundary` independently with no broker. Joins/knits/crossings are
palette-blind (`edges.right true`, `knits.fired 1`, `glowStale 0`, beings in
`neighbours.right`).

**Design change the spike bought before any code:** the plan proposed assigning
packs by `fnv1a` over wing id. That is now wrong — adjacent packs must agree on
which sky roles exist, and that is gate-expressible (the style-pack smoke
already reads every pack's `landOmit`). Where exactly the line sits between "a
visible tonal step" and "broken" stays Harry's call on the running desk.

---

**The being lift 2026-08-08 — KILLED at calibration; the demote shipped in its
place.** Spec + bars frozen before code:
`docs/superpowers/specs/2026-08-08-being-lift-design.md`.

The anatomy pass's standing finding: `ROLE_KEY` spends being-reserved palette
keys on terrain, so the salience contract has a hole where the product lives.
**Two corrections to how that was recorded.** (1) The desk-real scope is
**two** cohort members, not four: measured over all six wings at desk geometry,
only `cat` (orange) and `visitor` (cyan) collide — `relic` is magenta but
buried and `hall` is violet but the desk composes no hall. (2) The trigger is
the being's **own cell** (`surface[x] - 1`), which only `cottage` (5.0% of
columns) and `monument` (2.5%) can hold; `roof`/`topsoil`/`shaft` share the
orange key but never occupy it, and the `fgDim` roles are the GHOST's key,
whose dimness is a documented exception.

**Proven on screen before anything was built**, by move-and-diff: taking the
cyan Visitor off the cyan monument changed the vacated cell by **max 2/255 per
channel** where the same being on clear ground changed 41. Not drawn faintly —
not drawn.

**A second hole in the same gate**: `smoke-salience.mts` asserted the
reservation through `beingAccentRole(id)`, which `terminalLand.ts:983` uses
only for ids outside the cohort (`def ? theme.palette[def.paletteKey] : …`).
Every drawn being takes the first branch, so the gate was green for five weeks
over a path production never runs — and the two disagree about which agent gets
which colour. Lesson written up as
[[a-gate-can-assert-through-the-fallback-branch]].

**The lift died on arithmetic, not taste.** Bar A (≥1.5 separation) failed at
every factor and *plateaued* — 1.27 at ×1.28, still 1.31 at ×2.5 — because the
accents are already at or near channel maximum, so clamping eats the lift.
`night-drive` has ×1.00 headroom on all three colliding accents; `phosphor`,
the pack the desk boots, has none on two of three. **A being cannot be made
brighter: it is already the brightest thing its palette can say in that hue** —
which is what "beings own the loud register" bought.

So the same separation went on the side with headroom. `cottage` and
`monument` join `crust`/`foliage` in `GROUND_DEMOTE` at **0.6, the factor
already shipped** — not a new constant. "One ramp step" (0.78) is measurably
too small on *either* side (1.47 vs the 1.5 bar).

**`landRoleFill` now CAPS rather than multiplies** where a role is both demoted
and ramped: `min(f, demote)`. Found by the real gate after the calibration
missed it (the sweep used default `GRADIENT_FACTORS` and `bg`; the product uses
the pack's own factors and its drawn sky) — gameboy-dmg ramps both roles and
compounding drove its step-0 band to 1.01 against the frozen
`RAMP_STEP0_MIN 1.1`. **The bar was not touched.** Capping darkens only the
BRIGHT end, where the collision is; `RAMP_STEP0_MIN` guards the DIM end, and
DMG's step 0 stays `min(0.45, 0.6) = 0.45`, byte-identical. No-op for the two
roles the demote already shipped for — `crust`/`foliage` are `LAND_RAMP_LOCKED`
and never receive a step.

Gate: `smoke-salience.mts` 21 → 28. The own-cell role set is **derived** by
composing the desk's six wings at two widths (a new structure role joins for
free), the hidden-layer exclusion is **parsed out of `hideBakedLayers()`** so
un-hiding a layer re-arms the bar, and both derivations carry vacuity guards.
Mutant-checked four ways, all red. **First test PASSED live** (frontmost
window): the vacated cell now changes by **max 76/255**, against 2/255 before.
69 smokes + all three typecheck legs green. **Harry's eyeball is open on the
one cost: `cottage` and `monument` are darker in all ten packs.**

---

**T5 SHIPPED 2026-08-15 — orchestration v0, Depth-3 gated. The desk may ask
for one room a night, and only if you said it could.** Spec + eight frozen
bars (frozen before code):
`docs/superpowers/specs/2026-08-14-t5-orchestration-design.md`. Shape:
opt-in only (`orchestration` config boolean, default OFF, tray checkbox
"Overnight proposals"); an opted-in desk's SLEEP-PASS reflections see one
extra clause on the T4 topology line naming the CLOSED wings as legal
`move_to` targets; a plan step naming a closed wing becomes the night's one
proposal candidate (extracted from `activePlan` — **zero new AI calls**, the
CLAUDE.md ledger says so); main is the authority (first-writer-wins over
`terminal:proposeTopology`, session cleared on sleep/apply/dismiss, never
persisted); the winning window's morning banner grows the desk's FIRST
interactive element — `the night asks: a terminal onto d4?` over
`[ open it ]   [ let it pass ]`, hit-tested through the existing pointer
path (launcher-hotspot pattern; the Pixi container stays
`eventMode:'none'`); apply spawns through the EXISTING `spawnTerminal` at
exact abutment with the anchor's join chain (`proposalSpawnBounds`, pure) so
`computeJoins` reports the join mechanically; **no `setBounds` on any
pre-existing window anywhere on the path**; a missed banner evaporates
(Harry's call: 30 s timeout = dismissal, no tray fallback, banner taps
only). New pure modules `src/terminal/deskProposal.ts` +
`desktop/src/proposalPlacement.ts`; new IPC
`terminal:getOrchestration/proposeTopology/applyProposal/dismissProposal` +
`terminal:debugProposalState`; new hooks `debugSleepSweep` /
`debugProposal` / `debugTapProposal`, `debugTopology(proposals?)`. Smokes:
`smoke-t5-proposal` (37), `smoke-t5-placement` (16), `smoke-t5-broker` (27,
real broker under the mocked-electron harness); `smoke-t3-desk` grew the
orchestration erasure-hazard checks; full 76-smoke sweep + all three
typecheck legs green; `smoke-5b-sleep` and `smoke-desk-topology` pass
UNTOUCHED (the palace/opted-out byte-identity proofs).

VERIFIED ON SCREEN (macOS desk, CDP + REAL `Input.dispatchMouseEvent`
taps): opted-out — prompt line byte-free of the clause, broker rejects
`opted_out`, no banner; opted-in — five REAL Sonnet sleep-pass dispatches;
banner mounts on wake shape with the proposal panel (shot:
`docs/design-reviews/2026-08-14-t5-orchestration/desk-t1-proposal-banner.png`);
a real tap on `[ let it pass ]` cleared the broker session and closed the
banner with the desk unchanged; a real tap on `[ open it ]` spawned `t3`
onto d2 at exact abutment (700,160), `computeJoins` reported `t1|t3`, the
anchor's bounds stayed byte-identical, and beings then CROSSED into the
applied window on their own cadence (roster showed loki in t3; shot:
`desk-t3-d2-applied.png`) — the acceptance's "watch agents explore". The
30 s timeout observed evaporating a live proposal (session null after).

**Three live findings worth carrying.** (1) **Sonnet writes wing targets as
noun phrases** — the first real plan came back `target: "d0 terminal"`, so
the exact-match extractor would have missed every real proposal while all
smokes stayed green; extraction now matches a closed wing as its own WORD
(`\bd3\b`), which still only surfaces a wing the plan actually named
(brain: match-llm-emitted-ids-by-word-not-equality). (2) **Organic
proposal rate is LOW**: five real dispatches, zero closed-wing targets —
plans stay inside the open desk. Legal per the bars (empty nights are
correct, nothing is invented), and the spec's argument-against predicted
exactly this content weakness; if Harry wants a livelier night, the dial is
the clause's wording, never the gates. (3) **On the MacBook's 1440-wide
display a joined pair leaves NO room for a third 640px window** — apply
from a 2-chain is a truthful `no_room` no-op; a proposal can only ever
apply on a LONE terminal on this display. The machinery is display-honest;
the product consequence (T5 is near-inert on the sole active surface unless
a window is closed first) is Harry's to weigh.

**Not verified live, deliberately:** the broker-side session clear on the
transition INTO 'sleeping' (one line in the throttle callback; wallpaper
mode + 10 min real idle to reach — same precedent as T4, whose bar 7 also
bypassed real sleep) — the renderer-side mirror of the same clear IS
exercised by `debugSleepSweep`. Eyeball bar 8 (the shy-question taste bar)
is Harry's, on the running desk. Test-session config was restored:
opted-out, default t1/t2 pair.

---

**Underground-continuation probe OPENED 2026-08-17 (mockup only, no engine
work) — vertical stacking re-opened per protocol.** Harry asked for stacked
storeys directly; the recorded ground: "Terrace Join" was KILLED 2026-08-01
on priority grounds plus the invariant break (not refuted), and the
stacked-storeys idea (IDEAS.md, 2026-08-06) is PARKED on a mockup eyeball.
New document with the inherited kills quoted verbatim:
`docs/design-reviews/2026-08-17-underground-continuation.md` — **committed
BEFORE the mockup was authored** (freezing order is part of the record).
Product decisions (Harry, this session): a window snapped UNDERNEATH is the
**same wing's underground continuation** (no sky, all deep strata — caverns,
ore, relics, the descent shaft continuing down; the seam is the strata
boundary, dodging the recorded "sky at mid-elevation" failure); **downward
only** in v0; **mockup before engine**. Display fact that shaped the shape:
two stacked 520px windows (1040px) exceed the MacBook's ~830–875px work
area, so the under window is a second fixed size, **640×260**, mocked at
that size so the eyeball judges what would ship (pre-authorised dial: one
re-mock at 640×320). Kill conditions frozen in §3: K1 one-place
(inherited), K2 deep-rock legibility, K3 seam-reads-as-chrome. The probe
(`2026-08-17-underground-continuation.html`): upper window **generated from
the real composer** at the desk's exact options (53×20, skyH 11, no mural,
closed-wing skyline d1–d5) through the real render transforms
(strataMaterialGlyph / landRoleFill / phosphor), honesty-checked against a
live t1 capture (`2026-08-17-underground-continuation/live-t1-honesty-check.png`
— same monument, same shaft column 22, same strata register); the under-land
continuation is the one authored element — bedrock-dominant with stone-vein
intrusions so the depth gradient stays monotone across the seam, material
glyphs hashed at GLOBAL y so texture runs continue rather than restart, the
shaft continuing at the model's own column into a cavern, a relic labelled
with the wing's SIXTH game (the five slice games all label surface sites
above — a duplicate name would be an authoring artefact). Closed state
mocked too: bottom wall row `═` with `╤`/`╧` at the ╎-cadence transposed.
**Eyeball PASSED 2026-08-18 — "passes, the lower window reads as the same
wing" (K2 in its own words; no kill named on K1/K3; 640×260 not flagged
shallow, so the 640×320 re-mock dial goes unspent). Verdict recorded in the
probe doc. The Phase B engine slices (VJoin topology + under-compose +
shaft-column climb/descent, outlined in the approved plan at
`~/.claude/plans/i-meant-stacking-them-linked-duckling.md`) are UNBLOCKED.** Also this session, discussed and
recorded as separate candidate slices, unbuilt: desk-wide shared sky (one
moon/sun for the joined desk, wisps drifting across seams — Harry's three
visual findings collapse to per-window private skies), the caption-backing
defect, the README GIF re-cut.

**The stitch family SHIPPED 2026-08-17, eyeball PASSED same day ("yea those
look nice" → "yea merged") — all three MERGED; the corpus is 13 themes. The
motif-density question went unanswered: the widening unpark is NOT
triggered, and re-arms if Harry ever judges the packs short of the
reference.** Harry's reference: a cross-stitch pixel-art piece ("a
little quiet town in the coast of the Aegean Sea"; local file only, never
committed — public repo, someone's artwork). The extracted mechanism: every
material a FIELD of one repeated micro-motif, no outlines (boundary = field
change), detail from density + rhythm, depth from terraced field boundaries,
dark ground. Three packs authored against it through the EXISTING slots:
**aegean-stitch** (indigo sampler: ╳ starBright, ▚/▞ strata weave, ▲ trees,
olive green — first cut's mint green read as a different pack and was pulled
to sage), **kilim** (aubergine wool rug: ◆ starBright, ┄ skyDither weft, ♦
trees, madder/ochre), **winter-sampler** (spruce nordic knit: ♠ trees, ▘/▝
fine-knit strata, scandi red). All omit-free → they join `DESK_PACK_POOL`
positions 8–10 with ZERO change to the shipped wings d0–d5 (mapping is
positional). All four gates green per pack (style-pack 72 assertions each;
bedrock/cavern dropped from the aegean ramp — bgAlt-keyed roles fail the
step-0 bar by construction). Desk-verified live (`?theme` on t2 via
`history.replaceState` + reload — **plain `location.href` navigation gets
renormalised to the canonical URL by the shell; replaceState is the working
override path**). Shots:
`docs/design-reviews/2026-08-17-stitch-packs/`. **The round's real question
rides the eyeball: do current slots reach the photo's motif density, or do
these packs fall short — the frozen widening-track unpark condition ("a real
pack author needs a slot that does not exist"). Gates never bound; no
engine gap was HIT during authoring, so the unpark is not triggered unless
Harry's eye says the read falls short.** Also this session: the N-window
resource check (IDEAS.md § hundred-terminal has the numbers — 6 windows
cheap, idle ~zero, virtual tier binds at multi-monitor scale) and the
full-screen-desk direction discussion (PURSUE; ladder recorded in session,
gated on the underground eyeball + scale/anchor slice).

**Mural-weave probe JUDGED same day → MUTATE into the cell-density probe
(JUDGED same day: **KEEP SCALE 2** — "let's leave it as is"; fidelity routes to mixed registers only, per the frozen routing).** The weave at the real 22×5 mural rect did not
pass recognition (consistent with why the mural was cut); mosaic beat
cloth; the 44×10 diagnostic was Harry's "clearly the best" — so the
binding variable is CELL DENSITY, and Harry asked the foundational form:
can the whole world run a finer lattice? New probe with frozen bars
(`docs/design-reviews/2026-08-17-cell-density.{md,html}`): d0 composed at
today's 53×20/scale-2 beside a 106×40/scale-1 candidate (band split
rebalanced to today's sky proportion — the first cut was 62% sky vs 55%
and biased K2), both honest composer output. K1 glance-legibility of
beings/labels, K2 richer-place-vs-texture. PASS opens a real engine
question (scale dial, salience bars re-measured at the new denominator,
sub-cell animation re-dialled — own spec); FAIL routes fidelity to mixed
registers (fine-lattice mural rect / far layers inside the coarse world).
The mural's return waits on this answer either way.

**Caption-over-skyline defect CLOSED 2026-08-17 (close-out queue item 2;
logged 2026-08-06, residual re-observed at T3 slice 1).** The anatomy pass's
translucent backing (peak 0.651) dims terrain correctly but cannot solve
text-over-text: a caption whose rect crosses the closed-wing skyline mixed
with the wingSil/wingMark glyphs. Fix is occlusion, not opacity: the reveal
is nearer than the far-ridge plane, so while it is live an inverted mask
(scene-sized rect with the caption rect cut out, Pixi `cut()`; the
PixiApp.ts pane-clip pattern) is applied to the wingSil/wingMark layers
only — every judged reveal number (1.4 s smoothstep ease, 0.74 peak,
0.88× backing) is untouched, and terrain under the backing still dims
rather than punches out. The mask engages at `SKYLINE_OCCLUDE_ALPHA = 0.35`
on the same envelope, so the half-risen backing covers the glyph swap
instead of the ids popping out under an invisible caption; it releases on
the way out, closes safely on cap-eviction, and a join recompose re-masks
the fresh scene's layers (the old ones die with sceneContainer).
`debugReveal()` grew a `skylineOccluded` field. VERIFIED ON THE LIVE DESK
(typecheck + all smokes green first): flag observed true at peak 0.74 and
false at 0.041 on fade-out; pixel proof via two join-shots — the `d4 d2 d5`
wing ids absent under a live caption occupying their exact band, restored
after it closed, and ids OUTSIDE a live caption's rect unaffected while it
showed. Test residue: a few debugMark notes placed at cols 29/41 of d0
persist in the desk's mark memory (in-voice, render-capped; same precedent
as every debugMark-driven verification). Eyeball queued in TODO-USER.md.

**Shared sky SHIPPED 2026-08-18 (close-out queue item 4) — one ☼, one ☾,
weather crossing seams; no broker, by construction.** Spec + frozen bars:
`docs/superpowers/specs/2026-08-18-shared-sky-design.md` (committed before
implementation). Mechanism: every window already receives the FULL joins
list + wings map, so every window derives the same left-to-right chain
(`sharedSky.ts deskChain` — pure, cycle-guarded) and everything shared
seeds off the chain's wing key. Bodies: a hash of (chainKey, role) picks
one HOST window per body; only the host draws its ☼/☾ (extraction, arc,
glow untouched). Wisps: chained windows author `2 × chainLen` wisps from
the chain key (canonical shapes, the judged 0.25–0.45 band), positions in
desk-space over the chain's combined width; each window converts to local
columns, the canvas clips the overhang, and the neighbour — same clock,
same maths — draws the rest of the run. Occlusion stays per-window (own
blocked spans, own pack omissions). Solo (chain of one) leaves every sky
path byte-identical — the shared branch is unreachable (B3). The chain is
tracked BESIDE joinKey because it can change without this window's own
join seeds changing (a third window docking on a neighbour's far side);
that path rebuilds wisps + bodies without a recompose.

**All four measured bars PASSED on the live desk** (typecheck + full sweep
+ 17-assertion `smoke-shared-sky.mts` first): **B1** t1 sun-view only /
t2 moon-view only (debugSky both windows; re-verified after a fresh join);
**B2** timestamped reads 15.1 s apart show all four wisps at consistent
desk positions drifting at exactly their spec speeds (0.40–0.44 cells/s),
and one wisp was caught mid-crossing — desk x 45.2 in both windows, t1
drawing to its right edge, t2 the head past the seam, both lit; **B4**
closing t2 collapsed t1's chain to one, wisps back to 2, both bodies
redrawn; rejoining re-split them. The KILL (windows deriving different
chains) never fired — every paired read agreed on key `d0>d1`. `debugSky`
grew a `shared` block (chain/index/key/hosts/per-wisp desk-x). Shot:
`docs/design-reviews/2026-08-18-shared-sky/joined-pair-one-sun.png`.
Eyeball PASSED same day ("yea looks good") — the slice is fully closed.
Known and accepted (spec §2): the host pick is blind to pack omissions —
only gameboy-dmg omits bodies and it is excluded from the auto-pool.
Verification note: an OCCLUDED window's compositor pauses, so its drawn
positions read stale over CDP — activate the app before sampling (two
false alarms this session both dissolved on wake). **The README demo-GIF re-cut SHIPPED the same
day**: same rig and beat (join-demo.sh, 36 frames), now showing d0
phosphor beside d1 solarized, ONE moon after the snap (checked
frame-by-frame — the exact frame class the old cut carried two moons
in), desk-wide wisps, marginalia reveals, the crossing. The close-out
queue's Claude-side items (2, 3, 4) are all closed; remaining are
Harry's T3/T5 eyeballs, the caption eyeball, and the T5-1440px call.

**Phase B — underground continuation SHIPPED 2026-08-18 (all three engine
slices, one session; Harry's eyeball PENDING).** Spec with frozen bars
committed first (`docs/superpowers/specs/2026-08-18-underground-continuation-phase-b.md`);
slices landed B1p → B1w → B2s → B3, each typecheck + smoke green before
commit. The shape: a second window kind — `Open undercroft (<wing>)` in the
tray spawns a 640×260 `under` window (`&under=1`, `resizable:false`) docked
at exact abutment beneath its surface terminal; `VJoin {top, bottom}` in
`desktop/src/topology.ts` (`computeVSnapTarget`/`computeVJoins`/
`neighbourBelow`/`neighbourAbove`, `SNAP_X_PX 48`), kind-gated so ONLY under
windows snap vertically and horizontal drag is their escape — the old
SNAP_Y_PX conflict dissolved, surface behaviour untouched (smoke-t0
unmodified). `composeUnderLand` (`UNDER_SALT 0x0d0e`, own stream) continues
the wing's depth profile via the extracted `landReliefProfile`/`shaftColumn`/
`strataRoleAtDepth` helpers — role bands, shaft column + GLOBAL-y glyph
parity, and `strataMaterialGlyph` runs (renderer `strataYOffset`) agree
across the seam with no broker; the flat crust floor row IS `model.surface[]`
so intents/wear/marks/knit run unchanged; `'deep'` (violet) is emitted for
the first time below twice the surface band. Seam craft: on dock a `─` wall
row parts OUTWARD from the shaft (rowSpan + the reused partFront/wallAlpha),
a strata glow rides the front (vKnitCols), pulsing `▾`/`▴` thresholds mark
the shaft mouth; both rest states carry zero objects (vjoin-free windows
byte-identical). Descent: crossing side widened to down/up at the HANDOFF
seams only (nearEdge + watch_edge stay horizontal — beings don't see through
rock); a being crossing the shaft column while the seam is open may take it
(0.25 chance + cooldown); climb is renderer juice (x pinned, eased row
offset — the intent engine stays 1-D); `deskTopologyLine` gains the
undercroft clauses, never a move_to target (reachableWings untouched,
smoke-t5-proposal passes unmodified). ZERO new AI call sites (CLAUDE.md
entry added). **Verified live end-to-end on the desk**: dock/undock/re-dock
by drag (surface window never moves — T5 kill held), relaunch restores the
vjoined pair (TerminalSlot.kind persisted; absent = surface), wallpaper
round-trip with an undercroft docked keeps bounds, and loki + cat descended
organically, lived on the gallery floor, were STRANDED safely when the
undercroft was dragged away mid-visit (exits refuse, no crash), and climbed
back after re-dock. Smokes: new `smoke-under-land` (92) + `smoke-vertical-join`
(37); extended edge-part (54), broker-handoff (39), cross-edge (17),
being-intents (52), desk-topology (43), glyph-coverage. Shots:
scratchpad-only this session; the eyeball re-captures. **Eyeball PASSED
same day — "passes, the undercroft reads as one place — merged": K1 in its
own words, no kill named anywhere, including against the flagged violet
`deep` band, which stands as shipped (its dial — ROLE_KEY.deep / deep fill
density — stays available if it ever grates). The vertical-stacking arc is
CLOSED at v0 scope.** The L-shape stays deferred; hall/storeys stays
parked on its own precondition.

**Scale/anchor slice SHIPPED 2026-08-18, eyeball PASSED same day
("the aperture eyeball passes — reads as the same wing, merged") — window
height stops meaning zoom and starts meaning depth.** Spec + frozen bars committed
first (`docs/superpowers/specs/2026-08-18-scale-anchor-slice.md`); the
load-bearing rung of the full-screen-desk ladder (IDEAS.md § Terminals of
different sizes, item 2; PRD § risks "lock land scale across terminals",
made concrete). WORLD_SCALE stays 2 (cell-density verdict inherited). The
surface geometry is now the exported constant `DESK_SURFACE` in
`src/procedural/land.ts` ({rows 20, skyH 11, band 4, underH 4, groundRow
15}) — `terminalLand.ts` composes with a FIXED skyH instead of deriving it
from window height, and `layoutWorld` anchors the world to the window TOP
(`world.y = 0`, replacing the bottom anchor; at both shipped sizes content
exactly fills the window, so the swap is pixel-identical by construction —
top-anchored ground + the broker's tops-equal join predicate is exactly
what keeps ground lines continuous at any height). Extra height composes
`extraRows` of **aperture rock** below the canonical model via the new pure
`composeLandExtension`: each row draws from its own salted stream
(`seed ^ EXT_SALT(0xa9e2) ^ globalRow`), so any two heights agree on every
shared row *by construction* (the UNDER_SALT discipline, per-row-keyed) and
the canonical compose is untouchable — **widening `underH` instead was
ruled out and must stay ruled out: underground draws interleave in
composeLand's main stream before surface/ore/sky draws, so it moves every
above-ground row**. Content: strata fill at the undercroft's density
constants, shaft continuing at global parity, ≤1 ore glint per row; no
caverns/gallery/floor — uninhabitable depth, `model.surface` stays in the
top 20 rows so beings/marks/wear/knit/descent never see the extension.
Desktop: `terminal:debugSpawn` takes optional `heightPx` (clamped 520–780),
the Terminal record carries its real `h` and the broker re-applies it at
snap/debugMove (no more squash-to-520); debug heights are session-only
(restore respawns standard); `spawnUnder` is GATED to standard-height
parents — a tall window's extension rows and an undercroft's galleries
both claim global rows 20+, and reconciling them belongs to the
variable-size rung. Evidence: new `smoke-land-aperture` (26 — anchor
identity, row agreement 5-vs-12, band/parity continuity incl. join relief,
per-wing aperture goldens frozen, canonical d0 golden double-pinned); full
80-smoke sweep green with ZERO re-baselines (bar 1); both typecheck legs +
desktop tsc green; live on the desk — 640×650 t3 (d2) spawned via the debug
IPC, snapped to t1 (d0) with joins `[{left:t1,right:t3}]` at its own height,
masthead/sky/ground rows aligned across the seam, only deeper rock differs
(bedrock thinning into the violet `deep` band, shaft unbroken). Shots:
`docs/design-reviews/2026-08-18-scale-anchor/`. Smoke-literal hygiene rode
along: smoke-salience + smoke-under-land geometry restatements now import
DESK_SURFACE (zero goldens moved). **Frozen bars carried:** every golden
byte-identical (kill: a golden moves → the canonical compose was perturbed;
rework, never re-baseline); extension rows pure in (seed, width, globalRow).
**Eyeball PASSED 2026-08-18, same day:** tall-beside-standard reads as a
deeper aperture onto the same wing — "reads as the same wing, merged". The
frozen kill (second-underworld read → cut ore glints, then cap extension
depth) never fired; both remedies stay available as dials if the read ever
grates. Next rungs on the ladder are UNBLOCKED: variable widths, then the
archipelago full-screen mockup.

**Variable-widths rung SHIPPED 2026-08-18, same day (eyeball PASSED) —
window width means horizon, not zoom.** Spec + frozen bars committed first
(`docs/superpowers/specs/2026-08-18-variable-widths.md`); rung 2 of the
full-screen ladder (IDEAS.md § Terminals of different sizes, item 1).
Most of the rung was ALREADY width-general and was verified by reading, not
assumed: the renderer composes cols from its own window width, snap/join
maths reads width off the bounds, proposal placement walks real bounds,
near-edge projection is distance-from-edge, and the seam blend folds wing
seeds only. What actually changed: (1) broker — `Terminal.w` beside `h`,
`terminal:debugSpawn {widthPx}` clamped **[480, 1200]** (480 = the
renderer's 40-col floor at CW 6 × WORLD_SCALE 2; 1200 keeps a wide window
plus a standard sibling inside a 1440 work area), settle/debugMove/clampX
re-apply the window's own width, debug widths session-only (restore
respawns standard); (2) the topology payload carries
`widths: Record<id, px>` (broker ground truth, in the change-gate key);
(3) shared sky — desk-space is now a PREFIX-SUM space: `chainOffsets` in
`sharedSky.ts`, every window converts every member's px width to cols with
the same formula it uses for itself, `sharedWisps` takes the chain's total
cols, wisp draw + skyDebug deskX use the offset instead of
`index × model.width` (uniform chains produce byte-identical values by
construction — bar 2); (4) the vertical dock gains a width-equality
predicate (computeVSnapTarget/computeVJoins) and `spawnUnder` gates to
standard-WIDTH parents beside the existing height gate — the shared relief
profile and shaftColumn are functions of cols, so a mismatched dock would
disagree at the seam by construction. Evidence: smoke-shared-sky 22 (bars
2+3: uniform offsets ≡ index × width, mixed offsets are prefix sums, host
picks blind to widths), smoke-vertical-join 40 (width-mismatched pair
never vjoins/vsnaps), smoke-t1-broker-handoff payload shape; full 80-smoke
sweep green with ZERO re-baselines (bar 1, every golden byte-identical);
both typecheck legs + desktop tsc green. Live (bar 5): 960×520 d2 spawned
via debug IPC, snapped to standard d0 — join reported at width 960 (no
squash), skyDebug from both seats agreed on the chain and on every shared
wisp's desk position with `deskX = localX + 53` exactly (t1's cols), each
wisp visible in precisely the window whose span contains it; 480×520 d3
snapped to both the wide and the standard window; `spawnUnder` on the 960
parent returned null while the standard parent still docked. Shots:
`docs/design-reviews/2026-08-18-variable-widths/` (960+480 exactly filling
the 1440 display; 480 beside the standard 640). **Frozen bars carried:**
every golden byte-identical (kill: a golden moves → rework, never
re-baseline); uniform-chain shared sky byte-identical to shipped.
**Eyeball PASSED 2026-08-18, same day:** "both read as apertures, merged" —
different widths read as different-width apertures onto the same world. The
frozen kill (width reads as zoom / a different place) never fired, and no
masthead collision was flagged at 480, so the [480, 1200] clamp stands.
Out of scope, recorded: resizable windows, variable-width
undercrofts, multi-seam edges (IDEAS item 3). Next rung: the archipelago
full-screen mockup.

**Archipelago full-screen MOCKUP taken 2026-08-18, eyeball PASSED
2026-08-21 — rung 3 of the full-screen-desk ladder, a judgment on the
direction before any engine spend.** Harry's verdict, verbatim: *"yea 2.
looks good"* — one affirmative over both shots, K1 and K2 not separately
spoken to; neither frozen kill fired (no pile-of-windows read on K1, no
forgotten-window read on K2), and the pre-registered TWO MOONS drew no
complaint, so no desk-global-sky routing is forced. **The archipelago
engine rungs (desk-global sky, apartness dialect, mixed-size persistence,
multi-seam / L-shape) are UNBLOCKED, queued behind the dungeon arc per
the 2026-08-21 plan.** Bars frozen + committed before the app was launched
(`docs/design-reviews/2026-08-18-archipelago.md`); unlike the underground
probe this mockup is entirely LIVE-DESK engine output — the shipped
height/width clamps + undercroft dock arranged via the debug IPC, whole
display captured with `screencapture` so the desktop between windows is
in frame. Two arrangements
(`docs/design-reviews/2026-08-18-archipelago/`): **01-continent** — an
800×780 aperture (d1) joined to a standard 640×520 (d0) with its 640×260
undercroft docked beneath (right column 780, matching), a 1440×780 world
block exactly filling the display width, broker confirming
`joins [{t5,t1}]` + `vjoins [{t1,u1}]`, ground lines aligned across the
seam, strait of desktop below; **02-archipelago** — mainland (d0 +
undercroft) upper-left, a lone 480×520 outpost (d1) at (920, 280), tops
offset 250 px, ~240 px strait, `joins []`, the real desktop as the sea.
**Frozen bars:** K1 — shot 01 reads as one world through a wall of
apertures (kill: pile-of-app-windows → the full-screen direction fails,
ladder ends); K2 — the outpost reads as deliberately apart (kill:
forgotten/broken → the apartness dialect, layout-06's outpost treatment,
becomes its own rung first). **Pre-registered observation, confirmed in
frame: shot 02 shows TWO MOONS** — shared-sky chains are per-island by
construction; if that specific thing grates it routes to a desk-global
sky rung and K2 is judged on the apart-read alone. Test residue: the
desk's persisted slots now hold the mockup arrangement (debug sizes
session-only; restart respawns standard); the app is left running in the
shot-02 arrangement for a live look. A pass unblocks the archipelago
engine rungs (desk-global sky, apartness dialect, mixed-size persistence,
multi-seam / L-shape) each as its own specced slice.

**Dungeon rung 1 SHIPPED 2026-08-19 (eyeball queued) — Tier-0 delvers
under one wing; spec frozen before implementation**
(`docs/superpowers/specs/2026-08-19-dungeon-rung1-delvers.md`; the
dungeon-economy ladder, IDEAS.md § The dungeon economy). One wing —
`delverWingOf` picks the first sorted profile wing from the topology
broadcast, so every window agrees without talking — keeps a persistent
colony of 3-5 `▪` delvers in its undercroft. The pure engine is
`src/terminal/delve.ts` (no PIXI/IPC/wall-clock reads): expedition N of
a wing draws from `mulberry32(fnv1a("delve:{wing}:{N}"))`, so same seed
+ same dispatch sequence reproduces the same outcomes by construction
(bar 6); odds are a pure function of `ExpeditionParams {depth,
retreatThreshold, partySize}` — engine defaults at rung 1, rung 2's
directives will move them (bar 7, Addendum 1's consequentiality). One
creature hazard: it lairs at a drawn step; fight rounds roll
death/drive-off dice, the retreat threshold caps exposure. Dispatch
cadence is DESK-UPTIME wall-clock accrual (clamped 10 s/tick — the
AWAY_* lesson), one per [6h, 12h) → 2-4 per 24h of uptime (bar 2); a
being visibly walks to the shaft mouth on a new `dispatch` intent
(errand posture — pickIntent never scores it, resumeIntent decays it,
smoke-launch-targets enforces both), the ✦ send-off fires at the mouth,
and the undercroft window plays the party's descent (sink through the
cavern floor at the delve mouth), the hazard beat (dim `▒▚░`
disturbance pulse, melancholy register), and the survivors' return.
Deaths are permanent; replacements walk in over [2d, 4d) of WALL clock,
one on the road at a time. Every expedition leaves exactly ONE
marginalia line above ground at the shaft mouth in the dispatching
being's voice (EXPEDITION_VOCAB in marks.ts, rich/hollow/loss/lost, the
first dead delver named, ZERO numerals — smoke-enforced), through the
shipped recordMark/addMarkView surface (the stepThrough event posture).
Gold accrues to `hoardGold` in the persisted blob and renders NOWHERE
(bar 5). Persistence: additive `delve_state` table (schema v4→v5, the
land_wear pattern), one JSON colony blob keyed by the wing's SURFACE
cell id — the surface window owns every write, the undercroft window
polls the same blob by explicit cell id every 5 s (WAL-shared). Zero
LLM calls anywhere in the loop (bar 2; no new CLAUDE.md cost entry
needed). e2e surface: `debugDelve()` readback + `debugDelveDispatch()`
(uptime jump; the real walk runs) + `debugDelveResolve()`. Evidence:
new `smoke-delve` (130 — determinism, the two-sided bar-7 odds test
[timid vs reckless retreat shifts the death rate; the smoke FAILS if
params stop moving odds], no-numeral vocab, founding bounds, permanent
death + slow replacement, sqlite round-trip incl. cross-namespace
read); smoke-launch-targets grew the dispatch never-scored assertions;
smoke-glyph-coverage covers `▪▚`; full smoke sweep green, both
typecheck legs + desktop tsc green; fresh-context spec review graded
all 8 bars MET at code level, zero findings. **Frozen kill conditions
carried verbatim, all eyeball-gated:** reads as an idle game → re-cut
pacing/render, never add UI; invisible without peeking after a week →
re-cut the marginalia beat; a number appears → remove, never restyle;
params do not move odds → smoke-delve already fails. **Eyeball PASSED
2026-08-20** ("both eyeballs pass", judged together with rung 2's) —
none of the four kills fired; the rung is CLOSED.

**Dungeon rung 2 SHIPPED 2026-08-20 (eyeball queued) — persona
directives + the hoard glyph; spec frozen before implementation**
(`docs/superpowers/specs/2026-08-20-dungeon-rung2-directives-hoard.md`;
Addendum 1 is the only addendum routed in, per IDEAS.md's context
routing). Harry's two direction calls, made at planning: directives are
PERSONA-DERIVED and zero-LLM (reflection-driven directives are a later
rung), and the evidence surface is the hoard glyph alone (memorial +
changed sprite stay on the ladder). Leg A: the dispatch site now passes
`directiveParams(b.id, b.persona)` instead of the engine defaults —
`directiveBoldness` (pure, in `delve.ts`) folds the land persona's
rest/wander bias, walk speed and think-window into a [0,1] temperament
(DEFAULT_LAND_PERSONA lands at exactly 0.5, so strangers derive within
±1 of the rung-1 defaults — smoke-enforced), mapped over the
CALIBRATED ranges depth 4-8 / retreat 2-5 / party 4-3; the ±1 depth
flavour is a hash of the agent id, ZERO prng draws, so rung 1's
expedition streams provably cannot move. Calibration happened BEFORE
the spec froze (order on record in the spec): depth moves gold, not
death odds, and party 2 at the bold end breaks the spread cap — that is
why the bold floor is party 3. The Addendum-1 kill test is a smoke, on
IDENTICAL per-run seed streams so only the directive varies: ghost
1.27% / defaults-ignored 1.80% / loki 2.51% per-delver death — spread
1.24pp (bar > 1pp), ratio 1.98x (bar < 2.5x), strict ordering
timid < default < bold. Leg B: `hoardStage` (pure, monotone, thresholds
1/40/160/480/1200 — first glint within a day of uptime, never done
inside a month) drives `HOARD_GLYPH_ROWS`, a low static heap of
`▪ ░ ▒` at the camp side of the shaft (away from the delve mouth),
drawn by the undercroft presenter in the rung-1 convention
(direct BitmapText, decor.quiet ink), rebuilt ONLY on stage change and
DELIBERATELY never animated — a pulsing pile reads as a gauge. No
DelveState shape change, no migration, zero new AI calls. Evidence:
new `smoke-delve2` (41 — derivation purity/determinism/zero-draw,
range + default-≈-defaults shape, the two-sided kill test, bounded
spread, hoard monotonicity, numeral-free glyph rows); `smoke-delve`
byte-untouched and green (130); full 82-smoke sweep + all three
typecheck legs green; fresh-context spec review: all 7 code-checkable
bars MET, zero findings (incl. a brute-force over cols 40-400 showing
the hoard column never collides with the shaft). VERIFIED LIVE (macOS
desk, t1/t6/u1, windows visible not throttled): three forced
dispatch/resolve cycles drew three DIFFERENT organic dispatchers whose
banked gold fingerprints their directives exactly — loki party 3
banking 44/run (depth 8, one survived encounter), archivist party 4
banking 27 (depth 6), cat party 4 banking 14 (depth 4), ledger
44→88→115→129; the undercroft window rendered the stage-2 pile
(`hoardGlyphs 1`) on its next poll. debugDelve() grew `hoardStage` +
`hoardGlyphs`. Shots (context only):
`docs/design-reviews/2026-08-20-dungeon-rung2/`. **Frozen kill
conditions carried verbatim:** a number appears → remove, never
restyle; directives do not move odds → smoke-delve2 already fails; one
persona reads as cursed → re-tune derivation ranges, never the dice;
the hoard reads as a gauge or confetti → re-cut shape/thresholds, never
add UI, never animate. One honest flag for the eyeball: at stages 1-2
the pile is `▪`/`▪▪`, the delvers' own glyph — only its stillness
distinguishes it until stage 3's `░▒`; the dial is HOARD_GLYPH_ROWS.
**Eyeball PASSED 2026-08-20, same day** — Harry: "both eyeballs pass —
the hoard reads as treasure" (bar 8 in its own words; no kill fired,
the same-glyph flag drew no complaint, no dial spent). The rung is
CLOSED; rung 3 (monuments/spend, Addendum 2) and the Addendum-9
display rung's spec-interview are UNBLOCKED.

**Dungeon rung 3 SHIPPED 2026-08-20, eyeball PASSED 2026-08-21 — the
shrine, the spend, and watchable veneration; spec frozen before
implementation. The rung is CLOSED.** Harry's verdict, verbatim: *"yea i
think one is working"* — an affirmative over the rung as presented (the
veneration walk + the shrine); no kill was named on bars 9-10 (no
pathing-noise read, no idle-game or gauge read, no number sighted). The
hedge ("i think") is recorded as spoken; the pacing/shape dials stay
available if the ritual read weakens on a longer watch. **Rung 4
(cookbook + DM, Addenda 2/7/8) and the Addendum-9 display spec-interview
are UNBLOCKED — rung 4 is the lead arc per the same-day plan.**
(`docs/superpowers/specs/2026-08-20-dungeon-rung3-monuments.md`;
Addendum 2 is the only addendum routed in). Harry's four direction
calls, made at planning: the spend decision is PERSONA-DERIVED and
zero-LLM (reflection-driven spending is a later rung); the buff is a
WARD; the monument stands on the SURFACE in visible construction
stages; reinvestment buys a BIGGER COLONY. One flagged inference,
approved with the plan: timid personas fund the monument (civic,
patient), bold ones reinvest (direct, selfish). The spend: at each
resolution, once `hoardGold ≥ SPEND_RESERVE(40) + SPEND_TRANCHE(60)`,
one tranche leaves the hoard, routed by the DISPATCHER's
`directiveBoldness` — <0.5 grows `monumentFund`, ≥0.5 adds a
`capRaises` (a full cap ladder routes everything to the shrine); pure
in (state, boldness), ZERO prng draws, scheduling provably untouched
by who spent. The rendered hoard pile may now SHRINK by stages when a
tranche leaves — `hoardStage` the FUNCTION stays monotone (rung-2 bar
inherited verbatim); the supersession is on the spec's record. The
ward: `warded` on ExpeditionParams swaps `ROUND_DEATH_CHANCE` 0.1 →
`WARDED_ROUND_DEATH_CHANCE` 0.055 inside `runExpedition` — same draw
count, same order, so every unwarded run is BYTE-IDENTICAL to rung 2
by construction. Calibrated BEFORE tuning was frozen (the rung-2
order-of-operations, on the spec's record): on the bold-most probe
over identical streams, 0.055 → gap 1.11pp (bar > 1pp) at ratio 0.562
(god-mode floor ≥ 0.5×); the first guess 0.07 FAILED the gap bar and
was re-tuned at calibration, 0.05 crowds the floor. The colony:
`effectiveTargetPop = min(POPULATION_HARD_CAP=8, targetPop +
capRaises)` replaces both roster reads; recruits ride the unchanged
`tickArrival` road. The shrine: `shrineStage` (pure, monotone,
thresholds 60/180/360; the fund never decrements — the shrine only
grows) drives `SHRINE_GLYPH_ROWS`, a low 3-wide 3-stage structure
(`░▒░` → `▌▒▐` walls → `▐▪▌/▌▒▐/█░█`), deliberately unlike the
mastered-game monument (no crown, no box-drawing), drawn by the
SURFACE window in the hoard convention (direct BitmapText, quiet ink,
static), placed by a deterministic scan outward from the shaft over
flat structure-free ground (side by wing hash; recomputed on
recompose), one `SHRINE_VOCAB` marginalia line per completed stage in
the spending dispatcher's voice (re-derived from the fund on boot, so
a relaunch never re-announces). Veneration: a completed shrine makes
the dispatch walk TWO LEGS — `delveDispatch` gains
`phase: toShrine|toShaft` + `warded`; the being holds a 3 s bow at the
shrine, the walk cap re-stamps per leg, and `beginExpedition` receives
`warded: true` BECAUSE the walk happened — the buff's cause is a
scene (Addendum 2's kill condition satisfied by construction). No
DelveState schema bump (new optional fields default at parse; rung-2
blobs load clean), zero new AI call sites. Evidence: new
`smoke-delve3` (58 — the two-sided ward kill test on identical
streams, unwarded byte-identity, spend routing/determinism/purity,
fund + shrineStage monotonicity, hoardStage inherited verbatim,
cap bounds, back-compat parse, numeral-free + allowlisted glyph rows
and vocab); `smoke-delve` (130) and `smoke-delve2` (41)
byte-untouched and green; smoke-glyph-coverage grew the
SHRINE_GLYPH_ROWS import; full 84-script sweep + all three typecheck
legs green. VERIFIED LIVE (macOS desk, t1/t6/u1): 8 organic
dispatch/resolve cycles walked the ledger 1129→853 while the fund
climbed 60→360 (stage 1→2→3 rendered on the surface at the shaft's
ground line), then the next dispatch ran the two-leg walk — debug
phases `toShrine → toShaft+warded`, the expedition descended
`activeWarded: true` — and a COLD APP RELAUNCH recovered fund 420 /
stage 3 / shrineX from the blob alone. One field lesson: occluded
desk windows pause the whole tick (the rung-2 "visible not throttled"
note), which mimicked a dead dispatch until the app was foregrounded.
debugDelve grew `monumentFund/capRaises/effectiveTargetPop/shrineX/
shrineStage/shrineGlyphs/shrinePx/dispatch{phase,warded}/activeWarded`
plus e2e-only `debugDelveGrant(gold)`. Shots (context only):
`docs/design-reviews/2026-08-20-dungeon-rung3/`. **Frozen kill
conditions carried verbatim, eyeball-gated:** a number appears →
remove, never restyle; the ward statistically illegible →
smoke-delve3 already fails, monuments revert to expression-only; no
watchable veneration on the desk → monuments revert to
expression-only; gauge/confetti read → re-cut shape or thresholds,
never animate; idle-game read → re-cut pacing, never add UI. Eyeball
(bars 9-10, queued in TODO-USER.md): the veneration walk should read
as ritual, the shrine as wealth-from-below made architecture. Next on
the ladder: rung 4 (skill cookbook + the DM proposal loop; Addenda
2/7/8 route in), and the Addendum-9 display rung's own
spec-interview.

**Dungeon rung 4 spec FROZEN + go/no-go RUN, verdict GO — 2026-08-21;
engine work is UNBLOCKED, nothing implemented yet.** Spec
(`docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md`,
b4b04e4) froze eleven bars before implementation; Harry's four
interview calls on its record (proposals ride the dispatcher's
reflection after notable delves; the colony owns the cookbook,
loadouts temperament-picked; Addendum 8 schema-complete lightly used;
the DM is Sonnet at proposal time). Bar 5's pre-committed go/no-go ran
same day, protocol frozen and committed BEFORE the first call
(`2026-08-21-dungeon-rung4-go-no-go.md`, 9aa7e72 + b059d5c pre-run,
results 2b94484): draft grammar v0 (six verbs × four modifiers,
deterministic score, price floor/cap), five hand-authored delve
scenarios, proposals authored by Sonnet-as-reflection (the shipped
channel's shape — hand-authoring them would have tested the writer,
not the mechanism), then five DM adjudications on `claude-sonnet-4-6`.
Result: zero escapes, zero nulls, zero transport repairs; 5/5 DM
outputs in-schema with prices inside floor..cap; four distinct cells,
three of them unseeded; every ground line traces. The kill (novelty
only by escaping the grammar) did not fire — the run's best proposals
(saints-laden, broken-rope, lean-harvest) are legal compositions. A
labelled POST-HOC probe (not pre-registered) exercised the rejection
path the five grants had left untested: the same-cell S2 proposal
against a cookbook already holding S1's grant was refused
beyond-the-craft with a diegetic line — craft judgment, not a rubber
stamp. Residue carried into implementation, none blocking: the grammar
cannot say "break earlier" (consider a seventh retreat-side verb at
bar-1 time, widened in code); granted fiction can outrun the cell's
mechanics (DM prompt must state what each verb does not do; bar-10
eyeball owns overpromise); magnitude/pacing monoculture to watch; the
beyond-the-craft output shape (empty name, zero price) needs defining
in bar 4's contract. Next: implement bars 1-4 + 6-9 (grammar, smokes,
proposal channel, DM through the Worker, marginalia rail, ledger entry
in CLAUDE.md before ship).**

**Dungeon rung 4 SHIPPED 2026-08-21 (commits f635e45 → 565da74 + a
comment fix; spec review SOUND, zero findings, bars 1-4 + 6-9 all MET;
eyeball PENDING — bars 10-11, queued in TODO-USER.md).** The society
grows its own craft. Grammar v0 as the go/no-go drafted it PLUS the
residue-1 seventh verb `break` (retreat −1 round — the working the
five proposals could not say), widened deliberately in code:
7 mechanical verbs × 4 modifiers in `src/terminal/craft.ts`, every
verb a threshold/parameter swap on a draw `runExpedition` already
makes (the ward pattern), so the no-loadout path is byte-identical to
rung 3 by construction — smoke-asserted over 50 seeds plus the
zero-draw purity idiom, and delve smokes 1-3 (130/41/58) are
byte-untouched and green. Deterministic power score (cap 9), price
floor/cap (10×/25× score), death-floor guard (warded stack never
below 0.4× unwarded — shrine+ward3 measures ratio 0.413 on the
identical-stream probe: on the floor, never below). Calibration
(2026-08-21, 8000 identical streams, bold-most probe, BEFORE the
smoke froze it): draft deltas kept unchanged — the bold seed pick
(loud-iron+keen-eye) moves yield +18.8% gold (bar 2's "or yield" arm,
+18pp of base potential), the timid pick (ember-line+soft-step) moves
death odds 0.55pp at ratio 0.79 (legible, bounded). Seed cookbook 8
entries, two aspect-gated; aspects accrue from Tier-0 DEEDS only
(warded dispatch→faith, rich→harvest, deaths→death, survived
drive-off→war, grant→craft); payment is pure, zero-draw,
reserve-respecting, pacing-gated, before the tranche. The proposal
channel: a notable delve (lost / ≥2 dead / first-clear past a quiet
founding baseline / gold ≥40 — dials) sets `proposalPressure` on the
blob and pushes a `delve_return` perception through the existing
Tier-1 drain (importance 6); the craft clause rides the TOPOLOGY
STRING through the UNCHANGED routeTier2 (the T5 pattern) with a
seq-rotated exemplar (residue 3); extraction is content-whitelist off
any plan step (`craft: <name>: <verb> <strength> <modifier>`),
escapes recorded diegetically, never repaired. The DM: ONE new
runtime AI call (the third desk-side — CLAUDE.md ledger entry landed
BEFORE ship, c5bef76), Sonnet via `POST /api/agent/adjudicate`
reusing callTier2Reflect's pin, prompt in pure
`worker/lib/dm-prompt.ts` stating what each verb does NOT do
(residue 2); deterministic validation BEFORE, grant-scoped
re-validation AFTER (residue 4: beyond-the-craft answers with the
line alone); a hard desk-wide `DM_CALLS_PER_DAY = 5` cap claimed from
the main-process broker (`terminal:claimDmCall`, T5 posture;
window-local fallback); every failure path a consumed rejection, the
walker never blocks. Marginalia is the only surface: `CRAFT_VOCAB`
(5 voices × proposed/granted/refused/carried, numeral-free,
smoke-asserted) at the shaft mouth; `carried` fires only when an
INVENTED working goes below. One design amendment from the live run:
the pick reserves its first slot for the best-ranked granted working
— without it a grant outside the dispatcher's top two verb affinities
would NEVER be carried and bar 10's skill-in-use beat could never
land (pure, deterministic, still temperament-led). Persistence rides
the delve blob with defaulted fields (no schema bump; the live desk's
rung-3 blob loaded unchanged). Evidence: smoke-delve4 159; full
84-script sweep green by exit code; all three typecheck legs green.
VERIFIED LIVE end-to-end (macOS desk, t1/d0, worker on `anthropic`):
debugDelveNotable('loki','lost') → forced reflection through the
unchanged routeTier2 → Sonnet proposed hold-once-when-few (an
UNSEEDED cell) named low-oath → admitted (score 1, bounds 10..25) →
real DM GRANTED at price 14 with a diegetic numeral-free line → hoard
paid 807→793 (reserve held), craft deed accrued → marginalia trail in
loki's voice (proposed + granted rows on the record) → reload +
mode-flip recovered cookbook/hoard from the blob alone → the next
organic dispatch (cat, warded, party 4) fingerprinted
`activeLoadout: ["low-oath","ember-line"]` with the carried mark in
cat's voice; DM spend on logTier2 (844/78 tokens, ~$0.004).
debugDelve grew cookbook/aspects/proposalPressure/deepestCleared/
activeLoadout plus e2e-only debugDelveNotable/debugCraftProposal.
Residue for the eyeball: the being ADOPTED THE CLAUSE EXEMPLAR'S NAME
(low-oath) — composition original, name anchored (brain note
format-exemplars-donate-their-content; a placeholder-token exemplar
is the fix if it grates). Desk state at close: wallpaper mode
restored, cookbook holds low-oath (paid), worker stopped,
`worker/.dev.vars` restored to `LLM_PROVIDER=local` AS FOUND — NOTE
the desk's whole AI surface (Tier-1/2, DM) fails quietly on this Mac
under `local` with no Ollama; flip to `anthropic` for any live-magic
session. **Frozen kill conditions carried verbatim, eyeball-gated:**
skills statistically illegible → smoke-delve4 already fails, the
cookbook reverts to lore-only and the DM does not ship; reads as
patch notes → re-cut voice and cadence, never add UI; a number
appears → remove, never restyle; gauge/confetti read → re-cut shape
or thresholds, never animate. Next on the ladder: the Addendum-9
display rung's spec-interview; then the archipelago engine rungs
(queued behind the dungeon arc).

**Height-elastic sky PROBE taken 2026-08-21 (bars frozen + committed first,
`1c362e2`; eyeball queued).** Opened from Harry's question — "are the glyphs
too big to have detail?" — and from the three artifacts of 2026-08-20. Three
corrections landed before any probe existed:

1. **The Row Budget artifact measured the wrong scene.** It quoted the desk as
   "200×55 cells"; that is `V0_SCENE` (`src/render/levels/land.ts:28`), the
   prototype preview land. The shipped desk window is `DESK_SURFACE` =
   **53×20 = 1,060 cells**, measured live at `innerWidth 640 / innerHeight 520`.
2. **The artifact's frozen perf kill does NOT fire.** New probe scripts
   `scripts/e2e/frameprobe.mjs` (rAF deltas, 240 frames) and
   `scripts/e2e/cpuprobe.mjs` (`Performance.TaskDuration` over 8 s wall),
   measured on the live desk: standard 640×520 (1,060 cells) 16.67 ms / 4.5 %
   CPU; full-screen 1440×811 at scale 2 (3,720 cells) 16.67 ms / 4.7 %;
   full-screen at **scale 1** (240×62 = 14,880 cells) 16.67 ms / 3.8 %.
   Fourteen times the cells, vsync still locked, CPU flat — cell count is
   effectively free in this renderer; cost lives in the per-frame animation
   set, not in static cell geometry. **The kill stays dead only for STATIC
   cells** — a slice that animates per-cell re-arms it.
3. **The work area is 1440×811 logical** (2560×1600 physical, dpr 2), so a
   full-screen desk at today's glyph size is 3,720 cells — under a third of the
   artifact's "today's grid" demo panel (222×55 = 12,210). That density is
   reachable here only at scale 1. This is what makes the question legitimately
   re-askable rather than settled: on 08-17 scale 1 was judged in a **640×520
   window**, never full-screen.

The gap the probe tests: `DESK_SURFACE` is frozen at 20 rows and extra height
extends only *downward* (`composeLandExtension`), so a full-screen window today
composes **20 rows of world and 11 rows of bare aperture rock**. IDEAS.md
§ "Terminals of different sizes" item 2 promised "more sky above *and* more
underground below"; only the underground half ever shipped, and no doc records
the sky half as decided, deferred or killed.

Probe: `docs/design-reviews/2026-08-21-height-elastic-sky.{md,html}` +
`.../probe-page.png`, generated by `scripts/probe-height-elastic.mts` — wing
d0, phosphor, one seed, midnight, all three panels from the REAL composer and
the REAL render rules (`composeLand` / `composeLandExtension` /
`strataMaterialGlyph` / `landRoleFill` / `skyInkOf`), beings overlaid the way
`addBeing` draws them (cohort glyph in the def's palette accent at
`surface[col] - 1`) because K1 is judged on beings. Panels: **A** today
full-screen (120×31, 20 world rows + 11 rock); **B** height-elastic sky
(120×31, all 31 rows world at today's band proportions — skyH 17, band 6,
underH 7); **C** full-screen at scale 1 (240×62 = 14,880, skyH 34, band 12,
underH 15). B and C pass `skyH` straight to `composeLand` — a probe
convenience, NOT the shipping mechanism: the real slice must extend sky on a
per-global-row salted stream (the `composeLandExtension` precedent), because a
larger `skyH` in the main stream moves every golden.

**Bars frozen before generation** (`docs/design-reviews/2026-08-21-height-elastic-sky.md`
§3): **K1** glance value and **K2** letter-noise, both inherited VERBATIM from
`2026-08-17-cell-density.md` §3 including their mixed-registers routing; **K3**
(new) the stretched-sky failure — `starDensity`/`skyDitherDensity` are
`skyH`-relative, so a taller sky stretches the existing ramp rather than adding
structure, and if B reads as a bigger void the height-elastic rung dies and the
finding is that sky detail needs a new density vocabulary, not more rows;
**K4** busy-not-detailed, inherited from The Row Budget's own frozen kill.
A pass on B alone unblocks the height-elastic engine slice; a pass on C alone
re-opens the scale dial, ships nothing on this document, and inherits 08-17's
condition that a pass requires every salience bar re-measured at the new
denominator and sub-cell animation re-dialled. **The 08-17 KEEP-SCALE-2 verdict
is untouched and `WORLD_SCALE` was reverted to 2 after the measurement.**

**Detail thread JUDGED + PARKED 2026-08-21, same day** (commits `1c362e2`
`72f2cfe` `7a5e078` + this one). Two verdicts and a park.

**1 · Height-elastic sky probe — B preferred.** Harry: *"I like B."* Recorded
honestly: B was preferred over A (today full-screen: 20 world rows + 11 of bare
aperture rock) and C (full-screen at scale 1), and **K3 — the taller sky reads
as a bigger void — did NOT fire**. K1, K2 and K4 were not explicitly spoken to,
so this is a preference, not a signed-off sweep of the frozen bars; anyone
reopening this inherits §3 verbatim rather than treating the rung as cleared.
The height-elastic engine slice is **unblocked but NOT scheduled** — his
immediate follow-on was that the scene *inside* B needs to be better, which is
the finding that closed the rung out. `WORLD_SCALE` stays **2**; the 08-17
KEEP verdict and its mixed-registers routing are untouched.

**2 · The bigger-jump direction round — none taken, none killed.** Five
directions on the same real `composeLand` output (`scripts/directions-bigger-jump.mts`;
page `docs/design-reviews/2026-08-21-bigger-jump.html`; artifact
`5a119016-7b98-43d0-8c31-06f2e3ce6f6f`, favicon 🏙️ — republish the SAME path/URL
if it reopens): 01 depth planes, 02 a near plane, 03 authored set-pieces, 04 a
second grammar (procedural night city), 05 architecture generated. Harry: *"none
of those suggestions really jump out as is."* Per the round protocol **all five
stay OPEN**; silence never defaults to killed. Prior art scanned at conception
and recorded on the page: Stone Story RPG's scenes are drawn frame by frame, and
the repo reached the same verdict at the Terminal Terraria gate in June. The one
observation running AGAINST that framing: the best-looking panel was 04, the
fully procedural city, not 03, the drawn set-pieces — one observation on one
panel, untested.

**3 · The idea that outlived the round — double the grid, same scene.** Harry:
*"double the grid but just make the same thing more detailed."* NEVER TESTED:
both prior probes shrank everything, because the composer scales its content
COUNT with the grid (the 08-17 doc says so outright). His version holds feature
size constant on screen and spends the extra cells on the feature's own edge,
which also dodges the K1 glance failure that killed scale 1. Argument against:
no generator in `src/procedural/land.ts` is scale-aware — relief is a per-column
sine field, strata hash per cell at a fixed `STRATA_RUN_LEN 6`, sites are
fixed-size 3–5-row stamps, sky dither is a per-cell density; detail must come
from a finer rule or from drawn art. **NEEDS-CHECK, and it is the unpark
condition** (two-sided bars written before any render, in IDEAS.md § The detail
thread): make the composer scale-aware (amplitudes, run lengths, densities in
world units not cells), render the same wing at 2× with feature sizes held,
place it beside today's. Confirms → this, not the five directions, is the answer
to the thread. Kills → only the marks get finer while the shapes stay as crude
as they are, and the content problem is primitives, not resolution (routes back
to 03/05).

**4 · The unpark check RAN and was JUDGED the same day — KILLED.** Harry:
*"I actually prefer the today one."* The frozen kill fires on both halves, the
measurable and the taste. **Doubling the grid is dead as a route to detail and
the unpark condition is spent.** With scale 1 judged 2026-08-17 and doubling
judged now, **the resolution axis is exhausted** — no remaining move on this
thread is about the lattice; what is left is primitives (directions 03/05) and
the never-built fine-lattice mural rect. Detail of the check: (`scripts/probe-scale-aware.mts`,
`docs/design-reviews/2026-08-21-scale-aware.html`). Three panels at identical
PHYSICAL size (1440×806) — A today 120×31 @ 12×26, **B a CONTROL** (2×, no new
rules, so no gain can be credited to the lattice), C 2× scale-aware (horizon at
half-cell precision, strata re-grained at the same patch size, sky marks at
sub-cell positions with apparent density held). Result: **the kill clause is met
on its measurable half.** A→B is provably shape-identical — a block element
already encodes a sub-cell edge, so it expands EXACTLY (`▀` → two full cells,
`▙` → three) — and B→C moves texture only: same hills, same cottages, same crust
profile. The taste half (is the finer grain worth it anyway?) is Harry's eye.
**New finding, and the durable one: the scene is two kinds of matter.** Block
matter (terrain, silhouettes, buildings) tiles, holds screen size, takes a finer
edge; glyph matter (every being, label, star, the ☼) cannot be tiled into four
cells and lands at HALF its screen size. That is the named mechanism behind the
08-17 glance-value failure, and any future resolution move must answer it — from
the primitives, not the lattice. Written up as
`brain/learnings/a-glyph-grid-holds-two-kinds-of-matter.md`.

Full record, including the measured facts that survive regardless (the cell is
not the cap; the perf kill is dead at 14× the cells; braille ships in Cozette;
the work area is 1440×811): **IDEAS.md § The detail thread**. The oldest live
thread in this area is still the 08-17 verdict's own routed destination — a
fine-lattice mural rect inside the coarse world — which was never built, and the
desk still passes `mural: false`.

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
