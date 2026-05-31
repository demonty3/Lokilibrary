/**
 * Phase 7-D — cross-seam perception map (the cheap seed).
 *
 * GOAL. For a cell pane with an OPEN seam to a neighbour cell pane, the
 * per-tick WorldSnapshot fed to `computePerception` additionally contains the
 * neighbour's player + agents that fall within FOV across the shared edge, each
 * translated into THIS pane's cell-coordinate space via the seam bridge.
 * `perception.ts`'s FOV math (Chebyshev radius, salience dedupe, hold timer) is
 * UNTOUCHED — the enriched snapshot is the only new input.
 *
 * BYTE-IDENTICAL no-seam path. With NO open seam (`openSeamsFor(paneId)`
 * returns []) this returns the base WorldSnapshot BY REFERENCE (same object
 * identity), allocating nothing. The single-pane / multi-pane-unjoined paths
 * are therefore provably identical to today.
 *
 * ID NAMESPACING. Neighbour subjects are keyed under `${neighbourPaneId}:${id}`
 * so (a) they never collide with this pane's own agent of the same id (both
 * panes run the same 5-agent COHORT, so collision is the DEFAULT), (b)
 * perception.ts's `otherId === runtime.id` self-skip never accidentally drops a
 * neighbour, and (c) agent_meeting events carry a subject that identifies the
 * cross-seam origin. The neighbour PLAYER is surfaced as a synthetic agent
 * entry (`${neighbourPaneId}:player`) rather than overwriting `world.player` —
 * so THIS pane's own player_proximity / player_holding hold-timer stays intact.
 *
 * REACH PRE-FILTER. For each open seam, take the neighbour's player + each
 * neighbour agent, project via `bridge.toLocal`, and include it ONLY if its
 * projected position is within `maxFov` Chebyshev of the shared-edge band — a
 * cheap pre-filter so we don't project the neighbour's whole cohort every tick.
 * perception.ts still does the authoritative per-agent FOV test.
 *
 * SCOPE. This module CONSUMES the seam-graph contract (SeamEdge/SeamBridge) but
 * does not author the real adjacency derivation — the cohort wires an injected
 * `openSeamsFor` that defaults to a stub returning [] (see cohort.ts), so this
 * slice lands + smokes independently of a fully-wired seam graph. Seam-CROSSING
 * movement, memory-flow, and input transfer are explicitly OUT of scope here.
 */

import type { CellPoint } from '../procedural/cell';
import type { RuntimeScope } from '../state/agentRuntime';
import type { WorldSnapshot } from './perception';

/** Which physical edge of THIS pane the seam shares. */
export type SharedEdge = 'N' | 'E' | 'S' | 'W';

/**
 * Coordinate transform across a seam, pinned direction:
 * `toLocal(neighbourPoint)` maps a point in the NEIGHBOUR's cell space into
 * THIS pane's cell space. A subject sitting just over the shared edge lands at
 * the cell just outside this pane's edge (negative or >= width/height coords
 * are fine — Chebyshev distance still computes correctly and FOV clips the far
 * ones).
 */
export interface SeamBridge {
  toLocal(neighbourPoint: CellPoint): CellPoint;
}

/**
 * One OPEN seam from THIS pane's perspective: the neighbour it opens onto, the
 * bridge into this pane's space, the shared edge, and the band extent along
 * that edge in THIS pane's coordinates (the reach pre-filter measures Chebyshev
 * to this band, not to a fixed origin, so it doesn't mis-clip when the
 * neighbour grid is a different size).
 */
export interface SeamEdge {
  neighbourPaneId: string;
  bridge: SeamBridge;
  sharedEdge: SharedEdge;
  /** Edge band in THIS pane's cell coords: the line just outside this pane's
   *  edge that the neighbour projects onto, and the along-edge span. For an
   *  'E' edge: bandLine = width (one past the right column), [bandStart,bandEnd)
   *  in y. For 'S': bandLine = height, span in x. Used only by the pre-filter. */
  bandLine: number;
  bandStart: number;
  bandEnd: number;
  /** Whether this is a walkable same-level cell↔cell seam. The enricher REFUSES
   *  (skips) a seam that is not a flat cell-space adjacency — a vertical/scale
   *  seam is "visible from multiple altitudes", NOT a flat coordinate bridge. */
  walkable: boolean;
}

/** Dependencies injected into the enricher — defaulted to the real
 *  registry/graph lookups by the cohort, stubbed by the smoke. */
export interface CrossSeamDeps {
  /** Open seams for this pane. Returns [] unless a seam is BOTH adjacent AND
   *  open — the load-bearing invariant for the byte-identical no-seam path. */
  openSeamsFor: (paneId: string) => readonly SeamEdge[];
  /** Neighbour pane's RuntimeScope, or undefined if the neighbour is not a
   *  registered cell pane (district/island have no cohort). */
  getNeighbourScope: (paneId: string) => RuntimeScope | undefined;
  /** Neighbour pane's live player position (paneId-keyed; getPlayerPos). */
  getNeighbourPlayer: (paneId: string) => CellPoint;
  /** Max def.fov across the cohort — the reach pre-filter radius. Computed once
   *  at mount. perception.ts re-clips authoritatively per agent. */
  maxFov: number;
}

/** Chebyshev distance from a projected point to a seam's edge band (in THIS
 *  pane's cell coords). For an N/S band (horizontal line) the dominant axis is
 *  y-to-bandLine; for E/W it is x-to-bandLine. The along-edge axis is clamped
 *  into [bandStart, bandEnd) before measuring so a subject within the band's
 *  span but past its ends still measures correctly. */
function chebyshevToBand(edge: SeamEdge, p: CellPoint): number {
  if (edge.sharedEdge === 'E' || edge.sharedEdge === 'W') {
    const dx = Math.abs(p.x - edge.bandLine);
    const clampedY = Math.max(edge.bandStart, Math.min(edge.bandEnd - 1, p.y));
    const dy = Math.abs(p.y - clampedY);
    return Math.max(dx, dy);
  }
  const dy = Math.abs(p.y - edge.bandLine);
  const clampedX = Math.max(edge.bandStart, Math.min(edge.bandEnd - 1, p.x));
  const dx = Math.abs(p.x - clampedX);
  return Math.max(dx, dy);
}

/**
 * Enrich the per-tick WorldSnapshot with cross-seam subjects.
 *
 * Returns `base` BY REFERENCE when `openSeamsFor(paneId)` is empty (no copy, no
 * allocation) — the byte-identical no-seam guarantee. Otherwise returns a COPY
 * of `base` whose `agents` map additionally contains projected, namespaced
 * neighbour subjects within `maxFov` of the shared edge.
 */
export function enrichSnapshotAcrossSeams(
  base: WorldSnapshot,
  paneId: string,
  deps: CrossSeamDeps,
): WorldSnapshot {
  const edges = deps.openSeamsFor(paneId);
  if (edges.length === 0) return base; // byte-identical: same object, no alloc

  // Copy the agents map once; bookshelves + player pass by reference unchanged.
  const agents = new Map<string, CellPoint>(base.agents);

  for (const edge of edges) {
    // Refuse a non-walkable / non-flat-cell-space seam (vertical/scale seam):
    // a coordinate bridge does not apply, so skip rather than mis-project.
    if (!edge.walkable) continue;

    // Neighbour PLAYER → synthetic agent entry (never overwrites world.player).
    const neighbourPlayer = deps.getNeighbourPlayer(edge.neighbourPaneId);
    const projPlayer = edge.bridge.toLocal(neighbourPlayer);
    if (chebyshevToBand(edge, projPlayer) <= deps.maxFov) {
      agents.set(`${edge.neighbourPaneId}:player`, projPlayer);
    }

    // Neighbour AGENTS. A non-cell neighbour has no scope → skip the seam.
    const neighbourScope = deps.getNeighbourScope(edge.neighbourPaneId);
    if (!neighbourScope) continue;
    for (const rt of neighbourScope.runtimes.values()) {
      if (!rt.present) continue;
      const proj = edge.bridge.toLocal({ x: rt.x, y: rt.y });
      if (chebyshevToBand(edge, proj) > deps.maxFov) continue;
      agents.set(`${edge.neighbourPaneId}:${rt.id}`, proj);
    }
  }

  return {
    player: base.player,
    agents,
    bookshelves: base.bookshelves,
  };
}

/** A no-op deps stub: no open seams ever. The cohort default until the real
 *  seam graph is wired, so the no-seam path is byte-identical by construction.
 *  Exported so the cohort + smoke can share one canonical "off" deps object. */
export function noCrossSeamDeps(maxFov = 0): CrossSeamDeps {
  return {
    openSeamsFor: () => [],
    getNeighbourScope: () => undefined,
    getNeighbourPlayer: () => ({ x: 0, y: 0 }),
    maxFov,
  };
}
