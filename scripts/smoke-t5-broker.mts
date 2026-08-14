/**
 * T5 broker smoke — `npx tsx scripts/smoke-t5-broker.mts`.
 * Drives the REAL main-process broker (desktop/src/terminals.ts) against the
 * mocked electron (the smoke-t1-broker-handoff pattern):
 *   - opted-out desks reject every candidate (bar 1)
 *   - first-writer-wins, one proposal per session (bar 3)
 *   - only the proposing window may apply/dismiss (bar 6)
 *   - apply spawns at exact abutment on the anchor's chain and the join is
 *     REAL, no pre-existing window moves (bar 4)
 *   - a wing opened by hand overnight makes apply a quiet no-op (bar 4)
 *
 * NOT covered here (live e2e instead): the session clear on the transition
 * into 'sleeping' — that line lives in the throttle controller's callback,
 * which only runs in wallpaper mode and is verified on the real desk via
 * terminal:debugProposalState.
 *
 * Spec: docs/superpowers/specs/2026-08-14-t5-orchestration-design.md
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

const { check, report } = makeChecker('smoke t5-broker');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-t5-'));

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

const WORK_AREA = { x: 0, y: 0, width: 2560, height: 1440 };
mockElectronModule({
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: () => {},
  },
  screen: {
    getPrimaryDisplay: () => ({ workArea: WORK_AREA }),
    getDisplayMatching: () => ({ workArea: WORK_AREA }),
  },
  app: { getPath: () => tmpDir, on: () => {} },
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({}) },
  Tray: class {
    setToolTip(): void {}
    setContextMenu(): void {}
  },
});

const config = await import('../desktop/src/config.ts');
const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');

const [w1, w2] = FakeBrowserWindow.all;
const sender = (w: FakeBrowserWindow) => ({ sender: w.webContents });
const propose = handlers.get('terminal:proposeTopology')!;
const apply = handlers.get('terminal:applyProposal')!;
const dismiss = handlers.get('terminal:dismissProposal')!;
const pState = () =>
  handlers.get('terminal:debugProposalState')!(null) as {
    proposal: { wing: string; terminalId: string; agentId: string } | null;
    orchestration: boolean;
  };
const deskState = () =>
  handlers.get('terminal:debugState')!(null) as {
    bounds: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    joins: Array<{ left: string; right: string }>;
  };

// Join t1+t2 first: the desk the proposal will grow (t1 boots at x=60).
handlers.get('terminal:debugMove')!(null, { terminalId: 't2', x: 700, y: 160 });
check('precondition: t1|t2 joined',
  JSON.stringify(deskState().joins) === JSON.stringify([{ left: 't1', right: 't2' }]));

// --- bar 1: opted-out rejects, and the default IS opted-out ----------------
check('a fresh config is opted OUT', pState().orchestration === false);
check('opted-out candidate rejected',
  JSON.stringify(propose(sender(w1), { wing: 'd2', agentId: 'loki' })) ===
    JSON.stringify({ accepted: false, reason: 'opted_out' }));
check('…and no session state was created', pState().proposal === null);

// --- bar 3: first writer wins, one per session -----------------------------
config.setOrchestration(true);
check('opt-in visible over IPC', pState().orchestration === true);
check('an open wing is refused',
  (propose(sender(w1), { wing: 'd1', agentId: 'loki' }) as { reason: string }).reason === 'wing_open');
check('an unknown wing is refused',
  (propose(sender(w1), { wing: 'd9', agentId: 'loki' }) as { reason: string }).reason === 'unknown_wing');
check('the first valid candidate is accepted',
  (propose(sender(w1), { wing: 'd2', agentId: 'loki' }) as { accepted: boolean }).accepted === true);
check('the session names wing, window and agent',
  JSON.stringify(pState().proposal) ===
    JSON.stringify({ wing: 'd2', terminalId: 't1', agentId: 'loki' }));
check('a second window\'s candidate gets already_proposed',
  (propose(sender(w2), { wing: 'd3', agentId: 'cat' }) as { reason: string }).reason === 'already_proposed');

// --- bar 6: only the proposing window may apply or dismiss -----------------
check('apply from the OTHER window refused',
  (apply(sender(w2), { wing: 'd2' }) as { reason: string }).reason === 'not_owner');
check('apply for the WRONG wing refused',
  (apply(sender(w1), { wing: 'd3' }) as { reason: string }).reason === 'not_owner');
const foreignDismiss = dismiss(sender(w2));
check('dismiss from the other window is a no-op', foreignDismiss === true && pState().proposal !== null);

// --- bar 4: apply spawns adjacent + joined, nothing else moves -------------
const before = deskState().bounds.map((b) => JSON.stringify(b));
const applied = apply(sender(w1), { wing: 'd2' }) as { applied: boolean; terminalId?: string };
check('apply succeeds', applied.applied === true && applied.terminalId === 't3', JSON.stringify(applied));
check('the session cleared on apply', pState().proposal === null);
const after = deskState();
const t3 = after.bounds.find((b) => b.id === 't3');
// t1 at (60,160), t2 snapped flush at (700,160) — the chain end is t2, so
// the new window lands at t2.right = 1340, same y.
check('the new window abuts the chain END at the same y',
  t3?.x === 1340 && t3?.y === 160, JSON.stringify(t3));
check('the join is REAL (computeJoins reports t2|t3)',
  after.joins.some((j) => j.left === 't2' && j.right === 't3'), JSON.stringify(after.joins));
check('no pre-existing window moved',
  after.bounds.filter((b) => b.id !== 't3').map((b) => JSON.stringify(b)).join() === before.join());
const cfg = () =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf8')) as {
    terminals?: Array<{ id: string; wing: string }>;
    orchestration?: boolean;
  };
check('the applied terminal persisted like any other',
  cfg().terminals?.some((t) => t.id === 't3' && t.wing === 'd2') === true);
check('the session itself is NEVER persisted', !('proposal' in (cfg() as Record<string, unknown>)));

// --- bar 4: a wing opened by hand overnight → quiet no-op ------------------
check('a new night\'s candidate is accepted (apply cleared the slot)',
  (propose(sender(w1), { wing: 'd3', agentId: 'loki' }) as { accepted: boolean }).accepted === true);
handlers.get('terminal:debugSpawn')!(null); // the tray opens d3 by hand
check('the tray spawn took the proposed wing',
  deskState().bounds.some((b) => b.id === 't4'));
const stale = apply(sender(w1), { wing: 'd3' }) as { applied: boolean; reason?: string };
check('apply against a now-open wing is a quiet no-op',
  stale.applied === false && stale.reason === 'wing_open', JSON.stringify(stale));
check('…and the stale session cleared', pState().proposal === null);

// --- bar 6: dismiss clears -------------------------------------------------
check('one more candidate accepted',
  (propose(sender(w2), { wing: 'd4', agentId: 'cat' }) as { accepted: boolean }).accepted === true);
dismiss(sender(w2));
check('dismiss by the owner clears the session', pState().proposal === null);
check('after a dismiss the desk did not grow',
  deskState().bounds.length === 4, String(deskState().bounds.length));

report();
