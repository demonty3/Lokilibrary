# Variable widths — a wider window is a wider aperture, not a different place

**Date**: 2026-08-18. **Ladder**: full-screen desk, rung 2 (after the
scale/anchor slice, whose eyeball passed the same day). IDEAS.md
§ Terminals of different sizes, item 1 ("nearly free"). Bars frozen
BEFORE implementation, per protocol.

## What changes

Window height already means depth (scale/anchor). This rung makes window
WIDTH mean horizon: a wider terminal shows more of its wing left-to-right,
a narrower one shows less, and two windows of different widths join with
the same masthead row, sky band and ground line, because none of those
depend on width.

What is genuinely already free (verified by reading, not assumed):

- The renderer composes `cols` from its own window width
  (`terminalLand.ts:623`), so land content is width-parametric today.
- `computeSnapTarget` / `computeJoins` read `width` off the bounds —
  edge maths is width-general.
- `proposalSpawnBounds` walks the chain by real bounds.
- `projectAcrossEdge` / `nearEdgeSummary` are distance-from-edge based.
- `landSeamBoundary` folds wing seeds only — the seam blend is
  width-independent.

What is NOT free (the slice):

1. **Broker** (`desktop/src/terminals.ts`): the Terminal record gains `w`
   beside `h`; `spawnTerminal` takes an optional `widthPx` clamped to
   **[480, 1200]** (480 = the renderer's 40-col floor at CW 6 ×
   WORLD_SCALE 2; 1200 keeps a wide window + one standard sibling inside
   a 1440 work area); `settle`, `terminal:debugMove` and `clampX` use the
   window's own width instead of `TERMINAL_W`;
   `terminal:debugSpawn` accepts `{widthPx}` beside `{heightPx}`. Debug
   widths are session-only exactly like debug heights: the restore path
   respawns standard.
2. **Topology payload**: `terminal:topology` / `getTopology` gain
   `widths: Record<terminalId, px>` (broker ground truth), included in
   the change-gate key.
3. **Shared sky** (`sharedSky.ts` + `terminalLand.ts`): wisp desk-space
   becomes a prefix-sum space. Each window converts every chain member's
   px width to cols with the SAME formula it uses for itself; the desk
   width is the sum, this window's offset is the prefix sum before its
   index. `sharedWisps` takes the total desk width in cells (uniform
   chain ⇒ identical value ⇒ identical output). Wisp draw and skyDebug
   `deskX` use the offset instead of `index × model.width`. Missing
   width for an id (stale payload) falls back to this window's own
   `model.width`, i.e. the shipped assumption.
4. **Undercroft width equality**: `computeVSnapTarget` / `computeVJoins`
   additionally require equal widths (within `JOIN_EPS_PX`) — the shared
   relief profile and `shaftColumn(cols, …)` are functions of cols, so a
   width-mismatched dock would disagree at the seam by construction.
   `spawnUnder` refuses non-standard-WIDTH parents exactly as it refuses
   non-standard-height ones (variable-width undercrofts are a later
   rider, not this rung).

Out of scope: resizable windows (windows stay `resizable: false`; widths
are chosen at spawn), variable-width undercrofts, multi-seam edges
(IDEAS item 3), persistence of debug sizes.

## Frozen bars

1. **Zero re-baselines.** Full smoke sweep green; every golden
   byte-identical. Kill: a golden moves → the canonical compose was
   perturbed; rework, never re-baseline.
2. **Uniform desk byte-identical.** For a chain of equal widths the new
   prefix-sum maths must reproduce the shipped shared-sky behaviour
   exactly — smoke asserts `sharedWisps` output equality and
   offset ≡ `index × width`. Kill: any drift on the standard desk →
   the refactor changed shipped behaviour; rework.
3. **Desk-space continuity at mixed widths** (new smoke cases): with
   member cols e.g. [100, 53], offset(i+1) = offset(i) + cols(i), so a
   wisp's exit column of window i is the entry column of window i+1;
   the host picks stay a pure function of the chain key.
4. **Standard topology untouched.** Existing smoke-t0-topology /
   vertical-join cases pass unmodified — the width-equality predicate is
   vacuous at uniform widths.
5. **Live**: a 960×520 window spawned via `debugSpawn {widthPx: 960}`
   snapped to a standard 640×520 — joins report, masthead row, sky band
   and ground line continuous across the seam; `skyDebug` on both
   windows agrees on each shared wisp's desk-space position (within one
   cell, same wall clock). `spawnUnder` on the 960 parent returns null.
6. Both typecheck legs + desktop tsc green.

**Eyeball (queued on ship, judged by Harry):** a wide window and a
narrow window beside a standard one — does each read as a different-width
*aperture onto the same wing* (more/less horizon, same glyph scale, same
ground), or does width read as zoom / a different place? Kill: zoom-read
→ the slice failed at its one job; narrow-window masthead collision
(wing label vs holdings overlapping at 480px) → raise the minimum width
to 520 rather than reworking the masthead.

## Known risks (named before building)

- **Masthead at 40 cols**: the left block (wing label + game ids) and the
  right-aligned holdings count could collide on a holdings-rich wing.
  Inference, not observed; the eyeball kill above owns it.
- **Mural omission**: below `MURAL_MIN_COLS` the flagship mural simply
  does not spawn — legal omission, same doctrine as the undercroft's
  missing sky.
- **cols formula drift**: the renderer converts neighbours' px widths
  with its own formula; if a window's canvas width ever diverged from its
  bounds width the chain maths would disagree. Frameless, non-resizable
  windows make them equal today; bar 5 measures it live.
