/**
 * Marginalia slice smoke — `npx tsx scripts/smoke-t2-marks.mts`.
 * Locks the pure mark logic (src/terminal/marks.ts):
 *   - maybeMark: cooldown gate, column dedupe, per-context chance
 *   - vocab totality (every being × context) + {thought} garnish + fallback
 *   - surface-row re-derivation against a ramped (joined) model
 *   - pickReveal: proximity radius, per-mark cooldown, none-eligible → null
 *   - revealAlpha: the eased opacity envelope, with linear as a negative control
 */
import { makeChecker } from './lib/smoke.ts';
import {
  MARK_CHANCE, MARK_DEDUPE_COLS, markCooldownS, maybeMark, noteFor,
  markDisplayRow, pickReveal, REVEAL_COOLDOWN_S, REVEAL_RADIUS_COLS,
  REVEAL_FADE_S, REVEAL_HOLD_S, REVEAL_PEAK_ALPHA, revealAlpha,
  type MarkContextKind,
} from '../src/terminal/marks.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke t2-marks');
const lo = () => 0;         // rand that always passes a chance gate
const hi = () => 0.999;     // rand that never passes
const KINDS: MarkContextKind[] = ['after_crossing', 'at_structure', 'at_edge', 'mid_wander'];
const IDS = ['loki', 'archivist', 'cat', 'visitor', 'ghost'];
const base = { agentId: 'loki', kind: 'at_structure' as MarkContextKind, col: 20, nowS: 1000, lastMarkAtS: -Infinity, existingCols: [], thought: '' };

// 1 · cooldown
check('cooldown is per-id staggered into [90,180)', IDS.every((id) => markCooldownS(id) >= 90 && markCooldownS(id) < 180));
check('cooldown deterministic per id', markCooldownS('loki') === markCooldownS('loki'));
check('inside cooldown: never marks', maybeMark(lo, { ...base, lastMarkAtS: 1000 - markCooldownS('loki') + 1 }) === null);
check('past cooldown: marks', maybeMark(lo, { ...base, lastMarkAtS: 1000 - markCooldownS('loki') - 1 }) !== null);

// 2 · dedupe + chance
check('dedupe within 2 cols', maybeMark(lo, { ...base, existingCols: [20 + MARK_DEDUPE_COLS] }) === null);
check('outside dedupe: marks', maybeMark(lo, { ...base, existingCols: [20 + MARK_DEDUPE_COLS + 1] }) !== null);
check('high roll never marks', KINDS.every((kind) => maybeMark(hi, { ...base, kind }) === null));
check('mid_wander is the low tail', MARK_CHANCE.mid_wander < MARK_CHANCE.at_edge && MARK_CHANCE.at_edge < MARK_CHANCE.after_crossing && MARK_CHANCE.after_crossing <= MARK_CHANCE.at_structure);

// 3 · vocab totality + garnish
for (const id of [...IDS, 'stranger']) for (const kind of KINDS) {
  const n = noteFor(id, kind, lo, '');
  check(`vocab total: ${id}/${kind}`, n.length > 0 && !n.includes('{thought}'));
}
const seen = new Set<string>();
let s = 0; const seq = () => { s = (s + 0.37) % 1; return s; };
for (let i = 0; i < 40; i++) seen.add(noteFor('loki', 'at_structure', seq, 'Find The Warm Spot'));
check('thought folded lowercased into some line', [...seen].some((n) => n.includes('find the warm spot')));
check('empty thought falls back to authored lines', [...Array(40)].every(() => !noteFor('loki', 'at_structure', seq, '').includes('{')));

// 4 · surface-row re-derivation (ramped model)
const fnv = (str: string): number => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const dims = { width: 60, skyH: 6, surfaceBand: 4, underH: 10, withPlayer: false };
const plain = composeLand(fnv('terminal:d0'), SAMPLE_LAND.slice(0, 5), dims);
const joined = composeLand(fnv('terminal:d0'), SAMPLE_LAND.slice(0, 5), { ...dims, join: { right: fnv('terminal:d1') } });
const col = joined.width - 2; // inside the seam blend
check('display row tracks the CURRENT surface', markDisplayRow(joined.surface, col) === joined.surface[col] - 1);
check('ramp shifts some blend-buffer row vs unjoined (advisory-y motivation)',
  [...Array(6)].some((_, i) => plain.surface[plain.width - 1 - i] !== joined.surface[joined.width - 1 - i]));
check('display row clamps out-of-range cols', markDisplayRow(joined.surface, -5) === joined.surface[0] - 1 && markDisplayRow(joined.surface, 999) === joined.surface[joined.width - 1] - 1);

// 5 · reveal
const m = (col2: number, lastRevealAtS = -Infinity) => ({ col: col2, lastRevealAtS });
check('being within radius reveals', pickReveal([m(10)], [10 + REVEAL_RADIUS_COLS - 0.1], 100) === 0);
check('being outside radius does not', pickReveal([m(10)], [10 + REVEAL_RADIUS_COLS + 0.1], 100) === null);
check('reveal cooldown holds', pickReveal([m(10, 100 - REVEAL_COOLDOWN_S + 1)], [10], 100) === null);
check('reveal cooldown expires', pickReveal([m(10, 100 - REVEAL_COOLDOWN_S - 1)], [10], 100) === 0);
check('first eligible wins', pickReveal([m(50), m(10)], [10, 50], 100) === 0);
check('no marks → null', pickReveal([], [10], 100) === null);

// 6 · the reveal envelope (2026-08-08 — Harry: the note "flashes up")
// The shape is the fix, so the shape is what gets locked. Bar 4 is the one
// that carries the complaint: a LINEAR ramp is what read as a flash, and it
// is the obvious "simplification" of this function, so it is asserted as a
// live negative control rather than left to a comment.
const TOTAL = REVEAL_FADE_S + REVEAL_HOLD_S + REVEAL_FADE_S;
const at = (t: number) => revealAlpha(t);

check('closed before it opens', at(-1) === 0 && at(0) === 0);
check('closed after it ends', at(TOTAL) === 0 && at(TOTAL + 5) === 0);
check('never fully opaque', REVEAL_PEAK_ALPHA < 1
  && Array.from({ length: 400 }, (_, i) => at((i / 399) * TOTAL)).every((a) => a <= REVEAL_PEAK_ALPHA + 1e-9));
check('holds at peak mid-dwell', Math.abs(at(REVEAL_FADE_S + REVEAL_HOLD_S / 2) - REVEAL_PEAK_ALPHA) < 1e-9);

const rising = Array.from({ length: 60 }, (_, i) => at(((i + 1) / 61) * REVEAL_FADE_S));
const falling = Array.from({ length: 60 }, (_, i) => at(TOTAL - ((i + 1) / 61) * REVEAL_FADE_S));
check('monotone in', rising.every((v, i) => i === 0 || v > rising[i - 1]));
check('monotone out', falling.every((v, i) => i === 0 || v > falling[i - 1]));
check('symmetric ends', rising.every((v, i) => Math.abs(v - falling[i]) < 1e-9));

// Bar 4 — no corner at onset. Over the first 10% of the fade a smoothstep
// covers <3% of its travel; a linear ramp covers exactly 10%. Asserting BOTH
// sides keeps this a real bar: it fails if the ease is removed, and it fails
// if someone eases so hard the note never arrives.
const onset = at(REVEAL_FADE_S * 0.1) / REVEAL_PEAK_ALPHA;
check('eased onset, not linear', onset < 0.05, `onset ${onset.toFixed(4)} (linear would be 0.1000)`);
check('onset still moves', onset > 0.002, `onset ${onset.toFixed(4)}`);

// Continuity: no visible step at 60 fps anywhere in the envelope.
const frames = Array.from({ length: 1200 }, (_, i) => at((i / 1199) * TOTAL));
const biggestStep = Math.max(...frames.slice(1).map((v, i) => Math.abs(v - frames[i])));
check('continuous at 60 fps', biggestStep < 0.02, `largest per-frame step ${biggestStep.toFixed(4)}`);

// The slow-down is the point; guard the magnitude, not just the shape.
check('fade is unhurried', REVEAL_FADE_S >= 1.2, `REVEAL_FADE_S=${REVEAL_FADE_S}`);

report();
