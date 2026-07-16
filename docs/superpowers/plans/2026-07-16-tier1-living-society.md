# Tier 1 — The Living Society: land agents with intent, memory, and cross-window perception

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the T0 spike's flip-wander walkers with a real land agent runtime: beings pick seeded Tier-0 intents (wander / rest / approach-a-structure / watch-the-edge), carry their runtime state across window handoffs so they *resume* rather than respawn, write crossings + arrivals into the Smallville memory stream (record only — no LLM dispatch), and perceive the joined neighbour's near-edge beings so the society gravitates toward open joins.

**Architecture:** A pure intent engine (`src/terminal/beingIntents.ts`, the 1-D land port of `behavior.ts`'s utility-AI candidate scoring) drives the walker in `terminalLand.ts` off the existing `makeRng` stream. The `terminal:agentExit` IPC payload gains an opaque runtime-state blob the broker forwards verbatim in `terminal:agentEnter` (plus `from: {terminalId, wing}`), so the arrival side resumes speed/dir/intent/bob and can record "crossed from d0 into d1" through the desktop `MemoryWriter` (null writer on web). Cross-edge perception is the 1-D `enrichSnapshotAcrossSeams` idea: each renderer reports a change-gated ≤1 Hz near-edge summary; the broker relays it to the joined neighbour with the side flipped; a non-empty summary is a decisive `watch_edge` score bonus.

**Tech Stack:** TypeScript, PixiJS v8 (BitmapText), Electron (main-process broker + preload IPC), better-sqlite3 memory store (WAL), `tsx` smokes via `scripts/lib/smoke.ts` (+ `mockElectronModule` for the broker).

## Global Constraints

- **Assumes Tier 0 (join-moment plan) is DONE.** All `terminalLand.ts` anchors below reference the post-join-moment file: `let model`, `recompose`, `applyJoins(joins, wings)`, `composeOpts`, knit sweep, frameless `TerminalApp.tsx`.
- **Determinism:** nothing here touches `src/procedural/` behaviour. Runtime wander/juice keeps the local `makeRng` pattern (no `Math.random`); the intent engine is a pure function of `(rand, ctx)`. `Date.now()` appears ONLY as memory-row timestamps (the existing `writer.ts` precedent), never in animation or layout.
- **All animation rides `app.ticker.deltaMS`** — the 1 Hz near-edge report and intent re-picks ride `elapsedS` (ticker-accumulated), never a wall clock, so they freeze cleanly under throttle.
- **NO LLM / API-key / network dependency.** Memory is record-only: crossings and arrivals become `observation` rows via the local sqlite `MemoryWriter`. `routeTier1`/`routeTier2` are never called. (PRD-T2's "Tier-1 perception fires on arrival" is deliberately deferred — see Deferred.)
- **No new ObservationSource token.** `schema.ts` documents extending `ObservationSource` as a schema-version bump + migration; the new event kinds (`terminal_crossing` / `terminal_arrival`) map to the existing `'self_perception'` source, with the semantics preserved in row text + subject. Additive-safe, zero migration.
- **No new glyphs.** Beings keep `L A M C V`; edges/sparks unchanged — `scripts/smoke-glyph-coverage.mts` needs no edit. The `→` in a crossing *subject* is stored text, never rendered by PIXI.
- **IPC chatter bounded:** near-edge reports are ≤1 Hz AND change-gated (fire-and-forget `ipcRenderer.send`, no ack); summaries capped at 4 beings/side.
- **Verification floor per task:** `npm run typecheck` (repo root) **and** `npm --prefix desktop run build`, plus the task's smoke(s), plus a git commit. Final task runs the full smoke sweep and the live T0 harness.
- **Stale-preload degradation:** every new bridge call keeps the `typeof api.x !== 'function'` guard idiom from `src/api/electron.ts` — an old preload silently drops state/perception (fresh-spawn fallback) instead of throwing.

---

### Task 1: The pure intent engine + TDD smoke

The substance of (a): score-based intent picking, land-local and 1-D, mirroring `src/agents/behavior.ts`'s candidate ladder. Pure — fully TDD'd headlessly. Also home to `structureColumns` (labelled-structure targets from `LandModel.role`) and `resumeIntent` (Task 3's handoff continuation).

**Files:**
- Create: `src/terminal/beingIntents.ts`
- Create: `scripts/smoke-t1-being-intents.mts`

**Interfaces:**
- Produces: `type BeingIntent = {kind:'wander';dir:1|-1} | {kind:'rest'} | {kind:'approach';targetX:number} | {kind:'watch_edge';side:'left'|'right'}` · `interface IntentContext { width; x; structureCols; edges; neighbourNear }` · `pickIntent(rand: () => number, ctx: IntentContext): BeingIntent` · `resumeIntent(kind: string, entrySide: 'left'|'right', ctx: IntentContext): BeingIntent` · `structureColumns(role: ReadonlyArray<ReadonlyArray<LandRole>>): number[]`
- Consumes: `type LandRole` from `src/procedural/land.ts` (type-only).

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-t1-being-intents.mts`:

```ts
/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-being-intents.mts`.
 * Locks the pure intent engine (src/terminal/beingIntents.ts):
 *   - pickIntent is pure: same rand stream + ctx → same pick sequence
 *   - watch_edge candidates exist only for OPEN edges
 *   - a non-empty neighbour summary is DECISIVE (society gravity)
 *   - approach only fires when structures exist; targets are structure cols
 *   - structureColumns finds label-run centres (incl. on a real composeLand)
 *   - resumeIntent: inward dir, chain continuation, graceful decay
 */
import { makeChecker } from './lib/smoke.ts';
import {
  pickIntent,
  resumeIntent,
  structureColumns,
  type IntentContext,
} from '../src/terminal/beingIntents.ts';
import { composeLand, SAMPLE_LAND, type LandRole } from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke t1-being-intents');

/** Local copy of terminalLand's makeRng — the runtime stream the engine is fed. */
const makeRng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const baseCtx = (over: Partial<IntentContext> = {}): IntentContext => ({
  width: 60,
  x: 30,
  structureCols: [12, 40],
  edges: { left: false, right: false },
  neighbourNear: { left: 0, right: 0 },
  ...over,
});

const picks = (seed: number, ctx: IntentContext, n: number) => {
  const r = makeRng(seed);
  return Array.from({ length: n }, () => pickIntent(r, ctx));
};

// 1 · purity + determinism
check('same stream → same picks',
  JSON.stringify(picks(7, baseCtx(), 50)) === JSON.stringify(picks(7, baseCtx(), 50)));
check('different stream → different picks',
  JSON.stringify(picks(7, baseCtx(), 50)) !== JSON.stringify(picks(8, baseCtx(), 50)));

// 2 · closed edges never produce watch_edge
check('no watch_edge on closed edges',
  picks(3, baseCtx(), 200).every((i) => i.kind !== 'watch_edge'));

// 3 · open edge → watch_edge occurs, on the open side only; variety survives
const openPicks = picks(3, baseCtx({ edges: { left: false, right: true } }), 400);
check('open edge → watch_edge occurs', openPicks.some((i) => i.kind === 'watch_edge'));
check('watch_edge targets the open side only',
  openPicks.every((i) => i.kind !== 'watch_edge' || i.side === 'right'));
const kinds = new Set(openPicks.map((i) => i.kind));
check('variety: all four intent kinds occur',
  (['wander', 'rest', 'approach', 'watch_edge'] as const).every((k) => kinds.has(k)));

// 4 · a non-empty neighbour summary is decisive (min pulled score 0.75 ≥ every
//     other candidate's sup — see the scoring-ladder comment in the module)
const pulled = picks(3, baseCtx({ edges: { left: false, right: true }, neighbourNear: { left: 0, right: 2 } }), 200);
check('neighbour beings → watch_edge always wins',
  pulled.every((i) => i.kind === 'watch_edge' && i.side === 'right'));

// 5 · approach gating + targets
check('no approach without structures',
  picks(5, baseCtx({ structureCols: [] }), 200).every((i) => i.kind !== 'approach'));
check('approach targets are structure cols',
  picks(5, baseCtx(), 400).every((i) => i.kind !== 'approach' || [12, 40].includes(i.targetX)));

// 6 · structureColumns
const grid: LandRole[][] = Array.from({ length: 4 }, () => Array.from({ length: 20 }, () => 'sky' as LandRole));
for (let x = 3; x <= 7; x++) grid[1][x] = 'label';   // centre 5
for (let x = 14; x <= 16; x++) grid[2][x] = 'label'; // centre 15
check('structureColumns finds run centres', JSON.stringify(structureColumns(grid)) === JSON.stringify([5, 15]));
check('structureColumns empty grid → []', structureColumns([]).length === 0);
const model = composeLand(0xbeef, SAMPLE_LAND.slice(0, 5), { width: 60, skyH: 6, surfaceBand: 4, underH: 10, withPlayer: false });
check('real land has >=1 labelled structure column', structureColumns(model.role).length >= 1);

// 7 · resumeIntent (Task 3 consumes this at agentEnter)
const rctx = baseCtx({ edges: { left: true, right: true } });
check('wander resumes inward (enter left → dir 1)',
  JSON.stringify(resumeIntent('wander', 'left', rctx)) === JSON.stringify({ kind: 'wander', dir: 1 }));
check('rest resumes as rest', resumeIntent('rest', 'right', rctx).kind === 'rest');
const ra = resumeIntent('approach', 'left', rctx);
check('approach re-targets the structure nearest the entry', ra.kind === 'approach' && ra.targetX === 12);
check('approach with no structures decays to inward wander',
  JSON.stringify(resumeIntent('approach', 'right', baseCtx({ structureCols: [] }))) === JSON.stringify({ kind: 'wander', dir: -1 }));
const rw = resumeIntent('watch_edge', 'left', rctx);
check('watch_edge continues to the far side of a chain', rw.kind === 'watch_edge' && rw.side === 'right');
check('watch_edge decays to inward wander when the far side is closed',
  JSON.stringify(resumeIntent('watch_edge', 'left', baseCtx())) === JSON.stringify({ kind: 'wander', dir: 1 }));
check('unknown kind decays to inward wander',
  JSON.stringify(resumeIntent('???', 'right', rctx)) === JSON.stringify({ kind: 'wander', dir: -1 }));

// 8 · ctx is never mutated (frozen ctx would throw in strict mode)
const frozen = Object.freeze(baseCtx());
pickIntent(makeRng(1), frozen);
check('pickIntent leaves ctx untouched (frozen ctx, no throw)', true);

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-t1-being-intents.mts`
Expected: FAIL — `src/terminal/beingIntents.ts` does not exist (module-not-found).

- [ ] **Step 3: Create the module**

Create `src/terminal/beingIntents.ts`:

```ts
/**
 * Tier-1 "living society" — the pure intent engine for terminal-land
 * beings (docs/PRD-snapping-terminals.md §T2, adapted to the T0 land).
 *
 * Score-based pick mirroring src/agents/behavior.ts's utility-AI shape,
 * but land-local and 1-D: each re-pick builds a candidate list, jitters
 * scores with the injected rand, and takes the max (ties break by
 * insertion order — earlier = preferred, the behavior.ts discipline).
 * NO PIXI, NO IPC, NO wall clock: a pure function of (rand, ctx), so the
 * smoke drives it headlessly and the renderer's makeRng stream keeps the
 * runtime deterministic-enough per terminal (the T0 walker contract).
 *
 * Scoring ladder — base + jitter [0, 0.3):
 *   watch_edge  0.5  (+0.25 DECISIVE pull when the neighbour summary
 *               shows beings near the far side: pulled min 0.75 ≥ every
 *               other candidate's sup, so society gravity always wins)
 *   approach    0.45 (labelled structure columns only)  → sup 0.75
 *   wander      0.4  (baseline, always available)       → sup 0.7
 *   rest        0.2  (always available)                 → sup 0.5
 * The un-pulled ranges overlap deliberately: every kind occurs, the
 * ladder only orders expectations.
 */

import type { LandRole } from '../procedural/land';

export type BeingIntent =
  | { kind: 'wander'; dir: 1 | -1 }
  | { kind: 'rest' }
  | { kind: 'approach'; targetX: number }
  | { kind: 'watch_edge'; side: 'left' | 'right' };

export type BeingIntentKind = BeingIntent['kind'];

export interface IntentContext {
  /** Land width in cells. */
  readonly width: number;
  /** The being's current column (float). */
  readonly x: number;
  /** Centre columns of labelled structures (structureColumns()). */
  readonly structureCols: readonly number[];
  /** Which edges are OPEN (joined to a neighbour terminal). */
  readonly edges: { readonly left: boolean; readonly right: boolean };
  /** How many beings the joined neighbour reported near each shared
   *  edge (0 when closed / empty). Counts are enough — the pull is
   *  about "something is over there", not positions. */
  readonly neighbourNear: { readonly left: number; readonly right: number };
}

interface Scored {
  score: number;
  intent: BeingIntent;
}

/** One BT pick. Pure: same rand draws + ctx → same intent. */
export function pickIntent(rand: () => number, ctx: IntentContext): BeingIntent {
  const candidates: Scored[] = [];
  candidates.push({
    score: 0.4 + rand() * 0.3,
    intent: { kind: 'wander', dir: rand() < 0.5 ? 1 : -1 },
  });
  candidates.push({ score: 0.2 + rand() * 0.3, intent: { kind: 'rest' } });
  if (ctx.structureCols.length > 0) {
    const idx = Math.min(ctx.structureCols.length - 1, Math.floor(rand() * ctx.structureCols.length));
    candidates.push({
      score: 0.45 + rand() * 0.3,
      intent: { kind: 'approach', targetX: ctx.structureCols[idx] },
    });
  }
  for (const side of ['left', 'right'] as const) {
    if (!ctx.edges[side]) continue;
    const pull = ctx.neighbourNear[side] > 0 ? 0.25 : 0;
    candidates.push({
      score: 0.5 + pull + rand() * 0.3,
      intent: { kind: 'watch_edge', side },
    });
  }
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].score > best.score) best = candidates[i];
  }
  return best.intent;
}

/**
 * Resume a handed-off intent on the ARRIVAL side (Task 3's agentEnter).
 * Pure. The old land's coordinates are meaningless here, so `approach`
 * re-targets the structure nearest the entry edge; `watch_edge`
 * continues to the FAR side when it's open (the being is walking a
 * chain) and decays to an inward wander otherwise. `kind` arrives as a
 * broker-opaque string — unknown values decay to wander.
 */
export function resumeIntent(
  kind: string,
  entrySide: 'left' | 'right',
  ctx: IntentContext,
): BeingIntent {
  const inward: 1 | -1 = entrySide === 'left' ? 1 : -1;
  const farSide = entrySide === 'left' ? 'right' : 'left';
  switch (kind) {
    case 'rest':
      return { kind: 'rest' };
    case 'approach': {
      if (ctx.structureCols.length > 0) {
        const entryX = entrySide === 'left' ? 0 : ctx.width - 1;
        let best = ctx.structureCols[0];
        for (const c of ctx.structureCols) {
          if (Math.abs(c - entryX) < Math.abs(best - entryX)) best = c;
        }
        return { kind: 'approach', targetX: best };
      }
      return { kind: 'wander', dir: inward };
    }
    case 'watch_edge':
      if (ctx.edges[farSide]) return { kind: 'watch_edge', side: farSide };
      return { kind: 'wander', dir: inward };
    default:
      return { kind: 'wander', dir: inward };
  }
}

/**
 * Centre columns of the land's labelled structures — one entry per
 * horizontal 'label' run in LandModel.role, sorted, deduped within 3
 * cells (a structure may carry stacked labels). Pure projection; the
 * walker uses these as approach targets so "walk to a structure and
 * linger" reads against something with a name.
 */
export function structureColumns(role: ReadonlyArray<ReadonlyArray<LandRole>>): number[] {
  const centres: number[] = [];
  for (let y = 0; y < role.length; y++) {
    const row = role[y];
    let runStart = -1;
    for (let x = 0; x <= row.length; x++) {
      const isLabel = x < row.length && row[x] === 'label';
      if (isLabel && runStart < 0) runStart = x;
      if (!isLabel && runStart >= 0) {
        centres.push(Math.round((runStart + x - 1) / 2));
        runStart = -1;
      }
    }
  }
  centres.sort((a, b) => a - b);
  const out: number[] = [];
  for (const c of centres) {
    if (out.length === 0 || c - out[out.length - 1] > 3) out.push(c);
  }
  return out;
}
```

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-t1-being-intents.mts`
Expected: `[smoke t1-being-intents] 22 assertions passed`

- [ ] **Step 5: Typecheck both legs**

Run: `npm run typecheck && npm --prefix desktop run build`
Expected: both clean (new module has no consumers yet).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/beingIntents.ts scripts/smoke-t1-being-intents.mts
git commit -m "feat(terminals): pure Tier-0 intent engine for land beings (TDD)"
```

---

### Task 2: Wire the intent runtime into the terminal walker

Replace the spike's flip-wander with the intent engine: beings approach labelled structures and linger, rest, and drift toward open edges. `window.__terminal.state()` exposes each being's intent for the e2e harness.

**Files:**
- Modify: `src/terminal/terminalLand.ts` (knobs, `Being`, `TerminalLandState`, imports, `structureCols` + `intentCtx`, `addBeing`, tick walking block, `debugPlace`, `state()`, `recompose`)

**Interfaces:**
- Consumes: `pickIntent`, `structureColumns`, `type BeingIntent`, `type IntentContext` (Task 1).
- Produces: `TerminalLandState.beings[].intent: string` (e2e-visible, additive).

- [ ] **Step 1: Swap the knobs**

In `terminalLand.ts`, replace the three lines from `/** Mean seconds between wander direction flips. */` through the `HESITATE_S` declaration with:

```ts
/** Intent re-pick window (min + seeded extra, seconds). */
const INTENT_S: [number, number] = [6, 6];
/** Hesitation beat at each re-pick (min + seeded extra, seconds). */
const HESITATE_S: [number, number] = [0.3, 0.5];
/** approach: linger radius (cells) around the structure column. */
const APPROACH_NEAR = 0.4;
/** watch_edge: within this many cells of the open edge, drift slowly. */
const WATCH_NEAR = 3;
/** Speed multiplier while drifting at a watched edge. */
const WATCH_DRIFT = 0.4;
/** Anti-ping-pong: seconds after entering before a being may exit again
 *  (the 7D.2 cooldown idea, ported to the land handoff). */
const CROSS_COOLDOWN_S = 4;
```

Add the import after the `../api/electron` import block:

```ts
import {
  pickIntent,
  structureColumns,
  type BeingIntent,
  type IntentContext,
} from './beingIntents';
```

- [ ] **Step 2: Rework `Being` + `TerminalLandState`**

Replace the `Being` interface with:

```ts
interface Being {
  id: string;
  glyph: string;
  x: number; // cells, float
  dir: 1 | -1;
  speed: number; // cells/sec
  /** Current Tier-0 intent (beingIntents.ts) + the BT re-pick clock. */
  intent: BeingIntent;
  nextIntentAt: number; // elapsed-seconds timestamp
  pausedUntil: number; // hesitation beat after a re-pick
  /** Anti-ping-pong: a just-entered being may not exit until this. */
  crossCooldownUntil: number;
  bobPhase: number;
  text: BitmapText;
  /** Mid-handoff: walking stops until the broker acks. */
  pending: boolean;
  /** Exit/enter juice state (progress driven by elapsedS). */
  exitingSince: number | null;
  enteringSince: number | null;
}
```

Replace `TerminalLandState` with:

```ts
export interface TerminalLandState {
  terminalId: string;
  wing: string;
  edges: { left: boolean; right: boolean };
  beings: Array<{ id: string; x: number; dir: number; intent: string }>;
}
```

- [ ] **Step 3: Structure targets + the intent context**

Right after the `recompose` function definition, add:

```ts
  // Approach targets: the labelled structure columns of the CURRENT model.
  let structureCols = structureColumns(model.role);

  /** Live context for a BT pick. neighbourNear stays 0 until cross-edge
   *  perception (Tier-1 Task 5) feeds the joined neighbour's summary. */
  const intentCtx = (x: number): IntentContext => ({
    width: model.width,
    x,
    structureCols,
    edges,
    neighbourNear: { left: 0, right: 0 },
  });
```

Inside `recompose`, after `layoutWorld();`, add:

```ts
    structureCols = structureColumns(model.role);
```

- [ ] **Step 4: `addBeing` picks an intent**

In the `addBeing` object literal, replace the `nextFlipAt` line with:

```ts
      intent: pickIntent(rng, intentCtx(x)),
      nextIntentAt: elapsedS + INTENT_S[0] + rng() * INTENT_S[1],
      crossCooldownUntil: 0,
```

- [ ] **Step 5: The intent-driven walking block**

In `tick()`, replace the whole `if (!b.pending) { … }` block (the flip/hesitate/edge logic) with:

```ts
      if (!b.pending) {
        // BT re-pick on cadence (or forced when an intent invalidates).
        if (elapsedS >= b.nextIntentAt) {
          b.intent = pickIntent(rng, intentCtx(b.x));
          b.pausedUntil = elapsedS + HESITATE_S[0] + rng() * HESITATE_S[1];
          b.nextIntentAt = elapsedS + INTENT_S[0] + rng() * INTENT_S[1];
        }

        // Intent → this frame's signed velocity (cells/sec).
        let vel = 0;
        const it = b.intent;
        if (it.kind === 'wander') {
          b.dir = it.dir;
          vel = b.dir * b.speed;
        } else if (it.kind === 'approach') {
          if (Math.abs(b.x - it.targetX) > APPROACH_NEAR) {
            b.dir = b.x < it.targetX ? 1 : -1;
            vel = b.dir * b.speed;
          } // else linger at the structure: stand, keep bobbing
        } else if (it.kind === 'watch_edge') {
          if (!edges[it.side]) {
            b.nextIntentAt = elapsedS; // edge closed under us — re-pick next frame
          } else {
            const edgeX = it.side === 'left' ? 0 : model.width - 1;
            b.dir = it.side === 'left' ? -1 : 1;
            const near = Math.abs(b.x - edgeX) <= WATCH_NEAR;
            vel = b.dir * b.speed * (near ? WATCH_DRIFT : 1);
          }
        } // rest: vel stays 0

        if (elapsedS >= b.pausedUntil) b.x += vel * dt;

        if (b.x <= 0) {
          if (edges.left && elapsedS >= b.crossCooldownUntil) {
            tryExit(b, 'left');
          } else {
            b.x = 0;
            b.dir = 1;
            if (b.intent.kind === 'wander') b.intent = { kind: 'wander', dir: 1 };
            else b.nextIntentAt = elapsedS; // bounced — re-pick
          }
        } else if (b.x >= model.width - 1) {
          if (edges.right && elapsedS >= b.crossCooldownUntil) {
            tryExit(b, 'right');
          } else {
            b.x = model.width - 1;
            b.dir = -1;
            if (b.intent.kind === 'wander') b.intent = { kind: 'wander', dir: -1 };
            else b.nextIntentAt = elapsedS;
          }
        }
      }
```

- [ ] **Step 6: e2e surface — `state()` + `debugPlace`**

Replace the `window.__terminal` assignment with:

```ts
  window.__terminal = {
    state: () => ({
      terminalId,
      wing,
      edges: { ...edges },
      beings: [...beings.values()].map((b) => ({
        id: b.id,
        x: Math.round(b.x * 10) / 10,
        dir: b.dir,
        intent: b.intent.kind,
      })),
    }),
    debugPlace: (id, x, dir) => {
      const b = beings.get(id);
      if (!b || b.pending) return false;
      b.x = Math.min(model.width - 1, Math.max(0, x));
      b.dir = dir;
      b.intent = { kind: 'wander', dir };
      b.pausedUntil = 0;
      b.crossCooldownUntil = 0;
      b.nextIntentAt = elapsedS + 30; // hold course long enough to cross
      return true;
    },
  };
```

- [ ] **Step 7: Typecheck + regression smokes**

Run: `npm run typecheck && npm --prefix desktop run build && npx tsx scripts/smoke-t1-being-intents.mts && npx tsx scripts/smoke-land-seam.mts`
Expected: all clean/green.

- [ ] **Step 8: On-screen verification (macOS)**

```bash
npm run dev > /tmp/loki-vite.log 2>&1 &   # if not already serving
npm --prefix desktop run build
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-electron-t0.log 2>&1 & )
sleep 6
node scripts/e2e/t0-drive.mjs state
sleep 30
node scripts/e2e/t0-drive.mjs state
node scripts/e2e/t0-drive.mjs shot /tmp/loki-t1/intents.png
```

Expected: every being carries an `intent` field; across the two states intents change kinds; with the windows joined, some beings show `watch_edge`; an `approach` being sits at/near a labelled structure column in the shot.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/terminalLand.ts
git commit -m "feat(terminals): intent-driven land beings (approach/rest/watch-the-edge)"
```

---

### Task 3: State-carrying handoff — beings resume, not respawn

(b) end-to-end: `terminal:agentExit` carries `{speed, dir, intent, bobPhase}`; the broker forwards it opaquely (plus `from: {terminalId, wing}` — Task 4's crossing text needs the source wing) in `terminal:agentEnter`. Broker smoke locks roster uniqueness + the opaque round-trip.

**Files:**
- Modify: `desktop/src/preload.ts` (`TerminalBeingState`, `terminalAgentExit`, `onTerminalAgentEnter`)
- Modify: `desktop/src/terminals.ts` (agentExit payload + forward)
- Modify: `src/api/electron.ts` (mirror types + helpers)
- Modify: `src/terminal/terminalLand.ts` (`tryExit` carries state; enter handler resumes via `resumeIntent`)
- Create: `scripts/smoke-t1-broker-handoff.mts`

**Interfaces:**
- Produces: `interface TerminalBeingState { speed: number; dir: 1|-1; intent: string; bobPhase: number }` (mirrored in preload + api/electron) · exit payload `{agentId, terminalId, side, state}` · enter event `{agentId, side, state?, from?: {terminalId, wing}}`.
- Consumes: `resumeIntent` (Task 1).

- [ ] **Step 1: Preload types + impl**

In `desktop/src/preload.ts`, add below the `TerminalJoin` interface:

```ts
/** Runtime state carried across a handoff so the being RESUMES in the
 *  neighbour rather than respawning fresh. Broker-opaque: the main
 *  process forwards it verbatim, renderers own the shape. */
export interface TerminalBeingState {
  speed: number;
  dir: 1 | -1;
  intent: string;
  bobPhase: number;
}
```

In the `ElectronAPI` interface, replace the `terminalAgentExit` and `onTerminalAgentEnter` declarations with:

```ts
  /** A being walked off an open edge, carrying its runtime state. True =
   *  the neighbour accepted it (despawn locally); false = refused. */
  terminalAgentExit(
    agentId: string,
    terminalId: string,
    side: 'left' | 'right',
    state: TerminalBeingState,
  ): Promise<boolean>;
  /** A being handed over by the broker arrives at `side`, with its
   *  carried state and the source terminal/wing. */
  onTerminalAgentEnter(
    cb: (event: {
      agentId: string;
      side: 'left' | 'right';
      state?: TerminalBeingState;
      from?: { terminalId: string; wing: string };
    }) => void,
  ): () => void;
```

In the implementation object, replace the two matching entries with:

```ts
  terminalAgentExit: (agentId, terminalId, side, state) =>
    ipcRenderer.invoke('terminal:agentExit', { agentId, terminalId, side, state }) as Promise<boolean>,
  onTerminalAgentEnter: (cb) => {
    const handler = (
      _e: IpcRendererEvent,
      event: {
        agentId: string;
        side: 'left' | 'right';
        state?: TerminalBeingState;
        from?: { terminalId: string; wing: string };
      },
    ): void => cb(event);
    ipcRenderer.on('terminal:agentEnter', handler);
    return () => ipcRenderer.off('terminal:agentEnter', handler);
  },
```

- [ ] **Step 2: Broker forwards opaquely**

In `desktop/src/terminals.ts`, replace the whole `ipcMain.handle('terminal:agentExit', …)` registration with:

```ts
  // A being walked off an open edge. Validate the join + ownership, move it
  // in the roster, and hand it to the neighbour WITH its runtime state
  // (forwarded opaquely — renderers own the shape) and the source wing (the
  // arrival side's memory write names it). Ack=false → renderer keeps the
  // being (turn it around) rather than losing it.
  ipcMain.handle(
    'terminal:agentExit',
    (
      _e,
      payload: {
        agentId: string;
        terminalId: string;
        side: 'left' | 'right';
        state?: unknown;
      },
    ) => {
      const dest = neighbourOf(payload.terminalId, payload.side, joins);
      if (!dest || roster.get(payload.agentId) !== payload.terminalId) return false;
      const destTerm = terminals.get(dest);
      if (!destTerm || destTerm.win.isDestroyed()) return false;
      const src = terminals.get(payload.terminalId);
      roster.set(payload.agentId, dest);
      destTerm.win.webContents.send('terminal:agentEnter', {
        agentId: payload.agentId,
        side: payload.side === 'left' ? 'right' : 'left', // enters the opposite edge
        state: payload.state,
        from: { terminalId: payload.terminalId, wing: src?.wing ?? '' },
      });
      // eslint-disable-next-line no-console
      console.log(`[terminals] ${payload.agentId}: ${payload.terminalId} → ${dest}`);
      return true;
    },
  );
```

- [ ] **Step 3: Client API mirror**

In `src/api/electron.ts`, add below the `TerminalJoin` interface:

```ts
/** Tier-1 society — runtime state carried across a handoff (mirrors
 *  desktop/src/preload.ts; broker-opaque). */
export interface TerminalBeingState {
  speed: number;
  dir: 1 | -1;
  intent: string;
  bobPhase: number;
}
```

In the `ElectronAPI` interface, replace the two terminal lines with:

```ts
  terminalAgentExit(
    agentId: string,
    terminalId: string,
    side: 'left' | 'right',
    state: TerminalBeingState,
  ): Promise<boolean>;
  onTerminalAgentEnter(
    cb: (event: {
      agentId: string;
      side: 'left' | 'right';
      state?: TerminalBeingState;
      from?: { terminalId: string; wing: string };
    }) => void,
  ): () => void;
```

Replace the `terminalAgentExit` helper with:

```ts
export async function terminalAgentExit(
  agentId: string,
  terminalId: string,
  side: 'left' | 'right',
  state: TerminalBeingState,
): Promise<boolean> {
  const api = getElectronAPI();
  if (!api || typeof api.terminalAgentExit !== 'function') return false;
  try {
    return await api.terminalAgentExit(agentId, terminalId, side, state);
  } catch {
    return false;
  }
}
```

Replace `subscribeTerminalAgentEnter` with:

```ts
export function subscribeTerminalAgentEnter(
  cb: (event: {
    agentId: string;
    side: 'left' | 'right';
    state?: TerminalBeingState;
    from?: { terminalId: string; wing: string };
  }) => void,
): () => void {
  const api = getElectronAPI();
  if (!api || typeof api.onTerminalAgentEnter !== 'function') return () => undefined;
  return api.onTerminalAgentEnter(cb);
}
```

- [ ] **Step 4: Renderer carries + resumes**

In `src/terminal/terminalLand.ts`, extend the `./beingIntents` import to include `resumeIntent`. Replace `tryExit` with:

```ts
  const tryExit = (b: Being, side: 'left' | 'right'): void => {
    b.pending = true;
    const carried = { speed: b.speed, dir: b.dir, intent: b.intent.kind, bobPhase: b.bobPhase };
    void terminalAgentExit(b.id, terminalId, side, carried).then((accepted) => {
      if (accepted) {
        b.exitingSince = elapsedS; // ease out past the edge, then destroy
        spawnSpark(side);
      } else {
        b.pending = false;
        b.dir = side === 'left' ? 1 : -1; // refused — turn around
      }
    });
  };
```

Replace the `unsubEnter` subscription with:

```ts
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side, state }) => {
    if (beings.has(agentId)) return; // duplicate guard
    const glyph = agentId.match(/-([A-Z])\d+$/)?.[1] ?? 'V';
    spawnSpark(side);
    const b = addBeing(agentId, glyph, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1, true);
    b.crossCooldownUntil = elapsedS + CROSS_COOLDOWN_S; // anti-ping-pong
    if (state) {
      // RESUME, don't respawn: gait + phase carry over; the intent
      // continues in this land's terms (chain-aware watch_edge, nearest
      // structure for approach). Missing state (stale preload) degrades
      // to the fresh-spawn defaults addBeing already chose.
      b.speed = state.speed;
      b.dir = state.dir;
      b.bobPhase = state.bobPhase;
      b.intent = resumeIntent(state.intent, side, intentCtx(b.x));
    }
  });
```

- [ ] **Step 5: The broker smoke**

Create `scripts/smoke-t1-broker-handoff.mts`:

```ts
/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-broker-handoff.mts`.
 * Drives the REAL main-process broker (desktop/src/terminals.ts) against a
 * mocked electron (fake BrowserWindows + captured ipcMain handlers):
 *   - roster uniqueness across two simulated terminals (first writer wins)
 *   - snap via debugMove → topology broadcast carries {joins, wings}
 *   - agentExit forwards the being's runtime state OPAQUELY to agentEnter
 *     (deep-equal round-trip), flips the entry side, names the source wing
 *   - exit refused off a closed edge / for a non-owned agent
 */
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

const { check, report } = makeChecker('smoke t1-broker-handoff');

type Handler = (e: unknown, payload?: unknown) => unknown;
const handlers = new Map<string, Handler>();
const listeners = new Map<string, Handler>();

class FakeWebContents {
  sent: Array<{ channel: string; payload: unknown }> = [];
  send(channel: string, payload: unknown): void {
    this.sent.push({ channel, payload });
  }
  on(): void {}
  getURL(): string {
    return '';
  }
}

class FakeBrowserWindow {
  static all: FakeBrowserWindow[] = [];
  webContents = new FakeWebContents();
  private bounds: { x: number; y: number; width: number; height: number };
  constructor(opts: { x: number; y: number; width: number; height: number }) {
    this.bounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height };
    FakeBrowserWindow.all.push(this);
  }
  once(_ev: string, cb: () => void): void {
    cb();
  }
  on(): void {}
  show(): void {}
  loadURL(): Promise<void> {
    return Promise.resolve();
  }
  getBounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.bounds };
  }
  setBounds(b: { x: number; y: number; width: number; height: number }): void {
    this.bounds = { ...b };
  }
  isDestroyed(): boolean {
    return false;
  }
}

mockElectronModule({
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: (channel: string, fn: Handler) => listeners.set(channel, fn),
  },
});

const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');

check('two windows spawned', FakeBrowserWindow.all.length === 2);
check('debug IPC registered', handlers.has('terminal:debugState') && handlers.has('terminal:debugMove'));

const state = () =>
  handlers.get('terminal:debugState')!(null) as {
    joins: Array<{ left: string; right: string }>;
    roster: Record<string, string>;
  };

// --- snap t2 against t1's right edge (t1 boots at x=60, w=640) --------------
check('boots unjoined', state().joins.length === 0);
handlers.get('terminal:debugMove')!(null, { terminalId: 't2', x: 700, y: 160 });
check('debugMove → snap → joined',
  JSON.stringify(state().joins) === JSON.stringify([{ left: 't1', right: 't2' }]));

const [w1, w2] = FakeBrowserWindow.all;
const topo = w1.webContents.sent.filter((m) => m.channel === 'terminal:topology').pop();
check('topology broadcast carries joins + wings',
  JSON.stringify(topo?.payload) ===
    JSON.stringify({ joins: [{ left: 't1', right: 't2' }], wings: { t1: 'd0', t2: 'd1' } }));

// --- roster uniqueness (7D.2 single-roaming-roster over IPC) -----------------
const spawn = handlers.get('terminal:agentSpawn')!;
check('first spawn accepted', spawn(null, { agentId: 'b1', terminalId: 't1' }) === true);
check('duplicate spawn in ANOTHER terminal refused', spawn(null, { agentId: 'b1', terminalId: 't2' }) === false);
check('re-spawn in the SAME terminal is idempotent', spawn(null, { agentId: 'b1', terminalId: 't1' }) === true);
check('roster names exactly one home', state().roster.b1 === 't1');

// --- state-carrying handoff ---------------------------------------------------
const exit = handlers.get('terminal:agentExit')!;
const carried = { speed: 1.7, dir: 1, intent: 'watch_edge', bobPhase: 2.1 };
check('exit off the joined edge accepted',
  exit(null, { agentId: 'b1', terminalId: 't1', side: 'right', state: carried }) === true);
check('roster moved b1 → t2', state().roster.b1 === 't2');
const enter = w2.webContents.sent.filter((m) => m.channel === 'terminal:agentEnter').pop()?.payload as
  | { agentId: string; side: string; state: unknown; from: { terminalId: string; wing: string } }
  | undefined;
check('agentEnter reached the neighbour', enter?.agentId === 'b1');
check('entry side flips (exit right → enter left)', enter?.side === 'left');
check('runtime state round-trips opaquely', JSON.stringify(enter?.state) === JSON.stringify(carried));
check('from names the source terminal + wing',
  JSON.stringify(enter?.from) === JSON.stringify({ terminalId: 't1', wing: 'd0' }));

// --- refusals ------------------------------------------------------------------
check('exit refused off a closed edge',
  exit(null, { agentId: 'b1', terminalId: 't2', side: 'right', state: carried }) === false);
check('exit refused for a non-owned agent',
  exit(null, { agentId: 'b1', terminalId: 't1', side: 'right', state: carried }) === false);
check('refusals leave the roster untouched', state().roster.b1 === 't2');

report();
```

- [ ] **Step 6: Run the smoke + typecheck both legs**

Run: `npx tsx scripts/smoke-t1-broker-handoff.mts && npm run typecheck && npm --prefix desktop run build`
Expected: `[smoke t1-broker-handoff] 16 assertions passed`; both legs clean.

- [ ] **Step 7: On-screen verification (macOS)**

Relaunch the two-terminal build (Task 2 Step 8 launch lines — restart Electron so the new preload compiles in), then:

```bash
node scripts/e2e/t0-drive.mjs state          # note a t1 being id, e.g. t1-L0
node scripts/e2e/t0-drive.mjs place t1 t1-L0 58 1
node scripts/e2e/t0-drive.mjs waitcross t1-L0 30
node scripts/e2e/t0-drive.mjs state
```

Expected: `CROSSED: t1-L0 t1 → t2`; in the post-cross state, `t1-L0` appears in t2's beings with `dir: 1` (kept walking the same way, not respawned at a default) and an intent field; for ~4 s (`CROSS_COOLDOWN_S`) it does not bounce straight back.

- [ ] **Step 8: Commit**

```bash
git add desktop/src/preload.ts desktop/src/terminals.ts src/api/electron.ts src/terminal/terminalLand.ts scripts/smoke-t1-broker-handoff.mts
git commit -m "feat(terminals): state-carrying handoff — beings resume across windows"
```

---

### Task 4: Crossings + arrivals write to the memory stream

(c): record-only observations through the desktop `MemoryWriter`. The terminal renderer bootstraps the store namespaced per wing; web keeps the null writer. No new `ObservationSource` token (see Global Constraints) — `writer.ts` gains prose `describeEvent` cases and an explicit source mapping to `'self_perception'`.

**Files:**
- Modify: `src/agents/memory/db.ts` (busy_timeout pragma — two terminal renderer processes share one WAL sqlite)
- Modify: `src/agents/memory/writer.ts` (`describeEvent` + `sourceFromEventKind` cases)
- Create: `src/terminal/terminalMemory.ts`
- Modify: `src/terminal/terminalLand.ts` (bootstrap + write sites)
- Create: `scripts/smoke-t1-society-memory.mts`

**Interfaces:**
- Produces: `recordCrossing(writer: MemoryWriter, args: {agentId; fromWing; toWing; col; row; whenMs}): string | null` · `recordArrival(writer: MemoryWriter, args: {agentId; wing; col; row; whenMs}): string | null` · `CROSSING_IMPORTANCE = 5` · `ARRIVAL_IMPORTANCE = 3`.
- Consumes: `MemoryWriter`/`nullMemoryWriter` (`src/agents/router.ts`), `bootstrapMemory`/`getCurrentMemoryWriter` (`src/agents/memory/bootstrap.ts`), `cellIdFor`/`libraryIdFor` (`src/agents/memory/schema.ts`), enter-event `from` (Task 3).

- [ ] **Step 1: Multi-process write safety**

In `src/agents/memory/db.ts`, after the `db.pragma('journal_mode = WAL');` line, add:

```ts
  // Tier-1 terminals: multiple renderer processes share this file (one
  // memory.sqlite per userData). WAL handles concurrent readers; a busy
  // writer should wait briefly, not throw SQLITE_BUSY into a tick.
  db.pragma('busy_timeout = 3000');
```

- [ ] **Step 2: Prose + source mapping in `writer.ts`**

In `src/agents/memory/writer.ts`, in `describeEvent`, add above the `default:` case:

```ts
    case 'terminal_crossing': {
      const [from, to] = (ev.subject ?? '').split('→');
      return `crossed from the ${from || '?'} terminal into ${to || '?'}`;
    }
    case 'terminal_arrival':
      return `arrived in the ${ev.subject ?? '?'} land`;
```

In `sourceFromEventKind`, add above the `default:` case:

```ts
    case 'terminal_crossing':
    case 'terminal_arrival':
      // Terminal-society events ride the existing source vocabulary:
      // ObservationSource is a frozen schema contract (schema.ts — a new
      // token = SCHEMA_VERSION bump + migration), and the agent's own
      // movement is honestly 'self_perception'. The kind survives in the
      // row text + subject, so the stream stays queryable.
      return 'self_perception';
```

- [ ] **Step 3: The recorder module**

Create `src/terminal/terminalMemory.ts`:

```ts
/**
 * Tier-1 "living society" — terminal-land memory recording.
 *
 * Crossings + arrivals become plain 'observation' rows in the Smallville
 * memory stream through the injected MemoryWriter — the DB-backed writer
 * in the desktop wrapper (bootstrapMemory), the null writer on web. NO
 * Tier-1/Tier-2 dispatch fires from terminals: record only. (PRD-T2's
 * "Tier-1 perception fires on arrival" is deliberately deferred — the
 * no-LLM rail for this arc.)
 *
 * Every write is try/caught: terminal windows are separate renderer
 * processes sharing one memory.sqlite (WAL + busy_timeout), and write
 * contention must cost a lost observation, never a broken tick.
 */

import type { MemoryWriter } from '../agents/router';

/** Smallville importance for a cross-window move — between agent_meeting
 *  (6) and player_proximity (4): noteworthy, not headline. */
export const CROSSING_IMPORTANCE = 5;
/** Arrival in a land (spawn) — ambient, like cell_mount (3). */
export const ARRIVAL_IMPORTANCE = 3;

export function recordCrossing(
  writer: MemoryWriter,
  args: {
    agentId: string;
    fromWing: string;
    toWing: string;
    col: number;
    row: number;
    whenMs: number;
  },
): string | null {
  try {
    return writer.recordPerception(
      args.agentId,
      {
        kind: 'terminal_crossing',
        subject: `${args.fromWing}→${args.toWing}`,
        at: { x: args.col, y: args.row },
        when: args.whenMs,
      },
      CROSSING_IMPORTANCE,
    );
  } catch {
    return null;
  }
}

export function recordArrival(
  writer: MemoryWriter,
  args: { agentId: string; wing: string; col: number; row: number; whenMs: number },
): string | null {
  try {
    return writer.recordPerception(
      args.agentId,
      {
        kind: 'terminal_arrival',
        subject: args.wing,
        at: { x: args.col, y: args.row },
        when: args.whenMs,
      },
      ARRIVAL_IMPORTANCE,
    );
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Wire the renderer**

In `src/terminal/terminalLand.ts`, add imports:

```ts
import { nullMemoryWriter } from '../agents/router';
import { bootstrapMemory, getCurrentMemoryWriter } from '../agents/memory/bootstrap';
import { cellIdFor, libraryIdFor } from '../agents/memory/schema';
import { recordArrival, recordCrossing } from './terminalMemory';
```

After the `const seed = fnv1a(...)` line, add:

```ts
  // Memory stream (Tier-1 society): the desktop terminal gets the DB-backed
  // writer namespaced per wing; the web preview degrades to the null writer.
  // Each terminal window is its own renderer process → its own bootstrap.
  let memory = getCurrentMemoryWriter() ?? nullMemoryWriter;
  void bootstrapMemory({
    namespace: { cellId: cellIdFor(seed), libraryId: libraryIdFor(null) },
  }).then((r) => {
    memory = r.writer;
  });
```

Replace the native-spawn loop body's `.then` with:

```ts
    void terminalAgentSpawn(id, terminalId).then((ok) => {
      if (!ok) return;
      const b = addBeing(id, glyph, 6 + ((i * 37) % (model.width - 12)), i % 2 === 0 ? 1 : -1);
      recordArrival(memory, {
        agentId: id,
        wing,
        col: Math.round(b.x),
        row: model.surface[Math.round(b.x)] ?? 0,
        whenMs: Date.now(),
      });
    });
```

In the Task-3 enter handler, destructure `from` too (`({ agentId, side, state, from })`) and add, after the `if (state) { … }` block:

```ts
    recordCrossing(memory, {
      agentId,
      fromWing: from?.wing || '?',
      toWing: wing,
      col: Math.round(b.x),
      row: model.surface[Math.round(b.x)] ?? 0,
      whenMs: Date.now(),
    });
```

- [ ] **Step 5: The smoke (spy writer + real-DB round-trip)**

Create `scripts/smoke-t1-society-memory.mts`:

```ts
/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-society-memory.mts`.
 * Locks the record-only memory contract:
 *   - crossing/arrival writes hit MemoryWriter.recordPerception with the
 *     documented kinds, subjects, locations and importances (spy writer)
 *   - the null writer no-ops gracefully (web build path)
 *   - a throwing writer is swallowed (multi-process sqlite contention)
 *   - REAL DB round-trip: writer.ts renders the crossing as prose, kind
 *     'observation', riding the frozen ObservationSource vocabulary
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';
import { nullMemoryWriter, type MemoryWriter } from '../src/agents/router.ts';
import {
  ARRIVAL_IMPORTANCE,
  CROSSING_IMPORTANCE,
  recordArrival,
  recordCrossing,
} from '../src/terminal/terminalMemory.ts';

// The memory modules resolve better-sqlite3 via a global require.
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const { check, report } = makeChecker('smoke t1-society-memory');

// --- 1 · spy writer sees the documented shape --------------------------------
interface Call {
  agentId: string;
  event: { kind: string; subject?: string; at: { x: number; y: number }; when: number };
  importance: number;
}
const calls: Call[] = [];
const spy: MemoryWriter = {
  ...nullMemoryWriter,
  recordPerception: (agentId, event, importance) => {
    calls.push({ agentId, event: event as Call['event'], importance });
    return 'mem-1';
  },
};
check('recordCrossing returns the writer id',
  recordCrossing(spy, { agentId: 't1-L0', fromWing: 'd0', toWing: 'd1', col: 0, row: 12, whenMs: 1000 }) === 'mem-1');
check('crossing kind', calls[0]?.event.kind === 'terminal_crossing');
check('crossing subject is from→to', calls[0]?.event.subject === 'd0→d1');
check('crossing importance', calls[0]?.importance === CROSSING_IMPORTANCE);
check('crossing location is the entry cell', calls[0]?.event.at.x === 0 && calls[0]?.event.at.y === 12);
recordArrival(spy, { agentId: 't1-L0', wing: 'd0', col: 6, row: 11, whenMs: 1000 });
check('arrival kind', calls[1]?.event.kind === 'terminal_arrival');
check('arrival subject is the wing', calls[1]?.event.subject === 'd0');
check('arrival importance', calls[1]?.importance === ARRIVAL_IMPORTANCE);

// --- 2 · graceful no-ops --------------------------------------------------------
check('null writer → null, no throw',
  recordCrossing(nullMemoryWriter, { agentId: 'x', fromWing: 'd0', toWing: 'd1', col: 0, row: 0, whenMs: 0 }) === null);
const thrower: MemoryWriter = {
  ...nullMemoryWriter,
  recordPerception: () => {
    throw new Error('SQLITE_BUSY');
  },
};
check('throwing writer → null, no throw',
  recordCrossing(thrower, { agentId: 'x', fromWing: 'd0', toWing: 'd1', col: 0, row: 0, whenMs: 0 }) === null);

// --- 3 · real DB round-trip (writer.ts describe/source mapping) ------------------
const { openMemoryDb } = await import('../src/agents/memory/db.ts');
const { openMemoryVault } = await import('../src/agents/memory/vault.ts');
const { buildMemoryWriter } = await import('../src/agents/memory/writer.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-t1-'));
const db = openMemoryDb({ path: path.join(tmp, 'memory.sqlite') });
const vault = openMemoryVault({ rootDir: path.join(tmp, 'vaults') });
const writer = buildMemoryWriter({ db, vault, ns: { cellId: 'cell:t1test', libraryId: 'library:anonymous' } });
const id = recordCrossing(writer, { agentId: 't1-L0', fromWing: 'd0', toWing: 'd1', col: 0, row: 12, whenMs: Date.now() });
check('DB write returns an id', typeof id === 'string' && (id as string).length > 0);
const recent = writer.recentMemories('t1-L0', 5);
check('row lands in the stream', recent.length === 1);
check('row kind is observation', recent[0]?.kind === 'observation');
check('row text reads as prose', recent[0]?.text === 'crossed from the d0 terminal into d1');
check('row importance persisted', recent[0]?.importance === CROSSING_IMPORTANCE);
db.close();
fs.rmSync(tmp, { recursive: true, force: true });

report();
```

- [ ] **Step 6: Run smoke + typecheck + memory regression**

Run: `npx tsx scripts/smoke-t1-society-memory.mts && npx tsx scripts/smoke-2a-memory.mts && npm run typecheck && npm --prefix desktop run build`
Expected: `[smoke t1-society-memory] 15 assertions passed`; 2A still green (busy_timeout is additive); both legs clean.

- [ ] **Step 7: On-screen verification (macOS)**

Relaunch (fresh Electron), force a crossing, then read the store:

```bash
node scripts/e2e/t0-drive.mjs place t1 t1-L0 58 1
node scripts/e2e/t0-drive.mjs waitcross t1-L0 30
sqlite3 "$HOME/Library/Application Support/lokilibrary-desktop/memory.sqlite" \
  "SELECT agent_id, kind, json_extract(payload_json,'$.text') FROM memories ORDER BY created_at DESC LIMIT 5;"
```

Expected: an `observation` row for the crossed being with text `crossed from the d0 terminal into d1`, plus `arrived in the … land` rows from boot. Electron log shows `[memory/bootstrap] db ready …` in terminal windows.

- [ ] **Step 8: Commit**

```bash
git add src/agents/memory/db.ts src/agents/memory/writer.ts src/terminal/terminalMemory.ts src/terminal/terminalLand.ts scripts/smoke-t1-society-memory.mts
git commit -m "feat(terminals): crossings + arrivals write the Smallville memory stream (record-only)"
```

---

### Task 5: Cross-edge perception — the society leans toward joins

(d): pure 1-D projection helpers (the `enrichSnapshotAcrossSeams` pattern), a ≤1 Hz change-gated renderer report, a broker relay to the joined neighbour, and the decisive `watch_edge` pull. Ends with the full sweep.

**Files:**
- Create: `src/terminal/crossEdge.ts`
- Create: `scripts/smoke-t1-cross-edge.mts`
- Modify: `desktop/src/preload.ts` (`TerminalNearEdgeBeing`, `terminalReportNearEdge`, `onTerminalNeighbourSummary`)
- Modify: `desktop/src/terminals.ts` (`ipcMain.on('terminal:nearEdge')` relay)
- Modify: `src/api/electron.ts` (mirror types + helpers)
- Modify: `src/terminal/terminalLand.ts` (report loop, summary subscription, intent pull, `state().neighbours`)

**Interfaces:**
- Produces: `interface NearEdgeBeing { id: string; dist: number }` · `NEAR_EDGE_CELLS = 10` · `NEAR_EDGE_MAX = 4` · `nearEdgeSummary(beings: ReadonlyArray<{id: string; x: number}>, width: number, edges: {left: boolean; right: boolean}): { left: NearEdgeBeing[]; right: NearEdgeBeing[] }` · `projectAcrossEdge(side: 'left'|'right', width: number, beings: readonly NearEdgeBeing[]): Array<{id: string; x: number}>` · IPC `terminal:nearEdge` (renderer→broker, fire-and-forget) and `terminal:neighbourSummary` `{side, beings}` (broker→renderer).
- Consumes: `neighbourOf` (broker), `IntentContext.neighbourNear` (Task 1/2).

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-t1-cross-edge.mts`:

```ts
/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-cross-edge.mts`.
 * Locks cross-edge perception.
 *   PURE (src/terminal/crossEdge.ts):
 *   - nearEdgeSummary: open-edge gating, distance math, nearest-first cap,
 *     radius, closed edges report [], purity
 *   - projectAcrossEdge: neighbours land just OUTSIDE the local land; the
 *     two windows' views of one being are mirror-consistent
 *   BROKER (real desktop/src/terminals.ts, mocked electron):
 *   - terminal:nearEdge relays each JOINED side to that neighbour with the
 *     side flipped; un-joined sides are dropped
 */
import { makeChecker, mockElectronModule } from './lib/smoke.ts';
import {
  NEAR_EDGE_CELLS,
  NEAR_EDGE_MAX,
  nearEdgeSummary,
  projectAcrossEdge,
} from '../src/terminal/crossEdge.ts';

const { check, report } = makeChecker('smoke t1-cross-edge');

// --- nearEdgeSummary -----------------------------------------------------------
const beings = [
  { id: 'a', x: 2 },
  { id: 'b', x: 57 },
  { id: 'c', x: 30 },
  { id: 'd', x: 59 },
];
const both = nearEdgeSummary(beings, 60, { left: true, right: true });
check('left side: in-range being, correct dist',
  JSON.stringify(both.left) === JSON.stringify([{ id: 'a', dist: 2 }]));
check('right side: nearest first',
  JSON.stringify(both.right) === JSON.stringify([{ id: 'd', dist: 0 }, { id: 'b', dist: 2 }]));
check('mid-land beings excluded', !JSON.stringify(both).includes('"c"'));
const closed = nearEdgeSummary(beings, 60, { left: false, right: false });
check('closed edges report []', closed.left.length === 0 && closed.right.length === 0);
const crowd = Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, x: i }));
const capped = nearEdgeSummary(crowd, 60, { left: true, right: false });
check(`cap at NEAR_EDGE_MAX (${NEAR_EDGE_MAX})`, capped.left.length === NEAR_EDGE_MAX);
check('cap keeps the nearest', capped.left[0].id === 'x0' && capped.left[0].dist === 0);
check('radius respected',
  nearEdgeSummary([{ id: 'far', x: NEAR_EDGE_CELLS + 1 }], 60, { left: true, right: false }).left.length === 0);
check('pure: same inputs → same summary',
  JSON.stringify(nearEdgeSummary(beings, 60, { left: true, right: true })) === JSON.stringify(both));
check('pure: input array unmutated', beings.length === 4 && beings[0].id === 'a' && beings[0].x === 2);

// --- projectAcrossEdge -----------------------------------------------------------
check('right-side neighbours land just past width-1',
  JSON.stringify(projectAcrossEdge('right', 60, [{ id: 'n0', dist: 0 }, { id: 'n3', dist: 3 }])) ===
    JSON.stringify([{ id: 'n0', x: 60 }, { id: 'n3', x: 63 }]));
check('left-side neighbours land just below 0',
  JSON.stringify(projectAcrossEdge('left', 60, [{ id: 'n0', dist: 0 }])) ===
    JSON.stringify([{ id: 'n0', x: -1 }]));
// Mirror consistency: MY being at x=59 (width 60) is dist 0 off my right
// edge; the neighbour projects it at ITS x=-1 — exactly the column my
// col 59 occupies on the shared desk.
const mine = nearEdgeSummary([{ id: 'm', x: 59 }], 60, { left: false, right: true });
check("mirror: my edge being appears at the neighbour's x=-1",
  JSON.stringify(projectAcrossEdge('left', 60, mine.right)) === JSON.stringify([{ id: 'm', x: -1 }]));

// --- broker relay (real terminals.ts, mocked electron) -----------------------------
type Handler = (e: unknown, payload?: unknown) => unknown;
const handlers = new Map<string, Handler>();
const listeners = new Map<string, Handler>();

class FakeWebContents {
  sent: Array<{ channel: string; payload: unknown }> = [];
  send(channel: string, payload: unknown): void {
    this.sent.push({ channel, payload });
  }
  on(): void {}
  getURL(): string {
    return '';
  }
}
class FakeBrowserWindow {
  static all: FakeBrowserWindow[] = [];
  webContents = new FakeWebContents();
  private bounds: { x: number; y: number; width: number; height: number };
  constructor(opts: { x: number; y: number; width: number; height: number }) {
    this.bounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height };
    FakeBrowserWindow.all.push(this);
  }
  once(_ev: string, cb: () => void): void {
    cb();
  }
  on(): void {}
  show(): void {}
  loadURL(): Promise<void> {
    return Promise.resolve();
  }
  getBounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.bounds };
  }
  setBounds(b: { x: number; y: number; width: number; height: number }): void {
    this.bounds = { ...b };
  }
  isDestroyed(): boolean {
    return false;
  }
}

mockElectronModule({
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: (channel: string, fn: Handler) => listeners.set(channel, fn),
  },
});
const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');
handlers.get('terminal:debugMove')!(null, { terminalId: 't2', x: 700, y: 160 }); // snap → t1+t2

const [w1, w2] = FakeBrowserWindow.all;
check('nearEdge listener registered', listeners.has('terminal:nearEdge'));
listeners.get('terminal:nearEdge')!(null, {
  terminalId: 't1',
  near: { left: [{ id: 'a', dist: 2 }], right: [{ id: 'd', dist: 0 }] },
});
const w2sum = w2.webContents.sent.filter((m) => m.channel === 'terminal:neighbourSummary').pop();
check("t1's right-edge beings reach t2 as ITS left summary",
  JSON.stringify(w2sum?.payload) === JSON.stringify({ side: 'left', beings: [{ id: 'd', dist: 0 }] }));
check("t1's un-joined left side is dropped",
  w1.webContents.sent.filter((m) => m.channel === 'terminal:neighbourSummary').length === 0);

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-t1-cross-edge.mts`
Expected: FAIL — `src/terminal/crossEdge.ts` does not exist.

- [ ] **Step 3: Create the pure module**

Create `src/terminal/crossEdge.ts`:

```ts
/**
 * Tier-1 society — cross-edge perception, the 1-D land port of
 * src/agents/crossSeam.ts's enrichSnapshotAcrossSeams idea: a being near
 * an OPEN edge perceives the joined neighbour's near-edge beings,
 * projected just OUTSIDE the local land so distances still measure
 * correctly and nothing renders. PURE helpers only — the transport
 * (renderer ≤1 Hz change-gated report → broker relay) lives in
 * terminalLand.ts / desktop/src/terminals.ts.
 */

/** A being near a shared edge, as reported across a join. `dist` = whole
 *  cells between the being and the shared edge (0 = on the edge column). */
export interface NearEdgeBeing {
  id: string;
  dist: number;
}

/** How close to an open edge a being must be to appear in the summary. */
export const NEAR_EDGE_CELLS = 10;
/** Cap per side — keeps the ≤1 Hz IPC payload bounded. */
export const NEAR_EDGE_MAX = 4;

/** THIS terminal's near-edge summary: for each OPEN edge, the beings
 *  within NEAR_EDGE_CELLS of it, nearest first, capped at NEAR_EDGE_MAX.
 *  Closed edges report [] — the broker never learns about beings at a
 *  wall (the openSeamsFor-returns-[] invariant, 1-D). */
export function nearEdgeSummary(
  beings: ReadonlyArray<{ id: string; x: number }>,
  width: number,
  edges: { left: boolean; right: boolean },
): { left: NearEdgeBeing[]; right: NearEdgeBeing[] } {
  const side = (open: boolean, distOf: (x: number) => number): NearEdgeBeing[] => {
    if (!open) return [];
    return beings
      .map((b) => ({ id: b.id, dist: Math.round(distOf(b.x)) }))
      .filter((b) => b.dist >= 0 && b.dist <= NEAR_EDGE_CELLS)
      .sort((a, b) => a.dist - b.dist || a.id.localeCompare(b.id))
      .slice(0, NEAR_EDGE_MAX);
  };
  return {
    left: side(edges.left, (x) => x),
    right: side(edges.right, (x) => width - 1 - x),
  };
}

/** Project a neighbour's near-edge beings into THIS terminal's column
 *  space: they land just outside the local land (x < 0 / x > width-1),
 *  mirroring crossSeam's toLocal contract. My col width-1 abuts the
 *  neighbour's col 0, so their dist-d being sits at width+d (right join)
 *  or -1-d (left join). */
export function projectAcrossEdge(
  side: 'left' | 'right',
  width: number,
  beings: readonly NearEdgeBeing[],
): Array<{ id: string; x: number }> {
  return beings.map((b) => ({
    id: b.id,
    x: side === 'left' ? -1 - b.dist : width + b.dist,
  }));
}
```

- [ ] **Step 4: Preload + client API**

In `desktop/src/preload.ts`, add below `TerminalBeingState`:

```ts
/** A being near a shared edge (cross-edge perception relay). */
export interface TerminalNearEdgeBeing {
  id: string;
  dist: number;
}
```

Add to the `ElectronAPI` interface (after `onTerminalAgentEnter`):

```ts
  /** ≤1 Hz, change-gated near-edge report; the broker relays each joined
   *  side to that neighbour. Fire-and-forget — perception is advisory. */
  terminalReportNearEdge(
    terminalId: string,
    near: { left: TerminalNearEdgeBeing[]; right: TerminalNearEdgeBeing[] },
  ): void;
  /** The joined neighbour's near-edge beings, per side of THIS terminal. */
  onTerminalNeighbourSummary(
    cb: (event: { side: 'left' | 'right'; beings: TerminalNearEdgeBeing[] }) => void,
  ): () => void;
```

And to the implementation object:

```ts
  terminalReportNearEdge: (terminalId, near) => {
    ipcRenderer.send('terminal:nearEdge', { terminalId, near });
  },
  onTerminalNeighbourSummary: (cb) => {
    const handler = (
      _e: IpcRendererEvent,
      event: { side: 'left' | 'right'; beings: TerminalNearEdgeBeing[] },
    ): void => cb(event);
    ipcRenderer.on('terminal:neighbourSummary', handler);
    return () => ipcRenderer.off('terminal:neighbourSummary', handler);
  },
```

In `src/api/electron.ts`, add below `TerminalBeingState`:

```ts
/** Tier-1 society — a being near a shared edge (mirrors preload). */
export interface TerminalNearEdgeBeing {
  id: string;
  dist: number;
}
```

Add the two signatures to its `ElectronAPI` interface (same text as the preload interface lines above), and add the helpers at the bottom of the terminal-helpers section:

```ts
export function terminalReportNearEdge(
  terminalId: string,
  near: { left: TerminalNearEdgeBeing[]; right: TerminalNearEdgeBeing[] },
): void {
  const api = getElectronAPI();
  if (!api || typeof api.terminalReportNearEdge !== 'function') return;
  try {
    api.terminalReportNearEdge(terminalId, near);
  } catch {
    /* advisory — never throws into the tick */
  }
}

export function subscribeTerminalNeighbourSummary(
  cb: (event: { side: 'left' | 'right'; beings: TerminalNearEdgeBeing[] }) => void,
): () => void {
  const api = getElectronAPI();
  if (!api || typeof api.onTerminalNeighbourSummary !== 'function') return () => undefined;
  return api.onTerminalNeighbourSummary(cb);
}
```

- [ ] **Step 5: Broker relay**

In `desktop/src/terminals.ts`, after the `terminal:agentExit` registration, add:

```ts
  // Cross-edge perception: renderers report near-edge beings on a slow
  // cadence (≤1 Hz, change-gated renderer-side); relay each side that faces
  // a live join to that neighbour with the side flipped to ITS view of the
  // shared edge. Fire-and-forget (ipcMain.on, not handle) — advisory only.
  ipcMain.on(
    'terminal:nearEdge',
    (
      _e,
      payload: {
        terminalId: string;
        near: { left: unknown[]; right: unknown[] };
      },
    ) => {
      for (const side of ['left', 'right'] as const) {
        const dest = neighbourOf(payload.terminalId, side, joins);
        if (!dest) continue;
        const destTerm = terminals.get(dest);
        if (!destTerm || destTerm.win.isDestroyed()) continue;
        destTerm.win.webContents.send('terminal:neighbourSummary', {
          side: side === 'left' ? 'right' : 'left',
          beings: payload.near[side],
        });
      }
    },
  );
```

- [ ] **Step 6: Renderer — report, receive, pull, expose**

In `src/terminal/terminalLand.ts`:

Add to the `../api/electron` import list: `terminalReportNearEdge, subscribeTerminalNeighbourSummary`. Add:

```ts
import { nearEdgeSummary, projectAcrossEdge, type NearEdgeBeing } from './crossEdge';
```

Add a knob beside `CROSS_COOLDOWN_S`:

```ts
/** Near-edge report cadence (seconds; also change-gated). */
const NEAR_EDGE_REPORT_S = 1;
```

Above the `intentCtx` definition, add:

```ts
  // The joined neighbours' near-edge beings, per side (cross-edge
  // perception). Cleared when an edge closes; fed by the broker relay.
  const neighbourNear: { left: NearEdgeBeing[]; right: NearEdgeBeing[] } = { left: [], right: [] };
  let lastNearReport = '';
  let nearReportAt = 0;
```

Replace `intentCtx`'s `neighbourNear` line (and its placeholder comment) with:

```ts
    neighbourNear: { left: neighbourNear.left.length, right: neighbourNear.right.length },
```

In `applyJoins`, immediately after the `edges = { … };` assignment, add:

```ts
    if (!edges.left) neighbourNear.left = [];
    if (!edges.right) neighbourNear.right = [];
```

In `tick()`, right after `elapsedS += dt;`, add:

```ts
    // Near-edge report — ≤1 Hz AND change-gated, so IPC stays bounded.
    if (elapsedS >= nearReportAt) {
      nearReportAt = elapsedS + NEAR_EDGE_REPORT_S;
      const near = nearEdgeSummary(
        [...beings.values()].filter((b) => !b.pending).map((b) => ({ id: b.id, x: b.x })),
        model.width,
        edges,
      );
      const key = JSON.stringify(near);
      if (key !== lastNearReport) {
        lastNearReport = key;
        terminalReportNearEdge(terminalId, near);
      }
    }
```

In the broker-wiring section, after `unsubEnter`, add:

```ts
  const unsubNeighbour = subscribeTerminalNeighbourSummary(({ side, beings: bs }) => {
    neighbourNear[side] = bs;
  });
```

…and call `unsubNeighbour();` in the teardown (beside `unsubEnter();`).

Extend `TerminalLandState` and `state()` — replace the interface with:

```ts
export interface TerminalLandState {
  terminalId: string;
  wing: string;
  edges: { left: boolean; right: boolean };
  beings: Array<{ id: string; x: number; dir: number; intent: string }>;
  /** The joined neighbours' near-edge beings, projected into THIS land's
   *  column space (x < 0 / x > width-1 — just outside the local land). */
  neighbours: {
    left: Array<{ id: string; x: number }>;
    right: Array<{ id: string; x: number }>;
  };
}
```

…and add to the `state: () => ({ … })` object:

```ts
      neighbours: {
        left: projectAcrossEdge('left', model.width, neighbourNear.left),
        right: projectAcrossEdge('right', model.width, neighbourNear.right),
      },
```

- [ ] **Step 7: Run the smoke, typecheck, full sweep**

Run:

```bash
npx tsx scripts/smoke-t1-cross-edge.mts
npm run typecheck && npm --prefix desktop run build
for f in scripts/smoke-*.mts; do npx tsx "$f" || exit 1; done
```

Expected: `[smoke t1-cross-edge] 16 assertions passed`; both legs clean; every smoke in the sweep green (glyph-coverage untouched — no new glyphs shipped in this arc).

- [ ] **Step 8: On-screen verification (macOS)**

Relaunch fresh (new preload), then:

```bash
node scripts/e2e/t0-drive.mjs place t1 t1-L0 57 1     # park a being at t1's right edge
sleep 3
node scripts/e2e/t0-drive.mjs state                    # t2.neighbours.left should list t1-L0 at x≈-1..-3
sleep 30
node scripts/e2e/t0-drive.mjs state                    # t2 beings trend to intent watch_edge:left
node scripts/e2e/t0-drive.mjs shot /tmp/loki-t1/gravity.png
```

Expected: t2's `neighbours.left` is non-empty within ~2 s of the place; over the next intent re-picks t2's beings adopt `watch_edge` toward the join (the PRD-T2 acceptance: agents cluster toward joins when something is on the other side); crossings become visibly more frequent. Un-snap (`move t2 900 160`) → both `neighbours` empty and the pull stops.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/crossEdge.ts scripts/smoke-t1-cross-edge.mts desktop/src/preload.ts desktop/src/terminals.ts src/api/electron.ts src/terminal/terminalLand.ts
git commit -m "feat(terminals): cross-edge perception — beings sense the neighbour and lean toward joins"
```

---

## Deliberately deferred (from PRD-T2)

- **Real 5-agent cohort defs / `migrateRuntime`-over-IPC:** the land walker is 1-D float-x; grafting the 2-D cell `AgentDef`/BT/scope machinery onto it now would be a speculative abstraction — the intent engine gives the same behavioural surface land-locally, and the cohort port is its own arc.
- **Tier-1 perception dispatch on arrival:** violates this arc's no-LLM rail; crossings are recorded so a later arc can dispatch off the same rows (no flag needed — the call is simply never made).
- **New `ObservationSource` token (`terminal_crossing`):** `schema.ts`/`writer.ts` document source extension as a SCHEMA_VERSION bump + migration; riding `'self_perception'` with the kind in text+subject is additive-safe today and migratable later.
- **Full 7D.2 anti-ping-pong port (floor/edge gating):** the `CROSS_COOLDOWN_S` beat covers the observed failure mode (instant re-exit); the rest waits for real cohort runtimes.
- **Being persistence across relaunch:** PRD-T1 territory (terminal registry + config), out of scope.

## Self-Review

**Spec coverage:** (a) intents → Tasks 1–2 (score-based, seeded via `makeRng`, approach/rest/watch-the-edge + linger). (b) state-carrying handoff → Task 3 (payload + opaque broker forward + resume, preload/api types end-to-end). (c) memory stream → Task 4 (record-only, `'observation'` kind, frozen-source decision documented, null writer graceful). (d) cross-edge perception → Task 5 (pure projection, ≤1 Hz change-gated report, broker relay, bounded payloads). (e) smokes → roster uniqueness + handoff round-trip (Task 3), crossing-writes-memory spy + real-DB (Task 4), perception projection purity (Task 5), intent purity (Task 1). ✓

**Type consistency:** `BeingIntent`/`IntentContext` defined once (Task 1), consumed in Tasks 2/3/5 with matching shapes; `TerminalBeingState {speed; dir; intent; bobPhase}` identical in preload, api/electron, and the `carried` literal; `NearEdgeBeing {id; dist}` identical in crossEdge.ts and both IPC mirrors; enter event `{agentId, side, state?, from?}` matches broker send. `neighbourNear` counts in `IntentContext` vs. arrays in the renderer are deliberate (the engine needs counts only).

**Ordering:** every task compiles and greens standalone; Task 4 needs Task 3's `from` field; Task 5 replaces Task 2's `neighbourNear` zeros. Decisive-pull math verified: pulled watch_edge min 0.75 ≥ sup of every other candidate range.

**Placeholder scan:** none — every step carries the actual code.

### Critical Files for Implementation
- /Users/henrydemontfort/code/projects/Lokilibrary/src/terminal/terminalLand.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/desktop/src/terminals.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/desktop/src/preload.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/api/electron.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/src/agents/memory/writer.ts