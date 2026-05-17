/**
 * Steam Web API client. All calls go through the Worker (frontend never holds
 * the key — CLAUDE.md). Phase 2 currently ships four calls:
 *   - GetOwnedGames + include_appinfo=1 (one call returns names + playtime)
 *   - GetPlayerSummaries (persona + avatar for the connector panel header)
 *   - GetRecentlyPlayedGames (cross-references against owned for recency)
 *   - GetPlayerAchievements (per-appid; mastery / completion signals)
 *
 * Private-profile detection (SPEC §7.1 "Privacy gotcha"): GetOwnedGames
 * returns `{response: {}}` — no game_count, no games array — when the user
 * has either their whole profile or game details set to private. We surface
 * this as a structured error so the connector panel can show the right hint.
 *
 * GetPlayerAchievements is more nuanced: it can return 200 with
 * `playerstats.success: false` for games with no achievements or with
 * achievements set to private. Treat those as "no signal" (return null) —
 * never as an error, since most libraries contain a handful of titles
 * without public achievements.
 */

const STEAM_API = 'https://api.steampowered.com';

export type SteamErrorReason =
  | 'unauthorized'
  | 'rate_limited'
  | 'private_profile'
  | 'upstream'
  | 'no_api_key';

export class SteamError extends Error {
  constructor(readonly reason: SteamErrorReason, message: string) {
    super(message);
  }
}

export interface OwnedGame {
  appid: number;
  name: string;
  /** Steam playtime in minutes. */
  playtime_forever: number;
  /** Playtime in the last two weeks (minutes). Often absent if zero. */
  playtime_2weeks?: number;
  /** Unix seconds; absent if never played. */
  rtime_last_played?: number;
}

export interface Persona {
  steamId: string;
  name: string;
  avatarUrl: string;
}

interface RawOwnedGame {
  appid: number;
  name?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
}
interface OwnedGamesResponse {
  response: { game_count?: number; games?: RawOwnedGame[] };
}
interface PlayerSummariesResponse {
  response: { players?: Array<{ steamid: string; personaname: string; avatarfull: string }> };
}

export async function fetchOwnedGames(steamId: string, apiKey: string): Promise<OwnedGame[]> {
  if (!apiKey) throw new SteamError('no_api_key', 'STEAM_WEB_API_KEY not configured');

  const url = new URL(`${STEAM_API}/IPlayerService/GetOwnedGames/v1/`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamid', steamId);
  url.searchParams.set('include_appinfo', '1');
  url.searchParams.set('include_played_free_games', '1');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (res.status === 401 || res.status === 403) {
    throw new SteamError('unauthorized', `steam ${res.status} — check STEAM_WEB_API_KEY`);
  }
  if (res.status === 429) throw new SteamError('rate_limited', 'steam 429');
  if (!res.ok) throw new SteamError('upstream', `steam ${res.status}`);

  const data = (await res.json()) as OwnedGamesResponse;
  // Private profile / game details hidden → response is {response: {}}.
  if (!data.response || !Array.isArray(data.response.games)) {
    throw new SteamError(
      'private_profile',
      'steam returned no games — profile is private or game details are hidden',
    );
  }

  return data.response.games
    .filter((g): g is RawOwnedGame & { name: string } => typeof g.name === 'string')
    .map((g) => ({
      appid: g.appid,
      name: g.name,
      playtime_forever: g.playtime_forever ?? 0,
      ...(g.playtime_2weeks !== undefined && { playtime_2weeks: g.playtime_2weeks }),
      ...(g.rtime_last_played !== undefined && { rtime_last_played: g.rtime_last_played }),
    }))
    .sort((a, b) => b.playtime_forever - a.playtime_forever);
}

export interface RecentlyPlayedEntry {
  appid: number;
  /** Playtime in the last two weeks (minutes). */
  playtime_2weeks: number;
  /** Lifetime playtime, for the same row from Steam's POV. Often redundant
   *  with GetOwnedGames; we keep it so callers don't need both calls. */
  playtime_forever: number;
}

interface RecentlyPlayedResponse {
  response: { total_count?: number; games?: RecentlyPlayedEntry[] };
}

export async function fetchRecentlyPlayed(
  steamId: string,
  apiKey: string,
): Promise<RecentlyPlayedEntry[]> {
  if (!apiKey) throw new SteamError('no_api_key', 'STEAM_WEB_API_KEY not configured');

  const url = new URL(`${STEAM_API}/IPlayerService/GetRecentlyPlayedGames/v1/`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamid', steamId);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (res.status === 401 || res.status === 403) {
    throw new SteamError('unauthorized', `steam ${res.status} — check STEAM_WEB_API_KEY`);
  }
  if (res.status === 429) throw new SteamError('rate_limited', 'steam 429');
  if (!res.ok) throw new SteamError('upstream', `steam ${res.status}`);

  const data = (await res.json()) as RecentlyPlayedResponse;
  return data.response.games ?? [];
}

export interface AchievementsSummary {
  unlocked: number;
  total: number;
  /** 0–100, rounded to one decimal. */
  percent: number;
}

interface PlayerAchievementsResponse {
  playerstats?: {
    success?: boolean;
    error?: string;
    achievements?: Array<{ achieved: number }>;
  };
}

/**
 * Returns null when the game has no achievements, or the user has set
 * achievement details to private, or the appid is unsupported by the
 * endpoint (some demos / soundtracks / dedicated servers). Throws only on
 * unambiguous infrastructure failures.
 */
export async function fetchAchievements(
  steamId: string,
  appid: number,
  apiKey: string,
): Promise<AchievementsSummary | null> {
  if (!apiKey) throw new SteamError('no_api_key', 'STEAM_WEB_API_KEY not configured');

  const url = new URL(`${STEAM_API}/ISteamUserStats/GetPlayerAchievements/v0001/`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamid', steamId);
  url.searchParams.set('appid', String(appid));
  url.searchParams.set('l', 'english');

  const res = await fetch(url.toString());
  // 400 / 403 are the documented "no public achievements / not supported"
  // responses; treat as no signal rather than failing the whole library load.
  if (res.status === 400 || res.status === 403) return null;
  if (res.status === 429) throw new SteamError('rate_limited', 'steam 429');
  if (!res.ok) throw new SteamError('upstream', `steam ${res.status} for appid ${appid}`);

  const data = (await res.json()) as PlayerAchievementsResponse;
  const stats = data.playerstats;
  if (!stats || stats.success === false || !Array.isArray(stats.achievements)) return null;

  const total = stats.achievements.length;
  if (total === 0) return null;
  const unlocked = stats.achievements.reduce((n, a) => n + (a.achieved ? 1 : 0), 0);
  return {
    unlocked,
    total,
    percent: Math.round((unlocked / total) * 1000) / 10,
  };
}

export async function fetchPersona(steamId: string, apiKey: string): Promise<Persona> {
  if (!apiKey) throw new SteamError('no_api_key', 'STEAM_WEB_API_KEY not configured');

  const url = new URL(`${STEAM_API}/ISteamUser/GetPlayerSummaries/v0002/`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamids', steamId);

  const res = await fetch(url.toString());
  if (res.status === 401 || res.status === 403) {
    throw new SteamError('unauthorized', `steam ${res.status} — check STEAM_WEB_API_KEY`);
  }
  if (res.status === 429) throw new SteamError('rate_limited', 'steam 429');
  if (!res.ok) throw new SteamError('upstream', `steam ${res.status}`);

  const data = (await res.json()) as PlayerSummariesResponse;
  const player = data.response.players?.[0];
  if (!player) throw new SteamError('upstream', 'steam returned no player');
  return {
    steamId: player.steamid,
    name: player.personaname,
    avatarUrl: player.avatarfull,
  };
}
