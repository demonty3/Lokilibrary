/** Cloud-drift smoke — `npx tsx scripts/smoke-cloud-drift.mts`.
 *  #19 slice 2: the terminal renderer hides the baked cloud layer and
 *  re-renders the same wisps drifting on the wall clock. This smokes the
 *  pure maths (src/terminal/clouds.ts); the Pixi wiring is e2e-verified. */
import { makeChecker } from './lib/smoke.ts';
import { composeLand, SAMPLE_LAND } from '../src/procedural/land.ts';
import { extractWisps, wispAlpha, wispX } from '../src/terminal/clouds.ts';
const { check, report } = makeChecker('smoke cloud-drift');

const T = { width: 120, skyH: 11, surfaceBand: 4, underH: 8, withPlayer: false } as const;
const m = composeLand(7, SAMPLE_LAND, T);
const wisps = extractWisps(m, 7);

check('two wisps extracted (composer bakes two)', wisps.length === 2, String(wisps.length));
check('wisp text is the baked glyph run', wisps.every((w) => /^[~ ]+$/.test(w.text) && w.text.length >= 3));
check('speeds within the wallpaper band', wisps.every((w) => w.speed >= 0.04 && w.speed <= 0.11),
  JSON.stringify(wisps.map((w) => w.speed)));
check('deterministic', JSON.stringify(wisps) === JSON.stringify(extractWisps(m, 7)));
check('seed varies phase', JSON.stringify(extractWisps(m, 8).map((w) => w.phase))
  !== JSON.stringify(wisps.map((w) => w.phase)));

const w0 = wisps[0];
// Drift: over one second, x advances by exactly speed (mod the wrap span).
const a = wispX(w0, 1000, m.width);
const b = wispX(w0, 1001, m.width);
const span = m.width + w0.text.length;
const step = ((b - a) % span + span) % span;
check('x advances by speed per second', Math.abs(step - w0.speed) < 1e-9, String(step));
// Wrap: x always inside [-len, width).
let wrapped = true;
for (let t = 0; t < 20000; t += 37) {
  const x = wispX(w0, t, m.width);
  if (x < -w0.text.length || x >= m.width) wrapped = false;
}
check('x stays in the wrap window', wrapped);

// Alpha: synthetic wisp with one blocked span.
const s = { row: 3, text: '~~~', speed: 0.05, phase: 0, blocked: [[50, 60]] } as const;
check('alpha 0 inside the span', wispAlpha(s, 52) === 0);
check('alpha 0 when overlapping the edge', wispAlpha(s, 48) === 0); // 48..51 overlaps 50
check('alpha 1 far away', wispAlpha(s, 10) === 1);
check('alpha ramps in the 2-cell skirt', wispAlpha(s, 46) > 0 && wispAlpha(s, 46) < 1,
  String(wispAlpha(s, 46)));

report();
