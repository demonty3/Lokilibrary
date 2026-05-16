import { useAppStore } from '../state/store';
import { SAMPLE_LIBRARY } from '../data/sampleLibrary';
import { ARCHETYPE_COMPONENTS } from './archetypes';

/**
 * Renders the manifest's casting as actual archetype components. The
 * "template-agnostic scene assembly" PLAN.md 1.8 calls out — same code reads
 * any manifest regardless of which template the LLM picked.
 *
 * Falls back to nothing while the manifest is loading; the surrounding scenery
 * (houses, lamp posts, water) in Town.tsx is independent and renders either way.
 */
export function CastedWorld() {
  const manifest = useAppStore((s) => s.manifest);
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
        const game = SAMPLE_LIBRARY.find((g) => g.appid === entry.appid);
        if (!game) return null;
        return (
          <Component
            key={`${entry.appid}-${idx}`}
            appid={entry.appid}
            name={game.name}
            position={entry.position}
          />
        );
      })}
    </>
  );
}
