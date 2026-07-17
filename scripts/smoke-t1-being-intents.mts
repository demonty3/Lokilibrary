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
check('variety at an open edge: wander/approach/watch_edge all occur',
  (['wander', 'approach', 'watch_edge'] as const).every((k) => kinds.has(k)));
// rest [0.2,0.5) is strictly dominated by watch_edge [0.5,0.8) while an edge
// is open — deliberate (the join is exciting); rest lives in the no-join case.
const closedKinds = new Set(picks(3, baseCtx(), 400).map((i) => i.kind));
check('variety at closed edges: wander/rest/approach all occur',
  (['wander', 'rest', 'approach'] as const).every((k) => closedKinds.has(k)));

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

report();
