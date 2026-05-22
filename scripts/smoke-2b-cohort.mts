/**
 * Phase 2B smoke — `npx tsx scripts/smoke-2b-cohort.mts`. Pure-logic test,
 * no PIXI. Verifies the cohort + Tier-0 BT pieces:
 *   - Same seed → same spawn positions (determinism)
 *   - BT keeps agents on walkable floor cells only
 *   - Wall-clock injection swings Archivist toward the window
 *   - Intermittent presence cycles correctly for Visitor
 *   - Theme allow-list drops Ghost when not enabled
 */

import { layoutCell } from '../src/procedural/cell.ts';
import { mulberry32 } from '../src/procedural/prng.ts';
import { T_FLOOR } from '../src/procedural/tiles/library.ts';
import { COHORT, filterByTheme, resolveSpawn } from '../src/agents/cohort.ts';
import {
  tickBehavior,
  tickPresence,
  type BehaviorContext,
} from '../src/agents/behavior.ts';
import { initialRuntime } from '../src/state/agentRuntime.ts';

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

console.log('\n[smoke 2b] cohort + Tier-0 BT\n');

const SEED = 0xa11ce11 >>> 0;
const layout = layoutCell(SEED);

console.log('Step 1 — spawn determinism');
const spawnsA = COHORT.map((def) => ({
  id: def.id,
  ...resolveSpawn(def.spawn, layout, SEED),
}));
const spawnsB = COHORT.map((def) => ({
  id: def.id,
  ...resolveSpawn(def.spawn, layout, SEED),
}));
assert(
  JSON.stringify(spawnsA) === JSON.stringify(spawnsB),
  'two calls with same seed produce same spawns',
);
// Loki spawn comes from pickLokiSpawn (already deterministic) and
// must be a floor cell.
const lokiSpawn = spawnsA.find((s) => s.id === 'loki')!;
assert(
  layout.tiles[lokiSpawn.y][lokiSpawn.x] === T_FLOOR,
  `loki spawn (${lokiSpawn.x},${lokiSpawn.y}) is floor`,
);
const archSpawn = spawnsA.find((s) => s.id === 'archivist')!;
assert(
  layout.tiles[archSpawn.y][archSpawn.x] === T_FLOOR,
  `archivist spawn (${archSpawn.x},${archSpawn.y}) is floor`,
);
const catSpawn = spawnsA.find((s) => s.id === 'cat')!;
assert(
  layout.tiles[catSpawn.y][catSpawn.x] === T_FLOOR,
  `cat spawn (${catSpawn.x},${catSpawn.y}) is floor`,
);

console.log('\nStep 2 — Tier-0 BT keeps Loki on floor');
const lokiDef = COHORT.find((d) => d.id === 'loki')!;
const lokiRuntime = initialRuntime({ id: 'loki', x: lokiSpawn.x, y: lokiSpawn.y });
// Force action to expire immediately so BT picks every tick.
lokiRuntime.actionEndsAt = 0;

const prngs = new Map<string, ReturnType<typeof mulberry32>>();
for (const def of COHORT) {
  // Same hash function as cohort renderer (FNV-1a).
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < def.id.length; i++) {
    h ^= def.id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  prngs.set(def.id, mulberry32((SEED ^ h) >>> 0));
}

const baseCtx: BehaviorContext = {
  layout,
  prngs,
  scatterAnchors: new Map(),
  wallClockHour: () => 12, // mid-day, not Archivist's window hours
};

let now = 1000;
let allOnFloor = true;
for (let i = 0; i < 200; i++) {
  tickBehavior(lokiDef, lokiRuntime, baseCtx, now);
  if (layout.tiles[lokiRuntime.y]?.[lokiRuntime.x] !== T_FLOOR) {
    allOnFloor = false;
    console.log(
      `    [debug] Loki stepped off floor at tick ${i}: (${lokiRuntime.x},${lokiRuntime.y}) = tile ${layout.tiles[lokiRuntime.y]?.[lokiRuntime.x]}`,
    );
    break;
  }
  now += lokiDef.tier0StepMs;
  lokiRuntime.actionEndsAt = 0; // force re-pick each iteration
}
assert(allOnFloor, '200 BT ticks all land on floor tiles');

console.log('\nStep 3 — Loki BT is deterministic over many ticks');
const loki1 = initialRuntime({ id: 'loki', x: lokiSpawn.x, y: lokiSpawn.y });
const loki2 = initialRuntime({ id: 'loki', x: lokiSpawn.x, y: lokiSpawn.y });
const prngs1 = new Map([['loki', mulberry32((SEED ^ fnv('loki')) >>> 0)]]);
const prngs2 = new Map([['loki', mulberry32((SEED ^ fnv('loki')) >>> 0)]]);
let nowSim = 1000;
for (let i = 0; i < 50; i++) {
  loki1.actionEndsAt = 0;
  loki2.actionEndsAt = 0;
  tickBehavior(lokiDef, loki1, { ...baseCtx, prngs: prngs1 }, nowSim);
  tickBehavior(lokiDef, loki2, { ...baseCtx, prngs: prngs2 }, nowSim);
  nowSim += lokiDef.tier0StepMs;
}
assert(
  loki1.x === loki2.x && loki1.y === loki2.y,
  `two BT runs with same seed end at same position (${loki1.x},${loki1.y}) == (${loki2.x},${loki2.y})`,
);

console.log('\nStep 4 — Archivist visit_window schedule activates 06–09');
const archDef = COHORT.find((d) => d.id === 'archivist')!;
const archRT = initialRuntime({ id: 'archivist', x: archSpawn.x, y: archSpawn.y });
const ctxMorning: BehaviorContext = { ...baseCtx, wallClockHour: () => 7 };
const ctxAfternoon: BehaviorContext = { ...baseCtx, wallClockHour: () => 14 };

archRT.actionEndsAt = 0;
const morningAction = tickBehavior(archDef, archRT, ctxMorning, 5000);
assert(
  morningAction.kind === 'scheduled' && morningAction.label === 'visit_window',
  `morning tick picks visit_window (got ${JSON.stringify(morningAction)})`,
);

const archRT2 = initialRuntime({ id: 'archivist', x: archSpawn.x, y: archSpawn.y });
archRT2.actionEndsAt = 0;
const afternoonAction = tickBehavior(archDef, archRT2, ctxAfternoon, 5000);
assert(
  afternoonAction.kind !== 'scheduled' || afternoonAction.label !== 'visit_window',
  `afternoon tick does NOT pick visit_window (got ${afternoonAction.kind === 'scheduled' ? afternoonAction.label : afternoonAction.kind})`,
);

console.log('\nStep 5 — Visitor presence cycles');
const visDef = COHORT.find((d) => d.id === 'visitor')!;
const visRT = initialRuntime({ id: 'visitor', x: layout.doorAt.x, y: layout.doorAt.y });
const mountedAt = 0;

// At t=0 the visitor should be present (cycle starts in visit phase).
tickPresence(visDef, visRT, baseCtx, mountedAt, 0);
assert(visRT.present === true, 'visitor present at t=0');

// At t=visitMs+1 the visitor should be absent.
tickPresence(visDef, visRT, baseCtx, mountedAt, 90_001);
assert(visRT.present === false, 'visitor absent at t=90s+1ms');

// At t=cycle+1 the visitor should be present again.
tickPresence(visDef, visRT, baseCtx, mountedAt, 900_001);
assert(visRT.present === true, 'visitor present again after full cycle');

console.log('\nStep 6 — Ghost theme allow-list');
const noGhost = filterByTheme(COHORT, 'solarized-dark');
assert(
  !noGhost.some((d) => d.id === 'ghost'),
  'ghost filtered out for solarized-dark',
);
const withGhost = filterByTheme(COHORT, 'tokyo-night');
assert(
  withGhost.some((d) => d.id === 'ghost'),
  'ghost present for tokyo-night',
);

console.log(`\n[smoke 2b] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

function fnv(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
