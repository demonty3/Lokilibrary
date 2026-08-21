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
