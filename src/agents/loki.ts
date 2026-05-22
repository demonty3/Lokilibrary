import { BitmapText } from 'pixi.js';
import type { Application, Container, TickerCallback } from 'pixi.js';
import { mulberry32, type Prng } from '../procedural/prng';
import type { CellLayout } from '../procedural/cell';
import { T_FLOOR } from '../procedural/tiles/library';
import type { Theme } from '../themes/types';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../render/fonts';

/**
 * Phase 1 Loki — a single sprite that random-walks the floor of the
 * cell, deterministically (seeded PRNG namespaced as `seed ^ 0x10ki`).
 * **No LLM call.** Tier 1 + Tier 2 agent dialogue is Phase 2 territory;
 * Phase 0's `/api/agent/tick` round-trip stays as a boot-time
 * verification log but doesn't drive movement here.
 *
 * The sprite is the magenta `L`. Step interval is 400ms — slow enough
 * that a static glance at the room shows the agent moving, not so fast
 * that they teleport around. Random-walk only considers floor cells as
 * candidates; walls + bookshelves + tables + door + window are not
 * walkable.
 *
 * Per CLAUDE.md "agent-as-marginalia": no chat, no speech bubble. The
 * agent's presence is the feature.
 */

const MOVE_INTERVAL_MS = 400;

// PRNG namespace — `LOKI` in leetspeak as hex. Keeps Loki's random walk
// independent of the cell layout's PRNG even though both start from the
// same profileSeed.
const LOKI_SEED_NAMESPACE = 0x10ce;

interface LokiState {
  x: number;
  y: number;
  prng: Prng;
  accumMs: number;
}

export function mountLoki(
  app: Application,
  parent: Container,
  theme: Theme,
  layout: CellLayout,
  seed: number,
): () => void {
  const prng = mulberry32((seed ^ LOKI_SEED_NAMESPACE) >>> 0);

  // Pick a starting floor cell that isn't the player's spawn (so the
  // L and the @ don't overlap at boot).
  const floors: Array<[number, number]> = [];
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (
        layout.tiles[y][x] === T_FLOOR &&
        !(x === layout.spawnAt.x && y === layout.spawnAt.y)
      ) {
        floors.push([x, y]);
      }
    }
  }
  const [startX, startY] = floors.length > 0 ? prng.pick(floors) : [1, 1];

  const loki: LokiState = { x: startX, y: startY, prng, accumMs: 0 };

  const sprite = new BitmapText({
    text: 'L',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.magenta),
    },
  });
  sprite.x = loki.x * COZETTE_CELL_WIDTH;
  sprite.y = loki.y * COZETTE_CELL_HEIGHT;
  parent.addChild(sprite);

  const tick: TickerCallback<unknown> = (ticker) => {
    loki.accumMs += ticker.deltaMS;
    if (loki.accumMs < MOVE_INTERVAL_MS) return;
    loki.accumMs = 0;

    const candidates: Array<[number, number]> = [];
    const dirs: ReadonlyArray<[number, number]> = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = loki.x + dx;
      const ny = loki.y + dy;
      if (nx < 0 || nx >= layout.width || ny < 0 || ny >= layout.height) continue;
      if (layout.tiles[ny][nx] === T_FLOOR) candidates.push([nx, ny]);
    }
    if (candidates.length === 0) return;
    const [nx, ny] = loki.prng.pick(candidates);
    loki.x = nx;
    loki.y = ny;
    sprite.x = loki.x * COZETTE_CELL_WIDTH;
    sprite.y = loki.y * COZETTE_CELL_HEIGHT;
  };
  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    sprite.destroy();
  };
}
