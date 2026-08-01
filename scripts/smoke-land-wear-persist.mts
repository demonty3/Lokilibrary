/**
 * Marginalia slice smoke — `npx tsx scripts/smoke-land-wear-persist.mts`.
 * Locks persistent wear:
 *   - decayedCount half-life math (halve per real day, clamp negative age)
 *   - createFootfall seeding (pre-worn columns worn from frame one) + snapshot
 *   - land_wear flush/restore round-trip, prune-below-1, namespacing
 *   - recordMark → placedMarksForCell round-trip, active+pending filter
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';
import { createFootfall, decayedCount, WEAR_HALF_LIFE_MS } from '../src/terminal/wear.ts';
import { nullMemoryWriter } from '../src/agents/router.ts';

// The memory modules resolve better-sqlite3 via a global require.
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

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

// 2b · fractional seed crossing (decayed counts are not integers)
const frac = createFootfall(8, new Map([[7, 7.3]]));
check('fractional seed: not yet worn', !frac.worn.has(7));
check('fractional seed crosses on the next step', frac.step(7) && frac.worn.has(7));
check('crossing fires exactly once', !frac.step(7));

// 3 · snapshot
const snap = seeded.snapshot();
check('snapshot holds seeded + stepped counts', snap.get(5) === 9 && snap.get(6) === 8);
const before = seeded.snapshot().get(5);
(snap as Map<number, number>).set(5, 999);
check('snapshot is a copy', seeded.snapshot().get(5) === before);

// 4 · real DB round-trip
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
check('null writer wear no-ops', (nullMemoryWriter.flushLandWear([{ col: 1, count: 5 }], now), nullMemoryWriter.landWearForCell().length === 0));

// 5 · recordMark → placedMarksForCell round-trip (the load-bearing filter)
const { recordMark } = await import('../src/terminal/terminalMemory.ts');
const markId = recordMark(writer, { agentId: 'archivist', note: 'edge traffic: sparse. recorded anyway.', col: 7, row: 12 });
check('mark recorded', markId !== null);
const marks = writer.placedMarksForCell('cell:wingtest');
check('mark visible to the palace read path', marks.length === 1 && marks[0].agentId === 'archivist' && marks[0].location.x === 7 && marks[0].text.includes('edge traffic'));
writer.recordPlan({ agentId: 'cat', text: 'done mark, must stay invisible', steps: [{ kind: 'place_mark', location: { x: 9, y: 12 }, status: 'done' }], status: 'active', importance: 6 });
check('a done step is invisible', writer.placedMarksForCell('cell:wingtest').every((m) => m.location.x !== 9));
check('null writer mark no-ops', recordMark(nullMemoryWriter, { agentId: 'loki', note: 'x', col: 1, row: 1 }) === null);

db.close();
fs.rmSync(tmp, { recursive: true, force: true });

report();
