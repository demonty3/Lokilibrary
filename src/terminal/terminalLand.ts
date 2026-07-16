/**
 * T0 spike — the terminal-window land view (docs/PRD-snapping-terminals.md).
 *
 * A terminal window shows ONE wing as a side-on land. The main-process
 * broker tells us which of our edges are joined to a neighbour terminal:
 * joined edges OPEN (a bright threshold doorway at the ground line); closed
 * edges are walls (beings turn around).
 *
 * Beings here are the spike's minimal walker runtime — live walkers riding
 * the surface height field with sub-cell motion (float x + idle bob +
 * hesitation beats — beings, not a process). At an open edge they hand
 * themselves to the broker (`terminal:agentExit`) and continue in the
 * neighbour window: exit eases out past the edge, entry fades in off a ✦
 * spark. The roster lives in the MAIN process (single-roaming-roster, 7D.2
 * semantics across process boundaries). Wander/juice randomness is runtime
 * behaviour (like cell agents), not procedural layout — the LAND itself
 * stays seed-deterministic. All animation rides app.ticker.deltaMS
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
import { composeLand, SAMPLE_LAND, type LandGame } from '../procedural/land';
import {
  getTerminalTopology,
  subscribeTerminalAgentEnter,
  subscribeTerminalTopology,
  terminalAgentExit,
  terminalAgentSpawn,
  type TerminalJoin,
} from '../api/electron';

// ── T0 spike knobs ─────────────────────────────────────────────────────────
/** Integer up-scale — 1× Cozette fails the glance test in a 640px window. */
const WORLD_SCALE = 2;
const UNDER_H = 10;
const SURFACE_BAND = 4;
const BEINGS_PER_TERMINAL = 3;
const BEING_GLYPHS = ['L', 'A', 'M', 'C', 'V'];
const BEING_SPEED_CELLS_PER_S: [number, number] = [1.2, 2.6];
/** Mean seconds between wander direction flips. */
const FLIP_MEAN_S = 4;
/** Hesitation beat at each flip (min + seeded extra, seconds). */
const HESITATE_S: [number, number] = [0.3, 0.5];
/** Idle bob: local px amplitude + speed. */
const BOB_PX = 1.5;
const BOB_HZ = 1.6;
/** Crossing juice durations (seconds). */
const EXIT_S = 0.25;
const ENTER_S = 0.25;
const SPARK_S = 0.3;

interface Being {
  id: string;
  glyph: string;
  x: number; // cells, float
  dir: 1 | -1;
  speed: number; // cells/sec
  nextFlipAt: number; // elapsed-seconds timestamp
  pausedUntil: number; // hesitation beat after a flip
  bobPhase: number;
  text: BitmapText;
  /** Mid-handoff: walking stops until the broker acks. */
  pending: boolean;
  /** Exit/enter juice state (progress driven by elapsedS). */
  exitingSince: number | null;
  enteringSince: number | null;
}

export interface TerminalLandState {
  terminalId: string;
  wing: string;
  edges: { left: boolean; right: boolean };
  beings: Array<{ id: string; x: number; dir: number }>;
}

declare global {
  interface Window {
    __terminal?: {
      state(): TerminalLandState;
      /** e2e only — teleport a being (e.g. next to an open edge so a
       *  crossing happens on demand instead of after minutes of wander). */
      debugPlace(id: string, x: number, dir: 1 | -1): boolean;
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

  const recompose = (join: { left?: number; right?: number } | null): void => {
    model = composeLand(seed, games, join ? { ...composeOpts, join } : composeOpts);
    world.removeChild(sceneContainer);
    sceneContainer.destroy({ children: true });
    scene = buildLandContainer(theme, model);
    sceneContainer = scene.container;
    contentH = scene.contentH;
    world.addChildAt(sceneContainer, 0);
    layoutWorld();
  };

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

  /** Cache key of the current join seeds — recompose only when it changes. */
  let joinKey = '';
  const applyJoins = (joins: TerminalJoin[], wings: Record<string, string>): void => {
    edges = {
      left: joins.some((j) => j.right === terminalId),
      right: joins.some((j) => j.left === terminalId),
    };
    const leftNb = joins.find((j) => j.right === terminalId)?.left;
    const rightNb = joins.find((j) => j.left === terminalId)?.right;
    const join: { left?: number; right?: number } = {};
    if (leftNb && wings[leftNb]) join.left = fnv1a(`terminal:${wings[leftNb]}`);
    if (rightNb && wings[rightNb]) join.right = fnv1a(`terminal:${wings[rightNb]}`);
    const key = `${join.left ?? ''}|${join.right ?? ''}`;
    if (key !== joinKey) {
      joinKey = key;
      recompose(join.left === undefined && join.right === undefined ? null : join);
    }
    drawEdges();
  };

  // ── Beings: the minimal walker runtime (sub-cell, juiced) ──────────────
  const beings = new Map<string, Being>();
  /** One-shot ✦ sparks at crossing thresholds: [text, bornAt]. */
  const sparks: Array<{ text: BitmapText; bornAt: number }> = [];
  const rng = makeRng(fnv1a(`beings:${terminalId}`));
  let elapsedS = 0;

  const surfaceLocalY = (x: number): number => {
    const cx = Math.min(model.width - 1, Math.max(0, Math.floor(x)));
    return (model.surface[cx] - 1) * CH;
  };

  const addBeing = (id: string, glyph: string, x: number, dir: 1 | -1, entering = false): Being => {
    const text = new BitmapText({
      text: glyph,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
    });
    if (entering) text.alpha = 0;
    world.addChild(text); // world space → rides WORLD_SCALE for free
    const being: Being = {
      id,
      glyph,
      x,
      dir,
      speed: BEING_SPEED_CELLS_PER_S[0] + rng() * (BEING_SPEED_CELLS_PER_S[1] - BEING_SPEED_CELLS_PER_S[0]),
      nextFlipAt: elapsedS + rng() * FLIP_MEAN_S * 2,
      pausedUntil: 0,
      bobPhase: (fnv1a(id) % 628) / 100,
      text,
      pending: false,
      exitingSince: null,
      enteringSince: entering ? elapsedS : null,
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

  // Spawn this terminal's natives (roster registers them; a refusal means
  // the id is already live elsewhere — e.g. a renderer reload — so skip).
  for (let i = 0; i < BEINGS_PER_TERMINAL; i++) {
    const glyph = BEING_GLYPHS[(fnv1a(terminalId) + i) % BEING_GLYPHS.length];
    const id = `${terminalId}-${glyph}${i}`;
    void terminalAgentSpawn(id, terminalId).then((ok) => {
      if (ok) addBeing(id, glyph, 6 + ((i * 37) % (model.width - 12)), i % 2 === 0 ? 1 : -1);
    });
  }

  const tryExit = (b: Being, side: 'left' | 'right'): void => {
    b.pending = true;
    void terminalAgentExit(b.id, terminalId, side).then((accepted) => {
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

    // Open-edge doorways breathe.
    for (const t of thresholds) t.alpha = 0.55 + 0.45 * Math.sin(elapsedS * 3);

    // Crossing sparks fade out.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      const p = (elapsedS - s.bornAt) / SPARK_S;
      if (p >= 1) {
        s.text.destroy();
        sparks.splice(i, 1);
      } else s.text.alpha = 1 - p;
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

      if (!b.pending) {
        if (elapsedS >= b.nextFlipAt) {
          // A beat of hesitation before committing to the new direction.
          b.dir = rng() < 0.5 ? 1 : -1;
          b.pausedUntil = elapsedS + HESITATE_S[0] + rng() * HESITATE_S[1];
          b.nextFlipAt = elapsedS + rng() * FLIP_MEAN_S * 2;
        }
        if (elapsedS >= b.pausedUntil) b.x += b.dir * b.speed * dt;
        if (b.x <= 0) {
          if (edges.left) {
            tryExit(b, 'left');
          } else {
            b.x = 0;
            b.dir = 1;
          }
        } else if (b.x >= model.width - 1) {
          if (edges.right) {
            tryExit(b, 'right');
          } else {
            b.x = model.width - 1;
            b.dir = -1;
          }
        }
      }

      b.text.x = Math.round(b.x * CW);
      b.text.y = surfaceLocalY(b.x) + Math.sin(elapsedS * BOB_HZ * 6.283 + b.bobPhase) * BOB_PX;
    }
  };
  app.ticker.add(tick);

  // ── Broker wiring ────────────────────────────────────────────────────────
  const unsubTopology = subscribeTerminalTopology(({ joins, wings }) => applyJoins(joins, wings));
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side }) => {
    if (beings.has(agentId)) return; // duplicate guard
    const glyph = agentId.match(/-([A-Z])\d+$/)?.[1] ?? 'V';
    spawnSpark(side);
    addBeing(agentId, glyph, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1, true);
  });
  void getTerminalTopology().then(({ joins, wings }) => applyJoins(joins, wings));
  drawEdges();

  window.__terminal = {
    state: () => ({
      terminalId,
      wing,
      edges: { ...edges },
      beings: [...beings.values()].map((b) => ({ id: b.id, x: Math.round(b.x * 10) / 10, dir: b.dir })),
    }),
    debugPlace: (id, x, dir) => {
      const b = beings.get(id);
      if (!b || b.pending) return false;
      b.x = Math.min(model.width - 1, Math.max(0, x));
      b.dir = dir;
      b.pausedUntil = 0;
      b.nextFlipAt = elapsedS + 30; // hold course long enough to cross
      return true;
    },
  };

  return () => {
    unsubTopology();
    unsubEnter();
    app.ticker.remove(tick);
    delete window.__terminal;
    app.destroy(true, { children: true });
  };
}
