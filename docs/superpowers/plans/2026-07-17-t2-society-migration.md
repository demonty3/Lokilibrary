# T2 Society Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The real 5-agent cohort (Loki, Archivist, Cat, Visitor, Ghost) replaces the generic native walkers in the terminal lands, with real minds (Tier-1 LLM on arrival, key-free fallback), full personality (intent biases + presence dynamics), proper memory-schema source tokens, mind-state carried across seam handoffs, and homes that survive relaunch.

**Architecture:** Hybrid (spec: `docs/superpowers/specs/2026-07-17-t2-society-migration-design.md`) — the proven `Being` walker in `terminalLand.ts` stays the body; each cohort member gets a REAL `AgentRuntimeState` (via `initialRuntime`) as the mind so `routeTier1` runs unchanged. The main-process broker owns homes (`agentId → wing`) and persists them to config. One deliberate simplification vs the spec's wording: the mind lives as `Being.mind` (one lifecycle, one map) rather than a separate `RuntimeScope` — the spec's real requirement (real `AgentRuntimeState`, no shim) holds.

**Tech Stack:** TypeScript strict, PixiJS v8 (renderer), Electron main-process broker (`desktop/`), better-sqlite3 memory stream, smokes via `npx tsx scripts/smoke-*.mts`.

## Global Constraints

- **TS strict mode** both legs: `npm run typecheck` (root + worker) AND `cd desktop && npx tsc --noEmit` after desktop changes.
- **No `Math.random()`/`Date.now()` in `src/procedural/`** — this slice touches `src/terminal/` + `src/agents/` + `desktop/src/`, where runtime `Date.now()` is allowed (existing pattern in terminalLand.ts).
- **New runtime AI calls require a CLAUDE.md entry** — Task 6 adds it (Tier-1 on terminal-land arrival).
- **Whitelist discipline:** the LLM output steers the walker ONLY via the existing `approach x,y` intent parse. No prompt widening, no worker changes.
- **Time base on land is `Date.now()`** (NOT `performance.now()` as in the cell): `lastTier1At` crosses process boundaries in handoffs, and `performance.now()` has a per-process origin. Self-consistent — lands only exchange state with lands.
- **Don't touch** `legacy-3d/`, `legacy-desktop-v0.6/`, the palace cell cohort path (`src/render/agents/cohort.ts`), or the worker.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Full smoke sweep before finishing: `for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done` — every smoke must PASS.
- Default terminal theme is **`phosphor`** (`TerminalApp.tsx:TERMINAL_THEME`), and Ghost's `themeAllow` is `['tokyo-night','catppuccin-mocha']` — Ghost NEVER appears on a default desk. This is correct cell-parity behavior, not a bug. Verify Ghost with `?theme=tokyo-night`.

---

### Task 1: Pure intent layer — land personas, biased picks, LLM-intent parse

**Files:**
- Modify: `src/terminal/beingIntents.ts`
- Test: `scripts/smoke-t1-being-intents.mts` (extend)

**Interfaces:**
- Consumes: existing `pickIntent(rand, ctx)`, `BeingIntent`, `BeingIntentKind`.
- Produces: `IntentBias`, `LandPersona {bias, speed:[number,number], intentWindowMult}`, `LAND_PERSONAS: Record<string, LandPersona>`, `DEFAULT_LAND_PERSONA`, `pickIntent(rand, ctx, bias?: IntentBias)`, `landIntentFromTick(intent: string, ctx: {width: number}): BeingIntent | null`. Task 5 consumes all of these.

- [ ] **Step 1: Write the failing tests** — append to `scripts/smoke-t1-being-intents.mts` (it uses `makeChecker` from `scripts/lib/smoke.ts`; follow its existing `check(label, cond, detail)` style):

```ts
// ── T2 society: personas + bias ─────────────────────────────────────────
import {
  LAND_PERSONAS,
  DEFAULT_LAND_PERSONA,
  landIntentFromTick,
} from '../src/terminal/beingIntents';

// S-bias-1: the decisive-pull invariant — a POPULATED-edge watch_edge pull
// must dominate every other candidate's sup for EVERY persona:
// 0.75 + bias.watch_edge ≥ max(0.7 + wander, 0.75 + approach, 0.5 + rest)
for (const [id, p] of Object.entries(LAND_PERSONAS)) {
  const bwe = 0.75 + (p.bias.watch_edge ?? 0);
  const others = Math.max(
    0.7 + (p.bias.wander ?? 0),
    0.75 + (p.bias.approach ?? 0),
    0.5 + (p.bias.rest ?? 0),
  );
  check(`persona ${id}: populated-edge pull still dominates`, bwe >= others,
    `${bwe} < ${others}`);
  check(`persona ${id}: speed range sane`, p.speed[0] > 0 && p.speed[1] > p.speed[0]);
  check(`persona ${id}: intent window mult sane`, p.intentWindowMult > 0);
}
check('all five cohort ids have a persona',
  ['loki', 'archivist', 'cat', 'visitor', 'ghost'].every((id) => id in LAND_PERSONAS));

// S-bias-2: no-bias call = byte-identical to the pre-bias engine (the
// default param adds +0 to every candidate). Same seeded stream both ways.
{
  const mk = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const ctx = {
    width: 80, x: 40, structureCols: [20, 60],
    edges: { left: true, right: false }, neighbourNear: { left: 0, right: 0 },
  };
  const a = mk(7), b = mk(7);
  let identical = true;
  for (let i = 0; i < 50; i++) {
    if (JSON.stringify(pickIntent(a, ctx)) !== JSON.stringify(pickIntent(b, ctx, {}))) identical = false;
  }
  check('empty bias is byte-identical to no bias', identical);

  // S-bias-3: biases measurably steer — cat rests more than loki over the
  // SAME stream; loki watches the open edge more than cat.
  const count = (bias: Record<string, number>, kind: string): number => {
    const r = mk(99);
    let n = 0;
    for (let i = 0; i < 300; i++) if (pickIntent(r, ctx, bias).kind === kind) n++;
    return n;
  };
  const catRest = count(LAND_PERSONAS.cat.bias, 'rest');
  const lokiRest = count(LAND_PERSONAS.loki.bias, 'rest');
  check('cat rests more than loki', catRest > lokiRest, `${catRest} vs ${lokiRest}`);
  const lokiWatch = count(LAND_PERSONAS.loki.bias, 'watch_edge');
  const catWatch = count(LAND_PERSONAS.cat.bias, 'watch_edge');
  check('loki watches the edge more than cat', lokiWatch > catWatch, `${lokiWatch} vs ${catWatch}`);
}

// S-parse: landIntentFromTick — the ONLY LLM→walker steering channel.
check('parse approach', JSON.stringify(landIntentFromTick('approach 34,0', { width: 80 }))
  === JSON.stringify({ kind: 'approach', targetX: 34 }));
check('parse clamps high', (landIntentFromTick('approach 999,0', { width: 80 }) as { targetX: number }).targetX === 79);
check('parse clamps negative', (landIntentFromTick('approach -5,2', { width: 80 }) as { targetX: number }).targetX === 0);
check('parse trims', landIntentFromTick('  approach 10,0  ', { width: 80 }) !== null);
check('flavor is null', landIntentFromTick('inspect shelf:hades', { width: 80 }) === null);
check('empty is null', landIntentFromTick('', { width: 80 }) === null);
check('prose is null', landIntentFromTick('walk toward the monument', { width: 80 }) === null);
check('default persona is native-compatible',
  DEFAULT_LAND_PERSONA.speed[0] === 1.2 && DEFAULT_LAND_PERSONA.speed[1] === 2.6
  && DEFAULT_LAND_PERSONA.intentWindowMult === 1
  && Object.keys(DEFAULT_LAND_PERSONA.bias).length === 0);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx scripts/smoke-t1-being-intents.mts`
Expected: FAIL — `LAND_PERSONAS` / `landIntentFromTick` have no export.

- [ ] **Step 3: Implement in `src/terminal/beingIntents.ts`**

Add after the `IntentContext` interface:

```ts
/** Additive score offsets per intent kind. Invariant (smoke-enforced):
 *  a POPULATED-edge watch_edge pull must still dominate every other
 *  candidate's sup — 0.75 + watch_edge ≥ max(0.7 + wander,
 *  0.75 + approach, 0.5 + rest) — so society gravity always wins. */
export type IntentBias = Partial<Record<BeingIntentKind, number>>;

export interface LandPersona {
  bias: IntentBias;
  /** Walk speed range, cells/sec [min, max). */
  speed: [number, number];
  /** Multiplier on the intent re-pick window — slow thinkers re-pick less. */
  intentWindowMult: number;
}

/** The cohort's land personalities (T2 society migration). Keyed by
 *  AgentDef.id; unknown ids fall back to DEFAULT_LAND_PERSONA (the
 *  T0 native tuning, kept for the defensive unknown-id path). */
export const LAND_PERSONAS: Record<string, LandPersona> = {
  loki: { bias: { wander: 0.05, watch_edge: 0.1 }, speed: [2.0, 2.8], intentWindowMult: 0.8 },
  archivist: { bias: { approach: 0.12, watch_edge: 0.12 }, speed: [1.4, 2.0], intentWindowMult: 1 },
  cat: { bias: { rest: 0.25, approach: 0.05, watch_edge: 0.05 }, speed: [0.8, 1.4], intentWindowMult: 1.3 },
  visitor: { bias: { wander: 0.05 }, speed: [1.6, 2.4], intentWindowMult: 1 },
  ghost: { bias: { rest: 0.2 }, speed: [0.6, 1.0], intentWindowMult: 1.5 },
};

export const DEFAULT_LAND_PERSONA: LandPersona = {
  bias: {},
  speed: [1.2, 2.6],
  intentWindowMult: 1,
};
```

Change `pickIntent`'s signature and the four candidate pushes (bias adds a
constant offset; empty bias is +0 everywhere = byte-identical):

```ts
export function pickIntent(
  rand: () => number,
  ctx: IntentContext,
  bias: IntentBias = {},
): BeingIntent {
  const candidates: Scored[] = [];
  candidates.push({
    score: 0.4 + (bias.wander ?? 0) + rand() * 0.3,
    intent: { kind: 'wander', dir: rand() < 0.5 ? 1 : -1 },
  });
  candidates.push({ score: 0.2 + (bias.rest ?? 0) + rand() * 0.3, intent: { kind: 'rest' } });
  if (ctx.structureCols.length > 0) {
    const idx = Math.min(ctx.structureCols.length - 1, Math.floor(rand() * ctx.structureCols.length));
    candidates.push({
      score: 0.45 + (bias.approach ?? 0) + rand() * 0.3,
      intent: { kind: 'approach', targetX: ctx.structureCols[idx] },
    });
  }
  for (const side of ['left', 'right'] as const) {
    if (!ctx.edges[side]) continue;
    const pull = ctx.neighbourNear[side] > 0 ? 0.25 : 0;
    candidates.push({
      score: 0.5 + pull + (bias.watch_edge ?? 0) + rand() * 0.3,
      intent: { kind: 'watch_edge', side },
    });
  }
  // ... max-pick loop unchanged
```

Also update the module docstring's scoring-ladder comment to mention the
per-persona bias offsets and the invariant.

Add at the end of the file (near `resumeIntent` — it is the same
"LLM/handoff → land intent" family):

```ts
/**
 * The ONLY channel by which a Tier-1 LLM tick steers the walker: the
 * cell's `approach x,y` intent format (behavior.ts:parseIntentTarget's
 * grammar), mapped to a 1-D land approach. Anything else is flavor —
 * the caller keeps its engine-picked intent. Total: never throws.
 */
export function landIntentFromTick(
  intent: string,
  ctx: { width: number },
): BeingIntent | null {
  const m = /^approach\s+(-?\d+)\s*,\s*(-?\d+)$/.exec(intent.trim());
  if (!m) return null;
  const targetX = Math.min(ctx.width - 1, Math.max(0, Number(m[1])));
  return { kind: 'approach', targetX };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx scripts/smoke-t1-being-intents.mts`
Expected: PASS, count grows by ~25 assertions. Also run `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/beingIntents.ts scripts/smoke-t1-being-intents.mts
git commit -m "feat(terminal): land personas — biased intent picks + the approach-x,y LLM steering parse

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Memory schema v3 — terminal ObservationSource tokens

**Files:**
- Modify: `src/agents/memory/schema.ts` (union + `SCHEMA_VERSION`)
- Modify: `src/agents/memory/writer.ts` (`sourceFromEventKind`)
- Modify: `src/terminal/terminalMemory.ts` (docstring only — the "frozen source" note is stale after this)
- Test: `scripts/smoke-t1-society-memory.mts` (extend)

**Interfaces:**
- Produces: `ObservationSource` gains `'terminal_crossing' | 'terminal_arrival'`; `SCHEMA_VERSION = 3`. Rows written for those kinds now carry their own source token. Task 6's sqlite verification queries `source='terminal_crossing'`.

- [ ] **Step 1: Write the failing tests** — `scripts/smoke-t1-society-memory.mts` opens a real better-sqlite3 DB and drives `recordCrossing`/`recordArrival` through the real writer. Append (adapt db/writer variable names to the ones the file already uses):

```ts
// ── T2 society: proper source tokens (SCHEMA_VERSION 3) ────────────────
// A crossing row must carry its OWN source, not the v2 'self_perception' fold.
{
  const id = recordCrossing(writer, {
    agentId: 'loki', fromWing: 'd0', toWing: 'd1', col: 3, row: 12, whenMs: 1700000000000,
  });
  check('crossing recorded', id !== null);
  const row = rawDb
    .prepare(`SELECT payload_json FROM memories WHERE id = ?`)
    .get(id) as { payload_json: string };
  const payload = JSON.parse(row.payload_json) as { data: { source: string } };
  check('crossing source token', payload.data.source === 'terminal_crossing',
    payload.data.source);
}
{
  const id = recordArrival(writer, { agentId: 'loki', wing: 'd1', col: 0, row: 12, whenMs: 1700000000001 });
  const row = rawDb
    .prepare(`SELECT payload_json FROM memories WHERE id = ?`)
    .get(id) as { payload_json: string };
  const payload = JSON.parse(row.payload_json) as { data: { source: string } };
  check('arrival source token', payload.data.source === 'terminal_arrival', payload.data.source);
}
check('schema_version contains 3',
  (rawDb.prepare(`SELECT COUNT(*) AS n FROM schema_version WHERE version = 3`).get() as { n: number }).n === 1);
```

NOTE: if the smoke's writer wraps the raw db handle without exposing it,
open a second read-only `new Database(dbPath)` on the same file for the
assertions — WAL mode allows it. If the observation payload stores
`source` at a different JSON path, `console.log` one row first and match
the real shape; the assertion's substance is `=== 'terminal_crossing'`.

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx scripts/smoke-t1-society-memory.mts`
Expected: FAIL — sources come back `'self_perception'`, version 3 absent.

- [ ] **Step 3: Implement**

`src/agents/memory/schema.ts` — extend the union and bump:

```ts
export type ObservationSource =
  | 'self_perception'
  | 'agent_meeting'
  | 'player_proximity'
  | 'bookshelf_e'
  | 'game_launched'
  | 'external_fullscreen'
  | 'cell_mount'
  | 'terminal_crossing'
  | 'terminal_arrival';
```

```ts
/** Schema version. Bump when changing column shape; migration lives in db.ts.
 *  v3 (2026-07-17): +terminal_crossing/+terminal_arrival ObservationSource
 *  tokens — additive only (`source` is unconstrained TEXT; old rows untouched;
 *  the version table accumulates one row per version). */
export const SCHEMA_VERSION = 3;
```

`src/agents/memory/writer.ts` — `sourceFromEventKind`: add the two tokens
to the return union and map them to themselves, replacing the v2 fold:

```ts
    case 'terminal_crossing':
      return 'terminal_crossing';
    case 'terminal_arrival':
      return 'terminal_arrival';
```

(Delete the old combined case and its "frozen schema contract" comment —
the tokens are first-class as of v3. Keep the `default: return
'self_perception'`.)

`src/terminal/terminalMemory.ts` — update the docstring paragraph that
says crossings map to the frozen `'self_perception'` source and that no
Tier-1 fires from terminals: as of the T2 society migration, crossings/
arrivals carry their own source tokens (schema v3) and terminalLand.ts
dispatches Tier-1 on arrival (this module still only records).

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx scripts/smoke-t1-society-memory.mts` → PASS.
Run: `npx tsx scripts/smoke-2a-memory.mts` → PASS (schema bump must not break the memory-stream smoke).
Run: `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/agents/memory/schema.ts src/agents/memory/writer.ts src/terminal/terminalMemory.ts scripts/smoke-t1-society-memory.mts
git commit -m "feat(memory): schema v3 — terminal_crossing/terminal_arrival become first-class ObservationSource tokens

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Renderer society module — residents + mind handoff (pure)

**Files:**
- Create: `src/terminal/society.ts`
- Test: `scripts/smoke-t2-society.mts` (new)

**Interfaces:**
- Consumes: `COHORT` (`src/agents/cohort.ts`), `initialRuntime` + types (`src/state/agentRuntime.ts`).
- Produces (Task 5 consumes): `SOCIETY_IDS`, `residentsOf(society, wing)`, `CarriedMind`, `carriedFromMind(mind)`, `reconstructMind(id, x, y, carried?)`, `sceneLabelFor(wing, width, structureCols)`.

- [ ] **Step 1: Write the failing test** — create `scripts/smoke-t2-society.mts`:

```ts
/**
 * T2 society migration smoke — `npx tsx scripts/smoke-t2-society.mts`.
 * Pure renderer-side society helpers: resident resolution (with the
 * no-broker web fallback), mind carry/reconstruct round-trip (the
 * migrateRuntime-over-IPC contract), and the Tier-1 scene label.
 */
import { makeChecker } from './lib/smoke.ts';
import {
  SOCIETY_IDS,
  residentsOf,
  carriedFromMind,
  reconstructMind,
  sceneLabelFor,
} from '../src/terminal/society';
import { initialRuntime } from '../src/state/agentRuntime';
import { COHORT } from '../src/agents/cohort';

const { check, report } = makeChecker('smoke t2-society');

// Residents
check('SOCIETY_IDS mirrors COHORT order',
  JSON.stringify(SOCIETY_IDS) === JSON.stringify(COHORT.map((d) => d.id)));
const society = { loki: 'd0', archivist: 'd1', cat: 'd0', visitor: 'd1', ghost: 'd0' };
check('residents of d0', JSON.stringify(residentsOf(society, 'd0')) === JSON.stringify(['loki', 'cat', 'ghost']));
check('residents of d1', JSON.stringify(residentsOf(society, 'd1')) === JSON.stringify(['archivist', 'visitor']));
check('residents of an unassigned wing is empty', residentsOf(society, 'd5').length === 0);
check('null society (web preview, no broker) → the lone land hosts everyone',
  JSON.stringify(residentsOf(null, 'd0')) === JSON.stringify([...SOCIETY_IDS]));

// Mind carry/reconstruct — the exactly-once IPC handoff contract.
const mind = initialRuntime({ id: 'loki', x: 3, y: 12 });
mind.lastTier1At = 1700000000000;
mind.reflectionCounter = 42;
mind.perceptionQueue.push({ kind: 'terminal_arrival', subject: 'd0', at: { x: 3, y: 12 }, when: 1700000000000 });
const carried = carriedFromMind(mind);
check('carried is plain JSON', JSON.stringify(carried).length > 0);
check('carried queue is a COPY', carried.perceptionQueue !== mind.perceptionQueue);
const rebuilt = reconstructMind('loki', 79, 11, JSON.parse(JSON.stringify(carried)));
check('rebuilt id/pos', rebuilt.id === 'loki' && rebuilt.x === 79 && rebuilt.y === 11);
check('rebuilt lastTier1At carried', rebuilt.lastTier1At === 1700000000000);
check('rebuilt reflectionCounter carried', rebuilt.reflectionCounter === 42);
check('rebuilt queue carried (throttled arrival survives the seam)',
  rebuilt.perceptionQueue.length === 1 && rebuilt.perceptionQueue[0].kind === 'terminal_arrival');
check('rebuilt is otherwise fresh', rebuilt.intent === '' && rebuilt.present === true && rebuilt.activePlan === null);
const fresh = reconstructMind('cat', 5, 12);
check('no carried → pure initialRuntime', fresh.lastTier1At === 0 && fresh.perceptionQueue.length === 0);

// Scene label — must name the wing, the width, and structure columns so
// the LLM can emit a parseable `approach x,y`.
const label = sceneLabelFor('d1', 96, [34, 60]);
check('scene names the wing', label.includes('d1'));
check('scene names the width', label.includes('96'));
check('scene names structure columns', label.includes('34') && label.includes('60'));
check('scene tells the model y is 0', label.includes('y') && label.includes('0'));
check('structure-free land still labels', sceneLabelFor('d0', 80, []).includes('d0'));

report();
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx scripts/smoke-t2-society.mts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/terminal/society.ts`**

```ts
/**
 * T2 society migration — pure renderer-side society helpers
 * (docs/superpowers/specs/2026-07-17-t2-society-migration-design.md).
 *
 * The main-process broker owns HOMES (agentId → wing, persisted in
 * config); this module answers "who lives on THIS land" and packs/
 * unpacks the mind half of a seam handoff. NO PIXI, NO IPC — the
 * smoke drives everything headlessly.
 */

import type { AgentRuntimeState, PerceptionEvent } from '../state/agentRuntime';
import { initialRuntime } from '../state/agentRuntime';
import { COHORT } from '../agents/cohort';

/** Cohort ids in COHORT order — the round-robin order the broker mirrors
 *  (desktop/src/terminals.ts SOCIETY_IDS; desktop compiles separately, so
 *  it keeps a literal copy the way preload mirrors TerminalBeingState). */
export const SOCIETY_IDS: readonly string[] = COHORT.map((d) => d.id);

/** Which cohort members live on `wing`. A null society means no broker
 *  (web preview / missing preload): the lone land hosts everyone. */
export function residentsOf(
  society: Record<string, string> | null,
  wing: string,
): string[] {
  if (!society) return [...SOCIETY_IDS];
  return SOCIETY_IDS.filter((id) => society[id] === wing);
}

/** The mind half of a handoff — plain JSON, broker-opaque. The queue is
 *  usually empty (dispatch drains it) but a THROTTLED arrival leaves its
 *  event queued; carrying it means no perception is ever lost at a seam. */
export interface CarriedMind {
  lastTier1At: number;
  reflectionCounter: number;
  perceptionQueue: PerceptionEvent[];
}

export function carriedFromMind(mind: AgentRuntimeState): CarriedMind {
  return {
    lastTier1At: mind.lastTier1At,
    reflectionCounter: mind.reflectionCounter,
    perceptionQueue: [...mind.perceptionQueue],
  };
}

/** migrateRuntime-over-IPC, arrival side: a REAL runtime via
 *  initialRuntime + the carried mind fields overlaid. Everything else
 *  (intent, plans, seam state) starts fresh — those are cell-surface
 *  concepts the land does not run. */
export function reconstructMind(
  id: string,
  x: number,
  y: number,
  carried?: CarriedMind,
): AgentRuntimeState {
  const mind = initialRuntime({ id, x, y });
  if (carried) {
    mind.lastTier1At = carried.lastTier1At;
    mind.reflectionCounter = carried.reflectionCounter;
    mind.perceptionQueue.push(...carried.perceptionQueue);
  }
  return mind;
}

/** Tier-1 scene string. Names the structure COLUMNS so the existing
 *  `approach x,y` intent grammar is expressible without any worker/
 *  prompt change (y on a land surface is always given as 0). */
export function sceneLabelFor(
  wing: string,
  width: number,
  structureCols: readonly number[],
): string {
  const structures =
    structureCols.length > 0
      ? `structures stand near columns ${structureCols.join(', ')}`
      : 'no structures stand here yet';
  return (
    `a side-on terminal land showing the ${wing} wing, ${width} columns wide ` +
    `(positions are "column,0" — y is always 0); ${structures}`
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx scripts/smoke-t2-society.mts` → PASS (~20 assertions).
Run: `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/society.ts scripts/smoke-t2-society.mts
git commit -m "feat(terminal): society module — resident resolution + mind handoff pack/unpack + Tier-1 scene label

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Broker homes + persistence + society IPC

**Files:**
- Modify: `desktop/src/config.ts` (society field, parse-don't-strip)
- Modify: `desktop/src/terminals.ts` (homes map, assignment, re-home on crossing, `terminal:getSociety` IPC, debugState)
- Modify: `desktop/src/preload.ts` (getTerminalSociety + TerminalBeingState.mind mirror)
- Modify: `src/api/electron.ts` (same two, renderer side)
- Test: `scripts/smoke-t1-broker-handoff.mts` (extend)

**Interfaces:**
- Consumes: existing broker (`roster`, `terminals`, `joins`, `persistTerminals`, agentExit handler), `getSociety`/`setSociety` (new, this task).
- Produces (Task 5 consumes): `getTerminalSociety(): Promise<Record<string, string> | null>` in `src/api/electron.ts`; `TerminalBeingState.mind?: {lastTier1At: number; reflectionCounter: number; perceptionQueue: Array<{kind: string; subject?: string; at: {x: number; y: number}; when: number}>}`; broker re-homes a crossing agent and persists; `terminal:debugState` response gains `society`.

- [ ] **Step 1: Write the failing tests** — append to `scripts/smoke-t1-broker-handoff.mts` (it boots the REAL `startTerminalsMode` against `mockElectronModule` fakes with a tmp userData dir; reuse its existing handles for `handlers` (captured ipcMain) and the fake windows):

```ts
// ── T2 society: homes + persistence ─────────────────────────────────────
// Boot (2 terminals, wings d0/d1) must round-robin all five cohort ids.
{
  const state = handlers.get('terminal:debugState')!(null) as {
    society: Record<string, string>;
  };
  check('society exists in debugState', !!state.society);
  const homes = state.society;
  check('all five assigned', ['loki', 'archivist', 'cat', 'visitor', 'ghost'].every((id) => id in homes));
  check('round-robin over open wings',
    homes.loki === 'd0' && homes.archivist === 'd1' && homes.cat === 'd0'
    && homes.visitor === 'd1' && homes.ghost === 'd0',
    JSON.stringify(homes));
  const society = handlers.get('terminal:getSociety')!(null) as Record<string, string>;
  check('getSociety matches debugState', JSON.stringify(society) === JSON.stringify(homes));
}

// A successful crossing RE-HOMES the agent and persists.
{
  // Precondition from the existing handoff section: t1 and t2 are joined.
  await handlers.get('terminal:agentSpawn')!(null, { agentId: 'loki', terminalId: 't1' });
  const ok = await handlers.get('terminal:agentExit')!(null, {
    agentId: 'loki', terminalId: 't1', side: 'right',
    state: { speed: 2, dir: 1, intent: 'wander', bobPhase: 0, mind: { lastTier1At: 5, reflectionCounter: 1, perceptionQueue: [] } },
  });
  check('exit accepted', ok === true);
  const state = handlers.get('terminal:debugState')!(null) as { society: Record<string, string> };
  check('loki re-homed to the destination wing', state.society.loki === 'd1', state.society.loki);
  const cfg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf8')) as {
    society?: Record<string, string>;
  };
  check('re-home persisted to config', cfg.society?.loki === 'd1');
  check('persisted society keeps the others', cfg.society?.cat === 'd0');
}

// Opaque mind forwarding: the enter payload's state.mind round-trips deep-equal.
{
  const dest = FakeBrowserWindow.all /* the t2 window as the existing section resolves it */;
  // Reuse the existing "agentExit forwards state opaquely" pattern: find the
  // last terminal:agentEnter sent to t2 and deep-compare payload.state.mind:
  // check('mind forwarded opaquely', JSON.stringify(enterPayload.state.mind)
  //   === JSON.stringify({ lastTier1At: 5, reflectionCounter: 1, perceptionQueue: [] }));
}
```

Also add a SECOND broker boot in the same smoke (fresh tmp dir) that
pre-writes a config with a saved society including one dead wing, then
asserts restore + fallback:

```ts
// Saved homes are honored; a dead wing falls back to round-robin.
fs.writeFileSync(path.join(tmpDir2, 'config.json'), JSON.stringify({
  mode: 'window',
  terminals: [
    { id: 't1', wing: 'd0', x: 60, y: 160, width: 640, height: 520 },
    { id: 't2', wing: 'd1', x: 720, y: 160, width: 640, height: 520 },
  ],
  society: { loki: 'd1', archivist: 'd0', cat: 'd9', visitor: 'd1', ghost: 'd0' },
}));
// ...boot startTerminalsMode against tmpDir2, then:
check('saved home honored', society2.loki === 'd1' && society2.archivist === 'd0');
check('dead wing d9 falls back to round-robin', society2.cat === 'd0' || society2.cat === 'd1');
```

NOTE to implementer: the existing smoke already isolates userData via the
mocked `app.getPath` — follow the same mechanism for `tmpDir2` (a second
`mockElectronModule` cycle needs a fresh module-registry import of
`terminals.ts`; the file already demonstrates the import pattern. If a
second boot in one process proves brittle because of module-level state
in terminals.ts, put the restore/fallback assertions in a NEW smoke file
`scripts/smoke-t2-broker-homes.mts` that reuses the same fakes — the
substance of the assertions is what matters, not which file hosts them.)

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx scripts/smoke-t1-broker-handoff.mts`
Expected: FAIL — `terminal:getSociety` handler missing, `debugState.society` undefined.

- [ ] **Step 3: Implement**

`desktop/src/config.ts` — add to the interface, parse, and accessors:

```ts
export interface Config {
  mode: Mode;
  displayId?: number;
  terminals?: TerminalSlot[];
  /** T2 society — agentId → home wing. Written by terminals.ts on every
   *  roster change; wings (not terminalIds) are the stable identity. */
  society?: Record<string, string>;
}

function isSocietyRecord(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((w) => typeof w === 'string');
}
```

In `readConfig` (the parse is load-bearing — an unparsed field would be
erased by the next read-modify-write):

```ts
    const society = isSocietyRecord(cfg.society) ? cfg.society : undefined;
    return {
      mode: cfg.mode === 'wallpaper' ? 'wallpaper' : 'window',
      displayId: typeof cfg.displayId === 'number' ? cfg.displayId : undefined,
      ...(terminals.length > 0 ? { terminals } : {}),
      ...(society ? { society } : {}),
    };
```

```ts
export function getSociety(): Record<string, string> | undefined {
  return readConfig().society;
}

export function setSociety(society: Record<string, string> | undefined): void {
  const cfg = readConfig();
  if (!society || Object.keys(society).length === 0) delete cfg.society;
  else cfg.society = society;
  writeConfig(cfg);
}
```

`desktop/src/terminals.ts`:

```ts
import { getSociety, getTerminals, setSociety, setTerminals } from './config';

/** Cohort ids in COHORT order — literal mirror of src/agents/cohort.ts
 *  (desktop compiles separately; same convention as preload's
 *  TerminalBeingState mirror). */
const SOCIETY_IDS = ['loki', 'archivist', 'cat', 'visitor', 'ghost'];

/** agentId → home wing. Assigned at boot (saved society or round-robin
 *  over the desk's open wings), updated on every accepted crossing,
 *  persisted to config. Wings are the stable identity — terminal ids mint
 *  fresh every session. */
const homes = new Map<string, string>();

function assignHomes(saved: Record<string, string> | undefined, wings: readonly string[]): void {
  homes.clear();
  let rr = 0;
  for (const id of SOCIETY_IDS) {
    const w = saved?.[id];
    if (w && wings.includes(w)) homes.set(id, w);
    else homes.set(id, wings[rr++ % wings.length]);
  }
}

function persistSociety(): void {
  setSociety(Object.fromEntries(homes));
}
```

In `startTerminalsMode`, right after the `for (const s of slots) spawnTerminal(...)` loop:

```ts
  assignHomes(
    process.env.LOKILIBRARY_TERMINALS_RESET ? undefined : getSociety(),
    slots.map((s) => s.wing),
  );
  persistSociety();
```

In the `terminal:agentExit` handler, after `roster.set(payload.agentId, dest);`:

```ts
      // Society members re-home on a crossing (unknown/native ids don't).
      if (homes.has(payload.agentId)) {
        homes.set(payload.agentId, destTerm.wing);
        persistSociety();
      }
```

New IPC handle next to `terminal:getTopology`:

```ts
  // Society hydration: which cohort member lives on which wing.
  ipcMain.handle('terminal:getSociety', () => Object.fromEntries(homes));
```

Extend `terminal:debugState`:

```ts
  ipcMain.handle('terminal:debugState', () => ({
    bounds: allBounds(),
    joins,
    roster: Object.fromEntries(roster),
    society: Object.fromEntries(homes),
  }));
```

`desktop/src/preload.ts` — extend the `TerminalBeingState` mirror and the API:

```ts
export interface TerminalBeingState {
  speed: number;
  dir: 1 | -1;
  intent: string;
  bobPhase: number;
  /** T2 society — the mind half of a handoff (mirrors src/api/electron.ts). */
  mind?: {
    lastTier1At: number;
    reflectionCounter: number;
    perceptionQueue: Array<{ kind: string; subject?: string; at: { x: number; y: number }; when: number }>;
  };
}
```

```ts
  getTerminalSociety: () =>
    ipcRenderer.invoke('terminal:getSociety') as Promise<Record<string, string>>,
```

(add `getTerminalSociety(): Promise<Record<string, string>>;` to the
preload's ElectronAPI interface next to the getTopology entry.)

`src/api/electron.ts` — the same mirror on its `TerminalBeingState`, the
interface method, and a null-safe wrapper following `getTerminalTopology`'s
existing pattern:

```ts
/** T2 society — agentId → home wing, or null when no broker is attached
 *  (web preview): the caller treats null as "the lone land hosts everyone". */
export async function getTerminalSociety(): Promise<Record<string, string> | null> {
  const api = getElectronAPI();
  if (!api || typeof api.getTerminalSociety !== 'function') return null;
  try {
    return await api.getTerminalSociety();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx scripts/smoke-t1-broker-handoff.mts` → PASS.
Run: `npx tsx scripts/smoke-t3-desk.mts` → PASS (config read-modify-write must not strip `society`; if that smoke asserts exact config shape, extend it: write a society, `setTerminals`, assert society survived).
Run: `cd desktop && npx tsc --noEmit` and `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/config.ts desktop/src/terminals.ts desktop/src/preload.ts src/api/electron.ts scripts/smoke-t1-broker-handoff.mts
git commit -m "feat(desktop): broker owns society homes — round-robin assignment, re-home on crossing, config persistence, getSociety IPC

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: terminalLand migration — cohort bodies + minds

**Files:**
- Modify: `src/terminal/terminalLand.ts` (the bulk of the slice)
- Modify: `src/agents/behavior.ts` (narrow `tickPresence`'s ctx param — one line)
- Test: no new smoke (renderer glue; pure parts are Tasks 1–4) — gate is typecheck + FULL smoke sweep + Task 6's live run

**Interfaces:**
- Consumes: everything Tasks 1–4 produced, plus `COHORT`/`filterByTheme`/`AgentDef` (`src/agents/cohort.ts`), `tickPresence` (`src/agents/behavior.ts`), `routeTier1` (`src/agents/router.ts`), `theme.id` (already in scope).
- Produces: `window.__terminal.state().beings[]` entries gain `present: boolean`.

- [ ] **Step 1: Narrow `tickPresence` in `src/agents/behavior.ts`** — the land supplies only prngs; the cell's full `BehaviorContext` still satisfies the Pick:

```ts
export function tickPresence(
  def: AgentDef,
  runtime: AgentRuntimeState,
  ctx: Pick<BehaviorContext, 'prngs'>,
  mountedAt: number,
  nowMs: number,
): void {
```

Run: `npm run typecheck` → clean (cell call sites unaffected).

- [ ] **Step 2: Rewire `src/terminal/terminalLand.ts`.** The edits, in file order:

**(a) Imports** — add/extend:

```ts
import { COHORT, filterByTheme, type AgentDef } from '../agents/cohort';
import { tickPresence } from '../agents/behavior';
import { nullMemoryWriter, routeTier1 } from '../agents/router';
import type { AgentRuntimeState } from '../state/agentRuntime';
import {
  getTerminalSociety,
  // ...existing electron imports unchanged
} from '../api/electron';
import {
  beingAccentRole,
  DEFAULT_LAND_PERSONA,
  LAND_PERSONAS,
  landIntentFromTick,
  pickIntent,
  resumeIntent,
  structureColumns,
  type BeingIntent,
  type IntentContext,
  type LandPersona,
} from './beingIntents';
import {
  carriedFromMind,
  reconstructMind,
  residentsOf,
  sceneLabelFor,
} from './society';
```

**(b) Constants** — DELETE `BEINGS_PER_TERMINAL`, `BEING_GLYPHS`, and
`BEING_SPEED_CELLS_PER_S` (personas own speed now; `DEFAULT_LAND_PERSONA`
carries the old `[1.2, 2.6]` for unknown ids). Add:

```ts
const COHORT_BY_ID = new Map(COHORT.map((d) => [d.id, d]));
```

**(c) `Being` interface** — add two fields:

```ts
  /** The REAL agent runtime (initialRuntime-built) — the mind. routeTier1
   *  reads/mutates it directly; carried across seams via society.ts. */
  mind: AgentRuntimeState;
  /** Land personality (beingIntents.ts LAND_PERSONAS). Cached at spawn. */
  persona: LandPersona;
```

**(d) `TerminalLandState.beings`** — entries gain `present: boolean`.

**(e) `addBeing`** — glyph/tint/speed/mind become def-driven. New signature
`(id: string, x: number, dir: 1 | -1, entering = false)` (glyph derived).
Body changes:

```ts
  const addBeing = (id: string, x: number, dir: 1 | -1, entering = false): Being => {
    const def = COHORT_BY_ID.get(id);
    const persona = LAND_PERSONAS[id] ?? DEFAULT_LAND_PERSONA;
    const surfaceRow = model.surface[Math.round(x)] ?? 0;
    const text = new BitmapText({
      text: def?.glyph ?? 'V',
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        // Cohort members wear their REAL accent (the cell/ladder identity);
        // unknown ids keep the T0 hash-picked accent (defensive path).
        fill: def
          ? hexToInt(theme.palette[def.paletteKey])
          : hexToInt(theme.palette[roleKey(theme, beingAccentRole(id), 'fgBright')]),
      },
    });
    if (entering) text.alpha = 0;
    world.addChild(text);
    const being: Being = {
      id,
      glyph: def?.glyph ?? 'V',
      x,
      dir,
      speed: persona.speed[0] + rng() * (persona.speed[1] - persona.speed[0]),
      intent: pickIntent(rng, intentCtx(x), persona.bias),
      nextIntentAt: elapsedS + (INTENT_S[0] + rng() * INTENT_S[1]) * persona.intentWindowMult,
      pausedUntil: 0,
      crossCooldownUntil: 0,
      bobPhase: (fnv1a(id) % 628) / 100,
      lastCol: Math.round(x),
      text,
      pending: false,
      exitingSince: null,
      enteringSince: entering ? elapsedS : null,
      mind: reconstructMind(id, Math.round(x), surfaceRow),
      persona,
    };
    beings.set(id, being);
    return being;
  };
```

**(f) Boot spawn block** — replace the `for (let i = 0; i < BEINGS_PER_TERMINAL ...)` loop entirely:

```ts
  // Spawn this land's RESIDENTS — the cohort members whose home is this
  // wing (broker-owned homes; null society = web preview, everyone lives
  // here). filterByTheme keeps cell semantics: a theme-excluded agent
  // (Ghost outside tokyo-night/catppuccin) never spawns; its home persists
  // harmlessly. Roster refusal (renderer reload) → skip, as before.
  const mountedAtMs = Date.now();
  const presencePrngs = new Map<string, () => number>();
  void getTerminalSociety().then((society) => {
    const defs = filterByTheme(
      residentsOf(society, wing)
        .map((id) => COHORT_BY_ID.get(id))
        .filter((d): d is AgentDef => d !== undefined),
      theme.id,
    );
    defs.forEach((def, i) => {
      presencePrngs.set(def.id, makeRng(fnv1a(`presence:${def.id}:${terminalId}`)));
      void terminalAgentSpawn(def.id, terminalId).then((ok) => {
        if (!ok) return;
        const b = addBeing(def.id, 6 + ((i * 37) % (model.width - 12)), i % 2 === 0 ? 1 : -1);
        recordArrival(memory, {
          agentId: def.id,
          wing,
          col: Math.round(b.x),
          row: model.surface[Math.round(b.x)] ?? 0,
          whenMs: Date.now(),
        });
      });
    });
  });
```

**(g) `tryExit`** — the carried state gains the mind:

```ts
    const carried = {
      speed: b.speed,
      dir: b.dir,
      intent: b.intent.kind,
      bobPhase: b.bobPhase,
      mind: carriedFromMind(b.mind),
    };
```

**(h) Near-edge summary** — absent agents are invisible to neighbours.
In the `nearEdgeSummary(...)` call change the filter to
`.filter((b) => !b.pending && b.mind.present)`.

**(i) The per-being tick block** — three insertions inside
`for (const b of beings.values())`:

After the exit/enter juice blocks (so mid-handoff juice always finishes),
BEFORE `if (!b.pending) {`:

```ts
      // Presence dynamics (Visitor's cycle, Ghost's rare apparitions) —
      // tickPresence reuses the CELL's schedule rules on the real mind.
      // Absent: invisible, no walking, no crossings; the roster home holds.
      const def = COHORT_BY_ID.get(b.id);
      if (def && def.schedule.length > 0) {
        tickPresence(def, b.mind, { prngs: presencePrngs }, mountedAtMs, Date.now());
      }
      b.text.visible = b.mind.present;
      if (!b.mind.present) continue;
```

Inside the re-pick branch (`if (elapsedS >= b.nextIntentAt) {`), replace
the `pickIntent` call and window arithmetic with the persona-aware forms,
then add the Tier-1 pump:

```ts
        if (elapsedS >= b.nextIntentAt) {
          b.intent = pickIntent(rng, intentCtx(b.x), b.persona.bias);
          b.pausedUntil = elapsedS + HESITATE_S[0] + rng() * HESITATE_S[1];
          b.nextIntentAt = elapsedS + (INTENT_S[0] + rng() * INTENT_S[1]) * b.persona.intentWindowMult;

          // Tier-1 pump (arrival-driven): only arrivals queue events, so an
          // empty queue is the common free no-op. routeTier1 is UNCHANGED —
          // real def, real throttle (a throttled event drains on a later
          // re-pick), deny-verbs, telemetry, memory writes. Fire-and-forget:
          // the walker never blocks; a parseable `approach x,y` intent
          // steers, anything else is flavor (memory prose). Key-free rail:
          // transport failure logs + stamps throttle inside routeTier1.
          if (def && b.mind.perceptionQueue.length > 0) {
            void routeTier1(
              def,
              b.mind,
              sceneLabelFor(wing, model.width, structureCols),
              Date.now(),
              { memory },
            ).then((res) => {
              if (!res.tick) return;
              const li = landIntentFromTick(res.tick.intent, { width: model.width });
              if (li && beings.has(b.id)) {
                b.intent = li;
                b.nextIntentAt =
                  elapsedS + (INTENT_S[0] + rng() * INTENT_S[1]) * b.persona.intentWindowMult;
              }
            });
          }
        }
```

(`def` is the same const bound in the presence insertion above — one
lookup per being per frame.)

**(j) `agentEnter` handler** — cohort identity + mind reconstruction +
arrival perception; DELETE the glyph regex and the `recordArrival` call
(routeTier1's drain writes the arrival observation — same importance, 3,
via `importanceFor`'s default; `recordCrossing` stays):

```ts
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side, state, from }) => {
    if (beings.has(agentId)) return; // duplicate guard
    spawnSpark(side);
    const b = addBeing(agentId, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1, true);
    b.crossCooldownUntil = elapsedS + CROSS_COOLDOWN_S; // anti-ping-pong
    if (!presencePrngs.has(agentId)) {
      presencePrngs.set(agentId, makeRng(fnv1a(`presence:${agentId}:${terminalId}`)));
    }
    const surfaceRow = model.surface[Math.round(b.x)] ?? 0;
    if (state) {
      b.speed = state.speed;
      b.dir = state.dir;
      b.bobPhase = state.bobPhase;
      b.intent = resumeIntent(state.intent, side, intentCtx(b.x));
      if (state.mind) b.mind = reconstructMind(agentId, Math.round(b.x), surfaceRow, state.mind);
    }
    // The arrival is a PERCEPTION now — queued on the mind, drained (and
    // written to memory) by the next re-pick's routeTier1. recordArrival
    // is boot-spawn-only as of T2.
    b.mind.perceptionQueue.push({
      kind: 'terminal_arrival',
      subject: wing,
      at: { x: Math.round(b.x), y: surfaceRow },
      when: Date.now(),
    });
    recordCrossing(memory, {
      agentId,
      fromWing: from?.wing || '?',
      toWing: wing,
      col: Math.round(b.x),
      row: surfaceRow,
      whenMs: Date.now(),
    });
  });
```

**(k) `state()`** — the beings mapping adds `present: b.mind.present`.

**(l) Header docstring** — update the "Beings here are the spike's minimal
walker runtime" paragraph: the walkers are now the REAL cohort (defs,
accents, personas, presence) with real minds (routeTier1 on arrival,
key-free fallback); crossing handoffs carry the mind; homes live in the
broker.

- [ ] **Step 3: Typecheck + full smoke sweep**

Run: `npm run typecheck && (cd desktop && npx tsc --noEmit)`
Expected: clean.
Run: `for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: every smoke PASSES. Likely fallout to fix here (surgical, in
the failing smoke or the code — judge which is wrong):
- any smoke or e2e helper that assumed native ids (`t1-L0`-style) or the
  `BEING_GLYPHS`/`BEINGS_PER_TERMINAL` exports;
- `smoke-t0-topology` / `smoke-t1-cross-edge` drive pure modules and the
  broker — they should be unaffected, but the sweep is the proof.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/terminalLand.ts src/agents/behavior.ts
git commit -m "feat(terminal): the real cohort moves in — def-driven beings, real minds, Tier-1 on arrival, presence dynamics, mind handoff

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Live verification + docs (CLAUDE.md cost entry, STATE.md)

**Files:**
- Modify: `CLAUDE.md` (runtime-AI cost-model entry)
- Modify: `STATE.md` (present-tense entry)
- Modify: `scripts/e2e/t0-drive.mjs` usage docs IF its header still names native-id examples (verbs are id-agnostic; `place t1 loki 62 1` now)
- Test: live headless e2e on the real desktop app

**Interfaces:**
- Consumes: the shipped slice; `scripts/e2e/t0-drive.mjs` verbs (`state`/`place`/`waitcross`/`eval`); the launch recipe in `.claude/skills/launch-desktop-app`.

- [ ] **Step 1: Boot a fresh 2-terminal desk** (vite dev running on 5183; from `desktop/`):

```bash
LOKILIBRARY_TERMINALS=2 LOKILIBRARY_TERMINALS_RESET=1 \
LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
npx electron . --remote-debugging-port=9222
```

- [ ] **Step 2: Assert the society is home** (from REPO ROOT):

```bash
node scripts/e2e/t0-drive.mjs state
```

Expected: `roster` holds cohort ids only (`loki`, `archivist`, `cat`,
`visitor` — NO `ghost` under the default phosphor theme, NO `t1-…`
native ids); `society` round-robins d0/d1. Then per window:
`node scripts/e2e/t0-drive.mjs eval t1 "window.__terminal.state()"` —
beings carry `present: true` and cohort ids; glyphs L/A/c/V on screen
with distinct accents (screenshot via the drive's `shot` verb).

- [ ] **Step 3: Drive a crossing + verify the mind moved**

```bash
node scripts/e2e/t0-drive.mjs move t2 <abutting-x> <same-y>   # join the pair
node scripts/e2e/t0-drive.mjs place t1 loki 62 1
node scripts/e2e/t0-drive.mjs waitcross loki 30
```

Expected: loki appears in t2's `state()` with `present: true`; broker
`state` shows `society.loki === 'd1'`.

- [ ] **Step 4: Verify memory + Tier-1**

Query the desktop sqlite (path + query pattern per the Tier-1 society
plan's live verification, `docs/superpowers/plans/2026-07-16-tier1-living-society.md`):
a `terminal_crossing`-source row for loki exists (v3 token, not
`self_perception`); after the next re-pick (≤ ~10 s), either a Tier-1
telemetry row (worker + key present) or the `[router] tier1 loki failed:`
console line (key-free rail) — BOTH are passes; the walker kept walking
either way.

- [ ] **Step 5: Verify relaunch homes** — quit the app, relaunch WITHOUT
`LOKILIBRARY_TERMINALS_RESET`:

Expected: the desk restores AND `t0-drive state` shows loki still homed
on `d1` (the wing he crossed into), spawned in t2's land.

- [ ] **Step 6: CLAUDE.md cost-model entry** — in "Things to NOT do", the
runtime-AI rule's ledger currently reads "Phase 0 has exactly one runtime
AI call (Tier 1 agent tick). Phase 2 adds Tier 2 reflection." Extend that
sentence list with:

```
The T2 society migration (2026-07-17) adds ONE runtime AI call: Tier-1 on
terminal-land arrival — trigger: a seam-crossing arrival queues a
perception event, drained on the walker's re-pick cadence through the
UNCHANGED routeTier1 (per-agent tier1ThrottleMs 30–120 s). Cost: bounded
by the crossing rate — a few Haiku calls/hour on an active desk, zero
idle, zero key-free. Caching: none (each call is a fresh perception).
Fallback: the pure land intent engine; transport failure stamps the
throttle and the walker never blocks. Telemetry: existing logTier1 rows.
```

- [ ] **Step 7: STATE.md present-tense entry** — add a dated
"**T2 society migration SHIPPED 2026-07-17**" block at the top of the
narrative section, in the established style: what moved in (cohort defs +
accents, personas + presence via tickPresence/filterByTheme, real minds +
routeTier1 arrival dispatch + the approach-x,y steering channel, schema
v3 tokens, CarriedMind over IPC, broker homes + config society), what was
VERIFIED ON SCREEN (the Step 2–5 evidence), smoke counts, and the
DEFERRED list (Tier-2/topology reflection = T4; marginalia on land;
launcher beat).

- [ ] **Step 8: Final sweep + commit**

```bash
npm run typecheck && (cd desktop && npx tsc --noEmit)
for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done
git add CLAUDE.md STATE.md scripts/e2e/t0-drive.mjs
git commit -m "docs(state): T2 society migration shipped — cohort lives on the desk; CLAUDE.md runtime-AI ledger entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review record

- **Spec coverage:** §1 population/homes → Tasks 4 (broker) + 5(f) (spawn); §2 personality/presence → Tasks 1 + 5(i); §3 mind wiring → Tasks 3 + 5(e,i,j), cost entry Task 6; §4 handoff/schema → Tasks 2 + 4 (mirrors) + 5(g,j); §5 persistence → Task 4; verification list → Tasks 1–4 smokes + Task 6 live. Spec's "RuntimeScope" wording implemented as `Being.mind` (real `AgentRuntimeState` via `initialRuntime` — the substantive requirement); deviation recorded in the header.
- **Known-behavior notes (not bugs):** Ghost absent on the default phosphor desk (theme gate, cell parity); a window closed mid-session takes its residents until the next boot's fallback re-homes them; the `schema_version` table accumulates one row per version (existing pattern).
- **Type consistency:** `CarriedMind` (Task 3) = `TerminalBeingState.mind` mirrors (Task 4) = `carriedFromMind`/`reconstructMind` call sites (Task 5). `pickIntent(rand, ctx, bias?)` (Task 1) = Task 5 call sites. `getTerminalSociety(): Promise<Record<string,string> | null>` (Task 4) = Task 5(f).
