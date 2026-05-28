/**
 * Phase 4C slice smoke — `npx tsx scripts/smoke-4c-peek.mts`.
 *
 * Covers the WSL-testable surface of the Ctrl+Alt+L peek hotkey:
 *   - `togglePeek` state-machine semantics as a pure transition function
 *     (false → true → false → true; no-op when mode is 'window').
 *   - Explicit mode change cancels peek (peeking flag reset to false
 *     when applyMode runs while peeking is true).
 *   - IPC payload shape for `wallpaper:peekChanged` (a single boolean).
 *   - Renderer-side `subscribePeek` / `getPeeking` defensive guards
 *     short-circuit when the bridge surface is missing (mirrors the
 *     4A stale-preload pattern; missing methods log a warn + return
 *     no-op falsy values instead of throwing into React's render loop).
 *
 * NOT covered (needs Windows-native Electron):
 *   - The actual globalShortcut.register() return value (success vs
 *     conflict with another app's binding).
 *   - exitWallpaper + setAlwaysOnTop + focus during peek-on.
 *   - enterWallpaper + setAlwaysOnTop(false) restoring during peek-off.
 *   - The tray "Peek" / "Exit peek" label flip based on peeking state.
 *   - globalShortcut.unregisterAll() in window-all-closed.
 *
 * The user verifies those in a Windows-native PowerShell `npm run dev`
 * inside desktop/, per the plan's verification section.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Pure togglePeek transition mirror
//
// main.ts's togglePeek() interleaves side-effects (exitWallpaper,
// setAlwaysOnTop, focus, enterWallpaper, throttle restart, tray rebuild,
// IPC notify) with the boolean flip. The flip itself is what's worth
// testing — everything else is Win32/Electron and gets user-verified on
// Windows. Mirror the transition as a pure function:

type Mode = 'window' | 'wallpaper';
interface PeekState { mode: Mode; peeking: boolean }

function togglePeekPure(s: PeekState): PeekState {
  if (s.mode !== 'wallpaper') {
    // No-op — peek only meaningful in wallpaper mode. Persisted mode +
    // peeking flag both unchanged.
    return s;
  }
  return { mode: s.mode, peeking: !s.peeking };
}

// applyMode's peek-cancel: when an explicit mode change runs while peek
// is on, the flag resets to false. Modeled as a pure transition over
// the same shape:
function applyModePure(s: PeekState, nextMode: Mode): PeekState {
  if (s.mode === nextMode) return s; // tray auto-fire guard
  // Mode change always wins over transient peek.
  return { mode: nextMode, peeking: false };
}

const { check, report } = makeChecker('smoke 4C');

// ---------------------------------------------------------------------------
// 1. togglePeek state-machine

// Starting state: wallpaper mode, not peeking.
let s: PeekState = { mode: 'wallpaper', peeking: false };

s = togglePeekPure(s);
check('toggle from off: peeking → true, mode unchanged', s.peeking === true && s.mode === 'wallpaper');
s = togglePeekPure(s);
check('toggle from on: peeking → false, mode unchanged', s.peeking === false && s.mode === 'wallpaper');
s = togglePeekPure(s);
check('toggle again: peeking → true (idempotent toggle)', s.peeking === true);

// No-op when in window mode — both flag and mode preserved unchanged.
s = { mode: 'window', peeking: false };
const before = s;
s = togglePeekPure(s);
check('toggle in window mode: no-op (peeking stays false)', s.peeking === false && s.mode === 'window');
check('toggle in window mode: returns same shape (no mutation)', s === before);

// Edge case: if peeking was somehow true while mode is 'window' (shouldn't
// happen via normal flow, but defensive), the toggle is still a no-op.
s = { mode: 'window', peeking: true };
s = togglePeekPure(s);
check('toggle in window mode with peeking=true: stays true (no-op)', s.peeking === true && s.mode === 'window');

// ---------------------------------------------------------------------------
// 2. applyMode cancels peek

s = { mode: 'wallpaper', peeking: true };
s = applyModePure(s, 'window');
check('applyMode(window) while peeking: mode=window, peeking=false', s.mode === 'window' && s.peeking === false);

s = { mode: 'wallpaper', peeking: true };
s = applyModePure(s, 'wallpaper');
check(
  'applyMode(same mode) while peeking: no-op (tray auto-fire guard) — peek stays',
  s.mode === 'wallpaper' && s.peeking === true,
);

s = { mode: 'window', peeking: false };
s = applyModePure(s, 'wallpaper');
check('applyMode(window→wallpaper) while not peeking: mode flips, peeking=false', s.mode === 'wallpaper' && s.peeking === false);

// ---------------------------------------------------------------------------
// 3. Mock Electron + load src/api/electron.ts to test the renderer-side
//    defensive guards (warnStalePreload on missing bridge methods)

// Build a minimal window.electronAPI stub. Start with no peek methods —
// triggers the stale-preload warn path. Tests then progressively add
// methods to verify each guard.
interface PartialAPI {
  isElectron: true;
  getPeeking?: () => Promise<boolean>;
  togglePeek?: () => Promise<boolean>;
  onPeekChanged?: (cb: (peeking: boolean) => void) => () => void;
}
const partial: PartialAPI = { isElectron: true };
(globalThis as { window?: { electronAPI?: PartialAPI } }).window = { electronAPI: partial };

// Capture console.warn calls so we can verify the helpful warn fires once.
const warns: string[] = [];
const originalWarn = console.warn;
console.warn = (msg: unknown): void => { warns.push(String(msg)); };

// Hijack require('electron') as a no-op (api/electron.ts doesn't actually
// import the electron runtime module — declares the global window type only
// — but other transitive deps might).
mockElectronModule({});

const electron = await import('../src/api/electron.ts');
const { getPeeking, togglePeek, subscribePeek } = electron;

// 3a. Bridge missing all three peek methods → guards short-circuit, warn fires once
warns.length = 0;
const peek1 = await getPeeking();
check('getPeeking with missing bridge: returns false', peek1 === false);
check(
  'getPeeking with missing bridge: warn mentions getPeeking',
  warns.some((w) => w.includes('getPeeking') && w.includes('preload')),
);

// 3b. togglePeek with missing bridge: same pattern
const tog1 = await togglePeek();
check('togglePeek with missing bridge: returns false', tog1 === false);

// Note: warnStalePreload fires once per session (the warnedStalePreload
// flag is module-local in electron.ts). So further missing-method calls
// don't add new warns. That's correct behavior — we don't want the
// console spammed every render of a stale-preload component.

// 3c. subscribePeek with missing bridge: returns a no-op unsub function
const unsub1 = subscribePeek(() => undefined);
check('subscribePeek with missing bridge: returns no-op fn', typeof unsub1 === 'function');
unsub1(); // should not throw

// 3d. Bridge methods present → calls go through
partial.getPeeking = async () => true;
partial.togglePeek = async () => true;
let lastBroadcast: boolean | null = null;
let subscribedHandler: ((p: boolean) => void) | null = null;
partial.onPeekChanged = (cb) => {
  subscribedHandler = cb;
  return () => { subscribedHandler = null; };
};

const peek2 = await getPeeking();
check('getPeeking with bridge present: returns true (bridge response)', peek2 === true);

const tog2 = await togglePeek();
check('togglePeek with bridge present: returns true (bridge response)', tog2 === true);

const unsub2 = subscribePeek((p) => { lastBroadcast = p; });
check('subscribePeek with bridge present: hooks into onPeekChanged', subscribedHandler !== null);
// Simulate a main-process emit:
subscribedHandler?.(true);
check('subscribePeek: fires the callback with the boolean', lastBroadcast === true);
subscribedHandler?.(false);
check('subscribePeek: fires the callback on reset', lastBroadcast === false);
unsub2();
check('subscribePeek: unsub clears the handler', subscribedHandler === null);

// 3e. Bridge method that throws → returns false (doesn't propagate)
partial.getPeeking = async () => { throw new Error('boom'); };
const peek3 = await getPeeking();
check('getPeeking with bridge that throws: returns false (caught)', peek3 === false);

partial.togglePeek = async () => { throw new Error('boom'); };
const tog3 = await togglePeek();
check('togglePeek with bridge that throws: returns false (caught)', tog3 === false);

// 3f. No electron at all (web build path) → all helpers safe defaults
(globalThis as { window?: unknown }).window = undefined;
const peek4 = await getPeeking();
check('getPeeking with no window: returns false', peek4 === false);
const tog4 = await togglePeek();
check('togglePeek with no window: returns false', tog4 === false);
const unsub3 = subscribePeek(() => undefined);
check('subscribePeek with no window: returns no-op fn', typeof unsub3 === 'function');
unsub3();

// ---------------------------------------------------------------------------
// Cleanup + report

console.warn = originalWarn;
report();
