/**
 * Broadcast-registry smoke — `npx tsx scripts/smoke-broadcast.mts`.
 * Locks desktop/src/broadcast.ts, which replaced three sends that were
 * hardcoded to `mainWindow.webContents` and early-returned when it was null —
 * and it is ALWAYS null in terminals mode, so those sends were silent no-ops
 * on the desk (PRD-snapping-terminals.md:47, the singleton T1 never cleared).
 *
 * Invariants and the mutant each exists to catch (all run red first):
 *   - every registered window receives   <- sending to targets[0] only
 *   - a destroyed window is skipped      <- dropping the isDestroyed guard
 *   - a throwing send is contained       <- dropping the try/catch
 *   - 'closed' deregisters               <- not wiring the closed handler
 *   - register is idempotent             <- adding to an array instead of a Set
 *
 * electron is mocked before the import: broadcast.ts only type-imports
 * BrowserWindow, but mockElectronModule keeps this honest if that changes.
 */
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

mockElectronModule({});

const { broadcast, registerWindow, unregisterWindow, targetCount, resetForTests } = await import(
  '../desktop/src/broadcast.ts'
);

const { check, report } = makeChecker('smoke broadcast');

interface FakeWin {
  id: string;
  destroyed: boolean;
  sent: Array<{ channel: string; payload: unknown }>;
  throwOnSend: boolean;
  closedHandlers: Array<() => void>;
  isDestroyed(): boolean;
  on(ev: string, cb: () => void): void;
  webContents: { send(channel: string, payload: unknown): void };
  close(): void;
}

function fakeWin(id: string, opts: { throwOnSend?: boolean } = {}): FakeWin {
  const w: FakeWin = {
    id,
    destroyed: false,
    sent: [],
    throwOnSend: opts.throwOnSend ?? false,
    closedHandlers: [],
    isDestroyed: () => w.destroyed,
    on: (ev, cb) => {
      if (ev === 'closed') w.closedHandlers.push(cb);
    },
    webContents: {
      send: (channel, payload) => {
        if (w.throwOnSend) throw new Error('renderer gone');
        w.sent.push({ channel, payload });
      },
    },
    close: () => {
      w.destroyed = true;
      for (const cb of w.closedHandlers) cb();
    },
  };
  return w;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reg = (w: FakeWin): void => registerWindow(w as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unreg = (w: FakeWin): void => unregisterWindow(w as any);

// 1 · Fan-out reaches EVERY registered window. This is the whole point: the
//     desk is N windows and the old code sent to one.
resetForTests();
const a = fakeWin('a');
const b = fakeWin('b');
const c = fakeWin('c');
reg(a); reg(b); reg(c);
check('three registered', targetCount() === 3, `${targetCount()}`);
broadcast('throttle:state-change', { state: 'full', isInitial: false });
check('window a received', a.sent.length === 1);
check('window b received', b.sent.length === 1);
check('window c received', c.sent.length === 1, 'a single-target send would leave this at 0');
check('the channel is carried', a.sent[0].channel === 'throttle:state-change');
check('the payload is carried', (a.sent[0].payload as { state: string }).state === 'full');

// 2 · register is idempotent — a double register must not double-send.
reg(a);
check('re-registering does not grow the set', targetCount() === 3, `${targetCount()}`);
broadcast('x');
check('window a received exactly once more', a.sent.length === 2, `${a.sent.length}`);
// The Set dedupes membership on its own, so THIS is what the has() guard
// actually protects: without it a second register stacks another 'closed'
// listener. Found by running the mutant and watching it stay green.
check(
  're-registering does not stack a second closed listener',
  a.closedHandlers.length === 1,
  `${a.closedHandlers.length}`,
);

// 3 · A destroyed window is skipped and pruned, not sent to.
resetForTests();
const live = fakeWin('live');
const dead = fakeWin('dead');
reg(live); reg(dead);
dead.destroyed = true; // destroyed WITHOUT a 'closed' event (the racy case)
broadcast('ping');
check('the live window received', live.sent.length === 1);
check('the destroyed window was not sent to', dead.sent.length === 0);
check('the destroyed window was pruned', targetCount() === 1, `${targetCount()}`);

// 4 · A throwing send is contained — one dead renderer must not stop the
//     others. Registration order puts the thrower FIRST on purpose.
resetForTests();
const thrower = fakeWin('thrower', { throwOnSend: true });
const after = fakeWin('after');
reg(thrower); reg(after);
let threw = false;
try {
  broadcast('ping');
} catch {
  threw = true;
}
check('broadcast did not propagate the throw', !threw);
check('the window AFTER the thrower still received', after.sent.length === 1);

// 5 · 'closed' self-deregisters, so no caller has to remember cleanup.
resetForTests();
const closing = fakeWin('closing');
reg(closing);
check('registered before close', targetCount() === 1);
closing.close();
check("'closed' deregistered it", targetCount() === 0, `${targetCount()}`);
broadcast('ping');
check('a closed window receives nothing', closing.sent.length === 0);

// 6 · Explicit unregister, and an empty fan-out is a no-op not a crash.
resetForTests();
const solo = fakeWin('solo');
reg(solo);
unreg(solo);
check('unregisterWindow removes it', targetCount() === 0);
broadcast('ping');
check('broadcast to nobody is harmless', solo.sent.length === 0);
check('unregistering an unknown window is harmless', (unreg(fakeWin('ghost')), targetCount() === 0));

report();
