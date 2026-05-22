/**
 * Loki spawn helper. Phase 1 shipped `mountLoki` here as a one-off
 * random-walk Ticker; Phase 2B replaced the per-agent renderer with
 * `mountCohort` in `src/render/agents/cohort.ts`, so all that lives in
 * this file now is the spawn-cell picker. Kept here (rather than
 * inlined into cohort.ts) because:
 *
 *   1. `src/procedural/scatter.ts` uses it as an extra keepout so
 *      decor doesn't overlap Loki at boot — neither cohort nor scatter
 *      should depend on the other, but both depend on this.
 *   2. Loki's spawn is intentionally distinct from the generic
 *      `random_floor` rule (always near a bookshelf, never the player
 *      tile), and is the only spawn rule that needs the layout's
 *      bookshelfSlots specifically.
 *
 * PRNG namespace: `seed ^ 0x10ce` — `LOCE` in leetspeak. Matches Phase
 * 1 so existing layouts keep Loki in the same spot across the upgrade.
 */

import { mulberry32 } from '../procedural/prng';
import type { CellLayout, CellPoint } from '../procedural/cell';
import { T_FLOOR } from '../procedural/tiles/library';

const LOKI_SEED_NAMESPACE = 0x10ce;

export function pickLokiSpawn(layout: CellLayout, seed: number): CellPoint {
  const prng = mulberry32((seed ^ LOKI_SEED_NAMESPACE) >>> 0);
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
  if (floors.length === 0) return { x: 1, y: 1 };
  const [x, y] = prng.pick(floors);
  return { x, y };
}
