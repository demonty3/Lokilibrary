/**
 * Phase 5B — "morning dispatch" overlay. Shown once on the SLEEPING →
 * FULL transition with the reflections + plan summaries the agents
 * produced overnight (via `triggerSleepReflection` in
 * `src/agents/sleep-reflection.ts`).
 *
 * Format: terminal-styled multi-line BitmapText pinned to the top
 * center of the screen. Each line is one agent's reflection. Auto-
 * dismisses after 30 s. No interactive dismiss in v1 — wallpaper
 * mode is click-through + the existing keydown listener in App.tsx is
 * gated on `!wallpaperMode`, so neither click nor keypress can reach
 * us. Auto-timeout is the entire UX.
 *
 * Lifted from the telemetry-overlay mount/unmount pattern
 * (`src/render/overlays/telemetry.ts`) — same container + BitmapText
 * + ticker-driven reposition story.
 *
 * IDEAS.md 2026-05-28 sleep mode entry: "First thing the user sees on
 * wake: a single one-line terminal dispatch, dismissable. *Last night
 * Loki added a shelf in the lighthouse and pinned a note about Disco
 * Elysium.* This is the screenshot-shareable artifact each morning."
 * The v1 here delivers the spirit (terminal-styled overnight summary)
 * if not the exact poetry — the per-agent reflection text comes from
 * Sonnet via /api/agent/reflect, so the language quality scales with
 * the prompt's craft.
 */

import { BitmapText, Container } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { Theme } from '../../themes/types';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/** Columns of air kept between the banner and each window edge. */
const GRID_MARGIN_COLS = 1;
/** Rows of air kept below the banner's last line. */
const GRID_MARGIN_ROWS = 1;

export interface MorningDispatchLine {
  readonly agentName: string;
  readonly text: string;
  /** True if the reflection also produced a multi-step plan
   *  (decorative — "...and made a plan" suffix). */
  readonly hadPlan: boolean;
}

export interface MountMorningDispatchOptions {
  app: Application;
  theme: Theme;
  lines: ReadonlyArray<MorningDispatchLine>;
  /** Auto-dismiss after this many ms. Default 30_000. */
  dismissAfterMs?: number;
  /** Fired once when the banner goes away — by the auto-dismiss timer as
   *  well as by an explicit `dismiss()`. A caller that holds the handle
   *  MUST use this to drop it: the auto-dismiss is internal, so without it
   *  the caller's handle outlives the banner and reports a destroyed
   *  overlay as still open (T4 bar 7 was mis-measured for exactly this
   *  reason — see `bannerRect` in terminalLand.ts). */
  onDismiss?: () => void;
  /** Draw on a cell grid rather than as free-floating 1x chrome: scaled to
   *  `scale`, wrapped to the columns that fit, and snapped to a cell origin
   *  at row `topRow`. The desk passes its `WORLD_SCALE` so the banner sits
   *  in the same columns and rows as the land, the masthead and the
   *  marginalia; the palace omits it and keeps the 1x overlay. */
  grid?: { scale: number; topRow: number };
  /** T5 — the desk's overnight proposal block, appended above the foot rule.
   *  The rows and their bracket hit spans come from ONE pure source
   *  (deskProposal.ts), passed in so this overlay stays desk-agnostic and
   *  the palace path (no `proposal`) stays byte-identical. The container
   *  stays non-interactive; the desk's own pointer handler asks
   *  `proposalHit` instead (the launcher-hotspot pattern). */
  proposal?: {
    rows: readonly string[];
    hit: {
      apply: { row: number; c0: number; c1: number };
      dismiss: { row: number; c0: number; c1: number };
    };
  };
}

/** A mounted banner. `view` is the overlay's own container — held so a
 *  caller can measure THE BANNER rather than guess at it from the stage
 *  (the last stage child is not the banner: a `scanlines` pack adds one
 *  after it, and after an auto-dismiss it is the masthead). */
export interface MorningDispatchHandle {
  readonly view: Container;
  /** Dismiss early (e.g. SLEEPING fires again before the auto-dismiss
   *  elapsed). Idempotent — the auto-dismiss timer calls this too. */
  dismiss(): void;
  /** T5 — which proposal bracket (if any) a canvas-space point lands on.
   *  Always null without a mounted proposal block. */
  proposalHit(globalX: number, globalY: number): 'apply' | 'dismiss' | null;
}

/** Mount the banner.
 *
 *  Returns `null` when `lines.length === 0` — no point mounting an
 *  empty banner. Caller treats `null` as "nothing to show, nothing
 *  to dismiss." T5: a `proposal` mounts even with zero lines — the
 *  proposal IS the dispatch on a night with nothing narrated.
 */
export function mountMorningDispatch(
  opts: MountMorningDispatchOptions,
): MorningDispatchHandle | null {
  if (opts.lines.length === 0 && !opts.proposal) return null;
  const dismissAfterMs = opts.dismissAfterMs ?? 30_000;

  const container = new Container();
  container.eventMode = 'none';
  opts.app.stage.addChild(container);

  /** Grid row (within the banner text) of the proposal block's first row,
   *  or null when no proposal is mounted. Re-derived on every re-render —
   *  wrapping can move it. */
  let proposalRow0: number | null = null;
  const compose = (maxCols?: number, maxRows?: number): string => {
    const r = renderDispatchProposal(opts.lines, opts.proposal?.rows ?? [], maxCols, maxRows);
    proposalRow0 = r.proposalRow0;
    return r.text;
  };

  const text = new BitmapText({
    text: compose(),
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(opts.theme.palette.fgBright),
      align: 'left',
    },
  });
  container.addChild(text);

  // On a grid: scale the CONTAINER by an integer (the masthead's pattern) so
  // the baked Cozette atlas stays pixel-exact — bumping fontSize instead
  // would resample it. Then wrap to the columns that survive the margin, and
  // snap the origin to a cell so the banner's glyphs sit in the same columns
  // and rows as the land's. Off the grid (the palace) nothing changes.
  const grid = opts.grid;
  const cell = { w: COZETTE_CELL_WIDTH * (grid?.scale ?? 1), h: COZETTE_CELL_HEIGHT * (grid?.scale ?? 1) };
  if (grid) container.scale.set(grid.scale);

  const reposition = (): void => {
    if (grid) {
      const cols = Math.floor(opts.app.screen.width / cell.w);
      // One column of air each side, so the longest wrapped row never runs
      // into the window edge; and never more rows than the window has below
      // `topRow`. At 2x a full cohort of 140-char reflections is ~32 rows,
      // which would run off the bottom — at 1x the same banner fitted, so
      // this bound is the scale-up's own debt.
      const rows = Math.floor(opts.app.screen.height / cell.h) - grid.topRow - GRID_MARGIN_ROWS;
      text.text = compose(Math.max(1, cols - 2 * GRID_MARGIN_COLS), Math.max(3, rows));
    }
    const x = (opts.app.screen.width - text.width * (grid?.scale ?? 1)) / 2;
    container.x = grid ? Math.max(0, Math.round(x / cell.w) * cell.w) : Math.floor(x);
    container.y = grid ? grid.topRow * cell.h : 24;
  };
  reposition();
  opts.app.renderer.on('resize', reposition);

  let torndown = false;
  const teardown = (): void => {
    if (torndown) return;
    torndown = true;
    opts.app.ticker.remove(autoDismissTick);
    opts.app.renderer.off('resize', reposition);
    container.destroy({ children: true });
    opts.onDismiss?.();
  };

  // Auto-dismiss on ACCUMULATED TICKER TIME, not on the wall clock — the
  // ticker is stopped during SLEEPING and runs at 1 Hz when throttled, so
  // a wall-clock deadline (`performance.now()`, or a setTimeout) burns the
  // banner's 30 s while nothing is being painted: the desk can re-enter
  // sleep on the same wake and the morning artifact expires unseen.
  // Summing `deltaMS` spends the budget only against frames the user was
  // actually shown.
  let shownMs = 0;
  const autoDismissTick: TickerCallback<unknown> = (ticker) => {
    shownMs += ticker.deltaMS;
    if (shownMs >= dismissAfterMs) teardown();
  };
  opts.app.ticker.add(autoDismissTick);

  const proposalHit = (globalX: number, globalY: number): 'apply' | 'dismiss' | null => {
    if (!opts.proposal || proposalRow0 === null || torndown) return null;
    const col = Math.floor((globalX - container.x) / cell.w);
    const row = Math.floor((globalY - container.y) / cell.h);
    for (const which of ['apply', 'dismiss'] as const) {
      const s = opts.proposal.hit[which];
      if (row === proposalRow0 + s.row && col >= s.c0 && col < s.c1) return which;
    }
    return null;
  };

  return { view: container, dismiss: teardown, proposalHit };
}

/** Continuation indent for a wrapped row — the same two columns the
 *  `↳` decoration already sits at, so a reflection that runs on stays
 *  visibly owned by the agent line above it. */
const WRAP_INDENT = '  ';

/** The rules that cap the banner top and bottom. `RULE_MIN_COLS` is the
 *  header at its shortest — a rule narrower than its own label would read as
 *  a mistake, so it is the floor for a one-line dispatch. */
const RULE = '─';
const HEAD_LABEL = '── overnight ';
const RULE_MIN_COLS = 15;

/** Greedy word-wrap to `maxCols` columns, indenting continuations. A word
 *  longer than the whole width is hard-broken rather than allowed to
 *  overhang — on the grid an overhanging row is the one thing that reads
 *  as broken. */
function wrapRow(row: string, maxCols: number): string[] {
  if (row.length <= maxCols) return [row];
  const out: string[] = [];
  let cur = '';
  let indent = '';
  const flush = (): void => {
    out.push(indent + cur);
    cur = '';
    indent = WRAP_INDENT;
  };
  for (const word of row.split(' ')) {
    let w = word;
    // A single word wider than the line: bite off full rows until it fits.
    while (indent.length + w.length > maxCols) {
      const room = maxCols - indent.length - (cur ? cur.length + 1 : 0);
      if (room > 0) {
        cur = cur ? `${cur} ${w.slice(0, room)}` : w.slice(0, room);
        w = w.slice(room);
      }
      flush();
    }
    if (cur && indent.length + cur.length + 1 + w.length > maxCols) flush();
    cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(indent + cur);
  return out;
}

/** Pure text builder — extracted for the smoke. Given a list of agent
 *  reflection lines, produce the multi-line banner text. Format — the rules
 *  span the widest row, so the dispatch reads as one panel:
 *
 *      ── overnight ───────────────────────────────────────────
 *      Loki: the player keeps returning to the Hades shelf
 *        ↳ and made a plan
 *      Archivist: someone has been near the south door tonight
 *      ────────────────────────────────────────────────────────
 *
 *  `maxCols` wraps every row to that many columns (continuations indented
 *  by `WRAP_INDENT`). Omitted, rows run as long as the reflection does —
 *  which is fine at 1x on a wide palace and NOT fine on the desk's 2x cell
 *  grid, where a two-sentence reflection would overhang the window.
 */
export function renderDispatch(
  lines: ReadonlyArray<MorningDispatchLine>,
  maxCols?: number,
  maxRows?: number,
): string {
  const wrap = (row: string): string[] =>
    maxCols && maxCols > WRAP_INDENT.length + 1 ? wrapRow(row, maxCols) : [row];

  // One group per agent, so a budget is spent in WHOLE reflections: half a
  // reflection reads worse than an omitted one.
  const groups = lines.map((line) => {
    const safeText = line.text.replace(/\s+/g, ' ').trim();
    const rows = wrap(`${line.agentName}: ${safeText}`);
    return line.hadPlan ? [...rows, ...wrap('  ↳ and made a plan')] : rows;
  });

  let shown = groups.length;
  if (maxRows !== undefined) {
    // Budget is the window minus the header and footer rules, one row each.
    // At least one group always shows — a single over-long reflection is
    // better spilled than swallowed.
    const budget = maxRows - 2;
    let used = 0;
    shown = 0;
    for (const g of groups) {
      if (shown > 0 && used + g.length > budget) break;
      used += g.length;
      shown++;
    }
  }
  const body = groups.slice(0, shown).flat();
  const dropped = groups.length - shown;

  // The rules span the block, so they read as the top and bottom of one
  // panel rather than as two stubs floating above and below it. Width is the
  // widest row actually shown (never wider — every body row is already
  // wrapped inside `maxCols`), floored so a one-line dispatch still gets a
  // rule long enough to carry the label.
  const width = Math.max(RULE_MIN_COLS, ...body.map((r) => r.length));
  // Header opens at the left, footer closes at the right: the drop count is
  // the one thing the footer has to say, so it sits where a reader lands.
  const head = HEAD_LABEL + RULE.repeat(Math.max(0, width - HEAD_LABEL.length));
  const footLabel = dropped > 0 ? ` +${dropped} more ──` : '';
  const foot = RULE.repeat(Math.max(1, width - footLabel.length)) + footLabel;
  return [head, ...body, foot].join('\n');
}

/** T5 — `renderDispatch` plus a proposal block above the foot rule, one
 *  blank row of air between them. Pure, extracted for the smoke; with no
 *  proposal rows it IS `renderDispatch` (byte-identical — the palace bar).
 *  Returns the block's first row index so the mounted banner's hit-test and
 *  the drawn glyphs share one geometry. The row budget hands the proposal
 *  its rows first — the proposal is the one actionable thing on the banner,
 *  so it is never the part that gets dropped. */
export function renderDispatchProposal(
  lines: ReadonlyArray<MorningDispatchLine>,
  proposalRows: readonly string[],
  maxCols?: number,
  maxRows?: number,
): { text: string; proposalRow0: number | null } {
  if (proposalRows.length === 0) {
    return { text: renderDispatch(lines, maxCols, maxRows), proposalRow0: null };
  }
  const base = renderDispatch(
    lines,
    maxCols,
    maxRows === undefined ? undefined : maxRows - proposalRows.length - 1,
  );
  const rows = base.split('\n');
  const head = rows.shift() ?? '';
  const foot = rows.pop() ?? '';
  // The panel's rules stretch to enclose the proposal too — a row poking
  // past the frame is the one thing that reads as broken.
  const width = Math.max(head.length, foot.length, ...proposalRows.map((r) => r.length));
  const headW = head + RULE.repeat(Math.max(0, width - head.length));
  const footW = RULE.repeat(Math.max(0, width - foot.length)) + foot;
  return {
    text: [headW, ...rows, '', ...proposalRows, footW].join('\n'),
    proposalRow0: 1 + rows.length + 1,
  };
}
