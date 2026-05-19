/**
 * System tray icon + right-click menu. Phase 6 slice 4.
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
 *   - Quit
 *
 * The menu is rebuilt whenever the mode changes so the radio checkmark
 * stays in sync. Both the menu-driven and the IPC-driven mode changes flow
 * through the same applyMode() in main.ts.
 */

import { app, Menu, Tray, nativeImage } from 'electron';
import * as path from 'node:path';
import type { Mode } from './config';

let tray: Tray | null = null;

export interface TrayHandle {
  rebuild(): void;
  destroy(): void;
}

function trayIconPath(): string {
  // Compiled main.js sits at desktop/dist/main.js; the asset is at
  // desktop/assets/tray-icon.png. Two levels up.
  return path.resolve(__dirname, '..', 'assets', 'tray-icon.png');
}

export function createTray(
  getMode: () => Mode,
  applyMode: (mode: Mode) => void,
): TrayHandle {
  const icon = nativeImage.createFromPath(trayIconPath());
  // Resize to 16x16 — what Windows actually expects in the tray. Most users
  // won't notice the difference but the source is 32x32 for sharper macOS
  // rendering later.
  const sized = icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
  tray = new Tray(sized);
  tray.setToolTip('LibraryWorld');

  const rebuild = (): void => {
    if (!tray) return;
    const current = getMode();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Window mode',
          type: 'radio',
          checked: current === 'window',
          click: () => applyMode('window'),
        },
        {
          label: 'Wallpaper mode',
          type: 'radio',
          checked: current === 'wallpaper',
          click: () => applyMode('wallpaper'),
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]),
    );
  };
  rebuild();

  return {
    rebuild,
    destroy: () => {
      tray?.destroy();
      tray = null;
    },
  };
}
