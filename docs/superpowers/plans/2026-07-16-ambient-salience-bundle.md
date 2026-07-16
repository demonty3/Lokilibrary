# Ambient-Salience Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec:** `docs/superpowers/specs/2026-07-16-ambient-salience-bundle-design.md`. Branch: `claude/ambient-salience`.

**Goal:** The attention contract reaches the land register (ground demoted, beings in reserved accents), cell shelves read as books (three sub-cell spine strokes replace the flat `▓`), and the cell stops being pixel-frozen (seam caps breathe, trees sway, walked floor brightens and decays).

**Architecture:** Three additive passes over existing render machinery. Land: fill resolution for non-shaded roles extracts into a pure exported `landRoleFill()` with a new `GROUND_DEMOTE` table (crust/foliage scaled 0.6); dynamic beings in `terminalLand.ts` resolve tint through `roleKey()` with a deterministic accent pick shared as a pure helper in `beingIntents.ts`. Cell: the tile loop skips `T_BOOKSHELF` glyphs and a post-moves stroke pass composes each shelf from three `│` strokes tinted by a pure `shelfStrokeTints()` in the tile bible; one new `ambientTick` ticker (the `pulseLandmark` deltaMS contract) drives seam-cap alpha breathing, foliage sway, and a capped wear overlay in a new `wearLayer`.

**Tech Stack:** TypeScript strict (both legs), PixiJS v8 BitmapText, `npx tsx scripts/smoke-*.mts` smokes (`makeChecker`), e2e captures via `scripts/e2e/run.sh` + `drive.mjs` (cell) and the T0 harness `t0-drive.mjs` (land).

## Global Constraints

- **Determinism:** no `Math.random`/`Date.now` anywhere in this plan — stroke tints, sway phases, and accent picks all hash via FNV (`fnv1a32` from `src/procedural/seed.ts`, or the module's existing local hash).
- **One palette per scene:** every tint resolves through `theme.palette[...]` / `roles.ts`; no new palette keys, no hard-coded hexes.
- **No new glyphs:** `│` (tile bible T_WALL_V), `╫` (seam caps), `♠` (scatter) all already ship — `scripts/smoke-glyph-coverage.mts` needs no changes; verify it stays green in each sweep.
- **Throttle-aware animation:** all motion accumulates `app.ticker.deltaMS` (the `pulseLandmark` pattern) — freezes under `paused`/`sleeping`, never a wall clock.
- **Every task ends green:** `npm run typecheck && npm --prefix desktop run build` + the full sweep `for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done` + a git commit.
- **Reserved being keys** (`BEING_ROLE_KEYS`: magenta/violet/orange/cyan) may never appear in stroke tints or demoted ground — smoke-enforced.

---

### Task 1: Land ground demotion — `GROUND_DEMOTE` + `landRoleFill()` (TDD)

The bright green bars on the land are `crust` and `foliage`, both `ROLE_KEY`-mapped to the full `green` accent (`src/render/levels/land.ts:78,88`). Extract the non-shaded fill computation into a pure exported `landRoleFill()` and add a `GROUND_DEMOTE` scale table so the ground keeps its hue but drops ~two ramp steps. The runtime worn-paths system (`src/terminal/wear.ts`) swaps the crust layer's *text* only — fills are set once at build, so this composes cleanly.

**Files:**
- Modify: `src/render/levels/land.ts` (new exports; fill computation in `buildLandContainer`)
- Modify: `scripts/smoke-land-atmosphere.mts` (import + assertions)

**Interfaces:**
- Produces: `export const GROUND_DEMOTE: Partial<Record<LandRole, number>>` (`{crust: 0.6, foliage: 0.6}`) · `export function landRoleFill(theme: Theme, r: LandRole): number` (src/render/levels/land.ts). Task 6's land captures rely on this rendering change.
- Consumes: existing `shadeOf`, `mixToward`, `FAR_FADE`, `ROLE_KEY` (all already in the file).

- [ ] **Step 1: Write the failing smoke assertions**

In `scripts/smoke-land-atmosphere.mts`, replace the land import line:

```ts
import { FAR_FADE, GROUND_DEMOTE, landRoleFill, mixToward } from '../src/render/levels/land.ts';
```

and add below it:

```ts
import { getById } from '../src/themes/index.ts';
import { hexToInt } from '../src/render/fonts.ts';
```

Append before `report()`:

```ts
// 5 · ground demotion (ambient-salience bundle) — crust/foliage keep their
//     green HUE but scale down; quiet roles verbatim; FAR_FADE untouched.
const theme = getById('solarized-dark');
const expectScaled = (hex: string, f: number): number => {
  const n = hexToInt(hex);
  return (
    (Math.round(((n >> 16) & 0xff) * f) << 16) |
    (Math.round(((n >> 8) & 0xff) * f) << 8) |
    Math.round((n & 0xff) * f)
  );
};
check('GROUND_DEMOTE covers crust+foliage at 0.6', GROUND_DEMOTE.crust === 0.6 && GROUND_DEMOTE.foliage === 0.6);
check('crust fill = green scaled by GROUND_DEMOTE', landRoleFill(theme, 'crust') === expectScaled(theme.palette.green, 0.6));
check('foliage fill matches crust demotion', landRoleFill(theme, 'foliage') === expectScaled(theme.palette.green, 0.6));
check('stone fill untouched (fgDim verbatim)', landRoleFill(theme, 'stone') === hexToInt(theme.palette.fgDim));
check(
  'ridge still fades toward bg (FAR_FADE path unchanged)',
  landRoleFill(theme, 'ridge') === mixToward(theme.palette.fgDim, theme.palette.bg, FAR_FADE.ridge!),
);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-atmosphere.mts`
Expected: FAIL — `GROUND_DEMOTE` / `landRoleFill` not exported.

- [ ] **Step 3: Implement in land.ts**

In `src/render/levels/land.ts`, add directly below the `FAR_FADE` export:

```ts
/** Ground demotion (ambient-salience bundle): crust + foliage keep their
 *  green HUE but drop ~two ramp steps so the lawn stops out-shouting the
 *  beings — the land-register half of the attention contract (the beings'
 *  accent half lands in terminalLand.ts). Exported for the smoke. */
export const GROUND_DEMOTE: Partial<Record<LandRole, number>> = {
  crust: 0.6,
  foliage: 0.6,
};

/** Single fill-resolution point for a NON-shaded land role: far planes fade
 *  toward bg (FAR_FADE), ground roles demote by channel scale
 *  (GROUND_DEMOTE), everything else is its palette key verbatim. Pure —
 *  exported for the smoke. */
export function landRoleFill(theme: Theme, r: LandRole): number {
  const fade = FAR_FADE[r];
  if (fade !== undefined) return mixToward(theme.palette[ROLE_KEY[r]], theme.palette.bg, fade);
  const demote = GROUND_DEMOTE[r];
  if (demote !== undefined) return shadeOf(theme.palette[ROLE_KEY[r]], demote);
  return hexToInt(theme.palette[ROLE_KEY[r]]);
}
```

In `buildLandContainer`, replace the else-branch fill computation

```ts
    } else {
      const fade = FAR_FADE[r];
      const fill =
        fade !== undefined
          ? mixToward(theme.palette[ROLE_KEY[r]], theme.palette.bg, fade)
          : hexToInt(theme.palette[ROLE_KEY[r]]);
```

with

```ts
    } else {
      const fill = landRoleFill(theme, r);
```

(The foliage parity planes below it already consume `fill` — both sway planes demote together.)

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-land-atmosphere.mts`
Expected: previous count + 5 assertions, all passing.

- [ ] **Step 5: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean; every smoke green.

- [ ] **Step 6: Commit**

```bash
git add src/render/levels/land.ts scripts/smoke-land-atmosphere.mts
git commit -m "feat(land): ground demotion — crust/foliage drop two ramp steps (attention contract)"
```

---

### Task 2: Land beings in reserved accents (TDD)

`terminalLand.ts:addBeing` tints every being flat `theme.palette.fgBright`. Give each being a stable reserved accent from the same pool as the cell cohort. The pure pick lives in `src/terminal/beingIntents.ts` (the being-domain pure module, already imported by both `terminalLand.ts` and smokes) with its own tiny FNV so the smoke import stays dependency-light.

**Files:**
- Modify: `src/terminal/beingIntents.ts` (pure `beingAccentRole` + `LAND_BEING_ROLES`)
- Modify: `src/terminal/terminalLand.ts` (`addBeing` fill; imports)
- Modify: `scripts/smoke-salience.mts` (assertions)

**Interfaces:**
- Produces: `export const LAND_BEING_ROLES: readonly ['being.loki', 'being.archivist', 'being.cat', 'being.visitor']` · `export function beingAccentRole(id: string): ThemeRole` (src/terminal/beingIntents.ts).
- Consumes: `roleKey` from `src/themes/roles.ts`; `ThemeRole` from `src/themes/types.ts`; `hexToInt` (already imported by terminalLand.ts).

- [ ] **Step 1: Write the failing smoke assertions**

Append to `scripts/smoke-salience.mts` before `report()`:

```ts
// land beings draw from the reserved accent pool (ambient-salience bundle)
const { beingAccentRole, LAND_BEING_ROLES } = await import('../src/terminal/beingIntents.ts');
check('land accent deterministic', beingAccentRole('b1') === beingAccentRole('b1'));
const accentSpread = new Set(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'].map(beingAccentRole));
check('land accents spread over >1 role', accentSpread.size > 1);
check(
  'land accents are being roles only',
  [...accentSpread].every((r) => (LAND_BEING_ROLES as readonly string[]).includes(r)),
);
check(
  'every land role resolves to a reserved key by default',
  LAND_BEING_ROLES.every((r) => beingKeys.has(roleKey(theme, r, 'fgBright') as never)),
);
```

(`beingKeys`, `roleKey`, `theme` already exist earlier in this smoke.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-salience.mts`
Expected: FAIL — `beingAccentRole` is not exported.

- [ ] **Step 3: Implement the pure pick in beingIntents.ts**

In `src/terminal/beingIntents.ts`, add at the bottom:

```ts
// ── Being accents (ambient-salience bundle) ─────────────────────────────
// Land beings draw from the SAME reserved accent pool as the cell cohort
// (roles.ts BEING_ROLE_KEYS via the four being roles), picked
// deterministically by id hash — the brightest marks on a land are its
// creatures. Pure; terminalLand.ts + smoke-salience share it.

import type { ThemeRole } from '../themes/types';

export const LAND_BEING_ROLES = [
  'being.loki',
  'being.archivist',
  'being.cat',
  'being.visitor',
] as const satisfies readonly ThemeRole[];

/** FNV-1a over the id — local copy so this module stays dependency-light
 *  (terminalLand.ts keeps its own identical hash for seeds/phases). */
function accentHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function beingAccentRole(id: string): (typeof LAND_BEING_ROLES)[number] {
  return LAND_BEING_ROLES[accentHash(id) % LAND_BEING_ROLES.length];
}
```

(If `beingIntents.ts` already imports from `../themes/types`, merge into the existing import instead of adding a second one; move the `import type` to the top of the file with the other imports.)

- [ ] **Step 4: Wire it into addBeing**

In `src/terminal/terminalLand.ts`:
- Add to the `./beingIntents` import block: `beingAccentRole`.
- Add a new import: `import { roleKey } from '../themes/roles';`
- In `addBeing`, replace

```ts
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
```

with

```ts
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        // Reserved accent per being (ambient-salience bundle) — same pool
        // as the cell cohort, deterministic by id.
        fill: hexToInt(theme.palette[roleKey(theme, beingAccentRole(id), 'fgBright')]),
      },
```

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-salience.mts`
Expected: previous count + 4, all passing.

- [ ] **Step 6: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/beingIntents.ts src/terminal/terminalLand.ts scripts/smoke-salience.mts
git commit -m "feat(terminals): land beings wear reserved accents — deterministic per id"
```

---

### Task 3: Book-spine shelves — sub-cell strokes replace the flat ▓ (TDD)

Each `T_BOOKSHELF` cell currently draws one `▓` at `yellow` (tile bible) with a `fgBright` initial overlaid. Replace the slab with three `│` strokes at sub-cell offsets, tinted by a pure helper: stroke 0 always shelf-gold (identity), strokes 1–2 hash-picked from the quiet ramp; bookless shelves all-dim. The stroke pass runs AFTER the events-calendar moves so stocked/empty reads the final `slotToBook`.

**Files:**
- Modify: `src/procedural/tiles/library.ts` (pure `shelfStrokeTints` + `SHELF_STROKE_OFFSETS_PX`)
- Modify: `src/render/levels/cell.ts` (tile-loop skip; stroke pass; imports)
- Modify: `scripts/smoke-salience.mts` (assertions)

**Interfaces:**
- Produces: `export const SHELF_STROKE_OFFSETS_PX: readonly [-2, 0, 2]` · `export function shelfStrokeTints(hash: number, stocked: boolean): [PaletteKey, PaletteKey, PaletteKey]` (src/procedural/tiles/library.ts, where `PaletteKey` is the same key type the bible's `fgKey` field uses — import from `../../themes/types` if the file doesn't already carry it).
- Consumes: `fnv1a32(s: string): number` from `src/procedural/seed.ts`; `slotToBook: Map<string, BookGame>` and `layout.bookshelfSlots` (already in cell.ts).

- [ ] **Step 1: Write the failing smoke assertions**

Append to `scripts/smoke-salience.mts` before `report()`:

```ts
// book-spine strokes (ambient-salience bundle): deterministic, gold-
// guaranteed when stocked, all-dim when empty, never a reserved key
const { shelfStrokeTints, SHELF_STROKE_OFFSETS_PX } = await import('../src/procedural/tiles/library.ts');
let strokeDeterministic = true;
let strokeGold = true;
let strokeDim = true;
let strokeReserved = false;
for (let i = 0; i < 500; i++) {
  const h = (Math.imul(i, 0x9e3779b1) ^ 0x5eed) >>> 0;
  const stocked = shelfStrokeTints(h, true);
  const empty = shelfStrokeTints(h, false);
  if (JSON.stringify(stocked) !== JSON.stringify(shelfStrokeTints(h, true))) strokeDeterministic = false;
  if (!stocked.includes('yellow')) strokeGold = false;
  if (stocked.some((k) => beingKeys.has(k as never))) strokeReserved = true;
  if (!empty.every((k) => k === 'fgDim')) strokeDim = false;
}
check('shelf strokes deterministic', strokeDeterministic);
check('stocked shelves always carry a gold stroke', strokeGold);
check('bookless shelves read all-dim', strokeDim);
check('no stroke uses a reserved being key', !strokeReserved);
check('three sub-cell stroke offsets', SHELF_STROKE_OFFSETS_PX.length === 3);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-salience.mts`
Expected: FAIL — `shelfStrokeTints` is not exported.

- [ ] **Step 3: Implement the pure helper in the tile bible**

In `src/procedural/tiles/library.ts`, add at the bottom (importing `PaletteKey` from `../../themes/types` at the top if not already present):

```ts
// ── Book-spine strokes (ambient-salience bundle, programme #10) ─────────
// Shelf cells render as three sub-cell '│' strokes instead of one flat ▓
// — books, not slabs. Pure data here (the bible owns shelf display);
// src/render/levels/cell.ts draws it, smoke-salience locks it.

/** Sub-cell x-offsets (px at glyph scale 1) for the three strokes. The
 *  '│' glyph's bar sits ~centre of its 6px advance; these offsets fan the
 *  three bars across the cell. */
export const SHELF_STROKE_OFFSETS_PX = [-2, 0, 2] as const;

/** Stroke tints for one shelf cell. Stroke 0 is ALWAYS shelf-gold on a
 *  stocked shelf (the room keeps its warm identity at a glance); strokes
 *  1–2 pick from the quiet ramp by hash. Bookless shelves read all-dim
 *  (the programme's empty-shelf treatment). Never a reserved being key. */
export function shelfStrokeTints(
  hash: number,
  stocked: boolean,
): [PaletteKey, PaletteKey, PaletteKey] {
  if (!stocked) return ['fgDim', 'fgDim', 'fgDim'];
  const ramp: readonly PaletteKey[] = ['yellow', 'fg', 'fgDim'];
  return ['yellow', ramp[(hash >>> 4) % 3], ramp[(hash >>> 8) % 3]];
}
```

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-salience.mts`
Expected: previous count + 5, all passing.

- [ ] **Step 5: Wire the renderer**

In `src/render/levels/cell.ts`:

1. Add `fnv1a32` to the imports: `import { fnv1a32 } from '../../procedural/seed';` and add `shelfStrokeTints, SHELF_STROKE_OFFSETS_PX` to the existing `../../procedural/tiles/library` import block.

2. Immediately before the base-tile loop (`for (let y = 0; y < layout.height; y++) {`), declare:

```ts
  // Ambient-salience bundle (#10): shelf cells are composed as sub-cell
  // spine strokes AFTER the events-calendar moves land (the stroke read
  // needs the FINAL stocked/empty state) — the tile loop collects them
  // and draws nothing.
  const shelfCells: CellPoint[] = [];
```

3. In the tile loop, insert a branch between the `if (texture)` block and the glyph `else`:

```ts
      } else if (tileId === T_BOOKSHELF) {
        shelfCells.push({ x, y });
      } else {
```

4. After the `for (const move of movesToApply) { applyShelfMove(...) }` loop and BEFORE the spine-overlay pass, insert:

```ts
  // Ambient-salience bundle (#10): three '│' strokes per shelf cell at
  // ±1px height variance — books, not slabs. Deterministic per
  // (seed, cell) via fnv1a32; strokes join baseLayer (the ▓ slab's old
  // home, same Z under the spine initials).
  for (const cell of shelfCells) {
    const stocked = slotToBook.has(`${cell.x},${cell.y}`);
    const h = fnv1a32(`shelf:${seed}:${cell.x},${cell.y}`);
    const tints = shelfStrokeTints(h, stocked);
    for (let i = 0; i < 3; i++) {
      const stroke = new BitmapText({
        text: '│',
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          fill: hexToInt(theme.palette[tints[i]]),
        },
      });
      stroke.x = cell.x * COZETTE_CELL_WIDTH + SHELF_STROKE_OFFSETS_PX[i];
      stroke.y = cell.y * COZETTE_CELL_HEIGHT - ((h >>> (10 + i * 2)) % 2);
      baseLayer.addChild(stroke);
    }
  }
```

- [ ] **Step 6: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean (glyph-coverage green — `│` already ships via T_WALL_V).

- [ ] **Step 7: On-screen — the shelf wall reads as books**

```bash
bash scripts/e2e/run.sh
node scripts/e2e/drive.mjs shot /tmp/loki-bundle/cell-spines.png
```

Eyeball `/tmp/loki-bundle/cell-spines.png` against the pre-bundle baseline (`/tmp/loki-fidelity/leg-a-glyphs.png` if still present, else `docs/media/sprite-fidelity-comparison-2026-07-16.png` leg A): shelves read as vertical book rows with a warm gold presence; initials still the brightest step; unstocked shelves visibly dimmer; no stroke bleeding into a neighbouring wall cell. If strokes crowd or misalign, tune `SHELF_STROKE_OFFSETS_PX` (e.g. `[-2, 0, 2]` → `[-1, 1, 3]`) and re-capture — offsets are the one sanctioned tuning knob here.

- [ ] **Step 8: Commit**

```bash
git add src/procedural/tiles/library.ts src/render/levels/cell.ts scripts/smoke-salience.mts
git commit -m "feat(cell): book-spine shelves — three sub-cell strokes replace the flat slab (programme #10)"
```

---

### Task 4: Ambient ticker — seam caps breathe + trees sway

One new `ambientTick` ticker in `mountCell`, following the `pulseLandmark` contract exactly (deltaMS accumulation, teardown removal). Seam caps oscillate alpha on a ~4s sine; scatter `♠` foliage nudges ±0.5px on a ~1.6s square wave with per-instance FNV phase.

**Files:**
- Modify: `src/render/levels/cell.ts`

**Interfaces:**
- Produces: `ambientMs` accumulator + `ambientTick` ticker that Task 5 extends with wear stamping (names matter — Task 5 appends to this exact function).
- Consumes: `fnv1a32` (imported in Task 3); the seam-cap and scatter loops.

- [ ] **Step 1: Collect the animation handles**

In `src/render/levels/cell.ts`:

1. Immediately before the seam-caps loop (`const seamCapColour = ...`), declare:

```ts
  // Ambient-salience bundle (#9): handles for the idle registers.
  const seamCapSprites: BitmapText[] = [];
  const SWAY_PERIOD_MS = 1600;
  const swaySprites: Array<{ sprite: BitmapText; baseX: number; phaseMs: number }> = [];
```

2. In the seam-caps loop, after `wallLayer.addChild(capSprite);` add:

```ts
        seamCapSprites.push(capSprite);
```

3. In the scatter loop, after `scatterLayer.addChild(sprite);` add:

```ts
    // Foliage sways (#9): ♠ gets a 2-frame sub-pixel nudge; per-instance
    // phase from position hash so the room never moves in lockstep.
    if (item.glyph === '♠') {
      swaySprites.push({ sprite, baseX: sprite.x, phaseMs: fnv1a32(`sway:${item.x},${item.y}`) % SWAY_PERIOD_MS });
    }
```

- [ ] **Step 2: Add the ticker**

Immediately after the `app.ticker.add(pulseLandmark);` line, add:

```ts
  // Ambient-salience bundle (#9): the cell's idle registers. One ticker,
  // deltaMS-driven (freezes under paused/sleeping, no wall clock — the
  // pulseLandmark contract): seam caps breathe, foliage sways. Task 5 of
  // the bundle extends this with walk-wear stamping + decay.
  let ambientMs = 0;
  const BREATHE_PERIOD_MS = 4000;
  const ambientTick: TickerCallback<unknown> = () => {
    ambientMs += app.ticker.deltaMS;
    const bt = (ambientMs % BREATHE_PERIOD_MS) / BREATHE_PERIOD_MS;
    const breatheAlpha = 0.7 + 0.3 * (0.5 - 0.5 * Math.cos(bt * 2 * Math.PI));
    for (const cap of seamCapSprites) cap.alpha = breatheAlpha;
    for (const s of swaySprites) {
      const local = (ambientMs + s.phaseMs) % SWAY_PERIOD_MS;
      s.sprite.x = s.baseX + (local < SWAY_PERIOD_MS / 2 ? -0.5 : 0.5);
    }
  };
  app.ticker.add(ambientTick);
```

- [ ] **Step 3: Remove it at teardown**

In the `teardown` closure, next to `app.ticker.remove(pulseLandmark);` add:

```ts
      app.ticker.remove(ambientTick);
```

- [ ] **Step 4: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean.

- [ ] **Step 5: On-screen — the room is no longer pixel-frozen**

```bash
bash scripts/e2e/run.sh
node scripts/e2e/drive.mjs shot /tmp/loki-bundle/motion-1.png
sleep 2
node scripts/e2e/drive.mjs shot /tmp/loki-bundle/motion-2.png
python3 - <<'EOF'
from PIL import Image, ImageChops
a = Image.open('/tmp/loki-bundle/motion-1.png').convert('RGB')
b = Image.open('/tmp/loki-bundle/motion-2.png').convert('RGB')
diff = ImageChops.difference(a, b).getbbox()
print('differs:', diff is not None, diff)
assert diff is not None, 'frames byte-identical — ambient registers not moving'
EOF
```

Expected: `differs: True (...)`. Then eyeball `motion-1.png`: seam caps and trees look normal (no visible displacement artefacts — the sway is sub-pixel at scale 1 but visible after the container's integer fit upscale).

- [ ] **Step 6: Commit**

```bash
git add src/render/levels/cell.ts
git commit -m "feat(cell): ambient life — seam caps breathe, foliage sways (programme #9)"
```

---

### Task 5: Walk wear — floor brightens where beings actually walk

The cell cousin of the land's worn paths: a `wearLayer` overlay brightens the floor glyph one step wherever the player or an agent stands, decaying over ~8s. Capped at 64 live marks, oldest evicted. Volatile, pane-local, cleared with the mount.

**Files:**
- Modify: `src/render/levels/cell.ts`

**Interfaces:**
- Consumes: `ambientMs` + `ambientTick` from Task 4 (extends that function); `pos` (player), `listRuntimesIn(scope)` (already imported); `TILE_BY_ID`, `T_FLOOR` (already imported).
- Produces: nothing later tasks consume.

- [ ] **Step 1: Add the wear layer**

In the layer declarations, after `const baseLayer = new Container();` add:

```ts
  // Walk wear (#9): brightened floor glyphs where someone recently stood.
  // Above the floor text, below walls/spines/marks.
  const wearLayer = new Container();
```

and in the `container.addChild(...)` block, insert `container.addChild(wearLayer);` immediately after `container.addChild(baseLayer);`.

- [ ] **Step 2: Wear state + stamping**

Immediately before the `let ambientMs = 0;` line from Task 4, add:

```ts
  // Walk wear (#9): Map of "x,y" → live mark. Stamped every ambient tick
  // from the player + each present agent runtime; decays over
  // WEAR_FADE_MS; capped (oldest evicted) so churn stays bounded.
  const WEAR_FADE_MS = 8000;
  const WEAR_CAP = 64;
  const wearMarks = new Map<string, { sprite: BitmapText; stampedAtMs: number }>();
  const wearGlyph = TILE_BY_ID.get(T_FLOOR)?.glyph ?? '·';
  const wearFill = hexToInt(theme.palette.fg); // one step up from the floor's fgDim
  const stampWear = (x: number, y: number): void => {
    if (x < 0 || y < 0 || y >= layout.height || x >= layout.width) return;
    if (layout.tiles[y][x] !== T_FLOOR) return;
    const key = `${x},${y}`;
    const existing = wearMarks.get(key);
    if (existing) {
      existing.stampedAtMs = ambientMs;
      return;
    }
    if (wearMarks.size >= WEAR_CAP) {
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      for (const [k, v] of wearMarks) {
        if (v.stampedAtMs < oldestAt) {
          oldestAt = v.stampedAtMs;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        wearMarks.get(oldestKey)!.sprite.destroy();
        wearMarks.delete(oldestKey);
      }
    }
    const sprite = new BitmapText({
      text: wearGlyph,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: wearFill },
    });
    sprite.x = x * COZETTE_CELL_WIDTH;
    sprite.y = y * COZETTE_CELL_HEIGHT;
    wearLayer.addChild(sprite);
    wearMarks.set(key, { sprite, stampedAtMs: ambientMs });
  };
```

**Ordering note:** `stampWear` reads `ambientMs`, which is declared after it — that's fine (closure, called only from the ticker) — but if the typechecker objects to use-before-declare in your placement, declare `let ambientMs = 0;` above `stampWear` and delete Task 4's duplicate declaration.

- [ ] **Step 3: Stamp + decay inside ambientTick**

Append to the END of the `ambientTick` function body (after the sway loop):

```ts
    // Walk wear (#9): stamp whoever is standing, fade the trail.
    stampWear(pos.x, pos.y);
    for (const rt of listRuntimesIn(scope)) if (rt.present) stampWear(rt.x, rt.y);
    for (const [key, mark] of wearMarks) {
      const age = ambientMs - mark.stampedAtMs;
      if (age >= WEAR_FADE_MS) {
        mark.sprite.destroy();
        wearMarks.delete(key);
        continue;
      }
      mark.sprite.alpha = 0.9 * (1 - age / WEAR_FADE_MS);
    }
```

- [ ] **Step 4: Clear at teardown**

In the `teardown` closure, next to the ticker removals, add:

```ts
      wearMarks.clear(); // sprites die with container.destroy(children:true)
```

- [ ] **Step 5: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean.

- [ ] **Step 6: On-screen — the trail**

```bash
bash scripts/e2e/run.sh
node scripts/e2e/drive.mjs key d 6
node scripts/e2e/drive.mjs key s 3
node scripts/e2e/drive.mjs shot /tmp/loki-bundle/wear-trail.png
```

Eyeball `/tmp/loki-bundle/wear-trail.png`: a brightened floor trail behind the `@` along the walked path (brightest at the player, fading with distance/time); agents' own steps leave the same. Wait ~10s, re-shot, confirm the trail has faded.

- [ ] **Step 7: Commit**

```bash
git add src/render/levels/cell.ts
git commit -m "feat(cell): walk wear — floor brightens under footsteps and decays (programme #9)"
```

---

### Task 6: Whole-bundle verification + STATE.md

The spec's capture-judged success criteria, both surfaces, then the present-tense record.

**Files:**
- Modify: `STATE.md` (new top entry)
- Output: `/tmp/loki-bundle/*.png` captures; optionally copy the best land before/after pair into `docs/media/` if the diff is striking.

**Interfaces:**
- Consumes: everything above, landed.

- [ ] **Step 1: Cell criteria (harness)**

```bash
bash scripts/e2e/run.sh
node scripts/e2e/drive.mjs shot /tmp/loki-bundle/cell-after.png
```

Check against the spec: shelves read as book rows (§2 criteria), initials brightest, motion diff still passes (re-run Task 4 Step 5's two-shot diff).

- [ ] **Step 2: Land criteria (T0 harness)**

```bash
npm run dev > /tmp/loki-vite.log 2>&1 &   # if :5183 not already serving
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_TERMINALS_RESET=1 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-bundle-land.log 2>&1 & )
sleep 8
node scripts/e2e/t0-drive.mjs move t1 60 200
node scripts/e2e/t0-drive.mjs move t2 712 212      # snaps → joined
osascript -e 'tell application "System Events" to set frontmost of (first process whose name is "Electron") to true'
node scripts/e2e/t0-drive.mjs shot /tmp/loki-bundle/land-after.png
osascript -e 'tell application "Electron" to quit'
```

Eyeball `/tmp/loki-bundle/land-after.png` against `docs/demo/join-2-joined.png` (the pre-bundle state): grass reads as ground, not highlight; every being wears a clear accent (magenta/violet/orange/cyan) and is the brightest mark in its neighbourhood; labels/strata unchanged. Both windows agree.

- [ ] **Step 3: STATE.md entry**

Add a present-tense entry at the top of `STATE.md` (below the intro block, above the current top entry) summarising: bundle SHIPPED (spec+plan paths, commit range), the three moves (GROUND_DEMOTE + landRoleFill, beingAccentRole accents, shelf strokes via shelfStrokeTints, ambientTick breathe/sway/wear), which smokes grew (land-atmosphere +5, salience +9), and the on-screen evidence paths. Follow the existing entries' voice and density.

- [ ] **Step 4: Final sweep + commit**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add STATE.md
git commit -m "docs(state): ambient-salience bundle shipped — present-tense entry"
```

---

## Self-Review

**Spec coverage:** §1 land salience → Tasks 1 (ground demotion, smoke-locked) + 2 (being accents via the shared role pool, smoke-locked). §2 book-spines → Task 3 (pure tints in the bible + renderer stroke pass after the events moves; empty-shelf treatment; `│` needs no coverage change; offsets are the sanctioned tuning knob). §3 ambient life → Tasks 4 (breathe + sway on one deltaMS ticker) + 5 (wear overlay, capped, pane-volatile). Success criteria + harness legs → per-task on-screen steps + Task 6. Out-of-scope items from the spec: untouched by any task. ✓

**Placeholder scan:** every code step carries full code; the two tunables (demotion factor, stroke offsets) ship concrete values with an explicit tuning procedure. One deliberate judgment call is documented inline (Task 5 Step 2 ordering note). ✓

**Type consistency:** `GROUND_DEMOTE`/`landRoleFill` (Task 1) consumed only by land rendering + smoke; `beingAccentRole`/`LAND_BEING_ROLES` (Task 2) consumed by terminalLand + smoke; `shelfStrokeTints`/`SHELF_STROKE_OFFSETS_PX` (Task 3) consumed by cell.ts + smoke; `ambientMs`/`ambientTick` names shared between Tasks 4 and 5 (Task 5 appends to the same function; the use-before-declare note covers the one ordering risk). `PaletteKey` sourced from `src/themes/types` everywhere. ✓

**Risk notes:** the sway writes `sprite.x` fractionally — PixiJS renders sub-pixel positions fine and the fit-scale magnifies the nudge; if it blurs instead of steps on screen, snap the offset to ±1px in Task 4 Step 5 and re-capture. The stroke pass assumes `CellPoint` is imported in cell.ts (it is — used by `scatterAnchors`).

### Critical Files for Implementation

- /Users/henrydemontfort/code/projects/Lokilibrary/src/render/levels/land.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/render/levels/cell.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/terminal/terminalLand.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/terminal/beingIntents.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/procedural/tiles/library.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/scripts/smoke-salience.mts
- /Users/henrydemontfort/code/projects/Lokilibrary/scripts/smoke-land-atmosphere.mts
