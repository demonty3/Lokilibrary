/** Mural compose smoke — `npx tsx scripts/smoke-land-mural.mts`. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, MURAL_INTERIOR_W, MURAL_INTERIOR_H } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-mural');

const T = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false } as const;

/** FNV-1a 32-bit — local copy (src/terminal/terminalLand.ts has the canonical
 *  version); used here only to compress the golden compose output into a
 *  short hex string instead of a megabyte JSON literal. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const hash = (v: unknown): string => fnv1a(JSON.stringify(v)).toString(16);

// 1 — off by default: no mural field, no mural roles anywhere (byte-identity guard).
const off = composeLand(7, SAMPLE_LAND, T);
check('no mural field without opts.mural', off.mural === undefined);
check('no mural roles without opts.mural',
  !off.role.some((row) => row.some((r) => r === 'mural' || r === 'muralFrame')));

// golden: no-mural compose output re-frozen 2026-08-06 (#19 slice 2 land
// re-roll) — a change here means the mural-off path is no longer
// byte-identical.
//
// RE-FROZEN AGAIN 2026-08-06 (launcher beat): this hash covers the WHOLE
// model payload, and `LandSite` gained the launcher's `name` + `appid`
// metadata. NO drawn cell moved — char/role/surface/mural/shade/poster and
// every site's x/y/text/kind were diffed against the pre-change composer and
// came back identical. The hash still hashes everything on purpose (a gate
// that hashed only the grid would miss real payload regressions).
// RE-FROZEN AGAIN 2026-08-07 (hour-without-colour, leg 1): the shelf lamp's
// role byte changed from 'sun' to 'lamp' so the sky body and the ground light
// can take OPPOSITE alphas with the hour. A PAYLOAD change, not a re-roll —
// `set()` consumes no RNG, so no draw moved, and the proof is that the other
// 67 smokes stayed green through it (monument geometry, constellations, ore,
// signposts, sites, wear, marks all assert positions and none moved). Only
// this gate, which hashes the whole model including roles, sees it.
const NO_MURAL_GOLDEN: Record<string, string> = {
  seed7: 'bbfd0f01',
  seed41: 'c7c807b1',
  // NB (pre-existing): seed 7's right edge already sits at the shared seam
  // height, so a right join is a no-op for THIS seed — same hash as seed7 by
  // coincidence, not by a broken join. Other seeds do move.
  join: 'bbfd0f01',
};
check('no-mural golden: seed 7', hash(off) === NO_MURAL_GOLDEN.seed7, hash(off));
check('no-mural golden: seed 41',
  hash(composeLand(41, SAMPLE_LAND, T)) === NO_MURAL_GOLDEN.seed41,
  hash(composeLand(41, SAMPLE_LAND, T)));
check('no-mural golden: join',
  hash(composeLand(7, SAMPLE_LAND, { ...T, join: { right: 99 } })) === NO_MURAL_GOLDEN.join,
  hash(composeLand(7, SAMPLE_LAND, { ...T, join: { right: 99 } })));

// 2 — on: interior rect + frame + cartouche.
const on = composeLand(7, SAMPLE_LAND, { ...T, mural: true });
const m = on.mural!;
check('mural present', m !== undefined);
check('interior is 22x5', m.w === MURAL_INTERIOR_W && m.h === MURAL_INTERIOR_H);
check('flagship is hades (surface[0])', m.name === 'hades' && m.appid === 1145360);
check('horizontally centred', m.x === Math.floor((53 - 24) / 2) + 1);
check('sky row 2 (frame), interior row 3', m.y === 3);
const rowStr = (y: number) => on.char[y].join('');
check('top rail ╔═..═╗', rowStr(m.y - 1).slice(m.x - 1, m.x + 23) === '╔' + '═'.repeat(22) + '╗');
check('cartouche names the game', rowStr(m.y + 5).includes('╡ hades ╞'));
check('side rails ║', on.char[m.y][m.x - 1] === '║' && on.char[m.y][m.x + 22] === '║');
check('frame cells carry muralFrame role', on.role[m.y - 1][m.x - 1] === 'muralFrame');
check('interior blank + mural role',
  on.char[m.y][m.x] === ' ' && on.role[m.y][m.x] === 'mural');
let decorated = 0;
for (let y = m.y - 1; y <= m.y + 5; y++)
  for (let x = m.x - 1; x <= m.x + 22; x++) {
    const r = on.role[y][x];
    if (r === 'star' || r === 'starBright' || r === 'skyDither' || r === 'sun' || r === 'moon' || r === 'cloud') decorated++;
  }
check('no sky decoration inside the outer rect', decorated === 0);

// 3 — determinism + skips.
check('deterministic', JSON.stringify(on) === JSON.stringify(composeLand(7, SAMPLE_LAND, { ...T, mural: true })));
check('skips when cols < 32', composeLand(7, SAMPLE_LAND, { ...T, width: 30, mural: true }).mural === undefined);
check('skips when skyH < 9', composeLand(7, SAMPLE_LAND, { ...T, skyH: 8, mural: true }).mural === undefined);
const noAppid = [{ name: 'celeste', state: 'loved' as const }];
check('skips when flagship has no appid', composeLand(7, noAppid, { ...T, mural: true }).mural === undefined);
const longName = [{ name: 'a-very-long-game-name-here', state: 'loved' as const, appid: 999 }];
const lm = composeLand(7, longName, { ...T, mural: true }).mural!;
check('cartouche name truncated to 16', lm.name.length <= 16);

report();
