/**
 * Phase 2A smoke — runnable with `npx tsx scripts/smoke-2a-memory.mts`.
 *
 * Verifies the Electron renderer path can't be tested from CLI (no
 * window.require), so this script exercises the Node fallback by
 * temporarily exposing `require` on globalThis. Same code path Electron
 * hits, minus the Electron BrowserWindow.
 *
 * What it covers:
 *   - Bootstrap DB + vault in OS tmp dir
 *   - Insert one of each memory kind
 *   - Verify SQLite rows present + FTS5 mirrors them
 *   - Verify vault files exist with the expected layout
 *   - Round-trip vault edit → reimport → DB updated
 *   - Embedding attach (only if sqlite-vec loads cleanly)
 *
 * Exits 0 on full success, non-zero on the first assertion failure.
 */

import { createRequire } from 'node:module';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';

// Expose require on globalThis so the memory modules' pickRequire()
// finds it. In Electron renderer this is provided automatically by
// nodeIntegration; in pure Node we wire it manually.
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { openMemoryVault } = await import('../src/agents/memory/vault.ts');
const {
  recordObservation,
  recordReflection,
  recordPlan,
  recordDialogue,
  drainEmbedQueue,
} = await import('../src/agents/memory/import.ts');
const { cellIdFor, libraryIdFor } = await import('../src/agents/memory/schema.ts');

const tmpRoot = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'lokilib-2a-'));
const dbPath = nodePath.join(tmpRoot, 'memory.sqlite');
const vaultDir = nodePath.join(tmpRoot, 'vaults');

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

console.log(`\n[smoke 2a] tmp = ${tmpRoot}\n`);

const db = openMemoryDb({ path: dbPath, suppressVecWarning: false });
const vault = openMemoryVault({ rootDir: vaultDir });

console.log(`[smoke 2a] db hasVec = ${db.hasVec}\n`);

const ns = {
  agentId: 'loki',
  cellId: cellIdFor(0xa11ce11),
  libraryId: libraryIdFor('76561198000000000'),
};

console.log('Step 1 — record one of each kind');
const obs = recordObservation(db, vault, ns, {
  text: 'the player walked near the Hades shelf',
  source: 'player_proximity',
  location: { x: 5, y: 7 },
});
const ref = recordReflection(db, vault, ns, {
  text: 'the player returns to roguelikes when stressed',
  synthesised_from: [obs.id],
  themes: ['escapism'],
});
const plan = recordPlan(db, vault, ns, {
  text: 'leave a small mark near the Hades shelf for next time',
  steps: [
    { kind: 'move_to', location: { x: 5, y: 7 }, status: 'pending' },
    { kind: 'place_mark', target: 'shelf:hades', status: 'pending' },
  ],
  status: 'active',
});
const dlg = recordDialogue(
  db,
  vault,
  { ...ns, agentId: 'archivist' },
  {
    text: 'welcome back',
    addressee: 'player',
  },
);

console.log('\nStep 2 — DB rows present');
assert(db.getMemory(obs.id)?.kind === 'observation', 'observation row exists');
assert(db.getMemory(ref.id)?.kind === 'reflection', 'reflection row exists');
assert(db.getMemory(plan.id)?.kind === 'plan', 'plan row exists');
assert(db.getMemory(dlg.id)?.kind === 'dialogue', 'dialogue row exists');
assert(db.getMemory(ref.id)?.parent_id === null, 'reflection.parent_id is null (uses synthesised_from in payload)');
assert(db.getMemory(obs.id)?.importance === 4, 'player_proximity importance = 4');
assert(db.getMemory(ref.id)?.importance === 7, 'reflection importance = 7');

console.log('\nStep 3 — recentForAgent ordering');
const lokiRecent = db.recentForAgent('loki', 10);
assert(lokiRecent.length === 3, 'loki has 3 memories (obs + ref + plan)');
assert(lokiRecent[0].id === plan.id, 'newest first (plan was last)');

console.log('\nStep 4 — FTS5 search hits payload.text');
const hits = db.searchFts('Hades', 'loki', 10);
assert(hits.length >= 2, `Hades matches >= 2 rows (got ${hits.length})`);
const hitKinds = hits.map((h) => h.kind).sort();
assert(hitKinds.includes('observation') && hitKinds.includes('plan'), 'observation + plan both matched');

console.log('\nStep 5 — vault files exist with expected layout');
const lokiDir = nodePath.join(vaultDir, 'loki');
const archivistDir = nodePath.join(vaultDir, 'archivist');
assert(nodeFs.existsSync(lokiDir), 'loki vault dir exists');
assert(nodeFs.existsSync(archivistDir), 'archivist vault dir exists');
const lokiFiles = nodeFs.readdirSync(lokiDir).sort();
assert(lokiFiles.length === 3, `loki has 3 .md files (got ${lokiFiles.length}: ${lokiFiles.join(', ')})`);

const obsFile = vault.pathFor(db.getMemory(obs.id)!);
const obsBody = nodeFs.readFileSync(obsFile, 'utf8');
assert(obsBody.startsWith('---\n'), 'vault file starts with frontmatter');
assert(obsBody.includes(`id: ${obs.id}`), 'frontmatter includes id');
assert(obsBody.includes(`agent_id: loki`), 'frontmatter includes agent_id');
assert(obsBody.includes(`kind: observation`), 'frontmatter includes kind');
assert(obsBody.includes('the player walked near the Hades shelf'), 'body contains text');

const refFile = vault.pathFor(db.getMemory(ref.id)!);
const refBody = nodeFs.readFileSync(refFile, 'utf8');
assert(refBody.includes(`[[${obs.id}]]`), 'reflection vault has [[backlink]] to observation');

console.log('\nStep 6 — embed queue captured all writes');
const jobs = drainEmbedQueue();
assert(jobs.length === 4, `4 embed jobs queued (got ${jobs.length})`);
assert(jobs[0].memoryId === obs.id, 'first job is observation');
assert(jobs.every((j) => j.text.length > 0), 'all jobs have non-empty text');
assert(drainEmbedQueue().length === 0, 'queue drained');

console.log('\nStep 7 — vault round-trip (edit + reimport)');
// Wait a tick so mtime can change deterministically.
await new Promise((r) => setTimeout(r, 50));
const editedBody = obsBody.replace(
  'the player walked near the Hades shelf',
  'the player paused near the Hades shelf for a long time',
);
nodeFs.writeFileSync(obsFile, editedBody, 'utf8');
// Bump mtime explicitly — some filesystems share mtime within a tick.
const future = new Date(Date.now() + 1000);
nodeFs.utimesSync(obsFile, future, future);
const updated = vault.reimportChanged(db);
assert(updated === 1, `reimportChanged returned 1 (got ${updated})`);
const reread = db.getMemory(obs.id)!;
const newText = JSON.parse(reread.payload_json).text;
assert(
  newText === 'the player paused near the Hades shelf for a long time',
  'DB text updated from vault edit',
);

console.log('\nStep 8 — embedding attach (vec only)');
if (db.hasVec) {
  const fakeEmbedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) fakeEmbedding[i] = Math.sin(i / 12);
  db.attachEmbedding(obs.id, fakeEmbedding);
  const after = db.getMemory(obs.id)!;
  assert(after.embedding_id !== null, 'embedding_id populated after attach');
} else {
  console.log('  · sqlite-vec unavailable, skipping');
}

console.log('\nStep 9 — persona upsert');
db.upsertPersona('loki', 'Loki', 'You are Loki.', '{"top_genres":["roguelike"]}');
const persona = db.getPersona('loki');
assert(persona?.name === 'Loki', 'persona name persisted');
assert(persona?.system_prompt === 'You are Loki.', 'persona prompt persisted');

console.log('\nStep 10 — telemetry append');
db.logTelemetry({
  agent_id: 'loki',
  tier: 1,
  model: 'claude-haiku-4-5',
  provider: 'anthropic',
  tokens_in: 412,
  tokens_out: 87,
  latency_ms: 1810,
  cost_usd_est: 0.000497,
  created_at: Date.now(),
});

db.close();
console.log(`\n[smoke 2a] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  // Leave tmp dir behind for inspection on failure.
  console.log(`\nKept tmp dir for inspection: ${tmpRoot}`);
  process.exit(1);
}
nodeFs.rmSync(tmpRoot, { recursive: true, force: true });
console.log(`[smoke 2a] cleaned ${tmpRoot}`);
