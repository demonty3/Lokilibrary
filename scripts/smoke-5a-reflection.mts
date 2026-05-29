/**
 * Phase 5 5A smoke — `npx tsx scripts/smoke-5a-reflection.mts`.
 *
 * Covers the three coupled pieces of slice 5A:
 *   - **Rate-limit**: routeTier2 returns `skipReason: 'rate_limited'`
 *     when called within REFLECTION_MIN_INTERVAL_MS of a successful
 *     dispatch. Counter NOT reset on rate-limit skip (so the next
 *     eligible dispatch still has full context). `force: true`
 *     bypasses the rate-limit.
 *   - **Plan parsing + persistence**: mock transport returns a
 *     reflection with a plan; router calls `memory.recordPlan` with
 *     the right shape AND sets `runtime.activePlan` +
 *     `runtime.activePlanStepIndex = 0`. Empty plan (no `plan` field
 *     or empty steps array) leaves activePlan null.
 *   - **BT plan-step execution**: tickBehavior scores the plan-step
 *     candidate at 0.75 (above intent-approach 0.7). Step with a
 *     location → approach action toward that cell. Step without
 *     location → idle / wander mapping by kind. tryAdvancePlanStep
 *     advances on arrival (location match) and immediately for
 *     no-location steps. Plan completion clears activePlan.
 *
 * NOT covered (needs running Worker / Sonnet / browser):
 *   - The Worker's actual prompt extension (Sonnet might or might
 *     not emit a valid plan — verified manually post-deploy).
 *   - Marginalia rendering pickup for plan-driven place_mark steps
 *     (cell.ts:179 already reads place_marks at mount; 5A's
 *     contribution is the PLAN, not the visual refresh).
 *   - Reflection telemetry assertions (covered by Phase 2D smokes).
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  routeTier2,
  REFLECTION_MIN_INTERVAL_MS,
  REFLECTION_THRESHOLD,
  nullMemoryWriter,
} = await import('../src/agents/router.ts');
type RouterModule = typeof import('../src/agents/router.ts');
const router = await import('../src/agents/router.ts') as RouterModule;
const { tickBehavior } = await import('../src/agents/behavior.ts');
const { initialRuntime, clearRuntimes } = await import('../src/state/agentRuntime.ts');
const { mulberry32 } = await import('../src/procedural/prng.ts');
const { layoutCell } = await import('../src/procedural/cell.ts');

const { check, report } = makeChecker('smoke 5A');

// ---------------------------------------------------------------------------
// Test fixtures

interface FakeRow {
  id: string;
  text: string;
  kind: 'observation' | 'reflection' | 'plan' | 'dialogue';
  importance: number;
  created_at: number;
}

interface RecordedPlan {
  agentId: string;
  text: string;
  stepCount: number;
  status: 'active' | 'completed' | 'abandoned';
}

function makeMockMemory(opts: {
  recent: readonly FakeRow[];
  onRecordPlan?: (plan: RecordedPlan) => void;
}) {
  return {
    recordPerception: () => null,
    recordReflection: () => 'reflection-id',
    recordPlan: (args: { agentId: string; text: string; steps: ReadonlyArray<unknown>; status: 'active' | 'completed' | 'abandoned' }) => {
      opts.onRecordPlan?.({
        agentId: args.agentId,
        text: args.text,
        stepCount: args.steps.length,
        status: args.status,
      });
      return 'plan-id';
    },
    placedMarksForCell: () => [],
    aggregateTelemetry: () => nullMemoryWriter.aggregateTelemetry(0),
    logTier1: () => undefined,
    logTier2: () => undefined,
    recentMemories: () => opts.recent,
    persona: () => null,
    // Phase 5C — lore surface; this 5A test has no lore, so no-ops keep
    // defaultLoreGatherer's loreCount()===0 early-return quiet.
    recordLore: () => null,
    recentLore: () => [],
    loreCount: () => 0,
  };
}

function makeMockTransport(opts: {
  plan?: {
    text: string;
    steps: ReadonlyArray<{
      kind: 'move_to' | 'inspect' | 'place_mark' | 'linger' | 'withdraw';
      target?: string;
      location?: { x: number; y: number };
    }>;
  };
  fail?: boolean;
}) {
  return {
    call: async () => { throw new Error('Tier 1 not used in this smoke'); },
    reflect: async (_input: unknown) => {
      if (opts.fail) {
        return { ok: false as const, error: 'mock failure' };
      }
      return {
        ok: true as const,
        result: {
          reflection: 'I notice the player keeps returning to the Hades shelf.',
          synthesised_from: ['m1', 'm2'],
          themes: ['return', 'mythos'],
          importance: 8,
          ...(opts.plan && { plan: opts.plan }),
          model: 'mock-sonnet',
          provider: 'mock',
          latencyMs: 100,
          tokensIn: 200,
          tokensOut: 30,
        },
      };
    },
  };
}

const def = {
  id: 'loki',
  name: 'Loki',
  glyph: 'L',
  fgKey: 'magenta' as const,
  spawn: { x: 10, y: 5 },
  tier0StepMs: 400,
  tier1ThrottleMs: 30000,
  schedule: [],
  whitelist: [],
};

// ---------------------------------------------------------------------------
// 1. Rate-limit (linear — uses realistic timestamps so the
// `lastReflectionAt > 0` guard in routeTier2 doesn't treat t=0 as "never
// dispatched" sentinel)

async function rateLimitTest(): Promise<void> {
  const fakeRows: FakeRow[] = [
    { id: 'm1', text: 'event', kind: 'observation', importance: 5, created_at: 1 },
  ];
  const transport = makeMockTransport({});
  const memory = makeMockMemory({ recent: fakeRows });
  const runtime = initialRuntime({ id: 'loki', x: 0, y: 0 });
  runtime.reflectionCounter = REFLECTION_THRESHOLD + 1; // over threshold

  const T0 = 1_000_000; // arbitrary > 0 baseline

  // First dispatch at T0 succeeds.
  const r1 = await router.routeTier2(def as never, runtime, T0, { transport, memory });
  check('rate-limit: first dispatch succeeds', r1.dispatched === true);
  check('rate-limit: first dispatch sets lastReflectionAt to now', runtime.lastReflectionAt === T0);

  // Re-fill counter (it was reset on dispatch).
  runtime.reflectionCounter = REFLECTION_THRESHOLD + 1;

  // Second dispatch 10s later → rate-limited.
  const r2 = await router.routeTier2(def as never, runtime, T0 + 10_000, { transport, memory });
  check('rate-limit: 10s later → skipReason=rate_limited', r2.skipReason === 'rate_limited');
  check('rate-limit: 10s later → dispatched=false', r2.dispatched === false);
  check(
    'rate-limit: counter preserved on rate-limited skip',
    runtime.reflectionCounter === REFLECTION_THRESHOLD + 1,
  );

  // After interval elapsed → succeeds again.
  const T1 = T0 + REFLECTION_MIN_INTERVAL_MS + 1;
  const r3 = await router.routeTier2(def as never, runtime, T1, { transport, memory });
  check('rate-limit: after interval elapsed → dispatched=true', r3.dispatched === true);
  check(
    'rate-limit: lastReflectionAt updated to new dispatch time',
    runtime.lastReflectionAt === T1,
  );

  // force: true bypasses the rate-limit.
  runtime.reflectionCounter = REFLECTION_THRESHOLD + 1;
  const r4 = await router.routeTier2(def as never, runtime, T1 + 1000, {
    transport,
    memory,
    force: true,
  });
  check('rate-limit: force=true bypasses rate-limit (dispatched)', r4.dispatched === true);

  // Below threshold + force=false → below_threshold (rate-limit branch not reached).
  runtime.reflectionCounter = 0;
  const r5 = await router.routeTier2(def as never, runtime, T1 + 2 * REFLECTION_MIN_INTERVAL_MS, {
    transport,
    memory,
  });
  check('rate-limit: below threshold returns below_threshold (not rate_limited)', r5.skipReason === 'below_threshold');
}

clearRuntimes();

// ---------------------------------------------------------------------------
// 2. Plan parsing + persistence (linear)

async function planPersistenceTest(): Promise<void> {
  const fakeRows: FakeRow[] = [
    { id: 'm1', text: 'player walked past', kind: 'observation', importance: 5, created_at: 1 },
  ];
  const recordedPlans: RecordedPlan[] = [];
  const memory = makeMockMemory({
    recent: fakeRows,
    onRecordPlan: (p) => recordedPlans.push(p),
  });

  // 2a. Reflection with plan → persists + sets activePlan
  const transportWithPlan = makeMockTransport({
    plan: {
      text: 'Walk to Hades, leave a note.',
      steps: [
        { kind: 'move_to', location: { x: 5, y: 8 } },
        { kind: 'place_mark', location: { x: 5, y: 8 } },
      ],
    },
  });
  const runtime = initialRuntime({ id: 'loki', x: 0, y: 0 });
  runtime.reflectionCounter = REFLECTION_THRESHOLD + 1;
  const result = await router.routeTier2(def as never, runtime, 0, {
    transport: transportWithPlan,
    memory,
  });

  check('plan: dispatch succeeded', result.dispatched === true);
  check('plan: result includes plan summary', !!result.plan);
  check('plan: result.plan.stepCount === 2', result.plan?.stepCount === 2);
  check('plan: recordPlan called once', recordedPlans.length === 1);
  check('plan: recorded plan agentId === loki', recordedPlans[0]?.agentId === 'loki');
  check('plan: recorded plan stepCount === 2', recordedPlans[0]?.stepCount === 2);
  check('plan: recorded plan status === active', recordedPlans[0]?.status === 'active');
  check('plan: runtime.activePlan set', runtime.activePlan !== null);
  check('plan: activePlan.steps.length === 2', runtime.activePlan?.steps.length === 2);
  check('plan: activePlanStepIndex === 0 after install', runtime.activePlanStepIndex === 0);

  // 2b. Reflection WITHOUT plan → activePlan stays null
  clearRuntimes();
  const transportNoPlan = makeMockTransport({});
  const memory2 = makeMockMemory({ recent: fakeRows });
  const runtime2 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  runtime2.reflectionCounter = REFLECTION_THRESHOLD + 1;
  // Wait — we set runtime.lastReflectionAt earlier so cannot dispatch again at t=0.
  // Use a new runtime which starts with lastReflectionAt=0.
  const result2 = await router.routeTier2(def as never, runtime2, 0, {
    transport: transportNoPlan,
    memory: memory2,
  });
  check('plan: no-plan case still dispatches', result2.dispatched === true);
  check('plan: no-plan case → result.plan undefined', result2.plan === undefined);
  check('plan: no-plan case → runtime.activePlan stays null', runtime2.activePlan === null);

  // 2c. Reflection with EMPTY steps array → also treated as no-plan
  clearRuntimes();
  const transportEmptyPlan = makeMockTransport({
    plan: { text: 'no concrete next step', steps: [] },
  });
  const memory3 = makeMockMemory({ recent: fakeRows });
  const runtime3 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  runtime3.reflectionCounter = REFLECTION_THRESHOLD + 1;
  const result3 = await router.routeTier2(def as never, runtime3, 0, {
    transport: transportEmptyPlan,
    memory: memory3,
  });
  check('plan: empty steps → result.plan undefined', result3.plan === undefined);
  check('plan: empty steps → activePlan stays null', runtime3.activePlan === null);

  // 2d. Failed reflection → counter NOT consumed for next attempt
  // (lastReflectionAt NOT updated, counter was reset upfront per
  // existing 2D behavior — verify the rate-limit doesn't fire on a
  // re-attempt after failure)
  clearRuntimes();
  const transportFail = makeMockTransport({ fail: true });
  const memory4 = makeMockMemory({ recent: fakeRows });
  const runtime4 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  runtime4.reflectionCounter = REFLECTION_THRESHOLD + 1;
  const result4 = await router.routeTier2(def as never, runtime4, 0, {
    transport: transportFail,
    memory: memory4,
  });
  check('plan: failed dispatch → rejected', result4.skipReason === 'rejected');
  check('plan: failed dispatch → lastReflectionAt NOT updated', runtime4.lastReflectionAt === 0);
}

// ---------------------------------------------------------------------------
// 3. BT plan-step execution

function btPlanExecutionTest(): void {
  // Build a tiny cell layout for the BT context.
  const layout = layoutCell(0xdeadbeef);
  const prngs = new Map([['loki', mulberry32(42)]]);
  const ctx = {
    layout,
    prngs,
    scatterAnchors: new Map(),
    wallClockHour: () => 12,
  };

  // 3a. Plan-step with location → BT picks approach toward it
  const runtime = initialRuntime({ id: 'loki', x: 0, y: 0 });
  runtime.activePlan = {
    text: 'Walk to a corner.',
    steps: [
      { kind: 'move_to', location: { x: 3, y: 3 }, status: 'pending' as const },
    ],
    status: 'active' as const,
  };
  runtime.activePlanStepIndex = 0;
  // Force runtime onto a known walkable cell.
  // (layoutCell's deterministic output puts floor in known places; we use 0,0
  // which is a wall corner. We bypass by setting position to a floor cell
  // the BT will walk from. For the smoke we just need the *action* picked.)
  // The BT will check walkable cells when stepping; with the test plan
  // step at (3, 3) and the BT picking approach, executeAction may not
  // physically move (if path blocked) but the action selection is what
  // we're testing.
  const action = tickBehavior(def as never, runtime, ctx, 1000);
  check('bt: plan-step → action.kind === approach', action.kind === 'approach');
  if (action.kind === 'approach') {
    check('bt: approach targets the plan step location', action.target.x === 3 && action.target.y === 3);
  }

  // 3b. Plan with no-location step (linger) → idle
  const runtime2 = initialRuntime({ id: 'loki', x: 5, y: 5 });
  runtime2.activePlan = {
    text: 'pause',
    steps: [{ kind: 'linger', status: 'pending' as const }],
    status: 'active' as const,
  };
  runtime2.activePlanStepIndex = 0;
  const action2 = tickBehavior(def as never, runtime2, ctx, 1000);
  check('bt: linger step → action.kind === idle', action2.kind === 'idle');

  // 3c. After linger step (no location), tryAdvancePlanStep auto-advances.
  // Call tickBehavior again — the step should now be consumed.
  // Note: the advance happens AT THE START of tickBehavior on the next
  // call, BEFORE picking a new action. So we need a second tick.
  // First reset action ending so a new pick happens:
  runtime2.actionEndsAt = 0;
  const action3 = tickBehavior(def as never, runtime2, ctx, 2000);
  check(
    'bt: after no-location step + next tick → plan advanced + cleared',
    runtime2.activePlan === null && runtime2.activePlanStepIndex === 0,
  );
  // action3 falls back to wander/idle (no plan candidate scored).
  check('bt: post-plan action is wander or idle', action3.kind === 'wander' || action3.kind === 'idle');

  // 3d. Multi-step plan: advance on arrival at each step's location
  const runtime3 = initialRuntime({ id: 'loki', x: 5, y: 5 });
  runtime3.activePlan = {
    text: 'visit two corners',
    steps: [
      { kind: 'move_to', location: { x: 5, y: 5 }, status: 'pending' as const }, // already there
      { kind: 'inspect', location: { x: 5, y: 5 }, status: 'pending' as const },  // also at location
      { kind: 'linger', status: 'pending' as const },                              // no location
    ],
    status: 'active' as const,
  };
  runtime3.activePlanStepIndex = 0;

  // Call 1: tryAdvancePlanStep at start sees agent at step 0's location
  // (5,5) → advances to step 1. BT then picks step 1's action (approach,
  // already at target). Post-pick handler: step 1 has location → no
  // advance. Index ends at 1.
  tickBehavior(def as never, runtime3, ctx, 1000);
  check('bt: multi-step plan after 1 tick → index advanced to 1', runtime3.activePlanStepIndex === 1);
  check('bt: multi-step plan after 1 tick → plan still active', runtime3.activePlan !== null);

  // Call 2 (after action ends): tryAdvance sees agent at step 1's
  // location → advances to step 2 (linger, no location). BT picks
  // step 2's idle action. Post-pick handler: no location → advances
  // to step 3 → OOB → plan cleared. Two advancements in one tick.
  runtime3.actionEndsAt = 0;
  tickBehavior(def as never, runtime3, ctx, 2000);
  check('bt: multi-step plan after 2 ticks → plan cleared', runtime3.activePlan === null);
  check('bt: multi-step plan after 2 ticks → index reset to 0', runtime3.activePlanStepIndex === 0);
}

// ---------------------------------------------------------------------------
// 4. planStepToAction kinds (via behavior — checking action choices)

function planStepKindMappingTest(): void {
  const layout = layoutCell(0xdeadbeef);
  const prngs = new Map([['loki', mulberry32(42)]]);
  const ctx = {
    layout,
    prngs,
    scatterAnchors: new Map(),
    wallClockHour: () => 12,
  };

  // move_to → approach (location set)
  const r1 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  r1.activePlan = {
    text: '', status: 'active',
    steps: [{ kind: 'move_to', location: { x: 10, y: 10 }, status: 'pending' as const }],
  };
  const a1 = tickBehavior(def as never, r1, ctx, 1000);
  check('kind: move_to → approach', a1.kind === 'approach');

  // inspect with location → approach
  const r2 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  r2.activePlan = {
    text: '', status: 'active',
    steps: [{ kind: 'inspect', location: { x: 7, y: 8 }, status: 'pending' as const }],
  };
  const a2 = tickBehavior(def as never, r2, ctx, 1000);
  check('kind: inspect (with location) → approach', a2.kind === 'approach');

  // inspect without location → idle
  const r3 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  r3.activePlan = {
    text: '', status: 'active',
    steps: [{ kind: 'inspect', status: 'pending' as const }],
  };
  const a3 = tickBehavior(def as never, r3, ctx, 1000);
  check('kind: inspect (no location) → idle', a3.kind === 'idle');

  // place_mark with location → approach
  const r4 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  r4.activePlan = {
    text: '', status: 'active',
    steps: [{ kind: 'place_mark', location: { x: 4, y: 4 }, status: 'pending' as const }],
  };
  const a4 = tickBehavior(def as never, r4, ctx, 1000);
  check('kind: place_mark (with location) → approach', a4.kind === 'approach');

  // linger → idle
  const r5 = initialRuntime({ id: 'loki', x: 0, y: 0 });
  r5.activePlan = {
    text: '', status: 'active',
    steps: [{ kind: 'linger', status: 'pending' as const }],
  };
  const a5 = tickBehavior(def as never, r5, ctx, 1000);
  check('kind: linger → idle', a5.kind === 'idle');

  // withdraw → wander
  const r6 = initialRuntime({ id: 'loki', x: 5, y: 5 });
  r6.activePlan = {
    text: '', status: 'active',
    steps: [{ kind: 'withdraw', status: 'pending' as const }],
  };
  const a6 = tickBehavior(def as never, r6, ctx, 1000);
  check('kind: withdraw → wander', a6.kind === 'wander');
}

// ---------------------------------------------------------------------------
// Run linear tests + report

await rateLimitTest();
await planPersistenceTest();
btPlanExecutionTest();
planStepKindMappingTest();

report();
