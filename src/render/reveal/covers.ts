/**
 * Hero-cover loader for the reveal's "oh I own that" beat. Loads a bounded
 * handful of Steam `header.jpg` textures (the recognition surface — CLAUDE.md
 * "per-game art = Steam CDN") and hands them back for the build phase to fade
 * onto bookshelf slots.
 *
 * Best-effort and non-blocking: any failure (offline, 404, CORS) is swallowed
 * per-cover so the reveal stays glyph-only rather than erroring. Nothing here
 * is on the critical path — the reveal plays with or without covers.
 *
 * Note for the deferred share-image export: these textures come cross-origin
 * from Steam's CDN. Displaying them is fine, but reading the canvas back
 * (toDataURL) would taint it — when export lands, proxy header images through
 * the Worker. Not a concern for on-screen playback.
 */

import { Assets, type Texture } from 'pixi.js';
import { headerImageUrl } from '../../data/sampleLibrary';

export interface HeroCover {
  appid: number;
  texture: Texture;
}

/** Load up to `max` covers for the given appids, preserving input order.
 *  Resolves once all attempts settle; failed covers are simply omitted. */
export async function loadHeroCovers(
  appids: readonly number[],
  max = 4,
): Promise<HeroCover[]> {
  const pick = appids.slice(0, max);
  const settled = await Promise.all(
    pick.map(async (appid): Promise<HeroCover | null> => {
      try {
        const texture = await Assets.load<Texture>(headerImageUrl(appid));
        return texture ? { appid, texture } : null;
      } catch {
        return null;
      }
    }),
  );
  return settled.filter((c): c is HeroCover => c !== null);
}
