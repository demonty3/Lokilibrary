import { Application } from 'pixi.js';
import type { Theme } from '../themes/types';
import type { Profile } from '../types';
import { layoutCell } from '../procedural/cell';
import { profileSeed } from '../procedural/seed';
import { useAppStore } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { mountCell } from './levels/cell';
import { waitForCozette } from './fonts';

/**
 * Phase 1C PixiJS bootstrap. Creates the PIXI.Application once, awaits
 * Cozette, then dispatches to the active scale level's renderer. Phase
 * 1C implements `cell` only; Phase 1D adds the scale-ladder state
 * machine + district + stub levels and wires the subscribe-and-remount
 * path.
 *
 * Profile + library data is read from the Zustand store at mount; if
 * the user is anonymous (no profile yet), we fall back to SAMPLE_LIBRARY
 * + a stable demo seed so the renderer has something to draw on first
 * boot.
 *
 * Returns a teardown that destroys the Application + its canvas. Per
 * CLAUDE.md the Application stays alive for the full React mount; level
 * transitions only destroy the level's Container, not the Application.
 */
export async function mountPalace(
  container: HTMLDivElement,
  theme: Theme,
): Promise<() => void> {
  const app = new Application();
  await app.init({
    resizeTo: container,
    background: theme.palette.bg,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  container.appendChild(app.canvas);

  await waitForCozette();

  const { profile, spines, seed } = snapshotLibraryState();
  void profile; // unused at Phase 1C — reserved for the scale subscriber

  const layout = layoutCell(seed);
  const teardownLevel = mountCell(app, theme, layout, spines);

  return () => {
    teardownLevel();
    app.destroy(true, { children: true, texture: true });
  };
}

interface LibrarySnapshot {
  profile: Profile | null;
  spines: string[];
  seed: number;
}

/** Anonymous-user seed. Picked to give a visually interesting WFC
 *  outcome on the sample library; changing this changes every
 *  not-signed-in demo. */
const ANONYMOUS_SEED = 0xa11ce11 >>> 0;

function snapshotLibraryState(): LibrarySnapshot {
  const state = useAppStore.getState();
  const profile = state.profile;
  if (profile) {
    return {
      profile,
      spines: profile.topGames.map((g) => g.name),
      seed: profileSeed(profile),
    };
  }
  return {
    profile: null,
    spines: SAMPLE_LIBRARY.map((g) => g.name),
    seed: ANONYMOUS_SEED,
  };
}
