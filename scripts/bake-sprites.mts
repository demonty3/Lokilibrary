/**
 * Phase 3C-β bake script. Generates N PixelLab candidates for one
 * (slot, theme) pair, palette-quantizes each against the theme's
 * foreground palette, and writes them to staging/<theme>/<slot>/<i>.png
 * for manual curation.
 *
 * Manual curation is the load-bearing step per CLAUDE.md "Conventions":
 *   - Generate 5–10 candidates per asset
 *   - Hand-curate the survivor
 *   - Run through palette quantize + (Astropulse PixelDetector grid-snap — 3D)
 *   - Bake into public/sprites/{theme_id}/
 *
 * After running this, eyeball the staging PNGs, pick the best one, and
 * copy it over the placeholder:
 *   cp staging/<theme>/<slot>/<i>.png public/sprites/<theme>/<slot>.png
 *
 * Prereqs:
 *   1. Worker running on http://localhost:8787 (npm run worker).
 *   2. PIXELLAB_API_KEY set in worker/.dev.vars.
 *
 * Usage:
 *   npx tsx scripts/bake-sprites.mts --slot=bookshelf --theme=solarized-dark --n=5
 *
 * Cost (from CLAUDE.md / PixelLab pricing): ~$0.008 at 16×16, ~$0.013
 * at 400×400. The 3C-β bookshelf at 16×32 lands around $0.009/call —
 * 5 candidates ≈ $0.045 per bake run. Total budgeted slice spend stays
 * well under $1.
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPixelLabProvider } from '../src/agents/pixelart.ts';
import { foregroundPalette, quantizeToPalette } from './lib/quantize.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(REPO_ROOT, 'src', 'themes');
const STAGING_ROOT = path.join(REPO_ROOT, 'staging');

const { values } = parseArgs({
  options: {
    slot: { type: 'string', default: 'bookshelf' },
    theme: { type: 'string', default: 'solarized-dark' },
    n: { type: 'string', default: '5' },
    worker: { type: 'string', default: 'http://localhost:8787' },
  },
});

const slot = values.slot!;
const themeId = values.theme!;
const n = Number.parseInt(values.n!, 10);
if (!Number.isInteger(n) || n < 1 || n > 20) {
  throw new Error(`--n must be an integer in [1, 20], got "${values.n}"`);
}

// Load the theme JSON. Walk the directory rather than hard-coding the
// filename since solarized-dark lives in solarized.json (and other
// themes match their id directly) — the file-id mapping isn't stable
// enough to derive.
const themes = fs
  .readdirSync(THEMES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(THEMES_DIR, f), 'utf8')) as {
    id: string;
    palette: Record<string, string>;
  });
const theme = themes.find((t) => t.id === themeId);
if (!theme) {
  throw new Error(
    `unknown theme "${themeId}" — available: ${themes.map((t) => t.id).join(', ')}`,
  );
}

const stagingDir = path.join(STAGING_ROOT, themeId, slot);
fs.mkdirSync(stagingDir, { recursive: true });

const provider = createPixelLabProvider({ workerBase: values.worker });
const palette = foregroundPalette(theme);

console.log(
  `[bake] slot="${slot}" theme="${themeId}" n=${n} worker=${values.worker} ` +
    `palette=${palette.length} colors`,
);
console.log(`[bake] output: ${stagingDir}`);

let totalUsd = 0;
let succeeded = 0;
for (let i = 0; i < n; i++) {
  const t0 = Date.now();
  try {
    const result = await provider.generate({ themeId, slotId: slot });
    const quantized = quantizeToPalette(result.pngBytes, { palette });
    const outPath = path.join(stagingDir, `${i}.png`);
    fs.writeFileSync(outPath, quantized);
    // Pull the $ amount out of the provider's `source` string — it
    // formats it as `pixellab/pixflux ($0.0089) 16×32 1234ms`.
    const usdMatch = result.source.match(/\$([0-9]+\.[0-9]+)/);
    const usd = usdMatch ? Number.parseFloat(usdMatch[1]!) : 0;
    totalUsd += usd;
    succeeded++;
    console.log(
      `  [${i}] ${outPath} ${quantized.byteLength}B ${Date.now() - t0}ms ` +
        `$${usd.toFixed(4)} sha=${result.contentHash.slice(0, 8)}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  [${i}] FAILED (${Date.now() - t0}ms): ${msg}`);
  }
}

console.log(
  `\n[bake] ${succeeded}/${n} candidates written, $${totalUsd.toFixed(4)} total. ` +
    `Pick the survivor and copy it to:`,
);
console.log(`  public/sprites/${themeId}/${slot}.png`);

if (succeeded === 0) process.exit(1);
