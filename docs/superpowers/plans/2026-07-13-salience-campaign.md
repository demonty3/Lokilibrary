# Salience Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the glance test from "gold furniture" to "someone lives here": a semantic role layer gives beings reserved theme accents, `@` gets a cursor blink, apertures get one blue dialect, the HUD/marginalia/focus chrome get themed — plus the two confirmed rendering bugs.

**Architecture:** A `roles` layer resolves semantic roles to EXISTING palette keys (`src/themes/roles.ts`, uniform defaults, per-theme JSON override possible later — no JSON changes now). Consumers (cohort tint, `@`, seam caps, marginalia tick) go through `roleKey()`. Tile-bible/scatter re-keys enforce the reserved-accent rule, locked by a new smoke.

**Tech Stack:** TypeScript strict, PixiJS v8 BitmapText/Graphics, smokes via `npx tsx scripts/smoke-*.mts`, e2e via `scripts/e2e/run.sh` + `drive.mjs`.

## Global Constraints

- **One palette per scene is structural**: `roleKey` returns palette KEYS only; no hex anywhere new. Every changed glyph must be in the Cozette atlas (all pre-verified: `▤ ╔ ═ ╗ ╚ ╝ ║ ╫ ░`) and enumerated in the coverage smoke.
- **Final role table** (spec § 0, one correction from recon — the visitor was ALREADY cyan, so only two beings move): player `fgBright`+blink · loki `magenta` (unchanged) · archivist `blue→violet` · cat `yellow→orange` · visitor `cyan` (unchanged) · ghost `fgDim` (deliberate) · apertures (door/window/seam-caps) `blue` · quiet decor `fgDim`.
- **Reserved-accent rule**: no tile-bible or scatter entry may use `magenta`, `violet`, `orange`, or `cyan` (the being keys). Smoke-enforced.
- **Animation rails**: blink rides `app.ticker` deltaMS (freezes under throttle); never wall-clock; never `Math.random` in `src/procedural/`.
- Every task ends green (`npm run typecheck` + full `for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`), commits per task, `git push && git push origin claude/consolidation-pass:main`.
- Single-pane default renders byte-identical for anything not deliberately changed (focus alpha 1.0 when focused; blink only affects `@`'s fill).

---

### Task 1: The colour system — roles, re-keys, reserved-accent smoke

**Files:**
- Modify: `src/themes/types.ts`
- Create: `src/themes/roles.ts`
- Modify: `src/procedural/tiles/library.ts` (T_DOOR, T_TABLE), `src/procedural/scatter.ts` (`☼` lamp), `src/agents/cohort.ts` (archivist, cat)
- Modify: `src/render/agents/cohort.ts:198` (tint via roleKey)
- Modify: `scripts/smoke-glyph-coverage.mts` (add `▤`)
- Test: `scripts/smoke-salience.mts` (new)

**Interfaces:**
- Consumes: `ThemePalette`/`Theme` (types.ts), `TILES` (library bible), scatter bible export, `AgentDef.paletteKey`.
- Produces (later tasks rely on): `PaletteKey` (exported from types.ts), `ThemeRole`, `roleKey(theme: Theme, role: ThemeRole, fallback: PaletteKey): PaletteKey`, `BEING_ROLE_KEYS: readonly PaletteKey[]` (the reserved set) from `src/themes/roles.ts`.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-salience.mts`:

```ts
/**
 * Salience-campaign smoke — `npx tsx scripts/smoke-salience.mts`.
 * Locks the role layer (uniform defaults, per-theme override, fallback)
 * and the reserved-accent rule: no tile-bible or scatter entry may use a
 * being's palette key in ANY theme.
 */
import { makeChecker } from './lib/smoke.ts';

const { roleKey, ROLE_DEFAULTS, BEING_ROLE_KEYS } = await import('../src/themes/roles.ts');
const { getById, THEME_IDS } = await import('../src/themes/index.ts');
const { TILES } = await import('../src/procedural/tiles/library.ts');
const scatter = await import('../src/procedural/scatter.ts');

const { check, report } = makeChecker('smoke salience');

const theme = getById('solarized-dark');

// role resolution: defaults
check('player → fgBright', roleKey(theme, 'player', 'fg') === 'fgBright');
check('being.archivist → violet', roleKey(theme, 'being.archivist', 'blue') === 'violet');
check('being.cat → orange', roleKey(theme, 'being.cat', 'yellow') === 'orange');
check('being.visitor → cyan', roleKey(theme, 'being.visitor', 'cyan') === 'cyan');
check('being.ghost → fgDim (deliberate)', roleKey(theme, 'being.ghost', 'fgDim') === 'fgDim');
check('seam → blue', roleKey(theme, 'seam', 'blue') === 'blue');

// fallback: unknown role in defaults AND theme → fallback wins
check('fallback honoured', roleKey(theme, 'decor.quiet', 'bgAlt') === (ROLE_DEFAULTS['decor.quiet'] ?? 'bgAlt'));

// per-theme override: a theme carrying roles wins over defaults
const overridden = { ...theme, roles: { player: 'red' as const } };
check('theme override wins', roleKey(overridden, 'player', 'fgBright') === 'red');

// reserved-accent rule over the tile bible
const beingKeys = new Set(BEING_ROLE_KEYS);
const tileViolations = TILES.filter((t: { fgKey: string }) => beingKeys.has(t.fgKey as never)).map(
  (t: { id: number; fgKey: string }) => `tile ${t.id}:${t.fgKey}`,
);
check('no tile uses a being key', tileViolations.length === 0, tileViolations.join(', '));

// reserved-accent rule over the scatter bible — find the exported table
// (buildScatterTable or a raw array; adapt to the module's real export,
// smoke-glyph-coverage.mts already imports it — mirror that import).
const scatterEntries: Array<{ glyph: string; fgKey: string }> =
  (scatter as { SCATTER_BIBLE?: Array<{ glyph: string; fgKey: string }> }).SCATTER_BIBLE ??
  [];
check('scatter bible located', scatterEntries.length > 0, 'adapt the import to the real export name');
const scatterViolations = scatterEntries
  .filter((e) => beingKeys.has(e.fgKey as never))
  .map((e) => `${e.glyph}:${e.fgKey}`);
check('no scatter entry uses a being key', scatterViolations.length === 0, scatterViolations.join(', '));

// the tofu swap landed
const table = TILES.find((t: { glyph: string }) => t.glyph === '▤');
check('T_TABLE glyph is ▤ (not □)', table !== undefined && !TILES.some((t: { glyph: string }) => t.glyph === '□'));

report();
```

(Where the smoke says "adapt": open `scripts/smoke-glyph-coverage.mts` first — it already imports the scatter bible and `TILES`; copy its exact import names/shapes for both, and `THEME_IDS`/`getById` from how other smokes import the registry. The assertions are the contract; the import lines follow the codebase.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-salience.mts`
Expected: FAIL — `Cannot find module '../src/themes/roles.ts'`

- [ ] **Step 3: Types + roles module**

`src/themes/types.ts` — add after `ThemePalette`:

```ts
export type PaletteKey = keyof ThemePalette;

/** Salience campaign (spec 2026-07-13): semantic colour roles. A role
 *  resolves to an EXISTING palette key — never a new colour — so the
 *  one-palette rule stays structural. Themes may override per-role in
 *  their JSON via `roles`; src/themes/roles.ts carries the uniform
 *  defaults. */
export type ThemeRole =
  | 'player'
  | 'being.loki'
  | 'being.archivist'
  | 'being.cat'
  | 'being.visitor'
  | 'being.ghost'
  | 'seam'
  | 'decor.quiet';
```

and extend `Theme`:

```ts
export interface Theme {
  id: string;
  name: string;
  palette: ThemePalette;
  /** Optional per-theme role overrides (see ThemeRole). */
  roles?: Partial<Record<ThemeRole, PaletteKey>>;
}
```

Create `src/themes/roles.ts`:

```ts
/**
 * Semantic colour roles (salience campaign, spec 2026-07-13).
 *
 * The visual-programme's pixel-verified finding: beings rendered at or
 * below furniture salience in every theme (the Archivist was darker than
 * the floor in IBM-3270). The fix is structural: beings own reserved
 * accent keys no decor may use (smoke-salience enforces it), and every
 * being/player/seam tint resolves through roleKey().
 *
 * Resolution order: theme.roles override → ROLE_DEFAULTS → caller
 * fallback. Roles map to palette KEYS, never colours — the one-palette
 * rule stays intact by construction.
 */

import type { PaletteKey, Theme, ThemeRole } from './types';

export const ROLE_DEFAULTS: Partial<Record<ThemeRole, PaletteKey>> = {
  player: 'fgBright',
  'being.loki': 'magenta',
  'being.archivist': 'violet',
  'being.cat': 'orange',
  'being.visitor': 'cyan',
  // The ghost is DELIBERATELY barely-there — a documented exception to
  // the beings-are-loud rule, not an oversight.
  'being.ghost': 'fgDim',
  // Apertures: door + window + seam caps share one dialect. (The
  // panel's admired "north seam marker" was the window tile, already
  // blue.)
  seam: 'blue',
  'decor.quiet': 'fgDim',
};

/** The reserved being accents: no tile-bible or scatter entry may use
 *  these keys (smoke-enforced). fgDim is shared infrastructure (ghost's
 *  deliberate dimness), so it is NOT reserved. */
export const BEING_ROLE_KEYS: readonly PaletteKey[] = ['magenta', 'violet', 'orange', 'cyan'];

export function roleKey(theme: Theme, role: ThemeRole, fallback: PaletteKey): PaletteKey {
  return theme.roles?.[role] ?? ROLE_DEFAULTS[role] ?? fallback;
}
```

- [ ] **Step 4: Re-keys**

`src/procedural/tiles/library.ts`: `T_DOOR` `fgKey: 'orange'` → `fgKey: 'blue',` with the comment `// aperture dialect (door/window/seam caps share blue) — salience campaign`. `T_TABLE`: `glyph: '□'` → `glyph: '▤',` and `fgKey: 'violet'` → `fgKey: 'fgDim',` with `// ▤ (not □ — hollow squares read as tofu); quiet-decor tier`.

`src/procedural/scatter.ts`: the `☼` lamp entry `fgKey: 'orange'` → `fgKey: 'yellow'` (the cat owns orange now).

`src/agents/cohort.ts`: archivist `paletteKey: 'blue'` → `'violet'`; cat `paletteKey: 'yellow'` → `'orange'`. (loki/visitor/ghost unchanged.)

`src/render/agents/cohort.ts:198` — replace the fill with:

```ts
          fill: hexToInt(
            opts.theme.palette[
              roleKey(opts.theme, `being.${def.id}` as ThemeRole, def.paletteKey)
            ],
          ),
```

with imports `import { roleKey } from '../../themes/roles';` and `import type { ThemeRole } from '../../themes/types';` (adjust relative paths to the file's existing style). The `as ThemeRole` cast is safe: unknown ids fall through `ROLE_DEFAULTS[role] === undefined` to `def.paletteKey`.

`scripts/smoke-glyph-coverage.mts`: `▤` replaces/joins `□` wherever the bible enumeration or literals list carries it (the bible import may pick it up automatically — verify the smoke still passes and that `▤` is actually asserted).

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-salience.mts`
Expected: all assertions pass, none failed.

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green. WFC determinism note: glyph/fgKey changes don't touch tile ids, frequencies, or adjacency — layouts are byte-identical; if any layout smoke fails, STOP and report (something else changed).

```bash
git add src/themes/types.ts src/themes/roles.ts src/procedural/tiles/library.ts src/procedural/scatter.ts src/agents/cohort.ts src/render/agents/cohort.ts scripts/smoke-salience.mts scripts/smoke-glyph-coverage.mts
git commit -m "feat(salience): role layer + reserved being accents + aperture dialect

Semantic roles resolve to existing palette keys (roleKey; uniform
defaults, per-theme override). Beings own magenta/violet/orange/cyan —
smoke-enforced against the tile + scatter bibles. Door re-keys to the
blue aperture dialect (window's key); table loses its tofu □ for ▤ and
drops to the quiet tier; lamp moves off the cat's orange.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 2: Bug — ladder label double-draw

**Files:**
- Modify: `src/render/levels/district.ts`, `src/render/levels/island.ts`, `src/render/levels/continent.ts` (whichever carry the stamp-layer bug — the card STRING builders are clean; see below)
- Test: e2e visual (this bug has no headless assertion; Task 7's shots are the gate)

**Interfaces:** consumes nothing new; must not change any exported card-builder signature (island exports its card fn for smokes).

- [ ] **Step 1: Reproduce and locate**

The card string builders (`renderDistrictCard` etc.) produce clean lines — the corruption ("C0Viliza…", names overprinting `+` fields; pixel-confirmed in the visual programme) happens where card lines become BitmapTexts. Run `bash scripts/e2e/run.sh`, then `node scripts/e2e/drive.mjs level root district` + `shot /tmp/salience-labels-before.png`, same for island + continent. READ the shots to confirm the corruption, then locate the stamp sites: `rg -n "BitmapText|addChild" src/render/levels/district.ts src/render/levels/island.ts src/render/levels/continent.ts` and look for (a) any SECOND text draw at a card's position (an id, a marker, a YOU overlay) sharing the name row's cells, and (b) label text stamped over a dot-field without clearing.

- [ ] **Step 2: Fix — one text per cell row, cleared beneath**

Apply whichever of these matches what Step 1 found (both patterns, real code):

(a) If a separate id/marker BitmapText overlaps the name row: delete that draw entirely (ids are internal; the display shows name + count only).

(b) If a label stamps over a glyph field (continent's name over `+`): give the label an opaque backing rect, the caption pattern already in cell.ts:

```ts
    const labelBacking = new Graphics()
      .rect(labelX - 2, labelY - 1, labelWidthPx + 4, COZETTE_CELL_HEIGHT + 2)
      .fill({ color: hexToInt(theme.palette.bg) });
    container.addChild(labelBacking);
    container.addChild(labelText); // text draws after (above) its backing
```

(adapt variable names to the site; `labelWidthPx = label.length * COZETTE_CELL_WIDTH`).

- [ ] **Step 3: Verify on screen**

Rebuild + relaunch Chrome (`pkill -f loki-e2e-chrome-profile; bash scripts/e2e/run.sh` — the tab does NOT reload on rebuild), re-shot all three levels to `/tmp/salience-labels-after-{district,island,continent}.png`, READ them: every label legible, no overstrike, no id fragments. Kill the harness.

- [ ] **Step 4: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done` (island's exported card fn has smoke coverage — must stay green).

```bash
git add src/render/levels/district.ts src/render/levels/island.ts src/render/levels/continent.ts
git commit -m "fix(render): ladder labels — one text per row, cleared beneath

The double-draw corruption ('C0Viliza…', names overprinting dot
fields) came from the stamp layer, not the card builders. Ids no
longer render; field-overlapping labels get an opaque bg backing
(the caption pattern).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 3: The HUD becomes themed chrome

**Files:**
- Modify: `src/App.tsx` (theme state + `Hud`)

**Interfaces:** consumes `getById` (already imported in App.tsx) and the mount effect's `themeId`; `Hud` signature changes to `{ scale, theme }` — internal to App.tsx.

- [ ] **Step 1: Thread the active theme into React state**

In `App()`: add `const [activeTheme, setActiveTheme] = useState<Theme | null>(null);` (import `type Theme` from `./themes/types`). In the mount effect, right after `const themeId = e2eThemeOverrideId() ?? themeFromLore(writer);` add `setActiveTheme(getById(themeId));`. (The effect re-runs on `loreVersion` bumps — recolors re-thread automatically. PixiApp's internal profile-remount keeps its own theme; the HUD tracking the lore/e2e theme matches today's visible behaviour.)

- [ ] **Step 2: Retheme + diet the Hud**

Replace the `Hud` component (currently `App.tsx:392-415`, hard-coded `#cdd6f4`) with:

```tsx
function Hud({ scale, theme }: { scale: ScaleLevel; theme: Theme }) {
  const label = scale.replace(/_/g, ' ');
  const p = theme.palette;
  return (
    <div
      data-hud=""
      style={{
        position: 'fixed',
        top: 8,
        left: 12,
        font: '12px/1.4 ui-monospace, monospace',
        color: p.fg,
        background: `${p.bgAlt}eb`, // bgAlt at ~0.92 alpha (hex8)
        border: `1px solid ${p.fgDim}`,
        padding: '4px 8px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div>level: {label}</div>
      <div style={{ color: p.fgDim }}>
        [ zoom out · ] zoom in · wasd walk · e open shelf · | split · \ study · tab focus
      </div>
    </div>
  );
}
```

(The `steamid` line is deleted; `steamId` prop + its plumbing go with it — remove the now-unused prop threading. `textShadow` dropped: the opaque themed panel doesn't need it. Theme JSON colours are `#rrggbb`, so the `eb` suffix forms a valid 8-digit hex.)

Render site: `{activeTheme && <Hud scale={scale} theme={activeTheme} />}` (the HUD appears once the palace mounts — imperceptible).

- [ ] **Step 3: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add src/App.tsx
git commit -m "feat(salience): themed HUD chrome + content diet

Fill/ink/border derive from the active theme (bgAlt/fg/fgDim) instead
of hard-coded Catppuccin ink; the steamid debug line dies; the key
hints gain 'e open shelf' (the diegetic [E] prompt stays the
contextual half).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 4: `@` cursor blink + seam caps

**Files:**
- Modify: `src/render/levels/cell.ts`

**Interfaces:** consumes `roleKey` (Task 1); no new exports.

- [ ] **Step 1: `@` blink**

At the player sprite creation (`cell.ts:535` region, `fill: hexToInt(theme.palette.fgBright)`), switch to the role colour and add the blink ticker:

```ts
  const playerOn = hexToInt(theme.palette[roleKey(theme, 'player', 'fgBright')]);
  const playerOff = hexToInt(theme.palette.fgDim);
```

Create the player sprite with `fill: 0xffffff` and set
`playerSprite.tint = playerOn;` right after creation — the blink drives
`.tint` (guaranteed repaint path in PixiJS v8; mutating
`BitmapText.style.fill` per-frame is not). Then after the sprite is
added:

```ts
  // Salience: the cursor blink — the one idle animation the player
  // deserves. 800ms on / 250ms off, deltaMS-driven so it freezes cleanly
  // under the wallpaper throttle. Never fully invisible (off = fgDim).
  let blinkAcc = 0;
  let blinkOn = true;
  const BLINK_ON_MS = 800;
  const BLINK_OFF_MS = 250;
  const blinkPlayer = (): void => {
    blinkAcc += app.ticker.deltaMS;
    const limit = blinkOn ? BLINK_ON_MS : BLINK_OFF_MS;
    if (blinkAcc >= limit) {
      blinkAcc = 0;
      blinkOn = !blinkOn;
      playerSprite.tint = blinkOn ? playerOn : playerOff;
    }
  };
  app.ticker.add(blinkPlayer);
```

and in the teardown closure, next to the other ticker removals: `app.ticker.remove(blinkPlayer);`. Import `roleKey` from `../../themes/roles`.

- [ ] **Step 2: Seam caps**

After the tile paint loop (the `layout.tiles[y][x]` loop ending ~cell.ts:310), add cap glyphs beside every carved E/W opening — derived from the layout, no assumptions:

```ts
  // Salience: cap carved seam openings with the aperture dialect (the
  // window's ╫ in blue) so side gaps read as doorways, not broken walls.
  // Derived from the tiles: any floor cell on column 0 / width-1 is a
  // carved opening; the wall cells immediately above/below the opening
  // run get the cap.
  const seamCapColour = hexToInt(theme.palette[roleKey(theme, 'seam', 'blue')]);
  for (const col of [0, layout.width - 1]) {
    for (let y = 0; y < layout.height; y++) {
      const isOpen = layout.tiles[y][col] === T_FLOOR;
      const above = y > 0 ? layout.tiles[y - 1][col] : -1;
      const below = y < layout.height - 1 ? layout.tiles[y + 1][col] : -1;
      const capAbove = isOpen && above !== T_FLOOR && above !== -1;
      const capBelow = isOpen && below !== T_FLOOR && below !== -1;
      for (const [cap, cy] of [[capAbove, y - 1], [capBelow, y + 1]] as Array<[boolean, number]>) {
        if (!cap) continue;
        const capSprite = new BitmapText({
          text: '╫',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: seamCapColour },
        });
        capSprite.x = col * COZETTE_CELL_WIDTH;
        capSprite.y = cy * COZETTE_CELL_HEIGHT;
        tileLayer.addChild(capSprite);
      }
    }
  }
```

(`T_FLOOR` is already imported in cell.ts; `tileLayer` = whatever container the tile loop adds to — match its name. Caps draw OVER the wall glyph at that cell: intended, the aperture terminator replaces the plain wall visually. Single-pane rooms with solid E/W walls get zero caps — no visual change.)

- [ ] **Step 3: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done` (glyph smoke: `╫` is already enumerated via the window tile).

```bash
git add src/render/levels/cell.ts
git commit -m "feat(salience): @ cursor blink + seam-cap aperture terminators

The player gets the role colour and an 800/250ms deltaMS blink
(throttle-safe, never fully off). Carved E/W seam openings get ╫ caps
in the blue aperture dialect, derived from the layout tiles.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 5: Pane focus indicator (wall layer alpha)

**Files:**
- Modify: `src/render/levels/cell.ts`

**Interfaces:** consumes `useAppStore` (already imported: `focusedPaneId` lives there); no new exports.

- [ ] **Step 1: Split walls into their own layer**

In the tile paint loop, walls-and-frame tiles go to a new `wallLayer` (created next to the existing layers, added to the container in the same z-position as tiles today); everything else stays where it is:

```ts
  const wallLayer = new Container();
  // ...added immediately after (or in place of the wall half of) the tile layer
  const WALL_TILE_IDS = new Set([
    T_WALL_H, T_WALL_V, T_CORNER_TL, T_CORNER_TR, T_CORNER_BL, T_CORNER_BR,
    T_TEE, T_DOOR, T_WINDOW,
  ]);
```

and in the loop: `(WALL_TILE_IDS.has(tileId) ? wallLayer : tileLayer).addChild(tileSprite);`. (Import the `T_*` ids from the library bible — they're exported there; check exact names via the bible's constants. The Task 4 seam caps belong on `wallLayer` too — move their `addChild` accordingly.)

- [ ] **Step 2: Drive alpha from focus**

```ts
  // Salience: focused pane reads bright, unfocused recedes — pure alpha,
  // no new chrome. Single pane: always focused → alpha 1 → identical to
  // today.
  const applyFocusAlpha = (): void => {
    const focused = useAppStore.getState().focusedPaneId === paneId;
    wallLayer.alpha = focused ? 1.0 : 0.55;
  };
  applyFocusAlpha();
  const unsubFocus = useAppStore.subscribe(applyFocusAlpha);
```

Teardown: `unsubFocus();` next to the other unsubscribes. (Zustand's plain `subscribe` fires on every store change; the handler is two property reads — fine at store-change rate.)

- [ ] **Step 3: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add src/render/levels/cell.ts
git commit -m "feat(salience): pane focus via wall-layer alpha

Walls/frame/apertures split into wallLayer; focused pane 1.0,
unfocused 0.55, driven by a focusedPaneId subscription. Single-pane
default unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 6: Marginalia frame dialect

**Files:**
- Modify: `src/render/levels/cell.ts` (`captionFor`, caption mount block)
- Modify: `scripts/smoke-glyph-coverage.mts` (add `╔ ═ ╗ ╚ ╝ ║`)

**Interfaces:** consumes `roleKey`; `captionFor` stays private.

- [ ] **Step 1: Double-line frame**

In `captionFor`, swap the frame set: top `╔` + `═`-run + `╗`, sides `║`, bottom `╚` + `═`-run + `╝` (the word-wrap and hard-break logic stay byte-identical — only the six frame characters change).

- [ ] **Step 2: Shadow + Loki tick**

In the caption mount block (where `markCaptionBacking` + `markCaption` are created): add a shadow Graphics BEHIND the backing —

```ts
  const markCaptionShadow = new Graphics();
  captionLayer.addChild(markCaptionShadow); // added FIRST → renders under backing + text
```

and wherever the backing rect is (re)drawn/positioned, mirror it offset one cell right + down at 0.6 alpha in `bg`:

```ts
    markCaptionShadow
      .clear()
      .rect(bx + COZETTE_CELL_WIDTH, by + COZETTE_CELL_HEIGHT, bw, bh)
      .fill({ color: hexToInt(theme.palette.bg), alpha: 0.6 });
```

(`bx/by/bw/bh` = the backing's rect values — reuse the same locals.) Visibility toggles with the caption exactly like the backing.

Loki tick: a small BitmapText `'L·'` in `theme.palette[roleKey(theme, 'being.loki', 'magenta')]`, positioned at the frame's bottom-right corner cell (x = caption right edge − 2 glyph widths, y = caption bottom row), added to `captionLayer` last, shown/hidden with the caption. (The tick is Loki's signature on the reveal chrome; marks by other agents come later — today all findable notes are Loki-authored: calendar events + launch notes.)

- [ ] **Step 3: Glyph smoke**

Add the double-line set to the coverage smoke's renderer-literals with provenance: `{ glyphs: ['╔','═','╗','╚','╝','║'], from: 'src/render/levels/cell.ts captionFor (marginalia frame)' }` (matching the array's real entry shape).

- [ ] **Step 4: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add src/render/levels/cell.ts scripts/smoke-glyph-coverage.mts
git commit -m "feat(salience): marginalia notes get their own frame dialect

Double-line ╔═╗ frame + one-cell ░-alpha drop shadow + an 'L·' corner
tick in Loki's accent: found notes read as paper pinned over the
world, not engine chrome.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 7: e2e re-capture, controller eyeball, final review

**Files:** none (fixes fold back into owning tasks).

- [ ] **Step 1: Full mechanical sweep**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do echo "── $f"; npx tsx "$f" || break; done`
Expected: all green.

- [ ] **Step 2: After-matrix capture**

Fresh `bash scripts/e2e/run.sh`, then capture to `/tmp/loki-salience/`:
- all 6 themes (setTheme + sleep 4 + shot, as the visual pass did)
- blink pair: two shots of the default view ≥1s apart (`salience-blink-1.png`, `salience-blink-2.png`)
- split + a focus flip (`split vertical`, shot; `key Tab`, shot)
- caption (placeMark at player pos, shot)
- ladder: district/island/continent (already re-shot in Task 2 — re-verify against the final build)
Kill the harness after.

- [ ] **Step 3: Report for the controller's eyeball**

List every capture path with a one-line description of what YOU see, explicitly answering the panel's complaints: Is the cat findable against the gold field in every theme? Is the orange cross gone (blue aperture at the door)? Is the HUD themed on phosphor/ibm-3270? Do the blink pair differ in `@`'s colour? Does the split show focus? Does the note read as Loki's (frame + tick + shadow)? Are the ladder labels clean? The CONTROLLER makes the final call by reading the images — your descriptions are the index, not the verdict.
