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

import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { getMode, getSociety, getTerminals, setMode, setSociety, setTerminals, type Mode } from './config';
import { enterWallpaper, exitWallpaper } from './wallpaper';
import { startThrottleController, stopThrottleController } from './wallpaper/throttle';
import { computeJoins, computeSnapTarget, neighbourOf, type Join, type TermBounds } from './topology';
import { broadcast, registerWindow } from './broadcast';

/** Peek hotkey label for the tray item. main.ts owns the registration (it
 *  binds the accelerator for both the palace and the desk). */
const PEEK_ACCELERATOR = 'CmdOrCtrl+Alt+L';

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

/** Cohort ids in COHORT order — literal mirror of src/agents/cohort.ts
 *  (desktop compiles separately; same convention as preload's
 *  TerminalBeingState mirror). */
const SOCIETY_IDS = ['loki', 'archivist', 'cat', 'visitor', 'ghost'];

/** agentId → home wing. Assigned at boot (saved society or round-robin
 *  over the desk's open wings), updated on every accepted crossing,
 *  persisted to config. Wings are the stable identity — terminal ids mint
 *  fresh every session. */
const homes = new Map<string, string>();

function assignHomes(saved: Record<string, string> | undefined, wings: readonly string[]): void {
  homes.clear();
  let rr = 0;
  for (const id of SOCIETY_IDS) {
    const w = saved?.[id];
    if (w && wings.includes(w)) homes.set(id, w);
    else homes.set(id, wings[rr++ % wings.length]);
  }
}

function persistSociety(): void {
  setSociety(Object.fromEntries(homes));
}

let joins: Join[] = [];
/** Guard: programmatic setBounds re-fires 'move'; don't re-broker those. */
let snapping = false;
/** App quit in progress — the per-window 'closed' cascade must not persist
 *  a shrinking desk (quitting a 3-terminal desk would otherwise save 0). */
let quitting = false;

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

/** Write the live desk {id, wing, bounds} to config (desk persistence). */
function persistTerminals(): void {
  setTerminals(
    [...terminals.values()]
      .filter((t) => !t.win.isDestroyed())
      .map((t) => {
        const b = t.win.getBounds();
        return { id: t.id, wing: t.wing, x: b.x, y: b.y, width: b.width, height: b.height };
      }),
  );
}

/** Same asset + sizing as main.ts's createTray — desktop/assets/tray-icon.png,
 *  resolved relative to desktop/dist. */
function trayIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(path.resolve(__dirname, '..', 'assets', 'tray-icon.png'));
  return icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
}

/** terminalId → wing, for renderers to derive a joined neighbour's seed. */
function wingsMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const t of terminals.values()) if (!t.win.isDestroyed()) m[t.id] = t.wing;
  return m;
}

/** Change gate for broadcastTopology: joins + the wings map (a spawn/close
 *  changes which wings are OPEN without changing any join, and the closed-
 *  wing skyline recomposes off that). */
let lastTopologyKey = '';

function broadcastTopology(): void {
  const next = computeJoins(allBounds());
  const key = JSON.stringify({ joins: next, wings: wingsMap() });
  if (key === lastTopologyKey) return;
  lastTopologyKey = key;
  joins = next;
  // eslint-disable-next-line no-console
  console.log(`[terminals] topology: ${joins.length ? joins.map((j) => `${j.left}+${j.right}`).join(' ') : '(none)'}`);
  for (const t of terminals.values()) {
    if (!t.win.isDestroyed())
      t.win.webContents.send('terminal:topology', { joins, wings: wingsMap(), allWings: WINGS });
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
  persistTerminals();
}

/** Returns the desk's handle for main.ts — currently just peek, which main.ts
 *  binds to the global accelerator (registered in BOTH branches now; it used
 *  to sit after the terminals early-return, so the desk never had it). */
export function startTerminalsMode(
  count: number,
  rendererUrl: string,
): { togglePeek: () => void } {
  const settleTimers = new Map<string, NodeJS.Timeout>();

  function spawnTerminal(id: string, wing: string, x: number, y: number): void {
    const win = new BrowserWindow({
      width: TERMINAL_W,
      height: TERMINAL_H,
      x,
      y,
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
    registerWindow(win); // throttle / mode / peek / attention fan-out
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
      if (!quitting) persistTerminals();
      rebuildTray(); // a close frees a wing — the menu label must refresh
    });

    terminals.set(id, { id, wing, win });
  }

  // ── Desk persistence: restore the set as it was left ────────────────────
  // LOKILIBRARY_TERMINALS still gates ENTERING terminals mode (main.ts);
  // once in, a persisted desk wins over the count — relaunch restores the
  // desk as you left it. LOKILIBRARY_TERMINALS_RESET=1 skips the restore
  // (the e2e/demo harness sets it for reproducible layouts).
  app.on('before-quit', () => {
    quitting = true;
  });
  const saved = process.env.LOKILIBRARY_TERMINALS_RESET ? undefined : getTerminals();
  const fromConfig: Array<{ id: string; wing: string; x: number; y: number }> = [];
  const seen = new Set<string>();
  for (const s of saved ?? []) {
    if (seen.has(s.id) || !WINGS.includes(s.wing)) continue; // hand-edited-config hygiene
    seen.add(s.id);
    fromConfig.push({ id: s.id, wing: s.wing, x: clampX(s.x), y: s.y });
  }
  const restored = fromConfig.length >= 2;
  let slots = fromConfig;
  if (!restored) {
    const n = Math.max(2, Math.min(count, WINGS.length));
    // Boot spread: fully apart when the chain fits the display; a clamped,
    // overlapping cascade when it doesn't (overlaps never join, so this only
    // changes where windows START — the user/e2e drags them into place).
    // Slight y-offsets so the demo IS the drag-together (snap aligns y).
    const wa = screen.getPrimaryDisplay().workArea;
    const spacing = Math.min(
      TERMINAL_W + 80,
      Math.max(40, Math.floor((wa.width - TERMINAL_W - 120) / Math.max(1, n - 1))),
    );
    slots = Array.from({ length: n }, (_, i) => ({
      id: `t${i + 1}`,
      wing: WINGS[i],
      x: clampX(60 + i * spacing),
      y: 160 + i * 36,
    }));
  }
  // eslint-disable-next-line no-console
  console.log(`[terminals] ${restored ? 'restoring desk' : 'spawning defaults'} — ${slots.length} terminal windows`);
  for (const s of slots) spawnTerminal(s.id, s.wing, s.x, s.y);
  assignHomes(
    process.env.LOKILIBRARY_TERMINALS_RESET ? undefined : getSociety(),
    slots.map((s) => s.wing),
  );
  persistSociety();
  broadcastTopology(); // a restored desk can boot already-joined
  persistTerminals();

  // ── Wallpaper mode, desk-wide ───────────────────────────────────────────
  // The DESK is the unit, not the window: one mode for all N terminals. A
  // per-window mode is a promise peek cannot keep (peek is one boolean, so a
  // desk with two wallpapered terminals and one windowed one has no defined
  // peek), so config.mode stays the single app-wide scalar it already is.
  //
  // Terminals enter with bounds:'keep' — their snapped 640x520 IS the
  // arrangement, and covering the display would destroy the very thing being
  // made ambient. Nothing re-snaps on the way in or out, because nothing
  // moved: joins are bounds-pure, so they are invariant across the
  // round-trip (smoke-desk-wallpaper asserts exactly that).
  let deskMode: Mode = 'window';

  function displayFor(win: BrowserWindow): Electron.Display {
    return screen.getDisplayMatching(win.getBounds());
  }

  function enterAll(): void {
    for (const t of terminals.values()) {
      if (!t.win.isDestroyed()) {
        enterWallpaper(t.win, displayFor(t.win), { bounds: 'keep', clickThrough: true });
      }
    }
  }

  function exitAll(): void {
    for (const t of terminals.values()) {
      if (!t.win.isDestroyed()) exitWallpaper(t.win);
    }
  }

  /** Peek: the desk's ONLY interaction path while wallpapered.
   *
   *  SPIKE-A (2026-08-06) settled that this is not a choice. At the desktop
   *  level — and even one level ABOVE the desktop icons, with click-through
   *  off and the activation policy left alone — the WindowServer routes no
   *  mouse events to the window at all: a real CGEvent click on a site did
   *  nothing, and a real CGEvent drag left bounds byte-identical. So a
   *  wallpapered desk is ambience, and peek is how you reach it.
   *
   *  Desk-wide by construction: all N lift together, arrangement preserved,
   *  and everything (drag, snap, joins, crossings, the launcher) works
   *  exactly as it does in window mode until the desk drops back. */
  let deskPeeking = false;

  function toggleDeskPeek(): void {
    if (deskMode !== 'wallpaper') {
      // eslint-disable-next-line no-console
      console.log('[peek] ignored — only meaningful in wallpaper mode');
      return;
    }
    deskPeeking = !deskPeeking;
    if (deskPeeking) {
      // Stop the controller first so its watchdog can't race the transition
      // (the palace's togglePeek does the same, for the same reason).
      stopThrottleController();
      broadcast('throttle:state-change', { state: 'full', isInitial: true });
      exitAll();
      for (const t of terminals.values()) {
        if (!t.win.isDestroyed()) t.win.setAlwaysOnTop(true);
      }
      // ONE app-level focus, then the FIRST window only. Focusing N windows
      // in a loop fights the WindowServer and ends with an arbitrary winner.
      app.focus({ steal: true });
      const first = [...terminals.values()].find((t) => !t.win.isDestroyed());
      first?.win.focus();
      // A peek is a deliberate "I am here and looking at the desk" — better
      // evidence of return than a stray mousemove, and in wallpaper mode the
      // pointer/focus paths are dead, so this is how an away being comes
      // back. Peek-OFF is you leaving, so it does not fire.
      broadcast('desk:attention');
    } else {
      for (const t of terminals.values()) {
        if (!t.win.isDestroyed()) t.win.setAlwaysOnTop(false);
      }
      // Re-enter at whatever bounds each window NOW has, so a drag made
      // during peek is preserved. No re-snap: settle() already ran on the
      // drag, and re-running it here could pull together windows the user
      // deliberately left apart.
      enterAll();
      startThrottleController(null, {
        display: screen.getPrimaryDisplay(),
        onStateChange: (state, isInitial) => {
          broadcast('throttle:state-change', { state, isInitial });
        },
      });
    }
    rebuildTray();
    broadcast('wallpaper:peekChanged', deskPeeking);
    // eslint-disable-next-line no-console
    console.log(`[peek] desk peek ${deskPeeking ? 'on' : 'off'} (${terminals.size} windows)`);
  }

  function applyDeskMode(mode: Mode): void {
    if (mode === deskMode) return; // the tray checkbox auto-fire guard
    // A mode change wins over peek (palace parity, main.ts:268-272): clear it
    // first, or a peeked desk would carry alwaysOnTop into window mode.
    if (deskPeeking) {
      deskPeeking = false;
      for (const t of terminals.values()) {
        if (!t.win.isDestroyed()) t.win.setAlwaysOnTop(false);
      }
      broadcast('wallpaper:peekChanged', false);
    }
    deskMode = mode;
    if (mode === 'wallpaper') {
      enterAll();
      // ONE controller for the whole desk: the macOS idle ladder ignores the
      // window argument entirely, so there is nothing per-window to own.
      startThrottleController(null, {
        display: screen.getPrimaryDisplay(),
        onStateChange: (state, isInitial) => {
          broadcast('throttle:state-change', { state, isInitial });
        },
      });
    } else {
      stopThrottleController();
      broadcast('throttle:state-change', { state: 'full', isInitial: true });
      exitAll();
    }
    setMode(mode);
    rebuildTray();
    broadcast('wallpaper:modeChanged', mode);
    // eslint-disable-next-line no-console
    console.log(`[terminals] desk mode → ${mode} (${terminals.size} windows)`);
  }

  // ── Tray: "New terminal" onto the next unused wing ──────────────────────
  // Terminals mode never reaches main.ts's createTray() (the early return),
  // so this is the mode's only tray.
  let tray: Tray | null = null;
  let nextIndex =
    1 + [...terminals.keys()].reduce((m, id) => Math.max(m, Number(/^t(\d+)$/.exec(id)?.[1] ?? '0')), 0);

  function nextWing(): string | undefined {
    const used = new Set([...terminals.values()].map((t) => t.wing));
    return WINGS.find((w) => !used.has(w));
  }

  function spawnNext(): string | null {
    const wing = nextWing();
    if (!wing) return null;
    const id = `t${nextIndex++}`;
    const i = terminals.size;
    spawnTerminal(id, wing, clampX(60 + i * (TERMINAL_W + 80)), 160 + i * 36);
    broadcastTopology(); // the opened wing leaves every sibling's skyline
    persistTerminals();
    rebuildTray();
    return id;
  }

  function rebuildTray(): void {
    if (!tray) return;
    const wing = nextWing();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: wing ? `New terminal (${wing})` : 'New terminal — all wings open',
          enabled: wing !== undefined,
          click: () => void spawnNext(),
        },
        { type: 'separator' },
        // CHECKBOX, not radio: main.ts:161-172 records the v0.6 hazard where
        // a radio group fires its own click on rebuild. applyDeskMode's
        // same-mode guard is the second belt.
        {
          label: 'Window mode',
          type: 'checkbox',
          checked: deskMode === 'window',
          click: () => applyDeskMode('window'),
        },
        {
          label: 'Wallpaper mode',
          type: 'checkbox',
          checked: deskMode === 'wallpaper',
          click: () => applyDeskMode('wallpaper'),
        },
        // Peek is the interaction path while wallpapered, so the tray item is
        // not a convenience — it is the recovery route if the accelerator is
        // taken by another app (globalShortcut.register can return false).
        ...(deskMode === 'wallpaper'
          ? [
              {
                label: deskPeeking ? 'Exit peek' : `Peek (${PEEK_ACCELERATOR})`,
                click: () => toggleDeskPeek(),
              } as MenuItemConstructorOptions,
            ]
          : []),
        // No Display submenu, deliberately: for a desk of individually
        // positioned windows, picking a display means MOVING N windows to
        // another monitor — an arrangement change, and adjacent to the PRD's
        // "agents never move the user's windows".
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]),
    );
  }

  tray = new Tray(trayIcon());
  tray.setToolTip('lokilibrary — terminals');
  rebuildTray();

  // Restore the persisted mode. Deferred to ready-to-show for the same
  // reason main.ts defers it: entering before the first paint gives the
  // desktop a window that has never drawn.
  if (getMode() === 'wallpaper') {
    let pending = terminals.size;
    for (const t of terminals.values()) {
      t.win.once('ready-to-show', () => {
        if (--pending === 0) {
          deskMode = 'window'; // so applyDeskMode's guard doesn't short-circuit
          applyDeskMode('wallpaper');
        }
      });
    }
  }

  // Blocker 11: the desk tray is a closure local, so main.ts's
  // window-all-closed (which destroys ITS tray) never sees it.
  app.on('before-quit', () => {
    stopThrottleController();
    tray?.destroy();
    tray = null;
  });

  // --- IPC: renderer ↔ broker ---------------------------------------------

  // Hydration: a terminal renderer asks for the current joins on mount.
  ipcMain.handle('terminal:getTopology', () => ({ joins, wings: wingsMap(), allWings: WINGS }));

  // Society hydration: which cohort member lives on which wing.
  ipcMain.handle('terminal:getSociety', () => Object.fromEntries(homes));

  // T4: who is WHERE right now (agentId → terminalId), for the topology line a
  // Tier-2 reflection reads. Deliberately a PULL, not a field on the
  // `terminal:topology` broadcast — that broadcast is change-gated on
  // {joins, wings} to stay bounded, and the roster moves on every crossing.
  // Reflections are rare (≤ 1 per agent per real hour), so pulling on demand
  // costs nothing and leaves the hot path alone.
  ipcMain.handle('terminal:getRoster', () => Object.fromEntries(roster));

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
      // Society members re-home on a crossing (unknown/native ids don't).
      if (homes.has(payload.agentId)) {
        homes.set(payload.agentId, destTerm.wing);
        persistSociety();
      }
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
    society: Object.fromEntries(homes),
  }));

  ipcMain.handle('terminal:debugMove', (_e, payload: { terminalId: string; x: number; y: number }) => {
    const t = terminals.get(payload.terminalId);
    if (!t || t.win.isDestroyed()) return false;
    t.win.setBounds({ x: payload.x, y: payload.y, width: TERMINAL_W, height: TERMINAL_H });
    settle(payload.terminalId);
    return true;
  });

  // Tray parity for the harness: the exact spawn path the tray item drives.
  ipcMain.handle('terminal:debugSpawn', () => spawnNext());

  // Tray parity for the harness: the exact mode path the tray items drive.
  // Also the e2e escape hatch — a wallpapered desk is click-through, so
  // without this the tray is the ONLY way back and a headless run could
  // strand itself behind the desktop.
  ipcMain.handle('terminal:debugSetMode', (_e, mode: Mode) => {
    applyDeskMode(mode);
    return deskMode;
  });
  ipcMain.handle('terminal:debugTogglePeek', () => {
    toggleDeskPeek();
    return deskPeeking;
  });
  ipcMain.handle('terminal:debugDeskState', () => ({
    mode: deskMode,
    peeking: deskPeeking,
    windows: [...terminals.values()].map((t) => ({
      id: t.id,
      bounds: t.win.isDestroyed() ? null : t.win.getBounds(),
      alwaysOnTop: t.win.isDestroyed() ? null : t.win.isAlwaysOnTop(),
    })),
    joins: joins.map((j) => `${j.left}|${j.right}`),
  }));

  return { togglePeek: toggleDeskPeek };
}
