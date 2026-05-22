/**
 * Tiny per-user config persistence. JSON file in Electron's userData dir.
 *
 * Stores `mode` (window | wallpaper). Multi-monitor `displayId` from the
 * v0.6 build is out of scope for the wallpaper revival (single primary
 * display only); see legacy-desktop-v0.6/src/config.ts if it returns.
 *
 * On disk: <userData>/config.json — `%APPDATA%\lokilibrary-desktop\config.json`
 * on Windows, `~/Library/Application Support/lokilibrary-desktop/` on Mac.
 * Survives uninstall/reinstall as long as the userData dir isn't cleared.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Mode = 'window' | 'wallpaper';

export interface Config {
  mode: Mode;
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
