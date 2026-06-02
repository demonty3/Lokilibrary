import { create } from 'zustand';
import { fetchWorld } from '../api/world';
import { fetchMe, logout as logoutRequest } from '../api/auth';
import { fetchLibrary, type LibraryFailureReason } from '../api/library';
import { signInWithSteamTicket } from '../api/electron';
import type { Manifest } from '../ai/manifest';
import type { LibraryGame, Profile, ScaleLevel, SteamPersona } from '../types';

export type ManifestStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';
export type LibraryStatus = 'idle' | 'loading' | 'loaded' | 'error';
/** First-run cinematic reveal. `playing` swaps the interactive level for the
 *  reveal scene; `done` drops back into the live cell. */
export type RevealStatus = 'idle' | 'playing' | 'done';

/**
 * Top-level app state. Auth, library, profile, manifest, and Electron
 * wallpaper/peek toggles. Pure data — no renderer dependencies.
 */
export interface AppState {
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

  /** Scale-ladder level. Phase 1 implements `cell` + `district`; the
   *  other four mount a "not yet built" stub. The level renderer
   *  subscribes to this slice and tears down + remounts on change. */
  scale: ScaleLevel;
  setScale: (level: ScaleLevel) => void;

  /** First-run reveal flythrough. `playReveal` swaps the interactive level
   *  for the cinematic (and resets scale to `cell` so it ends in the room);
   *  `endReveal` is called by the reveal scene's onComplete. */
  revealStatus: RevealStatus;
  playReveal: () => void;
  endReveal: () => void;
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

  scale: 'cell',
  setScale: (level) => {
    if (get().scale !== level) set({ scale: level });
  },

  revealStatus: 'idle',
  playReveal: () => set({ revealStatus: 'playing', scale: 'cell' }),
  endReveal: () => set({ revealStatus: 'done' }),
}));
