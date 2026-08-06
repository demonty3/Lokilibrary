# The launcher beat — click a site, a being runs the errand, the game starts

**Date:** 2026-08-06
**Programme item:** T2 remainder (PLAN.md) — "the launcher beat", deferred
from the T2 society migration (2026-07-17) and explicitly held out of land
polish #19 slice 2 ("Door behaviour / launcher beat (walk-in-to-launch) —
separate slice"). The `door` role exists as its landing spot.

**Direction ruling, Harry, 2026-08-06** (three calls taken before any code):

1. **Gesture** — click any *site* on the land. A wing carries five games as
   sites (surface structures + buried relics) with proximity-revealed
   labels; the whole land becomes the launcher, not one button.
2. **Timing** — **errand**, not button. The click lights the door and the
   nearest being turns and walks to it; Steam fires when the being *arrives*
   (capped, see below). The walk is the mechanism, not decoration.
3. **While playing** — the being is **gone**. They step through the door and
   are absent from the land until you come back to the desk, then re-emerge
   at the door.

This is the product's "doubles as a launcher" pillar, and the first user
*input* the terminals desk has ever had: today the desk has no player, no
keyboard handler, and no pointer handler. The slice invents the gesture as
well as the beat.

## Architectural decision

**Renderer-side only. `src/procedural/` gains one additive metadata field
and nothing else.**

The land model already stamps everything this needs — sites, the monument
door, the surface row. Launching is behaviour, so it lives where behaviour
lives (`src/terminal/`), on the same `tick` channel as the walker. The one
compose-side change is that `LandSite` must carry the *identity* of its
game (`appid`, untruncated `name`); today it carries a ≤7-char display
string, which cannot address Steam. That field is pure exported metadata —
no cell is written, no PRNG draw is taken, no glyph changes — so the frozen
compose goldens must stay **byte-identical**, and that is a smoke assertion,
not a claim.

Rejected: (a) a keyboard beat with a player caret on the desk (the palace's
E-key shape) — the desk deliberately has no player, and adding one to reach
a launcher is a much larger design change than the beat needs; (b) a new
`BeingIntent` produced by `pickIntent` — the errand is user-driven by
construction, and putting it in the scoring ladder would let the world
launch games on its own, which it must never do.

## Leg 1 — Hit-testing (new: pointer input on the desk)

`src/terminal/launchTargets.ts` — pure, PIXI-free, smokeable (the
`siteLabels.ts` / `wear.ts` posture).

- `launchTargets(model)` → one hotspot per site **that has an appid**
  (`celeste` in the sample library has none: not launchable, no affordance,
  no dead click).
- `hitLaunchTarget(targets, cellX, cellY)` → the target whose column is
  within `LAUNCH_HIT_COLS` (3) and whose row band `[y-4, y+1]` contains the
  click; nearest column wins ties. Generous on purpose — a 1-cell glyph is
  not a mouse target, and the label plus its structure/relic read as one
  object.
- `terminalLand.ts` mounts a `pointerdown` + `pointermove` handler on the
  canvas, converting screen → world → cell through the existing `world`
  transform + `WORLD_SCALE` (never a second copy of the layout maths).

**Affordance:** hovering a launchable site pins its proximity label to full
alpha (the existing fade, driven to 1) and sets the canvas cursor to
`pointer`. That is the whole discoverability story — no new chrome, no
tooltip, no HUD. The 20px drag strip is untouched, so window dragging still
works.

## Leg 2 — The errand

New intent kind `{ kind: 'errand'; targetX }` in `beingIntents.ts`, in the
union but **never produced by `pickIntent`** (smoke-enforced over N draws)
and never produced by `resumeIntent`. It walks exactly like `approach` and
outranks nothing, because nothing scores it.

On a hit:

1. The door lights immediately (`door` role cells ramp to full alpha and
   hold) — the click is acknowledged in the world within a frame, whatever
   happens next.
2. The **runner** is chosen: the present, non-pending, non-exiting being
   nearest the door column. Their current intent is replaced by the errand;
   any queued re-pick is suspended until it resolves.
3. **Target column** = the monument door if this land has one, else the
   clicked site's own column. Not every wing's slice contains a `mastered`
   game, so not every land has a monument; a land without a door sends the
   runner into the game's own structure. Stated as a rule, not left to
   chance.
4. **Steam fires on arrival**, or at `ERRAND_CAP_S` (2.5 s) — whichever is
   first. If the being is still walking at the cap, they fade out where they
   stand and the launch fires anyway. A launcher that makes you wait is a
   broken launcher; Steam's own cold start is 5-20 s, so ≤2.5 s of world
   response reads as anticipation rather than lag.
5. **No being present** (empty land, or everyone absent/pending): the launch
   fires immediately on click, door-light only. The beat degrades to a
   button rather than failing.
6. Re-entrancy: a second click while an errand is live is ignored for the
   *same* site and re-targets for a different one only after the live errand
   resolves. One runner at a time per window.

Transport is the existing `src/agents/launch.ts` (`launchGame`) — the same
call the palace's bookshelf E-key makes. No new Steam surface.

## Leg 3 — Away, and coming back

On arrival the runner steps through: fade to alpha 0 over `THROUGH_S`
(0.35 s) at the door column, then `away = true`.

While away they are excluded from everything a present being drives —
drawn, label proximity, footfall wear, near-edge reports, crossings — by the
same predicate that already gates `mind.present`.

**The return signal.** There is no game-exit signal available on macOS
today: the fullscreen/foreground probe in `desktop/src/wallpaper/throttle.ts`
is Win32-only, and throttle IPC is broadcast to the palace's `mainWindow`
only, never to terminal windows. Building one is a desktop-capability slice,
not this slice. So the beat uses **attention** instead of process state: the
runner re-emerges at the door on the first focus or pointer event in the
window after an `AWAY_FLOOR_S` (20 s) floor, and unconditionally at an
`AWAY_CEIL_S` (30 min) ceiling so nobody is lost forever on a desk you never
touch again. Absence is session-scoped: a relaunch spawns everyone normally.

This is honestly "back when you return to the desk", not "back when the game
exits". Recorded as such; the real signal is an out-of-scope follow-up.

## Leg 4 — What it leaves behind

Parity with the palace's `handleLaunch`, adapted to the land:

- A **mark** at the door column, in the existing marginalia system
  (`recordMark` + `addMarkView`), with launch-specific vocab ("gone into
  <name>"), bypassing `maybeMark`'s odds and cooldown — a launch is not
  ambient punctuation, it always leaves a trace. Dedupe by column still
  applies (a mark already at the door is replaced, not stacked).
- A **`game_launched` perception row** for the runner through
  `terminalMemory.ts` (new `recordLaunch`, importance 6 — palace parity),
  carrying the appid + name.
- A **return row** on re-emergence (importance 3, the arrival class).
- **No new AI calls.** The perception queue is drained by the existing
  arrival-driven Tier-1 pump on the walker's own cadence; nothing new
  dispatches, so CLAUDE.md's runtime-AI ledger is unchanged. Stated
  explicitly because the palace's version force-fires Tier-2 — this one
  deliberately does not.

## Verification plan

- **Smokes**: `smoke-launch-targets` (hotspot geometry, appid-less sites
  excluded, hit bands, tie-break); `smoke-land-site-identity` (a golden
  assertion that `appid`/`name` ride `model.sites` **and** that the compose
  goldens are byte-identical to the pre-slice hashes); an addition to the
  being-intents smoke (`pickIntent` never returns `errand` over 10k draws;
  `resumeIntent` never decays to it).
- **Mutant check** on the errand smoke before trusting it (the
  brain's `regression-test-must-fail-on-prefix-code` discipline).
- **e2e / debug hooks**: `__terminal.debugLaunch()` exposing
  `{ targets, errand: {agentId, targetX, firedAt} | null, away: string[] }`
  so the harness can drive a click and read the beat without watching it.
- **Live verification** (launch-desktop-app skill), window frontmost — a
  backgrounded window's ticker never runs the errand and would pass
  vacuously (`a-passing-check-on-a-throttled-window-proves-nothing`):
  solo window click-to-launch, the no-door wing, the no-being case, and a
  joined two-window desk (the runner must not cross a seam mid-errand).
- Steam is not installed on this Mac; `launchGame` returns `ok:false` on
  the electron path. The beat is verified on the *world* side, and the
  launch call is verified by its log line + the memory row, not by a game
  starting. Stated up front so a missing game window is not read as failure.

## Eyeball bars (frozen now, before implementation)

Shots + a live watch, `docs/design-reviews/2026-08-06-launcher-beat/`:

1. **Discoverability**: moving the mouse over the land makes it obvious
   something is clickable — the label pin plus cursor reads as "this is a
   thing". KILL: you have to be told where to click → add a persistent
   affordance to launchable sites (one dial), then reconsider the gesture.
2. **The beat**: click → the door lights and a being visibly turns and goes.
   It reads as *sending someone*, not as a progress spinner. KILL: it reads
   as lag between click and game → drop to immediate-launch (Harry's
   rejected option B) and keep the walk as an echo.
3. **Arrival**: the being stepping through the door reads as entering, not
   as dying or glitching out. KILL: reads as a bug → replace the fade with
   a different exit (one dial), then pull the through-door and leave them
   standing at the door.
4. **Absence**: the land with a resident away reads as *someone is out*,
   not as broken/empty. KILL: the desk feels dead while you play → cut
   absence, keep the mark only (Harry's rejected option B for that call).
5. **Return**: coming back to the desk and finding them at the door with a
   note reads as a payoff. KILL: the re-emergence is unnoticeable → hold the
   mark's reveal open on return (one dial), then drop the return beat.
6. **Nothing regressed**: seam/knit/murals/marks/drift on a joined
   two-window desk are unchanged, and a click never disturbs window drag.

Per bar: at most the single named iteration dial, then the kill fires. No
bar may be softened after shots exist.

## Out of scope (recorded, not scheduled)

- A real game-exit signal (macOS foreground/process probe) — desktop
  capability slice; the return beat swaps to it for free when it exists.
- Launching from the palace side or from the mural — the mural stays the
  recognition surface, the sites are the launcher.
- Tier-2 reflection on launch (the palace force-fires; this deliberately
  does not) — belongs with the T4 topology→reflection arc.
- Multiple simultaneous errands, or a runner crossing a seam to reach a
  door in another window.
- Persisting absence across a relaunch.
