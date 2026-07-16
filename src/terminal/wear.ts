/**
 * Worn paths (Tier-2 depth pass) — pure, session-scoped footfall wear.
 *
 * The terminal renderer counts a footfall each time a being ENTERS an
 * integer column (terminalLand tracks lastCol); past WEAR_THRESHOLD entries
 * the column's crust glyph packs down (▀ → ▔) — "paths wear deeper", the
 * agent-as-marginalia beat. Session-scoped: no persistence this tier.
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

export interface Footfall {
  /** Record one column entry. Returns true exactly when this step crosses
   *  the wear threshold (the caller re-renders the crust layer). */
  step(col: number): boolean;
  /** Columns at/past the threshold. */
  readonly worn: ReadonlySet<number>;
}

export function createFootfall(threshold: number = WEAR_THRESHOLD): Footfall {
  const counts = new Map<number, number>();
  const worn = new Set<number>();
  return {
    step(col: number): boolean {
      const n = (counts.get(col) ?? 0) + 1;
      counts.set(col, n);
      if (n === threshold) {
        worn.add(col);
        return true;
      }
      return false;
    },
    worn,
  };
}

/** The crust role's full-grid layer text (the renderer's layerFor shape:
 *  rows trimmed of trailing spaces, '\n'-joined) with worn columns swapped
 *  to the packed variant. Pure — drives BitmapText.text on wear + recompose. */
export function crustLayerText(model: LandModel, worn: ReadonlySet<number>): string {
  const rows: string[] = [];
  for (let y = 0; y < model.height; y++) {
    let line = '';
    for (let x = 0; x < model.width; x++) {
      line += model.role[y][x] === 'crust' ? (worn.has(x) ? WORN_CRUST_GLYPH : model.char[y][x]) : ' ';
    }
    rows.push(line.replace(/\s+$/u, ''));
  }
  return rows.join('\n');
}
