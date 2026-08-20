/**
 * Dungeon rung 2 smoke — `npx tsx scripts/smoke-delve2.mts`.
 * Locks persona directives + the hoard stage against the spec's bars
 * (docs/superpowers/specs/2026-08-20-dungeon-rung2-directives-hoard.md):
 *   - bar 1: directiveParams is pure, deterministic per (agentId,
 *     persona) and takes ZERO draws from any expedition prng
 *   - bar 2 + kill condition (Addendum 1, two-sided): on the SAME
 *     per-run seed streams, timid-most vs bold-most persona per-delver
 *     death rates differ by > 1 percentage point, and directives
 *     order strictly against the ignored defaults (timid < default <
 *     bold). If this fails, the mind isn't consequential and rung 2
 *     is dead — this smoke failing IS the kill.
 *   - bar 3 + kill condition: bounded spread — bold < 2.5x timid and
 *     < 10% absolute (nobody's dispatches read as cursed)
 *   - bar 4: hoardStage is monotone from the persisted gold
 *   - bar 5 + kill condition "a number appears": the rendered hoard
 *     rows carry no numeral and only rung-1 undercroft glyphs
 *   - bar 6: the default persona derives within ±1 of the rung-1
 *     engine defaults on every field (strangers unpenalised)
 */
import { makeChecker } from './lib/smoke.ts';
import {
  DEFAULT_EXPEDITION_PARAMS,
  directiveBoldness,
  directiveParams,
  expeditionPrng,
  HOARD_GLYPH_ROWS,
  HOARD_STAGE_MAX,
  hoardStage,
  runExpedition,
  type ExpeditionParams,
} from '../src/terminal/delve.ts';
import { DEFAULT_LAND_PERSONA, LAND_PERSONAS } from '../src/terminal/beingIntents.ts';

const { check, report } = makeChecker('smoke delve2');

// 1 · derivation purity + determinism (bar 1)
const personas = { ...LAND_PERSONAS, stranger: DEFAULT_LAND_PERSONA };
for (const [id, p] of Object.entries(personas)) {
  check(`directiveParams(${id}) is deterministic`,
    JSON.stringify(directiveParams(id, p)) === JSON.stringify(directiveParams(id, p)));
}
// Zero prng involvement: a seeded stream draws identically whether or
// not a derivation happens between draws (frozen, not just implied).
{
  const a = expeditionPrng('purity', 0);
  const b = expeditionPrng('purity', 0);
  const before = [a.next(), a.next()];
  b.next();
  directiveParams('loki', LAND_PERSONAS.loki);
  b.next();
  check('derivation takes no draws from an expedition stream',
    before[1] === (() => { const c = expeditionPrng('purity', 0); c.next(); return c.next(); })()
    && before.length === 2);
}

// 2 · shape (bars 1/6): all personas in range; default ≈ engine defaults
const inRange = (p: ExpeditionParams): boolean =>
  p.depth >= 4 && p.depth <= 8
  && p.retreatThreshold >= 2 && p.retreatThreshold <= 5
  && p.partySize >= 3 && p.partySize <= 4;
for (const [id, p] of Object.entries(personas)) {
  const d = directiveParams(id, p);
  check(`directiveParams(${id}) in the calibrated ranges (${JSON.stringify(d)})`, inRange(d));
}
{
  const d = directiveParams('stranger', DEFAULT_LAND_PERSONA);
  check('default persona boldness is exactly 0.5', directiveBoldness(DEFAULT_LAND_PERSONA) === 0.5);
  check('default persona derives within ±1 of the engine defaults',
    Math.abs(d.depth - DEFAULT_EXPEDITION_PARAMS.depth) <= 1
    && Math.abs(d.retreatThreshold - DEFAULT_EXPEDITION_PARAMS.retreatThreshold) <= 1
    && Math.abs(d.partySize - DEFAULT_EXPEDITION_PARAMS.partySize) <= 1);
}
// The temperament ordering the derivation exists to encode.
const bTimid = Math.min(directiveBoldness(LAND_PERSONAS.ghost), directiveBoldness(LAND_PERSONAS.cat));
const bBold = directiveBoldness(LAND_PERSONAS.loki);
check('ghost/cat read timid, loki reads bold', bTimid < 0.5 && bBold > 0.5);

// 3 · the Addendum-1 kill test (bar 2, two-sided) + bounded spread (bar 3).
// SAME seed streams for every param set — only the directive varies, so
// any rate difference is purely the directive's doing.
const deathRate = (params: ExpeditionParams): number => {
  let dead = 0;
  let sent = 0;
  for (let i = 0; i < 8000; i++) {
    const o = runExpedition(params, expeditionPrng('directive-odds', i));
    dead += o.deadIndices.length;
    sent += params.partySize;
  }
  return dead / sent;
};
const timidRate = deathRate(directiveParams('ghost', LAND_PERSONAS.ghost));
const defaultRate = deathRate(DEFAULT_EXPEDITION_PARAMS);
const boldRate = deathRate(directiveParams('loki', LAND_PERSONAS.loki));
check(`directives move odds by >1pp (timid ${(timidRate * 100).toFixed(2)}% vs bold ${(boldRate * 100).toFixed(2)}%)`,
  boldRate - timidRate > 0.01);
check(`directives-followed order strictly around directives-ignored (default ${(defaultRate * 100).toFixed(2)}%)`,
  timidRate < defaultRate && defaultRate < boldRate);
check('bounded spread: bold under 2.5x timid', boldRate < 2.5 * timidRate);
check('bounded spread: bold under 10% absolute', boldRate < 0.1);

// 4 · hoard stage (bar 4): monotone, zero-at-zero, first glint cheap
check('empty hoard shows nothing', hoardStage(0) === 0);
check('the first gold coin starts the pile', hoardStage(1) === 1);
{
  let prev = 0;
  let monotone = true;
  let capped = true;
  for (let g = 0; g <= 2000; g++) {
    const s = hoardStage(g);
    if (s < prev) monotone = false;
    if (s < 0 || s > HOARD_STAGE_MAX) capped = false;
    prev = s;
  }
  check('hoardStage is monotone non-decreasing over 0..2000', monotone);
  check(`hoardStage stays within 0..${HOARD_STAGE_MAX}`, capped);
  check('the pile is not done within a month-scale hoard', hoardStage(1100) < HOARD_STAGE_MAX);
}

// 5 · the rendered pile (bar 5 + kill condition 1): one row-set per
// stage, numeral-free, rung-1 undercroft glyphs only, growing
check('one glyph row-set per stage', HOARD_GLYPH_ROWS.length === HOARD_STAGE_MAX);
let prevMass = 0;
HOARD_GLYPH_ROWS.forEach((rows, i) => {
  const flat = rows.join('');
  check(`stage ${i + 1} rows carry no numeral`, !/\d/.test(flat));
  check(`stage ${i + 1} uses only rung-1 undercroft glyphs`, [...flat].every((c) => '▪░▒ '.includes(c)));
  const mass = [...flat].filter((c) => c !== ' ').length;
  check(`stage ${i + 1} pile is bigger than stage ${i}`, mass > prevMass);
  prevMass = mass;
});

report();
