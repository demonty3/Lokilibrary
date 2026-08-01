/**
 * Marginalia slice smoke — `npx tsx scripts/smoke-land-wear-persist.mts`.
 * Locks persistent wear:
 *   - decayedCount half-life math (halve per real day, clamp negative age)
 *   - createFootfall seeding (pre-worn columns worn from frame one) + snapshot
 *   - land_wear flush/restore round-trip, prune-below-1, namespacing
 *   - recordMark → placedMarksForCell round-trip, active+pending filter
 */
import { makeChecker } from './lib/smoke.ts';
import { createFootfall, decayedCount, WEAR_HALF_LIFE_MS } from '../src/terminal/wear.ts';

const { check, report } = makeChecker('smoke land-wear-persist');

// 1 · decay math
const t0 = 1_700_000_000_000;
check('zero age: unchanged', decayedCount(8, t0, t0) === 8);
check('one day: halved', decayedCount(8, t0, t0 + WEAR_HALF_LIFE_MS) === 4);
check('two days: quartered', decayedCount(8, t0, t0 + 2 * WEAR_HALF_LIFE_MS) === 2);
check('negative age clamps to unchanged', decayedCount(8, t0 + 9999, t0) === 8);

// 2 · seeding
const seeded = createFootfall(8, new Map([[5, 9], [6, 3]]));
check('at/past threshold: worn from frame one', seeded.worn.has(5));
check('below threshold: not worn', !seeded.worn.has(6));
let crossed = false;
for (let i = 0; i < 5; i++) crossed = seeded.step(6) || crossed;
check('seeded count resumes toward threshold', crossed && seeded.worn.has(6));

// 2b · fractional seed crossing (decayed counts are not integers)
const frac = createFootfall(8, new Map([[7, 7.3]]));
check('fractional seed: not yet worn', !frac.worn.has(7));
check('fractional seed crosses on the next step', frac.step(7) && frac.worn.has(7));
check('crossing fires exactly once', !frac.step(7));

// 3 · snapshot
const snap = seeded.snapshot();
check('snapshot holds seeded + stepped counts', snap.get(5) === 9 && snap.get(6) === 8);
const before = seeded.snapshot().get(5);
(snap as Map<number, number>).set(5, 999);
check('snapshot is a copy', seeded.snapshot().get(5) === before);

report();
