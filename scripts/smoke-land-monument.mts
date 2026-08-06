/** Monument smoke — `npx tsx scripts/smoke-land-monument.mts`.
 *  Land polish #19 slice 2: the mastered-game monument is real architecture
 *  (cap course, window slits, block body) with a ground-level door and a
 *  crown that owns its own role — a sun-omit no longer blanks it. */
import { makeChecker } from './lib/smoke.ts';
import {
  composeLand, MONUMENT_BODY, MONUMENT_CROWN, MONUMENT_DOOR, type LandGame,
} from '../src/procedural/land.ts';
const { check, report } = makeChecker('smoke land-monument');

const GAMES: LandGame[] = [
  { name: 'hades', state: 'mastered' },
  { name: 'celeste', state: 'loved' },
  { name: 'stardew', state: 'recent' },
];
const T = { width: 80, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;

for (const seed of [7, 41, 113]) {
  const m = composeLand(seed, GAMES, T);
  const cells = (role: string) => {
    const out: Array<{ x: number; y: number; c: string }> = [];
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++)
        if (m.role[y][x] === role) out.push({ x, y, c: m.char[y][x] });
    return out;
  };

  const doors = cells('door');
  check(`seed ${seed}: exactly one door`, doors.length === 1, String(doors.length));
  check(`seed ${seed}: door glyph`, doors.every((d) => d.c === MONUMENT_DOOR));
  const door = doors[0];
  check(`seed ${seed}: door at surface-1`, door.y === m.surface[door.x] - 1,
    `door y ${door.y} surface ${m.surface[door.x]}`);

  const crowns = cells('monumentCrown');
  check(`seed ${seed}: exactly one crown`, crowns.length === 1, String(crowns.length));
  check(`seed ${seed}: crown glyph`, crowns.every((k) => k.c === MONUMENT_CROWN));
  check(`seed ${seed}: crown tops the body`, crowns[0].y === door.y - MONUMENT_BODY.length,
    `crown y ${crowns[0].y} door y ${door.y}`);
  check(`seed ${seed}: crown shares the door column`, crowns[0].x === door.x);

  // Decoupling: no 'sun'-role cell inside the monument's own rect (the sky
  // sun may legitimately share the column high above — constrain by row).
  const suns = cells('sun').filter(
    (s) => Math.abs(s.x - door.x) <= 1 && s.y >= crowns[0].y && s.y <= door.y,
  );
  check(`seed ${seed}: no sun-role cell on the monument`, suns.length === 0);

  // Body vocabulary: every monument-role glyph comes from MONUMENT_BODY rows.
  const vocab = new Set(MONUMENT_BODY.join('').split(''));
  check(`seed ${seed}: body glyphs from the exported rows`,
    cells('monument').every((b) => vocab.has(b.c)));

  // Determinism.
  check(`seed ${seed}: deterministic`,
    JSON.stringify(m) === JSON.stringify(composeLand(seed, GAMES, T)));
}

report();
