/**
 * Glyph-coverage smoke — `npx tsx scripts/smoke-glyph-coverage.mts`.
 *
 * The Cozette font ships as a vector woff2 (public/fonts/CozetteVector.woff2).
 * PixiJS v8 BitmapText lazily bakes a per-glyph atlas from it, so any literal
 * glyph the renderers emit whose codepoint is NOT in the font renders as
 * .notdef — a blank tofu box. That is an INVISIBLE bug: the feature ships, the
 * smoke passes, the typecheck passes, and the user sees a hole in the world.
 *
 * This guard enumerates every literal glyph the procedural + render layers
 * emit and asserts each codepoint is covered by the font. The covered set is
 * scripts/lib/cozette-coverage.json (inclusive codepoint ranges), regenerated
 * from the real woff2 by scripts/gen-cozette-coverage.py — so this smoke tracks
 * the ACTUAL shipped font, not a hand-maintained list.
 *
 * Source-of-truth glyphs are imported from the real modules where they are
 * exported (LANDMARK_GLYPHS, buildScatterTable, TILES, activityGlyphFor); the
 * renderer-literal box/shade glyphs (card frames, double-line stub panel,
 * footer legends, player/mark glyphs) are listed here WITH the file they come
 * from. When a renderer adds a new literal glyph, add it to RENDERER_LITERALS
 * with its provenance and this smoke proves it is renderable.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeChecker } from './lib/smoke.ts';
import { LANDMARK_GLYPHS } from '../src/procedural/localLandmark.ts';
import { buildScatterTable } from '../src/procedural/scatter.ts';
import { TILE_BY_ID } from '../src/procedural/tiles/library.ts';
import { activityGlyphFor } from '../src/procedural/clusters.ts';
import type { ClusterActivity } from '../src/procedural/clusters.ts';
import { SKY_DITHER_GLYPHS } from '../src/procedural/land.ts';
import { WORN_CRUST_GLYPH } from '../src/terminal/wear.ts';

const { check, report } = makeChecker('smoke glyph-coverage');

// --- load the font coverage snapshot ---------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const coverage = JSON.parse(
  readFileSync(path.join(here, 'lib', 'cozette-coverage.json'), 'utf8'),
) as { count: number; ranges: [number, number][] };

const covered = (cp: number): boolean =>
  coverage.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

check('coverage snapshot non-empty', coverage.count > 1000);
check('coverage snapshot has ranges', coverage.ranges.length > 0);
// Sanity: ASCII 'A' and the box-drawing light horizontal must be present, else
// the snapshot is corrupt and every assertion below would falsely pass.
check("snapshot covers 'A' (U+0041)", covered(0x41));
check('snapshot covers ─ (U+2500)', covered(0x2500));

// --- collect every emitted glyph, with provenance --------------------------
// Each entry: [glyph, "where it is emitted"]. A glyph may legitimately repeat
// across surfaces; we de-dupe by codepoint for the assertion but keep the
// provenance so a failure points at the surface.
const emitted: Array<[string, string]> = [];
const add = (glyph: string, where: string): void => {
  // Emit each visible character (skip plain spaces — never tofu).
  for (const ch of glyph) {
    if (ch === ' ' || ch === '\n') continue;
    emitted.push([ch, where]);
  }
};

// 1. Tile bible (src/procedural/tiles/library.ts) — imported real source.
for (const t of TILE_BY_ID.values()) add(t.glyph, `tiles/library.ts tile id=${t.id}`);

// 2. Scatter bible (src/procedural/scatter.ts) — via the exported table builder
//    (SCATTER_BIBLE itself is module-private; buildScatterTable exposes the
//    glyphs). With no lore profile this is the base bible, byte-identical.
for (const [glyph] of buildScatterTable().entries) {
  add(glyph, 'scatter.ts SCATTER_BIBLE');
}

// 3. Local-model landmark (src/procedural/localLandmark.ts) — imported.
for (const [variant, glyph] of Object.entries(LANDMARK_GLYPHS)) {
  add(glyph, `localLandmark.ts LANDMARK_GLYPHS.${variant}`);
}

// 4. Activity shade ramp (src/procedural/clusters.ts) — every engagement.
const activities: ClusterActivity[] = [
  'deeply_lived_in',
  'past_main',
  'engaged',
  'tried',
  'just_opened',
  'unplayed',
  'none',
];
for (const a of activities) add(activityGlyphFor(a), `clusters.ts activityGlyphFor(${a})`);

// 4b. Tier-2 sky dither vocabulary (src/procedural/land.ts) — imported real source.
for (const g of SKY_DITHER_GLYPHS) add(g, 'land.ts SKY_DITHER_GLYPHS');

// 4c. Tier-2 worn-path crust variant (src/terminal/wear.ts) — imported real source.
add(WORN_CRUST_GLYPH, 'wear.ts WORN_CRUST_GLYPH (worn crust)');

// 5. Renderer-literal glyphs — box/shade/punctuation emitted directly in the
//    render layer (NOT exported from a data module). Provenance is the file.
const RENDERER_LITERALS: Array<[string, string]> = [
  // Card frames — district.ts / island.ts renderIslandCard/renderDistrictCard.
  ['┌─┐│└┘', 'district.ts + island.ts card frames'],
  // Double-line stub/empty panel — stub.ts + island.ts/continent.ts emptyPanel.
  ['╔═╗║╚╝', 'stub.ts + island/continent emptyPanel frame'],
  // Footer legend + separators (the shade glyphs are also covered above).
  ['▓▒░·', 'district/island/continent footer legend'],
  ['…', 'clusters.ts truncateLabel + bookshelfPrompt ellipsis'],
  ['·', 'middle-dot separator (headers/footers/status)'],
  // cell.ts literals.
  ['@', 'cell.ts player avatar'],
  ['·', 'cell.ts placed-mark glyph'],
  // bookshelfPrompt.ts launch prompt frame.
  ['[E]', 'bookshelfPrompt.ts launch prompt'],
  // morning-dispatch.ts banner — renderDispatch emits the box-drawing rule
  // and the "made a plan" sub-arrow as BitmapText (not just in comments).
  ['──', 'morning-dispatch.ts renderDispatch rule'],
  ['↳', 'morning-dispatch.ts renderDispatch plan arrow'],
  // Phase 7-B — composable-panes seam glyphs (PixiApp.ts SEAM_GLYPHS +
  // drawSeamGlyphs). Drawn as box-drawing decoration where panes abut.
  ['│─┼├┤┬┴', 'PixiApp.ts SEAM_GLYPHS pane seams'],
  // Agent-mind pass — per-agent trace glyphs (cell.ts MARK_STYLES).
  ['’≡⌐°,·', 'cell.ts MARK_STYLES'],
  // Salience — marginalia frame dialect: the walk-over caption's found-note
  // frame is EXCLUSIVELY double-line (captionFor), distinct from the
  // single-line card frames and the double-line stub/empty panel above.
  ['╔═╗╚╝║', 'src/render/levels/cell.ts captionFor (marginalia frame)'],
  ['…', 'cell.ts captionFor truncation (capped-text ellipsis)'],
];
for (const [glyphs, where] of RENDERER_LITERALS) add(glyphs, where);

// --- assert every emitted codepoint is covered -----------------------------
// De-dupe by codepoint but remember a provenance for the failure message.
const byCp = new Map<number, string>();
for (const [ch, where] of emitted) {
  if (!byCp.has(ch.codePointAt(0)!)) byCp.set(ch.codePointAt(0)!, where);
}

let allCovered = true;
for (const [cp, where] of byCp) {
  const ok = covered(cp);
  if (!ok) {
    allCovered = false;
    // eslint-disable-next-line no-console
    console.error(
      `  TOFU RISK: U+${cp.toString(16).toUpperCase().padStart(4, '0')} ` +
        `'${String.fromCodePoint(cp)}' emitted by ${where} is NOT in the font`,
    );
  }
}

check(`every emitted glyph is in the font (${byCp.size} distinct)`, allCovered);

// Spot assertions on the highest-risk glyphs (box-drawing + the two landmark
// glyphs + the shade ramp) so a regression names the exact offender.
check('▓ bookshelf/heavy-shade covered', covered(0x2593));
check('▒ medium-shade covered', covered(0x2592));
check('░ light-shade covered', covered(0x2591));
check('▔ worn-path crust covered', covered(0x2594));
check('⌂ cottage landmark covered', covered(0x2302));
check('║ tower / double-vertical covered', covered(0x2551));
check('╪ door covered', covered(0x256a));
check('╫ window covered', covered(0x256b));
check('♠ plant covered', covered(0x2660));
check('∩ chair covered', covered(0x2229));
check('≡ books covered', covered(0x2261));
check('☼ lamp covered', covered(0x263c));
check('▤ table covered', covered(0x25a4));
check('… ellipsis covered', covered(0x2026));
check('↳ morning-dispatch plan arrow covered', covered(0x21b3));

report();
