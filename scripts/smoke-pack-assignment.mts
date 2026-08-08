/**
 * Pack-assignment smoke (T3 slice 1) — `npx tsx scripts/smoke-pack-assignment.mts`.
 *
 * Locks the two things that make per-terminal packs safe: the assignment is
 * deterministic and total, and every pack a multi-window desk can reach agrees
 * with every other on which roles exist — the constraint the two-pack seam
 * spike found (docs/design-reviews/2026-08-08-two-pack-seam.md).
 */
import { makeChecker } from './lib/smoke.ts';
import { DESK_PACK_POOL, FIRST_WING_PACK, deskPackFor, packsCompatible } from '../src/terminal/packAssignment.ts';
import { THEMES, THEME_IDS } from '../src/themes/index.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';

const { check, report } = makeChecker('smoke pack-assignment');

// --- the pool -------------------------------------------------------------
check('pool is non-empty (else every check below is vacuous)', DESK_PACK_POOL.length > 0);
check('pool leads with the first-wing pack', DESK_PACK_POOL[0] === FIRST_WING_PACK, DESK_PACK_POOL[0]);
check('first-wing pack is phosphor — every judged shot and the README GIF use it',
  FIRST_WING_PACK === 'phosphor', FIRST_WING_PACK);
check('every pool entry is a registered theme',
  DESK_PACK_POOL.every((id) => (THEME_IDS as readonly string[]).includes(id)),
  DESK_PACK_POOL.filter((id) => !(THEME_IDS as readonly string[]).includes(id)).join(','));
check('pool has no duplicates', new Set(DESK_PACK_POOL).size === DESK_PACK_POOL.length);

// The pool must be a real subset decision, not "everything" — otherwise the
// compatibility rule is doing nothing and this gate would pass a regression
// that dropped it entirely.
check('pool EXCLUDES at least one registered pack (the rule bites)',
  DESK_PACK_POOL.length < THEME_IDS.length,
  `pool ${DESK_PACK_POOL.length} of ${THEME_IDS.length}`);
const excluded = THEME_IDS.filter((id) => !DESK_PACK_POOL.includes(id));
check('gameboy-dmg is excluded — it is the pack the spike measured as broken at a seam',
  excluded.includes('gameboy-dmg'), `excluded: ${excluded.join(',') || 'none'}`);

// --- the constraint the spike found ---------------------------------------
// Every pair a desk can produce must agree on which roles exist. Checked
// pairwise over the whole pool rather than against the first entry, so the
// rule cannot be satisfied by a pool that is merely a star around phosphor.
const badPairs: string[] = [];
for (const a of DESK_PACK_POOL) {
  for (const b of DESK_PACK_POOL) {
    if (!packsCompatible(THEMES[a], THEMES[b])) badPairs.push(`${a}|${b}`);
  }
}
check('every pool pair is compatible (identical landOmit)', badPairs.length === 0, badPairs.slice(0, 5).join(' '));
check('an excluded pack is genuinely INcompatible with the pool',
  excluded.every((id) => !packsCompatible(THEMES[id], THEMES[FIRST_WING_PACK])),
  excluded.join(','));

// packsCompatible must be a real predicate, not a constant true.
check('packsCompatible is not constant-true',
  !packsCompatible(THEMES['gameboy-dmg'], THEMES['phosphor']));
check('packsCompatible is reflexive', packsCompatible(THEMES['gameboy-dmg'], THEMES['gameboy-dmg']));

// --- assignment: deterministic, total, and pinned at d0 -------------------
check('d0 gets the first-wing pack', deskPackFor('d0') === FIRST_WING_PACK, deskPackFor('d0'));
check('assignment is deterministic', deskPackFor('d3') === deskPackFor('d3'));
const desk = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
const assigned = desk.map(deskPackFor);
check('every desk wing resolves to a pool member',
  assigned.every((id) => DESK_PACK_POOL.includes(id)), assigned.join(','));
check('the desk actually VARIES across its six wings (the point of the slice)',
  new Set(assigned).size > 1, assigned.join(','));
check('six wings are all distinct (pool is large enough not to repeat)',
  new Set(assigned).size === desk.length, assigned.join(','));
// Total: a wing id outside the d<number> shape must still resolve.
for (const odd of ['', 'wing', 'd', 'd-1', 'dX7', 'd999999']) {
  check(`total for wing '${odd}'`, DESK_PACK_POOL.includes(deskPackFor(odd)), deskPackFor(odd));
}

// --- the join is unaffected by the pack ----------------------------------
// The spike measured this live; pin it headlessly so a future change to the
// seam maths cannot quietly make terrain depend on the palette. composeLand
// takes no theme at all, which is the structural reason — assert the
// consequence, not the implementation.
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const GEOM = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false, mural: false } as const;
const left = composeLand(fnv('terminal:d0'), SAMPLE_LAND, { ...GEOM, join: { right: fnv('terminal:d1') } });
const right = composeLand(fnv('terminal:d1'), SAMPLE_LAND, { ...GEOM, join: { left: fnv('terminal:d0') } });
check('joined wings meet at the same surface row, whatever pack each wears',
  left.surface[left.width - 1] === right.surface[0],
  `left ${left.surface[left.width - 1]} vs right ${right.surface[0]}`);
check('…and the two wings assigned different packs', deskPackFor('d0') !== deskPackFor('d1'));

report();
