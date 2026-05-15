/** Which launch-ritual animation a game plays. Defaults to 'tint'. */
export type RitualStyle = 'tint' | 'casefile';

/** A single game in the user's library, as the world consumes it. */
export interface GameEntry {
  /** Steam application ID. */
  appid: number;
  /** Display name. */
  name: string;
  /** Optional dominant color (CSS hex) used to tint the launch ritual. */
  ritualColor?: string;
  /** Which ritual variant plays on launch. Defaults to 'tint'. */
  ritualStyle?: RitualStyle;
}
