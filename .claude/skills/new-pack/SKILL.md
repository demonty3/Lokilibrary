---
name: new-pack
description: Author a new style pack (theme) for the terminals desk — palette, glyph dialect, fx, value ramp, omission, daylight — gated by the pack conformance smoke and accepted by screenshot. Use whenever Harry wants a new theme/pack/palette ("make a <mood> pack", "author pack 11", "theme it like <thing>"), or a stranger-agent cold run is being set up. NOT for changing the pack engine, the gates, or the renderer — those are engine slices.
---

# New style pack

**The authoritative recipe is `docs/blueprints/style-pack.md`. Read it end to
end FIRST and follow it exactly** — schemas, contrast bars, locked roles,
registration touch points, gates, screenshot checklist, hard rails. It is
agent-facing and complete; this skill only adds what a fresh session doesn't
know about how pack work runs *in this project's sessions*. Do not restate or
re-derive the blueprint's numbers; if this file and the blueprint disagree,
the blueprint wins.

## Before authoring: direction from Harry

Packs are taste-led. Extract ONE mood from whatever Harry gives you; if the
direction is vague, offer 2-3 concrete named candidates (palette anchors + one
sentence of machine-identity each) and let him react — dialogue, not Q&A. A
pack should answer the blueprint's §7 question: whose pack is this and why
does it look like them? Check `src/themes/` first so you don't author a
near-duplicate of a shipped pack.

## Authoring loop (blueprint §1–3)

Touch only `src/themes/<pack-id>.json` + the registration lines in
`src/themes/index.ts`. Iterate against
`npx tsx scripts/smoke-style-pack.mts <pack-id> --values` — tune to measured
numbers, never guess, never soften a bar. Then the full gate set from
blueprint §3, run fresh.

## Desk context the blueprint predates

- **Pack assignment is per-wing and automatic** (`src/terminal/packAssignment.ts`):
  a registered pack joins the desk's rotation on its own; the first wing is
  pinned to `phosphor`; `?theme=<pack-id>` overrides for deliberate viewing.
- **`landOmit` decides desk compatibility**: two packs share a desk only if
  their omit sets are identical (two-pack seam finding, 2026-08-08). A heavy
  omission dialect (DMG-style) is legal but will pair only with its own kind
  at seams — flag this trade-off to Harry when authoring one.
- **Daylight (`daySky`) is optional and most packs omit it.** If authoring it,
  the blueprint's daylight section applies in full: hue leads, brightness is
  bounded — find the ceiling with `--values` before picking stops.

## Acceptance (adjusts blueprint §4 for the 2026-08-14 single-surface direction)

The browser e2e harness (`scripts/e2e/run.sh` + `drive.mjs shot`) remains the
authoring screenshot loop — fast, headless, fine for your own §4 checklist
pass. But the web build is paused as a verified surface: the shot that counts
is on the Electron desk Harry lives with. Before queueing the eyeball, boot
the desktop app via the `launch-desktop-app` skill and screenshot the pack
there (use the `?theme=` override or a second-wing spawn).

## Done = Harry's eyeball, not green gates

Green gates prove conformance, not taste. Close via the `close-slice` skill:
record in STATE.md, queue the pack screenshot + stock reference side-by-side
in TODO-USER.md for Harry's eyeball. A pack is MERGED only after his pass.
For stranger/cold-run packs, also record the tally against the standing kill
condition ("needs hand-fixing every run" — 2/2 clean as of 2026-07-31).
