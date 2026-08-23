/**
 * Authored murals (claude-authoring rung 1) — frozen, gate-validated wing
 * art. Each JSON under src/murals/ is one mural: MURAL_INTERIOR_H glyph
 * rows of MURAL_INTERIOR_W cells plus an aligned `ink` grid of palette-KEY
 * letter codes ('.' = blank; the sky-tinted backing shows through). Keys,
 * never hex — the same mural is legal under every pack by construction.
 * Gate: scripts/smoke-mural-blueprint.mts; authoring spec:
 * docs/blueprints/mural.md. The desk mounts these through the UNCHANGED
 * buildQuantizedMural path (src/render/mural.ts); the CDN fetch+quantise
 * path stays off (Harry's 2026-08-08 anatomy cut) — compose only asks for
 * a mural rect on wings that carry an authored one.
 */
import type { MuralCell } from '../render/muralCells';
import type { PaletteKey } from '../themes/types';
import d0 from './d0.json';
import d2 from './d2.json';
import d3 from './d3.json';
import d5 from './d5.json';

export interface AuthoredMural {
  wing: string;
  brief: 'world' | 'relationship';
  /** One line, on the record: which brief was chosen and why (rung-1 spec
   *  Done-means 1). Surfacing this in-world is a later-rung question. */
  why: string;
  rows: string[]; // glyphs, MURAL_INTERIOR_H × MURAL_INTERIOR_W codepoints
  ink: string[]; // aligned palette-key letter codes, '.' = blank
}

/** Ink letter → palette key. bg/bgAlt/fgBright are absent BY DESIGN: the
 *  backing owns bg, and fgBright is the beings' reserved salience register
 *  (the muralCells EXCLUDED contract, held structurally — an authored
 *  mural cannot even spell those keys). */
export const MURAL_INK_LEGEND: Readonly<Record<string, PaletteKey>> = Object.freeze({
  d: 'fgDim',
  f: 'fg',
  y: 'yellow',
  o: 'orange',
  r: 'red',
  m: 'magenta',
  v: 'violet',
  b: 'blue',
  c: 'cyan',
  g: 'green',
});

/** The registry. Add new mural JSONs here (one import + one row); the
 *  conformance smoke validates every entry, so a mural that typechecks and
 *  smokes green is done. Wing-keyed: one mural per wing. */
export const AUTHORED_MURALS: readonly AuthoredMural[] = Object.freeze([
  d0 as AuthoredMural,
  d2 as AuthoredMural,
  d3 as AuthoredMural,
  d5 as AuthoredMural,
]);

export function authoredMuralFor(wing: string): AuthoredMural | undefined {
  return AUTHORED_MURALS.find((m) => m.wing === wing);
}

/** Grid → MuralCell[] for buildQuantizedMural. Pure. Codepoint-safe row
 *  indexing (Array.from) so multi-byte glyphs count as one cell. Malformed
 *  cells (unknown ink letter) render blank — the smoke guarantees none
 *  reach here. */
export function authoredMuralCells(m: AuthoredMural): MuralCell[] {
  const cells: MuralCell[] = [];
  for (let y = 0; y < m.rows.length; y++) {
    const row = Array.from(m.rows[y]);
    const ink = Array.from(m.ink[y]);
    for (let x = 0; x < row.length; x++) {
      const key = MURAL_INK_LEGEND[ink[x]] ?? null;
      const ch = row[x];
      cells.push(key === null || ch === ' ' ? { ch: ' ', key: null } : { ch, key });
    }
  }
  return cells;
}
