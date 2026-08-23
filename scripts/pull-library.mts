/**
 * Pull a real Steam library into a local fixture + text summary —
 * `npx tsx scripts/pull-library.mts [--steamid <id64>] [--top 15] [--out fixtures/library]`.
 *
 * Mirrors the worker's /api/library pipeline (worker/index.ts assembleLibrary /
 * enrichTopGames) without the session gate or KV: owned games → top-N
 * enrichment (recently-played, achievements, HLTB) → tagLibrary → buildProfile.
 * Reads STEAM_WEB_API_KEY from worker/.dev.vars. Output goes to the gitignored
 * fixtures/ dir — real library data never enters the public repo; the
 * committed matching-test artefacts carry only the profile summary text.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  fetchOwnedGames,
  fetchRecentlyPlayed,
  fetchAchievements,
  fetchPersona,
  SteamError,
  type OwnedGame,
  type AchievementsSummary,
  type RecentlyPlayedEntry,
} from '../worker/lib/steam.ts';
import { discoverHltbEndpoint, searchHltb, type HltbResult } from '../worker/lib/hltb.ts';
import { tagLibrary, stateCounts } from '../worker/lib/state.ts';
import { buildProfile } from '../worker/lib/profile.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Recency window for the `recent` flag — worker/index.ts RECENT_WINDOW_S. */
const RECENT_WINDOW_S = 60 * 60 * 24 * 7;
/** Pause between sequential HLTB searches — the script has no KV cache, so
 *  parallel bursts (the worker's pattern) would risk throttling. */
const HLTB_DELAY_MS = 300;

const { values: args } = parseArgs({
  options: {
    steamid: { type: 'string', default: '76561198405139364' },
    top: { type: 'string', default: '15' },
    out: { type: 'string', default: 'fixtures/library' },
  },
});
const steamId = args.steamid!;
const topN = Number(args.top);
const outDir = join(ROOT, args.out!);

function readApiKey(): string {
  const devVarsPath = join(ROOT, 'worker/.dev.vars');
  let text: string;
  try {
    text = readFileSync(devVarsPath, 'utf8');
  } catch {
    console.error(`cannot read ${devVarsPath} — copy worker/.dev.vars.example first`);
    process.exit(1);
  }
  const match = text.match(/^STEAM_WEB_API_KEY=(.+)$/m);
  const key = match?.[1].trim();
  if (!key) {
    console.error(
      'STEAM_WEB_API_KEY is empty in worker/.dev.vars.\n' +
        'Grab one (30s, while logged into Steam): https://steamcommunity.com/dev/apikey\n' +
        '(any domain, e.g. localhost) and paste it after STEAM_WEB_API_KEY=',
    );
    process.exit(1);
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const apiKey = readApiKey();
  const nowS = Math.floor(Date.now() / 1000);

  const persona = await fetchPersona(steamId, apiKey).catch(() => null);

  let owned: OwnedGame[];
  try {
    owned = await fetchOwnedGames(steamId, apiKey);
  } catch (err) {
    if (err instanceof SteamError && err.reason === 'private_profile') {
      console.error(
        `Steam returned no games for ${steamId} — game details are hidden.\n` +
          'Fix: Steam → Profile → Edit Profile → Privacy Settings → "Game details: Public",\n' +
          'then re-run. (Profile-level "Public" alone is not enough.)',
      );
      process.exit(1);
    }
    throw err;
  }
  if (owned.length === 0) {
    console.error(`library for ${steamId} is empty — nothing to pull`);
    process.exit(1);
  }
  console.log(`owned games: ${owned.length}${persona ? ` (persona: ${persona.name})` : ''}`);

  // Top-N enrichment — worker/index.ts enrichTopGames, minus KV.
  const top = owned.slice(0, topN);
  const recentCutoff = nowS - RECENT_WINDOW_S;
  const recent: RecentlyPlayedEntry[] = await fetchRecentlyPlayed(steamId, apiKey).catch(() => []);
  const recentAppids = new Set(recent.map((g) => g.appid));
  const achievements: Array<AchievementsSummary | null> = await Promise.all(
    top.map((g) => fetchAchievements(steamId, g.appid, apiKey).catch(() => null)),
  );

  const hltbEndpoint = await discoverHltbEndpoint();
  if (!hltbEndpoint) console.warn('HLTB endpoint discovery failed — tagging degrades to playtime-only');
  const hltbs: Array<HltbResult | null> = [];
  for (const g of top) {
    hltbs.push(hltbEndpoint ? await searchHltb(g.name, hltbEndpoint).catch(() => null) : null);
    if (hltbEndpoint) await sleep(HLTB_DELAY_MS);
  }

  const enrichedTop = top.map((game, i) => {
    const isRecent =
      recentAppids.has(game.appid) ||
      (typeof game.rtime_last_played === 'number' && game.rtime_last_played >= recentCutoff);
    const ach = achievements[i];
    const hltb = hltbs[i];
    const completionFraction =
      hltb && hltb.mainStoryHours > 0 && game.playtime_forever > 0
        ? Math.round(((game.playtime_forever / 60) / hltb.mainStoryHours) * 100) / 100
        : undefined;
    return {
      ...game,
      ...(ach && { achievements: ach }),
      ...(isRecent && { recent: true }),
      ...(hltb && { hltb }),
      ...(completionFraction !== undefined && { completion_fraction: completionFraction }),
    };
  });

  const tagged = tagLibrary([...enrichedTop, ...owned.slice(topN)], nowS);
  const profile = buildProfile(tagged, topN);

  // Self-checks: a pull that silently produced nothing is worse than a crash.
  if (profile.topGames.length === 0) throw new Error('self-check failed: empty topGames');
  if (!profile.summary.includes('Behavioral profile:')) {
    throw new Error('self-check failed: summary shape');
  }

  mkdirSync(outDir, { recursive: true });
  const base = join(outDir, `harry-${steamId}`);
  writeFileSync(
    `${base}.json`,
    JSON.stringify(
      {
        pulledAt: new Date(nowS * 1000).toISOString(),
        steamId,
        persona,
        hltbAvailable: Boolean(hltbEndpoint),
        gameCount: owned.length,
        library: tagged,
        profile,
      },
      null,
      2,
    ),
  );
  writeFileSync(`${base}.summary.txt`, profile.summary + '\n');

  console.log(`\nwrote ${base}.json + .summary.txt\n`);
  console.log(profile.summary);
  console.log('\nstate counts:', stateCounts(tagged));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
