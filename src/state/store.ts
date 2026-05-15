import { create } from 'zustand';

/**
 * Top-level UI state. Connection state for Steam / Claude / asset libraries
 * also lives here once the relevant backend pieces land; for v0.1 the panel
 * surfaces placeholders that document the architecture.
 */
interface AppState {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;

  /** Footer interaction prompt — e.g. "[E] Open system". null hides the line. */
  prompt: string | null;
  setPrompt: (s: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),

  prompt: null,
  setPrompt: (s) => {
    if (get().prompt !== s) set({ prompt: s });
  },
}));
