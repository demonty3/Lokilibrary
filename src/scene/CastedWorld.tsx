import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { ARCHETYPE_COMPONENTS } from './archetypes';
import { layoutFor, layoutForSeed } from '../procedural/seaside';
import type { LibraryState } from '../types';

/**
 * Renders the manifest's casting as actual archetype components.
 *
 * Sources:
 *   - **name + state per appid:** real library when authed, SAMPLE_LIBRARY
 *     when not. Same Map<appid, …> shape either way.
 *   - **positions:** computed deterministically by src/procedural/seaside.ts
 *     from the profile seed (Phase 5 slice 2). The manifest no longer carries
 *     positions; this code can't read them even if the LLM hallucinated some.
 *
 * Falls back to nothing while the manifest is loading; the surrounding scenery
 * (houses, lamp posts, water) in Town.tsx is independent and renders either way.
 */
export function CastedWorld() {
  const manifest = useAppStore((s) => s.manifest);
  const library = useAppStore((s) => s.library);
  const profile = useAppStore((s) => s.profile);
  const viewOnly = useAppStore((s) => s.viewOnly);
  const sharedSeed = useAppStore((s) => s.sharedSeed);

  const gameByAppid = useMemo(() => {
    const m = new Map<number, { name: string; state?: LibraryState }>();
    if (library) {
      for (const g of library) m.set(g.appid, { name: g.name, state: g.state });
    } else {
      for (const g of SAMPLE_LIBRARY) m.set(g.appid, { name: g.name });
    }
    return m;
  }, [library]);

  const layout = useMemo(() => {
    if (!manifest) return null;
    // View-only mode: drive the layout from the share record's precomputed
    // seed. The creator's machine hashed their profile to this value at
    // share time; reusing it verbatim reproduces the same world.
    if (viewOnly && sharedSeed !== null) {
      return layoutForSeed(sharedSeed, manifest.casting);
    }
    return layoutFor(profile, manifest.casting);
  }, [manifest, profile, viewOnly, sharedSeed]);

  if (!manifest || !layout) return null;

  if (import.meta.env.DEV && layout.dropped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `procedural layout dropped ${layout.dropped.length} archetype(s):`,
      layout.dropped,
    );
  }

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
        const position = layout.positions.get(entry.appid);
        if (!position) return null;
        return (
          <Component
            key={`${entry.appid}-${idx}`}
            appid={entry.appid}
            name={game.name}
            position={position}
            state={game.state}
          />
        );
      })}
    </>
  );
}
