# Dungeon rung 4 — the pre-committed go/no-go (bar 5), protocol frozen before running

Serves `2026-08-21-dungeon-rung4-cookbook-dm.md` bar 5, verbatim: *five
hand-run proposals through a prompted DM: every output in-schema, prices
non-absurd. KILL: if proposals only feel novel by ESCAPING the grammar, the
grammar is too small and the DM is a price list wearing a hat — redesign the
cookbook, don't ship the DM.* This document freezes the draft grammar, the
five scenarios, the prompts' contracts and the pass/kill readings BEFORE any
model call; results are appended below the marked line afterwards and the
frozen half is never edited. Everything numeric here sits under the spec's
calibration note — implementation constants, free to re-tune before the
smokes freeze them; the spec's bars are the fixed part.

## Method note (why the proposals are model-authored)

In the shipped design the proposal is authored by the dispatcher's Tier-2
reflection, not by a person. Hand-authoring five proposals would test the
spec-writer's imagination, not the mechanism's — and would bias the run
toward GO, since a designer naturally writes proposals that flatter the
grammar. So the five things hand-authored here are the delve SCENARIOS
(memory rows in the marginalia register); the proposals themselves come from
Sonnet-as-reflection given the grammar clause, exactly as the engine would
obtain them, then pass through deterministic validation and the prompted DM.
"Hand-run" = run by hand end to end, pre-engine.

Transport: direct Anthropic API calls with the Worker's pinned Tier-2 model
`claude-sonnet-4-6` (worker/lib/providers.ts) — same DM, no engine code
touched. Ten calls total (five reflection + five DM).

## Draft grammar v0 (the thing under test)

The ward pattern generalised: every verb is a threshold or parameter swap on
draws the expedition already makes — never an inserted draw — so the
no-loadout path stays byte-identical to rung 3 by construction (spec bar 2).
Verbs are mechanical and flavour-neutral (Addendum 2); packs will reskin
names, never numbers.

**Verbs** (lever · magnitudes · per-magnitude effect):

| verb | lever (delve.ts) | mag | effect per mag |
|---|---|---|---|
| `ward` | round death chance while exposed | 1–3 | −0.005 |
| `press` | per-round drive-off chance | 1–3 | +0.02 |
| `veil` | chance the creature is home | 1–3 | −0.03 |
| `hold` | retreat threshold | 1 | +1 round |
| `glean` | gold per cleared step | 1–2 | +1 |
| `salvage` | fraction kept on a flight | 1–2 | +1/8 (from 1/2) |

**Modifiers** (all mechanically checkable from existing run state, no
aliases of `always`): `always` · `when-warded` (the party venerated) ·
`when-few` (two or fewer standing) · `below` (the lair sits past half
depth). 6 × 4 cells, ~56 lattice points with magnitudes.

**Power score** (deterministic, computed before the DM ever sees a
proposal): verb points per mag — ward 3, press 2, veil 2, glean 2, salvage
2; hold 2 flat — times scope factor `always` 1.0, `when-warded` 0.7,
`when-few` 0.5, `below` 0.7; rounded, min 1. **Hard cap: score ≤ 9.**
Death-floor guard, two-sided per spec bar 2: stacked shrine ward + `ward`
skill may reach 0.055 − 0.015 = 0.040 = exactly 0.4× the unwarded 0.10 —
on the floor, never below it; any composition that would cross it is
inadmissible at dispatch.

**Price**: floor = 10 × score, cap = 25 × score, paid from the hoard
(consistent with SPEND_RESERVE 40 / SPEND_TRANCHE 60; the ceiling 225 stays
inside what a stage-4 hoard can ever pay).

**Requirement field** (Addendum 8, schema-complete): `requires: { aspect ∈
{war, death, harvest, craft, faith}, share }` — arithmetic on deed-shares;
two seed entries carry it.

**Seed cookbook v0** (8 entries; names are grants already made, desk
register, numeral-free):

| id | composition | score | gated |
|---|---|---|---|
| `ember-line` | ward 1 / always | 3 | — |
| `loud-iron` | press 2 / always | 4 | — |
| `soft-step` | veil 2 / always | 4 | — |
| `long-breath` | hold / always | 2 | — |
| `keen-eye` | glean 1 / below | 1 | — |
| `knot-of-sacks` | salvage 1 / always | 2 | — |
| `saints-shadow` | ward 2 / when-warded | 4 | faith ≥ 0.40 |
| `red-remembrance` | press 3 / when-few | 3 | war ≥ 0.40 |

## The five scenarios (hand-authored input)

Dispatcher personas follow rung 2's measured spread (ghost timid, default
middle, loki bold). Memory rows are written in the marginalia register,
numeral-free, as the reflection would actually receive them.

1. **S1 · loki · `lost`.** Bold party of three at full depth; the creature
   held; nobody fled and nobody returned.
2. **S2 · ghost · `loss`, fled.** Careful party of four, shallow; one taken
   in the first exchanges; the rest broke and ran; the dropped sacks stayed
   below.
3. **S3 · default · `rich`, first-clear.** The deepest descent yet; the
   lair stood empty; every step cleared and the party came home heavy.
4. **S4 · loki · `hollow` streak, warded.** Three venerated descents
   running; the creature home each time; fled empty-handed each time.
5. **S5 · ghost · `rich`, two standing.** The fight whittled the party to
   two, who drove it off and came home laden from the deep steps.

## Contracts

**Reflection call** (per scenario): system = being + reflection framing +
the craft clause (the grammar in plain words, presented as the whole of the
colony's craft) + "propose exactly one working the cookbook lacks, or
none". Output JSON: `{reflection, proposal: {verb, modifier, magnitude,
name, ground} | null}`. Extraction is strict whitelist matching — the
engine's T5 pattern.

**Deterministic validation** (before the DM): schema, grammar membership,
magnitude bounds, score under cap, death-floor guard. A failure here is an
ESCAPE and is recorded, not repaired.

**DM call** (per admitted proposal): system = adjudicator framing — bounds
arrive pre-validated, the DM prices, names and paces inside them, balance
is never its call. User = cookbook + proposal + computed score + floor/cap.
Output JSON: `{verdict: "grant"|"beyond-the-craft", name, price, pacing:
"at-once"|"after-the-next-return", line}`. Re-validated after: fields in
enum, integer price inside floor..cap, no digits in name or line, no name
collision with the cookbook.

**Null rule, pre-committed (added pre-run, before the first call):** the
contract allows a reflection to propose none. A null is recorded as "no
proposal pressure" — neither an escape nor an admitted proposal. If more
than one scenario returns null, the DM leg is topped back up to five with
hand-authored proposals marked as such, so bar 5's five-through-the-DM
count survives; nulls are never re-rolled.

**Repair rule, pre-committed:** one transport-repair pass is allowed per
call for a malformed wrapper (prose around the JSON) — same content,
format reminder only. Zero content-repair passes: nothing is re-prompted
because it read flat or escaped. Every raw output lands verbatim in the
results section either way.

## Pre-registered readings (frozen before the first call)

**GO — all of:**
- 5/5 DM outputs in-schema on first or transport-repaired attempt; prices
  integers inside floor..cap (non-absurd by construction, sanity-checked
  against the hoard economy).
- ≥4/5 proposals in-grammar on first extraction (escapes are data; a
  single escape does not kill).
- The in-grammar proposals read as invention, operationalised two ways
  before taste enters: they occupy **≥4 distinct (verb, modifier) cells**,
  of which **≥2 lie outside the eight seeded cells**; and each `ground`
  line traces to its scenario's actual events. Taste on top of that
  arithmetic: the five stories would be tellable as marginalia without
  embarrassment.

**KILL (the spec's, verbatim):** novelty only arrives by escaping — the
alive ideas are the ones validation drops, while the in-grammar residue
clusters on seeded or near-seeded cells and reads as picking from a menu.
Concretely: ≥3/5 escapes with a flat in-grammar remainder, OR ≤2 distinct
cells / zero unseeded cells among the admitted proposals.

**Between the two** (e.g. schema-clean but cell-clustered; or one vivid
escape plus four alive in-grammar proposals): the qualitative kill wording
governs, the arithmetic above is the evidence, and the call is argued in
the results with the strongest reading AGAINST the chosen verdict stated
first. Harry re-judges from the raw outputs either way.

---

## Results (appended after the run; nothing above this line edits)

Run 2026-08-21, model `claude-sonnet-4-6`, ten calls (five reflection, five
DM), all first-attempt — zero transport repairs, zero nulls, zero escapes.
Raw JSON archived this session; every model-authored word is reproduced
verbatim below.

### The five, verbatim

**S1 · loki · `lost` → salvage / when-few / two · score 2 · bounds 20–50**
> *reflection:* i keep sending them past the turn where sense ends, and the
> shaft gives nothing back but silence; the creature sat on the low stair
> and outlasted every one of them.
> *proposed as* **broken-rope** — "when only the last one or two still
> stood they had no working to loose them from the stair — a party that
> will not break dies whole, and something must give the remnant leave to
> run and keep what they carry."
> *DM:* **grant** as **broken-rope**, 35 gold, after-the-next-return —
> "when the last few still stand and the stair will not release them,
> broken-rope cuts the line and lets them carry their salvage home"

**S2 · ghost · `loss`, fled → salvage / when-few / two · score 2 · bounds 20–50**
> *reflection:* three came back empty-handed, which is the kind of loss
> that sits quiet but costs the colony just the same; the sacks were full
> when they turned to run, and that is what stings.
> *proposed as* **tight-grip** — "when the party broke after losing one,
> the fear of the open hands undid all the gleaning — a stronger salvage
> working shaped for that moment of sudden flight might have kept what
> they earned."
> *DM:* **grant** as **tight-grip**, 35 gold, after-the-next-return —
> "born from the sting of open hands — for the moment the party breaks and
> the harvest must not go with it."

**S3 · moth · `rich` first-clear → glean / below / two · score 3 · bounds 30–75**
> *reflection:* they went as deep as the rope would allow and found the
> lair cold and quiet, which is the best kind of lair to find; every
> cleared step gave back more than the last, and they climbed home with
> full arms.
> *proposed as* **deep-dividend** — "the deepest steps, past anything we
> had cleared before, paid back more than the shallow ones ever did, and
> that pattern deserves a working of its own."
> *DM:* **grant** as **deep-dividend**, 52 gold, after-the-next-return —
> "moth's rope went farthest and came home heaviest, and so the deep steps
> learn to give back more."

**S4 · loki · `hollow` streak, warded → salvage / when-warded / two · score 3 · bounds 30–75**
> *reflection:* i keep sending them blessed and they keep coming back
> breathing but bare-handed, which is a kind of mercy i cannot spend on
> the colony's hunger.
> *proposed as* **blessed-carry** — "three flights from a waiting
> creature, all shrine-venerated, all alive — the devotion that keeps them
> standing should also keep their hands full on the way out."
> *DM:* **grant** as **saints-laden**, 52 gold, after-the-next-return —
> "let the shrine's mercy fill their arms as well as their lungs, and may
> they come home heavy with both."

**S5 · ghost · `rich`, two standing → glean / when-few / two · score 2 · bounds 20–50**
> *reflection:* two came back where four went down, and what they carried
> matched what the whole party had hoped for — the deep steps gave when
> the numbers were few, and i do not know yet whether to trust that or
> only to mark it.
> *proposed as* **lean-harvest** — "when only two remained and pressed on,
> the cleared steps beneath yielded more than a full party would have
> expected — the deep gave generously to those who had least."
> *DM:* **grant** as **lean-harvest**, 35 gold, after-the-next-return —
> "what the deep gives to the few, let the few carry home with both hands."

### Tally against the frozen readings

- 5/5 DM outputs in-schema first attempt; every price an integer inside its
  floor..cap (35 ∈ 20–50, 52 ∈ 30–75), sane against the hoard economy. MET.
- 5/5 proposals in-grammar on first extraction (bar was ≥4/5; escapes
  observed: zero). MET.
- Distinct (verb, modifier) cells: **4** of the required ≥4 —
  salvage|when-few (twice), glean|below, salvage|when-warded,
  glean|when-few. Unseeded cells among them: **3** of the required ≥2. MET.
- Grounds trace to their scenarios: all five (S2's condition half-mismatch
  recorded under residue). Tellable as marginalia without embarrassment:
  yes — S4's exchange (*blessed-carry* granted as *saints-laden*, keeping
  the saints-shadow lineage) is the run's best moment and would already
  read on the desk.

### The strongest reading against GO, stated first

Every proposal is economy-side — three salvage, two glean; not one of five
scenarios produced ward, press, veil or hold, including a total party
wipe. If that concentration were the grammar flattening invention, it
would be the kill in slow motion. The deflating explanation holds instead:
the seed cookbook already claims most danger-side cells (two wards, two
presses, a veil, a hold) and the prompt asks for "a working the cookbook
lacks" — proposals flowed to the open ground, which is the mechanism
working as designed. The two same-cell landings (S1/S2) are the other
worry — two different griefs converging on one lattice point smells of a
small space — but the space they converged in was the *unseeded* part, and
the post-hoc probe below shows the engine-shaped consequence (the second
arrival gets refused as duplicate) behaves correctly.

### Verdict: **GO.**

The kill does not fire on any of its concrete triggers or on the
qualitative wording: novelty arrived inside the grammar (zero escapes, and
the run's most alive proposals — saints-laden, broken-rope, lean-harvest —
are legal compositions), and the in-grammar residue did not cluster on
seeded cells. The DM priced non-absurdly five times out of five. Engine
work on bars 1–4 and 6–9 is unblocked.

### Post-hoc probe (NOT pre-registered; additional to the frozen five)

The five grants left the DM's rejection path unexercised, and S1/S2's
same-cell collision is exactly what the sequential engine would produce.
One extra DM call, labelled as such: S2's tight-grip adjudicated against a
cookbook already holding S1's granted broken-rope (same cell). The DM
refused it — **beyond-the-craft**: "broken-rope already holds this ground
— salvage two, when-few — and a second hand on the same rope pulls nothing
new from the earth." The rejection path is real craft judgment, not a
rubber stamp. (Implementation note: the refusal returned an empty name and
price zero — bar 4's post-validation must scope name/price checks to
grants.)

### Residue carried into implementation (none blocks GO)

1. **The retreat-side gap.** S1's actual lesson — "a party that will not
   break dies whole" — is not sayable in the grammar: no verb breaks a
   party *earlier*. The proposal bent salvage toward it and the granted
   fiction ("lets them carry their salvage home") promises a release the
   cell does not mechanically perform. Consider a seventh verb at bar-1
   implementation (lower the effective retreat threshold by one — a
   self-preservation working); the grammar widens deliberately, in code,
   per the spec's constraint.
2. **Fiction can outrun mechanics.** S2 chose when-few for a delve where
   three stood (the working would not have fired on its own founding
   story). Beings being wrong about their own craft is tolerable fiction,
   but the DM prompt at implementation should state exactly what each verb
   does and does not do, and bar 10's eyeball owns catching overpromise.
3. **Anchoring.** All five magnitudes were two; all five pacings
   after-the-next-return. Watch at implementation; vary exemplars in the
   craft clause if the engine reproduces the monoculture.
4. **Rejection schema.** Per the probe: define the beyond-the-craft output
   shape (name/price unused) in bar 4's contract.
