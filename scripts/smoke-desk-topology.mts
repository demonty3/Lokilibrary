/**
 * Desk-topology smoke (T4) — `npx tsx scripts/smoke-desk-topology.mts`.
 *
 * The topology line is the whole of T4's context half: it is what a Tier-2
 * reflection reads to learn the desk's shape. Two things must hold or the
 * feature is worse than useless — it must describe the REAL desk (bar 1), and
 * "who is where" must be the live roster rather than the homes map (bar 2) —
 * and one thing must never happen: it must never offer the model a wing that
 * has no window open (bar 5's widening clause).
 *
 * Spec: docs/superpowers/specs/2026-08-09-t4-topology-reflection-design.md
 */
import { makeChecker } from './lib/smoke.ts';
import {
  deskTopology,
  deskTopologyLine,
  reachableWings,
} from '../src/terminal/deskTopology.ts';
import { buildReflectPrompt } from '../worker/lib/agent-prompt.ts';

const { check, report } = makeChecker('smoke desk-topology');

const NAMES = { loki: 'Loki', archivist: 'Archivist', cat: 'Cat', visitor: 'Visitor' };
const ALL = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];

// The desk the project actually boots: t1→d0 joined to t2→d1.
const DESK = {
  terminalId: 't1',
  wing: 'd0',
  joins: [{ left: 't1', right: 't2' }],
  wings: { t1: 'd0', t2: 'd1' },
  allWings: ALL,
  roster: { cat: 't1', loki: 't1', archivist: 't2', visitor: 't2' },
  names: NAMES,
};

// --- bar 1: it names the REAL desk ----------------------------------------
const t = deskTopology(DESK);
check('this wing is named as here', t.here === 'd0');
check('the neighbour is on the RIGHT, because t1 is the join’s left',
  t.joined.right === 'd1' && t.joined.left === undefined, JSON.stringify(t.joined));
check('open wings are exactly the ones with a window', t.open.join() === 'd0,d1', t.open.join());
check('closed wings are exactly the rest', t.closed.join() === 'd2,d3,d4,d5', t.closed.join());
check('open and closed never overlap', !t.open.some((w) => t.closed.includes(w)));

// Mirror it: the SAME desk seen from t2 must put the neighbour on the left.
const mirror = deskTopology({ ...DESK, terminalId: 't2', wing: 'd1' });
check('seen from the other window the neighbour is on the LEFT',
  mirror.joined.left === 'd0' && mirror.joined.right === undefined, JSON.stringify(mirror.joined));
check('…and both windows agree on which wings are open',
  mirror.open.join() === t.open.join());

// A join naming a terminal that has since closed must not invent a wing.
const stale = deskTopology({ ...DESK, joins: [{ left: 't1', right: 'tGONE' }] });
check('a join to a closed terminal yields no neighbour, not a phantom one',
  stale.joined.right === undefined, JSON.stringify(stale.joined));

// --- bar 2: occupancy is the live roster, not homes -----------------------
check('occupancy places beings by their CURRENT terminal',
  JSON.stringify(t.occupancy) ===
    JSON.stringify([
      { wing: 'd0', who: ['Cat', 'Loki'] },
      { wing: 'd1', who: ['Archivist', 'Visitor'] },
    ]),
  JSON.stringify(t.occupancy));
// The discriminator: move one being and the line must move with it. If the
// summary were reading homes, this would not change.
const crossed = deskTopology({ ...DESK, roster: { ...DESK.roster, cat: 't2' } });
check('after a crossing the crosser appears in the DESTINATION wing',
  crossed.occupancy.find((o) => o.wing === 'd1')?.who.includes('Cat') === true,
  JSON.stringify(crossed.occupancy));
check('…and no longer in the origin',
  crossed.occupancy.find((o) => o.wing === 'd0')?.who.includes('Cat') === false,
  JSON.stringify(crossed.occupancy));
check('a being in a terminal that has closed is dropped, not placed nowhere',
  deskTopology({ ...DESK, roster: { ghost: 'tGONE' } }).occupancy.length === 0);
check('agent ids without a display name fall back to the id, never to blank',
  deskTopology({ ...DESK, roster: { mystery: 't1' }, names: {} })
    .occupancy[0].who.join() === 'mystery');

// --- bar 5: only OPEN wings may ever be offered as a target ---------------
const reach = reachableWings(t);
check('reachable = the joined neighbours only', reach.join() === 'd1', reach.join());
check('an unjoined-but-open wing is NOT reachable — a being can only walk to a land it shares an edge with',
  !reachableWings(deskTopology({ ...DESK, joins: [], wings: { t1: 'd0', t2: 'd1' } })).includes('d1'));
const line = deskTopologyLine(t);
for (const closedWing of t.closed) {
  check(`the line never offers ${closedWing} as a move_to target`,
    !new RegExp(`walk to[^.]*${closedWing}`).test(line), line);
}
check('the line offers the neighbour as a move_to target', /move_to target/.test(line), line);
check('the line names no wing that has no window',
  !ALL.filter((w) => !t.open.includes(w)).some((w) => new RegExp(`walk to[^.]*${w}`).test(line)));

// --- the line itself ------------------------------------------------------
check('the line mentions this wing', line.includes('d0'), line);
check('the line mentions the neighbour and the side', /d1 joins you on the right/.test(line), line);
check('the line says the ground runs unbroken (the join is the point)',
  line.includes('unbroken'), line);
check('the line reports the closed wings', line.includes('d2, d3, d4 and d5'), line);
check('the line reports who is where', /Cat and Loki are in d0/.test(line), line);
check('the line is one paragraph, not a list', !line.includes('\n'), line);
check('the line stays prompt-sized', line.length < 600, `${line.length} chars`);

// An unjoined lone terminal still describes itself honestly.
const lone = deskTopology({ ...DESK, joins: [], wings: { t1: 'd0' }, roster: { cat: 't1' } });
const loneLine = deskTopologyLine(lone);
check('a lone terminal says it is the only one open', /only one open/.test(loneLine), loneLine);
check('…and that its edges are walls', /edges are walls/.test(loneLine), loneLine);
check('…and offers NO move_to target', !/move_to target/.test(loneLine), loneLine);
check('an empty desk yields an empty line (no broker → today’s prompt)',
  deskTopologyLine(deskTopology({ terminalId: 't1', wing: 'd0', joins: [], wings: {} })) === '');

// --- bar 3: a topology-less caller is byte-identical -----------------------
const base = {
  agent: { id: 'loki', name: 'Loki' },
  recentMemories: [
    { id: 'm1', text: 'crossed from the d0 terminal into d1', kind: 'observation', importance: 5, created_at: 1_000 },
  ],
  nowMs: 60_000,
};
const without = buildReflectPrompt(base);
const withTopo = buildReflectPrompt({ ...base, topology: line });
check('omitting topology reproduces the pre-T4 prompt exactly',
  without.user === buildReflectPrompt({ ...base, topology: undefined }).user &&
    without.system === withTopo.system,
  'system must not move either');
check('…and the topology line does reach the user block',
  withTopo.user.endsWith(line) && withTopo.user.length > without.user.length, line);
check('the plan VERB whitelist is untouched by the widening',
  ['move_to', 'inspect', 'place_mark', 'linger', 'withdraw'].every((v) =>
    withTopo.system.includes(v)) &&
    !/\b(cross_seam|walk_to_terminal|open_terminal)\b/.test(withTopo.system + withTopo.user));

report();
