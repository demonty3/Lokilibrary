/**
 * Phase 2F smoke — `npx tsx scripts/smoke-2f-telemetry.mts`.
 *
 * Covers:
 *   - aggregateSince: counts/cost/latency over a time window
 *   - extrapolateMonthlyCost: linear projection from the window
 *   - PRICE_TABLE: per-(provider, model) prefix lookup with date suffix
 *   - persona auto-seed: Loki + 4 NPCs land in agent_personas after
 *     writer construction
 *   - router reprompt: deny-listed verb triggers a single retry; if
 *     the retry succeeds, repromptRecovered increments
 *   - router reprompt: persistent denial bumps the rejection counter
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { openMemoryVault } = await import('../src/agents/memory/vault.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const { cellIdFor, libraryIdFor } = await import('../src/agents/memory/schema.ts');
const {
  aggregateSince,
  extrapolateMonthlyCost,
  HOUR_MS,
  priceFor,
  PRICE_TABLE,
} = await import('../src/agents/telemetry.ts');
const { COHORT } = await import('../src/agents/cohort.ts');
const {
  routeTier1,
  getRouterStats,
  resetRouterStats,
} = await import('../src/agents/router.ts');
const { initialRuntime } = await import('../src/state/agentRuntime.ts');

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-2f-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite'), suppressVecWarning: true });
const vault = openMemoryVault({ rootDir: path.join(tmp, 'vaults') });
const ns = { cellId: cellIdFor(0xa11ce11), libraryId: libraryIdFor('demo') };
const writer = buildMemoryWriter({ db, vault, ns });

console.log('\n[smoke 2f] telemetry + persona + reprompt\n');

console.log('Step 1 — PRICE_TABLE prefix lookup handles Anthropic date suffixes');
const haikuExact = priceFor('anthropic', 'claude-haiku-4-5');
const haikuDated = priceFor('anthropic', 'claude-haiku-4-5-20251001');
assert(haikuExact?.inPerMtok === 0.8, 'exact key for haiku');
assert(
  haikuDated?.inPerMtok === 0.8,
  'date-suffixed haiku matches via prefix walk',
);
const sonnet = priceFor('anthropic', 'claude-sonnet-4-6');
assert(sonnet?.outPerMtok === 15.0, 'sonnet out price');
assert(priceFor('unknown', 'whatever') === null, 'unknown combo returns null');
assert(PRICE_TABLE.size >= 5, `price table has ≥5 entries (got ${PRICE_TABLE.size})`);

console.log('\nStep 2 — persona auto-seed populated all 5 agents');
const personaIds = ['loki', 'archivist', 'cat', 'visitor', 'ghost'];
for (const id of personaIds) {
  const p = db.getPersona(id);
  assert(p !== undefined, `persona "${id}" exists`);
  assert(p?.system_prompt.length! > 50, `persona "${id}" has non-trivial prompt`);
}
const lokiPersona = db.getPersona('loki');
const lokiMeta = JSON.parse(lokiPersona!.metadata_json) as { whitelist?: string[] };
assert(
  Array.isArray(lokiMeta.whitelist) && lokiMeta.whitelist.includes('shelve'),
  'loki metadata carries whitelist incl. "shelve"',
);

console.log('\nStep 3 — telemetry aggregation over a window');
const now = 1_000_000_000;
// Seed 10 Tier-1 + 2 Tier-2 events in the last hour.
for (let i = 0; i < 10; i++) {
  writer.logTier1({
    agentId: 'loki',
    model: 'claude-haiku-4-5',
    provider: 'anthropic',
    tokensIn: 400,
    tokensOut: 80,
    latencyMs: 1700 + i,
    costUsdEst: 0.001,
  });
}
for (let i = 0; i < 2; i++) {
  writer.logTier2({
    agentId: 'loki',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    tokensIn: 1200,
    tokensOut: 220,
    latencyMs: 1820,
    costUsdEst: 0.015,
  });
}
const summary = aggregateSince(db, HOUR_MS, Date.now() + 1000);
assert(summary.total.tier1Count === 10, `10 tier-1 rows (got ${summary.total.tier1Count})`);
assert(summary.total.tier2Count === 2, `2 tier-2 rows (got ${summary.total.tier2Count})`);
assert(
  Math.abs(summary.total.costUsd - (0.001 * 10 + 0.015 * 2)) < 0.0001,
  `cost sums (got $${summary.total.costUsd})`,
);
assert(summary.byModel.size === 2, `2 model buckets (haiku + sonnet)`);

console.log('\nStep 4 — extrapolateMonthlyCost scales linearly');
const monthly = extrapolateMonthlyCost(summary);
const expected = summary.total.costUsd * 24 * 30; // window = 1h
assert(
  Math.abs(monthly - expected) < 0.001,
  `monthly ≈ $${monthly.toFixed(4)} matches $${expected.toFixed(4)}`,
);

console.log('\nStep 5 — writer.aggregateTelemetry surfaces the same numbers');
const viaWriter = writer.aggregateTelemetry(HOUR_MS);
assert(viaWriter.total.tier1Count === 10, 'writer agg tier1 count');
assert(viaWriter.total.tier2Count === 2, 'writer agg tier2 count');

console.log('\nStep 6 — router reprompt recovers on second try');
resetRouterStats();
const lokiDef = COHORT.find((d) => d.id === 'loki')!;
const repromptRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
repromptRT.perceptionQueue.push({
  kind: 'player_proximity',
  subject: 'player',
  at: { x: 5, y: 6 },
  when: 10_000,
});
let callIndex = 0;
const recoveringTransport = {
  call: async () => {
    callIndex++;
    if (callIndex === 1) {
      return {
        ok: true as const,
        tick: {
          action: 'speak quietly to the player',
          intent: 'greet',
          model: 'stub',
          provider: 'stub',
          latencyMs: 5,
        },
      };
    }
    return {
      ok: true as const,
      tick: {
        action: 'inspect the Hades shelf',
        intent: 'examine top games',
        model: 'stub',
        provider: 'stub',
        latencyMs: 6,
      },
    };
  },
  reflect: async () => ({ ok: false as const, error: 'not called' }),
};
const r1 = await routeTier1(lokiDef, repromptRT, 'a small room', 10_000, {
  transport: recoveringTransport,
  memory: writer,
});
assert(r1.dispatched === true, 'dispatched after reprompt');
assert(repromptRT.intent === 'examine top games', 'intent installed from second response');
const stats1 = getRouterStats();
assert(stats1.reprompts === 1, `1 reprompt (got ${stats1.reprompts})`);
assert(stats1.repromptRecovered === 1, `1 recovery (got ${stats1.repromptRecovered})`);
assert(stats1.rejections === 0, `no rejection (got ${stats1.rejections})`);

console.log('\nStep 7 — router reprompt fails → rejection counter bumps');
resetRouterStats();
const stubbornRT = initialRuntime({ id: 'loki', x: 5, y: 5 });
stubbornRT.perceptionQueue.push({
  kind: 'player_proximity',
  subject: 'player',
  at: { x: 5, y: 6 },
  when: 20_000,
});
const stubbornTransport = {
  call: async () => ({
    ok: true as const,
    tick: {
      action: 'tell the player a story',
      intent: 'monologue',
      model: 'stub',
      provider: 'stub',
      latencyMs: 5,
    },
  }),
  reflect: async () => ({ ok: false as const, error: 'not called' }),
};
const r2 = await routeTier1(lokiDef, stubbornRT, 'a small room', 20_000, {
  transport: stubbornTransport,
  memory: writer,
});
assert(r2.dispatched === false, 'rejected');
assert(r2.skipReason === 'rejected', 'skipReason=rejected');
const stats2 = getRouterStats();
assert(stats2.reprompts === 1, '1 reprompt attempted');
assert(stats2.repromptRecovered === 0, '0 recoveries');
assert(stats2.rejections === 1, '1 rejection');
assert(stubbornRT.intent === '', 'intent NOT installed');

db.close();
console.log(`\n[smoke 2f] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\nKept tmp: ${tmp}`);
  process.exit(1);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`[smoke 2f] cleaned ${tmp}`);
