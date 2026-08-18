# Phase B — underground continuation: engine slices

**Date:** 2026-08-18
**Arc:** vertical stacking, re-opened per protocol as the underground-continuation
probe. Design gate: `docs/design-reviews/2026-08-17-underground-continuation.md`
— eyeball **PASSED 2026-08-18** ("passes, the lower window reads as the same
wing"); both §4 preconditions met (K-bars survived; the 640×260 under-window
size accepted, the 640×320 re-mock dial unspent). This spec opens the engine
work that pass unblocked.
**Status:** bars frozen 2026-08-18 BEFORE any code.
**Scope (product decisions, Harry 2026-08-17):** a window snapped underneath is
the SAME wing's underground continuation — no sky, all deep strata; downward
only; a vertical pair only (the L-shape is explicitly deferred); one under
window per surface window; the under window is its own kind (640×260,
`resizable:false`, spawned from the tray), never a converted surface window.

## The shape

Five slices, ordered so the riskiest item — seam determinism — is pinned by
pure smokes before any window exists, and every commit is green and meaningful:

1. **B0** — this document, committed first.
2. **B1p** — pure underground compose (`composeUnderLand` + shared helpers +
   `smoke-under-land`), headless.
3. **B1w** — vertical topology (`VJoin`), the under-window spawn path, the
   static join. First eyeball.
4. **B2s** — seam craft: the seam row parting outward from the shaft column,
   a column-wise knit sibling. Second eyeball.
5. **B3** — being descent + return through the shaft, topology language.
   Third eyeball.

## Bars — frozen before implementation

> **KILL — golden drift.** Any existing golden hash moves: the land goldens
> (`smoke-land-mural`, `smoke-land-bands`, `smoke-land-seam`), the horizontal
> topology suite (`smoke-t0-topology`, unmodified), the vjoin-free
> `deskTopologyLine` goldens (`smoke-desk-topology`), or `smoke-t5-proposal`'s
> `{}` vs `{proposals:false}` byte-identity. The surface window's composed
> model must be byte-identical whether or not an undercroft exists — only its
> bottom-edge RENDERING may change when vjoined.

> **KILL — moving the user's windows.** Any `setBounds` on a pre-existing
> window (T5's kill, inherited verbatim). Positioning a NEW window at spawn is
> legal. Consequence accepted and intended: dragging a surface window does NOT
> drag its undercroft — the vjoin honestly breaks and the user re-docks by
> hand.

> **KILL — horizontal regression.** `computeSnapTarget`, `computeJoins`,
> `openSides`, `neighbourOf`, and the SNAP_Y_PX drag-out escape change
> behaviour for surface windows in any way.

**Untouched by declaration** (not opened, not widened): `reachableWings`
(the `move_to` whitelist — the undercroft is the same wing, never a movement
target); `nearEdgeSummary` and the neighbour-summary relay (beings do not see
through rock); `watch_edge.side` (the intent engine stays 1-D); the T5
proposal path; the rendered output of every vjoin-free window.

**Determinism:** no `Math.random()` in `src/procedural/`; the under compose
draws from its own salted stream (`UNDER_SALT = 0x0d0e`, registered in the
land.ts salt registry, uniqueness checked against all eleven existing salts)
so it can never perturb the surface seed's main stream.

**Seam contract — what must agree and what must not.** Must agree between the
surface window's bottom row and the under window's top row: the strata ROLE
bands per column (via the shared relief-derived depth profile, including the
horizontal-join edge ramps), the shaft column and its glyph parity (global-y),
and the renderer's glyph-run texture (global-y hash offset). Deliberately NOT
agreeing — and not a bar: ore veins, caverns, and per-cell fill speckle.
Vertically adjacent rows within ONE window are already independent draws, so
per-cell continuation is not something the medium ever promised. The K3
seam bar (no window-chrome artefact) is inherited from the probe and judged
at the eyeballs.

## Cost model (CLAUDE.md requires this before shipping)

| | |
|---|---|
| **Trigger** | a being descending or ascending the shaft arrives in the other window and pushes the EXISTING `terminal_arrival` perception (subject `"<wing> undercroft"` going down, `"<wing>"` coming up), drained on the walker's re-pick cadence through the unchanged `routeTier1` |
| **Cost** | **zero new call sites.** One Tier-1 call per descent/ascent at most, charged to the existing terminal-land-arrival budget line (T2 society migration, 2026-07-17); descent frequency is bounded by the crossing chance + cooldown, so it sits well under the horizontal crossing rate. The under window runs the unchanged Tier-2 reflection pump, but reflection budgeting is per-BEING (threshold + 1-per-real-hour rate limit carried in the mind across seams), so a being below reflects instead of, not in addition to, reflecting above — neutral |
| **Caching** | none (each arrival is a fresh perception) |
| **Fallback** | the pure land intent engine; a refused exit (undercroft dragged away mid-visit) turns the being around exactly like a refused horizontal exit; transport failure stamps the throttle and the walker never blocks |
| **Telemetry** | existing logTier1/logTier2 rows (unchanged) |

A matching entry lands in CLAUDE.md's runtime-AI list at close-out.

## Acceptance (the three eyeballs)

1. **B1w:** tray → "Open undercroft" under a surface terminal: a 640×260
   frameless window snapped beneath — no sky, no masthead, the shaft
   continuing at the same column, strata bands and glyph runs continuing
   column-for-column across the OS window gap. Sideways drag detaches it and
   it STAYS detached; dragging back re-snaps.
2. **B2s:** docking/undocking parts the seam row outward from the shaft and
   closes it back, no flash frame; vjoin-free windows look exactly as before.
3. **B3:** a being wanders to the shaft, climbs down through the seam, lives
   on the gallery floor, later climbs back up; dragging the undercroft away
   mid-visit strands it below without a crash until re-dock.

Bars do not soften after viewing. Rendering artefacts route to
fix-and-look-again; a failed bar routes to the kill it names.
