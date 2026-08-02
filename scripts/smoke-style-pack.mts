/**
 * Style-pack conformance smoke — the executable taste rails behind
 * docs/blueprints/style-pack.md. A pack is not "done" until this passes.
 *
 *   npx tsx scripts/smoke-style-pack.mts             → validate EVERY registered theme
 *   npx tsx scripts/smoke-style-pack.mts <themeId>   → validate one pack (authoring loop)
 *   … --values                                       → print the measured numbers too
 *
 * What it gates, and why each rail exists:
 *   - registration lockstep (THEMES + THEME_IDS + id field agree) — the
 *     4-touch-point registration recipe done wrong fails HERE, not on screen.
 *   - palette shape: exactly the 13 keys, #rrggbb each.
 *   - dark ground: relative luminance of bg < 0.35. Light backgrounds hit
 *     six hard-coded dark sites + the darken-only shadeOf — a known v1
 *     engine limit, enforced rather than discovered on screen.
 *   - register ordering: fgBright > fg > fgDim contrast vs bg — the three
 *     text registers must actually rank, or salience collapses.
 *   - beings out-shout the terrain: every reserved being accent key
 *     (src/themes/roles.ts BEING_ROLE_KEYS) + fgBright must beat fgDim,
 *     bgAlt AND the REAL demoted crust/foliage fills (landRoleFill — the
 *     exact maths the renderer applies). This is the salience campaign's
 *     pixel-verified finding ("the Archivist was darker than the floor")
 *     as a bar, not advice. Thresholds calibrated on the six shipped
 *     themes 2026-07-30, then FROZEN.
 *   - landGlyphs: valid land roles only, never a LAND_GLYPH_LOCKED role,
 *     exactly one visible glyph each, every codepoint in the shipped
 *     Cozette coverage snapshot (tofu is an invisible bug).
 *   - fx: absent, or a string/array whose entries are all in THEME_FX,
 *     no duplicates (read through themeFxList — the renderer's own path).
 *   - landRamp: real, never-LAND_RAMP_LOCKED roles; factors exactly 4,
 *     in (0,1], strictly ascending, LAST EXACTLY 1.0 (darken-only — step 3
 *     is byte-identical to the unramped fill, which is why the frozen
 *     being-salience bars stay sound under ramping); each ramped role's
 *     step-0 band keeps ≥ RAMP_STEP0_MIN contrast vs bg (a band that
 *     vanishes reads as a hole in the world).
 *   - landOmit: real, never-LAND_OMIT_LOCKED roles, no duplicates, at most
 *     OMIT_MAX — omission is a dialect choice (a blank DMG sky, a stroke-
 *     only scope), not a licence to empty the scene.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeChecker } from './lib/smoke.ts';
import { THEMES, THEME_IDS } from '../src/themes/index.ts';
import { BEING_ROLE_KEYS, ROLE_DEFAULTS } from '../src/themes/roles.ts';
import { THEME_FX, themeFxList, type Theme, type ThemePalette } from '../src/themes/types.ts';
import { landRoleFill, LAND_GLYPH_LOCKED, LAND_OMIT_LOCKED, LAND_RAMP_LOCKED, ROLE_KEY } from '../src/render/levels/land.ts';
import type { LandRole } from '../src/procedural/land.ts';

const args = process.argv.slice(2);
const wantValues = args.includes('--values');
const onlyId = args.find((a) => !a.startsWith('--'));

const { check, report } = makeChecker('smoke style-pack');

// --- palette maths (WCAG relative luminance + contrast ratio) --------------
const PALETTE_KEYS: readonly (keyof ThemePalette)[] = [
  'bg', 'bgAlt', 'fgDim', 'fg', 'fgBright',
  'yellow', 'orange', 'red', 'magenta', 'violet', 'blue', 'cyan', 'green',
];

const lumOfInt = (n: number): number => {
  const ch = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 0xff) + 0.7152 * ch((n >> 8) & 0xff) + 0.0722 * ch(n & 0xff);
};
const lumOfHex = (hex: string): number => lumOfInt(parseInt(hex.slice(1), 16));
const contrast = (la: number, lb: number): number =>
  (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);

// --- font coverage snapshot (same source as smoke-glyph-coverage) ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const coverage = JSON.parse(
  readFileSync(path.join(here, 'lib', 'cozette-coverage.json'), 'utf8'),
) as { ranges: [number, number][] };
const covered = (cp: number): boolean => coverage.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

// --- bars (calibrated on the six shipped themes 2026-07-30; FROZEN) --------
/** bg relative luminance ceiling — "dark ground". Shipped max: solarized
 *  bg #002b36 ≈ 0.02; the ceiling leaves room for moody-not-light packs. */
const BG_LUM_MAX = 0.35;
/** Being-accent bars, calibrated 2026-07-30 on the six shipped themes and
 *  frozen. Contrast-vs-bg is a proxy that under-credits HUE separation
 *  (gruvbox's violet Archivist reads clearly at 0.87× the dust register's
 *  contrast), so a strict "beat the ground" bar failed two shipped themes.
 *  Tightest bars all six pass: each reserved being accent must reach
 *  ≥ BEING_CLEAR × the ground-register max (shipped floor 0.866) AND
 *  ≥ BEING_MIN_CONTRAST absolute vs bg (WCAG 3:1 graphics floor; shipped
 *  floor 3.26). */
const BEING_CLEAR = 0.85;
const BEING_MIN_CONTRAST = 3.0;
/** Ramp dimmest-step visibility floor: a ramped role's step-0 band must keep
 *  this much contrast vs bg, or the band reads as a hole in the world.
 *  Calibrated 2026-07-31 on the 10-theme corpus (gameboy-dmg is the only
 *  ramped pack; its step-0 floor is stone 1.13, bedrock/cavern 1.28, the
 *  rest ≥ 1.43) and FROZEN just under that floor. */
const RAMP_STEP0_MIN = 1.1;
/** Omission ceiling: at most this many roles per pack's landOmit. Set
 *  2026-07-31 and FROZEN before any omitting pack shipped: 12 of the 22
 *  omittable roles leaves headroom for the maximal stroke-only cut (the
 *  08-oscilloscope direction needs ~11 fill roles gone) while keeping
 *  "omit nearly everything" illegal. */
const OMIT_MAX = 12;

const VALID_ROLES = new Set(Object.keys(ROLE_KEY));
const VALID_THEME_ROLES = new Set(Object.keys(ROLE_DEFAULTS));
const TOP_LEVEL = new Set(['id', 'name', 'palette', 'roles', 'landGlyphs', 'fx', 'landRamp', 'landOmit']);

const ids = onlyId ? [onlyId] : [...THEME_IDS];
check('registry lockstep: THEME_IDS == Object.keys(THEMES)',
  JSON.stringify([...THEME_IDS].sort()) === JSON.stringify(Object.keys(THEMES).sort()));
if (onlyId) {
  check(`'${onlyId}' is registered in THEMES + THEME_IDS`,
    Object.hasOwn(THEMES, onlyId) && (THEME_IDS as readonly string[]).includes(onlyId));
}

// --- mural + muralFrame role lock-set wiring -----
check('mural is glyph-locked', LAND_GLYPH_LOCKED.has('mural'));
check('muralFrame is glyph-locked', LAND_GLYPH_LOCKED.has('muralFrame'));
check('muralFrame is omit-locked', LAND_OMIT_LOCKED.has('muralFrame'));
check('mural is omit-ALLOWED (lossy-lens doctrine)', !LAND_OMIT_LOCKED.has('mural'));
check('mural is ramp-locked', LAND_RAMP_LOCKED.has('mural'));
check('muralFrame is ramp-locked', LAND_RAMP_LOCKED.has('muralFrame'));

// --- closed-wing skyline role lock-set wiring (land polish #19) -----
check('wingMark is glyph-locked (it is a name, like label)', LAND_GLYPH_LOCKED.has('wingMark'));
check('wingMark is omit-ALLOWED (deletes with its silhouette)', !LAND_OMIT_LOCKED.has('wingMark'));
check('wingSil is glyph-allowed', !LAND_GLYPH_LOCKED.has('wingSil'));
check('wingSil is omit-allowed', !LAND_OMIT_LOCKED.has('wingSil'));
check('wingSil is ramp-allowed', !LAND_RAMP_LOCKED.has('wingSil'));

for (const id of ids) {
  const t = THEMES[id] as Theme | undefined;
  if (!t) continue; // registration failure already recorded above
  const tag = `[${id}]`;

  // 1 · shape
  check(`${tag} id field matches registry key`, t.id === id);
  check(`${tag} has a name`, typeof t.name === 'string' && t.name.length > 0);
  check(`${tag} no unknown top-level keys`,
    Object.keys(t).every((k) => TOP_LEVEL.has(k)),
    Object.keys(t).filter((k) => !TOP_LEVEL.has(k)).join(','));
  const pal = t.palette ?? ({} as ThemePalette);
  check(`${tag} palette has exactly the 13 keys`,
    JSON.stringify(Object.keys(pal).sort()) === JSON.stringify([...PALETTE_KEYS].sort()),
    Object.keys(pal).join(','));
  const hexOk = PALETTE_KEYS.every((k) => /^#[0-9a-f]{6}$/i.test(pal[k] ?? ''));
  check(`${tag} every palette value is #rrggbb`, hexOk);
  if (!hexOk) continue; // the maths below would NaN — shape failure already recorded

  // 2 · dark ground
  const bgLum = lumOfHex(pal.bg);
  check(`${tag} dark ground: relLum(bg) ${bgLum.toFixed(3)} < ${BG_LUM_MAX}`, bgLum < BG_LUM_MAX);

  // 3 · register ordering
  const C = (hex: string): number => contrast(lumOfHex(hex), bgLum);
  check(`${tag} register order: fgBright > fg > fgDim (vs bg)`,
    C(pal.fgBright) > C(pal.fg) && C(pal.fg) > C(pal.fgDim),
    `fgBright ${C(pal.fgBright).toFixed(2)} fg ${C(pal.fg).toFixed(2)} fgDim ${C(pal.fgDim).toFixed(2)}`);

  // 4 · beings out-shout the terrain (real renderer maths via landRoleFill).
  //     Still sound under landRamp: factors are darken-only (last exactly
  //     1.0, check 8), so no ramp step is ever brighter than the fills
  //     measured here.
  const groundFills: Array<[string, number]> = [
    ['fgDim', contrast(lumOfHex(pal.fgDim), bgLum)],
    ['bgAlt', contrast(lumOfHex(pal.bgAlt), bgLum)],
    ['crust(demoted)', contrast(lumOfInt(landRoleFill(t, 'crust')), bgLum)],
    ['foliage(demoted)', contrast(lumOfInt(landRoleFill(t, 'foliage')), bgLum)],
  ];
  const groundMax = Math.max(...groundFills.map(([, c]) => c));
  const beingKeys = [...new Set([...BEING_ROLE_KEYS, 'fgBright' as const])];
  for (const k of beingKeys) {
    const c = contrast(lumOfHex(pal[k]), bgLum);
    check(`${tag} being accent '${k}' clears the ground registers`,
      c >= groundMax * BEING_CLEAR && c >= BEING_MIN_CONTRAST,
      `${k} ${c.toFixed(2)} vs ground max ${groundMax.toFixed(2)} (need ≥${(groundMax * BEING_CLEAR).toFixed(2)} and ≥${BEING_MIN_CONTRAST})`);
  }

  // 5 · glyph dialect
  const glyphs = t.landGlyphs ?? {};
  for (const [role, g] of Object.entries(glyphs)) {
    check(`${tag} landGlyphs.${role} is a real land role`, VALID_ROLES.has(role));
    check(`${tag} landGlyphs.${role} is not locked`,
      !LAND_GLYPH_LOCKED.has(role as LandRole),
      `locked: ${[...LAND_GLYPH_LOCKED].join(' ')}`);
    const cps = [...String(g)];
    const oneVisible = cps.length === 1 && g !== ' ';
    check(`${tag} landGlyphs.${role} is exactly one visible glyph`, oneVisible, JSON.stringify(g));
    if (oneVisible) {
      const cp = g.codePointAt(0)!;
      check(`${tag} landGlyphs.${role} '${g}' (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) is in Cozette`,
        covered(cp));
    }
  }

  // 6 · fx whitelist (string or array — themeFxList is the renderer's own read)
  const fxShapeOk = t.fx === undefined || typeof t.fx === 'string' || Array.isArray(t.fx);
  check(`${tag} fx is absent, a string, or an array`, fxShapeOk, JSON.stringify(t.fx));
  const fxList = fxShapeOk ? themeFxList(t) : [];
  check(`${tag} fx entries all in THEME_FX`,
    fxList.every((f) => (THEME_FX as readonly string[]).includes(f)),
    JSON.stringify(t.fx));
  check(`${tag} fx entries unique`, new Set(fxList).size === fxList.length, JSON.stringify(t.fx));

  // 7 · roles overrides stay inside the vocab
  for (const [role, key] of Object.entries(t.roles ?? {})) {
    check(`${tag} roles.${role} is a real theme role`, VALID_THEME_ROLES.has(role));
    check(`${tag} roles.${role} maps to a palette key`,
      (PALETTE_KEYS as readonly string[]).includes(key as string), String(key));
  }

  // 8 · landRamp (style-pack slot 4): shape + the step-0 visibility bar
  const ramp = t.landRamp;
  const rampRoles: LandRole[] = [];
  if (ramp !== undefined) {
    const rolesShapeOk = Array.isArray(ramp.roles) && ramp.roles.length > 0;
    check(`${tag} landRamp.roles is a non-empty array`, rolesShapeOk, JSON.stringify(ramp.roles));
    for (const role of rolesShapeOk ? ramp.roles : []) {
      check(`${tag} landRamp role '${role}' is a real land role`, VALID_ROLES.has(role));
      check(`${tag} landRamp role '${role}' is not ramp-locked`,
        !LAND_RAMP_LOCKED.has(role),
        `locked: ${[...LAND_RAMP_LOCKED].join(' ')}`);
      if (VALID_ROLES.has(role) && !LAND_RAMP_LOCKED.has(role)) rampRoles.push(role);
    }
    const f = ramp.factors;
    if (f !== undefined) {
      const fOk = Array.isArray(f) && f.length === 4 &&
        f.every((v) => typeof v === 'number' && v > 0 && v <= 1);
      check(`${tag} landRamp.factors: exactly 4 numbers in (0, 1]`, fOk, JSON.stringify(f));
      if (fOk) {
        check(`${tag} landRamp.factors strictly ascending`,
          f[0] < f[1] && f[1] < f[2] && f[2] < f[3], f.join(','));
        check(`${tag} landRamp.factors end at exactly 1.0 (darken-only)`, f[3] === 1, String(f[3]));
      }
    }
    for (const role of rampRoles) {
      const c = contrast(lumOfInt(landRoleFill(t, role, 0)), bgLum);
      check(`${tag} landRamp '${role}' step-0 band stays visible`,
        c >= RAMP_STEP0_MIN,
        `${c.toFixed(2)} vs bar ${RAMP_STEP0_MIN}`);
    }
  }

  // 9 · landOmit (style-pack slot 5): shape + locked set + the emptiness bound
  const omit = t.landOmit;
  if (omit !== undefined) {
    const omitShapeOk = Array.isArray(omit) && omit.length > 0;
    check(`${tag} landOmit is a non-empty array`, omitShapeOk, JSON.stringify(omit));
    for (const role of omitShapeOk ? omit : []) {
      check(`${tag} landOmit role '${role}' is a real land role`, VALID_ROLES.has(role));
      check(`${tag} landOmit role '${role}' is not omit-locked`,
        !LAND_OMIT_LOCKED.has(role),
        `locked: ${[...LAND_OMIT_LOCKED].join(' ')}`);
    }
    if (omitShapeOk) {
      check(`${tag} landOmit has no duplicates`, new Set(omit).size === omit.length,
        omit.join(','));
      check(`${tag} landOmit stays under the emptiness bound`, omit.length <= OMIT_MAX,
        `${omit.length} roles vs OMIT_MAX ${OMIT_MAX}`);
    }
  }

  if (wantValues) {
    // eslint-disable-next-line no-console
    console.log(`  ${tag} relLum(bg)=${bgLum.toFixed(4)}  ` +
      PALETTE_KEYS.map((k) => `${k}=${C(pal[k]).toFixed(2)}`).join(' '));
    // eslint-disable-next-line no-console
    console.log(`  ${tag} ground: ${groundFills.map(([n, c]) => `${n}=${c.toFixed(2)}`).join(' ')}`);
    if (fxList.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`  ${tag} fx: ${fxList.join('+')}`);
    }
    if (rampRoles.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`  ${tag} ramp step0/step3: ${rampRoles.map((r) => {
        const c0 = contrast(lumOfInt(landRoleFill(t, r, 0)), bgLum);
        const c3 = contrast(lumOfInt(landRoleFill(t, r, 3)), bgLum);
        return `${r}=${c0.toFixed(2)}/${c3.toFixed(2)}`;
      }).join(' ')}`);
    }
    if (omit !== undefined && Array.isArray(omit) && omit.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`  ${tag} omit (${omit.length}/${OMIT_MAX}): ${omit.join(' ')}`);
    }
  }
}

report();
