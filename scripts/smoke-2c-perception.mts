/**
 * Phase 2C smoke — `npx tsx scripts/smoke-2c-perception.mts`.
 * Pure-logic verification of perception + router. Uses a stub
 * Tier1Transport so we never hit the real Worker.
 *
 * Coverage:
 *   - perception emits player_proximity inside FOV, drops outside
 *   - salience window dedupes back-to-back events
 *   - router skips on empty queue
 *   - router throttles when called within tier1ThrottleMs
 *   - router updates runtime.intent on success
 *   - whitelist drops deny-listed verbs
 *   - bookshelf_in_reach fires only when adjacent
 */

import { layoutCell } from '../src/procedural/cell.ts';
import { COHORT } from '../src/agents/cohort.ts';
import {
  computePerception,
  resetPerceptionState,
  type WorldSnapshot,
} from '../src/agents/perception.ts';
import {
  routeTier1,
  type MemoryWriter,
  type Tier1Transport,
  nullMemoryWriter,
} from '../src/agents/router.ts';
import { initialRuntime } from '../src/state/agentRuntime.ts';
import type { AgentTickResult } from '../src/api/agent.ts';

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

console.log('\n[smoke 2c] perception + router\n');

const SEED = 0xa11ce11 >>> 0;
const layout = layoutCell(SEED);
const lokiDef = COHORT.find((d) => d.id === 'loki')!;
const lokiRT = initialRuntime({ id: 'loki', x: 10, y: 5 });
lokiRT.present = true;

console.log('Step 1 — player_proximity fires inside FOV');
resetPerceptionState();
const worldNear: WorldSnapshot = {
  player: { x: 12, y: 6 }, // distance 2 from loki at (10,5) — inside fov=8
  agents: new Map([['loki', { x: 10, y: 5 }]]),
  bookshelves: layout.bookshelfSlots,
};
const ev1 = computePerception(lokiDef, lokiRT, worldNear, 1000);
assert(
  ev1.some((e) => e.kind === 'player_proximity'),
  'player_proximity emitted',
);
const queueAfter1 = lokiRT.perceptionQueue.length;
assert(queueAfter1 >= 1, `queue grew (now ${queueAfter1})`);

console.log('\nStep 2 — salience window dedupes within 8s');
const ev2 = computePerception(lokiDef, lokiRT, worldNear, 1500);
assert(
  !ev2.some((e) => e.kind === 'player_proximity'),
  'second tick within 8s does NOT re-emit player_proximity',
);

console.log('\nStep 3 — player outside FOV → no event');
resetPerceptionState();
lokiRT.perceptionQueue.length = 0;
const lokiRT2 = initialRuntime({ id: 'loki', x: 1, y: 1 });
const worldFar: WorldSnapshot = {
  player: { x: 22, y: 14 }, // far corner — distance > fov=8
  agents: new Map([['loki', { x: 1, y: 1 }]]),
  bookshelves: layout.bookshelfSlots,
};
const ev3 = computePerception(lokiDef, lokiRT2, worldFar, 5000);
assert(
  !ev3.some((e) => e.kind === 'player_proximity'),
  'player at chebyshev > 8 does NOT trigger player_proximity',
);

console.log('\nStep 4 — bookshelf_in_reach fires only when adjacent');
resetPerceptionState();
const adjacentShelf = layout.bookshelfSlots[0];
const lokiRT3 = initialRuntime({
  id: 'loki',
  // Place loki 1 cell south of the first shelf (adjacent = chebyshev 1).
  x: adjacentShelf.x,
  y: Math.min(layout.height - 2, adjacentShelf.y + 1),
});
const ev4 = computePerception(
  lokiDef,
  lokiRT3,
  {
    player: { x: 50, y: 50 }, // off-grid; no player_proximity noise
    agents: new Map(),
    bookshelves: layout.bookshelfSlots,
  },
  6000,
);
assert(
  ev4.some((e) => e.kind === 'bookshelf_in_reach'),
  `bookshelf_in_reach fires at adjacency (got ${JSON.stringify(ev4.map((e) => e.kind))})`,
);

console.log('\nStep 5 — router skips on empty queue');
resetPerceptionState();
const emptyRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
const r5 = await routeTier1(lokiDef, emptyRT, 'a small room', 10_000, {
  transport: failTransport(),
});
assert(r5.dispatched === false && r5.skipReason === 'empty_queue', 'empty queue → skip');

console.log('\nStep 6 — router dispatches when queue non-empty + not throttled');
resetPerceptionState();
const dispatchRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
dispatchRT.perceptionQueue.push({
  kind: 'player_proximity',
  subject: 'player',
  at: { x: 5, y: 6 },
  when: 11_000,
});
const stubTransport: Tier1Transport = {
  call: async () => okTick('inspect the Hades shelf', 'examine top games'),
};
const r6 = await routeTier1(lokiDef, dispatchRT, 'a small room', 11_000, {
  transport: stubTransport,
});
assert(r6.dispatched === true, 'dispatched when queue had item');
assert(
  dispatchRT.intent === 'examine top games',
  `intent installed (got "${dispatchRT.intent}")`,
);
assert(dispatchRT.perceptionQueue.length === 0, 'queue drained after dispatch');
assert(dispatchRT.lastTier1At === 11_000, `lastTier1At marked (got ${dispatchRT.lastTier1At})`);

console.log('\nStep 7 — router throttles within tier1ThrottleMs');
dispatchRT.perceptionQueue.push({
  kind: 'player_proximity',
  subject: 'player',
  at: { x: 5, y: 6 },
  when: 11_500,
});
const r7 = await routeTier1(lokiDef, dispatchRT, 'a small room', 11_500, {
  transport: stubTransport,
});
assert(
  r7.dispatched === false && r7.skipReason === 'throttled',
  `throttled at 500ms after last call (loki throttle is 30000ms)`,
);

console.log('\nStep 8 — router refuses deny-listed verbs');
resetPerceptionState();
const denyRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
denyRT.perceptionQueue.push({
  kind: 'player_proximity',
  subject: 'player',
  at: { x: 5, y: 6 },
  when: 100_000,
});
const denyTransport: Tier1Transport = {
  call: async () => okTick('speak hello to the player', 'greet'),
};
const r8 = await routeTier1(lokiDef, denyRT, 'a small room', 100_000, {
  transport: denyTransport,
});
assert(r8.dispatched === false && r8.skipReason === 'rejected', '"speak" rejected');
assert(denyRT.intent === '', `intent NOT overwritten (got "${denyRT.intent}")`);

console.log('\nStep 9 — router uses memory writer hooks');
resetPerceptionState();
const writes: { perception: number; tier1: number } = { perception: 0, tier1: 0 };
const memWriter: MemoryWriter = {
  ...nullMemoryWriter,
  recordPerception: () => {
    writes.perception++;
    return 'mem-id';
  },
  logTier1: () => {
    writes.tier1++;
  },
};
const memRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
memRT.perceptionQueue.push({
  kind: 'player_proximity',
  subject: 'player',
  at: { x: 5, y: 6 },
  when: 200_000,
});
memRT.perceptionQueue.push({
  kind: 'bookshelf_in_reach',
  subject: 'shelf:0',
  at: { x: 6, y: 6 },
  when: 200_000,
});
await routeTier1(lokiDef, memRT, 'a small room', 200_000, {
  transport: stubTransport,
  memory: memWriter,
});
assert(writes.perception === 2, `2 perception writes (got ${writes.perception})`);
assert(writes.tier1 === 1, `1 tier1 log (got ${writes.tier1})`);

console.log(`\n[smoke 2c] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

// ---------- helpers ----------

function okTick(action: string, intent: string): AgentTickResult {
  return {
    ok: true,
    tick: {
      action,
      intent,
      model: 'stub',
      provider: 'stub',
      latencyMs: 1,
    },
  };
}

function failTransport(): Tier1Transport {
  return {
    call: async () => {
      throw new Error('transport should not be called in skip-path tests');
    },
  };
}
