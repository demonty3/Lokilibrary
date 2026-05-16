import { create } from 'zustand';
import { fetchWorld } from '../api/world';
import type { Manifest } from '../ai/manifest';

export type ManifestStatus = 'idle' | 'loading' | 'loaded' | 'error';

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

  /** Active ritual, if any. Drives the launch animation + steam://run dispatch. */
  activeRitual: ActiveRitual | null;
  startRitual: (r: ActiveRitual) => void;
  clearRitual: () => void;

  /** Has the player returned from a launched game (focus event fired)? */
  returnPending: boolean;
  markReturnPending: () => void;
  clearReturn: () => void;
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

  activeRitual: null,
  startRitual: (r) => {
    if (get().activeRitual) return;
    set({ activeRitual: r });
  },
  clearRitual: () => set({ activeRitual: null }),

  returnPending: false,
  markReturnPending: () => set({ returnPending: true }),
  clearReturn: () => set({ returnPending: false }),
}));
