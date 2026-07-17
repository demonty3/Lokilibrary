# Ladder Identity Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Theme the district/island/continent rungs (gold frames, warm ramp, agent letters, composed YOU marker), make home follow the pane's wing, fill the pane per the cell composition rule, and re-key MARK_STYLES through the role layer (ghost → dim-but-distinct `fg`).

**Architecture:** A pure tint-layer canvas (`tintPanel.ts`) generalizes the home-card carve-out — every glyph cell owned by exactly one named layer, one BitmapText per layer. Per-rung string composition moves into a pure, pixi-free `ladderCompose.ts` so the smoke pins it headlessly; the three level renderers become thin PIXI shells (compose → layer texts → fit). Presence flows from an extended `cellPaneScopes` registry (wing per scope) through a pure `presenceByDistrict`.

**Tech Stack:** PixiJS v8 BitmapText, TypeScript strict, tsx smokes (`scripts/lib/smoke.ts` makeChecker), e2e via `.claude/skills/launch-desktop-app`.

## Global Constraints

- Determinism: no `Math.random`/`Date.now` anywhere touched; same inputs → same panels.
- One palette per scene; accents are palette KEYS resolved via `roleKey` or literal `ThemePalette` keys — never hex.
- Ladder rungs stay read-only: no ticker, no keydown (must render under `paused`/`sleeping`).
- No new glyphs outside the covered vocabulary (YOU is ASCII; letters L A c V G already render in cell) — `smoke-glyph-coverage` must stay green.
- Reserved being accents (smoke-salience): `BEING_ROLE_KEYS` value must stay `['magenta','violet','orange','cyan']`.
- Every task ends: `npx tsx scripts/smoke-ladder-identity.mts` green + `npm run typecheck` green (both legs: root + desktop tsc where touched) + commit.
- Branch: all work on `claude/ladder-identity` off main.

---

### Task 0: Branch

- [ ] `git checkout -b claude/ladder-identity`

### Task 1: `tintPanel.ts` — pure tint-layer canvas + cell-rule fit math

**Files:**
- Create: `src/render/levels/tintPanel.ts`
- Test: `scripts/smoke-ladder-identity.mts` (new)

**Interfaces (Produces):**
```ts
export interface TintCanvas { cols: number; rows: number; glyphs: string[][]; owner: string[][] }
export function createCanvas(cols: number, rows: number, baseLayer: string): TintCanvas
export function stamp(c: TintCanvas, x: number, y: number, text: string, layer: string): void
export function stampLines(c: TintCanvas, x: number, y: number, lines: readonly string[], layer: string): void
export function layerStrings(c: TintCanvas): Map<string, string>
export interface FitResult { scale: number; x: number; y: number }
export function fitGrid(panelW: number, panelH: number, rect: { pw: number; ph: number }): FitResult
```

- [ ] **Step 1: failing smoke.** Create `scripts/smoke-ladder-identity.mts`:

```ts
/**
 * Ladder identity smoke — `npx tsx scripts/smoke-ladder-identity.mts`.
 * Pins the pure layer-composition + fit + presence + home-resolution +
 * mark-re-key logic behind the themed scale-ladder rungs
 * (spec docs/superpowers/specs/2026-07-17-ladder-identity-design.md).
 */
import { makeChecker } from './lib/smoke.ts';
import {
  createCanvas, stamp, stampLines, layerStrings, fitGrid,
} from '../src/render/levels/tintPanel.ts';

const { check, report } = makeChecker('smoke ladder-identity');

// T1 — canvas: base layer owns everything; stamp moves ownership.
{
  const c = createCanvas(6, 2, 'base');
  stamp(c, 1, 0, '┌──┐', 'gold');
  stamp(c, 2, 0, 'YO', 'you'); // overwrites two gold cells
  const layers = layerStrings(c);
  const gold = layers.get('gold')!.split('\n');
  const you = layers.get('you')!.split('\n');
  const base = layers.get('base')!.split('\n');
  check('T1 gold keeps non-stolen cells', gold[0] === ' ┌  ┐ ');
  check('T1 you owns stolen cells', you[0] === '  YO  ');
  check('T1 base filled elsewhere', base[1] === '      ');
  // Disjoint union: per cell exactly one non-space owner across layers.
  let disjoint = true;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 6; x++) {
    const owners = [...layers.values()].filter((s) => s.split('\n')[y][x] !== ' ').length;
    const glyph = c.glyphs[y][x];
    if (glyph !== ' ' && owners !== 1) disjoint = false;
    if (glyph === ' ' && owners !== 0) disjoint = false;
  }
  check('T1 layers disjoint, union = canvas', disjoint);
}

// T2 — stampLines + all rows same width in every layer string.
{
  const c = createCanvas(4, 3, 'base');
  stampLines(c, 0, 1, ['ab', 'cd'], 'x');
  const s = layerStrings(c);
  check('T2 stampLines rows land', s.get('x')!.split('\n')[1] === 'ab  ' && s.get('x')!.split('\n')[2] === 'cd  ');
  check('T2 uniform row width', [...s.values()].every((t) => t.split('\n').every((r) => r.length === 4)));
}

// T3 — fitGrid = the cell room rule (integer, centred, min 1).
{
  const f = fitGrid(60, 26, { pw: 600, ph: 130 });
  check('T3 integer scale min(sx,sy)', f.scale === 5, `got ${f.scale}`);
  check('T3 centred', f.x === Math.floor((600 - 300) / 2) && f.y === 0);
  const tiny = fitGrid(600, 260, { pw: 100, ph: 100 });
  check('T3 floor at 1', tiny.scale === 1);
}

report();
```

- [ ] **Step 2: run — expect FAIL** (`Cannot find module .../tintPanel.ts`).
  `npx tsx scripts/smoke-ladder-identity.mts`

- [ ] **Step 3: implement** `src/render/levels/tintPanel.ts` (NO pixi imports — the smoke runs it in bare node):

```ts
/**
 * Tint-layer panel composition (ladder identity pass, spec 2026-07-17).
 *
 * The scale-ladder rungs need per-surface accents (gold frames, warm ramp,
 * being letters, a bright YOU) inside ONE composed character panel. The
 * prior pattern — a single-fill BitmapText plus a "carved out" second text
 * for the home card — generalizes here: a canvas where every glyph cell is
 * OWNED by exactly one named tint layer. `layerStrings` emits one
 * spaces-elsewhere string per layer; the renderer draws one BitmapText per
 * layer at a shared origin, so no cell is ever double-drawn (the ladder
 * overstrike bug can't come back by construction).
 *
 * Pure string/number logic only — no pixi import, so the smoke pins it
 * headlessly (same contract as src/procedural).
 */

export interface TintCanvas {
  cols: number;
  rows: number;
  /** glyph per cell (' ' = empty) */
  glyphs: string[][];
  /** owning layer per cell */
  owner: string[][];
}

export function createCanvas(cols: number, rows: number, baseLayer: string): TintCanvas {
  return {
    cols,
    rows,
    glyphs: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' ')),
    owner: Array.from({ length: rows }, () => Array.from({ length: cols }, () => baseLayer)),
  };
}

/** Stamp one row of text; each stamped cell's ownership MOVES to `layer`
 *  (last write wins). Out-of-bounds cells are clipped, not thrown — a
 *  truncated label at a panel edge is a composition detail, not a crash. */
export function stamp(c: TintCanvas, x: number, y: number, text: string, layer: string): void {
  if (y < 0 || y >= c.rows) return;
  for (let i = 0; i < text.length; i++) {
    const cx = x + i;
    if (cx < 0 || cx >= c.cols) continue;
    c.glyphs[y][cx] = text[i];
    c.owner[y][cx] = layer;
  }
}

export function stampLines(c: TintCanvas, x: number, y: number, lines: readonly string[], layer: string): void {
  for (let r = 0; r < lines.length; r++) stamp(c, x, y + r, lines[r], layer);
}

/** One spaces-elsewhere multi-line string per layer that owns ≥1 non-space
 *  glyph. Every row in every string is exactly `cols` wide (BitmapText
 *  alignment depends on it). */
export function layerStrings(c: TintCanvas): Map<string, string> {
  const rows = new Map<string, string[][]>();
  for (let y = 0; y < c.rows; y++) {
    for (let x = 0; x < c.cols; x++) {
      const g = c.glyphs[y][x];
      if (g === ' ') continue;
      const layer = c.owner[y][x];
      let grid = rows.get(layer);
      if (!grid) {
        grid = Array.from({ length: c.rows }, () => Array.from({ length: c.cols }, () => ' '));
        rows.set(layer, grid);
      }
      grid[y][x] = g;
    }
  }
  const out = new Map<string, string>();
  for (const [layer, grid] of rows) out.set(layer, grid.map((r) => r.join('')).join('\n'));
  return out;
}

export interface FitResult { scale: number; x: number; y: number }

/** The cell room's composition rule (cell.ts fit): integer scale that fits
 *  BOTH dimensions, floored at 1, centred. Ladder panels now inhabit the
 *  pane like the room does instead of floating at 0.55×. */
export function fitGrid(panelW: number, panelH: number, rect: { pw: number; ph: number }): FitResult {
  const scale = Math.max(1, Math.min(Math.floor(rect.pw / Math.max(1, panelW)), Math.floor(rect.ph / Math.max(1, panelH))));
  return {
    scale,
    x: Math.floor((rect.pw - panelW * scale) / 2),
    y: Math.floor((rect.ph - panelH * scale) / 2),
  };
}
```

- [ ] **Step 4: run smoke — PASS.** `npx tsx scripts/smoke-ladder-identity.mts` → `[smoke ladder-identity] 8 assertions passed`
- [ ] **Step 5: typecheck + commit.** `npm run typecheck` → clean. `git add src/render/levels/tintPanel.ts scripts/smoke-ladder-identity.mts && git commit -m "feat(render): tint-layer panel canvas + cell-rule fit (ladder identity)"`

### Task 2: clusters home-resolution helpers

**Files:**
- Modify: `src/procedural/clusters.ts` (append after the existing flatten helpers)
- Test: extend `scripts/smoke-ladder-identity.mts`

**Interfaces (Produces):**
```ts
export function findContinentOf(tree: ClusterTree, districtId: string): Continent | null
export function homeDistrictId(tree: ClusterTree, homeWingId?: string): string | null
```

- [ ] **Step 1: failing smoke additions** (import `clusterLibrary, findContinentOf, homeDistrictId` from `../src/procedural/clusters.ts`; `SAMPLE_LIBRARY` from `../src/data/sampleLibrary.ts`):

```ts
// T4 — home resolution: bound wing wins; stale/absent falls back to canonical d0.
{
  const games = SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name }));
  const tree = clusterLibrary(games, 0xa11ce11);
  const first = tree.continents[0].islands[0].districts[0].id;
  const all = tree.continents.flatMap((c) => c.islands.flatMap((i) => i.districts.map((d) => d.id)));
  const other = all.find((id) => id !== first)!;
  check('T4 canonical fallback', homeDistrictId(tree) === first);
  check('T4 bound wing wins', homeDistrictId(tree, other) === other);
  check('T4 stale wing falls back', homeDistrictId(tree, 'd999') === first);
  check('T4 findContinentOf finds', findContinentOf(tree, other)!.islands.some((i) => i.districts.some((d) => d.id === other)));
  check('T4 findContinentOf null on stale', findContinentOf(tree, 'd999') === null);
  const empty = clusterLibrary([], 1);
  check('T4 empty tree → null home', homeDistrictId(empty) === null);
}
```

- [ ] **Step 2: run — FAIL** (`findContinentOf` not exported).
- [ ] **Step 3: implement** in `src/procedural/clusters.ts`:

```ts
/** Continent containing `districtId`, or null (stale id — the library
 *  shrank since a pane was bound). Ladder identity pass. */
export function findContinentOf(tree: ClusterTree, districtId: string): Continent | null {
  for (const c of tree.continents) {
    for (const i of c.islands) {
      if (i.districts.some((d) => d.id === districtId)) return c;
    }
  }
  return null;
}

/** The home district for a pane: its bound wing when it still resolves,
 *  else the canonical first district (the pre-pane-awareness behaviour),
 *  else null on an empty library. */
export function homeDistrictId(tree: ClusterTree, homeWingId?: string): string | null {
  const all = flattenDistricts(tree);
  if (all.length === 0) return null;
  if (homeWingId && all.some((d) => d.id === homeWingId)) return homeWingId;
  return all[0].id;
}
```

- [ ] **Step 4: run smoke — PASS** (14 assertions). Also `npx tsx scripts/smoke-7a-scale-ladder.mts` still green (73).
- [ ] **Step 5: typecheck + commit** `feat(procedural): findContinentOf + homeDistrictId (ladder pane-awareness)`

### Task 3: presence plumbing — wing-aware scope registry + pure presence map

**Files:**
- Modify: `src/state/cellPaneScopes.ts`
- Modify: `src/render/levels/cell.ts:300` (registration call) + its mount signature
- Modify: `src/render/PixiApp.ts` (thread `regionId` into `mountCell` call)
- Create: `src/render/levels/ladderPresence.ts`
- Test: extend `scripts/smoke-ladder-identity.mts`

**Interfaces (Produces):**
```ts
// cellPaneScopes.ts
export function registerCellPaneScope(scope: RuntimeScope, wingId?: string | null): () => void
export function listCellPaneWings(): Array<{ wingId: string | null; agentIds: string[] }>
// ladderPresence.ts
export function presenceByDistrict(
  homeId: string | null,
  live: ReadonlyArray<{ wingId: string | null; agentIds: readonly string[] }>,
  fallbackIds: readonly string[],
): ReadonlyMap<string, readonly string[]>
```

- [ ] **Step 1: failing smoke additions:**

```ts
import { presenceByDistrict } from '../src/render/levels/ladderPresence.ts';

// T5 — presence: live scopes map by wing (null wing = home); empty → cohort fallback on home.
{
  const live = [
    { wingId: null, agentIds: ['loki', 'cat'] },
    { wingId: 'd2', agentIds: ['visitor'] },
  ];
  const p = presenceByDistrict('d0', live, ['loki', 'archivist']);
  check('T5 null wing → home', (p.get('d0') ?? []).join(',') === 'loki,cat');
  check('T5 bound wing kept', (p.get('d2') ?? []).join(',') === 'visitor');
  const fb = presenceByDistrict('d0', [], ['loki', 'archivist']);
  check('T5 no live scopes → fallback on home', (fb.get('d0') ?? []).join(',') === 'loki,archivist');
  check('T5 null home → empty', presenceByDistrict(null, [], ['loki']).size === 0);
  const merged = presenceByDistrict('d0', [{ wingId: null, agentIds: ['loki'] }, { wingId: 'd0', agentIds: ['cat'] }], []);
  check('T5 same-district scopes merge', (merged.get('d0') ?? []).join(',') === 'loki,cat');
}
```

- [ ] **Step 2: run — FAIL.**
- [ ] **Step 3: implement.**

`src/render/levels/ladderPresence.ts`:

```ts
/**
 * Ladder presence (ladder identity pass, spec 2026-07-17) — which beings'
 * letters appear on which district card. Pure: consumed by the ladder
 * composition, fed by PixiApp from the live cell-pane registry.
 *
 * A whole-library pane (wingId null) counts as the HOME wing. When no cell
 * pane is live at all — the DEFAULT single-pane flow, where zooming out
 * unmounted the cell — the full (theme-filtered) cohort renders on home:
 * the roster spawns into root, so "they live at home" is true-enough, and
 * the map never goes lifeless. Presence is a mount-time snapshot by design
 * (the rungs are read-only and ticker-free).
 */
export function presenceByDistrict(
  homeId: string | null,
  live: ReadonlyArray<{ wingId: string | null; agentIds: readonly string[] }>,
  fallbackIds: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  if (homeId === null) return out;
  if (live.length === 0) {
    if (fallbackIds.length > 0) out.set(homeId, [...fallbackIds]);
    return out;
  }
  for (const entry of live) {
    const district = entry.wingId ?? homeId;
    const bucket = out.get(district) ?? [];
    bucket.push(...entry.agentIds);
    out.set(district, bucket);
  }
  return out;
}
```

`src/state/cellPaneScopes.ts` — replace the Set with a Map and add the wing snapshot (keep both existing exports' shapes):

```ts
import type { RuntimeScope } from './agentRuntime';
import { listRuntimesIn } from './agentRuntime';

const cellPaneScopes = new Map<RuntimeScope, string | null>();

/** Register a live cell pane's scope (wingId = the pane's bound region
 *  district, null for the whole-library pane). Returns an unregister fn. */
export function registerCellPaneScope(scope: RuntimeScope, wingId: string | null = null): () => void {
  cellPaneScopes.set(scope, wingId);
  return () => {
    cellPaneScopes.delete(scope);
  };
}

export function listCellPaneScopes(): RuntimeScope[] {
  return Array.from(cellPaneScopes.keys());
}

/** Ladder identity — presence snapshot: each live cell pane's wing + the
 *  agent ids currently in its scope. */
export function listCellPaneWings(): Array<{ wingId: string | null; agentIds: string[] }> {
  return Array.from(cellPaneScopes.entries()).map(([scope, wingId]) => ({
    wingId,
    agentIds: listRuntimesIn(scope).map((r) => r.id),
  }));
}
```

(Check `listRuntimesIn` returns runtimes with `.id` — it does, `AgentRuntimeState.id`; adjust to its actual return shape if it yields ids directly.)

`src/render/levels/cell.ts` — `mountCell` gains an optional `regionWingId: string | null = null` parameter (append after `isWholeLibraryPane`); the registration at line ~300 becomes:

```ts
const unregisterScope = registerCellPaneScope(scope, regionWingId);
```

`src/render/PixiApp.ts` `mountPaneLevel` cell branch — pass the wing (the resolved region's id, null for whole-library):

```ts
return mountCell(
  app, parent, rect, theme, layout, books, seed, memoryWriter, spriteAtlas,
  localModel, paneId, crossWiring, isWholeLibraryPane,
  isWholeLibraryPane ? null : regionId ?? null,
);
```

- [ ] **Step 4: run smoke — PASS** (19). Run the pane/runtime smokes: `npx tsx scripts/smoke-pane-runtime.mts` + `npx tsx scripts/smoke-7b-panes.mts` — green.
- [ ] **Step 5: typecheck + commit** `feat(state): wing-aware cell-pane registry + pure ladder presence`

### Task 4: `ladderCompose.ts` — pure per-rung composition (district + island + continent)

**Files:**
- Create: `src/render/levels/ladderCompose.ts`
- Test: extend `scripts/smoke-ladder-identity.mts`

**Interfaces (Produces):**
```ts
export const LAYER_KEYS: Record<'frame'|'name'|'dim'|'ramp'|'home'|`being.${string}`, never> // conceptual — layers are strings
// Layer names used: 'frame' 'name' 'dim' 'ramp' 'home' and per-being 'being.<id>'
export interface LadderIdentity {
  homeWingId?: string;
  presence?: ReadonlyMap<string, readonly string[]>;
}
export interface ComposedPanel { canvas: TintCanvas; cols: number; rows: number }
export interface ContinentLabelSpec { text: string; startCol: number; row: number; home: boolean }
export function composeDistrictPanel(games: readonly ClusterGame[], seed: number, identity?: LadderIdentity): ComposedPanel
export function composeIslandPanel(games: readonly ClusterGame[], seed: number, identity?: LadderIdentity): ComposedPanel
export function composeContinentPanel(games: readonly ClusterGame[], seed: number, identity?: LadderIdentity): { panel: ComposedPanel; labels: ContinentLabelSpec[] }
export const AGENT_LETTERS: ReadonlyMap<string, string> // id → glyph, from COHORT defs
```

Layer → palette mapping lives with the renderers (Task 5); composition only names layers. Card geometry stays CARD_W=11 / CARD_H=5; continent CELL_BLOCK=14; HEADER_ROWS=2; footer 1 row + 1 blank before it.

Composition rules (all three, per spec):
- Header row 0 (`name` layer): `district · wing d3 · 4 neighbourhoods · 8 games` (wing segment only when `homeWingId` resolves); island: `island · <continentId> · N neighbourhoods`; continent unchanged text.
- Borders `┌─┐│└┘` → `frame` layer; home card's ENTIRE card cells → `home` layer, and its top border reads `┌─ YOU ` + `─`… + `┐` (`'┌─ YOU '` then fill `─` to width). For CARD_W=11: `┌─ YOU ───┐`.
- Name row → `name`; count row → `dim`; ramp glyphs (`▓▒░` repeats) → `ramp`; ramp pad dots + empty-slot terrain dots + sea dots → `dim`; footer → `dim`.
- Agent letters: for each district card, letters = `presence.get(districtId)` mapped through `AGENT_LETTERS` (unknown ids skipped), stamped LEFT-ALIGNED into the fill row starting at col 1, each letter into its own `being.<id>` layer; the ramp fill then starts AFTER `letters.length + 1` cols (ramp run shortened to fit; dots pad as before). Home card letters still stamp their being layers (letters stay accented ON the bright card — beings outrank home).
- District home = `homeDistrictId(tree, identity?.homeWingId)`; centre card = home district (NOT blindly districts[0]): order the 3×3 as home-centre + remaining districts in canonical order around it.
- Island: continent shown = `findContinentOf(tree, homeId) ?? pickPrimaryContinent(...)`; home card = homeId's card.
- Continent: home continent = `findContinentOf(tree, homeId)?.id ?? continents[0].id`; home label text gains `YOU · ` prefix (before truncation budget — `truncateLabel(..., CELL_BLOCK)` still applies); land cells → `ramp` layer (glyph still the activity ramp), sea dots → `dim`. Labels returned as `ContinentLabelSpec[]` (drawn as backed BitmapTexts by the renderer, NOT canvas cells — they overprint the blob and need the bg backing; `home` flag picks bright/dim).
- `AGENT_LETTERS` built from `COHORT` defs: `new Map(COHORT.map((d) => [d.id, d.glyph]))`.

- [ ] **Step 1: failing smoke additions** (representative assertions):

```ts
import { composeDistrictPanel, composeIslandPanel, composeContinentPanel, AGENT_LETTERS } from '../src/render/levels/ladderCompose.ts';

// T6 — district composition: YOU in home border, gold frames, letters in being layers.
{
  const games = SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name }));
  const tree = clusterLibrary(games, 0xa11ce11);
  const all = tree.continents.flatMap((c) => c.islands.flatMap((i) => i.districts.map((d) => d.id)));
  const wing = all[all.length - 1];
  const presence = new Map([[wing, ['loki', 'cat'] as const]]);
  const { canvas } = composeDistrictPanel(games, 0xa11ce11, { homeWingId: wing, presence });
  const layers = layerStrings(canvas);
  check('T6 home layer carries YOU', (layers.get('home') ?? '').includes('YOU'));
  check('T6 frame layer has borders', (layers.get('frame') ?? '').includes('┌'));
  check('T6 loki letter in its being layer', (layers.get('being.loki') ?? '').includes('L'));
  check('T6 cat letter in its being layer', (layers.get('being.cat') ?? '').includes('c'));
  // Determinism: same inputs → byte-identical layer map.
  const again = layerStrings(composeDistrictPanel(games, 0xa11ce11, { homeWingId: wing, presence }).canvas);
  check('T6 deterministic', JSON.stringify([...layers]) === JSON.stringify([...again]));
  // No identity → canonical home, no letters, still composes.
  const bare = layerStrings(composeDistrictPanel(games, 0xa11ce11).canvas);
  check('T6 bare compose has home', (bare.get('home') ?? '').includes('YOU'));
  check('T6 bare compose no being layers', ![...bare.keys()].some((k) => k.startsWith('being.')));
}

// T7 — island + continent: home follows the wing across rungs.
{
  const games = SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name }));
  const tree = clusterLibrary(games, 0xa11ce11);
  const all = tree.continents.flatMap((c) => c.islands.flatMap((i) => i.districts.map((d) => d.id)));
  const wing = all[all.length - 1];
  const island = layerStrings(composeIslandPanel(games, 0xa11ce11, { homeWingId: wing }).canvas);
  check('T7 island home layer non-empty', (island.get('home') ?? '').includes('YOU'));
  const { labels } = composeContinentPanel(games, 0xa11ce11, { homeWingId: wing });
  check('T7 exactly one home continent label', labels.filter((l) => l.home).length === 1);
  check('T7 home label carries YOU ·', labels.find((l) => l.home)!.text.startsWith('YOU · ') || labels.find((l) => l.home)!.text.includes('YOU'));
  check('T7 labels stay inside CELL_BLOCK budget', labels.every((l) => l.text.length <= 14));
}

// T8 — AGENT_LETTERS mirrors COHORT glyphs.
check('T8 letters from defs', AGENT_LETTERS.get('loki') === 'L' && AGENT_LETTERS.get('cat') === 'c' && AGENT_LETTERS.get('ghost') === 'G');
```

- [ ] **Step 2: run — FAIL.**
- [ ] **Step 3: implement `ladderCompose.ts`.** Port the string-building bodies of `renderDistrictCard` / `renderIslandCard` / the continent glyph-grid loop out of the three renderers into this module, layered via `stamp`/`stampLines` per the rules above. NO pixi imports; imports allowed: `tintPanel.ts`, `../../procedural/clusters`, `../../agents/cohort` (COHORT — pure data), `island.ts`'s `pickPrimaryContinent` moves HERE (export it; island.ts re-imports). Empty library → a `ComposedPanel` containing the existing double-frame `no library loaded yet.` text in the `dim` layer (both island/continent; district keeps its dotted-terrain empties).
- [ ] **Step 4: run smoke — PASS** (~31). `smoke-7a-scale-ladder` + `smoke-glyph-coverage` still green.
- [ ] **Step 5: typecheck + commit** `feat(render): pure ladder panel composition — gold frames, warm ramp, YOU, being letters`

### Task 5: thin renderers — district/island/continent through the layer stack

**Files:**
- Modify: `src/render/levels/district.ts`, `src/render/levels/island.ts`, `src/render/levels/continent.ts`
- Modify: `src/render/PixiApp.ts:862-873` (ladder branches)

**Interfaces:**
- Consumes: `composeDistrictPanel/composeIslandPanel/composeContinentPanel`, `layerStrings`, `fitGrid`, `roleKey`, `listCellPaneWings`, `presenceByDistrict`, `homeDistrictId`, `filterByTheme`, `COHORT`.
- Produces: `mountDistrict/mountIsland/mountContinent(parent, rect, theme, games, seed, identity?: LadderIdentity)` — same teardown/refit contract.

Layer → tint resolution, shared helper in each renderer (or exported once from `tintPanel.ts` — put it there as `ladderLayerTint(theme, layer)`):

```ts
import { roleKey } from '../../themes/roles';
import type { Theme, ThemeRole, PaletteKey } from '../../themes/types';

/** Layer name → palette key for the ladder rungs (spec §2 table). */
export function ladderLayerTint(theme: Theme, layer: string): PaletteKey {
  if (layer === 'frame') return 'yellow';        // shelf-gold, the built/owned dialect
  if (layer === 'ramp') return 'orange';         // the warm accent
  if (layer === 'dim') return 'fgDim';
  if (layer === 'home') return roleKey(theme, 'player', 'fgBright');
  if (layer.startsWith('being.')) return roleKey(theme, layer as ThemeRole, 'fg');
  return 'fg';                                   // 'name', header, anything else
}
```

Each mount body becomes: compose → for each `[layer, text]` of `layerStrings(canvas)` create one `BitmapText` at (0,0) with `fill: hexToInt(theme.palette[ladderLayerTint(theme, layer)])` → `fit` closure applies `fitGrid(cols * COZETTE_CELL_WIDTH, rows * COZETTE_CELL_HEIGHT, rect)` to the container. Continent additionally draws its `ContinentLabelSpec[]` as today's backed label nodes (backing rect `bg`, text bright/dim by `home`), positioned `startCol * COZETTE_CELL_WIDTH / (row + HEADER_ROWS…)` exactly as the current `placeLabels` does (the clamp math now lives in composition, which returns final `startCol`). The old `makeFit`/`renderDistrictCard`/`renderIslandCard`/home-carve blocks are deleted (the orphans this change creates). `emptyPanel` moves behind composition (Task 4) — renderers keep no string literals beyond nothing.

PixiApp ladder branches build identity once:

```ts
if (level === 'district' || level === 'island' || level === 'continent') {
  const { clusterGames, seed } = snapshotLibraryState();
  const tree = clusterLibrary(clusterGames, seed);
  const homeId = homeDistrictId(tree, regionId ?? undefined);
  const fallbackIds = filterByTheme(COHORT, theme.id).map((d) => d.id);
  const identity: LadderIdentity = {
    homeWingId: homeId ?? undefined,
    presence: presenceByDistrict(homeId, listCellPaneWings(), fallbackIds),
  };
  if (level === 'district') return mountDistrict(parent, rect, theme, clusterGames, seed, identity);
  if (level === 'island') return mountIsland(parent, rect, theme, clusterGames, seed, identity);
  return mountContinent(parent, rect, theme, clusterGames, seed, identity);
}
```

- [ ] **Step 1:** rewrite the three renderers + PixiApp branches as above.
- [ ] **Step 2:** full smoke sweep (`for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`) — ALL green (glyph-coverage guards the composed literals; if `YOU` or any moved literal trips RENDERER_LITERALS, update that smoke's literal list to point at ladderCompose.ts).
- [ ] **Step 3:** `npm run typecheck` both legs.
- [ ] **Step 4: commit** `feat(render): ladder rungs render through tint layers — themed, pane-aware, inhabited`

### Task 6: MARK_STYLES re-key + `mark.ghost` role + derived BEING_ROLE_KEYS

**Files:**
- Modify: `src/themes/types.ts` (ThemeRole union), `src/themes/roles.ts`, `src/render/levels/cell.ts:74-85,620-637`
- Test: extend `scripts/smoke-ladder-identity.mts`

- [ ] **Step 1: failing smoke additions:**

```ts
import { ROLE_DEFAULTS, BEING_ROLE_KEYS, roleKey } from '../src/themes/roles.ts';

// T9 — mark re-key: ghost is the dim-but-distinct step; being keys derived.
{
  check('T9 mark.ghost default fg', ROLE_DEFAULTS['mark.ghost'] === 'fg');
  check('T9 being.ghost stays fgDim', ROLE_DEFAULTS['being.ghost'] === 'fgDim');
  check('T9 BEING_ROLE_KEYS derived value unchanged',
    JSON.stringify(BEING_ROLE_KEYS) === JSON.stringify(['magenta', 'violet', 'orange', 'cyan']));
}
```

- [ ] **Step 2: run — FAIL.**
- [ ] **Step 3: implement.**

`types.ts` ThemeRole union — add after `'being.ghost'`:
```ts
  | 'mark.ghost'
```

`roles.ts`:
```ts
  // Ghost MARKS are a dim-but-distinct step (Harry, 2026-07-17): no accent
  // hue (dim), one ramp step above both the ghost's fgDim body and the
  // fgDim floor dust it sits on (distinct). Per-theme overridable.
  'mark.ghost': 'fg',
```
and replace the hand-kept list:
```ts
/** The reserved being accents, DERIVED from ROLE_DEFAULTS (being.* entries
 *  minus the ghost's shared-infrastructure fgDim). Value is unchanged from
 *  the hand-kept list the salience campaign shipped. */
export const BEING_ROLE_KEYS: readonly PaletteKey[] = Object.entries(ROLE_DEFAULTS)
  .filter(([role, key]) => role.startsWith('being.') && key !== 'fgDim')
  .map(([, key]) => key as PaletteKey);
```

`cell.ts` MARK_STYLES (glyphs unchanged; tint through the role layer):
```ts
const MARK_STYLES: Record<string, { glyph: string; role: ThemeRole; fallback: PaletteKey }> = {
  loki: { glyph: '’', role: 'being.loki', fallback: 'magenta' },
  archivist: { glyph: '≡', role: 'being.archivist', fallback: 'violet' },
  cat: { glyph: '⌐', role: 'being.cat', fallback: 'orange' },
  ghost: { glyph: '°', role: 'mark.ghost', fallback: 'fg' },
  visitor: { glyph: ',', role: 'being.visitor', fallback: 'cyan' },
};
const DEFAULT_MARK_STYLE = { glyph: '·', role: 'being.loki' as ThemeRole, fallback: 'magenta' as PaletteKey };
```
and the draw site:
```ts
fill: hexToInt(theme.palette[roleKey(theme, style.role, style.fallback)]),
```
(add `roleKey` + `ThemeRole`/`PaletteKey` imports to cell.ts if absent).

- [ ] **Step 4: run — PASS** (~34). `npx tsx scripts/smoke-salience.mts` green (reservation + value lock).
- [ ] **Step 5: typecheck + commit** `feat(themes): marks wear their author's accent; ghost marks get the dim-but-distinct fg step`

### Task 7: full verification sweep

- [ ] **Step 1:** every smoke: `for f in scripts/smoke-*.mts; do echo "== $f"; npx tsx "$f" || break; done` — all green.
- [ ] **Step 2:** `npm run typecheck` (root) + `cd desktop && npx tsc --noEmit` — clean.
- [ ] **Step 3: commit** anything outstanding.

### Task 8: e2e screenshot-eyeball leg (mandatory)

Single-pane captures per memory protocol (split-pane capture caused a false finding; ibm-3270 hues surprise by design).

- [ ] **Step 1:** `bash .claude/skills/launch-desktop-app/scripts/launch.sh` then `node .claude/skills/launch-desktop-app/scripts/drive.mjs window` (the terminals-mode instance from Harry's test session must not be killed if still in use — use `LOKI_CDP_PORT=9223` for a parallel instance if :9222 is his).
- [ ] **Step 2:** captures (drive verbs; 2.2s settle built into `key`):
  - `key [ 1` → shot `/tmp/loki-ladder/district-solarized.png`
  - `key [ 1` → shot `island-solarized.png`; `key [ 1` → shot `continent-solarized.png`
  - `key ] 3` back to cell; `key r 1` (bind wing d0→d1) then `key [ 1` → shot `district-wing.png` — YOU must sit on the BOUND wing's card, header names the wing.
  - `eval "window.__loki.setTheme('ibm-3270')"` → re-shoot district.
  - marks: `eval` the `__loki` mark-injection hook (e2ePlaceMark) for ghost + cat at known floor cells in a cell view → shot `marks.png` — ghost `°` legible (fg) but dimmer than the cat's orange `⌐`.
- [ ] **Step 3: EYEBALL each capture** against the spec table: gold frames? orange ramp readable (cat letter not smearing into it — fallback: ramp `yellow`)? YOU composed into the border with no overstrike? letters on the right cards? panels FILL the pane (no floating-small)? continent land gold on dim sea, home label `YOU · `-prefixed, labels inside the panel?
- [ ] **Step 4:** fix-and-reshoot anything broken; commit fixes.

### Task 9: ship

- [ ] **Step 1:** STATE.md top entry (present tense, mirrors prior slices: what shipped, layer architecture, pane-awareness, mark re-key, verification evidence).
- [ ] **Step 2:** memory update (`visual-programme-status.md`: ladder identity SHIPPED; MARK_STYLES decision RESOLVED — ghost=fg; next arcs: #12 shade ramp, murals).
- [ ] **Step 3:** `git checkout main && git merge --no-ff claude/ladder-identity && git push origin main`.
