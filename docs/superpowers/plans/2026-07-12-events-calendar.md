# Events Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the palace a clock — a deterministic daily event calendar (notes appear, books move) with a SQLite ledger, a shelf overlay, walk-over rationale marks, agent perception, and a "while you were away" banner line. Zero new AI calls.

**Architecture:** Pure seeded selection in `src/procedural/calendar.ts` (`eventForDay(dayKey, seed, facts)`); staging in `src/agents/events/stage.ts` walks elapsed days (cap 7), writes a `world_events` ledger row per event and applies effects (marks via the existing `recordPlan` path; moves via a read-side shelf overlay in cell.ts with 10-day expiry, max 3 active). Staging runs through a cell-registered closure (mount = boot; App.tsx wake handler calls it).

**Tech Stack:** TypeScript strict (both legs), better-sqlite3 (existing store), smokes via `npx tsx scripts/smoke-*.mts` + `makeChecker`, e2e via `scripts/e2e/run.sh` + `drive.mjs`.

## Global Constraints

- **Determinism:** `eventForDay` and every catalogue template are pure — no `Math.random()`, no `Date.now()` inside selection; PRNG = `mulberry32((fnv1a32(dayKey) ^ profileSeed) >>> 0)`. Same (day, seed, library) → identical event, forever.
- **Register contract** (spec § 1): every template note is Loki-voiced — lowercase game names, understatement, no exclamation marks, never addresses the user, **≤ 90 chars** (the caption contract). The catalogue text in this plan is APPROVED CREATIVE CONTENT — transcribe verbatim.
- **Numbers (spec-locked):** event probability **0.4/day**; kind split **note 0.6 / move 0.4**; catch-up cap **7 days**; first run stages **today only**; move expiry **10 days**; **max 3** concurrent active moves; one event max per day (`day` is the ledger PK).
- **Zero new AI calls.** Events reach agents ONLY as perception (`world_event`, importance 6).
- Every task ends green: `npm run typecheck` + `for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done` before its commit; commit per task; `git push && git push origin claude/consolidation-pass:main` after each.
- Renderer-touching work carries the **mandatory screenshot-eyeball step** (brain: reviews-miss-visual-defects).

---

### Task 1: Pure selection — `calendar.ts` + the authored catalogue

**Files:**
- Modify: `src/procedural/seed.ts` (export the existing private `fnv1a32`)
- Create: `src/procedural/calendar.ts`
- Test: `scripts/smoke-calendar.mts` (new)

**Interfaces:**
- Consumes: `mulberry32`/`Prng` from `src/procedural/prng.ts` (`next(): number in [0,1)`, `range(min,max)`, `pick(arr)`); `LibraryGame` from `src/types.ts`.
- Produces (later tasks rely on these exact names):
  - `fnv1a32(s: string): number` exported from `src/procedural/seed.ts`
  - from `src/procedural/calendar.ts`:
    - `dayKey(date: Date): string`
    - `addDays(dayKey: string, n: number): string`
    - `type CalendarBook = { appid: number; name: string; hours: number }`
    - `interface LibraryFacts { dustiest: CalendarBook[]; loved: CalendarBook[]; abandoned: CalendarBook[]; mastered: CalendarBook[]; unplayed: CalendarBook[] }`
    - `buildLibraryFacts(games: readonly LibraryGame[] | null): LibraryFacts`
    - `type DayEvent = { kind: 'note'; day: string; templateId: string; target: CalendarBook; note: string } | { kind: 'move'; day: string; templateId: string; pair: [CalendarBook, CalendarBook]; note: string }`
    - `eventForDay(day: string, profileSeed: number, facts: LibraryFacts): DayEvent | null`
    - `type ShelfMove = { day: string; pair: [{ appid: number }, { appid: number }] }`
    - `activeMovesFrom(events: ReadonlyArray<{ day: string; kind: string; payload: string }>, todayKey: string): ShelfMove[]` (expiry + 3-cap, pure)

- [ ] **Step 1: Export `fnv1a32` from seed.ts**

In `src/procedural/seed.ts`, change `function fnv1a32(s: string): number {` to `export function fnv1a32(s: string): number {` (the doc comment above it stays).

- [ ] **Step 2: Write the failing smoke**

Create `scripts/smoke-calendar.mts`:

```ts
/**
 * Events-calendar smoke — `npx tsx scripts/smoke-calendar.mts`.
 * Locks the pure selection contract: determinism, probability bounds,
 * kind split, catalogue fall-through, register lint on every template,
 * dayKey shape, and the active-move expiry/cap math.
 */
import { makeChecker } from './lib/smoke.ts';
import type { LibraryGame } from '../src/types.ts';

const {
  dayKey, addDays, buildLibraryFacts, eventForDay, activeMovesFrom,
} = await import('../src/procedural/calendar.ts');

const { check, report } = makeChecker('smoke calendar');

const g = (appid: number, name: string, mins: number, state?: LibraryGame['state']): LibraryGame => ({
  appid, name, playtime_forever: mins, ...(state && { state }),
});
const GAMES: LibraryGame[] = [
  g(1, 'Hades', 91 * 60, 'loved'),
  g(2, 'Elden Ring', 140 * 60, 'loved'),
  g(3, 'Crusader Kings III', 210 * 60, 'dusty'),
  g(4, 'Baldur\'s Gate 3', 80 * 60, 'dusty'),
  g(5, 'Celeste', 12 * 60, 'abandoned'),
  g(6, 'Hollow Knight', 30 * 60, 'abandoned'),
  g(7, 'Outer Wilds', 30 * 60, 'mastered'),
  g(8, 'Terraria', 0),
];
const FACTS = buildLibraryFacts(GAMES);
const SEED = 0xc0ffee;

// dayKey shape + arithmetic
check('dayKey format', /^\d{4}-\d{2}-\d{2}$/.test(dayKey(new Date(2026, 6, 12))));
check('dayKey local(y,m,d)', dayKey(new Date(2026, 6, 12)) === '2026-07-12');
check('addDays crosses month', addDays('2026-07-31', 1) === '2026-08-01');
check('addDays negative', addDays('2026-07-01', -1) === '2026-06-30');

// determinism: identical across repeated calls
const e1 = eventForDay('2026-07-12', SEED, FACTS);
const e2 = eventForDay('2026-07-12', SEED, FACTS);
check('deterministic', JSON.stringify(e1) === JSON.stringify(e2));

// probability + split over a fixed 1000-day window (all deterministic)
let events = 0, notes = 0, moves = 0;
let d = '2026-01-01';
for (let i = 0; i < 1000; i++) {
  const e = eventForDay(d, SEED, FACTS);
  if (e) { events++; if (e.kind === 'note') notes++; else moves++; }
  d = addDays(d, 1);
}
check('event rate ≈0.4 (±0.06)', events >= 340 && events <= 460, `events=${events}`);
check('note share ≈0.6 of events (±0.1)', notes / events >= 0.5 && notes / events <= 0.7, `notes=${notes}/${events}`);
check('moves happen', moves > 0);

// register lint on every event the window produced
d = '2026-01-01';
let lintOk = true, lintDetail = '';
for (let i = 0; i < 1000; i++) {
  const e = eventForDay(d, SEED, FACTS);
  if (e) {
    if (e.note.includes('!')) { lintOk = false; lintDetail = `! in ${e.templateId}`; break; }
    if (e.note.length > 90) { lintOk = false; lintDetail = `${e.note.length} chars in ${e.templateId}`; break; }
    if (/\byou\b/i.test(e.note)) { lintOk = false; lintDetail = `addresses user in ${e.templateId}`; break; }
  }
  d = addDays(d, 1);
}
check('register lint over 1000-day window', lintOk, lintDetail);

// long-name safety: 60-char name must still yield ≤90-char notes
const LONG = buildLibraryFacts([
  g(9, 'The Extraordinarily Protracted Chronicle of the Unfinished Kingdom Deluxe', 300 * 60, 'dusty'),
  g(10, 'Another Very Extremely Long Game Title That Goes On And On Forever OK', 200 * 60, 'dusty'),
]);
d = '2026-01-01';
let longOk = true;
for (let i = 0; i < 400; i++) {
  const e = eventForDay(d, SEED, LONG);
  if (e && e.note.length > 90) { longOk = false; break; }
  d = addDays(d, 1);
}
check('long names never exceed 90 chars', longOk);

// fall-through: empty library → always quiet
const EMPTY = buildLibraryFacts([]);
d = '2026-01-01';
let quiet = true;
for (let i = 0; i < 200; i++) {
  if (eventForDay(d, SEED, EMPTY) !== null) { quiet = false; break; }
  d = addDays(d, 1);
}
check('empty library → always quiet', quiet);

// facts: ordering + membership
check('dustiest sorted playtime desc', FACTS.dustiest[0]?.appid === 3);
check('unplayed detected', FACTS.unplayed[0]?.appid === 8);

// activeMovesFrom: expiry (10 days), cap (3), kind filter, bad payload skipped
const mv = (day: string) => ({ day, kind: 'move', payload: JSON.stringify({ kind: 'move', day, templateId: 't', pair: [{ appid: 1, name: 'a', hours: 1 }, { appid: 2, name: 'b', hours: 1 }], note: 'n' }) });
const rows = [mv('2026-07-01'), mv('2026-07-03'), mv('2026-07-08'), mv('2026-07-10'), mv('2026-07-11'),
  { day: '2026-07-12', kind: 'note', payload: '{}' }, { day: '2026-07-09', kind: 'move', payload: 'not-json' }];
const active = activeMovesFrom(rows, '2026-07-12');
check('expiry: 07-01 dropped (>10 days)', !active.some((m) => m.day === '2026-07-01'));
check('cap: at most 3 active', active.length === 3);
check('cap keeps newest 3', active.map((m) => m.day).join(',') === '2026-07-08,2026-07-10,2026-07-11');
check('notes + bad payloads ignored', !active.some((m) => m.day === '2026-07-12' || m.day === '2026-07-09'));

report();
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx tsx scripts/smoke-calendar.mts`
Expected: FAIL — `Cannot find module '../src/procedural/calendar.ts'`

- [ ] **Step 4: Create `src/procedural/calendar.ts`**

```ts
/**
 * Events calendar — pure selection (spec:
 * docs/superpowers/specs/2026-07-12-events-calendar-design.md).
 *
 * The world has a clock: each real calendar day, this module decides —
 * deterministically from (dayKey × profileSeed × library facts) — whether
 * the palace stages an event and which one. Same inputs → same event on
 * every machine, forever; history (which days actually got staged) lives
 * in the SQLite ledger, not here.
 *
 * Under src/procedural/'s charter: no Math.random(), no Date.now() inside
 * selection — the date arrives as an argument. PRNG namespace: the fnv of
 * the dayKey XOR the profile seed.
 *
 * The template notes are AUTHORED CONTENT in Loki's register (see the
 * agent-mind spec § Voice): lowercase names, understatement, no
 * exclamation marks, never addressed to anyone, ≤ 90 chars (the walk-over
 * caption contract). Don't add a template without running
 * scripts/smoke-calendar.mts's register lint over it.
 */

import { mulberry32, type Prng } from './prng';
import { fnv1a32 } from './seed';
import type { LibraryGame } from '../types';

export const EVENT_PROBABILITY = 0.4;
export const NOTE_SHARE = 0.6;
export const CATCHUP_CAP_DAYS = 7;
export const MOVE_EXPIRY_DAYS = 10;
export const MAX_ACTIVE_MOVES = 3;

/** Local-time YYYY-MM-DD. Day boundary = local midnight. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** dayKey ± n days (uses local Date arithmetic; DST-safe via noon anchor). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const anchor = new Date(y, m - 1, d, 12); // noon dodges DST edges
  anchor.setDate(anchor.getDate() + n);
  return dayKey(anchor);
}

/** Days from a to b (b - a), both dayKeys. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const A = Date.UTC(ay, am - 1, ad);
  const B = Date.UTC(by, bm - 1, bd);
  return Math.round((B - A) / 86_400_000);
}

export interface CalendarBook {
  appid: number;
  name: string;
  hours: number;
}

export interface LibraryFacts {
  dustiest: CalendarBook[];
  loved: CalendarBook[];
  abandoned: CalendarBook[];
  mastered: CalendarBook[];
  unplayed: CalendarBook[];
}

function toBook(g: LibraryGame): CalendarBook {
  return { appid: g.appid, name: g.name, hours: Math.round(g.playtime_forever / 60) };
}

/** (playtime desc, appid asc) — the codebase's stable-selection idiom. */
function byPlaytime(a: LibraryGame, b: LibraryGame): number {
  return b.playtime_forever - a.playtime_forever || a.appid - b.appid;
}

export function buildLibraryFacts(games: readonly LibraryGame[] | null): LibraryFacts {
  const gs = games ?? [];
  const of = (pred: (g: LibraryGame) => boolean): CalendarBook[] =>
    gs.filter(pred).sort(byPlaytime).map(toBook);
  return {
    dustiest: of((g) => g.state === 'dusty'),
    loved: of((g) => g.state === 'loved'),
    abandoned: of((g) => g.state === 'abandoned'),
    mastered: of((g) => g.state === 'mastered'),
    unplayed: of((g) => g.playtime_forever === 0),
  };
}

export type DayEvent =
  | { kind: 'note'; day: string; templateId: string; target: CalendarBook; note: string }
  | { kind: 'move'; day: string; templateId: string; pair: [CalendarBook, CalendarBook]; note: string };

/** Lowercased, length-capped name for note text (caption budget). */
function short(name: string): string {
  const n = name.toLowerCase();
  return n.length > 28 ? `${n.slice(0, 27)}…` : n;
}

interface NoteTemplate {
  id: string;
  resolve(facts: LibraryFacts): { target: CalendarBook; note: string } | null;
}

interface MoveTemplate {
  id: string;
  resolve(facts: LibraryFacts): { pair: [CalendarBook, CalendarBook]; note: string } | null;
}

/** The authored catalogue. Order matters — selection falls through it
 *  deterministically. Every note passes the register lint. */
const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: 'dust-recent',
    resolve(f) {
      const t = f.dustiest[0];
      if (!t || t.hours < 20) return null;
      return { target: t, note: `${t.hours} hours in ${short(t.name)}. the dust is recent. noted.` };
    },
  },
  {
    id: 'spine-lean',
    resolve(f) {
      const t = f.loved[0];
      if (!t) return null;
      return { target: t, note: `${short(t.name)} again. the shelf leans from use. left it leaning.` };
    },
  },
  {
    id: 'mid-sentence',
    resolve(f) {
      const t = f.abandoned[0];
      if (!t) return null;
      return { target: t, note: `${short(t.name)} stopped mid-sentence. the bookmark is still warm.` };
    },
  },
  {
    id: 'practices-patience',
    resolve(f) {
      const t = f.unplayed[0];
      if (!t) return null;
      return { target: t, note: `${short(t.name)} has never been opened. it practices patience.` };
    },
  },
  {
    id: 'sits-differently',
    resolve(f) {
      const t = f.mastered[0];
      if (!t) return null;
      return { target: t, note: `${short(t.name)} is finished and knows it. it sits differently.` };
    },
  },
  {
    id: 'counted-readings',
    resolve(f) {
      const t = f.loved[1];
      if (!t) return null;
      return { target: t, note: `the ${short(t.name)} spine is darker where thumbs go. counted the readings.` };
    },
  },
];

const MOVE_TEMPLATES: readonly MoveTemplate[] = [
  {
    id: 'compare-notes',
    resolve(f) {
      const [a, b] = [f.abandoned[0], f.abandoned[1]];
      if (!a || !b) return null;
      return { pair: [a, b], note: 'both left mid-story. they can compare notes.' };
    },
  },
  {
    id: 'always-meeting',
    resolve(f) {
      const [a, b] = [f.loved[0], f.loved[1]];
      if (!a || !b) return null;
      return { pair: [a, b], note: 'the two most-thumbed spines. they were always going to meet.' };
    },
  },
  {
    id: 'someone-had-to',
    resolve(f) {
      const [a, b] = [f.dustiest[0], f.dustiest[1]];
      if (!a || !b) return null;
      return { pair: [a, b], note: 'neither has moved in months. moved them. someone had to.' };
    },
  },
];

/** The day's event, or null for a quiet day. Pure + deterministic. */
export function eventForDay(day: string, profileSeed: number, facts: LibraryFacts): DayEvent | null {
  const prng: Prng = mulberry32((fnv1a32(day) ^ profileSeed) >>> 0);
  if (prng.next() >= EVENT_PROBABILITY) return null;
  const wantNote = prng.next() < NOTE_SHARE;

  const tryNotes = (): DayEvent | null => {
    const resolved = NOTE_TEMPLATES
      .map((t) => ({ id: t.id, r: t.resolve(facts) }))
      .filter((x): x is { id: string; r: { target: CalendarBook; note: string } } => x.r !== null);
    if (resolved.length === 0) return null;
    const pickd = resolved[prng.range(0, resolved.length)];
    return { kind: 'note', day, templateId: pickd.id, target: pickd.r.target, note: pickd.r.note };
  };
  const tryMoves = (): DayEvent | null => {
    const resolved = MOVE_TEMPLATES
      .map((t) => ({ id: t.id, r: t.resolve(facts) }))
      .filter((x): x is { id: string; r: { pair: [CalendarBook, CalendarBook]; note: string } } => x.r !== null);
    if (resolved.length === 0) return null;
    const pickd = resolved[prng.range(0, resolved.length)];
    return { kind: 'move', day, templateId: pickd.id, pair: pickd.r.pair, note: pickd.r.note };
  };

  // Preferred kind first; fall through to the other; both dry → quiet day.
  return wantNote ? (tryNotes() ?? tryMoves()) : (tryMoves() ?? tryNotes());
}

export interface ShelfMove {
  day: string;
  pair: [{ appid: number }, { appid: number }];
}

/** Read-side move filter: within MOVE_EXPIRY_DAYS of `todayKey`, newest
 *  MAX_ACTIVE_MOVES win. Rows are ledger rows (payload = DayEvent JSON);
 *  malformed payloads and non-move rows are skipped. Pure — the ledger
 *  itself is never mutated (history is history). */
export function activeMovesFrom(
  events: ReadonlyArray<{ day: string; kind: string; payload: string }>,
  todayKey: string,
): ShelfMove[] {
  const moves: ShelfMove[] = [];
  for (const row of events) {
    if (row.kind !== 'move') continue;
    const age = daysBetween(row.day, todayKey);
    if (age < 0 || age >= MOVE_EXPIRY_DAYS) continue;
    try {
      const ev = JSON.parse(row.payload) as { pair?: Array<{ appid?: number }> };
      const [a, b] = ev.pair ?? [];
      if (typeof a?.appid !== 'number' || typeof b?.appid !== 'number') continue;
      moves.push({ day: row.day, pair: [{ appid: a.appid }, { appid: b.appid }] });
    } catch {
      // malformed history row — skip, never throw into the renderer
    }
  }
  moves.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return moves.slice(-MAX_ACTIVE_MOVES);
}
```

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-calendar.mts`
Expected: summary line `[smoke calendar] N assertions passed` with no failures. (If the event-rate bound fails marginally, the PRNG stream is legitimately outside ±0.06 for this seed — verify the observed rate is within 0.34–0.46 for TWO other seeds before widening the smoke's tolerance, and say so in the report.)

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green.

```bash
git add src/procedural/seed.ts src/procedural/calendar.ts scripts/smoke-calendar.mts
git commit -m "feat(events): pure day-function calendar + authored catalogue

eventForDay(day, seed, facts): 0.4/day, notes 0.6 / moves 0.4,
deterministic fall-through catalogue (6 note + 3 move templates in
Loki's register, ≤90 chars), activeMovesFrom read-side expiry/cap.
fnv1a32 exported from seed.ts. Smoke-locked incl. 1000-day
probability window + register lint.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 2: Ledger — `world_events` table + writer methods

**Files:**
- Modify: `src/agents/memory/schema.ts` (SCHEMA_VERSION +1; row type), `src/agents/memory/db.ts` (CREATE TABLE + insert/list), `src/agents/memory/writer.ts` (three methods), `src/agents/router.ts` (`MemoryWriter` interface + `nullMemoryWriter` no-ops)
- Test: `scripts/smoke-events-store.mts` (new; real better-sqlite3, mirroring `smoke-5c2-lore-store.mts`'s construction pattern)

**Interfaces:**
- Consumes: `DayEvent`, `activeMovesFrom`, `ShelfMove` from Task 1.
- Produces (Tasks 3–4 rely on): `MemoryWriter` gains
  - `recordWorldEvent(event: DayEvent): void` (INSERT OR IGNORE — `day` PK makes staging idempotent)
  - `lastStagedDay(): string | null`
  - `activeShelfMoves(todayKey: string): ShelfMove[]`
  - null writer: no-op / `null` / `[]`.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-events-store.mts` — open `scripts/smoke-5c2-lore-store.mts` FIRST and construct the writer the exact way it does (same imports, same temp-db location/options); then:

```ts
/**
 * world_events store smoke — `npx tsx scripts/smoke-events-store.mts`.
 * Real better-sqlite3: recordWorldEvent persists + is idempotent per day,
 * lastStagedDay tracks the max day, activeShelfMoves applies the pure
 * expiry/cap filter over real rows.
 */
import { makeChecker } from './lib/smoke.ts';
const { check, report } = makeChecker('smoke events-store');

// [writer construction copied from smoke-5c2-lore-store.mts — same
//  bootstrap, temp path, teardown]

const noteEvent = { kind: 'note' as const, day: '2026-07-10', templateId: 'dust-recent',
  target: { appid: 3, name: 'Crusader Kings III', hours: 210 },
  note: '210 hours in crusader kings iii. the dust is recent. noted.' };
const moveEvent = { kind: 'move' as const, day: '2026-07-11', templateId: 'compare-notes',
  pair: [{ appid: 5, name: 'Celeste', hours: 12 }, { appid: 6, name: 'Hollow Knight', hours: 30 }] as [any, any],
  note: 'both left mid-story. they can compare notes.' };

check('empty ledger → lastStagedDay null', writer.lastStagedDay() === null);
writer.recordWorldEvent(noteEvent);
writer.recordWorldEvent(moveEvent);
check('lastStagedDay = max day', writer.lastStagedDay() === '2026-07-11');
writer.recordWorldEvent({ ...moveEvent, note: 'DIFFERENT' });
check('same-day re-record is ignored (idempotent)', writer.activeShelfMoves('2026-07-12').length === 1);
const active = writer.activeShelfMoves('2026-07-12');
check('move surfaces as active', active[0]?.pair[0].appid === 5 && active[0]?.pair[1].appid === 6);
check('note rows never surface as moves', !active.some((m) => m.day === '2026-07-10'));
check('expired move filtered', writer.activeShelfMoves('2026-09-01').length === 0);

report();
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-events-store.mts`
Expected: FAIL — `writer.recordWorldEvent is not a function` (after the copied construction compiles).

- [ ] **Step 3: Schema + db**

`src/agents/memory/schema.ts`: increment `SCHEMA_VERSION` by 1 (read the current literal, +1). Add:

```ts
/** Events-calendar ledger row (spec 2026-07-12-events-calendar-design). */
export interface WorldEventRow {
  day: string;      // YYYY-MM-DD, PK — one event max per day
  kind: string;     // 'note' | 'move'
  payload: string;  // DayEvent JSON
  staged_at: number;
}
```

`src/agents/memory/db.ts`: append to the `bootstrap` exec block (after `agent_personas`/`lore`, matching the file's SQL style):

```sql
    CREATE TABLE IF NOT EXISTS world_events (
      day       TEXT PRIMARY KEY,
      kind      TEXT NOT NULL CHECK (kind IN ('note','move')),
      payload   TEXT NOT NULL,
      staged_at INTEGER NOT NULL
    );
```

and add two functions following the file's existing prepared-statement style:

```ts
export function insertWorldEvent(db: SqliteHandle, row: WorldEventRow): void {
  db.prepare(
    'INSERT OR IGNORE INTO world_events (day, kind, payload, staged_at) VALUES (?, ?, ?, ?)',
  ).run(row.day, row.kind, row.payload, row.staged_at);
}

export function listWorldEvents(db: SqliteHandle): WorldEventRow[] {
  return db.prepare('SELECT day, kind, payload, staged_at FROM world_events ORDER BY day ASC')
    .all() as WorldEventRow[];
}
```

(Adapt `SqliteHandle`/import names to the file's actual local aliases.)

- [ ] **Step 4: Interface + implementations**

`src/agents/router.ts` — add to the `MemoryWriter` interface (after `placedMarksForCell`):

```ts
  /** Events calendar (spec 2026-07-12): persist one day's event.
   *  INSERT OR IGNORE on the day PK — staging stays idempotent. */
  recordWorldEvent(event: import('../procedural/calendar').DayEvent): void;
  /** Latest staged dayKey, or null on first run. */
  lastStagedDay(): string | null;
  /** Moves currently shaping the shelves (expiry + cap applied). */
  activeShelfMoves(todayKey: string): import('../procedural/calendar').ShelfMove[];
```

(If the file's style prefers top-level imports over inline `import()`, hoist them — `calendar.ts` is a leaf module, no cycle.) Add to `nullMemoryWriter`: `recordWorldEvent() {},` `lastStagedDay() { return null; },` `activeShelfMoves() { return []; },`.

`src/agents/memory/writer.ts` — implement in `buildMemoryWriter`'s returned object:

```ts
    recordWorldEvent(event) {
      insertWorldEvent(db, {
        day: event.day, kind: event.kind,
        payload: JSON.stringify(event), staged_at: Date.now(),
      });
    },
    lastStagedDay() {
      const rows = listWorldEvents(db);
      return rows.length > 0 ? rows[rows.length - 1].day : null;
    },
    activeShelfMoves(todayKey) {
      return activeMovesFrom(listWorldEvents(db), todayKey);
    },
```

If `npm run typecheck` flags any smoke's from-scratch `MemoryWriter` fake, fix it by spreading `nullMemoryWriter` under the fake's overrides (`{ ...nullMemoryWriter, <existing overrides> }`) — do not hand-write the three methods per fake. List every file you touched this way in your report.

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-events-store.mts`
Expected: all assertions pass.

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: all green.

```bash
git add src/agents/memory/schema.ts src/agents/memory/db.ts src/agents/memory/writer.ts src/agents/router.ts scripts/smoke-events-store.mts
git commit -m "feat(events): world_events ledger + writer methods

recordWorldEvent (INSERT OR IGNORE on day PK), lastStagedDay,
activeShelfMoves (pure expiry/cap via activeMovesFrom). Null writer
no-ops keep the web build event-free like marks.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 3: Staging — `stage.ts`, perception, dispatch buffer

**Files:**
- Create: `src/agents/events/stage.ts`
- Modify: `src/agents/router.ts` (`broadcastWorldEvent` + `importanceFor` case `'world_event'` → 6)
- Test: `scripts/smoke-events-stage.mts` (new; fake writer)

**Interfaces:**
- Consumes: Task 1 (`eventForDay`, `dayKey`, `addDays`, `CATCHUP_CAP_DAYS`, `buildLibraryFacts`), Task 2 writer methods, `broadcastGameLaunched`'s pattern in router.ts, `AgentRuntimeState`/`listRuntimesIn`.
- Produces (Task 4 relies on):
  - `stageMissedDays(deps: StageDeps): StagedSummary` where `StageDeps = { writer: MemoryWriter; games: readonly LibraryGame[] | null; profileSeed: number; slotForAppid(appid: number): CellPoint | null; runtimes: readonly AgentRuntimeState[]; now: Date }` and `StagedSummary = { staged: number }`
  - `registerStageNow(fn: (() => void) | null): void` + `callStageNow(): boolean` (module-level registration, e2e-hook pattern)
  - `consumeCalendarDispatch(): { agentName: string; text: string; hadPlan: boolean } | null`

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-events-stage.mts`:

```ts
/**
 * Staging smoke — `npx tsx scripts/smoke-events-stage.mts`.
 * Fake writer: catch-up walk (cap 7), first-run today-only, idempotence
 * via recorded days, note→recordPlan effect with resolved slot, move→
 * ledger + rationale mark, perception broadcast, dispatch line buffer.
 */
import { makeChecker } from './lib/smoke.ts';
import type { LibraryGame } from '../src/types.ts';

const { stageMissedDays, consumeCalendarDispatch } = await import('../src/agents/events/stage.ts');
const { nullMemoryWriter } = await import('../src/agents/router.ts');
const { eventForDay, buildLibraryFacts, dayKey, addDays } = await import('../src/procedural/calendar.ts');

const { check, report } = makeChecker('smoke events-stage');

const g = (appid: number, name: string, mins: number, state?: LibraryGame['state']): LibraryGame => ({
  appid, name, playtime_forever: mins, ...(state && { state }),
});
const GAMES: LibraryGame[] = [
  g(1, 'Hades', 91 * 60, 'loved'), g(2, 'Elden Ring', 140 * 60, 'loved'),
  g(3, 'Crusader Kings III', 210 * 60, 'dusty'), g(4, 'BG3', 80 * 60, 'dusty'),
  g(5, 'Celeste', 12 * 60, 'abandoned'), g(6, 'Hollow Knight', 30 * 60, 'abandoned'),
];
const SEED = 0xc0ffee;
const NOW = new Date(2026, 6, 12, 9, 0, 0);

function fakeWriter(initialLastDay: string | null) {
  const events: Array<{ day: string; kind: string }> = [];
  const plans: Array<{ agentId: string; text: string; steps: any[] }> = [];
  let last = initialLastDay;
  return {
    writer: {
      ...nullMemoryWriter,
      recordWorldEvent(ev: any) { events.push({ day: ev.day, kind: ev.kind }); last = ev.day; },
      lastStagedDay() { return last; },
      recordPlan(args: any) { plans.push(args); return 'plan-id'; },
    },
    events, plans,
  };
}
const runtime = { id: 'archivist', present: true, perceptionQueue: [] as any[] } as any;

// first run: today only
const fr = fakeWriter(null);
const s1 = stageMissedDays({ writer: fr.writer as any, games: GAMES, profileSeed: SEED,
  slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [runtime], now: NOW });
const todayEvent = eventForDay(dayKey(NOW), SEED, buildLibraryFacts(GAMES));
check('first run stages ≤1 day', fr.events.length <= 1);
check('first run matches pure function', (todayEvent === null) === (fr.events.length === 0));
check('summary.staged consistent', s1.staged === fr.events.length);

// catch-up: 30 days away → at most 7 walked
const far = fakeWriter(addDays(dayKey(NOW), -30));
stageMissedDays({ writer: far.writer as any, games: GAMES, profileSeed: SEED,
  slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [runtime], now: NOW });
check('catch-up cap: staged days ⊆ last 7', far.events.every((e) =>
  ['2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11','2026-07-12'].includes(e.day)));

// idempotence: already staged today → nothing new
const same = fakeWriter(dayKey(NOW));
const s3 = stageMissedDays({ writer: same.writer as any, games: GAMES, profileSeed: SEED,
  slotForAppid: () => ({ x: 5, y: 5 }), runtimes: [runtime], now: NOW });
check('same-day rerun stages nothing', s3.staged === 0 && same.events.length === 0);

// effects: every staged event leaves a loki place_mark plan with the note
check('every event leaves a rationale mark', far.events.length === far.plans.length
  && far.plans.every((p) => p.agentId === 'loki' && p.steps[0]?.kind === 'place_mark' && typeof p.text === 'string'));

// perception: one world_event per staged event
check('perception broadcast', runtime.perceptionQueue.filter((e: any) => e.kind === 'world_event').length > 0
  || far.events.length === 0);

// dispatch buffer: line present when staged>0, drained after consume
const line = consumeCalendarDispatch();
if (far.events.length + fr.events.length > 0) {
  check('dispatch line buffered', line !== null && /changed while you were away/.test(line!.text));
} else {
  check('no events → no line', line === null);
}
check('buffer drains', consumeCalendarDispatch() === null);

report();
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/smoke-events-stage.mts`
Expected: FAIL — `Cannot find module '../src/agents/events/stage.ts'`

- [ ] **Step 3: `broadcastWorldEvent` + importance**

`src/agents/router.ts` — next to `broadcastGameLaunched` (same shape):

```ts
/**
 * Events calendar — inject a `world_event` perception into every present
 * agent's queue when staging lands an event. The cohort's existing tiers
 * do the reacting (the Archivist logs Loki's mischief on its own); this
 * is the calendar's ONLY contact with the AI layer — no new call types.
 */
export function broadcastWorldEvent(
  runtimes: readonly AgentRuntimeState[],
  args: { day: string; kind: string; at: { x: number; y: number }; when: number },
): void {
  for (const rt of runtimes) {
    if (!rt.present) continue;
    rt.perceptionQueue.push({
      kind: 'world_event',
      subject: `${args.kind}:${args.day}`,
      at: { x: args.at.x, y: args.at.y },
      when: args.when,
    });
  }
}
```

and add to `importanceFor`'s switch (above the default): `case 'world_event': return 6;`

- [ ] **Step 4: Create `src/agents/events/stage.ts`**

```ts
/**
 * Events-calendar staging (spec 2026-07-12-events-calendar-design § 2).
 *
 * Walks real days elapsed since the last staged day (cap
 * CATCHUP_CAP_DAYS; first run = today only), asks the pure calendar
 * what happened each day, and materializes it: a ledger row (idempotent
 * on the day PK), a loki place_mark plan carrying the event's note (the
 * "legible" constraint — every event's rationale is findable on the
 * floor), and one world_event perception per staged event.
 *
 * Invoked through a cell-registered closure (the e2e-hook registration
 * pattern) because effects need the live layout: mountCell registers
 * stageNow at mount and runs it once (boot path); App.tsx's wake handler
 * calls callStageNow() (a day may roll over mid-sleep). Best-effort:
 * failures warn, never throw into mount or the wake handler.
 */

import {
  addDays,
  buildLibraryFacts,
  CATCHUP_CAP_DAYS,
  dayKey,
  daysBetween,
  eventForDay,
} from '../../procedural/calendar';
import type { LibraryGame } from '../../types';
import type { CellPoint } from '../../procedural/cell';
import type { AgentRuntimeState } from '../../state/agentRuntime';
import { broadcastWorldEvent, type MemoryWriter } from '../router';

export interface StageDeps {
  writer: MemoryWriter;
  games: readonly LibraryGame[] | null;
  profileSeed: number;
  /** Resolve a book's CURRENT base shelf slot; null if not shelved. */
  slotForAppid(appid: number): CellPoint | null;
  runtimes: readonly AgentRuntimeState[];
  now: Date;
}

export interface StagedSummary {
  staged: number;
}

/** One buffered banner line; drained by the morning-dispatch caller. */
let calendarDispatch: { agentName: string; text: string; hadPlan: boolean } | null = null;

export function consumeCalendarDispatch(): typeof calendarDispatch {
  const out = calendarDispatch;
  calendarDispatch = null;
  return out;
}

export function stageMissedDays(deps: StageDeps): StagedSummary {
  const today = dayKey(deps.now);
  const last = deps.writer.lastStagedDay();
  // First run: today only. Otherwise from the day after `last`, capped to
  // the most recent CATCHUP_CAP_DAYS — a month away yields ≤7 rows and
  // older days collapse into quiet (the palace kept its calendar; it
  // does not flood the floor).
  let from = last === null ? today : addDays(last, 1);
  if (daysBetween(from, today) >= CATCHUP_CAP_DAYS) {
    from = addDays(today, -(CATCHUP_CAP_DAYS - 1));
  }
  if (daysBetween(from, today) < 0) return { staged: 0 };

  const facts = buildLibraryFacts(deps.games);
  let staged = 0;
  for (let d = from; daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    try {
      const event = eventForDay(d, deps.profileSeed, facts);
      if (!event) continue;
      deps.writer.recordWorldEvent(event);
      // The rationale mark: at the note's target slot, or the move
      // pair's first-book slot (the pair's shared shelf area).
      const anchorAppid = event.kind === 'note' ? event.target.appid : event.pair[0].appid;
      const slot = deps.slotForAppid(anchorAppid);
      if (slot) {
        deps.writer.recordPlan({
          agentId: 'loki',
          text: event.note,
          steps: [{ kind: 'place_mark', target: `shelf:${slot.x},${slot.y}`, location: slot, status: 'pending' }],
          status: 'active',
          importance: 6,
        });
      }
      broadcastWorldEvent(deps.runtimes, {
        day: event.day,
        kind: event.kind,
        at: slot ?? { x: 0, y: 0 },
        when: Date.now(),
      });
      staged++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[events] staging ${d} failed: ${(e as Error).message}`);
    }
  }

  if (staged > 0) {
    calendarDispatch = {
      agentName: 'the palace',
      text: `kept its calendar. ${staged} thing${staged === 1 ? '' : 's'} changed while you were away.`,
      hadPlan: false,
    };
  }
  return { staged };
}

/** Cell-registered staging closure (last mount wins; cleared at
 *  teardown) — the e2e-hook registration pattern. */
let stageNow: (() => void) | null = null;
export function registerStageNow(fn: (() => void) | null): void {
  stageNow = fn;
}
export function callStageNow(): boolean {
  if (!stageNow) return false;
  stageNow();
  return true;
}
```

- [ ] **Step 5: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-events-stage.mts`
Expected: all assertions pass.

- [ ] **Step 6: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add src/agents/events/stage.ts src/agents/router.ts scripts/smoke-events-stage.mts
git commit -m "feat(events): staging — elapsed-day walk, effects, perception

stageMissedDays: cap-7 catch-up (first run = today only), ledger row +
loki rationale mark per event, world_event perception (importance 6)
to present agents, banner line buffered for the dispatch overlay.
Registered-closure invocation (cell owns the layout).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 4: Integration — shelf overlay, boot/wake staging, banner, e2e hooks

**Files:**
- Modify: `src/render/levels/cell.ts` (overlay + stageNow registration + boot staging, ordered before the marks loop), `src/App.tsx` (wake path calls `callStageNow()`, banner line boot + wake), `src/debug/e2eHook.ts` (`calendarEventFor` + `setCalendarMoves`)
- Test: e2e verification via the harness (screenshots, controller-eyeballed)

**Interfaces:**
- Consumes: Tasks 1–3 exports; `getPlayerPos`-style module registration already in cell.ts (`e2ePlaceMark`); `mountMorningDispatch` (`lines: {agentName, text, hadPlan}[]`); `useAppStore` profile/library; `profileSeed` from `src/procedural/seed.ts` (cell.ts's seed is already derived from it upstream — reuse the `seed` value cell.ts already has).
- Produces: `window.__loki.calendarEventFor(day: string): unknown` (pure eval of the live library) and `window.__loki.setCalendarMoves(moves: ShelfMove[]): void` (DEV/E2E overlay injection; takes effect on next remount — use `setTheme` to force one).

- [ ] **Step 1: The shelf overlay + staging call in cell.ts**

Right after the base `slotToBook` map is built (`const slotToBook = new Map<string, BookGame>();` + its fill loop) and BEFORE anything consumes it, insert:

```ts
  // Events calendar (spec 2026-07-12): stage elapsed days FIRST (so a
  // note staged today renders in this very mount's marks loop below),
  // then apply active moves to the base assignment. slotForAppid
  // resolves against the BASE map — a mark anchors to where the book
  // lives before today's shuffle.
  const slotOfAppid = new Map<number, CellPoint>();
  for (const [key, book] of slotToBook) {
    const [sx, sy] = key.split(',').map(Number);
    slotOfAppid.set(book.appid, { x: sx, y: sy });
  }
  registerStageNow(() => {
    stageMissedDays({
      writer: memoryWriter,
      games: useAppStore.getState().library,
      profileSeed: seed,
      slotForAppid: (appid) => slotOfAppid.get(appid) ?? null,
      runtimes: listRuntimesIn(scope),
      now: new Date(),
    });
  });
  callStageNow(); // boot path — idempotent per day via the ledger PK

  // Apply active moves: pairwise swaps on the ordered slot assignment.
  // Adjacency = consecutive indices in bookshelfSlots order (spec § 3).
  const e2eMoves = getE2ECalendarMoves(); // DEV/E2E only; [] in prod
  const movesToApply = [
    ...memoryWriter.activeShelfMoves(dayKey(new Date())),
    ...e2eMoves,
  ];
  for (const move of movesToApply) {
    applyShelfMove(slotToBook, layout.bookshelfSlots, move);
  }
```

with two module-scope helpers in cell.ts (near `MARK_STYLES`):

```ts
/** Swap books so a move's pair sits at consecutive bookshelfSlots
 *  indices: the second book moves to index(first)+1; the displaced book
 *  takes the vacated slot. Skips defensively when either appid is not
 *  currently shelved (library changed since staging) or first is the
 *  last slot. */
function applyShelfMove(
  slotToBook: Map<string, BookGame>,
  slots: readonly CellPoint[],
  move: { pair: [{ appid: number }, { appid: number }] },
): void {
  const keyOf = (p: CellPoint): string => `${p.x},${p.y}`;
  const indexOfAppid = (appid: number): number =>
    slots.findIndex((s) => slotToBook.get(keyOf(s))?.appid === appid);
  const i = indexOfAppid(move.pair[0].appid);
  const j = indexOfAppid(move.pair[1].appid);
  if (i < 0 || j < 0 || i + 1 >= slots.length || j === i + 1) return;
  const destKey = keyOf(slots[i + 1]);
  const srcKey = keyOf(slots[j]);
  const displaced = slotToBook.get(destKey);
  const moving = slotToBook.get(srcKey);
  if (!moving) return;
  slotToBook.set(destKey, moving);
  if (displaced) slotToBook.set(srcKey, displaced);
  else slotToBook.delete(srcKey);
}

/** DEV/E2E move injection (mirrors e2ePlaceMark). */
let e2eCalendarMoves: Array<{ pair: [{ appid: number }, { appid: number }] }> = [];
export function setE2ECalendarMoves(moves: typeof e2eCalendarMoves): void {
  e2eCalendarMoves = moves;
}
function getE2ECalendarMoves(): typeof e2eCalendarMoves {
  return e2eCalendarMoves;
}
```

Imports for cell.ts: `registerStageNow, stageMissedDays` from `../../agents/events/stage`; `dayKey` from `../../procedural/calendar`; `useAppStore` and `listRuntimesIn` are already imported (verify — add if not). In the teardown closure add `registerStageNow(null);` next to `e2ePlaceMark = null;`.

**Ordering check (must hold):** cohort mount (runtimes exist) → base `slotToBook` → staging (writes today's mark + broadcasts) → overlay swaps → bookshelf consumers → `placedMarksForCell` loop (now sees today's mark). Verify the marks loop is positionally after this insertion; if the file's current order differs, move the insertion, not the loop.

- [ ] **Step 2: App.tsx — wake staging + banner (boot + wake)**

In the wake branch (`prevState === 'sleeping' && next !== 'sleeping'`), BEFORE `consumeSleepReflections()`: add `callStageNow();` (import from `./agents/events/stage`). Then merge the calendar line:

```ts
        const calendarLine = consumeCalendarDispatch();
        const lines = [
          ...(calendarLine ? [calendarLine] : []),
          ...consumeSleepReflections(),
        ];
```

(adjust the existing `const lines = consumeSleepReflections();` accordingly — the overlay call below it is unchanged).

Boot path: in the same effect where PixiApp mounts (after mount succeeds), add a one-shot check ~2.5 s after mount so boot staging's line surfaces:

```ts
      // Events calendar — boot banner. Staging ran inside mountCell; if
      // it landed events, surface the one-line dispatch. One-shot, only
      // when a line is actually buffered.
      const calendarBootTimer = setTimeout(() => {
        const line = consumeCalendarDispatch();
        const ctx = getCurrentRenderContext();
        if (line && ctx) {
          mountMorningDispatch({ app: ctx.app, theme: ctx.theme, lines: [line] });
        }
      }, 2500);
```

and clear it in that effect's cleanup (`clearTimeout(calendarBootTimer);`). Match the surrounding effect's structure — `getCurrentRenderContext` and `mountMorningDispatch` are already imported in App.tsx.

- [ ] **Step 3: e2e hooks**

`src/debug/e2eHook.ts` — add to the interface + object (following `placeMark`'s style):

```ts
  /** Events calendar — pure selection preview for a given dayKey against
   *  the LIVE library + seed (DEV/E2E only). */
  calendarEventFor(day: string): unknown;
  /** Events calendar — inject shelf moves for the overlay; takes effect
   *  on the next cell mount (drive a remount via setTheme). */
  setCalendarMoves(moves: Array<{ pair: [{ appid: number }, { appid: number }] }>): void;
```

```ts
    calendarEventFor(day) {
      const s = useAppStore.getState();
      const profile = s.profile;
      const seed = profile ? profileSeed(profile) : 0;
      return eventForDay(day, seed, buildLibraryFacts(s.library));
    },
    setCalendarMoves(moves) {
      setE2ECalendarMoves(moves);
    },
```

Imports: `eventForDay, buildLibraryFacts` from `../procedural/calendar`; `profileSeed` from `../procedural/seed`; `setE2ECalendarMoves` from `../render/levels/cell`. NOTE: if cell.ts's seed derivation for the sample library differs from `profileSeed(profile)` (no profile in web build), return `eventForDay(day, 0, …)` — the hook's job is determinism preview, and seed 0 is fine for the harness; state this in your report.

- [ ] **Step 4: e2e verification (screenshots, mandatory eyeball)**

Run: `bash scripts/e2e/run.sh` then:

```bash
# determinism: same day twice → identical JSON
node scripts/e2e/drive.mjs eval "JSON.stringify(__loki.calendarEventFor('2026-07-15'))"
node scripts/e2e/drive.mjs eval "JSON.stringify(__loki.calendarEventFor('2026-07-15'))"
# base shelves
node scripts/e2e/drive.mjs shot /tmp/events-base.png
# inject a move between the 1st and 3rd shelved books (self-contained —
# reads the live store, no hand-copied appids), force remount, re-shot:
node scripts/e2e/drive.mjs eval "(() => { const lib = __loki.store.getState().library ?? []; if (lib.length < 3) return 'lib-too-small'; __loki.setCalendarMoves([{ pair: [{ appid: lib[0].appid }, { appid: lib[2].appid }] }]); return 'moves-set'; })()"
node scripts/e2e/drive.mjs eval "__loki.setTheme('gruvbox-dark')" && sleep 4
node scripts/e2e/drive.mjs shot /tmp/events-moved.png
```

READ both PNGs: `events-moved.png` must show the shelf headers/covers reordered relative to `events-base.png` (theme differs too — that's fine, compare ORDER not colour; if order is illegible at full size, crop the shelf rows). Confirm the two determinism evals returned byte-identical JSON. Reset: `setCalendarMoves([])` + `setTheme(null)`. Kill the harness (`pkill -f "vite preview --port 4173"; pkill -f loki-e2e-chrome-profile`).

(The staged-mark + caption path was e2e-proven in the agent-mind pass; the note-event's mark rides the identical `recordPlan`/`placedMarksForCell`/caption machinery, and the desktop is where the writer is real. Do not attempt writer-backed staging in the web harness.)

- [ ] **Step 5: Full verification + commit**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add src/render/levels/cell.ts src/App.tsx src/debug/e2eHook.ts
git commit -m "feat(events): shelf overlay + boot/wake staging + banner line

Base slot assignment now takes active calendar moves (consecutive-index
adjacency, defensive on missing appids); staging runs at cell mount via
the registered closure and on wake; the morning dispatch gains 'the
palace kept its calendar…' on both paths. e2e hooks: calendarEventFor
(determinism preview) + setCalendarMoves (+ setTheme remount trick).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push && git push origin claude/consolidation-pass:main
```

---

### Task 5: Verification sweep

**Files:** none created (fixes fold back into owning tasks' files).

- [ ] **Step 1: Full mechanical sweep**

Run: `npm run typecheck && for f in scripts/smoke-*.mts; do echo "── $f"; npx tsx "$f" || break; done`
Expected: typecheck clean both legs; every smoke green (suite grew by 3 files this arc).

- [ ] **Step 2: e2e regression + events re-verification**

Run: `bash scripts/e2e/run.sh`, then (a) plain boot shot — must look normal (no events in the web build's null writer: no marks, no banner, base shelf order); (b) repeat Task 4 Step 4's move-overlay verification fresh; (c) the agent-mind caption regression: `placeMark` at spawn + walk-over caption still renders above agents. READ every screenshot; describe each in the report. Kill the harness after.

- [ ] **Step 3: Report the arc summary**

No commit (nothing changed unless fixes were needed — those follow their owning task's verification + a `fix(events): …` commit). Report: sweep results per smoke, e2e evidence with image paths + one-line descriptions, any deviations.
