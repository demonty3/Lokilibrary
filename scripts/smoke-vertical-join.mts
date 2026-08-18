/**
 * Vertical-join smoke (Phase B, B1w) — `npx tsx scripts/smoke-vertical-join.mts`.
 *
 * Pure half: computeVSnapTarget / computeVJoins / neighbourBelow /
 * neighbourAbove (desktop/src/topology.ts) — the kind gate that keeps
 * vertical snapping an UNDER-window affair (surface windows keep
 * vertical-drag-to-unsnap; horizontal drag is the under window's escape,
 * position-based so it STAYS escaped).
 *
 * Broker half: drives the REAL desktop/src/terminals.ts against a mocked
 * electron — spawnUnder docks a 640×260 window at exact abutment, the
 * topology broadcast carries vjoins, under windows never appear in a
 * horizontal join, drag-away undocks, drag-back re-docks, and one
 * undercroft per surface window is enforced.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';
import {
  computeVJoins,
  computeVSnapTarget,
  computeJoins,
  computeSnapTarget,
  neighbourAbove,
  neighbourBelow,
  JOIN_EPS_PX,
  SNAP_PX,
  SNAP_X_PX,
  type TermBounds,
  type TermKind,
} from '../desktop/src/topology.ts';

const { check, report } = makeChecker('smoke vertical-join');

const W = (id: string, x: number, y: number, kind?: TermKind): TermBounds => ({
  id,
  x,
  y,
  width: 640,
  height: kind === 'under' ? 260 : 520,
  ...(kind ? { kind } : {}),
});

// --- computeVJoins -----------------------------------------------------------
check('exact abut vjoins', JSON.stringify(computeVJoins([W('t1', 100, 100), W('u1', 100, 620, 'under')])) === JSON.stringify([{ top: 't1', bottom: 'u1' }]));
check('JOIN_EPS_PX tolerance holds', computeVJoins([W('t1', 100, 100), W('u1', 100 + JOIN_EPS_PX, 620 + JOIN_EPS_PX, 'under')]).length === 1);
check('3px y gap does not vjoin', computeVJoins([W('t1', 100, 100), W('u1', 100, 623, 'under')]).length === 0);
check('3px x offset does not vjoin', computeVJoins([W('t1', 103, 100), W('u1', 100, 620, 'under')]).length === 0);
check('surface below surface never vjoins', computeVJoins([W('t1', 100, 100), W('t2', 100, 620)]).length === 0);
check('under below under never vjoins', computeVJoins([W('u1', 100, 100, 'under'), W('u2', 100, 360, 'under')]).length === 0);
check('vjoins sort deterministically',
  JSON.stringify(computeVJoins([W('u2', 800, 620, 'under'), W('t2', 800, 100), W('u1', 100, 620, 'under'), W('t1', 100, 100)]).map((v) => `${v.top}/${v.bottom}`)) ===
  JSON.stringify(['t1/u1', 't2/u2']));

// --- computeVSnapTarget ------------------------------------------------------
{
  const t1 = W('t1', 100, 100); // bottom edge at 620
  check('under snaps to the surface bottom edge',
    JSON.stringify(computeVSnapTarget(W('u1', 110, 640, 'under'), [t1])) === JSON.stringify({ x: 100, y: 620 }));
  check('SNAP_PX bounds the vertical gap',
    computeVSnapTarget(W('u1', 110, 620 + SNAP_PX + 1, 'under'), [t1]) === null &&
    computeVSnapTarget(W('u1', 110, 620 + SNAP_PX, 'under'), [t1]) !== null);
  check('horizontal drag past SNAP_X_PX escapes (and stays escaped)',
    computeVSnapTarget(W('u1', 100 + SNAP_X_PX + 1, 630, 'under'), [t1]) === null);
  check('boundary inclusive at exactly SNAP_X_PX',
    computeVSnapTarget(W('u1', 100 + SNAP_X_PX, 630, 'under'), [t1]) !== null);
  check('a surface mover never v-snaps',
    computeVSnapTarget(W('t2', 110, 640), [t1]) === null);
  check('an under candidate is never a v-snap anchor',
    computeVSnapTarget(W('u2', 110, 900, 'under'), [W('u1', 100, 620, 'under')]) === null);
  check('an occupied surface is skipped (one undercroft per surface)',
    computeVSnapTarget(W('u2', 105, 640, 'under'), [t1, W('u1', 100, 620, 'under')]) === null);
  check('a docked under re-settles onto its own spot',
    JSON.stringify(computeVSnapTarget(W('u1', 101, 621, 'under'), [t1])) === JSON.stringify({ x: 100, y: 620 }));
  check('nearest surface wins',
    // t2's bottom edge (650) is 14px from the mover; t1's (620) is 16px.
    JSON.stringify(computeVSnapTarget(W('u1', 100, 636, 'under'), [t1, W('t2', 100, 130)])) === JSON.stringify({ x: 100, y: 650 }));
}

// --- neighbourBelow / neighbourAbove ----------------------------------------
{
  const vjoins = computeVJoins([W('t1', 100, 100), W('u1', 100, 620, 'under')]);
  check('neighbourBelow finds the undercroft', neighbourBelow('t1', vjoins) === 'u1');
  check('neighbourAbove finds the surface', neighbourAbove('u1', vjoins) === 't1');
  check('no vjoin → null both ways', neighbourBelow('u1', vjoins) === null && neighbourAbove('t1', vjoins) === null);
}

// --- horizontal functions are blind to kind (bar: unchanged behaviour) -------
{
  // Two surface windows abutting horizontally join exactly as pre-B…
  check('horizontal joins unchanged for surfaces',
    computeJoins([W('t1', 100, 100), W('t2', 740, 100)]).length === 1);
  // …and the BROKER (not these functions) excludes under windows from the
  // horizontal universe; the pure function itself stays kind-blind:
  check('computeSnapTarget itself stays kind-blind (broker filters)',
    computeSnapTarget(W('u1', 745, 110, 'under'), [W('t1', 100, 100)]) !== null);
}

// --- broker drive (REAL terminals.ts, mocked electron) ------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-vjoin-'));

type Handler = (e: unknown, payload?: unknown) => unknown;
const handlers = new Map<string, Handler>();

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
  static urls: string[] = [];
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
  loadURL(url: string): Promise<void> {
    FakeBrowserWindow.urls.push(url);
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
    on: () => {},
  },
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 2560, height: 1440 } }) },
  app: { getPath: () => tmpDir, on: () => {} },
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({}) },
  Tray: class {
    setToolTip(): void {}
    setContextMenu(): void {}
  },
});

const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');

interface DebugState {
  bounds: Array<{ id: string; x: number; y: number; width: number; height: number; kind?: string }>;
  joins: Array<{ left: string; right: string }>;
  vjoins: Array<{ top: string; bottom: string }>;
}
const state = (): DebugState => handlers.get('terminal:debugState')!(null) as DebugState;

check('debugSpawnUnder registered', handlers.has('terminal:debugSpawnUnder'));

// Dock: spawn t1's undercroft.
const u1 = handlers.get('terminal:debugSpawnUnder')!(null, 't1') as string | null;
check('spawnUnder returns the new id', u1 === 'u1');
{
  const s = state();
  const t1 = s.bounds.find((b) => b.id === 't1')!;
  const under = s.bounds.find((b) => b.id === 'u1');
  check('undercroft is 640×260, kind under',
    under?.width === 640 && under?.height === 260 && under?.kind === 'under');
  check('undercroft docks at exact abutment', under?.x === t1.x && under?.y === t1.y + t1.height);
  check('vjoin live', JSON.stringify(s.vjoins) === JSON.stringify([{ top: 't1', bottom: 'u1' }]));
  check('renderer URL carries under=1',
    FakeBrowserWindow.urls.some((u) => u.includes('terminal=u1') && u.includes('wing=d0') && u.includes('under=1')));
}
check('one undercroft per surface: second spawn refused',
  handlers.get('terminal:debugSpawnUnder')!(null, 't1') === null);
check('an under window cannot host an undercroft',
  handlers.get('terminal:debugSpawnUnder')!(null, 'u1') === null);

// Broadcast carries vjoins.
{
  const w1 = FakeBrowserWindow.all[0];
  const topo = w1.webContents.sent.filter((m) => m.channel === 'terminal:topology').pop() as
    | { payload: { vjoins?: unknown } }
    | undefined;
  check('topology broadcast carries vjoins',
    JSON.stringify((topo as { payload?: { vjoins?: unknown } })?.payload && (topo!.payload as { vjoins?: unknown }).vjoins) ===
    JSON.stringify([{ top: 't1', bottom: 'u1' }]));
  const pulled = handlers.get('terminal:getTopology')!(null) as { vjoins: unknown };
  check('getTopology pull carries vjoins', JSON.stringify(pulled.vjoins) === JSON.stringify([{ top: 't1', bottom: 'u1' }]));
}

// Undock by horizontal drag; the surface window never moves (T5 kill).
{
  const before = state().bounds.find((b) => b.id === 't1')!;
  handlers.get('terminal:debugMove')!(null, { terminalId: 'u1', x: before.x + 200, y: before.y + before.height + 10 });
  const s = state();
  check('horizontal drag undocks', s.vjoins.length === 0);
  const after = s.bounds.find((b) => b.id === 't1')!;
  check('the surface window never moved', after.x === before.x && after.y === before.y);
  const under = s.bounds.find((b) => b.id === 'u1')!;
  check('escaped under stays where it was dragged (past SNAP_X_PX)', under.x === before.x + 200);
}

// Re-dock by dragging back into the capture band.
{
  const t1 = state().bounds.find((b) => b.id === 't1')!;
  handlers.get('terminal:debugMove')!(null, { terminalId: 'u1', x: t1.x + 20, y: t1.y + t1.height + 12 });
  const s = state();
  check('drag back re-docks', JSON.stringify(s.vjoins) === JSON.stringify([{ top: 't1', bottom: 'u1' }]));
  const under = s.bounds.find((b) => b.id === 'u1')!;
  check('re-dock is exact abutment', under.x === t1.x && under.y === t1.y + t1.height);
}

// Under windows never enter the horizontal join universe.
{
  const t2 = state().bounds.find((b) => b.id === 't2')!;
  handlers.get('terminal:debugMove')!(null, { terminalId: 'u1', x: t2.x + t2.width, y: t2.y });
  const s = state();
  check('an under window flush against a surface edge never h-joins',
    !s.joins.some((j) => j.left === 'u1' || j.right === 'u1'));
}

report();
