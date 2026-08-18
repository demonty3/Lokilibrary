# Scale/anchor slice — height stops meaning zoom, starts meaning depth

**Date:** 2026-08-18 · **Status:** bars frozen before implementation ·
**Origin:** IDEAS.md § "Terminals of different sizes" item 2 (PURSUE,
2026-08-06); the load-bearing rung of the full-screen-desk ladder (PURSUE,
2026-08-17). PRD-snapping-terminals.md § risks already names the mitigation:
"Lock land scale across terminals."

## 1 · The defect

Window height currently determines both *how much world exists*
(`rows = floor(h / 26)`, `terminalLand.ts` grid derivation — skyH is derived
FROM rows) and *where the world sits* (`world.y = screenH − contentH×2`,
bottom-anchored), while the join broker aligns window **tops**
(`topology.ts` join predicate). Two windows of different heights joined at
the top would therefore disagree on where the ground line is by exactly the
height difference: a taller neighbour is a magnified-or-shifted copy, not a
bigger aperture. Every future rung (variable widths, archipelago
full-screen, hall/storeys) trips over this first.

## 2 · The mechanism

**WORLD_SCALE stays 2** (cell-density probe verdict 2026-08-17: KEEP; this
slice moves no scale dial). Instead:

- **Fixed surface geometry from the top.** `DESK_SURFACE = { rows: 20,
  skyH: 11, surfaceBand: 4, underH: 4, groundRow: 15 }` exported from
  `src/procedural/land.ts`. skyH is no longer derived from window height;
  the ground line sits at a constant row from the window top in every
  surface window.
- **Extra height = more underground.** A window taller than 520 px composes
  `extraRows = rows − 20` additional strata rows below the canonical model.
  These come from a NEW pure `composeLandExtension`, drawing each extension
  row from its own salted stream `mulberry32(seed ^ EXT_SALT ^ globalRow)`
  — the `UNDER_SALT` discipline — so every extension row is a pure function
  of `(seed, width, globalRow)` and cannot perturb the canonical compose.
  (Passing a larger `underH` to `composeLand` is ruled out: underground
  draws interleave in the main stream before surface structures/ore/sky
  beings, so it would move every above-ground row and break every golden.)
  Content: strata fill + shaft continuation at global parity + a light
  per-row ore-glint chance; no caverns, no gallery, no floor — this is
  aperture rock, not a second undercroft.
- **Top anchor.** `world.y` becomes a fixed top offset (0), replacing the
  bottom anchor. At both shipped sizes content exactly fills the window
  (20×13×2 = 520, 10×13×2 = 260), so the anchor change is pixel-identical
  today — and under it, the topology rule "joins align tops" becomes
  exactly the rule that keeps ground lines continuous at any height.
- **A way to see it.** `terminal:debugSpawn` accepts an optional
  `heightPx` (clamped 520–780); the broker keeps the spawned window's own
  height at snap/debugMove instead of squashing to `TERMINAL_H`. Debug
  heights are session-only (not persisted); `spawnUnder` stays gated to
  standard-height parents.

Deliberately NOT done: variable widths (next rung); any user-facing spawn
surface for nonstandard sizes; reconciling a tall parent's extension rows
with an open undercroft window's galleries (recorded risk, next rung); seam
wall spans across unequal heights (`edgeSpan` per-window, recorded).

## 3 · Frozen bars

1. **Shipped desk byte-identical.** Every existing golden smoke passes with
   zero re-baselines. Kill: any golden moves → the canonical compose was
   perturbed; stop and rework, do not re-baseline.
2. **Anchor identity.** New smoke asserts `20×13×2 === 520` and
   `10×13×2 === 260`; live e2e screenshot of the standard desk unchanged
   versus current build.
3. **Row agreement.** Extension compose at `extraRows = 5` vs `12` is
   byte-identical on all shared rows, per wing; strata bands match
   `strataRoleAtDepth` per column; shaft glyph parity is unbroken across
   the row-20 boundary.
4. **Aperture golden.** One hash per wing of the 25-row aperture (canonical
   20 + 5 extension rows), frozen at slice close.
5. `npm run typecheck` (both legs) + full smoke sweep green.
6. **Eyeball (Harry).** A 640×650 debug window beside a standard 520
   sibling: masthead, sky, ground row identical across the pair; only
   deeper rock differs. Pass: the tall window reads as a *deeper aperture
   onto the same wing*. Kill: the extra strata read as a second underworld
   competing with the real undercroft → cut the ore glints first; if it
   still fails, cap the extension depth rather than tune the fill.

## 4 · Runtime AI calls

Zero new call sites. No CLAUDE.md budget entry required.
