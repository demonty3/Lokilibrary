import { Application } from 'pixi.js';
import type { Theme } from '../themes/types';
import type { Profile, ScaleLevel } from '../types';
import { layoutCell } from '../procedural/cell';
import { profileSeed } from '../procedural/seed';
import { useAppStore, type AppState } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { deriveStats } from '../procedural/macro';
import { mountCell } from './levels/cell';
import { mountDistrict } from './levels/district';
import { mountStubLevel } from './levels/stub';
import { mountReveal, type RevealContext } from './reveal';
import { waitForCozette } from './fonts';

/**
 * Phase 1D PixiJS bootstrap + level router. Creates the PIXI.Application
 * once, awaits Cozette, mounts the level matching the Zustand `scale`
 * slice, and subscribes to slice changes to tear down + remount on
 * transition. **The Application stays alive across level changes**
 * (CLAUDE.md rule); only the per-level Container is destroyed.
 *
 * Profile + library data is read from the Zustand store at each mount;
 * if the user is anonymous (no profile yet), we fall back to
 * SAMPLE_LIBRARY + a stable demo seed so the renderer has something to
 * draw on first boot. When the profile loads later (from /api/library),
 * the cell does NOT auto-remount — the scale slice is the only
 * remount trigger in Phase 1. Phase 2 will subscribe to profile
 * changes too so signing in actually re-seeds the room.
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

  let teardown: () => void = mountFor(app, theme, useAppStore.getState());

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    const revealChanged = state.revealStatus !== prev.revealStatus;
    const scaleChanged = state.scale !== prev.scale;
    if (!revealChanged && !scaleChanged) return;
    // While the reveal is playing it owns the screen — ignore scale changes.
    if (state.revealStatus === 'playing' && !revealChanged) return;
    teardown();
    teardown = mountFor(app, theme, state);
  });

  return () => {
    unsubscribe();
    teardown();
    app.destroy(true, { children: true, texture: true });
  };
}

/** Mount whatever the current state calls for: the reveal cinematic while it's
 *  playing, otherwise the interactive level for the active scale. */
function mountFor(app: Application, theme: Theme, state: AppState): () => void {
  if (state.revealStatus === 'playing') {
    return mountReveal(app, theme, buildRevealContext(), () =>
      useAppStore.getState().endReveal(),
    );
  }
  return mountLevel(app, theme, state.scale);
}

/** Assemble the reveal's draw context from the live library snapshot. Same
 *  seed → same reveal (determinism contract). */
function buildRevealContext(): RevealContext {
  const { profile, spines, seed } = snapshotLibraryState();
  const stats = deriveStats(profile, SAMPLE_LIBRARY.length);
  const heroAppids = profile
    ? profile.topGames.map((g) => g.appid)
    : SAMPLE_LIBRARY.map((g) => g.appid);
  const persona = useAppStore.getState().persona;
  const totalGames = profile?.totalGames ?? SAMPLE_LIBRARY.length;
  const hours = profile?.totalPlaytimeHours ?? 0;
  return {
    seed,
    spines,
    heroAppids,
    stats,
    title: persona?.name ?? 'your library',
    gamesLabel: `${totalGames.toLocaleString()} games`,
    hoursLabel: hours > 0 ? `${Math.round(hours).toLocaleString()} h played` : 'a new library',
  };
}

function mountLevel(
  app: Application,
  theme: Theme,
  scale: ScaleLevel,
): () => void {
  if (scale === 'cell') {
    const { spines, seed } = snapshotLibraryState();
    const layout = layoutCell(seed);
    return mountCell(app, theme, layout, spines, seed);
  }
  if (scale === 'district') {
    return mountDistrict(app, theme);
  }
  return mountStubLevel(app, theme, scale);
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

export function snapshotLibraryState(): LibrarySnapshot {
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
