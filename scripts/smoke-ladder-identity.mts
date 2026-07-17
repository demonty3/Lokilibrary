/**
 * Ladder identity smoke — `npx tsx scripts/smoke-ladder-identity.mts`.
 *
 * Pins the pure layer-composition + fit + presence + home-resolution +
 * mark-re-key logic behind the themed scale-ladder rungs
 * (spec docs/superpowers/specs/2026-07-17-ladder-identity-design.md).
 *
 * Hard rules asserted:
 *   - TintCanvas layers are DISJOINT and their union reproduces the canvas
 *     (the no-overstrike-by-construction contract).
 *   - fitGrid is the cell room's composition rule (integer, centred, ≥1).
 *   - home resolution: a pane's bound wing wins; stale/absent falls back
 *     to the canonical first district.
 *   - presence: live scopes map by wing, whole-library counts as home,
 *     no live scopes → theme-filtered cohort fallback on home.
 *   - composition: YOU composed into the home border, frames/ramp/letters
 *     in their own layers, deterministic, per-rung home follows the wing.
 *   - mark re-key: ghost marks = 'mark.ghost' → fg (the dim-but-distinct
 *     step); BEING_ROLE_KEYS derives to the same reserved value.
 */
import { makeChecker } from './lib/smoke.ts';
import {
  createCanvas, stamp, stampLines, layerStrings, fitGrid,
} from '../src/render/levels/tintPanel.ts';
import {
  clusterLibrary, findContinentOf, homeDistrictId,
} from '../src/procedural/clusters.ts';
import { SAMPLE_LIBRARY } from '../src/data/sampleLibrary.ts';
import { presenceByDistrict } from '../src/render/levels/ladderPresence.ts';
import {
  composeDistrictPanel, composeIslandPanel, composeContinentPanel, AGENT_LETTERS,
} from '../src/render/levels/ladderCompose.ts';
import { BEING_ROLE_KEYS, ROLE_DEFAULTS } from '../src/themes/roles.ts';

const { check, report } = makeChecker('smoke ladder-identity');

// T1 — canvas: base layer owns everything; stamp moves ownership.
{
  const c = createCanvas(6, 2, 'base');
  stamp(c, 1, 0, '┌──┐', 'gold');
  stamp(c, 2, 0, 'YO', 'you'); // overwrites two gold cells
  const layers = layerStrings(c);
  const gold = layers.get('gold')!.split('\n');
  const you = layers.get('you')!.split('\n');
  check('T1 gold keeps non-stolen cells', gold[0] === ' ┌  ┐ ', gold[0]);
  check('T1 you owns stolen cells', you[0] === '  YO  ', you[0]);
  check('T1 base layer absent when it owns no glyphs', !layers.has('base'));
  // Disjoint union: per cell exactly one non-space owner across layers.
  let disjoint = true;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 6; x++) {
      const owners = [...layers.values()].filter((s) => s.split('\n')[y][x] !== ' ').length;
      const glyph = c.glyphs[y][x];
      if (glyph !== ' ' && owners !== 1) disjoint = false;
      if (glyph === ' ' && owners !== 0) disjoint = false;
    }
  }
  check('T1 layers disjoint, union = canvas', disjoint);
}

// T2 — stampLines + all rows same width in every layer string.
{
  const c = createCanvas(4, 3, 'base');
  stampLines(c, 0, 1, ['ab', 'cd'], 'x');
  const s = layerStrings(c);
  check('T2 stampLines rows land', s.get('x')!.split('\n')[1] === 'ab  ' && s.get('x')!.split('\n')[2] === 'cd  ');
  check(
    'T2 uniform row width',
    [...s.values()].every((t) => t.split('\n').every((r) => r.length === 4)),
  );
  // Clipping: out-of-bounds stamps neither throw nor wrap.
  stamp(c, 3, 0, 'wxyz', 'x');
  check('T2 stamp clips at the edge', c.glyphs[0][3] === 'w' && c.glyphs[0].join('').length === 4);
  stamp(c, 0, 99, 'nope', 'x'); // silently ignored
  check('T2 row out of range ignored', c.rows === 3);
}

// T3 — fitGrid = the cell room rule (integer, centred, min 1).
{
  const f = fitGrid(60, 26, { pw: 600, ph: 130 });
  check('T3 integer scale min(sx,sy)', f.scale === 5, `got ${f.scale}`);
  check('T3 centred', f.x === Math.floor((600 - 300) / 2) && f.y === 0);
  const tiny = fitGrid(600, 260, { pw: 100, ph: 100 });
  check('T3 floor at 1', tiny.scale === 1);
  // Full-rect identity: panel == rect → scale 1, origin 0.
  const id = fitGrid(200, 100, { pw: 200, ph: 100 });
  check('T3 exact fit identity', id.scale === 1 && id.x === 0 && id.y === 0);
}

// T4 — home resolution: bound wing wins; stale/absent falls back to canonical d0.
{
  const games = SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name }));
  const tree = clusterLibrary(games, 0xa11ce11);
  const all = tree.continents.flatMap((c) => c.islands.flatMap((i) => i.districts.map((d) => d.id)));
  const first = all[0];
  const other = all.find((id) => id !== first)!;
  check('T4 canonical fallback', homeDistrictId(tree) === first);
  check('T4 bound wing wins', homeDistrictId(tree, other) === other);
  check('T4 stale wing falls back', homeDistrictId(tree, 'd999') === first);
  check(
    'T4 findContinentOf finds',
    findContinentOf(tree, other)!.islands.some((i) => i.districts.some((d) => d.id === other)),
  );
  check('T4 findContinentOf null on stale', findContinentOf(tree, 'd999') === null);
  const empty = clusterLibrary([], 1);
  check('T4 empty tree → null home', homeDistrictId(empty) === null);
}

// T5 — presence: live scopes map by wing (null wing = home); empty → cohort fallback on home.
{
  const live = [
    { wingId: null, agentIds: ['loki', 'cat'] },
    { wingId: 'd2', agentIds: ['visitor'] },
  ];
  const p = presenceByDistrict('d0', live, ['loki', 'archivist']);
  check('T5 null wing → home', (p.get('d0') ?? []).join(',') === 'loki,cat');
  check('T5 bound wing kept', (p.get('d2') ?? []).join(',') === 'visitor');
  const fb = presenceByDistrict('d0', [], ['loki', 'archivist']);
  check('T5 no live scopes → fallback on home', (fb.get('d0') ?? []).join(',') === 'loki,archivist');
  check('T5 null home → empty', presenceByDistrict(null, [], ['loki']).size === 0);
  const merged = presenceByDistrict(
    'd0',
    [{ wingId: null, agentIds: ['loki'] }, { wingId: 'd0', agentIds: ['cat'] }],
    [],
  );
  check('T5 same-district scopes merge', (merged.get('d0') ?? []).join(',') === 'loki,cat');
}

// T6 — district composition: YOU in home border, gold frames, letters in being layers.
{
  const games = SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name }));
  const tree = clusterLibrary(games, 0xa11ce11);
  const all = tree.continents.flatMap((c) => c.islands.flatMap((i) => i.districts.map((d) => d.id)));
  const wing = all[all.length - 1];
  const presence = new Map<string, readonly string[]>([[wing, ['loki', 'cat']]]);
  const { canvas } = composeDistrictPanel(games, 0xa11ce11, { homeWingId: wing, presence });
  const layers = layerStrings(canvas);
  check('T6 home layer carries YOU', (layers.get('home') ?? '').includes('YOU'));
  check('T6 frame layer has borders', (layers.get('frame') ?? '').includes('┌'));
  check('T6 header names the wing', (layers.get('name') ?? '').includes(`wing ${wing}`));
  check('T6 loki letter in its being layer', (layers.get('being.loki') ?? '').includes('L'));
  check('T6 cat letter in its being layer', (layers.get('being.cat') ?? '').includes('c'));
  check('T6 ramp layer present', (layers.get('ramp') ?? '').length > 0);
  // Determinism: same inputs → byte-identical layer map.
  const again = layerStrings(
    composeDistrictPanel(games, 0xa11ce11, { homeWingId: wing, presence }).canvas,
  );
  check('T6 deterministic', JSON.stringify([...layers]) === JSON.stringify([...again]));
  // No identity → canonical home + YOU, no letters, no wing header segment.
  const bare = layerStrings(composeDistrictPanel(games, 0xa11ce11).canvas);
  check('T6 bare compose has home YOU', (bare.get('home') ?? '').includes('YOU'));
  check('T6 bare compose no being layers', ![...bare.keys()].some((k) => k.startsWith('being.')));
  check('T6 bare compose no wing segment', !(bare.get('name') ?? '').includes('wing '));
  // Every row in every layer is canvas-width (BitmapText alignment).
  check(
    'T6 uniform rows',
    [...layers.values()].every((t) => t.split('\n').every((r) => r.length === canvas.cols)),
  );
}

// T7 — island + continent: home follows the wing across rungs.
{
  const games = SAMPLE_LIBRARY.map((g) => ({ appid: g.appid, name: g.name }));
  const tree = clusterLibrary(games, 0xa11ce11);
  const all = tree.continents.flatMap((c) => c.islands.flatMap((i) => i.districts.map((d) => d.id)));
  const wing = all[all.length - 1];
  const island = layerStrings(composeIslandPanel(games, 0xa11ce11, { homeWingId: wing }).canvas);
  check('T7 island home layer has YOU', (island.get('home') ?? '').includes('YOU'));
  const { labels } = composeContinentPanel(games, 0xa11ce11, { homeWingId: wing });
  check('T7 exactly one home continent label', labels.filter((l) => l.home).length === 1);
  check('T7 home label carries YOU', labels.find((l) => l.home)!.text.includes('YOU'));
  check('T7 labels stay inside CELL_BLOCK budget', labels.every((l) => l.text.length <= 14));
  // Empty library: composes the dim empty panel, no labels, no crash.
  const emptyIsland = composeIslandPanel([], 1);
  check(
    'T7 empty island → dim empty panel',
    (layerStrings(emptyIsland.canvas).get('dim') ?? '').includes('no library loaded yet.'),
  );
  const emptyContinent = composeContinentPanel([], 1);
  check('T7 empty continent → no labels', emptyContinent.labels.length === 0);
}

// T8 — AGENT_LETTERS mirrors COHORT glyphs.
check(
  'T8 letters from defs',
  AGENT_LETTERS.get('loki') === 'L' && AGENT_LETTERS.get('cat') === 'c' && AGENT_LETTERS.get('ghost') === 'G',
);

// T9 — mark re-key: ghost is the dim-but-distinct step; being keys derived.
{
  check('T9 mark.ghost default fg', ROLE_DEFAULTS['mark.ghost'] === 'fg');
  check('T9 being.ghost stays fgDim', ROLE_DEFAULTS['being.ghost'] === 'fgDim');
  check(
    'T9 BEING_ROLE_KEYS derived value unchanged',
    JSON.stringify(BEING_ROLE_KEYS) === JSON.stringify(['magenta', 'violet', 'orange', 'cyan']),
  );
}

report();
