/**
 * Tier-1 "living society" — the pure intent engine for terminal-land
 * beings (docs/PRD-snapping-terminals.md §T2, adapted to the T0 land).
 *
 * Score-based pick mirroring src/agents/behavior.ts's utility-AI shape,
 * but land-local and 1-D: each re-pick builds a candidate list, jitters
 * scores with the injected rand, and takes the max (ties break by
 * insertion order — earlier = preferred, the behavior.ts discipline).
 * NO PIXI, NO IPC, NO wall clock: a pure function of (rand, ctx), so the
 * smoke drives it headlessly and the renderer's makeRng stream keeps the
 * runtime deterministic-enough per terminal (the T0 walker contract).
 *
 * Scoring ladder — base + jitter [0, 0.3):
 *   watch_edge  0.5  (+0.25 DECISIVE pull when the neighbour summary
 *               shows beings near the far side: pulled min 0.75 ≥ every
 *               other candidate's sup, so society gravity always wins)
 *   approach    0.45 (labelled structure columns only)  → sup 0.75
 *   wander      0.4  (baseline, always available)       → sup 0.7
 *   rest        0.2  (always available)                 → sup 0.5
 * The un-pulled ranges overlap deliberately so wander/approach still win
 * sometimes at an open edge; rest [0.2, 0.5) is strictly dominated while
 * an edge is open — also deliberate (the join is exciting) — and occurs
 * in the common no-join case.
 */

import type { LandRole } from '../procedural/land';
import type { ThemeRole } from '../themes/types';

export type BeingIntent =
  | { kind: 'wander'; dir: 1 | -1 }
  | { kind: 'rest' }
  | { kind: 'approach'; targetX: number }
  | { kind: 'watch_edge'; side: 'left' | 'right' };

export type BeingIntentKind = BeingIntent['kind'];

export interface IntentContext {
  /** Land width in cells. */
  readonly width: number;
  /** The being's current column (float). */
  readonly x: number;
  /** Centre columns of labelled structures (structureColumns()). */
  readonly structureCols: readonly number[];
  /** Which edges are OPEN (joined to a neighbour terminal). */
  readonly edges: { readonly left: boolean; readonly right: boolean };
  /** How many beings the joined neighbour reported near each shared
   *  edge (0 when closed / empty). Counts are enough — the pull is
   *  about "something is over there", not positions. */
  readonly neighbourNear: { readonly left: number; readonly right: number };
}

interface Scored {
  score: number;
  intent: BeingIntent;
}

/** One BT pick. Pure: same rand draws + ctx → same intent. */
export function pickIntent(rand: () => number, ctx: IntentContext): BeingIntent {
  const candidates: Scored[] = [];
  candidates.push({
    score: 0.4 + rand() * 0.3,
    intent: { kind: 'wander', dir: rand() < 0.5 ? 1 : -1 },
  });
  candidates.push({ score: 0.2 + rand() * 0.3, intent: { kind: 'rest' } });
  if (ctx.structureCols.length > 0) {
    const idx = Math.min(ctx.structureCols.length - 1, Math.floor(rand() * ctx.structureCols.length));
    candidates.push({
      score: 0.45 + rand() * 0.3,
      intent: { kind: 'approach', targetX: ctx.structureCols[idx] },
    });
  }
  for (const side of ['left', 'right'] as const) {
    if (!ctx.edges[side]) continue;
    const pull = ctx.neighbourNear[side] > 0 ? 0.25 : 0;
    candidates.push({
      score: 0.5 + pull + rand() * 0.3,
      intent: { kind: 'watch_edge', side },
    });
  }
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].score > best.score) best = candidates[i];
  }
  return best.intent;
}

/**
 * Resume a handed-off intent on the ARRIVAL side (agentEnter). Pure. The
 * old land's coordinates are meaningless here, so `approach` re-targets
 * the structure nearest the entry edge; `watch_edge` continues to the
 * FAR side when it's open (the being is walking a chain) and decays to
 * an inward wander otherwise. `kind` arrives as a broker-opaque string —
 * unknown values decay to wander.
 */
export function resumeIntent(
  kind: string,
  entrySide: 'left' | 'right',
  ctx: IntentContext,
): BeingIntent {
  const inward: 1 | -1 = entrySide === 'left' ? 1 : -1;
  const farSide = entrySide === 'left' ? 'right' : 'left';
  switch (kind) {
    case 'rest':
      return { kind: 'rest' };
    case 'approach': {
      if (ctx.structureCols.length > 0) {
        const entryX = entrySide === 'left' ? 0 : ctx.width - 1;
        let best = ctx.structureCols[0];
        for (const c of ctx.structureCols) {
          if (Math.abs(c - entryX) < Math.abs(best - entryX)) best = c;
        }
        return { kind: 'approach', targetX: best };
      }
      return { kind: 'wander', dir: inward };
    }
    case 'watch_edge':
      if (ctx.edges[farSide]) return { kind: 'watch_edge', side: farSide };
      return { kind: 'wander', dir: inward };
    default:
      return { kind: 'wander', dir: inward };
  }
}

/**
 * Centre columns of the land's labelled structures — one entry per
 * horizontal 'label' run in LandModel.role, sorted, deduped within 3
 * cells (a structure may carry stacked labels). Pure projection; the
 * walker uses these as approach targets so "walk to a structure and
 * linger" reads against something with a name.
 */
export function structureColumns(role: ReadonlyArray<ReadonlyArray<LandRole>>): number[] {
  const centres: number[] = [];
  for (let y = 0; y < role.length; y++) {
    const row = role[y];
    let runStart = -1;
    for (let x = 0; x <= row.length; x++) {
      const isLabel = x < row.length && row[x] === 'label';
      if (isLabel && runStart < 0) runStart = x;
      if (!isLabel && runStart >= 0) {
        centres.push(Math.round((runStart + x - 1) / 2));
        runStart = -1;
      }
    }
  }
  centres.sort((a, b) => a - b);
  const out: number[] = [];
  for (const c of centres) {
    if (out.length === 0 || c - out[out.length - 1] > 3) out.push(c);
  }
  return out;
}

// ── Being accents (ambient-salience bundle) ─────────────────────────────
// Land beings draw from the SAME reserved accent pool as the cell cohort
// (roles.ts BEING_ROLE_KEYS via the four being roles), picked
// deterministically by id hash — the brightest marks on a land are its
// creatures. Pure; terminalLand.ts + smoke-salience share it.

export const LAND_BEING_ROLES = [
  'being.loki',
  'being.archivist',
  'being.cat',
  'being.visitor',
] as const satisfies readonly ThemeRole[];

/** FNV-1a over the id — local copy so this module stays dependency-light
 *  (terminalLand.ts keeps its own identical hash for seeds/phases). */
function accentHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function beingAccentRole(id: string): (typeof LAND_BEING_ROLES)[number] {
  return LAND_BEING_ROLES[accentHash(id) % LAND_BEING_ROLES.length];
}
