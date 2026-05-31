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

// ---------------------------------------------------------------------------
// seamExitsForPane (Phase 7-D.2 — the crossing exits)
// ---------------------------------------------------------------------------

/** One open walkable seam exit FROM a pane: the interior edge cell that, when
 *  stepped off, crosses into a neighbour, plus the bridged entry cell in the
 *  neighbour's interior space. `entry.paneId` is the neighbour. */
export interface SeamExit {
  /** The interior edge cell of THIS pane the agent must be at + step off. */
  edge: CellPoint2;
  /** Which physical edge of THIS pane the exit faces ('E'/'W'/'N'/'S'). */
  sharedEdge: 'N' | 'E' | 'S' | 'W';
  /** The bridged entry cell in the neighbour pane's interior space. */
  entry: { paneId: string; x: number; y: number };
}

/** Stable key for a cell, for the edge-cell → exit lookup map. */
function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Phase 7-D.2 (must-fix) — per-pane walkability oracle. `isWalkable(paneId, x, y)`
 * answers "is the cell (x,y) in pane `paneId`'s interior STAND-ON-ABLE (floor)?".
 * `seamExitsForPane` gates BOTH the exit cell (this pane) AND the bridged entry
 * cell (neighbour) through it, so an agent can NEVER be offered a cross that
 * would step it off a wall or migrate it INTO a wall (where `walkableNeighbours`
 * returns [] and the agent would be stuck).
 *
 * This matters because the real cell layout fills its WHOLE perimeter with wall
 * (`boundaryAt` → edgeE/edgeW = T_WALL_V, edgeN/edgeS = T_WALL_H) with the only
 * door on the SOUTH edge. So today an E/W (vertical-split) seam yields ZERO
 * crossable exits — the honest empty result. A walkable seam edge needs a
 * follow-up that opens a floor edge cell (deferred; see STATE.md / TODO-USER.md).
 */
export type WalkableOracle = (paneId: string, x: number, y: number) => boolean;

/**
 * Phase 7-D.2 — derive the SAME-LEVEL OPEN walkable seam exits for ONE pane, as
 * a Map keyed by THIS pane's interior edge cell ("x,y") → the bridged entry into
 * the neighbour. PURE (no PIXI / Date.now / Math.random): a function of the seam
 * graph + each pane's interior dims (+ an optional walkability oracle), so the
 * crossing path stays inside the determinism contract the rest of `seams.ts`
 * honours.
 *
 * For each seam touching `paneId` that is OPEN and SAME-LEVEL, we walk the
 * along-edge interior span of THIS pane (its full edge band, 0..height for a
 * vertical seam / 0..width for horizontal — the seam segment is grid-space, but
 * the exit is offered for every interior cell on the abutting edge) and call
 * `bridgeCoord` to get the neighbour entry cell. The edge cell is the LAST
 * interior column/row on the shared side (x=width-1 for an east exit, x=0 for
 * west, y=height-1 for south, y=0 for north).
 *
 * FLOOR GATE (must-fix): when `isWalkable` is supplied, an exit is emitted ONLY
 * if BOTH the exit cell (this pane) AND the bridged entry cell (neighbour) are
 * walkable (mirrors behavior.ts:walkableNeighbours, which only steps onto
 * T_FLOOR). Without the gate an agent could migrate into a wall and be stuck
 * (no walkable neighbour out). Omitting `isWalkable` (the pure smoke's synthetic
 * exits) keeps the geometric-only behaviour for tests that build floor cells by
 * construction.
 *
 * Returns an EMPTY map when no open same-level seam touches the pane — so a
 * single 'root' pane (buildSeams returns []) yields {} and the crossing path is
 * dead, byte-identical to today. With the real layout an E/W seam also yields {}
 * because the edge column is solid wall (no floor edge cell to stand on).
 */
export function seamExitsForPane(
  seams: readonly Seam[],
  paneId: string,
  dimsByPaneId: ReadonlyMap<string, PaneDims>,
  isWalkable?: WalkableOracle,
): Map<string, SeamExit> {
  const exits = new Map<string, SeamExit>();
  const myDims = dimsByPaneId.get(paneId);
  if (!myDims) return exits;

  for (const seam of seams) {
    if (!seam.open) continue;
    if (seam.levelA !== seam.levelB) continue; // cross-level deferred
    const isA = seam.paneA === paneId;
    const isB = seam.paneB === paneId;
    if (!isA && !isB) continue;

    const dimsA = dimsByPaneId.get(seam.paneA);
    const dimsB = dimsByPaneId.get(seam.paneB);
    if (!dimsA || !dimsB) continue; // neighbour not a live cell pane → skip

    if (seam.segment.axis === 'vertical') {
      // Crossing moves along x; y is the along-edge axis. paneA is the LEFT
      // pane (exits its right edge, 'E'); paneB is the RIGHT pane (exits its
      // left edge, 'W').
      const sharedEdge: 'E' | 'W' = isA ? 'E' : 'W';
      const edgeX = isA ? myDims.width - 1 : 0;
      for (let y = 0; y < myDims.height; y++) {
        const bridged = bridgeCoord(seam, { paneId, x: edgeX, y }, dimsA, dimsB);
        if (bridged.kind !== 'same-level') continue;
        // FLOOR GATE — the exit cell (here) AND the entry cell (neighbour) must
        // both be stand-on-able, or the cross would strand the agent in a wall.
        if (isWalkable && !isWalkable(paneId, edgeX, y)) continue;
        if (isWalkable && !isWalkable(bridged.paneId, bridged.cell.x, bridged.cell.y)) continue;
        exits.set(cellKey(edgeX, y), {
          edge: { x: edgeX, y },
          sharedEdge,
          entry: { paneId: bridged.paneId, x: bridged.cell.x, y: bridged.cell.y },
        });
      }
    } else {
      // Horizontal seam: crossing moves along y; x is the along-edge axis.
      // paneA is the TOP pane (exits its bottom edge, 'S'); paneB is the
      // BOTTOM pane (exits its top edge, 'N').
      const sharedEdge: 'S' | 'N' = isA ? 'S' : 'N';
      const edgeY = isA ? myDims.height - 1 : 0;
      for (let x = 0; x < myDims.width; x++) {
        const bridged = bridgeCoord(seam, { paneId, x, y: edgeY }, dimsA, dimsB);
        if (bridged.kind !== 'same-level') continue;
        if (isWalkable && !isWalkable(paneId, x, edgeY)) continue;
        if (isWalkable && !isWalkable(bridged.paneId, bridged.cell.x, bridged.cell.y)) continue;
        exits.set(cellKey(x, edgeY), {
          edge: { x, y: edgeY },
          sharedEdge,
          entry: { paneId: bridged.paneId, x: bridged.cell.x, y: bridged.cell.y },
        });
      }
    }
  }
  return exits;
}
