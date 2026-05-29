import { create } from 'zustand';
import { fetchWorld } from '../api/world';
import { fetchMe, logout as logoutRequest } from '../api/auth';
import { fetchLibrary, type LibraryFailureReason } from '../api/library';
import { signInWithSteamTicket, type ThrottleState } from '../api/electron';
import type { Manifest } from '../ai/manifest';
import type { LibraryGame, Profile, ScaleLevel, SteamPersona } from '../types';

export type ManifestStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';
export type LibraryStatus = 'idle' | 'loading' | 'loaded' | 'error';

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
   *  subscribes to this slice and tears down + remounts on change. */
  scale: ScaleLevel;
  setScale: (level: ScaleLevel) => void;

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

  scale: 'cell',
  setScale: (level) => {
    if (get().scale !== level) set({ scale: level });
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
}));
