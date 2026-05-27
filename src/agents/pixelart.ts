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
      '[pixelart] noopProvider: no provider wired. Phase 3C wires PixelLab.ai via createPixelLabProvider; Phase 3D wires the local SDXL sidecar.',
    );
  },
};

/** Phase 3C — slice-β resolution table. Per CLAUDE.md "default to
 *  template-build-time generation", this map is the source of truth for
 *  what *native* pixel-art size each slot is generated at. The
 *  *displayed* size is owned by `src/render/sprites.ts`; the two can
 *  diverge (e.g. bookshelf generates at 16×32 native and renders at 16×32
 *  displayed = 1:1 nearest-neighbor on a 6×13 grid cell, blooming across
 *  ~2.7 cells). PixelLab's pixflux endpoint enforces 16 ≤ dim ≤ 400; this
 *  table must respect that. */
const NATIVE_PX: ReadonlyMap<string, { width: number; height: number }> = new Map([
  // 3C only wires the bookshelf bake; the rest stay on 3B's procedural
  // 6×13 placeholders. When a slot lands here it must also get a matching
  // displaySize entry in `src/render/sprites.ts` SLOT_DISPLAY.
  ['bookshelf', { width: 16, height: 32 }],
]);

/** Prompt template per slot. Kept here (not in the Worker) because the
 *  prompt is the renderer's concern — it knows the slot's *visual role*
 *  in the world. The Worker stays a dumb HTTP proxy that can serve any
 *  description. */
function describeSlot(slot: SpriteSlot): string {
  if (slot.slotId === 'bookshelf') {
    return (
      'A tall wooden bookshelf in a cozy library, front view, dark wood ' +
      'frame, four horizontal shelves filled with colorful book spines, ' +
      'vertical sprite, transparent background, pixel art'
    );
  }
  // Fallback prompt. 3D will fill the gaps as we widen the bake to the
  // other slots; until then noopProvider catches stray calls in tests.
  return `${slot.slotId} for a cozy pixel-art library room, transparent background, pixel art`;
}

function nativeSize(slot: SpriteSlot): { width: number; height: number } {
  return NATIVE_PX.get(slot.slotId) ?? { width: 16, height: 16 };
}

/** Options for the PixelLab provider — split out so tests can inject a
 *  mock fetch + a custom workerBase without touching globalThis. */
export interface PixelLabProviderOptions {
  /** Base URL of the Worker (without trailing slash). Defaults to the
   *  local-dev wrangler port. The bake script never talks to PixelLab
   *  directly — the key lives only in the Worker. */
  workerBase?: string;
  /** fetch implementation. Defaults to global fetch (Node ≥18). */
  fetchImpl?: typeof fetch;
}

/** Phase 3C provider: bake-time HTTP client for PixelLab.ai pixflux,
 *  routed through the Worker's /api/bake/sprite proxy. Single-shot — the
 *  bake script calls .generate() N times to gather N candidates and
 *  curates manually. Throws on any non-2xx so the caller can decide
 *  whether to retry or skip. */
export function createPixelLabProvider(opts: PixelLabProviderOptions = {}): PixelArtProvider {
  const workerBase = (opts.workerBase ?? 'http://localhost:8787').replace(/\/$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    id: 'pixellab',
    generate: async (slot) => {
      const description = describeSlot(slot);
      const { width, height } = nativeSize(slot);
      const res = await fetchImpl(`${workerBase}/api/bake/sprite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description, width, height }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        throw new Error(
          `[pixelart] pixellab worker returned ${res.status}: ${raw.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as {
        image: { base64: string; format?: string };
        usage: { type?: string; usd?: number; credits?: number } | null;
        latencyMs: number;
      };
      const pngBytes = decodeBase64Png(data.image.base64);
      const contentHash = await sha256Hex(pngBytes);
      const usd = data.usage?.usd;
      const source =
        `pixellab/pixflux` +
        (usd !== undefined ? ` ($${usd.toFixed(4)})` : '') +
        ` ${width}×${height} ${data.latencyMs}ms`;
      return { slot, pngBytes, contentHash, source };
    },
  };
}

/** Strip the optional `data:image/png;base64,` prefix and decode to raw
 *  PNG bytes. Used by the provider; exported for the smoke. */
export function decodeBase64Png(b64: string): Uint8Array {
  const stripped = b64.startsWith('data:') ? (b64.split(',', 2)[1] ?? '') : b64;
  // atob is available in Node 16+ and all browsers; Cloudflare Workers
  // too. Avoids an extra dep on the Node Buffer.from('...', 'base64')
  // path that the renderer can't use.
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** SHA-256 hex of raw bytes via Web Crypto (Node ≥20, browsers, Workers). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
