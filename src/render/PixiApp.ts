import { Application } from 'pixi.js';
import type { Theme } from '../themes/types';
import type { Profile, ScaleLevel } from '../types';
import { layoutCell } from '../procedural/cell';
import { profileSeed } from '../procedural/seed';
import { useAppStore } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { mountCell } from './levels/cell';
import { mountDistrict } from './levels/district';
import { mountStubLevel } from './levels/stub';
import { mountTelemetryOverlay } from './overlays/telemetry';
import { waitForCozette } from './fonts';
import { nullMemoryWriter, type MemoryWriter } from '../agents/router';

export interface BookGame {
  appid: number;
  name: string;
}

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
export interface MountPalaceOptions {
  /** Optional memory writer — Electron path passes the DB-backed
   *  writer (slice 2F bootstrap), web build passes nothing and gets
   *  the null writer. */
  memoryWriter?: MemoryWriter;
}

export async function mountPalace(
  container: HTMLDivElement,
  theme: Theme,
  options: MountPalaceOptions = {},
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

  const memoryWriter = options.memoryWriter ?? nullMemoryWriter;

  let teardownLevel: () => void = mountLevel(
    app,
    theme,
    useAppStore.getState().scale,
    memoryWriter,
  );

  // Telemetry overlay (Phase 2F) — mounted on demand by the
  // `agentDebugOverlay` subscription. Lives at the app level (not the
  // cell level) so it stays visible across scale transitions.
  let teardownOverlay: (() => void) | null = null;
  function applyOverlay(on: boolean): void {
    if (on && !teardownOverlay) {
      teardownOverlay = mountTelemetryOverlay({ app, theme, memoryWriter });
    } else if (!on && teardownOverlay) {
      teardownOverlay();
      teardownOverlay = null;
    }
  }
  applyOverlay(useAppStore.getState().agentDebugOverlay);

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (state.scale !== prev.scale) {
      teardownLevel();
      teardownLevel = mountLevel(app, theme, state.scale, memoryWriter);
    }
    if (state.agentDebugOverlay !== prev.agentDebugOverlay) {
      applyOverlay(state.agentDebugOverlay);
    }
  });

  return () => {
    unsubscribe();
    if (teardownOverlay) teardownOverlay();
    teardownLevel();
    app.destroy(true, { children: true, texture: true });
  };
}

function mountLevel(
  app: Application,
  theme: Theme,
  scale: ScaleLevel,
  memoryWriter: MemoryWriter,
): () => void {
  if (scale === 'cell') {
    const { books, seed } = snapshotLibraryState();
    const layout = layoutCell(seed);
    return mountCell(app, theme, layout, books, seed, memoryWriter);
  }
  if (scale === 'district') {
    return mountDistrict(app, theme);
  }
  return mountStubLevel(app, theme, scale);
}

interface LibrarySnapshot {
  profile: Profile | null;
  books: BookGame[];
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
      books: profile.topGames.map((g) => ({ appid: g.appid, name: g.name })),
      seed: profileSeed(profile),
    };
  }
  return {
    profile: null,
    books: SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name })),
    seed: ANONYMOUS_SEED,
  };
}
