/**
 * Salience-campaign smoke — `npx tsx scripts/smoke-salience.mts`.
 * Locks the role layer (uniform defaults, per-theme override, fallback)
 * and the reserved-accent rule: no tile-bible or scatter entry may use a
 * being's palette key in ANY theme.
 */
import { makeChecker } from './lib/smoke.ts';

const { roleKey, ROLE_DEFAULTS, BEING_ROLE_KEYS } = await import('../src/themes/roles.ts');
const { getById } = await import('../src/themes/index.ts');
const { TILE_BY_ID } = await import('../src/procedural/tiles/library.ts');
const { buildScatterTable } = await import('../src/procedural/scatter.ts');

const { check, report } = makeChecker('smoke salience');

const theme = getById('solarized-dark');

// role resolution: defaults
check('player → fgBright', roleKey(theme, 'player', 'fg') === 'fgBright');
check('being.archivist → violet', roleKey(theme, 'being.archivist', 'blue') === 'violet');
check('being.cat → orange', roleKey(theme, 'being.cat', 'yellow') === 'orange');
check('being.visitor → cyan', roleKey(theme, 'being.visitor', 'cyan') === 'cyan');
check('being.ghost → fgDim (deliberate)', roleKey(theme, 'being.ghost', 'fgDim') === 'fgDim');
check('seam → blue', roleKey(theme, 'seam', 'blue') === 'blue');

// fallback: unknown role in defaults AND theme → fallback wins
check('fallback honoured', roleKey(theme, 'decor.quiet', 'bgAlt') === (ROLE_DEFAULTS['decor.quiet'] ?? 'bgAlt'));

// per-theme override: a theme carrying roles wins over defaults
const overridden = { ...theme, roles: { player: 'red' as const } };
check('theme override wins', roleKey(overridden, 'player', 'fgBright') === 'red');

// reserved-accent rule over the tile bible
const beingKeys = new Set(BEING_ROLE_KEYS);
const tiles = [...TILE_BY_ID.values()];
const tileViolations = tiles
  .filter((t) => beingKeys.has(t.fgKey as never))
  .map((t) => `tile ${t.id}:${t.fgKey}`);
check('no tile uses a being key', tileViolations.length === 0, tileViolations.join(', '));

// reserved-accent rule over the scatter bible — via the exported table
// builder (SCATTER_BIBLE itself is module-private; buildScatterTable
// exposes the glyphs, mirroring scripts/smoke-glyph-coverage.mts).
const scatterEntries = buildScatterTable().entries.map(([glyph, fgKey]) => ({ glyph, fgKey }));
check('scatter bible located', scatterEntries.length > 0, 'buildScatterTable returned no entries');
const scatterViolations = scatterEntries
  .filter((e) => beingKeys.has(e.fgKey as never))
  .map((e) => `${e.glyph}:${e.fgKey}`);
check('no scatter entry uses a being key', scatterViolations.length === 0, scatterViolations.join(', '));

// the tofu swap landed
const table = tiles.find((t) => t.glyph === '▤');
check('T_TABLE glyph is ▤ (not □)', table !== undefined && !tiles.some((t) => t.glyph === '□'));

// land beings draw from the reserved accent pool (ambient-salience bundle)
const { beingAccentRole, LAND_BEING_ROLES } = await import('../src/terminal/beingIntents.ts');
check('land accent deterministic', beingAccentRole('b1') === beingAccentRole('b1'));
const accentSpread = new Set(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'].map(beingAccentRole));
check('land accents spread over >1 role', accentSpread.size > 1);
check(
  'land accents are being roles only',
  [...accentSpread].every((r) => (LAND_BEING_ROLES as readonly string[]).includes(r)),
);
check(
  'every land role resolves to a reserved key by default',
  LAND_BEING_ROLES.every((r) => beingKeys.has(roleKey(theme, r, 'fgBright') as never)),
);

// --- the PRIMARY tint path (2026-08-08) ------------------------------------
// The four checks above resolve through beingAccentRole(), which
// terminalLand.ts:983 uses ONLY for ids outside the cohort:
//   fill: def ? theme.palette[def.paletteKey] : roleKey(theme, beingAccentRole(id), …)
// Every being the desk draws takes the first branch, so the block above was
// guarding a path production never runs — and the two disagree about which
// agent gets which colour. These check the branch that ships.
const { COHORT } = await import('../src/agents/cohort.ts');
check('cohort is non-empty (else everything below is vacuous)', COHORT.length > 0);
const strayAccent = COHORT.filter((d) => d.paletteKey !== 'fgDim' && !beingKeys.has(d.paletteKey as never))
  .map((d) => `${d.id}:${d.paletteKey}`);
check('every cohort accent is a reserved key (or the ghost fgDim exception)',
  strayAccent.length === 0, strayAccent.join(', '));

// --- no furniture may wear a being's colour UNDER that being ---------------
// A being draws at model.surface[x] - 1. If the role occupying THAT cell
// resolves to the being's own palette key, the glyph renders in its
// background's exact colour and vanishes: measured on the running desk, the
// cyan Visitor leaving the cyan monument changed the vacated cell by max 2/255
// per channel, where the same being on clear ground changed 41. GROUND_DEMOTE
// darkens the two roles this can happen in; this bar is what keeps them
// separated, and it is stated as an absolute so that zeroing the demote fails
// it (a bar written in terms of the constant it guards is not a bar).
const SEP_MIN = 1.5; // inherited verbatim from the daylight-colour rung's
                     // measured "perceptible change to the same surface" floor
const { composeLand, SAMPLE_LAND } = await import('../src/procedural/land.ts');
const { ROLE_KEY, landRoleFill } = await import('../src/render/levels/land.ts');
const { THEMES, THEME_IDS } = await import('../src/themes/index.ts');

// Desk geometry, restated from terminalLand.ts:143-144 + :437-439 (the desk
// builds its composeOpts inline and exports nothing). Swept over a second
// width so a window-size change cannot silently shrink the trigger set.
const DESK_GEOM = [
  { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false, mural: false },
  { width: 80, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false, mural: false },
] as const;
const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
/** Roles that can occupy a being's OWN cell, derived by composing the desk's
 *  own wings rather than hard-coded — a new structure role joins the bar for
 *  free. */
const ownCell = new Set<string>();
for (const geom of DESK_GEOM) {
  for (const wing of ['d0', 'd1', 'd2', 'd3', 'd4', 'd5']) {
    const rot = fnv(wing) % SAMPLE_LAND.length;
    const games = Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);
    const m = composeLand(fnv(`terminal:${wing}`), games, geom);
    for (let x = 0; x < m.width; x++) {
      const by = m.surface[x] - 1;
      if (by >= 0) ownCell.add(m.role[by][x]);
    }
  }
}
check('own-cell role set derived (else the bar below is vacuous)', ownCell.size > 3, `${ownCell.size} roles`);
check('the two known colliding roles are in the derived set',
  ownCell.has('cottage') && ownCell.has('monument'), [...ownCell].join(','));

// The desk hides several BAKED layers and draws its own (terminalLand.ts
// hideBakedLayers). A role it never draws cannot collide with anything on the
// product surface, so it leaves the bar — but the exclusion is READ OUT of the
// renderer rather than restated here, so that un-hiding a layer re-arms the bar
// automatically instead of leaving this gate guarding a stale assumption.
const { readFileSync } = await import('node:fs');
const landSrc = readFileSync(new URL('../src/terminal/terminalLand.ts', import.meta.url), 'utf8');
const hideBody = /const hideBakedLayers[\s\S]*?\n  \};/.exec(landSrc)?.[0] ?? '';
const hidden = new Set([...hideBody.matchAll(/scene\.layers\.(\w+)/g)].map((m) => m[1]));
check('hideBakedLayers parsed out of the renderer', hidden.size > 0, `${hidden.size} layers`);
check('the baked being layer is among them (it is why `being` leaves the bar)', hidden.has('being'));
for (const r of hidden) ownCell.delete(r);

const srgbC = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lumInt = (i: number): number =>
  0.2126 * srgbC(((i >> 16) & 255) / 255) + 0.7152 * srgbC(((i >> 8) & 255) / 255) + 0.0722 * srgbC((i & 255) / 255);
const contrastOf = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const collisions: string[] = [];
for (const id of THEME_IDS) {
  const t = THEMES[id];
  const omit = new Set<string>(t.landOmit ?? []);
  for (const d of COHORT) {
    // The ghost is DELIBERATELY barely-there, so fgDim roles (ridge, edge,
    // skyDither, signpost) are by design, not a defect.
    if (d.paletteKey === 'fgDim') continue;
    for (const role of ownCell) {
      if (omit.has(role)) continue;
      if (ROLE_KEY[role as never] !== d.paletteKey) continue;
      const sep = contrastOf(
        lumInt(parseInt(t.palette[d.paletteKey].slice(1), 16)),
        lumInt(landRoleFill(t, role as never)),
      );
      if (sep < SEP_MIN) collisions.push(`${id}/${d.id} on ${role} ${sep.toFixed(2)}`);
    }
  }
}
check(`every being separates from the furniture it stands IN (>= ${SEP_MIN}:1, all themes)`,
  collisions.length === 0, collisions.slice(0, 6).join(', '));

// book-spine strokes (ambient-salience bundle): deterministic, gold-
// guaranteed when stocked, all-dim when empty, never a reserved key
const { shelfStrokeTints, SHELF_STROKE_OFFSETS_PX } = await import('../src/procedural/tiles/library.ts');
let strokeDeterministic = true;
let strokeGold = true;
let strokeDim = true;
let strokeReserved = false;
for (let i = 0; i < 500; i++) {
  const h = (Math.imul(i, 0x9e3779b1) ^ 0x5eed) >>> 0;
  const stocked = shelfStrokeTints(h, true);
  const empty = shelfStrokeTints(h, false);
  if (JSON.stringify(stocked) !== JSON.stringify(shelfStrokeTints(h, true))) strokeDeterministic = false;
  if (!stocked.includes('yellow')) strokeGold = false;
  if (stocked.some((k) => beingKeys.has(k as never))) strokeReserved = true;
  if (JSON.stringify(empty) !== JSON.stringify(['yellow', 'fgDim', 'fgDim'])) strokeDim = false;
}
check('shelf strokes deterministic', strokeDeterministic);
check('stocked shelves always carry a gold stroke', strokeGold);
check('bookless shelves = gold case + dim books', strokeDim);
check('no stroke uses a reserved being key', !strokeReserved);
check('three sub-cell stroke offsets', SHELF_STROKE_OFFSETS_PX.length === 3);

report();
