/**
 * Proximity-reveal maths for the terminal land's site labels (pure, no PIXI —
 * the wear.ts/knit.ts precedent, smokeable in scripts/smoke-site-labels.mts).
 *
 * Always-on game labels broke the world up (Harry, 2026-07-30); a site's name
 * now fades in only while a being is near — surface sites when a walker is
 * within LABEL_NEAR_SURFACE columns, buried sites when one stands within
 * LABEL_NEAR_BURIED columns of the relic column (beings only walk the
 * surface, so "stands above" is column proximity). The fade is a linear ramp
 * over LABEL_FADE_S stepped by the caller's deltaMS-derived dt (throttle-safe:
 * dt = 0 is a no-op), drawn through a smoothstep ease.
 */

import type { LandSite } from '../procedural/land';

/** Surface site reveal radius (columns). */
export const LABEL_NEAR_SURFACE = 4;
/** Buried site reveal radius (columns — walker overhead, not depth). */
export const LABEL_NEAR_BURIED = 3;
/** Seconds for a full fade in (or out). */
export const LABEL_FADE_S = 0.35;

/** 1 while any being is within the site's reveal radius, else 0. */
export function siteLabelTarget(
  site: Pick<LandSite, 'x' | 'kind'>,
  beingXs: readonly number[],
): 0 | 1 {
  const near = site.kind === 'surface' ? LABEL_NEAR_SURFACE : LABEL_NEAR_BURIED;
  return beingXs.some((x) => Math.abs(x - site.x) <= near) ? 1 : 0;
}

/** Move `current` toward `target` at 1/LABEL_FADE_S per second, clamped to
 *  [0, 1]. dt <= 0 returns `current` unchanged (frozen under throttle/pause). */
export function stepLabelAlpha(current: number, target: 0 | 1, dtS: number): number {
  if (dtS <= 0) return current;
  const step = dtS / LABEL_FADE_S;
  const next = target === 1 ? current + step : current - step;
  return Math.min(1, Math.max(0, next));
}

/** Smoothstep ease for the drawn alpha — soft at both ends of the fade. */
export function easeLabelAlpha(a: number): number {
  const t = Math.min(1, Math.max(0, a));
  return t * t * (3 - 2 * t);
}
