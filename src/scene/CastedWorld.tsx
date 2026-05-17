import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { ARCHETYPE_COMPONENTS } from './archetypes';
import type { LibraryState } from '../types';

/**
 * Renders the manifest's casting as actual archetype components. The
 * "template-agnostic scene assembly" PLAN.md 1.8 calls out — same code reads
 * any manifest regardless of which template the LLM picked.
 *
 * Source for game names (slice 7): the real library when authed, otherwise
 * SAMPLE_LIBRARY for the stub manifest path. Both maps are keyed by appid
 * so the lookup is identical from the render's POV.
 *
 * Per-game state (Phase 4): comes from the real library when present, drives
 * the per-archetype visual treatment in stateStyling.ts. Stub manifests have
 * no state — archetypes render in their default style.
 *
 * Falls back to nothing while the manifest is loading; the surrounding scenery
 * (houses, lamp posts, water) in Town.tsx is independent and renders either way.
 */
export function CastedWorld() {
  const manifest = useAppStore((s) => s.manifest);
  const library = useAppStore((s) => s.library);

  const gameByAppid = useMemo(() => {
    const m = new Map<number, { name: string; state?: LibraryState }>();
    if (library) {
      for (const g of library) m.set(g.appid, { name: g.name, state: g.state });
    } else {
      for (const g of SAMPLE_LIBRARY) m.set(g.appid, { name: g.name });
    }
    return m;
  }, [library]);

  if (!manifest) return null;

  return (
    <>
      {manifest.casting.map((entry, idx) => {
        const Component = ARCHETYPE_COMPONENTS[entry.archetype];
        if (!Component) {
          // Server-side validation should have rejected this; treat as a
          // hard error in dev rather than silently dropping the entry.
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error(`No component for archetype "${entry.archetype}"`);
          }
          return null;
        }
        const game = gameByAppid.get(entry.appid);
        if (!game) return null;
        return (
          <Component
            key={`${entry.appid}-${idx}`}
            appid={entry.appid}
            name={game.name}
            position={entry.position}
            state={game.state}
          />
        );
      })}
    </>
  );
}
