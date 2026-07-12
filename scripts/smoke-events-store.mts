/**
 * world_events store smoke — `npx tsx scripts/smoke-events-store.mts`.
 * Real better-sqlite3: recordWorldEvent persists + is idempotent per day,
 * lastStagedDay tracks the max day, activeShelfMoves applies the pure
 * expiry/cap filter over real rows.
 */
import { createRequire } from 'node:module';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { makeChecker } from './lib/smoke.ts';
const { check, report } = makeChecker('smoke events-store');

// [writer construction copied from smoke-5c2-lore-store.mts — same
//  bootstrap, temp path, teardown]
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');

const tmpRoot = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'lokilib-events-'));
const dbPath = nodePath.join(tmpRoot, 'memory.sqlite');
const db = openMemoryDb({ path: dbPath, suppressVecWarning: true });

const vault = null;
const writer = buildMemoryWriter({ db, vault, ns: { cellId: 'cell:1', libraryId: 'library:aaa' } });

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

db.close();
try { nodeFs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }

report();
