/**
 * Tiny per-user config persistence. JSON file in Electron's userData dir.
 *
 * Slice 4 stored `mode` (window | wallpaper). Slice 5 adds `displayId` for
 * the multi-monitor picker — Electron's display IDs are stable across runs
 * on the same hardware, so the user's chosen monitor survives restarts.
 *
 * On disk: <userData>/config.json — `%APPDATA%\libraryworld-desktop\config.json`
 * on Windows, `~/Library/Application Support/libraryworld-desktop/` on Mac.
 * Survives uninstall/reinstall as long as the userData dir isn't cleared.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Mode = 'window' | 'wallpaper';

export interface Config {
  mode: Mode;
  /** Electron Display.id — null/undefined means "use primary display".
   *  Persisting the id rather than (x, y) bounds means a monitor swap
   *  reassigns the wallpaper to the primary instead of crashing into a
   *  no-longer-existent display. */
  displayId?: number;
}

const DEFAULT_CONFIG: Config = { mode: 'window' };

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig(): Config {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw) as Partial<Config>;
    return {
      mode: cfg.mode === 'wallpaper' ? 'wallpaper' : 'window',
      displayId: typeof cfg.displayId === 'number' ? cfg.displayId : undefined,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(cfg: Config): void {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[config] persist failed:', (e as Error).message);
  }
}

export function getMode(): Mode {
  return readConfig().mode;
}

export function setMode(mode: Mode): void {
  writeConfig({ ...readConfig(), mode });
}

export function getDisplayId(): number | undefined {
  return readConfig().displayId;
}

export function setDisplayId(displayId: number | undefined): void {
  const cfg = readConfig();
  if (displayId === undefined) delete cfg.displayId;
  else cfg.displayId = displayId;
  writeConfig(cfg);
}
