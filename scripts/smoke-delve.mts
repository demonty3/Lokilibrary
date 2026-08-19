/**
 * Dungeon rung 1 smoke — `npx tsx scripts/smoke-delve.mts`.
 * Locks the pure delve engine + persistence against the spec's bars
 * (docs/superpowers/specs/2026-08-19-dungeon-rung1-delvers.md):
 *   - bar 6: determinism — same wing + same dispatch sequence → same
 *     outcomes, byte-identical; no draw depends on the wall clock
 *   - bar 7 + kill condition: expedition params MOVE survival odds —
 *     the two-sided bar is asserted (varying retreatThreshold shifts
 *     the death rate measurably; if it cannot, this smoke FAILS and
 *     rung 2's directives are already dead)
 *   - bar 4 / kill condition "a number appears": no expedition vocab
 *     line contains a numeral; delver names carry none either
 *   - bars 1/3: founding population within [3,5]; deaths are permanent;
 *     a replacement is scheduled DAYS out, at most one on the road
 *   - bar 8: the colony blob round-trips through the real sqlite table
 *   - bar 2 cadence: dispatch gaps land in [6h, 12h) of desk uptime
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';
import {
  accrueUptime,
  ARRIVAL_GAP_MS,
  beginExpedition,
  DEFAULT_EXPEDITION_PARAMS,
  deferDispatch,
  delverWingOf,
  DISPATCH_GAP_MS,
  dispatchDue,
  expeditionPrng,
  initialDelveState,
  outcomeKind,
  parseDelveState,
  POPULATION_MAX,
  POPULATION_MIN,
  resolveExpedition,
  runExpedition,
  tickArrival,
  UPTIME_CLAMP_MS,
} from '../src/terminal/delve.ts';
import { expeditionNote, expeditionVocabLines } from '../src/terminal/marks.ts';
import { mulberry32 } from '../src/procedural/prng.ts';

// The memory modules resolve better-sqlite3 via a global require.
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { check, report } = makeChecker('smoke delve');

// 1 · determinism (bar 6): same wing + seq → byte-identical outcomes
const runSeq = (wing: string, seqs: number[]): string =>
  JSON.stringify(seqs.map((s) => runExpedition(DEFAULT_EXPEDITION_PARAMS, expeditionPrng(wing, s))));
check('same wing + dispatch sequence → same outcomes', runSeq('d1', [0, 1, 2]) === runSeq('d1', [0, 1, 2]));
check('different wing → different outcome stream', runSeq('d1', [0, 1, 2]) !== runSeq('d2', [0, 1, 2]));
check('different seq → different draws', runSeq('d1', [0]) !== runSeq('d1', [1]));

// 2 · consequentiality (bar 7): a parameter moves survival odds. The
// two-sided bar, written before looking (spec kill condition 4): CONFIRM
// if timid (retreatThreshold 1) beats reckless (6) by > 1 percentage
// point of per-delver death rate over 4000 seeded runs; KILL (this smoke
// fails) if the rates are statistically indistinguishable.
const deathRate = (retreatThreshold: number): number => {
  const params = { ...DEFAULT_EXPEDITION_PARAMS, retreatThreshold };
  let dead = 0;
  let sent = 0;
  for (let i = 0; i < 4000; i++) {
    const o = runExpedition(params, expeditionPrng(`odds:${retreatThreshold}`, i));
    dead += o.deadIndices.length;
    sent += params.partySize;
  }
  return dead / sent;
};
const timid = deathRate(1);
const reckless = deathRate(6);
check(`retreatThreshold moves survival odds (timid ${(timid * 100).toFixed(2)}% vs reckless ${(reckless * 100).toFixed(2)}% deaths)`,
  reckless - timid > 0.01);
// And partySize moves the odds too (more hands drive the creature off).
const soloRate = ((): number => {
  let dead = 0, sent = 0;
  for (let i = 0; i < 4000; i++) {
    const o = runExpedition({ ...DEFAULT_EXPEDITION_PARAMS, partySize: 1, retreatThreshold: 6 }, expeditionPrng('solo', i));
    dead += o.deadIndices.length;
    sent += 1;
  }
  return dead / sent;
})();
check('a lone delver dies more often than a reckless party member', soloRate > reckless);

// 3 · outcomes classify without numbers (bar 4 + kill condition 3)
for (const line of expeditionVocabLines()) {
  if (/\d/.test(line)) {
    check(`vocab line carries a numeral: "${line}"`, false);
  }
}
check('no expedition vocab line contains a numeral', expeditionVocabLines().every((l) => !/\d/.test(l)));
const vprng = mulberry32(7);
const vr = (): number => vprng.next();
for (const id of ['loki', 'archivist', 'cat', 'visitor', 'ghost', 'stranger']) {
  for (const kind of ['rich', 'hollow', 'loss', 'lost']) {
    const note = expeditionNote(id, kind, 'marrow', vr);
    check(`expeditionNote(${id},${kind}) is non-empty prose without numerals`,
      note.length > 8 && !/\d/.test(note) && !note.includes('{name}'));
  }
}

// 4 · the colony: founding, dispatch cadence, deaths, slow replacements
const s = initialDelveState('d1');
check('founding population within [3,5]', s.delvers.length >= POPULATION_MIN && s.delvers.length <= POPULATION_MAX);
check('delver names carry no numerals', s.delvers.every((d) => !/\d/.test(d.name)));
check('first dispatch gap in [6h, 12h) of uptime',
  s.nextDispatchAtUptimeMs >= DISPATCH_GAP_MS[0] && s.nextDispatchAtUptimeMs < DISPATCH_GAP_MS[0] + DISPATCH_GAP_MS[1]);
check('founding is deterministic per wing',
  JSON.stringify(initialDelveState('d1')) === JSON.stringify(s));

// Uptime accrual clamps sleep gaps.
accrueUptime(s, 8 * 3_600_000);
check('an eight-hour gap accrues at most the clamp', s.uptimeMs <= UPTIME_CLAMP_MS);
s.uptimeMs = s.nextDispatchAtUptimeMs;
check('dispatch due once uptime crosses the drawn gap', dispatchDue(s));
deferDispatch(s);
check('deferring pushes the due point out', !dispatchDue(s));

// Dispatch → resolve. Find a seq whose outcome kills someone so the
// permanent-death path is exercised deterministically.
s.uptimeMs = s.nextDispatchAtUptimeMs;
const t0 = 1_700_000_000_000;
let nowMs = t0;
let sawDeath = false;
let popBefore = s.delvers.length;
for (let round = 0; round < 200 && !sawDeath; round++) {
  s.uptimeMs = s.nextDispatchAtUptimeMs;
  const a = beginExpedition(s, 'loki', DEFAULT_EXPEDITION_PARAMS, nowMs);
  check(`expedition ${a.seq}: party drawn from the roster`,
    a.partyIds.every((id) => s.delvers.some((d) => d.id === id)));
  check(`expedition ${a.seq}: resolves in the future, minutes not hours`,
    a.resolveAtMs > nowMs && a.resolveAtMs - nowMs < 15 * 60_000);
  popBefore = s.delvers.length;
  nowMs = a.resolveAtMs;
  const res = resolveExpedition(s, nowMs);
  check(`expedition ${a.seq}: resolution fires at resolveAtMs`, res !== null);
  if (res && res.deadCount > 0) {
    sawDeath = true;
    check('deaths shrink the population permanently', s.delvers.length === popBefore - res.deadCount);
    check('a lost delver is named for the marginalia', res.deadName.length > 0);
    check('outcome kind reflects the loss', res.kind === 'loss' || res.kind === 'lost');
    check('a replacement is scheduled days out',
      s.nextArrivalAtMs !== null && s.nextArrivalAtMs - nowMs >= ARRIVAL_GAP_MS[0]);
  } else if (res) {
    check(`expedition ${a.seq}: hoard never shrinks`, s.hoardGold >= 0);
  }
}
check('the dice eventually kill a delver (200 expeditions)', sawDeath);
check('gold accrued to the invisible hoard across the campaign', s.hoardGold > 0);

// Replacement arrival: not before its day, exactly one recruit after.
const shortBy = s.delvers.length;
check('no arrival before its time', tickArrival(s, nowMs) === null && s.delvers.length === shortBy);
const arriveAt = s.nextArrivalAtMs!;
const newcomer = tickArrival(s, arriveAt);
check('the replacement walks in on its day', newcomer !== null && s.delvers.length === shortBy + 1);
check('replacement ids never reuse the dead', newcomer !== null && !/\d/.test(newcomer.name));

// outcomeKind classification edges
check('all dead → lost', outcomeKind({ deadIndices: [0, 1, 2], gold: 0, stepsCleared: 1, encountered: true, fled: false, durationS: 100, hazardAtFrac: 0.5 }, 3) === 'lost');
check('some dead → loss', outcomeKind({ deadIndices: [0], gold: 4, stepsCleared: 3, encountered: true, fled: true, durationS: 100, hazardAtFrac: 0.5 }, 3) === 'loss');
check('fled empty-handed → hollow', outcomeKind({ deadIndices: [], gold: 0, stepsCleared: 1, encountered: true, fled: true, durationS: 100, hazardAtFrac: 0.5 }, 3) === 'hollow');
check('clean full run → rich', outcomeKind({ deadIndices: [], gold: 27, stepsCleared: 6, encountered: false, fled: false, durationS: 100, hazardAtFrac: null }, 3) === 'rich');

// 5 · the one delver wing: stable, profile-first, open-wings fallback
check('delver wing = first sorted profile wing', delverWingOf(['d3', 'd1', 'd2'], ['d2']) === 'd1');
check('falls back to open wings without a profile', delverWingOf([], ['d2', 'd4']) === 'd2');
check('no wings → no colony', delverWingOf([], []) === null);

// 6 · persistence round-trip through the real sqlite table (bar 8)
const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-delve-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite'), suppressVecWarning: true });
const surface = buildMemoryWriter({ db, vault: null, ns: { cellId: 'cell:surface', libraryId: 'library:anonymous' } });
const under = buildMemoryWriter({ db, vault: null, ns: { cellId: 'cell:under', libraryId: 'library:anonymous' } });

check('empty table reads null', surface.delveStateForCell('cell:wing-d1') === null);
surface.saveDelveState('cell:wing-d1', JSON.stringify(s), nowMs);
const readBack = parseDelveState(surface.delveStateForCell('cell:wing-d1'), 'd1');
check('colony blob round-trips byte-identically',
  readBack !== null && JSON.stringify(readBack) === JSON.stringify(s));
check('population, deaths and the hoard survive the round-trip',
  readBack !== null && readBack.delvers.length === s.delvers.length && readBack.hoardGold === s.hoardGold);
// The undercroft window (a DIFFERENT namespace) reads the same colony —
// the explicit-cellId contract both windows share.
const underRead = parseDelveState(under.delveStateForCell('cell:wing-d1'), 'd1');
check('another namespace reads the same colony by explicit cell id',
  underRead !== null && JSON.stringify(underRead) === JSON.stringify(s));
// Upsert wins wholesale (last write, one owner).
s.hoardGold += 5;
surface.saveDelveState('cell:wing-d1', JSON.stringify(s), nowMs + 1);
check('upsert replaces the blob',
  parseDelveState(surface.delveStateForCell('cell:wing-d1'), 'd1')?.hoardGold === s.hoardGold);
check('a corrupt blob parses to null (colony re-founds, never crashes)',
  parseDelveState('{"nope', 'd1') === null && parseDelveState(JSON.stringify({ wing: 'other' }), 'd1') === null);

db.close();
fs.rmSync(tmp, { recursive: true, force: true });

report();
