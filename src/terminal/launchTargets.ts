/**
 * The launcher beat — pure target geometry (no PIXI, no IPC, no wall clock;
 * the siteLabels.ts / wear.ts posture, smokeable in
 * scripts/smoke-launch-targets.mts).
 *
 * A wing's games stand on its land as sites: surface structures and buried
 * relics, each already carrying a proximity-revealed label. Clicking one is
 * how you launch it (Harry, 2026-08-06 — the whole land is the launcher, not
 * one button). This module answers two questions and nothing else: which
 * sites are launchable, and which one did a click land on.
 *
 * A single glyph is not a mouse target, so a hotspot is generous: the label
 * plus the structure or relic above it read as one object, and that is the
 * box. Sites whose game has no appid (nothing to launch) produce no hotspot
 * at all — no affordance, no dead click.
 */

import type { LandModel, LandRole } from '../procedural/land';

/** Half-width of a hotspot, in columns, either side of the site centre. */
export const LAUNCH_HIT_COLS = 3;
/** Rows ABOVE the site's label row — the structure standing over its name. */
export const LAUNCH_HIT_ROWS_ABOVE = 4;
/** Rows BELOW the label row (the label itself sits at row 0 of the box). */
export const LAUNCH_HIT_ROWS_BELOW = 1;

export interface LaunchTarget {
  /** Site centre column. */
  readonly x: number;
  /** The site's label row — the hotspot box is measured from here. */
  readonly y: number;
  /** Full game name (LandSite.text is truncated for drawing). */
  readonly name: string;
  readonly appid: number;
  readonly kind: 'surface' | 'buried';
}

/** Launchable sites, in model order. A site with no appid is skipped. */
export function launchTargets(
  model: Pick<LandModel, 'sites'>,
): LaunchTarget[] {
  const out: LaunchTarget[] = [];
  for (const s of model.sites) {
    if (s.appid === undefined) continue;
    out.push({ x: s.x, y: s.y, name: s.name, appid: s.appid, kind: s.kind });
  }
  return out;
}

/** The target a cell-space click lands on, or null. Nearest centre column
 *  wins when hotspots overlap; ties break by model order (the earlier site),
 *  matching the behavior.ts insertion-order discipline. */
export function hitLaunchTarget(
  targets: readonly LaunchTarget[],
  cellX: number,
  cellY: number,
): LaunchTarget | null {
  let best: LaunchTarget | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const dx = Math.abs(cellX - t.x);
    if (dx > LAUNCH_HIT_COLS) continue;
    if (cellY < t.y - LAUNCH_HIT_ROWS_ABOVE || cellY > t.y + LAUNCH_HIT_ROWS_BELOW) continue;
    if (dx < bestDist) {
      bestDist = dx;
      best = t;
    }
  }
  return best;
}

/**
 * The column of the monument's door, or null when this land has no monument
 * (a wing's slice need not contain a `mastered` game, and a structure inside
 * the hall/seam buffer is skipped entirely).
 *
 * The errand walks HERE — the door is where the beat lands. A land without
 * one sends the runner to the clicked site's own column instead; that
 * fallback is the caller's, so this stays a plain lookup.
 */
export function doorColumn(
  role: ReadonlyArray<ReadonlyArray<LandRole>>,
): number | null {
  for (let y = 0; y < role.length; y++) {
    const row = role[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'door') return x;
    }
  }
  return null;
}
