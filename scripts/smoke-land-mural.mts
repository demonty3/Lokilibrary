/** Mural compose smoke — `npx tsx scripts/smoke-land-mural.mts`. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND, MURAL_INTERIOR_W, MURAL_INTERIOR_H } from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-mural');

const T = { width: 53, skyH: 11, surfaceBand: 4, underH: 4, withPlayer: false } as const;

// 1 — off by default: no mural field, no mural roles anywhere (byte-identity guard).
const off = composeLand(7, SAMPLE_LAND, T);
check('no mural field without opts.mural', off.mural === undefined);
check('no mural roles without opts.mural',
  !off.role.some((row) => row.some((r) => r === 'mural' || r === 'muralFrame')));

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
