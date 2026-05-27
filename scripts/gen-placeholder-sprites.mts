/**
 * Phase 3A/3B/3C — generate placeholder tile sprites per theme into
 * `public/sprites/{theme_id}/<slot>.png`. Most slots are 6×13 RGBA PNGs
 * matching Cozette's cell dimensions exactly; the bookshelf bumped to
 * 16×32 in 3C-β so it can render at the same size the PixelLab bake
 * generates (PixelLab's pixflux endpoint enforces 16 ≤ dim ≤ 400, so
 * 6×13 wasn't reachable). The 16×32 placeholder lets the renderer have
 * something to draw before the real bake replaces it.
 *
 * No image-lib dependency — encodes PNG by hand via Node's `zlib`
 * + a small CRC32 table. Idempotent: same theme JSON + LAYOUTS in →
 * same bytes out.
 *
 * Run: `npx tsx scripts/gen-placeholder-sprites.mts`
 *
 * Phase 3A shipped the bookshelf only. Phase 3B extends to every tile
 * in the library bible *except floor* (floor is 70% of cells; a sprite
 * for it would create huge bind churn for marginal value, and the `·`
 * glyph reads fine as floor). 3C-β bumps the bookshelf design to 16×32
 * but leaves the other slots at 6×13. Each layout is keyed off palette
 * slots so theme swaps re-tint without changing geometry.
 *
 * Phase 3C+ will replace these placeholders with model-generated
 * sprites via PixelArtProvider (see src/agents/pixelart.ts); the file
 * format + directory layout stay identical so no renderer change.
 *
 * Slot id ↔ tile id mapping lives in `src/render/sprites.ts` —
 * `KNOWN_SLOTS` there must agree with `SLOT_IDS` here. The smoke test
 * (`scripts/smoke-3a-sprites.mts`) catches drift. Per-slot native sizes
 * here MUST match `SLOT_DISPLAY` in `src/render/sprites.ts`.
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

// Default cell-aligned slot size — 6×13 to match Cozette's cell. The
// bookshelf overrides this to 16×32 (see SLOT_NATIVE below) — every other
// slot keeps the default. Width/height are inferred from each Layout's
// shape at validation time, so adding a non-default size only requires
// the new layout literal.
const DEFAULT_W = 6;
const DEFAULT_H = 13;

/** Pixel layout key — abstract palette role. The renderer resolves
 *  each key to a theme-specific hex through `resolveColor`.
 *  `transparent` is the only non-color key and renders alpha=0. */
type LayoutKey =
  | 'transparent'
  | 'wood'       // → palette.orange
  | 'wall'       // → palette.fg
  | 'shelfLine'  // → palette.fgDim
  | 'light'      // → palette.fgBright
  | 'pane'       // → palette.bgAlt
  | 'handle'     // → palette.yellow
  | 'red'
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'magenta'
  | 'blue'
  | 'violet';

type Layout = ReadonlyArray<ReadonlyArray<LayoutKey>>;

// ---------- layout designs ----------
//
// Conventions:
//   T = transparent (pixel outside the tile's body; renders nothing)
//   W = wall (palette.fg)
//   . = transparent shorthand — used in the row literals below for
//       readability when scanning a layout by eye.
//
// All layouts are 6 wide × 13 tall. Adjacency between tiles works
// because the wall band uses the same row positions (5-7) everywhere
// and the vertical wall band uses the same col positions (2-3)
// everywhere — corners + tees + door + window all snap to that grid.

// Bookshelf — Phase 3C-β redesign at 16×32 to match the PixelLab
// native size (pixflux endpoint enforces 16 ≤ dim ≤ 400; the smaller
// 6×13 original couldn't be reached). 4 shelves of 7 books each, each
// book 2 cols wide × 6 rows tall, inside a 1-px wood frame on cols
// 0 + 15 with 1-row wood caps top and bottom. Shelf-line key uses the
// dim foreground (fgDim) so it reads as a shadow under each shelf
// regardless of the active theme.
//
// Color sequences rotate per shelf for visual variety while staying
// inside the theme palette. The first letter of each game name renders
// over the top-left of the sprite as a spine glyph (see cell.ts) —
// 16×32 leaves room for that overlay to land roughly on the leftmost
// book without obscuring the rest.
type BookColor = 'red' | 'cyan' | 'green' | 'yellow' | 'magenta' | 'blue' | 'violet';
const SHELF_PATTERNS: ReadonlyArray<ReadonlyArray<BookColor>> = [
  ['red', 'cyan', 'green', 'yellow', 'magenta', 'blue', 'violet'],
  ['green', 'yellow', 'magenta', 'blue', 'violet', 'red', 'cyan'],
  ['magenta', 'blue', 'violet', 'red', 'cyan', 'green', 'yellow'],
  ['violet', 'red', 'cyan', 'green', 'yellow', 'magenta', 'blue'],
];

function buildBookshelf(): Layout {
  const rows: LayoutKey[][] = [];
  const woodRow = (): LayoutKey[] => Array<LayoutKey>(16).fill('wood');
  const shelfLineRow = (): LayoutKey[] => {
    const r: LayoutKey[] = Array<LayoutKey>(16).fill('shelfLine');
    r[0] = 'wood';
    r[15] = 'wood';
    return r;
  };
  const bookRow = (colors: ReadonlyArray<BookColor>): LayoutKey[] => {
    const r: LayoutKey[] = Array<LayoutKey>(16).fill('wood');
    // 7 books × 2 cols each = 14 cols starting at col 1.
    for (let b = 0; b < 7; b++) {
      r[1 + b * 2] = colors[b];
      r[2 + b * 2] = colors[b];
    }
    return r;
  };
  rows.push(woodRow()); // 0
  rows.push(woodRow()); // 1
  for (let s = 0; s < SHELF_PATTERNS.length; s++) {
    rows.push(shelfLineRow());
    for (let i = 0; i < 6; i++) rows.push(bookRow(SHELF_PATTERNS[s]));
  }
  // After 4 shelves: 2 + 4 * (1 + 6) = 30 rows. Cap with one more shelf
  // line + one wood row → 32 total.
  rows.push(shelfLineRow());
  rows.push(woodRow());
  return rows;
}

const BOOKSHELF: Layout = buildBookshelf();

// ---- wall band convention (used by wall_h + corners + tee + door) ----
// Horizontal wall sits on rows 5-7 (3 rows tall).
// Vertical wall sits on cols 2-3 (2 cols wide).

// Wall horizontal — 3-row band across rows 5-7, full width.
const WALL_H: Layout = [
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// Wall vertical — 2-col band at cols 2-3, full height.
const WALL_V: Layout = [
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
];

// Corner top-left — wall_h band extends east (cols 2-5 at rows 5-7),
// wall_v continues south (cols 2-3 at rows 5-12). L shape opening
// down-and-right.
const CORNER_TL: Layout = [
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
];

// Corner top-right — wall_h extends west (cols 0-3 at rows 5-7),
// wall_v continues south. Mirror of TL.
const CORNER_TR: Layout = [
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
];

// Corner bottom-left — wall_v from north (rows 0-7), wall_h goes east
// at rows 5-7. L shape opening up-and-right.
const CORNER_BL: Layout = [
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// Corner bottom-right — wall_v from north, wall_h goes west. Mirror of BL.
const CORNER_BR: Layout = [
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// Tee ┴ — wall_v coming from north, wall_h east+west (no south arm).
// Library bible says T_TEE is reserved for fancier door framing but
// not actively placed in Phase 1/2; the sprite still ships in case
// layoutCell starts using it.
const TEE: Layout = [
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'wall', 'wall', 'transparent', 'transparent'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// Door ╪ — orange wooden panel embedded in the wall_h band. Spans
// rows 4-8 vertically (extends 1 row above + below the wall band so
// the door reads as "thicker than the wall") and cols 1-4 horizontally,
// leaving wall pieces at cols 0 + 5 to connect with adjacent wall_h.
// Yellow handle dot at the right side, mid-height.
const DOOR: Layout = [
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'wood', 'wood', 'wood', 'wood', 'transparent'],
  ['wall', 'wood', 'wood', 'wood', 'wood', 'wall'],
  ['wall', 'wood', 'wood', 'wood', 'handle', 'wall'],
  ['wall', 'wood', 'wood', 'wood', 'wood', 'wall'],
  ['transparent', 'wood', 'wood', 'wood', 'wood', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// Window ╫ — blue frame with two stacked lit panes (`light` =
// fgBright). 5 rows tall (rows 4-8) so it's slightly taller than the
// wall band, breaking the wall visually the way the door does.
const WINDOW: Layout = [
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['blue', 'blue', 'blue', 'blue', 'blue', 'blue'],
  ['blue', 'light', 'light', 'light', 'light', 'blue'],
  ['blue', 'blue', 'blue', 'blue', 'blue', 'blue'],
  ['blue', 'light', 'light', 'light', 'light', 'blue'],
  ['blue', 'blue', 'blue', 'blue', 'blue', 'blue'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// Table — top-down view: violet rounded surface across rows 3-8 with
// two legs visible at rows 9-10. Centered horizontally with 1-pixel
// edge inset at top/bottom to round the corners visually.
const TABLE: Layout = [
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'violet', 'violet', 'violet', 'violet', 'transparent'],
  ['violet', 'violet', 'violet', 'violet', 'violet', 'violet'],
  ['violet', 'violet', 'violet', 'violet', 'violet', 'violet'],
  ['violet', 'violet', 'violet', 'violet', 'violet', 'violet'],
  ['violet', 'violet', 'violet', 'violet', 'violet', 'violet'],
  ['transparent', 'violet', 'violet', 'violet', 'violet', 'transparent'],
  ['transparent', 'violet', 'transparent', 'transparent', 'violet', 'transparent'],
  ['transparent', 'violet', 'transparent', 'transparent', 'violet', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
  ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
];

// ---------- slot registry ----------
//
// MUST stay in sync with `KNOWN_SLOTS` in src/render/sprites.ts.
// Smoke `scripts/smoke-3a-sprites.mts` enforces both sides exist.

const LAYOUTS: ReadonlyArray<[slot: string, layout: Layout]> = [
  ['bookshelf', BOOKSHELF],
  ['wall-h', WALL_H],
  ['wall-v', WALL_V],
  ['corner-tl', CORNER_TL],
  ['corner-tr', CORNER_TR],
  ['corner-bl', CORNER_BL],
  ['corner-br', CORNER_BR],
  ['tee', TEE],
  ['door', DOOR],
  ['window', WINDOW],
  ['table', TABLE],
];

/** Slots whose native size differs from the 6×13 default. Must agree
 *  with `SLOT_DISPLAY` in `src/render/sprites.ts` — the renderer reads
 *  the on-disk PNG at face value and uses the matching display size, so
 *  a drift here would render a stretched/squished sprite. */
const SLOT_NATIVE: ReadonlyMap<string, { width: number; height: number }> = new Map([
  ['bookshelf', { width: 16, height: 32 }],
]);

function dimsFor(slot: string): { width: number; height: number } {
  return SLOT_NATIVE.get(slot) ?? { width: DEFAULT_W, height: DEFAULT_H };
}

// Validate dimensions at module load — catches typos in any layout
// before we burn an entire generation pass on a malformed grid. Each
// slot must match its declared native size (default 6×13 unless
// overridden in SLOT_NATIVE).
for (const [slot, layout] of LAYOUTS) {
  const { width, height } = dimsFor(slot);
  if (layout.length !== height) {
    throw new Error(`[gen-sprites] slot "${slot}" has ${layout.length} rows, expected ${height}`);
  }
  for (let y = 0; y < height; y++) {
    if (layout[y].length !== width) {
      throw new Error(
        `[gen-sprites] slot "${slot}" row ${y} has ${layout[y].length} cols, expected ${width}`,
      );
    }
  }
}

// ---------- color resolution ----------

/** Resolve a layout key to a [r,g,b,a] tuple from the theme.
 *  `transparent` returns alpha=0; everything else maps to a palette
 *  hex with alpha=255. */
function resolveColor(theme: Theme, key: LayoutKey): [number, number, number, number] {
  if (key === 'transparent') return [0, 0, 0, 0];
  const p = theme.palette;
  const hex = (() => {
    switch (key) {
      case 'wood': return p.orange;
      case 'wall': return p.fg;
      case 'shelfLine': return p.fgDim;
      case 'light': return p.fgBright;
      case 'pane': return p.bgAlt;
      case 'handle': return p.yellow;
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
function buildScanlines(theme: Theme, layout: Layout, width: number, height: number): Buffer {
  const stride = 1 + width * 4;
  const buf = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const off = y * stride;
    buf[off] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = resolveColor(theme, layout[y][x]);
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

function encodePng(theme: Theme, layout: Layout, width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA truecolor
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: standard
  ihdr[12] = 0; // interlace: none
  const idat = zlib.deflateSync(buildScanlines(theme, layout, width, height), { level: 9 });
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
let totalBytes = 0;
let spritesWritten = 0;
for (const theme of themes) {
  const dir = path.join(OUT_ROOT, theme.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [slot, layout] of LAYOUTS) {
    const { width, height } = dimsFor(slot);
    const png = encodePng(theme, layout, width, height);
    const out = path.join(dir, `${slot}.png`);
    fs.writeFileSync(out, png);
    totalBytes += png.length;
    spritesWritten++;
  }
  console.log(`  ${theme.id}: ${LAYOUTS.length} sprites`);
}
console.log(
  `[gen-sprites] wrote ${spritesWritten} sprites across ${themes.length} themes (${totalBytes}b total)`,
);
