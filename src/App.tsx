import { Canvas, useThree } from '@react-three/fiber';
import { KeyboardControls, PointerLockControls } from '@react-three/drei';
import type { KeyboardControlsEntry } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useEffect, useState } from 'react';
import { Scene } from './scene/Scene';
import { ConnectorPanel } from './ui/ConnectorPanel';
import { useAppStore } from './state/store';
import {
  getPeekAccelerator,
  getPeeking,
  getWallpaperMode,
  launchSteamGame,
  subscribePeek,
  subscribeWallpaperMode,
  togglePeek,
} from './api/electron';

export type Movement = 'forward' | 'backward' | 'left' | 'right';

const keyMap: KeyboardControlsEntry<Movement>[] = [
  { name: 'forward',  keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward', keys: ['ArrowDown',  'KeyS'] },
  { name: 'left',     keys: ['ArrowLeft',  'KeyA'] },
  { name: 'right',    keys: ['ArrowRight', 'KeyD'] },
];

/** Pre-launch animation length. The first 80% is full animation, the last 20%
 *  is the moment steam:// fires (CLAUDE.md: rituals 1.5-3s, last 20% is when
 *  Steam actually launches). */
const LAUNCH_MS = 1800;
const RITUAL_TOTAL_MS = 2200;
const RETURN_MS = 1200;

/** Slice 5: wallpaper-mode redraw cadence. 10fps is enough for the ambient
 *  motion (terrain bob, ritual flicker) without burning GPU like 'always'. */
const WALLPAPER_FPS = 10;

/** Match /w/:id paths — share-URL viewer entry point. */
function shareIdFromPath(): string | null {
  const m = /^\/w\/([a-f0-9]{8,32})$/.exec(window.location.pathname);
  return m ? m[1] : null;
}

export function App() {
  const loadManifest = useAppStore((s) => s.loadManifest);
  const loadAuth = useAppStore((s) => s.loadAuth);
  const loadLibrary = useAppStore((s) => s.loadLibrary);
  const loadSharedWorld = useAppStore((s) => s.loadSharedWorld);
  const authStatus = useAppStore((s) => s.authStatus);
  const viewOnly = useAppStore((s) => s.viewOnly);
  const wallpaperMode = useAppStore((s) => s.wallpaperMode);
  const setWallpaperModeAction = useAppStore((s) => s.setWallpaperMode);
  const peeking = useAppStore((s) => s.peeking);
  const setPeekingAction = useAppStore((s) => s.setPeeking);
  const [peekAccelerator, setPeekAccelerator] = useState<string | null>(null);
  const markReturnPending = useAppStore((s) => s.markReturnPending);
  const setInFlight = useAppStore((s) => s.setInFlight);
  const clearRitual = useAppStore((s) => s.clearRitual);
  const clearReturn = useAppStore((s) => s.clearReturn);
  const activeRitual = useAppStore((s) => s.activeRitual);
  const inFlight = useAppStore((s) => s.inFlight);
  const returnPending = useAppStore((s) => s.returnPending);

  // Boot path branch (Phase 5 slice 3):
  //   /w/:id  →  view someone else's world (no auth round-trip, no Stage 1)
  //   else    →  the normal authed flow
  useEffect(() => {
    const id = shareIdFromPath();
    if (id) {
      void loadSharedWorld(id);
    } else {
      void loadAuth();
    }
  }, [loadAuth, loadSharedWorld]);

  // Slice 7: fire the Stage 1 call once auth has resolved. Authed users get
  // a manifest built from their real library; anon users get 401 and the
  // fetcher falls back to the stub manifest so the scene still renders.
  // Re-fires when the user signs in or out — manifest swaps stub <-> real.
  // Skipped entirely in view-only mode; the share record already populated
  // everything the renderer needs.
  useEffect(() => {
    if (viewOnly) return;
    if (authStatus === 'authenticated' || authStatus === 'anonymous') {
      void loadManifest();
    }
  }, [viewOnly, authStatus, loadManifest]);

  // Slice 2: as soon as auth resolves to authenticated, pull the library for
  // the connector panel preview. The manifest call above does its own library
  // build server-side; this one is for visibility.
  useEffect(() => {
    if (viewOnly) return;
    if (authStatus === 'authenticated') void loadLibrary();
  }, [viewOnly, authStatus, loadLibrary]);

  // Phase 6 slice 4: in Electron, seed the store with the persisted mode
  // and subscribe to future changes (tray menu, IPC). No-op in the web
  // build — the helpers short-circuit when window.electronAPI is absent.
  useEffect(() => {
    void getWallpaperMode().then((mode) => setWallpaperModeAction(mode === 'wallpaper'));
    const unsubscribe = subscribeWallpaperMode((mode) => {
      setWallpaperModeAction(mode === 'wallpaper');
    });
    return unsubscribe;
  }, [setWallpaperModeAction]);

  // Slice 6: peek state. Seed from main, subscribe to broadcasts (hotkey
  // press, tray click), and grab the accelerator string for the on-screen
  // hint. Web build short-circuits all three calls.
  useEffect(() => {
    void getPeeking().then((v) => setPeekingAction(v));
    void getPeekAccelerator().then((accel) => {
      if (accel) setPeekAccelerator(accel);
    });
    const unsubscribe = subscribePeek((v) => setPeekingAction(v));
    return unsubscribe;
  }, [setPeekingAction]);

  // Phase 1.9: launch ritual orchestration. When activeRitual flips on, schedule
  // steam://run at LAUNCH_MS and clear the ritual at RITUAL_TOTAL_MS. The
  // archetype components animate against the ritual.startedAt timestamp
  // themselves; this effect only handles state transitions + the steam:// fire.
  useEffect(() => {
    if (!activeRitual) return;
    const appid = activeRitual.appid;
    const launchTimer = window.setTimeout(() => {
      // Slice 6.3: in Electron the helper dispatches via IPC →
      // shell.openExternal so the renderer window stays put; web build
      // keeps using window.location.href which the browser's protocol
      // handler routes to Steam.
      launchSteamGame(appid);
      setInFlight(true);
    }, LAUNCH_MS);
    const clearTimer = window.setTimeout(() => clearRitual(), RITUAL_TOTAL_MS);
    return () => {
      window.clearTimeout(launchTimer);
      window.clearTimeout(clearTimer);
    };
  }, [activeRitual, setInFlight, clearRitual]);

  // Phase 1.10: return ritual. After a launch fires steam://run, the tab loses
  // focus; we listen for it to come back and surface a "you came home" beat.
  // CLAUDE.md flags this as a small lie (focus fires on any tab-switch) —
  // accepted through v0.5; the native wrapper at v0.6 swaps in real signals.
  useEffect(() => {
    const onFocus = () => {
      if (useAppStore.getState().inFlight) {
        setInFlight(false);
        markReturnPending();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [markReturnPending, setInFlight]);

  // Auto-clear the return animation after its tween length.
  useEffect(() => {
    if (!returnPending) return;
    const t = window.setTimeout(() => clearReturn(), RETURN_MS);
    return () => window.clearTimeout(t);
  }, [returnPending, clearReturn]);

  // Slice 6: the window is interactive when not in wallpaper mode, OR when
  // in wallpaper mode but currently peeking. Peeking lifts the window into
  // the foreground (main process drops alwaysOnTop + focuses) so all the
  // normal interaction layers come back.
  const interactive = !wallpaperMode || peeking;
  return (
    <KeyboardControls map={keyMap}>
      {/* Slice 5: drop r3f to demand-driven rendering when the window is a
          live wallpaper the user can't interact with. Peek flips us back to
          'always' because the user is actively looking + clicking. */}
      <Canvas
        shadows
        camera={{ position: [0, 1.7, 6], fov: 70 }}
        frameloop={interactive ? 'always' : 'demand'}
      >
        <Physics>
          <Scene />
        </Physics>
        {!interactive && <WallpaperThrottle fps={WALLPAPER_FPS} />}
        {/* PointerLockControls needs window focus + mouse events. Skipped
            in ambient wallpaper; re-mounts during peek. */}
        {interactive && <PointerLockControls />}
      </Canvas>
      {interactive && <Footer />}
      {interactive && <ConnectorPanel />}
      {peeking && peekAccelerator && <PeekHint accelerator={peekAccelerator} />}
      {(activeRitual || inFlight || returnPending) && (
        <RitualOverlay
          phase={returnPending ? 'returning' : inFlight ? 'in-flight' : 'launching'}
        />
      )}
    </KeyboardControls>
  );
}

/**
 * Slice 6 hint shown while peeking. The wallpaper is in foreground +
 * interactive, but visually identical to wallpaper mode — without a hint
 * the user has no signal that the same hotkey returns them to ambient. The
 * label clicks-through to togglePeek() so users who forgot the hotkey have
 * an obvious dismiss target.
 */
function PeekHint({ accelerator }: { accelerator: string }) {
  return (
    <button
      onClick={() => void togglePeek()}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        background: 'rgba(0, 0, 0, 0.55)',
        color: '#ffe6a8',
        border: '1px solid rgba(255, 230, 168, 0.35)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        letterSpacing: 0.4,
        cursor: 'pointer',
        zIndex: 60,
      }}
    >
      Peek · {accelerator} to return
    </button>
  );
}

function Footer() {
  const prompt = useAppStore((s) => s.prompt);
  const menuOpen = useAppStore((s) => s.menuOpen);
  const activeRitual = useAppStore((s) => s.activeRitual);
  const inFlight = useAppStore((s) => s.inFlight);
  if (menuOpen || activeRitual || inFlight) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: prompt ? '#ffe6a8' : '#888',
        fontSize: 12,
        letterSpacing: 0.5,
        pointerEvents: 'none',
      }}
    >
      {prompt ?? 'click to capture mouse · WASD to walk · esc to release'}
    </div>
  );
}

/**
 * Slice 5 throttle. Lives inside <Canvas> so it can grab the r3f invalidate
 * function. With frameloop="demand" set on the Canvas, no frames render
 * until someone calls invalidate() — this calls it at WALLPAPER_FPS so the
 * scene still breathes (sun moves slightly, lighthouse pulses) at a
 * fraction of the GPU cost of a free-running 60fps loop.
 */
function WallpaperThrottle({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = window.setInterval(() => invalidate(), Math.max(1, Math.floor(1000 / fps)));
    return () => window.clearInterval(id);
  }, [fps, invalidate]);
  return null;
}

// Diegetic dimming layer drawn over the canvas. The 3D-side archetype
// animations live in src/scene/archetypes/* — this is just the surrounding
// vignette that signals "the world is paying attention to one thing."
type RitualPhase = 'launching' | 'in-flight' | 'returning';

function RitualOverlay({ phase }: { phase: RitualPhase }) {
  const background =
    phase === 'launching'
      ? 'radial-gradient(circle at 50% 60%, transparent 0%, rgba(0,0,0,0.6) 90%)'
      : phase === 'in-flight'
      ? 'rgba(0,0,0,0.85)'
      : 'radial-gradient(circle at 50% 50%, rgba(255, 230, 168, 0.05) 0%, rgba(0,0,0,0.45) 100%)';
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background,
        transition: 'background 600ms ease-out',
        zIndex: 50,
      }}
    />
  );
}
