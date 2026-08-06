/**
 * Cloud drift (#19 slice 2) — pure maths for the terminal renderer's
 * drifting wisps. The composer still bakes static clouds (non-animated
 * surfaces keep them); the terminal path hides that layer and re-renders
 * the SAME wisps from here, drifting on the wall clock — two windows on the
 * same wing agree without a broker channel, and a throttled renderer that
 * wakes simply snaps to where the sky has got to. Speed is wallpaper-scale
 * (a window crossing every few minutes): noticeable in ~10 s of watching,
 * ambient at a glance. Pure + Pixi-free so scripts/smoke-cloud-drift.mts
 * can run it.
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

/** A wisp is starved when its row is mostly blocked — it spends the crossing
 *  at alpha 0 (the bar-3 eyeball finding: every window wears a mural, and the
 *  mural span dominated both baked cloud rows at desk widths). */
const RE_ROW_THRESHOLD = 0.5;
/** The composer's canonical wisp shapes — used to restore the intended count
 *  when the mural evicts a baked run outright. */
const WISP_SHAPES = ['~ ~~~~ ~', '~~ ~~~'] as const;
/** The composer always bakes two wisps; the drifting sky keeps that many. */
const WISP_COUNT = 2;

function blockedSpansAt(model: LandModel, y: number): Array<readonly [number, number]> {
  const blocked: Array<readonly [number, number]> = [];
  let bs = -1;
  for (let c = 0; c <= model.width; c++) {
    const bad = c < model.width && !DRIFTABLE.has(model.role[y][c]);
    if (bad && bs < 0) bs = c;
    if (!bad && bs >= 0) { blocked.push([bs, c]); bs = -1; }
  }
  return blocked;
}

const blockedFraction = (spans: ReadonlyArray<readonly [number, number]>, width: number): number =>
  spans.reduce((n, [s, e]) => n + (e - s), 0) / width;

/** The clearest sky row not yet taken: lowest blocked fraction, ties to the
 *  smallest row. Row 0 is never a candidate (the drag strip overlays it). */
function clearestRow(model: LandModel, taken: ReadonlySet<number>): number {
  let best = -1;
  let bestFrac = Infinity;
  for (let y = 1; y < model.height; y++) {
    if (taken.has(y)) continue;
    const f = blockedFraction(blockedSpansAt(model, y), model.width);
    if (f < bestFrac) { bestFrac = f; best = y; }
  }
  return best;
}

/** The baked cloud runs, lifted: one WispSpec per contiguous cloud-role run,
 *  with per-wisp speed/phase from fnv1a over (seed, index). Two visibility
 *  rescues (bar-3 eyeball fix, 2026-08-06), both render-side — the model is
 *  untouched and static surfaces keep the baked clouds exactly:
 *  - a wisp whose row is > RE_ROW_THRESHOLD blocked drifts on the clearest
 *    free sky row instead (pre-fix it crossed at alpha 0);
 *  - if the mural evicted baked runs outright (a real seed-41 outcome at
 *    desk widths), canonical-shape wisps are synthesized on clear rows so
 *    the sky keeps the composer's intended weather. */
export function extractWisps(model: LandModel, seed: number): WispSpec[] {
  const runs: Array<{ row: number; text: string }> = [];
  for (let y = 0; y < model.height; y++) {
    let x = 0;
    while (x < model.width) {
      if (model.role[y][x] !== 'cloud') { x++; continue; }
      let end = x;
      while (end < model.width && model.role[y][end] === 'cloud') end++;
      const text = model.char[y].slice(x, end).join('');
      // A run the mural clipped to a stub no longer reads as a wisp —
      // treat it as evicted and let synthesis restore the count.
      if (text.length >= 3 && text.split('~').length - 1 >= 2) runs.push({ row: y, text });
      x = end;
    }
  }
  while (runs.length < WISP_COUNT) runs.push({ row: -1, text: WISP_SHAPES[runs.length % WISP_SHAPES.length] });

  const taken = new Set<number>();
  return runs.map((run, i) => {
    let row = run.row;
    if (row < 0 || blockedFraction(blockedSpansAt(model, row), model.width) > RE_ROW_THRESHOLD) {
      const clear = clearestRow(model, taken);
      if (clear >= 0) row = clear;
    }
    taken.add(row);
    const h = fnv1a32(`${seed}:wisp:${i}`);
    return {
      row,
      text: run.text,
      // 0.25..0.45 cells/s — a window crossing every ~3-5 min. The first cut
      // (0.04..0.10) moved under a cell per 15 s of watching: mechanically
      // alive, humanly invisible (Harry, 2026-08-06). This band clears the
      // bar's "noticeable in ~10 s" leg (~3-4 cells of motion) while staying
      // ambient; the too-salient direction has its own frozen kill ladder.
      speed: 0.25 + (h % 61) / 300,
      phase: h % model.width,
      blocked: blockedSpansAt(model, row),
    };
  });
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
