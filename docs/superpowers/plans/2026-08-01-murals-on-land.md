# Murals on Land (#16) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every terminal window shows a framed, palette-quantised mural of its wing's flagship game, mid-sky — spec `docs/superpowers/specs/2026-08-01-murals-on-land-design.md`.

**Architecture:** The pure land composer stamps the frame + cartouche into the model as two new roles (`mural`, `muralFrame`) and reserves the interior rect; a pure quantise module maps CDN header pixels → `{glyph, paletteKey}` cells; the terminal renderer fetches once (session pixel cache), quantises against the ACTIVE theme, and mounts ≤13 BitmapText layers at the rect.

**Tech Stack:** TypeScript strict, PixiJS v8 BitmapText, mulberry32-free (no new randomness), smokes via `npx tsx scripts/smoke-*.mts` + `makeChecker` from `scripts/lib/smoke.ts`.

## Global Constraints

- `src/procedural/` stays pure + deterministic: no network, no PIXI, no `Math.random()`, no new PRNG salt (mural placement is arithmetic). Frame stamping runs AFTER all existing passes so no RNG stream shifts.
- **Byte-identity contract:** `composeLand` without `opts.mural` must produce output identical to pre-slice (guard the whole stamping block on `opts.mural`).
- Quantise targets NEVER include `bg`, `bgAlt`, `fgBright` (`fgBright` is the beings' reserved register — salience contract).
- Recognition rule: Steam CDN `header.jpg` only (`headerImageUrl(appid)`); no generated art; full-RGB is retired for this surface.
- No hard-coded colours: mural backing fills from `theme.palette.bg`.
- Gates per task: `npm run typecheck` + the named smokes individually (there is no aggregate runner). Conventional commits.
- Kill condition (frozen in spec): if the mural reads as noise at wallpaper distance, iterate the quantise, never the recognition rule.

---

### Task 1: The two new land roles + lock-set wiring

**Files:**
- Modify: `src/procedural/land.ts` (the `LandRole` union, ~line 43)
- Modify: `src/render/levels/land.ts` (`ROLE_KEY`, `LAND_GLYPH_LOCKED`, `LAND_OMIT_LOCKED`)
- Modify: `scripts/smoke-style-pack.mts` (runtime role list + lock assertions)

**Interfaces:**
- Produces: `LandRole` now includes `'mural' | 'muralFrame'`; `ROLE_KEY.mural === 'fgDim'`, `ROLE_KEY.muralFrame === 'fg'`; both glyph-locked; `muralFrame` omit-locked, `mural` omit-ALLOWED.

- [ ] **Step 1: Write the failing smoke assertions**

Open `scripts/smoke-style-pack.mts`, find its list of valid land roles (grep `runtime role` or the array containing `'ridgeFar'`), add `'mural', 'muralFrame'` to it, and add these assertions next to its existing lock-set checks:

```ts
check('mural is glyph-locked', LAND_GLYPH_LOCKED.has('mural'));
check('muralFrame is glyph-locked', LAND_GLYPH_LOCKED.has('muralFrame'));
check('muralFrame is omit-locked', LAND_OMIT_LOCKED.has('muralFrame'));
check('mural is omit-ALLOWED (lossy-lens doctrine)', !LAND_OMIT_LOCKED.has('mural'));
check('mural is ramp-locked', LAND_RAMP_LOCKED.has('mural'));
check('muralFrame is ramp-locked', LAND_RAMP_LOCKED.has('muralFrame'));
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-style-pack.mts`
Expected: FAIL — TypeScript/tsx error (`'mural'` not assignable to `LandRole`) or the new checks failing.

- [ ] **Step 3: Implement**

In `src/procedural/land.ts`, extend the union (after `'shaft'`):

```ts
  | 'shaft'
  | 'edge'
  | 'mural'       // reserved interior of the framed mural (blank in the model; pixels are render-side)
  | 'muralFrame'; // the box-drawing frame + name cartouche
```

In `src/render/levels/land.ts`:

```ts
// In ROLE_KEY (exhaustive Record — typecheck forces these):
  mural: 'fgDim', // nominal — interior colour resolves per-cell in the quantiser
  muralFrame: 'fg', // structure register, NOT fgBright (beings' reserved contract)

// LAND_GLYPH_LOCKED gains both (a pack glyph would paint the blank interior solid):
  'crust',
  'edge',
  'mural',
  'muralFrame',

// LAND_OMIT_LOCKED: mural is the ONE glyph-locked role a pack MAY omit
// (lossy-lens doctrine — a pack may delete the picture, never contradict it;
// the frame + cartouche stay, so the wing keeps its name):
export const LAND_OMIT_LOCKED: ReadonlySet<LandRole> = new Set<LandRole>(
  [...LAND_GLYPH_LOCKED, 'sky'].filter((r) => r !== 'mural'),
);
```

`LAND_RAMP_LOCKED` spreads `LAND_GLYPH_LOCKED`, so both roles are ramp-locked with no edit.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx scripts/smoke-style-pack.mts` → PASS. Then `npm run typecheck` → clean (the exhaustive `ROLE_KEY` is why this task can't split).

- [ ] **Step 5: Commit**

```bash
git add src/procedural/land.ts src/render/levels/land.ts scripts/smoke-style-pack.mts
git commit -m "feat(land): mural + muralFrame roles with lock-set wiring"
```

---

### Task 2: Compose the frame — model side

**Files:**
- Modify: `src/procedural/land.ts` (`LandGame`, `SAMPLE_LAND`, `ComposeLandOptions`, `LandModel`, `composeLand`)
- Create: `scripts/smoke-land-mural.mts`

**Interfaces:**
- Consumes: roles from Task 1.
- Produces: `LandGame.appid?: number`; `ComposeLandOptions.mural?: boolean`; `LandModel.mural?: { readonly x; y; w; h: number; readonly appid: number; readonly name: string }` (x/y/w/h = INTERIOR rect, cells); exported `MURAL_INTERIOR_W = 22`, `MURAL_INTERIOR_H = 5`.

- [ ] **Step 1: Write the failing smoke** — create `scripts/smoke-land-mural.mts`:

```ts
/** Mural compose smoke — `npx tsx scripts/smoke-land-mural.mts`. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, MURAL_INTERIOR_W, MURAL_INTERIOR_H } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-mural');

const T = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false } as const;

// 1 — off by default: no mural field, no mural roles anywhere (byte-identity guard).
const off = composeLand(7, SAMPLE_LAND, T);
check('no mural field without opts.mural', off.mural === undefined);
check('no mural roles without opts.mural',
  !off.role.some((row) => row.some((r) => r === 'mural' || r === 'muralFrame')));

// 2 — on: interior rect + frame + cartouche.
const on = composeLand(7, SAMPLE_LAND, { ...T, mural: true });
const m = on.mural!;
check('mural present', m !== undefined);
check('interior is 22x5', m.w === MURAL_INTERIOR_W && m.h === MURAL_INTERIOR_H);
check('flagship is hades (surface[0])', m.name === 'hades' && m.appid === 1145360);
check('horizontally centred', m.x === Math.floor((53 - 24) / 2) + 1);
check('sky row 2 (frame), interior row 3', m.y === 3);
const rowStr = (y: number) => on.char[y].join('');
check('top rail ╔═..═╗', rowStr(m.y - 1).slice(m.x - 1, m.x + 23) === '╔' + '═'.repeat(22) + '╗');
check('cartouche names the game', rowStr(m.y + 5).includes('╡ hades ╞'));
check('side rails ║', on.char[m.y][m.x - 1] === '║' && on.char[m.y][m.x + 22] === '║');
check('frame cells carry muralFrame role', on.role[m.y - 1][m.x - 1] === 'muralFrame');
check('interior blank + mural role',
  on.char[m.y][m.x] === ' ' && on.role[m.y][m.x] === 'mural');
let decorated = 0;
for (let y = m.y - 1; y <= m.y + 5; y++)
  for (let x = m.x - 1; x <= m.x + 22; x++) {
    const r = on.role[y][x];
    if (r === 'star' || r === 'starBright' || r === 'skyDither' || r === 'sun' || r === 'moon' || r === 'cloud') decorated++;
  }
check('no sky decoration inside the outer rect', decorated === 0);

// 3 — determinism + skips.
check('deterministic', JSON.stringify(on) === JSON.stringify(composeLand(7, SAMPLE_LAND, { ...T, mural: true })));
check('skips when cols < 32', composeLand(7, SAMPLE_LAND, { ...T, width: 30, mural: true }).mural === undefined);
check('skips when skyH < 9', composeLand(7, SAMPLE_LAND, { ...T, skyH: 8, mural: true }).mural === undefined);
const noAppid = [{ name: 'celeste', state: 'loved' as const }];
check('skips when flagship has no appid', composeLand(7, noAppid, { ...T, mural: true }).mural === undefined);
const longName = [{ name: 'a-very-long-game-name-here', state: 'loved' as const, appid: 999 }];
const lm = composeLand(7, longName, { ...T, mural: true }).mural!;
check('cartouche name truncated to 16', lm.name.length <= 16);

report();
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-land-mural.mts`
Expected: FAIL — `MURAL_INTERIOR_W` not exported / `opts.mural` unknown.

- [ ] **Step 3: Implement** in `src/procedural/land.ts`:

```ts
// LandGame gains the CDN hook (optional — celeste degrades):
export interface LandGame {
  name: string;
  state: EngagementState;
  /** Steam appid for the CDN recognition surface (mural). Absent = no mural. */
  appid?: number;
}

// SAMPLE_LAND entries gain appids from SAMPLE_LIBRARY (celeste stays bare):
export const SAMPLE_LAND: LandGame[] = [
  { name: 'hades', state: 'loved', appid: 1145360 },
  { name: 'stardew', state: 'recent', appid: 413150 },
  { name: 'hollow', state: 'mastered', appid: 367520 },
  { name: 'disco', state: 'dusty', appid: 632470 },
  { name: 'wilds', state: 'abandoned', appid: 753640 },
  { name: 'spire', state: 'recent', appid: 646570 },
  { name: 'civ', state: 'dusty', appid: 289070 },
  { name: 'celeste', state: 'abandoned' },
];

// Constants next to the V0 hall knobs:
export const MURAL_INTERIOR_W = 22;
export const MURAL_INTERIOR_H = 5;
const MURAL_MIN_COLS = 32;
const MURAL_MIN_SKY = 9;
const MURAL_NAME_MAX = 16;

// ComposeLandOptions:
  /** Murals #16: stamp the flagship game's framed mural rect into the sky
   *  (frame + cartouche in the model; PIXELS are render-side). Default
   *  absent = byte-identical output to pre-slice. */
  readonly mural?: boolean;

// LandModel:
  /** Murals #16: INTERIOR cell rect + the flagship's identity. Present only
   *  when composed with `mural: true` and the window fits. */
  readonly mural?: {
    readonly x: number; readonly y: number; readonly w: number; readonly h: number;
    readonly appid: number; readonly name: string;
  };
```

In `composeLand`, stamp LAST (after the label/site pass, before the `withPlayer` block — every RNG draw has already happened, so streams never shift). The flagship mirrors the structure pass: the first game whose `state !== 'abandoned'` (the `surface[0]` / hall rule — reuse the same filtered list the structure pass builds; if it's a local, hoist it).

```ts
  let mural: LandModel['mural'];
  if (opts.mural) {
    const flagship = games.find((g) => g.state !== 'abandoned');
    if (flagship?.appid !== undefined && cols >= MURAL_MIN_COLS && SKY_H >= MURAL_MIN_SKY) {
      const name = flagship.name.slice(0, MURAL_NAME_MAX);
      const ox = Math.floor((cols - (MURAL_INTERIOR_W + 2)) / 2); // outer left col
      const oy = 2; // outer top row (sky row 2 — clear of the drag strip)
      // Clear the outer rect (sky decorations mechanically evicted), then frame.
      for (let y = oy; y < oy + MURAL_INTERIOR_H + 2; y++)
        for (let x = ox; x < ox + MURAL_INTERIOR_W + 2; x++) set(x, y, ' ', 'sky');
      put(ox, oy, '╔' + '═'.repeat(MURAL_INTERIOR_W) + '╗', 'muralFrame');
      for (let y = oy + 1; y <= oy + MURAL_INTERIOR_H; y++) {
        set(ox, y, '║', 'muralFrame');
        set(ox + MURAL_INTERIOR_W + 1, y, '║', 'muralFrame');
        for (let x = ox + 1; x <= ox + MURAL_INTERIOR_W; x++) set(x, y, ' ', 'mural');
      }
      const cart = `╡ ${name} ╞`; // ╡ U+2561 / ╞ U+255E — atlas-verified (coverage smoke)
      const pad = MURAL_INTERIOR_W - cart.length;
      const left = Math.floor(pad / 2);
      put(ox, oy + MURAL_INTERIOR_H + 1,
        '╚' + '═'.repeat(left) + cart + '═'.repeat(pad - left) + '╝', 'muralFrame');
      mural = { x: ox + 1, y: oy + 1, w: MURAL_INTERIOR_W, h: MURAL_INTERIOR_H, appid: flagship.appid, name };
    }
  }
```

Add `mural` to the returned object literal.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx scripts/smoke-land-mural.mts` → PASS. Then byte-identity neighbours: `npx tsx scripts/smoke-land-atmosphere.mts`, `npx tsx scripts/smoke-land-bands.mts`, `npx tsx scripts/smoke-land-seam.mts`, `npx tsx scripts/smoke-sky-dither.mts` → all PASS unchanged. `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/procedural/land.ts scripts/smoke-land-mural.mts
git commit -m "feat(land): compose the mural frame + cartouche into the model"
```

---

### Task 3: The pure quantiser

**Files:**
- Create: `src/render/muralCells.ts` (pure — no PIXI, no DOM, no network)
- Create: `scripts/smoke-mural-cells.mts`

**Interfaces:**
- Consumes: `ThemePalette` type from `src/themes/types.ts`.
- Produces: `MuralCell { ch: string; key: PaletteKey | null }`; `MURAL_RAMP = [' ', '░', '▒', '▓', '█']`; `muralQuantizeTargets(palette: ThemePalette): MuralTarget[]`; `quantizeMural(data: ArrayLike<number>, srcW, srcH, cellsW, cellsH, targets): MuralCell[]` (row-major, `data` is RGBA as from `getImageData`).

- [ ] **Step 1: Write the failing smoke** — create `scripts/smoke-mural-cells.mts`:

```ts
/** Mural quantiser smoke — `npx tsx scripts/smoke-mural-cells.mts`. */
import { makeChecker } from './lib/smoke.ts';
import { MURAL_RAMP, muralQuantizeTargets, quantizeMural } from '../src/render/muralCells.ts';
import { THEMES } from '../src/themes/index.ts';
const { check, report } = makeChecker('smoke mural-cells');

const pal = Object.values(THEMES)[0].palette;
const targets = muralQuantizeTargets(pal);
check('ramp is space..full-block', MURAL_RAMP.join('') === ' ░▒▓█');
for (const theme of Object.values(THEMES)) {
  const keys = muralQuantizeTargets(theme.palette).map((t) => t.key);
  check(`${theme.id ?? theme.name ?? 'theme'}: no bg/bgAlt/fgBright target`,
    !keys.includes('bg') && !keys.includes('bgAlt') && !keys.includes('fgBright'));
}

// A 2×1-source image quantised to 2×1 cells: pure black + pure white.
const px = (r: number, g: number, b: number) => [r, g, b, 255];
const bw = [...px(0, 0, 0), ...px(255, 255, 255)];
const cells = quantizeMural(bw, 2, 1, 2, 1, targets);
check('black → blank cell', cells[0].ch === ' ' && cells[0].key === null);
check('white → full block', cells[1].ch === '█' && cells[1].key !== null);

// Chroma: a saturated red cell maps to the palette's red.
const red = quantizeMural([...px(200, 30, 30), ...px(200, 30, 30)], 2, 1, 1, 1, targets);
check('red pixels → red key', red[0].key === 'red');

// Box-averaging: 2×2 source → 1 cell, mean of all four.
const quad = [...px(255, 255, 255), ...px(255, 255, 255), ...px(0, 0, 0), ...px(0, 0, 0)];
const avg = quantizeMural(quad, 2, 2, 1, 1, targets);
check('box average lands mid-ramp', avg[0].ch === '▒' || avg[0].ch === '▓');

check('deterministic', JSON.stringify(cells) ===
  JSON.stringify(quantizeMural(bw, 2, 1, 2, 1, targets)));
report();
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-mural-cells.mts` → FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/render/muralCells.ts`:

```ts
/**
 * Murals #16 — the pure quantiser. CDN header pixels → {glyph, paletteKey}
 * cells: luminance carries density (MURAL_RAMP), chroma snaps to the nearest
 * ACTIVE-theme palette key. Pure: no PIXI, no DOM, no network — the smokeable
 * half of the mural pipeline (fetch/mount live in src/render/mural.ts).
 * Targets NEVER include bg/bgAlt (backing) or fgBright (the beings' reserved
 * register — the salience contract holds by construction).
 */
import type { PaletteKey, ThemePalette } from '../themes/types';

export interface MuralCell {
  ch: string;
  key: PaletteKey | null; // null = blank (theme-bg backing shows through)
}
export interface MuralTarget {
  key: PaletteKey;
  rgb: readonly [number, number, number];
}

export const MURAL_RAMP = [' ', '░', '▒', '▓', '█'] as const;
const EXCLUDED: ReadonlySet<PaletteKey> = new Set(['bg', 'bgAlt', 'fgBright']);

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

export function muralQuantizeTargets(palette: ThemePalette): MuralTarget[] {
  return (Object.keys(palette) as PaletteKey[])
    .filter((k) => !EXCLUDED.has(k))
    .map((key) => ({ key, rgb: hexRgb(palette[key]) }));
}

export function quantizeMural(
  data: ArrayLike<number>, // RGBA, row-major (getImageData shape)
  srcW: number,
  srcH: number,
  cellsW: number,
  cellsH: number,
  targets: readonly MuralTarget[],
): MuralCell[] {
  const boxW = Math.max(1, Math.floor(srcW / cellsW));
  const boxH = Math.max(1, Math.floor(srcH / cellsH));
  const cells: MuralCell[] = [];
  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      let r = 0, g = 0, b = 0;
      for (let y = cy * boxH; y < (cy + 1) * boxH; y++)
        for (let x = cx * boxW; x < (cx + 1) * boxW; x++) {
          const i = (y * srcW + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
      const n = boxW * boxH;
      r /= n; g /= n; b /= n;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const idx = Math.min(MURAL_RAMP.length - 1, Math.floor(lum * MURAL_RAMP.length));
      if (idx === 0) { cells.push({ ch: ' ', key: null }); continue; }
      let best: PaletteKey = targets[0].key;
      let bestD = Infinity;
      for (const t of targets) {
        const d = (r - t.rgb[0]) ** 2 + (g - t.rgb[1]) ** 2 + (b - t.rgb[2]) ** 2;
        if (d < bestD) { bestD = d; best = t.key; }
      }
      cells.push({ ch: MURAL_RAMP[idx], key: best });
    }
  }
  return cells;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx scripts/smoke-mural-cells.mts` → PASS. `npm run typecheck` → clean. (If the `red` assertion fails on the first theme's palette geometry, assert against a theme whose `red` is nearest to (200,30,30) — pick the theme in the smoke, don't touch the quantiser.)

- [ ] **Step 5: Commit**

```bash
git add src/render/muralCells.ts scripts/smoke-mural-cells.mts
git commit -m "feat(render): pure mural quantiser — luminance ramp + nearest-palette chroma"
```

---

### Task 4: Fetch, cache, mount — the terminal wiring

**Files:**
- Create: `src/render/mural.ts`
- Modify: `src/terminal/terminalLand.ts` (composeOpts, mount + recompose, `TerminalLandState`, `__terminal.state()`)

**Interfaces:**
- Consumes: `LandModel.mural` (Task 2), `quantizeMural`/`muralQuantizeTargets`/`MuralCell` (Task 3).
- Produces: `loadMuralPixels(appid): Promise<{data: Uint8ClampedArray; w: number; h: number}>` (session-cached); `buildQuantizedMural(cells, w, h, theme): Container`; `TerminalMuralState = 'idle'|'loading'|'ready'|'failed-cors'|'failed-load'|'omitted'`; `state().mural: { state: TerminalMuralState; appid: number } | null`.

- [ ] **Step 1: Create `src/render/mural.ts`** (PIXI + DOM — not smokeable; typecheck + e2e are the gates):

```ts
/**
 * Murals #16 — fetch + mount (the impure half; the quantiser is muralCells).
 * ONE full-res getImageData + session pixel cache per appid: joins, theme
 * relaunches and re-quantises never refetch. Backing fills from the ACTIVE
 * theme bg (the ansiSpike 0x050505 debt stops here; ansiSpike itself stays
 * for the V0 preview).
 */
import { BitmapText, Container, Graphics } from 'pixi.js';
import { COZETTE_CELL_HEIGHT, COZETTE_CELL_WIDTH, COZETTE_FONT_FAMILY, COZETTE_FONT_SIZE, hexToInt } from './fonts';
import { headerImageUrl } from '../data/sampleLibrary';
import { quantizeMural, muralQuantizeTargets, type MuralCell } from './muralCells';
import type { Theme } from '../themes/types';

export type TerminalMuralState = 'idle' | 'loading' | 'ready' | 'failed-cors' | 'failed-load' | 'omitted';

const pixelCache = new Map<number, { data: Uint8ClampedArray; w: number; h: number }>();

export async function loadMuralPixels(appid: number): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const hit = pixelCache.get(appid);
  if (hit) return hit;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous'; // Steam CDN sends ACAO:* — readback stays untainted
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`[mural] image load failed: ${appid}`));
    el.src = headerImageUrl(appid);
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('[mural] 2d context unavailable');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height); // throws SecurityError if tainted
  const entry = { data, w: canvas.width, h: canvas.height };
  pixelCache.set(appid, entry);
  return entry;
}

/** ≤1 backing + 13 key layers (one BitmapText per palette key used) — never
 *  per-cell objects. Local glyph space; caller positions at the model rect. */
export function buildQuantizedMural(cells: readonly MuralCell[], w: number, h: number, theme: Theme): Container {
  const c = new Container();
  c.addChild(new Graphics().rect(0, 0, w * COZETTE_CELL_WIDTH, h * COZETTE_CELL_HEIGHT)
    .fill(hexToInt(theme.palette.bg)));
  // One text block per palette key: same layerFor idiom as buildLandContainer.
  const keys = [...new Set(cells.map((cl) => cl.key).filter((k): k is NonNullable<typeof k> => k !== null))];
  for (const key of keys) {
    const rows: string[] = [];
    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < w; x++) {
        const cell = cells[y * w + x];
        line += cell.key === key ? cell.ch : ' ';
      }
      rows.push(line.replace(/\s+$/u, ''));
    }
    const text = rows.join('\n');
    if (!text.trim()) continue;
    c.addChild(new BitmapText({
      text,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette[key]) },
    }));
  }
  return c;
}
```

- [ ] **Step 2: Wire `terminalLand.ts`**

1. `composeOpts` gains the flag: `const composeOpts = { width: cols, skyH, surfaceBand: SURFACE_BAND, underH: UNDER_H, withPlayer: false, mural: true };`
2. Module-level per-mount state + mounter (place near the wear/marks helpers):

```ts
  let muralState: TerminalMuralState = 'idle';
  const mountMural = (): void => {
    const spec = model.mural;
    if (!spec) { muralState = 'idle'; return; }
    if ((theme.landOmit ?? []).includes('mural')) { muralState = 'omitted'; return; }
    const host = sceneContainer; // capture: a recompose swaps this out — the dead-guard
    muralState = 'loading';
    loadMuralPixels(spec.appid)
      .then((px) => {
        if (host !== sceneContainer || host.destroyed) return; // late resolve, dead scene
        const cells = quantizeMural(px.data, px.w, px.h, spec.w, spec.h, muralQuantizeTargets(theme.palette));
        const mc = buildQuantizedMural(cells, spec.w, spec.h, theme);
        mc.x = spec.x * CW;
        mc.y = spec.y * CH;
        host.addChild(mc); // child of the scene → dies with it on recompose
        muralState = 'ready';
      })
      .catch((err: unknown) => {
        muralState = err instanceof Error && err.name === 'SecurityError' ? 'failed-cors' : 'failed-load';
        console.warn('[terminal] mural failed:', err); // frame + cartouche stand alone
      });
  };
```

3. Call `mountMural()` once after the initial `buildSiteLabels()` call, and add `mountMural();` at the END of `recompose()` (after `buildSiteLabels()` — the scene child was destroyed with `sceneContainer`, the pixel cache makes the remount instant).
4. `TerminalLandState` gains `mural: { state: TerminalMuralState; appid: number } | null;` and `state()` returns `mural: model.mural ? { state: muralState, appid: model.mural.appid } : null,`.
5. Imports: `import { loadMuralPixels, buildQuantizedMural, type TerminalMuralState } from '../render/mural';` and `import { quantizeMural, muralQuantizeTargets } from '../render/muralCells';`.

- [ ] **Step 3: Typecheck + full smoke neighbours**

Run: `npm run typecheck` → clean both legs. Then the terminal-land smokes that consume `composeLand` output shapes: `npx tsx scripts/smoke-t2-marks.mts`, `npx tsx scripts/smoke-worn-paths.mts`, `npx tsx scripts/smoke-land-wear-persist.mts`, `npx tsx scripts/smoke-t1-being-intents.mts` → PASS. (`composeOpts` now sets `mural: true` — if any of these smokes drive the REAL terminal compose path and assert sky content inside the rect, read the failure and adjust the SMOKE's fixture cols/skyH below the mural threshold rather than weakening assertions; note it in the commit message.)

- [ ] **Step 4: Deterministic e2e check**

Run the headless harness (`scripts/e2e/run.sh` pattern) with `LOKILIBRARY_TERMINALS=2`; poll `__terminal.state()` until `mural.state === 'ready'` in both windows; assert the two `mural.appid`s DIFFER (wing rotation ⇒ different flagships). Capture `drive.mjs shot` per window.

- [ ] **Step 5: Commit**

```bash
git add src/render/mural.ts src/terminal/terminalLand.ts
git commit -m "feat(terminal): mount the quantised mural — session pixel cache, omit-aware, join-safe"
```

---

### Task 5: Glyph provenance + verification sweep

**Files:**
- Modify: `scripts/smoke-glyph-coverage.mts` (RENDERER_LITERALS-style provenance entries)

- [ ] **Step 1: Add provenance entries** — in the `emitted` list of `scripts/smoke-glyph-coverage.mts`, import `MURAL_RAMP` from `../src/render/muralCells.ts` and add:

```ts
// Murals #16 — frame + cartouche (composeLand) and the quantise ramp.
for (const g of ['╔', '╗', '╚', '╝', '║', '═', '╡', '╞'])
  emitted.push([g, 'src/procedural/land.ts composeLand mural frame/cartouche']);
for (const g of MURAL_RAMP) if (g !== ' ') emitted.push([g, 'src/render/muralCells.ts MURAL_RAMP']);
```

- [ ] **Step 2: Run** `npx tsx scripts/smoke-glyph-coverage.mts` → PASS (`╡` U+2561 and `╞` U+255E pre-verified against `scripts/lib/cozette-coverage.json`).

- [ ] **Step 3: Full named sweep** — run each individually, all must PASS:
`smoke-land-mural`, `smoke-mural-cells`, `smoke-style-pack`, `smoke-glyph-coverage`, `smoke-land-atmosphere`, `smoke-land-bands`, `smoke-land-seam`, `smoke-sky-dither`, `smoke-salience`, `smoke-worn-paths`, `smoke-land-wear-persist`, `smoke-t2-marks`, `smoke-t1-being-intents`, `smoke-t1-broker-handoff`, `smoke-t0-topology`. Plus `npm run typecheck`.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-glyph-coverage.mts
git commit -m "test: glyph provenance for the mural frame, cartouche and ramp"
```

---

### Task 6: On-screen eyeball + slice record

**Files:**
- Modify: `STATE.md` (new slice entry at top), `PLAN.md` (depth-track status), `TODO-USER.md` (only if an eyeball item is left for Harry)

- [ ] **Step 1: On-screen verification** (launch-desktop-app skill, `LOKILIBRARY_TERMINALS=2`, window frontmost — the throttled-window lesson):
  - Two windows show two DIFFERENT murals; each reads as its game at wallpaper distance (the identity beat).
  - Beings remain the brightest marks (salience read).
  - Join two windows; confirm the mural survives the recompose (remounts, no refetch flash).
  - Relaunch with the `gameboy-dmg` theme: the mural quantises to the 4-green palette.
  - Offline run (Wi-Fi off or bogus appid via a temporary edit): frame + cartouche render, `state().mural.state === 'failed-load'`, no error surface.
  - Screenshot the two-window desk for the record (`docs/design-reviews/` shot folder or /tmp gallery per e2e habit).
- [ ] **Step 2: Harry's eyeball gate** — the KILL CONDITION from the spec applies: noise-not-Hades ⇒ iterate quantise (ramp, cell size, targets), never the recognition rule.
- [ ] **Step 3: Slice record** — STATE.md entry (shape: what shipped, verification evidence, deferred list), PLAN.md depth-track item 2 marked SHIPPED (maintenance rule), commit `docs: murals #16 slice record`.

---

## Spec-coverage map (every Verification bullet → task)

| Spec bullet | Task |
|---|---|
| smoke-mural-cells (quantise maths, fgBright, determinism) | 3 |
| smoke-land-mural (rect/frame/cartouche/skips/byte-identity) | 2 |
| smoke-style-pack roles + lock sets | 1 |
| glyph provenance ╡╞ (+ramp) | 5 |
| existing land/salience smokes green | 2, 4, 5 |
| e2e state().mural + screenshot | 4 |
| on-screen eyeball (identity, retint, DMG, salience) | 6 |
| offline degradation | 4 (code path), 6 (verified) |
| both typecheck legs | every task |
