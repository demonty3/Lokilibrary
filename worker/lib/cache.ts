/**
 * Read-through KV cache used by Steam (slice 2), HLTB (slice 4), IGDB (Phase
 * 3), and the Stage 1 manifest. Same pattern everywhere: try cache, miss →
 * call the upstream fetcher, write the result back with a TTL, return it.
 *
 * `force` bypasses the read but still writes (useful for the `?force=1`
 * developer escape hatch on /api/library). If KV is unavailable — production
 * not yet provisioned, dev not connected — falls back to an uncached fetch
 * rather than crashing; we'd rather burn an extra API call than 500 the user.
 */

export interface KvCacheOptions {
  /** Skip the read; still writes a fresh value. Defaults to false. */
  force?: boolean;
}

/**
 * Read-through KV cache. `T` is whatever the fetcher returns — anything
 * JSON.stringify-able. Caller is responsible for keeping shapes stable so a
 * cached older shape doesn't blow up the new code path.
 */
export async function kvGet<T>(
  kv: KVNamespace | undefined,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  opts: KvCacheOptions = {},
): Promise<T> {
  if (!kv) return fetcher();

  if (!opts.force) {
    try {
      const hit = await kv.get(key, 'json');
      if (hit !== null) return hit as T;
    } catch {
      // KV read failed — fall through to refetch.
    }
  }

  const fresh = await fetcher();
  try {
    await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });
  } catch {
    // Write failure is non-fatal — return the value anyway.
  }
  return fresh;
}
