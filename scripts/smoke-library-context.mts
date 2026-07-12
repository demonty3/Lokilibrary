/**
 * Library-context smoke — `npx tsx scripts/smoke-library-context.mts`.
 * Locks: deterministic pole selection (playtime desc, appid asc tie-break),
 * state counts, null on empty, ~40-token cap, no Date/random dependence.
 */
import { makeChecker } from './lib/smoke.ts';
import type { LibraryGame } from '../src/types.ts';

const { buildLibraryContext } = await import('../src/agents/library-context.ts');
const { check, report } = makeChecker('smoke library-context');

const g = (appid: number, name: string, mins: number, state?: LibraryGame['state']): LibraryGame => ({
  appid,
  name,
  playtime_forever: mins,
  ...(state && { state }),
});

const games: LibraryGame[] = [
  g(1145360, 'Hades', 91 * 60, 'loved'),
  g(1245620, 'Elden Ring', 140 * 60, 'loved'),
  g(1158310, 'Crusader Kings III', 210 * 60, 'dusty'),
  g(504230, 'Celeste', 12 * 60, 'abandoned'),
  g(753640, 'Outer Wilds', 30 * 60, 'mastered'),
  g(105600, 'Terraria', 5 * 60), // untagged — counts toward total only
];

const line = buildLibraryContext(games);
check('non-null for a real library', line !== null);
const text = line ?? '';
check('total count present', text.includes('6 games'));
check('state counts present', text.includes('2 loved') && text.includes('1 dusty') && text.includes('1 abandoned') && text.includes('1 mastered'));
check('bright pole = highest-playtime loved/mastered', text.includes('Elden Ring (loved, 140h)'));
check('dim pole = highest-playtime dusty/abandoned', text.includes('Crusader Kings III (dusty, 210h)'));
check('untagged game not named', !text.includes('Terraria'));
check('capped length', text.length <= 260);

check('empty → null', buildLibraryContext([]) === null);
check('null → null', buildLibraryContext(null) === null);

// determinism: same input → identical string; appid tie-break
const tie: LibraryGame[] = [g(20, 'B Game', 600, 'loved'), g(10, 'A Game', 600, 'loved')];
const t1 = buildLibraryContext(tie) ?? '';
check('tie-break by appid asc', t1.indexOf('A Game') !== -1 && t1.indexOf('A Game') < t1.indexOf('B Game'));
check('deterministic', buildLibraryContext(games) === line);

report();
