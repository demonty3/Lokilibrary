/**
 * macOS wallpaper mode — desktop-level NSWindow, live-toggled.
 *
 * Unlike the Windows path (which SetParents the HWND behind Progman), macOS
 * has no reparenting: a window joins the desktop by dropping its
 * `NSWindow.level` to the desktop-picture level and adopting a collection
 * behavior that keeps it present across every Space and stationary under
 * Mission Control. We do this on the *live* window — no recreation — so the
 * PixiJS renderer (and, later, the live agent runtime) keeps its state across
 * a mode toggle. Recreating the BrowserWindow with `{ type: 'desktop' }` would
 * be simpler but reloads the renderer on every switch; for a live wallpaper
 * that's the wrong trade.
 *
 * There is no public Electron API for a below-desktop window level, so we
 * call into the Objective-C runtime via koffi FFI (already a dependency for
 * the Windows Win32 bindings):
 *   - `-[NSView window]` to get our NSWindow from the native view handle
 *   - `-[NSWindow setLevel:]` / `-[NSWindow setCollectionBehavior:]`
 *   - `CGWindowLevelForKey(kCGDesktopWindowLevelKey)` to resolve the desktop
 *     level at runtime rather than hardcoding a fragile magic number.
 *
 * Everything is best-effort + idempotent, matching windows.ts: if any binding
 * or call fails we log a warning and leave the window usable (just not behind
 * the desktop). The caller (main.ts) persists the chosen mode either way so
 * the tray stays consistent.
 *
 * koffi is loaded lazily on first enter so the binding cost (and the dlopen of
 * libobjc / CoreGraphics) never touches the pure window-mode path.
 */

import { app, type BrowserWindow, type Display } from 'electron';

// --- koffi typing (loose; koffi's own .d.ts isn't worth pulling in here) -----

type KoffiFn = (...args: unknown[]) => unknown;
interface KoffiLib {
  // Both koffi func forms: explicit (name, ret, args) and prototype-string.
  func(name: string, result: string, args: string[]): KoffiFn;
  func(signature: string): KoffiFn;
}
interface Koffi {
  load(path: string): KoffiLib;
}

// --- Objective-C / CoreGraphics constants ------------------------------------

/** CGWindowLevelKey for the desktop-picture level. CGWindowLevelForKey(2)
 *  returns the live desktop level; a window set to it sits above the static
 *  wallpaper and below the desktop icons. If it ever renders *behind* the
 *  static picture on some display config, nudge to `+ 1` (see enterWallpaper). */
const KCG_DESKTOP_WINDOW_LEVEL_KEY = 2;
/** Fallback if CGWindowLevelForKey can't be resolved — the documented value of
 *  kCGDesktopWindowLevel. */
const KCG_DESKTOP_WINDOW_LEVEL_FALLBACK = -2147483623;

/** NSWindowCollectionBehavior bits (AppKit):
 *    CanJoinAllSpaces = 1<<0, Stationary = 1<<4, IgnoresCycle = 1<<6.
 *  Present on every Space, doesn't shift under Mission Control, skipped by
 *  Cmd-Tab / window cycling. */
const NS_COLLECTION_CAN_JOIN_ALL_SPACES = 1 << 0;
const NS_COLLECTION_STATIONARY = 1 << 4;
const NS_COLLECTION_IGNORES_CYCLE = 1 << 6;
const WALLPAPER_COLLECTION_BEHAVIOR =
  NS_COLLECTION_CAN_JOIN_ALL_SPACES | NS_COLLECTION_STATIONARY | NS_COLLECTION_IGNORES_CYCLE;

/** Restore targets if we somehow never captured the originals. */
const NS_NORMAL_WINDOW_LEVEL = 0;
const NS_COLLECTION_BEHAVIOR_DEFAULT = 0;

// --- Lazy-bound runtime bridge -----------------------------------------------

interface ObjcBridge {
  /** id objc_msgSend(id, SEL) — pointer return (e.g. -[NSView window]). */
  msgSendId(self: unknown, sel: unknown): unknown;
  /** NSInteger objc_msgSend(id, SEL) — read -[NSWindow level]. */
  msgSendLong(self: unknown, sel: unknown): number;
  /** NSUInteger objc_msgSend(id, SEL) — read -[NSWindow collectionBehavior]. */
  msgSendULong(self: unknown, sel: unknown): number;
  /** void objc_msgSend(id, SEL, NSInteger) — -[NSWindow setLevel:]. */
  msgSendVoidLong(self: unknown, sel: unknown, arg: number): void;
  /** void objc_msgSend(id, SEL, NSUInteger) — -[NSWindow setCollectionBehavior:]. */
  msgSendVoidULong(self: unknown, sel: unknown, arg: number): void;
  /** Resolved desktop CGWindowLevel (with fallback baked in). */
  desktopLevel: number;
  selWindow: unknown;
  selLevel: unknown;
  selSetLevel: unknown;
  selCollectionBehavior: unknown;
  selSetCollectionBehavior: unknown;
}

let bridge: ObjcBridge | null = null;
let bridgeTried = false;

/** Build (once) the libobjc + CoreGraphics bindings. Returns null on any
 *  failure — callers then leave the window in plain window mode. */
function ensureBridge(): ObjcBridge | null {
  if (bridgeTried) return bridge;
  bridgeTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi') as Koffi;
    const objc = koffi.load('/usr/lib/libobjc.A.dylib');

    const sel_registerName = objc.func('sel_registerName', 'void *', ['str']);
    // objc_msgSend has no single ABI shape — bind one callable per call shape.
    // koffi resolves the same symbol independently for each prototype.
    const msgSendId = objc.func('objc_msgSend', 'void *', ['void *', 'void *']);
    const msgSendLong = objc.func('objc_msgSend', 'long', ['void *', 'void *']);
    const msgSendULong = objc.func('objc_msgSend', 'unsigned long', ['void *', 'void *']);
    const msgSendVoidLong = objc.func('objc_msgSend', 'void', ['void *', 'void *', 'long']);
    const msgSendVoidULong = objc.func('objc_msgSend', 'void', ['void *', 'void *', 'unsigned long']);

    let desktopLevel = KCG_DESKTOP_WINDOW_LEVEL_FALLBACK;
    try {
      const cg = koffi.load(
        '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics',
      );
      const CGWindowLevelForKey = cg.func('CGWindowLevelForKey', 'int32', ['int32']);
      desktopLevel = CGWindowLevelForKey(KCG_DESKTOP_WINDOW_LEVEL_KEY) as number;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[wallpaper:macos] CGWindowLevelForKey unavailable, using fallback level:',
        (e as Error).message,
      );
    }

    bridge = {
      msgSendId: (self, sel) => msgSendId(self, sel),
      msgSendLong: (self, sel) => msgSendLong(self, sel) as number,
      msgSendULong: (self, sel) => msgSendULong(self, sel) as number,
      msgSendVoidLong: (self, sel, arg) => void msgSendVoidLong(self, sel, arg),
      msgSendVoidULong: (self, sel, arg) => void msgSendVoidULong(self, sel, arg),
      desktopLevel,
      selWindow: sel_registerName('window'),
      selLevel: sel_registerName('level'),
      selSetLevel: sel_registerName('setLevel:'),
      selCollectionBehavior: sel_registerName('collectionBehavior'),
      selSetCollectionBehavior: sel_registerName('setCollectionBehavior:'),
    };
    return bridge;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:macos] objc bridge init failed; staying in window mode:', (e as Error).message);
    bridge = null;
    return null;
  }
}

/** Electron's getNativeWindowHandle() returns a Buffer wrapping the NSView*
 *  (pointer-sized, little-endian on x64/arm64). Read the pointer value and
 *  ask the view for its NSWindow. Mirrors windows.ts:electronHwnd — koffi
 *  accepts a bigint for `void *` handle params. Returns null if the handle
 *  isn't ready or the view has no window yet. */
function nsWindowOf(win: BrowserWindow, b: ObjcBridge): unknown {
  const viewPtr = win.getNativeWindowHandle().readBigInt64LE(0);
  if (viewPtr === 0n) return null;
  const nsWindow = b.msgSendId(viewPtr, b.selWindow);
  return nsWindow ?? null;
}

// --- Module state (saved on enter, restored on exit) -------------------------

interface WallpaperState {
  priorLevel: number | null;
  priorCollectionBehavior: number | null;
  preWallpaperBounds: Electron.Rectangle | null;
}
const state: WallpaperState = {
  priorLevel: null,
  priorCollectionBehavior: null,
  preWallpaperBounds: null,
};

// --- Public API --------------------------------------------------------------

export function enterWallpaper(win: BrowserWindow, display: Display): void {
  try {
    const b = ensureBridge();
    if (!b) return;
    if (win.isDestroyed()) return;
    const nsWindow = nsWindowOf(win, b);
    if (!nsWindow) {
      // eslint-disable-next-line no-console
      console.warn('[wallpaper:macos] no NSWindow for handle; staying in window mode');
      return;
    }

    // Capture originals once (guard against a double-enter from startup-restore
    // racing a tray click) so exit restores exactly what Electron configured.
    if (state.priorLevel === null) {
      state.priorLevel = b.msgSendLong(nsWindow, b.selLevel);
      state.priorCollectionBehavior = b.msgSendULong(nsWindow, b.selCollectionBehavior);
      state.preWallpaperBounds = win.getBounds();
    }

    // Drop to the desktop-picture level + all-Spaces/stationary behavior.
    b.msgSendVoidLong(nsWindow, b.selSetLevel, b.desktopLevel);
    b.msgSendVoidULong(nsWindow, b.selSetCollectionBehavior, WALLPAPER_COLLECTION_BEHAVIOR);

    // Cover the CHOSEN display (the tray multi-monitor picker passes it in),
    // go click-through, hide chrome + Dock icon (the menu-bar tray stays — the
    // macOS analogue of Windows' hide-from-Alt-Tab).
    const { x, y, width, height } = display.bounds;
    win.setBounds({ x, y, width, height });
    win.setIgnoreMouseEvents(true);
    win.setWindowButtonVisibility(false);
    app.setActivationPolicy('accessory');

    // eslint-disable-next-line no-console
    console.log(`[wallpaper:macos] entered — level ${b.desktopLevel}, behavior ${WALLPAPER_COLLECTION_BEHAVIOR}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:macos] enter failed:', (e as Error).message);
  }
}

export function exitWallpaper(win: BrowserWindow): void {
  try {
    const b = ensureBridge();
    if (!b) return;
    if (win.isDestroyed()) return;

    const nsWindow = nsWindowOf(win, b);
    if (nsWindow) {
      const level = state.priorLevel ?? NS_NORMAL_WINDOW_LEVEL;
      const behavior = state.priorCollectionBehavior ?? NS_COLLECTION_BEHAVIOR_DEFAULT;
      b.msgSendVoidLong(nsWindow, b.selSetLevel, level);
      b.msgSendVoidULong(nsWindow, b.selSetCollectionBehavior, behavior);
    }

    win.setIgnoreMouseEvents(false);
    win.setWindowButtonVisibility(true);
    app.setActivationPolicy('regular');
    if (state.preWallpaperBounds) win.setBounds(state.preWallpaperBounds);

    state.priorLevel = null;
    state.priorCollectionBehavior = null;
    state.preWallpaperBounds = null;
    // eslint-disable-next-line no-console
    console.log('[wallpaper:macos] exited');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[wallpaper:macos] exit failed:', (e as Error).message);
  }
}
