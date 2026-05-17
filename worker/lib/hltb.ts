/**
 * HowLongToBeat client. HLTB has no official API (SPEC §7.2); the community
 * reverse-engineered a search endpoint whose URL contains a session-derived
 * hash that rotates periodically. To stay reasonably resilient:
 *
 *   1. Scrape the HLTB homepage for the current Next.js bundle URL.
 *   2. Fetch that bundle and regex out the search endpoint.
 *   3. Cache the resolved endpoint (1h TTL).
 *   4. POST a search by lowercased game name; take the first result.
 *   5. Cache the per-name result (30d TTL — HLTB times barely change).
 *
 * Anything failing returns null. SPEC §7.2: "Don't let an HLTB outage break
 * the world generation." Callers treat null as "we don't have this signal"
 * and proceed with playtime-only state tagging.
 */

const HLTB_BASE = 'https://howlongtobeat.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Endpoint discovery is moderately expensive; cache it on the KV side for an
 *  hour so we don't hit the homepage on every uncached game lookup. */
export const HLTB_ENDPOINT_TTL_S = 60 * 60;

/** Per-name result cache. SPEC §7.2 — HLTB completion times move very rarely. */
export const HLTB_RESULT_TTL_S = 60 * 60 * 24 * 30;

export interface HltbResult {
  /** What HLTB returned — useful if the match disagrees with the Steam name. */
  matchedName: string;
  hltbId: number;
  /** Hours, 0 means HLTB doesn't have the figure (treated as missing). */
  mainStoryHours: number;
  mainExtrasHours: number;
  completionistHours: number;
}

/**
 * Discover HLTB's current search endpoint. Returns the absolute URL or null.
 * Implementation is permissive on purpose — the bundle path and the search
 * key both rotate; we accept anything matching the broad shape.
 */
export async function discoverHltbEndpoint(): Promise<string | null> {
  try {
    const home = await fetch(`${HLTB_BASE}/`, {
      headers: { 'user-agent': UA, accept: 'text/html' },
    });
    if (!home.ok) return null;
    const html = await home.text();

    // <script src="/_next/static/chunks/pages/_app-<HASH>.js">
    const bundleMatch = html.match(
      /\/_next\/static\/chunks\/pages\/_app-[A-Za-z0-9_-]+\.js/,
    );
    if (!bundleMatch) return null;

    const bundleUrl = `${HLTB_BASE}${bundleMatch[0]}`;
    const bundle = await fetch(bundleUrl, { headers: { 'user-agent': UA } });
    if (!bundle.ok) return null;
    const js = await bundle.text();

    // The search endpoint key has been "/api/search/<HASH>", "/api/seek/<HASH>",
    // and "/api/find/<HASH>" at various points. Match the broad shape.
    const endpointMatch = js.match(
      /"\/api\/(?:search|seek|find)\/([A-Za-z0-9_-]+)"/,
    );
    if (!endpointMatch) return null;

    // Reconstruct the absolute URL by splicing the matched fragment back in.
    const segment = endpointMatch[0].slice(1, -1); // strip the surrounding quotes
    return `${HLTB_BASE}${segment}`;
  } catch {
    return null;
  }
}

interface HltbSearchResponse {
  data?: Array<{
    game_id?: number;
    game_name?: string;
    /** Seconds. */
    comp_main?: number;
    comp_plus?: number;
    comp_100?: number;
  }>;
}

/**
 * POST a search query against a discovered endpoint. Returns the first match
 * or null. Times are returned by HLTB in seconds — convert to hours here.
 */
export async function searchHltb(
  name: string,
  endpoint: string,
): Promise<HltbResult | null> {
  const body = {
    searchType: 'games',
    searchTerms: name.toLowerCase().split(/\s+/).filter(Boolean),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': UA,
        referer: `${HLTB_BASE}/`,
        origin: HLTB_BASE,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HltbSearchResponse;
    const first = data.data?.[0];
    if (!first || typeof first.game_id !== 'number' || typeof first.game_name !== 'string') {
      return null;
    }
    return {
      matchedName: first.game_name,
      hltbId: first.game_id,
      mainStoryHours: secondsToHours(first.comp_main),
      mainExtrasHours: secondsToHours(first.comp_plus),
      completionistHours: secondsToHours(first.comp_100),
    };
  } catch {
    return null;
  }
}

function secondsToHours(s: number | undefined): number {
  if (typeof s !== 'number' || s <= 0) return 0;
  return Math.round((s / 3600) * 10) / 10;
}
