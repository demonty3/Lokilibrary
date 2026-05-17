/**
 * Mulberry32 — a small, fast seeded PRNG with period 2^32. Standard pick for
 * game / procedural-generation use; NOT cryptographic.
 *
 * Every random draw in src/procedural/** goes through here. SPEC §10 + CLAUDE.md:
 * the share-URL contract depends on determinism — `Math.random()` anywhere in
 * src/procedural/ silently breaks shareability between the creator's browser
 * and the viewer's. Treat it as a regression.
 */

export interface Prng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [min, max) — half-open per JS array-index convention. */
  range(min: number, max: number): number;
  /** Float in [min, max). */
  rangeFloat(min: number, max: number): number;
  /** Random item from arr. Throws on empty input. */
  pick<T>(arr: readonly T[]): T;
}

/**
 * Create a PRNG seeded by `seed`. The same seed always produces the same
 * sequence; PRNGs created from the same seed in two separate calls produce
 * the same sequence too, so a procedural layer can spawn a fresh PRNG per
 * subsystem (terrain, scatter, paths) and stay reproducible.
 */
export function mulberry32(seed: number): Prng {
  // Coerce to uint32 once; further state arithmetic keeps it in that range.
  let s = seed >>> 0;

  function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min: number, max: number): number {
    return min + Math.floor(next() * (max - min));
  }

  function rangeFloat(min: number, max: number): number {
    return min + next() * (max - min);
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('mulberry32.pick: empty array');
    return arr[Math.floor(next() * arr.length)] as T;
  }

  return { next, range, rangeFloat, pick };
}
