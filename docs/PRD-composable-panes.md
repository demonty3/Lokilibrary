# PRD — Composable panes: snap, chrome, and agent orchestration

**Status:** Proposed 2026-06-11, after the Terminal-Terraria V0 gate returned
"not yet" and Harry re-asserted the priority: *terminals snapping together so
agents can share and orchestrate worlds.* Slices gate on Harry's checkpoint
verification, same protocol as the visual PRD.
**Owner:** Harry. **Implementer:** Claude Code.
**Context docs:** `IDEAS.md` §Composable Panes (the Depth 1–3 ladder),
`STATE.md` (7B/7D.2 as-built), `src/state/store.ts`, `src/state/seams.ts`,
`src/render/PixiApp.ts`, `src/agents/crossSeam.ts`.

---

## 1. Where we actually are

The hard part is built and smoke-tested (782+ assertions):

- **Pane grid (7B):** flat list of `PaneDescriptor {id, level, rect, regionId?}`
  with integer grid-cell rects; split/close/focus/arrangement reducers;
  deterministic pane ids; the single-pane path byte-identical to pre-7B.
- **Seam graph (7D):** pure derivation of seams from abutting rects
  (`buildSeams`), coordinate bridging, walkable exits.
- **Seam-walking agents (7D.2):** a SINGLE ROAMING ROSTER — agents spawn once,
  perceive across seams (`enrichSnapshotAcrossSeams`), deliberately seek
  seams, and `migrateRuntime` moves them between pane scopes. A crossing is
  real: the agent leaves one world and inhabits another.
- **Region terminals:** a pane can be bound to a library wing (`regionId`),
  so two panes are two *different worlds* sharing one agent society.

What's missing is everything the user (and later the agents) touch:

1. **No pointer input at all.** Panes rearrange only via keyboard
   (`|` split, `\` arrangement preset). "Snap together" is not felt.
2. **Chrome is minimal:** 1px seam strokes + junction glyphs. No borders,
   no titles, no affordances — a pane doesn't read as a *terminal*.
3. **Agents don't know the topology.** They perceive across a seam band but
   have no concept of "which terminals exist"; nothing records crossings to
   the memory stream; reflection can't reason about the arrangement.
4. **Agents can't act on the topology** (IDEAS.md Depth 3).

## 2. Goals

- Direct-manipulation panes: drag a seam to resize, drag a pane to rearrange,
  everything snapping to the Cozette cell grid (quantisation applies to pane
  chrome/boundaries only — never to sprite movement, per CLAUDE.md).
- Diegetic glyph chrome: panes read as tmux-style terminals
  (`┌─┤ wing d0 ├─┐`), and the chrome IS the drag affordance.
- Topology as perception: agents know the arrangement, remember crossings,
  and reflect on it. The pane graph becomes the society's spatial substrate.
- Orchestration v0 (Depth 3, gated): the society may propose one reversible
  topology change overnight; the user wakes to a changed — and explained —
  arrangement.

## 3. Non-goals

- **No Dockview / react-mosaic.** The homegrown 7B system stays; a DOM layout
  library would replace working, smoke-tested code with a worse fit
  (supersedes the visual PRD's P1 approach).
- No floating/overlapping panes — the grid tiles fully; "snap" means
  grid-quantised tiling, not free windows.
- No new scale levels, no visual-PRD M-slices (parked pending its gate).
- No agent chatter about panes (no speech bubbles — expression stays spatial).

## 4. Hard constraints

- Single-pane path stays byte-identical (every slice keeps the
  `buildSeams([root]) === []` reductions intact).
- Determinism: pane ids stay `paneSeq`-derived; agent-driven topology
  changes seed from existing PRNG streams; no `Math.random()`/`Date.now()`
  in procedural or store paths.
- Keep `smoke-7b-panes.mts`, `smoke-7d-seams.mts`, `smoke-7d2-walk.mts`,
  `smoke-regions.mts` green at every checkpoint.
- Orchestration actions are whitelist-only (split/close/bind from the
  existing reducers) — the LLM never invents an action (CLAUDE.md whitelist
  rule). No new runtime AI calls: Depth-3 proposals ride the EXISTING Tier-2
  reflection dispatch (plan-output extension), inside the current budget.
- Wallpaper mode ignores all pointer input (existing guard pattern).

## 5. Slices

Each ends with a Harry-verified checkpoint (e2e screenshots + interactive
feel in the browser). Commit at green.

### S1 — Pointer foundation + seam drag-resize (~1 weekend)

The first mouse input in the app. Hit-test pointer position against the live
seam graph (reuse `projectSeamToPixels`); cursor feedback on hover; drag
moves the shared boundary, live-previewed, released position quantised to
the nearest Cozette cell column/row. Implementation: a `resizeSeam` store
action that refines the pane grid by an integer factor when needed (pure
refinement — all rects multiply, layout unchanged — so 7B invariants and
smokes hold), then shifts the seam line. Min pane size enforced (e.g. 12×8
terminal cells). New smoke: refinement preserves tiling; resize is
deterministic and reversible.

**Acceptance:** with a `|`-split, dragging the seam feels like dragging a
tmux divider; agents in both panes keep walking (and keep crossing) through
a resize; single-pane app has zero pointer overhead.

### S2 — Drag-to-rearrange + snap (~1 weekend)

Drag a pane (by its title zone once S3 lands; by a modifier-drag interim)
to rearrange: live ghost preview shows the snap candidate — swap with the
pane under the pointer, or dock to a screen edge/half (an implicit split).
Release applies atomically via one store action; Escape cancels. Agents
survive a rearrange: rect-only changes refit without remount (already true
in `reconcilePanes`); swaps preserve each pane's id/level/region so scopes
and rosters ride along untouched.

**Acceptance:** two terminals visibly *snap together*; a seam that appears
where panes now abut is immediately walkable (agent crosses it without
remount); arrangement is recoverable (undo last rearrange).

### S3 — Diegetic glyph chrome (~1 weekend, adapts visual-PRD P2)

Pane borders drawn in the glyph grid: box-drawing corners/edges, shared
dividers as single `│`/`─` runs, title inset tmux-style (`┤ wing d0 ├` —
region/level-derived), one-row status line per pane (agent count, level).
Focused pane gets `fgBright` border, others `fgDim`. Hover/drag affordances
live in the same vocabulary (divider brightens under pointer; title bar is
the S2 drag handle). Renders into the existing `seamLayer` (extended to a
`chromeLayer`), regenerated on layout change, cached as static text between
changes. Single pane = no chrome (or a minimal frame — Harry's call at
checkpoint).

**Acceptance:** a 3-pane screenshot reads as a tmux session inhabited by a
world; resizing feels like dragging a tmux split. (This is the original
P2 acceptance, kept verbatim — it survives the visual-PRD gate because it's
pane UX, not mural aesthetics.)

### S4 — Topology → agent perception (~½ week)

Agents gain arrangement awareness, kept spatial:

- Thread a `topology` view into `crossWiring`/`BehaviorContext`:
  neighbour pane ids + levels + regions, derived from the live seam graph.
- Record crossings to the Smallville memory stream (`agent X crossed from
  wing d0's terminal into the library root`) — crossings become memories,
  retrievable, reflectable.
- Tier-2 reflection context includes a one-line topology summary, so plans
  can say "explore the new terminal" — using existing whitelisted actions.

**Acceptance (headless):** smoke proves a crossing writes a memory; a
reflection fired after a split references the new terminal in its plan;
single-pane path allocation-free as before.

### S5 — Orchestration v0, Depth 3 gated (~1 week)

The society acts on the topology, safely:

- During 5B `SLEEPING` throttle, the cohort's overnight reflection may emit
  ONE topology proposal: `{action: 'split'|'close'|'bind', ...}` from a
  whitelist, validated against pins and bounds.
- Executed via the existing reducers; the previous arrangement is stored,
  the change is named, and the morning dispatch surfaces it ("Loki opened a
  terminal onto wing d2 — [revert]").
- Behind an explicit opt-in (trust-ladder per IDEAS.md); panes can be
  pinned; revert is one action.

**Acceptance:** opt in, force a sleep cycle headlessly, wake to a changed
arrangement + morning-dispatch explanation + working revert; opted-out
users can never see a topology change.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Grid refinement breaks 7B smoke expectations | Refinement only on drag; smokes drive keyboard paths which never refine; new smoke covers refinement invariants |
| Pointer hit-testing fights future in-world mouse use | Namespace it: chrome/seam zones consume; world clicks pass through (none exist yet) |
| Region remount drops walked-in agents (known 7D.2 issue) | S2 swaps preserve pane identity (no remount); region *changes* keep the existing caveat, noted not fixed |
| Depth-3 feels creepy / un-asked-for | Trust ladder: opt-in, named, reversible, pinnable — per IDEAS.md; default OFF |
| Chrome cost in wallpaper mode | Chrome is static text regenerated only on layout change; cached like murals |

## 7. Sequencing note

The visual PRD (Terminal Terraria) is PARKED at its V0 gate: the spike
shipped (commit `fbbaf5c`/`911ef49`), the verdict was "not yet", and the
likely path to "yes" is M2-style hand-authored murals — revisit after S3,
when the chrome work will have sharpened the glyph-craft anyway.
`v1-scope-gaps` (Loki events, enrichment budget) still queue ahead of any
SIXTH new system; S1–S3 are UX completion of an existing system, S4–S5 are
the next arc STATE.md already names.
