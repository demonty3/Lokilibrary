/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-society-memory.mts`.
 * Locks the record-only memory contract:
 *   - crossing/arrival writes hit MemoryWriter.recordPerception with the
 *     documented kinds, subjects, locations and importances (spy writer)
 *   - the null writer no-ops gracefully (web build path)
 *   - a throwing writer is swallowed (multi-process sqlite contention)
 *   - REAL DB round-trip: writer.ts renders the crossing as prose, kind
 *     'observation', riding the schema-v3 ObservationSource vocabulary
 *     (crossings/arrivals carry their own first-class source tokens,
 *     `terminal_crossing` / `terminal_arrival`, not a frozen enum)
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';
import { nullMemoryWriter, type MemoryWriter } from '../src/agents/router.ts';
import {
  ARRIVAL_IMPORTANCE,
  CROSSING_IMPORTANCE,
  recordArrival,
  recordCrossing,
} from '../src/terminal/terminalMemory.ts';

// The memory modules resolve better-sqlite3 via a global require.
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { check, report } = makeChecker('smoke t1-society-memory');

// --- 1 · spy writer sees the documented shape --------------------------------
interface Call {
  agentId: string;
  event: { kind: string; subject?: string; at: { x: number; y: number }; when: number };
  importance: number;
}
const calls: Call[] = [];
const spy: MemoryWriter = {
  ...nullMemoryWriter,
  recordPerception: (agentId, event, importance) => {
    calls.push({ agentId, event: event as Call['event'], importance });
    return 'mem-1';
  },
};
check('recordCrossing returns the writer id',
  recordCrossing(spy, { agentId: 't1-L0', fromWing: 'd0', toWing: 'd1', col: 0, row: 12, whenMs: 1000 }) === 'mem-1');
check('crossing kind', calls[0]?.event.kind === 'terminal_crossing');
check('crossing subject is from→to', calls[0]?.event.subject === 'd0→d1');
check('crossing importance', calls[0]?.importance === CROSSING_IMPORTANCE);
check('crossing location is the entry cell', calls[0]?.event.at.x === 0 && calls[0]?.event.at.y === 12);
recordArrival(spy, { agentId: 't1-L0', wing: 'd0', col: 6, row: 11, whenMs: 1000 });
check('arrival kind', calls[1]?.event.kind === 'terminal_arrival');
check('arrival subject is the wing', calls[1]?.event.subject === 'd0');
check('arrival importance', calls[1]?.importance === ARRIVAL_IMPORTANCE);

// --- 2 · graceful no-ops --------------------------------------------------------
check('null writer → null, no throw',
  recordCrossing(nullMemoryWriter, { agentId: 'x', fromWing: 'd0', toWing: 'd1', col: 0, row: 0, whenMs: 0 }) === null);
const thrower: MemoryWriter = {
  ...nullMemoryWriter,
  recordPerception: () => {
    throw new Error('SQLITE_BUSY');
  },
};
check('throwing writer → null, no throw',
  recordCrossing(thrower, { agentId: 'x', fromWing: 'd0', toWing: 'd1', col: 0, row: 0, whenMs: 0 }) === null);

// --- 3 · real DB round-trip (writer.ts describe/source mapping) ------------------
const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { openMemoryVault } = await import('../src/agents/memory/vault.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-t1-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite') });
const vault = openMemoryVault({ rootDir: path.join(tmp, 'vaults') });
const writer = buildMemoryWriter({ db, vault, ns: { cellId: 'cell:t1test', libraryId: 'library:anonymous' } });
const id = recordCrossing(writer, { agentId: 't1-L0', fromWing: 'd0', toWing: 'd1', col: 0, row: 12, whenMs: Date.now() });
check('DB write returns an id', typeof id === 'string' && (id as string).length > 0);
const recent = writer.recentMemories('t1-L0', 5);
check('row lands in the stream', recent.length === 1);
check('row kind is observation', recent[0]?.kind === 'observation');
check('row text reads as prose', recent[0]?.text === 'crossed from the d0 terminal into d1');
check('row importance persisted', recent[0]?.importance === CROSSING_IMPORTANCE);

// ── T2 society: proper source tokens (SCHEMA_VERSION 3) ────────────────
// A crossing row must carry its OWN source, not the v2 'self_perception' fold.
{
  const id = recordCrossing(writer, {
    agentId: 'loki', fromWing: 'd0', toWing: 'd1', col: 3, row: 12, whenMs: 1700000000000,
  });
  check('crossing recorded', id !== null);
  // Open a read-only connection to verify the raw payload (WAL allows concurrent access).
  const Database = require('better-sqlite3');
  const rawDb = new Database(path.join(tmp, 'memory.sqlite'), { readonly: true });
  try {
    const row = rawDb
      .prepare(`SELECT payload_json FROM memories WHERE id = ?`)
      .get(id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as { source: string };
    check('crossing source token', payload.source === 'terminal_crossing',
      payload.source);
  } finally {
    rawDb.close();
  }
}
{
  const id = recordArrival(writer, { agentId: 'loki', wing: 'd1', col: 0, row: 12, whenMs: 1700000000001 });
  const Database = require('better-sqlite3');
  const rawDb = new Database(path.join(tmp, 'memory.sqlite'), { readonly: true });
  try {
    const row = rawDb
      .prepare(`SELECT payload_json FROM memories WHERE id = ?`)
      .get(id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as { source: string };
    check('arrival source token', payload.source === 'terminal_arrival', payload.source);
  } finally {
    rawDb.close();
  }
}
{
  const Database = require('better-sqlite3');
  const rawDb = new Database(path.join(tmp, 'memory.sqlite'), { readonly: true });
  try {
    check('schema_version contains 3',
      (rawDb.prepare(`SELECT COUNT(*) AS n FROM schema_version WHERE version = 3`).get() as { n: number }).n === 1);
  } finally {
    rawDb.close();
  }
}

db.close();
fs.rmSync(tmp, { recursive: true, force: true });

report();
