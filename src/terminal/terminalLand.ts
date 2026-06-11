/**
 * T0 spike — the terminal-window land view (docs/PRD-snapping-terminals.md).
 *
 * A terminal window shows ONE wing as a side-on land. The main-process
 * broker tells us which of our edges are joined to a neighbour terminal:
 * joined edges OPEN (the frame parts and beings can walk out of the window);
 * closed edges are walls (beings turn around).
 *
 * Beings here are the spike's minimal walker runtime — the land previously
 * baked beings as static glyphs; these are live: they wander the surface
 * height field, and at an open edge they hand themselves to the broker
 * (`terminal:agentExit`) and continue in the neighbour window. The roster
 * lives in the MAIN process (single-roaming-roster, 7D.2 semantics across
 * process boundaries). Wander randomness is runtime behaviour (like cell
 * agents), not procedural layout — the LAND itself stays seed-deterministic.
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
import { composeLand } from '../procedural/land';
import {
  getTerminalTopology,
  subscribeTerminalAgentEnter,
  subscribeTerminalTopology,
  terminalAgentExit,
  terminalAgentSpawn,
  type TerminalJoin,
} from '../api/electron';

// ── T0 spike knobs ─────────────────────────────────────────────────────────
const BEINGS_PER_TERMINAL = 3;
const BEING_GLYPHS = ['L', 'A', 'M', 'C', 'V'];
const BEING_SPEED_CELLS_PER_S: [number, number] = [1.2, 2.6];
/** Mean seconds between wander direction flips. */
const FLIP_MEAN_S = 4;

interface Being {
  id: string;
  glyph: string;
  x: number; // cells, float
  dir: 1 | -1;
  speed: number; // cells/sec
  nextFlipAt: number; // elapsed-seconds timestamp
  text: BitmapText;
  /** Mid-handoff: ticker skips it until the broker acks. */
  pending: boolean;
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

/** Deterministic-enough runtime rng for wander (NOT procedural layout). */
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

  // Land dims from the (fixed-size) window so the world fills the frame.
  // Equal window sizes across terminals ⇒ equal rows ⇒ equal ground row ⇒
  // ground-line continuity once the broker aligns window y.
  const cols = Math.max(60, Math.floor(app.screen.width / CW));
  const rows = Math.max(24, Math.floor(app.screen.height / CH));
  const underH = 8;
  const surfaceBand = 4;
  const skyH = rows - surfaceBand - 1 - underH - 1; // -1: title row
  const seed = fnv1a(`terminal:${wing}`);
  const model = composeLand(seed, undefined, { width: cols, skyH, surfaceBand, underH, withPlayer: false });
  const { container: world, contentH } = buildLandContainer(theme, model);
  world.y = Math.floor((app.screen.height - contentH) / 2) + Math.floor(CH / 2);
  app.stage.addChild(world);

  // Title — the terminal's identity, tmux-style. (Frameless + drag region
  // is T1; under the spike's native frame this is still the world's label.)
  const title = new BitmapText({
    text: `┤ ${wing} terminal ├`,
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgDim) },
  });
  title.x = Math.floor((app.screen.width - title.width) / 2);
  title.y = 2;
  app.stage.addChild(title);

  // ── Edges: closed = wall glyphs; open = cleared (the join) ─────────────
  let edges = { left: false, right: false };
  const edgeLayer = new Container();
  app.stage.addChild(edgeLayer);

  const drawEdges = (): void => {
    edgeLayer.removeChildren().forEach((c) => c.destroy());
    for (const side of ['left', 'right'] as const) {
      if (edges[side]) continue; // open — the world runs out of the window
      const lines: string[] = [];
      for (let y = 0; y < model.height; y++) lines.push(y % 4 === 2 ? '╎' : '║');
      const wall = new BitmapText({
        text: lines.join('\n'),
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgDim) },
      });
      wall.x = side === 'left' ? 0 : (model.width - 1) * CW;
      wall.y = world.y;
      edgeLayer.addChild(wall);
    }
  };

  const applyJoins = (joins: TerminalJoin[]): void => {
    edges = {
      left: joins.some((j) => j.right === terminalId),
      right: joins.some((j) => j.left === terminalId),
    };
    drawEdges();
  };

  // ── Beings: the minimal walker runtime ──────────────────────────────────
  const beings = new Map<string, Being>();
  const rng = makeRng(fnv1a(`beings:${terminalId}`));
  let elapsedS = 0;

  const surfaceYpx = (x: number): number => {
    const cx = Math.min(model.width - 1, Math.max(0, Math.floor(x)));
    return world.y + (model.surface[cx] - 1) * CH;
  };

  const addBeing = (id: string, glyph: string, x: number, dir: 1 | -1): Being => {
    const text = new BitmapText({
      text: glyph,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.violet) },
    });
    app.stage.addChild(text);
    const being: Being = {
      id,
      glyph,
      x,
      dir,
      speed: BEING_SPEED_CELLS_PER_S[0] + rng() * (BEING_SPEED_CELLS_PER_S[1] - BEING_SPEED_CELLS_PER_S[0]),
      nextFlipAt: elapsedS + rng() * FLIP_MEAN_S * 2,
      text,
      pending: false,
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
        removeBeing(b.id);
      } else {
        b.pending = false;
        b.dir = side === 'left' ? 1 : -1; // refused — turn around
      }
    });
  };

  const tick = (): void => {
    const dt = app.ticker.deltaMS / 1000;
    elapsedS += dt;
    for (const b of beings.values()) {
      if (b.pending) continue;
      if (elapsedS >= b.nextFlipAt) {
        b.dir = rng() < 0.5 ? 1 : -1;
        b.nextFlipAt = elapsedS + rng() * FLIP_MEAN_S * 2;
      }
      b.x += b.dir * b.speed * dt;
      if (b.x <= 0) {
        if (edges.left) {
          tryExit(b, 'left');
          continue;
        }
        b.x = 0;
        b.dir = 1;
      } else if (b.x >= model.width - 1) {
        if (edges.right) {
          tryExit(b, 'right');
          continue;
        }
        b.x = model.width - 1;
        b.dir = -1;
      }
      b.text.x = Math.round(b.x * CW); // sub-cell motion, cell-rounded draw
      b.text.y = surfaceYpx(b.x);
    }
  };
  app.ticker.add(tick);

  // ── Broker wiring ────────────────────────────────────────────────────────
  const unsubTopology = subscribeTerminalTopology(({ joins }) => applyJoins(joins));
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side }) => {
    if (beings.has(agentId)) return; // duplicate guard
    const glyph = agentId.match(/-([A-Z])\d+$/)?.[1] ?? 'V';
    addBeing(agentId, glyph, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1);
  });
  void getTerminalTopology().then(({ joins }) => applyJoins(joins));
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
