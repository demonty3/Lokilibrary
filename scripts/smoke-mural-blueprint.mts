/**
 * Authored-mural conformance smoke — `npx tsx scripts/smoke-mural-blueprint.mts`
 * Optional: `<wing>` validates one mural (authoring loop); `--values` also
 * prints measured numbers (no pass/fail semantics — the calibration mode).
 *
 * Gates every mural registered in src/murals/ (claude-authoring rung 1,
 * spec docs/superpowers/specs/2026-08-21-claude-authoring-rung1-mural-blueprint.md;
 * authoring spec docs/blueprints/mural.md). What each rail gates and why:
 *
 * - SHAPE — rows/ink exactly MURAL_INTERIOR_H × MURAL_INTERIOR_W codepoints,
 *   ink '.' aligned with row spaces both ways. A misaligned grid renders as
 *   silent holes or orphan colour, invisible until the desk boots.
 * - PALETTE LEGALITY — ink letters resolve through MURAL_INK_LEGEND to real
 *   palette keys, and the legend NEVER spells bg/bgAlt/fgBright: the backing
 *   owns bg, and fgBright is the beings' reserved salience register (the
 *   muralCells EXCLUDED contract). Keys-not-hex keeps every mural legal
 *   under every pack by construction.
 * - GLYPH LEGALITY — every drawn glyph is in the Cozette atlas
 *   (scripts/lib/cozette-coverage.json). Tofu is an invisible bug: the atlas
 *   renders a blank, not a box, so a missing glyph LOOKS like a hole.
 * - DENSITY + LETTER-NOISE BUDGETS — a near-empty rect reads as a broken
 *   fetch, a letterform-heavy one as UI text noise (the 07-31 diorama
 *   finding: dither crust read as letter-noise). Budgets are ABSOLUTE
 *   values, calibrated on the approved seed corpus, then frozen.
 * - WING WIRING — the wing is one the desk can open (desktop/src/terminals.ts
 *   WINGS), at most one mural per wing, and the wing's real slate composes a
 *   mural rect (flagship with an appid) — an authored mural for a wing whose
 *   compose skips the rect would silently never mount.
 *
 * Bars: PROVISIONAL 2026-08-21 (pre-corpus). Calibrate on the approved seed
 * corpus via --values, then FREEZE after Harry's corpus eyeball; record the
 * date + observed corpus values beside each constant when freezing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, MURAL_INTERIOR_W, MURAL_INTERIOR_H, type LandGame } from '../src/procedural/land.ts';
import { AUTHORED_MURALS, MURAL_INK_LEGEND, authoredMuralCells, authoredMuralFor, type AuthoredMural } from '../src/murals/index.ts';
import { THEMES, DEFAULT_THEME_ID } from '../src/themes/index.ts';

const { check, report } = makeChecker('smoke mural-blueprint');
const args = process.argv.slice(2);
const wantValues = args.includes('--values');
const onlyWing = args.find((a) => !a.startsWith('--'));

// --- Bars (PROVISIONAL — see header) ---------------------------------------
/** Non-blank fraction of the 22×5 interior. Floor: below this the rect reads
 *  as a failed load, not art. Ceiling: a fully solid slab buries the sky
 *  backing that makes the mural sit IN the hour. */
const DENSITY_MIN = 0.25;
const DENSITY_MAX = 0.92;
/** Letterform glyphs ([A-Za-z0-9]) as a fraction of DRAWN cells. Murals are
 *  pictures, not captions — the cartouche below the frame carries the name. */
const LETTER_MAX = 0.15;
/** `why` is one line, on the record — not an essay. */
const WHY_MAX = 160;

// --- Fixed knowledge --------------------------------------------------------
const BRIEFS = ['world', 'relationship'] as const;
/** The three keys an authored mural must never reach (muralCells EXCLUDED). */
const FORBIDDEN_KEYS = new Set(['bg', 'bgAlt', 'fgBright']);
/** Same compose dims smoke-land-mural.mts uses — clears MURAL_MIN_COLS/SKY. */
const T = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false } as const;

/** FNV-1a 32-bit — local copy (src/terminal/terminalLand.ts holds the
 *  canonical one); must match it so the wing→slate rotation is the desk's. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The desk's wing slate — replicates the rotation at terminalLand.ts
 *  (`real profile wings replace this in T2`); revisit both together. */
function wingSlate(wing: string): LandGame[] {
  const rot = fnv1a(wing) % SAMPLE_LAND.length;
  return Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const coverage = JSON.parse(
  readFileSync(path.join(here, 'lib', 'cozette-coverage.json'), 'utf8'),
) as { count: number; ranges: [number, number][] };
const covered = (cp: number): boolean => coverage.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
check('coverage snapshot sane', coverage.count > 1000 && covered(0x41) && covered(0x2500));

/** The desk's wing roster, read from source — importing terminals.ts pulls
 *  electron. The regex pins the exact declaration; if the WINGS line moves
 *  or reshapes, this smoke fails loudly rather than validating against air. */
const terminalsSrc = readFileSync(path.join(here, '..', 'desktop', 'src', 'terminals.ts'), 'utf8');
const wingsMatch = terminalsSrc.match(/const WINGS = \[([^\]]+)\]/);
check('desk WINGS roster found in terminals.ts', wingsMatch !== null);
const DESK_WINGS = new Set(
  (wingsMatch?.[1] ?? '').split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean),
);
check('desk WINGS roster non-empty', DESK_WINGS.size > 0, `parsed ${DESK_WINGS.size}`);

// --- Legend wiring (once, outside the mural loop) ---------------------------
const paletteKeys = new Set(Object.keys(THEMES[DEFAULT_THEME_ID].palette));
for (const [letter, key] of Object.entries(MURAL_INK_LEGEND)) {
  check(`legend '${letter}' resolves to a real palette key`, paletteKeys.has(key), key);
  check(`legend '${letter}' avoids the forbidden keys`, !FORBIDDEN_KEYS.has(key), key);
  check(`legend letter '${letter}' is a single character`, letter.length === 1 && letter !== '.');
}
check('legend is injective (one letter per key)',
  new Set(Object.values(MURAL_INK_LEGEND)).size === Object.keys(MURAL_INK_LEGEND).length);

// --- Per-mural gates --------------------------------------------------------
const murals: readonly AuthoredMural[] = onlyWing
  ? AUTHORED_MURALS.filter((m) => m.wing === onlyWing)
  : AUTHORED_MURALS;
if (onlyWing) check(`a mural is registered for '${onlyWing}'`, murals.length > 0);

const seenWings = new Set<string>();
for (const m of murals) {
  const tag = `[${m.wing}]`;

  // wing wiring
  check(`${tag} wing is on the desk roster`, DESK_WINGS.has(m.wing), m.wing);
  check(`${tag} one mural per wing`, !seenWings.has(m.wing));
  seenWings.add(m.wing);
  check(`${tag} registry lookup returns this mural`, authoredMuralFor(m.wing) === m);
  const model = composeLand(fnv1a(`terminal:${m.wing}`), wingSlate(m.wing), { ...T, mural: true });
  check(`${tag} the wing's slate composes a mural rect`, model.mural !== undefined);
  check(`${tag} composed rect is the blueprint geometry`,
    model.mural?.w === MURAL_INTERIOR_W && model.mural?.h === MURAL_INTERIOR_H,
    `${model.mural?.w}×${model.mural?.h}`);

  // meta
  check(`${tag} brief is one of ${BRIEFS.join('/')}`, (BRIEFS as readonly string[]).includes(m.brief), m.brief);
  check(`${tag} why is one non-empty line ≤ ${WHY_MAX} chars`,
    typeof m.why === 'string' && m.why.trim().length > 0 && !m.why.includes('\n') && m.why.length <= WHY_MAX,
    `${m.why?.length ?? 'missing'} chars`);

  // shape
  check(`${tag} ${MURAL_INTERIOR_H} rows`, m.rows.length === MURAL_INTERIOR_H, `${m.rows.length}`);
  check(`${tag} ${MURAL_INTERIOR_H} ink rows`, m.ink.length === MURAL_INTERIOR_H, `${m.ink.length}`);
  let drawn = 0;
  let letters = 0;
  const badGlyphs = new Set<string>();
  const badInk = new Set<string>();
  let misaligned = 0;
  for (let y = 0; y < Math.min(m.rows.length, m.ink.length); y++) {
    const row = Array.from(m.rows[y] ?? '');
    const ink = Array.from(m.ink[y] ?? '');
    check(`${tag} row ${y} is ${MURAL_INTERIOR_W} glyphs`, row.length === MURAL_INTERIOR_W, `${row.length}`);
    check(`${tag} ink ${y} is ${MURAL_INTERIOR_W} codes`, ink.length === MURAL_INTERIOR_W, `${ink.length}`);
    for (let x = 0; x < Math.min(row.length, ink.length); x++) {
      const blankInk = ink[x] === '.';
      const blankGlyph = row[x] === ' ';
      if (blankInk !== blankGlyph) misaligned++;
      if (blankInk) continue;
      drawn++;
      if (!(ink[x] in MURAL_INK_LEGEND)) badInk.add(ink[x]);
      const cp = row[x].codePointAt(0) ?? 0;
      if (cp < 0x21 || !covered(cp)) badGlyphs.add(row[x]);
      if (/[A-Za-z0-9]/.test(row[x])) letters++;
    }
  }
  check(`${tag} ink '.' aligns with row spaces both ways`, misaligned === 0, `${misaligned} cells`);
  check(`${tag} every ink code is in the legend`, badInk.size === 0, [...badInk].join(' '));
  check(`${tag} every drawn glyph is Cozette-covered`, badGlyphs.size === 0,
    [...badGlyphs].map((g) => `'${g}' U+${(g.codePointAt(0) ?? 0).toString(16).toUpperCase()}`).join(' '));

  // budgets
  const cellCount = MURAL_INTERIOR_W * MURAL_INTERIOR_H;
  const density = drawn / cellCount;
  const letterFrac = drawn === 0 ? 0 : letters / drawn;
  check(`${tag} density in [${DENSITY_MIN}, ${DENSITY_MAX}]`,
    density >= DENSITY_MIN && density <= DENSITY_MAX, density.toFixed(3));
  check(`${tag} letterform fraction ≤ ${LETTER_MAX}`, letterFrac <= LETTER_MAX, letterFrac.toFixed(3));

  // cells round-trip: what the mount will actually draw
  const cells = authoredMuralCells(m);
  check(`${tag} cell grid is ${cellCount} cells`, cells.length === cellCount, `${cells.length}`);
  check(`${tag} cells: blank ⇔ null key`,
    cells.every((c) => (c.key === null) === (c.ch === ' ')));

  if (wantValues) {
    const keyUse = new Map<string, number>();
    for (const c of cells) if (c.key) keyUse.set(c.key, (keyUse.get(c.key) ?? 0) + 1);
    const keys = [...keyUse.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ');
    const glyphs = [...new Set(cells.filter((c) => c.key).map((c) => c.ch))].join('');
    console.log(`  values ${tag} brief=${m.brief} density=${density.toFixed(3)} (${drawn}/${cellCount})`
      + ` letters=${letterFrac.toFixed(3)} keys={${keys}} glyphs="${glyphs}"`);
  }
}

if (!onlyWing && wantValues && murals.length === 0) console.log('  values: no murals registered');
report();
