/**
 * PixelArtProvider — the generative tier for sprite assets, parallel to
 * the Tier 1/Tier 2 LLM router. **Template-build time only**: per
 * CLAUDE.md "default to template-build-time generation; runtime
 * generative API calls require explicit scoping." Phase 3A defines the
 * interface; Phase 3B wires the PixelLab.ai cloud provider; Phase 3C
 * spawns the local SDXL + `nerijs/pixel-art-xl` LoRA Python sidecar.
 *
 * Curation contract (CLAUDE.md "Conventions"):
 *   - Generate 5–10 candidates per asset.
 *   - Hand-curate the survivor.
 *   - Run through palette quantize + Astropulse PixelDetector grid-snap.
 *   - Bake into `public/sprites/{theme_id}/`.
 *
 * The runtime renderer (Phase 3A `src/render/sprites.ts`) only reads
 * baked PNGs from that directory; it never calls a provider. The
 * provider is a developer tool for filling the sprite library, not a
 * load-bearing surface the user's machine exercises.
 */

/** Theme-scoped sprite slot. Today: tile-driven (one sprite per
 *  walkable+visible tile id in `LIBRARY_BIBLE`). Phase 3+ extends to
 *  per-game (appid-derived) sprites for bookshelves and per-agent
 *  sprites for the cohort. */
export interface SpriteSlot {
  /** Theme this sprite is generated against. Sprites are
   *  palette-locked — a Solarized sprite is wrong on Gruvbox. */
  readonly themeId: string;
  /** Tile id (`T_*` constants in `procedural/tiles/library.ts`) or
   *  semantic slot id (`'bookshelf'`, `'cat'`, `'loki'`). 3A treats
   *  both as opaque strings. */
  readonly slotId: string;
  /** Optional: a per-game (appid) variant for bookshelves. When set,
   *  the sprite is generated from a prompt that includes the game's
   *  name + genre. When null, it's a generic shelf. */
  readonly appid?: number;
}

/** What a provider returns for one slot. PNG bytes + a content hash so
 *  the cache key can validate the on-disk file matches the provider's
 *  intended output (drift detection across re-generation runs). */
export interface SpriteResult {
  readonly slot: SpriteSlot;
  /** Raw PNG bytes. 6×13 for tile sprites today; 3+ phases may
   *  introduce larger sprite atlases. */
  readonly pngBytes: Uint8Array;
  /** SHA-256 of `pngBytes` as a lowercase hex string. The bake-step
   *  writer can verify the file on disk matches before overwriting. */
  readonly contentHash: string;
  /** Free-text label (provider + model) for telemetry / debug. */
  readonly source: string;
}

/** Hardware probe result the bake step uses to pick the provider.
 *  Phase 3A only declares the shape; 3C populates `vramBytes` via the
 *  Python sidecar's `torch.cuda.get_device_properties()` round-trip. */
export interface HardwareProbe {
  /** True if a discrete GPU with ≥8 GB VRAM was detected. Threshold
   *  matches FEASIBILITY § 4's "≥8 GB" line for SDXL on consumer
   *  cards. */
  readonly localCapable: boolean;
  /** VRAM in bytes, when detected; null if no GPU or detection failed. */
  readonly vramBytes: number | null;
  /** Free-text reason (used in dev-time logging). */
  readonly reason: string;
}

/** The provider contract. Local SDXL (3C) + PixelLab.ai (3B) both
 *  implement this; the bake script picks one based on `HardwareProbe`.
 *  Calls happen *at build time*, not at user runtime. */
export interface PixelArtProvider {
  /** Human-readable id — `'local-sdxl'`, `'pixellab'`, `'noop'`. Used
   *  in logs + the `SpriteResult.source` field. */
  readonly id: string;
  /** Generate one sprite for the slot. Implementations should:
   *    - synthesise the prompt from the slot + the theme palette
   *    - request multiple candidates (5–10 per CLAUDE.md curation rule)
   *    - return the best candidate post-palette-quantize + grid-snap
   *  Throws if generation fails — caller handles fallback. */
  generate(slot: SpriteSlot): Promise<SpriteResult>;
}

/** Default provider used when `bake` runs but neither cloud nor local
 *  is wired (Phase 3A state). Throws on every call so a stray bake
 *  attempt fails loudly rather than silently producing nothing. */
export const noopProvider: PixelArtProvider = {
  id: 'noop',
  generate: async () => {
    throw new Error(
      '[pixelart] noopProvider: no provider wired yet. Phase 3B wires PixelLab.ai; Phase 3C wires the local SDXL sidecar.',
    );
  },
};

/** Probe stub. Phase 3C replaces this with a real VRAM detection (the
 *  Python sidecar reports back; Electron caches the result on disk so
 *  re-runs skip the probe). Phase 3A returns "no GPU detected" so the
 *  bake step would always pick the cloud fallback if it ran. */
export async function probeHardware(): Promise<HardwareProbe> {
  return {
    localCapable: false,
    vramBytes: null,
    reason: 'phase-3A stub: no VRAM probe wired yet (lands in 3C)',
  };
}

/** Pick a provider from a registry given a probe. Phase 3A's registry
 *  is empty; 3B/3C populate it. Caller passes the registry so tests
 *  can inject. */
export function pickProvider(
  registry: ReadonlyMap<string, PixelArtProvider>,
  probe: HardwareProbe,
): PixelArtProvider {
  if (probe.localCapable && registry.has('local-sdxl')) {
    return registry.get('local-sdxl')!;
  }
  if (registry.has('pixellab')) {
    return registry.get('pixellab')!;
  }
  return noopProvider;
}
