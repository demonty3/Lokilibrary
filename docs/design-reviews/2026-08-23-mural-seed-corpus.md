# Mural seed corpus — the calibration eyeball

2026-08-23. Claude-authoring rung 1 (spec
`docs/superpowers/specs/2026-08-21-claude-authoring-rung1-mural-blueprint.md`,
frozen 055d568). The four seed murals are built, gate-green and mounted;
this eyeball approves (or re-cuts) them as the calibration corpus. **The
conformance smoke's taste bars stay PROVISIONAL until this passes** — the
spec's Done-means 2: bars calibrate on the approved corpus, then freeze.
After the freeze: the cold test (Done-means 3), then the blind taste bar
(Done-means 4).

## The corpus

Shots in `2026-08-23-mural-seed-corpus/`, one per authored wing, each
taken from the live compose path (`?terminal=t1&wing=<w>`; wing d0 also
mounts on your real desk):

| shot | wing | flagship | brief | why (verbatim from the JSON) |
|---|---|---|---|---|
| d0-stardew-world.png | d0 | stardew (recent) | world | "…no marked personal arc in the data, so the mural paints the valley itself: sun up, lit window, field rows." |
| d2-disco-relationship.png | d2 | disco (dusty) | relationship | "…a whole city bought and never entered, so the mural is the relationship: a skyline under dust with one window still lit for you." |
| d3-hades-world.png | d3 | hades (loved) | world | "…an ongoing affair rather than a memory, so the mural is the place itself: the pillared hall, braziers lit, embers rising." |
| d5-hollow-relationship.png | d5 | hollow (mastered) | relationship | "…the one descent this library finished, so the mural is the relationship: the shaft mapped solid, the stitched path down, the bottom reached." |

Measured (`smoke-mural-blueprint --values`): density .500 / .509 / .464 /
.827, letterform fraction .000 on all four. Provisional bars: density
[0.25, 0.92], letters ≤ 0.15. Evidence, not judgment: the same JSONs
re-dress under every pack by construction (keys, never hex) — d5 renders
amber under its wing's pack, d2's towers grey under the blue night.

## Bars — frozen before you look

- **B1, a picture.** Each mural reads at a glance as a scene or a shape —
  not as texture, not as UI text. KILL: any mural you read as noise →
  that mural is re-authored and the corpus re-eyeballed; no freeze.
- **B2, the ship bar.** None is "would not ship" hanging beside the
  desk's own art. KILL: same consequence as B1.
- **B3, in the hour.** The blank cells read as sky showing through — the
  mural belongs to the window's night or day, not a poster taped over
  it. KILL: reads as a pasted poster → density re-cut downward, re-shoot.

PASS = all three, spoken (per mural or for the corpus as one). On a pass
the smoke's bars freeze at the values above with the corpus measurements
recorded beside them, and the cold test unblocks. Bars never soften after
observation; a re-cut mural re-enters under the same bars.

One trade on the record, not a bar: the mural rect's return re-arms the
08-08 eviction trade (sky decorations under the rect are evicted, the ☼
among them) on the four authored wings only — every unauthored wing keeps
its unbroken sky.
