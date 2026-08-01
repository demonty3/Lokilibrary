/**
 * Worn paths (Tier-2 depth pass) — pure footfall wear.
 *
 * The terminal renderer counts a footfall each time a being ENTERS an
 * integer column (terminalLand tracks lastCol); past WEAR_THRESHOLD entries
 * the column's crust glyph packs down (▀ → ▔) — "paths wear deeper", the
 * agent-as-marginalia beat. Marginalia slice: counts persist per wing
 * (land_wear table) and decay lazily — createFootfall seeds from persisted
 * counts, snapshot() exposes them for flushing.
 *
 * Pure + renderer-side: no PIXI, no procedural coupling — composeLand's
 * output is untouched (the determinism contract holds); wear is a live
 * re-text of the crust LAYER only.
 */

import type { LandModel } from '../procedural/land';

/** Column entries before the crust packs down. */
export const WEAR_THRESHOLD = 8;
/** Packed/worn crust variant (U+2594 UPPER ONE EIGHTH BLOCK — in the Cozette
 *  atlas; enumerated in scripts/smoke-glyph-coverage.mts). */
export const WORN_CRUST_GLYPH = '▔';

/** Wear half-life: persisted counts halve per real-world day (lazy, on read). */
export const WEAR_HALF_LIFE_MS = 86_400_000;

/** Effective count after lazy decay. Wall-clock is fine here (renderer-side,
 *  the lastTier1At precedent); src/procedural/ is untouched. */
export function decayedCount(count: number, updatedAtMs: number, nowMs: number): number {
  return count * Math.pow(0.5, Math.max(0, nowMs - updatedAtMs) / WEAR_HALF_LIFE_MS);
}

export interface Footfall {
  /** Record one column entry. Returns true exactly when this step crosses
   *  the wear threshold (the caller re-renders the crust layer). */
  step(col: number): boolean;
  /** Columns at/past the threshold. */
  readonly worn: ReadonlySet<number>;
  /** Current counts (seeded + stepped), copied — for the persistence flush. */
  snapshot(): ReadonlyMap<number, number>;
}

export function createFootfall(
  threshold: number = WEAR_THRESHOLD,
  initial?: ReadonlyMap<number, number>,
): Footfall {
  const counts = new Map<number, number>(initial ?? []);
  const worn = new Set<number>();
  for (const [col, n] of counts) if (n >= threshold) worn.add(col);
  return {
    step(col: number): boolean {
      const n = (counts.get(col) ?? 0) + 1;
      counts.set(col, n);
      // Worn-guard crossing (not n === threshold): seeded counts are
      // fractional after decay, so a column can pass the threshold
      // between integers — the guard still fires exactly once.
      if (!worn.has(col) && n >= threshold) {
        worn.add(col);
        return true;
      }
      return false;
    },
    worn,
    snapshot(): ReadonlyMap<number, number> {
      return new Map(counts);
    },
  };
}

/** The crust glyph at (x, y): the packed variant on a worn column, the
 *  model's own otherwise. The ▀ → ▔ rule lives here alone, so everything
 *  that draws ground — the crust layer, the knit glow — agrees about a worn
 *  column instead of one of them showing pristine crust over packed. */
export function crustGlyphAt(
  model: LandModel,
  worn: ReadonlySet<number>,
  x: number,
  y: number,
): string {
  return worn.has(x) ? WORN_CRUST_GLYPH : model.char[y][x];
}

/** The crust role's full-grid layer text (the renderer's layerFor shape:
 *  rows trimmed of trailing spaces, '\n'-joined) with worn columns swapped
 *  to the packed variant. Pure — drives BitmapText.text on wear + recompose. */
export function crustLayerText(model: LandModel, worn: ReadonlySet<number>): string {
  const rows: string[] = [];
  for (let y = 0; y < model.height; y++) {
    let line = '';
    for (let x = 0; x < model.width; x++) {
      line += model.role[y][x] === 'crust' ? crustGlyphAt(model, worn, x, y) : ' ';
    }
    rows.push(line.replace(/\s+$/u, ''));
  }
  return rows.join('\n');
}
