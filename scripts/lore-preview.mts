/**
 * Lore preview — headless prediction of the 5D.4 palette recolor.
 *
 * Runs the REAL `buildLoreProfile` + `themeFromLore` against a lore .md file
 * the exact way the desktop ingest path does (`chunkText` → one lore row per
 * chunk), so you can confirm which theme a file will recolor the world to
 * BEFORE launching the app. Not a smoke — a dev preview tool for the lore
 * verification pass.
 *
 *   npx tsx scripts/lore-preview.mts lore-samples/pastoral.md
 *   npx tsx scripts/lore-preview.mts lore-samples/pastoral.md lore-samples/nautical.md
 */
import { readFileSync } from 'node:fs';
import { chunkText } from '../src/agents/memory/chunk';
import { buildLoreProfile } from '../src/agents/lore-profile';
import { themeFromLore } from '../src/agents/lore-theme';
import type { MemoryWriter } from '../src/agents/router';

type LoreWriter = Pick<MemoryWriter, 'recentLore' | 'loreCount'>;

/** Mirror `ingestLore`: chunk the file, store one lore row per chunk. */
function previewWriter(text: string): LoreWriter {
  const rows = chunkText(text).map((t, i) => ({ id: `c${i}`, text: t, source: 'preview' }));
  return {
    loreCount: () => rows.length,
    recentLore: (n: number) => rows.slice(0, n),
  };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: npx tsx scripts/lore-preview.mts <file.md> [more.md ...]');
  process.exit(1);
}

for (const file of files) {
  const writer = previewWriter(readFileSync(file, 'utf8'));
  const profile = buildLoreProfile(writer);
  console.log(`\n${file}`);
  console.log(`  chunks:         ${profile.sourceCount}`);
  console.log(`  dominantThemes: ${profile.dominantThemes.join(', ') || '(none)'}`);
  console.log(`  tone:           ${profile.tone}`);
  console.log(`  paletteBias:    ${profile.suggestedTilePaletteBias.join(', ') || '(none)'}`);
  console.log(`  → world theme:  ${themeFromLore(writer)}`);
}
