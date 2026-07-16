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
