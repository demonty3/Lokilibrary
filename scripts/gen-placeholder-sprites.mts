/**
 * Phase 3A — generate placeholder bookshelf sprites per theme into
 * `public/sprites/{theme_id}/bookshelf.png`. Each sprite is a 6×13
 * RGBA PNG that fits Cozette's cell dimensions exactly, so the
 * sprite-aware cell renderer can drop them in where the `▓` glyph
 * used to live.
 *
 * No image-lib dependency — encodes PNG by hand via Node's `zlib`
 * + a small CRC32 table. Idempotent: same theme JSON in → same
 * bytes out.
 *
 * Run: `npx tsx scripts/gen-placeholder-sprites.mts`
 *
 * Pixel layout (6 wide × 13 tall — `W` = wood / orange, `-` = shelf
 * line / fgDim, letters = book accent colors cycled per shelf, `.` =
 * interior bg):
 *
 *   W W W W W W   ← top of frame
 *   W - - - - W   ← shelf line
 *   W R C G Y W   ← shelf 1, 4 books
 *   W R C G Y W
 *   W - - - - W
 *   W M B Y C W   ← shelf 2
 *   W M B Y C W
 *   W - - - - W
 *   W G R C M W   ← shelf 3
 *   W G R C M W
 *   W - - - - W
 *   W Y G R B W   ← shelf 4, single-row (short books)
 *   W W W W W W   ← bottom of frame
 *
 * Phase 3B/3C will replace these placeholders with real
 * model-generated sprites via PixelArtProvider; the file format +
 * directory layout stay identical.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(REPO_ROOT, 'src', 'themes');
const OUT_ROOT = path.join(REPO_ROOT, 'public', 'sprites');

interface ThemePalette {
  bg: string;
  bgAlt: string;
  fgDim: string;
  fg: string;
  fgBright: string;
  yellow: string;
  orange: string;
  red: string;
  magenta: string;
  violet: string;
  blue: string;
  cyan: string;
  green: string;
}
interface Theme {
  id: string;
  name: string;
  palette: ThemePalette;
}

const WIDTH = 6;
const HEIGHT = 13;

/** Pixel layout — each cell references a palette key. `bg` means the
 *  cell's interior fill (one step lighter than the canvas bg). */
type LayoutKey =
  | 'wood'
  | 'shelfLine'
  | 'bg'
  | 'red'
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'magenta'
  | 'blue'
  | 'violet';

const LAYOUT: ReadonlyArray<ReadonlyArray<LayoutKey>> = [
  ['wood', 'wood', 'wood', 'wood', 'wood', 'wood'],         // 0
  ['wood', 'shelfLine', 'shelfLine', 'shelfLine', 'shelfLine', 'wood'], // 1
  ['wood', 'red', 'cyan', 'green', 'yellow', 'wood'],       // 2
  ['wood', 'red', 'cyan', 'green', 'yellow', 'wood'],       // 3
  ['wood', 'shelfLine', 'shelfLine', 'shelfLine', 'shelfLine', 'wood'], // 4
  ['wood', 'magenta', 'blue', 'yellow', 'cyan', 'wood'],    // 5
  ['wood', 'magenta', 'blue', 'yellow', 'cyan', 'wood'],    // 6
  ['wood', 'shelfLine', 'shelfLine', 'shelfLine', 'shelfLine', 'wood'], // 7
  ['wood', 'green', 'red', 'cyan', 'magenta', 'wood'],      // 8
  ['wood', 'green', 'red', 'cyan', 'magenta', 'wood'],      // 9
  ['wood', 'shelfLine', 'shelfLine', 'shelfLine', 'shelfLine', 'wood'], // 10
  ['wood', 'yellow', 'green', 'red', 'blue', 'wood'],       // 11
  ['wood', 'wood', 'wood', 'wood', 'wood', 'wood'],         // 12
];

if (LAYOUT.length !== HEIGHT) throw new Error('LAYOUT row count mismatch');
for (const row of LAYOUT) {
  if (row.length !== WIDTH) throw new Error('LAYOUT col count mismatch');
}

/** Resolve a layout key to a [r,g,b,a] tuple from the theme. */
function resolveColor(theme: Theme, key: LayoutKey): [number, number, number, number] {
  const p = theme.palette;
  const hex = (() => {
    switch (key) {
      case 'wood': return p.orange;
      case 'shelfLine': return p.fgDim;
      case 'bg': return p.bgAlt;
      case 'red': return p.red;
      case 'cyan': return p.cyan;
      case 'green': return p.green;
      case 'yellow': return p.yellow;
      case 'magenta': return p.magenta;
      case 'blue': return p.blue;
      case 'violet': return p.violet;
    }
  })();
  const [r, g, b] = parseHex(hex);
  return [r, g, b, 255];
}

function parseHex(hex: string): [number, number, number] {
  const s = hex.replace(/^#/, '');
  if (s.length !== 6) throw new Error(`bad hex: ${hex}`);
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

/** Build the raw RGBA pixel buffer (height × (1 filter byte + width × 4)). */
function buildScanlines(theme: Theme): Buffer {
  const stride = 1 + WIDTH * 4;
  const buf = Buffer.alloc(HEIGHT * stride);
  for (let y = 0; y < HEIGHT; y++) {
    const off = y * stride;
    buf[off] = 0; // filter type: None
    for (let x = 0; x < WIDTH; x++) {
      const [r, g, b, a] = resolveColor(theme, LAYOUT[y][x]);
      const px = off + 1 + x * 4;
      buf[px] = r;
      buf[px + 1] = g;
      buf[px + 2] = b;
      buf[px + 3] = a;
    }
  }
  return buf;
}

// ---------- minimal PNG encoder ----------

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tbl[n] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
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

function encodePng(theme: Theme): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA truecolor
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: standard
  ihdr[12] = 0; // interlace: none
  const idat = zlib.deflateSync(buildScanlines(theme), { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- main ----------

const themes: Theme[] = [];
for (const entry of fs.readdirSync(THEMES_DIR)) {
  if (!entry.endsWith('.json')) continue;
  const raw = fs.readFileSync(path.join(THEMES_DIR, entry), 'utf8');
  themes.push(JSON.parse(raw) as Theme);
}

if (themes.length === 0) {
  console.error('[gen-sprites] no themes found');
  process.exit(1);
}

fs.mkdirSync(OUT_ROOT, { recursive: true });
for (const theme of themes) {
  const dir = path.join(OUT_ROOT, theme.id);
  fs.mkdirSync(dir, { recursive: true });
  const png = encodePng(theme);
  const out = path.join(dir, 'bookshelf.png');
  fs.writeFileSync(out, png);
  console.log(`  ${theme.id}: ${png.length}b → public/sprites/${theme.id}/bookshelf.png`);
}
console.log(`[gen-sprites] wrote ${themes.length} sprites`);
