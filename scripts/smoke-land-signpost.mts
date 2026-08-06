/** Sign-post smoke — `npx tsx scripts/smoke-land-signpost.mts`.
 *  #19 slice 2: a small standing post beside each surface site — furniture
 *  for the proximity-revealed name. Collision → skip (a missing post is
 *  fine, a mangled one is not); buried relics get no post; the reveal path
 *  (model.sites) is untouched. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SIGNPOST_GLYPHS, SAMPLE_LAND } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-signpost');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;

let totalPosts = 0;
for (const seed of [7, 41, 113, 271, 997]) {
  const m = composeLand(seed, SAMPLE_LAND, T);
  const posts: Array<{ x: number; y: number; c: string }> = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++)
      if (m.role[y][x] === 'signpost') posts.push({ x, y, c: m.char[y][x] });

  // Posts come in vertical pairs: head at surface-2, post at surface-1.
  const cols = [...new Set(posts.map((p) => p.x))];
  totalPosts += cols.length;
  check(`seed ${seed}: posts are complete pairs`, posts.length === cols.length * 2,
    `${posts.length} cells across ${cols.length} columns`);
  for (const cx of cols) {
    const pair = posts.filter((p) => p.x === cx).sort((a, b) => a.y - b.y);
    check(`seed ${seed}: post at ${cx} shaped head-over-post`,
      pair[0].c === SIGNPOST_GLYPHS[0] && pair[1].c === SIGNPOST_GLYPHS[1] &&
      pair[1].y === m.surface[cx] - 1 && pair[0].y === m.surface[cx] - 2,
      JSON.stringify(pair));
  }
  // The reveal contract: sites are exactly the game count, unchanged shape.
  check(`seed ${seed}: sites untouched`, m.sites.length === SAMPLE_LAND.length,
    `${m.sites.length} vs ${SAMPLE_LAND.length}`);
  // No post underground (buried relics excluded by construction — pin it).
  check(`seed ${seed}: no post below the surface`,
    posts.every((p) => p.y < m.surface[p.x]));
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, SAMPLE_LAND, T)));
}
check('posts exist across the seed set', totalPosts >= 3, String(totalPosts));

report();
