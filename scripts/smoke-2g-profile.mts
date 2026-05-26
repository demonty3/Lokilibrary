/**
 * Phase 2G smoke — `npx tsx scripts/smoke-2g-profile.mts`.
 *
 * Covers the profile-aware remount + writer namespace rebuild:
 *   - namespaceFor returns distinct (cellId, libraryId) tuples for
 *     anonymous vs signed-in profiles
 *   - bootstrapMemory opens the DB once; rebuildNamespaceSync swaps
 *     the writer wrapper without reopening (DB instance identity holds)
 *   - getCurrentMemoryWriter reflects the rebuilt writer to subsequent
 *     callers — this is what PixiApp's resolveWriter() reads at each
 *     cell remount
 *   - rows written through the rebuilt writer land under the new
 *     cell_id / library_id; rows written under the old namespace stay
 *     readable only via the old cellId (no spill across namespaces)
 *   - placedMarksForCell is namespace-scoped: a Plan written under
 *     cell_a is invisible when reading cell_b's marks
 *   - rebuildNamespaceSync is a no-op in the web build (no cached db)
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

// Stub window.electronAPI before importing bootstrap. The IPC's only
// load-bearing surface for 2G is getUserDataPath — point it at a tmp
// dir so bootstrap opens a real memory.sqlite.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-2g-'));
const electronStub = {
  isElectron: true as const,
  getUserDataPath: async () => tmpRoot,
  getSteamId: async () => null,
  isSteamworksAvailable: async () => false,
  getAuthTicket: async () => null,
  launchGame: async () => true,
  getWallpaperMode: async () => 'window' as const,
  setWallpaperMode: async () => true,
  onWallpaperModeChanged: () => () => undefined,
};
(globalThis as { window?: unknown }).window = { electronAPI: electronStub };

const {
  bootstrapMemory,
  namespaceFor,
  rebuildNamespaceSync,
  getCurrentMemoryWriter,
  resetBootstrap,
} = await import('../src/agents/memory/bootstrap.ts');
const { cellIdFor, libraryIdFor } = await import('../src/agents/memory/schema.ts');
const { profileSeed } = await import('../src/procedural/seed.ts');
const { nullMemoryWriter } = await import('../src/agents/router.ts');

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

console.log('\n[smoke 2g] profile-aware remount + writer namespace rebuild\n');

// Two profiles with disjoint top games — they must hash to different
// seeds, so cellId differs.
const profileA = {
  totalGames: 12,
  playedGames: 7,
  dustyGames: 2,
  totalPlaytimeHours: 220,
  topGames: [
    { appid: 1145360, name: 'Hades', playtimeHours: 80, engagement: 'deeply_lived_in' as const, recent: true },
    { appid: 413150, name: 'Stardew Valley', playtimeHours: 60, engagement: 'past_main' as const, recent: false },
  ],
  bingeRatio: 0.4,
  recentlyActiveCount: 1,
  summary: 'A profile',
};
const profileB = {
  totalGames: 30,
  playedGames: 18,
  dustyGames: 5,
  totalPlaytimeHours: 480,
  topGames: [
    { appid: 632470, name: 'Disco Elysium', playtimeHours: 120, engagement: 'deeply_lived_in' as const, recent: true },
    { appid: 753640, name: 'Outer Wilds', playtimeHours: 90, engagement: 'past_main' as const, recent: false },
  ],
  bingeRatio: 0.5,
  recentlyActiveCount: 2,
  summary: 'A different profile',
};

console.log('Step 1 — namespaceFor distinguishes anonymous vs signed-in');
const seedA = profileSeed(profileA);
const seedB = profileSeed(profileB);
assert(seedA !== seedB, `distinct seeds for distinct topGames (A=${seedA}, B=${seedB})`);
const nsAnon = namespaceFor(null, null, 0);
const nsA = namespaceFor(profileA, 'STEAM_A', seedA);
const nsB = namespaceFor(profileB, 'STEAM_B', seedB);
assert(nsAnon.cellId === cellIdFor(0), 'anonymous cellId matches cellIdFor(0)');
assert(nsAnon.libraryId === libraryIdFor('anonymous'), 'anonymous libraryId is the sentinel');
assert(nsA.cellId !== nsAnon.cellId, 'profile A cellId differs from anonymous');
assert(nsA.libraryId === libraryIdFor('STEAM_A'), 'profile A libraryId uses steamId');
assert(nsA.cellId !== nsB.cellId, 'profile A vs B cellId differ');
assert(nsA.libraryId !== nsB.libraryId, 'profile A vs B libraryId differ');

console.log('\nStep 2 — bootstrapMemory opens the DB once');
const boot1 = await bootstrapMemory({ namespace: nsAnon });
assert(boot1.db !== null, 'bootstrap returned a DB');
assert(boot1.writer !== nullMemoryWriter, 'bootstrap writer is not the null writer');
assert(boot1.rootDir === tmpRoot, `rootDir is the tmp dir (${boot1.rootDir})`);
const dbInstance = boot1.db;
// Second call with same args returns cached (no rebuild).
const boot2 = await bootstrapMemory({ namespace: nsAnon });
assert(boot2.db === dbInstance, 'second bootstrap returns the same DB instance');
assert(boot2.writer === boot1.writer, 'second bootstrap returns the same writer (no rebuild flag)');

console.log('\nStep 3 — getCurrentMemoryWriter exposes the cached writer');
const initialFetched = getCurrentMemoryWriter();
assert(initialFetched === boot1.writer, 'getCurrentMemoryWriter returns the cached writer');

console.log('\nStep 4 — writer under anonymous namespace writes rows scoped to nsAnon');
boot1.writer.recordPlan({
  agentId: 'loki',
  text: 'place a mark near the anonymous shelf',
  steps: [
    {
      kind: 'place_mark',
      target: 'shelf:anon',
      location: { x: 3, y: 3 },
      status: 'pending',
    },
  ],
  status: 'active',
  importance: 6,
});
const anonMarks = boot1.writer.placedMarksForCell(nsAnon.cellId);
assert(anonMarks.length === 1, `anon cell sees 1 placed mark (got ${anonMarks.length})`);
assert(anonMarks[0].agentId === 'loki', 'anon mark recorded by loki');

console.log('\nStep 5 — rebuildNamespaceSync swaps writer without reopening DB');
const rebuilt = rebuildNamespaceSync(nsA);
assert(rebuilt !== null, 'rebuildNamespaceSync returned a writer (db cached)');
assert(rebuilt !== boot1.writer, 'rebuilt writer is a fresh instance');
const afterRebuild = getCurrentMemoryWriter();
assert(afterRebuild === rebuilt, 'getCurrentMemoryWriter now returns the rebuilt writer');
// Confirm the DB instance is still the same — we did not reopen.
const boot3 = await bootstrapMemory({ namespace: nsA });
assert(boot3.db === dbInstance, 'DB instance identity preserved across rebuild');
assert(boot3.writer === rebuilt, 'cached writer is the rebuilt one');

console.log('\nStep 6 — writes through rebuilt writer land under profile A namespace');
rebuilt!.recordPlan({
  agentId: 'loki',
  text: 'place a mark near the Hades shelf (profile A)',
  steps: [
    {
      kind: 'place_mark',
      target: 'shelf:hades',
      location: { x: 7, y: 4 },
      status: 'pending',
    },
  ],
  status: 'active',
  importance: 7,
});
// placedMarksForCell takes a cellId arg — it returns rows for THAT cell
// regardless of the writer's current namespace, which is exactly what
// the cell renderer needs at mount.
const profileAMarks = rebuilt!.placedMarksForCell(nsA.cellId);
assert(profileAMarks.length === 1, `profile A cell sees 1 mark (got ${profileAMarks.length})`);
assert(profileAMarks[0].text.includes('Hades'), 'profile A mark text is the Hades one');
// The anonymous cell still only has its own mark — no spillover from
// the rebuilt writer's writes.
const anonStillOne = rebuilt!.placedMarksForCell(nsAnon.cellId);
assert(anonStillOne.length === 1, 'anon cell still has 1 mark (no spillover)');
assert(
  anonStillOne[0].text.includes('anonymous'),
  'anon mark is unchanged after rebuild',
);

console.log('\nStep 7 — namespace switch back exposes the right marks for each cell');
rebuildNamespaceSync(nsB);
const newWriter = getCurrentMemoryWriter()!;
const aMarks = newWriter.placedMarksForCell(nsA.cellId);
const bMarks = newWriter.placedMarksForCell(nsB.cellId);
assert(aMarks.length === 1, `profile A cell still has 1 mark from any writer (got ${aMarks.length})`);
assert(bMarks.length === 0, `profile B cell starts empty (got ${bMarks.length})`);
newWriter.recordPlan({
  agentId: 'archivist',
  text: 'place a mark near the Disco Elysium shelf',
  steps: [
    {
      kind: 'place_mark',
      target: 'shelf:disco',
      location: { x: 9, y: 9 },
      status: 'pending',
    },
  ],
  status: 'active',
  importance: 5,
});
const bMarksAfter = newWriter.placedMarksForCell(nsB.cellId);
assert(bMarksAfter.length === 1, 'profile B cell now has 1 mark');
assert(bMarksAfter[0].agentId === 'archivist', 'profile B mark is by archivist');

console.log('\nStep 8 — rebuildNamespaceSync returns null when bootstrap not run');
resetBootstrap();
const nullRebuild = rebuildNamespaceSync(nsA);
assert(nullRebuild === null, 'rebuildNamespaceSync returns null after resetBootstrap');
assert(getCurrentMemoryWriter() === null, 'getCurrentMemoryWriter returns null after reset');

console.log('\nStep 9 — web build path: no electronAPI → null writer + sync rebuild no-op');
(globalThis as { window?: unknown }).window = {}; // strip electronAPI
const webBoot = await bootstrapMemory({ namespace: nsA });
assert(webBoot.writer === nullMemoryWriter, 'web bootstrap returns null writer');
assert(webBoot.db === null, 'web bootstrap has no DB');
const webRebuild = rebuildNamespaceSync(nsB);
assert(webRebuild === nullMemoryWriter, 'web rebuild returns the cached null writer');

resetBootstrap();
console.log(`\n[smoke 2g] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\nKept tmp: ${tmpRoot}`);
  process.exit(1);
}
fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log(`[smoke 2g] cleaned ${tmpRoot}`);
