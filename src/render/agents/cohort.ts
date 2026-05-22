/**
 * Cohort renderer. Mounts one BitmapText sprite per visible agent,
 * owns a single Ticker that runs Tier-0 BT + presence updates for the
 * whole cohort, and reposititions each sprite from its runtime state.
 *
 * One Ticker for the whole cohort (rather than per-agent) keeps the
 * frame budget predictable and the teardown path symmetrical with
 * `mountCell`. Per-agent tick *cadence* is enforced inside
 * `tickBehavior` via `def.tier0StepMs` + `runtime.actionEndsAt`, so
 * Cat is not woken up every frame just because Loki is.
 *
 * Presence (Visitor / Ghost) toggles `runtime.present` + sprite
 * `visible`. Sprites stay attached when absent so re-appearance doesn't
 * need to rebuild the BitmapText.
 */

import { BitmapText, Container } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { CellLayout, CellPoint } from '../../procedural/cell';
import type { Theme } from '../../themes/types';
import { mulberry32, type Prng } from '../../procedural/prng';
import {
  COHORT,
  filterByTheme,
  resolveSpawn,
} from '../../agents/cohort';
import {
  tickBehavior,
  tickPresence,
  type BehaviorContext,
} from '../../agents/behavior';
import {
  clearRuntimes,
  initialRuntime,
  listRuntimes,
  setRuntime,
} from '../../state/agentRuntime';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

export interface MountCohortOptions {
  app: Application;
  parent: Container;
  theme: Theme;
  layout: CellLayout;
  /** Seed for per-agent PRNG namespacing. Use the same seed as the
   *  cell layout so the cohort positions are stable for a given profile. */
  seed: number;
  /** Glyph → cell positions, built from the scatter pass. Used by Cat's
   *  `bias_idle_near_glyph` schedule. */
  scatterAnchors?: ReadonlyMap<string, readonly CellPoint[]>;
  /** Wall-clock provider — defaults to `new Date().getHours()`. Tests
   *  inject a fake clock here. */
  wallClockHour?: () => number;
}

export function mountCohort(opts: MountCohortOptions): () => void {
  const defs = filterByTheme(COHORT, opts.theme.id);
  const sprites = new Map<string, BitmapText>();
  const prngs = new Map<string, Prng>();
  const mountedAt = performance.now();

  // Per-agent PRNG namespacing. Hash the agent id into a 32-bit salt
  // so the seed-mix is stable + collision-resistant for the 5 agents.
  for (const def of defs) {
    const agentSalt = fnvHash(def.id);
    prngs.set(def.id, mulberry32((opts.seed ^ agentSalt) >>> 0));
  }

  // Reset runtimes (previous mount's cell may have left stale state).
  clearRuntimes();

  for (const def of defs) {
    const spawn = resolveSpawn(def.spawn, opts.layout, opts.seed);
    setRuntime(initialRuntime({ id: def.id, x: spawn.x, y: spawn.y }));

    const sprite = new BitmapText({
      text: def.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(opts.theme.palette[def.paletteKey]),
      },
    });
    sprite.x = spawn.x * COZETTE_CELL_WIDTH;
    sprite.y = spawn.y * COZETTE_CELL_HEIGHT;
    opts.parent.addChild(sprite);
    sprites.set(def.id, sprite);
  }

  const ctx: BehaviorContext = {
    layout: opts.layout,
    prngs,
    scatterAnchors: opts.scatterAnchors ?? new Map(),
    wallClockHour: opts.wallClockHour ?? (() => new Date().getHours()),
  };

  const defById = new Map(defs.map((d) => [d.id, d]));

  const tick: TickerCallback<unknown> = () => {
    const now = performance.now();
    for (const runtime of listRuntimes()) {
      const def = defById.get(runtime.id);
      if (!def) continue;
      tickPresence(def, runtime, ctx, mountedAt, now);
      tickBehavior(def, runtime, ctx, now);
      const sprite = sprites.get(runtime.id);
      if (!sprite) continue;
      sprite.visible = runtime.present;
      const px = runtime.x * COZETTE_CELL_WIDTH;
      const py = runtime.y * COZETTE_CELL_HEIGHT;
      if (sprite.x !== px) sprite.x = px;
      if (sprite.y !== py) sprite.y = py;
    }
  };
  opts.app.ticker.add(tick);

  return () => {
    opts.app.ticker.remove(tick);
    for (const sprite of sprites.values()) sprite.destroy();
    sprites.clear();
    prngs.clear();
    clearRuntimes();
  };
}

/** FNV-1a hash of a string → uint32. Kept inline (rather than importing
 *  from `procedural/seed.ts`) because cohort lives outside `procedural/`
 *  and we want this to be standalone. Same algorithm; cross-checked
 *  against seed.ts for compatibility. */
function fnvHash(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
