---
up: "[[Lokilibrary]]"
---

# Unpark review — 2026-08-06

**What this document is.** A one-off audit of every parked item against its own
stated release condition. It asks one question per park: *has the precondition
fired?* It never asks whether the park was right — bars are inherited verbatim,
per the no-softening rule. Rulings from Harry go in the RULING lines; nothing
here is applied to `PLAN.md` until he rules.

**Why it exists.** Across the whole corpus and 360 commits: `PARKED` appears 51
times, `KILLED` 23 times, and `unpark` twice — both of which are *definitions*
of a release condition, not release events. Zero parks have ever fired. The
global rule requires a PARK to name what unblocks it; the project obeys for its
formal verdicts and not for the informal majority, so most parks are structurally
incapable of firing.

---

## Part 1 — preconditions that have already fired

### 1.1 6A local-AI landmark — **MET**

`TODO-USER.md:263`: *"PARKED: needs a local Ollama, which this Mac can't host …
revisit only if a local-inference box re-enters the picture."*

`TODO-USER.md:159`, same file: *"the agent-mind taste gate RAN (local models on
harryspc; voices landed per Harry, 2026-07)."*

The box re-entered the picture in 2026-07 and it is recorded in the same
document as the park. Depth 1 code is shipped and smoke-locked; it has never
been seen running. `nomic-embed-text` and real lore retrieval are parked behind
the identical, expired condition (`TODO-USER.md:269`).

**Blocked on:** harryspc has been offline six days (`tailscale status`, 2026-08-06:
*"offline, last seen 6d ago"*). The harness audit went RED this morning for
exactly this. Powering the box on is the whole of step one.

RULING:

### 1.2 Electron vs Tauri — **JUSTIFICATION EXPIRED**

`CLAUDE.md` rejects Tauri on the grounds that *"steamworks.js requires a Node
host runtime"*. Steam distribution was retired 2026-07-11. `PLAN.md:141` already
records that the rationale is weakened, filed under "open on paper, untracked".

Per the no-softening rule this cannot be resolved by editing the old rationale.
It needs a new document inheriting the old bars verbatim.

RULING:

### 1.3 Diorama-neighbour re-mock — **PLAUSIBLY MET**

`STATE.md:134`: *"any re-mock waits for the improved desk, inheriting the frozen
bar."* Since that was written, murals #16 shipped (eyeball passed), #19 slices 1
and 2 shipped, and the crust-legibility finding that drove the MUTATE was
addressed on the depth track. The desk has improved.

The *engine* preconditions are unchanged — one of the two (a Phase 3 sprite
surviving curation) is still genuinely unmet, and traces to a single missing
API key:

> `PIXELLAB_API_KEY` → `scripts/bake-sprites.mts` → curate survivor → Phase 3
> aesthetic gate → diorama precondition (b) → engine work unparks

RULING:

---

## Part 2 — parks with no release condition at all

Each of these is parked with an *intention* rather than a condition, so none can
ever fire. Proposed conditions below are observable and, where possible, hang off
an event `PLAN.md` already tracks. **A park that cannot fire is a kill pretending
to be reversible** — so for each, the choice is a real condition or a tombstone.

### 2.1 T3 — terminal identity + chrome

Current: *"OPEN (parked, not rejected; glyph-chrome craft resurfaces here)."*

Proposed condition: **a layout-round KEEP lands on a T3-concretising direction
(10 or its successor), OR a desk shot shows two joined terminals a stranger
cannot tell apart.** The first leg is already half-wired — the 2026-07-30 layout
review states that a keep on 10 is "effectively a vote to schedule T3".

RULING:

### 2.2 Layout directions 02, 03, 04, 06, 10

Current: *"parked for a future round"* — unowned, undated.

Proposed condition: **the depth track closes (all four items shipped and
eyeballed), at which point round 3 runs over the five unjudged directions.**
This fires off an event PLAN.md already tracks, so it needs no separate owner.

RULING:

### 2.3 Palace-facing #12 shade-ramp, #14 phosphor, #17 composition

Current: parked under terminals-first, which is a standing direction with no
reversal condition. That makes these unfireable by construction.

Proposed: **KILL, with tombstones.** Terminals-first is not scheduled to end. If
they should stay alive, the condition has to be something observable — e.g. the
desk reaching its depth bar *and* palace polish becoming the highest-value
remaining work — but the honest reading is that a park under a permanent
direction is a kill.

RULING:

### 2.4 `scripts/*.mts` not covered by `npm run typecheck`

Current: *"worth its own slice someday."*

Proposed condition: **defect-triggered — the next time a bug reaches a slice
that a typecheck over `scripts/` would have caught, or the next slice that
touches `scripts/` substantively, whichever is first.** Self-selects for value
rather than sitting on the queue.

RULING:

### 2.5 `docs/pivot/DESIGN.md` Q1 — pixel-art pipeline

Current: *"open on paper, untracked."*

Proposed: **not actually conditionless — fold into the Phase 3 aesthetic gate
chain in §1.3 and delete the separate entry.** It resolves when the gate is
judged.

RULING:

---

## Part 3 — the unobservable condition

### 3.1 Style-pack / ceiling-widening track

Condition as frozen: *"a real pack author needs a slot that does not exist, or
the depth track reaches its bar."*

Leg 2 is fine and correctly unmet — depth item 4 (static-beings liveliness) is
unstarted and #19 slice 2 has an open bar.

Leg 1 **cannot ever be observed**: the project has no users, so no pack author
can report a missing slot. It reads as a precondition and functions as a
permanent lock.

Proposed: **replace leg 1 with "cold run 3 hits a slot that does not exist."**
Cold runs are an existing mechanism (2/2 passed, both packs merged unedited) and
cold run 3 is already on the parked list, so this is observable with no new
machinery. Alternatively drop leg 1 and rely on the depth-track leg alone.

Note this is a *repair of an unobservable bar*, not a softening — the substance
of the condition is unchanged, only its observability.

RULING:

---

## Falsification

This review would have been worthless if every precondition turned out correctly
unmet. Two fired (§1.1, §1.2) and one is plausibly met (§1.3), so the exercise
paid for itself. Whether it should become a recurring ritual is a separate
question, and should be judged on the yield of the *second* run, not this one.
