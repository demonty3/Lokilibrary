/**
 * Phase 5D — lore profile extraction.
 *
 * Turns the library's uploaded lore corpus into a COMPACT, deterministic
 * profile that biases world generation. Pure + synchronous: no network, no
 * LLM, no embeddings — just term-frequency over a SHIPPED closed vocabulary.
 * That keeps three contracts intact at once:
 *
 *  - **Privacy.** The profile is derived locally. The fields that are ever
 *    allowed to leave the device (the 5D.4 digest) are CLOSED-VOCAB ONLY —
 *    `dominantThemes` + `tone`. `keywords` carries raw user vocabulary and is
 *    LOCAL-ONLY; never put it on the wire.
 *  - **Determinism.** It ultimately biases the seeded seaside layout + scatter,
 *    which must satisfy the share-URL contract (same corpus → same profile →
 *    same world). Stable recency ordering + fully-ordered tie-breaks + an
 *    inlined FNV-1a; no `Date.now` / `Math.random` (mirrors src/procedural).
 *  - **Whitelist.** Every emitted theme/district/palette/tone token is a
 *    member of a shipped whitelist. Unmatched lore vocabulary is dropped,
 *    never echoed (CLAUDE.md: never emit arbitrary tokens).
 *
 * Pure TS: imports only TYPES from the writer, so it never pulls
 * better-sqlite3 into a bundle. The web build has no lore store, so callers
 * there receive `emptyLoreProfile()`.
 */

import type { SeasideArchetype } from '../ai/manifest';
import { THEME_IDS, type ThemeId } from '../themes';
import type { MemoryWriter } from './router';

export type LoreTone =
  | 'neutral'
  | 'dark'
  | 'whimsical'
  | 'melancholic'
  | 'heroic'
  | 'cozy';

/**
 * Closed vocabulary of theme tags. The ONLY theme tokens that may ever cross
 * the wire (as part of the 5D.4 digest). Abstract by construction — no proper
 * nouns, no raw user text. Widen deliberately; never by relaxing the mapping
 * "to be more creative".
 */
export const THEME_TAGS = [
  'nautical',
  'gothic',
  'folklore',
  'noir',
  'cosmic-horror',
  'pastoral',
  'cyberpunk',
  'sci-fi',
  'high-fantasy',
  'arcane',
  'martial',
  'mechanical',
  'mystery',
  'cozy',
] as const;
export type ThemeTag = (typeof THEME_TAGS)[number];

export interface LoreProfile {
  /** Ranked, whitelisted theme tags (closed vocab; safe to egress). */
  dominantThemes: ThemeTag[];
  /** Single whitelisted tone token (closed vocab; safe to egress). */
  tone: LoreTone;
  /**
   * Top raw corpus terms. LOCAL-ONLY — never put these on the wire; they
   * carry user vocabulary. Kept for local theming / debug / future use.
   */
  keywords: string[];
  /** Ranked palette suggestions, subset of THEME_IDS. */
  suggestedTilePaletteBias: ThemeId[];
  /** Ranked district suggestions, subset of the seaside archetypes. */
  suggestedDistrictHints: SeasideArchetype[];
  /** Number of lore rows the profile was built from. */
  sourceCount: number;
  /** Stable hash of the corpus identity — cache key + change detection. */
  corpusHash: string;
}

/** Zero-lore sentinel. Every consumer falls back to pre-5D behaviour on this. */
export function emptyLoreProfile(): LoreProfile {
  return {
    dominantThemes: [],
    tone: 'neutral',
    keywords: [],
    suggestedTilePaletteBias: [],
    suggestedDistrictHints: [],
    sourceCount: 0,
    corpusHash: '',
  };
}

// ---------------------------------------------------------------------------
// Static mapping tables (the shipped whitelist). Each lore term maps to at
// most one theme tag and at most one tone (separate tables — a word may be
// both a theme cue and a tone cue).
// ---------------------------------------------------------------------------

const KEYWORD_TO_THEME: Readonly<Record<string, ThemeTag>> = {
  // nautical
  sea: 'nautical', ocean: 'nautical', ship: 'nautical', harbour: 'nautical',
  harbor: 'nautical', tide: 'nautical', sail: 'nautical', wave: 'nautical',
  coast: 'nautical', shore: 'nautical', port: 'nautical', mariner: 'nautical',
  vessel: 'nautical', lighthouse: 'nautical', fisher: 'nautical',
  fishing: 'nautical', anchor: 'nautical', beacon: 'nautical',
  // gothic
  cathedral: 'gothic', crypt: 'gothic', gargoyle: 'gothic', raven: 'gothic',
  decay: 'gothic', ruin: 'gothic', tomb: 'gothic', candle: 'gothic',
  mist: 'gothic', grave: 'gothic', cobweb: 'gothic',
  // folklore
  myth: 'folklore', legend: 'folklore', spirit: 'folklore', fae: 'folklore',
  fairy: 'folklore', omen: 'folklore', charm: 'folklore', witch: 'folklore',
  folk: 'folklore', tale: 'folklore', goblin: 'folklore', troll: 'folklore',
  // noir
  detective: 'noir', alley: 'noir', dame: 'noir', crime: 'noir',
  whiskey: 'noir', fedora: 'noir', gumshoe: 'noir', informant: 'noir',
  stakeout: 'noir',
  // cosmic-horror
  eldritch: 'cosmic-horror', void: 'cosmic-horror', madness: 'cosmic-horror',
  tentacle: 'cosmic-horror', abyss: 'cosmic-horror', cult: 'cosmic-horror',
  cosmic: 'cosmic-horror', dread: 'cosmic-horror', unknowable: 'cosmic-horror',
  nameless: 'cosmic-horror',
  // pastoral
  meadow: 'pastoral', farm: 'pastoral', harvest: 'pastoral', orchard: 'pastoral',
  village: 'pastoral', field: 'pastoral', pasture: 'pastoral', garden: 'pastoral',
  bloom: 'pastoral', cottage: 'pastoral',
  // cyberpunk
  neon: 'cyberpunk', chrome: 'cyberpunk', hacker: 'cyberpunk', corp: 'cyberpunk',
  cyber: 'cyberpunk', augment: 'cyberpunk', grid: 'cyberpunk',
  dystopia: 'cyberpunk', megacity: 'cyberpunk', implant: 'cyberpunk',
  // sci-fi
  starship: 'sci-fi', galaxy: 'sci-fi', android: 'sci-fi', laser: 'sci-fi',
  orbit: 'sci-fi', alien: 'sci-fi', planet: 'sci-fi', quantum: 'sci-fi',
  warp: 'sci-fi', nebula: 'sci-fi', star: 'sci-fi',
  // high-fantasy
  kingdom: 'high-fantasy', dragon: 'high-fantasy', elf: 'high-fantasy',
  dwarf: 'high-fantasy', castle: 'high-fantasy', quest: 'high-fantasy',
  realm: 'high-fantasy', throne: 'high-fantasy', prophecy: 'high-fantasy',
  wyrm: 'high-fantasy',
  // arcane
  spell: 'arcane', mage: 'arcane', wizard: 'arcane', rune: 'arcane',
  sigil: 'arcane', mana: 'arcane', enchant: 'arcane', sorcery: 'arcane',
  ritual: 'arcane', arcane: 'arcane', incantation: 'arcane',
  // martial
  warrior: 'martial', blade: 'martial', sword: 'martial', battle: 'martial',
  soldier: 'martial', legion: 'martial', duel: 'martial', siege: 'martial',
  knight: 'martial', spear: 'martial', shield: 'martial', war: 'martial',
  // mechanical
  gear: 'mechanical', engine: 'mechanical', steam: 'mechanical',
  clockwork: 'mechanical', machine: 'mechanical', factory: 'mechanical',
  piston: 'mechanical', automaton: 'mechanical', forge: 'mechanical',
  cog: 'mechanical', gauge: 'mechanical',
  // mystery
  clue: 'mystery', riddle: 'mystery', secret: 'mystery', puzzle: 'mystery',
  enigma: 'mystery', cipher: 'mystery', vanish: 'mystery', mystery: 'mystery',
  // cozy
  tea: 'cozy', blanket: 'cozy', warm: 'cozy', comfort: 'cozy', nook: 'cozy',
  hearth: 'cozy', quilt: 'cozy', cocoa: 'cozy',
};

const KEYWORD_TO_TONE: Readonly<Record<string, LoreTone>> = {
  // dark
  blood: 'dark', death: 'dark', grim: 'dark', curse: 'dark', fear: 'dark',
  terror: 'dark', doom: 'dark', rot: 'dark', plague: 'dark', dread: 'dark',
  decay: 'dark', shadow: 'dark', dark: 'dark', night: 'dark', grave: 'dark',
  // melancholic
  grief: 'melancholic', sorrow: 'melancholic', loss: 'melancholic',
  lonely: 'melancholic', mourn: 'melancholic', fading: 'melancholic',
  faded: 'melancholic', ash: 'melancholic', ember: 'melancholic',
  tear: 'melancholic', ruin: 'melancholic', weary: 'melancholic',
  // heroic
  hero: 'heroic', valor: 'heroic', valiant: 'heroic', glory: 'heroic',
  triumph: 'heroic', brave: 'heroic', honor: 'heroic', honour: 'heroic',
  victory: 'heroic', champion: 'heroic', noble: 'heroic', courage: 'heroic',
  // whimsical
  whimsy: 'whimsical', jest: 'whimsical', merry: 'whimsical', frolic: 'whimsical',
  giggle: 'whimsical', playful: 'whimsical', silly: 'whimsical',
  wonder: 'whimsical', sparkle: 'whimsical', mischief: 'whimsical',
  prank: 'whimsical',
  // cozy
  tea: 'cozy', hearth: 'cozy', blanket: 'cozy', warm: 'cozy', gentle: 'cozy',
  comfort: 'cozy', snug: 'cozy', quiet: 'cozy', cottage: 'cozy', cocoa: 'cozy',
  quilt: 'cozy',
};

/** Theme tag → candidate seaside districts (whitelisted to the 5 archetypes). */
const THEME_TO_DISTRICTS: Readonly<Record<ThemeTag, readonly SeasideArchetype[]>> = {
  nautical: ['lighthouse', 'fishing_boat', 'harbour_masters_hut'],
  gothic: ['lighthouse', 'detectives_office'],
  folklore: ['lighthouse', 'fish_market'],
  noir: ['detectives_office'],
  'cosmic-horror': ['lighthouse', 'detectives_office'],
  pastoral: ['fish_market', 'harbour_masters_hut'],
  cyberpunk: ['detectives_office', 'harbour_masters_hut'],
  'sci-fi': ['lighthouse', 'harbour_masters_hut'],
  'high-fantasy': ['lighthouse', 'harbour_masters_hut'],
  arcane: ['lighthouse', 'detectives_office'],
  martial: ['harbour_masters_hut', 'fishing_boat'],
  mechanical: ['harbour_masters_hut', 'fish_market'],
  mystery: ['detectives_office', 'lighthouse'],
  cozy: ['fish_market', 'harbour_masters_hut'],
};

/** Theme tag → preferred theme palette (whitelisted to the 5 ThemeIds). */
const THEME_TO_PALETTE: Readonly<Record<ThemeTag, ThemeId>> = {
  nautical: 'tokyo-night',
  gothic: 'catppuccin-mocha',
  folklore: 'gruvbox-dark',
  noir: 'ibm-3270',
  'cosmic-horror': 'tokyo-night',
  pastoral: 'gruvbox-dark',
  cyberpunk: 'tokyo-night',
  'sci-fi': 'tokyo-night',
  'high-fantasy': 'catppuccin-mocha',
  arcane: 'catppuccin-mocha',
  martial: 'gruvbox-dark',
  mechanical: 'ibm-3270',
  mystery: 'ibm-3270',
  cozy: 'solarized-dark',
};

/** Tone → preferred theme palette (whitelisted to the 5 ThemeIds). */
const TONE_TO_PALETTE: Readonly<Record<LoreTone, ThemeId>> = {
  neutral: 'solarized-dark',
  dark: 'tokyo-night',
  whimsical: 'catppuccin-mocha',
  melancholic: 'catppuccin-mocha',
  heroic: 'gruvbox-dark',
  cozy: 'solarized-dark',
};

/** Canonical tie-break order for tones (stable secondary sort key). */
const TONE_ORDER: readonly LoreTone[] = [
  'dark',
  'melancholic',
  'heroic',
  'whimsical',
  'cozy',
  'neutral',
];

/** Common short words that carry no thematic signal. (Tokens < 3 chars are
 *  already dropped, so only 3+ letter stopwords need listing.) */
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can',
  'had', 'her', 'was', 'one', 'our', 'out', 'has', 'him', 'his', 'how',
  'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'did', 'get',
  'way', 'use', 'with', 'that', 'this', 'they', 'from', 'have', 'were',
  'when', 'your', 'what', 'will', 'would', 'there', 'their', 'been', 'them',
  'then', 'than', 'into', 'only', 'some', 'more', 'most', 'such', 'like',
  'also', 'just', 'over', 'very', 'much', 'many', 'each', 'here', 'came',
  'come', 'said', 'where', 'which', 'about', 'after', 'again', 'every',
]);

const MAX_THEMES = 6;
const MAX_KEYWORDS = 12;
const MAX_DISTRICTS = 5;
const MAX_PALETTES = 3;
const DEFAULT_SCAN_LIMIT = 200;

/**
 * Build a deterministic LoreProfile from the library's lore corpus.
 *
 * Sync + pure: only reads `loreCount()` + `recentLore(n)` (recency-ordered,
 * stable). Returns `emptyLoreProfile()` when there is no lore.
 */
export function buildLoreProfile(
  writer: Pick<MemoryWriter, 'recentLore' | 'loreCount'>,
  opts: { scanLimit?: number } = {},
): LoreProfile {
  if (writer.loreCount() === 0) return emptyLoreProfile();
  const rows = writer.recentLore(opts.scanLimit ?? DEFAULT_SCAN_LIMIT);
  if (rows.length === 0) return emptyLoreProfile();

  // Term frequency over the whole sampled corpus.
  const freq = new Map<string, number>();
  for (const row of rows) {
    for (const tok of tokenize(row.text)) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
  }

  // Rank terms: count desc, then term asc (fully-ordered, stable).
  const ranked = [...freq.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  const keywords = ranked.slice(0, MAX_KEYWORDS).map(([t]) => t);

  // Accumulate theme + tone scores from the ranked terms.
  const themeScore = new Map<ThemeTag, number>();
  const toneScore = new Map<LoreTone, number>();
  for (const [term, count] of ranked) {
    const tag = KEYWORD_TO_THEME[term];
    if (tag) themeScore.set(tag, (themeScore.get(tag) ?? 0) + count);
    const tone = KEYWORD_TO_TONE[term];
    if (tone) toneScore.set(tone, (toneScore.get(tone) ?? 0) + count);
  }

  const dominantThemes = rankKeys(themeScore, THEME_TAGS).slice(0, MAX_THEMES);
  const tone = rankKeys(toneScore, TONE_ORDER)[0] ?? 'neutral';

  // Districts implied by the dominant themes (ranked by theme order, deduped).
  const suggestedDistrictHints = dedupe(
    dominantThemes.flatMap((t) => THEME_TO_DISTRICTS[t]),
  ).slice(0, MAX_DISTRICTS);

  // Palette bias: tone first (if any), then dominant themes; deduped + clamped.
  const palettes: ThemeId[] = [];
  if (tone !== 'neutral') pushUnique(palettes, TONE_TO_PALETTE[tone]);
  for (const t of dominantThemes) pushUnique(palettes, THEME_TO_PALETTE[t]);
  const suggestedTilePaletteBias = palettes
    .filter((p) => THEME_IDS.includes(p))
    .slice(0, MAX_PALETTES);

  const corpusHash = fnv1aHex(rows.map((r) => r.id).join('|'));

  return {
    dominantThemes,
    tone,
    keywords,
    suggestedTilePaletteBias,
    suggestedDistrictHints,
    sourceCount: rows.length,
    corpusHash,
  };
}

// ---------------------------------------------------------------------------
// Helpers (all deterministic; no Date.now / Math.random).
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

/** Keys with score > 0, sorted by score desc then canonical order asc. */
function rankKeys<K extends string>(scores: Map<K, number>, order: readonly K[]): K[] {
  const idx = new Map<K, number>(order.map((k, i) => [k, i] as const));
  return [...scores.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || (idx.get(a[0]) ?? 0) - (idx.get(b[0]) ?? 0))
    .map(([k]) => k);
}

function dedupe<T>(list: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of list) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function pushUnique<T>(arr: T[], v: T): void {
  if (!arr.includes(v)) arr.push(v);
}

/** Inlined FNV-1a 32-bit (matches src/procedural/seed.ts) → 8-char hex.
 *  Inlined rather than imported to keep src/agents decoupled from
 *  src/procedural (which is a standalone determinism-critical module). */
function fnv1aHex(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
