/**
 * Dungeon rung 4 smoke — `npx tsx scripts/smoke-delve4.mts`.
 * Locks the craft grammar, the cookbook, the loadout and the DM bounds
 * against the spec's bars
 * (docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md):
 *   - bar 1: the grammar's scores and price bounds match the frozen
 *     go/no-go table; the whole lattice sits under the hard cap; the
 *     seed cookbook is 8 entries, two aspect-gated
 *   - bar 2 + kill (two-sided, the rung-2/3 harness): on the SAME
 *     per-run seed streams, the bold dispatcher's actual pick moves
 *     yield by >1pp of base potential (skills are real), the timid
 *     pick's death gap stays legible, AND the worst admissible death
 *     stack (shrine ward + `ward` three) stays ≥ 0.4x the unwarded
 *     baseline — on the floor, never below it. This smoke failing IS
 *     the kill: the cookbook reverts to lore-only, the DM doesn't ship.
 *     Calibrated 2026-08-21 (8000 identical streams, bold-most probe):
 *     timid pick gap 0.55pp at ratio 0.79; bold pick +18.8% gold;
 *     shrine+ward3 ratio 0.413.
 *   - bar 2: the no-loadout path takes ZERO inserted draws —
 *     byte-identical with mods absent or empty; the pick is pure,
 *     prng-free, ≤2, one skill per verb, requirement-gated
 *   - bar 4: deterministic validation admits only in-grammar,
 *     under-cap, floor-respecting proposals; DM output is re-validated
 *     with name/price/pacing scoped to GRANTS (the go/no-go residue-4
 *     shape — a refusal carries line alone)
 *   - bar 7: aspects accrue from Tier-0-observable deeds only, at the
 *     dispatch/resolution sites; requirement arithmetic gates entries
 *   - bar 8: payment is pure, zero-draw, reserve-respecting, pacing-
 *     gated; rung-3-shaped blobs parse with defaulted craft fields
 *   - bar 6 (vocab half): skill names are numeral-free by construction
 */
import { makeChecker } from './lib/smoke.ts';
import {
  accrueAspect,
  beginExpedition,
  DEFAULT_EXPEDITION_PARAMS,
  directiveBoldness,
  directiveParams,
  expeditionPrng,
  initialDelveState,
  NOTABLE_DEAD_MIN,
  NOTABLE_GOLD_MIN,
  parseDelveState,
  resolveExpedition,
  runExpedition,
  SPEND_RESERVE,
  SPEND_TRANCHE,
  type DelveState,
  type ExpeditionParams,
} from '../src/terminal/delve.ts';
import {
  applyGrant,
  aspectShare,
  cookbookIds,
  CRAFT_LOADOUT_MAX,
  CRAFT_MODIFIERS,
  CRAFT_NAME_RE,
  CRAFT_SCORE_CAP,
  CRAFT_VERBS,
  craftScore,
  effectiveCookbook,
  grantedAsSkill,
  pickLoadout,
  proposalBounds,
  requirementMet,
  resolveMods,
  respectsDeathFloor,
  SEED_COOKBOOK,
  validateCraftProposal,
  validateDmVerdict,
  verbMagMax,
  type CraftComposition,
  type DmGrant,
} from '../src/terminal/craft.ts';
import { craftClause, extractCraftProposal } from '../src/terminal/craftProposal.ts';
import { craftNote, craftVocabLines } from '../src/terminal/marks.ts';
import { buildDmPrompt } from '../worker/lib/dm-prompt.ts';
import { LAND_PERSONAS } from '../src/terminal/beingIntents.ts';
import type { PlanStep } from '../src/agents/memory/schema.ts';

const { check, report } = makeChecker('smoke delve4');

// 1 · the grammar's arithmetic (bar 1): frozen against the go/no-go
// table — seed scores, worked examples, price bounds, the lattice cap.
{
  const expected: Record<string, number> = {
    'ember-line': 3, 'loud-iron': 4, 'soft-step': 4, 'long-breath': 2,
    'keen-eye': 1, 'knot-of-sacks': 2, 'saints-shadow': 4, 'red-remembrance': 3,
  };
  check('the seed cookbook ships 8 entries', SEED_COOKBOOK.length === 8);
  check('exactly two seed entries carry aspect requirements',
    SEED_COOKBOOK.filter((s) => s.requires).length === 2);
  for (const s of SEED_COOKBOOK) {
    check(`seed score matches the frozen table: ${s.id} = ${expected[s.id]}`,
      craftScore(s.composition) === expected[s.id]);
    check(`seed name passes the register: ${s.id}`, CRAFT_NAME_RE.test(s.id) && !/\d/.test(s.id));
  }
  const worked: [CraftComposition, number, number, number][] = [
    [{ verb: 'salvage', magnitude: 2, modifier: 'when-few' }, 2, 20, 50],
    [{ verb: 'glean', magnitude: 2, modifier: 'below' }, 3, 30, 75],
    [{ verb: 'salvage', magnitude: 2, modifier: 'when-warded' }, 3, 30, 75],
  ];
  for (const [c, score, floor, cap] of worked) {
    const b = proposalBounds(c);
    check(`go/no-go worked example holds: ${c.verb} ${c.magnitude} ${c.modifier}`,
      b.score === score && b.floor === floor && b.cap === cap);
  }
  let latticeOk = true;
  let latticeMax = 0;
  for (const verb of CRAFT_VERBS) {
    for (const modifier of CRAFT_MODIFIERS) {
      for (let magnitude = 1; magnitude <= verbMagMax(verb); magnitude++) {
        const s = craftScore({ verb, modifier, magnitude });
        if (s < 1 || s > CRAFT_SCORE_CAP) latticeOk = false;
        latticeMax = Math.max(latticeMax, s);
      }
    }
  }
  check(`every lattice point scores within 1..${CRAFT_SCORE_CAP}`, latticeOk);
  check('the lattice reaches the cap (ward three, always)', latticeMax === CRAFT_SCORE_CAP);
}

// 2 · the death floor (bar 2's low side, arithmetic half): ward three
// sits ON the floor; any deeper stack is inadmissible.
check('ward three alone is admissible — on the floor, never below',
  respectsDeathFloor([{ verb: 'ward', magnitude: 3, modifier: 'always' }]));
check('stacking a second ward crosses the floor and is refused',
  !respectsDeathFloor([
    { verb: 'ward', magnitude: 3, modifier: 'always' },
    { verb: 'ward', magnitude: 1, modifier: 'when-few' },
  ]));
check('exposure-side verbs never trip the death-die guard',
  respectsDeathFloor([
    { verb: 'veil', magnitude: 3, modifier: 'always' },
    { verb: 'press', magnitude: 3, modifier: 'always' },
  ]));

// 3 · consequentiality (bar 2, two-sided, identical seed streams). The
// probes are the ACTUAL temperament picks off the seed cookbook.
const stats = (params: ExpeditionParams) => {
  let dead = 0;
  let sent = 0;
  let gold = 0;
  for (let i = 0; i < 8000; i++) {
    const o = runExpedition(params, expeditionPrng('craft-odds', i));
    dead += o.deadIndices.length;
    sent += params.partySize;
    gold += o.gold;
  }
  return { death: dead / sent, gold: gold / 8000 };
};
const boldParams = directiveParams('loki', LAND_PERSONAS.loki);
const basePotential = Array.from({ length: boldParams.depth }, (_, s) => 2 + s)
  .reduce((a, b) => a + b, 0);
const base = stats(boldParams);
const seedBook = effectiveCookbook({ cookbook: [] });
const boldPick = pickLoadout(directiveBoldness(LAND_PERSONAS.loki), seedBook, undefined);
const timidPick = pickLoadout(directiveBoldness(LAND_PERSONAS.ghost), seedBook, undefined);
check('the bold pick off the seeds is press + glean',
  boldPick.map((s) => s.id).join(',') === 'loud-iron,keen-eye');
check('the timid pick off the seeds is ward + veil',
  timidPick.map((s) => s.id).join(',') === 'ember-line,soft-step');
{
  const withBold = stats({ ...boldParams, mods: resolveMods(boldPick) });
  const yieldPp = (withBold.gold - base.gold) / basePotential;
  check(`the bold pick moves yield by >1pp of base potential (measured ${(yieldPp * 100).toFixed(1)}pp)`,
    yieldPp > 0.01);
  const withTimid = stats({ ...boldParams, mods: resolveMods(timidPick) });
  const gap = base.death - withTimid.death;
  check(`the timid pick's death gap stays legible (>0.2pp; measured ${(gap * 100).toFixed(2)}pp at freeze — 0.55)`,
    gap > 0.002);
  check('no pick is god-mode: both stay ≥ 0.4x the unloaded baseline',
    withTimid.death >= 0.4 * base.death && withBold.death >= 0.4 * base.death);
}
{
  // The worst admissible death stack: shrine ward + `ward` three.
  const floorStack = stats({
    ...boldParams,
    warded: true,
    mods: resolveMods([{ id: 'x', composition: { verb: 'ward', magnitude: 3, modifier: 'always' } }]),
  });
  check(`the floor holds under the worst stack (measured ratio ${(floorStack.death / base.death).toFixed(3)} ≥ 0.4)`,
    floorStack.death >= 0.4 * base.death);
}

// 4 · zero inserted draws (bar 2): absent mods, empty mods and a bare
// loadout-ids field all take the identical path; a real loadout differs.
{
  let identical = true;
  let loadoutDiffers = false;
  const mods = resolveMods(timidPick);
  for (let i = 0; i < 50; i++) {
    const a = JSON.stringify(runExpedition(DEFAULT_EXPEDITION_PARAMS, expeditionPrng('craft-byte', i)));
    const b = JSON.stringify(runExpedition({ ...DEFAULT_EXPEDITION_PARAMS, mods: [] }, expeditionPrng('craft-byte', i)));
    const c = JSON.stringify(runExpedition(
      { ...DEFAULT_EXPEDITION_PARAMS, loadout: ['ember-line'] }, expeditionPrng('craft-byte', i)));
    const d = JSON.stringify(runExpedition({ ...DEFAULT_EXPEDITION_PARAMS, mods }, expeditionPrng('craft-byte', i)));
    if (a !== b || a !== c) identical = false;
    if (a !== d) loadoutDiffers = true;
  }
  check('no-loadout runs are byte-identical with mods absent, empty, or ids-only', identical);
  check('a real loadout changes at least one outcome over 50 seeds', loadoutDiffers);
}

// 5 · the pick (bar 2): pure, deterministic, bounded, one per verb,
// requirement-gated by deed arithmetic.
{
  const again = pickLoadout(directiveBoldness(LAND_PERSONAS.loki), seedBook, undefined);
  check('the pick is deterministic per (boldness, cookbook, tally)',
    JSON.stringify(again) === JSON.stringify(boldPick));
  check(`the pick never exceeds ${CRAFT_LOADOUT_MAX}`,
    boldPick.length <= CRAFT_LOADOUT_MAX && timidPick.length <= CRAFT_LOADOUT_MAX);
  const verbs = timidPick.map((s) => s.composition.verb);
  check('one skill per verb', new Set(verbs).size === verbs.length);
  check('an empty tally gates the gated entries out',
    !pickLoadout(0.2, seedBook, undefined).some((s) => s.requires)
    && !pickLoadout(0.9, seedBook, {}).some((s) => s.requires));
  const faithful = pickLoadout(0.2, seedBook, { faith: 2, harvest: 1 });
  check('a faith-heavy record unlocks saints-shadow for the timid pick',
    faithful.some((s) => s.id === 'saints-shadow'));
  check('requirement arithmetic: share of zero deeds is zero, gate closed',
    aspectShare({}, 'faith') === 0 && !requirementMet({}, { aspect: 'faith', share: 0.4 }));
  check('requirement arithmetic: share counts only the named aspect',
    aspectShare({ faith: 1, war: 3 }, 'faith') === 0.25
    && requirementMet({ faith: 2, war: 2 }, { aspect: 'faith', share: 0.5 }));
}

// 6 · proposal validation (bar 4, BEFORE the DM): in-grammar admits with
// the right bounds; escapes are named, never repaired.
{
  const ok = validateCraftProposal({ name: 'broken-rope', verb: 'salvage', modifier: 'when-few', magnitude: 2 });
  check('an in-grammar proposal is admitted with the frozen bounds',
    ok.ok && ok.bounds.score === 2 && ok.bounds.floor === 20 && ok.bounds.cap === 50);
  check('a verb outside the grammar is an escape',
    !validateCraftProposal({ name: 'x-name', verb: 'smite', modifier: 'always', magnitude: 1 }).ok);
  check('a modifier outside the grammar is an escape',
    !validateCraftProposal({ name: 'x-name', verb: 'ward', modifier: 'when-brave', magnitude: 1 }).ok);
  check('magnitude past the verb bound is an escape',
    !validateCraftProposal({ name: 'x-name', verb: 'hold', modifier: 'always', magnitude: 2 }).ok);
  check('a fractional magnitude is an escape',
    !validateCraftProposal({ name: 'x-name', verb: 'ward', modifier: 'always', magnitude: 1.5 }).ok);
  check('a name off the register is an escape',
    !validateCraftProposal({ name: 'Rope2', verb: 'ward', modifier: 'always', magnitude: 1 }).ok
    && !validateCraftProposal({ name: 'ab', verb: 'ward', modifier: 'always', magnitude: 1 }).ok);
  check('the new retreat-side verb is sayable: break / when-few admits',
    validateCraftProposal({ name: 'loose-line', verb: 'break', modifier: 'when-few', magnitude: 1 }).ok);
}

// 7 · DM output validation (bar 4, AFTER — grant-scoped per residue 4).
{
  const bounds = { score: 2, floor: 20, cap: 50 };
  const taken = cookbookIds({ cookbook: [] });
  const grant = validateDmVerdict(
    { verdict: 'grant', name: 'broken-rope', price: 35, pacing: 'after-the-next-return', line: 'the line is cut' },
    bounds, taken);
  check('a clean grant validates', grant?.verdict === 'grant' && grant.price === 35);
  check('a refusal validates on line alone — empty name and price zero are in-contract',
    validateDmVerdict(
      { verdict: 'beyond-the-craft', name: '', price: 0, pacing: '', line: 'the ground is held' },
      bounds, taken)?.verdict === 'beyond-the-craft');
  check('a price outside floor..cap is rejected',
    validateDmVerdict({ verdict: 'grant', name: 'broken-rope', price: 51, pacing: 'at-once', line: 'x y z' }, bounds, taken) === null
    && validateDmVerdict({ verdict: 'grant', name: 'broken-rope', price: 19, pacing: 'at-once', line: 'x y z' }, bounds, taken) === null);
  check('a fractional price is rejected',
    validateDmVerdict({ verdict: 'grant', name: 'broken-rope', price: 35.5, pacing: 'at-once', line: 'x y z' }, bounds, taken) === null);
  check('a digit in the line is rejected',
    validateDmVerdict({ verdict: 'grant', name: 'broken-rope', price: 35, pacing: 'at-once', line: 'costs 35' }, bounds, taken) === null);
  check('a name collision with the cookbook is rejected',
    validateDmVerdict({ verdict: 'grant', name: 'ember-line', price: 35, pacing: 'at-once', line: 'x y z' }, bounds, taken) === null);
  check('an unknown pacing is rejected',
    validateDmVerdict({ verdict: 'grant', name: 'broken-rope', price: 35, pacing: 'someday', line: 'x y z' }, bounds, taken) === null);
  check('an unknown verdict is rejected',
    validateDmVerdict({ verdict: 'maybe', line: 'x y z' }, bounds, taken) === null);
  check('a refusal with a digit in the line is still rejected',
    validateDmVerdict({ verdict: 'beyond-the-craft', line: 'take 2' }, bounds, taken) === null);
}

// 8 · grants, payment and pacing (bar 8): pure, zero draws, the reserve
// holds, pacing gates the earliest payment.
const mkDue = (hoard: number): DelveState => {
  const s = initialDelveState('craft-wing');
  s.hoardGold = hoard;
  beginExpedition(s, 'disp', DEFAULT_EXPEDITION_PARAMS, 0);
  if (s.active) {
    s.active.outcome = { ...s.active.outcome, gold: 0, deadIndices: [], stepsCleared: 0 };
    s.active.resolveAtMs = 0;
  }
  return s;
};
const grant35: DmGrant = { verdict: 'grant', name: 'broken-rope', price: 35, pacing: 'at-once', line: 'the line is cut' };
const proposal = { name: 'loose-line', composition: { verb: 'salvage', magnitude: 2, modifier: 'when-few' } as CraftComposition };
{
  const s = initialDelveState('grant-wing');
  s.hoardGold = SPEND_RESERVE + 35;
  const g = applyGrant(s, proposal, grant35, 'disp');
  check('an affordable at-once grant pays immediately and holds the reserve',
    g.paid && s.hoardGold === SPEND_RESERVE);
  check('the grant records the proposer name for the lore trail',
    g.proposedBy === 'disp' && g.proposedName === 'loose-line' && g.id === 'broken-rope');
  check('the grant accrues the proposer craft deed', s.aspects['disp']?.craft === 1);
  check('a paid grant joins the effective cookbook',
    effectiveCookbook(s).some((k) => k.id === 'broken-rope'));
  check('cookbookIds sees seed and granted names alike',
    cookbookIds(s).includes('broken-rope') && cookbookIds(s).includes('ember-line'));
}
{
  const s = initialDelveState('grant-wing');
  s.hoardGold = 10;
  const g = applyGrant(s, proposal, grant35, 'disp');
  check('an unaffordable at-once grant waits unpaid', !g.paid && s.hoardGold === 10);
  check('an unpaid grant is not carried', !effectiveCookbook(s).some((k) => k.id === 'broken-rope'));
}
{
  // at-once, unaffordable at grant → pays at the next resolution once
  // the banked gold covers price over reserve; the tranche comes after.
  const s = mkDue(0);
  applyGrant(s, proposal, grant35, 'disp');
  if (s.active) s.active.outcome = { ...s.active.outcome, gold: SPEND_RESERVE + 35, deadIndices: [] };
  resolveExpedition(s, 1, 0.2);
  check('a pending grant pays at resolution when affordable',
    s.cookbook[0].paid && s.hoardGold === SPEND_RESERVE && s.monumentFund === 0);
}
{
  // Payment precedes the tranche: enough for the skill OR the tranche,
  // not both — the working wins.
  const s = mkDue(SPEND_RESERVE + SPEND_TRANCHE - 1);
  applyGrant(s, proposal, grant35, 'disp');
  resolveExpedition(s, 1, 0.2);
  check('payment comes before the tranche when the hoard covers only one',
    s.cookbook[0].paid && s.monumentFund === 0);
}
{
  // after-the-next-return: granted mid-expedition, the CURRENT return
  // does not pay; the one after does.
  const s = mkDue(SPEND_RESERVE + 200);
  applyGrant(s, proposal, { ...grant35, pacing: 'after-the-next-return' }, 'disp');
  resolveExpedition(s, 1, 0.2);
  check('after-the-next-return skips the in-flight expedition\'s resolution', !s.cookbook[0].paid);
  beginExpedition(s, 'disp', DEFAULT_EXPEDITION_PARAMS, 0);
  if (s.active) {
    s.active.outcome = { ...s.active.outcome, gold: 0, deadIndices: [], stepsCleared: 0 };
    s.active.resolveAtMs = 0;
  }
  resolveExpedition(s, 1, 0.2);
  check('the next return pays it', s.cookbook[0].paid);
}
{
  // Zero draws and no scheduling drift: an unpaid grant in the book
  // leaves the dispatch schedule untouched (the delve3 purity idiom).
  const a = mkDue(SPEND_RESERVE + 200);
  const b = mkDue(SPEND_RESERVE + 200);
  applyGrant(b, proposal, grant35, 'disp');
  resolveExpedition(a, 1, 0.2);
  resolveExpedition(b, 1, 0.2);
  check('payment never touches the dispatch schedule',
    a.nextDispatchAtUptimeMs === b.nextDispatchAtUptimeMs);
  const before = (() => { const p = expeditionPrng('craft-purity', 0); return p.next(); })();
  const s = mkDue(SPEND_RESERVE + 200);
  applyGrant(s, proposal, grant35, 'disp');
  resolveExpedition(s, 1, 0.2);
  const after = (() => { const p = expeditionPrng('craft-purity', 0); return p.next(); })();
  check('grants and payment take no draws from an expedition stream', before === after);
}

// 9 · deeds (bar 7): accrued at the Tier-0 sites, and only there.
{
  const s = initialDelveState('deed-wing');
  beginExpedition(s, 'disp', { ...DEFAULT_EXPEDITION_PARAMS, warded: true }, 0);
  check('a warded dispatch is a faith deed', s.aspects['disp']?.faith === 1);
  if (s.active) {
    s.active.outcome = {
      ...s.active.outcome, gold: 10, deadIndices: [], stepsCleared: 3, encountered: true, fled: false,
    };
    s.active.resolveAtMs = 0;
  }
  resolveExpedition(s, 1, 0.2);
  check('a rich return is a harvest deed', s.aspects['disp']?.harvest === 1);
  check('a survived drive-off is a war deed', s.aspects['disp']?.war === 1);
  check('no deaths, no death deed', s.aspects['disp']?.death === undefined);
}
{
  const s = mkDue(0);
  if (s.active) s.active.outcome = { ...s.active.outcome, deadIndices: [0] };
  resolveExpedition(s, 1, 0.2);
  check('a loss is a death deed', s.aspects['disp']?.death === 1);
  check('accrueAspect is plain arithmetic', (accrueAspect(s, 'disp', 'death'), s.aspects['disp']?.death === 2));
}

// 10 · notable delves (bar 3): pressure set at the thresholds, the
// founding run sets the depth baseline quietly, latest pressure wins.
{
  const s = mkDue(0);
  if (s.active) s.active.outcome = { ...s.active.outcome, gold: NOTABLE_GOLD_MIN, deadIndices: [] };
  const r = resolveExpedition(s, 1, 0.2);
  check('a rich haul is notable', r?.notable === true && s.proposalPressure?.dispatcherId === 'disp');
}
{
  const s = mkDue(0);
  if (s.active) s.active.outcome = { ...s.active.outcome, gold: 0, deadIndices: [0, 1] };
  const r = resolveExpedition(s, 1, 0.2);
  check(`${NOTABLE_DEAD_MIN} deaths are notable`, r?.notable === true && s.proposalPressure?.kind === 'loss');
}
{
  const s = mkDue(0);
  if (s.active) s.active.outcome = { ...s.active.outcome, gold: 0, deadIndices: [0, 1, 2] };
  const r = resolveExpedition(s, 1, 0.2);
  check('a lost party is notable', r?.notable === true && s.proposalPressure?.kind === 'lost');
}
{
  const s = mkDue(0);
  if (s.active) s.active.outcome = { ...s.active.outcome, gold: 1, deadIndices: [], stepsCleared: 4 };
  const r1 = resolveExpedition(s, 1, 0.2);
  check('the founding run sets the baseline without pressure',
    r1?.notable === false && s.proposalPressure === null && s.deepestCleared === 4);
  beginExpedition(s, 'disp-two', DEFAULT_EXPEDITION_PARAMS, 0);
  if (s.active) {
    s.active.outcome = { ...s.active.outcome, gold: 1, deadIndices: [], stepsCleared: 6 };
    s.active.resolveAtMs = 0;
  }
  const r2 = resolveExpedition(s, 1, 0.2);
  check('a bettered mark is a first-clear, and the latest pressure wins',
    r2?.notable === true && s.proposalPressure?.dispatcherId === 'disp-two' && s.deepestCleared === 6);
  beginExpedition(s, 'disp-three', DEFAULT_EXPEDITION_PARAMS, 0);
  if (s.active) {
    s.active.outcome = { ...s.active.outcome, gold: 1, deadIndices: [], stepsCleared: 2 };
    s.active.resolveAtMs = 0;
  }
  const r3 = resolveExpedition(s, 1, 0.2);
  check('an unremarkable delve leaves standing pressure alone',
    r3?.notable === false && s.proposalPressure?.dispatcherId === 'disp-two');
}

// 11 · back-compat (bar 8): a rung-3-shaped blob parses with defaulted
// craft fields and ticks without throwing; foreign compositions skip.
{
  const s = initialDelveState('compat-wing');
  const blob = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  delete blob.cookbook;
  delete blob.aspects;
  delete blob.proposalPressure;
  delete blob.deepestCleared;
  const parsed = parseDelveState(JSON.stringify(blob), 'compat-wing');
  check('a rung-3 blob parses with defaulted craft fields',
    parsed !== null && parsed.cookbook.length === 0
    && parsed.proposalPressure === null && parsed.deepestCleared === 0
    && typeof parsed.aspects === 'object');
  if (parsed) {
    beginExpedition(parsed, 'x', DEFAULT_EXPEDITION_PARAMS, 0);
    if (parsed.active) parsed.active.resolveAtMs = 0;
    check('a defaulted blob resolves without throwing', resolveExpedition(parsed, 1, 0.2) !== null);
  }
  check('a foreign composition in a future blob is skipped, never thrown',
    grantedAsSkill({
      id: 'far-thing', composition: { verb: 'smite', modifier: 'always', magnitude: 1 },
      line: '', price: 10, pacing: 'at-once', grantedAtSeq: 0, paid: true, proposedBy: 'x',
    }) === null);
}

// 12 · the proposal channel's pure half (bar 3): extraction off plan
// steps by content whitelist, and the craft clause that asks for it.
const step = (target: string, kind: PlanStep['kind'] = 'place_mark'): PlanStep =>
  ({ kind, target, status: 'pending' });
{
  const raw = extractCraftProposal([
    step('walk the shaft line'),
    step('i will write it down — craft: broken-rope: salvage twice when-few — for the ones after'),
  ]);
  check('the craft step parses out of surrounding prose',
    raw !== null && raw.name === 'broken-rope' && raw.verb === 'salvage'
    && raw.magnitude === 2 && raw.modifier === 'when-few');
  if (raw) {
    check('extraction and validation round-trip', validateCraftProposal(raw).ok);
  }
  const cased = extractCraftProposal([step('CRAFT: Broken-Rope: Salvage Thrice Below', 'move_to')]);
  check('casing is not trusted, and any step kind carries',
    cased !== null && cased.name === 'broken-rope' && cased.magnitude === 3);
  const flat = extractCraftProposal([step('craft: loose-line: break when-few')]);
  check('a flat working may omit its strength',
    flat !== null && flat.verb === 'break' && flat.magnitude === 1);
  check('no craft marker, no proposal — the empty mailbox',
    extractCraftProposal([step('linger at the shrine'), step('watch the west seam')]) === null);
  check('a stepless plan extracts nothing', extractCraftProposal([]) === null);
  const escape = extractCraftProposal([step('craft: storm-call: smite twice below')]);
  check('an out-of-grammar verb still extracts raw — validation names the escape',
    escape !== null && escape.verb === 'smite' && !validateCraftProposal(escape).ok);
  const first = extractCraftProposal([
    step('craft: first-word: ward once always'),
    step('craft: second-word: press twice always'),
  ]);
  check('the first craft step wins', first?.name === 'first-word');
}
{
  const clause = craftClause('lost', seedBook, 7);
  check('the clause names every held working', seedBook.every((s) => clause.includes(s.id)));
  check('the clause carries the format marker and the null option',
    clause.includes('craft: ') && clause.includes('propose none'));
  check('the clause is numeral-free', !/\d/.test(clause));
  check('the clause is deterministic per (kind, cookbook, seq)',
    clause === craftClause('lost', seedBook, 7));
  check('the exemplar rotates with the seq (residue 3)',
    clause !== craftClause('lost', seedBook, 8));
  let exemplarsLegal = true;
  for (let seq = 0; seq < 24; seq++) {
    const c = craftClause('rich', seedBook, seq);
    const quoted = /"(craft:[^"]+)"/.exec(c);
    const raw = quoted ? extractCraftProposal([step(quoted[1])]) : null;
    if (!raw || !validateCraftProposal(raw).ok) exemplarsLegal = false;
  }
  check('every rotated exemplar is itself a legal composition', exemplarsLegal);
}

// 13 · the marginalia rail (bar 6 + inherited kill "a number appears"):
// the craft vocab covers all four beats in every voice, numeral-free.
{
  const lines = craftVocabLines();
  check('the craft vocab covers five voices x four beats x two lines', lines.length === 40);
  for (const line of lines) {
    check(`craft vocab line carries no numeral: "${line.slice(0, 32)}…"`, !/\d/.test(line));
  }
  const note = craftNote('loki', 'granted', 'broken-rope', () => 0);
  check('the {name} slot substitutes', note.includes('broken-rope') && !note.includes('{name}'));
  check('unknown dispatcher ids fall back to the loki table',
    craftNote('who-is-this', 'refused', 'broken-rope', () => 0).length > 0);
}

// 14 · the DM prompt (bar 4 + residues 2 and 4): pure, states what each
// verb does NOT do, defines the refusal shape, pins the JSON contract.
{
  const { system, user } = buildDmPrompt({
    proposer: { id: 'loki', name: 'loki' },
    proposal: { name: 'broken-rope', verb: 'salvage', magnitude: 2, modifier: 'when-few', ground: 'the party that would not break died whole' },
    bounds: { score: 2, floor: 20, cap: 50 },
    cookbook: [{ id: 'ember-line', verb: 'ward', magnitude: 1, modifier: 'always' }],
  });
  for (const verb of CRAFT_VERBS) {
    check(`the system prompt states what ${verb} does — and does not do`,
      system.includes(`${verb} `) && new RegExp(`${verb}[^.]*\\. it (does|moves|spares)`).test(system));
  }
  check('the refusal shape is defined: line alone, name/price/pacing withheld',
    system.includes('beyond-the-craft') && system.includes('not yours to give on a refusal'));
  check('the JSON contract is pinned with both verdicts and all five keys',
    ['"verdict"', '"name"', '"price"', '"pacing"', '"line"'].every((k) => system.includes(k)));
  check('digits are forbidden in the name and the line',
    system.includes('never put a digit in the name or the line'));
  check('balance is declared out of the DM\'s hands',
    system.includes('balance is never your call'));
  check('the user block carries the proposal, its ground and the bounds',
    user.includes('broken-rope') && user.includes('salvage twice, when-few')
    && user.includes('died whole') && user.includes('floor 20') && user.includes('cap 50'));
  check('the user block lists the held cookbook', user.includes('ember-line: ward once, always'));
  check('the builder is pure and deterministic',
    JSON.stringify(buildDmPrompt({
      proposer: { id: 'loki', name: 'loki' },
      proposal: { name: 'broken-rope', verb: 'salvage', magnitude: 2, modifier: 'when-few', ground: 'the party that would not break died whole' },
      bounds: { score: 2, floor: 20, cap: 50 },
      cookbook: [{ id: 'ember-line', verb: 'ward', magnitude: 1, modifier: 'always' }],
    })) === JSON.stringify({ system, user }));
}

report();
