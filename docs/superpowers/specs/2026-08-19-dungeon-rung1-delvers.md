# Dungeon economy, rung 1: Tier-0 delvers under one wing

Spec interviewed and frozen 2026-08-19, before implementation. Context loaded
per the routing block in IDEAS.md (main ladder, Addendum 1's consequentiality
principle, the marginalia evidence beat). Grading rubric for the spec-reviewer.

## Purpose

The first rung of the dungeon economy. A small permanent population of Tier-0
delvers lives in the undercroft beneath one wing. A few times a day, a being
walks to the shaft mouth and an expedition descends: pure utility-AI puppets,
dice and behaviour trees, watchable live in the shipped undercroft view. One
creature hazard waits below; delvers can die, permanently. Every expedition,
returned or lost, leaves one marginalia line above ground in the dispatching
being's name. Gold accrues invisibly in engine state. No LLM calls, no numbers
on screen.

## Done means

1. One designated wing hosts a persistent delver population (3 to 5), visible
   idling in the undercroft view between expeditions, visually distinct from
   beings (smaller or simpler sprites, same pack dialect as the desk).
2. Expeditions run 2 to 4 per 24 hours of desk uptime, each triggered by a
   being's visible walk to the shaft mouth; dispatch and descent are watchable.
   Zero LLM calls anywhere in the loop.
3. One creature hazard, dice-driven at Tier-0, rendered minimally (silhouette
   or disturbed glyphs, melancholy register, never horror). A delver can die
   permanently; the population shrinks and replacements arrive slowly (days).
4. Every expedition writes exactly one marginalia line above ground through the
   existing marginalia surface, attributed to the dispatching being, conveying
   the outcome with no numerals.
5. Gold yields accrue to persisted engine state and are rendered nowhere. No
   HUD, counter, bar, or numeric overlay exists anywhere in the feature.
6. All expedition and hazard randomness flows through the seeded PRNG
   (mulberry32); same seed plus same dispatch sequence reproduces the same
   outcomes. No `Math.random()`.
7. Consequentiality readiness (Addendum 1): outcome odds are a pure function of
   an expedition-parameters object (depth, retreat threshold, party size). At
   rung 1 the parameters are engine defaults; a harness test varies one
   parameter and shows survival odds shift measurably. This is what rung 2's
   directives will move.
8. Typecheck and existing smokes green; population, deaths, and the invisible
   hoard survive an app relaunch.

## Out of scope

Gold rendering and the hoard glyph (rung 2). Being directives or any reflection
involvement (rung 2). Monuments and spending (rung 3). Skill cookbook and DM
(rung 4). Combat dialect as a pack surface (rung 4; rung 1 renders in the
active pack's existing glyph vocabulary). More than one wing. Memorials beyond
a marginalia mention of the dead. Any new AI call site.

## Constraints

Rides the shipped Phase B undercroft surfaces; the wallpaper cannot be clicked,
so peek and the undercroft window are the viewing path. Tier-0 work fits the
existing desk tick budget. Marginalia goes through the shipped marginalia
system, not a new channel. Anything under `src/procedural/` obeys the
determinism rules. Aesthetic coherence: one pack dialect, the desk's own.

## Kill conditions

- **Reads as an idle game.** If the loop invites optimisation attention or the
  eyeball says "grind ticker", the register failed: re-cut pacing and render;
  never add UI to fix it.
- **Invisible without peeking.** If a week of uptime leaves no above-ground
  trace a wallpaper-glancer notices, the evidence rail failed and the
  marginalia beat must be re-cut until it lands.
- **A number appears.** Any numeric readout anywhere is a spatial-rail fail:
  remove it, never restyle it.
- **Parameters do not move odds.** If bar 7's test cannot shift survival odds,
  rung 2's kill test is already dead; fix before shipping rung 1.
