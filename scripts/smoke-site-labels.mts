/**
 * Proximity-label smoke — `npx tsx scripts/smoke-site-labels.mts`.
 * Locks the pure fade maths (src/terminal/siteLabels.ts):
 *   - siteLabelTarget: inclusive at the radius, 0 beyond it, per kind
 *   - stepLabelAlpha: linear ramp over LABEL_FADE_S, clamped, dt=0 no-op
 *     (throttle-frozen by construction)
 *   - easeLabelAlpha: smoothstep endpoints + midpoint
 */
import { makeChecker } from './lib/smoke.ts';
import {
  easeLabelAlpha,
  LABEL_FADE_S,
  LABEL_NEAR_BURIED,
  LABEL_NEAR_SURFACE,
  siteLabelTarget,
  stepLabelAlpha,
} from '../src/terminal/siteLabels.ts';

const { check, report } = makeChecker('smoke site-labels');

// 1 · target thresholds, boundary pinned (inclusive at the radius)
const surf = { x: 20, kind: 'surface' as const };
const buried = { x: 20, kind: 'buried' as const };
check('surface: inside radius reveals', siteLabelTarget(surf, [20 + LABEL_NEAR_SURFACE]) === 1);
check('surface: beyond radius hides', siteLabelTarget(surf, [20 + LABEL_NEAR_SURFACE + 0.01]) === 0);
check('buried: inside radius reveals', siteLabelTarget(buried, [20 - LABEL_NEAR_BURIED]) === 1);
check('buried: beyond radius hides', siteLabelTarget(buried, [20 - LABEL_NEAR_BURIED - 0.01]) === 0);
check('buried radius is tighter than surface', LABEL_NEAR_BURIED < LABEL_NEAR_SURFACE);
check('no beings → hidden', siteLabelTarget(surf, []) === 0);
check('any one near being reveals', siteLabelTarget(surf, [0, 50, 21]) === 1);

// 2 · fade ramp
check('full fade-in takes LABEL_FADE_S', stepLabelAlpha(0, 1, LABEL_FADE_S) === 1);
check('half step is half way', Math.abs(stepLabelAlpha(0, 1, LABEL_FADE_S / 2) - 0.5) < 1e-9);
check('clamps at 1', stepLabelAlpha(0.9, 1, LABEL_FADE_S) === 1);
check('fades back out', Math.abs(stepLabelAlpha(1, 0, LABEL_FADE_S / 2) - 0.5) < 1e-9);
check('clamps at 0', stepLabelAlpha(0.1, 0, LABEL_FADE_S) === 0);
check('dt=0 is a no-op (throttle-frozen)', stepLabelAlpha(0.4, 1, 0) === 0.4);
check('negative dt is a no-op', stepLabelAlpha(0.4, 1, -1) === 0.4);

// 3 · ease
check('ease endpoints exact', easeLabelAlpha(0) === 0 && easeLabelAlpha(1) === 1);
check('ease midpoint exact', easeLabelAlpha(0.5) === 0.5);
check('ease is soft at the start', easeLabelAlpha(0.1) < 0.1);
check('ease is soft at the end', easeLabelAlpha(0.9) > 0.9);
check('ease clamps out-of-range input', easeLabelAlpha(-1) === 0 && easeLabelAlpha(2) === 1);

report();
