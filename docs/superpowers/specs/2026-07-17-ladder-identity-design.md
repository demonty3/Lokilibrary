# Ladder identity pass — design

**Date:** 2026-07-17 · **Source:** visual programme #13 (`docs/design-reviews/
2026-07-13-visual-programme.md`, 2×L5 confirmed) + the salience campaign's
follow-up register (MARK_STYLES re-key, ladder pane-awareness). Harry
greenlit the slice and pre-decided the one open design question: **ghost
marks get a dim-but-distinct step.**

## Problem

The scale-ladder rungs (district / island / continent) are the least-themed
surfaces in the world. Every panel renders in flat `fg` with a `fgBright`
home carve-out — no theme accents, no beings, no explicit YOU, and the
panels float small (0.55–0.6 of the pane) in a void instead of filling the
pane the way the cell room does. The rungs also ignore which WING a pane is
bound to: a region terminal on d3 zooms out to a map that marks d0 as home.
SPEC promises "district shows agents as points of activity" — nothing does.

Separately (salience follow-up): `MARK_STYLES` in cell.ts predates the role
layer, so marginalia marks don't match their authors' accents — the ghost's
mark wears the visitor's cyan, the cat's mark is yellow while the cat is
orange.

## Approaches considered

- **A. Re-tint the single panel** (one BitmapText, gold fill): loses the
  hierarchy — borders/names/ramps/letters all need DIFFERENT accents.
  Rejected.
- **B. Per-cell BitmapText grid**: full tint freedom, but hundreds of
  display objects per rung against the established one-panel pattern.
  Rejected.
- **C. Tint-layer composition** (chosen): generalize the existing home-card
  carve-out — compose the character canvas as N named tint layers whose
  cells are DISJOINT (every glyph cell drawn exactly once), render one
  BitmapText per layer at a shared origin. Pure string work → smoke-
  testable; precedent already in the codebase twice (the ladder home-card
  carve-out, land.ts's per-role `layers`).

## Design

### 1 · Tint-layer panel helper (new, pure)

`src/render/levels/tintPanel.ts`:

- `TintCanvas` — a rows×cols character canvas where each cell holds
  `{glyph, layer}` (layer = a string key). `stamp(canvas, x, y, text,
  layer)` overwrites cells (last write wins — ownership moves, never
  duplicates).
- `layerStrings(canvas): Map<layer, string>` — per-layer multi-line strings
  (other layers' cells are spaces). Invariant: for every cell, exactly ONE
  layer holds a non-space glyph; the union reproduces the canvas.
- `mountTintPanel(parent, canvas, tints: Map<layer, number>)` — one
  BitmapText per layer at (0,0), Cozette metrics. Returns the container +
  measured glyph dims for fit.

The three rung renderers rebuild their panels through this helper. The
home-card "carve-out" special case disappears — home is just cells stamped
into a brighter layer.

### 2 · Rung accents (one palette, keys only)

| Surface | Layer → palette key |
|---|---|
| Card borders `┌─┐│└┘` | `yellow` — shelf-gold, the "built/owned" dialect (`shelfStrokeTints` stroke 0) |
| Game/district names | `fg` |
| Count lines (`4 games`) | `fgDim` |
| Activity ramp fills `▓▒░` | `orange` — the warm accent (programme wording) |
| Ramp pad dots + empty terrain + sea | `fgDim` |
| Home card / home label / YOU | `roleKey('player')` → `fgBright` |
| Agent letters | `roleKey('being.<id>')` per being (ghost letter `fgDim`, its documented dimness) |
| Header | `fg` |
| Footer legend | `fgDim` |
| Continent land-mass fill | `yellow` (gold land on a `fgDim` dot sea; the ramp GLYPH still encodes activity) |

Salience note: the cat's `orange` letter sits in the fill row NEXT TO the
orange ramp run. Acceptable at map scale (the letter is left-segment, ramp
right-segment, `fgDim` dots between) — flagged for the eyeball leg; if it
smears, the ramp falls back to `yellow`.

### 3 · YOU marker, composed not overlaid

The overstrike bug came from stamping a second BitmapText over shared
cells. The marker returns as COMPOSED text: the home card's top border
becomes `┌─ YOU ─…─┐` (stamped into the player layer), and the home
continent label gains a `YOU · ` prefix inside its existing (backed,
clamped) label string. Every cell still has exactly one draw.

### 4 · Pane-awareness (home follows the wing)

`mountPaneLevel` already receives `regionId` — thread it into
`mountDistrict/Island/Continent` as `homeWingId?: string`:

- **district**: home = the district whose id === homeWingId (fallback:
  canonical first). Centre card stays home; neighbours fill around it.
- **island**: show the continent CONTAINING home (today: largest); YOU on
  home's card. New pure helper `findContinentOf(tree, districtId)` in
  clusters.ts.
- **continent**: home continent = the one containing home.
- Header names the wing when bound: `district · wing d3 · …`.

Stale/unresolvable regionId → canonical fallback (mirrors the cell path's
whole-library fallback).

### 5 · Agents as points of activity

District + island cards show the letters of the beings (`AgentDef.glyph`:
L A c V G) on the card of the wing they're in, tinted per
`roleKey('being.<id>')`, placed in the fill row's left segment
(`│LAc ▓▓▓··│`).

Presence source: `registerCellPaneScope(scope)` gains an optional
`wingId: string | null` (null = whole-library pane = home). New
`listCellPaneWings(): Array<{wingId, agentIds}>` snapshot. `mountPaneLevel`
computes a `ReadonlyMap<districtId, agentIds[]>` for ladder mounts; the
renderers stay pure consumers.

**Fallback (the common case):** in the default single-pane flow, zooming
out UNMOUNTS the cell pane, so no cell scope is live. Then the full cohort
renders on the HOME wing's card (the roster spawns into root — true enough,
and the map never goes lifeless). Ghost respects its theme-allow filter.
Presence is a mount-time snapshot — the rungs stay read-only/ticker-free by
design (they must render under `paused`/`sleeping`), so letters update per
mount, not per frame. Documented, not a bug.

### 6 · Composition rule (fill like the cell)

Replace the three duplicated `makeFit(frac 0.55/0.6)` closures with the
cell room's rule, shared in tintPanel.ts:
`scale = max(1, min(floor(pw/panelW), floor(ph/panelH)))`, centred, integer.
Panel dims come from the canvas grid (cols×6, rows×13), not measured text.
Small maps scale UP to inhabit the pane instead of floating.

### 7 · MARK_STYLES re-key (cell.ts)

Mark glyphs unchanged. Tints resolve through the role layer:
`roleKey(theme, 'being.<agentId>', <current key as fallback>)` for
loki/archivist/cat/visitor — a mark now wears its author's accent.
**Ghost:** new `ThemeRole` `'mark.ghost'`, default **`fg`** — Harry's
"dim-but-distinct step": no accent hue (dim), one ramp step above both the
ghost's own `fgDim` body and the `fgDim` floor it sits on (distinct).
Per-theme overridable via `roles` JSON like every role.
`DEFAULT_MARK_STYLE` (unknown agent id) unchanged.

### 8 · Hygiene (follow-up register)

`BEING_ROLE_KEYS` derives from `ROLE_DEFAULTS` (`being.*` entries minus
`fgDim`) instead of a hand-kept list. Same exported value; the reservation
smoke keeps passing. NOT in scope: L· tick corner overprint, door/window
fgKey coupling, blink-freeze phase (other arcs).

## Testing

- **New smoke** `scripts/smoke-ladder-identity.mts`: layer disjointness +
  union (property-style across seeds/sizes), YOU-in-border composition,
  home resolution with/without/stale `homeWingId` at all three rungs,
  `findContinentOf`, agent-letter placement + cohort fallback, fit math
  (cell-rule parity incl. the full-rect identity), mark re-key table incl.
  ghost→`fg` + derived `BEING_ROLE_KEYS` equality.
- Existing smokes must stay green — especially smoke-salience (reservation),
  smoke-7a-scale-ladder (clustering untouched), smoke-glyph-coverage (no
  new glyphs — YOU is ASCII).
- **E2E screenshot-eyeball leg (mandatory — brain: reviews-miss-visual-
  defects):** single-pane captures (memory: split-pane capture caused a
  false finding) of district/island/continent in solarized-dark + one
  contrast theme (ibm-3270 — hues surprise there by design); plus a
  region-bound pane (`r` then `[`) proving YOU follows the wing; plus a
  cell shot with marks proving the re-key (ghost mark legible, cat mark
  orange).

## Out of scope

District≠island structural redesign (#18, its own arc), stub rungs
(planet/solar_system stay dim panels), murals (#16), shade-ramp floor
demotion (#12), any live-updating ladder ticker.
