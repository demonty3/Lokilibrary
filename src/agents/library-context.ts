/**
 * Library-context line (agent-mind pass). One capped, deterministic
 * sentence describing the ACTUAL collection, threaded into Tier-1/Tier-2
 * prompts so the personas' taste binds to this library instead of a
 * generic one ("the library:" line the Loki persona references).
 *
 * Deterministic by construction: sorts by (playtime desc, appid asc),
 * no Date.now(), no Math.random() — the same library yields the same
 * line, so prompt caches and smokes stay stable.
 *
 * Genres are deliberately absent — LibraryGame carries none client-side;
 * the named poles carry the specificity instead (spec § 3).
 */

import type { LibraryGame, LibraryState } from '../types';

const STATE_ORDER: readonly LibraryState[] = ['loved', 'recent', 'mastered', 'abandoned', 'dusty'];
const MAX_LINE_CHARS = 260;

function hours(g: LibraryGame): number {
  return Math.round(g.playtime_forever / 60);
}

/** (playtime desc, appid asc) — appid breaks ties so the line never churns. */
function byPlaytime(a: LibraryGame, b: LibraryGame): number {
  return b.playtime_forever - a.playtime_forever || a.appid - b.appid;
}

function pole(g: LibraryGame): string {
  return `${g.name} (${g.state}, ${hours(g)}h)`;
}

export function buildLibraryContext(games: readonly LibraryGame[] | null): string | null {
  if (!games || games.length === 0) return null;

  const counts = new Map<LibraryState, number>();
  for (const g of games) {
    if (g.state) counts.set(g.state, (counts.get(g.state) ?? 0) + 1);
  }
  const countParts = STATE_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map(
    (s) => `${counts.get(s)} ${s}`,
  );

  // Poles: up to 2 bright (loved/mastered) + up to 2 dim (dusty/abandoned),
  // each ranked by playtime — a once-loved dusty game is the interesting one.
  const bright = games.filter((g) => g.state === 'loved' || g.state === 'mastered').sort(byPlaytime);
  const dim = games.filter((g) => g.state === 'dusty' || g.state === 'abandoned').sort(byPlaytime);
  const poles = [...bright.slice(0, 2), ...dim.slice(0, 2)].map(pole);

  let line = `${games.length} games`;
  if (countParts.length > 0) line += `: ${countParts.join(', ')}`;
  line += '.';
  if (poles.length > 0) line += ` its poles: ${poles.join(' · ')}.`;
  if (line.length > MAX_LINE_CHARS) line = `${line.slice(0, MAX_LINE_CHARS - 1)}…`;
  return line;
}
