/**
 * T2 society smoke — `npx tsx scripts/smoke-t2-broker-homes.mts`.
 * Boots the REAL main-process broker (desktop/src/terminals.ts) against a
 * pre-written config that already has a saved society (including one dead
 * wing) and asserts:
 *   - saved homes are honored for wings still open on the restored desk
 *   - a dead wing (no matching terminal) falls back to round-robin
 *
 * Lives in its own process rather than a second boot appended to
 * scripts/smoke-t1-broker-handoff.mts: desktop/src/terminals.ts keeps
 * module-level state (terminals/roster/homes maps) that a second
 * startTerminalsMode() call against the SAME imported module instance
 * would leak into. A fresh process gives a fresh module registry for free.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

const { check, report } = makeChecker('smoke t2-broker-homes');

// Restore-from-config is the whole point of this smoke; don't let a stray
// env var from a manual verification run silently disable it.
delete process.env.LOKILIBRARY_TERMINALS_RESET;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-broker-homes-'));

// Saved homes are honored; a dead wing falls back to round-robin.
fs.writeFileSync(
  path.join(tmpDir, 'config.json'),
  JSON.stringify({
    mode: 'window',
    terminals: [
      { id: 't1', wing: 'd0', x: 60, y: 160, width: 640, height: 520 },
      { id: 't2', wing: 'd1', x: 720, y: 160, width: 640, height: 520 },
    ],
    society: { loki: 'd1', archivist: 'd0', cat: 'd9', visitor: 'd1', ghost: 'd0' },
  }),
);

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
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 2560, height: 1440 } }) },
  app: {
    getPath: () => tmpDir,
    on: () => {},
  },
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({}) },
  Tray: class {
    setToolTip(): void {}
    setContextMenu(): void {}
  },
});

const { startTerminalsMode } = await import('../desktop/src/terminals.ts');
startTerminalsMode(2, 'http://localhost:5183');

check('two windows restored', FakeBrowserWindow.all.length === 2);

const society2 = handlers.get('terminal:getSociety')!(null) as Record<string, string>;
check('saved home honored', society2.loki === 'd1' && society2.archivist === 'd0');
check('dead wing d9 falls back to round-robin', society2.cat === 'd0' || society2.cat === 'd1');

report();
