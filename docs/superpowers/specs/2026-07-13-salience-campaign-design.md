# Salience campaign — design

*2026-07-13 · source: docs/design-reviews/2026-07-13-visual-programme.md
(8-lens panel, pixel-verified). Scope approved by Harry: the two confirmed
bugs + quick wins #3–8. Goal: flip the glance test from "gold furniture"
to "someone lives here" — beings over furniture, one dialect per concept,
identity in every chrome surface.*

## 0 · The role layer (foundation for #3, #4, HUD)

`Theme` gains an optional `roles` map — semantic role → **existing palette
key** (never a new colour; the one-palette rule is structural):

```ts
export type PaletteKey = keyof ThemePalette;
export type ThemeRole =
  | 'player' | 'being.loki' | 'being.archivist' | 'being.cat'
  | 'being.visitor' | 'being.ghost' | 'seam' | 'decor.quiet';
// Theme: roles?: Partial<Record<ThemeRole, PaletteKey>>;
// helper: roleKey(theme, role, fallback: PaletteKey): PaletteKey
```

**Uniform default mapping** (works because each theme's palette JSON is
already tuned; a theme JSON may override any role):

| role | key | rationale |
|---|---|---|
| player | `fgBright` | brightest step + the blink makes it unmistakable |
| being.loki | `magenta` | unchanged — already distinct |
| being.archivist | `violet` | moves off blue (blue becomes the aperture dialect); violet freed from tables |
| being.cat | `orange` | freed from the door; warm counter-accent — the cat stops camouflaging into shelf gold |
| being.visitor | `cyan` | freed from green (tree clash) |
| being.ghost | `fgDim` | deliberate exception: a ghost should be barely-there; documented, not an oversight |
| seam (apertures) | `blue` | DISCOVERY: the "north ‖ marker" is the window tile (`T_WINDOW` `╫`, already blue). Door + window + seam caps become one blue *aperture dialect* |
| decor.quiet | `fgDim` | quiet furniture tier |

Decor keys after the shuffle: yellow = shelves/books (`≡` stack stays),
green = trees, blue = apertures, fgDim = quiet furniture (tables, chairs),
`☼` lamp re-keys orange→yellow. No decor shares a being's key.

**Reserved-accent rule** (enforced by smoke): no tile-bible or scatter
entry may use a `being.*` role's key. Consequences: `T_TABLE` re-keys
`violet → fgDim`; the cohort's `AgentDef.paletteKey` values update to
match the table (cat `yellow→orange`, visitor `green→cyan`); scatter
entries using `orange`/`cyan` re-key to `decor.quiet` or `yellow`.

## 1 · Bug: ladder label double-draw

`district.ts` / `island.ts` / `continent.ts`: the label cell-row is
stamped twice (internal id + name overprint → "C0Viliza…"). Fix: stamp
each label into an exclusively-cleared row; drop internal ids from
display entirely. (Locate the double stamp; the visible corruption is
pixel-confirmed in `level-district/island/continent.png`.)

## 2 · Bug + #8: the HUD becomes themed chrome

`App.tsx` `Hud` component (`#cdd6f4` at ~:402): takes the active `Theme`;
fill `palette.bgAlt` at 0.92, ink `palette.fg`, hint line `palette.fgDim`,
1px solid `palette.fgDim` border (CSS — the HUD is DOM). Content diet:
**drop the `steamid: —` line**; the key-hint line gains `e open shelf`
(static — the diegetic `[E] play` proximity prompt already exists and
stays the contextual half). Thread the theme from where App already
resolves it.

## 3 · The attention contract

- Cohort sprites tint via `roleKey(theme, 'being.<id>', def.paletteKey)`
  (`cohort.ts:198`).
- `@` tints via `roleKey(theme,'player','fgBright')` (`cell.ts:535`) and
  gets the **cursor blink**: colour alternates role-colour ↔ `fgDim` on
  an 800ms-on / 250ms-off cadence, driven by an `app.ticker` deltaMS
  accumulator (freezes cleanly under throttle; never wall-clock). Never
  fully invisible.
- Spine initials stay `fgBright` for now (shelf treatment is the next
  arc); the blink is what disambiguates `@` from spines today.

## 4 · One seam dialect

- `T_DOOR` (library.ts:139-141, glyph `╪`, `fgKey:'orange'`) re-keys to
  `blue` (the aperture dialect) — the highest-chroma isolated mark in
  every theme dies, and door/window/seam-caps read as one vocabulary.
- Carved side seam openings (`seamRows`): cap each open edge with the
  same ‖-dialect terminators the north marker uses, in the seam role's
  colour, so side gaps stop reading as broken walls. Rendering-side only
  (`cell.ts` reads `layout` — no procedural change, determinism intact).

## 5 · Tofu + letterform decor swap

- `T_TABLE` glyph `□ → ▤` (atlas-verified), fgKey `violet → fgDim`.
- CORRECTION from recon: the scatter bible contains NO letterform decor
  (`♠ ∩ ≡ ☼` only) — the panel's "M-shaped decor" was the `∩` chairs (or
  ghost sprites) mis-read at distance. No letterform swap needed; the
  finding dissolves. The `☼` lamp re-keys `orange → yellow` (reserved-
  accent rule — the cat owns orange now).
- Every new/changed glyph lands in the coverage smoke's enumeration.

## 6 · Pane focus indicator

Split the cell tile render into `wallLayer` (walls, corners, tees, door,
window, border glyphs) + the existing furniture layers. `wallLayer.alpha`
= 1.0 when `store.focusedPaneId === paneId`, else 0.55; updated on a
store subscription (unsubscribe at teardown). Single-pane default: always
focused → alpha 1.0 → **byte-identical to today**.

## 7 · Marginalia frame dialect

`captionFor` frame goes double-line (`╔═╗║╚╝` — atlas-verified): notes
are paper pinned over the world, not engine chrome. Plus: a one-cell `░`
drop shadow (second Graphics rect, offset +1 cell right/down, `bg` at
0.6 under the backing) and a 2-char corner tick `L·` in Loki's role
colour at the frame's bottom-right. (Mark GLYPHS stay single-agent-keyed
as shipped; only the reveal chrome changes.)

## 8 · Verification

1. Typecheck + full smoke sweep green per task; glyph-coverage smoke
   extended with `╔═╗╚╝║ ▤ ∩` and the seam terminators.
2. New smoke: reserved-accent rule (no bible/scatter entry uses a
   `being.*` key per theme), `roleKey` fallback behaviour.
3. e2e re-capture after the final task: all 6 themes, split, caption —
   **controller eyeballs every shot against the panel's specific
   complaints** (cat visible in gold field? orange cross gone? HUD
   themed on phosphor/3270? focus legible in split? note reads as
   Loki's?). Before/after pairs kept in /tmp/loki-salience/.
4. Blink verified via two shots ≥1s apart (colour differs) — motion
   evidence, per the stills-can't-see-easing lesson.

## Out of scope (later arcs)

Shelf spine-structure + per-theme spine ink · ambient life register ·
ladder identity pass (bug #1 is in; the theming is not) · shade-ramp
deployment · composition/density · phosphor palette redesign · land
items.

## Files touched

`src/themes/types.ts` + all 6 theme JSONs (roles) · new
`src/themes/roles.ts` (roleKey helper) · `src/render/agents/cohort.ts` ·
`src/render/levels/cell.ts` (blink, seam caps, wallLayer, caption frame)
· `src/procedural/tiles/library.ts` (door/table re-key + glyph) ·
scatter bible entries as found · `src/App.tsx` (Hud) ·
`src/render/levels/{district,island,continent}.ts` (label bug) ·
`scripts/smoke-glyph-coverage.mts` + new `scripts/smoke-salience.mts`.
