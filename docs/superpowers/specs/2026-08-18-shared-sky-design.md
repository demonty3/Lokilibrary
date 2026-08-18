# Shared sky — one moon, one sun, weather crossing seams

**Date:** 2026-08-18 · **Status:** bars frozen before implementation ·
**Origin:** Harry's close-out queue item 4 (2026-08-17); the T3-slice-1 /
T5 visual findings collapse to "per-window private skies" — a joined pair
shows two moons at the same hour.

## 1 · The defect

Conditions are desk-global (the hour, the sway, the daylight colour — all
wall-clock-derived, judged 2026-08-08), but the sky's CONTENT is per-window:
each window extracts its own ☼/☾ arc and its own wisps, so a joined desk
shows one moon per window and weather that never passes between rooms. The
world claims to be one place through several apertures; the sky contradicts
it. Load-bearing for anything full-screen, and the README GIF re-cut waits
behind it (two moons in the GIF would bake the defect in).

## 2 · The mechanism (no broker, by construction)

Everything needed is already in every window:

- **The chain.** `applyJoins` receives the full `joins` list + `wings` map,
  not just this window's neighbours. Every window can walk the joins into
  the same ordered left-to-right chain and find its own index. Same inputs
  → same chain, no messages.
- **The clock.** Wisps and arcs already run on wall-clock seconds ("two
  windows on the same wing agree without a broker channel" — clouds.ts).
  Desk-space positions derived from the same clock agree the same way.

So: a **chain key** (the chain's wing ids in order) seeds everything shared.

- **Bodies:** when the chain length is >1, a deterministic hash of
  (chainKey, role) picks the one HOST window per body; only the host draws
  it, at its own extracted arc column. Unjoined windows keep today's
  behaviour exactly.
- **Wisps:** when chained, wisp specs come from the chain key, not the
  window: count `2 × chainLen` (per-window density preserved), canonical
  shapes, speed in the judged 0.25–0.45 band, position computed in
  desk-space `[0, chainLen × width)` and wrapped desk-wide; each window
  draws the slice that overlaps its own range, so a run exits one window's
  right edge as it enters the neighbour's left. Occlusion stays LOCAL —
  each window fades the wisp against its own blocked spans and its own
  pack's omissions (the world always wins, per window).

Deliberately NOT done: desk-wide arc x-travel for bodies (skyArc's "the arc
moves y only" survives); considering pack omissions in the host pick (a
pack that omits the moon can host it and the desk has none — only
gameboy-dmg omits bodies and it is excluded from the auto-pool; recorded,
not solved); vertical chains (Phase B's VJoin gets its own sky question —
an under-window has no sky at all).

**Assumption, named:** all chained windows share one cell width (every
spawn is 640px). The chain math uses this window's own width for all.

## 3 · Measured bars — frozen before implementation

- **B1 (one body):** on a live joined pair, exactly one window reports a
  non-null sun view and exactly one a non-null moon view (`debugSky`
  across both windows). Today's measured pre-state: both windows report
  both bodies.
- **B2 (seam continuity):** for a shared wisp, window i's local x +
  i×width equals window j's local x + j×width (the same desk-space x) at
  the same wall second, same row — within the drift covered by the
  seconds between the two CDP reads (≤0.45 cells/s × Δt).
- **B3 (solo control):** an unjoined window's wisp specs and body views
  are byte-identical to the pre-slice path — the shared branch is
  unreachable at chain length 1 (smoke-asserted).
- **B4 (rehost):** after an unjoin, the now-solo window draws both bodies
  again; after a re-join, the desk is back to one of each.

**KILL:** if two live windows derive different chains or different hosts
from the same topology event — the no-broker premise is refuted; stop,
record the disagreement, do not add IPC inside this slice.

## 4 · Eyeball bars (Harry's, frozen)

The joined desk reads as ONE sky: one moon, and weather that passes
between rooms — a wisp leaving one window and entering the next reads as
passage. **KILL:** the handoff reads as a pop/teleport at the seam; or the
non-host window's bodyless sky reads as broken (a MISSING moon) rather
than "the moon is over the other room".

## 5 · Verification plan

New pure module + smoke (chain derivation, host pick, desk-space wisp
maths, solo-control identity); typecheck + full smoke sweep; live desk:
`debugSky`/`debugClouds` reads across both windows for B1/B2/B4, join-shot
for the eyeball record.
