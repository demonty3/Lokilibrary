/**
 * Fast terminal preview of the REAL side-on land composer
 * (`src/procedural/land.ts`) — prints the char grid (no colour) so the
 * composition can be tuned in seconds without a build/harness cycle. Colour
 * separation only shows in the PIXI render (`__loki.previewLand` via the e2e
 * harness); this is purely for iterating the BONES.
 *
 * Run: npx tsx scripts/proto-land.mts [seed]
 */

import { composeLand } from '../src/procedural/land.ts';

const SEED = Number(process.argv[2] ?? 0xca11ed) >>> 0;
const model = composeLand(SEED);

// eslint-disable-next-line no-console
console.log(`\n  seed=0x${SEED.toString(16)}   ${model.width}×${model.height} slice (world scrolls wider)\n`);
// eslint-disable-next-line no-console
console.log(model.char.map((r) => r.join('').replace(/\s+$/u, '')).join('\n'));
