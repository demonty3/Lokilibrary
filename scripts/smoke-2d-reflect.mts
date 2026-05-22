/**
 * Phase 2D smoke — `npx tsx scripts/smoke-2d-reflect.mts`.
 *
 * End-to-end memory + reflection chain (no real Worker; stub transport).
 * Verifies:
 *   - Tier-1 dispatch accumulates reflectionCounter via importanceFor()
 *   - routeTier2 short-circuits below threshold
 *   - routeTier2 fires above threshold + writes a Reflection memory
 *     with `synthesised_from` populated
 *   - Vault file lands for the reflection with [[backlinks]]
 *   - retrieval ranks by recency × relevance × importance
 *   - DB-backed MemoryWriter logs Tier-1 + Tier-2 telemetry correctly
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { openMemoryVault } = await import('../src/agents/memory/vault.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const { retrieveScored } = await import('../src/agents/memory/retrieval.ts');
const { cellIdFor, libraryIdFor } = await import('../src/agents/memory/schema.ts');
const { COHORT } = await import('../src/agents/cohort.ts');
const {
  routeTier1,
  routeTier2,
  REFLECTION_THRESHOLD,
} = await import('../src/agents/router.ts');
const { initialRuntime } = await import('../src/state/agentRuntime.ts');
const { recordObservation } = await import('../src/agents/memory/import.ts');

let passed = 0;
let failed = 0;
const failures: string[] = [];
function assert(cond: unknown, msg: string): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-2d-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite'), suppressVecWarning: true });
const vault = openMemoryVault({ rootDir: path.join(tmp, 'vaults') });
const ns = { cellId: cellIdFor(0xa11ce11), libraryId: libraryIdFor('demo') };
const writer = buildMemoryWriter({ db, vault, ns });

const lokiDef = COHORT.find((d) => d.id === 'loki')!;
const lokiRT = initialRuntime({ id: 'loki', x: 5, y: 5 });

console.log('\n[smoke 2d] reflection + retrieval\n');

console.log('Step 1 — accumulate reflectionCounter via Tier-1 dispatches');
let now = 1000;
let dispatched = 0;
// Each player_proximity event adds importance 4. Need 38 dispatches to
// exceed 150 (4 * 38 = 152).
for (let i = 0; i < 50; i++) {
  lokiRT.perceptionQueue.push({
    kind: 'player_proximity',
    subject: 'player',
    at: { x: 6, y: 6 },
    when: now,
  });
  const r = await routeTier1(lokiDef, lokiRT, 'a small room', now, {
    transport: {
      call: async () => ({
        ok: true,
        tick: { action: 'inspect shelves', intent: 'look at top games', model: 'stub', provider: 'stub', latencyMs: 5 },
      }),
      reflect: async () => {
        throw new Error('should not reflect here');
      },
    },
    memory: writer,
    throttleMs: 0, // disable throttle for the soak
  });
  if (r.dispatched) dispatched++;
  now += 100;
  if (lokiRT.reflectionCounter >= REFLECTION_THRESHOLD) break;
}
assert(dispatched >= 38, `dispatched ${dispatched} times (need ≥38 for counter)`);
assert(
  lokiRT.reflectionCounter >= REFLECTION_THRESHOLD,
  `counter crossed threshold (got ${lokiRT.reflectionCounter})`,
);

console.log('\nStep 2 — observation rows persisted');
const obsCount = db.recentForAgent('loki', 200).filter((r) => r.kind === 'observation').length;
assert(obsCount === dispatched, `${dispatched} observations in DB (got ${obsCount})`);

console.log('\nStep 3 — routeTier2 fires above threshold + writes Reflection');
let capturedRecentIds: string[] = [];
const r2 = await routeTier2(lokiDef, lokiRT, now, {
  transport: {
    call: async () => {
      throw new Error('not called in Tier-2 test');
    },
    reflect: async (input) => {
      capturedRecentIds = input.recentMemories.map((m) => m.id);
      return {
        ok: true,
        result: {
          reflection: 'the player keeps coming back to the same shelves',
          synthesised_from: capturedRecentIds.slice(0, 3),
          themes: ['escapism', 'completion'],
          importance: 8,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          latencyMs: 1820,
          tokensIn: 1200,
          tokensOut: 220,
        },
      };
    },
  },
  memory: writer,
});
assert(r2.dispatched === true, 'tier2 dispatched');
assert(r2.reflection?.synthesised_from.length === 3, 'reflection cites 3 synthesised_from ids');
assert(lokiRT.reflectionCounter === 0, 'reflectionCounter reset after fire');

console.log('\nStep 4 — Reflection row visible in DB with synthesised_from');
const allRefs = db.recentForAgent('loki', 200).filter((r) => r.kind === 'reflection');
assert(allRefs.length === 1, `1 reflection row (got ${allRefs.length})`);
const refRow = allRefs[0];
const refPayload = JSON.parse(refRow.payload_json) as { synthesised_from: string[] };
assert(refPayload.synthesised_from.length === 3, 'synthesised_from persisted');

console.log('\nStep 5 — Reflection vault file has [[backlinks]]');
const lokiVaultDir = path.join(tmp, 'vaults', 'loki');
const files = fs.readdirSync(lokiVaultDir).filter((f) => f.includes('--reflection--'));
assert(files.length === 1, `1 reflection .md file (got ${files.length})`);
const reflectMd = fs.readFileSync(path.join(lokiVaultDir, files[0]), 'utf8');
assert(reflectMd.includes('Synthesised from:'), 'vault includes "Synthesised from:" section');
assert(
  capturedRecentIds.slice(0, 3).every((id) => reflectMd.includes(`[[${id}]]`)),
  'vault contains [[id]] for each synthesised_from',
);

console.log('\nStep 6 — second routeTier2 short-circuits below threshold');
const r2b = await routeTier2(lokiDef, lokiRT, now + 1000, {
  transport: { call: async () => ({ ok: false, error: 'never called' }), reflect: async () => ({ ok: false, error: 'never called' }) },
  memory: writer,
});
assert(r2b.dispatched === false && r2b.skipReason === 'below_threshold', 'short-circuits below threshold');

console.log('\nStep 7 — retrieval ranks by recency × relevance × importance');
// Add an old high-importance observation and a recent low-importance one.
recordObservation(
  db,
  vault,
  { agentId: 'loki', cellId: ns.cellId, libraryId: ns.libraryId },
  {
    text: 'long ago a meteor cracked the ceiling',
    source: 'self_perception',
    location: { x: 5, y: 5 },
  },
  { importance: 10, now: now - 60 * 60 * 1000 * 24 }, // 24h old
);
recordObservation(
  db,
  vault,
  { agentId: 'loki', cellId: ns.cellId, libraryId: ns.libraryId },
  {
    text: 'a chair sat where it always does',
    source: 'self_perception',
    location: { x: 4, y: 5 },
  },
  { importance: 1, now }, // recent, importance 1
);
const ranked = retrieveScored(db, 'loki', { topK: 5, now });
assert(ranked.length === 5, '5 results');
// The recent reflection (importance 8) should outrank the 24h-old
// importance-10 observation because recency decay (~0.99^24 = 0.78)
// still dominates the importance gap.
const top = ranked[0];
assert(top.memory.kind !== 'observation' || top.memory.payload.text !== 'long ago a meteor cracked the ceiling',
  `top result is not the old meteor (got "${(top.memory.payload as { text: string }).text.slice(0, 40)}")`);
// All scores should be finite + decreasing.
for (let i = 1; i < ranked.length; i++) {
  assert(ranked[i - 1].total >= ranked[i].total, `score is monotone-decreasing at index ${i}`);
}

console.log('\nStep 8 — telemetry rows persist with correct tiers');
const telDb = (db as unknown as {
  // Touch through the public surface: there's no aggregate yet. Open a
  // separate connection via better-sqlite3 to count rows.
}) as unknown as object;
void telDb;
// Use a fresh raw query through the public surface — easier path: re-open
// with the same path. better-sqlite3 supports multiple connections.
const Database = (globalThis as { require: NodeRequire }).require('better-sqlite3') as new (p: string) => {
  prepare: (s: string) => { all: () => unknown[] };
  close: () => void;
};
const raw = new Database(path.join(tmp, 'memory.sqlite'));
const tier1Rows = raw.prepare("SELECT COUNT(*) as n FROM agent_telemetry WHERE tier=1").all() as Array<{ n: number }>;
const tier2Rows = raw.prepare("SELECT COUNT(*) as n FROM agent_telemetry WHERE tier=2").all() as Array<{ n: number }>;
raw.close();
assert(tier1Rows[0].n === dispatched, `${dispatched} tier-1 telemetry rows (got ${tier1Rows[0].n})`);
assert(tier2Rows[0].n === 1, `1 tier-2 telemetry row (got ${tier2Rows[0].n})`);

db.close();
console.log(`\n[smoke 2d] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\nKept tmp: ${tmp}`);
  process.exit(1);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`[smoke 2d] cleaned ${tmp}`);
