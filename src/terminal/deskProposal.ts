/**
 * T5 — orchestration v0, the renderer's pure half
 * (docs/superpowers/specs/2026-08-14-t5-orchestration-design.md).
 * Pure, PIXI-free, IPC-free — the deskTopology.ts posture, so
 * scripts/smoke-t5-proposal.mts drives it headlessly.
 *
 * The proposal RIDES the T4 sleep pass: no orchestrator call exists. An
 * opted-in desk's sleeping reflections see one extra clause on the topology
 * line (deskTopologyLine's `proposals` option); this module extracts the
 * candidate from the resulting plan — the first `move_to` step whose target
 * is a CLOSED wing — and owns the banner's proposal rows plus their bracket
 * hit spans, so the pointer hit-test and the drawn glyphs can never drift
 * apart (one source of truth, smoke-locked).
 *
 * Empty-mailbox principle: no closed-wing target in any plan → null →
 * nothing surfaces. The machinery never invents a proposal to have
 * something to show.
 */

import type { PlanStep } from '../agents/memory/schema';
import type { DeskTopology } from './deskTopology';

/** The one proposal kind v0 knows: open a terminal onto a closed wing. */
export interface ProposalCandidate {
  wing: string;
}

/**
 * First `move_to` step naming a closed wing → the candidate. The wing must
 * appear as its own word in the target: live Sonnet plans write targets
 * like "d0 terminal" rather than a bare "d0" (observed 2026-08-14, first
 * live sweep), so an exact match would miss every real proposal — but a
 * word-boundary match still only ever surfaces a wing the plan actually
 * named. Lower-cased first (the model's casing is not trusted). Anything
 * else — open wings, other verbs, no plan — is null.
 */
export function extractProposalCandidate(
  steps: readonly PlanStep[],
  t: Pick<DeskTopology, 'closed'>,
): ProposalCandidate | null {
  for (const s of steps) {
    if (s.kind !== 'move_to' || typeof s.target !== 'string') continue;
    const target = s.target.toLowerCase();
    const wing = t.closed.find((w) => new RegExp(`\\b${w}\\b`).test(target));
    if (wing) return { wing };
  }
  return null;
}

/**
 * The banner's proposal block, as rows of glyphs. Appended by the desk's
 * mount site below the dispatch body; the palace never sees these. Kept to
 * two quiet rows — the taste bar is "a small, shy question", not a dialog.
 */
export function proposalDispatchRows(wing: string): string[] {
  return [`the night asks: a terminal onto ${wing}?`, `  ${APPLY_LABEL}   ${DISMISS_LABEL}`];
}

const APPLY_LABEL = '[ open it ]';
const DISMISS_LABEL = '[ let it pass ]';

export interface ProposalHitSpan {
  /** Row within the proposal block (0-based, block-relative). */
  row: number;
  /** Column span [c0, c1) in glyph cells. */
  c0: number;
  c1: number;
}

/**
 * Bracket tap targets, derived FROM the rendered rows so geometry and glyphs
 * cannot drift. Both live on the block's second row.
 */
export function proposalHitSpans(wing: string): { apply: ProposalHitSpan; dismiss: ProposalHitSpan } {
  const rows = proposalDispatchRows(wing);
  const row = rows.length - 1;
  const line = rows[row];
  const a0 = line.indexOf(APPLY_LABEL);
  const d0 = line.indexOf(DISMISS_LABEL);
  return {
    apply: { row, c0: a0, c1: a0 + APPLY_LABEL.length },
    dismiss: { row, c0: d0, c1: d0 + DISMISS_LABEL.length },
  };
}
