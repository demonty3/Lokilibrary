import { create } from 'zustand';
import { fetchWorld } from '../api/world';
import { fetchMe, logout as logoutRequest } from '../api/auth';
import { fetchLibrary, type LibraryFailureReason } from '../api/library';
import { createShare, fetchShare } from '../api/share';
import { signInWithSteamTicket } from '../api/electron';
import type { Manifest } from '../ai/manifest';
import type { LibraryGame, Profile, SteamPersona } from '../types';

export type ManifestStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';
export type LibraryStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type ShareCreateStatus = 'idle' | 'creating' | 'done' | 'error';

/**
 * Top-level UI + world state. Connection state for Steam / Claude / asset
 * libraries also lives here once the relevant backend pieces land; for v0.1
 * the panel surfaces real status for the Stage 1 worker call.
 *
 * playerPosition stays out of this store (see state/playerPos.ts) — it mutates
 * 60×/sec and React re-renders would tank the frame rate.
 */
interface AppState {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;

  /** Footer interaction prompt — e.g. "[E] Open system". null hides the line. */
  prompt: string | null;
  setPrompt: (s: string | null) => void;

  /** Stage 1 manifest. null until the load finishes. */
  manifest: Manifest | null;
  manifestStatus: ManifestStatus;
  manifestSource: 'worker' | 'stub' | null;
  manifestError: string | null;
  loadManifest: () => Promise<void>;

  /** Steam OpenID auth state. Phase 2 slice 1; library + profile arrive in
   *  later slices. The cookie is HttpOnly so we can't read it directly —
   *  loadAuth() asks the worker. */
  authStatus: AuthStatus;
  steamId: string | null;
  persona: SteamPersona | null;
  loadAuth: () => Promise<void>;
  signOut: () => Promise<void>;

  /** Owned-games list from /api/library (Phase 2 slice 2). Renderer still uses
   *  the hard-coded library through slice 6; this surfaces in the connector
   *  panel and feeds the profile builder in slice 5. */
  library: LibraryGame[] | null;
  libraryStatus: LibraryStatus;
  libraryError: { reason: LibraryFailureReason; message: string } | null;
  totalGames: number | null;
  topN: number;
  /** Behavioral profile (slice 5). Stage 1 prompt at slice 7 will consume
   *  profile.summary; the panel surfaces a preview now. */
  profile: Profile | null;
  loadLibrary: (options?: { force?: boolean }) => Promise<void>;

  /** Active launch ritual — the 1.8s pre-launch animation, set when the
   *  player presses E. Cleared when steam://run fires. */
  activeRitual: ActiveRitual | null;
  startRitual: (r: ActiveRitual) => void;
  clearRitual: () => void;

  /** True between steam://run firing and the tab regaining focus. The window
   *  is presumed gone in this window of time. */
  inFlight: boolean;
  setInFlight: (v: boolean) => void;

  /** Brief return animation flag — toggled on by the focus handler when
   *  inFlight, cleared after a short tween. */
  returnPending: boolean;
  markReturnPending: () => void;
  clearReturn: () => void;

  // --- Phase 5 slice 3 — share-URL viewer / creator. -----------------------

  /** True when rendering someone else's world. Pressing E doesn't fire
   *  steam:// in this mode — it surfaces a tooltip. */
  viewOnly: boolean;
  /** When viewOnly, this is the procedural seed the creator's machine
   *  computed. The renderer feeds it to layoutForSeed() to reproduce the
   *  same world the creator was looking at. */
  sharedSeed: number | null;
  /** When viewOnly, the dusty count from the creator's library — drives the
   *  backlog cluster size without needing the full owned-games array. */
  sharedDustyCount: number;
  /** When viewOnly, the share id that was opened (for telemetry / UI). */
  sharedId: string | null;
  /** loadSharedWorld swaps the store into view-only mode rather than
   *  triggering an auth round-trip. Called from App.tsx when the path
   *  matches /w/:id. */
  loadSharedWorld: (id: string) => Promise<void>;

  // --- Phase 6 slice 4 — wallpaper mode (Electron only). ------------------

  /** True when the Electron desktop wrapper is rendering as a live wallpaper
   *  behind the desktop. In this mode the renderer skips PointerLockControls,
   *  Footer, ConnectorPanel — the canvas is click-through and we have no
   *  reliable way to drive interaction. Mode-switching happens via the
   *  system tray. Always false in the web build. */
  wallpaperMode: boolean;
  setWallpaperMode: (v: boolean) => void;

  /** Share-button state in the connector panel. */
  shareCreateStatus: ShareCreateStatus;
  shareUrl: string | null;
  shareError: string | null;
  createCurrentShare: () => Promise<void>;
  resetShareCreate: () => void;
}

export interface ActiveRitual {
  appid: number;
  archetype: string;
  /** Performance.now() timestamp when the ritual was kicked off. */
  startedAt: number;
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
    // Phase 6 slice 2: in the Electron wrapper, exchange a Steamworks
    // AuthSessionTicket for an lw_session cookie before fetchMe() reads
    // it. No-op in the web build (signInWithSteamTicket returns early
    // when window.electronAPI is absent).
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

  activeRitual: null,
  startRitual: (r) => {
    if (get().activeRitual || get().inFlight) return;
    set({ activeRitual: r, prompt: null });
  },
  clearRitual: () => set({ activeRitual: null }),

  inFlight: false,
  setInFlight: (v) => set({ inFlight: v }),

  returnPending: false,
  markReturnPending: () => set({ returnPending: true }),
  clearReturn: () => set({ returnPending: false }),

  viewOnly: false,
  sharedSeed: null,
  sharedDustyCount: 0,
  sharedId: null,
  loadSharedWorld: async (id) => {
    set({ manifestStatus: 'loading' });
    const share = await fetchShare(id);
    if (!share) {
      set({
        manifestStatus: 'error',
        manifestError: `share ${id} not found`,
        manifestSource: 'stub',
      });
      return;
    }
    // Populate the store like the user's own world, but flipped to view-only.
    // Library is just the shared top-N — enough for name + state lookups in
    // CastedWorld; the dusty cluster reads sharedDustyCount instead of
    // filtering the library array.
    set({
      manifest: share.manifest,
      manifestStatus: 'loaded',
      manifestSource: 'worker',
      manifestError: null,
      library: share.topLibrary,
      libraryStatus: 'loaded',
      totalGames: share.topLibrary.length + share.dustyCount,
      topN: share.topLibrary.length,
      persona: share.persona ?? null,
      profile: null,
      viewOnly: true,
      sharedSeed: share.profileSeed,
      sharedDustyCount: share.dustyCount,
      sharedId: id,
    });
  },

  wallpaperMode: false,
  setWallpaperMode: (v) => {
    if (get().wallpaperMode !== v) set({ wallpaperMode: v });
  },

  shareCreateStatus: 'idle',
  shareUrl: null,
  shareError: null,
  createCurrentShare: async () => {
    const { profile, shareCreateStatus } = get();
    if (shareCreateStatus === 'creating') return;
    if (!profile) {
      set({ shareCreateStatus: 'error', shareError: 'profile not loaded' });
      return;
    }
    // Compute the seed client-side. The worker accepts it verbatim — see
    // the design note in worker/lib/share.ts: this is a user-initiated
    // share of their own world; no security gain from worker-side recompute.
    const { profileSeed } = await import('../procedural/seed');
    const seed = profileSeed(profile);
    set({ shareCreateStatus: 'creating', shareError: null });
    const result = await createShare(seed);
    if (result.ok) {
      set({
        shareCreateStatus: 'done',
        shareUrl: result.share.url,
        shareError: null,
      });
    } else {
      set({
        shareCreateStatus: 'error',
        shareError: result.message,
        shareUrl: null,
      });
    }
  },
  resetShareCreate: () => set({ shareCreateStatus: 'idle', shareUrl: null, shareError: null }),
}));
