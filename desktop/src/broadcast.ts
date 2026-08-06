/**
 * Who receives process-level broadcasts (throttle, wallpaper mode, peek,
 * desk attention).
 *
 * Before this, main.ts sent those four on `mainWindow.webContents` and
 * early-returned when `mainWindow` was null. In terminals mode `mainWindow` is
 * ALWAYS null — `startTerminalsMode` returns before `createWindow()` ever runs
 * (main.ts) — so every one of those sends was a silent no-op, and
 * `wallpaper:setMode` from a terminal returned true while doing nothing. This
 * is the "broadcasts hardcoded to one webContents" item in
 * docs/PRD-snapping-terminals.md:47, which T1 was meant to clear and didn't.
 *
 * DELIBERATELY NOT A WINDOW MANAGER. It owns "who is listening" and nothing
 * else: no lifecycle, no bounds, no ordering, no z-order, no per-window state.
 * The callers keep their own registries — main.ts has `mainWindow`,
 * terminals.ts has the `terminals` map — and both merely also register here.
 *
 * `terminals.ts`'s `broadcastTopology` is deliberately NOT folded in: it is
 * change-gated on a dedupe key and carries desk-specific payload, so routing
 * it through a generic fan-out would either lose the gate or push desk
 * concerns in here. Two small specific things beat one general thing.
 */

import type { BrowserWindow } from 'electron';

const targets = new Set<BrowserWindow>();

/** Start sending broadcasts to `win`. Idempotent, and self-deregistering:
 *  a closed window drops itself, so nothing has to remember to clean up. */
export function registerWindow(win: BrowserWindow): void {
  if (targets.has(win)) return;
  targets.add(win);
  win.on('closed', () => targets.delete(win));
}

export function unregisterWindow(win: BrowserWindow): void {
  targets.delete(win);
}

/** Send to every live target. A destroyed window is skipped, and a throwing
 *  send is contained: one dead renderer must never stop the others receiving
 *  (renderers all poll their own getters on mount as the backstop). */
export function broadcast(channel: string, payload?: unknown): void {
  for (const win of targets) {
    if (win.isDestroyed()) {
      targets.delete(win);
      continue;
    }
    try {
      win.webContents.send(channel, payload);
    } catch {
      // Pre-load or a torn-down webContents; the renderer's on-mount poll
      // covers it.
    }
  }
}

export function targetCount(): number {
  return targets.size;
}

/** Test seam only — never called by the app. */
export function resetForTests(): void {
  targets.clear();
}
