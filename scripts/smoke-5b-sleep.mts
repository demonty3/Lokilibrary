/**
 * Phase 5B smoke — `npx tsx scripts/smoke-5b-sleep.mts`.
 *
 * Covers the WSL-testable surface of the sleep-mode slice:
 *   - SLEEPING state-machine: pure function gates correctly on
 *     idleDurationMs, wallpaper-mode, fullscreen detection. Idle
 *     short → never sleeping. Idle long + fullscreen-foreground →
 *     PAUSED still wins. Idle long + no fullscreen → SLEEPING. Idle
 *     long + wallpaper not foreground but Progman is → SLEEPING
 *     (user genuinely away, desktop visible).
 *   - `consumeSleepReflections()` drains its buffer (drain twice
 *     returns empty array).
 *   - `renderDispatch()` text builder produces the terminal-styled
 *     banner format with the `── overnight ──` header + per-agent
 *     lines + optional `↳ and made a plan` decoration.
 *
 * NOT covered (needs Windows-native Electron + a live Worker):
 *   - The Win32 `GetLastInputInfo` + `GetTickCount` koffi calls
 *     (PowerShell verification only).
 *   - The actual `triggerSleepReflection()` HTTP round-trip to
 *     /api/agent/reflect (needs the Worker + Anthropic key or local
 *     Ollama).
 *   - The PIXI overlay mount/unmount (renders BitmapText, needs WebGL).
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { makeChecker } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  consumeSleepReflections,
  peekSleepReflections,
} = await import('../src/agents/sleep-reflection.ts');

const {
  renderDispatch,
} = await import('../src/render/overlays/morning-dispatch.ts');

const { check, report } = makeChecker('smoke 5B');

// ---------------------------------------------------------------------------
// 1. SLEEPING state-machine mirror
//
// The production code's computeThrottleState lives in
// desktop/src/wallpaper/throttle.ts which imports `electron` at module
// top. Loading it here would require the Module._load mock and isn't
// worth the friction for a state-machine test. Mirror the four-state
// logic inline (same shape as 4A's smoke pattern) so the smoke can
// drive the state machine directly. Drift between this mirror and
// throttle.ts is caught by the user-side wallpaper-mode test —
// it's a known limitation of the WSL/Win32 testing split.

type ThrottleState = 'full' | 'throttled-1hz' | 'paused' | 'sleeping';
interface Rect { left: number; top: number; right: number; bottom: number }
interface Probe {
  isWallpaperMode: boolean;
  wallpaperHwnd: bigint | null;
  shellHwnd: bigint | null;
  foregroundHwnd: bigint | null;
  foregroundRect: Rect | null;
  monitorRect: Rect;
  idleDurationMs: number;
}
const SLEEP_THRESHOLD_MS = 10 * 60 * 1000;
const COVERAGE = 0.5;
const TOL = 2;

function rectArea(r: Rect): number {
  return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
}
function rectMatches(fg: Rect, mon: Rect): boolean {
  return (
    Math.abs(fg.left - mon.left) <= TOL &&
    Math.abs(fg.top - mon.top) <= TOL &&
    Math.abs(fg.right - mon.right) <= TOL &&
    Math.abs(fg.bottom - mon.bottom) <= TOL
  );
}
function compute(p: Probe): ThrottleState {
  if (!p.isWallpaperMode) return 'full';
  // SLEEPING wins above everything except mode-off.
  const isFullscreenFg =
    p.foregroundRect !== null &&
    p.foregroundHwnd !== null &&
    p.foregroundHwnd !== p.wallpaperHwnd &&
    (p.shellHwnd === null || p.foregroundHwnd !== p.shellHwnd) &&
    rectMatches(p.foregroundRect, p.monitorRect);
  if (p.idleDurationMs >= SLEEP_THRESHOLD_MS && !isFullscreenFg) return 'sleeping';
  if (p.foregroundHwnd === null) return 'full';
  if (p.wallpaperHwnd !== null && p.foregroundHwnd === p.wallpaperHwnd) return 'full';
  if (p.shellHwnd !== null && p.foregroundHwnd === p.shellHwnd) return 'full';
  if (p.foregroundRect === null) return 'full';
  if (rectMatches(p.foregroundRect, p.monitorRect)) return 'paused';
  const monArea = rectArea(p.monitorRect);
  if (monArea === 0) return 'full';
  if (rectArea(p.foregroundRect) / monArea > COVERAGE) return 'throttled-1hz';
  return 'full';
}

const mon: Rect = { left: 0, top: 0, right: 2560, bottom: 1440 };
const smallApp: Rect = { left: 100, top: 100, right: 400, bottom: 300 };
const bigApp: Rect = { left: 0, top: 0, right: 1920, bottom: 1440 }; // >50% coverage
const fullApp: Rect = { left: 0, top: 0, right: 2560, bottom: 1440 }; // exact match

// Helper to build a probe with defaults
function P(overrides: Partial<Probe> = {}): Probe {
  return {
    isWallpaperMode: true,
    wallpaperHwnd: 0x1000n,
    shellHwnd: 0x2000n,
    foregroundHwnd: 0x3000n,
    foregroundRect: smallApp,
    monitorRect: mon,
    idleDurationMs: 0,
    ...overrides,
  };
}

// --- Idle short → no sleeping (state determined by foreground heuristic) ---
check('idle=0 + small fg → full', compute(P()) === 'full');
check('idle=0 + big fg (>50% coverage) → throttled-1hz', compute(P({ foregroundRect: bigApp })) === 'throttled-1hz');
check('idle=0 + fullscreen fg → paused', compute(P({ foregroundRect: fullApp })) === 'paused');

// --- Idle near threshold but not over → still uses foreground heuristic ---
check('idle=9min + small fg → full', compute(P({ idleDurationMs: 9 * 60 * 1000 })) === 'full');

// --- Idle over threshold → SLEEPING (unless fullscreen wins) ---
check(
  'idle=15min + small fg → sleeping',
  compute(P({ idleDurationMs: 15 * 60 * 1000 })) === 'sleeping',
);
check(
  'idle=15min + no fg → sleeping (user idle, no app foreground)',
  compute(P({ idleDurationMs: 15 * 60 * 1000, foregroundHwnd: null, foregroundRect: null })) === 'sleeping',
);
check(
  'idle=15min + Progman fg → sleeping (user at desktop but idle)',
  compute(P({ idleDurationMs: 15 * 60 * 1000, foregroundHwnd: 0x2000n, foregroundRect: mon })) === 'sleeping',
);
check(
  'idle=15min + our wallpaper fg → sleeping (user idle even if wallpaper has focus)',
  compute(P({ idleDurationMs: 15 * 60 * 1000, foregroundHwnd: 0x1000n })) === 'sleeping',
);
check(
  'idle=15min + big fg (covering window) → sleeping (not THROTTLED, idle wins)',
  compute(P({ idleDurationMs: 15 * 60 * 1000, foregroundRect: bigApp })) === 'sleeping',
);

// --- Fullscreen always wins over SLEEPING (active game/video session) ---
check(
  'idle=15min + fullscreen fg → paused (fullscreen wins over idle)',
  compute(P({ idleDurationMs: 15 * 60 * 1000, foregroundRect: fullApp })) === 'paused',
);
check(
  'idle=2h + fullscreen fg → paused (still wins after 2h)',
  compute(P({ idleDurationMs: 2 * 60 * 60 * 1000, foregroundRect: fullApp })) === 'paused',
);

// --- Edge: threshold exactly at SLEEP_THRESHOLD_MS → sleeping (>=, not >) ---
check(
  'idle=exactly threshold → sleeping (>= boundary)',
  compute(P({ idleDurationMs: SLEEP_THRESHOLD_MS })) === 'sleeping',
);
check(
  'idle=threshold - 1ms → full (just under)',
  compute(P({ idleDurationMs: SLEEP_THRESHOLD_MS - 1 })) === 'full',
);

// --- Mode-off → always full regardless of idle ---
check(
  'wallpaperMode=false + idle=15min → full',
  compute(P({ isWallpaperMode: false, idleDurationMs: 15 * 60 * 1000 })) === 'full',
);

// ---------------------------------------------------------------------------
// 2. consumeSleepReflections drains the buffer

const firstDrain = consumeSleepReflections();
check('consume: initial buffer is empty', firstDrain.length === 0);
check('peek: initial buffer is empty', peekSleepReflections().length === 0);

// We can't trigger reflections without a live worker; just verify
// drain semantics on an empty buffer.
const secondDrain = consumeSleepReflections();
check('consume: second drain returns empty array', secondDrain.length === 0);
check('consume: returned array is readonly-friendly', Array.isArray(firstDrain) && Array.isArray(secondDrain));

// ---------------------------------------------------------------------------
// 3. renderDispatch text builder

const empty = renderDispatch([]);
check(
  'renderDispatch: empty lines → just the header + footer',
  empty === '── overnight ──\n──',
);

const one = renderDispatch([
  { agentName: 'Loki', text: 'the player keeps returning to the Hades shelf', hadPlan: true },
]);
check(
  'renderDispatch: single line with plan suffix',
  one === '── overnight ──\nLoki: the player keeps returning to the Hades shelf\n  ↳ and made a plan\n──',
);

const multi = renderDispatch([
  { agentName: 'Loki', text: 'noticed the kitchen', hadPlan: false },
  { agentName: 'Archivist', text: 'someone has been near the south door', hadPlan: true },
]);
check(
  'renderDispatch: multi-line, mixed hadPlan',
  multi === '── overnight ──\nLoki: noticed the kitchen\nArchivist: someone has been near the south door\n  ↳ and made a plan\n──',
);

// Whitespace normalisation
const messy = renderDispatch([
  { agentName: 'Loki', text: '  the   player\n keeps  returning  ', hadPlan: false },
]);
check(
  'renderDispatch: collapses whitespace in reflection text',
  messy === '── overnight ──\nLoki: the player keeps returning\n──',
);

// --- Grid wrapping (2026-08-14) --------------------------------------------
// The desk draws the banner at WORLD_SCALE on its cell grid, so a reflection
// longer than the window's column count MUST wrap rather than overhang.
const WRAPPED = renderDispatch(
  [{ agentName: 'Loki', text: 'the player keeps returning to the Hades shelf', hadPlan: true }],
  24,
);
const wrappedRows = WRAPPED.split('\n');
check(
  'renderDispatch(maxCols): no row exceeds the column budget',
  wrappedRows.every((r) => r.length <= 24),
);
check(
  'renderDispatch(maxCols): continuations are indented, first lines are not',
  wrappedRows[1] === 'Loki: the player keeps' && wrappedRows[2] === '  returning to the Hades',
);
check(
  'renderDispatch(maxCols): wrapping preserves every word, in order',
  wrappedRows.join(' ').replace(/\s+/g, ' ') ===
    renderDispatch([
      { agentName: 'Loki', text: 'the player keeps returning to the Hades shelf', hadPlan: true },
    ])
      .split('\n')
      .join(' ')
      .replace(/\s+/g, ' '),
);
check(
  'renderDispatch(maxCols): the plan decoration survives wrapping',
  wrappedRows.includes('  ↳ and made a plan'),
);
// A word wider than the whole line is hard-broken — an overhanging row is the
// one thing that reads as broken on a grid.
const longWord = renderDispatch([{ agentName: 'L', text: 'x'.repeat(40), hadPlan: false }], 12)
  .split('\n');
check(
  'renderDispatch(maxCols): an over-wide word is hard-broken, never overhangs',
  longWord.every((r) => r.length <= 12) &&
    // Broken across rows, but every character survives the break.
    longWord.join('').split('x').length - 1 === 40,
);
check(
  'renderDispatch: omitting maxCols leaves rows unwrapped (palace path)',
  renderDispatch([{ agentName: 'Loki', text: 'y'.repeat(80), hadPlan: false }]).split('\n')[1]
    .length === 86,
);

// --- Row budget (2026-08-14) -----------------------------------------------
// At 2x a full cohort of 140-char reflections is ~32 rows and would run off
// the bottom of a 640x520 window. The budget drops WHOLE agents and says so.
const SIX = Array.from({ length: 6 }, (_, i) => ({
  agentName: `Agent${i}`,
  text: 'z'.repeat(140),
  hadPlan: true,
}));
const budgeted = renderDispatch(SIX, 51, 12).split('\n');
check(
  'renderDispatch(maxRows): never exceeds the row budget',
  budgeted.length <= 12,
);
check(
  'renderDispatch(maxRows): the dropped count is stated, not silent',
  budgeted[budgeted.length - 1] === '── +4 more ──',
);
check(
  'renderDispatch(maxRows): agents are dropped WHOLE — no half reflection',
  // Two agents shown ⇒ exactly two "AgentN:" openers and two plan rows.
  budgeted.filter((r) => /^Agent\d:/.test(r)).length === 2 &&
    budgeted.filter((r) => r === '  ↳ and made a plan').length === 2,
);
check(
  'renderDispatch(maxRows): a budget nobody exceeds leaves the plain footer',
  renderDispatch(SIX.slice(0, 1), 51, 12).split('\n').at(-1) === '──',
);
check(
  'renderDispatch(maxRows): one over-long reflection spills rather than vanishing',
  renderDispatch(SIX.slice(0, 1), 51, 3).split('\n').filter((r) => /^Agent0:/.test(r)).length === 1,
);
check(
  'renderDispatch: omitting maxRows drops nothing (palace path)',
  renderDispatch(SIX, 51).split('\n').filter((r) => /^Agent\d:/.test(r)).length === 6,
);

// --- macOS/Linux idle-only throttle ladder (consolidation 2026-06) ----------
// Mirror of computeIdleThrottleState in desktop/src/wallpaper/throttle.ts (same
// electron-import reason as the SLEEPING mirror above: can't import it under
// plain Node). The macOS path has NO foreground/fullscreen 'paused' state — it
// is driven purely by powerMonitor idle time. Drift is caught by reviewing this
// mirror against the production fn together.
const IDLE_THROTTLE_MS = 60 * 1000;
function computeIdle(
  idleMs: number,
  isWallpaperMode: boolean,
  sleepMs = SLEEP_THRESHOLD_MS,
  throttleMs = IDLE_THROTTLE_MS,
): ThrottleState {
  if (!isWallpaperMode) return 'full';
  if (idleMs >= sleepMs) return 'sleeping';
  if (idleMs >= throttleMs) return 'throttled-1hz';
  return 'full';
}
check('idle ladder: not wallpaper mode → full regardless of idle', computeIdle(20 * 60 * 1000, false) === 'full');
check('idle ladder: idle=0 → full', computeIdle(0, true) === 'full');
check('idle ladder: just below throttle (59s) → full', computeIdle(IDLE_THROTTLE_MS - 1, true) === 'full');
check('idle ladder: at throttle threshold (60s) → throttled-1hz', computeIdle(IDLE_THROTTLE_MS, true) === 'throttled-1hz');
check('idle ladder: 5min → throttled-1hz', computeIdle(5 * 60 * 1000, true) === 'throttled-1hz');
check('idle ladder: just below sleep (10min-1) → throttled-1hz', computeIdle(SLEEP_THRESHOLD_MS - 1, true) === 'throttled-1hz');
check('idle ladder: at sleep threshold (10min) → sleeping', computeIdle(SLEEP_THRESHOLD_MS, true) === 'sleeping');
check('idle ladder: well past sleep (30min) → sleeping', computeIdle(30 * 60 * 1000, true) === 'sleeping');
check('idle ladder: never emits paused (no window probe on macOS)', computeIdle(9 * 60 * 1000, true) !== ('paused' as ThrottleState));

report();
