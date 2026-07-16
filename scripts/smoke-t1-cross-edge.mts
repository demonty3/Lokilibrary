/**
 * Tier-1 society smoke — `npx tsx scripts/smoke-t1-cross-edge.mts`.
 * Locks cross-edge perception.
 *   PURE (src/terminal/crossEdge.ts):
 *   - nearEdgeSummary: open-edge gating, distance math, nearest-first cap,
 *     radius, closed edges report [], purity
 *   - projectAcrossEdge: neighbours land just OUTSIDE the local land; the
 *     two windows' views of one being are mirror-consistent
 *   BROKER (real desktop/src/terminals.ts, mocked electron):
 *   - terminal:nearEdge relays each JOINED side to that neighbour with the
 *     side flipped; un-joined sides are dropped
 */
import { makeChecker, mockElectronModule } from './lib/smoke.ts';
import {
  NEAR_EDGE_CELLS,
  NEAR_EDGE_MAX,
  nearEdgeSummary,
  projectAcrossEdge,
} from '../src/terminal/crossEdge.ts';

const { check, report } = makeChecker('smoke t1-cross-edge');

// --- nearEdgeSummary -----------------------------------------------------------
const beings = [
  { id: 'a', x: 2 },
  { id: 'b', x: 57 },
  { id: 'c', x: 30 },
  { id: 'd', x: 59 },
];
const both = nearEdgeSummary(beings, 60, { left: true, right: true });
check('left side: in-range being, correct dist',
  JSON.stringify(both.left) === JSON.stringify([{ id: 'a', dist: 2 }]));
check('right side: nearest first',
  JSON.stringify(both.right) === JSON.stringify([{ id: 'd', dist: 0 }, { id: 'b', dist: 2 }]));
check('mid-land beings excluded', !JSON.stringify(both).includes('"c"'));
const closed = nearEdgeSummary(beings, 60, { left: false, right: false });
check('closed edges report []', closed.left.length === 0 && closed.right.length === 0);
const crowd = Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, x: i }));
const capped = nearEdgeSummary(crowd, 60, { left: true, right: false });
check(`cap at NEAR_EDGE_MAX (${NEAR_EDGE_MAX})`, capped.left.length === NEAR_EDGE_MAX);
check('cap keeps the nearest', capped.left[0].id === 'x0' && capped.left[0].dist === 0);
check('radius respected',
  nearEdgeSummary([{ id: 'far', x: NEAR_EDGE_CELLS + 1 }], 60, { left: true, right: false }).left.length === 0);
check('pure: same inputs → same summary',
  JSON.stringify(nearEdgeSummary(beings, 60, { left: true, right: true })) === JSON.stringify(both));
check('pure: input array unmutated', beings.length === 4 && beings[0].id === 'a' && beings[0].x === 2);

// --- projectAcrossEdge -----------------------------------------------------------
check('right-side neighbours land just past width-1',
  JSON.stringify(projectAcrossEdge('right', 60, [{ id: 'n0', dist: 0 }, { id: 'n3', dist: 3 }])) ===
    JSON.stringify([{ id: 'n0', x: 60 }, { id: 'n3', x: 63 }]));
check('left-side neighbours land just below 0',
  JSON.stringify(projectAcrossEdge('left', 60, [{ id: 'n0', dist: 0 }])) ===
    JSON.stringify([{ id: 'n0', x: -1 }]));
// Mirror consistency: MY being at x=59 (width 60) is dist 0 off my right
// edge; the neighbour projects it at ITS x=-1 — exactly the column my
// col 59 occupies on the shared desk.
const mine = nearEdgeSummary([{ id: 'm', x: 59 }], 60, { left: false, right: true });
check("mirror: my edge being appears at the neighbour's x=-1",
  JSON.stringify(projectAcrossEdge('left', 60, mine.right)) === JSON.stringify([{ id: 'm', x: -1 }]));

// --- broker relay (real terminals.ts, mocked electron) -----------------------------
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
});
const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');
handlers.get('terminal:debugMove')!(null, { terminalId: 't2', x: 700, y: 160 }); // snap → t1+t2

const [w1, w2] = FakeBrowserWindow.all;
check('nearEdge listener registered', listeners.has('terminal:nearEdge'));
listeners.get('terminal:nearEdge')!(null, {
  terminalId: 't1',
  near: { left: [{ id: 'a', dist: 2 }], right: [{ id: 'd', dist: 0 }] },
});
const w2sum = w2.webContents.sent.filter((m) => m.channel === 'terminal:neighbourSummary').pop();
check("t1's right-edge beings reach t2 as ITS left summary",
  JSON.stringify(w2sum?.payload) === JSON.stringify({ side: 'left', beings: [{ id: 'd', dist: 0 }] }));
check("t1's un-joined left side is dropped",
  w1.webContents.sent.filter((m) => m.channel === 'terminal:neighbourSummary').length === 0);

report();
