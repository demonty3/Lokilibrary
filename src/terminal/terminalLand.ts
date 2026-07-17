/**
 * T0 spike — the terminal-window land view (docs/PRD-snapping-terminals.md).
 *
 * A terminal window shows ONE wing as a side-on land. The main-process
 * broker tells us which of our edges are joined to a neighbour terminal:
 * joined edges OPEN (a bright threshold doorway at the ground line); closed
 * edges are walls (beings turn around).
 *
 * Beings here are the REAL cohort (T2 society migration): def-driven glyph/
 * accent/speed (src/agents/cohort.ts), a land personality (beingIntents.ts
 * LAND_PERSONAS) layered on the pure BT intent pick, and a REAL agent mind
 * (an `initialRuntime`-built AgentRuntimeState) that routeTier1 dispatches
 * on arrival (fire-and-forget; a parseable `approach x,y` intent steers the
 * walker, anything else is flavor — key-free rail, no worker changes).
 * Presence dynamics (Visitor's cycle, Ghost's rare apparitions) reuse the
 * cell's `tickPresence` schedule rules on that same mind. Sub-cell motion
 * (float x + idle bob + hesitation beats) still rides live per-terminal
 * juice, not procedural layout. At an open edge a being hands itself AND
 * its mind to the broker (`terminal:agentExit`) and continues in the
 * neighbour window: exit eases out past the edge, entry fades in off a ✦
 * spark, the mind reconstructs from the carried fields. Homes (which wing
 * a cohort member lives on) live in the broker (single-roaming-roster,
 * 7D.2 semantics across process boundaries); wander/juice randomness is
 * runtime behaviour (like cell agents), not procedural layout — the LAND
 * itself stays seed-deterministic. All animation rides app.ticker.deltaMS
 * (throttle-safe); all tints come from the active theme palette.
 *
 * UI/UX pass (game-design-review, 2026-06-11): 2× world scale, bottom
 * anchor, brighter beings, edge affordances, crossing juice, no duplicate
 * title. Knobs below.
 *
 * Exposes `window.__terminal` (state + debug) for the e2e harness.
 */

import { Application, BitmapText, Container } from 'pixi.js';
import type { Theme } from '../themes/types';
import {
  COZETTE_CELL_HEIGHT as CH,
  COZETTE_CELL_WIDTH as CW,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
  waitForCozette,
} from '../render/fonts';
import { buildLandContainer } from '../render/levels/land';
import { createFootfall, crustLayerText } from './wear';
import { composeLand, SAMPLE_LAND, type LandGame } from '../procedural/land';
import {
  getTerminalSociety,
  getTerminalTopology,
  subscribeTerminalAgentEnter,
  subscribeTerminalNeighbourSummary,
  subscribeTerminalTopology,
  terminalAgentExit,
  terminalAgentSpawn,
  terminalReportNearEdge,
  type TerminalJoin,
} from '../api/electron';
import { nearEdgeSummary, projectAcrossEdge, type NearEdgeBeing } from './crossEdge';
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
import { roleKey } from '../themes/roles';
import { COHORT, filterByTheme, type AgentDef } from '../agents/cohort';
import { tickPresence } from '../agents/behavior';
import { nullMemoryWriter, routeTier1 } from '../agents/router';
import type { AgentRuntimeState } from '../state/agentRuntime';
import { mulberry32, type Prng } from '../procedural/prng';
import { bootstrapMemory, getCurrentMemoryWriter } from '../agents/memory/bootstrap';
import { cellIdFor, libraryIdFor } from '../agents/memory/schema';
import { recordArrival, recordCrossing } from './terminalMemory';

// ── T0 spike knobs ─────────────────────────────────────────────────────────
/** Integer up-scale — 1× Cozette fails the glance test in a 640px window. */
const WORLD_SCALE = 2;
const UNDER_H = 10;
const SURFACE_BAND = 4;
/** Cohort defs keyed by id — resolved once, read by addBeing + the tick. */
const COHORT_BY_ID = new Map(COHORT.map((d) => [d.id, d]));
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
/** Near-edge report cadence (seconds; also change-gated). */
const NEAR_EDGE_REPORT_S = 1;
/** Idle bob: local px amplitude + speed. */
const BOB_PX = 1.5;
const BOB_HZ = 1.6;
/** Crossing juice durations (seconds). */
const EXIT_S = 0.25;
const ENTER_S = 0.25;
const SPARK_S = 0.3;
/** Tier-2 structure glow: alpha pulse (the 6A landmark-pulse envelope). */
const GLOW_STRUCT_PERIOD_S = 2.8;
const GLOW_STRUCT_RANGE: [number, number] = [0.72, 1];
const GLOW_SUN_PERIOD_S = 4.2;
const GLOW_SUN_RANGE: [number, number] = [0.62, 1];
/** Tier-2 foliage sway: sub-cell x oscillation (local px; × WORLD_SCALE on
 *  screen), the parity planes counter-phased. Stays well under CW = 6. */
const SWAY_PX = 1.2;
const SWAY_HZ = 0.35;
/** Knit-sweep: a one-shot glow that runs across a newly-joined seam. */
const KNIT_S = 0.6;
const KNIT_SPAN = 6; // columns the sweep travels inward from the seam
/** Tier-2 polish: the sweep carries a trail; the seam ground brightens. */
const KNIT_TRAIL = ['█', '▓', '▒'] as const; // head → tail
const KNIT_GLOW_S = 0.9; // ground-brightening outlives the sweep a beat

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
  /** Last integer column counted toward footfall wear. */
  lastCol: number;
  text: BitmapText;
  /** Mid-handoff: walking stops until the broker acks. */
  pending: boolean;
  /** Exit/enter juice state (progress driven by elapsedS). */
  exitingSince: number | null;
  enteringSince: number | null;
  /** The REAL agent runtime (initialRuntime-built) — the mind. routeTier1
   *  reads/mutates it directly; carried across seams via society.ts. */
  mind: AgentRuntimeState;
  /** Land personality (beingIntents.ts LAND_PERSONAS). Cached at spawn. */
  persona: LandPersona;
}

export interface TerminalLandState {
  terminalId: string;
  wing: string;
  edges: { left: boolean; right: boolean };
  beings: Array<{ id: string; x: number; dir: number; intent: string; present: boolean }>;
  /** e2e ground truth for the join juice: live sweep count + total fired. */
  knits: { live: number; fired: number };
  /** Columns worn past the footfall threshold (session-scoped). */
  worn: number[];
  /** The joined neighbours' near-edge beings, projected into THIS land's
   *  column space (x < 0 / x > width-1 — just outside the local land). */
  neighbours: {
    left: Array<{ id: string; x: number }>;
    right: Array<{ id: string; x: number }>;
  };
}

declare global {
  interface Window {
    __terminal?: {
      state(): TerminalLandState;
      /** e2e only — teleport a being (e.g. next to an open edge so a
       *  crossing happens on demand instead of after minutes of wander). */
      debugPlace(id: string, x: number, dir: 1 | -1): boolean;
      /** e2e only — live depth-cue readback (glow alphas + sway offsets). */
      debugDepth(): { monument: number | null; sun: number | null; foliageX: number[] };
      /** e2e only — force footfall on a column (n passes); true if worn. */
      debugWear(col: number, passes: number): boolean;
    };
  }
}

/** FNV-1a 32-bit — wing string → land seed (local copy; seed.ts's hash is
 *  module-private and profile-shaped). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic-enough runtime rng for wander/juice (NOT procedural layout). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function mountTerminalLand(
  host: HTMLDivElement,
  theme: Theme,
  terminalId: string,
  wing: string,
): Promise<() => void> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: theme.palette.bg,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  host.appendChild(app.canvas);
  await waitForCozette();

  // Land dims from the (fixed-size) window at the scaled cell size. Equal
  // window sizes + equal scale across terminals ⇒ equal ground row ⇒
  // ground-line continuity once the broker aligns window y.
  const cols = Math.max(40, Math.floor(app.screen.width / (CW * WORLD_SCALE)));
  const rows = Math.max(20, Math.floor(app.screen.height / (CH * WORLD_SCALE)));
  const skyH = rows - SURFACE_BAND - 1 - UNDER_H;
  const seed = fnv1a(`terminal:${wing}`);
  // Memory stream (Tier-1 society): the desktop terminal gets the DB-backed
  // writer namespaced per wing; the web preview degrades to the null writer.
  // Each terminal window is its own renderer process → its own bootstrap.
  let memory = getCurrentMemoryWriter() ?? nullMemoryWriter;
  void bootstrapMemory({
    namespace: { cellId: cellIdFor(seed), libraryId: libraryIdFor(null) },
  }).then((r) => {
    memory = r.writer;
  });
  // Each wing owns a DISTINCT slice of the library — same games in the same
  // order across terminals made t1/t2 read as copies, not as two wings.
  // Deterministic rotation by wing hash; real profile wings replace this in T2.
  const rot = fnv1a(wing) % SAMPLE_LAND.length;
  const games: LandGame[] = Array.from(
    { length: 5 },
    (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length],
  );
  const composeOpts = { width: cols, skyH, surfaceBand: SURFACE_BAND, underH: UNDER_H, withPlayer: false };
  let model = composeLand(seed, games, composeOpts);

  // Persistent transform container; the land SCENE is a swappable child so a
  // join can recompose the terrain without disturbing beings / edges / sparks.
  const world = new Container();
  world.scale.set(WORLD_SCALE);
  app.stage.addChild(world);

  let scene = buildLandContainer(theme, model);
  let sceneContainer = scene.container;
  let contentH = scene.contentH;
  world.addChildAt(sceneContainer, 0);

  // Bottom anchor: dead space (if any) lives behind the sky, never below
  // the bedrock — the land sits on the window sill.
  const layoutWorld = (): void => {
    world.x = Math.floor((app.screen.width - model.width * CW * WORLD_SCALE) / 2);
    world.y = app.screen.height - contentH * WORLD_SCALE;
  };
  layoutWorld();

  // ── Worn paths (Tier 2): session-scoped footfall wear ──────────────────
  // Column entries accumulate; past WEAR_THRESHOLD the crust packs down
  // (▀ → ▔) — paths wear deeper where beings actually walk.
  const footfall = createFootfall();
  const refreshWear = (): void => {
    const crust = scene.layers.crust?.[0];
    if (crust) crust.text = crustLayerText(model, footfall.worn);
  };

  const recompose = (join: { left?: number; right?: number } | null): void => {
    model = composeLand(seed, games, join ? { ...composeOpts, join } : composeOpts);
    world.removeChild(sceneContainer);
    sceneContainer.destroy({ children: true });
    scene = buildLandContainer(theme, model);
    sceneContainer = scene.container;
    contentH = scene.contentH;
    world.addChildAt(sceneContainer, 0);
    layoutWorld();
    refreshWear(); // worn columns survive a join recompose
    structureCols = structureColumns(model.role);
  };

  // Approach targets: the labelled structure columns of the CURRENT model.
  let structureCols = structureColumns(model.role);

  // The joined neighbours' near-edge beings, per side (cross-edge
  // perception). Cleared when an edge closes; fed by the broker relay.
  const neighbourNear: { left: NearEdgeBeing[]; right: NearEdgeBeing[] } = { left: [], right: [] };
  let lastNearReport = '';
  let nearReportAt = 0;

  /** Live context for a BT pick. neighbourNear counts pull watch_edge
   *  decisively (society gravity — beings lean toward populated joins). */
  const intentCtx = (x: number): IntentContext => ({
    width: model.width,
    x,
    structureCols,
    edges,
    neighbourNear: { left: neighbourNear.left.length, right: neighbourNear.right.length },
  });

  // ── Edges: closed = wall; open = a bright threshold doorway ────────────
  let edges = { left: false, right: false };
  const edgeLayer = new Container(); // child of world → local cell space
  world.addChild(edgeLayer);
  /** Pulsing open-edge markers, animated in tick(). */
  const thresholds: BitmapText[] = [];

  const drawEdges = (): void => {
    thresholds.length = 0;
    edgeLayer.removeChildren().forEach((c) => c.destroy());
    for (const side of ['left', 'right'] as const) {
      const edgeCol = side === 'left' ? 0 : model.width - 1;
      const surfaceRow = model.surface[edgeCol];
      if (edges[side]) {
        // Open: a doorway at the ground line, not a wall — the existing
        // land edge vocabulary (‹ ›), brightened + pulsing.
        const mark = new BitmapText({
          text: side === 'left' ? '‹' : '›',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
        });
        mark.x = edgeCol * CW;
        mark.y = (surfaceRow - 1) * CH;
        edgeLayer.addChild(mark);
        thresholds.push(mark);
      } else {
        // Closed: a wall that visibly meets the land (fg, not fgDim — the
        // old wall failed the glance test).
        const lines: string[] = [];
        for (let y = 0; y < model.height; y++) {
          if (y === surfaceRow) lines.push(side === 'left' ? '▌' : '▐');
          else lines.push(y % 4 === 2 ? '╎' : '║');
        }
        const wall = new BitmapText({
          text: lines.join('\n'),
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fg) },
        });
        wall.x = edgeCol * CW;
        wall.y = 0;
        edgeLayer.addChild(wall);
      }
    }
  };

  /** Cache key of the current join seeds — recompose only when it changes.
   *  Initialised to the no-join key so the boot applyJoins doesn't recompose. */
  let joinKey = '|';
  const applyJoins = (joins: TerminalJoin[], wings: Record<string, string>): void => {
    const prev = edges;
    edges = {
      left: joins.some((j) => j.right === terminalId),
      right: joins.some((j) => j.left === terminalId),
    };
    if (!edges.left) neighbourNear.left = [];
    if (!edges.right) neighbourNear.right = [];
    const leftNb = joins.find((j) => j.right === terminalId)?.left;
    const rightNb = joins.find((j) => j.left === terminalId)?.right;
    const join: { left?: number; right?: number } = {};
    if (leftNb && wings[leftNb]) join.left = fnv1a(`terminal:${wings[leftNb]}`);
    if (rightNb && wings[rightNb]) join.right = fnv1a(`terminal:${wings[rightNb]}`);
    const key = `${join.left ?? ''}|${join.right ?? ''}`;
    if (key !== joinKey) {
      joinKey = key;
      recompose(join.left === undefined && join.right === undefined ? null : join);
      if (edges.left && !prev.left) startKnit('left');
      if (edges.right && !prev.right) startKnit('right');
    }
    drawEdges();
  };

  // ── Beings: the minimal walker runtime (sub-cell, juiced) ──────────────
  const beings = new Map<string, Being>();
  /** One-shot ✦ sparks at crossing thresholds: [text, bornAt]. */
  const sparks: Array<{ text: BitmapText; bornAt: number }> = [];
  /** One-shot knit sweeps: a glow that runs inward from a newly-joined seam. */
  const knits: Array<{
    side: 'left' | 'right';
    bornAt: number;
    /** Sweep head + trail glyphs (KNIT_TRAIL order), repositioned per tick. */
    trail: BitmapText[];
    /** One brightened crust glyph per seam column, fading in place. */
    glow: BitmapText[];
  }> = [];
  let knitsFired = 0;
  const rng = makeRng(fnv1a(`beings:${terminalId}`));
  let elapsedS = 0;

  const surfaceLocalY = (x: number): number => {
    const cx = Math.min(model.width - 1, Math.max(0, Math.floor(x)));
    return (model.surface[cx] - 1) * CH;
  };

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
    world.addChild(text); // world space → rides WORLD_SCALE for free
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

  const removeBeing = (id: string): void => {
    const b = beings.get(id);
    if (!b) return;
    b.text.destroy();
    beings.delete(id);
  };

  const spawnSpark = (side: 'left' | 'right'): void => {
    const edgeCol = side === 'left' ? 0 : model.width - 1;
    const spark = new BitmapText({
      text: '✦',
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
    });
    spark.x = edgeCol * CW;
    spark.y = surfaceLocalY(edgeCol) - CH; // a breath above the threshold
    world.addChild(spark);
    sparks.push({ text: spark, bornAt: elapsedS });
  };

  /** The fuse beat: on a fresh join, a bright block runs inward from the seam
   *  along the (now continuous) ground, fading as it goes. Both windows play
   *  it ground-line-aligned, so it reads as one sweep crossing the seam. */
  const startKnit = (side: 'left' | 'right'): void => {
    const mk = (glyph: string): BitmapText =>
      new BitmapText({
        text: glyph,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
      });
    const trail = KNIT_TRAIL.map((g) => {
      const t = mk(g);
      t.alpha = 0; // positioned on the first tick
      world.addChild(t);
      return t;
    });
    const glow: BitmapText[] = [];
    for (let i = 0; i < KNIT_SPAN; i++) {
      const col = side === 'left' ? i : model.width - 1 - i;
      const g = mk(model.char[model.surface[col]][col]); // the crust glyph, brightened
      g.x = col * CW;
      g.y = model.surface[col] * CH;
      g.alpha = 0.75;
      world.addChild(g);
      glow.push(g);
    }
    knits.push({ side, bornAt: elapsedS, trail, glow });
    knitsFired += 1;
  };

  // Spawn this land's RESIDENTS — the cohort members whose home is this
  // wing (broker-owned homes; null society = web preview, everyone lives
  // here). filterByTheme keeps cell semantics: a theme-excluded agent
  // (Ghost outside tokyo-night/catppuccin) never spawns; its home persists
  // harmlessly. Roster refusal (renderer reload) → skip, as before.
  const mountedAtMs = Date.now();
  // tickPresence's ctx narrows to Pick<BehaviorContext, 'prngs'>, whose
  // value type is procedural/prng.ts's Prng (not the land-local makeRng
  // stream) — mulberry32 runs the identical mulberry32 step as makeRng, so
  // the presence rolls stay the same seeded-runtime-behaviour class as the
  // rest of this file, just typed to satisfy the shared BehaviorContext.
  const presencePrngs = new Map<string, Prng>();
  void getTerminalSociety().then((society) => {
    const defs = filterByTheme(
      residentsOf(society, wing)
        .map((id) => COHORT_BY_ID.get(id))
        .filter((d): d is AgentDef => d !== undefined),
      theme.id,
    );
    defs.forEach((def, i) => {
      presencePrngs.set(def.id, mulberry32(fnv1a(`presence:${def.id}:${terminalId}`)));
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

  const tryExit = (b: Being, side: 'left' | 'right'): void => {
    b.pending = true;
    const carried = {
      speed: b.speed,
      dir: b.dir,
      intent: b.intent.kind,
      bobPhase: b.bobPhase,
      mind: carriedFromMind(b.mind),
    };
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

  const tick = (): void => {
    const dt = app.ticker.deltaMS / 1000;
    elapsedS += dt;

    // Near-edge report — ≤1 Hz AND change-gated, so IPC stays bounded.
    if (elapsedS >= nearReportAt) {
      nearReportAt = elapsedS + NEAR_EDGE_REPORT_S;
      const near = nearEdgeSummary(
        [...beings.values()].filter((b) => !b.pending && b.mind.present).map((b) => ({ id: b.id, x: b.x })),
        model.width,
        edges,
      );
      const key = JSON.stringify(near);
      if (key !== lastNearReport) {
        lastNearReport = key;
        terminalReportNearEdge(terminalId, near);
      }
    }

    // Open-edge doorways breathe.
    for (const t of thresholds) t.alpha = 0.55 + 0.45 * Math.sin(elapsedS * 3);

    // Tier-2 structure glow: monuments (and a hall, if one ever composes
    // here) pulse gently; ☼ sun/lamps cycle slower. Cos-eased off elapsedS
    // (deltaMS-accumulated), so it freezes cleanly under throttle.
    const glow = (periodS: number, [lo, hi]: [number, number]): number =>
      lo + (hi - lo) * (0.5 - 0.5 * Math.cos(((elapsedS % periodS) / periodS) * 2 * Math.PI));
    const structAlpha = glow(GLOW_STRUCT_PERIOD_S, GLOW_STRUCT_RANGE);
    for (const t of scene.layers.monument ?? []) t.alpha = structAlpha;
    for (const t of scene.layers.hall ?? []) t.alpha = structAlpha;
    const sunAlpha = glow(GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE);
    for (const t of scene.layers.sun ?? []) t.alpha = sunAlpha;

    // Tier-2 foliage sway: sub-cell x offsets, parity planes counter-phased
    // (glyphs move BETWEEN cells — never snap-to-cell).
    const sway = Math.sin(elapsedS * SWAY_HZ * 2 * Math.PI) * SWAY_PX;
    (scene.layers.foliage ?? []).forEach((t, i) => {
      t.x = i % 2 === 0 ? sway : -sway;
    });

    // Crossing sparks fade out.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      const p = (elapsedS - s.bornAt) / SPARK_S;
      if (p >= 1) {
        s.text.destroy();
        sparks.splice(i, 1);
      } else s.text.alpha = 1 - p;
    }

    // Knit sweeps: a bright head + 2-glyph trail runs inward from the seam
    // along the (continuous) ground while the seam ground itself brightens,
    // then everything fades (the glow outlives the sweep by KNIT_GLOW_S − KNIT_S).
    for (let i = knits.length - 1; i >= 0; i--) {
      const k = knits[i];
      const p = (elapsedS - k.bornAt) / KNIT_S;
      const q = (elapsedS - k.bornAt) / KNIT_GLOW_S;
      if (p >= 1 && k.trail.length > 0) {
        for (const t of k.trail) t.destroy();
        k.trail.length = 0;
      }
      if (k.trail.length > 0) {
        const dirIn = k.side === 'left' ? 1 : -1;
        const headCol =
          k.side === 'left'
            ? Math.min(model.width - 1, Math.round(p * KNIT_SPAN))
            : Math.max(0, model.width - 1 - Math.round(p * KNIT_SPAN));
        k.trail.forEach((t, j) => {
          const col = Math.min(model.width - 1, Math.max(0, headCol - dirIn * j));
          t.x = col * CW;
          t.y = (model.surface[col] - 1) * CH;
          t.alpha = Math.max(0, (1 - p) * (1 - j * 0.3));
        });
      }
      if (q >= 1) {
        for (const g of k.glow) g.destroy();
        knits.splice(i, 1);
        continue;
      }
      for (const g of k.glow) g.alpha = 0.75 * (1 - q);
    }

    for (const b of beings.values()) {
      // Exit juice: slide one cell past the edge while fading, then go.
      if (b.exitingSince !== null) {
        const p = (elapsedS - b.exitingSince) / EXIT_S;
        if (p >= 1) {
          removeBeing(b.id);
          continue;
        }
        b.text.x = Math.round((b.x + b.dir * p) * CW);
        b.text.y = surfaceLocalY(b.x);
        b.text.alpha = 1 - p;
        continue;
      }
      // Entry juice: fade in while already walking inward.
      if (b.enteringSince !== null) {
        const p = (elapsedS - b.enteringSince) / ENTER_S;
        if (p >= 1) {
          b.enteringSince = null;
          b.text.alpha = 1;
        } else b.text.alpha = p;
      }

      // Presence dynamics (Visitor's cycle, Ghost's rare apparitions) —
      // tickPresence reuses the CELL's schedule rules on the real mind.
      // Absent: invisible, no walking, no crossings; the roster home holds.
      const def = COHORT_BY_ID.get(b.id);
      if (def && def.schedule.length > 0) {
        tickPresence(def, b.mind, { prngs: presencePrngs }, mountedAtMs, Date.now());
      }
      b.text.visible = b.mind.present;
      if (!b.mind.present) continue;

      if (!b.pending) {
        // BT re-pick on cadence (or forced when an intent invalidates).
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

      b.text.x = Math.round(b.x * CW);
      b.text.y = surfaceLocalY(b.x) + Math.sin(elapsedS * BOB_HZ * 6.283 + b.bobPhase) * BOB_PX;

      // Footfall: count column ENTRIES (not frames) toward path wear.
      const col = Math.round(b.x);
      if (col !== b.lastCol) {
        b.lastCol = col;
        if (footfall.step(col)) refreshWear();
      }
    }
  };
  app.ticker.add(tick);

  // ── Broker wiring ────────────────────────────────────────────────────────
  const unsubTopology = subscribeTerminalTopology(({ joins, wings }) => applyJoins(joins, wings));
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side, state, from }) => {
    if (beings.has(agentId)) return; // duplicate guard
    spawnSpark(side);
    const b = addBeing(agentId, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1, true);
    b.crossCooldownUntil = elapsedS + CROSS_COOLDOWN_S; // anti-ping-pong
    if (!presencePrngs.has(agentId)) {
      presencePrngs.set(agentId, mulberry32(fnv1a(`presence:${agentId}:${terminalId}`)));
    }
    const surfaceRow = model.surface[Math.round(b.x)] ?? 0;
    if (state) {
      // RESUME, don't respawn: gait + phase carry over; the intent
      // continues in this land's terms (chain-aware watch_edge, nearest
      // structure for approach). Missing state (stale preload) degrades
      // to the fresh-spawn defaults addBeing already chose.
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
  const unsubNeighbour = subscribeTerminalNeighbourSummary(({ side, beings: bs }) => {
    neighbourNear[side] = bs;
  });
  void getTerminalTopology().then(({ joins, wings }) => applyJoins(joins, wings));
  drawEdges();

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
        present: b.mind.present,
      })),
      knits: { live: knits.length, fired: knitsFired },
      worn: [...footfall.worn].sort((a, b) => a - b),
      neighbours: {
        left: projectAcrossEdge('left', model.width, neighbourNear.left),
        right: projectAcrossEdge('right', model.width, neighbourNear.right),
      },
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
    debugDepth: () => ({
      monument: scene.layers.monument?.[0]?.alpha ?? null,
      sun: scene.layers.sun?.[0]?.alpha ?? null,
      foliageX: (scene.layers.foliage ?? []).map((t) => t.x),
    }),
    debugWear: (col, passes) => {
      let crossed = false;
      for (let i = 0; i < passes; i++) if (footfall.step(col)) crossed = true;
      if (crossed) refreshWear();
      return footfall.worn.has(col);
    },
  };

  return () => {
    unsubTopology();
    unsubEnter();
    unsubNeighbour();
    app.ticker.remove(tick);
    delete window.__terminal;
    app.destroy(true, { children: true });
  };
}
