/**
 * V0 spike — ANSI conversion of Steam capsule art (PRD: Terminal Terraria
 * visual direction). Converts a CDN header.jpg into a glyph + full-RGB cell
 * matrix sized for the Cozette grid, mounted as a poster mural on the hall.
 *
 * The mural is FULL-RGB by doctrine (PRD M3 / SPEC §2.3): the capsule is the
 * recognition surface and is exempt from one-theme-per-scene — everything
 * else in the scene stays theme-tinted.
 *
 * Deterministic by construction: no randomness, a fixed glyph ramp, ONE
 * full-resolution getImageData + integer box-averaging in JS (drawImage
 * rescaling has browser-dependent filtering, so we never downsample with it).
 *
 * Spike-scoped — NOT the M2/M3 mural/converter module shape; that lands only
 * if V0 passes Harry's gate.
 */

import { BitmapText, Container, Graphics } from 'pixi.js';
import { COZETTE_CELL_HEIGHT, COZETTE_CELL_WIDTH, COZETTE_FONT_FAMILY, COZETTE_FONT_SIZE } from './fonts';
import { headerImageUrl } from '../data/sampleLibrary';

// ── V0 spike knob: luminance → glyph ramp, ordered dark → bright ──────────
// Block-weighted: every cell keeps a glyph so its full-RGB tint carries —
// thin-punctuation ramps (' .:-=+*#%@') drop most of a dark capsule.
const ANSI_RAMP = '░░▒▒▓▓███';

export interface AnsiCell {
  ch: string;
  rgb: number; // 0xRRGGBB — full-RGB, deliberately not theme-mapped
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Steam CDN sends ACAO:* — readback stays untainted
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[ansiSpike] image load failed: ${src}`));
    img.src = src;
  });
}

/** Convert a game's capsule (header.jpg, 460×215) to a row-major w*h cell
 *  matrix. Rejects with a SecurityError-named error if canvas readback is
 *  tainted (CORS contingency — caller reports, no Worker proxy without asking). */
export async function capsuleToCells(appid: number, w: number, h: number): Promise<AnsiCell[]> {
  const img = await loadImage(headerImageUrl(appid));
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('[ansiSpike] 2d context unavailable');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const boxW = Math.max(1, Math.floor(canvas.width / w));
  const boxH = Math.max(1, Math.floor(canvas.height / h));
  const cells: AnsiCell[] = [];
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = cy * boxH; y < (cy + 1) * boxH; y++) {
        for (let x = cx * boxW; x < (cx + 1) * boxW; x++) {
          const i = (y * canvas.width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
      }
      const n = boxW * boxH;
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const idx = Math.min(ANSI_RAMP.length - 1, Math.floor(lum * ANSI_RAMP.length));
      cells.push({ ch: ANSI_RAMP[idx], rgb: (r << 16) | (g << 8) | b });
    }
  }
  return cells;
}

/** Mount the cell matrix as per-cell BitmapText over a near-black backing
 *  (so the hall's placeholder fill never bleeds through dark poster cells).
 *  644 static objects for a 46×14 mural — fine for a spike; RenderTexture
 *  caching is an M2 concern. Local glyph space; caller positions it. */
export function buildMuralContainer(cells: AnsiCell[], w: number, h: number): Container {
  const container = new Container();
  container.addChild(
    new Graphics().rect(0, 0, w * COZETTE_CELL_WIDTH, h * COZETTE_CELL_HEIGHT).fill(0x050505),
  );
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = cells[y * w + x];
      if (cell.ch === ' ') continue;
      const t = new BitmapText({
        text: cell.ch,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: cell.rgb },
      });
      t.x = x * COZETTE_CELL_WIDTH;
      t.y = y * COZETTE_CELL_HEIGHT;
      container.addChild(t);
    }
  }
  return container;
}
