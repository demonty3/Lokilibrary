/**
 * Behavioral profile builder. Deterministic, pure — given the same enriched
 * library it always produces the same profile. SPEC §2.3 step 1 + §8 (the
 * Stage 1 prompt shape) drive the field set.
 *
 * What this slice consumes (built in earlier slices):
 *   - playtime_forever, rtime_last_played (slice 2 — GetOwnedGames)
 *   - recent boolean (slice 3 — GetRecentlyPlayedGames + rtime_last_played)
 *   - achievements.percent (slice 3 — GetPlayerAchievements)
 *   - completion_fraction (slice 4 — playtime_h / HLTB mainStoryHours)
 *
 * What it produces:
 *   - Structured Profile (for the procedural layer at Phase 5 to seed off)
 *   - Prompt-ready text summary (for the Stage 1 LLM call at slice 7)
 *
 * The state tagger (slice 6) consumes the same enriched-game shape; it does
 * NOT consume this profile. Profile is the *aggregate* view; state is the
 * per-game label. They're independent layers.
 */

import type { AchievementsSummary } from './steam';
import type { HltbResult } from './hltb';
import type { LibraryState } from './state';

/** Mirrors the EnrichedGame shape worker/index.ts assembles. */
export interface ProfileInputGame {
  appid: number;
  name: string;
  playtime_forever: number;       // minutes
  playtime_2weeks?: number;       // minutes
  rtime_last_played?: number;
  achievements?: AchievementsSummary;
  recent?: boolean;
  hltb?: HltbResult;
  completion_fraction?: number;
  /** Slice 6 — tagState() output. Available when tagLibrary() ran before
   *  the profile build (current /api/library flow). */
  state?: LibraryState;
}

export type Engagement =
  | 'deeply_lived_in'   // fraction >=5, or playtime >=50h without HLTB data
  | 'past_main'         // fraction in [1.0, 5)
  | 'engaged'           // fraction in [0.3, 1.0), or playtime in [10, 50)h
  | 'tried'             // fraction <0.3, or playtime in [2, 10)h
  | 'just_opened'       // playtime in (0, 2)h
  | 'unplayed';         // playtime == 0

/** Per-game summary as it appears in the profile. */
export interface ProfileGameSummary {
  appid: number;
  name: string;
  playtimeHours: number;
  completionFraction?: number;
  engagement: Engagement;
  achievementPercent?: number;
  recent: boolean;
}

export interface Profile {
  totalGames: number;
  playedGames: number;
  dustyGames: number;
  totalPlaytimeHours: number;
  /** Top-N games in order, enriched with engagement descriptor. */
  topGames: ProfileGameSummary[];
  /** Top-3 playtime as fraction of total (0–1). >=0.5 high, >=0.7 very high. */
  bingeRatio: number;
  /** Average achievement percent across top-N games with data (0–100). */
  completionRateAvg?: number;
  /** Count of top-N games with recent === true. */
  recentlyActiveCount: number;
  /** Per-state counts across the whole library (slice 6). Absent if state
   *  wasn't tagged before the profile build. */
  stateCounts?: Record<LibraryState, number>;
  /** Prompt-ready text summary, matching SPEC §8's shape. */
  summary: string;
}

export function buildProfile(
  library: ProfileInputGame[],
  topN: number,
): Profile {
  const totalGames = library.length;
  const playedGames = library.filter((g) => g.playtime_forever > 0).length;
  const dustyGames = totalGames - playedGames;
  const totalPlaytimeHours = round(
    library.reduce((sum, g) => sum + g.playtime_forever / 60, 0),
  );

  const top = library.slice(0, topN);
  const topGames: ProfileGameSummary[] = top.map((g) => ({
    appid: g.appid,
    name: g.name,
    playtimeHours: round(g.playtime_forever / 60),
    ...(g.completion_fraction !== undefined && { completionFraction: g.completion_fraction }),
    engagement: engagementFor(g),
    ...(g.achievements && { achievementPercent: g.achievements.percent }),
    recent: g.recent ?? false,
  }));

  // Binge ratio uses top-3 against total playtime across the whole library.
  // A power-user with 200 played games and a slight Hades lean has low binge;
  // a casual with 5 played games and 90% Hades has high binge.
  const top3Playtime = topGames.slice(0, 3).reduce((s, g) => s + g.playtimeHours, 0);
  const bingeRatio = totalPlaytimeHours > 0 ? round(top3Playtime / totalPlaytimeHours, 3) : 0;

  // Completion rate: average of achievement % across the top-N games that
  // expose achievements at all. Reported in the prompt as "this is a finisher"
  // vs "this is a sampler" — Stage 1 uses it to lean toward completionist
  // metaphors or wandering ones.
  const achPercents = topGames
    .map((g) => g.achievementPercent)
    .filter((p): p is number => typeof p === 'number');
  const completionRateAvg = achPercents.length
    ? round(achPercents.reduce((s, p) => s + p, 0) / achPercents.length, 1)
    : undefined;

  const recentlyActiveCount = topGames.filter((g) => g.recent).length;

  // State counts (slice 6) — only meaningful if tagLibrary() ran before this.
  let stateCounts: Record<LibraryState, number> | undefined;
  const tagged = library.filter((g): g is ProfileInputGame & { state: LibraryState } =>
    typeof g.state === 'string',
  );
  if (tagged.length > 0) {
    stateCounts = {
      loved: 0, recent: 0, mastered: 0, abandoned: 0, dusty: 0, default: 0,
    };
    for (const g of tagged) stateCounts[g.state]++;
  }

  const summary = summarize({
    totalGames,
    playedGames,
    dustyGames,
    totalPlaytimeHours,
    topGames,
    bingeRatio,
    ...(completionRateAvg !== undefined && { completionRateAvg }),
    recentlyActiveCount,
    ...(stateCounts && { stateCounts }),
  });

  return {
    totalGames,
    playedGames,
    dustyGames,
    totalPlaytimeHours,
    topGames,
    bingeRatio,
    ...(completionRateAvg !== undefined && { completionRateAvg }),
    recentlyActiveCount,
    ...(stateCounts && { stateCounts }),
    summary,
  };
}

function engagementFor(g: ProfileInputGame): Engagement {
  const hours = g.playtime_forever / 60;
  if (hours === 0) return 'unplayed';

  if (g.completion_fraction !== undefined) {
    if (g.completion_fraction >= 5) return 'deeply_lived_in';
    if (g.completion_fraction >= 1.0) return 'past_main';
    if (g.completion_fraction >= 0.3) return 'engaged';
    return 'tried';
  }

  // No HLTB cross-reference — use playtime alone (coarser but honest).
  if (hours >= 50) return 'deeply_lived_in';
  if (hours >= 10) return 'engaged';
  if (hours >= 2) return 'tried';
  return 'just_opened';
}

const ENGAGEMENT_PHRASING: Record<Engagement, string> = {
  deeply_lived_in: 'deeply lived-in',
  past_main: 'past main, ongoing',
  engaged: 'engaged but unfinished',
  tried: 'tried',
  just_opened: 'just opened',
  unplayed: 'unplayed',
};

/** Renders the prompt-ready text per SPEC §8. */
function summarize(p: Omit<Profile, 'summary'>): string {
  const lines: string[] = ['Behavioral profile:'];
  lines.push(`- Total owned games: ${p.totalGames}`);
  lines.push(`- Total playtime: ${p.totalPlaytimeHours.toLocaleString()}h`);

  if (p.topGames.length > 0) {
    lines.push(`- Top ${p.topGames.length} by playtime:`);
    for (const g of p.topGames) {
      const parts: string[] = [`${g.playtimeHours}h played`];
      if (g.completionFraction !== undefined && g.completionFraction > 0) {
        parts.push(`completion fraction ${g.completionFraction.toFixed(1)}`);
      }
      parts.push(`(${ENGAGEMENT_PHRASING[g.engagement]})`);
      if (g.recent) parts.push('played recently');
      lines.push(`  - ${g.name} — ${parts.join(', ')}`);
    }
  }

  if (p.completionRateAvg !== undefined) {
    lines.push(
      `- Avg achievement completion (top-N): ${p.completionRateAvg}% — ${
        p.completionRateAvg >= 60 ? 'a finisher' : p.completionRateAvg >= 30 ? 'mixed' : 'a sampler'
      }`,
    );
  }

  const bingePct = Math.round(p.bingeRatio * 100);
  const bingeLabel =
    p.bingeRatio >= 0.7 ? 'very high' : p.bingeRatio >= 0.5 ? 'high' : p.bingeRatio >= 0.3 ? 'moderate' : 'low';
  lines.push(`- Binge ratio: ${bingeLabel} (top 3 games = ${bingePct}% of total playtime)`);

  if (p.recentlyActiveCount > 0) {
    lines.push(`- Recent activity: ${p.recentlyActiveCount} of top ${p.topGames.length} played in the last week`);
  } else {
    lines.push('- Recent activity: none of the top games played in the last week');
  }

  lines.push(`- Dusty backlog (owned, never opened): ${p.dustyGames} titles`);

  if (p.stateCounts) {
    const c = p.stateCounts;
    const interesting: Array<[LibraryState, string]> = [
      ['loved', 'loved'],
      ['mastered', 'mastered'],
      ['recent', 'recently played'],
      ['abandoned', 'abandoned partway'],
    ];
    const parts = interesting
      .map(([k, label]) => (c[k] > 0 ? `${c[k]} ${label}` : null))
      .filter((s): s is string => s !== null);
    if (parts.length > 0) {
      lines.push(`- Library states: ${parts.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function round(n: number, places = 1): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
