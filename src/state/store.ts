import { create } from 'zustand';
import { fetchWorld } from '../api/world';
import { fetchMe, logout as logoutRequest } from '../api/auth';
import { fetchLibrary, type LibraryFailureReason } from '../api/library';
import { signInWithSteamTicket, type ThrottleState } from '../api/electron';
import type { Manifest } from '../ai/manifest';
import type {
  LibraryGame,
  PaneDescriptor,
  PaneRect,
  Profile,
  ScaleLevel,
  SteamPersona,
} from '../types';

export type ManifestStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';
export type LibraryStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Phase 7-B — named pane arrangements. 'single' is the back-compat default
 *  (one full-grid cell pane); 'study' is the demo composition (cell + district
 *  side-by-side). More presets ('tour', 'voyage') deferred. */
export type ArrangementName = 'single' | 'study';

/** The boot level of the default single pane — the back-compat anchor. */
const BOOT_LEVEL: ScaleLevel = 'cell';

/**
 * Phase 7-B — the back-compat hinge. Returns the FOCUSED pane's level, which
 * every focus/level-mutating reducer mirrors into the top-level `scale` field
 * in the SAME set() so PixiApp's `state.scale !== prev.scale` subscribe diff
 * keeps firing. Falls back to BOOT_LEVEL if focus is somehow dangling (it never
 * should be — closePane refocuses a survivor — but this keeps the invariant
 * total rather than throwing). Pure: no side effects, no store reads.
 */
function syncScaleToFocused(
  panes: readonly PaneDescriptor[],
  focusedPaneId: string,
): ScaleLevel {
  const focused = panes.find((p) => p.id === focusedPaneId);
  return focused ? focused.level : BOOT_LEVEL;
}

/**
 * Phase 7-B — the default single-pane state. ONE 'root' pane covering the whole
 * 1×1 grid at the boot level. This IS the back-compat default; `setArrangement
 * ('single')` restores exactly this. Returned fresh each call so callers never
 * share a mutable pane array. `paneSeq` resets to 1 so the next split is
 * deterministic from a reset (the smoke's split-twice-from-reset assertion).
 */
function singlePaneState(): {
  panes: PaneDescriptor[];
  focusedPaneId: string;
  gridCols: number;
  gridRows: number;
  paneSeq: number;
  scale: ScaleLevel;
} {
  return {
    panes: [{ id: 'root', level: BOOT_LEVEL, rect: { col: 0, row: 0, cols: 1, rows: 1 } }],
    focusedPaneId: 'root',
    gridCols: 1,
    gridRows: 1,
    paneSeq: 1,
    scale: BOOT_LEVEL,
  };
}

/**
 * Top-level app state. Auth, library, profile, manifest, and Electron
 * wallpaper/peek toggles. Pure data — no renderer dependencies.
 */
interface AppState {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;

  prompt: string | null;
  setPrompt: (s: string | null) => void;

  manifest: Manifest | null;
  manifestStatus: ManifestStatus;
  manifestSource: 'worker' | 'stub' | null;
  manifestError: string | null;
  loadManifest: () => Promise<void>;

  authStatus: AuthStatus;
  steamId: string | null;
  persona: SteamPersona | null;
  loadAuth: () => Promise<void>;
  signOut: () => Promise<void>;

  library: LibraryGame[] | null;
  libraryStatus: LibraryStatus;
  libraryError: { reason: LibraryFailureReason; message: string } | null;
  totalGames: number | null;
  topN: number;
  profile: Profile | null;
  loadLibrary: (options?: { force?: boolean }) => Promise<void>;

  wallpaperMode: boolean;
  setWallpaperMode: (v: boolean) => void;

  /** Phase 4 slice 4A: three-tier wallpaper throttle. 'full' in the web
   *  build (no throttling — the user has the canvas focused directly).
   *  In wallpaper mode, drops to 'throttled-1hz' when a window covers
   *  >50% of the monitor and to 'paused' when a fullscreen app is
   *  foreground. PixiApp subscribes + adjusts app.ticker.maxFPS /
   *  stop(). */
  throttleState: ThrottleState;
  setThrottleState: (state: ThrottleState) => void;

  /** Scale-ladder level. Phase 1 implements `cell` + `district`; the
   *  other four mount a "not yet built" stub. The level renderer
   *  subscribes to this slice and tears down + remounts on change.
   *
   *  Phase 7-B — `scale` is now a kept-in-sync MIRROR of the FOCUSED pane's
   *  level (a real written field, NOT a derived selector — so PixiApp's
   *  `state.scale !== prev.scale` subscribe diff keeps firing exactly as
   *  before). Every reducer that can change focus or the focused pane's
   *  level re-writes `scale` in the same set() via `syncScaleToFocused`, so
   *  the invariant `scale === focused pane level` can never drift.
   *  `setScale` is rewired to mutate the FOCUSED pane's level (and mirror
   *  `scale`), so App.tsx's `[`/`]` zoom keeps working unchanged. With the
   *  default single 'root' pane this is behavior-equivalent to the old
   *  scalar. */
  scale: ScaleLevel;
  setScale: (level: ScaleLevel) => void;

  /** Phase 7-B — composable panes. The renderer mounts ONE level Container
   *  per pane, clipped to the pane's rect. DEFAULT = a single 'root' pane
   *  covering the whole 1×1 grid at level 'cell' (back-compat with the old
   *  scale scalar). All ids come from `paneSeq` only — deterministic, no
   *  Math.random/Date.now, so src/procedural's reproducibility contract is
   *  untouched. */
  panes: PaneDescriptor[];
  /** The pane that owns input + that `setScale`/`[`/`]` zoom mutate. Always
   *  references an existing pane (never dangling — closePane refocuses a
   *  survivor). */
  focusedPaneId: string;
  /** Composition-grid dimensions. The 'single' arrangement is 1×1; 'study'
   *  grows to 2×1. PaneRects address cells of this grid. */
  gridCols: number;
  gridRows: number;
  /** Monotonic counter for deterministic pane ids. */
  paneSeq: number;

  /** Split the FOCUSED pane in two along `axis`, growing the grid as needed
   *  and re-tiling deterministically. The new pane inherits the focused
   *  pane's level; focus stays on the original. */
  splitPane: (axis: 'horizontal' | 'vertical') => void;
  /** Remove a pane by id. No-op on the last pane (never zero panes). Closing
   *  the focused pane refocuses a survivor + re-syncs `scale`. */
  closePane: (id: string) => void;
  /** Focus a pane by id. No-op if the id doesn't exist. Re-syncs `scale`. */
  focusPane: (id: string) => void;
  /** Advance focus to the next pane in array order, wrapping. No-op with one
   *  pane. Re-syncs `scale`. */
  cycleFocus: () => void;
  /** Set a specific pane's level. Re-syncs `scale` only when `id` is the
   *  focused pane. */
  setPaneLevel: (id: string, level: ScaleLevel) => void;
  /** Swap the whole arrangement. 'single' restores the exact default;
   *  'study' = a cell pane + a district pane side-by-side, focus on cell. */
  setArrangement: (name: ArrangementName) => void;
  /** Phase 7 / v2.x — region terminals. Cycle the FOCUSED cell pane through
   *  `[whole-library, …regionIds]`: undefined → regionIds[0] → … → last →
   *  undefined. `regionIds` is the live wing list (district ids), computed by
   *  the caller from the current library so the store stays free of the
   *  cluster-tree derivation. No-op when the focused pane is not a cell. */
  cycleFocusedPaneRegion: (regionIds: readonly string[]) => void;
  /** Phase 7 / v2.x — bind a specific pane to a region wing (or clear it with
   *  undefined). Used to make a freshly-split pane render a DIFFERENT wing than
   *  its sibling, so a split immediately yields two distinct worlds. Pure
   *  setter; no-op if the id is unknown or already on that region. */
  setPaneRegion: (id: string, regionId: string | undefined) => void;

  /** Phase 2F: telemetry overlay visibility. Toggled by Ctrl+\` in
   *  App.tsx; the overlay renderer subscribes + mounts/unmounts. */
  agentDebugOverlay: boolean;
  toggleAgentDebug: () => void;

  /** Phase 5C.2b: lore-upload drop-zone visibility. Toggled by Ctrl+U in
   *  App.tsx; the LoreDropZone DOM component (sibling of the canvas)
   *  reads this for visibility. A drop-zone is a DOM file-API surface,
   *  not a PIXI overlay. */
  loreUploadOpen: boolean;
  toggleLoreUpload: () => void;
  setLoreUploadOpen: (v: boolean) => void;

  /** Phase 5D — lore-driven world adaptation. OPT-IN, default OFF. Gates
   *  whether lore-derived signal may LEAVE the device (agent persona/reflect
   *  lore context now; Stage 1 manifest digest in 5D.4). Local lore-weighted
   *  scatter is computed on-device and is unaffected by this flag. */
  loreEnabled: boolean;
  setLoreEnabled: (on: boolean) => void;

  /** Phase 5D.4 — SECOND, INDEPENDENT lore egress opt-in (default OFF).
   *  Gates whether retrieved RAW lore excerpts (uploaded text + source
   *  filename) are sent to the model so agents can reference specific names
   *  and places. Distinct from `loreEnabled` (closed-vocab {themes,tone}
   *  only): either, both, or neither may be on. */
  loreQuoteEnabled: boolean;
  setLoreQuoteEnabled: (on: boolean) => void;

  /** Phase 5D.4 — monotonic counter bumped after a successful lore ingest.
   *  App.tsx's palace-mount effect depends on this so the world remounts
   *  with the theme recomputed from the (now larger) lore corpus. Palette
   *  recolor is LOCAL and applies whenever lore exists — it is independent
   *  of the `loreEnabled` egress toggle. */
  loreVersion: number;
  bumpLoreVersion: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),

  prompt: null,
  setPrompt: (s) => {
    if (get().prompt !== s) set({ prompt: s });
  },

  manifest: null,
  manifestStatus: 'idle',
  manifestSource: null,
  manifestError: null,
  loadManifest: async () => {
    if (get().manifestStatus === 'loading') return;
    set({ manifestStatus: 'loading', manifestError: null });
    const { manifest, source, fallbackReason } = await fetchWorld();
    set({
      manifest,
      manifestSource: source,
      manifestStatus: 'loaded',
      manifestError: fallbackReason ?? null,
    });
  },

  authStatus: 'idle',
  steamId: null,
  persona: null,
  loadAuth: async () => {
    if (get().authStatus === 'loading') return;
    set({ authStatus: 'loading' });
    await signInWithSteamTicket();
    const me = await fetchMe();
    set({
      authStatus: me.authenticated ? 'authenticated' : 'anonymous',
      steamId: me.steamId ?? null,
      persona: me.persona ?? null,
    });
    // Slice 2G: cascade into loadLibrary so profile populates and the
    // cell renderer (which subscribes to profile changes) re-seeds with
    // the user's real top games. Covers both first-time auth and the
    // cookie-restored boot path. Fire-and-forget — failures land in
    // libraryStatus/libraryError, not on this caller's promise.
    if (me.authenticated) {
      void get().loadLibrary();
    }
  },
  signOut: async () => {
    await logoutRequest();
    set({
      authStatus: 'anonymous',
      steamId: null,
      persona: null,
      library: null,
      libraryStatus: 'idle',
      libraryError: null,
      totalGames: null,
      profile: null,
    });
  },

  library: null,
  libraryStatus: 'idle',
  libraryError: null,
  totalGames: null,
  topN: 15,
  profile: null,
  loadLibrary: async (options) => {
    if (get().libraryStatus === 'loading') return;
    set({ libraryStatus: 'loading', libraryError: null });
    const result = await fetchLibrary(options);
    if (result.ok) {
      set({
        library: result.library.games,
        totalGames: result.library.totalGames,
        topN: result.library.topN,
        persona: result.library.persona ?? get().persona,
        profile: result.library.profile,
        libraryStatus: 'loaded',
        libraryError: null,
      });
    } else {
      set({
        libraryStatus: 'error',
        libraryError: { reason: result.reason, message: result.message },
      });
    }
  },

  wallpaperMode: false,
  setWallpaperMode: (v) => {
    if (get().wallpaperMode !== v) set({ wallpaperMode: v });
  },

  throttleState: 'full',
  setThrottleState: (state) => {
    if (get().throttleState !== state) set({ throttleState: state });
  },

  // Phase 7-B — the default single 'root' pane covering the whole 1×1 grid at
  // the boot level. `scale` is the kept-in-sync mirror of the focused pane's
  // level (here, the only pane). This block IS the back-compat default.
  ...singlePaneState(),
  setScale: (level) => {
    // Back-compat: mutate the FOCUSED pane's level + mirror `scale` in the
    // SAME set(). App.tsx's `[`/`]` handler reads `scale` and calls this
    // unchanged; with the default single pane it zooms that pane exactly as
    // the old scalar did.
    const { panes, focusedPaneId } = get();
    const idx = panes.findIndex((p) => p.id === focusedPaneId);
    if (idx < 0) return;
    if (panes[idx].level === level) return; // no-op (matches old guard)
    const next = panes.slice();
    next[idx] = { ...next[idx], level };
    set({ panes: next, scale: syncScaleToFocused(next, focusedPaneId) });
  },

  splitPane: (axis) => {
    const state = get();
    const { panes, focusedPaneId, gridCols, gridRows, paneSeq } = state;
    const focused = panes.find((p) => p.id === focusedPaneId);
    if (!focused) return;
    const newId = `p${paneSeq + 1}`;
    // Grow the grid along the split axis (uniform integer grid). Existing
    // rects scale up to keep their proportion; the focused pane's slot is
    // bisected into the original (kept) + the new pane.
    let nextCols = gridCols;
    let nextRows = gridRows;
    let nextPanes: PaneDescriptor[];
    if (axis === 'vertical') {
      // Split into a left + right half along columns.
      nextCols = gridCols * 2;
      nextPanes = panes.map((p) => {
        const scaled: PaneRect = {
          col: p.rect.col * 2,
          row: p.rect.row,
          cols: p.rect.cols * 2,
          rows: p.rect.rows,
        };
        if (p.id !== focusedPaneId) return { ...p, rect: scaled };
        // Focused pane keeps the left half.
        const half = Math.max(1, Math.floor(scaled.cols / 2));
        return { ...p, rect: { ...scaled, cols: half } };
      });
      const f = nextPanes.find((p) => p.id === focusedPaneId)!;
      nextPanes.push({
        id: newId,
        level: focused.level,
        rect: {
          col: f.rect.col + f.rect.cols,
          row: f.rect.row,
          cols: f.rect.cols, // right half mirrors the left half's width
          rows: f.rect.rows,
        },
      });
    } else {
      // Horizontal split → a top + bottom half along rows.
      nextRows = gridRows * 2;
      nextPanes = panes.map((p) => {
        const scaled: PaneRect = {
          col: p.rect.col,
          row: p.rect.row * 2,
          cols: p.rect.cols,
          rows: p.rect.rows * 2,
        };
        if (p.id !== focusedPaneId) return { ...p, rect: scaled };
        const half = Math.max(1, Math.floor(scaled.rows / 2));
        return { ...p, rect: { ...scaled, rows: half } };
      });
      const f = nextPanes.find((p) => p.id === focusedPaneId)!;
      nextPanes.push({
        id: newId,
        level: focused.level,
        rect: {
          col: f.rect.col,
          row: f.rect.row + f.rect.rows,
          cols: f.rect.cols,
          rows: f.rect.rows,
        },
      });
    }
    set({
      panes: nextPanes,
      gridCols: nextCols,
      gridRows: nextRows,
      paneSeq: paneSeq + 1,
      // Focus stays on the original pane; scale is unchanged but re-synced
      // for invariant safety.
      scale: syncScaleToFocused(nextPanes, focusedPaneId),
    });
  },

  closePane: (id) => {
    const { panes, focusedPaneId } = get();
    if (panes.length <= 1) return; // never zero panes
    if (!panes.some((p) => p.id === id)) return;
    const next = panes.filter((p) => p.id !== id);
    // If the focused pane was closed, refocus a survivor (the first
    // remaining pane) so focusedPaneId never dangles + scale re-syncs.
    const nextFocus = id === focusedPaneId ? next[0].id : focusedPaneId;
    set({
      panes: next,
      focusedPaneId: nextFocus,
      scale: syncScaleToFocused(next, nextFocus),
    });
  },

  focusPane: (id) => {
    const { panes, focusedPaneId } = get();
    if (id === focusedPaneId) return;
    if (!panes.some((p) => p.id === id)) return; // bad id → no-op
    set({ focusedPaneId: id, scale: syncScaleToFocused(panes, id) });
  },

  cycleFocus: () => {
    const { panes, focusedPaneId } = get();
    if (panes.length <= 1) return;
    const idx = panes.findIndex((p) => p.id === focusedPaneId);
    const nextIdx = ((idx < 0 ? 0 : idx) + 1) % panes.length;
    const nextId = panes[nextIdx].id;
    set({ focusedPaneId: nextId, scale: syncScaleToFocused(panes, nextId) });
  },

  setPaneLevel: (id, level) => {
    const { panes, focusedPaneId } = get();
    const idx = panes.findIndex((p) => p.id === id);
    if (idx < 0) return;
    if (panes[idx].level === level) return;
    const next = panes.slice();
    next[idx] = { ...next[idx], level };
    // Re-sync scale only when the changed pane is the focused one.
    set({ panes: next, scale: syncScaleToFocused(next, focusedPaneId) });
  },

  setArrangement: (name) => {
    if (name === 'single') {
      set(singlePaneState());
      return;
    }
    // 'study' — a cell pane (left) + a district pane (right) on a 2×1 grid,
    // focus on the cell. Deterministic ids from a fresh seq.
    set({
      panes: [
        { id: 'root', level: 'cell', rect: { col: 0, row: 0, cols: 1, rows: 1 } },
        { id: 'p2', level: 'district', rect: { col: 1, row: 0, cols: 1, rows: 1 } },
      ],
      focusedPaneId: 'root',
      gridCols: 2,
      gridRows: 1,
      paneSeq: 2,
      scale: 'cell',
    });
  },

  cycleFocusedPaneRegion: (regionIds) => {
    const { panes, focusedPaneId } = get();
    const idx = panes.findIndex((p) => p.id === focusedPaneId);
    if (idx < 0) return;
    // Region terminals only apply to a cell pane (the only level that takes a
    // seed + shelf games). Leave district/island/… panes untouched.
    if (panes[idx].level !== 'cell') return;
    // Walk [whole-library, …wings]. undefined sits at slot 0, so the current
    // undefined (or an id that fell out of the live list → indexOf -1 → 0)
    // advances to the first wing, and the last wing wraps back to whole-library.
    const order: (string | undefined)[] = [undefined, ...regionIds];
    const nextRegion = order[(order.indexOf(panes[idx].regionId) + 1) % order.length];
    const next = panes.slice();
    next[idx] = { ...next[idx], regionId: nextRegion };
    // No scale re-sync: a region swap never changes the pane's level.
    set({ panes: next });
  },

  setPaneRegion: (id, regionId) => {
    const { panes } = get();
    const idx = panes.findIndex((p) => p.id === id);
    if (idx < 0 || panes[idx].regionId === regionId) return;
    const next = panes.slice();
    next[idx] = { ...next[idx], regionId };
    set({ panes: next });
  },

  agentDebugOverlay: false,
  toggleAgentDebug: () => set({ agentDebugOverlay: !get().agentDebugOverlay }),

  loreUploadOpen: false,
  toggleLoreUpload: () => set({ loreUploadOpen: !get().loreUploadOpen }),
  setLoreUploadOpen: (v) => {
    if (get().loreUploadOpen !== v) set({ loreUploadOpen: v });
  },

  loreEnabled: false,
  setLoreEnabled: (on) => {
    if (get().loreEnabled !== on) set({ loreEnabled: on });
  },

  loreQuoteEnabled: false,
  setLoreQuoteEnabled: (on) => {
    if (get().loreQuoteEnabled !== on) set({ loreQuoteEnabled: on });
  },

  loreVersion: 0,
  bumpLoreVersion: () => set({ loreVersion: get().loreVersion + 1 }),
}));
