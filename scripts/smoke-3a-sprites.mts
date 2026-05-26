/**
 * Phase 3A smoke — `npx tsx scripts/smoke-3a-sprites.mts`.
 *
 * The PIXI Sprite path itself only runs in a real WebGL context;
 * this smoke covers the pure-TS infrastructure around it:
 *   - placeholder PNG generator produces valid 6×13 RGBA bytes for
 *     every theme in src/themes/
 *   - the on-disk PNGs match the generator's output (idempotent)
 *   - tile → slot mapping: T_BOOKSHELF → 'bookshelf', everything else
 *     resolves to no slot (renderer falls back to glyph)
 *   - textureForTile returns null when slot is unmapped OR when the
 *     atlas doesn't carry that slot
 *   - textureForTile returns the supplied texture when both branches
 *     align (using an opaque placeholder cast to Texture)
 *   - spriteUrl builds the public-root path Vite serves
 *   - PixelArtProvider contract: noopProvider throws on generate; the
 *     interface stub has the expected shape
 *   - pickProvider: prefers local-sdxl when probe says local-capable;
 *     falls back to pixellab; falls back to noop
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const {
  tileHasSpriteSlot,
  textureForTile,
  spriteUrl,
  TILE_TO_SLOT_VIEW,
  resetSpriteAtlasCache,
} = await import('../src/render/sprites.ts');
const { T_BOOKSHELF, T_FLOOR, T_WALL_H, T_TABLE } = await import(
  '../src/procedural/tiles/library.ts'
);
const { noopProvider, probeHardware, pickProvider } = await import(
  '../src/agents/pixelart.ts'
);

let passed = 0;
let failed = 0;
const failures: string[] = [];
function assert(cond: unknown, msg: string): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}

console.log('\n[smoke 3a] sprite atlas + PixelArtProvider scaffold\n');

console.log('Step 1 — placeholder generator runs cleanly');
const genResult = spawnSync(
  'npx',
  ['tsx', path.join(REPO_ROOT, 'scripts', 'gen-placeholder-sprites.mts')],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);
assert(genResult.status === 0, `generator exit status (got ${genResult.status})`);
assert(
  /wrote \d+ sprites/.test(genResult.stdout),
  'generator stdout reports wrote N sprites',
);

console.log('\nStep 2 — every theme has a baked bookshelf PNG');
const themesDir = path.join(REPO_ROOT, 'src', 'themes');
const themeIds: string[] = [];
for (const entry of fs.readdirSync(themesDir)) {
  if (!entry.endsWith('.json')) continue;
  const raw = JSON.parse(
    fs.readFileSync(path.join(themesDir, entry), 'utf8'),
  ) as { id: string };
  themeIds.push(raw.id);
}
assert(themeIds.length >= 5, `≥5 themes (got ${themeIds.length})`);
for (const id of themeIds) {
  const png = path.join(REPO_ROOT, 'public', 'sprites', id, 'bookshelf.png');
  assert(fs.existsSync(png), `${id} bookshelf.png exists`);
  const bytes = fs.readFileSync(png);
  assert(
    bytes.slice(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    `${id} PNG signature valid`,
  );
  // IHDR is bytes 8–32; width at 16-19, height at 20-23 (big-endian).
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert(width === 6, `${id} width = 6 (got ${width})`);
  assert(height === 13, `${id} height = 13 (got ${height})`);
  // Color type 6 = RGBA.
  assert(bytes[25] === 6, `${id} color type = RGBA (got ${bytes[25]})`);
}

console.log('\nStep 3 — tile → slot mapping is bookshelf-only');
assert(
  TILE_TO_SLOT_VIEW.get(T_BOOKSHELF) === 'bookshelf',
  'T_BOOKSHELF → bookshelf',
);
assert(TILE_TO_SLOT_VIEW.get(T_FLOOR) === undefined, 'T_FLOOR has no slot');
assert(TILE_TO_SLOT_VIEW.get(T_WALL_H) === undefined, 'T_WALL_H has no slot');
assert(TILE_TO_SLOT_VIEW.get(T_TABLE) === undefined, 'T_TABLE has no slot');
assert(tileHasSpriteSlot(T_BOOKSHELF), 'tileHasSpriteSlot(T_BOOKSHELF) true');
assert(!tileHasSpriteSlot(T_FLOOR), 'tileHasSpriteSlot(T_FLOOR) false');

console.log('\nStep 4 — textureForTile resolves correctly');
type FakeTex = { __id: string };
const fakeBookshelfTex = { __id: 'bookshelf-tex' } as FakeTex;
const atlas = {
  themeId: 'solarized-dark',
  textures: new Map([
    ['bookshelf', fakeBookshelfTex as unknown],
  ]) as unknown as ReadonlyMap<string, unknown>,
};
// Use a small type assertion to bridge the FakeTex stand-in to the
// real signature without pulling in PIXI here.
type AtlasLike = Parameters<typeof textureForTile>[0];
const atlasLike = atlas as unknown as AtlasLike;
assert(
  (textureForTile(atlasLike, T_BOOKSHELF) as unknown) === fakeBookshelfTex,
  'bookshelf tile resolves to the loaded texture',
);
assert(
  textureForTile(atlasLike, T_FLOOR) === null,
  'floor tile resolves to null (no slot)',
);
const emptyAtlas = {
  themeId: 'gruvbox-dark',
  textures: new Map(),
} as unknown as AtlasLike;
assert(
  textureForTile(emptyAtlas, T_BOOKSHELF) === null,
  'bookshelf tile resolves to null when atlas missing the slot',
);

console.log('\nStep 5 — spriteUrl builds public-root paths');
assert(
  spriteUrl('solarized-dark', 'bookshelf') === '/sprites/solarized-dark/bookshelf.png',
  'solarized path',
);
assert(
  spriteUrl('tokyo-night', 'bookshelf') === '/sprites/tokyo-night/bookshelf.png',
  'tokyo-night path',
);

console.log('\nStep 6 — PixelArtProvider noopProvider throws on generate');
assert(noopProvider.id === 'noop', 'noopProvider.id = "noop"');
let threw = false;
try {
  await noopProvider.generate({
    themeId: 'solarized-dark',
    slotId: 'bookshelf',
  });
} catch (e) {
  threw = true;
  assert(
    String((e as Error).message).includes('no provider wired yet'),
    'noopProvider throws with explanatory message',
  );
}
assert(threw, 'noopProvider.generate rejected');

console.log('\nStep 7 — probeHardware returns the 3A stub');
const probe = await probeHardware();
assert(probe.localCapable === false, 'localCapable false (3A stub)');
assert(probe.vramBytes === null, 'vramBytes null (3A stub)');
assert(
  probe.reason.includes('phase-3A stub'),
  'reason mentions 3A stub',
);

console.log('\nStep 8 — pickProvider picks the right provider given a probe');
const fakeLocal = { id: 'local-sdxl', generate: async () => { throw new Error('x'); } };
const fakeCloud = { id: 'pixellab', generate: async () => { throw new Error('x'); } };
const fullRegistry = new Map([
  ['local-sdxl', fakeLocal],
  ['pixellab', fakeCloud],
]);
const cloudOnly = new Map([['pixellab', fakeCloud]]);
const empty = new Map();

assert(
  pickProvider(fullRegistry, { localCapable: true, vramBytes: 12 * 1024 ** 3, reason: 'gpu' }) === fakeLocal,
  'localCapable + local in registry → local-sdxl',
);
assert(
  pickProvider(fullRegistry, { localCapable: false, vramBytes: null, reason: 'no gpu' }) === fakeCloud,
  '!localCapable + cloud available → pixellab',
);
assert(
  pickProvider(cloudOnly, { localCapable: true, vramBytes: 16 * 1024 ** 3, reason: 'gpu' }) === fakeCloud,
  'localCapable but local missing from registry → falls back to pixellab',
);
assert(
  pickProvider(empty, { localCapable: true, vramBytes: 24 * 1024 ** 3, reason: 'gpu' }) === noopProvider,
  'empty registry → noopProvider',
);

console.log('\nStep 9 — generator is byte-identical on re-run');
const before = new Map<string, Buffer>();
for (const id of themeIds) {
  const p = path.join(REPO_ROOT, 'public', 'sprites', id, 'bookshelf.png');
  before.set(id, fs.readFileSync(p));
}
const rerun = spawnSync(
  'npx',
  ['tsx', path.join(REPO_ROOT, 'scripts', 'gen-placeholder-sprites.mts')],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);
assert(rerun.status === 0, 'second generator run succeeds');
let driftCount = 0;
for (const id of themeIds) {
  const p = path.join(REPO_ROOT, 'public', 'sprites', id, 'bookshelf.png');
  const after = fs.readFileSync(p);
  if (!after.equals(before.get(id)!)) driftCount++;
}
assert(driftCount === 0, `0 themes drift across runs (got ${driftCount} different)`);

resetSpriteAtlasCache();
console.log(`\n[smoke 3a] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
