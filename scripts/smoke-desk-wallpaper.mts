/**
 * Terminals-as-wallpaper smoke — `npx tsx scripts/smoke-desk-wallpaper.mts`.
 * Spec: docs/superpowers/specs/2026-08-06-terminals-as-wallpaper-design.md.
 *
 * Locks the pure bookkeeping that makes N windows safe to wallpaper
 * (desktop/src/wallpaper/wallpaperState.ts) plus join invariance across a
 * peek round-trip (against the REAL desktop/src/topology.ts).
 *
 * Why the state module exists to be tested at all: macos.ts cannot be smoked
 * (it dlopens libobjc through koffi, so under a mocked electron every export
 * early-returns and a smoke would pass VACUOUSLY — the exact hazard the
 * brain's regression-test-must-fail-on-prefix-code note describes). The
 * bookkeeping was therefore split out so the interesting invariants are
 * asserted against real code.
 *
 * Invariants and the mutant each exists to catch (all run red before this was
 * trusted):
 *   - per-window capture      <- reinstating the module-level freshness guard
 *   - re-enter idempotence    <- capturing again on a second enter
 *   - bounds:'keep' contract  <- always recording/restoring bounds
 *   - count floor             <- letting endExit decrement on an unknown key
 *   - policy refcount         <- policyFor returning 'regular' on any decrement
 *   - join invariance         <- (covered by the bounds mutant)
 */
import { makeChecker } from './lib/smoke.ts';
import {
  beginEnter,
  endExit,
  enteredCount,
  isEntered,
  policyFor,
  resetForTests,
  type CapturedWindowState,
} from '../desktop/src/wallpaper/wallpaperState.ts';
import { computeJoins, type TermBounds } from '../desktop/src/topology.ts';

const { check, report } = makeChecker('smoke desk-wallpaper');

/** Stand-ins for BrowserWindow — the state module only needs object identity. */
const winA = { id: 'a' };
const winB = { id: 'b' };
const winC = { id: 'c' };

function cap(level: number, behaviour: number, bounds: CapturedWindowState['bounds'] = null): () => CapturedWindowState {
  return () => ({ level, collectionBehavior: behaviour, bounds, clickThrough: true });
}

// 1 · Per-window capture. THE bug this module exists to fix: with a single
//     module-level guard, window B's enter captured nothing at all.
resetForTests();
let calls = 0;
const a1 = beginEnter(winA, () => { calls++; return cap(0, 0)(); });
const b1 = beginEnter(winB, () => { calls++; return cap(3, 17)(); });
check('window A enter is fresh', a1.fresh);
check('window B enter is ALSO fresh (not swallowed by a shared guard)', b1.fresh);
check('window B captured its OWN level', b1.state.level === 3, `got ${b1.state.level}`);
check('window A kept its own level', a1.state.level === 0);
check('window B captured its own collectionBehavior', b1.state.collectionBehavior === 17);
check('both captures ran', calls === 2, `${calls}`);
check('both are entered', isEntered(winA) && isEntered(winB));
check('count is 2', enteredCount() === 2);

// 2 · Re-enter idempotence — a startup restore may race a tray click. The
//     second enter must NOT re-capture, or it would record the wallpaper
//     state as the thing to restore to.
const a2 = beginEnter(winA, () => { calls++; return cap(999, 999)(); });
check('a second enter is not fresh', !a2.fresh);
check('the capture closure did NOT run again', calls === 2, `${calls}`);
check('the original capture survived', a2.state.level === 0);
check('a re-enter does not double-count', enteredCount() === 2);

// 3 · The bounds contract. bounds:'keep' captures none, so exit restores
//     none — this is what stops an exit clobbering a desk arrangement.
resetForTests();
beginEnter(winC, cap(0, 0, null));
check("bounds:'keep' captures null", endExit(winC)?.bounds === null);
beginEnter(winC, cap(0, 0, { x: 1, y: 2, width: 3, height: 4 }));
check("bounds:'display' captures the rect", endExit(winC)?.bounds?.width === 3);

// 4 · Count floor. A spurious exit must be a no-op.
resetForTests();
check('exit of a never-entered window returns null', endExit(winA) === null);
check('count did not go negative', enteredCount() === 0, `${enteredCount()}`);
beginEnter(winA, cap(0, 0));
endExit(winA);
check('double exit is a no-op', endExit(winA) === null);
check('count still 0 after a double exit', enteredCount() === 0, `${enteredCount()}`);

// 5 · The activation-policy refcount. app.setActivationPolicy is
//     process-scoped: one terminal's exit must not put the Dock icon back
//     while the rest of the desk is still wallpapered.
resetForTests();
const policies: Array<string | null> = [];
function enterTracked(w: object): void {
  const before = enteredCount();
  beginEnter(w, cap(0, 0));
  policies.push(policyFor(before, enteredCount()));
}
function exitTracked(w: object): void {
  const before = enteredCount();
  const s = endExit(w);
  policies.push(s ? policyFor(before, enteredCount()) : null);
}
enterTracked(winA);
enterTracked(winB);
exitTracked(winA);
check('first enter goes accessory', policies[0] === 'accessory');
check('second enter changes nothing', policies[1] === null);
check('exiting ONE of two changes nothing (the Dock icon stays hidden)', policies[2] === null);
exitTracked(winB);
check('the LAST exit goes regular', policies[3] === 'regular');
exitTracked(winB);
check('a spurious exit after the last changes nothing', policies[4] === null);
check('policyFor is pure on a no-op transition', policyFor(2, 2) === null);
check('policyFor 0->0 is null', policyFor(0, 0) === null);

// 6 · Join invariance across an enter/peek/exit round-trip, against the REAL
//     topology module. The desk enters with bounds:'keep', so no window's
//     bounds are touched; computeJoins is bounds-pure; therefore joins are
//     invariant across the round-trip. That is the whole argument for "no
//     re-snap after peek", so it is asserted rather than assumed.
resetForTests();
const desk: TermBounds[] = [
  { id: 't1', x: 60, y: 160, width: 640, height: 520 },
  { id: 't2', x: 700, y: 160, width: 640, height: 520 },
];
const joinsBefore = computeJoins(desk);
check('the fixture desk is actually joined', joinsBefore.length === 1, `${joinsBefore.length}`);
// Round-trip: enter (keep) -> peek out -> peek in -> exit. Bounds untouched.
const snapshot = JSON.stringify(desk);
for (const w of desk) beginEnter(w, cap(0, 0, null));
for (const w of desk) {
  const s = endExit(w);
  if (s?.bounds) Object.assign(w, s.bounds); // the ONLY way bounds could move
}
for (const w of desk) beginEnter(w, cap(0, 0, null));
for (const w of desk) {
  const s = endExit(w);
  if (s?.bounds) Object.assign(w, s.bounds);
}
check('bounds are byte-identical across the round-trip', JSON.stringify(desk) === snapshot);
check(
  'joins are identical across the round-trip',
  JSON.stringify(computeJoins(desk)) === JSON.stringify(joinsBefore),
);
check('the desk is still joined after the round-trip', computeJoins(desk).length === 1);

report();
