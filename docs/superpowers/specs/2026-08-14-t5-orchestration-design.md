# T5 — orchestration v0: the desk may ask for one room

**Date:** 2026-08-14
**Arc:** snapping terminals, `docs/PRD-snapping-terminals.md` § T5 — "Opt-in
only: overnight, the society may PROPOSE one topology change — 'open a
terminal onto wing d2' — surfaced in the morning dispatch with one-tap
apply/dismiss. Applying opens the window (spawned adjacent, already joined).
Agents never move existing windows." Acceptance: *opted-in: wake to a
proposal, apply it, watch agents explore the new terminal; opted-out: nothing
ever appears.*
**Status:** bars frozen 2026-08-14 BEFORE any code. T4 closed 2026-08-10.
**Direction calls (Harry, 2026-08-14):** a proposal that times out
**evaporates** — no tray fallback, no persistent banner; apply/dismiss are
**banner taps only**, on the proposing window.

## What Depth-3 gating means here

The IDEAS.md sleep-mode trust ladder: Depth 3 is topology — the agent shapes
the arrangement itself — and it unlocks *only on explicit opt-in*. So the
gate is a config boolean that defaults off, a tray checkbox to flip it, and
an opted-out desk that is **byte-identical** to T4 everywhere: prompt, IPC
surface behaviour, banner. That byte-identity is a bar, not an intention.

## The moves

### M1 — Zero new AI calls: the proposal rides the sleep pass

No orchestrator call, no new dispatch, no ledger growth. When the desk is
opted in, the T4 topology line gains ONE clause **during the sleep pass
only**, naming the closed wings as legal one-proposal `move_to` targets. A
sleeping reflection whose plan contains a `move_to` step targeting a closed
wing becomes the proposal candidate; the step targets are read from
`b.mind.activePlan` (which `routeTier2` sets — the result payload is
unchanged). Everything else about the reflection — threshold, rate limit,
verbs, MAX_STEPS, JSON shape — is untouched.

An empty night is legal and correct (the empty-mailbox principle): if no plan
named a closed wing, nothing surfaces, and no machinery invents a proposal to
have something to show.

**The deliberate whitelist widening, stated plainly:** T4's bar 5 said "only
open wings are ever named as targets." T5 widens that FOR OPTED-IN DESKS,
DURING THE SLEEP PASS ONLY — closed wings become nameable as proposal
targets. The opted-out prompt inherits T4's bar verbatim. A closed-wing
target is movement-inert by construction: `planStepToAction` maps a
target-only `move_to` to one idle beat, so the widened vocabulary cannot walk
an agent into a wall.

### M2 — Main is the authority: one proposal per desk per night

Renderers report candidates over new IPC (`terminal:proposeTopology`); the
main process validates — opt-in on, wing genuinely closed, no proposal
already accepted this sleep session — and the first valid candidate wins
(the `terminal:agentSpawn` first-writer-wins pattern). Session state lives in
`startTerminalsMode`, cleared on every transition INTO sleeping, on apply,
and on dismiss. **Never persisted**: a missed proposal evaporates; a restart
forgets it; nothing nags.

### M3 — The morning banner grows the desk's first tap targets

The winning window — and only that window — appends a proposal row to its
morning dispatch: the proposal line plus `[ open it ]  [ let it pass ]`.
The banner container stays `eventMode:'none'`; hit-testing rides the
launcher-beat pattern instead (the existing `onPointerDown` handler tests the
tap spans before the launch hotspots, geometry from one pure function). The
banner's existing 30 s auto-dismiss doubles as implicit dismissal. A tap on
either bracket, or the timeout, clears main's session state.

### M4 — Apply spawns adjacent and joined; nothing else ever moves

Apply re-validates in main (the wing may have been opened by hand overnight),
then computes a spawn position at **exact abutment with the proposing
window** — same y, x flush against the anchor's free side (right preferred,
walking the join chain; left as fallback), rejected if it would overlap a
window or leave the display. The new terminal spawns through the EXISTING
`spawnTerminal` and joins mechanically on the next `broadcastTopology()`
(`computeJoins` at `JOIN_EPS_PX 2` sees exact abutment). No legal placement →
the apply is a quiet no-op and the wing stays closed. **No `setBounds` on any
pre-existing window, anywhere on this path.** Reversibility is structural:
the applied window is an ordinary terminal the user closes like any other.

### Cost model (CLAUDE.md requires this before shipping)

| | |
|---|---|
| **Trigger** | none of its own — candidates are extracted from the T4 sleep pass's existing reflections |
| **Cost** | **ZERO new runtime AI calls.** The topology line grows one clause on opted-in sleeping dispatches; token delta per reflection is a few dozen tokens |
| **Caching** | n/a |
| **Fallback** | no candidate / rejected candidate / failed IPC → no proposal, desk unchanged; failed apply → quiet no-op, wing stays closed |
| **Telemetry** | existing logTier2 rows (unchanged) |

## What this slice does NOT do

- No dedicated orchestrator call, no new model dispatch of any kind.
- No moving or resizing of existing windows — ever, opted-in or not.
- No proposal persistence: not in config, not across restarts.
- No tray surfacing of a pending proposal (Harry's call: banner only).
- No plan EXECUTION on the land (unchanged from T4); no closing of windows,
  no multi-window proposals, no proposal kinds other than "open wing W".
- No palace changes: `renderDispatch` and the proposal-less mount are
  byte-identical.

## Bars, frozen before code

Two-sided. Measured via smokes + `__terminal` debug hooks over CDP on a real
desk (window FRONTMOST — an occluded window passes vacuously), except bar 8
which is Harry's look.

1. **Opt-in is real and default-off.** Fresh or absent config: the reflect
   prompt is byte-identical to T4's, `terminal:proposeTopology` rejects, and
   no banner ever contains a proposal row. **KILL:** any prompt diff while
   opted out, a proposal surfacing on an opted-out desk, or the field
   defaulting on.
2. **The proposal rides; it never spends.** Zero new model calls; the
   candidate comes from the sleep pass's existing `activePlan`; an empty
   night surfaces nothing. **KILL:** a dedicated orchestrator call, or an
   invented proposal when no plan named a closed wing.
3. **One per desk per night, main decides.** First validated candidate wins;
   later reporters get `already_proposed`; the session clears on the next
   sleep transition, on apply, and on dismiss, and is never persisted.
   **KILL:** two proposals in one session, a proposal surviving a restart, or
   a renderer surfacing a candidate main rejected.
4. **Apply spawns adjacent and joined; nothing else moves.** The new window
   appears at exact abutment on the anchor's free side, same y;
   `computeJoins` reports the join on the next broadcast; no existing
   window's bounds change; no legal placement → quiet no-op, wing stays
   closed. **KILL:** any `setBounds` on a pre-existing window, or an applied
   window that lands unjoined.
5. **The whitelist widens exactly one clause, downstream unbroken.**
   Threshold, rate limit, verb whitelist, MAX_STEPS and `reachableWings` are
   untouched; a closed-wing target in a plan step never produces movement.
   **KILL:** a diff in router or worker gates, or an agent pathing toward a
   closed wing.
6. **One affordance, reversible, evanescent.** Apply/dismiss exist only in
   the proposing window's morning banner; the 30 s timeout dismisses; either
   path clears main's session; the applied window is an ordinary closable
   terminal. **KILL:** an affordance on a second window, a proposal that
   re-shows after dismissal, or an apply the user cannot undo by closing the
   window.
7. **Palace untouched.** `renderDispatch` output, `mountMorningDispatch`
   without a proposal, and every palace smoke are byte-identical. **KILL:**
   any diff in `smoke-5b-sleep` expectations.
8. **Taste (Harry's, on the running desk).** Waking to a proposal reads as
   the desk asking a small, shy question — one line, two quiet bracket taps,
   gone in 30 seconds — not a notification demanding a decision; applying
   feels like the desk growing a room. **KILL:** it reads as a dialog box, or
   the new window's arrival reads as a popup rather than an opening.

## The strongest argument against, stated before building

The slice buys little an opted-in user couldn't do with the tray's "New
terminal" item — and pays for it with the desk's first interactive banner,
four new IPC channels, and a per-session state machine in main. Worse, the
proposal's *content* is weak: the model is not reasoning about desk growth,
it is pattern-completing a clause we appended, so "the society proposed d2"
is close to "the prompt suggested d2 and the model echoed it." If proposals
feel arbitrary, the feature trains users to dismiss them, and the Depth-3
trust ladder is spent on a rung nobody stands on.

The bet the slice makes: v0's job is the *machinery* — surfaced, gated,
reversible, one-per-night — proven safe on the cheapest possible content, so
that when a future slice gives the society real reasons to want a room
(memory pressure, crowding, a lore thread), the trust plumbing already exists
and has never once moved a user's window.
