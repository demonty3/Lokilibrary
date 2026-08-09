# T4 — topology → reflection: the desk gets a mind of its own shape

**Date:** 2026-08-09
**Arc:** snapping terminals, `docs/PRD-snapping-terminals.md` § T4 — "Tier-2
reflection context gains a topology summary (which terminals exist, which are
joined, who's where); plans can target other terminals using existing
whitelisted actions. Morning dispatch narrates overnight movement across the
desk." Acceptance: *a reflection fired after a new join references it in a plan;
no new runtime AI calls (rides existing reflection dispatch).*
**Status:** bars frozen 2026-08-09 BEFORE any code. T3 closed 2026-08-09.

## The precondition the PRD did not know it had

**The desk has never dispatched Tier-2 at all.** `routeTier2` is called from
exactly three places — `render/agents/cohort.ts`, `render/levels/cell.ts` and
`agents/sleep-reflection.ts` — every one of them on the *palace* cell surface.
`src/terminal/` does not reference it, and `activePlan` appears nowhere in the
terminal path. STATE.md records this honestly at the T2 society migration:
"DEFERRED: Tier-2 / topology reflection (T4 arc)."

So "rides existing reflection dispatch" is true of the *router* and false of the
*desk*. T4 owns standing the pump up. That is a scope fact worth stating plainly
rather than discovering halfway.

**The half that is already built and waiting.** `routeTier1` fires on seam
arrival and accrues `reflectionCounter += importanceFor(ev.kind)` for every
drained perception; `terminal_arrival` is not in the switch, so it scores the
default **3**. `carriedFromMind` / `reconstructMind` carry `reflectionCounter`
across a seam handoff, so it accumulates over a being's whole journey across
the desk rather than resetting per window. Counters climb today and nothing
consumes them.

**That sets the natural cost.** `REFLECTION_THRESHOLD = 150` at 3 per arrival is
**50 seam crossings** before one organic dispatch. On an active desk that is
hours per agent — comfortably under the router's unchanged 1-per-agent-per-hour
rate limit, which therefore never binds in practice. The sleep pass, not the
threshold, is what will actually produce reflections.

## The moves

### M1 — A topology summary, built where the facts are

New pure `src/terminal/deskTopology.ts`. A window already receives
`{joins, wings, allWings}` on `terminal:topology`, so it can name every open
wing, its own, its joined neighbours and their side, and the wings with no
window. What it does **not** have is the live roster (`agentId → terminalId`);
the broker owns that.

**The roster is PULLED at dispatch time, not pushed.** Adding it to
`terminal:topology` would be wrong: that broadcast is change-gated on
`{joins, wings}` precisely to stay bounded, and the roster changes on every
crossing — folding it in would turn a rare broadcast into a per-crossing one.
A new `terminal:getRoster` invoke, called only when a reflection is about to
fire (≤ 1 per agent per hour), costs nothing and leaves the hot path alone.

The summary renders as one line appended to the reflect prompt's user block,
beside the existing `the library:` line.

### M2 — The line reaches the model, and widens exactly one vocabulary

`ReflectInput` gains `topology?: string`; `RouteOptions` passes it through;
`buildReflectPrompt` emits it next to `library`. A caller that supplies no
topology produces a **byte-identical** prompt to today's — that is a bar.

The one deliberate widening: **a wing id becomes a legal `move_to` target.** No
new verb, no change to the plan grammar
(`move_to / inspect / place_mark / linger / withdraw`), no change to the JSON
shape. Per CLAUDE.md, whitelists are widened deliberately and not by telling the
model to be more creative — so the summary names *only wings that actually have
a window open*, and the smoke asserts that.

### M3 — The pump

`terminalLand.ts` gets a slow, throttle-gated reflection pump: every
`REFLECT_POLL_S`, for each present, non-away being whose `reflectionCounter`
has crossed the threshold, fire `routeTier2` fire-and-forget with the topology
line attached. Threshold and rate limit are the router's and are **not**
touched. Riding `elapsedS` means it freezes with everything else under the 1 Hz
wallpaper throttle and stops dead when paused.

### M4 — The morning dispatch, per window

On entering `sleeping`, each window fires one pass over its own present beings
with `reflectionMinIntervalMs: 0` — the palace's 5B semantics, which is what the
per-hour limit was holding capacity for. Texts buffer locally. On the
`sleeping → full` wake the window mounts the existing
`render/overlays/morning-dispatch.ts` banner with its own theme and drains the
buffer.

**Per window, not desk-wide-elected.** Each window narrates its own residents:
no cross-window coordination, no leader election, and the banner is about the
land you are looking at. What makes it narrate *the desk* rather than one wing
is the topology line in the context — the reflections reference crossings and
neighbours because the prompt told them the desk's shape.

### Cost model (CLAUDE.md requires this before shipping)

| | |
|---|---|
| **Trigger** | `reflectionCounter ≥ 150` (≈ 50 seam arrivals, carried across seams), polled slowly; plus one forced pass per being per sleep session |
| **Cost** | Sonnet. Bounded by the router's UNCHANGED per-agent 1/real-hour limit → ≤ 5 calls/hour on a fully-populated active desk; realistically far less (the threshold, not the limit, is what binds). Zero on an idle desk, zero key-free |
| **Caching** | None. Each reflection is a fresh synthesis over that agent's recent memories — identical to the palace's Tier-2 |
| **Fallback** | Transport failure → `skipReason: 'rejected'`; the counter is already consumed, nothing retries in a loop, the walker never blocks. The desk keeps running on the pure land intent engine |
| **Telemetry** | Existing `logTier2` rows (model, provider, tokens, latency, cost estimate) |

## What this slice does NOT do

- **No plan EXECUTION on the land.** The land's intent engine
  (`beingIntents.ts`) does not read `activePlan`, and T4's acceptance is that a
  reflection *references* a join in a plan — authoring, not execution. A being
  walking its plan across the desk is a later slice and would be a real new
  subsystem.
- No new verb, no change to the plan JSON shape, no change to the threshold or
  rate limit.
- No change to the palace's Tier-2 path.

## Bars, frozen before code

Two-sided. Measured via `__terminal` debug hooks over CDP on a real two-window
desk, plus headless smokes, except bar 8 which is Harry's look.

**The summary**

1. **It names the real desk.** On a joined two-window desk the line names this
   wing as here, the neighbour on the correct side, marks them joined, and lists
   exactly the wings with no window open. **KILL:** it names a wing with no
   window, omits an open one, or puts a neighbour on the wrong side.
2. **"Who's where" is the live roster, not homes.** After a forced crossing the
   summary places the crosser in the DESTINATION wing. **KILL:** it reports the
   being's home wing, or a position the broker disagrees with.
3. **A topology-less caller is unchanged.** `buildReflectPrompt` with no
   topology returns a byte-identical prompt to today's. **KILL:** any diff.

**The dispatch**

4. **The gates are the router's, untouched.** Below threshold → no dispatch; at
   threshold → dispatch; again inside the rate-limit window → `rate_limited`.
   **KILL:** the pump dispatches below threshold, or bypasses the rate limit
   anywhere except the sleep pass.
5. **The plan can name a neighbour with an existing verb.** The verb whitelist
   is unchanged and only open wings are ever named as targets. **KILL:** a new
   verb reaches the prompt, or a closed wing is offered as a target.
6. **The walker never blocks.** Fire-and-forget: a transport failure leaves the
   being walking and the desk rendering. **KILL:** an await on the render path,
   or a rejection that reaches the ticker.

**The morning dispatch**

7. **Narrated once, on a real wake.** Entering `sleeping` fires one pass per
   present being with the limit bypassed; `sleeping → full` mounts the banner
   and DRAINS the buffer, so a second wake with nothing new shows nothing, and
   an initial transition shows nothing. **KILL:** stale text re-shown, or a
   banner on the initial transition.

**Taste (Harry's, on the running desk)**

8. The dispatch reads as **the desk's** night rather than one window's — the
   reflections reference crossings, neighbours and the shape of the desk, not
   generic room musings.

## The strongest argument against, stated before building

**This puts recurring Sonnet spend on the default desk boot, and the thing it
buys is invisible most of the time.** Until now the desk's only runtime AI call
was Tier-1 on arrival — a few Haiku calls an hour, cheap. Tier-2 is the
expensive tier, and its output lands in a banner the user sees once a day and in
plan rows nothing on the land executes yet (see "does NOT do"). A sceptic would
say T4 buys one banner for the project's most expensive call.

The answer, and its limit: the threshold makes it genuinely rare (50 crossings),
the rate limit caps the worst case at 5/hour, BYO-key means the user pays for
their own desk, and CLAUDE.md's direction is explicit that spending above the
old ≤$1/user/month bar on the magic surface is now a legitimate dial. But the
argument stands against the *plan* half specifically: plans that nothing
executes are speculative until the execution slice lands. If Harry wants that
trimmed, M1-M2 (the summary in the context) and M4 (the dispatch) stand on their
own and the plan-targeting clause can be dropped from the prompt in one line.
