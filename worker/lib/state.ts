/**
 * Library-state tagger. Per SPEC §4 — same archetype, different state,
 * different visual treatment in-world. The lighthouse that's `loved` glows
 * and has worn paths to it; the lighthouse that's `dusty` is a covered ruin.
 *
 * Deterministic, pure — same enriched library + same `nowMs` always yields
 * the same tags. PLAN.md task 6: this runs *before* the Stage 1 prompt, so
 * Claude only ever sees `state: "loved"` — never raw playtime numbers.
 *
 * Priority order matters when multiple triggers match: more specific wins.
 * dusty → loved → mastered → abandoned → recent → default. A game played
 * yesterday that's also in the top decile + past main + 95% achievements is
 * `loved` (most specific compound signal), not `recent` (single condition).
 */

import type { AchievementsSummary } from './steam';
import type { HltbResult } from './hltb';

export type LibraryState =
  | 'loved'
  | 'recent'
  | 'mastered'
  | 'abandoned'
  | 'dusty'
  | 'default';

export interface TaggerInputGame {
  appid: number;
  playtime_forever: number;        // minutes
  rtime_last_played?: number;      // unix seconds
  achievements?: AchievementsSummary;
  hltb?: HltbResult;
  completion_fraction?: number;
}

const DAY_S = 60 * 60 * 24;
const WEEK_S = DAY_S * 7;
const MONTH_S = DAY_S * 30;
const QUARTER_S = DAY_S * 90;

const MASTERED_ACHIEVEMENT_THRESHOLD = 80;     // %
const ABANDONED_MIN_HOURS = 1;
const ABANDONED_MAX_HOURS = 5;
const ABANDONED_MAX_FRACTION = 0.3;

/**
 * Top-decile playtime threshold. Returns the playtime-in-minutes that a game
 * must equal or exceed to be in the top 10% of the library. For libraries
 * smaller than 10 games, returns the playtime of the most-played game (so
 * "top decile" degenerates sensibly to "the heavy-hitters").
 */
export function topDecileThreshold(playedMinutesSortedDesc: number[]): number {
  if (playedMinutesSortedDesc.length === 0) return Infinity;
  const idx = Math.max(0, Math.floor(playedMinutesSortedDesc.length / 10) - 1);
  return playedMinutesSortedDesc[idx];
}

export interface TagContext {
  /** Top-decile minimum playtime in minutes (from topDecileThreshold). */
  topDecileMinutes: number;
  /** Now, in unix seconds. Pass-through for deterministic testing. */
  nowS: number;
}

export function tagState(game: TaggerInputGame, ctx: TagContext): LibraryState {
  // 1. dusty — owned, never opened. Unambiguous, must run first.
  if (game.playtime_forever === 0) return 'dusty';

  const minutes = game.playtime_forever;
  const hours = minutes / 60;
  const daysSincePlay = game.rtime_last_played
    ? (ctx.nowS - game.rtime_last_played) / DAY_S
    : Infinity;
  const ach = game.achievements?.percent;
  const frac = game.completion_fraction;

  // 2. loved — top decile + recent month + past main. All three required.
  if (
    minutes >= ctx.topDecileMinutes &&
    daysSincePlay <= 30 &&
    typeof frac === 'number' &&
    frac > 1.0
  ) {
    return 'loved';
  }

  // 3. mastered — achievement % > 80 OR completionist hours met.
  if (typeof ach === 'number' && ach > MASTERED_ACHIEVEMENT_THRESHOLD) return 'mastered';
  if (game.hltb && game.hltb.completionistHours > 0 && hours >= game.hltb.completionistHours) {
    return 'mastered';
  }

  // 4. abandoned — short stint, long since dropped, < 0.3 of main story.
  //    HLTB-less fallback: trust the playtime + time-since signal alone.
  if (
    hours >= ABANDONED_MIN_HOURS &&
    hours <= ABANDONED_MAX_HOURS &&
    daysSincePlay > 90 &&
    (typeof frac !== 'number' || frac < ABANDONED_MAX_FRACTION)
  ) {
    return 'abandoned';
  }

  // 5. recent — generic "you played this week."
  if (daysSincePlay <= 7) return 'recent';

  return 'default';
}

/** Convenience: tag every game in one pass with one shared context. */
export function tagLibrary<T extends TaggerInputGame>(
  library: T[],
  nowS: number,
): Array<T & { state: LibraryState }> {
  const playedSorted = library
    .map((g) => g.playtime_forever)
    .filter((m) => m > 0)
    .sort((a, b) => b - a);
  const ctx: TagContext = {
    topDecileMinutes: topDecileThreshold(playedSorted),
    nowS,
  };
  return library.map((g) => ({ ...g, state: tagState(g, ctx) }));
}

/** Aggregate counts per state — useful for the panel preview and for
 *  debugging "why does my library look the way it does." */
export function stateCounts(
  library: Array<{ state: LibraryState }>,
): Record<LibraryState, number> {
  const counts: Record<LibraryState, number> = {
    loved: 0,
    recent: 0,
    mastered: 0,
    abandoned: 0,
    dusty: 0,
    default: 0,
  };
  for (const g of library) counts[g.state]++;
  return counts;
}

// Re-used constants worth exporting for tests later (week / month).
export const WINDOW_S = { WEEK: WEEK_S, MONTH: MONTH_S, QUARTER: QUARTER_S };
