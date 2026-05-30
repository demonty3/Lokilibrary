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

  // --- Slice 6 — applied to every game by the state tagger. ---------------

  /** SPEC §4 library state. Drives in-world visual treatment at Phase 4
   *  and feeds the Stage 1 prompt at slice 7 in place of raw playtime
   *  numbers (PLAN.md task 6). */
  state?: LibraryState;
}

/**
 * Scale-ladder level. Phase 7-A implements `cell` + `district` + `island` +
 * `continent` (the last three driven by the `src/procedural/clusters.ts`
 * tree); `planet` + `solar_system` remain richer stubs via `mountStubLevel`
 * (planet = speculative rotating world, solar_system = Year-3 multi-source).
 * Per SPEC §4 (scale ladder), each level has its own rendering vocabulary +
 * agent-perception scope.
 */
export type ScaleLevel =
  | 'cell'
  | 'district'
  | 'island'
  | 'continent'
  | 'planet'
  | 'solar_system';

export const SCALE_ORDER: readonly ScaleLevel[] = [
  'cell',
  'district',
  'island',
  'continent',
  'planet',
  'solar_system',
];

/**
 * Phase 7-B — composable panes. A `PaneRect` is a cell on a uniform integer
 * composition grid (gridCols × gridRows): {col, row} is the top-left grid cell
 * the pane occupies; {cols, rows} is how many grid cells it spans. The renderer
 * (src/render/PixiApp.ts) maps a PaneRect onto a pixel rectangle against the
 * live screen size. Pure data: no runtime, importable by both the store and the
 * renderer with no import cycle.
 */
export interface PaneRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/**
 * Phase 7-B — one pane in the composable-panes arrangement. {id} is a
 * deterministic monotonic id (`root`, `p2`, `p3`, …) sourced from the store's
 * paneSeq counter — never Math.random/Date.now, so the world stays
 * reproducible. {level} is the scale rung the pane renders; {rect} is its
 * placement on the composition grid. The DEFAULT single 'root' pane covers the
 * whole 1×1 grid at level 'cell' — byte-equivalent to the pre-7-B scale scalar.
 */
export interface PaneDescriptor {
  id: string;
  level: ScaleLevel;
  rect: PaneRect;
}

/** Mirrors worker/lib/state.ts. SPEC §4 enumeration. */
export type LibraryState =
  | 'loved'
  | 'recent'
  | 'mastered'
  | 'abandoned'
  | 'dusty'
  | 'default';

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
  /** Slice 6 — per-state counts across the whole library. */
  stateCounts?: Record<LibraryState, number>;
  /** Prompt-ready text, matches SPEC §8's shape. Fed into Stage 1 at slice 7. */
  summary: string;
}
