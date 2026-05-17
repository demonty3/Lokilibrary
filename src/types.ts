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
 * One game as returned by /api/library (Phase 2 slice 2). Kept distinct from
 * GameEntry — the renderer consumes GameEntry; behavioral signals live here
 * and feed the profile builder + state tagger in later slices.
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
}

export interface SteamPersona {
  steamId: string;
  name: string;
  avatarUrl: string;
}
