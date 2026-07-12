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
