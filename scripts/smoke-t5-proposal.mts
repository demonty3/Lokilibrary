/**
 * T5 proposal smoke (pure half) — `npx tsx scripts/smoke-t5-proposal.mts`.
 *
 * Locks the renderer's whole pure surface: the topology line's proposal
 * clause (bar 1's byte-identity when off, bar 5's one-clause widening when
 * on), candidate extraction (bar 2's empty-mailbox), the banner's proposal
 * rows + bracket hit spans (bar 6's single affordance geometry), and the
 * composed dispatch text (bar 7's palace byte-identity).
 *
 * Spec: docs/superpowers/specs/2026-08-14-t5-orchestration-design.md
 */
import { makeChecker } from './lib/smoke.ts';
import { deskTopology, deskTopologyLine } from '../src/terminal/deskTopology.ts';
import {
  extractProposalCandidate,
  proposalDispatchRows,
  proposalHitSpans,
} from '../src/terminal/deskProposal.ts';
import {
  renderDispatch,
  renderDispatchProposal,
  type MorningDispatchLine,
} from '../src/render/overlays/morning-dispatch.ts';
import type { PlanStep } from '../src/agents/memory/schema.ts';

const { check, report } = makeChecker('smoke t5-proposal');

const ALL = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
const DESK = {
  terminalId: 't1',
  wing: 'd0',
  joins: [{ left: 't1', right: 't2' }],
  wings: { t1: 'd0', t2: 'd1' },
  allWings: ALL,
  roster: { cat: 't1', loki: 't2' },
  names: { cat: 'Cat', loki: 'Loki' },
};

// --- bar 1: the clause is OFF by default, byte-for-byte --------------------
{
  const topologies = [
    deskTopology(DESK),
    deskTopology({ ...DESK, joins: [], wings: { t1: 'd0' }, roster: {} }), // lone
    deskTopology({
      ...DESK,
      wings: { t1: 'd0', t2: 'd1', t3: 'd2', t4: 'd3', t5: 'd4', t6: 'd5' },
    }), // no closed wings
    deskTopology({ terminalId: 't1', wing: 'd0', joins: [], wings: {} }), // empty
  ];
  for (const [i, t] of topologies.entries()) {
    check(
      `topology ${i}: no opts === {proposals: false} === {} — byte-identical`,
      deskTopologyLine(t) === deskTopologyLine(t, {}) &&
        deskTopologyLine(t) === deskTopologyLine(t, { proposals: false }),
    );
  }
}

// --- bar 5: the clause widens exactly one sentence, closed wings only ------
{
  const t = deskTopology(DESK);
  const off = deskTopologyLine(t);
  const on = deskTopologyLine(t, { proposals: true });
  check('the clause is appended, never rewrites the base line', on.startsWith(off.slice(0, -1)), on);
  check('the clause names ONE proposal, not many', /ONE closed wing/.test(on), on);
  check('the clause routes through move_to (no new verb)', /as a move_to target/.test(on), on);
  check('the clause names the closed wings', /d2, d3, d4 and d5/.test(on), on);
  check('the clause says the morning will ask (surfaced, not silent)', /morning will ask/.test(on), on);

  // No closed wings → clause silently absent even when asked for.
  const full = deskTopology({
    ...DESK,
    wings: { t1: 'd0', t2: 'd1', t3: 'd2', t4: 'd3', t5: 'd4', t6: 'd5' },
  });
  check(
    'a desk with every wing open gets NO clause even opted in',
    deskTopologyLine(full, { proposals: true }) === deskTopologyLine(full),
  );
}

// --- bar 2: extraction accepts only a closed-wing move_to ------------------
{
  const t = deskTopology(DESK); // closed: d2..d5
  const step = (kind: PlanStep['kind'], target?: string): PlanStep =>
    ({ kind, ...(target !== undefined && { target }), status: 'pending' }) as PlanStep;

  check('closed-wing move_to → candidate',
    extractProposalCandidate([step('move_to', 'd3')], t)?.wing === 'd3');
  check('open-wing move_to → null (that is a walk, not a proposal)',
    extractProposalCandidate([step('move_to', 'd1')], t) === null);
  check('own wing → null',
    extractProposalCandidate([step('move_to', 'd0')], t) === null);
  check('closed-wing inspect → null (wrong verb)',
    extractProposalCandidate([step('inspect', 'd3')], t) === null);
  check('unknown target → null',
    extractProposalCandidate([step('move_to', 'the moon')], t) === null);
  check('no steps → null (empty-mailbox)',
    extractProposalCandidate([], t) === null);
  check('targetless move_to → null',
    extractProposalCandidate([step('move_to')], t) === null);
  check('the model\'s casing and whitespace are not trusted',
    extractProposalCandidate([step('move_to', '  D4 ')], t)?.wing === 'd4');
  check('the wing may be embedded as a word — live Sonnet writes "d3 terminal"',
    extractProposalCandidate([step('move_to', 'the d3 terminal')], t)?.wing === 'd3');
  check('an embedded OPEN wing still yields nothing',
    extractProposalCandidate([step('move_to', 'the d1 terminal')], t) === null);
  check('a wing id inside another word never matches (no d2 in "wind25")',
    extractProposalCandidate([step('move_to', 'wind25')], t) === null);
  check('first closed-wing hit wins among several steps',
    extractProposalCandidate(
      [step('inspect'), step('move_to', 'd1'), step('move_to', 'd5'), step('move_to', 'd2')],
      t,
    )?.wing === 'd5');
}

// --- bar 6: rows + hit spans share one geometry ----------------------------
{
  const rows = proposalDispatchRows('d3');
  check('two quiet rows, not a dialog', rows.length === 2, JSON.stringify(rows));
  check('the question names the wing', rows[0].includes('d3'), rows[0]);
  check('both brackets on the tap row',
    rows[1].includes('[ open it ]') && rows[1].includes('[ let it pass ]'), rows[1]);

  const spans = proposalHitSpans('d3');
  check('both spans on the last row', spans.apply.row === 1 && spans.dismiss.row === 1);
  check('apply span slices exactly its bracket',
    rows[1].slice(spans.apply.c0, spans.apply.c1) === '[ open it ]');
  check('dismiss span slices exactly its bracket',
    rows[1].slice(spans.dismiss.c0, spans.dismiss.c1) === '[ let it pass ]');
  check('the spans never overlap',
    spans.apply.c1 <= spans.dismiss.c0 || spans.dismiss.c1 <= spans.apply.c0);
}

// --- bar 7: the composed dispatch, palace byte-identity --------------------
{
  const lines: MorningDispatchLine[] = [
    { agentName: 'Loki', text: 'the shelf by the door kept its lamp lit', hadPlan: true },
    { agentName: 'Cat', text: 'someone crossed twice before midnight', hadPlan: false },
  ];
  check('no proposal rows → renderDispatchProposal IS renderDispatch',
    renderDispatchProposal(lines, [], 60, 20).text === renderDispatch(lines, 60, 20) &&
      renderDispatchProposal(lines, [], 60, 20).proposalRow0 === null);
  check('…including with no bounds at all',
    renderDispatchProposal(lines, []).text === renderDispatch(lines));

  const rows = proposalDispatchRows('d3');
  const r = renderDispatchProposal(lines, rows, 60, 20);
  const out = r.text.split('\n');
  check('proposal rows land where proposalRow0 says', r.proposalRow0 !== null &&
    out[r.proposalRow0!] === rows[0] && out[r.proposalRow0! + 1] === rows[1],
    JSON.stringify({ row0: r.proposalRow0, out }));
  check('a blank row of air separates dispatch from proposal',
    r.proposalRow0 !== null && out[r.proposalRow0! - 1] === '');
  check('the foot rule closes the panel below the proposal',
    out[out.length - 1].startsWith('─') && out.indexOf(rows[1]) < out.length - 1);
  check('the rules enclose every row (nothing pokes past the frame)',
    out.every((row) => row.length <= out[0].length), JSON.stringify(out));

  // The row budget spends on the proposal FIRST: even a tiny window keeps it.
  const tiny = renderDispatchProposal(lines, rows, 60, 7);
  const tinyRows = tiny.text.split('\n');
  check('a tiny window still shows both proposal rows',
    tinyRows.includes(rows[0]) && tinyRows.includes(rows[1]), tiny.text);

  // A night with no narrated reflections still panels the proposal.
  const bare = renderDispatchProposal([], rows, 60, 20);
  const bareRows = bare.text.split('\n');
  check('an empty dispatch still mounts the proposal inside the panel',
    bareRows.includes(rows[0]) && bareRows[0].includes('overnight') &&
      bareRows[bareRows.length - 1].startsWith('─'),
    bare.text);
}

report();
