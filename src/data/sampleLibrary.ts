import type { GameEntry } from '../types';

/**
 * Hard-coded sample library for v0.1 of the committed build. Same 7 games as the
 * 2D prototype. Replaced by a real Steam Web API library fetch at v0.2.
 * appids are real Steam app IDs so header.jpg loads from Steam's CDN.
 */
export const SAMPLE_LIBRARY: GameEntry[] = [
  { appid: 1145360, name: 'Hades',           ritualColor: '#7a1f1f' },
  { appid: 413150,  name: 'Stardew Valley',  ritualColor: '#3f6a2f' },
  { appid: 367520,  name: 'Hollow Knight',   ritualColor: '#1a2436' },
  { appid: 632470,  name: 'Disco Elysium',   ritualColor: '#5a3a1f' },
  { appid: 753640,  name: 'Outer Wilds',     ritualColor: '#3a2a5a' },
  { appid: 646570,  name: 'Slay the Spire',  ritualColor: '#5a2a3a' },
  { appid: 289070,  name: 'Civilization VI', ritualColor: '#2a3a5a' },
];

/** Build the Steam CDN header.jpg URL for a given appid. Free to hotlink. */
export function headerImageUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}
