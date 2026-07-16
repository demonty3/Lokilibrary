/**
 * T0 spike — snapping-terminals mode (docs/PRD-snapping-terminals.md).
 *
 * `LOKILIBRARY_TERMINALS=N` (N ≥ 2) boots N terminal windows instead of the
 * single palace window. Each is a fixed-size BrowserWindow loading the
 * renderer in terminal mode (`?terminal=tN&wing=dK`), showing one wing as a
 * side-on land. This module is the main-process TOPOLOGY BROKER:
 *
 *   - tracks window bounds ('move'/'moved' events, debounced to settle)
 *   - magnetically snaps a settled window to a neighbour's edge
 *     (computeSnapTarget) and re-derives the live joins (computeJoins)
 *   - broadcasts `terminal:topology` {joins} to every terminal so renderers
 *     open/close their edges
 *   - brokers being handoffs: `terminal:agentExit` from one renderer becomes
 *     `terminal:agentEnter` in the joined neighbour, guarded by a roster map
 *     (an agent lives in exactly ONE terminal — the 7D.2 single-roaming-
 *     roster invariant, ported across process boundaries)
 *
 * Deliberately AVOIDS the mainWindow/peek/throttle singletons (the T1
 * registry refactor owns those) — terminals mode is window-mode only and
 * spike-scoped. Debug IPC (`terminal:debugMove` / `terminal:debugState`)
 * exists so the e2e harness can drive window positions and assert
 * joins/crossings without a human dragging.
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { computeJoins, computeSnapTarget, neighbourOf, type Join, type TermBounds } from './topology';

// Sized so two terminals tile side-by-side on a 1440-wide display with
// margin — a half-offscreen window invites macOS to shuffle its neighbours,
// which fights the broker.
const TERMINAL_W = 640;
const TERMINAL_H = 520;
/** Settle debounce for live 'move' events (macOS streams them mid-drag). */
const SETTLE_MS = 140;
const WINGS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];

interface Terminal {
  id: string;
  wing: string;
  win: BrowserWindow;
}

const terminals = new Map<string, Terminal>();
/** agentId → terminalId. The single-roaming-roster authority. */
const roster = new Map<string, string>();
let joins: Join[] = [];
/** Guard: programmatic setBounds re-fires 'move'; don't re-broker those. */
let snapping = false;

function boundsOf(t: Terminal): TermBounds {
  const b = t.win.getBounds();
  return { id: t.id, x: b.x, y: b.y, width: b.width, height: b.height };
}

function allBounds(): TermBounds[] {
  return [...terminals.values()].filter((t) => !t.win.isDestroyed()).map(boundsOf);
}

/** Keep a spawn x on the primary work area — macOS shuffles fully-offscreen
 *  windows unpredictably (a 3×640 chain outgrows a 1440-wide desk), which
 *  fights the broker. */
function clampX(x: number): number {
  const wa = screen.getPrimaryDisplay().workArea;
  return Math.max(wa.x, Math.min(x, wa.x + wa.width - TERMINAL_W));
}

/** terminalId → wing, for renderers to derive a joined neighbour's seed. */
function wingsMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const t of terminals.values()) if (!t.win.isDestroyed()) m[t.id] = t.wing;
  return m;
}

function broadcastTopology(): void {
  const next = computeJoins(allBounds());
  if (JSON.stringify(next) === JSON.stringify(joins)) return;
  joins = next;
  // eslint-disable-next-line no-console
  console.log(`[terminals] topology: ${joins.length ? joins.map((j) => `${j.left}+${j.right}`).join(' ') : '(none)'}`);
  for (const t of terminals.values()) {
    if (!t.win.isDestroyed()) t.win.webContents.send('terminal:topology', { joins, wings: wingsMap() });
  }
}

/** Snap the settled window if a neighbour is in magnetic range, then
 *  re-derive joins either way. */
function settle(id: string): void {
  const t = terminals.get(id);
  if (!t || t.win.isDestroyed()) return;
  const moved = boundsOf(t);
  const others = allBounds().filter((b) => b.id !== id);
  const target = computeSnapTarget(moved, others);
  if (target && (target.x !== moved.x || target.y !== moved.y)) {
    snapping = true;
    t.win.setBounds({ x: target.x, y: target.y, width: TERMINAL_W, height: TERMINAL_H });
    snapping = false;
  }
  broadcastTopology();
}

export function startTerminalsMode(count: number, rendererUrl: string): void {
  const n = Math.max(2, Math.min(count, WINGS.length));
  // Boot spread: fully apart when the chain fits the display; a clamped,
  // overlapping cascade when it doesn't (overlaps never join, so this only
  // changes where windows START — the user/e2e drags them into place).
  const wa = screen.getPrimaryDisplay().workArea;
  const spacing = Math.min(
    TERMINAL_W + 80,
    Math.max(40, Math.floor((wa.width - TERMINAL_W - 120) / Math.max(1, n - 1))),
  );
  // eslint-disable-next-line no-console
  console.log(`[terminals] T0 spike — spawning ${n} terminal windows`);

  const settleTimers = new Map<string, NodeJS.Timeout>();

  for (let i = 0; i < n; i++) {
    const id = `t${i + 1}`;
    const wing = WINGS[i];
    const win = new BrowserWindow({
      width: TERMINAL_W,
      height: TERMINAL_H,
      // Apart + slightly y-offset so the demo IS the drag-together (snap
      // aligns y). Fixed size keeps ground rows comparable across windows.
      x: clampX(60 + i * spacing),
      y: 160 + i * 36,
      resizable: false,
      backgroundColor: '#0a0a0a',
      show: false,
      frame: false, // frameless: the ground continues across the join, no title bar gap
      hasShadow: false, // a neighbour's shadow would draw a false seam line
      roundedCorners: false, // square corners so abutting edges meet pixel-flush
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: false,
        nodeIntegration: true,
      },
    });
    win.once('ready-to-show', () => win.show());
    const sep = rendererUrl.includes('?') ? '&' : '?';
    void win.loadURL(`${rendererUrl}${sep}terminal=${id}&wing=${wing}`);
    win.webContents.on('will-navigate', (e, target) => {
      if (target !== win.webContents.getURL()) e.preventDefault();
    });

    const onMove = (): void => {
      if (snapping) return;
      const prev = settleTimers.get(id);
      if (prev) clearTimeout(prev);
      settleTimers.set(id, setTimeout(() => settle(id), SETTLE_MS));
    };
    win.on('move', onMove);
    win.on('closed', () => {
      terminals.delete(id);
      for (const [agent, where] of roster) if (where === id) roster.delete(agent);
      broadcastTopology();
    });

    terminals.set(id, { id, wing, win });
  }

  // --- IPC: renderer ↔ broker ---------------------------------------------

  // Hydration: a terminal renderer asks for the current joins on mount.
  ipcMain.handle('terminal:getTopology', () => ({ joins, wings: wingsMap() }));

  // Roster registration at spawn. First writer wins — a duplicate spawn of
  // a live agent id is refused (the renderer despawns its copy).
  ipcMain.handle('terminal:agentSpawn', (_e, payload: { agentId: string; terminalId: string }) => {
    if (roster.has(payload.agentId)) return roster.get(payload.agentId) === payload.terminalId;
    roster.set(payload.agentId, payload.terminalId);
    return true;
  });

  // A being walked off an open edge. Validate the join + ownership, move it
  // in the roster, and hand it to the neighbour WITH its runtime state
  // (forwarded opaquely — renderers own the shape) and the source wing (the
  // arrival side's memory write names it). Ack=false → renderer keeps the
  // being (turn it around) rather than losing it.
  ipcMain.handle(
    'terminal:agentExit',
    (
      _e,
      payload: {
        agentId: string;
        terminalId: string;
        side: 'left' | 'right';
        state?: unknown;
      },
    ) => {
      const dest = neighbourOf(payload.terminalId, payload.side, joins);
      if (!dest || roster.get(payload.agentId) !== payload.terminalId) return false;
      const destTerm = terminals.get(dest);
      if (!destTerm || destTerm.win.isDestroyed()) return false;
      const src = terminals.get(payload.terminalId);
      roster.set(payload.agentId, dest);
      destTerm.win.webContents.send('terminal:agentEnter', {
        agentId: payload.agentId,
        side: payload.side === 'left' ? 'right' : 'left', // enters the opposite edge
        state: payload.state,
        from: { terminalId: payload.terminalId, wing: src?.wing ?? '' },
      });
      // eslint-disable-next-line no-console
      console.log(`[terminals] ${payload.agentId}: ${payload.terminalId} → ${dest}`);
      return true;
    },
  );

  // Cross-edge perception: renderers report near-edge beings on a slow
  // cadence (≤1 Hz, change-gated renderer-side); relay each side that faces
  // a live join to that neighbour with the side flipped to ITS view of the
  // shared edge. Fire-and-forget (ipcMain.on, not handle) — advisory only.
  ipcMain.on(
    'terminal:nearEdge',
    (
      _e,
      payload: {
        terminalId: string;
        near: { left: unknown[]; right: unknown[] };
      },
    ) => {
      for (const side of ['left', 'right'] as const) {
        const dest = neighbourOf(payload.terminalId, side, joins);
        if (!dest) continue;
        const destTerm = terminals.get(dest);
        if (!destTerm || destTerm.win.isDestroyed()) continue;
        destTerm.win.webContents.send('terminal:neighbourSummary', {
          side: side === 'left' ? 'right' : 'left',
          beings: payload.near[side],
        });
      }
    },
  );

  // --- Debug IPC (e2e harness drives windows + reads ground truth) --------

  ipcMain.handle('terminal:debugState', () => ({
    bounds: allBounds(),
    joins,
    roster: Object.fromEntries(roster),
  }));

  ipcMain.handle('terminal:debugMove', (_e, payload: { terminalId: string; x: number; y: number }) => {
    const t = terminals.get(payload.terminalId);
    if (!t || t.win.isDestroyed()) return false;
    t.win.setBounds({ x: payload.x, y: payload.y, width: TERMINAL_W, height: TERMINAL_H });
    settle(payload.terminalId);
    return true;
  });
}
