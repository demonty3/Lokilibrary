/**
 * Static 5-agent cohort. The roster is fixed in code — Phase 2 is not
 * generative on agent identity; new agents come from explicit roster
 * edits + persona writes, never from runtime spawning. This keeps the
 * cost ceiling predictable and the persona contract auditable.
 *
 * Roster:
 *   - Loki: "your" agent, magenta L, spawn near bookshelves.
 *   - Archivist: NPC librarian, blue A, spawn near door, visits window
 *     at 06–09 wall-clock.
 *   - Cat: NPC, yellow c (lowercase), random floor, biased to idle near
 *     lamps.
 *   - Visitor: NPC, cyan V, door spawn, intermittent presence
 *     (present 90s out of every 15 min).
 *   - Ghost: NPC, fgDim G, theme-gated (Tokyo Night + Catppuccin only),
 *     rare appearance.
 *
 * Tier-1 throttles per the plan: Loki 30s, Archivist 60s, Cat 120s,
 * Visitor on entry/exit only, Ghost on player-proximity only. Slice 2C
 * reads these; slice 2B only needs spawn + Tier-0 schedule rules.
 */

import type { CellLayout, CellPoint } from '../procedural/cell';
import { mulberry32 } from '../procedural/prng';
import { T_FLOOR } from '../procedural/tiles/library';
import type { ThemePalette } from '../themes/types';
import { pickLokiSpawn } from './loki';
import { LOKI_DENY_VERBS } from './persona/loki';
import {
  ARCHIVIST_PERSONA,
  CAT_PERSONA,
  GHOST_PERSONA,
  VISITOR_PERSONA,
} from './persona/npc';

export type PaletteKey = keyof ThemePalette;

/** Spawn rules — resolved against a CellLayout + seed to pick a
 *  deterministic tile. */
export type SpawnRule =
  | { kind: 'loki' }
  | { kind: 'near_door'; offsetX?: number; offsetY?: number }
  | { kind: 'random_floor'; seedSalt: number }
  | { kind: 'on_door' };

/** Per-agent Tier-0 schedule rules. The BT (behavior.ts) reads these
 *  alongside the wall clock + cohort state to score `scheduled` actions
 *  above plain `wander`/`idle`. */
export type ScheduleRule =
  | {
      kind: 'visit_window_at_hours';
      startHour: number;
      endHour: number;
    }
  | {
      kind: 'bias_idle_near_glyph';
      /** Glyph to find in the scatter layer (e.g. '☼' for the lamp). */
      glyph: string;
      /** Probability boost added to idle-near-target action utility. */
      bias: number;
    }
  | {
      kind: 'intermittent_presence';
      visitMs: number;
      absenceMs: number;
    }
  | {
      kind: 'rare_appearance';
      themeAllow: readonly string[];
      appearanceChancePerMin: number;
    };

export interface AgentDef {
  id: string;
  name: string;
  glyph: string;
  paletteKey: PaletteKey;
  /** Field-of-view radius (Chebyshev). Used by Phase 2C perception. */
  fov: number;
  spawn: SpawnRule;
  schedule: readonly ScheduleRule[];
  /** Minimum ms between Tier-1 dispatches. 0 means never throttled
   *  (Visitor / Ghost handle their cadence via schedule rules). */
  tier1ThrottleMs: number;
  /** Tier-0 step interval — how often the BT recomputes the action.
   *  Slower agents (Cat) save CPU + look calmer; faster (Loki) feel
   *  more present. */
  tier0StepMs: number;
  /** Agent-mind pass — persona-specific verbs the router must reject on
   *  top of its global base list. Source of truth: the persona modules
   *  (LOKI_DENY_VERBS / NpcPersona.denylist); the DB persona row stays a
   *  prompt-only store. */
  denyVerbs?: readonly string[];
}

export const COHORT: readonly AgentDef[] = [
  {
    id: 'loki',
    name: 'Loki',
    glyph: 'L',
    paletteKey: 'magenta',
    fov: 8,
    spawn: { kind: 'loki' },
    schedule: [],
    tier1ThrottleMs: 30_000,
    tier0StepMs: 400,
    denyVerbs: LOKI_DENY_VERBS,
  },
  {
    id: 'archivist',
    name: 'Archivist',
    glyph: 'A',
    paletteKey: 'blue',
    fov: 5,
    spawn: { kind: 'near_door', offsetX: -2, offsetY: -1 },
    schedule: [
      { kind: 'visit_window_at_hours', startHour: 6, endHour: 9 },
    ],
    tier1ThrottleMs: 60_000,
    tier0StepMs: 600,
    denyVerbs: ARCHIVIST_PERSONA.denylist,
  },
  {
    id: 'cat',
    name: 'Cat',
    glyph: 'c',
    paletteKey: 'yellow',
    fov: 4,
    spawn: { kind: 'random_floor', seedSalt: 0xca7 },
    schedule: [{ kind: 'bias_idle_near_glyph', glyph: '☼', bias: 0.6 }],
    tier1ThrottleMs: 120_000,
    tier0StepMs: 900,
    denyVerbs: CAT_PERSONA.denylist,
  },
  {
    id: 'visitor',
    name: 'Visitor',
    glyph: 'V',
    paletteKey: 'cyan',
    fov: 5,
    spawn: { kind: 'on_door' },
    schedule: [
      // 90s present out of every 15 minutes — present-ish but not always.
      { kind: 'intermittent_presence', visitMs: 90_000, absenceMs: 810_000 },
    ],
    tier1ThrottleMs: 0,
    tier0StepMs: 600,
    denyVerbs: VISITOR_PERSONA.denylist,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    glyph: 'G',
    paletteKey: 'fgDim',
    fov: 6,
    spawn: { kind: 'random_floor', seedSalt: 0x6057 },
    schedule: [
      {
        kind: 'rare_appearance',
        themeAllow: ['tokyo-night', 'catppuccin-mocha'],
        appearanceChancePerMin: 0.1,
      },
    ],
    tier1ThrottleMs: 0,
    tier0StepMs: 1200,
    denyVerbs: GHOST_PERSONA.denylist,
  },
];

/** Resolve a spawn rule against a layout + cohort seed → deterministic
 *  cell coordinate. Falls back to the player spawn if no candidate fits
 *  the rule (e.g., layout has zero bookshelves; very rare but defensive). */
export function resolveSpawn(
  rule: SpawnRule,
  layout: CellLayout,
  seed: number,
): CellPoint {
  switch (rule.kind) {
    case 'loki':
      return pickLokiSpawn(layout, seed);
    case 'on_door':
      return layout.doorAt;
    case 'near_door': {
      const tx = clamp(layout.doorAt.x + (rule.offsetX ?? 0), 1, layout.width - 2);
      const ty = clamp(layout.doorAt.y + (rule.offsetY ?? -2), 1, layout.height - 2);
      // If the offset landed on non-floor, scan outward for the nearest
      // floor cell so the agent doesn't spawn inside a bookshelf.
      return nearestFloor(layout, { x: tx, y: ty });
    }
    case 'random_floor': {
      const prng = mulberry32((seed ^ rule.seedSalt) >>> 0);
      const floors: CellPoint[] = [];
      for (let y = 0; y < layout.height; y++) {
        for (let x = 0; x < layout.width; x++) {
          if (
            layout.tiles[y][x] === T_FLOOR &&
            !(x === layout.spawnAt.x && y === layout.spawnAt.y)
          ) {
            floors.push({ x, y });
          }
        }
      }
      if (floors.length === 0) return layout.spawnAt;
      return prng.pick(floors);
    }
  }
}

/** Agents whose `rare_appearance` rule excludes the active theme are
 *  removed from the cohort before any spawn / tick work. */
export function filterByTheme(
  defs: readonly AgentDef[],
  themeId: string,
): AgentDef[] {
  return defs.filter((def) => {
    const rare = def.schedule.find((r) => r.kind === 'rare_appearance') as
      | { kind: 'rare_appearance'; themeAllow: readonly string[] }
      | undefined;
    if (!rare) return true;
    return rare.themeAllow.includes(themeId);
  });
}

// ---------- internal ----------

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function nearestFloor(layout: CellLayout, from: CellPoint): CellPoint {
  if (layout.tiles[from.y]?.[from.x] === T_FLOOR) return from;
  // Manhattan ring search outward. Bounded by layout size.
  const maxR = layout.width + layout.height;
  for (let r = 1; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        const nx = from.x + dx;
        const ny = from.y + dy;
        if (nx < 0 || nx >= layout.width || ny < 0 || ny >= layout.height) continue;
        if (layout.tiles[ny][nx] === T_FLOOR) return { x: nx, y: ny };
      }
    }
  }
  return layout.spawnAt;
}
