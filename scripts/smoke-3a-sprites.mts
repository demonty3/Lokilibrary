/**
 * Phase 3A/3B smoke — `npx tsx scripts/smoke-3a-sprites.mts`.
 *
 * The PIXI Sprite path itself only runs in a real WebGL context;
 * this smoke covers the pure-TS infrastructure around it:
 *   - placeholder PNG generator produces valid 6×13 RGBA bytes for
 *     every (theme, slot) pair (3B: 11 slots × N themes)
 *   - on-disk PNGs are byte-identical on re-run (idempotent)
 *   - tile → slot mapping covers every non-floor tile in the library
 *     bible; T_FLOOR stays unmapped (renderer falls back to the · glyph)
 *   - textureForTile returns null when slot is unmapped OR when the
 *     atlas doesn't carry that slot; returns the supplied texture
 *     when both branches align
 *   - generator's LAYOUTS registry agrees with sprites.ts KNOWN_SLOTS
 *     (caught by counting on-disk PNGs vs expected slot count)
 *   - spriteUrl builds the public-root path Vite serves
 *   - PixelArtProvider contract: noopProvider throws on generate; the
 *     interface stub has the expected shape
 *   - pickProvider: prefers local-sdxl when probe says local-capable;
 *     falls back to pixellab; falls back to noop
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
const {
  T_BOOKSHELF,
  T_CORNER_BL,
  T_CORNER_BR,
  T_CORNER_TL,
  T_CORNER_TR,
  T_DOOR,
  T_FLOOR,
  T_TABLE,
  T_TEE,
  T_WALL_H,
  T_WALL_V,
  T_WINDOW,
} = await import('../src/procedural/tiles/library.ts');
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

// The set of slot ids 3B's generator + atlas both must know about.
// Drift here is caught by the per-(theme, slot) PNG existence check
// in step 2, plus the tile→slot assertions in step 3.
const EXPECTED_SLOTS = [
  'bookshelf',
  'wall-h',
  'wall-v',
  'corner-tl',
  'corner-tr',
  'corner-bl',
  'corner-br',
  'tee',
  'door',
  'window',
  'table',
] as const;

console.log('\n[smoke 3a/3b] sprite atlas + PixelArtProvider scaffold\n');

console.log('Step 1 — placeholder generator runs cleanly');
const genResult = spawnSync(
  'npx',
  ['tsx', path.join(REPO_ROOT, 'scripts', 'gen-placeholder-sprites.mts')],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);
assert(genResult.status === 0, `generator exit status (got ${genResult.status})`);
assert(
  /wrote \d+ sprites across \d+ themes/.test(genResult.stdout),
  'generator stdout reports wrote N sprites across M themes',
);

console.log('\nStep 2 — every (theme, slot) has a valid baked PNG');
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
let totalChecked = 0;
let totalInvalid = 0;
for (const id of themeIds) {
  for (const slot of EXPECTED_SLOTS) {
    const png = path.join(REPO_ROOT, 'public', 'sprites', id, `${slot}.png`);
    if (!fs.existsSync(png)) {
      totalInvalid++;
      assert(false, `${id}/${slot}.png missing`);
      continue;
    }
    const bytes = fs.readFileSync(png);
    const sigOk = bytes
      .slice(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const colorType = bytes[25];
    if (!sigOk || width !== 6 || height !== 13 || colorType !== 6) {
      totalInvalid++;
      assert(
        false,
        `${id}/${slot}.png invalid (sig=${sigOk} w=${width} h=${height} ct=${colorType})`,
      );
      continue;
    }
    totalChecked++;
  }
}
assert(
  totalInvalid === 0,
  `0 invalid PNGs (got ${totalInvalid} bad of ${totalChecked + totalInvalid})`,
);
assert(
  totalChecked === themeIds.length * EXPECTED_SLOTS.length,
  `checked all ${themeIds.length} themes × ${EXPECTED_SLOTS.length} slots = ${themeIds.length * EXPECTED_SLOTS.length} PNGs`,
);

console.log('\nStep 3 — tile → slot mapping covers every non-floor tile');
const tileSlotPairs: ReadonlyArray<[number, string, string]> = [
  [T_BOOKSHELF, 'bookshelf', 'T_BOOKSHELF'],
  [T_WALL_H, 'wall-h', 'T_WALL_H'],
  [T_WALL_V, 'wall-v', 'T_WALL_V'],
  [T_CORNER_TL, 'corner-tl', 'T_CORNER_TL'],
  [T_CORNER_TR, 'corner-tr', 'T_CORNER_TR'],
  [T_CORNER_BL, 'corner-bl', 'T_CORNER_BL'],
  [T_CORNER_BR, 'corner-br', 'T_CORNER_BR'],
  [T_TEE, 'tee', 'T_TEE'],
  [T_DOOR, 'door', 'T_DOOR'],
  [T_WINDOW, 'window', 'T_WINDOW'],
  [T_TABLE, 'table', 'T_TABLE'],
];
for (const [tileId, expectedSlot, name] of tileSlotPairs) {
  assert(
    TILE_TO_SLOT_VIEW.get(tileId) === expectedSlot,
    `${name} → ${expectedSlot}`,
  );
  assert(tileHasSpriteSlot(tileId), `tileHasSpriteSlot(${name}) true`);
}
// Floor stays unmapped — the · glyph is the cheaper render for the
// majority tile.
assert(TILE_TO_SLOT_VIEW.get(T_FLOOR) === undefined, 'T_FLOOR has no slot');
assert(!tileHasSpriteSlot(T_FLOOR), 'tileHasSpriteSlot(T_FLOOR) false');

console.log('\nStep 4 — textureForTile resolves correctly');
type FakeTex = { __id: string };
const fakeBookshelfTex = { __id: 'bookshelf-tex' } as FakeTex;
const fakeWallHTex = { __id: 'wall-h-tex' } as FakeTex;
const fakeDoorTex = { __id: 'door-tex' } as FakeTex;
const atlas = {
  themeId: 'solarized-dark',
  textures: new Map<string, unknown>([
    ['bookshelf', fakeBookshelfTex],
    ['wall-h', fakeWallHTex],
    ['door', fakeDoorTex],
  ]) as unknown as ReadonlyMap<string, unknown>,
};
type AtlasLike = Parameters<typeof textureForTile>[0];
const atlasLike = atlas as unknown as AtlasLike;
assert(
  (textureForTile(atlasLike, T_BOOKSHELF) as unknown) === fakeBookshelfTex,
  'bookshelf tile resolves to the loaded texture',
);
assert(
  (textureForTile(atlasLike, T_WALL_H) as unknown) === fakeWallHTex,
  'wall_h tile resolves to the loaded texture',
);
assert(
  (textureForTile(atlasLike, T_DOOR) as unknown) === fakeDoorTex,
  'door tile resolves to the loaded texture',
);
assert(
  textureForTile(atlasLike, T_FLOOR) === null,
  'floor tile resolves to null (no slot)',
);
assert(
  textureForTile(atlasLike, T_TABLE) === null,
  'table tile resolves to null when atlas missing the slot',
);
const emptyAtlas = {
  themeId: 'gruvbox-dark',
  textures: new Map(),
} as unknown as AtlasLike;
assert(
  textureForTile(emptyAtlas, T_BOOKSHELF) === null,
  'empty atlas → null for every slot',
);

console.log('\nStep 5 — spriteUrl builds public-root paths');
assert(
  spriteUrl('solarized-dark', 'bookshelf') === '/sprites/solarized-dark/bookshelf.png',
  'solarized bookshelf path',
);
assert(
  spriteUrl('tokyo-night', 'wall-h') === '/sprites/tokyo-night/wall-h.png',
  'tokyo-night wall-h path',
);
assert(
  spriteUrl('gruvbox-dark', 'corner-tl') === '/sprites/gruvbox-dark/corner-tl.png',
  'gruvbox corner-tl path',
);
assert(
  spriteUrl('catppuccin-mocha', 'door') === '/sprites/catppuccin-mocha/door.png',
  'catppuccin door path',
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

console.log('\nStep 9 — generator is byte-identical across all (theme, slot) on re-run');
const before = new Map<string, Buffer>();
for (const id of themeIds) {
  for (const slot of EXPECTED_SLOTS) {
    const p = path.join(REPO_ROOT, 'public', 'sprites', id, `${slot}.png`);
    before.set(`${id}/${slot}`, fs.readFileSync(p));
  }
}
const rerun = spawnSync(
  'npx',
  ['tsx', path.join(REPO_ROOT, 'scripts', 'gen-placeholder-sprites.mts')],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);
assert(rerun.status === 0, 'second generator run succeeds');
let driftCount = 0;
for (const id of themeIds) {
  for (const slot of EXPECTED_SLOTS) {
    const p = path.join(REPO_ROOT, 'public', 'sprites', id, `${slot}.png`);
    const after = fs.readFileSync(p);
    if (!after.equals(before.get(`${id}/${slot}`)!)) driftCount++;
  }
}
assert(
  driftCount === 0,
  `0 (theme, slot) pairs drift across runs (got ${driftCount} different of ${themeIds.length * EXPECTED_SLOTS.length})`,
);

resetSpriteAtlasCache();
console.log(`\n[smoke 3a/3b] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
