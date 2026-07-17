/**
 * T2 society migration smoke — `npx tsx scripts/smoke-t2-society.mts`.
 * Pure renderer-side society helpers: resident resolution (with the
 * no-broker web fallback), mind carry/reconstruct round-trip (the
 * migrateRuntime-over-IPC contract), and the Tier-1 scene label.
 */
import { makeChecker } from './lib/smoke.ts';
import {
  SOCIETY_IDS,
  residentsOf,
  carriedFromMind,
  reconstructMind,
  sceneLabelFor,
} from '../src/terminal/society';
import { initialRuntime } from '../src/state/agentRuntime';
import { COHORT } from '../src/agents/cohort';

const { check, report } = makeChecker('smoke t2-society');

// Residents
check('SOCIETY_IDS mirrors COHORT order',
  JSON.stringify(SOCIETY_IDS) === JSON.stringify(COHORT.map((d) => d.id)));
const society = { loki: 'd0', archivist: 'd1', cat: 'd0', visitor: 'd1', ghost: 'd0' };
check('residents of d0', JSON.stringify(residentsOf(society, 'd0')) === JSON.stringify(['loki', 'cat', 'ghost']));
check('residents of d1', JSON.stringify(residentsOf(society, 'd1')) === JSON.stringify(['archivist', 'visitor']));
check('residents of an unassigned wing is empty', residentsOf(society, 'd5').length === 0);
check('null society (web preview, no broker) → the lone land hosts everyone',
  JSON.stringify(residentsOf(null, 'd0')) === JSON.stringify([...SOCIETY_IDS]));

// Mind carry/reconstruct — the exactly-once IPC handoff contract.
const mind = initialRuntime({ id: 'loki', x: 3, y: 12 });
mind.lastTier1At = 1700000000000;
mind.reflectionCounter = 42;
mind.perceptionQueue.push({ kind: 'terminal_arrival', subject: 'd0', at: { x: 3, y: 12 }, when: 1700000000000 });
const carried = carriedFromMind(mind);
check('carried is plain JSON', JSON.stringify(carried).length > 0);
check('carried queue is a COPY', carried.perceptionQueue !== mind.perceptionQueue);
const rebuilt = reconstructMind('loki', 79, 11, JSON.parse(JSON.stringify(carried)));
check('rebuilt id/pos', rebuilt.id === 'loki' && rebuilt.x === 79 && rebuilt.y === 11);
check('rebuilt lastTier1At carried', rebuilt.lastTier1At === 1700000000000);
check('rebuilt reflectionCounter carried', rebuilt.reflectionCounter === 42);
check('rebuilt queue carried (throttled arrival survives the seam)',
  rebuilt.perceptionQueue.length === 1 && rebuilt.perceptionQueue[0].kind === 'terminal_arrival');
check('rebuilt is otherwise fresh', rebuilt.intent === '' && rebuilt.present === true && rebuilt.activePlan === null);
const fresh = reconstructMind('cat', 5, 12);
check('no carried → pure initialRuntime', fresh.lastTier1At === 0 && fresh.perceptionQueue.length === 0);

// Scene label — must name the wing, the width, and structure columns so
// the LLM can emit a parseable `approach x,y`.
const label = sceneLabelFor('d1', 96, [34, 60]);
check('scene names the wing', label.includes('d1'));
check('scene names the width', label.includes('96'));
check('scene names structure columns', label.includes('34') && label.includes('60'));
check('scene tells the model y is 0', label.includes('y') && label.includes('0'));
check('structure-free land still labels', sceneLabelFor('d0', 80, []).includes('d0'));

report();
