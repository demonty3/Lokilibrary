/**
 * Tiny per-user config persistence. JSON file in Electron's userData dir.
 *
 * Slice 4 only needs `mode` (window | wallpaper), so a 25-line homegrown
 * implementation beats the electron-store dep — saves us a pure-ESM
 * dependency that would otherwise force our CJS main process onto ESM.
 *
 * On disk: <userData>/config.json — `%APPDATA%\libraryworld-desktop\config.json`
 * on Windows, `~/Library/Application Support/libraryworld-desktop/` on Mac.
 * Survives uninstall/reinstall as long as the userData dir isn't cleared.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Mode = 'window' | 'wallpaper';

const DEFAULT_MODE: Mode = 'window';

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function getMode(): Mode {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw) as { mode?: unknown };
    return cfg.mode === 'wallpaper' ? 'wallpaper' : 'window';
  } catch {
    // First run, corrupted file, or permissions issue — default mode.
    return DEFAULT_MODE;
  }
}

export function setMode(mode: Mode): void {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify({ mode }, null, 2));
  } catch (e) {
    // Non-fatal — the mode still applies for the current session, just
    // won't persist across restart.
    // eslint-disable-next-line no-console
    console.warn('[config] persist failed:', (e as Error).message);
  }
}
