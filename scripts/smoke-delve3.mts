/**
 * Dungeon rung 3 smoke — `npx tsx scripts/smoke-delve3.mts`.
 * Locks the spend, the shrine, and the ward against the spec's bars
 * (docs/superpowers/specs/2026-08-20-dungeon-rung3-monuments.md):
 *   - bar 1: the spend decision is pure + deterministic per (dispatcher
 *     boldness, state) and takes ZERO draws from any expedition prng;
 *     scheduling is untouched by who spent
 *   - bar 2 + kill condition (two-sided): on the SAME per-run seed
 *     streams, warded vs unwarded per-delver death rates differ by
 *     > 1 percentage point on the bold-most probe (the ward is real),
 *     AND the warded rate stays ≥ 0.5x unwarded (a ward, never
 *     god-mode). If the low side fails, monuments revert to
 *     expression-only — this smoke failing IS the kill.
 *   - bar 4: unwarded expeditions are byte-identical to rung 2 (the
 *     ward is a threshold swap, never an inserted draw)
 *   - bar 5: shrineStage is pure + monotone in monumentFund; the fund
 *     never decrements across spend sequences; hoardStage's
 *     function-monotonicity bar re-asserted verbatim (the SUPERSEDED
 *     part is the world reading — spends may shrink the rendered pile)
 *   - bar 6: effectiveTargetPop bounded by POPULATION_HARD_CAP; a
 *     colony spend starts a real arrival; rung-2-shaped blobs load
 *     with defaulted fields
 *   - bar 7 + kill condition "a number appears": shrine glyph rows and
 *     shrine vocab lines carry no numeral; rows use covered glyphs only
 */
import { makeChecker } from './lib/smoke.ts';
import {
  beginExpedition,
  DEFAULT_EXPEDITION_PARAMS,
  directiveParams,
  effectiveTargetPop,
  expeditionPrng,
  hoardStage,
  HOARD_STAGE_MAX,
  initialDelveState,
  parseDelveState,
  POPULATION_HARD_CAP,
  resolveExpedition,
  runExpedition,
  SHRINE_GLYPH_ROWS,
  SHRINE_STAGE_MAX,
  shrineComplete,
  shrineStage,
  SPEND_RESERVE,
  SPEND_TRANCHE,
  type DelveState,
  type ExpeditionParams,
} from '../src/terminal/delve.ts';
import { LAND_PERSONAS } from '../src/terminal/beingIntents.ts';
import { shrineVocabLines } from '../src/terminal/marks.ts';

const { check, report } = makeChecker('smoke delve3');

// 1 · the ward kill test (bar 2, two-sided). SAME seed streams for both
// arms — only the warded flag varies, so any rate difference is purely
// the ward's doing. Probed on the bold-most persona's directive (the
// highest-exposure expedition, where a ward has the most to do).
const deathRate = (params: ExpeditionParams): number => {
  let dead = 0;
  let sent = 0;
  for (let i = 0; i < 8000; i++) {
    const o = runExpedition(params, expeditionPrng('ward-odds', i));
    dead += o.deadIndices.length;
    sent += params.partySize;
  }
  return dead / sent;
};
const boldParams = directiveParams('loki', LAND_PERSONAS.loki);
const unwarded = deathRate(boldParams);
const warded = deathRate({ ...boldParams, warded: true });
check(`the ward moves odds by >1pp (unwarded ${(unwarded * 100).toFixed(2)}% vs warded ${(warded * 100).toFixed(2)}%)`,
  unwarded - warded > 0.01);
check('the ward is never god-mode: warded stays ≥ 0.5x unwarded',
  warded >= 0.5 * unwarded);
{
  const u = deathRate(DEFAULT_EXPEDITION_PARAMS);
  const w = deathRate({ ...DEFAULT_EXPEDITION_PARAMS, warded: true });
  check('the ordering holds on the default directive too', w < u);
}

// 2 · unwarded byte-identity (bar 4): absent and explicitly-false warded
// take the identical path — same draws, same outcomes — and warded: true
// actually changes something.
{
  let identical = true;
  let wardDiffers = false;
  for (let i = 0; i < 50; i++) {
    const a = JSON.stringify(runExpedition(DEFAULT_EXPEDITION_PARAMS, expeditionPrng('byte', i)));
    const b = JSON.stringify(runExpedition({ ...DEFAULT_EXPEDITION_PARAMS, warded: false }, expeditionPrng('byte', i)));
    const c = JSON.stringify(runExpedition({ ...DEFAULT_EXPEDITION_PARAMS, warded: true }, expeditionPrng('byte', i)));
    if (a !== b) identical = false;
    if (a !== c) wardDiffers = true;
  }
  check('unwarded runs are byte-identical with the flag absent or false', identical);
  check('warded: true changes at least one outcome over 50 seeds', wardDiffers);
}

// 3 · the spend (bar 1): routing shape, reserve, determinism, and
// stream-independence. State surgery pins the resolved outcome to
// zero gold / zero deaths so the hoard is fully controlled.
const mkDue = (hoard: number): DelveState => {
  const s = initialDelveState('spend-wing');
  s.hoardGold = hoard;
  beginExpedition(s, 'x', DEFAULT_EXPEDITION_PARAMS, 0);
  if (s.active) {
    s.active.outcome = { ...s.active.outcome, gold: 0, deadIndices: [] };
    s.active.resolveAtMs = 0;
  }
  return s;
};
{
  const s = mkDue(SPEND_RESERVE + SPEND_TRANCHE - 1);
  const r = resolveExpedition(s, 1, 0.2);
  check('below reserve + tranche nothing is spent', r?.spent === null && s.monumentFund === 0 && s.capRaises === 0);
}
{
  const s = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  const r = resolveExpedition(s, 1, 0.2);
  check('a timid dispatcher funds the monument', r?.spent === 'monument' && s.monumentFund === SPEND_TRANCHE);
  check('the tranche left the hoard and the reserve held', s.hoardGold === SPEND_RESERVE);
  check('the resolution reports the shrine stage after the spend', r?.shrineStageAfter === shrineStage(s.monumentFund));
}
{
  const s = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  const r = resolveExpedition(s, 1, 0.8);
  check('a bold dispatcher reinvests in the colony', r?.spent === 'colony' && s.capRaises === 1 && s.monumentFund === 0);
  check('a colony spend starts a real arrival toward the raised cap', s.nextArrivalAtMs !== null);
}
{
  const s = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  s.capRaises = POPULATION_HARD_CAP - s.targetPop; // ladder full
  const r = resolveExpedition(s, 1, 0.9);
  check('a full cap ladder routes even the bold to the monument', r?.spent === 'monument');
}
{
  const s = mkDue(SPEND_RESERVE + 10 * SPEND_TRANCHE);
  resolveExpedition(s, 1, 0.2);
  check('at most one tranche per resolution', s.monumentFund === SPEND_TRANCHE);
}
{
  const a = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  const b = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  resolveExpedition(a, 1, 0.2);
  resolveExpedition(b, 1, 0.2);
  check('the spend is deterministic per (boldness, state)', JSON.stringify(a) === JSON.stringify(b));
}
{
  // Boldness routes the tranche and nothing else: scheduling comes off
  // the same delve-sched stream either way.
  const a = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  const b = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  resolveExpedition(a, 1, 0.1);
  resolveExpedition(b, 1, 0.9);
  check('boldness never touches the dispatch schedule',
    a.nextDispatchAtUptimeMs === b.nextDispatchAtUptimeMs);
}
{
  // Zero draws from any expedition stream (the delve2 purity idiom).
  const before = (() => { const p = expeditionPrng('spend-purity', 0); p.next(); return p.next(); })();
  const s = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  resolveExpedition(s, 1, 0.3);
  const after = (() => { const p = expeditionPrng('spend-purity', 0); p.next(); return p.next(); })();
  check('the spend takes no draws from an expedition stream', before === after);
}

// 4 · shrine stage (bar 5): pure, monotone, bounded; the fund only grows.
check('no fund, no shrine', shrineStage(0) === 0);
check('the first tranche starts the shrine', shrineStage(SPEND_TRANCHE) === 1);
check('shrineComplete only at the final stage',
  !shrineComplete(SPEND_TRANCHE) && shrineComplete(6 * SPEND_TRANCHE));
{
  let prev = 0;
  let monotone = true;
  let capped = true;
  for (let g = 0; g <= 2000; g++) {
    const s = shrineStage(g);
    if (s < prev) monotone = false;
    if (s < 0 || s > SHRINE_STAGE_MAX) capped = false;
    prev = s;
  }
  check('shrineStage is monotone non-decreasing over 0..2000', monotone);
  check(`shrineStage stays within 0..${SHRINE_STAGE_MAX}`, capped);
}
{
  // Across a run of timid spends the fund only ever grows.
  let fund = 0;
  let growsOnly = true;
  let s = mkDue(SPEND_RESERVE + SPEND_TRANCHE);
  for (let i = 0; i < 8; i++) {
    s.hoardGold = SPEND_RESERVE + SPEND_TRANCHE;
    beginExpedition(s, 'x', DEFAULT_EXPEDITION_PARAMS, 0);
    if (s.active) {
      s.active.outcome = { ...s.active.outcome, gold: 0, deadIndices: [] };
      s.active.resolveAtMs = 0;
    }
    resolveExpedition(s, 1, 0.2);
    if (s.monumentFund < fund) growsOnly = false;
    fund = s.monumentFund;
  }
  check('the monument fund never decrements across spend sequences', growsOnly && fund > 0);
}
// hoardStage FUNCTION-monotonicity, inherited verbatim (bar 5's
// supersession is about the rendered pile, never this function).
{
  let prev = 0;
  let monotone = true;
  for (let g = 0; g <= 2000; g++) {
    const st = hoardStage(g);
    if (st < prev) monotone = false;
    prev = st;
  }
  check('hoardStage stays monotone non-decreasing (inherited bar)', monotone);
  check(`hoardStage stays within 0..${HOARD_STAGE_MAX} (inherited bar)`, hoardStage(1e9) === HOARD_STAGE_MAX);
}

// 5 · the colony cap (bar 6): bounded, and defaults are unchanged.
{
  const s = initialDelveState('cap-wing');
  check('no raises: effective cap is the founding size', effectiveTargetPop(s) === s.targetPop);
  s.capRaises = 2;
  check('raises grow the effective cap', effectiveTargetPop(s) === s.targetPop + 2);
  s.capRaises = 1000;
  check('the hard cap binds', effectiveTargetPop(s) === POPULATION_HARD_CAP);
}

// 6 · back-compat parse (bar 6): a rung-2-shaped blob (no spend fields)
// loads with defaults and ticks without throwing.
{
  const s = initialDelveState('compat-wing');
  const blob = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  delete blob.monumentFund;
  delete blob.capRaises;
  const parsed = parseDelveState(JSON.stringify(blob), 'compat-wing');
  check('a rung-2 blob parses with defaulted spend fields',
    parsed !== null && parsed.monumentFund === 0 && parsed.capRaises === 0);
  if (parsed) {
    beginExpedition(parsed, 'x', DEFAULT_EXPEDITION_PARAMS, 0);
    if (parsed.active) parsed.active.resolveAtMs = 0;
    const r = resolveExpedition(parsed, 1, 0.2);
    check('a defaulted blob resolves (and may spend) without throwing', r !== null);
  }
  const roundTrip = parseDelveState(JSON.stringify(s), 'compat-wing');
  check('new fields survive a round-trip', roundTrip?.monumentFund === 0 && roundTrip?.capRaises === 0);
}

// 7 · the rendered shrine (bar 7 + kill condition "a number appears"):
// one row-set per stage, numeral-free, covered glyphs only, growing.
check('one glyph row-set per shrine stage', SHRINE_GLYPH_ROWS.length === SHRINE_STAGE_MAX);
{
  let prevMass = 0;
  SHRINE_GLYPH_ROWS.forEach((rows, i) => {
    const flat = rows.join('');
    check(`shrine stage ${i + 1} rows carry no numeral`, !/\d/.test(flat));
    check(`shrine stage ${i + 1} uses only covered glyphs`, [...flat].every((c) => '▪░▒▌▐█ '.includes(c)));
    check(`shrine stage ${i + 1} rows are three columns wide`, rows.every((r) => r.length === 3));
    const mass = [...flat].filter((c) => c !== ' ').length;
    check(`shrine stage ${i + 1} is bigger than stage ${i}`, mass > prevMass);
    prevMass = mass;
  });
}
for (const line of shrineVocabLines()) {
  check(`shrine vocab line carries no numeral: "${line.slice(0, 32)}…"`, !/\d/.test(line));
}

report();
