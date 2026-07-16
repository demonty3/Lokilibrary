# Depth & Atmosphere (Tier 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The side-on terminal wings read DEEP and ALIVE without any camera scroll: three silhouette planes that fade toward the sky, a dithered sky gradient toward the horizon, structures that glow, foliage that sways sub-cell, ground that wears where beings actually walk, and a knit sweep with a trail + seam glow.

**Architecture:** Two pure procedural additions in `src/procedural/land.ts` (a far ridge plane + a density-ramped sky-dither field), each on its OWN salted PRNG so the main `rng` sequence — silhouette, structures, caverns, the Tier-0 seam ramp — is byte-untouched. The renderer (`src/render/levels/land.ts`) gains `mixToward` palette math (atmospheric fade toward `bg`, no new palette entries) and returns a per-role `layers` handle so `terminalLand.ts`'s existing `tick` can animate whole role layers (glow / sway / wear) without rebuilding the scene. Worn paths are a pure, session-scoped module (`src/terminal/wear.ts`) driving a live crust-layer text swap (`▀ → ▔`). All motion rides `app.ticker.deltaMS` via the existing `elapsedS` accumulator. There is NO scrolling viewport — every depth cue is static composition or ticker-driven sub-cell motion.

**Tech Stack:** TypeScript, PixiJS v8 (BitmapText role layers), Electron T0 harness (`scripts/e2e/t0-drive.mjs`), `tsx` smokes via `scripts/lib/smoke.ts`.

## Global Constraints

- **Tier-0 prerequisite:** the join-moment plan (`docs/superpowers/plans/2026-07-16-join-moment.md`) is fully landed — `composeLand` has `join`, `terminalLand.ts` has the swappable `scene`/`recompose`/`applyJoins(joins, wings)` structure and (Task 6's baseline) the Tier-0 knit sweep (`KNIT_S`/`KNIT_SPAN`/`knits`/`startKnit`).
- **Determinism in `src/procedural/`:** no `Math.random`/`Date.now`; `mulberry32`/`fnv1a32` only. New decorations use their OWN salted PRNGs (`RIDGE_FAR_SALT = 0xfa42`, `SKY_DITHER_SALT = 0xd174` — both distinct from every reserved salt: cell `0xce11` · scatter `0x5ca7` · loki `0x10ce` · landmark `0x1a4d` · clusters `0xc1a5`/`0xc0a5` · cell-seam `0x5ea3` · land-seam `0x5a11`), so the main `rng` sequence never shifts and `scripts/smoke-land-seam.mts` stays green.
- **No LLM / API-key / network dependency anywhere** — Tier-0 renderer behaviour only. Nothing here dispatches Tier 1/2.
- **Animation rides `app.ticker.deltaMS`** (the `elapsedS` accumulator) — never a wall clock; everything freezes under throttle.
- **One theme palette per scene:** `mixToward` only interpolates between EXISTING palette keys (`role colour → bg`). The single new glyph is `▔` (U+2594, verified present in `scripts/lib/cozette-coverage.json`); it and every new emitting surface get enumerated in `scripts/smoke-glyph-coverage.mts`.
- **Verification floor per task:** `npm run typecheck` AND `npm --prefix desktop run build` clean, the FULL smoke sweep green (`for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`), a before/after gallery pair in `/tmp/loki-join/gallery/`, then a git commit. Taste sign-off is HARRY's later; tasks gate only on the objective checks.
- **Capture discipline:** BEFORE shots must be taken **before touching code** — Vite HMR hot-swaps the live windows the moment you save.
- **The relaunch recipe** (referenced by every capture step):

```bash
mkdir -p /tmp/loki-join/gallery
curl -sf http://localhost:5183 >/dev/null || (npm run dev > /tmp/loki-vite.log 2>&1 &)
pkill -f 'remote-debugging-port=9222' || true; sleep 1
npm --prefix desktop run build
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-electron-t0.log 2>&1 & )
sleep 5
node scripts/e2e/t0-drive.mjs move t2 700 160   # joined framing for every gallery shot
osascript -e 'tell application "System Events" to set frontmost of (first process whose name is "Electron") to true'
```

---

### Task 1: Atmospheric perspective — far ridge plane + bg-fade palette math

Three planes: far ridge (faintest) → near ridge → full-ink ground. Pure composer change + pure renderer colour math, both TDD'd.

**Files:**
- Modify: `src/procedural/land.ts` (`LandRole` + `'ridgeFar'`; `RIDGE_FAR_SALT`; far-ridge block; near ridge may overwrite the far plane)
- Modify: `src/render/levels/land.ts` (`mixToward`, `FAR_FADE`, `ROLE_KEY` entries)
- Create: `scripts/smoke-land-atmosphere.mts`

**Interfaces:**
- Produces: `LandRole` gains `'ridgeFar'` · `export function mixToward(hexA: string, hexB: string, t: number): number` · `export const FAR_FADE: Partial<Record<LandRole, number>>`.
- Consumes: `mulberry32` (already imported in both files' modules), `hexToInt` from `src/render/fonts`.

- [ ] **Step 1: Capture BEFORE (before any edit)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-1-atmosphere-before.png
```

- [ ] **Step 2: Write the failing smoke**

Create `scripts/smoke-land-atmosphere.mts`:

```ts
/**
 * Tier-2 depth smoke — `npx tsx scripts/smoke-land-atmosphere.mts`.
 * Locks the atmospheric-perspective primitives:
 *   - composeLand emits a far ridge plane ('ridgeFar'), strictly above the
 *     surface, ▁ hilltop line only, deterministic (own salted PRNG)
 *   - the near ridge still draws (it wins where the planes meet)
 *   - mixToward is exact at both endpoints and channel-correct between
 *   - FAR_FADE orders the planes: farther = closer to bg
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { FAR_FADE, mixToward } from '../src/render/levels/land.ts';

const { check, report } = makeChecker('smoke land-atmosphere');

const dims = { width: 120, skyH: 10, surfaceBand: 5, underH: 12, withPlayer: false } as const;
const m1 = composeLand(0xd00dfeed, SAMPLE_LAND, dims);
const m2 = composeLand(0xd00dfeed, SAMPLE_LAND, dims);

// 1 · deterministic
check('composeLand deterministic with far ridge', JSON.stringify(m1) === JSON.stringify(m2));

// 2 · far ridge exists, strictly above the surface, ▁ only
let farCells = 0;
let farOk = true;
for (let y = 0; y < m1.height; y++)
  for (let x = 0; x < m1.width; x++)
    if (m1.role[y][x] === 'ridgeFar') {
      farCells++;
      if (y >= m1.surface[x]) farOk = false;
      if (m1.char[y][x] !== '▁') farOk = false;
    }
check('far ridge plane present', farCells > 0, `farCells=${farCells}`);
check('far ridge strictly above the surface, ▁ only', farOk);

// 3 · near ridge still present (it overwrites the far plane where they meet)
let nearCells = 0;
for (let y = 0; y < m1.height; y++)
  for (let x = 0; x < m1.width; x++) if (m1.role[y][x] === 'ridge') nearCells++;
check('near ridge still present', nearCells > 0);

// 4 · mixToward endpoints + interior channel math
check('mixToward t=0 is pure ink', mixToward('#3dff8c', '#0a0a0a', 0) === 0x3dff8c);
check('mixToward t=1 is pure bg', mixToward('#3dff8c', '#0a0a0a', 1) === 0x0a0a0a);
const mid = mixToward('#000000', '#ffffff', 0.5);
check('mixToward midpoint channel math', mid === 0x808080, `got 0x${mid.toString(16)}`);

// 5 · plane ordering: farther planes fade harder
check(
  'FAR_FADE orders the planes',
  (FAR_FADE.ridgeFar ?? 0) > (FAR_FADE.ridge ?? 0) && (FAR_FADE.ridge ?? 0) > 0,
);

report();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-atmosphere.mts`
Expected: FAIL — `FAR_FADE`/`mixToward` are not exported yet (import error).

- [ ] **Step 4: Compose the far ridge plane**

In `src/procedural/land.ts`, add `'ridgeFar'` to the `LandRole` union (after `'ridge'`):

```ts
  | 'ridge'
  | 'ridgeFar'
```

Add the salt beside `LAND_SEAM_SALT` (same comment style):

```ts
/** PRNG namespace for the far ridge plane — distinct from every other
 *  src/procedural salt (cell 0xce11 · scatter 0x5ca7 · loki 0x10ce ·
 *  landmark 0x1a4d · clusters 0xc1a5/0xc0a5 · cell-seam 0x5ea3 ·
 *  land-seam 0x5a11). */
const RIDGE_FAR_SALT = 0xfa42;
```

Replace the existing parallax-ridge block (the `// --- Parallax ridge: …` comment through its closing `}`) with:

```ts
  // --- Far ridge plane (Tier 2 atmospheric perspective): a THIRD plane, one
  // faint ▁ hilltop line well above the near ridge, tinted nearest the sky
  // by the renderer's FAR_FADE. Its own salted PRNG so the main `rng`
  // sequence (silhouette, structures, caverns, seam ramp) is byte-untouched.
  const farRng = mulberry32((seed ^ RIDGE_FAR_SALT) >>> 0);
  const farPhase = farRng.rangeFloat(0, 6.283);
  for (let x = 0; x < cols; x++) {
    const fy = groundLine - 4 - Math.round(0.9 * Math.sin(x * 0.05 + farPhase) + 0.8);
    if (role[fy]?.[x] === 'sky') set(x, fy, '▁', 'ridgeFar');
  }

  // --- Parallax ridge: a distant hill silhouette behind the structures -----
  // A second, gentler height field a couple rows above the true ground line,
  // drawn dim — gives the sky depth + kills the dead-air letterbox feel.
  // A THIN silhouette (hilltop line + one row of body) so sky shows above it
  // and it never smears into the surface band behind the structures. The
  // NEARER plane wins where it meets the far ridge.
  const ridgePhase = rng.rangeFloat(0, 6.283);
  const behindRidge = (r: LandRole | undefined): boolean => r === 'sky' || r === 'ridgeFar';
  for (let x = 0; x < cols; x++) {
    const ry = groundLine - 2 - Math.round(1.1 * Math.sin(x * 0.07 + ridgePhase) + 0.6);
    if (behindRidge(role[ry]?.[x])) set(x, ry, '▁', 'ridge');
    if (behindRidge(role[ry + 1]?.[x])) set(x, ry + 1, '░', 'ridge');
  }
```

- [ ] **Step 5: Renderer fade math**

In `src/render/levels/land.ts`, add below `shadeOf`:

```ts
/** Linear per-channel mix from `hexA`'s ink toward `hexB` by t∈[0,1] — the
 *  atmospheric-perspective primitive (t=0 pure ink, t=1 vanishes into hexB).
 *  Both ends come from the ACTIVE theme, so setTheme hot-swap re-fades. */
export function mixToward(hexA: string, hexB: string, t: number): number {
  const a = hexToInt(hexA);
  const b = hexToInt(hexB);
  const ch = (shift: number): number => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Atmospheric perspective (Tier 2): how far each DISTANT role's ink is
 *  pulled toward the sky (bg) colour — farther planes lose contrast.
 *  Palette maths only (mixToward), no new palette entries, so the
 *  one-theme-per-scene rule stays structural. Exported for the smoke. */
export const FAR_FADE: Partial<Record<LandRole, number>> = {
  ridgeFar: 0.72,
  ridge: 0.45,
  cloud: 0.4,
  star: 0.35,
};
```

In `ROLE_KEY`, change the ridge line and add the new role (the fade now controls distance, so both planes key off `fgDim`):

```ts
  ridge: 'fgDim',
  ridgeFar: 'fgDim',
```

In `buildLandContainer`, replace the plain-role `else` branch of the roles loop with:

```ts
    } else {
      const fade = FAR_FADE[r];
      const fill =
        fade !== undefined
          ? mixToward(theme.palette[ROLE_KEY[r]], theme.palette.bg, fade)
          : hexToInt(theme.palette[ROLE_KEY[r]]);
      addLayer(layerFor((x, y) => model.role[y][x] === r), fill);
    }
```

- [ ] **Step 6: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-land-atmosphere.mts`
Expected: `[smoke land-atmosphere] 8 assertions passed`

- [ ] **Step 7: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`
Expected: both legs clean; every smoke green (`smoke-land-seam` and `smoke-glyph-coverage` included — `▁`/`░` are already-covered glyphs).

- [ ] **Step 8: Capture AFTER**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-1-atmosphere-after.png
```

Expected vs the before shot: a second, fainter hilltop line ABOVE the existing ridge; the two ridge planes read progressively closer to the sky colour (3-plane depth), ground ink unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/procedural/land.ts src/render/levels/land.ts scripts/smoke-land-atmosphere.mts
git commit -m "feat(land): atmospheric perspective — far ridge plane + bg-fade palette math"
```

---

### Task 2: Dithered sky gradient toward the horizon

A pure, seeded density-ramped `░·.` scatter so the sky reads as a gradient. Band function fully smokeable.

**Files:**
- Modify: `src/procedural/land.ts` (`'skyDither'` role; `SKY_DITHER_SALT`, `SKY_DITHER_GLYPHS`, `skyDitherDensity`, `skyDitherGlyph`; dither block in `composeLand`)
- Modify: `src/render/levels/land.ts` (`ROLE_KEY.skyDither`, `FAR_FADE.skyDither`)
- Modify: `scripts/smoke-glyph-coverage.mts` (enumerate the dither vocabulary)
- Create: `scripts/smoke-sky-dither.mts`

**Interfaces:**
- Produces: `export const SKY_DITHER_GLYPHS: readonly ['.', '·', '░']` · `export function skyDitherDensity(row: number, skyH: number): number` · `export function skyDitherGlyph(t: number): string` · `LandRole` gains `'skyDither'`.

- [ ] **Step 1: Capture BEFORE (before any edit)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-2-dither-before.png
```

- [ ] **Step 2: Write the failing smoke**

Create `scripts/smoke-sky-dither.mts`:

```ts
/**
 * Tier-2 depth smoke — `npx tsx scripts/smoke-sky-dither.mts`.
 * Locks the pure dithered-sky-gradient maths (src/procedural/land.ts):
 *   - skyDitherDensity: 0 at the zenith, monotone toward the horizon, bounded
 *   - skyDitherGlyph walks the vocabulary light → heavy
 *   - composed dither uses only SKY_DITHER_GLYPHS, only in sky rows, never
 *     over scatter/sun/cloud/ridge, and thickens toward the horizon
 *   - deterministic (same seed → byte-identical model)
 */
import { makeChecker } from './lib/smoke.ts';
import {
  composeLand,
  SAMPLE_LAND,
  SKY_DITHER_GLYPHS,
  skyDitherDensity,
  skyDitherGlyph,
} from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke sky-dither');

// 1 · pure band function
const SKY_H = 12;
check('density 0 at zenith', skyDitherDensity(0, SKY_H) === 0);
let monotone = true;
for (let y = 1; y < SKY_H; y++)
  if (skyDitherDensity(y, SKY_H) < skyDitherDensity(y - 1, SKY_H)) monotone = false;
check('density monotone toward the horizon', monotone);
const horizon = skyDitherDensity(SKY_H - 1, SKY_H);
check('density bounded', horizon > 0.1 && horizon <= 0.25, `horizon=${horizon}`);
check('density 0 outside the sky band', skyDitherDensity(-1, SKY_H) === 0 && skyDitherDensity(SKY_H, SKY_H) === 0);

// 2 · glyph ramp light → heavy
check('glyph ramp starts light', skyDitherGlyph(0) === SKY_DITHER_GLYPHS[0]);
check('glyph ramp ends heavy', skyDitherGlyph(1) === SKY_DITHER_GLYPHS[SKY_DITHER_GLYPHS.length - 1]);

// 3 · composed dither: vocabulary + sky rows only, denser at the horizon
const dims = { width: 200, skyH: SKY_H, surfaceBand: 5, underH: 10, withPlayer: false } as const;
const m = composeLand(0xa11ce, SAMPLE_LAND, dims);
const vocab = new Set<string>(SKY_DITHER_GLYPHS);
const perRow: number[] = Array.from({ length: m.height }, () => 0);
let vocabOk = true;
let rowsOk = true;
for (let y = 0; y < m.height; y++)
  for (let x = 0; x < m.width; x++)
    if (m.role[y][x] === 'skyDither') {
      perRow[y]++;
      if (!vocab.has(m.char[y][x])) vocabOk = false;
      if (y >= SKY_H) rowsOk = false;
    }
const total = perRow.reduce((a, b) => a + b, 0);
check('dither present', total > 40, `total=${total}`);
check('dither uses only SKY_DITHER_GLYPHS', vocabOk);
check('dither confined to the sky band', rowsOk);
const top = perRow.slice(0, Math.floor(SKY_H / 2)).reduce((a, b) => a + b, 0);
const bottom = perRow.slice(Math.floor(SKY_H / 2), SKY_H).reduce((a, b) => a + b, 0);
check('gradient: horizon half denser than zenith half', bottom > top * 2, `top=${top} bottom=${bottom}`);

// 4 · deterministic
check('deterministic', JSON.stringify(composeLand(0xa11ce, SAMPLE_LAND, dims)) === JSON.stringify(m));

report();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx scripts/smoke-sky-dither.mts`
Expected: FAIL — `SKY_DITHER_GLYPHS` / `skyDitherDensity` not exported yet.

- [ ] **Step 4: Add the pure dither field to the composer**

In `src/procedural/land.ts`, add `'skyDither'` to the `LandRole` union (after `'starBright'`):

```ts
  | 'starBright'
  | 'skyDither'
```

Add beside `RIDGE_FAR_SALT`:

```ts
/** PRNG namespace for the sky dither field (reserved-salt list as above,
 *  plus 0xfa42). */
const SKY_DITHER_SALT = 0xd174;

/** Dither vocabulary, light → heavy (all long-covered by the Cozette atlas;
 *  enumerated in scripts/smoke-glyph-coverage.mts). */
export const SKY_DITHER_GLYPHS = ['.', '·', '░'] as const;

/** Scatter probability for a sky row: 0 at the zenith, ramping quadratically
 *  to ~0.22 at the horizon row. PURE — the smokeable band function. */
export function skyDitherDensity(row: number, skyH: number): number {
  if (skyH <= 1 || row <= 0 || row >= skyH) return 0;
  const t = row / (skyH - 1);
  return 0.22 * t * t;
}

/** Glyph for sky-depth t∈[0,1] (0 zenith → 1 horizon): light → heavy. */
export function skyDitherGlyph(t: number): string {
  return t < 0.45 ? SKY_DITHER_GLYPHS[0] : t < 0.8 ? SKY_DITHER_GLYPHS[1] : SKY_DITHER_GLYPHS[2];
}
```

In `composeLand`, insert immediately AFTER the near-ridge block (before the `// --- Terrain:` comment):

```ts
  // --- Dithered sky gradient (Tier 2): density-ramped ░·. scatter so the sky
  // reads as a gradient toward the horizon. Own salted PRNG (main rng
  // untouched); fills only cells still empty sky, so scatter stars, sun,
  // clouds and both ridge planes always sit in front. Structures drawn later
  // overwrite it, which is correct — they're nearer than the sky.
  const ditherRng = mulberry32((seed ^ SKY_DITHER_SALT) >>> 0);
  for (let y = 0; y < SKY_H; y++) {
    const d = skyDitherDensity(y, SKY_H);
    if (d <= 0) continue;
    const tRow = SKY_H > 1 ? y / (SKY_H - 1) : 1;
    for (let x = 0; x < cols; x++) {
      if (ditherRng.next() < d && role[y][x] === 'sky') set(x, y, skyDitherGlyph(tRow), 'skyDither');
    }
  }
```

*(The seam contract is untouched: the Tier-0 boundary covers the GROUND; sky texture already differs across wings, exactly like scatter stars.)*

- [ ] **Step 5: Tint it in the renderer**

In `src/render/levels/land.ts`, add to `ROLE_KEY`:

```ts
  skyDither: 'fgDim',
```

and to `FAR_FADE` (it is sky — it fades):

```ts
  skyDither: 0.55,
```

- [ ] **Step 6: Enumerate the new emitting surface in the coverage smoke**

In `scripts/smoke-glyph-coverage.mts`, extend the land import group (add a new import line beside the existing procedural imports):

```ts
import { SKY_DITHER_GLYPHS } from '../src/procedural/land.ts';
```

and after section `// 4. Activity shade ramp …`'s loop, add:

```ts
// 4b. Tier-2 sky dither vocabulary (src/procedural/land.ts) — imported real source.
for (const g of SKY_DITHER_GLYPHS) add(g, 'land.ts SKY_DITHER_GLYPHS');
```

- [ ] **Step 7: Run the smokes to verify they pass**

Run: `npx tsx scripts/smoke-sky-dither.mts && npx tsx scripts/smoke-glyph-coverage.mts`
Expected: `[smoke sky-dither] 11 assertions passed`; glyph-coverage green.

- [ ] **Step 8: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`

- [ ] **Step 9: Capture AFTER**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-2-dither-after.png
```

Expected vs before: the sky bands from clean (top) to visibly speckled `.`→`·`→`░` (just above the ridges) — a readable gradient toward the horizon in both windows.

- [ ] **Step 10: Commit**

```bash
git add src/procedural/land.ts src/render/levels/land.ts scripts/smoke-sky-dither.mts scripts/smoke-glyph-coverage.mts
git commit -m "feat(land): dithered sky gradient toward the horizon"
```

---

### Task 3: Structure glow — role-layer handles + monument/sun pulse

`buildLandContainer` exposes its per-role BitmapText layers; `terminalLand`'s tick pulses monuments (6A landmark-pulse envelope) and cycles the ☼ sun/lamps. Adds the harness `eval` verb for objective runtime readback.

**Files:**
- Modify: `src/render/levels/land.ts` (`buildLandContainer` returns `layers`)
- Modify: `src/terminal/terminalLand.ts` (glow knobs, tick block, `debugDepth`)
- Modify: `scripts/e2e/t0-drive.mjs` (`eval <tid> <js>` verb)

**Interfaces:**
- Produces: `buildLandContainer(theme, model): { container: Container; contentW: number; contentH: number; layers: Partial<Record<LandRole, BitmapText[]>> }` · `window.__terminal.debugDepth(): { monument: number | null; sun: number | null; foliageX: number[] }` · t0-drive verb `eval <tid> <js>`.
- Consumes: the Tier-0 `let scene = buildLandContainer(…)` structure (recompose reassigns `scene`, so the tick always reads live layers).

- [ ] **Step 1: Capture BEFORE (before any edit)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-3-glow-before.png
```

- [ ] **Step 2: Return the role layers**

In `src/render/levels/land.ts`, change `buildLandContainer`'s signature + doc:

```ts
/** Build the stacked-by-role tinted container for a land model. Local glyph
 *  space (origin 0,0); the caller positions + scales it. `layers` carries the
 *  tinted BitmapText objects per drawn role (multi-text roles — shaded hall
 *  steps — carry >1 entry) so the terminal renderer can animate a layer
 *  (glow / sway / wear) without rebuilding the scene. */
export function buildLandContainer(theme: Theme, model: LandModel): {
  container: Container;
  contentW: number;
  contentH: number;
  layers: Partial<Record<LandRole, BitmapText[]>>;
} {
```

Replace `addLayer` and the roles loop (keeping Task 1's fade math) with:

```ts
  const layers: Partial<Record<LandRole, BitmapText[]>> = {};
  const addLayer = (r: LandRole, text: string, fill: number) => {
    if (!text.trim()) return;
    const bt = new BitmapText({
      text,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill },
    });
    container.addChild(bt);
    (layers[r] ??= []).push(bt);
  };
  for (const r of roles) {
    const shadeGrid = model.shade;
    if (shadeGrid && SHADED_ROLES.has(r)) {
      // V0: vertical gradient — one layer per luminance step (≤4 extra
      // objects), tint scaled from the role's theme colour.
      for (let s = 0; s < GRADIENT_FACTORS.length; s++) {
        addLayer(
          r,
          layerFor((x, y) => model.role[y][x] === r && shadeGrid[y][x] === s),
          shadeOf(theme.palette[ROLE_KEY[r]], GRADIENT_FACTORS[s]),
        );
      }
    } else {
      const fade = FAR_FADE[r];
      const fill =
        fade !== undefined
          ? mixToward(theme.palette[ROLE_KEY[r]], theme.palette.bg, fade)
          : hexToInt(theme.palette[ROLE_KEY[r]]);
      addLayer(r, layerFor((x, y) => model.role[y][x] === r), fill);
    }
  }

  return { container, contentW, contentH, layers };
```

*(`mountLandView` / `mountLandPreview` destructure only what they use — additive return field, no other change.)*

- [ ] **Step 3: Pulse in the terminal tick**

In `src/terminal/terminalLand.ts`, add to the knob section (after `SPARK_S`):

```ts
/** Tier-2 structure glow: alpha pulse (the 6A landmark-pulse envelope). */
const GLOW_STRUCT_PERIOD_S = 2.8;
const GLOW_STRUCT_RANGE: [number, number] = [0.72, 1];
const GLOW_SUN_PERIOD_S = 4.2;
const GLOW_SUN_RANGE: [number, number] = [0.62, 1];
```

In `tick()`, insert right after the `for (const t of thresholds) …` line:

```ts
    // Tier-2 structure glow: monuments (and a hall, if one ever composes
    // here) pulse gently; ☼ sun/lamps cycle slower. Cos-eased off elapsedS
    // (deltaMS-accumulated), so it freezes cleanly under throttle.
    const glow = (periodS: number, [lo, hi]: [number, number]): number =>
      lo + (hi - lo) * (0.5 - 0.5 * Math.cos(((elapsedS % periodS) / periodS) * 2 * Math.PI));
    const structAlpha = glow(GLOW_STRUCT_PERIOD_S, GLOW_STRUCT_RANGE);
    for (const t of scene.layers.monument ?? []) t.alpha = structAlpha;
    for (const t of scene.layers.hall ?? []) t.alpha = structAlpha;
    const sunAlpha = glow(GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE);
    for (const t of scene.layers.sun ?? []) t.alpha = sunAlpha;
```

- [ ] **Step 4: Expose runtime readback for the harness**

In the `declare global` block, add to the `__terminal` type (after `debugPlace`):

```ts
      /** e2e only — live depth-cue readback (glow alphas + sway offsets). */
      debugDepth(): { monument: number | null; sun: number | null; foliageX: number[] };
```

In the `window.__terminal = {…}` object, add after `debugPlace`:

```ts
    debugDepth: () => ({
      monument: scene.layers.monument?.[0]?.alpha ?? null,
      sun: scene.layers.sun?.[0]?.alpha ?? null,
      foliageX: (scene.layers.foliage ?? []).map((t) => t.x),
    }),
```

- [ ] **Step 5: Add the `eval` verb to the T0 driver**

In `scripts/e2e/t0-drive.mjs`, add before the final `} else {` usage branch:

```js
  } else if (verb === 'eval') {
    const ts = await targets();
    const t = ts.find((x) => new URL(x.url).searchParams.get('terminal') === a1);
    if (!t) throw new Error(`no window for terminal ${a1}`);
    const { send, close } = await attach(t);
    try { console.log(JSON.stringify(await evalIn(send, a2))); } finally { close(); }
```

and update the usage line:

```js
    console.error('usage: t0-drive.mjs state | move <tid> <x> <y> | place <tid> <being> <x> <dir> | waitcross <being> [sec] | eval <tid> <js> | shot <out.png>');
```

- [ ] **Step 6: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`

- [ ] **Step 7: On-screen verification (objective + gallery)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs eval t1 'window.__terminal.debugDepth()'
sleep 1
node scripts/e2e/t0-drive.mjs eval t1 'window.__terminal.debugDepth()'
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-3-glow-after-a.png
sleep 2
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-3-glow-after-b.png
```

Expected: the two `debugDepth` reads show `monument` (when the wing has a mastered game) and `sun` alphas that DIFFER between calls and sit inside `[0.72,1]` / `[0.62,1]`; the two after shots show the monument/☼ at different brightness (motion evidence).

- [ ] **Step 8: Commit**

```bash
git add src/render/levels/land.ts src/terminal/terminalLand.ts scripts/e2e/t0-drive.mjs
git commit -m "feat(terminals): structure glow — monument + sun/lamp pulse via role layers"
```

---

### Task 4: Foliage sway — counter-phased sub-cell oscillation

The foliage role splits into two parity planes so the sway isn't lock-step; the tick offsets them ±`SWAY_PX` in antiphase. Sub-character animation is the medium's whole advantage.

**Files:**
- Modify: `src/render/levels/land.ts` (foliage parity split in the roles loop)
- Modify: `src/terminal/terminalLand.ts` (sway knobs + tick block)

**Interfaces:**
- Produces: `layers.foliage` carries TWO BitmapText planes (even / odd columns).
- Consumes: Task 3's `layers` map + `debugDepth().foliageX`.

- [ ] **Step 1: Capture BEFORE (before any edit)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-4-sway-before.png
```

- [ ] **Step 2: Split foliage into parity planes**

In `src/render/levels/land.ts`, replace the plain-role `else` branch (from Task 3) with:

```ts
    } else {
      const fade = FAR_FADE[r];
      const fill =
        fade !== undefined
          ? mixToward(theme.palette[ROLE_KEY[r]], theme.palette.bg, fade)
          : hexToInt(theme.palette[ROLE_KEY[r]]);
      if (r === 'foliage') {
        // Two parity planes so the terminal tick can counter-phase the sway
        // (lock-step trees read mechanical).
        addLayer(r, layerFor((x, y) => model.role[y][x] === r && x % 2 === 0), fill);
        addLayer(r, layerFor((x, y) => model.role[y][x] === r && x % 2 === 1), fill);
      } else {
        addLayer(r, layerFor((x, y) => model.role[y][x] === r), fill);
      }
    }
```

- [ ] **Step 3: Sway in the terminal tick**

In `src/terminal/terminalLand.ts`, add to the knob section (after `GLOW_SUN_RANGE`):

```ts
/** Tier-2 foliage sway: sub-cell x oscillation (local px; × WORLD_SCALE on
 *  screen), the parity planes counter-phased. Stays well under CW = 6. */
const SWAY_PX = 1.2;
const SWAY_HZ = 0.35;
```

In `tick()`, insert right after the sun-glow loop (Task 3's block):

```ts
    // Tier-2 foliage sway: sub-cell x offsets, parity planes counter-phased
    // (glyphs move BETWEEN cells — never snap-to-cell).
    const sway = Math.sin(elapsedS * SWAY_HZ * 2 * Math.PI) * SWAY_PX;
    (scene.layers.foliage ?? []).forEach((t, i) => {
      t.x = i % 2 === 0 ? sway : -sway;
    });
```

- [ ] **Step 4: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`

- [ ] **Step 5: On-screen verification (objective + gallery)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs eval t1 'window.__terminal.debugDepth().foliageX'
sleep 1
node scripts/e2e/t0-drive.mjs eval t1 'window.__terminal.debugDepth().foliageX'
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-4-sway-after-a.png
sleep 1
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-4-sway-after-b.png
```

Expected: `foliageX` is a 2-element array, the two elements opposite in sign, every |value| ≤ 1.2, and the values DIFFER between the two reads (live oscillation). The after pair shows ♣ glyphs at sub-cell offsets.

- [ ] **Step 6: Commit**

```bash
git add src/render/levels/land.ts src/terminal/terminalLand.ts
git commit -m "feat(terminals): foliage sway — counter-phased sub-cell oscillation"
```

---

### Task 5: Worn paths — footfall wear packs the crust (▀ → ▔)

Session-scoped renderer-side wear: beings' column entries accumulate; past a threshold the crust glyph swaps to the packed variant. Pure logic TDD'd; `▔` (U+2594, verified in the Cozette coverage snapshot) joins the glyph enumeration. No persistence this tier.

**Files:**
- Create: `src/terminal/wear.ts`
- Create: `scripts/smoke-worn-paths.mts`
- Modify: `src/terminal/terminalLand.ts` (footfall wiring, `lastCol`, `refreshWear`, recompose hook, `state().worn`, `debugWear`)
- Modify: `scripts/smoke-glyph-coverage.mts` (`WORN_CRUST_GLYPH` + spot check)

**Interfaces:**
- Produces: `export const WEAR_THRESHOLD = 8` · `export const WORN_CRUST_GLYPH = '▔'` · `export function createFootfall(threshold?: number): Footfall` with `Footfall = { step(col: number): boolean; readonly worn: ReadonlySet<number> }` · `export function crustLayerText(model: LandModel, worn: ReadonlySet<number>): string` · `TerminalLandState.worn: number[]` · `window.__terminal.debugWear(col: number, passes: number): boolean`.
- Consumes: Task 3's `scene.layers.crust`; the Tier-0 `recompose`.

- [ ] **Step 1: Capture BEFORE (before any edit)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-5-worn-before.png
```

- [ ] **Step 2: Write the failing smoke**

Create `scripts/smoke-worn-paths.mts`:

```ts
/**
 * Tier-2 depth smoke — `npx tsx scripts/smoke-worn-paths.mts`.
 * Locks the pure worn-path logic (src/terminal/wear.ts):
 *   - createFootfall: a column wears exactly when its count crosses the
 *     threshold, reports the crossing exactly once, and stays worn
 *   - crustLayerText: swaps ▀ → ▔ on worn columns ONLY, leaves every other
 *     cell untouched (renderer layer-text shape: trimmed rows, \n-joined)
 */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { createFootfall, crustLayerText, WEAR_THRESHOLD, WORN_CRUST_GLYPH } from '../src/terminal/wear.ts';

const { check, report } = makeChecker('smoke worn-paths');

// 1 · threshold semantics
const f = createFootfall(3);
check('below threshold: no wear', !f.step(10) && !f.step(10) && !f.worn.has(10));
check('crossing reports exactly once', f.step(10) === true && f.worn.has(10));
check('past threshold: worn stays, no re-report', f.step(10) === false && f.worn.has(10));
check('columns independent', !f.worn.has(11) && !f.step(11));
check('default threshold sane', WEAR_THRESHOLD >= 4 && WEAR_THRESHOLD <= 30);

// 2 · crust layer text: the swap is surgical
const m = composeLand(0xbee5, SAMPLE_LAND, { width: 60, skyH: 6, surfaceBand: 4, underH: 8, withPlayer: false });
const plain = crustLayerText(m, new Set());
const rowsPlain = plain.split('\n');
check('plain crust text carries crust glyphs', rowsPlain.some((r) => r.includes('▀')));
// Wear the first three columns whose crust cell survived composition
// (labels/shaft legitimately overwrite some ground-line cells).
const crustCols: number[] = [];
for (let x = 0; x < m.width && crustCols.length < 3; x++)
  if ((rowsPlain[m.surface[x]] ?? '')[x] === '▀') crustCols.push(x);
check('found 3 crust columns to wear', crustCols.length === 3, `cols=${crustCols.join(',')}`);
const wornSet = new Set(crustCols);
const rowsWorn = crustLayerText(m, wornSet).split('\n');
let diffs = 0;
let swapOk = true;
for (let y = 0; y < m.height; y++) {
  const a = rowsPlain[y] ?? '';
  const b = rowsWorn[y] ?? '';
  for (let x = 0; x < Math.max(a.length, b.length); x++) {
    if ((a[x] ?? ' ') !== (b[x] ?? ' ')) {
      diffs++;
      if (!wornSet.has(x) || (b[x] ?? ' ') !== WORN_CRUST_GLYPH) swapOk = false;
    }
  }
}
check('exactly the worn columns changed', diffs === 3, `diffs=${diffs}`);
check('changed cells became the worn glyph', swapOk);
check('worn glyph is ▔', WORN_CRUST_GLYPH === '▔');

report();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx scripts/smoke-worn-paths.mts`
Expected: FAIL — `src/terminal/wear.ts` does not exist.

- [ ] **Step 4: Create the pure wear module**

Create `src/terminal/wear.ts`:

```ts
/**
 * Worn paths (Tier-2 depth pass) — pure, session-scoped footfall wear.
 *
 * The terminal renderer counts a footfall each time a being ENTERS an
 * integer column (terminalLand tracks lastCol); past WEAR_THRESHOLD entries
 * the column's crust glyph packs down (▀ → ▔) — "paths wear deeper", the
 * agent-as-marginalia beat. Session-scoped: no persistence this tier.
 *
 * Pure + renderer-side: no PIXI, no procedural coupling — composeLand's
 * output is untouched (the determinism contract holds); wear is a live
 * re-text of the crust LAYER only.
 */

import type { LandModel } from '../procedural/land';

/** Column entries before the crust packs down. */
export const WEAR_THRESHOLD = 8;
/** Packed/worn crust variant (U+2594 UPPER ONE EIGHTH BLOCK — in the Cozette
 *  atlas; enumerated in scripts/smoke-glyph-coverage.mts). */
export const WORN_CRUST_GLYPH = '▔';

export interface Footfall {
  /** Record one column entry. Returns true exactly when this step crosses
   *  the wear threshold (the caller re-renders the crust layer). */
  step(col: number): boolean;
  /** Columns at/past the threshold. */
  readonly worn: ReadonlySet<number>;
}

export function createFootfall(threshold: number = WEAR_THRESHOLD): Footfall {
  const counts = new Map<number, number>();
  const worn = new Set<number>();
  return {
    step(col: number): boolean {
      const n = (counts.get(col) ?? 0) + 1;
      counts.set(col, n);
      if (n === threshold) {
        worn.add(col);
        return true;
      }
      return false;
    },
    worn,
  };
}

/** The crust role's full-grid layer text (the renderer's layerFor shape:
 *  rows trimmed of trailing spaces, '\n'-joined) with worn columns swapped
 *  to the packed variant. Pure — drives BitmapText.text on wear + recompose. */
export function crustLayerText(model: LandModel, worn: ReadonlySet<number>): string {
  const rows: string[] = [];
  for (let y = 0; y < model.height; y++) {
    let line = '';
    for (let x = 0; x < model.width; x++) {
      line += model.role[y][x] === 'crust' ? (worn.has(x) ? WORN_CRUST_GLYPH : model.char[y][x]) : ' ';
    }
    rows.push(line.replace(/\s+$/u, ''));
  }
  return rows.join('\n');
}
```

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-worn-paths.mts`
Expected: `[smoke worn-paths] 10 assertions passed`

- [ ] **Step 6: Wire footfall into the terminal renderer**

In `src/terminal/terminalLand.ts`:

Add the import beside the `buildLandContainer` import:

```ts
import { createFootfall, crustLayerText } from './wear';
```

Add to the `Being` interface (after `bobPhase`):

```ts
  /** Last integer column counted toward footfall wear. */
  lastCol: number;
```

Add to `TerminalLandState`:

```ts
  worn: number[];
```

Add to the `__terminal` type in `declare global` (after `debugDepth`):

```ts
      /** e2e only — force footfall on a column (n passes); true if worn. */
      debugWear(col: number, passes: number): boolean;
```

In `mountTerminalLand`, insert right after the `layoutWorld();` call (BEFORE `recompose`):

```ts
  // ── Worn paths (Tier 2): session-scoped footfall wear ──────────────────
  // Column entries accumulate; past WEAR_THRESHOLD the crust packs down
  // (▀ → ▔) — paths wear deeper where beings actually walk.
  const footfall = createFootfall();
  const refreshWear = (): void => {
    const crust = scene.layers.crust?.[0];
    if (crust) crust.text = crustLayerText(model, footfall.worn);
  };
```

In `recompose`, add after its `layoutWorld();` line:

```ts
    refreshWear(); // worn columns survive a join recompose
```

In `addBeing`'s `Being` literal, add after `bobPhase: …,`:

```ts
      lastCol: Math.round(x),
```

In `tick()`, add at the bottom of the beings loop, right after the `b.text.y = …` line:

```ts
      // Footfall: count column ENTRIES (not frames) toward path wear.
      const col = Math.round(b.x);
      if (col !== b.lastCol) {
        b.lastCol = col;
        if (footfall.step(col)) refreshWear();
      }
```

In `window.__terminal`'s `state()` return, add:

```ts
      worn: [...footfall.worn].sort((a, b) => a - b),
```

and add after `debugDepth`:

```ts
    debugWear: (col, passes) => {
      let crossed = false;
      for (let i = 0; i < passes; i++) if (footfall.step(col)) crossed = true;
      if (crossed) refreshWear();
      return footfall.worn.has(col);
    },
```

- [ ] **Step 7: Enumerate the new glyph**

In `scripts/smoke-glyph-coverage.mts`, add the import:

```ts
import { WORN_CRUST_GLYPH } from '../src/terminal/wear.ts';
```

after the `// 4b.` dither loop (Task 2), add:

```ts
// 4c. Tier-2 worn-path crust variant (src/terminal/wear.ts) — imported real source.
add(WORN_CRUST_GLYPH, 'wear.ts WORN_CRUST_GLYPH (worn crust)');
```

and add a spot assertion beside the other block-element checks:

```ts
check('▔ worn-path crust covered', covered(0x2594));
```

- [ ] **Step 8: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`

- [ ] **Step 9: On-screen verification (objective + gallery)**

Run the relaunch recipe, then force a worn band and observe the swap:

```bash
node scripts/e2e/t0-drive.mjs eval t1 'Array.from({length: 14}, (_, i) => window.__terminal.debugWear(20 + i, 8)).every(Boolean)'
node scripts/e2e/t0-drive.mjs eval t1 'window.__terminal.state().worn.length'
node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-5-worn-after.png
```

Expected: first eval prints `true`, second prints `14`; the after shot shows a packed `▔` band along columns 20–33 of t1's ground line where the before shot shows `▀`. (Organic wear also accrues from real wander over a session — the debug hook only accelerates the screenshot.)

- [ ] **Step 10: Commit**

```bash
git add src/terminal/wear.ts src/terminal/terminalLand.ts scripts/smoke-worn-paths.mts scripts/smoke-glyph-coverage.mts
git commit -m "feat(terminals): worn paths — footfall wear packs the crust (▀→▔)"
```

---

### Task 6: Knit-sweep polish — glyph trail + seam ground glow

The Tier-0 single-`█` sweep gains a 3-glyph trail and a brief brightening of the seam ground that outlives the sweep by a beat. Rewrites Tier-0 Task 5's knit code in place.

**Files:**
- Modify: `src/terminal/terminalLand.ts` (knit constants, `knits` shape, `startKnit`, tick block)
- Modify: `scripts/smoke-glyph-coverage.mts` (knit trail provenance entry)

**Interfaces:**
- Produces: internal `startKnit(side: 'left' | 'right'): void` (same signature — `applyJoins`'s Tier-0 call sites are untouched).
- Consumes: Tier-0 `KNIT_S`/`KNIT_SPAN`, `model.surface`, `elapsedS`.

- [ ] **Step 1: Capture BEFORE (before any edit — drive a re-snap to fire the Tier-0 knit)**

Run the relaunch recipe, then:

```bash
node scripts/e2e/t0-drive.mjs move t2 900 160
node scripts/e2e/t0-drive.mjs move t2 700 160 && \
  node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-6-knit-before-a.png && \
  node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-6-knit-before-b.png
```

- [ ] **Step 2: Extend the knit constants + state**

In `src/terminal/terminalLand.ts`, replace the Tier-0 knit constants block with:

```ts
/** Knit-sweep: a one-shot glow that runs across a newly-joined seam. */
const KNIT_S = 0.6;
const KNIT_SPAN = 6; // columns the sweep travels inward from the seam
/** Tier-2 polish: the sweep carries a trail; the seam ground brightens. */
const KNIT_TRAIL = ['█', '▓', '▒'] as const; // head → tail
const KNIT_GLOW_S = 0.9; // ground-brightening outlives the sweep a beat
```

Replace the Tier-0 `knits` declaration with:

```ts
  const knits: Array<{
    side: 'left' | 'right';
    bornAt: number;
    /** Sweep head + trail glyphs (KNIT_TRAIL order), repositioned per tick. */
    trail: BitmapText[];
    /** One brightened crust glyph per seam column, fading in place. */
    glow: BitmapText[];
  }> = [];
```

- [ ] **Step 3: Rebuild the spawner**

Replace the Tier-0 `startKnit` with:

```ts
  const startKnit = (side: 'left' | 'right'): void => {
    const mk = (glyph: string): BitmapText =>
      new BitmapText({
        text: glyph,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
      });
    const trail = KNIT_TRAIL.map((g) => {
      const t = mk(g);
      t.alpha = 0; // positioned on the first tick
      world.addChild(t);
      return t;
    });
    const glow: BitmapText[] = [];
    for (let i = 0; i < KNIT_SPAN; i++) {
      const col = side === 'left' ? i : model.width - 1 - i;
      const g = mk(model.char[model.surface[col]][col]); // the crust glyph, brightened
      g.x = col * CW;
      g.y = model.surface[col] * CH;
      g.alpha = 0.75;
      world.addChild(g);
      glow.push(g);
    }
    knits.push({ side, bornAt: elapsedS, trail, glow });
  };
```

- [ ] **Step 4: Rebuild the tick animation**

Replace the Tier-0 knit block in `tick()` with:

```ts
    // Knit sweeps: a bright head + 2-glyph trail runs inward from the seam
    // along the (continuous) ground while the seam ground itself brightens,
    // then everything fades (the glow outlives the sweep by KNIT_GLOW_S − KNIT_S).
    for (let i = knits.length - 1; i >= 0; i--) {
      const k = knits[i];
      const p = (elapsedS - k.bornAt) / KNIT_S;
      const q = (elapsedS - k.bornAt) / KNIT_GLOW_S;
      if (p >= 1 && k.trail.length > 0) {
        for (const t of k.trail) t.destroy();
        k.trail.length = 0;
      }
      if (k.trail.length > 0) {
        const dirIn = k.side === 'left' ? 1 : -1;
        const headCol =
          k.side === 'left'
            ? Math.min(model.width - 1, Math.round(p * KNIT_SPAN))
            : Math.max(0, model.width - 1 - Math.round(p * KNIT_SPAN));
        k.trail.forEach((t, j) => {
          const col = Math.min(model.width - 1, Math.max(0, headCol - dirIn * j));
          t.x = col * CW;
          t.y = (model.surface[col] - 1) * CH;
          t.alpha = Math.max(0, (1 - p) * (1 - j * 0.3));
        });
      }
      if (q >= 1) {
        for (const g of k.glow) g.destroy();
        knits.splice(i, 1);
        continue;
      }
      for (const g of k.glow) g.alpha = 0.75 * (1 - q);
    }
```

- [ ] **Step 5: Document the trail glyphs in the coverage smoke**

In `scripts/smoke-glyph-coverage.mts`, add to `RENDERER_LITERALS`:

```ts
  // Tier-2 knit-sweep trail (terminalLand.ts startKnit/tick) — all covered.
  ['█▓▒', 'terminalLand.ts knit-sweep trail'],
```

- [ ] **Step 6: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done`

- [ ] **Step 7: On-screen verification (gallery)**

Run the relaunch recipe, then drive an un-snap → re-snap and shoot fast:

```bash
node scripts/e2e/t0-drive.mjs move t2 900 160
node scripts/e2e/t0-drive.mjs move t2 700 160 && \
  node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-6-knit-after-a.png && \
  node scripts/e2e/t0-drive.mjs shot /tmp/loki-join/gallery/tier2-6-knit-after-b.png
```

Expected vs the before pair: the sweep is no longer a lone `█` — a `█▓▒` comet runs inward from each seam edge, and the ground line's first 6 seam columns glow bright and fade over ~0.9 s (visible in at least one after shot; the two shots differ = motion evidence). Un-joined edges never fire it.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/terminalLand.ts scripts/smoke-glyph-coverage.mts
git commit -m "feat(terminals): knit-sweep polish — glyph trail + seam ground glow"
```

---

## Self-Review

**Spec coverage:**
- (a) Atmospheric perspective → Task 1 (`ridgeFar` third plane, `mixToward` + `FAR_FADE` fade toward `bg`, no new palette entries). ✓
- (b) Dithered sky gradient → Task 2 (pure `skyDitherDensity`/`skyDitherGlyph`, seeded, smoked; `░·.` vocabulary). ✓
- (c) Structure glow → Task 3 (monument + hall pulse, ☼ sun/lamp slow cycle, 6A envelope, `elapsedS`-driven). ✓
- (d) Foliage sway → Task 4 (sub-cell x oscillation, counter-phased parity planes). ✓
- (e) Worn paths → Task 5 (renderer-side footfall per column ENTRY, threshold swap `▀ → ▔`, session-scoped, survives recompose; `▔` verified in the Cozette snapshot and enumerated). ✓
- (f) Knit polish → Task 6 (`█▓▒` trail + seam ground-brightening). ✓
- Every item: pure smoke where the logic is pure (Tasks 1/2/5) + before/after gallery pair in `/tmp/loki-join/gallery/` with exact capture commands (all tasks); motion items add second-shot/eval evidence. No scroll-parallax anywhere — windows are fixed; all cues static or ticker-driven. No LLM/network anywhere. ✓

**Determinism:** both new procedural fields use their own salted PRNGs (`0xfa42`, `0xd174` — distinct from all reserved salts), so the main `rng` sequence, the surface silhouette, structures, caverns and the Tier-0 seam ramp are byte-identical to pre-Tier-2; `smoke-land-seam` stays green (its byte-identity checks compare same-code calls).

**Placeholder scan:** none — every code step carries the actual code; every capture step carries concrete filenames.

**Type consistency:** `layers: Partial<Record<LandRole, BitmapText[]>>` defined in Task 3 and consumed in Tasks 3/4/5 via `scene.layers.<role>`; `mixToward(string, string, number): number` and `FAR_FADE` defined in Task 1, consumed in Tasks 1/2 smokes + renderer; `createFootfall/crustLayerText/WORN_CRUST_GLYPH/WEAR_THRESHOLD` defined in Task 5's `wear.ts` exactly as imported by its smoke and `terminalLand.ts`; `startKnit(side)` keeps its Tier-0 signature so `applyJoins` is untouched in Task 6.

**Ordering:** Tasks 1–2 are procedural+renderer only (each independently landable); Task 3 introduces the `layers` handle + the `eval` harness verb that Tasks 4–5 consume; Task 6 only needs Tier-0. Run in order 1→6; each task boundary is green (typecheck both legs + full sweep + commit).

### Critical Files for Implementation
- /Users/henrydemontfort/code/projects/Lokilibrary/src/procedural/land.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/render/levels/land.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/terminal/terminalLand.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/scripts/smoke-glyph-coverage.mts
- /Users/henrydemontfort/code/projects/Lokilibrary/scripts/e2e/t0-drive.mjs