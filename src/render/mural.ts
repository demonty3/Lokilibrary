/**
 * Murals #16 — fetch + mount (the impure half; the quantiser is muralCells).
 * ONE full-res getImageData + session pixel cache per appid: joins, theme
 * relaunches and re-quantises never refetch. Backing fills from the ACTIVE
 * theme bg (the ansiSpike 0x050505 debt stops here; ansiSpike itself stays
 * for the V0 preview).
 */
import { BitmapText, Container, Graphics } from 'pixi.js';
import { COZETTE_CELL_HEIGHT, COZETTE_CELL_WIDTH, COZETTE_FONT_FAMILY, COZETTE_FONT_SIZE, hexToInt } from './fonts';
import { headerImageUrl } from '../data/sampleLibrary';
import type { MuralCell } from './muralCells';
import type { Theme } from '../themes/types';

export type TerminalMuralState = 'idle' | 'loading' | 'ready' | 'failed-cors' | 'failed-load' | 'omitted';

const pixelCache = new Map<number, { data: Uint8ClampedArray; w: number; h: number }>();

export async function loadMuralPixels(appid: number): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const hit = pixelCache.get(appid);
  if (hit) return hit;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous'; // Steam CDN sends ACAO:* — readback stays untainted
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`[mural] image load failed: ${appid}`));
    el.src = headerImageUrl(appid);
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('[mural] 2d context unavailable');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height); // throws SecurityError if tainted
  const entry = { data, w: canvas.width, h: canvas.height };
  pixelCache.set(appid, entry);
  return entry;
}

/** ≤1 backing + 13 key layers (one BitmapText per palette key used) — never
 *  per-cell objects. Local glyph space; caller positions at the model rect. */
export function buildQuantizedMural(cells: readonly MuralCell[], w: number, h: number, theme: Theme): Container {
  const c = new Container();
  c.addChild(new Graphics().rect(0, 0, w * COZETTE_CELL_WIDTH, h * COZETTE_CELL_HEIGHT)
    .fill(hexToInt(theme.palette.bg)));
  // One text block per palette key: same layerFor idiom as buildLandContainer.
  const keys = [...new Set(cells.map((cl) => cl.key).filter((k): k is NonNullable<typeof k> => k !== null))];
  for (const key of keys) {
    const rows: string[] = [];
    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < w; x++) {
        const cell = cells[y * w + x];
        line += cell.key === key ? cell.ch : ' ';
      }
      rows.push(line.replace(/\s+$/u, ''));
    }
    const text = rows.join('\n');
    if (!text.trim()) continue;
    c.addChild(new BitmapText({
      text,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette[key]) },
    }));
  }
  return c;
}
