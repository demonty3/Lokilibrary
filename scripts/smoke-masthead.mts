/**
 * Masthead smoke (T3 slice 2) — `npx tsx scripts/smoke-masthead.mts`.
 *
 * The title row is what a glancing viewer reads first, so the two claims it
 * makes are pinned here: the residents run is who is HERE (not who lives
 * here), and the holdings ramp is a real five-step distinction a reader can
 * order without a legend.
 *
 * Spec: docs/superpowers/specs/2026-08-09-t3-slice2-design.md
 */
import { makeChecker } from './lib/smoke.ts';
import {
  ENGAGEMENT_GLYPH,
  MAST_GAP_COLS,
  MAST_PAD_COLS,
  holdingsRamp,
  mastheadResidents,
  wingLabel,
} from '../src/terminal/masthead.ts';
import { SOCIETY_IDS } from '../src/terminal/society.ts';
import { SAMPLE_LAND, type EngagementState } from '../src/procedural/land.ts';
import { COHORT } from '../src/agents/cohort.ts';

const { check, report } = makeChecker('smoke masthead');

// --- the label ------------------------------------------------------------
check('the label names the wing', wingLabel('d0') === '┤ d0 ├', wingLabel('d0'));
check('…in the land’s own edge vocabulary, not a window title bar’s',
  !/[╔╗╚╝═_|]/.test(wingLabel('d0')), wingLabel('d0'));
check('the row leaves a margin at each end', MAST_PAD_COLS >= 1 && MAST_GAP_COLS >= 1);

// --- who is here ----------------------------------------------------------
const B = (id: string, present: boolean, away: boolean) => ({ id, present, away });
check('an ordinary present being is in the row',
  mastheadResidents([B('cat', true, false)]).join() === 'cat');
check('an ABSENT being is not — the Visitor between visits, the unmanifested Ghost',
  mastheadResidents([B('cat', true, false), B('visitor', false, false)]).join() === 'cat');
check('an AWAY being is not — out playing is not being here',
  mastheadResidents([B('cat', true, false), B('loki', true, true)]).join() === 'cat');
check('a being that is both present and away is still not here',
  mastheadResidents([B('ghost', true, true)]).length === 0);
check('an empty land draws an empty run', mastheadResidents([]).length === 0);

// Order is COHORT order, not arrival order: an arrival must never reshuffle
// the glyphs already standing in the row.
const arrivedBackwards = [...SOCIETY_IDS].reverse().map((id) => B(id, true, false));
check('the run is in COHORT order however the beings arrived',
  mastheadResidents(arrivedBackwards).join() === SOCIETY_IDS.join(),
  mastheadResidents(arrivedBackwards).join());
check('every cohort member can appear', mastheadResidents(
  SOCIETY_IDS.map((id) => B(id, true, false))).length === SOCIETY_IDS.length);
check('an id the roster does not know is dropped, not drawn as tofu',
  mastheadResidents([B('nobody', true, false)]).length === 0);

// The row's glyphs are the beings' own, so what you read in the row is what
// you see on the ground.
check('every drawn resident has a cohort glyph',
  SOCIETY_IDS.every((id) => (COHORT.find((d) => d.id === id)?.glyph ?? '').length === 1));

// --- the holdings ramp ----------------------------------------------------
const STATES: EngagementState[] = ['mastered', 'loved', 'recent', 'dusty', 'abandoned'];
check('every engagement state has a glyph',
  STATES.every((s) => typeof ENGAGEMENT_GLYPH[s] === 'string' && ENGAGEMENT_GLYPH[s].length === 1));
check('the five steps are DISTINCT — a collision would make two states unreadable',
  new Set(STATES.map((s) => ENGAGEMENT_GLYPH[s])).size === STATES.length,
  STATES.map((s) => ENGAGEMENT_GLYPH[s]).join(''));
check('the ramp descends: mastered is the tallest bar, abandoned the shortest',
  ENGAGEMENT_GLYPH.mastered === '█' && ENGAGEMENT_GLYPH.abandoned === '▁');

// Heights, not shade densities. The shade form was built and shot first and
// failed to read — five adjacent dither cells at fgDim are a patch of texture,
// the crust-legibility finding on a new surface. Evidence:
// docs/design-reviews/2026-08-09-t3-slice2/t3-ramp1.png beside t3-ramp2.png.
// Guard the replacement so nobody re-derives the ramp back into dither.
for (const [state, glyph] of [['loved', '▆'], ['recent', '▄'], ['dusty', '▂'], ['abandoned', '▁']] as const) {
  check(`${state} is a bar height, not a shade`, ENGAGEMENT_GLYPH[state] === glyph);
}
check('NO dither glyph is in the ramp — that read as crust, not as information',
  !STATES.some((s) => '▓▒░'.includes(ENGAGEMENT_GLYPH[s])),
  STATES.map((s) => ENGAGEMENT_GLYPH[s]).join(''));
check('the ramp is monotone in height — a reader can order it without a legend',
  STATES.map((s) => '▁▂▃▄▅▆▇█'.indexOf(ENGAGEMENT_GLYPH[s]))
    .every((h, i, a) => i === 0 || h < a[i - 1]),
  STATES.map((s) => ENGAGEMENT_GLYPH[s]).join(''));

check('the ramp is one cell per game, in order',
  holdingsRamp(SAMPLE_LAND) === SAMPLE_LAND.map((g) => ENGAGEMENT_GLYPH[g.state]).join(''));
check('an empty wing draws an empty ramp', holdingsRamp([]) === '');
check('the ramp stays short enough to sit beside the label',
  holdingsRamp(SAMPLE_LAND.slice(0, 5)).length === 5);

// --- desk-real: the row DISTINGUISHES wings -------------------------------
// The identity claim. terminalLand.ts hands each wing a rotated five-game
// slice (`rot = fnv1a(wing) % SAMPLE_LAND.length`); recomputed here the way
// smoke-pack-assignment recomputes the same hash.
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const wingRamp = (wing: string): string => {
  const rot = fnv(wing) % SAMPLE_LAND.length;
  return holdingsRamp(Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]));
};
const WINGS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
const ramps = WINGS.map(wingRamp);
check('the two wings a default desk boots read differently', ramps[0] !== ramps[1],
  `${ramps[0]} vs ${ramps[1]}`);
check('the six wings are not all one ramp (the row would say nothing)',
  new Set(ramps).size > 1, ramps.join(' '));
check('every wing’s ramp is five cells', ramps.every((r) => r.length === 5), ramps.join(' '));

report();
