/**
 * Deterministic library-clustering layer (Phase 7-A — scale ladder beyond
 * cell/district). Groups the library into a three-level hierarchy —
 * district → island → continent — seeded entirely by the profile seed, so
 * the same profile produces the same map at every rung. This is the
 * aggregation source the island/continent/district renderers paint.
 *
 * **Determinism (CLAUDE.md hard rule).** All randomness goes through
 * `mulberry32`. Two PRNG namespaces, both XORed into the profile seed and
 * isolated from every other src/procedural consumer (cell `0xce11`, scatter
 * `0x5ca7`, Loki `0x10ce`, landmark `0x1a4d`):
 *
 *   - `CLUSTER_SALT = 0xc1a5` ("CLuStr") — bucketing games into districts,
 *     districts into islands, islands into continents.
 *   - `LAYOUT_SALT = 0xc0a5` ("COASt") — 2D position placement of cluster
 *     boxes on a map grid (the pure layout helper consumed by the renderers).
 *
 * NO `Math.random`, NO `Date.now`, NO array-iteration-order dependence: the
 * library is canonicalised by a stable `appid` sort before any bucketing, so
 * the input order (profile.topGames vs SAMPLE_LIBRARY) never moves the tree.
 * The share-URL / WFC contract spans the creator's browser and the
 * share-viewer's; a leak here silently breaks shareability.
 *
 * **Invariants the smoke locks** (`scripts/smoke-7a-scale-ladder.mts`):
 *   - same (games, seed) → byte-identical tree (JSON.stringify equal).
 *   - every game lands in exactly one district (flatten count == input,
 *     no dupes).
 *   - island/continent membership aggregates from children by construction.
 *   - n == 0 → empty-but-valid tree (all counts 0, empty arrays).
 *   - n == 1 → 1 district / 1 island / 1 continent.
 *   - layoutClusterPositions: same (ids, seed) → same positions, in bounds.
 *
 * The cluster input is decoupled from `Profile` (a plain `ClusterGame`) so
 * both the authenticated path (`profile.topGames`, carrying `engagement`)
 * and the anonymous path (`SAMPLE_LIBRARY`, no engagement) feed it. The only
 * field required for clustering itself is `{appid, name}`; `engagement` is a
 * best-effort activity overlay that degrades gracefully to `'none'`.
 */

import { mulberry32 } from './prng';
import type { Engagement } from '../types';

/** PRNG namespace for cluster bucketing — distinct from cell 0xce11,
 *  scatter 0x5ca7, Loki 0x10ce, landmark 0x1a4d, and LAYOUT_SALT below. */
export const CLUSTER_SALT = 0xc1a5;

/** PRNG namespace for cluster-box 2D position placement. Distinct from
 *  CLUSTER_SALT so the tree shape and the map layout are independently
 *  seeded (changing one never correlates with the other). */
export const LAYOUT_SALT = 0xc0a5;

/** Upper bound on districts so big libraries stay legible as a map (the
 *  "four-incoherent-maps" failure mode includes an unreadably busy one). */
export const MAX_DISTRICTS = 8;
/** Islands group districts; continents group islands. Bounded so the higher
 *  rungs always read as a handful of distinct labelled shapes. */
export const MAX_ISLANDS = 4;
export const MAX_CONTINENTS = 2;

/** Minimal per-game shape the clusterer consumes. `engagement` is optional
 *  (absent on the anonymous SAMPLE_LIBRARY path) and only ever drives the
 *  best-effort activity glyph — never the bucketing, which uses {appid}
 *  alone so authenticated + anonymous trees are equally reproducible. */
export interface ClusterGame {
  appid: number;
  name: string;
  engagement?: Engagement;
}

/** Activity descriptor for a cluster: the dominant member engagement, or
 *  'none' when no member carries one (the graceful-degrade default). */
export type ClusterActivity = Engagement | 'none';

export interface District {
  id: string;
  games: ClusterGame[];
  /** Dominant member engagement (most "lived-in" wins). 'none' when no
   *  member carries an engagement signal. Drives the activity glyph. */
  activity: ClusterActivity;
}

export interface Island {
  id: string;
  districts: District[];
}

export interface Continent {
  id: string;
  islands: Island[];
}

export interface ClusterTree {
  continents: Continent[];
  districtCount: number;
  islandCount: number;
  continentCount: number;
  gameCount: number;
}

/** A placed cluster box on the map grid (pure layout output). */
export interface ClusterBox {
  id: string;
  /** Grid column / row (integer, 0-based). */
  x: number;
  y: number;
}

/**
 * Engagement → ordinal "how lived-in is this". Higher = more activity. Used
 * to pick a cluster's dominant activity (the most-active member wins) and to
 * rank the activity glyph. Pure lookup. `undefined`/'none' map to -1 so any
 * real engagement outranks "no signal".
 */
const ENGAGEMENT_RANK: Readonly<Record<Engagement, number>> = {
  deeply_lived_in: 5,
  past_main: 4,
  engaged: 3,
  tried: 2,
  just_opened: 1,
  unplayed: 0,
};

function engagementRank(e: ClusterActivity): number {
  return e === 'none' ? -1 : ENGAGEMENT_RANK[e];
}

/**
 * Whitelisted activity glyph per engagement level. Reuses the shared
 * box-glyph / shade vocabulary already shipping at cell level (T_BOOKSHELF
 * '▓', plus the lighter shade companions '▒' '░' and the floor dot '·' from
 * tiles/library.ts) so the four rungs read as one recoloured alphabet, not
 * four broken maps (CLAUDE.md aesthetic-coherence rule). All four glyphs are
 * confirmed present in the Cozette atlas (▓ already ships as T_BOOKSHELF; the
 * shade ramp ▒░ and the dot · are standard CP437/box-drawing glyphs Cozette
 * covers). Pure — the smoke pins the mapping.
 */
export function activityGlyphFor(activity: ClusterActivity): string {
  switch (activity) {
    case 'deeply_lived_in':
    case 'past_main':
      return '▓'; // loved / lived-in — heavy shade (the bookshelf glyph)
    case 'engaged':
      return '▒'; // engaged — medium shade
    case 'tried':
    case 'just_opened':
      return '░'; // dabbled — light shade
    case 'unplayed':
    case 'none':
    default:
      return '·'; // dusty / unknown — the floor dot
  }
}

/**
 * Canonical district/island/continent fan-out for a library of `n` games.
 * `ceil(sqrt(n))` clamped to [1, MAX] gives a square-ish map that grows
 * sub-linearly (a 7-game sample → 3 districts; a 15-game top-N → 4). Pure +
 * deterministic-from-count (no seed, no clock) so the smoke can pin it.
 */
export function districtCountFor(n: number): number {
  if (n <= 0) return 0;
  return clamp(Math.ceil(Math.sqrt(n)), 1, MAX_DISTRICTS);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Distribute `items` (already in canonical order) into `bucketCount`
 * buckets, guaranteeing every bucket is non-empty and every item lands in
 * exactly one bucket. First-fill (one item per bucket, in order) then
 * PRNG-distribute the remainder. The PRNG draw count is independent of item
 * identity, so the assignment is fully reproducible from (seed, salt).
 * Returns an array of `bucketCount` arrays. Pure.
 */
function bucketize<T>(
  items: readonly T[],
  bucketCount: number,
  seed: number,
  salt: number,
): T[][] {
  const buckets: T[][] = Array.from({ length: bucketCount }, () => [] as T[]);
  if (bucketCount <= 0 || items.length === 0) return buckets;
  const prng = mulberry32((seed ^ salt) >>> 0);
  for (let i = 0; i < items.length; i++) {
    if (i < bucketCount) {
      // First-fill phase: one item per bucket so none is ever empty.
      buckets[i].push(items[i]);
    } else {
      buckets[prng.range(0, bucketCount)].push(items[i]);
    }
  }
  return buckets;
}

/** Dominant activity of a set of games: the most-lived-in member's
 *  engagement, or 'none' when no member carries one. Pure. */
function dominantActivity(games: readonly ClusterGame[]): ClusterActivity {
  let best: ClusterActivity = 'none';
  for (const g of games) {
    const a: ClusterActivity = g.engagement ?? 'none';
    if (engagementRank(a) > engagementRank(best)) best = a;
  }
  return best;
}

/**
 * Build the deterministic district → island → continent tree for a library.
 *
 * Algorithm (pure, sync):
 *   1. Canonicalise: stable-sort games by appid ASC (input array order from
 *      profile.topGames vs SAMPLE_LIBRARY differs; appid is the identity).
 *   2. districtCount = districtCountFor(n); bucketize games into districts
 *      (first-fill-then-prng → every district non-empty, every game once).
 *   3. islandCount = clamp(ceil(districtCount/2), 1, MAX_ISLANDS); bucketize
 *      districts into islands the same way.
 *   4. continentCount = clamp(ceil(islandCount/2), 1, MAX_CONTINENTS);
 *      bucketize islands into continents identically.
 *   5. n == 0 → empty-but-valid tree (all counts 0, empty arrays).
 *
 * Membership aggregates by construction (a continent's games are the union
 * of its islands' districts' games). Each district carries its dominant
 * activity for the renderers' activity glyph.
 */
export function clusterLibrary(
  games: readonly ClusterGame[],
  seed: number,
): ClusterTree {
  const gameCount = games.length;
  if (gameCount === 0) {
    return {
      continents: [],
      districtCount: 0,
      islandCount: 0,
      continentCount: 0,
      gameCount: 0,
    };
  }

  // 1. Canonical order — appid ASC, lexical name tiebreak (defensive; appids
  //    are unique in practice). Independent of input array order.
  const sorted = [...games].sort((a, b) => {
    if (a.appid !== b.appid) return a.appid - b.appid;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  // 2. Games → districts.
  const districtCount = districtCountFor(gameCount);
  const districtBuckets = bucketize(sorted, districtCount, seed, CLUSTER_SALT);
  const districts: District[] = districtBuckets.map((gms, i) => ({
    id: `d${i}`,
    games: gms,
    activity: dominantActivity(gms),
  }));

  // 3. Districts → islands. Re-salt with the district index range so the
  //    island grouping isn't a trivial echo of the district grouping.
  const islandCount = clamp(Math.ceil(districtCount / 2), 1, MAX_ISLANDS);
  const islandBuckets = bucketize(
    districts,
    islandCount,
    seed,
    (CLUSTER_SALT + 1) >>> 0,
  );
  const islands: Island[] = islandBuckets.map((dists, i) => ({
    id: `i${i}`,
    districts: dists,
  }));

  // 4. Islands → continents.
  const continentCount = clamp(Math.ceil(islandCount / 2), 1, MAX_CONTINENTS);
  const continentBuckets = bucketize(
    islands,
    continentCount,
    seed,
    (CLUSTER_SALT + 2) >>> 0,
  );
  const continents: Continent[] = continentBuckets.map((isls, i) => ({
    id: `c${i}`,
    islands: isls,
  }));

  return {
    continents,
    districtCount,
    islandCount,
    continentCount,
    gameCount,
  };
}

// --- pure aggregation helpers (consumed by renderers + smoke) --------------

/** All districts in the tree, in continent→island→district order. Pure. */
export function flattenDistricts(tree: ClusterTree): District[] {
  const out: District[] = [];
  for (const c of tree.continents) {
    for (const i of c.islands) {
      for (const d of i.districts) out.push(d);
    }
  }
  return out;
}

/** Continent containing `districtId`, or null (stale id — the library
 *  shrank since a pane was bound). Ladder identity pass. */
export function findContinentOf(tree: ClusterTree, districtId: string): Continent | null {
  for (const c of tree.continents) {
    for (const i of c.islands) {
      if (i.districts.some((d) => d.id === districtId)) return c;
    }
  }
  return null;
}

/** The home district for a pane: its bound wing when it still resolves,
 *  else the canonical first district (the pre-pane-awareness behaviour),
 *  else null on an empty library. Ladder identity pass. */
export function homeDistrictId(tree: ClusterTree, homeWingId?: string): string | null {
  const all = flattenDistricts(tree);
  if (all.length === 0) return null;
  if (homeWingId && all.some((d) => d.id === homeWingId)) return homeWingId;
  return all[0].id;
}

/** All islands in the tree, in continent→island order. Pure. */
export function flattenIslands(tree: ClusterTree): Island[] {
  const out: Island[] = [];
  for (const c of tree.continents) {
    for (const i of c.islands) out.push(i);
  }
  return out;
}

/** Total games under an island (union of its districts' games). Pure. */
export function islandGameCount(island: Island): number {
  let n = 0;
  for (const d of island.districts) n += d.games.length;
  return n;
}

/** Total games under a continent (union of its islands). Pure. */
export function continentGameCount(continent: Continent): number {
  let n = 0;
  for (const i of continent.islands) n += islandGameCount(i);
  return n;
}

/** Dominant activity across a set of districts (most-lived-in wins). Pure.
 *  Used to give islands/continents an activity accent without re-walking
 *  raw games. */
export function aggregateActivity(
  districts: readonly District[],
): ClusterActivity {
  let best: ClusterActivity = 'none';
  for (const d of districts) {
    if (engagementRank(d.activity) > engagementRank(best)) best = d.activity;
  }
  return best;
}

// --- pure layout helper (consumed by island/continent renderers) ----------

/**
 * Deterministically place cluster boxes on a map grid. Boxes are laid out in
 * pure canonical grid order: box `idx` lands at `(idx % cols, floor(idx /
 * cols))`. The caller passes ids in canonical cluster order (id-sorted,
 * profile-stable, NOT input-array order), so the layout is fully reproducible
 * from the id list alone.
 *
 * **Collision-free by construction.** Every `idx` maps to a distinct (col,
 * row) — the renderers paint each card/blob into a shared glyph grid keyed by
 * these positions, so two boxes on one slot would silently overwrite a
 * neighbourhood (and drop the YOU marker's card). We do NOT apply per-box row
 * jitter: an independent row offset can collide two boxes on one cell (a row-0
 * box jittering down onto a box natively in the last row). The per-seed
 * variety the map needs already comes from the seed-dependent cluster TREE
 * (which games land in which district), so the LAYOUT itself needs no RNG to
 * vary — `seed`/`salt` are accepted for signature stability + future use but
 * deliberately unused here. If positional jitter is ever reintroduced it MUST
 * be a collision-checked permutation of distinct slots (seeded Fisher-Yates
 * over an over-provisioned grid), never an independent per-box offset.
 *
 * Pure + deterministic: same (ids, cols) → identical positions. Positions are
 * non-negative integers; x < cols; y < ceil(ids.length / cols); all (x,y)
 * pairs distinct. The smoke asserts determinism, bounds, one box per id, AND
 * all-distinct positions.
 */
export function layoutClusterPositions(
  ids: readonly string[],
  _seed: number,
  _salt: number,
  cols: number,
): ClusterBox[] {
  const out: ClusterBox[] = [];
  if (ids.length === 0) return out;
  const safeCols = Math.max(1, cols);
  for (let idx = 0; idx < ids.length; idx++) {
    out.push({ id: ids[idx], x: idx % safeCols, y: Math.floor(idx / safeCols) });
  }
  return out;
}

/** Truncate a label to `max` chars with an ellipsis. Pure — the renderers'
 *  card/centroid labels share one budget so nothing overflows its box. */
export function truncateLabel(label: string, max: number): string {
  if (max <= 0) return '';
  if (label.length <= max) return label;
  if (max === 1) return label.slice(0, 1);
  return label.slice(0, max - 1) + '…';
}

/** A grid cell (column/row) in a rasterised map. */
export interface MapCell {
  x: number;
  y: number;
}

/**
 * Deterministically rasterise a continent's land-mass blob centered on
 * (cx, cy) with a target `area` (game-count-driven). Grows a diamond/square
 * footprint sized by `area`, with seeded edge erosion so each mass reads as
 * a distinct organic shape rather than a perfect rectangle. Pure: same
 * (cx, cy, area, seed, salt) → identical cell set. Cells are clamped to
 * [0, width) × [0, height) so the blob never escapes the map.
 *
 * The radius grows as ~sqrt(area) so a bigger library is a visibly bigger
 * mass, sub-linearly (legibility cap). The core is always emitted (a 1-game
 * library still produces one sensible labelled cell).
 */
export function blobCells(
  cx: number,
  cy: number,
  area: number,
  width: number,
  height: number,
  seed: number,
  salt: number,
): MapCell[] {
  const prng = mulberry32((seed ^ salt) >>> 0);
  const radius = clamp(Math.round(Math.sqrt(Math.max(1, area))), 1, 6);
  const out: MapCell[] = [];
  const seen = new Set<string>();
  const push = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const k = `${x},${y}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y });
  };
  // Always emit the core so a tiny library still has a labelled mass.
  push(cx, cy);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const dist = Math.abs(dx) + Math.abs(dy); // diamond footprint
      if (dist > radius) continue;
      // Seeded edge erosion: the outermost ring drops cells ~30% of the
      // time so the coast reads organic. PRNG draw order is stable (fixed
      // dy/dx scan) so the cell set is reproducible.
      if (dist === radius && prng.next() < 0.3) continue;
      push(cx + dx, cy + dy);
    }
  }
  return out;
}

/** A district's display label: the most-lived-in member game's name (or the
 *  district id when empty — shouldn't happen given non-empty buckets, but
 *  degrades gracefully). Pure + deterministic. */
export function districtLabel(district: District): string {
  if (district.games.length === 0) return district.id;
  let best = district.games[0];
  let bestRank = engagementRank(best.engagement ?? 'none');
  for (const g of district.games) {
    const r = engagementRank(g.engagement ?? 'none');
    if (r > bestRank) {
      best = g;
      bestRank = r;
    }
  }
  return best.name;
}
