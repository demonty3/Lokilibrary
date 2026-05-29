/**
 * Phase 5C.2 smoke — `npx tsx scripts/smoke-5c2-lore-store.mts`.
 *
 * Covers the lore data path end-to-end against a REAL better-sqlite3 +
 * sqlite-vec store (works in WSL — verified the extension loads here):
 *   - insertLore → FTS5 indexes it (searchLoreFts finds it)
 *   - attachLoreEmbedding → lore_vec cosine KNN ranks by similarity
 *   - library isolation: lore in library A never leaks into library B's
 *     retrieval (FTS, vec, and recency paths)
 *   - retrieveLore: cosine path when a queryEmbedding is supplied;
 *     recency fallback otherwise
 *   - writer.recordLore / recentLore / loreCount surface
 *   - router lore injection: routeTier2 calls the injected gatherer and
 *     forwards recent_lore into the reflect transport input
 *
 * NOT covered (needs a live Worker + Ollama): the real /api/embed
 * round-trip that produces the 768-dim vectors — here we hand-craft
 * deterministic vectors. Verify the real embed on Windows after
 * `ollama pull nomic-embed-text`.
 */

import { createRequire } from 'node:module';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { makeChecker } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const { retrieveLore } = await import('../src/agents/memory/retrieval.ts');
const { routeTier2, nullMemoryWriter } = await import('../src/agents/router.ts');

const { check, report } = makeChecker('smoke 5C.2');

const tmpRoot = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'lokilib-5c2-'));
const dbPath = nodePath.join(tmpRoot, 'memory.sqlite');
const db = openMemoryDb({ path: dbPath, suppressVecWarning: true });

check('db opened with vec (sqlite-vec loaded)', db.hasVec === true,
  'sqlite-vec did not load — lore cosine path untestable here');

// ---------------------------------------------------------------------------
// Deterministic 768-dim unit-ish vectors. Distinct "directions" so cosine
// can separate them: vector for axis i has 1.0 at dim i.
function axisVec(i: number): Float32Array {
  const v = new Float32Array(768);
  v[i % 768] = 1;
  return v;
}
// A blended query closer to axis 3 than axis 50.
function blend(primary: number, secondary: number): Float32Array {
  const v = new Float32Array(768);
  v[primary] = 0.9;
  v[secondary] = 0.1;
  return v;
}

const LIB_A = 'library:aaa';
const LIB_B = 'library:bbb';

// ---------------------------------------------------------------------------
// 1. insertLore + FTS

db.insertLore({ id: 'l1', library_id: LIB_A, text: 'The city of Revachol sits in eternal grey rain', source: 'disco.md', created_at: 1000, embedding_id: null });
db.insertLore({ id: 'l2', library_id: LIB_A, text: 'Kim Kitsuragi drives a blue Coupris Kineema', source: 'disco.md', created_at: 2000, embedding_id: null });
db.insertLore({ id: 'l3', library_id: LIB_B, text: 'The Imperium spans a million worlds of the Emperor', source: '40k.md', created_at: 3000, embedding_id: null });

check('loreCount(A) == 2', db.loreCount(LIB_A) === 2);
check('loreCount(B) == 1', db.loreCount(LIB_B) === 1);

const ftsA = db.searchLoreFts('Revachol', LIB_A, 5);
check('searchLoreFts finds Revachol in A', ftsA.length === 1 && ftsA[0].id === 'l1');

const ftsCross = db.searchLoreFts('Revachol', LIB_B, 5);
check('searchLoreFts is library-isolated (B has no Revachol)', ftsCross.length === 0);

const ftsImperium = db.searchLoreFts('Imperium', LIB_A, 5);
check('searchLoreFts: A cannot see B lore (Imperium)', ftsImperium.length === 0);

// ---------------------------------------------------------------------------
// 2. attachLoreEmbedding + cosine KNN

// l1 → axis 3, l2 → axis 50, l3 (other library) → axis 3 (same dir as l1)
db.attachLoreEmbedding('l1', axisVec(3));
db.attachLoreEmbedding('l2', axisVec(50));
db.attachLoreEmbedding('l3', axisVec(3));

// Query near axis 3 → l1 should be nearest within library A.
const knn = db.searchLoreVec(blend(3, 50), 16);
check('searchLoreVec returns hits', knn.length >= 2);
check('searchLoreVec orders by distance asc', knn[0].distance <= knn[1].distance);
const firstA = knn.find((h) => h.row.library_id === LIB_A);
check('nearest A-lore for axis-3 query is l1', firstA?.row.id === 'l1');

// l3 is in library B but shares axis-3 direction with l1 — proves we must
// filter by library AFTER the global KNN (retrieveLore does this).
const hasB = knn.some((h) => h.row.library_id === LIB_B);
check('global KNN sees other libraries (B present in raw hits)', hasB === true);

// ---------------------------------------------------------------------------
// 3. retrieveLore — cosine path filters to library + slices topK

const cosineA = retrieveLore(db, LIB_A, { topK: 1, queryEmbedding: blend(3, 50) });
check('retrieveLore cosine: topK=1 returns one', cosineA.length === 1);
check('retrieveLore cosine: returns l1 for axis-3 query', cosineA[0].id === 'l1');
check('retrieveLore cosine: never leaks B into A', cosineA.every((l) => l.id !== 'l3'));

const cosineB = retrieveLore(db, LIB_B, { topK: 4, queryEmbedding: blend(3, 50) });
check('retrieveLore cosine: B query returns only B lore', cosineB.length === 1 && cosineB[0].id === 'l3');

// recency path (no queryEmbedding): newest first
const recencyA = retrieveLore(db, LIB_A, { topK: 4 });
check('retrieveLore recency: returns A lore newest-first', recencyA.length === 2 && recencyA[0].id === 'l2');
check('retrieveLore recency: library-isolated', recencyA.every((l) => l.id !== 'l3'));

// ---------------------------------------------------------------------------
// 4. Writer surface (recordLore / recentLore / loreCount)

const vault = null;
const writerA = buildMemoryWriter({ db, vault, ns: { cellId: 'cell:1', libraryId: LIB_A } });
check('writer.loreCount reflects existing A lore', writerA.loreCount() === 2);

const newId = writerA.recordLore({ text: 'Martinaise is a flooded district', source: 'disco.md', embedding: Array.from(axisVec(7)) });
check('writer.recordLore returns an id', typeof newId === 'string' && newId.length > 0);
check('writer.loreCount incremented', writerA.loreCount() === 3);

const writerB = buildMemoryWriter({ db, vault, ns: { cellId: 'cell:1', libraryId: LIB_B } });
check('writer B loreCount isolated from A', writerB.loreCount() === 1);

// recentLore with a query embedding near axis 7 → the just-added chunk.
const recalled = writerA.recentLore(1, blend(7, 3));
check('writer.recentLore cosine surfaces the matching chunk', recalled.length === 1 && recalled[0].id === newId);

// null writer no-ops
check('nullMemoryWriter.recordLore → null', nullMemoryWriter.recordLore({ text: 'x', source: 'y' }) === null);
check('nullMemoryWriter.recentLore → []', nullMemoryWriter.recentLore(4).length === 0);
check('nullMemoryWriter.loreCount → 0', nullMemoryWriter.loreCount() === 0);

// ---------------------------------------------------------------------------
// 5. Router lore injection — routeTier2 forwards recent_lore to transport

function makeDef(overrides: Record<string, unknown> = {}) {
  return { id: 'loki', name: 'Loki', archetype: 'trickster', tier1ThrottleMs: 30_000, schedule: [], ...overrides };
}
function makeRuntime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loki', x: 5, y: 5, present: true, intent: null,
    currentAction: { kind: 'idle', endsAt: 0 }, actionEndsAt: 0,
    perceptionQueue: [], reflectionCounter: 200, lastTier1At: 0,
    lastReflectionAt: 0, activePlan: null, activePlanStepIndex: 0,
    ...overrides,
  };
}

// Memory writer stub with one recent memory; gatherer is injected so no
// network. Capture what the transport receives.
const reflectInputs: any[] = [];
const transport = {
  async call() {
    return { ok: true, tick: { action: 'wander', intent: 'roam', model: 'm', provider: 'p', latencyMs: 1, tokensIn: 0, tokensOut: 0 } };
  },
  async reflect(input: any) {
    reflectInputs.push(input);
    return { ok: true, result: { reflection: 'r', synthesised_from: [], themes: [], importance: 5, model: 'm', provider: 'p', latencyMs: 1, tokensIn: 1, tokensOut: 1 } };
  },
};
const memStub = {
  ...nullMemoryWriter,
  recentMemories: () => [{ id: 'm1', text: 'the player keeps returning', kind: 'observation' as const, created_at: 1, importance: 5 }],
  persona: () => null,
};

// Gatherer returns lore → router must forward it.
const withLore = await routeTier2(makeDef() as any, makeRuntime() as any, 1_000_000, {
  transport: transport as any,
  memory: memStub as any,
  gatherLore: async () => [{ id: 'l1', text: 'Revachol grey rain', source: 'disco.md' }],
});
check('routeTier2 dispatched with lore', withLore.dispatched === true);
check('transport received recentLore', Array.isArray(reflectInputs[0]?.recentLore) && reflectInputs[0].recentLore.length === 1);
check('forwarded lore carries text + source', reflectInputs[0].recentLore[0].text === 'Revachol grey rain' && reflectInputs[0].recentLore[0].source === 'disco.md');

// Gatherer returns [] → router omits recentLore entirely.
reflectInputs.length = 0;
const noLore = await routeTier2(makeDef() as any, makeRuntime() as any, 2_000_000, {
  transport: transport as any,
  memory: memStub as any,
  gatherLore: async () => [],
});
check('routeTier2 dispatched without lore', noLore.dispatched === true);
check('transport input omits recentLore when empty', reflectInputs[0]?.recentLore === undefined);

// Gatherer throws → reflection still proceeds (best-effort).
reflectInputs.length = 0;
const throwLore = await routeTier2(makeDef() as any, makeRuntime() as any, 3_000_000, {
  transport: transport as any,
  memory: memStub as any,
  gatherLore: async () => { throw new Error('embed down'); },
});
check('routeTier2 survives gatherer throw', throwLore.dispatched === true);
check('throwing gatherer → no recentLore but reflection ran', reflectInputs[0]?.recentLore === undefined);

db.close();
try { nodeFs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }

report();
