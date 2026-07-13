/**
 * Cohort renderer. Mounts one BitmapText sprite per visible agent,
 * owns a single Ticker that runs Tier-0 BT + presence updates for the
 * whole cohort, and reposititions each sprite from its runtime state.
 *
 * One Ticker for the whole cohort (rather than per-agent) keeps the
 * frame budget predictable and the teardown path symmetrical with
 * `mountCell`. Per-agent tick *cadence* is enforced inside
 * `tickBehavior` via `def.tier0StepMs` + `runtime.actionEndsAt`, so
 * Cat is not woken up every frame just because Loki is.
 *
 * Presence (Visitor / Ghost) toggles `runtime.present` + sprite
 * `visible`. Sprites stay attached when absent so re-appearance doesn't
 * need to rebuild the BitmapText.
 */

import { BitmapText, Container } from 'pixi.js';
import type { Application, TickerCallback } from 'pixi.js';
import type { CellLayout, CellPoint } from '../../procedural/cell';
import type { Theme, ThemeRole } from '../../themes/types';
import { roleKey } from '../../themes/roles';
import { mulberry32, type Prng } from '../../procedural/prng';
import {
  COHORT,
  filterByTheme,
  resolveSpawn,
} from '../../agents/cohort';
import {
  tickBehavior,
  tickPresence,
  type BehaviorContext,
} from '../../agents/behavior';
import {
  computePerception,
  resetPerceptionState,
  type WorldSnapshot,
} from '../../agents/perception';
import {
  enrichSnapshotAcrossSeams,
  noCrossSeamDeps,
  type CrossSeamDeps,
} from '../../agents/crossSeam';
import {
  routeTier1,
  routeTier2,
  nullMemoryWriter,
  type MemoryWriter,
  type AgentTransport,
} from '../../agents/router';
import { buildLibraryContext } from '../../agents/library-context';
import {
  clearRuntimesIn,
  initialRuntime,
  listRuntimesIn,
  migrateRuntime,
  setRuntimeIn,
  type RuntimeScope,
} from '../../state/agentRuntime';
import type { SeamExit } from '../../state/seams';
import { isAgentLiveElsewhere } from '../../state/paneRegistry';
import { getPlayerPos } from '../../state/playerPos';
import { useAppStore } from '../../state/store';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

export interface MountCohortOptions {
  app: Application;
  parent: Container;
  theme: Theme;
  layout: CellLayout;
  /** Pane id this cohort belongs to (Phase 7 / v2.x pane-scoping). Drives
   *  the player-position read for the perception WorldSnapshot so each cell
   *  pane perceives its OWN `@`. Required — the cell renderer always passes
   *  its pane id ('root' for the single-pane default). */
  paneId: string;
  /** This pane's volatile runtime + perception scope (created by the cell
   *  renderer at mount). The cohort populates + ticks over THIS scope's map,
   *  so two cell panes run independent cohorts with no key collision. */
  scope: RuntimeScope;
  /** Seed for per-agent PRNG namespacing. Use the same seed as the
   *  cell layout so the cohort positions are stable for a given profile. */
  seed: number;
  /** Glyph → cell positions, built from the scatter pass. Used by Cat's
   *  `bias_idle_near_glyph` schedule. */
  scatterAnchors?: ReadonlyMap<string, readonly CellPoint[]>;
  /** Wall-clock provider — defaults to `new Date().getHours()`. Tests
   *  inject a fake clock here. */
  wallClockHour?: () => number;
  /** Tier-1 + Tier-2 transport override (tests inject stubs). Defaults
   *  to HTTP via api/agent.ts. */
  agentTransport?: AgentTransport;
  /** Memory writer (Electron-only in production; tests + web build use
   *  the null writer that no-ops every method). */
  memoryWriter?: MemoryWriter;
  /** Free-text scene label sent in each Tier-1 perception payload. */
  sceneLabel?: string;
  /** Phase 7-D — cross-seam perception deps. When omitted (the default), a
   *  no-op stub with NO open seams is used, so the per-tick snapshot is
   *  returned by reference unchanged — byte-identical to the pre-7-D path. The
   *  smoke injects a hand-built SeamEdge to exercise the projection + reach
   *  filter + perception round-trip; the real seam graph wires this when it
   *  lands. `maxFov` defaults to the cohort's max def.fov. */
  crossSeamDeps?: CrossSeamDeps;
  /** Phase 7-D.2 — live cross-seam wiring threaded from PixiApp (the one place
   *  that knows the live pane graph). Supplies BOTH the perception deps
   *  (`crossSeamDepsFor(maxFov)`, built after the cohort computes maxFov from
   *  its themed defs) AND the crossing exits (`seamExitsFor()` for the
   *  BehaviorContext). Both LAZY so a split/close keeps a mounted cohort current
   *  without a remount. Omitted (smoke / single-pane) ⇒ no-op deps + no exits ⇒
   *  byte-identical no-seam path. When `crossSeamDeps` is ALSO provided directly
   *  (the 7-D smoke's hand-built injection) that takes precedence for
   *  perception. */
  crossWiring?: {
    crossSeamDepsFor: (maxFov: number) => CrossSeamDeps;
    seamExitsFor: () => ReadonlyMap<string, SeamExit>;
  };
}

/** The single 'root' cell pane — the world's roster home under the
 *  single-roaming-roster model. Defined locally (mirrors playerPos.ts's
 *  ROOT_PANE sentinel) to avoid a render→state import just for the constant. */
const ROOT_PANE = 'root';

export function mountCohort(opts: MountCohortOptions): () => void {
  const defs = filterByTheme(COHORT, opts.theme.id);
  const sprites = new Map<string, BitmapText>();
  const prngs = new Map<string, Prng>();
  const mountedAt = performance.now();

  // Per-agent PRNG namespacing. Hash the agent id into a 32-bit salt
  // so the seed-mix is stable + collision-resistant for the 5 agents.
  for (const def of defs) {
    const agentSalt = fnvHash(def.id);
    prngs.set(def.id, mulberry32((opts.seed ^ agentSalt) >>> 0));
  }

  const scope = opts.scope;
  const defById = new Map(defs.map((d) => [d.id, d]));

  // Phase 7-D.2 — SINGLE ROAMING ROSTER. The COHORT exists ONCE for the whole
  // world. Spawn the 5 agents into the ROOT pane's scope only; a split pane
  // (paneId !== 'root') mounts an EMPTY scope and gains agents solely as they
  // WALK in across a seam. clearRuntimesIn + the empty-scope spawn run ONLY for
  // root, so a non-root pane never clears agents that migrated in mid-life.
  //
  // ROSTER-AWARE (must-fix): the gate must be IDEMPOTENT against a PARTIAL root
  // remount. If root relevels (zoom `]`/`[`) while a sibling cell pane keeps
  // running, reconcilePanes tears down + remounts ONLY root — but a sibling pane
  // may still hold an agent that walked out of root (e.g. `loki` now lives in
  // p2). The root-gate's fresh-empty scope would otherwise re-spawn ALL 5,
  // RE-CREATING `loki` in root while p2 still has it = duplicate runtime, two
  // sprites, doubled Tier-1. So we skip any id that is CURRENTLY live in another
  // registered pane's scope (isAgentLiveElsewhere consults the paneRegistry;
  // root itself is excluded). The distributed roster is re-adopted, not cloned.
  //
  // Single-pane byte-identical: with one 'root' pane there is NO other
  // registered pane (isAgentLiveElsewhere always false), so the gate seeds all 5
  // via the SAME mulberry32((seed^fnv(id))) + resolveSpawn as before, and the
  // reconcile below creates exactly the same 5 sprites at the same coords. No
  // seam ever opens ⇒ no migration ⇒ no reconcile churn.
  if (opts.paneId === ROOT_PANE) {
    clearRuntimesIn(scope);
    if (scope.runtimes.size === 0) {
      for (const def of defs) {
        // Re-adopt rather than clone: an agent already living in a sibling pane
        // stays there (it walked out of root); root only seeds the absentees.
        if (isAgentLiveElsewhere(def.id, ROOT_PANE)) continue;
        const spawn = resolveSpawn(def.spawn, opts.layout, opts.seed);
        setRuntimeIn(scope, initialRuntime({ id: def.id, x: spawn.x, y: spawn.y }));
      }
    }
  }

  /** Reconcile the sprite Map to the agents CURRENTLY in this pane's scope:
   *  create a BitmapText for an id newly present with no sprite, destroy + drop
   *  a sprite whose id has left (migrated out). A present, stable agent keeps
   *  its sprite untouched. No per-call allocation (iterates the live Maps
   *  directly). With one 'root' pane this is a pure no-op diff every tick after
   *  the first — same result as the old "sprite always exists" path. */
  function reconcileSprites(): void {
    // Create sprites for newly-present scope ids.
    for (const rt of scope.runtimes.values()) {
      if (sprites.has(rt.id)) continue;
      const def = defById.get(rt.id);
      // An id with no def in THIS pane's themed cohort (e.g. a Ghost that
      // theme-filtering dropped here) must not migrate in; skip gracefully
      // rather than crash. Single-pane never hits this (no migration).
      if (!def) continue;
      const sprite = new BitmapText({
        text: def.glyph,
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          fill: hexToInt(
            opts.theme.palette[
              roleKey(opts.theme, `being.${def.id}` as ThemeRole, def.paletteKey)
            ],
          ),
        },
      });
      sprite.x = rt.x * COZETTE_CELL_WIDTH;
      sprite.y = rt.y * COZETTE_CELL_HEIGHT;
      opts.parent.addChild(sprite);
      sprites.set(rt.id, sprite);
    }
    // Destroy sprites whose id is no longer in this scope (migrated out). Skip
    // the whole pass — including the keys() snapshot allocation — when every
    // sprite already has a live runtime (sprites.size <= scope.runtimes.size
    // means no sprite is orphaned IF the create pass above ran; the common
    // single-pane case where the two Maps hold the same id set). This keeps the
    // no-churn hot path allocation-free at 60Hz.
    if (sprites.size > scope.runtimes.size) {
      for (const id of [...sprites.keys()]) {
        if (scope.runtimes.has(id)) continue;
        const sprite = sprites.get(id)!;
        sprite.destroy();
        sprites.delete(id);
      }
    }
  }

  // Build the initial sprites for whoever is in scope right now (root: the 5
  // just-spawned; a split pane: none).
  reconcileSprites();

  // Static behavior context (no seam exits). The single-pane / no-seam path
  // uses THIS object every tick — zero per-frame allocation, byte-identical to
  // today. When seams are live the tick builds a per-tick ctx carrying the
  // current exits (only then, so single-pane never pays the alloc).
  const baseCtx: BehaviorContext = {
    layout: opts.layout,
    prngs,
    scatterAnchors: opts.scatterAnchors ?? new Map(),
    wallClockHour: opts.wallClockHour ?? (() => new Date().getHours()),
  };

  const memoryWriter = opts.memoryWriter ?? nullMemoryWriter;
  const sceneLabel = opts.sceneLabel ?? 'a small library room';

  // Agent-mind pass — one library line per mount (deterministic; the
  // library only changes on auth/profile remount, which remounts us).
  const libraryLine = buildLibraryContext(useAppStore.getState().library) ?? undefined;

  // Phase 7-D — cross-seam perception. maxFov = max def.fov across the cohort,
  // computed once at mount (perception.ts re-clips authoritatively per agent).
  // Default deps = no open seams → enricher returns the snapshot by reference,
  // so the no-seam path allocates nothing and is byte-identical to today.
  const maxFov = defs.reduce((m, d) => Math.max(m, d.fov), 0);
  // Direct `crossSeamDeps` (the 7-D smoke's hand-built injection) wins; else the
  // live wiring from PixiApp; else the no-op stub (single-pane / non-PixiApp).
  const crossSeamDeps =
    opts.crossSeamDeps ?? opts.crossWiring?.crossSeamDepsFor(maxFov) ?? noCrossSeamDeps(maxFov);
  // Bookshelf positions are stable per layout — passed by reference to
  // perception every tick, no copy.
  const bookshelves = opts.layout.bookshelfSlots;

  const tick: TickerCallback<unknown> = () => {
    const now = performance.now();

    // Phase 7-D.2 — reconcile sprites to scope FIRST: an agent that walked in
    // last tick gets a sprite now; one that walked out loses it. No-op diff for
    // a stable single-pane scope (sprites already exist for all 5 ids).
    reconcileSprites();

    const runtimes = listRuntimesIn(scope);

    // Phase 7-D.2 — live seam exits for this pane (re-read each tick so a split
    // mid-life is picked up). EMPTY map ⇒ use the static baseCtx (no per-tick
    // alloc, byte-identical single-pane). Only build a per-tick ctx when an exit
    // actually exists.
    const exits = opts.crossWiring?.seamExitsFor();
    const ctx: BehaviorContext =
      exits && exits.size > 0 ? { ...baseCtx, seamExits: exits } : baseCtx;

    // This pane's player (pane-scoped). Single 'root' pane === today.
    const player = getPlayerPos(opts.paneId);

    // Build the agents Map once per tick so perception's FOV loop sees
    // a coherent snapshot (rather than mid-tick mutated positions from
    // other agents' BT steps).
    const agentPositions = new Map<string, CellPoint>();
    for (const rt of runtimes) {
      agentPositions.set(rt.id, { x: rt.x, y: rt.y });
    }
    const baseWorld: WorldSnapshot = {
      player: { x: player.x, y: player.y },
      agents: agentPositions,
      bookshelves,
    };
    // Phase 7-D — splice in projected neighbour subjects across any OPEN seam.
    // With the default no-op deps this returns `baseWorld` BY REFERENCE (no
    // alloc, byte-identical). Cost in the common case is one openSeamsFor()
    // call returning [].
    const world = enrichSnapshotAcrossSeams(baseWorld, opts.paneId, crossSeamDeps);

    for (const runtime of runtimes) {
      const def = defById.get(runtime.id);
      if (!def) continue;
      tickPresence(def, runtime, ctx, mountedAt, now);
      tickBehavior(def, runtime, ctx, now);

      // Phase 7-D.2 — consume a cross-intent the BT wrote this tick. Resolve
      // the neighbour's LIVE scope via the cross-seam deps (paneRegistry-backed
      // in production); a torn-down / non-cell neighbour returns undefined so
      // we clear the intent and let the agent stay put (teardown-race guard —
      // never migrate INTO a scope with no cohort ticker = vanish). On 'ok' the
      // agent is no longer ours: its sprite is reconciled away next tick here,
      // and the neighbour cohort reconciles it in. `continue` so we don't keep
      // ticking an agent we just handed off.
      if (runtime.pendingCross) {
        const target = runtime.pendingCross;
        const neighbourScope = crossSeamDeps.getNeighbourScope(target.paneId);
        if (!neighbourScope) {
          runtime.pendingCross = null; // neighbour gone → abandon the cross
        } else {
          const res = migrateRuntime(scope, neighbourScope, runtime.id, target.x, target.y);
          if (res === 'ok') {
            continue; // migrated out — stop processing this agent here
          }
          // 'duplicate' (backstop — should never fire under single roaming
          // roster) or 'absent' (impossible — we just read it): clear the
          // intent + let the agent keep walking locally next pick. Log the
          // anomaly so a real collision surfaces in dev.
          // eslint-disable-next-line no-console
          if (res === 'duplicate') {
            console.warn(
              `[cohort] cross refused (duplicate) id=${runtime.id} → ${target.paneId} — single-roaming-roster invariant breached`,
            );
          }
          runtime.pendingCross = null;
        }
      }

      // Perception poll → queue; router decides whether to dispatch.
      // Pass this pane's perception caches so panes don't clobber each other.
      computePerception(def, runtime, world, now, undefined, undefined, scope.perception);
      if (runtime.perceptionQueue.length > 0) {
        // Fire-and-forget — routeTier1 sets lastTier1At synchronously
        // before awaiting, so concurrent ticks throttle correctly.
        void routeTier1(def, runtime, sceneLabel, now, {
          transport: opts.agentTransport,
          memory: memoryWriter,
          library: libraryLine,
        }).then(() => {
          // After a Tier-1 dispatch the reflectionCounter may have
          // crossed threshold — let routeTier2 short-circuit if not.
          void routeTier2(def, runtime, now, {
            transport: opts.agentTransport,
            memory: memoryWriter,
            loreEnabled: useAppStore.getState().loreEnabled,
            loreQuote: useAppStore.getState().loreQuoteEnabled,
            library: libraryLine,
            roomDims: { width: opts.layout.width, height: opts.layout.height },
          });
        });
      }

      const sprite = sprites.get(runtime.id);
      if (!sprite) continue;
      sprite.visible = runtime.present;
      const px = runtime.x * COZETTE_CELL_WIDTH;
      const py = runtime.y * COZETTE_CELL_HEIGHT;
      if (sprite.x !== px) sprite.x = px;
      if (sprite.y !== py) sprite.y = py;
    }
  };
  opts.app.ticker.add(tick);

  return () => {
    opts.app.ticker.remove(tick);
    // Destroy EVERY sprite in the Map (the Map is authoritative for teardown —
    // an agent that migrated out mid-frame still has its sprite here until the
    // next reconcile, which won't run after ticker.remove).
    for (const sprite of sprites.values()) sprite.destroy();
    sprites.clear();
    prngs.clear();
    // Phase 7-D.2 — clearing the scope on teardown is correct for BOTH a
    // closing root pane (it owns the roster home; a remount re-spawns) AND a
    // closing split pane that happens to hold migrated-in agents (they drop —
    // user close-seam control + "migrate-home before teardown" are DEFERRED,
    // see STATE.md). Without this, a closing split pane's runtimes would leak.
    clearRuntimesIn(scope);
    resetPerceptionState(scope.perception);
  };
}

/** FNV-1a hash of a string → uint32. Kept inline (rather than importing
 *  from `procedural/seed.ts`) because cohort lives outside `procedural/`
 *  and we want this to be standalone. Same algorithm; cross-checked
 *  against seed.ts for compatibility. */
function fnvHash(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
