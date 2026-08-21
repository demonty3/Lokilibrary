# Claude-authoring, rung 1: the mural blueprint and the cold test

Spec frozen 2026-08-21, before implementation. Direction thread:
`claude-authoring-direction.md` (session memory). Harry's four direction
calls, made in this spec-interview: scope is RUNG 1 ONLY (the live MCP
builder's hand and the first-run experience are later rungs, each with its
own spec-interview, contingent on this rung surviving); implementation
QUEUES BEHIND dungeon rung 4's bars; the blueprint ships BOTH content
briefs with the agent choosing per wing from library data; the taste bar
is BLIND A/B PLUS MATCHING.

Prior art (scout ran 2026-08-21, on the record): OpenPets occupies the
bare player-facing-MCP skeleton; MCPlayerOne authors worlds but ephemeral
and ungated; the full conjunction (own agent, gates, frozen assets,
deterministic engine, first-run-as-move-in) is unoccupied at medium
confidence. Residue: agentPet.io unfetchable (certificate error), no
closed-source/Discord sweep ran. NO NOVELTY CLAIM ships in README copy
off this scout alone. The per-game-art rule was amended the same day
(CLAUDE.md): interpretive generated art is allowed; the CDN art stays the
recognition anchor, never replaced; generated game-IP art never ships in
the repo or shared packs.

## Purpose

Prove that a stranger's own Claude, given only the repo, a mural
blueprint, and library data, can author wing murals that pass executable
gates with zero hand-fixes and survive a blind taste bar against the
shipped hand-authored murals. This extends the proven pack cold-test
mechanism (blueprint plus calibrated frozen gates) from palettes to art,
and is the load-bearing test for the whole Claude-authoring arc:
personalisation via the user's own artist rather than better procedural
generation. Zero new runtime AI call sites: authoring happens in the
user's own Claude session at build time; murals land as frozen assets on
the existing wing-mural surface; the deterministic engine is untouched.

## Done means

1. **Blueprint.** `docs/blueprints/mural.md`: mural rect geometry and
   placement on the shipped wing-mural surface; palette legality (active
   pack only); glyph legality (Cozette coverage); density and
   letter-noise budgets; and BOTH content briefs, "the game's world"
   (interpretive scene in the pack's dialect) and "you and the game"
   (memory-palace art of the player's relationship: hours, era, backlog),
   with the per-wing choice rule driven by library data (hours, recency,
   genre). The agent must state, per mural, which brief it chose and why
   (one line, for the record; surfacing that in-world is a later-rung
   question). Includes one worked example the maintainer has verified
   end-to-end.
2. **Gates, calibrated then frozen.** A conformance smoke with a
   `--values` mode, calibrated on the approved corpus FIRST: every
   shipped hand-authored mural passes before the bars freeze. Machine
   bars (palette, glyph coverage, rect fit, density budget) are written
   as absolute values, not multiples of the constants they guard.
3. **Cold test.** A context-cold agent (fresh session; never this
   conversation), given repo plus blueprint plus library data, ships
   murals for at least 3 wings, gate-green with ZERO maintainer
   hand-fixes. The strong-model run gates; a Haiku-floor run is
   informative only.
4. **Taste bar (frozen now, judged blind, on-screen in the real desk).**
   (a) Blind A/B: cold-run murals shuffled unlabelled among the shipped
   authored murals; PASS = Harry does not reliably single out the
   cold-run murals as the weak ones, and rules none "would not ship".
   (b) Matching: at least 4 mural/library-summary pairs (at least one
   real library, profiles distinct); PASS = Harry pairs them better than
   chance. Bars set before observation; never softened after.

## Out of scope (rung 1)

The MCP server and any live connection; the first-run experience,
including the hard-dependency-vs-move-in ruling (deferred to that rung's
interview); the fine-lattice mural rect (an engine slice, separately
spec'd if this rung shows the resolution ceiling binds); in-world
surfacing of the agent's choice rationale; pack-engine changes; community
sharing of murals.

## Constraints

Frozen assets only, no runtime generation, no new entries in CLAUDE.md's
runtime-AI ledger. The amended per-game-art rule applies verbatim.
Blueprint and smoke are docs-plus-script work; implementation starts
after dungeon rung 4's bars are done. Mac-only verification; on-screen
checks via the e2e harness and the launch-desktop-app skill.

## Kill conditions

- Gated output needs maintainer hand-fixes to ship: the blueprint-gate
  loop does not transfer from palettes to art. The rung dies; the MCP
  and first-run rungs do not start.
- Blind A/B fails (Harry reliably picks the cold-run murals as the weak
  ones, or any is "would not ship"): stranger's-Claude authoring does
  not clear the handcrafted bar. Same consequence.
- Matching at chance: the murals are generic and the personalisation is
  not real. The content brief reverts to maintainer-authored murals; the
  arc's premise is refuted at this surface.
