/**
 * Worn paths between `loved` archetypes. Phase 5 slice 4 — PLAN.md task 2.
 *
 * "If the player has multiple `loved` games, generate worn-path decals on
 * the ground between them" (SPEC §4 backlog table). The visual semantic is
 * "you've trodden between these games many times" — the more often a pair
 * shows up in your top decile + recently-played + past-main, the more
 * established the path between them.
 *
 * Algorithm here is simplest reasonable: all-pairs between loved games,
 * capped at MAX_PATHS so a library with many loved games doesn't paint
 * the ground into a tangle of crossing strips. The cap fires rarely —
 * most libraries have 1–4 loved games at any time.
 */

import type { LibraryGame } from '../types';
import type { Manifest } from '../ai/manifest';

const MAX_PATHS = 8;

export interface PathSegment {
  from: [number, number];
  to: [number, number];
}

export function lovedPaths(
  casting: Manifest['casting'],
  library: readonly LibraryGame[],
  positions: ReadonlyMap<number, [number, number]>,
): PathSegment[] {
  const lovedAppids = new Set(
    library.filter((g) => g.state === 'loved').map((g) => g.appid),
  );
  if (lovedAppids.size < 2) return [];

  // Iterate the casting array (not the library) so the order of generated
  // segments is stable across runs with the same manifest — deterministic
  // input to anything downstream (geometry build, share record).
  const lovedPositions: Array<[number, number]> = [];
  for (const entry of casting) {
    if (lovedAppids.has(entry.appid)) {
      const pos = positions.get(entry.appid);
      if (pos) lovedPositions.push(pos);
    }
  }

  const segments: PathSegment[] = [];
  for (let i = 0; i < lovedPositions.length; i++) {
    for (let j = i + 1; j < lovedPositions.length; j++) {
      segments.push({ from: lovedPositions[i], to: lovedPositions[j] });
      if (segments.length >= MAX_PATHS) return segments;
    }
  }
  return segments;
}
