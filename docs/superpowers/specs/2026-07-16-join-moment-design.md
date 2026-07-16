# The join moment — design

*2026-07-16 · source: this session's brainstorm + the `loki-research-sweep`
research (Terrain-Diffusion's shared-coordinate principle from Two Minute
Papers / arXiv 2512.08309; seam-continuity techniques; voxel = scope-trap;
Fable-5 = a build-time coding tool, not an art/runtime dependency). Scope
approved by Harry: Parts A + B + C. Goal: when two snapping terminals join,
the two side-on wings read as ONE continuous land — the ground flows across
the seam, no window-chrome gap interrupts it, and the join has a "fuse" beat.
Advances `docs/PRD-snapping-terminals.md` — this is the MINIMUM of T1 the join
needs; the full T1 registry / persistence / tray / chains stay deferred (§6).*

## 0 · Principle (why this shape)

The research converged on one answer: the fix is **2D + deterministic + native
to the codebase** — NOT voxel, NOT a diffusion model. Terrain-Diffusion's
transferable idea is *"terrain is a pure deterministic function of shared
coordinates + seed, so independently-rendered viewports line up by
construction."* We already ship exactly this pattern for the CELL walkable seam:
`cell.ts:71` `layoutCell(seed, seamSeed?)` + `SEAM_SALT` (`0x5ea3`) carves a
matching walkable row on **both** walls from a shared seed. Part A extends the
same idea from doorways to the **horizon line**.

## 1 · Part A — Continuous ground (the substance)

The break, confirmed in code: each wing's surface silhouette is an independent
seeded sine field (`land.ts:152`, `surfaceY(x)` off the wing's own `phase`), so
wingA's right-edge height ≠ wingB's left-edge height. The broker aligns the
baseline `groundLine` (shared constant, equal window height) but never the
relief on top of it — so the bumps jump at the seam.

- **New pure `landSeamBoundary(seedA, seedB): { height, slope }`** — co-located
  with `composeLand` in `land.ts`. Folds the two wing seeds via `fnv1a32`
  (`seed.ts:45`) in **canonical order** (sort the two numeric seeds ascending)
  through a NEW distinct PRNG salt (`LAND_SEAM_SALT`, chosen away from the
  existing namespaces `0xce11 / 0x5ca7 / 0x10ce / 0x1a4d / 0xc1a5 / 0xc0a5 /
  0x5ea3`). Same pair → same boundary in either window, no negotiation, works
  for any pair (the pair isn't known until snap). `height` is sampled inside the
  surface band; `slope` is a second small sample.
- **`ComposeLandOptions` gains `join?: { edge: 'left' | 'right'; neighbourSeed:
  number }`.** When present, `composeLand` computes `landSeamBoundary(seed,
  neighbourSeed)` and **ramps that edge's last K ≈ 6 columns** from the wing's
  interior `surfaceY` to the shared boundary height — **smoothstep for height,
  cubic Hermite matching slope** (match the first derivative, or the horizon
  visibly *corners* even when the two heights agree). The `‹` / `›` edge glyph
  re-anchors to the boundary height (today it's planted at each wing's own
  `surfaceY`, `land.ts:307-308`).
- **Structure-free buffer**: suppress structure / label / scatter placement in
  the K blend columns so only the ground line + fill move. The **underground
  fill** beneath the ramped columns keys off the same boundary height so strata
  don't step at the seam either.
- **No-join → byte-identical.** `opts.join` absent (single window, the two
  outer edges, the web/preview path) leaves `composeLand`'s output exactly as it
  is today. This is the load-bearing back-compat anchor.

## 2 · Broker + renderer wiring

- **Broker** (`desktop/src/terminals.ts`): the `terminal:topology` broadcast
  currently sends `{ joins }` (pairs). Extend it so each terminal also learns,
  per joined edge, its **neighbour's wing** (e.g. `{ left?: wing, right?: wing
  }`). The broker already owns `terminals` (id → wing), so this is a lookup — no
  new state.
- **Renderer** (`src/terminal/terminalLand.ts`): on a topology change that
  adds/removes a join, derive the neighbour seed with the same local hash it
  already uses for its own (`fnv1a('terminal:' + neighbourWing)`,
  `terminalLand.ts:149`) and **recompose the land with `opts.join`** (composeLand
  is pure and cheap — simpler and less bug-prone than a surgical in-place edge
  re-flow). Un-join recomposes with `opts.join` absent → the closed-wall,
  independent-silhouette land returns. The existing edge open/close affordance is
  unchanged.
- The terminal land seed is self-contained (`fnv1a('terminal:' + wing)`), so each
  window derives **both** seeds from wing strings; the broker only needs to
  supply the neighbour *wing*, never a seed.

## 3 · Part B — Frameless windows (make A visible)

Even a perfect terrain match still shows the title-bar + border + shadow gap
between two framed windows (visible in the T0 shot). Removing it is the other
half of "continuous".

- **`desktop/src/terminals.ts`**: terminal BrowserWindows become `frame: false`
  (with `titleBarStyle: 'hidden'` on macOS) so nothing interrupts the ground.
  Windows still fit fully on-screen (the T0 640×520 lesson — a half-offscreen
  frameless window still invites macOS to shuffle its neighbours and fight the
  broker).
- **Renderer**: a thin in-world **title / drag strip** at the very top
  (`┤ wing d0 ├`, tinted chrome) carrying CSS `-webkit-app-region: drag`; the
  PIXI canvas / world input sits below it (interactive regions get `no-drag`).
  Window close: **keep `cmd-Q` for the spike**; a glyph close button is a
  plan-level nicety, not required for the join to read.
- Guard: frameless is terminals-mode + window-mode only (the dev-flag path). The
  single-palace window and wallpaper mode are untouched.
- Scope rail: this is the ONLY part of PRD-T1 in scope. The registry refactor,
  persistence, tray, and multi-terminal chains stay deferred (§6).

## 4 · Part C — The fuse juice (pop where it counts)

- On the transition to `open` at a **newly-joined** edge: a **one-shot knit
  sweep** — a short glow / brightness pulse travelling along the seam's ground
  boundary columns (~0.6 s), so the join reads as *worlds fusing*, not two
  windows merely touching. Both windows play it, ground-line aligned, so it
  reads as one sweep crossing the seam.
- **Ticker-driven** off `app.ticker.deltaMS` — no wall clock, freezes cleanly
  under throttle (the `@`-blink / landmark-pulse precedent). Deterministic; no
  new AI call, no new asset.
- Un-join needs no animation — the edges just close.
- This is the on-brand "pop" the research pointed to (glow / atmosphere on a
  moment that matters), distinct from the broader land visual pass (parallax,
  atmospheric perspective, phosphor, ambient life) which stays a later arc.

## 5 · Verification

1. **Headless smoke** (`scripts/smoke-land-seam.mts`, new):
   `landSeamBoundary` is **symmetric** (`(a,b) === (b,a)` after canonical order)
   and deterministic across repeats; a composed pair asserts **wingA right-edge
   height === wingB left-edge height** (and matching slope) across several seed
   pairs; the K blend columns are **structure-free**; and **no-join
   `composeLand` is byte-identical** to the pre-change output (snapshot compare
   across seeds). Determinism guard: no `Math.random` / `Date.now` anywhere in
   the new path (the `src/procedural` contract).
2. **Typecheck both legs** (repo root + `desktop/`) + the full existing smoke
   sweep green.
3. **On-screen (macOS, the `LOKILIBRARY_TERMINALS=2` launch path + the
   `scripts/e2e/t0-drive.mjs` harness)**: two **frameless** terminals, snap →
   the **ground line is continuous across the seam** (no height jump, no chrome
   gap), the **knit sweep plays once**, and a being crosses on aligned ground;
   drag apart → edges close and the silhouettes return to independent. **Eyeball
   every shot** (the reviews-miss-visual-defects lesson — reviews have missed
   on-screen defects before); keep before/after captures in `/tmp/loki-join/`.
   Motion evidenced by two frames of the sweep ≥ a few hundred ms apart.

## 6 · Out of scope (deferred)

Full PRD-T1 (main-process terminal **registry** replacing the `mainWindow`
singleton, per-terminal peek / throttle, persistence of the desk layout, tray
"new terminal", multi-terminal A–B–C chains, snap hysteresis) · the real land
**agent runtime** (PRD-T2) · per-terminal theming + the crafted T3 join
treatment beyond the knit sweep · **tiled-feature** seam knitting (WFC
edge-constraint re-solve — only needed if strata / cave-mouths must knit across,
not just the horizon line) · **vertical** (N/S) joins · the 2D-voxel / Terraria
diggable-terrain idea (parked) · Fable-5 as a build-time co-developer (a tooling
option, not product work).

## 7 · Files touched

`src/procedural/land.ts` — `landSeamBoundary` + `ComposeLandOptions.join` + the
edge ramp + structure-free buffer + edge-glyph re-anchor · `src/procedural/seed.ts`
(reuse `fnv1a32`; `LAND_SEAM_SALT` const lives near the boundary code) ·
`desktop/src/terminals.ts` (`frame: false`; topology broadcast carries the
neighbour wing) · `src/terminal/terminalLand.ts` (recompose the joined edge on a
topology change; the knit sweep; the title / drag strip host) ·
`src/terminal/TerminalApp.tsx` (drag-strip DOM host, if done DOM-side) ·
`scripts/smoke-land-seam.mts` (new) · `scripts/smoke-glyph-coverage.mts` (only if
a new glyph is introduced by the drag strip or sweep).
