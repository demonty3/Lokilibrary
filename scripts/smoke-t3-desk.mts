/**
 * Desk-persistence smoke — `npx tsx scripts/smoke-t3-desk.mts`.
 * Locks the terminals field of desktop/src/config.ts:
 *   - fresh config → undefined; set/get round-trip
 *   - setMode PRESERVES terminals (readConfig's read-modify-write used to
 *     strip unknown fields — the regression this exists to catch)
 *   - malformed entries filtered on read; clear/empty → undefined
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

const { check, report } = makeChecker('smoke t3-desk');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-desk-'));
mockElectronModule({ app: { getPath: () => tmpDir } });
const { getTerminals, setTerminals, setMode, getMode } = await import('../desktop/src/config.ts');

check('fresh config → undefined', getTerminals() === undefined);

const desk = [
  { id: 't1', wing: 'd0', x: 20, y: 160, width: 640, height: 520 },
  { id: 't2', wing: 'd1', x: 660, y: 160, width: 640, height: 520 },
];
setTerminals(desk);
check('round-trip', JSON.stringify(getTerminals()) === JSON.stringify(desk));

setMode('wallpaper'); // read-modify-write on an unrelated field
check('setMode preserves terminals', JSON.stringify(getTerminals()) === JSON.stringify(desk));
check('setMode still works', getMode() === 'wallpaper');

// malformed entries are dropped on read, valid ones kept
fs.writeFileSync(
  path.join(tmpDir, 'config.json'),
  JSON.stringify({
    mode: 'window',
    terminals: [desk[0], { id: 42, wing: 'd1' }, 'junk', { ...desk[1], x: 'NaN' }],
  }),
);
check('malformed entries filtered', JSON.stringify(getTerminals()) === JSON.stringify([desk[0]]));

setTerminals(undefined);
check('clear → undefined', getTerminals() === undefined);
setTerminals([]);
check('empty array → undefined', getTerminals() === undefined);

report();
