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
