# SEALED — the blind A/B answer key

Open only after answering the two questions on
`2026-08-23-mural-blind-ab.html`.

| # | wing | source | brief |
|---|---|---|---|
| 1 | d3 (hades, pillared hall) | SEED | world |
| 2 | d4 (spire) | **COLD** | world |
| 3 | d1 (civ) | **COLD** | relationship |
| 4 | d2 (disco) | SEED | relationship |
| 5 | d0 (stardew) | SEED | world |
| 6 | d3 (hades, river passage) | **COLD** | world |
| 7 | d5 (hollow) | SEED | relationship |

The cold agent's whys, verbatim from its JSONs (branch
`worktree-agent-a5daf4b1bc94ddd3c`, commit `3648407`):

- **d1 (civ, relationship):** a half-painted map, the capital still lit,
  a dotted scout trail ending mid-sky — the blank right of the rect is
  the fog of war the campaign never cleared.
- **d4 (spire, world):** the spire rising floor over floor, a node-path
  climbing toward it, one red gem burning high as the single beat.
- **d3 (hades, world — replaces the seed's hall per the blueprint's
  replacement rule):** the river passage — cavern roof, ember drift,
  red waves, a dim boat hull, one lantern as the beat.

All three passed every gate with zero maintainer hand-fixes
(independently re-verified: 190 assertions, glyph coverage, typecheck;
diff scope exactly `src/murals/` + registry rows).
