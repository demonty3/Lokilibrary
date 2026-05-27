/**
 * Phase 3C-β palette quantizer for the bake script. Takes a PNG (raw
 * bytes, typically RGBA from PixelLab) and remaps every opaque pixel to
 * the nearest color in a fixed palette, preserving the transparent
 * background. The output PNG matches the input dimensions.
 *
 * Why: the renderer paints sprites over a themed floor — any
 * leftover off-palette pixel will fight the theme. Locking every opaque
 * pixel to the active theme's foreground palette guarantees aesthetic
 * coherence regardless of what the generator hallucinated for shadow,
 * highlight, or color anchor.
 *
 * Background palette slots (`bg`, `bgAlt`) are intentionally excluded
 * from the quantize set — if a sprite pixel got mapped to the room's
 * floor color it would render as a hole. Opaque pixels go to whichever
 * `fg*` / named-color palette slot is nearest in RGB-Euclidean space.
 *
 * Pure-function module; the bake script imports it, the smoke imports
 * it. Both use the same nearest-color path so the smoke's expectations
 * match the runtime behavior exactly.
 */

import { PNG } from 'pngjs';

export type RgbTriplet = readonly [number, number, number];

/** Palette colors to quantize toward. The bake script extracts these
 *  from the active theme JSON (foreground slots only — see header). */
export interface QuantizeOptions {
  readonly palette: ReadonlyArray<RgbTriplet>;
  /** Alpha threshold below which a pixel is forced to fully transparent
   *  (alpha=0). PixelLab's `no_background: true` produces alpha=0
   *  backgrounds, but model edges often have anti-aliased semi-transparent
   *  pixels (alpha 20–200). Pixel art wants hard edges, so default 128
   *  snaps the edge cleanly: <128 → transparent, ≥128 → opaque + quantized. */
  readonly alphaThreshold?: number;
}

/** Parse `#rrggbb` to a [r, g, b] tuple. Throws on bad input — fail
 *  fast at bake time rather than silently miscoloring. */
export function parseHexColor(hex: string): RgbTriplet {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`[quantize] invalid hex color "${hex}"`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Nearest-color picker via squared RGB-Euclidean distance. Returns the
 *  index into `palette` of the closest entry — caller looks up the
 *  actual color. Squared distance (no sqrt) is monotonic with true
 *  distance, so the argmin is identical and we save the sqrt per pixel. */
export function nearestPaletteIndex(
  pixel: RgbTriplet,
  palette: ReadonlyArray<RgbTriplet>,
): number {
  if (palette.length === 0) {
    throw new Error('[quantize] palette is empty');
  }
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i]!;
    const dr = pixel[0] - pr;
    const dg = pixel[1] - pg;
    const db = pixel[2] - pb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Quantize a PNG against a palette. Returns new PNG bytes with the
 *  same width/height but every opaque pixel snapped to a palette color.
 *  The function is pure — same input → same output bytes. */
export function quantizeToPalette(pngBytes: Uint8Array, opts: QuantizeOptions): Uint8Array {
  const alphaThreshold = opts.alphaThreshold ?? 128;
  // pngjs accepts a Buffer; Uint8Array → Buffer is a zero-copy wrap.
  const buf = Buffer.from(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  const png = PNG.sync.read(buf);
  // png.data is RGBA bytes, row-major, top-to-bottom.
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3]!;
    if (a < alphaThreshold) {
      // Force fully transparent — and zero the RGB so the saved PNG is
      // deterministic across model runs (otherwise faint colored
      // pixels under the alpha threshold leak through filters).
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
      continue;
    }
    const idx = nearestPaletteIndex(
      [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!],
      opts.palette,
    );
    const [r, g, b] = opts.palette[idx]!;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  const out = PNG.sync.write(png);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** Extract the bake-time foreground palette from a theme JSON. Bg
 *  slots (`bg`, `bgAlt`) are excluded — sprite pixels mapping to those
 *  would render as floor-colored holes when composited. */
export function foregroundPalette(themeJson: {
  palette: Record<string, string>;
}): RgbTriplet[] {
  const exclude = new Set(['bg', 'bgAlt']);
  const out: RgbTriplet[] = [];
  for (const [key, hex] of Object.entries(themeJson.palette)) {
    if (exclude.has(key)) continue;
    out.push(parseHexColor(hex));
  }
  return out;
}
