/**
 * Phase 5D.1 smoke — `npx tsx scripts/smoke-5d-lore-profile.mts`.
 *
 * `buildLoreProfile` is a pure, deterministic function over the lore corpus.
 * We feed it a hand-rolled fake writer (no DB / native deps needed) and
 * assert:
 *   - empty corpus → emptyLoreProfile() sentinel
 *   - theme detection (nautical / cyberpunk)
 *   - determinism: identical corpus → byte-identical profile
 *   - whitelist membership of every emitted token (themes, districts,
 *     palettes, tone) — no raw vocabulary leaks into the egress-safe fields
 *   - THEME_IDS stays in lockstep with THEMES (drift guard)
 *   - corpusHash changes when the corpus changes
 */

import { makeChecker } from './lib/smoke.ts';
import type { MemoryWriter } from '../src/agents/router.ts';

const { buildLoreProfile, emptyLoreProfile, THEME_TAGS } = await import(
  '../src/agents/lore-profile.ts'
);
const { THEME_IDS, THEMES } = await import('../src/themes/index.ts');

const { check, report } = makeChecker('smoke 5D.1');

const SEASIDE_ARCHETYPES = [
  'lighthouse',
  'fish_market',
  'detectives_office',
  'harbour_masters_hut',
  'fishing_boat',
];
const TONES = ['neutral', 'dark', 'whimsical', 'melancholic', 'heroic', 'cozy'];

/** Minimal fake of the two writer accessors buildLoreProfile reads. */
function fakeWriter(texts: readonly string[]): Pick<MemoryWriter, 'recentLore' | 'loreCount'> {
  const rows = texts.map((text, i) => ({ id: `lore-${i}`, text, source: 'test' }));
  return {
    loreCount: () => rows.length,
    recentLore: (n: number) => rows.slice(0, n),
  };
}

// 1. Empty corpus → sentinel.
const empty = buildLoreProfile(fakeWriter([]));
check(
  'empty corpus → emptyLoreProfile',
  JSON.stringify(empty) === JSON.stringify(emptyLoreProfile()),
);
check('empty corpus sourceCount 0', empty.sourceCount === 0);
check('empty corpus tone neutral', empty.tone === 'neutral');

// 2. Nautical corpus → nautical theme + seaside districts.
const nautical = [
  'The lighthouse keeper watched the tide roll over the harbour as the ship set sail.',
  'Every mariner knows the sea; the coast and the shore mark the edge of the ocean.',
];
const p = buildLoreProfile(fakeWriter(nautical));
check('nautical theme detected', p.dominantThemes.includes('nautical'));
check('sourceCount matches corpus', p.sourceCount === 2);
check('district hints non-empty for themed corpus', p.suggestedDistrictHints.length > 0);

// 3. Determinism — identical corpus yields byte-identical profile.
const p2 = buildLoreProfile(fakeWriter(nautical));
check('deterministic across runs', JSON.stringify(p) === JSON.stringify(p2));

// 4. Whitelist membership — nothing off-list leaks.
check('all themes whitelisted', p.dominantThemes.every((t) => (THEME_TAGS as readonly string[]).includes(t)));
check(
  'all districts whitelisted',
  p.suggestedDistrictHints.every((d) => SEASIDE_ARCHETYPES.includes(d)),
);
check(
  'all palettes whitelisted',
  p.suggestedTilePaletteBias.every((pal) => (THEME_IDS as readonly string[]).includes(pal)),
);
check('tone whitelisted', TONES.includes(p.tone));

// 5. Drift guard — THEME_IDS must match THEMES keys exactly.
check(
  'THEME_IDS == Object.keys(THEMES)',
  JSON.stringify([...THEME_IDS].sort()) === JSON.stringify(Object.keys(THEMES).sort()),
);

// 6. corpusHash changes with the corpus; other theme detected.
const cyber = buildLoreProfile(
  fakeWriter(['A neon hacker jacked into the chrome grid of the dystopia megacity.']),
);
check('different corpus → different corpusHash', p.corpusHash !== cyber.corpusHash);
check('cyberpunk theme detected', cyber.dominantThemes.includes('cyberpunk'));

// 7. Tone detection (dark lexicon).
const dark = buildLoreProfile(
  fakeWriter(['Blood and death; a curse of dread and terror, doom in the grim dark night.']),
);
check('dark tone detected', dark.tone === 'dark');

// 8. keywords stay local (raw terms) but are bounded.
check('keywords bounded', p.keywords.length <= 12);
check('keywords contain a raw corpus term', p.keywords.includes('lighthouse') || p.keywords.includes('tide'));

report();
