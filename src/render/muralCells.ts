/**
 * Murals #16 — the pure quantiser. CDN header pixels → {glyph, paletteKey}
 * cells: luminance carries density (MURAL_RAMP), chroma snaps to the nearest
 * ACTIVE-theme palette key. Pure: no PIXI, no DOM, no network — the smokeable
 * half of the mural pipeline (fetch/mount live in src/render/mural.ts).
 * Targets NEVER include bg/bgAlt (backing) or fgBright (the beings' reserved
 * register — the salience contract holds by construction).
 */
import type { PaletteKey, ThemePalette } from '../themes/types';

export interface MuralCell {
  ch: string;
  key: PaletteKey | null; // null = blank (theme-bg backing shows through)
}
export interface MuralTarget {
  key: PaletteKey;
  rgb: readonly [number, number, number];
}

export const MURAL_RAMP = [' ', '░', '▒', '▓', '█'] as const;
const EXCLUDED: ReadonlySet<PaletteKey> = new Set(['bg', 'bgAlt', 'fgBright']);

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

export function muralQuantizeTargets(palette: ThemePalette): MuralTarget[] {
  return (Object.keys(palette) as PaletteKey[])
    .filter((k) => !EXCLUDED.has(k))
    .map((key) => ({ key, rgb: hexRgb(palette[key]) }));
}

export function quantizeMural(
  data: ArrayLike<number>, // RGBA, row-major (getImageData shape)
  srcW: number,
  srcH: number,
  cellsW: number,
  cellsH: number,
  targets: readonly MuralTarget[],
): MuralCell[] {
  const boxW = Math.max(1, Math.floor(srcW / cellsW));
  const boxH = Math.max(1, Math.floor(srcH / cellsH));
  const cells: MuralCell[] = [];
  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      let r = 0, g = 0, b = 0;
      for (let y = cy * boxH; y < (cy + 1) * boxH; y++)
        for (let x = cx * boxW; x < (cx + 1) * boxW; x++) {
          const i = (y * srcW + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
      const n = boxW * boxH;
      r /= n; g /= n; b /= n;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const idx = Math.min(MURAL_RAMP.length - 1, Math.floor(lum * MURAL_RAMP.length));
      if (idx === 0) { cells.push({ ch: ' ', key: null }); continue; }
      let best: PaletteKey = targets[0].key;
      let bestD = Infinity;
      for (const t of targets) {
        const d = (r - t.rgb[0]) ** 2 + (g - t.rgb[1]) ** 2 + (b - t.rgb[2]) ** 2;
        if (d < bestD) { bestD = d; best = t.key; }
      }
      cells.push({ ch: MURAL_RAMP[idx], key: best });
    }
  }
  return cells;
}
