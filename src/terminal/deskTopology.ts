/**
 * T4 — the desk's shape, as one line a Tier-2 reflection can read
 * (docs/superpowers/specs/2026-08-09-t4-topology-reflection-design.md).
 * Pure, PIXI-free, IPC-free — the edgePart.ts / masthead.ts posture, so
 * scripts/smoke-desk-topology.mts drives it headlessly.
 *
 * A window already receives {joins, wings, allWings} on `terminal:topology`,
 * which is enough to say which terminals exist, which are joined and on which
 * side. Who is WHERE comes from the broker's roster, pulled at dispatch time
 * rather than pushed — the topology broadcast is change-gated to stay bounded
 * and the roster moves on every crossing.
 *
 * The line widens exactly one vocabulary: a wing id becomes a legal `move_to`
 * target, so a plan can name the terminal next door using the existing verb
 * whitelist. Only wings that actually have a window open are ever named —
 * CLAUDE.md's rule is that whitelists widen deliberately, so the set of legal
 * targets is derived from the live desk, never from the model's imagination.
 */

export interface DeskJoin {
  left: string;
  right: string;
}

export interface DeskTopologyInput {
  /** This window's terminal id and the wing it shows. */
  terminalId: string;
  wing: string;
  joins: readonly DeskJoin[];
  /** terminalId → wing, for every terminal with a window open. */
  wings: Readonly<Record<string, string>>;
  /** Every wing the profile knows about, open or not. */
  allWings?: readonly string[];
  /** agentId → terminalId, the broker's live roster. */
  roster?: Readonly<Record<string, string>>;
  /** agentId → display name, for the "who is where" clause. */
  names?: Readonly<Record<string, string>>;
}

export interface DeskTopology {
  /** The wing this window shows. */
  here: string;
  /** Neighbour WINGS across an open edge, by side. */
  joined: { left?: string; right?: string };
  /** Every wing with a window open, sorted — `here` included. */
  open: string[];
  /** Known wings with no window open, sorted. */
  closed: string[];
  /** Live occupancy, wing → agent display names, sorted by wing. */
  occupancy: Array<{ wing: string; who: string[] }>;
}

/** Resolve the raw broker payload into the desk as this window sees it. */
export function deskTopology(input: DeskTopologyInput): DeskTopology {
  const { terminalId, wing, joins, wings } = input;
  const leftNb = joins.find((j) => j.right === terminalId)?.left;
  const rightNb = joins.find((j) => j.left === terminalId)?.right;
  const joined: { left?: string; right?: string } = {};
  if (leftNb && wings[leftNb]) joined.left = wings[leftNb];
  if (rightNb && wings[rightNb]) joined.right = wings[rightNb];

  const open = [...new Set(Object.values(wings))].sort();
  const openSet = new Set(open);
  const closed = [...(input.allWings ?? [])].filter((w) => !openSet.has(w)).sort();

  // Occupancy is keyed by WING, not terminal: a reflection speaks about places,
  // and a wing is the place. Agents whose terminal has since closed are
  // dropped rather than placed in a wing with no window.
  const byWing = new Map<string, string[]>();
  for (const [agentId, tid] of Object.entries(input.roster ?? {})) {
    const w = wings[tid];
    if (!w) continue;
    const who = byWing.get(w) ?? [];
    who.push(input.names?.[agentId] ?? agentId);
    byWing.set(w, who);
  }
  const occupancy = [...byWing.entries()]
    .map(([w, who]) => ({ wing: w, who: who.sort() }))
    .sort((a, b) => a.wing.localeCompare(b.wing));

  return { here: wing, joined, open, closed, occupancy };
}

/** Wings a plan may legally name as a `move_to` target: the neighbours this
 *  window is actually joined to. Deliberately NOT every open wing — a being
 *  can only walk to a land it shares an edge with. */
export function reachableWings(t: DeskTopology): string[] {
  return [t.joined.left, t.joined.right].filter((w): w is string => typeof w === 'string');
}

function list(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The desk, as one line for the reflect prompt's user block. Empty string when
 * this window stands alone with nothing to say about a desk — a lone terminal
 * gets today's prompt, unchanged.
 *
 * T5: `{proposals: true}` (opted-in desks, sleep pass only) appends ONE
 * clause naming the CLOSED wings as legal proposal targets — the deliberate
 * Depth-3 whitelist widening. Default off; a caller passing nothing gets a
 * byte-identical line to T4's (smoke-t5-proposal asserts string equality).
 */
export function deskTopologyLine(t: DeskTopology, opts: { proposals?: boolean } = {}): string {
  const parts: string[] = [];

  const others = t.open.filter((w) => w !== t.here);
  if (others.length === 0 && t.closed.length === 0 && t.occupancy.length === 0) return '';

  parts.push(
    others.length === 0
      ? `the desk: your terminal onto ${t.here} is the only one open`
      : `the desk: ${t.open.length} terminals are open — ${list(t.open)}; yours shows ${t.here}`,
  );

  const sides: string[] = [];
  if (t.joined.left) sides.push(`${t.joined.left} joins you on the left`);
  if (t.joined.right) sides.push(`${t.joined.right} joins you on the right`);
  parts.push(
    sides.length > 0
      ? `${list(sides)}, so the ground runs unbroken between you`
      : 'no terminal is joined to yours; your edges are walls',
  );

  if (t.closed.length > 0) {
    parts.push(`${list(t.closed)} ${t.closed.length === 1 ? 'has' : 'have'} no terminal open`);
  }

  if (t.occupancy.length > 0) {
    parts.push(
      `right now, ${list(t.occupancy.map((o) => `${list(o.who)} ${o.who.length === 1 ? 'is' : 'are'} in ${o.wing}`))}`,
    );
  }

  const reachable = reachableWings(t);
  if (reachable.length > 0) {
    parts.push(
      `you can walk to ${list(reachable)} through an open edge — name one as a move_to target to plan a crossing`,
    );
  }

  if (opts.proposals && t.closed.length > 0) {
    parts.push(
      `if the desk should grow, you may propose opening ONE closed wing — name ${
        t.closed.length === 1 ? t.closed[0] : `one of ${list(t.closed)}`
      } as a move_to target and the morning will ask whether to open it`,
    );
  }

  return `${parts.join('. ')}.`;
}
