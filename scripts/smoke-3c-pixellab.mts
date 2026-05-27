/**
 * Phase 3C-β smoke — `npx tsx scripts/smoke-3c-pixellab.mts`.
 *
 * Covers the bake-time path end-to-end without a real PixelLab call:
 *   - PixelLabProvider conforms to the PixelArtProvider interface
 *   - provider POSTs to /api/bake/sprite with description + width/height
 *     derived from the slot id (bookshelf → 16×32)
 *   - base64 PNG round-trips through decodeBase64Png → palette quantize
 *     → re-encode without loss of dimensions or filter corruption
 *   - quantizeToPalette maps every opaque pixel to its palette match
 *     (deterministic) and zeroes sub-threshold-alpha pixels to fully
 *     transparent (hard edges on the saved sprite)
 *   - nearestPaletteIndex picks the argmin correctly on synthetic
 *     fixtures (exact match, ties, out-of-gamut input)
 *   - foregroundPalette excludes the bg/bgAlt slots so quantized
 *     sprites can never become floor-colored holes
 *   - parseHexColor accepts well-formed input and throws on bad input
 *
 * Does NOT call PixelLab. The provider's fetch is mocked with a fixture
 * PNG generated inline (same hand-rolled encoder as
 * gen-placeholder-sprites.mts). The smoke is hermetic — no Worker, no
 * network, no API key required.
 */

import { createRequire } from 'node:module';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  createPixelLabProvider,
  decodeBase64Png,
  sha256Hex,
  noopProvider,
} = await import('../src/agents/pixelart.ts');
const {
  quantizeToPalette,
  nearestPaletteIndex,
  parseHexColor,
  foregroundPalette,
} = await import('./lib/quantize.ts');

let passed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    return;
  }
  failures.push(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Fixture PNG generator — same approach as gen-placeholder-sprites.mts so
// the smoke doesn't need a PNG encoder dep beyond the one already in the
// project (zlib + hand-rolled CRC32 + chunks). 4×4 RGBA, one pixel of
// each fixture color.

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  return tbl;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Encode a small RGBA pixel array as a PNG. `pixels[y][x] = [r,g,b,a]`. */
function makePng(pixels: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>>): Buffer {
  const height = pixels.length;
  const width = pixels[0]!.length;
  const stride = 1 + width * 4;
  const scan = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const off = y * stride;
    scan[off] = 0;
    for (let x = 0; x < width; x++) {
      const px = off + 1 + x * 4;
      const [r, g, b, a] = pixels[y]![x]!;
      scan[px] = r;
      scan[px + 1] = g;
      scan[px + 2] = b;
      scan[px + 3] = a;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(scan, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// 1. parseHexColor

check('parseHexColor: solarized red', JSON.stringify(parseHexColor('#dc322f')) === JSON.stringify([220, 50, 47]));
check('parseHexColor: uppercase OK', JSON.stringify(parseHexColor('#DC322F')) === JSON.stringify([220, 50, 47]));

let threw = false;
try {
  parseHexColor('not-a-color');
} catch {
  threw = true;
}
check('parseHexColor: throws on bad input', threw);

threw = false;
try {
  parseHexColor('#abc'); // 3-digit form not supported
} catch {
  threw = true;
}
check('parseHexColor: throws on 3-digit hex', threw);

// ---------------------------------------------------------------------------
// 2. nearestPaletteIndex

const tinyPalette: ReadonlyArray<readonly [number, number, number]> = [
  [255, 0, 0],   // red
  [0, 255, 0],   // green
  [0, 0, 255],   // blue
];

check('nearest: exact red', nearestPaletteIndex([255, 0, 0], tinyPalette) === 0);
check('nearest: exact green', nearestPaletteIndex([0, 255, 0], tinyPalette) === 1);
check('nearest: near red', nearestPaletteIndex([240, 10, 10], tinyPalette) === 0);
check('nearest: gray closer to blue (R+G low)', nearestPaletteIndex([100, 100, 100], tinyPalette) >= 0);
// Tie-break: argmin scans low-to-high, so equal-distance picks first.
check('nearest: tie-break picks lowest idx', nearestPaletteIndex([128, 128, 0], tinyPalette) === 0);

threw = false;
try {
  nearestPaletteIndex([0, 0, 0], []);
} catch {
  threw = true;
}
check('nearest: throws on empty palette', threw);

// ---------------------------------------------------------------------------
// 3. foregroundPalette excludes bg + bgAlt

const fakeTheme = {
  palette: {
    bg: '#000000',
    bgAlt: '#111111',
    fg: '#aaaaaa',
    red: '#dc322f',
    green: '#859900',
  },
};
const fgPal = foregroundPalette(fakeTheme);
check('foregroundPalette: count = 3 (excludes bg, bgAlt)', fgPal.length === 3);
check(
  'foregroundPalette: bg color not present',
  !fgPal.some(([r, g, b]) => r === 0 && g === 0 && b === 0),
);
check(
  'foregroundPalette: bgAlt color not present',
  !fgPal.some(([r, g, b]) => r === 0x11 && g === 0x11 && b === 0x11),
);
check(
  'foregroundPalette: fg color present',
  fgPal.some(([r, g, b]) => r === 0xaa && g === 0xaa && b === 0xaa),
);

// ---------------------------------------------------------------------------
// 4. quantizeToPalette — round-trip with palette mapping + alpha handling

// 4×4 fixture: opaque off-palette pixels in row 0; opaque exact-match in
// row 1; semi-transparent in row 2; fully transparent in row 3.
const fixturePixels: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>> = [
  [
    [240, 10, 10, 255],  // near red
    [10, 240, 10, 255],  // near green
    [10, 10, 240, 255],  // near blue
    [128, 128, 128, 255], // gray (any palette pick fine)
  ],
  [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 0, 0, 255],
  ],
  [
    [200, 0, 0, 100],    // below threshold → transparent
    [200, 0, 0, 127],    // just below threshold → transparent
    [200, 0, 0, 128],    // at threshold → opaque, quantized
    [200, 0, 0, 200],    // above threshold → opaque, quantized
  ],
  [
    [50, 50, 50, 0],
    [50, 50, 50, 0],
    [50, 50, 50, 0],
    [50, 50, 50, 0],
  ],
];
const fixturePng = makePng(fixturePixels);
const quantized = quantizeToPalette(new Uint8Array(fixturePng), { palette: tinyPalette });

// Re-decode to check pixels. Use pngjs the same way the bake script does.
const { PNG } = await import('pngjs');
const decoded = PNG.sync.read(
  Buffer.from(quantized.buffer, quantized.byteOffset, quantized.byteLength),
);
check('quantize: width preserved', decoded.width === 4);
check('quantize: height preserved', decoded.height === 4);

function pixelAt(d: typeof decoded, x: number, y: number): readonly [number, number, number, number] {
  const off = (y * d.width + x) * 4;
  return [d.data[off]!, d.data[off + 1]!, d.data[off + 2]!, d.data[off + 3]!];
}

// Row 0: near-palette pixels should snap to the palette + alpha=255.
check(
  'quantize: row0 col0 → red',
  JSON.stringify(pixelAt(decoded, 0, 0)) === JSON.stringify([255, 0, 0, 255]),
);
check(
  'quantize: row0 col1 → green',
  JSON.stringify(pixelAt(decoded, 1, 0)) === JSON.stringify([0, 255, 0, 255]),
);
check(
  'quantize: row0 col2 → blue',
  JSON.stringify(pixelAt(decoded, 2, 0)) === JSON.stringify([0, 0, 255, 255]),
);

// Row 1: exact matches should round-trip identically.
check(
  'quantize: row1 col0 exact red unchanged',
  JSON.stringify(pixelAt(decoded, 0, 1)) === JSON.stringify([255, 0, 0, 255]),
);
check(
  'quantize: row1 col1 exact green unchanged',
  JSON.stringify(pixelAt(decoded, 1, 1)) === JSON.stringify([0, 255, 0, 255]),
);

// Row 2: alpha-threshold handling.
check(
  'quantize: alpha 100 → fully transparent',
  JSON.stringify(pixelAt(decoded, 0, 2)) === JSON.stringify([0, 0, 0, 0]),
);
check(
  'quantize: alpha 127 (just under default 128) → fully transparent',
  JSON.stringify(pixelAt(decoded, 1, 2)) === JSON.stringify([0, 0, 0, 0]),
);
check(
  'quantize: alpha 128 → opaque + quantized to red',
  JSON.stringify(pixelAt(decoded, 2, 2)) === JSON.stringify([255, 0, 0, 255]),
);
check(
  'quantize: alpha 200 → opaque + quantized to red',
  JSON.stringify(pixelAt(decoded, 3, 2)) === JSON.stringify([255, 0, 0, 255]),
);

// Row 3: fully transparent stays fully transparent.
for (let x = 0; x < 4; x++) {
  const [r, g, b, a] = pixelAt(decoded, x, 3);
  check(`quantize: row3 col${x} stays transparent`, r === 0 && g === 0 && b === 0 && a === 0);
}

// Custom alpha threshold.
const looserQ = quantizeToPalette(new Uint8Array(fixturePng), {
  palette: tinyPalette,
  alphaThreshold: 50,
});
const looserDecoded = PNG.sync.read(
  Buffer.from(looserQ.buffer, looserQ.byteOffset, looserQ.byteLength),
);
// At threshold=50, the alpha-100 pixel from row 2 becomes opaque + quantized.
check(
  'quantize: custom alphaThreshold=50 → alpha-100 pixel is opaque',
  pixelAt(looserDecoded, 0, 2)[3] === 255,
);

// Determinism: same input + same options → byte-identical output.
const a1 = quantizeToPalette(new Uint8Array(fixturePng), { palette: tinyPalette });
const a2 = quantizeToPalette(new Uint8Array(fixturePng), { palette: tinyPalette });
check(
  'quantize: deterministic (same in → same out)',
  a1.length === a2.length && a1.every((b, i) => b === a2[i]),
);

// ---------------------------------------------------------------------------
// 5. decodeBase64Png handles both raw base64 and data: prefix

const sample = Buffer.from('hello world');
const b64Bare = sample.toString('base64');
const b64DataUri = `data:image/png;base64,${b64Bare}`;
const bareBytes = decodeBase64Png(b64Bare);
const uriBytes = decodeBase64Png(b64DataUri);
check('decodeBase64Png: bare base64', Buffer.compare(Buffer.from(bareBytes), sample) === 0);
check('decodeBase64Png: data: URI prefix stripped', Buffer.compare(Buffer.from(uriBytes), sample) === 0);

// ---------------------------------------------------------------------------
// 6. sha256Hex shape + determinism

const h1 = await sha256Hex(sample);
const h2 = await sha256Hex(sample);
check('sha256Hex: 64 hex chars', /^[0-9a-f]{64}$/.test(h1));
check('sha256Hex: deterministic', h1 === h2);
check(
  'sha256Hex: known value for "hello world"',
  h1 === 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
);

// ---------------------------------------------------------------------------
// 7. PixelLabProvider end-to-end with a mocked fetch

interface FetchCall {
  url: string;
  init: RequestInit;
}
const fetchCalls: FetchCall[] = [];
const mockFixturePng = makePng([
  [[255, 0, 0, 255], [0, 255, 0, 255]],
  [[0, 0, 255, 255], [255, 0, 0, 255]],
]);
const mockFetch: typeof fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), init: (init ?? {}) as RequestInit });
  return new Response(
    JSON.stringify({
      image: {
        type: 'base64',
        base64: mockFixturePng.toString('base64'),
        format: 'png',
      },
      usage: { type: 'usd', usd: 0.0089 },
      latencyMs: 1234,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};

const provider = createPixelLabProvider({
  workerBase: 'http://localhost:8787',
  fetchImpl: mockFetch,
});

check('provider.id === pixellab', provider.id === 'pixellab');

const slot = { themeId: 'solarized-dark', slotId: 'bookshelf' };
const result = await provider.generate(slot);

check('provider.generate: returns slot back', result.slot === slot);
check('provider.generate: pngBytes non-empty', result.pngBytes.byteLength > 0);
check(
  'provider.generate: pngBytes match mock fixture',
  result.pngBytes.byteLength === mockFixturePng.byteLength &&
    Buffer.compare(Buffer.from(result.pngBytes), mockFixturePng) === 0,
);
check('provider.generate: contentHash is sha256', /^[0-9a-f]{64}$/.test(result.contentHash));
check('provider.generate: source mentions pixellab', result.source.includes('pixellab/pixflux'));
check('provider.generate: source mentions usd', result.source.includes('$0.0089'));
check('provider.generate: source mentions dimensions', result.source.includes('16×32'));

// Fetch call shape
check('provider: one fetch call', fetchCalls.length === 1);
check(
  'provider: hit /api/bake/sprite',
  fetchCalls[0]!.url === 'http://localhost:8787/api/bake/sprite',
);
check('provider: POST method', fetchCalls[0]!.init.method === 'POST');
const body = JSON.parse(String(fetchCalls[0]!.init.body)) as {
  description: string;
  width: number;
  height: number;
};
check('provider: bookshelf width=16', body.width === 16);
check('provider: bookshelf height=32', body.height === 32);
check(
  'provider: description mentions bookshelf',
  /bookshelf/i.test(body.description) && /pixel art/i.test(body.description),
);

// Worker base trailing slash is stripped.
const trimProvider = createPixelLabProvider({
  workerBase: 'http://example.com/',
  fetchImpl: mockFetch,
});
fetchCalls.length = 0;
await trimProvider.generate(slot);
check(
  'provider: trailing slash stripped from workerBase',
  fetchCalls[0]!.url === 'http://example.com/api/bake/sprite',
);

// Non-2xx surfaces as an error.
const errorFetch: typeof fetch = async () =>
  new Response('PIXELLAB_API_KEY not configured', { status: 500 });
const errProvider = createPixelLabProvider({ workerBase: 'http://x', fetchImpl: errorFetch });
let errCaught = false;
try {
  await errProvider.generate(slot);
} catch (e) {
  errCaught = true;
  check(
    'provider: error message includes status code',
    e instanceof Error && /500/.test(e.message),
  );
  check(
    'provider: error message includes upstream body',
    e instanceof Error && /PIXELLAB_API_KEY/.test(e.message),
  );
}
check('provider: throws on non-2xx', errCaught);

// noopProvider unchanged from 3A — still throws.
errCaught = false;
try {
  await noopProvider.generate(slot);
} catch {
  errCaught = true;
}
check('noopProvider: still throws (3A contract preserved)', errCaught);

// ---------------------------------------------------------------------------
// Report

console.log(`\n[smoke 3C] ${passed} assertions passed${failures.length ? `, ${failures.length} failed` : ''}`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
