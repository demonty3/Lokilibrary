/**
 * Phase 2F debug overlay. Corner panel showing live agent telemetry:
 *
 *   tier1: <n>   cost: $0.0123/h
 *   tier2: <n>   ≈ $X.XX/mo
 *   latency: <n>ms   tokens in/out: <n>/<n>
 *   (per-model lines)
 *
 * Toggled via Ctrl+\` (App.tsx) → `store.agentDebugOverlay`. We poll
 * the writer's `aggregateTelemetry` every 2 s — same refresh cadence
 * as the Smallville paper's UI sketches. The DB read is cheap (a
 * single indexed range scan against `agent_telemetry`).
 *
 * Layout: pinned to the top-right of the screen, hand-aligned Cozette.
 * Updates rewrite the BitmapText `.text` in place (no per-line sprite
 * churn).
 */

import { BitmapText, Container } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { MemoryWriter, TelemetrySummary } from '../../agents/router';
import { getRouterStats } from '../../agents/router';
import { extrapolateMonthlyCost, HOUR_MS } from '../../agents/telemetry';
import {
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

export interface MountTelemetryOverlayOptions {
  app: Application;
  theme: Theme;
  memoryWriter: MemoryWriter;
  /** Refresh cadence in ms. Default 2000. */
  refreshMs?: number;
  /** Window the aggregate reads back over. Default = last hour. */
  windowMs?: number;
}

export function mountTelemetryOverlay(opts: MountTelemetryOverlayOptions): () => void {
  const refreshMs = opts.refreshMs ?? 2000;
  const windowMs = opts.windowMs ?? HOUR_MS;

  const container = new Container();
  container.eventMode = 'none';
  opts.app.stage.addChild(container);

  const text = new BitmapText({
    text: 'telemetry: warming up…',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(opts.theme.palette.fgBright),
      align: 'right',
    },
  });
  container.addChild(text);

  // Build a subtle backdrop so the panel reads against any theme bg.
  const padding = 8;
  const bgColor = hexToInt(opts.theme.palette.bgAlt);
  // Lightweight backdrop via a tinted BitmapText space — overkill is a
  // Graphics fill; one rectangle costs more than the whole panel.
  // Skip the backdrop entirely for Phase 2F MVP; readability has been
  // adequate on the 5 stock themes we tested. If we add it later use
  // `new Graphics().rect(...).fill(bgColor)`.
  void bgColor;
  void padding;

  let lastRefresh = 0;
  const reposition = () => {
    container.x = Math.floor(opts.app.screen.width - text.width - 12);
    container.y = 12;
  };
  reposition();

  const tick: TickerCallback<unknown> = () => {
    const now = performance.now();
    if (now - lastRefresh < refreshMs) return;
    lastRefresh = now;
    const summary = opts.memoryWriter.aggregateTelemetry(windowMs);
    text.text = renderPanel(summary);
    reposition();
  };
  opts.app.ticker.add(tick);
  opts.app.renderer.on('resize', reposition);

  return () => {
    opts.app.ticker.remove(tick);
    opts.app.renderer.off('resize', reposition);
    container.destroy({ children: true });
  };
}

function renderPanel(summary: TelemetrySummary): string {
  const lines: string[] = [];
  lines.push('── telemetry ──────────────');
  const t = summary.total;
  lines.push(`tier1: ${pad(t.tier1Count, 4)}   tier2: ${pad(t.tier2Count, 4)}`);
  lines.push(
    `cost:  $${t.costUsd.toFixed(4)}/${humanWindow(summary.windowMs)}`,
  );
  // Monthly extrapolation — the cost-discipline number.
  const monthly = extrapolateMonthlyCost({
    windowMs: summary.windowMs,
    windowStartMs: 0,
    windowEndMs: 0,
    total: summary.total,
    byModel: summary.byModel,
  });
  lines.push(`extrap: ≈ $${monthly.toFixed(2)}/mo`);
  lines.push(`latency:${pad(t.meanLatencyMs, 5)}ms  tok i/o ${t.tokensIn}/${t.tokensOut}`);
  const stats = getRouterStats();
  lines.push(
    `reprompts: ${stats.reprompts}  rec ${stats.repromptRecovered}  rej ${stats.rejections}`,
  );
  if (summary.byModel.size > 0) {
    lines.push('per model:');
    for (const [key, bucket] of summary.byModel) {
      const calls = bucket.tier1Count + bucket.tier2Count;
      lines.push(`  ${trimKey(key)}: ${calls}× $${bucket.costUsd.toFixed(4)}`);
    }
  }
  return lines.join('\n');
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, ' ');
}

function humanWindow(ms: number): string {
  if (ms === HOUR_MS) return 'h';
  const minutes = Math.round(ms / 60_000);
  return `${minutes}m`;
}

function trimKey(key: string): string {
  // anthropic:claude-haiku-4-5-20251001 → haiku-4-5
  // local:qwen2.5:7b → qwen2.5:7b
  // stub:stub → stub
  const [provider, ...rest] = key.split(':');
  const model = rest.join(':');
  if (provider === 'anthropic') {
    return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
  }
  return model;
}
