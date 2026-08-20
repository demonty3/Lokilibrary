# Dungeon economy, rung 2: persona directives + the hoard glyph

Spec frozen 2026-08-20, before implementation. Context loaded per the routing
block in IDEAS.md (main ladder + Addendum 1 only — the consequentiality kill
test). Harry's two direction calls, made in the planning session: directives
are persona-derived and zero-LLM (reflection-driven directives are a later
rung), and the evidence surface is the hoard glyph alone (memorial and changed
sprite stay on the ladder). Grading rubric for the spec-reviewer.

Calibration note (order of operations, on the record): the odds bars below
came from the approved plan; BEFORE this spec froze, the rung-1 engine's death
rates were measured across the candidate (partySize, retreatThreshold) space
to choose derivation ranges that can satisfy them — depth moves gold, not
death odds; party 2 at the bold end breaks the spread cap. The chosen ranges
(depth 4-8, retreat 2-5, party 4-3) are implementation, free to re-tune; the
bars are frozen and are not.

## Purpose

The consequentiality rung. The dispatching being's temperament now decides how
an expedition runs: a timid persona sends a larger party shallower with an
early retreat; a bold one sends a smaller party deeper and holds the line
longer. Same wing, same dice, same engine — who walks to the shaft mouth
changes who comes home. And the invisible hoard becomes visible: a glyph pile
in the undercroft that grows by stages as gold accrues. No LLM calls, no
numbers on screen, no user gating.

## Done means

1. The dispatch site derives expedition params purely from the dispatcher's
   persona: a pure function, deterministic per (agentId, persona), taking
   ZERO draws from any expedition prng (rung-1 determinism untouched by
   construction).
2. Addendum-1 kill test, two-sided, as a smoke: over ≥8000 runs on the SAME
   per-run seed streams, the timid-most persona's per-delver death rate and
   the bold-most persona's differ by MORE THAN 1 percentage point (CONFIRM),
   and directives-followed vs `DEFAULT_EXPEDITION_PARAMS`-ignored orders
   strictly (timid < default < bold). KILL: rates indistinguishable — the
   mind isn't consequential and rung 2 dies here.
3. Bounded spread (the melancholy register survives): the bold-most persona's
   death rate stays under 2.5× the timid-most AND under 10% absolute. KILL:
   one persona reads as cursed — re-tune the derivation ranges, never the
   engine dice.
4. The hoard renders in the undercroft as a glyph pile at the camp side of
   the shaft; stage is a pure monotone function of `hoardGold`; stages only
   ever grow. First glint within a day of desk uptime; the pile is never
   done inside a month.
5. No numerals: nothing in the hoard glyph rows, the directive surface, or
   anywhere else on screen carries a digit — smoke-asserted on the exported
   glyph table, eyeball-asserted on the world surface.
6. Rung-1 regression: `smoke-delve.mts` (130 checks) stays green and
   byte-untouched; the default persona's derived params land within ±1 of
   `DEFAULT_EXPEDITION_PARAMS` on every field (strangers unpenalised).
7. Typecheck (src+worker and desktop legs) and the full smoke sweep green;
   the hoard stage survives an app relaunch for free (derived from the
   already-persisted `hoardGold` — no state-shape change, no migration).
8. Eyeball (Harry): the hoard reads as treasure accumulating. KILL: reads as
   clutter/confetti, or as a gauge/progress bar — re-cut the pile's shape or
   pacing, never add UI.

## Out of scope

Memorial for the lost. Changed dispatcher sprite. Addendum-9 display work
(gates, hover-reveal, scrolling undercroft). Reflection or any LLM
involvement. Monuments and spending (rung 3). Any new AI call site. Any
DelveState shape change.

## Constraints

The derivation reads the persona the being already carries (`LAND_PERSONAS` /
`DEFAULT_LAND_PERSONA` via `b.persona`) — the same identity axis the
marginalia voice keys on, so the voice and the temperament agree. The hoard
draws in the rung-1 undercroft convention: direct BitmapText, `decor.quiet`
ink, glyphs from the vocabulary already shipped (`▪ ░ ▒`), static — no pulse,
no fill animation (animation is what makes a pile read as a gauge). The
engine stays pure and PIXI-free; terminalLand owns wiring.

## Kill conditions

- **A number appears.** Remove it, never restyle it.
- **Directives do not move odds.** Bar 2's smoke fails → rung 2 is dead;
  nothing ships.
- **One persona reads as cursed.** Bar 3 breached → re-tune derivation
  ranges, never the dice.
- **The hoard reads as a gauge or as confetti.** Re-cut shape or thresholds,
  never add UI, never animate it into legibility.
