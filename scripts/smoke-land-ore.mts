/** Ore-vein smoke — `npx tsx scripts/smoke-land-ore.mts`.
 *  #19 slice 2: short diagonal glints in stone/bedrock. The stone-or-bedrock
 *  role guard at stamp time is the whole placement rule — caverns, topsoil,
 *  the shaft and relics are excluded by construction; these checks pin the
 *  observable consequences. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, ORE_GLYPH, SAMPLE_LAND, type LandRole } from '../src/procedural/land.ts';
import { strataMaterialGlyph } from '../src/render/levels/land.ts';
const { check, report } = makeChecker('smoke land-ore');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 10, withPlayer: false } as const;

let totalOre = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, T);
  const ore: Array<{ x: number; y: number; c: string }> = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++)
      if (m.role[y][x] === 'ore') ore.push({ x, y, c: m.char[y][x] });
  totalOre += ore.length;

  check(`seed ${seed}: ore glyph is ORE_GLYPH`, ore.every((o) => o.c === ORE_GLYPH));
  // Depth: strictly underground. (The stronger no-topsoil rule is enforced by
  // the stone-or-bedrock role guard at stamp time; strata bands key off
  // groundLine while the surface rolls ±2 per column, so a fixed surface+N
  // depth check here would flake on low-ground columns.)
  check(`seed ${seed}: ore strictly underground`, ore.every((o) => o.y > m.surface[o.x]),
    JSON.stringify(ore.filter((o) => o.y <= m.surface[o.x])));
  // Sparse: 2–4 veins × ≤4 cells = 16 max per strip.
  check(`seed ${seed}: ore stays sparse (<= 16 cells)`, ore.length <= 16, String(ore.length));
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, SAMPLE_LAND, T)));
}
check('ore exists across the seed set', totalOre >= 5, String(totalOre));

// The slice-1 material pass must leave ore alone: ore is not a strata-fill
// role, so the run-coherent redraw returns null for it.
check('material pass ignores ore', strataMaterialGlyph('ore' as LandRole, 3, 3) === null);

report();
