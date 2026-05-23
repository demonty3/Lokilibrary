/**
 * Phase 2E smoke — `npx tsx scripts/smoke-2e-launch.mts`.
 *
 * Covers the bookshelf launch chain:
 *   - launch.ts in non-Electron mode returns surface='none' when window
 *     is undefined (Node)
 *   - broadcastGameLaunched injects events into every present runtime
 *   - recordPlan writes a Plan row with place_mark step
 *   - placedMarksForCell returns the place_mark on remount
 *   - force=true makes routeTier2 fire even below threshold
 *   - importance for game_launched event is 8 (per the plan)
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { openMemoryVault } = await import('../src/agents/memory/vault.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const { placedMarksForCell } = await import('../src/agents/memory/retrieval.ts');
const { cellIdFor, libraryIdFor } = await import('../src/agents/memory/schema.ts');
const { COHORT } = await import('../src/agents/cohort.ts');
const {
  routeTier2,
  broadcastGameLaunched,
} = await import('../src/agents/router.ts');
const { initialRuntime, setRuntime, listRuntimes, clearRuntimes } = await import(
  '../src/state/agentRuntime.ts'
);
const { launchGame } = await import('../src/agents/launch.ts');

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-2e-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite'), suppressVecWarning: true });
const vault = openMemoryVault({ rootDir: path.join(tmp, 'vaults') });
const cellId = cellIdFor(0xa11ce11);
const writer = buildMemoryWriter({
  db,
  vault,
  ns: { cellId, libraryId: libraryIdFor('demo') },
});

console.log('\n[smoke 2e] launch + broadcast + marginalia\n');

console.log('Step 1 — launchGame in Node returns surface=none');
const ev = await launchGame({ appid: 1145360, name: 'Hades' });
// In Node (no window), launchGame falls through to surface='none'.
// In Electron it'd be 'electron'; in a browser tab it'd be 'protocol'.
assert(ev.surface === 'none', `Node fallthrough surface (got "${ev.surface}")`);
assert(ev.appid === 1145360 && ev.name === 'Hades', 'event carries appid + name');

console.log('\nStep 2 — broadcastGameLaunched injects into every present runtime');
clearRuntimes();
for (const def of COHORT.slice(0, 3)) {
  setRuntime(initialRuntime({ id: def.id, x: 5, y: 5 }));
}
const absentRT = initialRuntime({ id: 'visitor', x: 1, y: 1 });
absentRT.present = false;
setRuntime(absentRT);
broadcastGameLaunched(listRuntimes(), {
  appid: 1145360,
  name: 'Hades',
  at: { x: 10, y: 7 },
  when: 1000,
});
const present = listRuntimes().filter((r) => r.present);
const absent = listRuntimes().filter((r) => !r.present);
assert(
  present.every((r) => r.perceptionQueue.some((e) => e.kind === 'game_launched')),
  `all ${present.length} present agents got the event`,
);
assert(
  absent.every((r) => r.perceptionQueue.length === 0),
  'absent agents not pinged',
);

console.log('\nStep 3 — recordPlan writes Plan row + place_mark step');
const planId = writer.recordPlan({
  agentId: 'loki',
  text: 'leave a small mark near the Hades shelf for next time',
  steps: [
    {
      kind: 'place_mark',
      target: 'shelf:12,8',
      location: { x: 11, y: 8 },
      status: 'pending',
    },
  ],
  status: 'active',
  importance: 6,
});
assert(planId !== null, 'plan id returned');
const planRow = db.getMemory(planId!);
assert(planRow?.kind === 'plan', 'plan row stored');

console.log('\nStep 4 — placedMarksForCell returns the marker on "remount"');
const marks = placedMarksForCell(db, cellId);
assert(marks.length === 1, `1 placed mark (got ${marks.length})`);
assert(marks[0].location.x === 11 && marks[0].location.y === 8, 'mark at expected cell');
assert(marks[0].agentId === 'loki', 'mark attributed to loki');

console.log('\nStep 5 — placedMarksForCell dedupes duplicates');
writer.recordPlan({
  agentId: 'loki',
  text: 'second plan with same location',
  steps: [
    {
      kind: 'place_mark',
      target: 'shelf:12,8',
      location: { x: 11, y: 8 },
      status: 'pending',
    },
  ],
  status: 'active',
  importance: 6,
});
const marksDedup = placedMarksForCell(db, cellId);
assert(marksDedup.length === 1, `still 1 mark after duplicate plan (got ${marksDedup.length})`);

console.log('\nStep 6 — completed plans drop out of placedMarksForCell');
writer.recordPlan({
  agentId: 'loki',
  text: 'mark at (12,9) but plan is completed',
  steps: [
    {
      kind: 'place_mark',
      target: 'shelf:12,9',
      location: { x: 12, y: 9 },
      status: 'pending',
    },
  ],
  status: 'completed',
  importance: 6,
});
const marksAfter = placedMarksForCell(db, cellId);
assert(
  !marksAfter.some((m) => m.location.x === 12 && m.location.y === 9),
  'completed plan does not show its place_mark',
);

console.log('\nStep 7 — routeTier2 with force=true fires below threshold');
const lokiDef = COHORT.find((d) => d.id === 'loki')!;
const lokiRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
lokiRT.reflectionCounter = 0; // below threshold
let reflectCalled = false;
const r2 = await routeTier2(lokiDef, lokiRT, 2000, {
  force: true,
  transport: {
    call: async () => ({ ok: false, error: 'not called' }),
    reflect: async () => {
      reflectCalled = true;
      return {
        ok: true,
        result: {
          reflection: 'the player picked Hades',
          synthesised_from: [],
          themes: ['roguelike'],
          importance: 6,
          model: 'stub',
          provider: 'stub',
          latencyMs: 1,
          tokensIn: 0,
          tokensOut: 0,
        },
      };
    },
  },
  memory: writer,
});
assert(reflectCalled === true, 'reflect called via force=true');
assert(r2.dispatched === true, 'tier2 dispatched');

console.log('\nStep 8 — game_launched importance = 8');
const lokiRT2 = initialRuntime({ id: 'loki', x: 5, y: 5 });
lokiRT2.perceptionQueue.push({
  kind: 'game_launched',
  subject: 'appid:1145360',
  at: { x: 10, y: 7 },
  when: 3000,
});
const { routeTier1 } = await import('../src/agents/router.ts');
await routeTier1(lokiDef, lokiRT2, 'the cell', 3000, {
  throttleMs: 0,
  transport: {
    call: async () => ({
      ok: true,
      tick: {
        action: 'inspect Hades shelf',
        intent: 'follow the launch',
        model: 'stub',
        provider: 'stub',
        latencyMs: 1,
      },
    }),
    reflect: async () => ({ ok: false, error: 'not called' }),
  },
  memory: writer,
});
assert(
  lokiRT2.reflectionCounter === 8,
  `counter bumped by 8 from game_launched (got ${lokiRT2.reflectionCounter})`,
);

db.close();
console.log(`\n[smoke 2e] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\nKept tmp: ${tmp}`);
  process.exit(1);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`[smoke 2e] cleaned ${tmp}`);
