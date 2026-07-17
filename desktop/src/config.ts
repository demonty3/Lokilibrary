/**
 * Tiny per-user config persistence. JSON file in Electron's userData dir.
 *
 * Stores:
 *   - `mode` (window | wallpaper) — Phase 0 wallpaper revival.
 *   - `displayId` (Electron Display.id) — Phase 4B multi-monitor picker.
 *     Persisting the *id* rather than (x, y) bounds means a monitor swap
 *     reassigns the wallpaper to the primary instead of crashing into a
 *     no-longer-existent display. Undefined ↔ "use primary display."
 *   - `terminals` (id/wing/bounds array) — snapping-terminals desk
 *     persistence. Written by desktop/src/terminals.ts on settle/close/
 *     spawn; restored on the next LOKILIBRARY_TERMINALS launch.
 *
 * On disk: <userData>/config.json — `%APPDATA%\lokilibrary-desktop\config.json`
 * on Windows, `~/Library/Application Support/lokilibrary-desktop/` on Mac.
 * Survives uninstall/reinstall as long as the userData dir isn't cleared.
 *
 * Per-field getter/setter pattern (instead of one big setConfig) so each
 * call site has a narrow API surface — easier to grep, easier to mock in
 * tests, and the read-modify-write spread keeps unrelated fields safe.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Mode = 'window' | 'wallpaper';

/** One persisted terminal window of the snapping-terminals desk. */
export interface TerminalSlot {
  id: string;
  wing: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Config {
  mode: Mode;
  displayId?: number;
  terminals?: TerminalSlot[];
  /** T2 society — agentId → home wing. Written by terminals.ts on every
   *  roster change; wings (not terminalIds) are the stable identity. */
  society?: Record<string, string>;
}

function isTerminalSlot(v: unknown): v is TerminalSlot {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.wing === 'string' &&
    typeof s.x === 'number' &&
    typeof s.y === 'number' &&
    typeof s.width === 'number' &&
    typeof s.height === 'number'
  );
}

function isSocietyRecord(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((w) => typeof w === 'string');
}

const DEFAULT_CONFIG: Config = { mode: 'window' };

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig(): Config {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw) as Partial<Config>;
    // readConfig reconstructs from known fields, so an unparsed field would
    // be ERASED by the next read-modify-write — this parse is load-bearing.
    const terminals = Array.isArray(cfg.terminals) ? cfg.terminals.filter(isTerminalSlot) : [];
    const society = isSocietyRecord(cfg.society) ? cfg.society : undefined;
    return {
      mode: cfg.mode === 'wallpaper' ? 'wallpaper' : 'window',
      displayId: typeof cfg.displayId === 'number' ? cfg.displayId : undefined,
      ...(terminals.length > 0 ? { terminals } : {}),
      ...(society ? { society } : {}),
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

export function getTerminals(): TerminalSlot[] | undefined {
  return readConfig().terminals;
}

export function setTerminals(slots: TerminalSlot[] | undefined): void {
  const cfg = readConfig();
  if (!slots || slots.length === 0) delete cfg.terminals;
  else cfg.terminals = slots;
  writeConfig(cfg);
}

export function getSociety(): Record<string, string> | undefined {
  return readConfig().society;
}

export function setSociety(society: Record<string, string> | undefined): void {
  const cfg = readConfig();
  if (!society || Object.keys(society).length === 0) delete cfg.society;
  else cfg.society = society;
  writeConfig(cfg);
}
