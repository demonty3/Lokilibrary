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
}

/** Mount the banner. Returns a teardown function the caller can use to
 *  dismiss early (e.g. if SLEEPING fires again before the auto-dismiss
 *  elapsed; rare, but the cleanup matters). The auto-dismiss timer also
 *  calls the teardown internally; calling teardown twice is safe.
 *
 *  Returns `null` when `lines.length === 0` — no point mounting an
 *  empty banner. Caller treats `null` as "nothing to show, no
 *  teardown needed."
 */
export function mountMorningDispatch(
  opts: MountMorningDispatchOptions,
): (() => void) | null {
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

  const mountedAt = performance.now();
  let torndown = false;
  const teardown = (): void => {
    if (torndown) return;
    torndown = true;
    opts.app.ticker.remove(autoDismissTick);
    opts.app.renderer.off('resize', reposition);
    container.destroy({ children: true });
  };

  // Use the PIXI ticker for auto-dismiss timing rather than setTimeout
  // — the ticker is stopped during SLEEPING/PAUSED so a setTimeout
  // would auto-dismiss BEFORE the user actually saw the banner if
  // they immediately re-entered sleep. PIXI ticker delta-time
  // advances with actual rendering, so the 30s elapses against the
  // user's visible time.
  const autoDismissTick: TickerCallback<unknown> = () => {
    if (performance.now() - mountedAt >= dismissAfterMs) {
      teardown();
    }
  };
  opts.app.ticker.add(autoDismissTick);

  return teardown;
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
