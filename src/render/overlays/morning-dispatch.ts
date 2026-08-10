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
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

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
}

/** Mount the banner.
 *
 *  Returns `null` when `lines.length === 0` — no point mounting an
 *  empty banner. Caller treats `null` as "nothing to show, nothing
 *  to dismiss."
 */
export function mountMorningDispatch(
  opts: MountMorningDispatchOptions,
): MorningDispatchHandle | null {
  if (opts.lines.length === 0) return null;
  const dismissAfterMs = opts.dismissAfterMs ?? 30_000;

  const container = new Container();
  container.eventMode = 'none';
  opts.app.stage.addChild(container);

  const text = new BitmapText({
    text: renderDispatch(opts.lines),
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(opts.theme.palette.fgBright),
      align: 'left',
    },
  });
  container.addChild(text);

  const reposition = (): void => {
    container.x = Math.floor((opts.app.screen.width - text.width) / 2);
    container.y = 24;
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

  return { view: container, dismiss: teardown };
}

/** Pure text builder — extracted for the smoke. Given a list of agent
 *  reflection lines, produce the multi-line banner text. Format:
 *
 *      ── overnight ──
 *      Loki: the player keeps returning to the Hades shelf
 *        ↳ and made a plan
 *      Archivist: someone has been near the south door tonight
 *      ──
 */
export function renderDispatch(lines: ReadonlyArray<MorningDispatchLine>): string {
  const out: string[] = ['── overnight ──'];
  for (const line of lines) {
    const safeText = line.text.replace(/\s+/g, ' ').trim();
    out.push(`${line.agentName}: ${safeText}`);
    if (line.hadPlan) {
      out.push('  ↳ and made a plan');
    }
  }
  out.push('──');
  return out.join('\n');
}
