/**
 * Cozette bitmap font loader. Phase 1 ships CozetteVector.woff2 in
 * public/fonts/ — a vector wrapping of the Cozette 6×13 bitmap glyphs.
 * @font-face declaration is in index.html.
 *
 * PixiJS v8's BitmapText accepts a plain fontFamily string and lazily
 * generates a texture atlas per glyph used (dynamic BitmapFont). The
 * waitForCozette() helper just ensures the browser has finished loading
 * the woff2 before the first BitmapText is created — otherwise PixiJS
 * bakes the atlas against a system fallback and the result looks wrong
 * until a refresh.
 *
 * Cozette is a bitmap font and must render at exactly its design size
 * (13px) with antialias off to stay crisp. The COZETTE_FONT_SIZE +
 * COZETTE_FONT_FAMILY constants are the canonical values; consumers
 * should reference them rather than literal strings/numbers so a future
 * font swap is one line.
 */

export const COZETTE_FONT_FAMILY = 'Cozette';
export const COZETTE_FONT_SIZE = 13;
export const COZETTE_CELL_WIDTH = 6;
export const COZETTE_CELL_HEIGHT = 13;

let cozetteReady: Promise<void> | null = null;

export function waitForCozette(): Promise<void> {
  if (cozetteReady) return cozetteReady;
  if (typeof document === 'undefined' || !document.fonts) {
    cozetteReady = Promise.resolve();
    return cozetteReady;
  }
  cozetteReady = document.fonts
    .load(`${COZETTE_FONT_SIZE}px "${COZETTE_FONT_FAMILY}"`)
    .then(() => undefined);
  return cozetteReady;
}

/** "#RRGGBB" → 0xRRGGBB. PixiJS tints expect numeric. */
export function hexToInt(hex: string): number {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  return parseInt(s, 16);
}
