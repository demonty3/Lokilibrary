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
    if (/\byou(r|rs)?\b/i.test(e.note)) { lintOk = false; lintDetail = `addresses user in ${e.templateId}`; break; }
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
