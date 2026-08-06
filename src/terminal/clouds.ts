/**
 * Cloud drift (#19 slice 2) — pure maths for the terminal renderer's
 * drifting wisps. The composer still bakes static clouds (non-animated
 * surfaces keep them); the terminal path hides that layer and re-renders
 * the SAME wisps from here, drifting on the wall clock — two windows on the
 * same wing agree without a broker channel, and a throttled renderer that
 * wakes simply snaps to where the sky has got to. Speed is wallpaper-scale
 * (a few cells per minute): noticeable in ~10 s of watching, invisible at
 * a glance. Pure + Pixi-free so scripts/smoke-cloud-drift.mts can run it.
 */
import type { LandModel, LandRole } from '../procedural/land';
import { fnv1a32 } from '../procedural/seed';

/** Sky-register roles a wisp may drift over (a cloud IN FRONT of the moon
 *  is weather, not a bug); anything else — mural, skyline, structures —
 *  fades the wisp out: the world always wins. */
const DRIFTABLE = new Set<LandRole>(['sky', 'skyDither', 'star', 'starBright', 'cloud', 'moon']);

export interface WispSpec {
  readonly row: number;
  /** The baked wisp's glyph run, verbatim (e.g. '~ ~~~~ ~'). */
  readonly text: string;
  /** Cells per second — 0.04..0.10. */
  readonly speed: number;
  /** Starting offset in cells. */
  readonly phase: number;
  /** Column spans [start, end) on this row the wisp must not cover. */
  readonly blocked: ReadonlyArray<readonly [number, number]>;
}

/** The baked cloud runs, lifted: one WispSpec per contiguous cloud-role run,
 *  with per-wisp speed/phase from fnv1a over (seed, index). */
export function extractWisps(model: LandModel, seed: number): WispSpec[] {
  const wisps: WispSpec[] = [];
  for (let y = 0; y < model.height; y++) {
    let x = 0;
    while (x < model.width) {
      if (model.role[y][x] !== 'cloud') { x++; continue; }
      let end = x;
      while (end < model.width && model.role[y][end] === 'cloud') end++;
      const text = model.char[y].slice(x, end).join('');
      const blocked: Array<readonly [number, number]> = [];
      let bs = -1;
      for (let c = 0; c <= model.width; c++) {
        const bad = c < model.width && !DRIFTABLE.has(model.role[y][c]);
        if (bad && bs < 0) bs = c;
        if (!bad && bs >= 0) { blocked.push([bs, c]); bs = -1; }
      }
      const h = fnv1a32(`${seed}:wisp:${wisps.length}`);
      wisps.push({
        row: y,
        text,
        speed: 0.04 + (h % 61) / 1000, // 0.040..0.100 cells/s (2.4..6 cells/min)
        phase: h % model.width,
        blocked,
      });
      x = end;
    }
  }
  return wisps;
}

/** Position at wall-clock second tSec: cells, in [-text.length, width),
 *  wrapping — the wisp slides fully off the right edge and re-enters left. */
export function wispX(w: WispSpec, tSec: number, width: number): number {
  const span = width + w.text.length;
  return ((((w.phase + tSec * w.speed) % span) + span) % span) - w.text.length;
}

/** Target alpha at xCells: 0 while [x, x+len) overlaps a blocked span, 1 in
 *  the clear, a linear 2-cell skirt between — the wisp fades out approaching
 *  a mural or silhouette and back in past it, never pops. */
export function wispAlpha(w: WispSpec, xCells: number): number {
  const x0 = xCells;
  const x1 = xCells + w.text.length;
  let gap = Infinity;
  for (const [s, e] of w.blocked) {
    if (x1 > s && x0 < e) return 0;
    gap = Math.min(gap, x0 >= e ? x0 - e : s - x1);
  }
  return Math.min(1, gap / 2);
}
