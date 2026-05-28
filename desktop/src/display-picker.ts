/**
 * Phase 4B — multi-monitor picker helpers.
 *
 * Pure functions over Electron's `Display[]` shape, extracted from
 * main.ts so the smoke can mock the displays array directly without
 * standing up a real Electron `screen`. The actual wiring (tray menu
 * rebuild, IPC handlers, applyDisplay side-effects) stays in main.ts
 * where it can call `screen.getAllDisplays()` against the real API.
 *
 * Lifted patterns from the 3D-era reference at
 * `origin/claude/phase6-slice5-perf-multimonitor:desktop/src/{main,tray}.ts`.
 * The single-display "Only one display detected" short-circuit and the
 * label format (with primary indicator + dimensions) come from there
 * verbatim — they were already user-tested.
 */

import type { MenuItemConstructorOptions } from 'electron';

/** Minimal Display shape we depend on. Electron's `Display` has many
 *  more fields but the picker only needs id + label + bounds. Smokes
 *  use this shape so they don't pull in the full Electron type. */
export interface DisplayLike {
  readonly id: number;
  readonly label?: string;
  readonly bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Resolve the wallpaper's target display from a persisted id. Returns
 * the matching display if found, the primary otherwise (covers both
 * "no id persisted" and "persisted id no longer matches a connected
 * monitor" — e.g. the user unplugged the secondary). The caller is
 * responsible for picking the primary out of `all` and passing it as
 * `primary` so this stays a pure function over its inputs.
 *
 * Throws if `all` is empty — that's a system-level failure (no
 * displays at all) the caller should surface differently than a
 * routine fallback.
 */
export function resolveTargetDisplay<T extends DisplayLike>(
  all: readonly T[],
  primary: T,
  persistedId: number | undefined,
): T {
  if (all.length === 0) {
    throw new Error('[display-picker] no displays available');
  }
  if (persistedId === undefined) return primary;
  const match = all.find((d) => d.id === persistedId);
  return match ?? primary;
}

/** Format a display's tray label. The 3D-era convention:
 *
 *   "<label> (primary) — 2560×1440"
 *
 *  If the OS doesn't give a label, fall back to "Display <id>".
 *  Suffix " (primary)" only on the primary display so users with
 *  identical monitors can tell which is which. */
export function formatDisplayLabel<T extends DisplayLike>(
  display: T,
  primaryId: number,
): string {
  const name = display.label || `Display ${display.id}`;
  const primaryTag = display.id === primaryId ? ' (primary)' : '';
  return `${name}${primaryTag} — ${display.bounds.width}×${display.bounds.height}`;
}

/** Build the "Display" submenu item array for the tray. Single-display
 *  systems collapse to a disabled hint — the chooser is meaningless when
 *  there's only one option, and a disabled hint reads better than a
 *  useless one-item submenu.
 *
 *  `onPick(undefined)` corresponds to "use primary"; `onPick(<id>)`
 *  pins to that display. Radio checks track the persisted value
 *  (`persistedId === undefined` selects the "Primary" item).
 */
export function buildDisplaySubmenu<T extends DisplayLike>(
  all: readonly T[],
  primaryId: number,
  persistedId: number | undefined,
  onPick: (id: number | undefined) => void,
): MenuItemConstructorOptions[] {
  if (all.length <= 1) {
    return [{ label: 'Only one display detected', enabled: false }];
  }

  const primaryItem: MenuItemConstructorOptions = {
    label: 'Primary display',
    type: 'radio',
    checked: persistedId === undefined,
    click: () => onPick(undefined),
  };

  const items: MenuItemConstructorOptions[] = all.map((d) => ({
    label: formatDisplayLabel(d, primaryId),
    type: 'radio',
    checked: persistedId === d.id,
    click: () => onPick(d.id),
  }));

  return [primaryItem, { type: 'separator' }, ...items];
}
