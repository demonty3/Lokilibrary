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
import { loadSpriteAtlas, type SpriteAtlas } from './sprites';
import { nullMemoryWriter, type MemoryWriter } from '../agents/router';
import {
  getCurrentMemoryWriter,
  namespaceFor,
  rebuildNamespaceSync,
} from '../agents/memory/bootstrap';

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
 * draw on first boot. Slice 2G wires the profile subscription so a
 * library-load-after-auth triggers a cell remount with the new seed —
 * scale changes are no longer the only remount trigger.
 *
 * On each cell remount the writer is re-resolved via
 * `getCurrentMemoryWriter()` so the namespace rebuild in App.tsx's
 * profile effect (which calls `bootstrapMemory({rebuild:true})` with
 * the profile-derived cellId + libraryId) propagates without
 * threading the writer back through React state.
 */
export interface MountPalaceOptions {
  /** Optional memory writer — Electron path passes the DB-backed
   *  writer (slice 2F bootstrap), web build passes nothing and gets
   *  the null writer. Slice 2G reads `getCurrentMemoryWriter()` at
   *  each level mount so a later namespace rebuild picks up
   *  automatically; this initial value is the seed for the first
   *  mount before bootstrap has populated the cache. */
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

  // Cozette + sprite atlas can load in parallel — both are bounded by
  // the network round-trip for static assets in public/.
  const [, spriteAtlas] = await Promise.all([
    waitForCozette(),
    loadSpriteAtlas(theme.id),
  ]);

  const initialWriter = options.memoryWriter ?? nullMemoryWriter;
  function resolveWriter(): MemoryWriter {
    return getCurrentMemoryWriter() ?? initialWriter;
  }

  // Slice 2G: profile may have loaded during App.tsx's bootstrap + this
  // mountPalace await (auth → loadLibrary races the renderer init). If
  // so, the writer cached by App.tsx is still scoped to the anonymous
  // namespace; rebuild against the current profile before the first
  // cell mount so persona / marginalia / telemetry rows land under the
  // right (cellId, libraryId).
  {
    const initialState = useAppStore.getState();
    if (initialState.profile) {
      const seed = seedFromState(initialState.profile);
      rebuildNamespaceSync(
        namespaceFor(initialState.profile, initialState.steamId, seed),
      );
    }
  }

  let teardownLevel: () => void = mountLevel(
    app,
    theme,
    useAppStore.getState().scale,
    resolveWriter(),
    spriteAtlas,
  );

  // Telemetry overlay (Phase 2F) — mounted on demand by the
  // `agentDebugOverlay` subscription. Lives at the app level (not the
  // cell level) so it stays visible across scale transitions. Overlay
  // reads telemetry via the writer, so we resolve fresh on each mount;
  // a profile-driven namespace rebuild rebuilds the writer's prepared
  // statements against the same DB.
  let teardownOverlay: (() => void) | null = null;
  function applyOverlay(on: boolean): void {
    if (on && !teardownOverlay) {
      teardownOverlay = mountTelemetryOverlay({
        app,
        theme,
        memoryWriter: resolveWriter(),
      });
    } else if (!on && teardownOverlay) {
      teardownOverlay();
      teardownOverlay = null;
    }
  }
  applyOverlay(useAppStore.getState().agentDebugOverlay);

  // Slice 2G: track the profile-derived seed so we only remount on a
  // change that actually affects the renderer. profileSeed() ignores
  // persona / avatar drift; topGames + engagement + playtime buckets
  // are what move it. Anonymous → ANONYMOUS_SEED, profile → its hash.
  let lastSeed = seedFromState(useAppStore.getState().profile);

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    const scaleChanged = state.scale !== prev.scale;
    const nextSeed = seedFromState(state.profile);
    const seedChanged = nextSeed !== lastSeed;
    // Rebuild the writer namespace *before* remount so the new cell
    // mounts with a writer scoped to the profile-derived (cellId,
    // libraryId). No-op in the web build (rebuildNamespaceSync returns
    // null when no DB is cached).
    if (seedChanged) {
      rebuildNamespaceSync(
        namespaceFor(state.profile, state.steamId, nextSeed),
      );
    }
    if (scaleChanged || (seedChanged && state.scale === 'cell')) {
      teardownLevel();
      teardownLevel = mountLevel(
        app,
        theme,
        state.scale,
        resolveWriter(),
        spriteAtlas,
      );
      lastSeed = nextSeed;
    } else if (seedChanged) {
      // Scale isn't 'cell' right now, but record the new seed so a later
      // zoom back to cell remounts with the right library.
      lastSeed = nextSeed;
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

function seedFromState(profile: Profile | null): number {
  return profile ? profileSeed(profile) : ANONYMOUS_SEED;
}

function mountLevel(
  app: Application,
  theme: Theme,
  scale: ScaleLevel,
  memoryWriter: MemoryWriter,
  spriteAtlas: SpriteAtlas | null,
): () => void {
  if (scale === 'cell') {
    const { books, seed } = snapshotLibraryState();
    const layout = layoutCell(seed);
    return mountCell(
      app,
      theme,
      layout,
      books,
      seed,
      memoryWriter,
      spriteAtlas,
    );
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
