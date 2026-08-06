# Land Polish #19 Slice 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the terminal land its slice-2 depth pass — a real monument with a door, constellations in the salted sky, ore veins in the deep strata, sign posts at surface sites, and renderer-side drifting cloud wisps.

**Architecture:** One deliberate compose-side upgrade in `src/procedural/land.ts` (monument, constellations, ore, posts — changes composed bytes once; goldens re-frozen once in a dedicated commit), plus a pure cloud-drift maths module (`src/terminal/clouds.ts`) consumed by `src/terminal/terminalLand.ts`'s existing tick. Four new land roles enter the theme plumbing. Spec: `docs/superpowers/specs/2026-08-05-land-polish-slice2-design.md`.

**Tech Stack:** TypeScript strict, PixiJS v8 BitmapText, mulberry32/fnv1a determinism, tsx smoke scripts (`npx tsx scripts/smoke-*.mts`).

## Global Constraints

- **Determinism in `src/procedural/`**: all randomness via the existing `rng` / `skyRng` (mulberry32). No `Math.random()`, no `Date.now()` in that module. (`Date.now()` IS allowed in `src/terminal/` — the drift clock uses it deliberately.)
- **Atlas gate**: every new glyph literal must be covered by `scripts/lib/cozette-coverage.json`. All glyphs in this plan were pre-checked on 2026-08-06: `╔ ═ ╗ ║ ▪ ▐ █ ▌ ▯ ☼ ◆ ┬ │ ✦ ·` are ALL covered. Do not substitute a glyph without re-checking (`⟡`, for example, is NOT covered).
- **No new `ComposeLandOptions`**: the compose changes are unconditional (the deliberate re-roll). Do not add flags.
- **Byte-change discipline**: tasks 2–5 change composed bytes, so `scripts/smoke-land-mural.mts` (frozen golden hashes) goes red from Task 2 until Task 6 re-freezes it. That is EXPECTED and intended (spec: goldens re-frozen ONCE, in a dedicated commit). Each task's own smokes and `npm run typecheck` must be green before its commit; do not "fix" the mural golden early, and do not weaken any placement-rule assertion to get a smoke green.
- **Style-pack locks**: `door` is glyph-locked and omit-locked. `monumentCrown`, `ore`, `signpost` are dialect/ramp/omit-allowed.
- **Commits**: message style `feat(land): …` / `test: …` / `docs: …`, each ending with the Claude Code co-author trailer.
- **Verification platform**: macOS only. Typecheck = `npm run typecheck` (checks both tsconfig legs).

---

### Task 1: New roles + theme plumbing

**Files:**
- Modify: `src/procedural/land.ts` (the `LandRole` union, ~line 46–74)
- Modify: `src/render/levels/land.ts` (`ROLE_KEY` ~line 114, `LAND_GLYPH_LOCKED` ~line 154)
- Modify: `src/themes/gameboy-dmg.json` (`landOmit`, line 23)

**Interfaces:**
- Consumes: existing `LandRole` union, `ROLE_KEY: Record<LandRole, keyof Theme['palette']>`, `LAND_GLYPH_LOCKED: ReadonlySet<LandRole>`.
- Produces: `LandRole` gains `'monumentCrown' | 'door' | 'ore' | 'signpost'` — every later task stamps cells with these role strings. `ROLE_KEY` entries: `monumentCrown: 'yellow'`, `door: 'blue'`, `ore: 'yellow'`, `signpost: 'fgDim'`. `door` in `LAND_GLYPH_LOCKED` (and therefore automatically in `LAND_OMIT_LOCKED`, which is derived from it).

- [ ] **Step 1: Extend the `LandRole` union**

In `src/procedural/land.ts`, after the `| 'wingMark';` line, change it to:

```ts
  | 'wingMark'      // the faint wing id under its silhouette
  | 'monumentCrown' // the monument's ☼ finial (#19 slice 2 — own role, so packs choose crown visibility independently of their sky)
  | 'door'          // the monument's ground-level opening (glyph-locked; the future launcher beat lands here)
  | 'ore'           // mineral glints in stone/bedrock (#19 slice 2)
  | 'signpost';     // standing post at a surface site — the proximity label's furniture (#19 slice 2)
```

- [ ] **Step 2: Run typecheck to see the exhaustiveness failure**

Run: `npm run typecheck`
Expected: FAIL — `ROLE_KEY` in `src/render/levels/land.ts` no longer covers `LandRole` (it is a total `Record`). This failing typecheck is this task's "failing test".

- [ ] **Step 3: Add the `ROLE_KEY` entries and the `door` lock**

In `src/render/levels/land.ts`, add to `ROLE_KEY` after the `wingMark: 'fgDim',` line:

```ts
  monumentCrown: 'yellow', // the old ☼ borrowed 'sun' (also yellow) — same look, decoupled role
  door: 'blue', // apertures are blue (the seam/door/window dialect, ROLE_DEFAULTS.seam)
  ore: 'yellow',
  signpost: 'fgDim',
```

In `LAND_GLYPH_LOCKED`, add after the `'wingMark'` entry (keep its comment style):

```ts
  'door', // a door that dialects into noise stops reading as a door; omit-locked via derivation too
```

- [ ] **Step 4: Add `monumentCrown` to gameboy-dmg's omit list**

In `src/themes/gameboy-dmg.json` line 23, change `landOmit` to:

```json
  "landOmit": ["star", "starBright", "skyDither", "cloud", "ridgeFar", "moon", "sun", "wingSil", "wingMark", "monumentCrown"],
```

(10 entries — `OMIT_MAX` in `scripts/smoke-style-pack.mts` is 12, so no cap change. This is the pack-identity edit the spec records: DMG's judged blank-crown look becomes explicit instead of an accident of role-borrowing.)

- [ ] **Step 5: Run typecheck and the style-pack smoke**

Run: `npm run typecheck && npx tsx scripts/smoke-style-pack.mts`
Expected: both PASS. The style-pack corpus count grows (it derives roles from `ROLE_KEY` at runtime); note the new count printed — STATE.md's "corpus 301" gets updated in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/procedural/land.ts src/render/levels/land.ts src/themes/gameboy-dmg.json
git commit -m "feat(land): #19 slice 2 roles — monumentCrown, door, ore, signpost"
```

---

### Task 2: Monument architecture + door

**Files:**
- Modify: `src/procedural/land.ts` (constants near line 27; the `mastered` branch, ~line 479–481)
- Create: `scripts/smoke-land-monument.mts`

**Interfaces:**
- Consumes: Task 1's roles; existing `put(x, y, s, role)` / `set(x, y, c, role)` helpers inside `composeLand`; `surfaceY(x)`.
- Produces: exports from `src/procedural/land.ts`: `MONUMENT_BODY: readonly string[]` (7 rows, 3 cols, top→bottom), `MONUMENT_CROWN = '☼'`, `MONUMENT_DOOR = '▯'`. Task 6 imports these in the glyph-coverage smoke.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-land-monument.mts`:

```ts
/** Monument smoke — `npx tsx scripts/smoke-land-monument.mts`.
 *  Land polish #19 slice 2: the mastered-game monument is real architecture
 *  (cap course, window slits, block body) with a ground-level door and a
 *  crown that owns its own role — a sun-omit no longer blanks it. */
import { makeChecker } from './lib/smoke.ts';
import {
  composeLand, MONUMENT_BODY, MONUMENT_CROWN, MONUMENT_DOOR, type LandGame,
} from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-monument');

const GAMES: LandGame[] = [
  { name: 'hades', state: 'mastered' },
  { name: 'celeste', state: 'loved' },
  { name: 'stardew', state: 'recent' },
];
const T = { width: 80, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;

for (const seed of [7, 41, 113]) {
  const m = composeLand(seed, GAMES, T);
  const cells = (role: string) => {
    const out: Array<{ x: number; y: number; c: string }> = [];
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++)
        if (m.role[y][x] === role) out.push({ x, y, c: m.char[y][x] });
    return out;
  };

  const doors = cells('door');
  check(`seed ${seed}: exactly one door`, doors.length === 1, String(doors.length));
  check(`seed ${seed}: door glyph`, doors.every((d) => d.c === MONUMENT_DOOR));
  const door = doors[0];
  check(`seed ${seed}: door at surface-1`, door.y === m.surface[door.x] - 1,
    `door y ${door.y} surface ${m.surface[door.x]}`);

  const crowns = cells('monumentCrown');
  check(`seed ${seed}: exactly one crown`, crowns.length === 1, String(crowns.length));
  check(`seed ${seed}: crown glyph`, crowns.every((k) => k.c === MONUMENT_CROWN));
  check(`seed ${seed}: crown tops the body`, crowns[0].y === door.y - MONUMENT_BODY.length,
    `crown y ${crowns[0].y} door y ${door.y}`);
  check(`seed ${seed}: crown shares the door column`, crowns[0].x === door.x);

  // Decoupling: no 'sun'-role cell inside the monument's own rect (the sky
  // sun may legitimately share the column high above — constrain by row).
  const suns = cells('sun').filter(
    (s) => Math.abs(s.x - door.x) <= 1 && s.y >= crowns[0].y && s.y <= door.y,
  );
  check(`seed ${seed}: no sun-role cell on the monument`, suns.length === 0);

  // Body vocabulary: every monument-role glyph comes from MONUMENT_BODY rows.
  const vocab = new Set(MONUMENT_BODY.join('').split(''));
  check(`seed ${seed}: body glyphs from the exported rows`,
    cells('monument').every((b) => vocab.has(b.c)));

  // Determinism.
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, GAMES, T)));
}

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-monument.mts`
Expected: FAIL — `MONUMENT_BODY` is not exported yet.

- [ ] **Step 3: Implement the monument**

In `src/procedural/land.ts`, add near the other V0 knob constants (after `POSTER_H`):

```ts
// Land polish #19 slice 2: the mastered-game monument — real architecture
// (cap course, window slits, block body, ground-level door) instead of the
// old bare column. 3 wide × 7 tall + crown: still the tallest structure
// class. Exported for smoke-land-monument + smoke-glyph-coverage.
export const MONUMENT_BODY = ['╔═╗', '║▪║', '║ ║', '║▪║', '▐█▌', '▐█▌', '▐█▌'] as const;
export const MONUMENT_CROWN = '☼';
export const MONUMENT_DOOR = '▯';
```

Replace the `mastered` branch (currently the `for (let h = 1; h <= 6; …)` loop plus the `set(x, gy - 7, '☼', 'sun');` line) with:

```ts
    if (p.state === 'mastered') {
      // #19 slice 2: architecture rows top→bottom, door punched into the
      // bottom-centre cell, crown on its OWN role (a pack's sun-omit no
      // longer blanks it — gameboy-dmg omits monumentCrown explicitly).
      MONUMENT_BODY.forEach((row, i) => put(x - 1, gy - MONUMENT_BODY.length + i, row, 'monument'));
      set(x, gy - 1, MONUMENT_DOOR, 'door');
      set(x, gy - MONUMENT_BODY.length - 1, MONUMENT_CROWN, 'monumentCrown');
    }
```

- [ ] **Step 4: Run the smoke and typecheck**

Run: `npx tsx scripts/smoke-land-monument.mts && npm run typecheck`
Expected: both PASS. (`scripts/smoke-land-mural.mts` is now red — expected until Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/procedural/land.ts scripts/smoke-land-monument.mts
git commit -m "feat(land): #19 slice 2 monument — architecture rows, door, own-role crown"
```

---

### Task 3: Constellations

**Files:**
- Modify: `src/procedural/land.ts` (export near the sky constants; stamping after the cloud `put(...)` lines, ~line 339)
- Create: `scripts/smoke-land-constellations.mts`

**Interfaces:**
- Consumes: `skyRng` (the salted celestial PRNG), `SKY_H`, `cols`, the `role` grid and `set` helper, all in scope at the insertion point; existing glyphs `✦` (from `SKY_SCATTER_BRIGHT`) and `·` (from `SKY_SCATTER_DIM`) — no new glyphs.
- Produces: export `CONSTELLATIONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>>` (point 0 = bright anchor). Figures stamped as `star`/`starBright` role cells — blank-sky packs stay blank with zero edits.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-land-constellations.mts`:

```ts
/** Constellation smoke — `npx tsx scripts/smoke-land-constellations.mts`.
 *  #19 slice 2: figures are ARRANGEMENTS of the existing star roles — the
 *  patch loses its scatter (figures replace, never add), sun and moon always
 *  survive, and blank-sky packs need zero edits because no new role exists. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, CONSTELLATIONS, SAMPLE_LAND } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-constellations');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;

check('figure library has 3 figures', CONSTELLATIONS.length === 3);
check('figures are 4–6 points', CONSTELLATIONS.every((f) => f.length >= 4 && f.length <= 6));

let found = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, T);
  // A stamped figure = some origin where point 0 is '✦' and every other
  // point is '·' at exactly the figure's offsets.
  const isFigureAt = (fig: ReadonlyArray<readonly [number, number]>, ox: number, oy: number) =>
    fig.every(([dx, dy], i) =>
      m.char[oy + dy]?.[ox + dx] === (i === 0 ? '✦' : '·'));
  let hits = 0;
  for (const fig of CONSTELLATIONS)
    for (let oy = 0; oy < 8; oy++)
      for (let ox = 0; ox < m.width - 6; ox++)
        if (isFigureAt(fig, ox, oy)) hits++;
  if (hits > 0) found++;

  const roleCount = (r: string) => {
    let n = 0;
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) if (m.role[y][x] === r) n++;
    return n;
  };
  check(`seed ${seed}: sun survives`, roleCount('sun') >= 1);
  check(`seed ${seed}: moon survives`, roleCount('moon') === 1);
  check(`seed ${seed}: scatter still exists`, roleCount('star') + roleCount('starBright') > 10);
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, SAMPLE_LAND, T)));
}
// Placement re-rolls may legitimately fail on a crowded strip — but across
// 5 seeds at width 120, figures must land most of the time.
check('figures found on >= 4 of 5 seeds', found >= 4, String(found));

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-constellations.mts`
Expected: FAIL — `CONSTELLATIONS` is not exported.

- [ ] **Step 3: Implement**

In `src/procedural/land.ts`, add near `SKY_SCATTER_BRIGHT`:

```ts
/** #19 slice 2 constellation figures — [dx, dy] offsets; point 0 is the
 *  bright anchor (`✦`), the rest dim (`·`). Arrangements of the existing
 *  star roles, so blank-sky packs stay blank by construction. Exported for
 *  scripts/smoke-land-constellations.mts. */
export const CONSTELLATIONS = [
  [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1]],         // the W
  [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [4, 2]], // the plough
  [[0, 2], [1, 1], [2, 0], [3, 1]],                 // the arc
] as const; // as const, NOT an explicit annotation — bare [0, 1] literals widen to number[] and break the [dx, dy] destructuring
```

Immediately after the two cloud `put(...)` lines in the celestial pass, insert:

```ts
  // Constellations (#19 slice 2): 2–3 recognisable figures stamped from the
  // star roles — arrangements, not material. Each figure clears the scatter
  // in its patch first (figures REPLACE scatter; local density stays calm)
  // and only lands where every point sits on a sky-register cell, so the
  // sun, moon and clouds always survive. ≤8 placement re-rolls (the skyline
  // precedent); a crowded sky keeps its scatter — a missing figure is fine.
  const clearable = (r: LandRole | undefined): boolean =>
    r === 'sky' || r === 'star' || r === 'starBright' || r === 'skyDither';
  const figureCount = skyRng.next() < 0.5 ? 2 : 3;
  for (let f = 0; f < figureCount; f++) {
    const fig = CONSTELLATIONS[f % CONSTELLATIONS.length];
    const fw = Math.max(...fig.map(([dx]) => dx)) + 1;
    const fh = Math.max(...fig.map(([, dy]) => dy)) + 1;
    let ox = 0;
    let oy = 0;
    let ok = false;
    for (let tries = 0; tries < 8 && !ok; tries++) {
      ox = skyRng.range(2, Math.max(3, cols - fw - 2));
      oy = skyRng.range(1, Math.max(2, Math.floor(SKY_H / 2)));
      ok = fig.every(([dx, dy]) => clearable(role[oy + dy]?.[ox + dx]));
    }
    if (!ok) continue;
    for (let yy = oy - 1; yy <= oy + fh; yy++)
      for (let xx = ox - 1; xx <= ox + fw; xx++)
        if (role[yy]?.[xx] === 'star' || role[yy]?.[xx] === 'starBright') set(xx, yy, ' ', 'sky');
    fig.forEach(([dx, dy], i) =>
      set(ox + dx, oy + dy, i === 0 ? '✦' : '·', i === 0 ? 'starBright' : 'star'));
  }
```

- [ ] **Step 4: Run the smoke and typecheck**

Run: `npx tsx scripts/smoke-land-constellations.mts && npm run typecheck`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/procedural/land.ts scripts/smoke-land-constellations.mts
git commit -m "feat(land): #19 slice 2 constellations — star-role figures replace scatter"
```

---

### Task 4: Ore veins

**Files:**
- Modify: `src/procedural/land.ts` (export near the sky constants; stamping after the abandoned-relics block, ~line 513)
- Create: `scripts/smoke-land-ore.mts`

**Interfaces:**
- Consumes: `rng` (the main land PRNG), `role` grid, `set`, `groundLine`, `topsoilD`, `UNDER_H`, `cols` — all in scope at the insertion point.
- Produces: export `ORE_GLYPH = '◆'`. Ore cells carry role `'ore'` and only ever replace `stone`/`bedrock` cells — the role guard IS the placement rule.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-land-ore.mts`:

```ts
/** Ore-vein smoke — `npx tsx scripts/smoke-land-ore.mts`.
 *  #19 slice 2: short diagonal glints in stone/bedrock. The stone-or-bedrock
 *  role guard at stamp time is the whole placement rule — caverns, topsoil,
 *  the shaft and relics are excluded by construction; these checks pin the
 *  observable consequences. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, ORE_GLYPH, SAMPLE_LAND, type LandRole } from '../src/procedural/land.ts';
import { strataMaterialGlyph } from '../src/render/levels/land.ts';
const { check, report } = makeChecker('smoke land-ore');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 10, withPlayer: false } as const;

let totalOre = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, T);
  const ore: Array<{ x: number; y: number; c: string }> = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++)
      if (m.role[y][x] === 'ore') ore.push({ x, y, c: m.char[y][x] });
  totalOre += ore.length;

  check(`seed ${seed}: ore glyph is ORE_GLYPH`, ore.every((o) => o.c === ORE_GLYPH));
  // Depth: strictly underground. (The stronger no-topsoil rule is enforced by
  // the stone-or-bedrock role guard at stamp time; strata bands key off
  // groundLine while the surface rolls ±2 per column, so a fixed surface+N
  // depth check here would flake on low-ground columns.)
  check(`seed ${seed}: ore strictly underground`, ore.every((o) => o.y > m.surface[o.x]),
    JSON.stringify(ore.filter((o) => o.y <= m.surface[o.x])));
  // Sparse: 2–4 veins × ≤4 cells = 16 max per strip.
  check(`seed ${seed}: ore stays sparse (<= 16 cells)`, ore.length <= 16, String(ore.length));
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, SAMPLE_LAND, T)));
}
check('ore exists across the seed set', totalOre >= 5, String(totalOre));

// The slice-1 material pass must leave ore alone: ore is not a strata-fill
// role, so the run-coherent redraw returns null for it.
check('material pass ignores ore', strataMaterialGlyph('ore' as LandRole, 3, 3) === null);

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-ore.mts`
Expected: FAIL — `ORE_GLYPH` is not exported.

- [ ] **Step 3: Implement**

In `src/procedural/land.ts`, add next to the `MONUMENT_*` exports:

```ts
/** #19 slice 2 ore glyph — exported for smoke-land-ore + smoke-glyph-coverage. */
export const ORE_GLYPH = '◆';
```

Immediately after the abandoned-relics `forEach` block (before the beings loop), insert:

```ts
  // Ore veins (#19 slice 2): short diagonal glints through stone/bedrock.
  // The role guard at stamp time is the whole placement rule — a vein cell
  // only lands where stone or bedrock already is, so caverns (role 'sky' /
  // 'cavern'), topsoil, the shaft and relics are excluded by construction.
  // Sparse by count cap: 2–4 veins × 2–4 cells.
  const veinCount = 2 + rng.range(0, 3);
  for (let v = 0; v < veinCount; v++) {
    let vx = rng.range(2, cols - 2);
    let vy = groundLine + topsoilD + 1 + rng.range(0, Math.max(1, UNDER_H - topsoilD - 2));
    const vdx = rng.next() < 0.5 ? -1 : 1;
    const len = 2 + rng.range(0, 3);
    for (let c = 0; c < len; c++) {
      const r = role[vy]?.[vx];
      if (r === 'stone' || r === 'bedrock') set(vx, vy, ORE_GLYPH, 'ore');
      vx += vdx;
      vy += 1;
    }
  }
```

- [ ] **Step 4: Run the smoke and typecheck**

Run: `npx tsx scripts/smoke-land-ore.mts && npm run typecheck`
Expected: both PASS. If `ore exists across the seed set` fails (over-strict guard at this geometry), inspect with a quick `npx tsx` REPL compose — the fix is widening the seed set or the `underH` in `T`, NOT loosening the role guard.

- [ ] **Step 5: Commit**

```bash
git add src/procedural/land.ts scripts/smoke-land-ore.mts
git commit -m "feat(land): #19 slice 2 ore veins — diagonal glints, role-guarded to stone/bedrock"
```

---

### Task 5: Sign posts

**Files:**
- Modify: `src/procedural/land.ts` (exports; stamping after the trees loop, ~line 535, before the labels pass)
- Create: `scripts/smoke-land-signpost.mts`

**Interfaces:**
- Consumes: the `labels` working array (`{x, y, text, kind}` entries, in scope), `surfaceY(x)`, `inJoinBuffer(x)`, `hallSpan`, `role` grid, `set`.
- Produces: exports `SIGNPOST_GLYPHS = ['┬', '│'] as const` (head over post) and `SIGNPOST_OFFSET = 3`. Posts carry role `'signpost'`; `model.sites` and the proximity-reveal path are untouched.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-land-signpost.mts`:

```ts
/** Sign-post smoke — `npx tsx scripts/smoke-land-signpost.mts`.
 *  #19 slice 2: a small standing post beside each surface site — furniture
 *  for the proximity-revealed name. Collision → skip (a missing post is
 *  fine, a mangled one is not); buried relics get no post; the reveal path
 *  (model.sites) is untouched. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SIGNPOST_GLYPHS, SAMPLE_LAND } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-signpost');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;

let totalPosts = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, T);
  const posts: Array<{ x: number; y: number; c: string }> = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++)
      if (m.role[y][x] === 'signpost') posts.push({ x, y, c: m.char[y][x] });

  // Posts come in vertical pairs: head at surface-2, post at surface-1.
  const cols = [...new Set(posts.map((p) => p.x))];
  totalPosts += cols.length;
  check(`seed ${seed}: posts are complete pairs`, posts.length === cols.length * 2,
    `${posts.length} cells across ${cols.length} columns`);
  for (const cx of cols) {
    const pair = posts.filter((p) => p.x === cx).sort((a, b) => a.y - b.y);
    check(`seed ${seed}: post at ${cx} shaped head-over-post`,
      pair[0].c === SIGNPOST_GLYPHS[0] && pair[1].c === SIGNPOST_GLYPHS[1] &&
      pair[1].y === m.surface[cx] - 1 && pair[0].y === m.surface[cx] - 2,
      JSON.stringify(pair));
  }
  // The reveal contract: sites are exactly the game count, unchanged shape.
  check(`seed ${seed}: sites untouched`, m.sites.length === SAMPLE_LAND.length,
    `${m.sites.length} vs ${SAMPLE_LAND.length}`);
  // No post underground (buried relics excluded by construction — pin it).
  check(`seed ${seed}: no post below the surface`,
    posts.every((p) => p.y < m.surface[p.x]));
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, SAMPLE_LAND, T)));
}
check('posts exist across the seed set', totalPosts >= 3, String(totalPosts));

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-land-signpost.mts`
Expected: FAIL — `SIGNPOST_GLYPHS` is not exported.

- [ ] **Step 3: Implement**

In `src/procedural/land.ts`, add next to the `ORE_GLYPH` export:

```ts
/** #19 slice 2 sign post — head over post, stamped beside each surface site.
 *  Exported for smoke-land-signpost + smoke-glyph-coverage. */
export const SIGNPOST_GLYPHS = ['┬', '│'] as const;
export const SIGNPOST_OFFSET = 3;
```

After the trees loop (the `for (let t = 0; t < 4; t++) …` block) and BEFORE the "Labels last" pass, insert:

```ts
  // Sign posts (#19 slice 2): a small standing post beside each surface
  // site — the furniture the proximity-revealed name hangs off. The reveal
  // itself (model.sites, siteLabels.ts) is untouched. Collision → skip: a
  // missing post is fine, a mangled one is not. Buried relics get no post.
  for (const l of labels) {
    if (l.kind !== 'surface') continue;
    const px = l.x + SIGNPOST_OFFSET;
    if (px < 1 || px >= cols - 1 || inJoinBuffer(px)) continue;
    if (hallSpan && px >= hallSpan[0] - 1 && px <= hallSpan[1] + 1) continue;
    const gyp = surfaceY(px);
    if (role[gyp - 1]?.[px] !== 'sky' || role[gyp - 2]?.[px] !== 'sky') continue;
    set(px, gyp - 2, SIGNPOST_GLYPHS[0], 'signpost');
    set(px, gyp - 1, SIGNPOST_GLYPHS[1], 'signpost');
  }
```

- [ ] **Step 4: Run the smoke and typecheck**

Run: `npx tsx scripts/smoke-land-signpost.mts && npm run typecheck`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/procedural/land.ts scripts/smoke-land-signpost.mts
git commit -m "feat(land): #19 slice 2 sign posts — surface-site furniture, reveal untouched"
```

---

### Task 6: Golden re-freeze + full sweep + glyph-coverage roster

**Files:**
- Modify: `scripts/smoke-land-mural.mts` (the `NO_MURAL_GOLDEN` hashes)
- Modify: `scripts/smoke-glyph-coverage.mts` (import + roster the new glyph exports)
- Possibly modify: other smokes whose frozen counts/positions shifted with the re-roll (fix deliberately; see Step 3)

**Interfaces:**
- Consumes: `MONUMENT_BODY`, `MONUMENT_CROWN`, `MONUMENT_DOOR`, `ORE_GLYPH`, `SIGNPOST_GLYPHS` from `src/procedural/land.ts` (Tasks 2–5).
- Produces: a green 60+-smoke sweep and the ONE dedicated golden-re-freeze commit the spec requires.

- [ ] **Step 1: Add the new glyphs to the coverage roster**

In `scripts/smoke-glyph-coverage.mts`, find where `WING_SIL_SHAPES` is imported and rostered, and add the new exports the same way:

```ts
import {
  MONUMENT_BODY, MONUMENT_CROWN, MONUMENT_DOOR, ORE_GLYPH, SIGNPOST_GLYPHS,
} from '../src/procedural/land.ts';
```

and roster their characters alongside the existing entries (match the file's local pattern for turning constants into checked codepoints — e.g. `[...MONUMENT_BODY.join(''), MONUMENT_CROWN, MONUMENT_DOOR, ORE_GLYPH, ...SIGNPOST_GLYPHS]`).

Run: `npx tsx scripts/smoke-glyph-coverage.mts`
Expected: PASS (all glyphs pre-checked against the coverage snapshot).

- [ ] **Step 2: Run the full sweep and collect the failures**

Run: `for f in scripts/smoke-*.mts; do npx tsx "$f" >/dev/null 2>&1 || echo "RED: $f"; done`
Expected RED: `smoke-land-mural` (golden hashes). Possibly RED: any smoke that froze positions/counts the re-roll moved (e.g. `smoke-land-bands`, `smoke-site-labels`, `smoke-land-atmosphere`).

- [ ] **Step 3: Fix each red deliberately**

- `smoke-land-mural.mts`: run it verbosely (`npx tsx scripts/smoke-land-mural.mts`) — the failing checks print the ACTUAL hash as detail. Replace the three `NO_MURAL_GOLDEN` values (seed7 / seed41 / join) with the printed actuals, and update the file's freeze comment to `re-frozen 2026-08-06 (#19 slice 2 land re-roll)`.
- Any other red: the rule is **update frozen positions/counts to the new actuals; NEVER touch a placement-rule or invariant assertion**. If an invariant assertion fails (not a frozen constant), that is a real bug in Tasks 2–5 — stop and fix the task, not the smoke.

- [ ] **Step 4: Re-run the full sweep to green**

Run: `for f in scripts/smoke-*.mts; do npx tsx "$f" >/dev/null 2>&1 || echo "RED: $f"; done && npm run typecheck`
Expected: no RED lines; typecheck PASS.

- [ ] **Step 5: Commit (the dedicated re-freeze commit)**

```bash
git add scripts/
git commit -m "test: golden re-freeze — #19 slice 2 land re-roll (monument, constellations, ore, posts)"
```

---

### Task 7: Cloud drift — pure module + renderer integration

**Files:**
- Create: `src/terminal/clouds.ts`
- Create: `scripts/smoke-cloud-drift.mts`
- Modify: `src/terminal/terminalLand.ts` (hide the baked cloud layer ~line 465; build wisps at init + in `recompose` ~line 507/533; drift in `tick` ~line 871; `debugClouds` e2e hook ~line 217 interface + ~line 1255 implementation)

**Interfaces:**
- Consumes: `LandModel`, `LandRole` from `../procedural/land`; `fnv1a32` from `../procedural/seed`; in terminalLand: `scene.layers`, `model`, `seed`, `theme`, `world`, `CW`/`CH`, `landRoleFill` (already imported from `../render/levels/land` or import it), the `tick` closure.
- Produces: `src/terminal/clouds.ts` exports:
  - `interface WispSpec { row: number; text: string; speed: number; phase: number; blocked: ReadonlyArray<readonly [number, number]> }`
  - `extractWisps(model: LandModel, seed: number): WispSpec[]`
  - `wispX(w: WispSpec, tSec: number, width: number): number` — cells, in `[-text.length, width)`, wrapping
  - `wispAlpha(w: WispSpec, xCells: number): number` — 0 inside a blocked span, 1 clear of it, linear 2-cell skirt
  - terminalLand gains e2e hook `debugClouds(): Array<{ x: number; alpha: number }>`

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-cloud-drift.mts`:

```ts
/** Cloud-drift smoke — `npx tsx scripts/smoke-cloud-drift.mts`.
 *  #19 slice 2: the terminal renderer hides the baked cloud layer and
 *  re-renders the same wisps drifting on the wall clock. This smokes the
 *  pure maths (src/terminal/clouds.ts); the Pixi wiring is e2e-verified. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { extractWisps, wispAlpha, wispX } from '../src/terminal/clouds.ts';
const { check, report } = makeChecker('smoke cloud-drift');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;
const m = composeLand(7, SAMPLE_LAND, T);
const wisps = extractWisps(m, 7);

check('two wisps extracted (composer bakes two)', wisps.length === 2, String(wisps.length));
check('wisp text is the baked glyph run', wisps.every((w) => /^[~ ]+$/.test(w.text) && w.text.length >= 3));
check('speeds within the wallpaper band', wisps.every((w) => w.speed >= 0.04 && w.speed <= 0.11),
  JSON.stringify(wisps.map((w) => w.speed)));
check('deterministic', JSON.stringify(wisps) === JSON.stringify(extractWisps(m, 7)));
check('seed varies phase', JSON.stringify(extractWisps(m, 8).map((w) => w.phase))
  !== JSON.stringify(wisps.map((w) => w.phase)));

const w0 = wisps[0];
// Drift: over one second, x advances by exactly speed (mod the wrap span).
const a = wispX(w0, 1000, m.width);
const b = wispX(w0, 1001, m.width);
const span = m.width + w0.text.length;
const step = ((b - a) % span + span) % span;
check('x advances by speed per second', Math.abs(step - w0.speed) < 1e-9, String(step));
// Wrap: x always inside [-len, width).
let wrapped = true;
for (let t = 0; t < 20000; t += 37) {
  const x = wispX(w0, t, m.width);
  if (x < -w0.text.length || x >= m.width) wrapped = false;
}
check('x stays in the wrap window', wrapped);

// Alpha: synthetic wisp with one blocked span.
const s = { row: 3, text: '~~~', speed: 0.05, phase: 0, blocked: [[50, 60]] } as const;
check('alpha 0 inside the span', wispAlpha(s, 52) === 0);
check('alpha 0 when overlapping the edge', wispAlpha(s, 48) === 0); // 48..51 overlaps 50
check('alpha 1 far away', wispAlpha(s, 10) === 1);
check('alpha ramps in the 2-cell skirt', wispAlpha(s, 46) > 0 && wispAlpha(s, 46) < 1,
  String(wispAlpha(s, 46)));

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-cloud-drift.mts`
Expected: FAIL — `src/terminal/clouds.ts` does not exist.

- [ ] **Step 3: Implement the pure module**

Create `src/terminal/clouds.ts`:

```ts
/**
 * Cloud drift (#19 slice 2) — pure maths for the terminal renderer's
 * drifting wisps. The composer still bakes static clouds (non-animated
 * surfaces keep them); the terminal path hides that layer and re-renders
 * the SAME wisps from here, drifting on the wall clock — two windows on the
 * same wing agree without a broker channel, and a throttled renderer that
 * wakes simply snaps to where the sky has got to. Speed is wallpaper-scale
 * (a few cells per minute): noticeable in ~10 s of watching, invisible at
 * a glance. Pure + Pixi-free so scripts/smoke-cloud-drift.mts can run it.
 */
import type { LandModel, LandRole } from '../procedural/land';
import { fnv1a32 } from '../procedural/seed';

/** Sky-register roles a wisp may drift over (a cloud IN FRONT of the moon
 *  is weather, not a bug); anything else — mural, skyline, structures —
 *  fades the wisp out: the world always wins. */
const DRIFTABLE = new Set<LandRole>(['sky', 'skyDither', 'star', 'starBright', 'cloud', 'moon']);

export interface WispSpec {
  readonly row: number;
  /** The baked wisp's glyph run, verbatim (e.g. '~ ~~~~ ~'). */
  readonly text: string;
  /** Cells per second — 0.04..0.10. */
  readonly speed: number;
  /** Starting offset in cells. */
  readonly phase: number;
  /** Column spans [start, end) on this row the wisp must not cover. */
  readonly blocked: ReadonlyArray<readonly [number, number]>;
}

/** The baked cloud runs, lifted: one WispSpec per contiguous cloud-role run,
 *  with per-wisp speed/phase from fnv1a over (seed, index). */
export function extractWisps(model: LandModel, seed: number): WispSpec[] {
  const wisps: WispSpec[] = [];
  for (let y = 0; y < model.height; y++) {
    let x = 0;
    while (x < model.width) {
      if (model.role[y][x] !== 'cloud') { x++; continue; }
      let end = x;
      while (end < model.width && model.role[y][end] === 'cloud') end++;
      const text = model.char[y].slice(x, end).join('');
      const blocked: Array<readonly [number, number]> = [];
      let bs = -1;
      for (let c = 0; c <= model.width; c++) {
        const bad = c < model.width && !DRIFTABLE.has(model.role[y][c]);
        if (bad && bs < 0) bs = c;
        if (!bad && bs >= 0) { blocked.push([bs, c]); bs = -1; }
      }
      const h = fnv1a32(`${seed}:wisp:${wisps.length}`);
      wisps.push({
        row: y,
        text,
        speed: 0.04 + (h % 61) / 1000, // 0.040..0.100 cells/s (2.4..6 cells/min)
        phase: h % model.width,
        blocked,
      });
      x = end;
    }
  }
  return wisps;
}

/** Position at wall-clock second tSec: cells, in [-text.length, width),
 *  wrapping — the wisp slides fully off the right edge and re-enters left. */
export function wispX(w: WispSpec, tSec: number, width: number): number {
  const span = width + w.text.length;
  return ((((w.phase + tSec * w.speed) % span) + span) % span) - w.text.length;
}

/** Target alpha at xCells: 0 while [x, x+len) overlaps a blocked span, 1 in
 *  the clear, a linear 2-cell skirt between — the wisp fades out approaching
 *  a mural or silhouette and back in past it, never pops. */
export function wispAlpha(w: WispSpec, xCells: number): number {
  const x0 = xCells;
  const x1 = xCells + w.text.length;
  let gap = Infinity;
  for (const [s, e] of w.blocked) {
    if (x1 > s && x0 < e) return 0;
    gap = Math.min(gap, x0 >= e ? x0 - e : s - x1);
  }
  return Math.min(1, gap / 2);
}
```

- [ ] **Step 4: Run the smoke**

Run: `npx tsx scripts/smoke-cloud-drift.mts && npm run typecheck`
Expected: both PASS.

- [ ] **Step 5: Wire it into terminalLand**

In `src/terminal/terminalLand.ts`:

a) Import at the top with the other local imports:

```ts
import { extractWisps, wispAlpha, wispX, type WispSpec } from './clouds';
```

b) In `hideBakedLayers` (~line 465), add the cloud layer to the hidden set with a comment matching the file's style:

```ts
    // #19 slice 2: the drifting wisp layer owns the clouds on the terminal
    // path — the baked static layer stays in the model for other surfaces.
    for (const t of scene.layers.cloud ?? []) t.visible = false;
```

c) Next to `siteLabelViews` (~line 459), add the wisp state and builder:

```ts
  interface WispView { spec: WispSpec; text: BitmapText }
  let wispViews: WispView[] = [];
  const buildWisps = (): void => {
    for (const w of wispViews) w.text.destroy();
    wispViews = [];
    if ((theme.landOmit ?? []).includes('cloud')) return; // a pack that deletes clouds gets no wisps either
    wispViews = extractWisps(model, seed).map((spec) => {
      const text = new BitmapText({
        text: spec.text,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: landRoleFill(theme, 'cloud') },
      });
      text.y = spec.row * CH;
      text.alpha = 0; // positioned + faded on the first tick
      world.addChildAt(text, 1); // same plane as the label overlays
      return { spec, text };
    });
  };
```

(`landRoleFill` — add to the existing import from `../render/levels/land` if not already imported; it applies the cloud's `FAR_FADE`, so wisps keep the baked layer's atmospheric tint. `seed` is the compose seed already in scope.)

d) Call `buildWisps();` immediately after `buildSiteLabels();` BOTH at init (~line 508) and inside `recompose` (~line 533).

e) In `tick` (~after the foliage sway block, line 875), add:

```ts
    // #19 slice 2: cloud drift — wall-clock so same-wing windows agree and a
    // woken throttle snaps to where the sky has got to (no accumulator).
    const skyT = Date.now() / 1000;
    for (const w of wispViews) {
      const xc = wispX(w.spec, skyT, model.width);
      w.text.x = xc * CW;
      w.text.alpha = wispAlpha(w.spec, xc) * 0.9;
    }
```

f) Add the e2e hook. In the `window.__terminal` interface (~line 217, next to `debugDepth`):

```ts
      /** e2e only — wisp positions (cells) + alphas, for drift readback. */
      debugClouds(): Array<{ x: number; alpha: number }>;
```

and in the implementation object (~line 1255, next to `debugCellAt`):

```ts
    debugClouds: () =>
      wispViews.map((w) => ({
        x: Math.round((w.text.x / CW) * 100) / 100,
        alpha: Math.round(w.text.alpha * 1000) / 1000,
      })),
```

- [ ] **Step 6: Typecheck + smoke sweep spot-check**

Run: `npm run typecheck && npx tsx scripts/smoke-cloud-drift.mts && npx tsx scripts/smoke-land-mural.mts`
Expected: all PASS (the renderer change touches no composed bytes — the mural golden re-frozen in Task 6 must still hold).

- [ ] **Step 7: Commit**

```bash
git add src/terminal/clouds.ts src/terminal/terminalLand.ts scripts/smoke-cloud-drift.mts
git commit -m "feat(terminal): #19 slice 2 cloud drift — wall-clock wisps, world-wins occlusion"
```

---

### Task 8: Live verification, shots, docs

**Files:**
- Create: `docs/design-reviews/2026-08-06-land-polish-slice2/` (shots)
- Modify: `STATE.md` (slice record + corpus count), `TODO-USER.md` (eyeball item)

**Interfaces:**
- Consumes: the `launch-desktop-app` skill (boot + CDP recipe), `window.__terminal.debugClouds()` / `debugCellAt()` from Task 7.
- Produces: the eyeball package — three shots + a live-drift observation — and the frozen-bars TODO item.

- [ ] **Step 1: Full sweep + typecheck one more time**

Run: `for f in scripts/smoke-*.mts; do npx tsx "$f" >/dev/null 2>&1 || echo "RED: $f"; done && npm run typecheck`
Expected: clean.

- [ ] **Step 2: Launch and verify live (use the launch-desktop-app skill)**

Follow `.claude/skills/launch-desktop-app` for boot + CDP. Verify and screenshot into `docs/design-reviews/2026-08-06-land-polish-slice2/`:

1. **Solo window** (`desk-t1-d0.png`, default theme): monument shows cap/slits/body/door + crown; ≥1 constellation figure; ore glints in the deep band; posts at sites.
2. **Drift readback**: via CDP evaluate `window.__terminal.debugClouds()` twice ~5 s apart — x values must differ by ≈ 5 × speed cells; alphas in (0, 0.9]. Then watch the window ~15 s: drift perceptible, not eye-catching.
3. **Joined two-window desk** (`desk-joined.png`): seam/knit/murals/marks intact; wisps fade under the mural rect if their row crosses it; both windows' same-wing skies agree (spot-check `debugClouds()` x on both).
4. **gameboy-dmg relaunch** (`desk-dmg.png`): sky fully blank (no figures — star roles omitted; no wisps — cloud omitted), crowns blank (`monumentCrown` omitted), judged strata bands unmoved, door PRESENT (omit-locked).
5. `debugCellAt` spot-checks: a door cell returns `{char:'▯', role:'door'}`; an ore cell returns `{char:'◆', role:'ore'}`.

Any live-found defect: fix, re-run the relevant smoke, amend the task commit pattern (`fix(land): …`).

- [ ] **Step 3: Record the slice**

- `STATE.md`: add the slice-2 paragraph after the slice-1 one — shipped date, the four legs + drift, the two rejected approaches (flags, render-side), new smokes, the new style-pack corpus count (from Task 1 Step 5), shots path, and the frozen bars below VERBATIM.
- `TODO-USER.md`: new Active item `🔔 EYEBALL — land polish #19 slice 2`, pointing at the three shots + a live drift watch, with these bars **copied verbatim from the spec** (they were frozen 2026-08-05, before implementation):
  1. Monument: reads as built architecture with an entrance. KILL: noisier blob → revert to the column, rethink at mockup level.
  2. Constellations: ≥1 figure reads as deliberate; sky NO busier. KILL: more cluttered → remove figures, keep scatter.
  3. Cloud drift: noticeable in ~10 s, invisible at a glance. KILL: draws the eye from across the room → halve speed once; still pulls focus → ship static.
  4. Ore: "rock with veins", not confetti. KILL: confetti → halve count once; still confetti → pull the role.
  5. Sign posts: site furniture; reveal feels unchanged. KILL: stray glyphs → omit everywhere.
  6. gameboy-dmg: sky blank, crowns blank, judged bands unmoved, doors present.

- [ ] **Step 4: Commit + push**

```bash
git add docs/design-reviews/2026-08-06-land-polish-slice2/ STATE.md TODO-USER.md
git commit -m "docs: #19 slice 2 shipped — shots + slice record + eyeball item"
git push
```
