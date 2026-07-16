/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-broker-handoff.mts`.
 * Drives the REAL main-process broker (desktop/src/terminals.ts) against a
 * mocked electron (fake BrowserWindows + captured ipcMain handlers):
 *   - roster uniqueness across two simulated terminals (first writer wins)
 *   - snap via debugMove → topology broadcast carries {joins, wings}
 *   - agentExit forwards the being's runtime state OPAQUELY to agentEnter
 *     (deep-equal round-trip), flips the entry side, names the source wing
 *   - exit refused off a closed edge / for a non-owned agent
 */
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

const { check, report } = makeChecker('smoke t1-broker-handoff');

type Handler = (e: unknown, payload?: unknown) => unknown;
const handlers = new Map<string, Handler>();
const listeners = new Map<string, Handler>();

class FakeWebContents {
  sent: Array<{ channel: string; payload: unknown }> = [];
  send(channel: string, payload: unknown): void {
    this.sent.push({ channel, payload });
  }
  on(): void {}
  getURL(): string {
    return '';
  }
}

class FakeBrowserWindow {
  static all: FakeBrowserWindow[] = [];
  webContents = new FakeWebContents();
  private bounds: { x: number; y: number; width: number; height: number };
  constructor(opts: { x: number; y: number; width: number; height: number }) {
    this.bounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height };
    FakeBrowserWindow.all.push(this);
  }
  once(_ev: string, cb: () => void): void {
    cb();
  }
  on(): void {}
  show(): void {}
  loadURL(): Promise<void> {
    return Promise.resolve();
  }
  getBounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.bounds };
  }
  setBounds(b: { x: number; y: number; width: number; height: number }): void {
    this.bounds = { ...b };
  }
  isDestroyed(): boolean {
    return false;
  }
}

mockElectronModule({
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: (channel: string, fn: Handler) => listeners.set(channel, fn),
  },
  // Wide fake work area so the boot spread keeps the historic 720px spacing.
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 2560, height: 1440 } }) },
});

const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');

check('two windows spawned', FakeBrowserWindow.all.length === 2);
check('debug IPC registered', handlers.has('terminal:debugState') && handlers.has('terminal:debugMove'));

const state = () =>
  handlers.get('terminal:debugState')!(null) as {
    joins: Array<{ left: string; right: string }>;
    roster: Record<string, string>;
  };

// --- snap t2 against t1's right edge (t1 boots at x=60, w=640) --------------
check('boots unjoined', state().joins.length === 0);
handlers.get('terminal:debugMove')!(null, { terminalId: 't2', x: 700, y: 160 });
check('debugMove → snap → joined',
  JSON.stringify(state().joins) === JSON.stringify([{ left: 't1', right: 't2' }]));

const [w1, w2] = FakeBrowserWindow.all;
const topo = w1.webContents.sent.filter((m) => m.channel === 'terminal:topology').pop();
check('topology broadcast carries joins + wings',
  JSON.stringify(topo?.payload) ===
    JSON.stringify({ joins: [{ left: 't1', right: 't2' }], wings: { t1: 'd0', t2: 'd1' } }));

// --- roster uniqueness (7D.2 single-roaming-roster over IPC) -----------------
const spawn = handlers.get('terminal:agentSpawn')!;
check('first spawn accepted', spawn(null, { agentId: 'b1', terminalId: 't1' }) === true);
check('duplicate spawn in ANOTHER terminal refused', spawn(null, { agentId: 'b1', terminalId: 't2' }) === false);
check('re-spawn in the SAME terminal is idempotent', spawn(null, { agentId: 'b1', terminalId: 't1' }) === true);
check('roster names exactly one home', state().roster.b1 === 't1');

// --- state-carrying handoff ---------------------------------------------------
const exit = handlers.get('terminal:agentExit')!;
const carried = { speed: 1.7, dir: 1, intent: 'watch_edge', bobPhase: 2.1 };
check('exit off the joined edge accepted',
  exit(null, { agentId: 'b1', terminalId: 't1', side: 'right', state: carried }) === true);
check('roster moved b1 → t2', state().roster.b1 === 't2');
const enter = w2.webContents.sent.filter((m) => m.channel === 'terminal:agentEnter').pop()?.payload as
  | { agentId: string; side: string; state: unknown; from: { terminalId: string; wing: string } }
  | undefined;
check('agentEnter reached the neighbour', enter?.agentId === 'b1');
check('entry side flips (exit right → enter left)', enter?.side === 'left');
check('runtime state round-trips opaquely', JSON.stringify(enter?.state) === JSON.stringify(carried));
check('from names the source terminal + wing',
  JSON.stringify(enter?.from) === JSON.stringify({ terminalId: 't1', wing: 'd0' }));

// --- refusals ------------------------------------------------------------------
check('exit refused off a closed edge',
  exit(null, { agentId: 'b1', terminalId: 't2', side: 'right', state: carried }) === false);
check('exit refused for a non-owned agent',
  exit(null, { agentId: 'b1', terminalId: 't1', side: 'right', state: carried }) === false);
check('refusals leave the roster untouched', state().roster.b1 === 't2');

report();
