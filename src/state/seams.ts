/**
 * Phase 7-D — pure seam-graph + coordinate-bridge module.
 *
 * Today the ONLY place that knows which panes abut along which edge is
 * `drawSeams()` inside PixiApp.ts's mountPalace closure. It is impure (closes
 * over the live PIXI app + theme + seamLayer), works in PIXEL space, and
 * derives seams IMPLICITLY by stroking each pane's right+bottom interior edge.
 * There is no seam DATA model — seams exist only as Graphics strokes.
 *
 * This module derives the seam GRAPH in INTEGER GRID space — the same abutment
 * fact `drawSeams` uses, but as DATA so the two cannot diverge. PixiApp's
 * `drawSeams` is refactored to iterate `buildSeams()` output and project each
 * seam's grid segment to pixels with the SAME `computePixelRect` cellW/cellH,
 * making this the single source of abutment truth.
 *
 * KEY GEOMETRIC INSIGHT. `drawSeams` works in pixels, but the abutment relation
 * is EXACT in grid space (PaneRect col/row/cols/rows on the gridCols×gridRows
 * composition grid). Two panes A,B share a VERTICAL seam iff
 *   A.col + A.cols === B.col   (A is left of B)
 * AND their row-spans overlap; the shared segment is the grid column
 *   x = A.col + A.cols   over rows [max(A.row,B.row), min(A.row+A.rows, B.row+B.rows)).
 * Symmetric for HORIZONTAL. This is provably the same set of internal edges
 * `drawSeams` strokes, computed once as data + deduped by a canonical id.
 *
 * PURITY CONTRACT (mirrors the src/procedural determinism spirit):
 *   - Imports ONLY leaf types from ../types — no PIXI, no Zustand, no cycle.
 *   - No Math.random / Date.now: `buildSeams` is a pure function of its inputs.
 *   - Stays in INTEGER grid space and NEVER floors/computes pixels — so it
 *     cannot introduce a 1px gap; all float math stays in PixiApp at draw time.
 *   - Returns [] for <2 panes AND for the lone full-grid 'root' pane, so
 *     PixiApp's `livePanes.size <= 1` early-return is preserved exactly.
 *
 * OPEN/CLOSED MODEL. Default OPEN, toggle RESERVED. The product is ONE
 * inhabitable place (CLAUDE.md): panes are windows into contiguous regions, so
 * abutment ⇒ passable is the right default and needs zero new state. `open`
 * ships as a field (always true today) and `edgeType` is reserved (`null`
 * today) so a future locked/sealed pane can flip them WITHOUT changing
 * `buildSeams`' signature or `bridgeCoord`'s call sites.
 */

import type { PaneDescriptor, ScaleLevel } from '../types';

/** A seam runs along a grid column (vertical) or a grid row (horizontal). */
export type SeamAxis = 'vertical' | 'horizontal';

/**
 * The shared edge in INTEGER grid coordinates.
 *  - `line` — the shared grid column (vertical) or row (horizontal).
 *  - `[start, end)` — the half-open span along the OTHER axis (rows for a
 *    vertical seam, columns for a horizontal one).
 */
export interface SeamSegment {
  axis: SeamAxis;
  line: number;
  start: number;
  end: number;
}

/**
 * One internal seam between two abutting panes. `paneA` is ALWAYS the
 * lower-coordinate pane (col asc for vertical, row asc for horizontal) so a
 * seam has exactly ONE canonical form regardless of pair order.
 */
export interface Seam {
  /** Deterministic, order-independent id. */
  id: string;
  paneA: string;
  edgeA: 'right' | 'bottom';
  paneB: string;
  edgeB: 'left' | 'top';
  levelA: ScaleLevel;
  levelB: ScaleLevel;
  segment: SeamSegment;
  /** Default true. Reserved toggle for a future locked/sealed pane. */
  open: boolean;
  /** Reserved metadata ('wall' | 'door' | …). null today. */
  edgeType: string | null;
}

/** A cell-space point in ONE pane's interior coordinate space. */
export interface CellPoint2 {
  x: number;
  y: number;
}

/** A pane's INTERIOR content extent (layout.width/height) — DISTINCT from the
 *  composition-grid space PaneRect lives in. */
export interface PaneDims {
  width: number;
  height: number;
}

/** Result of bridging a coordinate across a seam. */
export type BridgeResult =
  | { kind: 'same-level'; paneId: string; cell: CellPoint2 }
  | { kind: 'cross-level' }
  | { kind: 'closed' };

// ---------------------------------------------------------------------------
// abutment helpers
// ---------------------------------------------------------------------------

/** Half-open overlap of [a0,a1) and [b0,b1). Returns null when they don't
 *  overlap (touching at a point counts as no overlap — a zero-length seam is
 *  not a seam). */
function segmentOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): { start: number; end: number } | null {
  const start = Math.max(a0, b0);
  const end = Math.min(a1, b1);
  if (end <= start) return null;
  return { start, end };
}

/**
 * Deterministic, order-independent seam id. The two pane ids are sorted so the
 * id is identical regardless of which pane is A — the dedup key.
 */
export function canonicalSeamId(
  axis: SeamAxis,
  segment: SeamSegment,
  idA: string,
  idB: string,
): string {
  const lo = idA < idB ? idA : idB;
  const hi = idA < idB ? idB : idA;
  return `${axis}:${segment.line}:${segment.start}-${segment.end}:${lo}|${hi}`;
}

// ---------------------------------------------------------------------------
// buildSeams
// ---------------------------------------------------------------------------

/**
 * Derive the seam graph from the pane arrangement. O(n²) pairwise (n is tiny —
 * single=1, study=2, double-split=4). Emits one Seam per abutting ordered pair
 * (A always the lower-coordinate pane), dedups by canonical id, and sorts by id
 * for determinism.
 *
 * Returns [] for <2 panes (and for the lone full-grid 'root' pane), so
 * PixiApp's `livePanes.size <= 1` early-return is preserved exactly.
 */
export function buildSeams(
  panes: readonly PaneDescriptor[],
  gridCols: number,
  gridRows: number,
): Seam[] {
  void gridCols;
  void gridRows;
  if (panes.length < 2) return [];

  const byId = new Map<string, Seam>();

  for (let i = 0; i < panes.length; i++) {
    for (let j = 0; j < panes.length; j++) {
      if (i === j) continue;
      const a = panes[i];
      const b = panes[j];

      // VERTICAL seam: a is left of b (a.right edge === b.left edge).
      if (a.rect.col + a.rect.cols === b.rect.col) {
        const ov = segmentOverlap(
          a.rect.row,
          a.rect.row + a.rect.rows,
          b.rect.row,
          b.rect.row + b.rect.rows,
        );
        if (ov) {
          const segment: SeamSegment = {
            axis: 'vertical',
            line: b.rect.col,
            start: ov.start,
            end: ov.end,
          };
          const id = canonicalSeamId('vertical', segment, a.id, b.id);
          if (!byId.has(id)) {
            byId.set(id, {
              id,
              paneA: a.id,
              edgeA: 'right',
              paneB: b.id,
              edgeB: 'left',
              levelA: a.level,
              levelB: b.level,
              segment,
              open: true,
              edgeType: null,
            });
          }
        }
      }

      // HORIZONTAL seam: a is above b (a.bottom edge === b.top edge).
      if (a.rect.row + a.rect.rows === b.rect.row) {
        const ov = segmentOverlap(
          a.rect.col,
          a.rect.col + a.rect.cols,
          b.rect.col,
          b.rect.col + b.rect.cols,
        );
        if (ov) {
          const segment: SeamSegment = {
            axis: 'horizontal',
            line: b.rect.row,
            start: ov.start,
            end: ov.end,
          };
          const id = canonicalSeamId('horizontal', segment, a.id, b.id);
          if (!byId.has(id)) {
            byId.set(id, {
              id,
              paneA: a.id,
              edgeA: 'bottom',
              paneB: b.id,
              edgeB: 'top',
              levelA: a.level,
              levelB: b.level,
              segment,
              open: true,
              edgeType: null,
            });
          }
        }
      }
    }
  }

  return Array.from(byId.values()).sort((s1, s2) => (s1.id < s2.id ? -1 : s1.id > s2.id ? 1 : 0));
}

// ---------------------------------------------------------------------------
// bridgeCoord
// ---------------------------------------------------------------------------

/** Round + clamp an integer into [0, max). */
function clampInt(v: number, max: number): number {
  const r = Math.round(v);
  if (r < 0) return 0;
  if (r >= max) return max - 1;
  return r;
}

/**
 * Project an interior coordinate from ONE pane's space onto the neighbour's
 * entry cell across a seam.
 *
 * @param seam   the seam being crossed.
 * @param from   the source coordinate: which pane it sits in + its interior x/y.
 * @param dimsA  paneA's interior content extent (layout.width/height).
 * @param dimsB  paneB's interior content extent.
 *
 * SAME-LEVEL open seam: the destination entry cell sits on the shared edge's
 * first interior row/column (x=0 crossing to a right neighbour's left edge,
 * x=destWidth-1 crossing left; symmetric y for top/bottom). The ALONG-edge
 * coordinate is proportionally projected from the source interior dims to the
 * destination interior dims (round to nearest, clamp in-bounds). The projection
 * is lossy at integer rounding, so a round-trip may be off by ±1 — acceptable
 * for a walk-through (player lands adjacent on the shared edge).
 *
 * CROSS-LEVEL seam (levelA !== levelB): { kind: 'cross-level' } with NO cell —
 * a cell tile and a district tile are not the same coordinate space; this is a
 * focus-transfer/zoom HINT, not a literal walk.
 *
 * CLOSED seam: { kind: 'closed' }.
 */
export function bridgeCoord(
  seam: Seam,
  from: { paneId: string; x: number; y: number },
  dimsA: PaneDims,
  dimsB: PaneDims,
): BridgeResult {
  if (!seam.open) return { kind: 'closed' };
  if (seam.levelA !== seam.levelB) return { kind: 'cross-level' };

  // Resolve which pane is the source vs the destination, and pull each side's
  // dims. dimsA always describes paneA, dimsB describes paneB.
  const fromIsA = from.paneId === seam.paneA;
  const fromIsB = from.paneId === seam.paneB;
  if (!fromIsA && !fromIsB) {
    // The `from` pane is not on this seam — caller error; treat as no crossing.
    return { kind: 'cross-level' };
  }

  const srcDims = fromIsA ? dimsA : dimsB;
  const dstDims = fromIsA ? dimsB : dimsA;
  const destPaneId = fromIsA ? seam.paneB : seam.paneA;

  if (seam.segment.axis === 'vertical') {
    // Crossing a vertical seam moves along x; y is the along-edge axis.
    // If `from` is the LEFT pane (paneA when seam.edgeA === 'right'), it exits
    // its right edge and enters the right pane's LEFT column (x = 0). Crossing
    // the other way enters the left pane's RIGHT column (x = destWidth - 1).
    const exitingRight = fromIsA; // paneA is the left (lower-col) pane
    const destX = exitingRight ? 0 : dstDims.width - 1;
    const srcSpan = Math.max(1, srcDims.height - 1);
    const dstSpan = Math.max(1, dstDims.height - 1);
    const projY = (from.y / srcSpan) * dstSpan;
    return {
      kind: 'same-level',
      paneId: destPaneId,
      cell: { x: destX, y: clampInt(projY, dstDims.height) },
    };
  }

  // horizontal seam — crossing moves along y; x is the along-edge axis.
  const exitingDown = fromIsA; // paneA is the top (lower-row) pane
  const destY = exitingDown ? 0 : dstDims.height - 1;
  const srcSpan = Math.max(1, srcDims.width - 1);
  const dstSpan = Math.max(1, dstDims.width - 1);
  const projX = (from.x / srcSpan) * dstSpan;
  return {
    kind: 'same-level',
    paneId: destPaneId,
    cell: { x: clampInt(projX, dstDims.width), y: destY },
  };
}
