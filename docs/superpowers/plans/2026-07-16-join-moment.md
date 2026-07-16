# The Join Moment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When two snapping terminals join, the two side-on wings read as one continuous land — the ground flows across the seam, no window chrome interrupts it, and the join has a "fuse" beat.

**Architecture:** Extend the existing `cell.ts` shared-seed seam pattern to the land horizon. A pure `landSeamBoundary(seedA, seedB)` folds both wing seeds into one boundary height+slope (symmetric, so each window computes it identically at snap); `composeLand` ramps a joined edge's last 6 columns to that boundary (Hermite, slope-matched). The broker tells each terminal its neighbour's wing; the renderer recomposes the joined edge on a topology change. Frameless windows close the chrome gap; a one-shot ticker-driven knit sweep is the juice.

**Tech Stack:** TypeScript, PixiJS v8 (BitmapText), Electron (main-process broker + preload IPC), `tsx` smokes via `scripts/lib/smoke.ts`.

## Global Constraints

- **Determinism in `src/procedural/`:** no `Math.random` / `Date.now`. All randomness through `mulberry32` / `fnv1a32`. Same inputs → same output. (`landSeamBoundary` is pure; `composeLand`'s main `rng` sequence must not change on the no-join path.)
- **No-join byte-identity:** `composeLand` with `opts.join` absent (or `{}`) must be byte-identical to today — the single-window / outer-edge / web-preview path never changes.
- **Animation is ticker-driven:** all motion off `app.ticker.deltaMS` — never a wall clock — so it freezes cleanly under throttle (the `@`-blink / landmark-pulse precedent).
- **Scope rail:** only the frameless-window slice of PRD-T1 is in scope. No terminal registry refactor, persistence, tray, or A–B–C chain UX (the ramp handles both edges if a chain ever forms, but chains aren't a deliverable here).
- **Verification floor:** typecheck **both legs** (repo root + `desktop/`) + the full existing smoke sweep green, per task.
- **Reserved determinism salts** (pick a new one distinct from all): cell `0xce11` · scatter `0x5ca7` · loki `0x10ce` · landmark `0x1a4d` · clusters `0xc1a5`/`0xc0a5` · cell-seam `0x5ea3`.

---

### Task 1: Procedural seam boundary + edge ramp

The substance: a shared boundary both wings agree on, and a slope-matched ramp to it in `composeLand`. Pure — fully TDD'd by a headless smoke.

**Files:**
- Modify: `src/procedural/land.ts` (imports; new `LAND_SEAM_SALT`, `SEAM_BLEND_COLS`, `hermite`, `landSeamBoundary`; `ComposeLandOptions.join`; the `surfaceY` block; structure-free buffer guards)
- Create: `scripts/smoke-land-seam.mts`

**Interfaces:**
- Produces: `export function landSeamBoundary(seedA: number, seedB: number): { height: number; slope: number }` · `ComposeLandOptions.join?: { readonly left?: number; readonly right?: number }` (neighbour wing seed per joined edge).
- Consumes: `fnv1a32` from `src/procedural/seed.ts`; `mulberry32` (already imported).

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-land-seam.mts`:

```ts
/**
 * Join-moment smoke — `npx tsx scripts/smoke-land-seam.mts`.
 * Locks the pure seam-continuity math (src/procedural/land.ts):
 *   - landSeamBoundary is symmetric + deterministic
 *   - two joined wings agree on the seam surface row
 *   - the K-column blend buffer is structure-free
 *   - no-join / empty-join composeLand is byte-identical
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, landSeamBoundary, SAMPLE_LAND } from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke land-seam');

// Wing seeds à la terminalLand (fnv1a('terminal:'+wing)); inline copy.
const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const seedA = fnv('terminal:d0');
const seedB = fnv('terminal:d1');

// 1 · symmetric + deterministic
const b1 = landSeamBoundary(seedA, seedB);
const b2 = landSeamBoundary(seedB, seedA);
check('landSeamBoundary symmetric', b1.height === b2.height && b1.slope === b2.slope);
check('landSeamBoundary deterministic', JSON.stringify(landSeamBoundary(seedA, seedB)) === JSON.stringify(b1));

// 2 · joined wings agree at the shared seam column (equal dims → equal groundLine)
const dims = { width: 60, skyH: 6, surfaceBand: 4, underH: 10, withPlayer: false } as const;
const wingA = composeLand(seedA, SAMPLE_LAND.slice(0, 5), { ...dims, join: { right: seedB } });
const wingB = composeLand(seedB, SAMPLE_LAND.slice(1, 6), { ...dims, join: { left: seedA } });
check('seam surface rows match', wingA.surface[wingA.width - 1] === wingB.surface[0],
  `A=${wingA.surface[wingA.width - 1]} B=${wingB.surface[0]}`);

// 3 · blend buffer is structure-free (no structure role in the K right-edge cols)
const K = 6;
const STRUCTURE_ROLES = new Set(['monument', 'roof', 'shelf', 'cottage', 'foliage', 'label']);
let clean = true;
for (let y = 0; y < wingA.height; y++)
  for (let x = wingA.width - K; x < wingA.width; x++)
    if (STRUCTURE_ROLES.has(wingA.role[y][x])) clean = false;
check('right-edge blend buffer is structure-free', clean);

// 4 · no-join / empty-join byte-identity
const plain = composeLand(seedA, SAMPLE_LAND.slice(0, 5), dims);
check('no-join deterministic', JSON.stringify(composeLand(seedA, SAMPLE_LAND.slice(0, 5), dims)) === JSON.stringify(plain));
check('empty join === no-join (byte-identical)',
  JSON.stringify(composeLand(seedA, SAMPLE_LAND.slice(0, 5), { ...dims, join: {} })) === JSON.stringify(plain));

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-seam.mts`
Expected: FAIL — `landSeamBoundary` is not exported yet (import error / `is not a function`).

- [ ] **Step 3: Add the boundary helpers + `join` option**

In `src/procedural/land.ts`, add the `seed.ts` import beside the existing prng import (top of file):

```ts
import { mulberry32 } from './prng';
import { fnv1a32 } from './seed';
```

Add constants + helpers just above `export function composeLand` (after `SAMPLE_LAND`):

```ts
/** PRNG namespace for the shared land-seam boundary — distinct from every
 *  other src/procedural salt (cell 0xce11 · scatter 0x5ca7 · loki 0x10ce ·
 *  landmark 0x1a4d · clusters 0xc1a5/0xc0a5 · cell-seam 0x5ea3). */
const LAND_SEAM_SALT = 0x5a11;
/** Columns over which a joined edge ramps to the shared seam height. */
const SEAM_BLEND_COLS = 6;

/** Cubic Hermite on t∈[0,1]: endpoint values p0,p1 and tangents m0,m1
 *  (already scaled to the [0,1] parameter interval). */
function hermite(t: number, p0: number, m0: number, p1: number, m1: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

/** The shared ground boundary two joined wings agree on. PURE + SYMMETRIC —
 *  landSeamBoundary(a,b) === landSeamBoundary(b,a) (canonical seed order), so
 *  each window computes the identical seam height + slope independently at
 *  snap, with no negotiation. Returned in RELIEF units (offset above the
 *  ground line, same ±2.4 scale as the surface sine field). */
export function landSeamBoundary(seedA: number, seedB: number): { height: number; slope: number } {
  const lo = Math.min(seedA >>> 0, seedB >>> 0);
  const hi = Math.max(seedA >>> 0, seedB >>> 0);
  const rng = mulberry32((fnv1a32(`${lo}:${hi}`) ^ LAND_SEAM_SALT) >>> 0);
  return {
    height: rng.rangeFloat(-1.8, 1.8), // within the surface-relief band
    slope: rng.rangeFloat(-0.5, 0.5),  // gentle tangent (relief units / column)
  };
}
```

Add the `join` field to `ComposeLandOptions` (after `hall?`):

```ts
  /** When terminal wings are JOINED, ramp the named edge(s)'s last
   *  SEAM_BLEND_COLS columns to a boundary height shared with the neighbour
   *  (its wing seed). Absent / {} = today's independent silhouette (single
   *  window / outer edges / web preview). Both edges may be set (a middle
   *  terminal in a chain); the two ramp regions never overlap. */
  readonly join?: { readonly left?: number; readonly right?: number };
```

- [ ] **Step 4: Replace the `surfaceY` block with the join-aware ramp**

In `composeLand`, replace the current horizon block (the `const phase = …` line through `const surfaceRows = …`):

```ts
  // Rolling horizon — deterministic height field (a touch more relief).
  const phase = rng.rangeFloat(0, 6.283);
  const baseRelief = (x: number): number =>
    1.6 * Math.sin(x * 0.09 + phase) + 0.8 * Math.sin(x * 0.21 + phase * 2);
  const baseSlope = (x: number): number =>
    0.144 * Math.cos(x * 0.09 + phase) + 0.168 * Math.cos(x * 0.21 + phase * 2);

  // Joined edges ramp to a boundary shared with the neighbour so the two
  // silhouettes meet at the same height + slope (Terrain-Diffusion's shared-
  // coordinate idea, folded from both wing seeds — see landSeamBoundary).
  const K = SEAM_BLEND_COLS;
  const rightJoin = opts.join?.right !== undefined ? landSeamBoundary(seed, opts.join.right) : null;
  const leftJoin = opts.join?.left !== undefined ? landSeamBoundary(seed, opts.join.left) : null;
  const reliefAt = (x: number): number => {
    if (rightJoin && x > cols - 1 - K) {
      const t = (x - (cols - 1 - K)) / K; // 0 at ramp start → 1 at the seam col
      return hermite(t, baseRelief(cols - 1 - K), baseSlope(cols - 1 - K) * K, rightJoin.height, rightJoin.slope * K);
    }
    if (leftJoin && x < K) {
      const t = x / K; // 0 at the seam col → 1 at ramp end
      return hermite(t, leftJoin.height, leftJoin.slope * K, baseRelief(K), baseSlope(K) * K);
    }
    return baseRelief(x);
  };
  const surfaceY = (x: number) => groundLine - Math.round(reliefAt(x));
  const surfaceRows: number[] = Array.from({ length: cols }, (_, x) => surfaceY(x));

  /** Suppress structures/labels in the blend columns so only ground + fill move. */
  const inJoinBuffer = (x: number): boolean =>
    (rightJoin !== null && x >= cols - 1 - K) || (leftJoin !== null && x <= K);
```

*(Note: at the seam column `hermite(1,…)` = the boundary value exactly, so both wings land on `groundLine - round(boundary.height)` — equal by construction. `hermite(0,…)` = the interior value, so it's C¹-continuous with the interior. The main `rng` is untouched — `landSeamBoundary` uses its own PRNG — so the no-join path stays byte-identical.)*

- [ ] **Step 5: Guard structures + foliage with the buffer**

In the `surface.forEach((p, i) => {…})` block, add the guard right after the two `hallSpan` early-returns (before the `if (p.state === 'mastered')`):

```ts
    if (inJoinBuffer(x)) return; // structure-free seam buffer
```

In the tree-foliage loop near the bottom (`for (let t = 0; t < 4; t++) {`), add after the `hallSpan` continue:

```ts
    if (inJoinBuffer(x)) continue; // no trees in the seam buffer
```

*(Both `x` values are drawn from `rng` before the guard, so skipping consumes no extra draws — determinism and no-join byte-identity hold.)*

- [ ] **Step 6: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-land-seam.mts`
Expected: `[smoke land-seam] 6 assertions passed`

- [ ] **Step 7: Typecheck + regression smokes**

Run: `npm run typecheck && npx tsx scripts/smoke-glyph-coverage.mts`
Expected: typecheck clean; glyph-coverage still passes (no new glyph introduced here).

- [ ] **Step 8: Commit**

```bash
git add src/procedural/land.ts scripts/smoke-land-seam.mts
git commit -m "feat(land): shared-seed seam boundary + slope-matched edge ramp"
```

---

### Task 2: Broadcast each terminal's neighbour wing

The renderer needs the neighbour's wing (to derive its seed) to compute the shared boundary. Extend the topology payload from `{joins}` to `{joins, wings}`. Type-only + broker change — verified by typecheck.

**Files:**
- Modify: `desktop/src/terminals.ts` (build a `wings` map; include it in the broadcast + the getTopology handler)
- Modify: `desktop/src/preload.ts` (topology type annotations)
- Modify: `src/api/electron.ts` (topology type signatures + fallbacks)

**Interfaces:**
- Produces: topology event/handler payload shape `{ joins: TerminalJoin[]; wings: Record<string, string> }` (terminalId → wing).

- [ ] **Step 1: Broker sends `wings`**

In `desktop/src/terminals.ts`, add a helper beside `allBounds()`:

```ts
function wingsMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const t of terminals.values()) if (!t.win.isDestroyed()) m[t.id] = t.wing;
  return m;
}
```

In `broadcastTopology()`, change the send line:

```ts
    if (!t.win.isDestroyed()) t.win.webContents.send('terminal:topology', { joins, wings: wingsMap() });
```

Change the hydration handler:

```ts
  ipcMain.handle('terminal:getTopology', () => ({ joins, wings: wingsMap() }));
```

- [ ] **Step 2: Preload passes the shape through (types only)**

In `desktop/src/preload.ts`, update the two topology type annotations (the impl already forwards the whole `event`, so `wings` flows through — only the types change). In the `ElectronAPI` interface:

```ts
  terminalGetTopology(): Promise<{ joins: TerminalJoin[]; wings: Record<string, string> }>;
  onTerminalTopology(cb: (event: { joins: TerminalJoin[]; wings: Record<string, string> }) => void): () => void;
```

In the implementation object:

```ts
  terminalGetTopology: () =>
    ipcRenderer.invoke('terminal:getTopology') as Promise<{ joins: TerminalJoin[]; wings: Record<string, string> }>,
  onTerminalTopology: (cb) => {
    const handler = (_e: IpcRendererEvent, event: { joins: TerminalJoin[]; wings: Record<string, string> }): void => cb(event);
    ipcRenderer.on('terminal:topology', handler);
    return () => ipcRenderer.off('terminal:topology', handler);
  },
```

- [ ] **Step 3: Client API types + fallbacks**

In `src/api/electron.ts`, update the `ElectronAPI` interface lines:

```ts
  terminalGetTopology(): Promise<{ joins: TerminalJoin[]; wings: Record<string, string> }>;
  onTerminalTopology(cb: (event: { joins: TerminalJoin[]; wings: Record<string, string> }) => void): () => void;
```

Update `getTerminalTopology` (return type + both `{ joins: [] }` fallbacks → include `wings: {}`):

```ts
export async function getTerminalTopology(): Promise<{ joins: TerminalJoin[]; wings: Record<string, string> }> {
  const api = getElectronAPI();
  if (!api || typeof api.terminalGetTopology !== 'function') return { joins: [], wings: {} };
  try {
    return await api.terminalGetTopology();
  } catch {
    return { joins: [], wings: {} };
  }
}
```

Update `subscribeTerminalTopology`'s callback type:

```ts
export function subscribeTerminalTopology(
  cb: (event: { joins: TerminalJoin[]; wings: Record<string, string> }) => void,
): () => void {
```

*(These new type params will make `terminalLand.ts` fail to typecheck until Task 3 updates `applyJoins` — expected; commit Task 2 and Task 3 keep the tree green at each task's end. If running tasks in isolation, do Step 4 of Task 3 in the same commit.)*

- [ ] **Step 4: Typecheck the desktop leg**

Run: `npm --prefix desktop run build`
Expected: `desktop/` typechecks clean (main + preload).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/terminals.ts desktop/src/preload.ts src/api/electron.ts
git commit -m "feat(terminals): broadcast neighbour wing in the topology payload"
```

---

### Task 3: Recompose the joined edge in the terminal renderer

Wire the boundary into the live renderer: restructure so the land scene is a swappable child, and recompose it (with `opts.join`) whenever the join set changes.

**Files:**
- Modify: `src/terminal/terminalLand.ts` (persistent transform container + swappable `sceneContainer`; `let model`; `recompose`; `applyJoins(joins, wings)`)

**Interfaces:**
- Consumes: `landSeamBoundary` indirectly (via `composeLand`'s `join` option, Task 1); the `{joins, wings}` topology payload (Task 2).
- Produces: (internal) `recompose(join | null)`.

- [ ] **Step 1: Make the land scene a swappable child**

In `mountTerminalLand`, replace the current compose+build block (`const model = composeLand(…)` through `app.stage.addChild(world);`) with:

```ts
  const composeOpts = { width: cols, skyH, surfaceBand: SURFACE_BAND, underH: UNDER_H, withPlayer: false };
  let model = composeLand(seed, games, composeOpts);

  // Persistent transform container; the land SCENE is a swappable child so a
  // join can recompose the terrain without disturbing beings / edges / sparks.
  const world = new Container();
  world.scale.set(WORLD_SCALE);
  app.stage.addChild(world);

  let scene = buildLandContainer(theme, model);
  let sceneContainer = scene.container;
  let contentH = scene.contentH;
  world.addChildAt(sceneContainer, 0);

  const layoutWorld = (): void => {
    world.x = Math.floor((app.screen.width - model.width * CW * WORLD_SCALE) / 2);
    world.y = app.screen.height - contentH * WORLD_SCALE;
  };
  layoutWorld();

  const recompose = (join: { left?: number; right?: number } | null): void => {
    model = composeLand(seed, games, join ? { ...composeOpts, join } : composeOpts);
    world.removeChild(sceneContainer);
    sceneContainer.destroy({ children: true });
    scene = buildLandContainer(theme, model);
    sceneContainer = scene.container;
    contentH = scene.contentH;
    world.addChildAt(sceneContainer, 0);
    layoutWorld();
  };
```

*(`edgeLayer`, beings, and sparks are still `world.addChild(...)` — they're added after `sceneContainer` so they render above it, and they survive a recompose because only `sceneContainer` is swapped. `model` is now `let`, so the `surfaceLocalY` / `drawEdges` closures read the recomposed surface.)*

- [ ] **Step 2: Recompose in `applyJoins`, threading `wings`**

Replace the `applyJoins` function with:

```ts
  let joinKey = '';
  const applyJoins = (joins: TerminalJoin[], wings: Record<string, string>): void => {
    edges = {
      left: joins.some((j) => j.right === terminalId),
      right: joins.some((j) => j.left === terminalId),
    };
    const leftNb = joins.find((j) => j.right === terminalId)?.left;
    const rightNb = joins.find((j) => j.left === terminalId)?.right;
    const join: { left?: number; right?: number } = {};
    if (leftNb && wings[leftNb]) join.left = fnv1a(`terminal:${wings[leftNb]}`);
    if (rightNb && wings[rightNb]) join.right = fnv1a(`terminal:${wings[rightNb]}`);
    const key = `${join.left ?? ''}|${join.right ?? ''}`;
    if (key !== joinKey) {
      joinKey = key;
      recompose(join.left === undefined && join.right === undefined ? null : join);
    }
    drawEdges();
  };
```

- [ ] **Step 3: Thread `wings` from both callers**

Update the two `applyJoins` call sites near the broker wiring:

```ts
  const unsubTopology = subscribeTerminalTopology(({ joins, wings }) => applyJoins(joins, wings));
```

and

```ts
  void getTerminalTopology().then(({ joins, wings }) => applyJoins(joins, wings));
```

- [ ] **Step 4: Typecheck both legs + smokes**

Run: `npm run typecheck && npm --prefix desktop run build && npx tsx scripts/smoke-land-seam.mts`
Expected: both legs clean; smoke still `6 assertions passed`.

- [ ] **Step 5: On-screen verification (macOS)**

Launch two terminals and drive a snap:

```bash
npm run dev > /tmp/loki-vite.log 2>&1 &   # if not already serving
npm --prefix desktop run build
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-electron-t0.log 2>&1 & )
# windows boot already-abutting → joined; force a clean re-snap if needed:
node scripts/e2e/t0-drive.mjs move t2 700 160
osascript -e 'tell application "System Events" to set frontmost of (first process whose name is "Electron") to true'
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/after.png
```

Expected: at the seam, the **ground line is continuous** — no height jump between t1's right edge and t2's left edge (it will still show the window-chrome gap until Task 4). Eyeball `/tmp/loki-join/after.png`.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/terminalLand.ts
git commit -m "feat(terminals): recompose the joined edge to a shared seam boundary"
```

---

### Task 4: Frameless terminal windows + drag strip

Remove the chrome gap so Task 3's continuous ground is genuinely pixel-adjacent.

**Files:**
- Modify: `desktop/src/terminals.ts` (`frame: false`)
- Modify: `src/terminal/TerminalApp.tsx` (in-world drag strip)

- [ ] **Step 1: Make terminal windows frameless**

In `desktop/src/terminals.ts`, in the `new BrowserWindow({…})` options, change the `frame` line (and its comment):

```ts
      frame: false, // frameless: the ground continues across the join, no title bar gap
      titleBarStyle: 'hidden',
```

- [ ] **Step 2: Add the drag strip to the terminal shell**

Replace `src/terminal/TerminalApp.tsx` with (hoists `wing`/`terminalId`/`themeId` so the strip can label itself):

```tsx
import { useEffect, useRef, type CSSProperties } from 'react';
import { getById } from '../themes';
import { mountTerminalLand } from './terminalLand';

/** Terminals default to the phosphor palette; ?theme= overrides. */
const TERMINAL_THEME = 'phosphor';

const params = new URLSearchParams(window.location.search);
const TERMINAL_ID = params.get('terminal') ?? 't1';
const WING = params.get('wing') ?? 'd0';
const THEME_ID = params.get('theme') ?? TERMINAL_THEME;

/** Frameless windows need an explicit OS drag region. A thin glyph strip at
 *  the very top doubles as the title and the drag handle; the world (and any
 *  seam continuity) lives at the BOTTOM, untouched. */
const dragStrip = {
  position: 'fixed', top: 0, left: 0, right: 0, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  font: '12px monospace', letterSpacing: '2px', color: '#8a8a8a',
  background: 'rgba(0,0,0,0.35)', userSelect: 'none',
  WebkitAppRegion: 'drag',
} as unknown as CSSProperties;

export function TerminalApp() {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = `${WING} — ${TERMINAL_ID}`;
    let teardown: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      if (!host.current) return;
      const fn = await mountTerminalLand(host.current, getById(THEME_ID), TERMINAL_ID, WING);
      if (cancelled) fn();
      else teardown = fn;
    })();
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div style={dragStrip}>{`┤ ${WING} ├`}</div>
      <div ref={host} style={{ position: 'fixed', inset: 0 }} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck both legs**

Run: `npm run typecheck && npm --prefix desktop run build`
Expected: both clean.

- [ ] **Step 4: On-screen verification (macOS)**

Relaunch the two-terminal build (as in Task 3 Step 5). Expected:
- **No title bar / border** on either window — the two lands sit edge-to-edge with the **ground line continuous across the seam** (Task 3 + Task 4 together = the payoff).
- **Drag the top strip** with the mouse → the window moves; release near the neighbour → it snaps and the edges stay open.
- Capture `/tmp/loki-join/frameless.png` and eyeball the seam.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/terminals.ts src/terminal/TerminalApp.tsx
git commit -m "feat(terminals): frameless windows + in-world drag strip"
```

---

### Task 5: The knit-sweep fuse juice

A one-shot glow that runs across the seam on a newly-opened edge, so the join reads as worlds fusing.

**Files:**
- Modify: `src/terminal/terminalLand.ts` (knit-sweep state, `startKnit`, tick animation, fire on newly-opened edge)

- [ ] **Step 1: Add knit-sweep state + spawner**

In `terminalLand.ts`, add a duration constant beside the crossing-juice knobs:

```ts
/** Knit-sweep: a one-shot glow that runs across a newly-joined seam. */
const KNIT_S = 0.6;
const KNIT_SPAN = 6; // columns the sweep travels inward from the seam
```

Beside the `sparks` array, add:

```ts
  const knits: Array<{ side: 'left' | 'right'; bornAt: number; text: BitmapText }> = [];
```

After `spawnSpark`, add the spawner (reads the recomposed `model.surface`, so it rides the now-continuous ground):

```ts
  const startKnit = (side: 'left' | 'right'): void => {
    const edgeCol = side === 'left' ? 0 : model.width - 1;
    const text = new BitmapText({
      text: '█',
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
    });
    text.x = edgeCol * CW;
    text.y = (model.surface[edgeCol] - 1) * CH;
    world.addChild(text);
    knits.push({ side, bornAt: elapsedS, text });
  };
```

- [ ] **Step 2: Animate the sweep in `tick`**

In `tick()`, right after the crossing-sparks fade loop, add:

```ts
    // Knit sweeps run inward from the seam along the (continuous) ground, fading.
    for (let i = knits.length - 1; i >= 0; i--) {
      const k = knits[i];
      const p = (elapsedS - k.bornAt) / KNIT_S;
      if (p >= 1) {
        k.text.destroy();
        knits.splice(i, 1);
        continue;
      }
      const col =
        k.side === 'left'
          ? Math.min(model.width - 1, Math.round(p * KNIT_SPAN))
          : Math.max(0, model.width - 1 - Math.round(p * KNIT_SPAN));
      k.text.x = col * CW;
      k.text.y = (model.surface[col] - 1) * CH;
      k.text.alpha = 1 - p;
    }
```

- [ ] **Step 3: Fire on a newly-opened edge**

In `applyJoins` (Task 3), capture the previous edges and fire the sweep inside the recompose branch. Replace the `applyJoins` body's edge assignment + recompose block with:

```ts
    const prev = edges;
    edges = {
      left: joins.some((j) => j.right === terminalId),
      right: joins.some((j) => j.left === terminalId),
    };
    const leftNb = joins.find((j) => j.right === terminalId)?.left;
    const rightNb = joins.find((j) => j.left === terminalId)?.right;
    const join: { left?: number; right?: number } = {};
    if (leftNb && wings[leftNb]) join.left = fnv1a(`terminal:${wings[leftNb]}`);
    if (rightNb && wings[rightNb]) join.right = fnv1a(`terminal:${wings[rightNb]}`);
    const key = `${join.left ?? ''}|${join.right ?? ''}`;
    if (key !== joinKey) {
      joinKey = key;
      recompose(join.left === undefined && join.right === undefined ? null : join);
      if (edges.left && !prev.left) startKnit('left');
      if (edges.right && !prev.right) startKnit('right');
    }
    drawEdges();
```

- [ ] **Step 4: Typecheck both legs**

Run: `npm run typecheck && npm --prefix desktop run build`
Expected: both clean.

- [ ] **Step 5: On-screen verification (macOS)**

Relaunch, then drive an un-snap → re-snap so a newly-opened edge fires:

```bash
node scripts/e2e/t0-drive.mjs move t2 900 160   # apart → edges close
node scripts/e2e/t0-drive.mjs move t2 700 160   # snap → edge opens, knit fires
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/knit-1.png
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/knit-2.png
```

Expected: on the re-snap, a **bright sweep runs across the seam once** (~0.6 s) then fades. Two shots a few hundred ms apart show the glow at different columns (motion evidence). Single-window / un-joined edges never fire it.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/terminalLand.ts
git commit -m "feat(terminals): one-shot knit sweep on a newly-joined seam"
```

---

## Self-Review

**Spec coverage:**
- Part A continuous ground → Task 1 (`landSeamBoundary`, ramp, buffer) + Task 3 (renderer recompose). ✓
- Broker/renderer wiring (neighbour wing) → Task 2 + Task 3. ✓
- Part B frameless + drag strip → Task 4. ✓
- Part C knit sweep → Task 5. ✓
- Verification (smoke symmetry / edge-height equality / structure-free / no-join byte-identity; typecheck both legs; on-screen) → Task 1 smoke + per-task typecheck + Task 3/4/5 on-screen. ✓
- Determinism guard (no `Math.random`/`Date.now`) → `landSeamBoundary` uses `mulberry32`/`fnv1a32`; smoke asserts no-join byte-identity. ✓

**Placeholder scan:** none — every code step carries the actual code.

**Type consistency:** `landSeamBoundary(number, number): {height, slope}` used identically in Task 1 (definition + smoke) and consumed via `ComposeLandOptions.join?: {left?: number; right?: number}` in Task 3. Topology payload `{joins, wings: Record<string,string>}` defined in Task 2 (broker + preload + api/electron) and consumed with matching destructure in Task 3 (`applyJoins(joins, wings)`). `recompose(join | null)` and `startKnit(side)` signatures consistent across Tasks 3 and 5. `SEAM_BLEND_COLS` (land.ts) vs `KNIT_SPAN` (terminalLand.ts) are deliberately separate constants (procedural vs renderer), both 6.

**Ordering note:** Task 2 loosens the topology type; `terminalLand.ts` only compiles clean once Task 3 updates `applyJoins`. Run Tasks 2 + 3 back-to-back (or in one commit) to keep every task boundary green.
