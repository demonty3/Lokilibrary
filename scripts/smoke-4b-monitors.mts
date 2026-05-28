/**
 * Phase 4B slice smoke — `npx tsx scripts/smoke-4b-monitors.mts`.
 *
 * Covers the WSL-testable surface of the multi-monitor picker:
 *   - `resolveTargetDisplay(all, primary, persistedId)` returns the
 *     match for a valid persisted id, falls back to primary for a stale
 *     id, returns primary when no id is persisted, and throws on an
 *     empty display list (system-level failure, not silent fallback).
 *   - `formatDisplayLabel(display, primaryId)` produces the tray label
 *     format the user sees ("<name> (primary) — WxH" or "<name> — WxH").
 *   - `buildDisplaySubmenu(all, primaryId, persistedId, onPick)` returns
 *     the right Electron menu shape: single-display short-circuit, the
 *     "Primary display" radio item, the per-display radio items, the
 *     separator, and the radio checks tracking the persisted value.
 *     Clicking each item calls onPick with the right id (or undefined
 *     for primary).
 *   - `getDisplayId() / setDisplayId()` round-trip persisted state via
 *     a temp Electron-userData mock (since the real getPath('userData')
 *     needs an Electron app).
 *
 * NOT covered (needs Windows-native Electron):
 *   - The actual `screen.getAllDisplays()` enumeration on a real
 *     multi-monitor setup
 *   - `applyDisplay()` exit-then-enter wallpaper flow with the real
 *     Win32 SetParent
 *   - Throttle controller observing the chosen display's monitorRect
 *
 * The user verifies those in a Windows-native PowerShell `npm run dev`
 * inside desktop/, per the plan's verification section.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Mock Electron's `app.getPath('userData')` to a tmp dir so the
// config round-trip test stays hermetic. Must run BEFORE the
// config.ts import below — Module._load is checked at require time.
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-4b-'));
mockElectronModule({ app: { getPath: (_name: string) => tmpUserData } });

// display-picker.ts has no electron runtime dep (it only imports the
// MenuItemConstructorOptions *type*), so it can load directly. config.ts
// DOES import `app` from electron — the hijack above intercepts it.

const {
  resolveTargetDisplay,
  formatDisplayLabel,
  buildDisplaySubmenu,
} = await import('../desktop/src/display-picker.ts');

const config = await import('../desktop/src/config.ts');
const { getDisplayId, setDisplayId, getMode, setMode } = config;

const { check, report } = makeChecker('smoke 4B');

// ---------------------------------------------------------------------------
// Fixtures

interface FakeDisplay {
  id: number;
  label?: string;
  bounds: { x: number; y: number; width: number; height: number };
}

const primary: FakeDisplay = {
  id: 10,
  label: 'Built-in',
  bounds: { x: 0, y: 0, width: 2560, height: 1440 },
};
const secondary: FakeDisplay = {
  id: 20,
  label: 'External 4K',
  bounds: { x: 2560, y: 0, width: 3840, height: 2160 },
};
const tertiary: FakeDisplay = {
  // No label — exercises the "Display <id>" fallback in formatDisplayLabel.
  id: 30,
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
};

// ---------------------------------------------------------------------------
// 1. resolveTargetDisplay

check(
  'resolveTargetDisplay: persistedId matches secondary → returns secondary',
  resolveTargetDisplay([primary, secondary], primary, 20) === secondary,
);
check(
  'resolveTargetDisplay: persistedId matches primary → returns primary',
  resolveTargetDisplay([primary, secondary], primary, 10) === primary,
);
check(
  'resolveTargetDisplay: persistedId undefined → returns primary',
  resolveTargetDisplay([primary, secondary], primary, undefined) === primary,
);
check(
  'resolveTargetDisplay: stale persistedId (no match) → returns primary',
  resolveTargetDisplay([primary, secondary], primary, 999) === primary,
);

let threw = false;
try {
  resolveTargetDisplay([], primary, undefined);
} catch {
  threw = true;
}
check('resolveTargetDisplay: empty display list throws', threw);

// Single-display setup — primary IS the only option, persistedId
// should still resolve to primary.
check(
  'resolveTargetDisplay: single-display setup → returns primary regardless',
  resolveTargetDisplay([primary], primary, undefined) === primary,
);

// ---------------------------------------------------------------------------
// 2. formatDisplayLabel

check(
  'formatDisplayLabel: primary gets (primary) suffix',
  formatDisplayLabel(primary, 10) === 'Built-in (primary) — 2560×1440',
);
check(
  'formatDisplayLabel: secondary no suffix',
  formatDisplayLabel(secondary, 10) === 'External 4K — 3840×2160',
);
check(
  'formatDisplayLabel: no label → "Display <id>" fallback',
  formatDisplayLabel(tertiary, 10) === 'Display 30 — 1920×1080',
);
check(
  'formatDisplayLabel: tertiary as primary',
  formatDisplayLabel(tertiary, 30) === 'Display 30 (primary) — 1920×1080',
);

// ---------------------------------------------------------------------------
// 3. buildDisplaySubmenu

// 3a. Single-display short-circuit
const single = buildDisplaySubmenu([primary], 10, undefined, () => undefined);
check(
  'submenu: single-display returns disabled hint',
  single.length === 1 &&
    single[0]!.label === 'Only one display detected' &&
    single[0]!.enabled === false,
);

// 3b. Multi-display shape — primary item + separator + N display items
let clicked: number | undefined | 'NONE' = 'NONE';
const multi = buildDisplaySubmenu(
  [primary, secondary],
  10,
  20, // persistedId = secondary
  (id) => { clicked = id; },
);
check(
  'submenu: multi-display item count = 4 (primary + separator + 2 displays)',
  multi.length === 4,
);
check(
  'submenu: item 0 is "Primary display" radio (unchecked since persisted = secondary)',
  multi[0]!.label === 'Primary display' &&
    multi[0]!.type === 'radio' &&
    multi[0]!.checked === false,
);
check('submenu: item 1 is separator', multi[1]!.type === 'separator');
check(
  'submenu: item 2 is primary display radio (unchecked)',
  multi[2]!.label === 'Built-in (primary) — 2560×1440' &&
    multi[2]!.type === 'radio' &&
    multi[2]!.checked === false,
);
check(
  'submenu: item 3 is secondary radio (CHECKED — matches persistedId 20)',
  multi[3]!.label === 'External 4K — 3840×2160' &&
    multi[3]!.type === 'radio' &&
    multi[3]!.checked === true,
);

// 3c. Click handlers fire with the right id
(multi[0]!.click as () => void)();
check('submenu: Primary click → onPick(undefined)', clicked === undefined);
clicked = 'NONE';
(multi[2]!.click as () => void)();
check('submenu: Built-in click → onPick(10)', clicked === 10);
clicked = 'NONE';
(multi[3]!.click as () => void)();
check('submenu: External 4K click → onPick(20)', clicked === 20);

// 3d. persistedId = undefined → Primary item is checked, others unchecked
const noPersist = buildDisplaySubmenu([primary, secondary], 10, undefined, () => undefined);
check(
  'submenu: undefined persistedId → Primary radio checked',
  noPersist[0]!.checked === true && noPersist[2]!.checked === false && noPersist[3]!.checked === false,
);

// 3e. persistedId points at non-primary display
const stalePersist = buildDisplaySubmenu([primary, secondary], 10, 999, () => undefined);
check(
  'submenu: stale persistedId → no radio checked (UI shows nothing selected; user must re-pick)',
  stalePersist[0]!.checked === false &&
    stalePersist[2]!.checked === false &&
    stalePersist[3]!.checked === false,
);

// ---------------------------------------------------------------------------
// 4. getDisplayId / setDisplayId round-trip

// Default state — no config file yet, both fields undefined.
check('config: getMode default = window', getMode() === 'window');
check('config: getDisplayId default = undefined', getDisplayId() === undefined);

// Set + read back
setDisplayId(42);
check('config: setDisplayId(42) → getDisplayId() === 42', getDisplayId() === 42);

// setDisplayId(undefined) clears the field — important so the JSON
// doesn't carry a stale `displayId: undefined` after the user picks
// "Primary display" in the submenu.
setDisplayId(undefined);
check('config: setDisplayId(undefined) → getDisplayId() === undefined', getDisplayId() === undefined);

// Setting displayId must NOT clobber mode (each setter is independent).
setMode('wallpaper');
setDisplayId(99);
check('config: setting displayId preserves mode', getMode() === 'wallpaper');
check('config: setting displayId persists', getDisplayId() === 99);

// And the inverse — setting mode must NOT clobber displayId.
setMode('window');
check('config: setting mode preserves displayId', getDisplayId() === 99);

// JSON file on disk has both fields.
const cfgPath = path.join(tmpUserData, 'config.json');
const onDisk = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { mode?: string; displayId?: number };
check('config: on-disk JSON has mode field', onDisk.mode === 'window');
check('config: on-disk JSON has displayId field', onDisk.displayId === 99);

// Clear displayId, verify it's removed from the JSON (not left as null).
setDisplayId(undefined);
const onDiskCleared = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { displayId?: unknown };
check(
  'config: clearing displayId removes the field entirely from JSON',
  !('displayId' in onDiskCleared),
);

// ---------------------------------------------------------------------------
// Cleanup + report

fs.rmSync(tmpUserData, { recursive: true, force: true });
report();
