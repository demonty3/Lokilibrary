# Marginalia on Land Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **On execution start:** copy this plan to `docs/superpowers/plans/2026-08-01-marginalia-on-land.md` (the repo's plan home) in Task 1's commit.

**Goal:** Beings leave persistent traces on the terminal land: occasional marks with in-voice notes that unfurl when another being passes, plus footfall wear that survives relaunch and decays over days.

**Architecture:** Palace-parity reuse per the approved spec (`docs/superpowers/specs/2026-07-17-marginalia-on-land-design.md`): marks are `recordPlan` plan rows through the wing-namespaced writer `terminalLand.ts` already holds, read back with `placedMarksForCell`; wear gets one additive `land_wear` table with lazy half-life decay. A pure `maybeMark` rides the intent re-pick clock as a side-effect. No new intent kind, zero new AI calls.

**Tech Stack:** TypeScript strict, PixiJS v8 BitmapText, better-sqlite3 (WAL, `busy_timeout=3000`), smokes via `npx tsx scripts/smoke-*.mts` (`makeChecker` from `scripts/lib/smoke.ts`).

## Global Constraints

- **Zero new runtime AI calls.** The `{thought}` garnish reads `b.mind.intent` (the free-form Tier-1 string, `src/state/agentRuntime.ts:76-78`, `''` = none) already produced by the existing arrival dispatch. Key-free rail gets the full feature minus garnish. No CLAUDE.md ledger entry needed.
- **`src/procedural/` byte-untouched.** Placement randomness uses the land's existing `makeRng` stream (`terminalLand.ts:215`); wear decay uses wall clock (the `lastTier1At` precedent). Wear/marks are renderer-side re-texts and overlays only.
- **No new `BeingIntent` kind.** `pickIntent`'s ladder (`src/terminal/beingIntents.ts:92-123`) and the watch_edge-dominance invariant (locked by `smoke-t1-being-intents.mts:72-76,121-135`) stay byte-identical.
- **Marks storage shape is load-bearing:** plan `status: 'active'` + step `status: 'pending'` + `kind: 'place_mark'` + `importance: 6`. `placedMarksForCell` (`src/agents/memory/retrieval.ts:257-262`) filters to exactly that; a `'done'` step is invisible.
- **Stored `y` is advisory.** Display row is re-derived from the live `model.surface` (the seam Hermite ramp shifts rows; `surfaceLocalY` at `terminalLand.ts:508-511`).
- **Render cap 12 marks per land; one reveal at a time per land.**
- **Wear flush every ~30 s when dirty + on teardown, never per footstep.** DB is WAL-shared across renderer processes. Every DB write try/caught: contention costs a lost observation, never a broken tick (`terminalMemory.ts:12-14` discipline).
- **All animation rides `elapsedS`** (`app.ticker.deltaMS` accumulator, freezes under throttle). Wall clock only for memory/decay timestamps.
- **Not in slice:** mouse-hover reveal, T4 reading marks, palace changes beyond the two pure extractions, wear stages beyond `▀ → ▔`, marks crossing seams.
- **Gates:** `npm run typecheck` + each named smoke individually (no aggregate runner exists). Existing smokes must stay green byte-identically, in particular `smoke-t1-being-intents`, `smoke-t2-society`, `smoke-land-seam`, `smoke-worn-paths`, `smoke-glyph-coverage`.

---

### Task 1: Extract `MARK_STYLES` to a shared module

**Files:**
- Create: `src/agents/markStyles.ts`
- Modify: `src/render/levels/cell.ts` (delete module-local table at lines 75-94, import instead; uses at :634 and :747 unchanged)
- Modify: `scripts/smoke-glyph-coverage.mts` (provenance entries :140-141; import the real export, the `WORN_CRUST_GLYPH` precedent at :35)

**Interfaces:**
- Produces: `export interface MarkStyle { glyph: string; role: ThemeRole; fallback: PaletteKey }`, `export const MARK_STYLES: Record<string, MarkStyle>`, `export const DEFAULT_MARK_STYLE: MarkStyle` — consumed by Tasks 7 and 10.

- [ ] **Step 1: Create the module** — content moved verbatim from `cell.ts:75-94` (keep the doc comment, including the `mark.ghost` re-key note), typed with `import type { PaletteKey, ThemeRole } from '../themes/types';`:

```ts
export interface MarkStyle { glyph: string; role: ThemeRole; fallback: PaletteKey }

export const MARK_STYLES: Record<string, MarkStyle> = {
  loki: { glyph: '’', role: 'being.loki', fallback: 'magenta' },
  archivist: { glyph: '≡', role: 'being.archivist', fallback: 'violet' },
  cat: { glyph: '⌐', role: 'being.cat', fallback: 'orange' },
  ghost: { glyph: '°', role: 'mark.ghost', fallback: 'fg' },
  visitor: { glyph: ',', role: 'being.visitor', fallback: 'cyan' },
};

export const DEFAULT_MARK_STYLE: MarkStyle = { glyph: '·', role: 'being.loki', fallback: 'magenta' };
```

- [ ] **Step 2: Point `cell.ts` at it** — delete the local `MARK_STYLES`/`DEFAULT_MARK_STYLE`, add `import { MARK_STYLES, DEFAULT_MARK_STYLE } from '../../agents/markStyles';`. No other cell.ts line changes.
- [ ] **Step 3: Update the glyph smoke** — in `smoke-glyph-coverage.mts`, add `import { MARK_STYLES, DEFAULT_MARK_STYLE } from '../src/agents/markStyles.ts';` and replace the hardcoded entry `['’≡⌐°,·', 'cell.ts MARK_STYLES']` with a derived one: `[Object.values(MARK_STYLES).map((s) => s.glyph).join('') + DEFAULT_MARK_STYLE.glyph, 'src/agents/markStyles.ts MARK_STYLES']`. Update the `:133` provenance string `'cell.ts placed-mark glyph'` → `'markStyles.ts DEFAULT_MARK_STYLE (placed-mark glyph)'`.
- [ ] **Step 4: Verify** — `npm run typecheck`; `npx tsx scripts/smoke-glyph-coverage.mts`; `npx tsx scripts/smoke-salience.mts`; `npx tsx scripts/smoke-ladder-identity.mts`. All green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor: extract MARK_STYLES to shared src/agents/markStyles.ts"` (include the plan copy to `docs/superpowers/plans/2026-08-01-marginalia-on-land.md` in this commit).

### Task 2: Extract `captionFor` to a shared module

**Files:**
- Create: `src/render/noteBox.ts`
- Modify: `src/render/levels/cell.ts` (delete :131-174, import; use at :707 unchanged)
- Modify: `scripts/smoke-glyph-coverage.mts` (provenance :145-146)

**Interfaces:**
- Produces: `export function captionFor(text: string, maxWidth: number): string` — word-wraps, 90-char cap with `…`, returns a `╔═╗║╚╝` double-line box. Consumed by Task 8.

- [ ] **Step 1: Create `src/render/noteBox.ts`** — move `captionFor` verbatim from `cell.ts:131-174` (doc comment included), `export`ed. Pure, no imports needed.
- [ ] **Step 2: Point `cell.ts` at it** — `import { captionFor } from '../noteBox';`, delete the local function.
- [ ] **Step 3: Update the glyph smoke provenance** — `'src/render/levels/cell.ts captionFor (marginalia frame)'` → `'src/render/noteBox.ts captionFor (marginalia frame)'`; `'cell.ts captionFor truncation (capped-text ellipsis)'` → `'noteBox.ts captionFor truncation (capped-text ellipsis)'`.
- [ ] **Step 4: Verify** — `npm run typecheck`; `npx tsx scripts/smoke-glyph-coverage.mts`. Green.
- [ ] **Step 5: Commit** — `refactor: extract captionFor to shared src/render/noteBox.ts`.

### Task 3: Wear seeding, snapshot, and decay (pure)

**Files:**
- Modify: `src/terminal/wear.ts` (extend `createFootfall` :30-45, add `snapshot`, add decay helper; `crustGlyphAt`/`crustLayerText` untouched)
- Create: `scripts/smoke-land-wear-persist.mts` (pure legs now; DB legs in Task 4)

**Interfaces:**
- Produces: `createFootfall(threshold?: number, initial?: ReadonlyMap<number, number>): Footfall`; `Footfall` gains `snapshot(): ReadonlyMap<number, number>`; `export const WEAR_HALF_LIFE_MS = 86_400_000`; `export function decayedCount(count: number, updatedAtMs: number, nowMs: number): number`. Consumed by Tasks 4 and 9.

- [ ] **Step 1: Write the failing smoke** — create `scripts/smoke-land-wear-persist.mts`:

```ts
/**
 * Marginalia slice smoke — `npx tsx scripts/smoke-land-wear-persist.mts`.
 * Locks persistent wear:
 *   - decayedCount half-life math (halve per real day, clamp negative age)
 *   - createFootfall seeding (pre-worn columns worn from frame one) + snapshot
 *   - land_wear flush/restore round-trip, prune-below-1, namespacing   [Task 4]
 *   - recordMark → placedMarksForCell round-trip, active+pending filter [Task 6]
 */
import { makeChecker } from './lib/smoke.ts';
import { createFootfall, decayedCount, WEAR_HALF_LIFE_MS } from '../src/terminal/wear.ts';

const { check, report } = makeChecker('smoke land-wear-persist');

// 1 · decay math
const t0 = 1_700_000_000_000;
check('zero age: unchanged', decayedCount(8, t0, t0) === 8);
check('one day: halved', decayedCount(8, t0, t0 + WEAR_HALF_LIFE_MS) === 4);
check('two days: quartered', decayedCount(8, t0, t0 + 2 * WEAR_HALF_LIFE_MS) === 2);
check('negative age clamps to unchanged', decayedCount(8, t0 + 9999, t0) === 8);

// 2 · seeding
const seeded = createFootfall(8, new Map([[5, 9], [6, 3]]));
check('at/past threshold: worn from frame one', seeded.worn.has(5));
check('below threshold: not worn', !seeded.worn.has(6));
let crossed = false;
for (let i = 0; i < 5; i++) crossed = seeded.step(6) || crossed;
check('seeded count resumes toward threshold', crossed && seeded.worn.has(6));

// 3 · snapshot
const snap = seeded.snapshot();
check('snapshot holds seeded + stepped counts', snap.get(5) === 9 && snap.get(6) === 8);
const before = seeded.snapshot().get(5);
(snap as Map<number, number>).set(5, 999);
check('snapshot is a copy', seeded.snapshot().get(5) === before);

report();
```

- [ ] **Step 2: Run to verify it fails** — `npx tsx scripts/smoke-land-wear-persist.mts`. Expected: import error (`decayedCount` not exported).
- [ ] **Step 3: Implement in `wear.ts`**:

```ts
/** Wear half-life: persisted counts halve per real-world day (lazy, on read). */
export const WEAR_HALF_LIFE_MS = 86_400_000;

/** Effective count after lazy decay. Wall-clock is fine here (renderer-side,
 *  the lastTier1At precedent); src/procedural/ is untouched. */
export function decayedCount(count: number, updatedAtMs: number, nowMs: number): number {
  return count * Math.pow(0.5, Math.max(0, nowMs - updatedAtMs) / WEAR_HALF_LIFE_MS);
}
```

`Footfall` interface gains `snapshot(): ReadonlyMap<number, number>;`. `createFootfall(threshold: number = WEAR_THRESHOLD, initial?: ReadonlyMap<number, number>): Footfall` copies `initial` into `counts` and pre-populates `worn` where `count >= threshold`; `snapshot: () => new Map(counts)`.

- [ ] **Step 4: Run to verify it passes** — `npx tsx scripts/smoke-land-wear-persist.mts`; also `npx tsx scripts/smoke-worn-paths.mts` (default-arg call sites unchanged) + `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(wear): seedable footfall + snapshot + lazy half-life decay`.

### Task 4: `land_wear` persistence (db + writer + null writer)

**Files:**
- Modify: `src/agents/memory/db.ts` (DDL in `bootstrap` after the lore block :512-524; prepared stmts near :238; methods in the returned literal near :396; `MemoryDb` interface near :76)
- Modify: `src/agents/memory/schema.ts` (`SCHEMA_VERSION` 3 → 4, comment in the :231-235 style)
- Modify: `src/agents/router.ts` (`MemoryWriter` interface before the Lore fence at :209; `nullMemoryWriter` additions at :227+)
- Modify: `src/agents/memory/writer.ts` (two closure methods, the `recordLore` shape at :147-170)
- Modify: `scripts/smoke-land-wear-persist.mts` (real-DB legs)

**Interfaces:**
- Produces (writer, namespace-closured over `ns.cellId`):
  - `landWearForCell(): ReadonlyArray<{ col: number; count: number; updatedAt: number }>`
  - `flushLandWear(entries: ReadonlyArray<{ col: number; count: number }>, nowMs: number): void` — upsert `count >= 1` rows, delete `< 1` rows, one transaction.
- Produces (db): `landWearRows(cellId)`; `flushLandWear(cellId, upserts, pruneCols, nowMs)`.
- Consumed by Task 9.

- [ ] **Step 1: Extend the smoke (failing)** — append to `smoke-land-wear-persist.mts` (the `smoke-t1-society-memory.mts:1-29,68-82` pattern — require shim then dynamic imports, `mkdtempSync` prefix `lokilib-wear-`):

```ts
// 4 · real DB round-trip
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);
const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-wear-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite'), suppressVecWarning: true });
const writer = buildMemoryWriter({ db, vault: null, ns: { cellId: 'cell:wingtest', libraryId: 'library:anonymous' } });
const other = buildMemoryWriter({ db, vault: null, ns: { cellId: 'cell:otherwing', libraryId: 'library:anonymous' } });

const now = 1_700_000_000_000;
writer.flushLandWear([{ col: 3, count: 9 }, { col: 4, count: 0.5 }], now);
const rows = writer.landWearForCell();
check('flush persists >=1 rows only', rows.length === 1 && rows[0].col === 3 && rows[0].count === 9 && rows[0].updatedAt === now);
check('namespacing: other wing sees nothing', other.landWearForCell().length === 0);
writer.flushLandWear([{ col: 3, count: 12 }], now + 1000);
const rows2 = writer.landWearForCell();
check('upsert overwrites in place', rows2.length === 1 && rows2[0].count === 12 && rows2[0].updatedAt === now + 1000);
writer.flushLandWear([{ col: 3, count: 0.2 }], now + 2000);
check('prune below 1 deletes the row', writer.landWearForCell().length === 0);

db.close();
fs.rmSync(tmp, { recursive: true, force: true });
```

(Move `report()` to the end of the file.)

- [ ] **Step 2: Run to verify it fails** — `npx tsx scripts/smoke-land-wear-persist.mts`. Expected: `flushLandWear is not a function`.
- [ ] **Step 3: Implement.** DDL appended in `bootstrap`'s exec (mirroring the lore comment style):

```sql
    -- Land wear (marginalia slice). Per-wing footfall counts, additive —
    -- its own table (the lore precedent), never touching the memories
    -- contract. Decay is lazy (on read); rows are pruned on flush.
    CREATE TABLE IF NOT EXISTS land_wear (
      cell_id    TEXT NOT NULL,
      col        INTEGER NOT NULL,
      count      REAL NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (cell_id, col)
    );
```

Prepared statements (grouped `// ---- Land wear statements ----`): select by cell_id; upsert `INSERT ... ON CONFLICT(cell_id, col) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at` (the `upsertPersonaStmt` shape at db.ts:184-195); delete by (cell_id, col). `flushLandWear` wraps upserts + deletes in one `db.transaction` (the `attachEmbeddingTx` shape at :270-286). `MemoryDb` interface gains the two methods under `// ---- Land wear (marginalia slice) ----`. `SCHEMA_VERSION = 4` with comment `v4 (2026-08-01): +land_wear table — additive only (CREATE IF NOT EXISTS; old rows untouched).` Writer methods (closure over `ns.cellId`):

```ts
    landWearForCell() {
      return db.landWearRows(ns.cellId).map((r) => ({ col: r.col, count: r.count, updatedAt: r.updated_at }));
    },
    flushLandWear(entries, nowMs) {
      const upserts = entries.filter((e) => e.count >= 1);
      const prunes = entries.filter((e) => e.count < 1).map((e) => e.col);
      db.flushLandWear(ns.cellId, upserts, prunes, nowMs);
    },
```

`MemoryWriter` interface gains both (doc: per-wing wear, additive table); `nullMemoryWriter` gains `landWearForCell: () => [],` and `flushLandWear: () => {},`.

- [ ] **Step 4: Run to verify it passes** — the smoke + `npm run typecheck` + `npx tsx scripts/smoke-t1-society-memory.mts` (schema-version assertion there may pin `3` — if it does, update that assertion to accept the accumulating v4 row; the version table accumulates one row per version by design).
- [ ] **Step 5: Commit** — `feat(memory): additive land_wear table + namespaced writer methods (schema v4)`.

### Task 5: `marks.ts` pure module + `smoke-t2-marks`

**Files:**
- Create: `src/terminal/marks.ts`
- Create: `scripts/smoke-t2-marks.mts` (pure — no DB, no require shim)

**Interfaces (produces, consumed by Tasks 7, 8, 10):**

```ts
export type MarkContextKind = 'after_crossing' | 'at_structure' | 'at_edge' | 'mid_wander';
export const MARK_RENDER_CAP = 12;
export const MARK_DEDUPE_COLS = 2;
export const MARK_CHANCE: Record<MarkContextKind, number>; // after_crossing .45, at_structure .5, at_edge .3, mid_wander .06
export function markCooldownS(agentId: string): number;    // 90 + fnv1a(id) % 90  → [90, 180)
export interface MarkAttempt {
  agentId: string; kind: MarkContextKind; col: number; nowS: number;
  lastMarkAtS: number; existingCols: readonly number[]; thought: string;
}
export function maybeMark(rand: () => number, a: MarkAttempt): { note: string; col: number } | null;
export function noteFor(agentId: string, kind: MarkContextKind, rand: () => number, thought: string): string;
export function markDisplayRow(surface: readonly number[], col: number): number; // surface[clamp(col)] - 1
export const REVEAL_RADIUS_COLS = 1.5;
export const REVEAL_COOLDOWN_S = 60;
export const REVEAL_FADE_S = 0.4;
export const REVEAL_HOLD_S = 4;
export function pickReveal(
  marks: ReadonlyArray<{ col: number; lastRevealAtS: number }>,
  beingCols: readonly number[], nowS: number,
): number | null;
```

- [ ] **Step 1: Write the failing smoke** — `scripts/smoke-t2-marks.mts`:

```ts
/**
 * Marginalia slice smoke — `npx tsx scripts/smoke-t2-marks.mts`.
 * Locks the pure mark logic (src/terminal/marks.ts):
 *   - maybeMark: cooldown gate, column dedupe, per-context chance
 *   - vocab totality (every being × context) + {thought} garnish + fallback
 *   - surface-row re-derivation against a ramped (joined) model
 *   - pickReveal: proximity radius, per-mark cooldown, none-eligible → null
 */
import { makeChecker } from './lib/smoke.ts';
import {
  MARK_CHANCE, MARK_DEDUPE_COLS, markCooldownS, maybeMark, noteFor,
  markDisplayRow, pickReveal, REVEAL_COOLDOWN_S, REVEAL_RADIUS_COLS,
  type MarkContextKind,
} from '../src/terminal/marks.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke t2-marks');
const lo = () => 0;         // rand that always passes a chance gate
const hi = () => 0.999;     // rand that never passes
const KINDS: MarkContextKind[] = ['after_crossing', 'at_structure', 'at_edge', 'mid_wander'];
const IDS = ['loki', 'archivist', 'cat', 'visitor', 'ghost'];
const base = { agentId: 'loki', kind: 'at_structure' as MarkContextKind, col: 20, nowS: 1000, lastMarkAtS: -Infinity, existingCols: [], thought: '' };

// 1 · cooldown
check('cooldown is per-id staggered into [90,180)', IDS.every((id) => markCooldownS(id) >= 90 && markCooldownS(id) < 180));
check('cooldown deterministic per id', markCooldownS('loki') === markCooldownS('loki'));
check('inside cooldown: never marks', maybeMark(lo, { ...base, lastMarkAtS: 1000 - markCooldownS('loki') + 1 }) === null);
check('past cooldown: marks', maybeMark(lo, { ...base, lastMarkAtS: 1000 - markCooldownS('loki') - 1 }) !== null);

// 2 · dedupe + chance
check('dedupe within 2 cols', maybeMark(lo, { ...base, existingCols: [20 + MARK_DEDUPE_COLS] }) === null);
check('outside dedupe: marks', maybeMark(lo, { ...base, existingCols: [20 + MARK_DEDUPE_COLS + 1] }) !== null);
check('high roll never marks', KINDS.every((kind) => maybeMark(hi, { ...base, kind }) === null));
check('mid_wander is the low tail', MARK_CHANCE.mid_wander < MARK_CHANCE.at_edge && MARK_CHANCE.at_edge < MARK_CHANCE.after_crossing && MARK_CHANCE.after_crossing <= MARK_CHANCE.at_structure);

// 3 · vocab totality + garnish
for (const id of [...IDS, 'stranger']) for (const kind of KINDS) {
  const n = noteFor(id, kind, lo, '');
  check(`vocab total: ${id}/${kind}`, n.length > 0 && !n.includes('{thought}'));
}
const seen = new Set<string>();
let s = 0; const seq = () => { s = (s + 0.37) % 1; return s; };
for (let i = 0; i < 40; i++) seen.add(noteFor('loki', 'at_structure', seq, 'Find The Warm Spot'));
check('thought folded lowercased into some line', [...seen].some((n) => n.includes('find the warm spot')));
check('empty thought falls back to authored lines', [...Array(40)].every((_, i) => !noteFor('loki', 'at_structure', seq, '').includes('{')));

// 4 · surface-row re-derivation (ramped model)
const fnv = (str: string): number => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const dims = { width: 60, skyH: 6, surfaceBand: 4, underH: 10, withPlayer: false };
const plain = composeLand(fnv('terminal:d0'), SAMPLE_LAND.slice(0, 5), dims);
const joined = composeLand(fnv('terminal:d0'), SAMPLE_LAND.slice(0, 5), { ...dims, join: { right: fnv('terminal:d1') } });
const col = joined.width - 2; // inside the seam blend
check('display row tracks the CURRENT surface', markDisplayRow(joined.surface, col) === joined.surface[col] - 1);
check('ramp shifts some blend-buffer row vs unjoined (advisory-y motivation)',
  [...Array(6)].some((_, i) => plain.surface[plain.width - 1 - i] !== joined.surface[joined.width - 1 - i]));
check('display row clamps out-of-range cols', markDisplayRow(joined.surface, -5) === joined.surface[0] - 1 && markDisplayRow(joined.surface, 999) === joined.surface[joined.width - 1] - 1);

// 5 · reveal
const m = (col: number, lastRevealAtS = -Infinity) => ({ col, lastRevealAtS });
check('being within radius reveals', pickReveal([m(10)], [10 + REVEAL_RADIUS_COLS - 0.1], 100) === 0);
check('being outside radius does not', pickReveal([m(10)], [10 + REVEAL_RADIUS_COLS + 0.1], 100) === null);
check('reveal cooldown holds', pickReveal([m(10, 100 - REVEAL_COOLDOWN_S + 1)], [10], 100) === null);
check('reveal cooldown expires', pickReveal([m(10, 100 - REVEAL_COOLDOWN_S - 1)], [10], 100) === 0);
check('first eligible wins', pickReveal([m(50), m(10)], [10, 50], 100) === 0);
check('no marks → null', pickReveal([], [10], 100) === null);

report();
```

- [ ] **Step 2: Run to verify it fails** — module not found.
- [ ] **Step 3: Implement `src/terminal/marks.ts`.** Pure (the `wear.ts` posture: no PIXI, no IPC, no wall clock; rand injected). Module-local `fnv1a` (copy the `terminalLand.ts:205` shape). `maybeMark`: return null if `a.nowS - a.lastMarkAtS < markCooldownS(a.agentId)`; null if any `existingCols` within `MARK_DEDUPE_COLS`; null if `rand() >= MARK_CHANCE[a.kind]`; else `{ note: noteFor(a.agentId, a.kind, rand, a.thought), col: Math.round(a.col) }`. `pickReveal`: first index whose `nowS - lastRevealAtS >= REVEAL_COOLDOWN_S` and some being col within `REVEAL_RADIUS_COLS`. Vocab tables, total over five beings × four contexts, written against each persona's `[MARKS]` clause (`src/agents/persona/loki.ts:82-84`, `npc.ts:48-50,68-72,91-94,118-121`); `plain` lines always present, `thoughted` templates used with probability 0.5 when `thought` is non-empty (folded `thought.trim().toLowerCase()`); unknown agent id falls back to the loki table (the `DEFAULT_MARK_STYLE` philosophy):

```ts
type Lines = { plain: readonly string[]; thoughted?: readonly string[] };
const VOCAB: Record<string, Record<MarkContextKind, Lines>> = {
  loki: {
    after_crossing: { plain: ['crossed over. the ground held.', 'new ground. same habit of checking twice.'], thoughted: ['came over thinking {thought}. still am.'] },
    at_structure: { plain: ['leaned here a while. the wall has opinions.', 'dog-eared this spot. it reads well.'], thoughted: ['stood here on {thought}. the spot agrees.'] },
    at_edge: { plain: ['watched the edge. something watched back.', 'the far side keeps its own hours. noted.'] },
    mid_wander: { plain: ['nothing here. that was the point.'], thoughted: ['wandered off {thought}. found this instead.'] },
  },
  archivist: {
    after_crossing: { plain: ['crossing logged. one of one this hour.', 'arrived. filed under: arrivals.'] },
    at_structure: { plain: ['four visits to this column. this makes five.', 'measured the lean of this wall. within tolerance.'], thoughted: ['noted at station: {thought}. counted once.'] },
    at_edge: { plain: ['edge traffic: sparse. recorded anyway.', 'watched the boundary. nothing crossed. that is also data.'] },
    mid_wander: { plain: ['surveyed between landmarks. registered: grass.'] },
  },
  cat: {
    after_crossing: { plain: ['a warm dent, fresh from the crossing.', 'fur on the threshold. the threshold started it.'] },
    at_structure: { plain: ['slept against this wall. the wall is claimed now.', 'a knocked pebble. it needed knocking.'] },
    at_edge: { plain: ['sat at the drop. judged it.', 'the edge is a shelf with no books. acceptable.'] },
    mid_wander: { plain: ['passed through. rearranged one thing. find it.'] },
  },
  visitor: {
    after_crossing: { plain: ['a bus ticket, dropped just past the seam.', 'left a folded map corner here. wrong map.'] },
    at_structure: { plain: ['initials almost carved, thought better of it.', 'a coffee ring on the step. it was cold anyway.'], thoughted: ['stopped here meaning {thought}. left this instead.'] },
    at_edge: { plain: ['stood here counting the far lights. lost count.', 'a pebble pocketed, a pebble put back.'] },
    mid_wander: { plain: ['dropped a receipt. nothing on it worth keeping.'] },
  },
  ghost: {
    after_crossing: { plain: ['"someone else crossed here once. it was colder then."', 'a chill that arrived with no footsteps.'] },
    at_structure: { plain: ['"this wall was leaned on, all night, years ago."', 'the stone remembers a warmer hand.'], thoughted: ['something meant to {thought} here. long ago.'] },
    at_edge: { plain: ['"the edge was watched before there were watchers."', 'cold gathers where the land stops.'] },
    mid_wander: { plain: ['a patch of air worth avoiding. or not.'] },
  },
};
```

`noteFor(id, kind, rand, thought)`: `const t = VOCAB[id] ?? VOCAB.loki; const e = t[kind]; const th = thought.trim().toLowerCase();` — if `e.thoughted` exists and `th !== ''` and `rand() < 0.5`, pick from `thoughted` and `.replace('{thought}', th)`; else pick from `plain` by `Math.floor(rand() * e.plain.length)`.

- [ ] **Step 4: Run to verify it passes** — `npx tsx scripts/smoke-t2-marks.mts` + `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(marks): pure mark placement/vocab/reveal module + smoke-t2-marks`.

### Task 6: `recordMark` + the load-bearing filter round-trip

**Files:**
- Modify: `src/terminal/terminalMemory.ts` (new helper, the `recordCrossing` :25-50 shape)
- Modify: `scripts/smoke-land-wear-persist.mts` (round-trip leg)

**Interfaces:**
- Produces: `export const MARK_IMPORTANCE = 6;` and `export function recordMark(writer: MemoryWriter, args: { agentId: string; note: string; col: number; row: number }): string | null` — consumed by Task 7.

- [ ] **Step 1: Extend the smoke (failing)** — append before the `db.close()`:

```ts
// 5 · recordMark → placedMarksForCell round-trip (the load-bearing filter)
const { recordMark } = await import('../src/terminal/terminalMemory.ts');
const markId = recordMark(writer, { agentId: 'archivist', note: 'edge traffic: sparse. recorded anyway.', col: 7, row: 12 });
check('mark recorded', markId !== null);
const marks = writer.placedMarksForCell('cell:wingtest');
check('mark visible to the palace read path', marks.length === 1 && marks[0].agentId === 'archivist' && marks[0].location.x === 7 && marks[0].text.includes('edge traffic'));
writer.recordPlan({ agentId: 'cat', text: 'done mark, must stay invisible', steps: [{ kind: 'place_mark', location: { x: 9, y: 12 }, status: 'done' }], status: 'active', importance: 6 });
check('a done step is invisible', writer.placedMarksForCell('cell:wingtest').every((m) => m.location.x !== 9));
check('null writer no-ops', recordMark(nullMemoryWriter, { agentId: 'loki', note: 'x', col: 1, row: 1 }) === null);
```

(Add `nullMemoryWriter` to the existing static import from `router.ts` — it is DB-free, safe to import statically.)

- [ ] **Step 2: Run to verify it fails** — `recordMark` not exported.
- [ ] **Step 3: Implement in `terminalMemory.ts`**:

```ts
/** Palace launch-mark parity (cell.ts handleLaunch): importance 6. */
export const MARK_IMPORTANCE = 6;

/** Persist a land mark as a plan row — the palace's exact shape.
 *  status 'active' + step 'pending' is load-bearing: placedMarksForCell
 *  filters to exactly that pair. Try/caught like every write here. */
export function recordMark(
  writer: MemoryWriter,
  args: { agentId: string; note: string; col: number; row: number },
): string | null {
  try {
    return writer.recordPlan({
      agentId: args.agentId,
      text: args.note,
      steps: [{ kind: 'place_mark', location: { x: args.col, y: args.row }, status: 'pending' }],
      status: 'active',
      importance: MARK_IMPORTANCE,
    });
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes** — the smoke + `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(marks): recordMark helper, palace plan-row parity`.

### Task 7: terminalLand wiring — placement, render, persistence load

**Files:**
- Modify: `src/terminal/terminalLand.ts` only.

**Interfaces:**
- Consumes: `maybeMark`, `noteFor`, `markDisplayRow`, `MARK_RENDER_CAP`, `MarkContextKind` (Task 5); `recordMark` (Task 6); `MARK_STYLES`, `DEFAULT_MARK_STYLE` (Task 1).
- Produces: module-local `marks: MarkView[]`, `addMarkView`, `drawMarks` used by Tasks 8 and 10; `Being.pendingArrivalMark`.

- [ ] **Step 1: Being field** — add `pendingArrivalMark: boolean;` to the `Being` interface (:144-165, next to `enteringSince`); in `addBeing` (:513) initialise `pendingArrivalMark: entering,`.
- [ ] **Step 2: Mark state + layer** — next to the footfall block (:317):

```ts
  interface MarkView { col: number; agentId: string; note: string; text: BitmapText; lastRevealAtS: number }
  const marks: MarkView[] = [];
  const markLastAt = new Map<string, number>();
  const marksLayer = new Container(); // world-local, under beings/edges
  world.addChild(marksLayer);
```

(Insert the `world.addChild(marksLayer)` before the `edgeLayer` creation at :402 so beings and edge glyphs render above marks.) `addMarkView(agentId, note, col)`: BitmapText with `MARK_STYLES[agentId] ?? DEFAULT_MARK_STYLE` glyph, tinted the way terminalLand already tints role-driven text (match whatever helper the site labels / being texts use in this file; the palace shape for reference is cell.ts:634 `hexToInt(theme.palette[roleKey(theme, style.role, style.fallback)])` — add the `roleKey`/`hexToInt` imports only if not already in scope), `x = col * CW`, `y = markDisplayRow(model.surface, col) * CH`, push `{col, agentId, note, text, lastRevealAtS: -Infinity}`; if `marks.length > MARK_RENDER_CAP`, shift the oldest and `destroy()` its text. `drawMarks()`: re-set every mark's `y` from the live `model.surface` (and `x`); call it inside `recompose` after `refreshWear()` (:371).

- [ ] **Step 3: Placement at the re-pick** — immediately before `b.intent = pickIntent(...)` (:790), derive the completed-intent context and try a mark:

```ts
        const done = b.intent;
        let markKind: MarkContextKind | null = null;
        if (b.pendingArrivalMark) { markKind = 'after_crossing'; b.pendingArrivalMark = false; }
        else if (done.kind === 'approach' && Math.abs(b.x - done.targetX) <= APPROACH_NEAR) markKind = 'at_structure';
        else if (done.kind === 'watch_edge' && edgesRef[done.side]) markKind = 'at_edge';
        else if (done.kind === 'wander' || done.kind === 'rest') markKind = 'mid_wander';
        if (markKind) {
          const d = maybeMark(rng, {
            agentId: b.id, kind: markKind, col: Math.round(b.x), nowS: elapsedS,
            lastMarkAtS: markLastAt.get(b.id) ?? -Infinity,
            existingCols: marks.map((m) => m.col), thought: b.mind.intent,
          });
          if (d) {
            markLastAt.set(b.id, elapsedS);
            recordMark(memory, { agentId: b.id, note: d.note, col: d.col, row: model.surface[d.col] });
            addMarkView(b.id, d.note, d.col);
          }
        }
```

(`edgesRef` = however the current open-edge state is named at :833's watch_edge branch — reuse the same source. `recordMark` already try/caught; null writer → null → in-memory only, per spec.)

- [ ] **Step 4: Mount-time load** — inside the `bootstrapMemory(...).then((r) => { memory = r.writer; ... })` (:254-258), after the writer lands: `for (const m of r.writer.placedMarksForCell(cellIdFor(seed)).slice(0, MARK_RENDER_CAP)) addMarkView(m.agentId, m.text, m.location.x);` (stored y advisory, ignored — display row re-derived).
- [ ] **Step 5: Verify** — `npm run typecheck`; byte-identity gates: `npx tsx scripts/smoke-t1-being-intents.mts`, `npx tsx scripts/smoke-t2-society.mts`, `npx tsx scripts/smoke-land-seam.mts`, `npx tsx scripts/smoke-worn-paths.mts`, `npx tsx scripts/smoke-knit-glow.mts`. On-screen: `bash scripts/e2e/run.sh`, then `node scripts/e2e/drive.mjs shot /tmp/marks-shot.png` after driving a being (marks appear over time; the deterministic check lands with Task 10's `debugMark`).
- [ ] **Step 6: Commit** — `feat(land): mark placement rides the intent re-pick + persisted-mark load`.

### Task 8: Reveal wiring

**Files:**
- Modify: `src/terminal/terminalLand.ts` only.

**Interfaces:**
- Consumes: `pickReveal`, `REVEAL_FADE_S`, `REVEAL_HOLD_S` (Task 5); `captionFor` (Task 2); `marks` (Task 7).
- Produces: module-local `reveal: { idx: number; startedAtS: number } | null` — read by Task 10's e2e state.

- [ ] **Step 1: Caption sprite** — after the knit texts are added (~:594): one `BitmapText` (`caption`), `visible = false`, added LAST to `world` (topmost). `const CAPTION_MAX_W = 24;`
- [ ] **Step 2: Tick logic** — in `tick()` after the per-being loop (near the footfall block :870-875):

```ts
    if (!reveal) {
      const idx = pickReveal(marks, beingCols, elapsedS); // beingCols: number[] collected in the being loop
      if (idx !== null) {
        const mark = marks[idx];
        reveal = { mark, startedAtS: elapsedS };
        mark.lastRevealAtS = elapsedS;
        caption.text = captionFor(mark.note, CAPTION_MAX_W);
        caption.x = Math.round(mark.col * CW - caption.width / 2);
        caption.y = markDisplayRow(model.surface, mark.col) * CH - caption.height - CH;
        caption.visible = true; caption.alpha = 0;
      }
    } else if (!marks.includes(reveal.mark)) {
      // Evicted by the render cap mid-reveal: close the caption safely.
      caption.visible = false; reveal = null;
    } else {
      const t = elapsedS - reveal.startedAtS;
      const total = REVEAL_FADE_S + REVEAL_HOLD_S + REVEAL_FADE_S;
      caption.alpha = t < REVEAL_FADE_S ? t / REVEAL_FADE_S
        : t < REVEAL_FADE_S + REVEAL_HOLD_S ? 1
        : Math.max(0, (total - t) / REVEAL_FADE_S);
      if (t >= total) { caption.visible = false; reveal = null; }
    }
```

(`reveal` is `{ mark: MarkView; startedAtS: number } | null` — a reference, not an index, so cap eviction is detected by `marks.includes`. Clamp `caption.x` into `[0, contentW - caption.width]` so seam-adjacent marks don't clip. Everything on `elapsedS` — freezes cleanly under throttle.)
- [ ] **Step 3: Verify** — `npm run typecheck`; e2e: `bash scripts/e2e/run.sh`, drive two beings near a mark (deterministic path lands with Task 10's `debugMark`; interim: place via several `debugWear`-style waits or accept Task 10 as the verification gate), screenshot shows the boxed note above the mark.
- [ ] **Step 4: Commit** — `feat(land): being-proximity note reveal, one slot per land`.

### Task 9: Wear persistence wiring

**Files:**
- Modify: `src/terminal/terminalLand.ts` only.

**Interfaces:**
- Consumes: `decayedCount`, `WEAR_THRESHOLD`, seedable `createFootfall` + `snapshot` (Task 3); writer `landWearForCell`/`flushLandWear` (Task 4).

- [ ] **Step 1: Seed** — change `const footfall = createFootfall();` (:317) to `let footfall = createFootfall();` and add:

```ts
  const seedWear = (w: MemoryWriter): void => {
    const nowMs = Date.now();
    const initial = new Map<number, number>();
    for (const r of w.landWearForCell()) {
      const c = decayedCount(r.count, r.updatedAt, nowMs);
      if (c >= 1) initial.set(r.col, c);
    }
    if (initial.size === 0) return;
    footfall = createFootfall(WEAR_THRESHOLD, initial);
    refreshWear();
  };
  seedWear(memory); // synchronous when the bootstrap cache is warm (worn from frame one)
```

and call `seedWear(r.writer)` inside the bootstrap `.then` too (fresh-process path; a few pre-seed footsteps are dropped by the re-create — acceptable, the counts are heuristic). Closures (`debugWear` :986, `state()` :951, knit reads :496/:945, the tick step :870-875) read the `footfall` binding, so the swap is picked up everywhere.
- [ ] **Step 2: Flush** — constants next to `NEAR_EDGE_REPORT_S` (:114): `const WEAR_FLUSH_S = 30;`. State next to `nearReportAt` (:388): `let wearFlushAt = 0; let wearDirty = false;`. Set `wearDirty = true` at both `footfall.step()` call sites (tick :870-875 and `debugWear` :986-991). In `tick()`, mirroring the near-edge gate (:662-675):

```ts
    if (elapsedS >= wearFlushAt) {
      wearFlushAt = elapsedS + WEAR_FLUSH_S;
      if (wearDirty) { wearDirty = false; flushWear(); }
    }
```

with

```ts
  const flushWear = (): void => {
    try {
      memory.flushLandWear([...footfall.snapshot()].map(([col, count]) => ({ col, count })), Date.now());
    } catch { /* contention costs a lost flush, never a broken tick */ }
  };
```

- [ ] **Step 3: Teardown flush** — first line of the returned teardown closure (:994): `flushWear();`.
- [ ] **Step 4: Verify** — `npm run typecheck`; `npx tsx scripts/smoke-land-wear-persist.mts`; `npx tsx scripts/smoke-worn-paths.mts`; on-screen persistence: launch desktop app (launch-desktop-app skill), `debugWear(12, 8)` via CDP, quit, relaunch, `state().worn` contains 12 before any being moves.
- [ ] **Step 5: Commit** — `feat(land): footfall wear persists per wing with lazy half-life decay`.

### Task 10: e2e surface, docs, full gate

**Files:**
- Modify: `src/terminal/terminalLand.ts` (`TerminalLandState` :166-183, the `declare global` block :185-201, `state()` :927-956, new `debugMark` next to `debugWear` :986-991)
- Modify: `STATE.md` (new slice section + the per-smoke assertion-count table near :1364-1392)

**Interfaces:**
- Consumes: `noteFor` (Task 5), `recordMark` (Task 6), `addMarkView`/`marks`/`reveal` (Tasks 7-8).

- [ ] **Step 1: State surface** — `TerminalLandState` gains `marks: Array<{ col: number; agentId: string; revealed: boolean }>;`; `state()` emits `marks: marks.map((m) => ({ col: m.col, agentId: m.agentId, revealed: reveal !== null && reveal.mark === m }))`.
- [ ] **Step 2: `debugMark`** — declaration `debugMark(col: number, agentId?: string): boolean;` in the global block; implementation next to `debugWear`:

```ts
    debugMark: (col, agentId = 'loki') => {
      const note = noteFor(agentId, 'mid_wander', rng, '');
      recordMark(memory, { agentId, note, col, row: model.surface[Math.max(0, Math.min(model.width - 1, col))] });
      addMarkView(agentId, note, col);
      return marks.some((m) => m.col === col);
    },
```

(Bypasses `maybeMark` gates by design — mirrors `debugWear`'s directness so the harness never waits out a cooldown.)
- [ ] **Step 3: Render-cap check via the hook** — through CDP: call `debugMark(c)` for 14 distinct columns, then assert `state().marks.length === 12` and that the two oldest are gone (MARK_RENDER_CAP eviction is wiring-side, so this is its real test).
- [ ] **Step 3b: On-screen verification (the spec's checklist)** — desktop app via the launch-desktop-app skill, `LOKILIBRARY_TERMINALS=2`:
  - a being lingers at a structure → a mark appears wearing its author's accent (or `debugMark(20, 'archivist')` for the deterministic shot);
  - drive a second being past it (`debugPlace`) → the note unfurls in the `╔═╗` box, holds ~4 s, fades;
  - relaunch WITHOUT reset → same marks and same worn columns present before any being moves (`state().marks`, `state().worn`);
  - key-free rail (no worker running): identical behaviour minus the garnish.
  Screenshot the reveal moment for the review record (`docs/design-reviews/` if it earns it).
- [ ] **Step 4: Full gate** — `npm run typecheck`; then every smoke touched or adjacent: `smoke-t2-marks`, `smoke-land-wear-persist`, `smoke-t1-being-intents`, `smoke-t2-society`, `smoke-t1-society-memory`, `smoke-land-seam`, `smoke-worn-paths`, `smoke-knit-glow`, `smoke-glyph-coverage`, `smoke-salience`, `smoke-ladder-identity`, `smoke-t1-broker-handoff`, `smoke-t3-desk`. Then the remaining `scripts/smoke-*.mts` as the full sweep: `for f in scripts/smoke-*.mts; do npx tsx "$f" || echo "FAIL $f"; done`.
- [ ] **Step 5: Docs** — STATE.md: new dated section (slice shape: marks.ts module, land_wear table + schema v4, writer methods, terminalLand wiring points, the two new smokes with their assertion counts added to the table; note the eyeball-pending status for the on-screen beat if Harry hasn't seen it live yet). TODO-USER.md: add the marginalia on-screen eyeball item (what to look at, per the spec's on-screen checklist).
- [ ] **Step 6: Commit** — `feat(land): marginalia e2e surface + docs; slice complete`.

---

## Verification (end-to-end)

1. `npm run typecheck` (both legs) green.
2. New smokes green: `npx tsx scripts/smoke-t2-marks.mts`, `npx tsx scripts/smoke-land-wear-persist.mts`.
3. Byte-identity gates green: `smoke-t1-being-intents` (ladder untouched), `smoke-t2-society`, `smoke-land-seam` (composeLand untouched), `smoke-worn-paths`, `smoke-glyph-coverage` (moved provenance).
4. Full sweep of all `scripts/smoke-*.mts`.
5. On-screen (desktop app, 2 terminals): mark appears in author accent → reveal unfurls/holds/fades → relaunch-without-reset shows the same marks + worn columns → key-free rail identical minus garnish.

## Risks / notes for the executor

- `smoke-t1-society-memory` may pin `SCHEMA_VERSION === 3`; the version table accumulates rows, update that assertion to v4 (Task 4 Step 4 covers it).
- The `reveal` slot stores the `MarkView` reference, not an index (cap eviction closes the caption safely).
- `footfall` becomes `let`; all existing closures read the binding, no signature changes.
- Pre-seed footsteps in the async-bootstrap window are dropped on re-seed; accepted (heuristic counts).
- `b.mind.intent` is the free-form Tier-1 string (`''` when none) — NOT `b.intent` (the walker intent object). The spec's §2 wording matches `b.mind.intent`.
