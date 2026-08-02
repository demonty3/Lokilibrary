/** Strata material-read smoke — `npx tsx scripts/smoke-land-material.mts`.
 *  Land polish #19 slice 1: strataMaterialGlyph redraws undialected strata
 *  cells in horizontal runs so the bands read as material, not letter-noise.
 *  Render-side only — the composed model must stay byte-identical. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, type LandRole } from '../src/procedural/land.ts';
import { strataMaterialGlyph } from '../src/render/levels/land.ts';
const { check, report } = makeChecker('smoke land-material');

const STRATA: LandRole[] = ['topsoil', 'stone', 'bedrock'];
const COVERED = new Set(['░', '▒', '▓', '█']);

// 1 — determinism: same (role, x, y) → same glyph, across repeated calls.
let stable = true;
for (const r of STRATA)
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 80; x++)
      if (strataMaterialGlyph(r, x, y) !== strataMaterialGlyph(r, x, y)) stable = false;
check('deterministic per (role,x,y)', stable);

// 2 — run-coherence: within a row, glyphs form runs of RUN_LEN (6) columns —
// equal inside a run boundary, with at least one boundary change per row span
// somewhere in the band (all-constant would mean the hash is degenerate).
let coherent = true;
let boundaries = 0;
for (const r of STRATA)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 120; x++) {
      const a = strataMaterialGlyph(r, x, y);
      const b = strataMaterialGlyph(r, Math.floor(x / 6) * 6, y);
      if (a !== b) coherent = false; // every cell matches its run's anchor
    }
    for (let run = 1; run < 20; run++)
      if (strataMaterialGlyph(r, run * 6, y) !== strataMaterialGlyph(r, (run - 1) * 6, y)) boundaries++;
  }
check('cells equal within their 6-col run', coherent);
check('run boundaries actually vary the glyph', boundaries > 20, String(boundaries));

// 3 — the material varies by ROW too (horizontal banding needs vertical
// variation or the whole stratum collapses to one texture).
const rowVariety = new Set(Array.from({ length: 10 }, (_, y) => strataMaterialGlyph('stone', 0, y))).size;
check('glyph varies across rows', rowVariety > 1, String(rowVariety));

// 4 — role scoping: null for every non-strata role; distinct classes per role
// (topsoil never draws ▓; bedrock never draws ▒).
const nonStrata: LandRole[] = ['sky', 'crust', 'cavern', 'foliage', 'monument', 'being', 'mural', 'ridge'];
check('null for non-strata roles', nonStrata.every((r) => strataMaterialGlyph(r, 3, 3) === null));
const drawn = (r: LandRole): Set<string> => {
  const s = new Set<string>();
  for (let y = 0; y < 12; y++) for (let x = 0; x < 240; x++) s.add(strataMaterialGlyph(r, x, y) as string);
  return s;
};
check('topsoil stays light (no ▓)', !drawn('topsoil').has('▓'));
check('bedrock skips the mid tone (no ▒)', !drawn('bedrock').has('▒'));
check('all material glyphs atlas-covered', STRATA.every((r) => [...drawn(r)].every((g) => COVERED.has(g))));

// 5 — the render-side contract: composing the land is untouched by the
// material's existence (the function reads nothing from the model).
const T = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false } as const;
const a = JSON.stringify(composeLand(7, SAMPLE_LAND, T));
for (let i = 0; i < 50; i++) strataMaterialGlyph('stone', i, 3);
const b = JSON.stringify(composeLand(7, SAMPLE_LAND, T));
check('composeLand byte-identical around material calls', a === b);

report();
