/**
 * Preload script — runs in the renderer's context with Node access.
 * Attaches `window.electronAPI` so the frontend can detect "running in
 * Electron" and call into the main process for Steamworks operations.
 *
 * Scratch-rebuilt alongside main.ts. Wallpaper-mode + peek + multi-
 * monitor channels are gone — they belong with the deferred v1.x
 * wallpaper revisit (see legacy-desktop-v0.6/src/preload.ts for the
 * historical surface).
 *
 * Because main.ts sets `contextIsolation: false`, the direct assignment
 * to `window.electronAPI` works. If isolation is ever re-enabled, switch
 * to `contextBridge.exposeInMainWorld`.
 */

import { ipcRenderer, type IpcRendererEvent } from 'electron';

export type WallpaperMode = 'window' | 'wallpaper';

/** Phase 4 slice 4A + 5B — wallpaper throttle. Mirrors
 *  ThrottleState in desktop/src/wallpaper/throttle.ts. */
export type ThrottleState = 'full' | 'throttled-1hz' | 'paused' | 'sleeping';

export interface ThrottleChangeEvent {
  readonly state: ThrottleState;
  /** True for the initial state emitted right after start (or after
   *  exit-wallpaper resets to 'full'); false for poll-detected
   *  transitions. Renderer uses this to suppress one-time
   *  perception-broadcast side-effects on the boot emission. */
  readonly isInitial: boolean;
}

export interface ElectronAPI {
  /** Always true. Renderer checks for presence of window.electronAPI to
   *  switch on Electron-specific code paths (auth ticket, launch). */
  readonly isElectron: true;

  /** Local player's steamID64 as a decimal string, or null if Steamworks
   *  failed to init. */
  getSteamId(): Promise<string | null>;

  /** Whether the main process successfully initialised steamworks.js.
   *  False means Steamworks-dependent features should hide in the UI. */
  isSteamworksAvailable(): Promise<boolean>;

  /** Hex-encoded Steamworks AuthSessionTicket. Renderer POSTs this to
   *  /api/auth/steamticket on the worker, which mints the session
   *  cookie without going through OpenID. Null on failure. */
  getAuthTicket(): Promise<string | null>;

  /** Launch a Steam game via the OS protocol handler. Main process
   *  calls shell.openExternal('steam://run/<appid>') — the only safe
   *  way from Electron, since assigning window.location.href in the
   *  renderer navigates the window away. */
  launchGame(appid: number): Promise<boolean>;

  /** Absolute path to Electron's per-user app-data directory
   *  (`app.getPath('userData')`). Renderer-side memory bootstrap
   *  (Phase 2F) writes memory.sqlite + vaults/ underneath here. */
  getUserDataPath(): Promise<string>;

  /** Read the current wallpaper-mode state. Either 'window' (regular
   *  floating BrowserWindow) or 'wallpaper' (reparented behind the
   *  desktop, click-through, hidden from Alt-Tab). Used by the
   *  renderer to gate any mode-aware UI. */
  getWallpaperMode(): Promise<WallpaperMode>;

  /** Request a mode change. Main process performs the platform-
   *  specific reparent, persists the new mode, rebuilds the tray, and
   *  broadcasts via onWallpaperModeChanged. Tray menu drives the same
   *  path. */
  setWallpaperMode(mode: WallpaperMode): Promise<boolean>;

  /** Subscribe to mode changes coming from the main process (tray
   *  click, startup restore). Returns an unsubscribe function. */
  onWallpaperModeChanged(cb: (mode: WallpaperMode) => void): () => void;

  /** Read the current throttle state. Returns 'full' when not in
   *  wallpaper mode or the controller isn't running. Renderer calls
   *  this on mount to hydrate before the first poll fires. */
  getThrottleState(): Promise<ThrottleState>;

  /** Subscribe to throttle-state transitions. The initial state is
   *  emitted right after startThrottleController in main; later events
   *  fire on every detected change (default poll = 1000ms). Returns an
   *  unsubscribe function. */
  onThrottleChange(cb: (event: ThrottleChangeEvent) => void): () => void;

  /** Phase 4C — current peek state. False in window mode (peek is only
   *  meaningful when in wallpaper mode). Renderer reads this on mount
   *  to hydrate; subsequent transitions arrive via onPeekChanged. */
  getPeeking(): Promise<boolean>;

  /** Phase 4C — toggle peek. No-op when persisted mode is 'window'.
   *  Returns the new peeking state after the toggle (or the unchanged
   *  state if the call was a no-op). The global hotkey (Ctrl+Alt+L)
   *  and tray "Peek" / "Exit peek" items drive most state changes;
   *  the renderer rarely calls this directly. */
  togglePeek(): Promise<boolean>;

  /** Subscribe to peek-state transitions. Fires every time peeking
   *  flips, including the reset that happens when an explicit mode
   *  change wins over a transient peek. Returns an unsubscribe
   *  function. */
  onPeekChanged(cb: (peeking: boolean) => void): () => void;

  // --- T0 spike: snapping terminals (docs/PRD-snapping-terminals.md) ----
  // Present on every window but only live in terminals mode
  // (LOKILIBRARY_TERMINALS=N); the palace renderer never calls these.

  /** Current joins + terminalId→wing map, for hydration on terminal mount. */
  terminalGetTopology(): Promise<{ joins: TerminalJoin[]; wings: Record<string, string> }>;
  /** Topology changes from the main-process broker (snap/un-snap). */
  onTerminalTopology(cb: (event: { joins: TerminalJoin[]; wings: Record<string, string> }) => void): () => void;
  /** Register a freshly spawned being with the roster. False = the id is
   *  already live in another terminal; despawn the local copy. */
  terminalAgentSpawn(agentId: string, terminalId: string): Promise<boolean>;
  /** A being walked off an open edge, carrying its runtime state. True =
   *  the neighbour accepted it (despawn locally); false = refused. */
  terminalAgentExit(
    agentId: string,
    terminalId: string,
    side: 'left' | 'right',
    state: TerminalBeingState,
  ): Promise<boolean>;
  /** A being handed over by the broker arrives at `side`, with its
   *  carried state and the source terminal/wing. */
  onTerminalAgentEnter(
    cb: (event: {
      agentId: string;
      side: 'left' | 'right';
      state?: TerminalBeingState;
      from?: { terminalId: string; wing: string };
    }) => void,
  ): () => void;
  /** ≤1 Hz, change-gated near-edge report; the broker relays each joined
   *  side to that neighbour. Fire-and-forget — perception is advisory. */
  terminalReportNearEdge(
    terminalId: string,
    near: { left: TerminalNearEdgeBeing[]; right: TerminalNearEdgeBeing[] },
  ): void;
  /** The joined neighbour's near-edge beings, per side of THIS terminal. */
  onTerminalNeighbourSummary(
    cb: (event: { side: 'left' | 'right'; beings: TerminalNearEdgeBeing[] }) => void,
  ): () => void;
}

/** A live horizontal join between two terminals (broker-derived). */
export interface TerminalJoin {
  left: string;
  right: string;
}

/** Runtime state carried across a handoff so the being RESUMES in the
 *  neighbour rather than respawning fresh. Broker-opaque: the main
 *  process forwards it verbatim, renderers own the shape. */
export interface TerminalBeingState {
  speed: number;
  dir: 1 | -1;
  intent: string;
  bobPhase: number;
}

/** A being near a shared edge (cross-edge perception relay). */
export interface TerminalNearEdgeBeing {
  id: string;
  dist: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const api: ElectronAPI = {
  isElectron: true,
  getSteamId: () => ipcRenderer.invoke('steam:getSteamId') as Promise<string | null>,
  isSteamworksAvailable: () => ipcRenderer.invoke('steam:isAvailable') as Promise<boolean>,
  getAuthTicket: () => ipcRenderer.invoke('steam:getAuthTicket') as Promise<string | null>,
  launchGame: (appid: number) => ipcRenderer.invoke('steam:launchGame', appid) as Promise<boolean>,
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath') as Promise<string>,
  getWallpaperMode: () =>
    ipcRenderer.invoke('wallpaper:getMode') as Promise<WallpaperMode>,
  setWallpaperMode: (mode) =>
    ipcRenderer.invoke('wallpaper:setMode', mode) as Promise<boolean>,
  onWallpaperModeChanged: (cb) => {
    const handler = (_e: IpcRendererEvent, mode: WallpaperMode): void => cb(mode);
    ipcRenderer.on('wallpaper:modeChanged', handler);
    return () => ipcRenderer.off('wallpaper:modeChanged', handler);
  },
  getThrottleState: () =>
    ipcRenderer.invoke('throttle:getCurrent') as Promise<ThrottleState>,
  onThrottleChange: (cb) => {
    const handler = (_e: IpcRendererEvent, event: ThrottleChangeEvent): void => cb(event);
    ipcRenderer.on('throttle:state-change', handler);
    return () => ipcRenderer.off('throttle:state-change', handler);
  },
  getPeeking: () => ipcRenderer.invoke('wallpaper:getPeeking') as Promise<boolean>,
  togglePeek: () => ipcRenderer.invoke('wallpaper:togglePeek') as Promise<boolean>,
  onPeekChanged: (cb) => {
    const handler = (_e: IpcRendererEvent, peeking: boolean): void => cb(peeking);
    ipcRenderer.on('wallpaper:peekChanged', handler);
    return () => ipcRenderer.off('wallpaper:peekChanged', handler);
  },
  terminalGetTopology: () =>
    ipcRenderer.invoke('terminal:getTopology') as Promise<{ joins: TerminalJoin[]; wings: Record<string, string> }>,
  onTerminalTopology: (cb) => {
    const handler = (_e: IpcRendererEvent, event: { joins: TerminalJoin[]; wings: Record<string, string> }): void => cb(event);
    ipcRenderer.on('terminal:topology', handler);
    return () => ipcRenderer.off('terminal:topology', handler);
  },
  terminalAgentSpawn: (agentId, terminalId) =>
    ipcRenderer.invoke('terminal:agentSpawn', { agentId, terminalId }) as Promise<boolean>,
  terminalAgentExit: (agentId, terminalId, side, state) =>
    ipcRenderer.invoke('terminal:agentExit', { agentId, terminalId, side, state }) as Promise<boolean>,
  onTerminalAgentEnter: (cb) => {
    const handler = (
      _e: IpcRendererEvent,
      event: {
        agentId: string;
        side: 'left' | 'right';
        state?: TerminalBeingState;
        from?: { terminalId: string; wing: string };
      },
    ): void => cb(event);
    ipcRenderer.on('terminal:agentEnter', handler);
    return () => ipcRenderer.off('terminal:agentEnter', handler);
  },
  terminalReportNearEdge: (terminalId, near) => {
    ipcRenderer.send('terminal:nearEdge', { terminalId, near });
  },
  onTerminalNeighbourSummary: (cb) => {
    const handler = (
      _e: IpcRendererEvent,
      event: { side: 'left' | 'right'; beings: TerminalNearEdgeBeing[] },
    ): void => cb(event);
    ipcRenderer.on('terminal:neighbourSummary', handler);
    return () => ipcRenderer.off('terminal:neighbourSummary', handler);
  },
};

window.electronAPI = api;
