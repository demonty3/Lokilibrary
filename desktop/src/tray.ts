/**
 * System tray icon + right-click menu. Phase 6 slice 4 + slice 5 (multi-monitor).
 *
 * The tray is the only mode-switch surface that survives wallpaper mode —
 * the in-world connector panel becomes unreachable when the window is
 * click-through and behind the desktop, so without the tray you'd have to
 * quit + restart to get back to window mode. Same pattern Wallpaper Engine
 * uses.
 *
 * Menu items:
 *   - Window mode (radio)
 *   - Wallpaper mode (radio)
 *   - Display ▸ (submenu, slice 5)
 *       - Primary (radio)
 *       - <each connected display> (radio)
 *   - Quit
 *
 * The menu is rebuilt whenever mode or display changes so the radio
 * checkmarks stay in sync. Both menu-driven and IPC-driven changes flow
 * through the same applyMode() / applyDisplay() in main.ts.
 */

import { app, Menu, screen, Tray, nativeImage } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'node:path';
import type { Mode } from './config';

let tray: Tray | null = null;

export interface TrayHandle {
  rebuild(): void;
  destroy(): void;
}

export interface TrayDeps {
  getMode: () => Mode;
  applyMode: (mode: Mode) => void;
  /** Persisted display id, or null for "primary". Slice 5. */
  getDisplayId: () => number | null;
  /** Pass `undefined` for "primary"; otherwise the chosen Display.id. */
  applyDisplay: (displayId: number | undefined) => void;
}

function trayIconPath(): string {
  // Compiled main.js sits at desktop/dist/main.js; the asset is at
  // desktop/assets/tray-icon.png. Two levels up.
  return path.resolve(__dirname, '..', 'assets', 'tray-icon.png');
}

function buildDisplaySubmenu(deps: TrayDeps): MenuItemConstructorOptions[] {
  const all = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  const chosen = deps.getDisplayId();
  // Single-monitor case — collapse to a disabled hint instead of a useless
  // one-item submenu. Slice 5 only matters when there's a choice.
  if (all.length <= 1) {
    return [{ label: 'Only one display detected', enabled: false }];
  }
  const primaryItem: MenuItemConstructorOptions = {
    label: 'Primary display',
    type: 'radio',
    checked: chosen === null,
    click: () => deps.applyDisplay(undefined),
  };
  const items: MenuItemConstructorOptions[] = all.map((d) => ({
    label: `${d.label || `Display ${d.id}`}${d.id === primaryId ? ' (primary)' : ''} — ${d.bounds.width}×${d.bounds.height}`,
    type: 'radio',
    checked: chosen === d.id,
    click: () => deps.applyDisplay(d.id),
  }));
  return [primaryItem, { type: 'separator' }, ...items];
}

export function createTray(deps: TrayDeps): TrayHandle {
  const icon = nativeImage.createFromPath(trayIconPath());
  // Resize to 16x16 — what Windows actually expects in the tray. Most users
  // won't notice the difference but the source is 32x32 for sharper macOS
  // rendering later.
  const sized = icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
  tray = new Tray(sized);
  tray.setToolTip('LibraryWorld');

  const rebuild = (): void => {
    if (!tray) return;
    const current = deps.getMode();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Window mode',
          type: 'radio',
          checked: current === 'window',
          click: () => deps.applyMode('window'),
        },
        {
          label: 'Wallpaper mode',
          type: 'radio',
          checked: current === 'wallpaper',
          click: () => deps.applyMode('wallpaper'),
        },
        { type: 'separator' },
        { label: 'Display', submenu: buildDisplaySubmenu(deps) },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]),
    );
  };
  rebuild();

  // Slice 5: rebuild when displays change (hot-plug, resolution change) so
  // the submenu stays accurate. The 'display-*' events fire from the main
  // process screen module.
  const onDisplayChange = (): void => rebuild();
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  screen.on('display-metrics-changed', onDisplayChange);

  return {
    rebuild,
    destroy: () => {
      screen.off('display-added', onDisplayChange);
      screen.off('display-removed', onDisplayChange);
      screen.off('display-metrics-changed', onDisplayChange);
      tray?.destroy();
      tray = null;
    },
  };
}
