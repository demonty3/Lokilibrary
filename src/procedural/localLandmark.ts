/**
 * Local-model landmark — deterministic placement + appearance for the
 * "Local AI lives in your world" Depth 1 slice (Phase 6A; IDEAS.md "The
 * local LLM is visible in the world", Depth 1).
 *
 * If the user runs a local Ollama model it manifests as ONE landmark in the
 * cell: a small glyph for a small model (a cottage), a taller glyph for a
 * large one (a tower), glowing when a model is actively loaded. This module
 * is the PURE, deterministic core:
 *
 *   - `pickLandmarkModel` — which installed model becomes the landmark
 *     (largest by sizeBytes, name tiebreak) so multiple models still yield
 *     ONE deterministic landmark (IDEAS.md "multiple models = a village" is
 *     a LATER depth).
 *   - `landmarkVariantFor` / `landmarkGlyphFor` — the size→variant→glyph map
 *     (the testable core). Whitelisted box/unicode glyphs only — both
 *     confirmed present in the Cozette atlas (CLAUDE.md: never render an
 *     unshipped glyph).
 *   - `formatLocalModelStatus` — the diegetic press-E status string.
 *   - `pickLandmarkCell` — deterministic floor-cell placement.
 *
 * **Determinism (CLAUDE.md hard rule).** Placement uses
 * `mulberry32((seed ^ 0x1a4d) >>> 0)` — namespace `0x1a4d` ("LAnD"), distinct
 * from cell `0xce11`, scatter `0x5ca7`, and Loki `0x10ce`. NO wall-clock, NO
 * Math.random: the share-URL / WFC contract depends on same-seed→same-world.
 *
 * The model's RUNNING state is live + machine-dependent, so it is kept OUT
 * of placement entirely: position depends only on (seed, layout, keepouts);
 * only the chosen GLYPH varies with model size, and the GLOW varies with
 * running state. Putting model size/name into the PRNG seed would break the
 * determinism contract.
 */

import { mulberry32 } from './prng';
import type { CellLayout, CellPoint } from './cell';
import { T_FLOOR } from './tiles/library';
import type { ThemePalette } from '../themes/types';
import type { LocalModelInfo, LocalModelResult } from '../api/localModel';

/** PRNG namespace for landmark placement — distinct from every other
 *  src/procedural consumer (cell 0xce11, scatter 0x5ca7, Loki 0x10ce). */
export const LANDMARK_SEED_NAMESPACE = 0x1a4d;

export type LandmarkVariant = 'cottage' | 'tower';

/**
 * Parameter-size threshold (in billions) at which a model reads as a TOWER
 * rather than a COTTAGE. IDEAS.md anchors the two ends (cottage = 7B, tower
 * = 70B) and leaves the middle open; 30B is the canonical cutoff — a 7B/14B
 * dev model stays a cottage, a 30B+ "I have real hardware" model becomes a
 * tower (the hardware-flex beat in IDEAS.md). Pinned by the 6A smoke. */
export const TOWER_PARAM_THRESHOLD_B = 30;

/** Byte-size fallback threshold when a model has no `paramClass`. Ollama's
 *  GGUF blob sizes are ~0.6 GB/B at q4, so 30B ≈ 18 GB; use 18 GiB. */
export const TOWER_SIZE_THRESHOLD_BYTES = 18 * 1024 * 1024 * 1024;

/** Whitelisted landmark glyphs — both confirmed in the Cozette atlas.
 *  `⌂` (U+2302) reads as a house/cottage; `║` (U+2551) reads as a tall
 *  tower column. Exported so the smoke can assert "only these ever emit". */
export const LANDMARK_GLYPHS: Readonly<Record<LandmarkVariant, string>> = {
  cottage: '⌂',
  tower: '║',
};

/** Theme palette key the landmark tints to. `cyan` reads as a distinct
 *  "this is special / yours" accent against the warm bookshelf/scatter
 *  palette and exists in every shipped theme (ThemePalette). */
export const LANDMARK_FG_KEY: keyof ThemePalette = 'cyan';

/**
 * Parse a parameter-class token ('7B', '13.0B', '70.6B') into a number of
 * billions. Returns undefined when there is nothing parseable. Pure.
 */
export function paramClassToBillions(paramClass: string | undefined): number | undefined {
  if (!paramClass) return undefined;
  const m = /([0-9]+(?:\.[0-9]+)?)\s*B/i.exec(paramClass);
  if (!m) return undefined;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Map a model to its landmark variant. Prefers the parameter class (the
 * canonical size signal); falls back to raw byte size when paramClass is
 * absent; defaults to 'cottage' when neither is known (a presence we can't
 * size reads as the humble option). Pure — the smoke pins the boundary.
 */
export function landmarkVariantFor(model: LocalModelInfo): LandmarkVariant {
  const billions = paramClassToBillions(model.paramClass);
  if (billions !== undefined) {
    return billions >= TOWER_PARAM_THRESHOLD_B ? 'tower' : 'cottage';
  }
  if (typeof model.sizeBytes === 'number') {
    return model.sizeBytes >= TOWER_SIZE_THRESHOLD_BYTES ? 'tower' : 'cottage';
  }
  return 'cottage';
}

/** Variant → glyph. Always a whitelisted glyph. */
export function landmarkGlyphFor(variant: LandmarkVariant): string {
  return LANDMARK_GLYPHS[variant];
}

/**
 * Pick the single landmark model from a present snapshot: largest by
 * sizeBytes, then by paramClass billions, then lexical name as a final
 * deterministic tiebreak. Returns null when no model is present. Pure +
 * deterministic (no dependence on array order beyond the explicit sort).
 */
export function pickLandmarkModel(result: LocalModelResult): LocalModelInfo | null {
  if (!result.present || result.models.length === 0) return null;
  const ranked = [...result.models].sort((a, b) => {
    const sa = a.sizeBytes ?? -1;
    const sb = b.sizeBytes ?? -1;
    if (sa !== sb) return sb - sa;
    const pa = paramClassToBillions(a.paramClass) ?? -1;
    const pb = paramClassToBillions(b.paramClass) ?? -1;
    if (pa !== pb) return pb - pa;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  return ranked[0];
}

/**
 * Diegetic press-E status string. Presence + status ONLY — no dialogue
 * (CLAUDE.md "don't make the agent a chatbot"). Shape:
 *   "Qwen 2.5 7B · idle · localhost"  /  "Qwen 2.5 7B · running · localhost"
 */
export function formatLocalModelStatus(model: LocalModelInfo, running: boolean): string {
  return `${model.name} · ${running ? 'running' : 'idle'} · localhost`;
}

/**
 * Deterministically pick the landmark's floor cell. Mirrors
 * `pickLokiSpawn(layout, seed)`: scan T_FLOOR cells, exclude the player
 * spawn + caller-supplied keepouts (Loki's spawn + scatter footprint), and
 * require at least one walkable (floor, non-keepout) neighbour so the player
 * can stand adjacent and press E. Falls back gracefully if no such cell
 * exists.
 */
export function pickLandmarkCell(
  layout: CellLayout,
  seed: number,
  keepouts: readonly CellPoint[] = [],
): CellPoint {
  const prng = mulberry32((seed ^ LANDMARK_SEED_NAMESPACE) >>> 0);

  const forbidden = new Set<string>();
  forbidden.add(key(layout.spawnAt.x, layout.spawnAt.y));
  for (const k of keepouts) forbidden.add(key(k.x, k.y));

  const isFloorFree = (x: number, y: number): boolean => {
    if (x < 0 || x >= layout.width || y < 0 || y >= layout.height) return false;
    if (layout.tiles[y][x] !== T_FLOOR) return false;
    return !forbidden.has(key(x, y));
  };

  const hasFreeNeighbour = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (isFloorFree(x + dx, y + dy)) return true;
      }
    }
    return false;
  };

  // Candidate floor cells that are themselves placeable AND have a walkable
  // neighbour to stand on. Built in a stable scan order so the PRNG pick is
  // reproducible.
  const candidates: CellPoint[] = [];
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (!isFloorFree(x, y)) continue;
      if (!hasFreeNeighbour(x, y)) continue;
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    // Degenerate room: relax the neighbour requirement, then fall back to
    // any free floor cell, then the spawn-adjacent default.
    for (let y = 0; y < layout.height; y++) {
      for (let x = 0; x < layout.width; x++) {
        if (isFloorFree(x, y)) candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return { x: 1, y: 1 };

  return prng.pick(candidates);
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
