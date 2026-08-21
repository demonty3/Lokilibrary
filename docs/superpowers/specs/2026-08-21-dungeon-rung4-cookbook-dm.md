# Dungeon economy, rung 4: the skill cookbook and the DM

Spec frozen 2026-08-21, before implementation. Context loaded per the routing
block in IDEAS.md (main entry's DM section + Addendum 2's flavour-neutral
grammar constraint + Addendum 7's aspects-as-bounded-dispositions + Addendum
8's deeds-only profiles). Harry's four direction calls, made in the
spec-interview this session: proposals trigger on NOTABLE DELVES, riding the
dispatcher's next reflection (zero new calls for the proposal itself); the
COLONY owns the cookbook and expeditions carry a temperament-picked loadout
(the rung-2/3 directive pattern); Addendum 8 ships SCHEMA-COMPLETE, LIGHTLY
USED (deeds-only accrual + requirement field from day one, one or two gated
entries, corruption deferred to the society arc); the DM is SONNET,
adjudicating AT PROPOSAL TIME. Grading rubric for the spec-reviewer.

Prior art (scout ran 2026-08-21, pre-committed by the routing): the
composition is UNOCCUPIED at medium confidence. Nearest mechanism:
arXiv:2512.17308 (LLM proposes Pokémon moves, a deterministic code evaluator
enforces numeric bounds, a separate LLM judge approves — independently
validates the propose→bound→judge shape; no persistence, no society,
explicitly no lore). Nearest container: Project Sid (persistent watchable
agent society; no invention mechanic). Friends & Fables ships an AI GM with
balance claims, human-prompted and per-campaign. Residue on the record: the
scout's GitHub code search 503'd unretried and no itch.io/7DRL pass ran, so
NO NOVELTY CLAIM ships in README copy off this scout alone. Adjacent work
strengthens; nothing occupies.

Calibration note (order of operations, on the record): the constants named
at planning — the power-score formula, hard caps, cost floors, the
notable-delve thresholds, the proposal chance, the loadout size k, the
desk-wide DM-call cap — are implementation, free to re-tune before the
smokes freeze their measured outcomes; the bars below are frozen now and are
not.

## Purpose

The invention rung. The society can now grow its own craft. After a notable
expedition, the dispatcher's next reflection may propose a new skill — a new
combination inside the cookbook's grammar, named in the being's voice. A
Sonnet DM prices, names and paces it strictly inside deterministic power
bounds; plain code is the balance authority, so a jailbroken DM can only
misprice, never break the game. Accepted skills enter the colony's shared
cookbook, get carried below as temperament-picked loadouts, measurably move
the Tier-0 odds, and leave their whole story — the proposal, the DM's
answer, the skill in use — as marginalia. Content generative from play; lore
with a paper trail. ONE new runtime AI call site (the DM); the proposal
rides the unchanged reflection.

## Done means

1. **Grammar + cookbook v0.** A hand-authored cookbook over a compositional
   grammar: mechanical verbs × modifiers × bounded numeric parameters, plus
   Addendum 8's requirement field. Addendum 2's constraint verbatim: the
   grammar's verbs stay MECHANICAL (flavour-neutral); how a verb renders in
   words and glyphs is a future pack-dialect surface — packs reskin names,
   never numbers. v0 ships 6–10 entries, of which one or two carry aspect
   requirements.
2. **Consequentiality (the Addendum-1 principle, rung-2 kill-test
   pattern).** Over ≥8000 runs on the SAME per-run seed streams, a
   representative loadout vs no loadout moves per-delver death odds or yield
   by MORE THAN 1 percentage point (CONFIRM skills are real), AND stays
   bounded (no loadout takes the warded death floor below 0.4× the unwarded
   baseline — craft, never god-mode). The no-skill path takes ZERO inserted
   draws — byte-identical to rung 3 by construction. The loadout itself is
   picked by dispatcher temperament, ≤k skills, pure and prng-free. KILL low
   side: skills statistically illegible → the cookbook reverts to lore-only
   and the DM does not ship.
3. **The proposal channel.** A notable expedition (thresholds are a dial:
   deaths, a first-clear, a rich haul) marks the dispatcher's mind; the
   proposal is extracted from that being's NEXT reflection through the
   UNCHANGED routeTier2 — the T5 extraction pattern, whitelisted schema,
   ids matched by word boundary. No notable delve → no proposal pressure.
   Zero new AI calls on this half.
4. **The DM adjudicates inside the bounds, never over them.** Deterministic
   validation runs BEFORE the DM (schema, grammar membership, computable
   power score under hard caps, cost floor scaling with score) — the DM only
   ever sees proposals the bounds already admit — and its output is
   re-validated AFTER (verdict, price within floor..cap, name and flavour
   through the no-numerals and glyph-coverage gates). A DM output failing
   validation is a rejection with a skipReason; the proposal counter is
   consumed, nothing retries in a loop, the walker never blocks (the T4
   posture). The DM is never the balance authority.
5. **The pre-committed go/no-go, BEFORE any engine work.** Five hand-run
   proposals through a prompted DM: every output in-schema, prices
   non-absurd. KILL verbatim: if proposals only feel novel by ESCAPING the
   grammar, the grammar is too small and the DM is a price list wearing a
   hat — redesign the cookbook, don't ship the DM.
6. **The spatial rail.** Every proposal outcome lands as marginalia in the
   being's voice — proposed, granted (under the DM's name for it), or
   rejected as "beyond the craft" (diegetic). No numerals anywhere on the
   world surface (smoke-asserted on the vocab exports, eyeball-asserted on
   screen); no HUD, no list, no cookbook browser — at v0 the cookbook reads
   through behaviour and marginalia only.
7. **Aspect profiles, schema-complete and lightly used.** Profiles accrue
   from Tier-0-observable DEEDS only (venerations, expedition choices and
   outcomes) — Addendum 8's kill verbatim: the profile ever derives from LLM
   text → cut that channel. The requirement field gates the one-or-two gated
   entries by arithmetic. No profile HUD — a morality HUD appearing is a
   spatial-rail fail. Corruption-path entries and extraction costs are OUT
   (society arc).
8. **Persistence + determinism regression.** Cookbook, profiles and pending
   proposal state ride the existing delve blob with defaulted fields — no
   schema bump, no migration; rung-3-shaped blobs load unchanged. smoke-delve
   (130), smoke-delve2 (41) and smoke-delve3 (58) stay green and
   byte-untouched.
9. **The ledger before the ship.** The DM call site is documented in
   CLAUDE.md's runtime-AI ledger BEFORE shipping: Sonnet via the Worker;
   trigger = a bounds-validated proposal following a notable delve; expected
   rate a few calls per week of active desk, under a hard desk-wide
   calls-per-day cap (dial); zero idle, zero key-free; caching none (each
   adjudication is a fresh judgment); fallback = consumed rejection, walker
   never blocks; telemetry = existing logTier2 rows. Typecheck (all three
   legs) + the full smoke sweep green; the chain verified live on the
   frontmost desk end-to-end: notable delve → proposal → DM → grant or
   rejection → marginalia → the next expedition's ledger fingerprint carries
   the loadout.
10. **Eyeball (Harry).** A granted skill's story is followable from the
    marginalia alone — the proposal, the DM's answer, the skill in use — and
    reads as the society INVENTING, not as a changelog. KILL: reads as patch
    notes → re-cut voice and cadence, never add UI.
11. **Inherited kills verbatim.** A number appears on the world surface —
    remove it, never restyle it. Anything reads as a gauge or confetti —
    re-cut shape or thresholds, never animate into legibility.

## Out of scope

Corruption-path entries and extraction costs (society arc, with Addenda 5/6).
Pack dialects for the grammar's verbs (the slot is designed for, not built).
Moddable mechanics — packs adding verbs/hazards/curves (parked, Addendum 2).
Monument proposals priced through the same grammar (future rung). The
Addendum-9 display rung. Vestment glyphs / visible specialisation (profiles
read through the world later). Per-delver skill learning (interview call:
colony-owned). Anything cluster- or multi-wing-scoped.

## Constraints

All DM calls go through the Worker (no key in any renderer). The whitelist
never widens by prompt wording — the grammar widens deliberately, in code.
`src/procedural/` stays untouched; everything here is terminal-side state +
the Worker. Live verification happens with the window frontmost (an occluded
desk pauses the tick and passes vacuously).
