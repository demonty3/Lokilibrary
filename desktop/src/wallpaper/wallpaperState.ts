/**
 * Per-window wallpaper bookkeeping (pure — no electron, no koffi).
 *
 * Split out of macos.ts for two reasons, one structural and one about proof.
 *
 * STRUCTURAL: macos.ts held a single module-level `state` object with a
 * `state.priorLevel === null` capture guard. That is correct at N=1 and wrong
 * the moment a desk of terminal windows enters wallpaper mode: window 2's
 * enter finds the guard already tripped and captures NOTHING, then either
 * window's exit restores one set of values and nulls the shared state, so
 * window 3's exit restores nothing at all. It was a latent bug in the palace
 * too — it just never had a second window to surface it.
 *
 * PROOF: macos.ts cannot be smoke-tested. It `dlopen`s libobjc through koffi,
 * so under mockElectronModule `ensureBridge()` returns null and every exported
 * function early-returns — a smoke against it would pass VACUOUSLY, which is
 * the exact failure the brain's regression-test-must-fail-on-prefix-code note
 * is about. Keeping the bookkeeping here, pure, means the interesting
 * invariants (per-window capture, the bounds contract, the activation-policy
 * refcount) are asserted against real code instead of a stub.
 *
 * The key is the BrowserWindow itself, held weakly: a closed window's entry
 * disappears with it, and we never enumerate — callers own their own
 * registries (main.ts has mainWindow, terminals.ts has the terminals map).
 * A WeakMap cannot be counted, so the refcount is tracked alongside it.
 */

export interface CapturedWindowState {
  /** NSWindow.level before we touched it. */
  level: number;
  /** NSWindow.collectionBehavior before we touched it. */
  collectionBehavior: number;
  /** Bounds to restore on exit, or null for "we never touched bounds".
   *  The desk enters with bounds:'keep' — its snapped 640x520 IS the
   *  arrangement — so a null here is what stops an exit clobbering a layout
   *  the user arranged. */
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** Whether WE turned click-through on, so exit only undoes what enter did. */
  clickThrough: boolean;
}

let captured = new WeakMap<object, CapturedWindowState>();
/** WeakMaps aren't countable; the activation-policy refcount needs a number. */
let entered = 0;

/**
 * Begin an enter for `key`. Returns `fresh:false` if this key was already
 * wallpapered — the caller should re-apply level/behaviour (idempotent, and a
 * startup-restore can race a tray click) but MUST NOT re-capture, or it would
 * record the wallpaper state as the thing to restore to.
 *
 * `capture` is only invoked on a fresh enter, which is itself an assertion the
 * smoke makes: a second enter must not call it.
 */
export function beginEnter(
  key: object,
  capture: () => CapturedWindowState,
): { fresh: boolean; state: CapturedWindowState } {
  const existing = captured.get(key);
  if (existing) return { fresh: false, state: existing };
  const state = capture();
  captured.set(key, state);
  entered++;
  return { fresh: true, state };
}

/** End an exit for `key`: hand back what was captured and forget it. Returns
 *  null if this key was never entered — a spurious exit must be a no-op and
 *  must not drive the count negative. */
export function endExit(key: object): CapturedWindowState | null {
  const state = captured.get(key);
  if (!state) return null;
  captured.delete(key);
  entered--;
  return state;
}

export function isEntered(key: object): boolean {
  return captured.has(key);
}

export function enteredCount(): number {
  return entered;
}

/**
 * What the PROCESS-WIDE activation policy should become across a count
 * transition, or null for no change.
 *
 * `app.setActivationPolicy` is process-scoped, not per-window: without this,
 * one terminal's exit flips the Dock icon back while the rest of the desk is
 * still wallpapered. Only the 0 -> N and N -> 0 edges matter.
 */
export function policyFor(before: number, after: number): 'regular' | 'accessory' | null {
  if (before === 0 && after > 0) return 'accessory';
  if (before > 0 && after === 0) return 'regular';
  return null;
}

/** Test seam only — drop ALL bookkeeping. Never called by the app.
 *  The map is reassigned, not just the count: a WeakMap cannot be cleared, and
 *  zeroing the count alone leaves stale entries that a later exit will happily
 *  decrement past zero (found by the smoke, not by review). */
export function resetForTests(): void {
  captured = new WeakMap<object, CapturedWindowState>();
  entered = 0;
}
