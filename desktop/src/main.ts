/**
 * Main process for the lokilibrary desktop wrapper.
 *
 * Scratch-rebuilt after the v0.6 inherited wrapper was archived to
 * legacy-desktop-v0.6/. Wallpaper-mode reparenting was restored in the
 * claude/wallpaper-revival branch using Lively's Win11 22H2+ Progman-
 * reparent technique (see src/wallpaper/windows.ts). Peek hotkey and
 * multi-monitor picker remain out of scope for this revival.
 *
 * What this file does:
 *   - Open an Electron BrowserWindow pointed at the renderer
 *   - Initialise steamworks.js (Steam overlay + auth ticket source)
 *   - Expose IPC for getSteamId / isAvailable / getAuthTicket /
 *     launchGame / wallpaper:getMode / wallpaper:setMode
 *   - System tray with Window/Wallpaper mode toggle + Quit
 *   - Restore the persisted wallpaper mode on startup
 *
 * What this file does NOT do (intentionally):
 *   - Hotkey peek
 *   - Multi-monitor picker
 */

import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'node:path';
import { enterWallpaper, exitWallpaper } from './wallpaper';
import { getDisplayId, getMode, setDisplayId, setMode, type Mode } from './config';
import {
  getCurrentThrottleState,
  startThrottleController,
  stopThrottleController,
  type ThrottleState,
} from './wallpaper/throttle';
import { resolveTargetDisplay, buildDisplaySubmenu } from './display-picker';

// steamworks.js types aren't perfectly matched to our usage so we import as
// `any` at the require boundary and contain the looseness here.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const steamworks: any = require('steamworks.js');

/** SpaceWar — Valve's public dev test appid. Swap for our real appid once
 *  the Steamworks partner application is approved. */
const DEFAULT_APP_ID = 480;

interface SteamworksClient {
  localplayer: { getSteamId: () => { steamId64: bigint; accountId: number } };
  auth?: {
    getAuthTicketForWebApi?: (
      identity: string,
      timeoutSeconds?: number | null,
    ) => Promise<{ getBytes: () => Buffer | Uint8Array }>;
  };
}

/** Shared between this file's getAuthTicket IPC and the worker's
 *  verifyAuthSessionTicket call. Both ends must use the same identity
 *  string or Steam rejects the ticket as cross-identity. */
const WEB_API_IDENTITY = 'lokilibrary';

let steamClient: SteamworksClient | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/** Phase 4C — "peek" is a transient overlay state on top of wallpaper
 *  mode. The user hits the global hotkey to lift the wallpaper into a
 *  foreground interactive window without changing the persisted mode.
 *  Reset when applyMode() runs (real mode change always wins over a
 *  transient peek). Not stored in config — peek does not survive
 *  restart by design. */
let peeking = false;

/** Phase 4C — peek accelerator. CmdOrCtrl+Alt+L: Ctrl+Alt+L on Win/Linux,
 *  Cmd+Alt+L on macOS. Three-key chord makes collisions with game
 *  bindings + system shortcuts unlikely. Configurable later if needed
 *  (tray pref, settings file). */
const PEEK_ACCELERATOR = 'CmdOrCtrl+Alt+L';

// Forward-declared because applyMode references mainWindow + tray (above)
// and rebuildTrayMenu references applyMode (below). Hoisted function decls
// would let us order this however; we use function-decl-then-mutate-state
// for symmetry with the existing initSteam / createWindow pattern.

function initSteam(): void {
  const appId = Number(process.env.LOKILIBRARY_STEAM_APPID) || DEFAULT_APP_ID;
  try {
    steamClient = steamworks.init(appId);
    const id = steamClient?.localplayer.getSteamId();
    if (id) {
      // eslint-disable-next-line no-console
      console.log(`[steamworks] init OK — steamid ${id.steamId64.toString()}`);
    }
  } catch (e) {
    // Most common cause: Steam isn't running, or SDK redistributables
    // aren't in the expected path. Log and continue — the renderer can
    // still load; Steamworks-gated features just stay disabled.
    // eslint-disable-next-line no-console
    console.warn('[steamworks] init failed:', (e as Error).message);
    steamClient = null;
  }
}

function rendererUrl(): string {
  const override = process.env.LOKILIBRARY_RENDERER_URL;
  if (override) return override;
  // __dirname after tsc is desktop/dist; bundled web build sits at repo
  // root /dist/. Two levels up + into dist/index.html.
  const bundled = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
  return `file://${bundled}`;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#15121d',
    show: false, // unhide after ready-to-show to avoid white flash
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // steamworks.js requires nodeIntegration + contextIsolation: false.
      // Discipline cost: do not load untrusted remote content into this
      // window — external links go through shell.openExternal.
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  void win.loadURL(rendererUrl());
  mainWindow = win;

  // Phase 5C.2b — drag-drop safety. With contextIsolation:false +
  // nodeIntegration:true, a file dropped ANYWHERE in the window (outside
  // the lore drop-zone) makes Chromium try to navigate to / open that
  // file as a page, killing the renderer. The lore drop-zone calls
  // preventDefault on its own dragover/drop; this is the backstop for a
  // stray miss. We only ever load the dev-server / built index URL —
  // block every other navigation.
  win.webContents.on('will-navigate', (e, target) => {
    if (target !== win.webContents.getURL()) e.preventDefault();
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

function createTray(): Tray {
  // Compiled main.js sits at desktop/dist/main.js; the asset is at
  // desktop/assets/tray-icon.png. Two levels up.
  const iconPath = path.resolve(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const sized = icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
  const t = new Tray(sized);
  t.setToolTip('lokilibrary');
  rebuildTrayMenu(t);
  return t;
}

function rebuildTrayMenu(t: Tray): void {
  const current = getMode();
  // 'checkbox' rather than 'radio' on purpose: per v0.6 retro, Electron
  // radio menu items auto-fire their click handlers when setContextMenu
  // rebuilds on Win11 (well-known issue). The applyMode no-op guard below
  // catches any stray auto-fire either way; checkbox just makes the menu
  // less weird-looking when both items happen to be unchecked momentarily.
  //
  // Phase 4B: the Display submenu uses radio (not checkbox) because the
  // chosen display IS a single-select set — the auto-fire risk is real
  // but acceptable: applyDisplay no-ops when the picked id matches the
  // persisted id, same guard pattern as applyMode.
  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Window mode',
      type: 'checkbox',
      checked: current === 'window',
      click: () => applyMode('window'),
    },
    {
      label: 'Wallpaper mode',
      type: 'checkbox',
      checked: current === 'wallpaper',
      click: () => applyMode('wallpaper'),
    },
    {
      label: 'Display',
      submenu: buildDisplaySubmenu(
        screen.getAllDisplays(),
        screen.getPrimaryDisplay().id,
        getDisplayId(),
        (id) => applyDisplay(id),
      ),
    },
    // Phase 4C — only show the peek item in wallpaper mode (it's a
    // no-op in window mode). Label flips between "Peek" and "Exit
    // peek" based on current state so the user always sees the
    // action, not the state.
    ...(current === 'wallpaper'
      ? [{
          label: peeking ? 'Exit peek' : `Peek (${PEEK_ACCELERATOR})`,
          click: () => togglePeek(),
        }]
      : []),
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ];
  t.setContextMenu(Menu.buildFromTemplate(items));
}

/** Resolve the wallpaper's target display from current state. Bridges
 *  the pure helper in `display-picker.ts` to Electron's real `screen`
 *  API. Falls back to primary when no id is persisted or the persisted
 *  id no longer matches a connected monitor. */
function resolveDisplay(): Electron.Display {
  return resolveTargetDisplay(
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
    getDisplayId(),
  );
}

/** Phase 4B — pin the wallpaper to a specific monitor (or clear back
 *  to primary with `undefined`). Persists immediately so the choice
 *  survives restart; only triggers a re-enter when actually in
 *  wallpaper mode. In window mode the id is still saved and honored
 *  on the next wallpaper toggle. */
function applyDisplay(displayId: number | undefined): void {
  if (getDisplayId() === displayId) return; // tray auto-fire guard
  setDisplayId(displayId);
  if (tray) rebuildTrayMenu(tray);
  if (!mainWindow) return;
  if (getMode() !== 'wallpaper') return;
  // Re-enter to pick up the new bounds. exit-then-enter is heavier
  // than a bare setBounds(), but it also re-runs the SetParent + style
  // flips, which is the right reset if the display hot-plug situation
  // changed under us. The throttle controller is stopped + restarted
  // so its cached wallpaperHwnd + chosen-display monitorRect stay in
  // sync.
  exitWallpaper(mainWindow);
  stopThrottleController();
  const display = resolveDisplay();
  enterWallpaper(mainWindow, display);
  startThrottleController(mainWindow, {
    display,
    onStateChange: (state, isInitial) => emitThrottleChange(state, isInitial),
  });
}

/** Apply a mode transition. Persists the chosen mode so the next launch
 *  starts in the same state, rebuilds the tray so checkmarks stay in sync,
 *  and broadcasts to the renderer in case it has mode-gated UI. */
function applyMode(mode: Mode): void {
  if (!mainWindow) return;
  // Electron menu items can fire their click handlers when setContextMenu
  // rebuilds; without this guard a wallpaper-mode rebuild would re-fire
  // applyMode('wallpaper'), which would then re-enterWallpaper (mostly
  // idempotent but wasteful) and re-rebuild the menu, etc. Real user
  // clicks always represent a real transition because the *other* mode
  // is what they're picking.
  if (getMode() === mode) return;

  // Phase 4C — explicit mode change always wins over a transient peek.
  // Clear the flag + drop alwaysOnTop BEFORE the new mode is applied so
  // we don't leave the window pinned above other apps after the user
  // toggles back to wallpaper from peek. notifyPeek() broadcasts the
  // reset so any renderer-side UI hint dismisses.
  if (peeking) {
    peeking = false;
    mainWindow.setAlwaysOnTop(false);
    notifyPeek();
  }

  if (mode === 'wallpaper') {
    const display = resolveDisplay();
    enterWallpaper(mainWindow, display);
    startThrottleController(mainWindow, {
      display,
      onStateChange: (state, isInitial) => emitThrottleChange(state, isInitial),
    });
  } else {
    exitWallpaper(mainWindow);
    // Stop polling first, THEN emit the synthetic 'full' so the renderer
    // ticker comes back up immediately. The controller resets its own
    // current-state to 'full' on stop; emitting here re-syncs the
    // renderer in case it was mid-PAUSED when the user toggled out.
    stopThrottleController();
    emitThrottleChange('full', true);
  }
  setMode(mode);
  if (tray) rebuildTrayMenu(tray);
  try {
    mainWindow.webContents.send('wallpaper:modeChanged', mode);
  } catch {
    // webContents may not be ready on early startup; the renderer can
    // poll getWallpaperMode() on mount as a backstop.
  }
}

/** Phase 4C — toggle "peek" state. When peeking on, fully exit
 *  wallpaper mode (unparent from Progman, restore window styles) and
 *  pin alwaysOnTop so the wallpaper sits above other apps as a normal
 *  interactive window. When toggling off, drop alwaysOnTop and
 *  re-enter wallpaper on the same chosen display. Persisted `mode`
 *  stays 'wallpaper' the whole time — peek is a transient overlay.
 *  No-op when persisted mode is 'window' (the window is already
 *  interactive; nothing to peek into).
 *
 *  The throttle controller is NOT stopped/restarted: during peek the
 *  wallpaper IS the foreground window, so the state machine's
 *  `foregroundHwnd === wallpaperHwnd → 'full'` short-circuit kicks in
 *  and agents tick at full speed (the right semantic — the user is
 *  actively looking at + interacting with the palace).
 */
function togglePeek(): void {
  if (!mainWindow) return;
  if (getMode() !== 'wallpaper') {
    // eslint-disable-next-line no-console
    console.log('[peek] ignored — only meaningful in wallpaper mode');
    return;
  }
  peeking = !peeking;
  // eslint-disable-next-line no-console
  console.log(`[peek] toggled ${peeking ? 'on' : 'off'}`);
  if (peeking) {
    // Full exit-then-alwaysOnTop. Heavier than a z-order lift but
    // gives proper Win11 input handling (alt-tab, click events,
    // keyboard focus all work like a normal interactive window).
    // Stop the throttle controller so the watchdog inside exitWallpaper
    // doesn't race the peek transition. We DON'T restart it during
    // peek — the renderer ticks at full FPS while the user is
    // interacting, and we restart on peek-off.
    stopThrottleController();
    emitThrottleChange('full', true);
    exitWallpaper(mainWindow);
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
  } else {
    mainWindow.setAlwaysOnTop(false);
    const display = resolveDisplay();
    enterWallpaper(mainWindow, display);
    startThrottleController(mainWindow, {
      display,
      onStateChange: (state, isInitial) => emitThrottleChange(state, isInitial),
    });
  }
  if (tray) rebuildTrayMenu(tray);
  notifyPeek();
}

/** Broadcast peek-state change to the renderer. Renderer can use this
 *  to show a "press Ctrl+Alt+L to exit peek" hint or any other
 *  peek-aware UI. Same pattern as wallpaper:modeChanged. */
function notifyPeek(): void {
  if (!mainWindow) return;
  try {
    mainWindow.webContents.send('wallpaper:peekChanged', peeking);
  } catch {
    // pre-load: renderer reads getPeeking() on mount as a backstop.
  }
}

/** Broadcast throttle changes to the renderer. Separate from the
 *  controller's onStateChange callback so the IPC details stay in main
 *  and the throttle module stays Electron-API-light. */
function emitThrottleChange(state: ThrottleState, isInitial: boolean): void {
  if (!mainWindow) return;
  // eslint-disable-next-line no-console
  console.log(`[throttle/ipc] sending state=${state} isInitial=${isInitial}`);
  try {
    mainWindow.webContents.send('throttle:state-change', { state, isInitial });
  } catch {
    // Same backstop as wallpaper:modeChanged — the renderer can poll
    // throttle:getCurrent on mount.
  }
}

// --- IPC bridge ----------------------------------------------------------

ipcMain.handle('steam:getSteamId', () => {
  if (!steamClient) return null;
  try {
    return steamClient.localplayer.getSteamId().steamId64.toString();
  } catch {
    return null;
  }
});

ipcMain.handle('steam:isAvailable', () => steamClient !== null);

// Launch a Steam game via the OS protocol handler. shell.openExternal
// hands the URL to the OS, which routes to the Steam client cleanly —
// in contrast, assigning window.location.href in the renderer would
// navigate the Electron window away from our app.
ipcMain.handle('steam:launchGame', (_event, appid: unknown) => {
  if (typeof appid !== 'number' || !Number.isInteger(appid) || appid <= 0) {
    return false;
  }
  void shell.openExternal(`steam://run/${appid}`);
  return true;
});

// Hex-encoded AuthSessionTicket. Renderer POSTs this to
// /api/auth/steamticket on the worker, which verifies via Steam Web API
// and mints a session cookie without the OpenID round-trip.
// Wallpaper-mode IPC. Renderer reads + sets the mode; main process handles
// the platform-specific reparent + persistence + tray sync.
// User-data path — Phase 2F renderer-side memory store bootstrap reads
// this to decide where memory.sqlite + vaults/ live. Electron's
// `app.getPath('userData')` returns the OS-appropriate per-user
// app-data dir; on Windows that's typically AppData/Roaming/lokilibrary.
ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

ipcMain.handle('wallpaper:getMode', () => getMode());
ipcMain.handle('wallpaper:setMode', (_event, mode: unknown) => {
  if (mode !== 'window' && mode !== 'wallpaper') return false;
  applyMode(mode);
  return true;
});

// Phase 4 slice 4A — throttle state, used by the renderer to set
// app.ticker.maxFPS / stop. Renderer hydrates on mount via this handle,
// then listens for `throttle:state-change` for transitions.
ipcMain.handle('throttle:getCurrent', () => getCurrentThrottleState());

// Phase 4 slice 4C — peek bridge. The renderer rarely needs to drive
// these (the global hotkey + tray drive most state changes), but the
// handlers exist so a renderer-side dismiss button or a peek-aware HUD
// hint can read state + toggle on demand.
ipcMain.handle('wallpaper:getPeeking', () => peeking);
ipcMain.handle('wallpaper:togglePeek', () => {
  togglePeek();
  return peeking;
});

ipcMain.handle('steam:getAuthTicket', async () => {
  if (!steamClient || !steamClient.auth?.getAuthTicketForWebApi) return null;
  try {
    const ticket = await steamClient.auth.getAuthTicketForWebApi(WEB_API_IDENTITY);
    const bytes = ticket.getBytes();
    return Buffer.from(bytes).toString('hex');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[steamworks] getAuthTicket failed:', (e as Error).message);
    return null;
  }
});

// --- Lifecycle -----------------------------------------------------------

void app.whenReady().then(() => {
  initSteam();
  createWindow();

  // Steam overlay must be enabled after the BrowserWindow exists so it
  // can attach to the Chromium swap chain.
  try {
    steamworks.electronEnableSteamOverlay();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[steamworks] overlay enable failed:', (e as Error).message);
  }

  tray = createTray();

  // Phase 4C — register the peek global shortcut. Log the result so
  // false (already registered by another app system-wide) is
  // user-actionable rather than a silent no-op.
  const registered = globalShortcut.register(PEEK_ACCELERATOR, () => togglePeek());
  // eslint-disable-next-line no-console
  console.log(`[peek] registered ${PEEK_ACCELERATOR} (${registered})`);
  if (!registered) {
    // eslint-disable-next-line no-console
    console.warn(
      `[peek] ${PEEK_ACCELERATOR} appears to be in use by another app; ` +
        'peek hotkey will not fire. Use the tray "Peek" item instead.',
    );
  }

  const initialMode = getMode();
  // eslint-disable-next-line no-console
  console.log(`[startup] userData=${app.getPath('userData')} initialMode=${initialMode}`);

  // Restore persisted wallpaper mode after the window's first paint. Fresh
  // SetParent-against-Progman on a not-yet-shown window can leave it
  // invisible on some Win11 builds; ready-to-show fires after the renderer
  // has produced at least one frame.
  if (initialMode === 'wallpaper' && mainWindow) {
    mainWindow.once('ready-to-show', () => {
      // Bypass applyMode's "already in this mode" guard — config says
      // 'wallpaper' but we haven't actually entered wallpaper yet.
      if (mainWindow) {
        const display = resolveDisplay();
        enterWallpaper(mainWindow, display);
        startThrottleController(mainWindow, {
          display,
          onStateChange: (state, isInitial) => emitThrottleChange(state, isInitial),
        });
      }
      if (tray) rebuildTrayMenu(tray);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Phase 4C — release any registered global shortcuts BEFORE app.quit()
  // so the hotkey doesn't linger system-wide for the next process. PLAN.md
  // Phase 4 task 3 explicitly calls this out.
  globalShortcut.unregisterAll();
  stopThrottleController();
  tray?.destroy();
  tray = null;
  if (steamClient) {
    try {
      steamworks.shutdown?.();
    } catch {
      /* best effort */
    }
  }
  if (process.platform !== 'darwin') app.quit();
});
