/** A single game in the user's library, as the world consumes it. */
export interface GameEntry {
  /** Steam application ID. */
  appid: number;
  /** Display name. */
  name: string;
  /**
   * Optional dominant color (CSS hex). Used as a fallback ritual tint before the
   * AI world manifest assigns a proper archetype + ritual.
   */
  ritualColor?: string;
}

/**
 * One game as returned by /api/library. The minimal shape (appid, name,
 * playtime fields) holds for every entry; top-N games carry the enrichment
 * fields added in Phase 2 slice 3 — `achievements` and `recent`. The
 * renderer consumes GameEntry; behavioral signals live here and feed the
 * profile builder + state tagger in later slices.
 */
export interface LibraryGame {
  appid: number;
  name: string;
  /** Total Steam playtime, minutes. */
  playtime_forever: number;
  /** Playtime in the last two weeks, minutes. Often absent if zero. */
  playtime_2weeks?: number;
  /** Unix seconds. Absent if the game has never been launched. */
  rtime_last_played?: number;

  // --- Slice 3 enrichment, only set on the top-N games. -------------------

  /** Public achievement summary. Absent if the game has no achievements, or
   *  the user's achievement details are private, or the appid is unsupported
   *  by the achievements endpoint (demos, soundtracks, etc.). */
  achievements?: {
    unlocked: number;
    total: number;
    percent: number;
  };
  /** True if the game has been played in the last 7 days (or appears in
   *  GetRecentlyPlayedGames, which catches free-to-play / family-share). */
  recent?: boolean;

  // --- Slice 4 enrichment, only set on the top-N games when HLTB matched. ---

  /** Community completion-time data from HowLongToBeat. Absent if HLTB had
   *  no match for the name, the HLTB endpoint was unreachable, or HLTB
   *  doesn't have figures for this title (rare for popular games). */
  hltb?: {
    matchedName: string;
    hltbId: number;
    mainStoryHours: number;
    mainExtrasHours: number;
    completionistHours: number;
  };
  /** Steam playtime hours ÷ HLTB main-story hours. >1.0 means past the main
   *  story (SPEC §7.2 — the signal that separates "lived in" from "tutorial
   *  abandoned"). Only set when both inputs are available. */
  completion_fraction?: number;
}

export interface SteamPersona {
  steamId: string;
  name: string;
  avatarUrl: string;
}

/**
 * Phase 2 slice 5 — behavioral profile. Mirrors worker/lib/profile.ts. Built
 * server-side from the enriched library and exposed on /api/library mainly so
 * the connector panel can preview what Stage 1 will see at slice 7. The
 * worker also re-builds it internally when /api/world fires.
 */
export type Engagement =
  | 'deeply_lived_in'
  | 'past_main'
  | 'engaged'
  | 'tried'
  | 'just_opened'
  | 'unplayed';

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
  topGames: ProfileGameSummary[];
  bingeRatio: number;
  completionRateAvg?: number;
  recentlyActiveCount: number;
  /** Prompt-ready text, matches SPEC §8's shape. Fed into Stage 1 at slice 7. */
  summary: string;
}
