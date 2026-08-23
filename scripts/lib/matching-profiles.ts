/**
 * Synthetic libraries for taste bar 4b (mural/library matching) — three fake
 * profiles with distinct poles, paired against Harry's real pull. Raw game
 * rows only; scripts/build-matching-summaries.mts derives recent /
 * completion_fraction and runs the SAME tagLibrary + buildProfile as the real
 * pull, so all four summaries are format-uniform and nothing leaks which is
 * real.
 *
 * Playtimes/recency/achievements are tuned against worker/lib/state.ts
 * thresholds so each library lands its pole (finisher → mastered cluster,
 * cozy → loved + recent cluster, hoarder → abandoned + dusty pile). HLTB
 * hours are embedded statically so tagging is offline-deterministic.
 *
 * Post-pull adjustments (2026-08-23, both pre-registered in the plan before
 * the pull ran):
 * - POLE COLLISION: Harry's real library tagged 4 abandoned / 5 games — the
 *   original third fake ("hoarder", abandoned epics + dusty pile) collided
 *   with it, so it became "collector" (deep unopened hoard, ZERO abandoned;
 *   abandoned stays unique to the real profile).
 * - CONFOUND STRENGTHENER: the collector owns Deep Rock Galactic unopened —
 *   the opposite of Harry's most-played-yet-brief relationship — so a
 *   DRG-flavoured mural cannot be paired on game recognition alone.
 */
import type { AchievementsSummary } from '../../worker/lib/steam';
import type { HltbResult } from '../../worker/lib/hltb';

/** Fixed "now" for deterministic tagging of the fakes: 2026-08-22T12:00Z. */
export const MATCHING_NOW_S = 1_787_400_000;

export interface FakeGame {
  appid: number;
  name: string;
  playtime_forever: number; // minutes
  /** Days before MATCHING_NOW_S it was last played; absent = never opened. */
  lastPlayedDaysAgo?: number;
  achievements?: AchievementsSummary;
  hltb?: HltbResult;
}

export interface FakeProfile {
  id: string;
  pole: string;
  games: FakeGame[];
}

const ach = (percent: number, total: number): AchievementsSummary => ({
  unlocked: Math.round((percent / 100) * total),
  total,
  percent,
});

const hltb = (
  name: string,
  hltbId: number,
  mainStoryHours: number,
  completionistHours: number,
): HltbResult => ({
  matchedName: name,
  hltbId,
  mainStoryHours,
  mainExtrasHours: Math.round(((mainStoryHours + completionistHours) / 2) * 10) / 10,
  completionistHours,
});

export const FAKE_PROFILES: FakeProfile[] = [
  {
    id: 'finisher',
    pole: 'mastery-heavy finisher — five mastered, tiny backlog',
    games: [
      { appid: 367520, name: 'Hollow Knight', playtime_forever: 6200, lastPlayedDaysAgo: 60, achievements: ach(97, 63), hltb: hltb('Hollow Knight', 26286, 26.5, 63) },
      { appid: 1145360, name: 'Hades', playtime_forever: 5800, lastPlayedDaysAgo: 20, achievements: ach(88, 49), hltb: hltb('Hades', 62537, 21.5, 94.5) },
      { appid: 814380, name: 'Sekiro: Shadows Die Twice', playtime_forever: 4700, lastPlayedDaysAgo: 120, achievements: ach(100, 34), hltb: hltb('Sekiro: Shadows Die Twice', 57331, 30, 70) },
      { appid: 504230, name: 'Celeste', playtime_forever: 2900, lastPlayedDaysAgo: 90, achievements: ach(91, 32), hltb: hltb('Celeste', 42834, 8, 37) },
      { appid: 588650, name: 'Dead Cells', playtime_forever: 2100, lastPlayedDaysAgo: 30, achievements: ach(84, 107), hltb: hltb('Dead Cells', 40441, 14.5, 92) },
      { appid: 646570, name: 'Slay the Spire', playtime_forever: 1800, lastPlayedDaysAgo: 45, achievements: ach(45, 46), hltb: hltb('Slay the Spire', 51339, 24, 143) },
      { appid: 1057090, name: 'Ori and the Will of the Wisps', playtime_forever: 900, lastPlayedDaysAgo: 200, achievements: ach(65, 37), hltb: hltb('Ori and the Will of the Wisps', 62755, 11.5, 20) },
      { appid: 268910, name: 'Cuphead', playtime_forever: 0 },
      { appid: 774361, name: 'Blasphemous', playtime_forever: 0 },
    ],
  },
  {
    id: 'cozy',
    pole: 'cozy-recent sampler — one loved anchor, everything else touched this week',
    games: [
      { appid: 413150, name: 'Stardew Valley', playtime_forever: 3400, lastPlayedDaysAgo: 2, achievements: ach(32, 40), hltb: hltb('Stardew Valley', 27036, 52.5, 157) },
      { appid: 972660, name: 'Spiritfarer', playtime_forever: 1100, lastPlayedDaysAgo: 5, achievements: ach(41, 33), hltb: hltb('Spiritfarer', 65533, 24.5, 37.5) },
      { appid: 1455840, name: 'Dorfromantik', playtime_forever: 700, lastPlayedDaysAgo: 12, achievements: ach(28, 41), hltb: hltb('Dorfromantik', 84937, 12, 51) },
      { appid: 914800, name: 'Coffee Talk', playtime_forever: 400, lastPlayedDaysAgo: 6, achievements: ach(50, 18), hltb: hltb('Coffee Talk', 62644, 4.5, 8) },
      { appid: 1135690, name: 'Unpacking', playtime_forever: 300, lastPlayedDaysAgo: 1, achievements: ach(55, 22), hltb: hltb('Unpacking', 74041, 4.5, 8.5) },
      { appid: 1055540, name: 'A Short Hike', playtime_forever: 150, lastPlayedDaysAgo: 3, achievements: ach(60, 12), hltb: hltb('A Short Hike', 6663, 1.5, 4.5) },
      { appid: 1062140, name: 'Garden Story', playtime_forever: 0 },
      { appid: 1458100, name: 'Cozy Grove', playtime_forever: 0 },
    ],
  },
  {
    id: 'collector',
    pole: 'the unopened hoard — buys everything, opens almost nothing, zero abandoned',
    games: [
      { appid: 1794680, name: 'Vampire Survivors', playtime_forever: 480, lastPlayedDaysAgo: 60, achievements: ach(21, 191), hltb: hltb('Vampire Survivors', 91163, 19.5, 82) },
      { appid: 1868140, name: 'DAVE THE DIVER', playtime_forever: 360, lastPlayedDaysAgo: 120, achievements: ach(15, 41), hltb: hltb('DAVE THE DIVER', 114859, 25, 45) },
      // The confound: Harry's most-played game, owned here and never opened.
      { appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 0 },
      { appid: 105600, name: 'Terraria', playtime_forever: 0 },
      { appid: 294100, name: 'RimWorld', playtime_forever: 0 },
      { appid: 379720, name: 'DOOM', playtime_forever: 0 },
      { appid: 261570, name: 'Ori and the Blind Forest', playtime_forever: 0 },
      { appid: 460950, name: 'Katana ZERO', playtime_forever: 0 },
      { appid: 881100, name: 'Noita', playtime_forever: 0 },
      { appid: 1282730, name: 'Loop Hero', playtime_forever: 0 },
      { appid: 262060, name: 'Darkest Dungeon', playtime_forever: 0 },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 0 },
      { appid: 219150, name: 'Hotline Miami', playtime_forever: 0 },
      { appid: 212680, name: 'FTL: Faster Than Light', playtime_forever: 0 },
      { appid: 590380, name: 'Into the Breach', playtime_forever: 0 },
      { appid: 239030, name: 'Papers, Please', playtime_forever: 0 },
      { appid: 1086940, name: "Baldur's Gate 3", playtime_forever: 0 },
    ],
  },
];
