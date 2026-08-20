/**
 * T0 spike — the terminal-window land view (docs/PRD-snapping-terminals.md).
 *
 * A terminal window shows ONE wing as a side-on land. The main-process
 * broker tells us which of our edges are joined to a neighbour terminal:
 * joined edges OPEN (a bright threshold doorway at the ground line); closed
 * edges are walls (beings turn around).
 *
 * Beings here are the REAL cohort (T2 society migration): def-driven glyph/
 * accent/speed (src/agents/cohort.ts), a land personality (beingIntents.ts
 * LAND_PERSONAS) layered on the pure BT intent pick, and a REAL agent mind
 * (an `initialRuntime`-built AgentRuntimeState) that routeTier1 dispatches
 * on arrival (fire-and-forget; a parseable `approach x,y` intent steers the
 * walker, anything else is flavor — key-free rail, no worker changes).
 * Presence dynamics (Visitor's cycle, Ghost's rare apparitions) reuse the
 * cell's `tickPresence` schedule rules on that same mind. Sub-cell motion
 * (float x + idle bob + hesitation beats) still rides live per-terminal
 * juice, not procedural layout. At an open edge a being hands itself AND
 * its mind to the broker (`terminal:agentExit`) and continues in the
 * neighbour window: exit eases out past the edge, entry fades in off a ✦
 * spark, the mind reconstructs from the carried fields. Homes (which wing
 * a cohort member lives on) live in the broker (single-roaming-roster,
 * 7D.2 semantics across process boundaries); wander/juice randomness is
 * runtime behaviour (like cell agents), not procedural layout — the LAND
 * itself stays seed-deterministic. All animation rides app.ticker.deltaMS
 * (throttle-safe); all tints come from the active theme palette.
 *
 * UI/UX pass (game-design-review, 2026-06-11): 2× world scale, bottom
 * anchor, brighter beings, edge affordances, crossing juice, no duplicate
 * title. Knobs below.
 *
 * Exposes `window.__terminal` (state + debug) for the e2e harness.
 */

import { Application, BitmapText, Container, Graphics, type Filter } from 'pixi.js';
import { themeFxList, type Theme } from '../themes/types';
import {
  beatOffset,
  bobOffset,
  IDLE_BEAT_DUR,
  IDLE_BEAT_S,
  IDLE_TURN_CHANCE,
  LEAN_PX,
  stepGait,
  stepLean,
  stepMoving,
} from './beingAnim';
import { createGlowFilter } from '../render/fx/glow';
import {
  COZETTE_CELL_HEIGHT as CH,
  COZETTE_CELL_WIDTH as CW,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
  waitForCozette,
} from '../render/fonts';
import { buildLandContainer, landRoleFill, skyInkOf, strataMaterialGlyph } from '../render/levels/land';
import { loadMuralPixels, buildQuantizedMural, MURAL_BACKING, type TerminalMuralState } from '../render/mural';
import { quantizeMural, muralQuantizeTargets } from '../render/muralCells';
import { knitGlowCell, vKnitCols } from './knit';
import {
  holdingsRamp,
  MAST_GAP_COLS,
  MAST_PAD_COLS,
  mastheadResidents,
  wingLabel,
} from './masthead';
import {
  EDGE_PART_S,
  edgeSpan,
  JAMB_H,
  JAMB_ROW0,
  jambAlpha,
  jambGlyph,
  partDone,
  partEase,
  partEaseInv,
  partFront,
  restFront,
  rowSpan,
  wallAlpha,
} from './edgePart';
import { createFootfall, crustLayerText, decayedCount, WEAR_THRESHOLD } from './wear';
import { daylight, foliageSway, localHour, pulse, skyNow, sunGlow } from './ambient';
import { arcAlpha, arcY, extractArc, type ArcSpec } from './skyArc';
import { blockedSpansAt, extractWisps, wispAlpha, wispX, type WispSpec } from './clouds';
import { bodyHost, chainOffsets, deskChain, sharedWisps, type DeskChainSpec } from './sharedSky';
import {
  expeditionNote,
  launchNote,
  maybeMark,
  markDisplayRow,
  MARK_DEDUPE_COLS,
  noteFor,
  pickReveal,
  MARK_RENDER_CAP,
  revealAlpha,
  type MarkContextKind,
} from './marks';
import {
  accrueUptime,
  beginExpedition,
  deferDispatch,
  delverWingOf,
  directiveParams,
  dispatchDue,
  HOARD_GLYPH_ROWS,
  hoardStage,
  initialDelveState,
  parseDelveState,
  resolveExpedition,
  tickArrival,
  type DelveState,
} from './delve';
import { MARK_STYLES, DEFAULT_MARK_STYLE } from '../agents/markStyles';
import { wrapNote } from '../render/noteBox';
import { easeLabelAlpha, siteLabelTarget, stepLabelAlpha } from './siteLabels';
import {
  doorColumn,
  hitLaunchTarget,
  launchTargets,
  type LaunchTarget,
} from './launchTargets';
import { launchGame } from '../agents/launch';
import { composeLand, composeLandExtension, composeUnderLand, shaftColumn, DESK_SURFACE, MOON_GLYPH, SAMPLE_LAND, SUN_GLYPH, type LandGame, type LandModel, type LandSite } from '../procedural/land';
import {
  getTerminalSociety,
  getTerminalTopology,
  getTerminalOrchestration,
  getTerminalRoster,
  getThrottleState,
  subscribeTerminalAgentEnter,
  subscribeTerminalNeighbourSummary,
  subscribeTerminalTopology,
  subscribeThrottle,
  subscribeDeskAttention,
  terminalAgentExit,
  terminalAgentSpawn,
  terminalApplyProposal,
  terminalDismissProposal,
  terminalProposeTopology,
  terminalReportNearEdge,
  type TerminalJoin,
  type TerminalVJoin,
  type ThrottleState,
} from '../api/electron';
import { shouldFireAttention, tickerFor } from './deskThrottle';
import { nearEdgeSummary, projectAcrossEdge, type NearEdgeBeing } from './crossEdge';
import {
  beingAccentRole,
  DEFAULT_LAND_PERSONA,
  LAND_PERSONAS,
  landIntentFromTick,
  pickIntent,
  resumeIntent,
  structureColumns,
  type BeingIntent,
  type IntentContext,
  type LandPersona,
} from './beingIntents';
import {
  carriedFromMind,
  reconstructMind,
  residentsOf,
  sceneLabelFor,
} from './society';
import { roleKey } from '../themes/roles';
import { COHORT, filterByTheme, type AgentDef } from '../agents/cohort';
import { tickPresence } from '../agents/behavior';
import {
  nullMemoryWriter,
  REFLECTION_THRESHOLD,
  routeTier1,
  routeTier2,
  type MemoryWriter,
  type ReflectRouteResult,
} from '../agents/router';
import { deskTopology, deskTopologyLine, reachableWings, type DeskTopology } from './deskTopology';
import { extractProposalCandidate, proposalDispatchRows, proposalHitSpans } from './deskProposal';
import {
  mountMorningDispatch,
  type MorningDispatchHandle,
  type MorningDispatchLine,
} from '../render/overlays/morning-dispatch';
import type { AgentRuntimeState } from '../state/agentRuntime';
import { mulberry32, type Prng } from '../procedural/prng';
import { bootstrapMemory, getCurrentMemoryWriter } from '../agents/memory/bootstrap';
import { cellIdFor, libraryIdFor } from '../agents/memory/schema';
import {
  recordArrival,
  recordCrossing,
  recordLaunch,
  recordMark,
  recordReturn,
} from './terminalMemory';

// ── T0 spike knobs ─────────────────────────────────────────────────────────
/** Integer up-scale — 1× Cozette fails the glance test in a 640px window. */
const WORLD_SCALE = 2;
/** Row the wake banner's first line sits on. The masthead owns row 0, so 2
 *  leaves one blank row between the window's title row and the dispatch. */
const BANNER_TOP_ROW = 2;
/** Raised horizon (2026-07-30): a tight 4-row underground; the reclaimed rows
 *  go to the sky (skyH 5 → 11 at 640×520). Terrace Join's precondition. */
const UNDER_H = 4;
const SURFACE_BAND = 4;
/** Cells the sky overhangs the land's edges by. `cols` floors, so the land is
 *  636 px in a 640 px window and `world.x = 2` leaves a bg sliver down each
 *  side — invisible while the sky is bg, a dark line at noon, and 4 px of it at
 *  a join, which is the one place the desk claims the ground is continuous.
 *  One cell (12 screen px) covers it with room for any rounding. */
const SKY_BLEED_CELLS = 1;
/** Cohort defs keyed by id — resolved once, read by addBeing + the tick. */
const COHORT_BY_ID = new Map(COHORT.map((d) => [d.id, d]));
/** Intent re-pick window (min + seeded extra, seconds). */
const INTENT_S: [number, number] = [6, 6];
/** Hesitation beat at each re-pick (min + seeded extra, seconds). */
const HESITATE_S: [number, number] = [0.3, 0.5];
/** approach: linger radius (cells) around the structure column. */
const APPROACH_NEAR = 0.4;
/** watch_edge: within this many cells of the open edge, drift slowly. */
const WATCH_NEAR = 3;
/** Speed multiplier while drifting at a watched edge. */
const WATCH_DRIFT = 0.4;
/** Anti-ping-pong: seconds after entering before a being may exit again
 *  (the 7D.2 cooldown idea, ported to the land handoff). */
const CROSS_COOLDOWN_S = 4;
/** Near-edge report cadence (seconds; also change-gated). */
const NEAR_EDGE_REPORT_S = 1;
/** Wear flush cadence (seconds; dirty-gated — never per footstep). */
const WEAR_FLUSH_S = 30;
/** Being liveliness (breath/gait/lean/idle beats) lives in beingAnim.ts —
 *  it owns its own amplitude + cadence consts, the siteLabels.ts posture. */
/** Crossing juice durations (seconds). */
const EXIT_S = 0.25;
const ENTER_S = 0.25;
/** Phase B: shaft climb-in after a vertical arrival — long enough to read as
 *  a descent (or ascent), not a teleport. */
const CLIMB_S = 1.2;
/** Phase B: chance per shaft-crossing that a being takes the shaft while the
 *  undercroft is open (runtime rng, the idle-beat stream's class — NOT
 *  procedural determinism). Kept modest so the surface stays lively. */
const DESCEND_CHANCE = 0.25;
const SPARK_S = 0.3;
/** Tier-2 structure glow: alpha pulse (the 6A landmark-pulse envelope). */
const GLOW_STRUCT_PERIOD_S = 2.8;
const GLOW_STRUCT_RANGE = [0.72, 1] as const;
/** Knit-sweep: a one-shot glow that runs across a newly-joined seam. */
const KNIT_S = 0.6;
const KNIT_SPAN = 6; // columns the sweep travels inward from the seam
/** Tier-2 polish: the sweep carries a trail; the seam ground brightens. */
const KNIT_TRAIL = ['█', '▓', '▒'] as const; // head → tail
const KNIT_GLOW_S = 0.9; // ground-brightening outlives the sweep a beat
/** Launcher beat (docs/superpowers/specs/2026-08-06-launcher-beat-design.md):
 *  click a site → the door lights, the nearest being runs the errand, Steam
 *  fires when they arrive. */
const ERRAND_CAP_S = 2.5; // fire anyway past this — a launcher may not make you wait
const THROUGH_S = 0.35; // fade through the door
const RETURN_S = 0.45; // fade back out of it
// Away time is WALL CLOCK, not the ticker's elapsedS — the same reason cloud
// drift is (see the wisp loop). A being is away precisely while the game has
// the screen and this window is occluded, and an occluded Chromium window
// throttles or stops rAF; worse, Pixi clamps deltaMS to 100 ms, so a 1 Hz
// throttled ticker accrues elapsed time ~10× slower than the wall. Measured in
// elapsedS, the floor would expire long after you were back and the ceiling
// could take most of a day. Verified live 2026-08-06: on a backgrounded desk
// the floor had not expired after 24 s of wall time.
const AWAY_FLOOR_MS = 20_000; // no re-emergence before this (a stray mouse move must not yank them back)
const AWAY_CEIL_MS = 30 * 60_000; // …and never later than this, attention or not
/** Door pulse while an errand is live (the click's acknowledgement). */
const DOOR_PULSE_HZ = 2;
const DOOR_PULSE_RANGE: [number, number] = [0.45, 1];

interface Being {
  id: string;
  glyph: string;
  x: number; // cells, float
  dir: 1 | -1;
  speed: number; // cells/sec
  /** Current Tier-0 intent (beingIntents.ts) + the BT re-pick clock. */
  intent: BeingIntent;
  nextIntentAt: number; // elapsed-seconds timestamp
  pausedUntil: number; // hesitation beat after a re-pick
  /** Anti-ping-pong: a just-entered being may not exit until this. */
  crossCooldownUntil: number;
  /** Liveliness channels (beingAnim.ts): breath phase, gait phase, the drawn
   *  facing + its eased lean, the walk/stand blend, and the live idle beat.
   *  `face` is the DRAWN facing only — `dir` above stays the behaviour /
   *  handoff / state() channel, so an idle turn can never perturb a crossing. */
  face: 1 | -1;
  lean: number;
  moving: number;
  gaitPhase: number;
  bobPhase: number;
  idleBeat: { startedS: number; turn: boolean } | null;
  /** Next elapsed-second at which a stationary being may fidget. */
  idleBeatAt: number;
  /** Last integer column counted toward footfall wear. */
  lastCol: number;
  text: BitmapText;
  /** Mid-handoff: walking stops until the broker acks. */
  pending: boolean;
  /** Exit/enter juice state (progress driven by elapsedS). */
  exitingSince: number | null;
  enteringSince: number | null;
  /** Phase B: vertical exit direction — 1 down / -1 up / 0 horizontal. The
   *  exit juice slides along the shaft instead of past the side edge. */
  exitDy: 0 | 1 | -1;
  /** Phase B: shaft climb-in after a vertical arrival — x pinned to the
   *  shaft, drawn row eased from `fromRows` cells away down/up to the
   *  ground; intent ticking suppressed while live. NO general y: the
   *  intent engine stays 1-D and the climb is renderer juice, like
   *  exitingSince. */
  climb: { fromRows: number; startedS: number } | null;
  /** Marginalia: the first re-pick after a seam arrival may leave an
   *  after_crossing mark; consumed (set false) at that re-pick. */
  pendingArrivalMark: boolean;
  /** The REAL agent runtime (initialRuntime-built) — the mind. routeTier1
   *  reads/mutates it directly; carried across seams via society.ts. */
  mind: AgentRuntimeState;
  /** Land personality (beingIntents.ts LAND_PERSONAS). Cached at spawn. */
  persona: LandPersona;
  /** Launcher beat: fading through the door (elapsedS at the step). */
  throughSince: number | null;
  /** Launcher beat: out playing. Absent from the land entirely — not drawn,
   *  no walking, no wear, no crossings, holds no label open. */
  away: { game: string; col: number; sinceMs: number } | null;
  /** Launcher beat: fading back out of the door. */
  returningSince: number | null;
}

export interface TerminalLandState {
  terminalId: string;
  wing: string;
  edges: { left: boolean; right: boolean };
  beings: Array<{
    id: string;
    x: number;
    dir: number;
    intent: string;
    present: boolean;
    /** Launcher beat: out playing (invisible, walks nothing, crosses nothing). */
    away: boolean;
  }>;
  /** e2e ground truth for the join juice: live sweep count, total fired, and
   *  live glow glyphs sitting off the current ground line. `glowStale` must
   *  always read 0 — a mid-knit recompose used to strand them mid-air. */
  knits: { live: number; fired: number; glowStale: number };
  /** Columns worn past the footfall threshold (persisted per wing). */
  worn: number[];
  /** Rendered marks (marginalia) + the live reveal slot. */
  marks: Array<{ col: number; agentId: string; revealed: boolean }>;
  /** Murals #16: the mount status of the flagship's framed mural, if this
   *  land was composed with one. */
  mural: { state: TerminalMuralState; appid: number } | null;
  /** The joined neighbours' near-edge beings, projected into THIS land's
   *  column space (x < 0 / x > width-1 — just outside the local land). */
  neighbours: {
    left: Array<{ id: string; x: number }>;
    right: Array<{ id: string; x: number }>;
  };
}

declare global {
  interface Window {
    __terminal?: {
      state(): TerminalLandState;
      /** e2e only — teleport a being (e.g. next to an open edge so a
       *  crossing happens on demand instead of after minutes of wander).
       *  `hold` parks it (rest intent) so a reveal shot has time to land. */
      debugPlace(id: string, x: number, dir: 1 | -1, hold?: boolean): boolean;
      /** e2e only — live depth-cue readback (glow alphas + sway offsets). */
      debugDepth(): {
        monument: number | null;
        sun: number | null;
        moon: number | null;
        star: number | null;
        foliageX: number[];
      };
      /** e2e only — force the world-clock hour (0..24), null restores the real
       *  one. Returns what the sky did about it: midnight is otherwise only
       *  verifiable by waiting until midnight. */
      debugClock(hour: number | null): {
        hour: number;
        overridden: boolean;
        daylight: number;
      };
      /** e2e only — what the sky ACTUALLY drew, one frame after debugClock.
       *  A still cannot show an arc and a screenshot cannot tell a climbing
       *  sun from a composed one, so the bars need the numbers. Rows are
       *  fractional: the bodies move between cells, never snap to them. */
      debugSky(): {
        sunY: number | null;
        moonY: number | null;
        sunAlpha: number | null;
        moonAlpha: number | null;
        lampAlpha: number | null;
        /** Column the body is DRAWN in — may differ from the composed one when
         *  the mural swallowed that column (see skyArc.extractArc). */
        sunCol: number | null;
        moonCol: number | null;
        /** DRAWN sky colour, packed rgb — the daylight register's observable.
         *  A screenshot cannot tell a lit sky from a pack with a lighter bg. */
        skyInk: number;
        /** DRAWN tint of one far plane, or null if this land composed none.
         *  Proves the far planes recede into the CURRENT sky rather than into a
         *  dark constant — the noon depth-inversion this rung had to avoid. */
        farInk: number | null;
        /** Shared sky (spec B1/B2): this window's derived chain, its index,
         *  the host picks, and each wisp's DESK-space x + row — two windows'
         *  reads must agree on the desk position modulo the drift between the
         *  reads. */
        shared: {
          chain: string[];
          index: number;
          key: string;
          sunHost: number | null;
          moonHost: number | null;
          wisps: Array<{ row: number; deskX: number; localX: number; alpha: number }>;
        };
      };
      /** e2e only — throttle readback: the state the desk believes it is in
       *  and what that did to the ticker. Bar 5 ("alive but cheap") is not
       *  checkable from outside the renderer without this. */
      debugThrottle(): { state: string; started: boolean; maxFPS: number };
      /** e2e only — live liveliness readback. `dx`/`dy` are the DRAWN
       *  sub-cell offsets in local px (sprite minus ground truth), not the
       *  model x, so bob/gait/lean/beat can be asserted on screen. */
      debugBeings(): Array<{
        id: string;
        x: number;
        dx: number;
        dy: number;
        face: 1 | -1;
        moving: number;
        beat: boolean;
        intent: string;
      }>;
      /** e2e only — the proximity-label sites + their live fade alphas. */
      debugLabels(): Array<{ text: string; x: number; y: number; kind: string; alpha: number }>;
      /** e2e only — force footfall on a column (n passes); true if worn. */
      debugWear(col: number, passes: number): boolean;
      /** e2e only — place a mark immediately (bypasses maybeMark's
       *  cooldown/chance gates, mirrors debugWear's directness). */
      debugMark(col: number, agentId?: string): boolean;
      /** e2e only — the composed model's cell at (x,y): glyph + role
       *  provenance for on-screen sightings. */
      debugCellAt(x: number, y: number): { char: string; role: string } | null;
      /** e2e only — wisp positions (cells) + alphas, for drift readback. */
      debugClouds(): Array<{ x: number; alpha: number }>;
      /** e2e only — the marginalia reveal's live render state. The smoke
       *  proves revealAlpha's SHAPE; this proves the shape reaches the
       *  screen (and that the backing tracks the text). */
      debugReveal(): {
        open: boolean;
        tS: number;
        alpha: number;
        backAlpha: number;
        framed: boolean;
        lines: number;
        /** True while the caption rect occludes the closed-wing skyline
         *  layers (the inverted mask is applied). */
        skylineOccluded: boolean;
      } | null;
      /** e2e only — launcher-beat readback: the clickable sites, the door
       *  column, the live errand, who is away, and the last launch fired. */
      debugLaunch(): {
        /** `px`/`py` are the site centre in CANVAS CSS PIXELS — the harness
         *  drives real mouse input (Input.dispatchMouseEvent), which needs
         *  screen coords, and this is the same transform the pointer handler
         *  inverts. */
        targets: Array<{ x: number; y: number; px: number; py: number; name: string; appid: number }>;
        doorX: number | null;
        /** Site column the pointer is currently over (the affordance's state). */
        hoverX: number | null;
        errand: { agentId: string; targetX: number; name: string } | null;
        away: string[];
        last: { name: string; appid: number; agentId: string | null; ok: boolean; surface: string } | null;
      };
      /** e2e only — click a cell (the pointer path's own hit-test), so the
       *  harness drives the beat exactly as a mouse would. True = it hit. */
      debugClick(x: number, y: number): boolean;
      /** e2e only — T3 slice 2. The masthead's live content and ink. A
       *  screenshot cannot tell this window's `fg` from the old constant
       *  grey, nor a backing sized to the ink from one sized to the window. */
      debugMasthead(): {
        label: string;
        /** Cohort ids drawn right now — present, not away, COHORT order. */
        residents: string[];
        holdings: string;
        /** DRAWN inks, packed rgb: the label's and each resident's. */
        labelInk: number;
        residentInks: number[];
        /** Columns the backing covers, against the row's full width. Bar 3:
         *  a band would make these equal. */
        backCols: number;
        cols: number;
      };
      /** e2e only — T3 slice 2. The parting frame, per side: the front's
       *  position in rows from the ground line, and the DRAWN alpha of every
       *  wall row (indexed by distance) plus every jamb row. The part is a
       *  half-second event no still can hold. */
      /** e2e only — T4. The desk line a reflection would read right now, plus
       *  the resolved topology behind it. The organic trigger is ~50 seam
       *  crossings, so the bars need to see the line without waiting for it. */
      debugTopology(proposals?: boolean): Promise<{
        line: string;
        here: string;
        joined: { left?: string; right?: string };
        open: string[];
        closed: string[];
        occupancy: Array<{ wing: string; who: string[] }>;
        reachable: string[];
      }>;
      /** e2e only — T4. One Tier-2 dispatch for `agentId`.
       *  `'force'` (default) bypasses the threshold + rate-limit the way
       *  debugWear/debugMark bypass theirs; `'plain'` goes through the REAL
       *  gates, so the rate-limit can be observed refusing; `'night'` runs the
       *  sleep pass and mounts the banner for real. Plan steps are returned
       *  because "a plan can name the neighbour" is not checkable from a
       *  step COUNT. */
      debugReflect(agentId: string, mode?: 'force' | 'plain' | 'night'): Promise<{
        dispatched: boolean;
        skipReason?: string;
        reflection?: string;
        plan?: { text: string; steps: Array<{ kind: string; target?: string }> };
        counter: number;
        buffered: number;
        bannerOpen: boolean;
        bannerRect?: { x: number; y: number; w: number; h: number; screen: string; stage: string[]; ink: number | string };
      }>;
      /** e2e only — T4 follow-up. Mount the morning-dispatch banner with
       *  CANNED lines: bar 7 is a RENDER question, and routing it through a
       *  real Sonnet dispatch made every look cost a call and a wait. Same
       *  `mountMorningDispatch` the wake path calls. */
      debugBanner(lines?: number, text?: string): {
        x: number;
        y: number;
        w: number;
        h: number;
        screen: string;
        stage: string[];
        ink: number | string;
      };
      /** e2e only — T5. One sleeping+proposals reflection for `agentId`
       *  (threshold force-bypassed — organic is ~50 crossings), reporting
       *  the extracted candidate and the broker's verdict. */
      debugSleepSweep(agentId: string): Promise<{
        dispatched: boolean;
        skipReason?: string;
        proposal: { wing: string; accepted: boolean } | null;
        pending: { wing: string; agentName: string } | null;
      }>;
      /** e2e only — T5. Submit a proposal for `wing` over the REAL IPC and
       *  mount the banner if it was accepted — the render/tap surface
       *  without a Sonnet call (the debugBanner posture). */
      debugProposal(wing?: string): Promise<{
        accepted: boolean;
        reason: string | null;
        pending: { wing: string; agentName: string } | null;
        bannerOpen: boolean;
        bannerRect?: { x: number; y: number; w: number; h: number; screen: string; stage: string[]; ink: number | string };
      }>;
      /** e2e only — T5. Drive the SAME code path a pointer tap on a
       *  proposal bracket drives. */
      debugTapProposal(which: 'apply' | 'dismiss'): {
        tapped: boolean;
        pending: { wing: string; agentName: string } | null;
        bannerOpen: boolean;
      };
      /** e2e only — dungeon rung 1. The colony as THIS window sees it:
       *  the surface owner reports its live state, the undercroft its
       *  latest poll + rendered views. Numbers here are harness-facing
       *  ground truth, never rendered (the spec's no-numerals bar is
       *  about the world surface). */
      debugDelve(): {
        here: boolean;
        delverWing: string | null;
        state: {
          delvers: Array<{ id: string; name: string }>;
          targetPop: number;
          hoardGold: number;
          expeditionSeq: number;
          uptimeMs: number;
          nextDispatchAtUptimeMs: number;
          nextArrivalAtMs: number | null;
          active: {
            dispatcherId: string;
            partyIds: string[];
            startedAtMs: number;
            resolveAtMs: number;
            hazardAtMs: number | null;
            deadCount: number;
          } | null;
        } | null;
        dispatch: { agentId: string } | null;
        views: Array<{ id: string; x: number; below: boolean; visible: boolean }>;
        hazardGlyphs: number;
        /** Rung 2 — derived hoard stage + rendered pile glyph rows. */
        hoardStage: number;
        hoardGlyphs: number;
      };
      /** e2e only — dungeon rung 1. Make the next dispatch due NOW
       *  (jumps the uptime clock; the walk + everything after runs the
       *  REAL path — the debugWear directness). Surface owner only. */
      debugDelveDispatch(): boolean;
      /** e2e only — dungeon rung 1. Pull a live expedition's resolution
       *  (and hazard beat) to now. Surface owner only. */
      debugDelveResolve(): boolean;
      debugEdgeFrame(): Record<
        'left' | 'right',
        {
          open: boolean;
          parting: boolean;
          front: number;
          span: number;
          /** Wall-row alphas, ordered by distance from the ground line. */
          wall: number[];
          jamb: number[];
          jambGlyphs: string[];
        }
      >;
    };
  }
}

/** FNV-1a 32-bit — wing string → land seed (local copy; seed.ts's hash is
 *  module-private and profile-shaped). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic-enough runtime rng for wander/juice (NOT procedural layout). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function mountTerminalLand(
  host: HTMLDivElement,
  theme: Theme,
  terminalId: string,
  wing: string,
  mountOpts: { kind?: 'surface' | 'under' } = {},
): Promise<() => void> {
  /** Phase B: this window is the wing's UNDERCROFT — same wing, same pack,
   *  deep-strata compose (composeUnderLand), no sky/masthead/celestial, no
   *  left/right joins, no boot residents (beings arrive via the shaft, B3). */
  const isUnder = mountOpts.kind === 'under';
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: theme.palette.bg,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  host.appendChild(app.canvas);
  await waitForCozette();

  // Land dims from the window at the scaled cell size. Scale/anchor slice
  // (spec 2026-08-18): the surface geometry is FIXED from the window top
  // (DESK_SURFACE — skyH no longer derives from window height), and the world
  // is top-anchored, so equal window TOPS ⇒ equal ground row on screen at any
  // height — exactly the broker's join predicate. A window taller than the
  // canonical 20 rows shows `extraRows` of aperture rock below the model.
  const cols = Math.max(40, Math.floor(app.screen.width / (CW * WORLD_SCALE)));
  const rows = Math.max(isUnder ? 8 : 20, Math.floor(app.screen.height / (CH * WORLD_SCALE)));
  const skyH = DESK_SURFACE.skyH;
  const extraRows = isUnder ? 0 : rows - DESK_SURFACE.rows;
  /** The surface window above an undercroft is the canonical 20 rows — the
   *  global-y offset for depth continuation, shaft parity, and the renderer's
   *  strata glyph runs. */
  const UNDER_PARENT_ROWS = DESK_SURFACE.rows;
  const underComposeOpts = {
    width: cols,
    rows,
    yOffset: UNDER_PARENT_ROWS,
    surface: {
      skyH: DESK_SURFACE.skyH,
      surfaceBand: SURFACE_BAND,
      underH: UNDER_H,
    },
  };
  const seed = fnv1a(`terminal:${wing}`);
  // Memory stream (Tier-1 society): the desktop terminal gets the DB-backed
  // writer namespaced per wing; the web preview degrades to the null writer.
  // Each terminal window is its own renderer process → its own bootstrap.
  // The undercroft keeps the wing's LAND seed (seam agreement) but its own
  // memory cell — marks/wear placed underground must not resurface on the
  // wing's surface rows.
  const memSeed = isUnder ? fnv1a(`terminal:${wing}:under`) : seed;
  let memory = getCurrentMemoryWriter() ?? nullMemoryWriter;
  void bootstrapMemory({
    namespace: { cellId: cellIdFor(memSeed), libraryId: libraryIdFor(null) },
  }).then((r) => {
    memory = r.writer;
    // Persisted marks (the palace's exact read path) — the 12 most
    // recent; stored y is advisory, the display row re-derives from the
    // live surface inside addMarkView.
    for (const m of r.writer.placedMarksForCell(cellIdFor(memSeed)).slice(0, MARK_RENDER_CAP)) {
      addMarkView(m.agentId, m.text, m.location.x);
    }
    seedWear(r.writer); // fresh-process path (bootstrap cache was cold)
    loadDelve(); // dungeon rung 1 — re-read the colony with the real writer
  });
  // Each wing owns a DISTINCT slice of the library — same games in the same
  // order across terminals made t1/t2 read as copies, not as two wings.
  // Deterministic rotation by wing hash; real profile wings replace this in T2.
  const rot = fnv1a(wing) % SAMPLE_LAND.length;
  const games: LandGame[] = Array.from(
    { length: 5 },
    (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length],
  );
  // `mural: false` — Harry's anatomy pass, 2026-08-08: the mural was the one
  // component marked CUT. The composer keeps the whole mural path (every
  // mural smoke still drives it with `mural: true`, and the no-mural branch it
  // now takes is the one smoke-land-mural.mts already pins with a golden
  // hash); the desk simply stops asking for one. Reversible by this word.
  const composeOpts = { width: cols, skyH, surfaceBand: SURFACE_BAND, underH: UNDER_H, withPlayer: false, mural: false };
  /** Append the aperture-rock rows a taller-than-canonical window shows below
   *  the model (extraRows ≤ 0 → the model passes through untouched, so shipped
   *  520px windows are byte-identical). `surface` stays in the top 20 rows —
   *  beings, marks, wear, knit and the shaft descent never see the extension. */
  const stitchExtension = (m: LandModel, join?: { left?: number; right?: number } | null): LandModel => {
    if (extraRows <= 0) return m;
    const ext = composeLandExtension(seed, games, {
      width: cols,
      extraRows,
      ...(join ? { join } : {}),
    });
    return { ...m, height: m.height + extraRows, char: [...m.char, ...ext.char], role: [...m.role, ...ext.role] };
  };
  let model = isUnder
    ? composeUnderLand(seed, games, underComposeOpts)
    : stitchExtension(composeLand(seed, games, composeOpts));

  // Persistent transform container; the land SCENE is a swappable child so a
  // join can recompose the terrain without disturbing beings / edges / sparks.
  const world = new Container();
  world.scale.set(WORLD_SCALE);
  app.stage.addChild(world);

  // ── The masthead (T3 slice 2) ──────────────────────────────────────────
  // The window's title row, in Cozette, in THIS window's pack — replacing the
  // DOM strip's grey system-monospace-on-a-black-band, which was the one
  // surface slice 1's per-terminal packs never reached. A stage SIBLING of
  // `world`: it is chrome, so it must stay outside the glow filter (a bloomed
  // status row is mush) and under the scanline field. Added here, before the
  // fx block, so both of those hold by construction.
  const masthead = new Container();
  masthead.scale.set(WORLD_SCALE);
  masthead.visible = !isUnder; // the undercroft has no masthead — drag strip only (probe decision)
  app.stage.addChild(masthead);
  const mastBack = new Graphics();
  masthead.addChild(mastBack);
  const mastLabel = new BitmapText({
    text: wingLabel(wing),
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fg) },
  });
  mastLabel.x = MAST_PAD_COLS * CW;
  masthead.addChild(mastLabel);
  const mastHoldings = new BitmapText({
    text: holdingsRamp(games),
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgDim) },
  });
  masthead.addChild(mastHoldings);
  /** One text per resident, in their own accent. Rebuilt only when the set
   *  changes — `mastKey` is the gate, so a still desk writes nothing. */
  let mastResidents: BitmapText[] = [];
  let mastKey: string | null = null;
  /** Columns the backing covers. Bar 3's observable: it must never approach
   *  the row's full width — a band is the thing being removed. */
  let mastBackCols = 0;

  const drawMasthead = (ids: string[]): void => {
    for (const t of mastResidents) t.destroy();
    mastResidents = ids.map((id, i) => {
      const def = COHORT_BY_ID.get(id);
      const t = new BitmapText({
        text: def?.glyph ?? 'V',
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          // The same expression addBeing uses, so the glyph in the row is the
          // exact ink of the being standing on the ground below it.
          fill: def
            ? hexToInt(theme.palette[def.paletteKey])
            : hexToInt(theme.palette[roleKey(theme, beingAccentRole(id), 'fgBright')]),
        },
      });
      t.x = (MAST_PAD_COLS + wingLabel(wing).length + MAST_GAP_COLS + i * 2) * CW;
      masthead.addChild(t);
      return t;
    });
    const holdCols = mastHoldings.text.length;
    mastHoldings.x = (model.width - MAST_PAD_COLS - holdCols) * CW;
    // Backing behind the INK ONLY (the caption's unframed pattern): enough
    // ground to stay legible against a noon sky, no border, no band.
    const leftCols =
      wingLabel(wing).length + (ids.length > 0 ? MAST_GAP_COLS + ids.length * 2 - 1 : 0);
    mastBackCols = leftCols + holdCols;
    mastBack.clear();
    mastBack
      .rect(MAST_PAD_COLS * CW - 1, -1, leftCols * CW + 2, CH + 2)
      .rect(mastHoldings.x - 1, -1, holdCols * CW + 2, CH + 2)
      .fill({ color: hexToInt(theme.palette.bg), alpha: 0.72 });
  };
  drawMasthead([]);

  // Style-pack fx slot (docs/blueprints/style-pack.md), read through
  // themeFxList so string and array forms behave identically.
  //
  // 'glow': a single-pass bloom filter on `world` — bright glyphs halo, the
  // source stays unblurred. Explicitly destroyed on teardown (filters are
  // not stage children, so app.destroy's children sweep misses them).
  //
  // 'scanlines': a static CRT line field over the whole window, above the
  // world — a stage SIBLING, so the crisp lines composite over the bloom
  // (correct CRT layering). Oversized fixed rect — covers any resize
  // without a listener; a single static Graphics, so the 1 Hz wallpaper
  // throttle costs nothing. Destroyed with the stage on teardown.
  const fxList = themeFxList(theme);
  let glowFilter: Filter | null = null;
  if (fxList.includes('glow')) {
    glowFilter = createGlowFilter();
    world.filters = [glowFilter];
  }
  if (fxList.includes('scanlines')) {
    const scan = new Graphics();
    for (let y = 0; y < 2400; y += 3) scan.rect(0, y, 4000, 1);
    scan.fill({ color: 0x000000, alpha: 0.16 });
    app.stage.addChild(scan);
  }

  // The backdrop (ground body + daylight sky) hangs OUTSIDE `world`, and
  // therefore outside the glow filter. A bright-pass bloom exists to halo glyph
  // INK — glow.ts's own words, "dim texture never blooms" — and a sky lit
  // toward noon clears its THRESHOLD 0.2 across the entire band, so a glow pack
  // would bloom its whole sky. `world` has no camera (scale fixed at mount, x/y
  // moved only by layoutWorld), so mirroring the transform is the whole cost of
  // getting the sky out of the filter's input. A no-op on every shipped pack:
  // amber-crt is the only one with `glow` and its bg tops out at 0.078.
  const backdropHost = new Container();
  backdropHost.scale.set(WORLD_SCALE);

  /** Under windows: no sky fill (their surface[] is the cavern floor) and the
   *  strata glyph-run hash offset by the parent's rows, so a run straddling
   *  the vertical seam picks the same glyph on both sides. */
  const containerOpts = {
    skyBleed: SKY_BLEED_CELLS,
    ...(isUnder ? { noSky: true, strataYOffset: UNDER_PARENT_ROWS } : {}),
  };
  let scene = buildLandContainer(theme, model, containerOpts);
  let sceneContainer = scene.container;
  world.addChildAt(sceneContainer, 0);
  app.stage.addChildAt(backdropHost, 0); // behind `world`; scanlines stay above both
  backdropHost.addChild(scene.backdrop);

  /** Last sky ink pushed to the scene, so a tick that changes nothing writes
   *  nothing. -1 is the "no scene has been coloured yet" sentinel and cannot
   *  collide with a real packed colour — a recompose resets to it, because the
   *  fresh scene is baked at midnight and would otherwise sit at midnight
   *  colours all afternoon behind an unchanged gate. */
  let lastSkyInk = -1;

  // The arcing bodies. The terminal path DRAWS ITS OWN ☼ and ☾ (the baked
  // layers are hidden in hideBakedLayers) for the same reason the wisps do:
  // the mural composes last and clears its rect, so measured over 60 seeds at
  // desk options it evicts the ☼ outright in 42% of lands and leaves the median
  // survivor visible over just 33% of its travel. Bound to the composed cell,
  // the arc would simply be missing most of the time. `extractArc` re-places a
  // body into the clearest column when its own is mostly wall.
  //
  // null = the pack deleted this body (gameboy-dmg's blank sky) or the land has
  // no clear sky at all; nothing is drawn and the tick skips it.
  let sunView: { spec: ArcSpec; text: BitmapText } | null = null;
  let moonView: { spec: ArcSpec; text: BitmapText } | null = null;
  // Shared sky (2026-08-18): this window's horizontal chain, derived in
  // applyJoins from the same broker payload every window gets — all windows
  // agree without talking. Solo (length 1) leaves every sky path byte-
  // identical to the pre-slice behaviour (spec B3).
  let chain: DeskChainSpec = { order: [terminalId], index: 0, key: wing };
  // Variable widths (2026-08-18): the chain's desk-space is a prefix-sum
  // space, not index × width. Every window converts every member's px width
  // (broker ground truth) to cols with the SAME formula it uses for its own
  // canvas, so the whole chain agrees without talking. A missing width falls
  // back to this window's own cols — the shipped uniform assumption.
  let deskWidthsPx: Record<string, number> = {};
  let chainTotalCols = 0; // recomputed below; 0 only before the first pass
  let chainOffsetCols = 0;
  const colsOfPx = (px: number | undefined): number =>
    px === undefined ? model.width : Math.max(40, Math.floor(px / (CW * WORLD_SCALE)));
  const recomputeChainCols = (): void => {
    const { total, offsets } = chainOffsets(chain.order.map((id) => colsOfPx(deskWidthsPx[id])));
    chainTotalCols = total;
    chainOffsetCols = offsets[chain.index] ?? 0;
  };
  recomputeChainCols();
  const buildBodies = (): void => {
    for (const v of [sunView, moonView]) v?.text.destroy();
    sunView = null;
    moonView = null;
    if (isUnder) return; // no sky underground — no bodies, ever
    const omit = theme.landOmit ?? [];
    for (const role of ['sun', 'moon'] as const) {
      if (omit.includes(role)) continue; // a pack that deletes the body gets no arc
      // Chained, one window hosts each body; the rest show sky (spec B1).
      if (chain.order.length > 1 && bodyHost(chain.key, role, chain.order.length) !== chain.index) continue;
      const spec = extractArc(model, role);
      if (!spec) continue;
      const text = new BitmapText({
        text: role === 'sun' ? SUN_GLYPH : MOON_GLYPH,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: landRoleFill(theme, role) },
      });
      text.x = spec.col * CW;
      text.alpha = 0; // positioned + faded on the first tick
      world.addChildAt(text, 1); // same plane as the wisps and label overlays
      const view = { spec, text };
      if (role === 'sun') sunView = view;
      else moonView = view;
    }
  };

  // Top anchor (scale/anchor slice): the ground line sits at a fixed offset
  // from the window TOP — the same edge the broker's join predicate aligns —
  // so ground lines stay continuous across joined windows of any height. At
  // shipped sizes content exactly fills the window, so this equals the old
  // bottom anchor pixel-for-pixel; a shorter window crops the bottom (rock),
  // never the sky.
  const layoutWorld = (): void => {
    world.x = Math.floor((app.screen.width - model.width * CW * WORLD_SCALE) / 2);
    world.y = 0;
    backdropHost.x = world.x;
    backdropHost.y = world.y;
    // The masthead shares the land's column grid but not its bottom anchor —
    // it sits on the window's top edge, where the DOM strip used to.
    masthead.x = world.x;
    masthead.y = 0;
  };
  layoutWorld();

  // ── Worn paths (Tier 2): session-scoped footfall wear ──────────────────
  // Column entries accumulate; past WEAR_THRESHOLD the crust packs down
  // (▀ → ▔) — paths wear deeper where beings actually walk.
  let footfall = createFootfall();
  const refreshWear = (): void => {
    const crust = scene.layers.crust?.[0];
    if (crust) crust.text = crustLayerText(model, footfall.worn);
  };
  // Wear persists per wing with lazy half-life decay. Seed synchronously
  // when the bootstrap cache is warm (worn from frame one); the fresh-
  // process path re-seeds when the writer lands — the few pre-seed
  // footsteps dropped by the re-create are heuristic counts, accepted.
  let wearDirty = false;
  let wearFlushAt = 0;
  const seedWear = (w: MemoryWriter): void => {
    const nowMs = Date.now();
    const initial = new Map<number, number>();
    for (const r of w.landWearForCell()) {
      const c = decayedCount(r.count, r.updatedAt, nowMs);
      if (c >= 1) initial.set(r.col, c);
    }
    if (initial.size === 0) return;
    footfall = createFootfall(WEAR_THRESHOLD, initial);
    refreshWear();
  };
  const flushWear = (): void => {
    try {
      memory.flushLandWear(
        [...footfall.snapshot()].map(([col, count]) => ({ col, count })),
        Date.now(),
      );
    } catch {
      // Contention costs a lost flush, never a broken tick.
    }
  };
  seedWear(memory);

  // ── Marginalia: marks (marginalia-on-land slice) ───────────────────────
  // A being's completed intent occasionally earns a mark (marks.ts
  // maybeMark, on the re-pick clock); each mark wears its AUTHOR's accent
  // via the shared style table. Persisted as plan rows (recordMark); the
  // in-memory list is the render truth either way (null writer = session-
  // only, everything else identical).
  interface MarkView {
    col: number;
    agentId: string;
    note: string;
    text: BitmapText;
    /** elapsedS of the last note reveal; -Infinity = never revealed. */
    lastRevealAtS: number;
  }
  const marks: MarkView[] = [];
  const markLastAt = new Map<string, number>();
  const marksLayer = new Container(); // world-local; under edges + beings
  world.addChild(marksLayer);
  const addMarkView = (agentId: string, note: string, col: number): void => {
    const style = MARK_STYLES[agentId] ?? DEFAULT_MARK_STYLE;
    const text = new BitmapText({
      text: style.glyph,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette[roleKey(theme, style.role, style.fallback)]),
      },
    });
    text.x = col * CW;
    text.y = markDisplayRow(model.surface, col) * CH;
    marksLayer.addChild(text);
    marks.push({ col, agentId, note, text, lastRevealAtS: -Infinity });
    if (marks.length > MARK_RENDER_CAP) {
      const evicted = marks.shift();
      evicted?.text.destroy();
    }
  };
  /** Re-derive every mark's display row from the CURRENT surface (the
   *  stored y is advisory; a join's Hermite ramp moves rows near seams). */
  const drawMarks = (): void => {
    for (const m of marks) {
      m.text.x = m.col * CW;
      m.text.y = markDisplayRow(model.surface, m.col) * CH;
    }
  };

  // ── Marginalia: the reveal (being-proximity, ambient) ──────────────────
  // One slot per land: a passing being unfurls the nearest eligible note
  // as unframed text over a soft backing — eased in, held, eased out on
  // elapsedS via marks.ts revealAlpha (freezes
  // under throttle). While the slot is occupied, passes don't queue.
  const CAPTION_MAX_W = 24;
  let reveal: { mark: MarkView; startedAtS: number } | null = null;
  const caption = new BitmapText({
    text: '',
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fg) },
  });
  // Unframed backing, NOT a box: enough ground to read against, no border to
  // read as a bubble. Also closes the logged caption-backing defect — a note
  // used to draw straight over whatever was behind it.
  const CAPTION_PAD = 2;
  const captionBack = new Graphics();
  caption.visible = false;
  captionBack.visible = false;
  world.addChild(captionBack);
  world.addChild(caption);

  // Text-over-text is the one collision the translucent backing cannot solve:
  // a caption whose rect crosses the closed-wing skyline mixes with the wing
  // silhouette + id glyphs (logged 2026-08-08, T3 slice 1). The reveal is
  // nearer than the far-ridge plane, so it occludes — an inverted mask (a
  // scene-sized rect with the caption rect cut out) on the wingSil/wingMark
  // layers, applied once the envelope passes SKYLINE_OCCLUDE_ALPHA so the
  // half-risen backing covers the swap rather than the glyphs popping out
  // under an invisible caption.
  const SKYLINE_OCCLUDE_ALPHA = 0.35;
  const skylineHole = new Graphics();
  world.addChild(skylineHole);
  let skylineOccluded = false;
  const captionRect = (): { x: number; y: number; w: number; h: number } => ({
    x: caption.x - CAPTION_PAD,
    y: caption.y - CAPTION_PAD,
    w: caption.width + CAPTION_PAD * 2,
    h: caption.height + CAPTION_PAD * 2,
  });
  const maskSkyline = (rect: { x: number; y: number; w: number; h: number } | null): void => {
    skylineHole.clear();
    const silTexts = [...(scene.layers.wingSil ?? []), ...(scene.layers.wingMark ?? [])];
    if (rect === null) {
      for (const t of silTexts) t.mask = null;
      return;
    }
    // No skyline layers (the undercroft, or a land with no closed wings):
    // with nothing to adopt it as a mask, the filled hole would render as a
    // literal scene-sized white rect — the underground white flash.
    if (silTexts.length === 0) return;
    skylineHole
      .rect(-4 * CW, -40 * CH, (model.width + 8) * CW, (model.height + 80) * CH)
      .fill(0xffffff)
      .rect(rect.x, rect.y, rect.w, rect.h)
      .cut();
    for (const t of silTexts) t.mask = skylineHole;
  };

  // ── Proximity labels (raised-horizon slice, 2026-07-30) ────────────────
  // The baked label layer is hidden in the TERMINAL path only (web preview /
  // V0 keep always-on labels); per-site overlay texts — knit-glow ownership
  // pattern — fade in only while a being is near (siteLabels.ts maths). The
  // model keeps its 'label' cells: structureColumns/approach intents and the
  // Tier-1 scene prompt read them.
  interface SiteLabelView {
    site: LandSite;
    text: BitmapText;
    /** The un-eased fade position (siteLabels.stepLabelAlpha state). */
    alpha: number;
  }
  let siteLabelViews: SiteLabelView[] = [];
  // The terminal path hides two baked layers: labels (the proximity overlay
  // owns them) and the composer's STATIC being letters — the REAL cohort
  // walks here, and frozen impostors read as clutter next to it (Harry's
  // kill, 2026-07-30). Both stay in the model: labels are load-bearing for
  // intents; being cells are inert decoration on non-terminal surfaces.
  const hideBakedLayers = (): void => {
    for (const t of scene.layers.label ?? []) t.visible = false;
    for (const t of scene.layers.being ?? []) t.visible = false;
    // #19 slice 2: the drifting wisp layer owns the clouds on the terminal
    // path — the baked static layer stays in the model for other surfaces.
    for (const t of scene.layers.cloud ?? []) t.visible = false;
    // Same, for the arcing bodies: the terminal path draws its own ☼ and ☾ so
    // they can be re-placed into clear sky when the mural evicts the composed
    // ones (42% of lands at desk options). The baked layers stay in the model.
    for (const t of scene.layers.sun ?? []) t.visible = false;
    for (const t of scene.layers.moon ?? []) t.visible = false;
  };
  const buildSiteLabels = (): void => {
    for (const v of siteLabelViews) v.text.destroy();
    siteLabelViews = model.sites.map((site) => {
      const text = new BitmapText({
        text: site.text,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgDim) },
      });
      text.x = (site.x - Math.floor(site.text.length / 2)) * CW;
      text.y = site.y * CH;
      text.alpha = 0;
      world.addChildAt(text, 1); // above the scene (index 0), below edges/beings
      return { site, text, alpha: 0 };
    });
  };
  /** `desk` marks a shared-sky wisp: its wispX runs in DESK cells over the
   *  chain's combined width and the tick converts to this window's local
   *  columns — the run leaves one window's right edge as it enters the
   *  neighbour's left. Occlusion stays local (own blocked spans, own pack). */
  interface WispView { spec: WispSpec; text: BitmapText; desk: boolean }
  let wispViews: WispView[] = [];
  const buildWisps = (): void => {
    for (const w of wispViews) w.text.destroy();
    wispViews = [];
    if (isUnder) return; // no sky underground — no wisps, ever
    if ((theme.landOmit ?? []).includes('cloud')) return; // a pack that deletes clouds gets no wisps either
    if (chain.order.length > 1) {
      wispViews = sharedWisps(chain.key, chain.order.length, chainTotalCols).map((s) => {
        const spec: WispSpec = { ...s, blocked: blockedSpansAt(model, s.row) };
        const text = new BitmapText({
          text: spec.text,
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: landRoleFill(theme, 'cloud') },
        });
        text.y = spec.row * CH;
        text.alpha = 0; // positioned + faded on the first tick
        world.addChildAt(text, 1);
        return { spec, text, desk: true };
      });
      return;
    }
    wispViews = extractWisps(model, seed).map((spec) => {
      const text = new BitmapText({
        text: spec.text,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: landRoleFill(theme, 'cloud') },
      });
      text.y = spec.row * CH;
      text.alpha = 0; // positioned + faded on the first tick
      world.addChildAt(text, 1); // same plane as the label overlays
      return { spec, text, desk: false };
    });
  };
  let muralState: TerminalMuralState = 'idle';
  /** The mural's backing, once one has loaded — sky, so it follows the hour.
   *  Cleared on recompose: the mural is a child of the scene and dies with it. */
  let muralBacking: Graphics | null = null;
  const mountMural = (): void => {
    const spec = model.mural;
    if (!spec) { muralState = 'idle'; return; }
    if ((theme.landOmit ?? []).includes('mural')) { muralState = 'omitted'; return; }
    const host = sceneContainer; // capture: a recompose swaps this out — the dead-guard
    muralState = 'loading';
    loadMuralPixels(spec.appid)
      .then((px) => {
        if (host !== sceneContainer || host.destroyed) return; // late resolve, dead scene
        const cells = quantizeMural(px.data, px.w, px.h, spec.w, spec.h, muralQuantizeTargets(theme.palette));
        const mc = buildQuantizedMural(cells, spec.w, spec.h, theme);
        mc.x = spec.x * CW;
        mc.y = spec.y * CH;
        host.addChild(mc); // child of the scene → dies with it on recompose
        // The mural composes INTO the sky band, so its backing is sky: it is
        // tracked here and re-tinted with everything else. Resolving late (a
        // CDN fetch) it can miss the tick that set the hour, so it takes the
        // current sky immediately rather than waiting for the next change.
        muralBacking = mc.getChildByLabel(MURAL_BACKING) as Graphics | null;
        if (muralBacking && lastSkyInk !== -1) muralBacking.tint = lastSkyInk;
        muralState = 'ready';
      })
      .catch((err: unknown) => {
        if (host !== sceneContainer || host.destroyed) return; // late reject, dead scene
        muralState = err instanceof Error && err.name === 'SecurityError' ? 'failed-cors' : 'failed-load';
        console.warn('[terminal] mural failed:', err); // frame + cartouche stand alone
      });
  };

  hideBakedLayers();
  buildSiteLabels();
  buildWisps();
  buildBodies();
  mountMural();

  /** Wings with no open terminal window — the closed-wing skyline (land
   *  polish #19). Derived in applyJoins from the broker's allWings roster;
   *  empty until the first topology arrives (and always empty on the web
   *  preview, which has no broker). */
  let closedWings: string[] = [];

  // Launcher beat geometry — the clickable sites and the door the errand
  // walks to. Both are pure functions of the CURRENT model, so a join
  // recompose re-derives them (a moved door with a stale column would send
  // the runner into a hillside).
  let launchHotspots: LaunchTarget[] = launchTargets(model);
  let doorX: number | null = doorColumn(model.role);

  const recompose = (join: { left?: number; right?: number } | null): void => {
    model = isUnder
      ? composeUnderLand(seed, games, { ...underComposeOpts, ...(join ? { join } : {}) })
      : stitchExtension(
          composeLand(seed, games, {
            ...composeOpts,
            ...(join ? { join } : {}),
            ...(closedWings.length > 0 ? { skyline: closedWings } : {}),
          }),
          join,
        );
    world.removeChild(sceneContainer);
    // The backdrop was re-parented out of sceneContainer at mount, so the
    // children sweep below cannot reach it — destroy it by hand or every join
    // leaks a full-scene Graphics pair.
    scene.backdrop.destroy({ children: true });
    sceneContainer.destroy({ children: true });
    scene = buildLandContainer(theme, model, containerOpts);
    sceneContainer = scene.container;
    world.addChildAt(sceneContainer, 0);
    backdropHost.addChild(scene.backdrop);
    muralBacking = null; // died with the old scene; mountMural re-registers it
    lastSkyInk = -1; // the new scene is baked at midnight; re-colour it this tick
    layoutWorld();
    refreshWear(); // worn columns survive a join recompose
    drawMarks(); // marks re-sit on the reshaped surface
    hideBakedLayers();
    // The occluded skyline layers died with the old scene; re-mask the new ones.
    if (skylineOccluded) maskSkyline(captionRect());
    buildSiteLabels(); // rebuilt at alpha 0 — a reshaped land re-earns its reveals
    buildWisps(); // same — the composed clouds are new, so the wisps must be too
    // A join reshapes the terrain and moves the mural, so both the arc's floor
    // and the clearest column change. Rebuild, or the ☼ keeps arcing to the old
    // land's horizon in a column the new mural may have swallowed.
    buildBodies();
    mountMural(); // scene child was destroyed with sceneContainer; pixel cache makes this instant
    structureCols = structureColumns(model.role);
    launchHotspots = launchTargets(model);
    doorX = doorColumn(model.role);
    // The ground these glyphs sat on no longer exists. Re-anchor NOW rather
    // than on the next tick — the recompose is the event that invalidated
    // them, and a throttled or paused renderer may not tick for a long time.
    for (const k of knits) anchorKnitGlow(k);
  };

  // Approach targets: the labelled structure columns of the CURRENT model.
  let structureCols = structureColumns(model.role);

  // The joined neighbours' near-edge beings, per side (cross-edge
  // perception). Cleared when an edge closes; fed by the broker relay.
  const neighbourNear: { left: NearEdgeBeing[]; right: NearEdgeBeing[] } = { left: [], right: [] };
  let lastNearReport = '';
  let nearReportAt = 0;

  /** Live context for a BT pick. neighbourNear counts pull watch_edge
   *  decisively (society gravity — beings lean toward populated joins). */
  const intentCtx = (x: number): IntentContext => ({
    width: model.width,
    x,
    structureCols,
    edges,
    neighbourNear: { left: neighbourNear.left.length, right: neighbourNear.right.length },
  });

  // ── Edges: closed = wall; open = a threshold the frame has parted around ─
  let edges = { left: false, right: false };
  const edgeLayer = new Container(); // child of world → local cell space
  world.addChild(edgeLayer);
  /** Pulsing open-edge markers, animated in tick(). */
  const thresholds: BitmapText[] = [];
  /** T3 slice 2 — the parting frame (edgePart.ts). The wall is one text PER
   *  ROW so a front travelling out from the ground line can light rows
   *  independently; behind it a short jamb stands above the threshold. Both
   *  sets exist on both sides at all times and the alphas decide which is
   *  seen, so a topology message may rebuild them mid-part without a seam in
   *  the animation. */
  interface EdgeFrame {
    /** Wall rows, indexed by land row; `dist` is that row's distance from the
     *  ground line, precomputed because the surface moves under a recompose. */
    wall: Array<{ text: BitmapText; dist: number }>;
    /** Jamb rows, bottom (the bend) first. */
    jamb: BitmapText[];
    /** How far the front must travel to clear this column. */
    span: number;
    /** Live tween: null once the front has come to rest. */
    part: { startedAtS: number; opening: boolean } | null;
    /** The front's position last frame — the drawn state's ground truth. */
    front: number;
  }
  const frames: Record<'left' | 'right', EdgeFrame> = {
    left: { wall: [], jamb: [], span: 1, part: null, front: restFront(false, 1) },
    right: { wall: [], jamb: [], span: 1, part: null, front: restFront(false, 1) },
  };

  const drawEdges = (): void => {
    thresholds.length = 0;
    edgeLayer.removeChildren().forEach((c) => c.destroy());
    for (const side of ['left', 'right'] as const) {
      const f = frames[side];
      f.wall = [];
      f.jamb = [];
      const edgeCol = side === 'left' ? 0 : model.width - 1;
      const surfaceRow = model.surface[edgeCol];
      f.span = edgeSpan(model.height, surfaceRow);
      if (f.part === null) f.front = restFront(edges[side], f.span);

      // The wall — glyph for glyph what the single multi-line text used to
      // write (▌/▐ at the ground line, a thin rule every fourth row, else
      // ║), split per row so each can carry its own alpha.
      const wallInk = hexToInt(theme.palette.fg);
      for (let y = 0; y < model.height; y++) {
        const text = new BitmapText({
          text: y === surfaceRow ? (side === 'left' ? '▌' : '▐') : y % 4 === 2 ? '╎' : '║',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: wallInk },
        });
        text.x = edgeCol * CW;
        text.y = y * CH;
        edgeLayer.addChild(text);
        f.wall.push({ text, dist: Math.abs(y - surfaceRow) });
      }
      // The jamb — the frame left standing aside, in the wall's own ink so it
      // reads as the wall parted rather than as a new element.
      for (let j = 0; j < JAMB_H; j++) {
        const row = surfaceRow - (JAMB_ROW0 + j);
        if (row < 0) break;
        const text = new BitmapText({
          text: jambGlyph(side, j),
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: wallInk },
        });
        text.x = edgeCol * CW;
        text.y = row * CH;
        edgeLayer.addChild(text);
        f.jamb.push(text);
      }
      // The doorway itself, at walking height — the existing land edge
      // vocabulary (‹ ›), brightened + pulsing. Only when open.
      if (edges[side]) {
        const mark = new BitmapText({
          text: side === 'left' ? '‹' : '›',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
        });
        mark.x = edgeCol * CW;
        mark.y = (surfaceRow - 1) * CH;
        edgeLayer.addChild(mark);
        thresholds.push(mark);
      }
      applyEdgeFront(side);
    }
  };

  /** Push a side's front onto its glyphs. Called every frame while a part
   *  runs, and once per rebuild so a fresh frame is never drawn at the wrong
   *  state for even one tick. */
  const applyEdgeFront = (side: 'left' | 'right'): void => {
    const f = frames[side];
    for (const w of f.wall) w.text.alpha = wallAlpha(w.dist, f.front);
    f.jamb.forEach((t, j) => {
      t.alpha = jambAlpha(j, f.front);
    });
  };

  /** Start the frame parting (or closing) on `side`. Mid-flight reversals
   *  restart from the current front rather than snapping, so a window dragged
   *  in and straight back out never flashes a whole wall. */
  const startPart = (side: 'left' | 'right', opening: boolean): void => {
    const f = frames[side];
    const from0 = restFront(!opening, f.span);
    const to = restFront(opening, f.span);
    if (f.front === to) return;
    // Enter the curve where the front already sits (partEaseInv), so the
    // remaining travel keeps EDGE_PART_S's feel instead of snapping.
    f.part = {
      startedAtS: elapsedS - partEaseInv((f.front - from0) / (to - from0)) * EDGE_PART_S,
      opening,
    };
  };

  // ── Phase B: the vertical seam (undercroft dock) ──────────────────────────
  // A vjoin-free window draws NOTHING here (the frozen bar: today's look,
  // byte-identical). On dock, a seam-row wall ('─' per column) parts OUTWARD
  // from the shaft column — partFront/partEase/wallAlpha reused with dist in
  // COLUMNS — and behind the front a brief glow brightens the strata it
  // revealed (knit's column-wise sibling, vKnitCols). On undock the wall
  // sweeps closed, holds a beat, fades, and is destroyed: both rest states
  // carry zero objects. Own layer — drawEdges() wipes edgeLayer wholesale.
  const vseamLayer = new Container();
  world.addChild(vseamLayer);
  const vShaftX = shaftColumn(cols, games.filter((g) => g.state !== 'abandoned').length);
  const vSeamRow = (): number => (isUnder ? 0 : model.height - 1);
  const VSEAM_SEAL_HOLD_S = 0.35;
  const VSEAM_SEAL_FADE_S = 0.8;
  interface VSeamState {
    wall: Array<{ text: BitmapText; dist: number }>;
    span: number;
    front: number;
    part: { startedAtS: number; opening: boolean } | null;
    /** Close finished at this time → linger, fade, destroy. */
    sealedAtS: number | null;
    /** Columns (as |col-shaft| indices) the glow has already fired for. */
    glowedTo: number;
  }
  let vseam: VSeamState | null = null;
  let vThresholds: BitmapText[] = [];
  /** One-shot strata brightenings behind the opening front. */
  const vglows: Array<{ text: BitmapText; bornAt: number }> = [];
  let vEdgeOpen = false; // surface: undercroft docked below · under: surface above

  const destroyVSeam = (): void => {
    if (!vseam) return;
    for (const w of vseam.wall) w.text.destroy();
    vseam = null;
  };
  const setVThresholds = (open: boolean): void => {
    for (const t of vThresholds) t.destroy();
    vThresholds = [];
    if (!open) return;
    // The shaft mouth, marked in the ‹ › vocabulary turned vertical: ▾ on the
    // surface floor, ▴ on the undercroft ceiling (both atlas-covered).
    const mark = new BitmapText({
      text: isUnder ? '▴' : '▾',
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
    });
    mark.x = vShaftX * CW;
    mark.y = vSeamRow() * CH;
    vseamLayer.addChild(mark);
    vThresholds.push(mark);
  };
  const applyVSeamAlphas = (fade: number): void => {
    if (!vseam) return;
    for (const w of vseam.wall) w.text.alpha = wallAlpha(w.dist, vseam.front) * fade;
  };
  const startVSeam = (opening: boolean): void => {
    const span = rowSpan(model.width, vShaftX);
    if (!vseam) {
      const row = vSeamRow();
      const wallInk = hexToInt(theme.palette.fg);
      const wall: VSeamState['wall'] = [];
      for (let x = 0; x < model.width; x++) {
        if (x === vShaftX) continue; // the shaft mouth never walls over
        const text = new BitmapText({
          text: '─',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: wallInk },
        });
        text.x = x * CW;
        text.y = row * CH;
        text.alpha = 0;
        vseamLayer.addChild(text);
        wall.push({ text, dist: Math.abs(x - vShaftX) });
      }
      vseam = { wall, span, front: restFront(!opening, span), part: null, sealedAtS: null, glowedTo: 0 };
    }
    vseam.sealedAtS = null;
    const from0 = restFront(!opening, span);
    const to = restFront(opening, span);
    // Mid-flight reversal resumes from the current front (startPart's move).
    vseam.part = {
      startedAtS: elapsedS - partEaseInv((vseam.front - from0) / (to - from0)) * EDGE_PART_S,
      opening,
    };
    applyVSeamAlphas(1);
  };
  /** Advance the seam tween + glow + threshold pulse. Rest states cost one
   *  null check. */
  const updateVSeam = (): void => {
    for (let i = vglows.length - 1; i >= 0; i--) {
      const g = vglows[i];
      const q = (elapsedS - g.bornAt) / KNIT_GLOW_S;
      if (q >= 1) {
        g.text.destroy();
        vglows.splice(i, 1);
      } else g.text.alpha = 0.85 * (1 - q);
    }
    for (const t of vThresholds) t.alpha = 0.55 + 0.25 * Math.sin(elapsedS * 2.2);
    if (!vseam) return;
    if (vseam.part) {
      const tS = elapsedS - vseam.part.startedAtS;
      vseam.front = partFront(tS, vseam.span, vseam.part.opening);
      if (vseam.part.opening) {
        // The glow rides the front: as each column pair is revealed, its
        // strata glyph brightens once and fades in place.
        const upto = Math.min(vseam.span, Math.floor(vseam.front));
        const row = vSeamRow();
        for (let idx = vseam.glowedTo; idx <= upto; idx++) {
          for (const col of vKnitCols(vShaftX, model.width, idx)) {
            const role = model.role[row]?.[col];
            const glyph =
              role !== undefined && role !== 'sky'
                ? (strataMaterialGlyph(role, col, row + (isUnder ? UNDER_PARENT_ROWS : 0)) ?? model.char[row][col])
                : null;
            if (glyph === null || glyph === ' ') continue;
            const text = new BitmapText({
              text: glyph,
              style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fg) },
            });
            text.x = col * CW;
            text.y = row * CH;
            text.alpha = 0.85;
            vseamLayer.addChild(text);
            vglows.push({ text, bornAt: elapsedS });
          }
        }
        vseam.glowedTo = upto + 1;
      }
      if (partDone(tS)) {
        vseam.front = restFront(vseam.part.opening, vseam.span);
        const wasOpening = vseam.part.opening;
        vseam.part = null;
        if (wasOpening) {
          destroyVSeam(); // rest-open = nothing (the rock IS continuous)
          return;
        }
        vseam.sealedAtS = elapsedS; // rest-closed lingers, then fades away
      }
      applyVSeamAlphas(1);
      return;
    }
    if (vseam.sealedAtS !== null) {
      const tS = elapsedS - vseam.sealedAtS;
      if (tS <= VSEAM_SEAL_HOLD_S) return;
      const fade = 1 - (tS - VSEAM_SEAL_HOLD_S) / VSEAM_SEAL_FADE_S;
      if (fade <= 0) {
        destroyVSeam();
        return;
      }
      applyVSeamAlphas(fade);
    }
  };
  /** The vjoin transition, from either broadcast branch of applyJoins. */
  const applyVEdge = (open: boolean): void => {
    if (open === vEdgeOpen) return;
    vEdgeOpen = open;
    startVSeam(open);
    setVThresholds(open);
  };

  /** Cache key of the current scene inputs (join seeds + closed-wing set) —
   *  recompose only when it changes. Initialised to the no-join, no-skyline
   *  key so a broker-less boot (web preview) never recomposes; the first
   *  desktop topology carries allWings and recomposes the skyline in. */
  let joinKey = '||';
  const applyJoins = (
    joins: TerminalJoin[],
    wings: Record<string, string>,
    allWings?: string[],
    vjoins?: TerminalVJoin[],
    widths?: Record<string, number>,
  ): void => {
    lastTopology = { joins, wings, ...(allWings && { allWings }), ...(vjoins && { vjoins }) };
    deskWidthsPx = widths ?? {};
    // Dungeon rung 1: every window (surface AND under) derives the one
    // delver wing from the same broadcast — nobody has to talk.
    maybeInitDelvers(allWings, wings);
    if (isUnder) {
      // The undercroft's left/right edges are rock, always (v0's vertical
      // pair). Its terrain instead tracks its PARENT's horizontal joins:
      // the shared relief profile ramps at the parent's seams, so the
      // corner columns of the under window agree with what the window
      // above composed. Recompose only when those change.
      const parent = (vjoins ?? []).find((v) => v.bottom === terminalId)?.top ?? null;
      const pl = parent ? joins.find((j) => j.right === parent)?.left : undefined;
      const pr = parent ? joins.find((j) => j.left === parent)?.right : undefined;
      const join: { left?: number; right?: number } = {};
      if (pl && wings[pl]) join.left = fnv1a(`terminal:${wings[pl]}`);
      if (pr && wings[pr]) join.right = fnv1a(`terminal:${wings[pr]}`);
      applyVEdge(parent !== null); // the ceiling parts when the surface docks above
      const key = `under|${parent ?? ''}|${join.left ?? ''}|${join.right ?? ''}`;
      if (key !== joinKey) {
        joinKey = key;
        recompose(join.left === undefined && join.right === undefined ? null : join);
      }
      return;
    }
    const prev = edges;
    edges = {
      left: joins.some((j) => j.right === terminalId),
      right: joins.some((j) => j.left === terminalId),
    };
    if (!edges.left) neighbourNear.left = [];
    if (!edges.right) neighbourNear.right = [];
    const leftNb = joins.find((j) => j.right === terminalId)?.left;
    const rightNb = joins.find((j) => j.left === terminalId)?.right;
    const join: { left?: number; right?: number } = {};
    if (leftNb && wings[leftNb]) join.left = fnv1a(`terminal:${wings[leftNb]}`);
    if (rightNb && wings[rightNb]) join.right = fnv1a(`terminal:${wings[rightNb]}`);
    const open = new Set(Object.values(wings));
    closedWings = (allWings ?? []).filter((w) => w !== wing && !open.has(w)).sort();
    // Shared sky: the chain can change without this window's own joins
    // changing (a third window docking on the FAR side of a neighbour), so
    // it is tracked beside joinKey, not inside it.
    const prevChainKey = chain.key;
    // Variable widths: the chain's column layout can change without the key
    // changing (same wings, a member respawned at another width), so it is
    // tracked beside the key.
    const prevChainColsKey = `${chainTotalCols}:${chainOffsetCols}`;
    chain = deskChain(terminalId, joins, wings);
    recomputeChainCols();
    const key = `${join.left ?? ''}|${join.right ?? ''}|${closedWings.join(',')}`;
    if (key !== joinKey) {
      joinKey = key;
      recompose(join.left === undefined && join.right === undefined ? null : join);
      if (edges.left && !prev.left) startKnit('left');
      if (edges.right && !prev.right) startKnit('right');
    } else if (chain.key !== prevChainKey || `${chainTotalCols}:${chainOffsetCols}` !== prevChainColsKey) {
      // No terrain change, but the desk's sky membership moved: re-author
      // the shared wisps and re-run the host pick (spec B1/B4).
      buildWisps();
      buildBodies();
    }
    // The frame parts on the same transition the knit fires on, and closes
    // again when a window is dragged away.
    for (const side of ['left', 'right'] as const) {
      if (edges[side] !== prev[side]) startPart(side, edges[side]);
    }
    // Phase B: the floor parts when an undercroft docks below.
    applyVEdge((vjoins ?? []).some((v) => v.top === terminalId));
    drawEdges();
  };

  // ── Beings: the minimal walker runtime (sub-cell, juiced) ──────────────
  const beings = new Map<string, Being>();
  /** One-shot ✦ sparks at crossing thresholds: [text, bornAt]. */
  const sparks: Array<{ text: BitmapText; bornAt: number }> = [];
  /** One-shot knit sweeps: a glow that runs inward from a newly-joined seam. */
  interface KnitSweep {
    side: 'left' | 'right';
    bornAt: number;
    /** Sweep head + trail glyphs (KNIT_TRAIL order), repositioned per tick. */
    trail: BitmapText[];
    /** One brightened crust glyph per seam column, fading in place. */
    glow: BitmapText[];
  }
  const knits: KnitSweep[] = [];
  let knitsFired = 0;
  const rng = makeRng(fnv1a(`beings:${terminalId}`));
  let elapsedS = 0;
  /** e2e only — force the world-clock hour (0..24), or null for the real one.
   *  Night is otherwise unverifiable except by waiting for it. */
  let clockOverrideH: number | null = null;

  /** Put a knit's glow on the CURRENT ground: position, glyph (wear included)
   *  and fade. The single writer — startKnit, the tick and recompose all go
   *  through it, so the glyphs can never be left on terrain that no longer
   *  exists. recompose calls it because waiting for the next tick is not free:
   *  under the wallpaper throttle that is up to a second, and paused it is
   *  forever. Hoisted so recompose (declared earlier) can reach it. */
  function anchorKnitGlow(k: KnitSweep): void {
    const q = (elapsedS - k.bornAt) / KNIT_GLOW_S;
    k.glow.forEach((g, i) => {
      const cell = knitGlowCell(model, footfall.worn, k.side, i);
      if (!cell) {
        g.alpha = 0; // no ground in that column — nothing to light
        return;
      }
      g.x = cell.col * CW;
      g.y = cell.row * CH;
      g.text = cell.glyph;
      g.alpha = 0.75 * Math.max(0, 1 - q);
    });
  }

  const surfaceLocalY = (x: number): number => {
    const cx = Math.min(model.width - 1, Math.max(0, Math.floor(x)));
    return (model.surface[cx] - 1) * CH;
  };

  const addBeing = (id: string, x: number, dir: 1 | -1, entering = false): Being => {
    const def = COHORT_BY_ID.get(id);
    const persona = LAND_PERSONAS[id] ?? DEFAULT_LAND_PERSONA;
    const surfaceRow = model.surface[Math.round(x)] ?? 0;
    const text = new BitmapText({
      text: def?.glyph ?? 'V',
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        // Cohort members wear their REAL accent (the cell/ladder identity);
        // unknown ids keep the T0 hash-picked accent (defensive path).
        fill: def
          ? hexToInt(theme.palette[def.paletteKey])
          : hexToInt(theme.palette[roleKey(theme, beingAccentRole(id), 'fgBright')]),
      },
    });
    if (entering) text.alpha = 0;
    world.addChild(text); // world space → rides WORLD_SCALE for free
    const being: Being = {
      id,
      glyph: def?.glyph ?? 'V',
      x,
      dir,
      speed: persona.speed[0] + rng() * (persona.speed[1] - persona.speed[0]),
      intent: pickIntent(rng, intentCtx(x), persona.bias),
      nextIntentAt: elapsedS + (INTENT_S[0] + rng() * INTENT_S[1]) * persona.intentWindowMult,
      pausedUntil: 0,
      crossCooldownUntil: 0,
      face: dir,
      lean: dir * LEAN_PX,
      moving: 0,
      // Seeded phases (fnv1a, like bobPhase) so nobody breathes or steps in
      // sync; the beat clock jitters off the same rng() stream as speed.
      gaitPhase: (fnv1a(`${id}/gait`) % 628) / 100,
      bobPhase: (fnv1a(id) % 628) / 100,
      idleBeat: null,
      idleBeatAt: elapsedS + IDLE_BEAT_S[0] + rng() * IDLE_BEAT_S[1],
      lastCol: Math.round(x),
      text,
      pending: false,
      exitingSince: null,
      exitDy: 0,
      climb: null,
      enteringSince: entering ? elapsedS : null,
      pendingArrivalMark: entering,
      mind: reconstructMind(id, Math.round(x), surfaceRow),
      persona,
      throughSince: null,
      away: null,
      returningSince: null,
    };
    beings.set(id, being);
    return being;
  };

  const removeBeing = (id: string): void => {
    const b = beings.get(id);
    if (!b) return;
    b.text.destroy();
    beings.delete(id);
  };

  const spawnSpark = (side: 'left' | 'right' | 'down' | 'up'): void => {
    // Vertical crossings spark at the shaft mouth, not a side edge.
    const edgeCol =
      side === 'left' ? 0 : side === 'right' ? model.width - 1 : vShaftX;
    const spark = new BitmapText({
      text: '✦',
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
    });
    spark.x = edgeCol * CW;
    spark.y = surfaceLocalY(edgeCol) - CH; // a breath above the threshold
    world.addChild(spark);
    sparks.push({ text: spark, bornAt: elapsedS });
  };

  // ── The launcher beat ──────────────────────────────────────────────────
  // Click a site → the door lights, the nearest being turns and walks to it,
  // Steam fires when they arrive (or at ERRAND_CAP_S, whichever is first).
  // The runner then steps THROUGH the door and is away until you come back
  // to the desk. Spec: docs/superpowers/specs/2026-08-06-launcher-beat-design.md.
  //
  // The errand is user-driven by construction: `pickIntent` never scores the
  // `errand` kind, so the world can never launch a game on its own.

  /** The live errand, cleared the moment Steam fires (one runner per window;
   *  a second click before that is ignored). */
  let errand: {
    target: LaunchTarget;
    targetX: number;
    agentId: string;
    startedS: number;
    /** Steam already fired (the cap expired mid-walk) — the runner keeps
     *  walking and still steps through the door properly. */
    fired: boolean;
  } | null = null;
  /** Hovered site column — pins that label open and flips the cursor. */
  let hoverX: number | null = null;
  /** e2e readback for the beat (debugLaunch). */
  let lastLaunch: { name: string; appid: number; agentId: string | null; ok: boolean; surface: string } | null = null;

  /** A being who could run an errand right now: here, visible, not already
   *  mid-handoff, mid-door or out playing. */
  const canRun = (b: Being): boolean =>
    b.mind.present &&
    !b.pending &&
    b.exitingSince === null &&
    b.throughSince === null &&
    b.away === null &&
    b.returningSince === null &&
    // One scripted walk at a time: a being mid-errand or mid-dispatch
    // holds nextIntentAt=Infinity, and hijacking it would strand the
    // other beat's completion.
    b.intent.kind !== 'errand' &&
    b.intent.kind !== 'dispatch';

  /** Nearest eligible being to the goal column, or null on an empty land. */
  const pickRunner = (goalX: number): Being | null => {
    let best: Being | null = null;
    let bestD = Infinity;
    for (const b of beings.values()) {
      if (!canRun(b)) continue;
      const d = Math.abs(b.x - goalX);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };

  /** Fire Steam, and write the launch to the memory stream. `runner` is null
   *  only on a land with nobody home — the beat degrades to a plain launch
   *  (no memory row: an observation belongs to whoever had it). The MARK is
   *  not written here: it belongs at the door, so stepThrough owns it. */
  const fireLaunch = (runner: Being | null, target: LaunchTarget, col: number): void => {
    void launchGame({ appid: target.appid, name: target.name }).then((ev) => {
      lastLaunch = {
        name: target.name,
        appid: target.appid,
        agentId: runner?.id ?? null,
        ok: ev.ok,
        surface: ev.surface,
      };
      // eslint-disable-next-line no-console
      console.log(
        `[land] launch ${ev.surface} appid=${target.appid} ok=${ev.ok} name="${target.name}" runner=${runner?.id ?? 'none'}`,
      );
    });
    if (!runner) return;
    recordLaunch(memory, {
      agentId: runner.id,
      name: target.name,
      appid: target.appid,
      col,
      row: model.surface[col] ?? 0,
      whenMs: Date.now(),
    });
  };

  /** The runner goes in: a mark at the door, then the fade through it. A
   *  launch ALWAYS leaves a mark (maybeMark's odds + cooldown are for ambient
   *  punctuation; this is an event). An existing mark at the door is replaced
   *  rather than stacked — the dedupe rule, applied by hand. */
  const stepThrough = (b: Being, target: LaunchTarget): void => {
    const col = Math.min(model.width - 1, Math.max(0, Math.round(b.x)));
    for (let i = marks.length - 1; i >= 0; i--) {
      if (Math.abs(marks[i].col - col) <= MARK_DEDUPE_COLS) {
        marks[i].text.destroy();
        marks.splice(i, 1);
      }
    }
    const note = launchNote(b.id, target.name, rng);
    markLastAt.set(b.id, elapsedS);
    recordMark(memory, { agentId: b.id, note, col, row: model.surface[col] });
    addMarkView(b.id, note, col);
    b.throughSince = elapsedS;
  };

  /** Click landed on a site: light the door, send someone. */
  const beginErrand = (target: LaunchTarget): void => {
    if (errand) return; // one runner at a time; resolves when Steam fires
    // The door is where the beat lands — but a wing's slice need not contain
    // a `mastered` game, so a land without a monument sends the runner into
    // the game's own structure instead.
    const goalX = doorX ?? target.x;
    const runner = pickRunner(goalX);
    if (!runner) {
      fireLaunch(null, target, goalX);
      return;
    }
    runner.intent = { kind: 'errand', targetX: goalX };
    runner.pausedUntil = 0; // no hesitation beat — they were asked to go
    runner.nextIntentAt = Infinity; // no re-pick until the errand resolves
    errand = { target, targetX: goalX, agentId: runner.id, startedS: elapsedS, fired: false };
  };

  /** The runner reached the door: fire if the cap hasn't already, then in
   *  they go. */
  const completeErrand = (b: Being): void => {
    if (!errand) return;
    const { target, fired } = errand;
    errand = null;
    if (!fired) fireLaunch(b, target, Math.round(b.x));
    stepThrough(b, target);
  };

  /** Out of the door, back onto the land. */
  const returnFromAway = (b: Being): void => {
    if (!b.away) return;
    const col = Math.min(model.width - 1, Math.max(0, b.away.col));
    recordReturn(memory, {
      agentId: b.id,
      name: b.away.game,
      col,
      row: model.surface[col] ?? 0,
      whenMs: Date.now(),
    });
    b.away = null;
    b.x = col;
    b.lastCol = col;
    b.returningSince = elapsedS;
    b.text.visible = true;
    b.text.alpha = 0;
    b.intent = { kind: 'rest' };
    b.pausedUntil = elapsedS + RETURN_S;
    b.nextIntentAt = elapsedS + RETURN_S + 1;
  };

  /** Attention on this window — the return signal. There is no game-exit
   *  signal available on macOS (the throttle's fullscreen probe is Win32-only
   *  and never reaches terminal windows), so the beat uses "you came back to
   *  the desk" instead, floored so a stray mouse move right after the click
   *  cannot yank anyone back. The spec records this honestly; a real exit
   *  signal drops straight in here. */
  const onAttention = (): void => {
    for (const b of beings.values()) {
      if (b.away && Date.now() - b.away.sinceMs >= AWAY_FLOOR_MS) returnFromAway(b);
    }
  };

  // Pointer input — the desk's first. Cell space comes from the SAME
  // transform the world is drawn with (never a second copy of the maths).
  const cellAt = (e: PointerEvent): { x: number; y: number } => ({
    x: Math.floor((e.offsetX - world.x) / (CW * WORLD_SCALE)),
    y: Math.floor((e.offsetY - world.y) / (CH * WORLD_SCALE)),
  });
  const onPointerMove = (e: PointerEvent): void => {
    const c = cellAt(e);
    const hit = hitLaunchTarget(launchHotspots, c.x, c.y);
    hoverX = hit ? hit.x : null;
    app.canvas.style.cursor = hit ? 'pointer' : 'default';
    onAttention();
  };
  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    // T5: the proposal brackets outrank the launch hotspots while a
    // proposal banner is up — same input path, tested first.
    const pHit = dispatchBanner?.proposalHit(e.offsetX, e.offsetY) ?? null;
    if (pHit && tapProposal(pHit)) return;
    const c = cellAt(e);
    const hit = hitLaunchTarget(launchHotspots, c.x, c.y);
    if (hit) beginErrand(hit);
    else onAttention();
  };
  const onWindowFocus = (): void => onAttention();
  app.canvas.addEventListener('pointermove', onPointerMove);
  app.canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('focus', onWindowFocus);

  // Wallpaper throttle. The desk subscribed to this NOWHERE before — it was
  // window-mode-only surface — so a wallpapered desk would have run at full
  // FPS forever. Two jobs:
  //   1. the ticker ladder (PixiApp.ts's, via tickerFor)
  //   2. a wake counts as ATTENTION. In wallpaper mode the desk is
  //      click-through and 'accessory', so pointer AND focus are both dead;
  //      without this the 30-min ceiling is the only way an away being
  //      returns. Gated on !isInitial — see deskThrottle.ts.
  // ── T4: Tier-2 reflection on the desk ──────────────────────────────────
  // The desk has never dispatched Tier-2 (STATE.md's T2 entry: "DEFERRED:
  // Tier-2 / topology reflection (T4 arc)") — but routeTier1 has been
  // accruing `reflectionCounter` on every seam arrival all along, and
  // carriedFromMind carries it ACROSS seams, so a being's counter measures
  // its whole journey over the desk. This is the consumer.
  //
  // Gates are the ROUTER'S and are not touched here: threshold 150 (≈50
  // arrivals at importance 3) and the per-agent one-per-real-hour limit. In
  // practice the threshold binds long before the limit does.
  /** The raw broker topology payload, kept so a reflection can describe the
   *  desk. applyJoins only keeps the derived bits it renders from. */
  let lastTopology: { joins: TerminalJoin[]; vjoins?: TerminalVJoin[]; wings: Record<string, string>; allWings?: string[] } = {
    joins: [],
    wings: {},
  };
  /** Reflections produced while asleep, drained by the wake banner. */
  const nightDispatch: MorningDispatchLine[] = [];
  /** T5 — the proposal THIS window won overnight, if any. Session-scoped
   *  mirror of the broker's slot: set on an accepted candidate, cleared on
   *  apply, dismiss (tap or timeout) and the next sleeping transition. */
  let pendingProposal: { wing: string; agentName: string } | null = null;
  let dispatchBanner: MorningDispatchHandle | null = null;
  /** Mount the wake banner and KEEP THE HANDLE HONEST: the overlay's own
   *  auto-dismiss is internal, so `onDismiss` is the only thing that drops
   *  our reference when the 30 s runs out. Without it `bannerOpen` stays
   *  true forever after the first banner — which is what made T4's bar 7
   *  read as a render defect. */
  const showDispatch = (lines: MorningDispatchLine[], proposal?: { wing: string }): void => {
    dispatchBanner?.dismiss();
    dispatchBanner = mountMorningDispatch({
      app,
      theme,
      lines,
      // On the desk's own cell grid: the banner was the one surface still
      // drawn at 1x while the land, the masthead and the marginalia are all
      // at WORLD_SCALE, so it read as pasted on rather than as part of the
      // terminal. Row 2 leaves the masthead its row 0 plus a blank row.
      grid: { scale: WORLD_SCALE, topRow: BANNER_TOP_ROW },
      ...(proposal && {
        proposal: { rows: proposalDispatchRows(proposal.wing), hit: proposalHitSpans(proposal.wing) },
      }),
      onDismiss: () => {
        dispatchBanner = null;
        // The 30 s timeout IS a dismissal (Harry's call: a missed proposal
        // evaporates). A tap clears pendingProposal FIRST, so this only
        // fires the IPC for the timeout / implicit path.
        if (pendingProposal) {
          pendingProposal = null;
          void terminalDismissProposal().catch(() => undefined);
        }
      },
    });
  };

  /** The desk as this window sees it, roster included. Pulled at dispatch
   *  time — see the broker's `terminal:getRoster` comment. */
  const deskSnapshot = async (): Promise<DeskTopology> => {
    const roster = await getTerminalRoster();
    return deskTopology({
      terminalId,
      wing,
      joins: lastTopology.joins,
      wings: lastTopology.wings,
      allWings: lastTopology.allWings,
      roster,
      names: Object.fromEntries(COHORT.map((d) => [d.id, d.name])),
      // Phase B: the vertical pair reaches the reflection line; never a
      // move_to target (reachableWings is untouched by construction).
      vjoins: lastTopology.vjoins,
      ...(isUnder ? { kind: 'under' as const } : {}),
    });
  };

  /** T5 — one tap on a proposal bracket. Clears the local mirror BEFORE
   *  dismissing the banner, so the banner's own onDismiss (the timeout /
   *  implicit path) never double-fires the dismiss IPC. Apply's failure
   *  modes (wing opened by hand overnight, no room) fizzle silently — the
   *  quiet no-op the spec promises. */
  const tapProposal = (which: 'apply' | 'dismiss'): boolean => {
    if (!pendingProposal || !dispatchBanner) return false;
    const wing = pendingProposal.wing;
    pendingProposal = null;
    if (which === 'apply') void terminalApplyProposal(wing).catch(() => undefined);
    else void terminalDismissProposal().catch(() => undefined);
    dispatchBanner.dismiss();
    return true;
  };

  /** One Tier-2 dispatch for `b`. Fire-and-forget by contract: every caller
   *  drops the promise, so a slow or failed reflection can never stall the
   *  ticker or the walker. `sleeping` bypasses the rate-limit — that is the
   *  budget the limit was holding capacity for (the palace's 5B semantics). */
  const reflectFor = async (
    b: Being,
    opts: { sleeping?: boolean; force?: boolean; proposals?: boolean } = {},
  ): Promise<ReflectRouteResult & { proposal?: { wing: string; accepted: boolean } }> => {
    const def = COHORT_BY_ID.get(b.id);
    if (!def) return { dispatched: false, skipReason: 'rejected' };
    const t = await deskSnapshot();
    const result = await routeTier2(def, b.mind, Date.now(), {
      memory,
      topology: deskTopologyLine(t, { proposals: opts.proposals === true }),
      ...(opts.sleeping && { reflectionMinIntervalMs: 0 }),
      ...(opts.force && { force: true }),
    });
    if (result.dispatched && result.reflection) {
      nightDispatch.push({
        agentName: def.name,
        text: result.reflection.text,
        hadPlan: result.plan !== undefined && result.plan.stepCount > 0,
      });
    }
    // T5 — the proposal candidate rides the same dispatch: the plan the
    // router just stored on the mind is the only place step TARGETS live
    // (the route result carries {text, stepCount} only, on purpose). No
    // candidate → nothing happens (empty-mailbox). Awaiting the broker's
    // answer is safe: every production caller drops reflectFor's promise,
    // so the ticker and the walker never see this round-trip.
    if (result.dispatched && opts.proposals === true) {
      const cand = extractProposalCandidate(b.mind.activePlan?.steps ?? [], t);
      if (cand) {
        try {
          const r = await terminalProposeTopology(cand.wing, b.id);
          if (r.accepted) pendingProposal = { wing: cand.wing, agentName: def.name };
          return { ...result, proposal: { wing: cand.wing, accepted: r.accepted } };
        } catch {
          return { ...result, proposal: { wing: cand.wing, accepted: false } };
        }
      }
    }
    return result;
  };

  /** The mounted banner's on-screen rect, read off the OVERLAY'S OWN
   *  container. It used to read `stage.children[last]` — which is the
   *  banner only by luck: a `scanlines` pack (amber-crt) adds a stage child
   *  above it, and once the 30 s auto-dismiss has fired the last child is
   *  the masthead. That is exactly how T4's bar 7 came to report a
   *  destroyed banner as present-with-ink at a plausible rect, and to be
   *  written up as a render defect. Returns nulls when nothing is mounted
   *  instead of measuring a bystander. */
  const bannerRect = (): {
    x: number;
    y: number;
    w: number;
    h: number;
    screen: string;
    stage: string[];
    ink: number | string;
  } => {
    const top = dispatchBanner?.view;
    const b = top && !top.destroyed ? top.getBounds() : undefined;
    return {
      x: Math.round(b?.x ?? -1),
      y: Math.round(b?.y ?? -1),
      w: Math.round(b?.width ?? 0),
      h: Math.round(b?.height ?? 0),
      screen: `${app.screen.width}x${app.screen.height}`,
      stage: app.stage.children.map(
        (c, i) => `${i}:${c.constructor.name} vis=${c.visible} a=${c.alpha} r=${c.renderable}`,
      ),
      ink: (() => {
        // Does the banner put INK on the canvas? Bounds prove it is in the
        // scene graph; only the extracted pixels prove it is drawn. NOTE
        // this is an isolated re-render — it stays non-zero even when the
        // composited frame never showed the banner, so it is evidence the
        // overlay CAN draw, never that the user saw it. Only a capture
        // settles that.
        if (!top || top.destroyed) return 0;
        try {
          const px = app.renderer.extract.pixels(top).pixels as Uint8ClampedArray;
          let lit = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] > 8) lit++;
          return lit;
        } catch (e) {
          return `extract failed: ${(e as Error).message}`;
        }
      })(),
    };
  };

  /** Poll cadence for the threshold check. Slow on purpose: the counter it
   *  watches moves a few points per seam crossing, so anything faster is
   *  wasted work under a ticker that may be running at 1 Hz anyway. */
  const REFLECT_POLL_S = 30;
  let reflectPollAt = REFLECT_POLL_S;

  let throttleState: ThrottleState = 'full';
  const applyThrottle = (state: ThrottleState): void => {
    const t = tickerFor(state);
    if (!t.started) {
      if (app.ticker.started) app.ticker.stop();
    } else {
      if (!app.ticker.started) app.ticker.start();
      app.ticker.maxFPS = t.maxFPS;
    }
  };
  void getThrottleState().then((s) => {
    throttleState = s;
    applyThrottle(s);
  });
  // Peek counts as attention: a deliberate "I am here and looking at the
  // desk" is better evidence of return than a stray mousemove.
  const unsubDeskAttention = subscribeDeskAttention(onAttention);
  const unsubThrottle = subscribeThrottle(({ state, isInitial }) => {
    const waking = shouldFireAttention(throttleState, state, isInitial);
    if (waking) onAttention();
    // T4 — the night sweep and the morning dispatch hang off the SAME two
    // transitions the launcher beat already uses, so "a real wake" means
    // exactly what deskThrottle.ts already proved it means (never initial).
    if (!isInitial && state === 'sleeping' && throttleState !== 'sleeping') {
      // A new night: last night's unclaimed proposal evaporated broker-side
      // (the broker clears BEFORE broadcasting this transition), so the
      // local mirror follows.
      pendingProposal = null;
      // One pass per present being, rate-limit bypassed. Fire-and-forget.
      // T5: the opt-in is pulled ONCE per sweep, not per being — sweeps are
      // rare and the answer cannot change mid-sweep in any way we honour.
      void getTerminalOrchestration()
        .then((proposals) => {
          for (const b of beings.values()) {
            if (!b.mind.present || b.away) continue;
            void reflectFor(b, { sleeping: true, proposals }).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }
    if (waking && (nightDispatch.length > 0 || pendingProposal !== null)) {
      // T5: a proposal mounts the banner even on a night with no narrated
      // reflections — the proposal IS the dispatch.
      showDispatch(nightDispatch.slice(), pendingProposal ?? undefined);
      // Drained, not kept: a second wake with nothing new must show nothing.
      nightDispatch.length = 0;
    }
    throttleState = state;
    applyThrottle(state);
  });

  /** The fuse beat: on a fresh join, a bright block runs inward from the seam
   *  along the (now continuous) ground, fading as it goes. Both windows play
   *  it ground-line-aligned, so it reads as one sweep crossing the seam. */
  const startKnit = (side: 'left' | 'right'): void => {
    const mk = (glyph: string): BitmapText =>
      new BitmapText({
        text: glyph,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
      });
    const trail = KNIT_TRAIL.map((g) => {
      const t = mk(g);
      t.alpha = 0; // positioned on the first tick
      world.addChild(t);
      return t;
    });
    // One text per seam column, kept even where there is no ground to
    // brighten (alpha 0) — a recompose can move a label off that column
    // mid-fade, and the next anchor lights it up when it becomes crust.
    const glow: BitmapText[] = [];
    for (let i = 0; i < KNIT_SPAN; i++) {
      const g = mk(''); // placed by anchorKnitGlow below
      world.addChild(g);
      glow.push(g);
    }
    const sweep: KnitSweep = { side, bornAt: elapsedS, trail, glow };
    anchorKnitGlow(sweep);
    knits.push(sweep);
    knitsFired += 1;
  };

  // Spawn this land's RESIDENTS — the cohort members whose home is this
  // wing (broker-owned homes; null society = web preview, everyone lives
  // here). filterByTheme keeps cell semantics: a theme-excluded agent
  // (Ghost outside tokyo-night/catppuccin) never spawns; its home persists
  // harmlessly. Roster refusal (renderer reload) → skip, as before.
  const mountedAtMs = Date.now();
  // tickPresence's ctx narrows to Pick<BehaviorContext, 'prngs'>, whose
  // value type is procedural/prng.ts's Prng (not the land-local makeRng
  // stream) — mulberry32 runs the identical mulberry32 step as makeRng, so
  // the presence rolls stay the same seeded-runtime-behaviour class as the
  // rest of this file, just typed to satisfy the shared BehaviorContext.
  const presencePrngs = new Map<string, Prng>();
  void getTerminalSociety().then((society) => {
    if (isUnder) return; // no boot residents underground — beings arrive via the shaft (B3)
    const defs = filterByTheme(
      residentsOf(society, wing)
        .map((id) => COHORT_BY_ID.get(id))
        .filter((d): d is AgentDef => d !== undefined),
      theme.id,
    );
    defs.forEach((def, i) => {
      presencePrngs.set(def.id, mulberry32(fnv1a(`presence:${def.id}:${terminalId}`)));
      void terminalAgentSpawn(def.id, terminalId).then((ok) => {
        if (!ok) return;
        const b = addBeing(def.id, 6 + ((i * 37) % (model.width - 12)), i % 2 === 0 ? 1 : -1);
        recordArrival(memory, {
          agentId: def.id,
          wing,
          col: Math.round(b.x),
          row: model.surface[Math.round(b.x)] ?? 0,
          whenMs: Date.now(),
        });
      });
    });
  });

  const tryExit = (b: Being, side: 'left' | 'right' | 'down' | 'up'): void => {
    b.pending = true;
    const carried = {
      speed: b.speed,
      dir: b.dir,
      intent: b.intent.kind,
      bobPhase: b.bobPhase,
      mind: carriedFromMind(b.mind),
    };
    void terminalAgentExit(b.id, terminalId, side, carried).then((accepted) => {
      if (accepted) {
        if (side === 'down' || side === 'up') {
          // Climb out along the shaft: pin the column, slide vertically.
          b.x = vShaftX;
          b.exitDy = side === 'down' ? 1 : -1;
        }
        b.exitingSince = elapsedS; // ease out past the edge, then destroy
        spawnSpark(side);
      } else {
        b.pending = false;
        // Refused — turn around (horizontal) or just walk on (vertical:
        // the shaft mouth refused, e.g. the undercroft was dragged away
        // mid-flight; the cooldown stamps below so nothing retries hot).
        if (side === 'left' || side === 'right') b.dir = side === 'left' ? 1 : -1;
        b.crossCooldownUntil = elapsedS + CROSS_COOLDOWN_S;
      }
    });
  };

  // ── Dungeon rung 1: the delver colony (spec 2026-08-19) ────────────────
  // ONE wing keeps a small Tier-0 colony in its undercroft. The wing's
  // SURFACE window owns the clock (uptime accrual, dispatch walks,
  // resolution, the one marginalia line, every state write); the
  // undercroft window is a pure presenter polling the shared blob. Both
  // key the blob by the WING's surface cell id, so they agree without
  // talking — the shared-sky discipline, pointed at sqlite.
  const delveCellId = cellIdFor(seed);
  let delverWing: string | null = null; // resolved from the topology broadcast
  let delveState: DelveState | null = null; // surface owner's live truth
  /** The live dispatch walk (one at a time — the errand posture). */
  let delveDispatch: { agentId: string; startedS: number } | null = null;
  let delveLastMs = Date.now();
  let delveUptimeFlushAtMs = 0;
  /** A stalled dispatch walk (dispatcher went absent) releases + retries. */
  const DELVE_WALK_CAP_S = 120;
  const delversHere = (): boolean => delverWing === wing;
  const saveDelve = (): void => {
    if (!delveState) return;
    try {
      memory.saveDelveState(delveCellId, JSON.stringify(delveState), Date.now());
    } catch {
      // Contention costs a lost save, never a broken tick.
    }
  };
  /** Load (or found) the colony. Runs when the topology names this wing
   *  AND when the DB writer lands — expeditions are hours apart, so the
   *  boot-order seconds between the two cannot lose progress. */
  const loadDelve = (): void => {
    if (isUnder || !delversHere()) return;
    let persisted: DelveState | null = null;
    try {
      persisted = parseDelveState(memory.delveStateForCell(delveCellId), wing);
    } catch {
      persisted = null;
    }
    if (persisted) {
      delveState = persisted;
    } else {
      if (!delveState) delveState = initialDelveState(wing);
      saveDelve(); // founds (or re-persists) the colony once a real writer exists
    }
  };
  const maybeInitDelvers = (allWings: string[] | undefined, wings: Record<string, string>): void => {
    const w = delverWingOf(allWings ?? [], Object.values(wings));
    if (w === delverWing) return;
    delverWing = w;
    loadDelve();
  };
  /** Resolution's one line above ground, at the shaft mouth, in the
   *  DISPATCHING being's voice (the stepThrough posture: an event
   *  bypasses maybeMark's odds; the dedupe rule applied by hand). */
  const placeExpeditionMark = (dispatcherId: string, kind: string, deadName: string): void => {
    const col = Math.min(model.width - 1, Math.max(0, vShaftX));
    for (let i = marks.length - 1; i >= 0; i--) {
      if (Math.abs(marks[i].col - col) <= MARK_DEDUPE_COLS) {
        marks[i].text.destroy();
        marks.splice(i, 1);
      }
    }
    const note = expeditionNote(dispatcherId, kind, deadName, rng);
    markLastAt.set(dispatcherId, elapsedS);
    recordMark(memory, { agentId: dispatcherId, note, col, row: model.surface[col] });
    addMarkView(dispatcherId, note, col);
  };

  // The undercroft presenter: single-cell ▪ folk on the cavern floor —
  // smaller marks than the beings' letters, inked quiet (never a
  // reserved being accent; smoke-salience's rule cuts the right way
  // here — delvers must NOT out-shout the beings).
  const DELVER_GLYPH = '▪';
  const DELVER_SPEED = 0.5; // cells/sec — small folk, unhurried
  const DELVER_SINK_S = 2.0; // descent through the floor at the delve mouth
  const DELVE_DEPART_MS = 30_000; // late joiners this far in start below
  const CAMP_HALF = 8;
  const HAZARD_S = 10;
  interface DelverView {
    id: string;
    x: number;
    tx: number;
    nextMoveAt: number;
    below: boolean;
    sinkStartS: number | null;
    riseStartS: number | null;
    text: BitmapText;
    rng: () => number;
    phase: number;
  }
  const delverViews = new Map<string, DelverView>();
  /** Where an expedition leaves the visible undercroft: the far side of
   *  the cavern from the up-shaft — the deep galleries. */
  const delveMouthX = vShaftX < cols / 2 ? cols - 3 : 2;
  const campMin = Math.max(1, vShaftX - CAMP_HALF);
  const campMax = Math.min(cols - 2, vShaftX + CAMP_HALF);
  let underDelve: DelveState | null = null; // the poll's latest read
  let delvePollAt = 0;
  const hazardViews: BitmapText[] = [];
  // Rung 2: the hoard glyph — the colony's wealth as a low static heap
  // on the camp side of the shaft, away from the delve mouth. Rebuilt
  // only when the stage moves; deliberately never animated (a pulsing
  // pile reads as a gauge — spec bar 8).
  const hoardViews: BitmapText[] = [];
  let lastHoardStage = -1;
  const hoardCol = vShaftX < cols / 2
    ? Math.max(1, vShaftX - 7)
    : Math.min(cols - 6, vShaftX + 3);
  const delverInk = (): number =>
    hexToInt(theme.palette[roleKey(theme, 'decor.quiet', 'fgDim')]);
  const addDelverView = (id: string, startBelow: boolean): void => {
    const drng = makeRng(fnv1a(`delver:${id}`));
    const text = new BitmapText({
      text: DELVER_GLYPH,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: delverInk() },
    });
    const x = campMin + drng() * (campMax - campMin);
    text.visible = !startBelow;
    world.addChild(text);
    delverViews.set(id, {
      id,
      x,
      tx: x,
      nextMoveAt: 0,
      below: startBelow,
      sinkStartS: null,
      riseStartS: null,
      text,
      rng: drng,
      phase: (fnv1a(id) % 628) / 100,
    });
  };
  const reconcileDelvers = (nowMs: number): void => {
    const s = underDelve;
    const want = new Set((s?.delvers ?? []).map((d) => d.id));
    for (const [id, v] of delverViews) {
      if (!want.has(id)) {
        v.text.destroy();
        delverViews.delete(id); // the dead never climb back up
      }
    }
    if (!s) return;
    for (const d of s.delvers) {
      if (delverViews.has(d.id)) continue;
      const a = s.active;
      const startBelow =
        a !== null && a.partyIds.includes(d.id) && nowMs < a.resolveAtMs && nowMs > a.startedAtMs + DELVE_DEPART_MS;
      addDelverView(d.id, startBelow);
    }
  };
  const rebuildHoard = (): void => {
    const stage = hoardStage(underDelve?.hoardGold ?? 0);
    if (stage === lastHoardStage) return;
    lastHoardStage = stage;
    for (const t of hoardViews) t.destroy();
    hoardViews.length = 0;
    if (stage === 0) return;
    const rows = HOARD_GLYPH_ROWS[stage - 1];
    rows.forEach((row, i) => {
      const t = new BitmapText({
        text: row,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: delverInk() },
      });
      t.x = hoardCol * CW;
      t.y = surfaceLocalY(hoardCol) - (rows.length - 1 - i) * CH;
      world.addChild(t);
      hoardViews.push(t);
    });
  };

  const tick = (): void => {
    const dt = app.ticker.deltaMS / 1000;
    elapsedS += dt;

    // Near-edge report — ≤1 Hz AND change-gated, so IPC stays bounded.
    if (elapsedS >= nearReportAt) {
      nearReportAt = elapsedS + NEAR_EDGE_REPORT_S;
      const near = nearEdgeSummary(
        [...beings.values()]
          .filter((b) => !b.pending && b.mind.present && b.away === null)
          .map((b) => ({ id: b.id, x: b.x })),
        model.width,
        edges,
      );
      const key = JSON.stringify(near);
      if (key !== lastNearReport) {
        lastNearReport = key;
        terminalReportNearEdge(terminalId, near);
      }
    }

    // Wear flush — ~30 s cadence, dirty-gated (never per footstep; the
    // DB is WAL-shared across renderer processes).
    if (elapsedS >= wearFlushAt) {
      wearFlushAt = elapsedS + WEAR_FLUSH_S;
      if (wearDirty) {
        wearDirty = false;
        flushWear();
      }
    }

    // Open-edge doorways breathe.
    for (const t of thresholds) t.alpha = 0.55 + 0.45 * Math.sin(elapsedS * 3);

    // T4 — the reflection pump. Slow, throttle-gated (it rides elapsedS, so it
    // freezes at 1 Hz and stops dead when paused, like everything else here).
    // routeTier2 short-circuits below threshold and inside the rate-limit
    // window, so this loop asserts nothing about either — it only asks.
    if (elapsedS >= reflectPollAt) {
      reflectPollAt = elapsedS + REFLECT_POLL_S;
      for (const b of beings.values()) {
        if (!b.mind.present || b.away) continue;
        if (b.mind.reflectionCounter < REFLECTION_THRESHOLD) continue;
        void reflectFor(b).catch(() => undefined);
      }
    }

    // Who is here. Change-gated on the id list, so the row is rebuilt when
    // someone crosses a seam, goes away on an errand or fades out of
    // presence — and at no other time.
    const here = mastheadResidents(
      [...beings.values()].map((b) => ({ id: b.id, present: b.mind.present, away: b.away !== null })),
    );
    const hereKey = here.join(',');
    if (hereKey !== mastKey) {
      mastKey = hereKey;
      drawMasthead(here);
    }

    // The parting frame: advance any live front and repaint that side. At
    // rest both sides are skipped entirely, so a joined desk pays nothing.
    for (const side of ['left', 'right'] as const) {
      const f = frames[side];
      if (!f.part) continue;
      const tS = elapsedS - f.part.startedAtS;
      f.front = partFront(tS, f.span, f.part.opening);
      if (partDone(tS)) {
        f.front = restFront(f.part.opening, f.span);
        f.part = null;
      }
      applyEdgeFront(side);
    }

    // Phase B: the vertical seam's tween/glow/threshold (rest = one null check).
    updateVSeam();

    // Wall clock, read once for every desk-global CONDITION in this tick (sun,
    // wind, sky drift): their whole job is to agree across windows that were
    // opened at different times, so they must share one instant — see
    // src/terminal/ambient.ts. Everything window-local keeps elapsedS.
    const nowMs = Date.now();
    const skyT = nowMs / 1000;

    // ── Dungeon rung 1: the colony's slow clock (surface owner) ─────────
    // Wall-clock deltas, clamped: occlusion/sleep gaps are not desk
    // uptime, and the wallpaper's 1 Hz throttle must still count — the
    // AWAY_* lesson (elapsedS accrues ~10× slow under throttle).
    const delveDtMs = nowMs - delveLastMs;
    delveLastMs = nowMs;
    if (!isUnder && delveState !== null && delversHere()) {
      const dS = delveState;
      accrueUptime(dS, delveDtMs);
      if (tickArrival(dS, nowMs)) saveDelve(); // a replacement walks in
      const res = resolveExpedition(dS, nowMs);
      if (res) {
        saveDelve();
        placeExpeditionMark(res.dispatcherId, res.kind, res.deadName);
      }
      if (delveDispatch && elapsedS - delveDispatch.startedS > DELVE_WALK_CAP_S) {
        // The walk stalled (dispatcher gone absent / off the roster):
        // release them and let the colony ask again in a while.
        const walker = beings.get(delveDispatch.agentId);
        if (walker && walker.intent.kind === 'dispatch') {
          walker.intent = { kind: 'rest' };
          walker.nextIntentAt = elapsedS;
        }
        delveDispatch = null;
        deferDispatch(dS);
        saveDelve();
      }
      if (!delveDispatch && dispatchDue(dS)) {
        const runner = pickRunner(vShaftX);
        if (runner) {
          runner.intent = { kind: 'dispatch', targetX: vShaftX };
          runner.pausedUntil = 0; // asked by the colony — no hesitation beat
          runner.nextIntentAt = Infinity; // no re-pick until the mouth
          delveDispatch = { agentId: runner.id, startedS: elapsedS };
        } else {
          deferDispatch(dS); // nobody home — the colony waits
          saveDelve();
        }
      }
      if (nowMs >= delveUptimeFlushAtMs) {
        delveUptimeFlushAtMs = nowMs + 60_000;
        saveDelve(); // accrued uptime survives a relaunch (≤1 min lost)
      }
    }

    // ── Dungeon rung 1: the undercroft presenter ────────────────────────
    if (isUnder && delversHere()) {
      if (elapsedS >= delvePollAt) {
        delvePollAt = elapsedS + 5;
        try {
          underDelve = parseDelveState(memory.delveStateForCell(delveCellId), wing);
        } catch {
          // Contention costs a stale poll, never a broken tick.
        }
        reconcileDelvers(nowMs);
        rebuildHoard();
      }
      const act = underDelve?.active ?? null;
      for (const v of delverViews.values()) {
        const inParty = act !== null && nowMs < act.resolveAtMs && act.partyIds.includes(v.id);
        if (inParty) {
          if (v.below) continue; // away in the deep galleries
          if (v.sinkStartS !== null) {
            // Descend through the cavern floor at the delve mouth.
            const p = (elapsedS - v.sinkStartS) / DELVER_SINK_S;
            if (p >= 1) {
              v.below = true;
              v.sinkStartS = null;
              v.text.visible = false;
            } else {
              v.text.x = Math.round(v.x * CW);
              v.text.y = surfaceLocalY(v.x) + p * 2 * CH;
              v.text.alpha = 1 - p;
            }
            continue;
          }
          if (Math.abs(v.x - delveMouthX) <= 0.4) {
            v.sinkStartS = elapsedS;
            continue;
          }
          v.x += (v.x < delveMouthX ? 1 : -1) * DELVER_SPEED * dt;
        } else {
          if (v.below || v.sinkStartS !== null) {
            // The expedition is over and this one lived: rise at the mouth.
            v.below = false;
            v.sinkStartS = null;
            v.riseStartS = elapsedS;
            v.x = delveMouthX;
            v.tx = campMin + v.rng() * (campMax - campMin);
            v.text.visible = true;
          }
          if (v.riseStartS !== null) {
            const p = (elapsedS - v.riseStartS) / DELVER_SINK_S;
            if (p >= 1) {
              v.riseStartS = null;
              v.text.alpha = 1;
            } else {
              v.text.x = Math.round(v.x * CW);
              v.text.y = surfaceLocalY(v.x) + (1 - p) * 2 * CH;
              v.text.alpha = p;
              continue;
            }
          }
          // Idle: unhurried drift within the camp around the shaft.
          if (elapsedS >= v.nextMoveAt) {
            v.nextMoveAt = elapsedS + 4 + v.rng() * 6;
            v.tx = campMin + v.rng() * (campMax - campMin);
          }
          if (Math.abs(v.x - v.tx) > 0.2) {
            v.x += (v.x < v.tx ? 1 : -1) * DELVER_SPEED * dt;
          }
        }
        v.text.x = Math.round(v.x * CW);
        // A faint breath, half the beings' amplitude — small folk.
        v.text.y = surfaceLocalY(v.x) + Math.sin(elapsedS * 1.1 + v.phase) * 0.5;
        v.text.alpha = 1;
      }
      // The creature hazard: disturbed glyphs at the delve mouth while
      // the beat passes below — a slow dim pulse, melancholy register,
      // never horror (spec bar 3). Rest state costs one null check.
      const hzActive =
        act !== null && act.hazardAtMs !== null && nowMs >= act.hazardAtMs && nowMs <= act.hazardAtMs + HAZARD_S * 1000;
      if (hzActive && hazardViews.length === 0) {
        const glyphs = ['▒', '▚', '░'];
        glyphs.forEach((g, i) => {
          const col = Math.min(cols - 1, Math.max(0, delveMouthX - 1 + i));
          const t = new BitmapText({
            text: g,
            style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: delverInk() },
          });
          t.x = col * CW;
          t.y = surfaceLocalY(col);
          t.alpha = 0;
          world.addChild(t);
          hazardViews.push(t);
        });
      } else if (!hzActive && hazardViews.length > 0) {
        for (const t of hazardViews) t.destroy();
        hazardViews.length = 0;
      }
      if (hzActive && act !== null && act.hazardAtMs !== null) {
        const q = (nowMs - act.hazardAtMs) / (HAZARD_S * 1000);
        const env = Math.min(1, q * 4, (1 - q) * 4);
        hazardViews.forEach((t, i) => {
          t.alpha = env * (0.3 + 0.15 * Math.sin(elapsedS * 1.6 + i));
        });
      }
    }

    // World clock: which of the baked sky is out at this hour, and how far
    // through its own day the pack's sky has moved. Every window derives it
    // from the same wall clock, so the desk agrees with NO broker channel — a
    // terminal opened at midnight matches its neighbours the instant it mounts.
    // `clockOverrideH` is the e2e hook: you cannot verify midnight by waiting.
    const sky = skyNow(clockOverrideH, localHour(nowMs));

    // The colour half of the clock (the daylight sky register). Two things take
    // it and must take the SAME value, or the world disagrees with its own sky:
    // the backdrop's tint, and the far planes that recede into it — a fade
    // aimed at a dark constant while the sky brightens inverts the depth cue,
    // so at noon the farthest ridge would read as the sharpest thing on the
    // horizon. A pack with no `daySky` returns its bg at every hour, so this
    // whole block is a no-op on the seven un-authored packs.
    const skyInk = skyInkOf(theme, sky.day);
    if (skyInk !== lastSkyInk) {
      lastSkyInk = skyInk;
      scene.sky.tint = skyInk;
      for (const f of scene.farLayers) f.bt.tint = landRoleFill(theme, f.role, f.step, skyInk);
      if (muralBacking && !muralBacking.destroyed) muralBacking.tint = skyInk;
    }

    // Tier-2 structure glow: monuments (and a hall, if one ever composes here)
    // pulse gently off elapsedS (deltaMS-accumulated), so they freeze cleanly
    // under throttle. Structures are WING-OWNED content — neighbours hold
    // different buildings, so their glows agreeing would mean nothing.
    const structAlpha = pulse(elapsedS, GLOW_STRUCT_PERIOD_S, GLOW_STRUCT_RANGE);
    for (const t of scene.layers.monument ?? []) t.alpha = structAlpha;
    for (const t of scene.layers.hall ?? []) t.alpha = structAlpha;
    // …but the ☼ is SHARED SKY, so it takes the wall clock: every window is a
    // lens on one sky, and on separate accumulators two joined terminals read
    // as two different suns over one landscape. Same pulse shape, other clock.
    // The pulse is now the ☼'s BREATH and the clock its ENVELOPE — at night it
    // still breathes, at zero.
    // The ARC (hour without colour, 2026-08-07): the ☼ climbs to its composed
    // row at noon and sinks toward the horizon at dawn and dusk, the ☾ does the
    // opposite. Position and alpha only — a lit SKY was the obvious way to say
    // "day" and it died at calibration, because beings stand at `surface - 1`
    // and are therefore seen against the sky. Moving a glyph costs no contrast.
    //
    // `.y` on the layer, sub-cell, exactly as sway drives `.x`: the body climbs
    // BETWEEN rows. Occlusion reuses the wisp rule — fade approaching a mural
    // or a structure top, never pop, the world always wins.
    if (sunView) {
      const y = arcY(sunView.spec, sky.day);
      sunView.text.y = y * CH;
      sunView.text.alpha = sunGlow(skyT) * sky.sun * arcAlpha(sunView.spec, y);
    }
    // ☾ and the stars are the same truth seen from the other side. The
    // composer bakes them into every sky; until the clock existed they simply
    // sat there at noon alongside the sun.
    if (moonView) {
      const y = arcY(moonView.spec, sky.night);
      moonView.text.y = y * CH;
      moonView.text.alpha = sky.night * arcAlpha(moonView.spec, y);
    }
    for (const t of scene.layers.star ?? []) t.alpha = sky.night;
    for (const t of scene.layers.starBright ?? []) t.alpha = sky.night;
    // The shelf lamp — the whole reason `lamp` split out of `sun`. It is a
    // LIGHT, so it runs opposite the body that used to share its role: lit
    // through the night, out by noon, keeping the ☼'s pulse as its breath.
    const lampAlpha = sunGlow(skyT) * sky.night;
    for (const t of scene.layers.lamp ?? []) t.alpha = lampAlpha;

    // Launcher beat: while an errand is live the door PULSES — the click is
    // acknowledged in the world within a frame, whatever Steam does later.
    // Otherwise it sits at full alpha, exactly as composed.
    const doorAlpha = errand
      ? DOOR_PULSE_RANGE[0] +
        (DOOR_PULSE_RANGE[1] - DOOR_PULSE_RANGE[0]) *
          (0.5 - 0.5 * Math.cos(elapsedS * DOOR_PULSE_HZ * 2 * Math.PI))
      : 1;
    for (const t of scene.layers.door ?? []) t.alpha = doorAlpha;

    // Tier-2 foliage sway: sub-cell x offsets, parity planes counter-phased
    // (glyphs move BETWEEN cells — never snap-to-cell). Wall-clock phased, not
    // elapsedS: one breeze crosses the whole desk, so foliage either side of a
    // seam leans together however long apart the terminals were opened.
    const sway = foliageSway(skyT);
    (scene.layers.foliage ?? []).forEach((t, i) => {
      t.x = i % 2 === 0 ? sway : -sway;
    });

    // #19 slice 2: cloud drift — same wall clock, same reason (and a woken
    // throttle snaps to where the sky has got to, with no accumulator).
    // Shared-sky wisps run in DESK cells: converted to local columns here,
    // the canvas clips the overhang, and the joined neighbour — computing the
    // same desk position from the same clock — draws the rest of the run.
    for (const w of wispViews) {
      const xc = w.desk
        ? wispX(w.spec, skyT, chainTotalCols) - chainOffsetCols
        : wispX(w.spec, skyT, model.width);
      w.text.x = xc * CW;
      w.text.alpha =
        xc <= -w.spec.text.length || xc >= model.width ? 0 : wispAlpha(w.spec, xc) * 0.9;
    }

    // Proximity labels: a site's name fades in only while a walker is near.
    // dt-driven (frozen under throttle); exiting/pending/absent beings don't
    // hold a label open.
    const walkerXs = [...beings.values()]
      .filter((b) => b.mind.present && b.exitingSince === null && !b.pending && b.away === null)
      .map((b) => b.x);
    for (const v of siteLabelViews) {
      // Launcher beat: a hovered site pins its own label open — that pin plus
      // the pointer cursor IS the affordance (no new chrome).
      const target = hoverX !== null && v.site.x === hoverX ? 1 : siteLabelTarget(v.site, walkerXs);
      v.alpha = stepLabelAlpha(v.alpha, target, dt);
      v.text.alpha = easeLabelAlpha(v.alpha);
    }

    // Crossing sparks fade out.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      const p = (elapsedS - s.bornAt) / SPARK_S;
      if (p >= 1) {
        s.text.destroy();
        sparks.splice(i, 1);
      } else s.text.alpha = 1 - p;
    }

    // Knit sweeps: a bright head + 2-glyph trail runs inward from the seam
    // along the (continuous) ground while the seam ground itself brightens,
    // then everything fades (the glow outlives the sweep by KNIT_GLOW_S − KNIT_S).
    for (let i = knits.length - 1; i >= 0; i--) {
      const k = knits[i];
      const p = (elapsedS - k.bornAt) / KNIT_S;
      const q = (elapsedS - k.bornAt) / KNIT_GLOW_S;
      if (p >= 1 && k.trail.length > 0) {
        for (const t of k.trail) t.destroy();
        k.trail.length = 0;
      }
      if (k.trail.length > 0) {
        const dirIn = k.side === 'left' ? 1 : -1;
        const headCol =
          k.side === 'left'
            ? Math.min(model.width - 1, Math.round(p * KNIT_SPAN))
            : Math.max(0, model.width - 1 - Math.round(p * KNIT_SPAN));
        k.trail.forEach((t, j) => {
          const col = Math.min(model.width - 1, Math.max(0, headCol - dirIn * j));
          t.x = col * CW;
          t.y = (model.surface[col] - 1) * CH;
          t.alpha = Math.max(0, (1 - p) * (1 - j * 0.3));
        });
      }
      if (q >= 1) {
        for (const g of k.glow) g.destroy();
        knits.splice(i, 1);
        continue;
      }
      // Re-anchored per tick from the LIVE model, exactly like the trail
      // above: a mid-knit unjoin/rewire recomposes the seam ramp under these
      // very columns, and a baked glyph would hang off the redrawn ground for
      // the rest of the fade (and miss wear packing the crust down).
      anchorKnitGlow(k);
    }

    // Launcher beat: the cap. A launcher may not make you wait, so Steam
    // fires at ERRAND_CAP_S whether or not the runner has arrived — but the
    // WALK continues, and they still step through the door when they get
    // there (Steam's own cold start is 5-20 s, so the world finishes its beat
    // while the game loads). Handled HERE, not in the runner's own branch, so
    // a runner who goes absent (Visitor's cycle, Ghost's apparitions) or
    // vanishes mid-errand can never wedge it: the launch fires anyway, it
    // just fires with nobody to walk it.
    if (errand) {
      const runner = beings.get(errand.agentId);
      if (!runner || !canRun(runner)) {
        // Gone or gone absent mid-errand (completeErrand clears `errand`
        // BEFORE the through-door fade, so this is never the arrival path).
        const { target, targetX, fired } = errand;
        errand = null;
        if (!fired) fireLaunch(null, target, targetX);
      } else if (!errand.fired && elapsedS - errand.startedS >= ERRAND_CAP_S) {
        errand.fired = true;
        fireLaunch(runner, errand.target, Math.round(runner.x));
      }
    }

    const beingCols: number[] = []; // present beings' columns (reveal proximity)
    for (const b of beings.values()) {
      // Launcher beat: out playing. Absent from the land — nothing below
      // runs for them, so they hold no label, wear no path and cross no
      // seam. They come back on attention (onAttention), or at the ceiling
      // if this desk is never touched again.
      if (b.away !== null) {
        if (Date.now() - b.away.sinceMs >= AWAY_CEIL_MS) returnFromAway(b);
        continue;
      }
      // Stepping THROUGH the door: fade out where they stand, then go away.
      if (b.throughSince !== null) {
        const p = (elapsedS - b.throughSince) / THROUGH_S;
        if (p >= 1) {
          b.throughSince = null;
          b.away = { game: lastLaunch?.name ?? '', col: Math.round(b.x), sinceMs: Date.now() };
          b.text.visible = false;
          b.text.alpha = 1; // reset for the return fade
          continue;
        }
        b.text.alpha = 1 - p;
        b.text.x = Math.round(b.x * CW);
        b.text.y = surfaceLocalY(b.x);
        continue;
      }
      // …and back out of it.
      if (b.returningSince !== null) {
        const p = (elapsedS - b.returningSince) / RETURN_S;
        if (p >= 1) {
          b.returningSince = null;
          b.text.alpha = 1;
        } else {
          b.text.alpha = p;
          b.text.x = Math.round(b.x * CW);
          b.text.y = surfaceLocalY(b.x);
          continue;
        }
      }
      // Exit juice: slide one cell past the edge while fading, then go.
      // A vertical exit (Phase B) slides along the shaft instead.
      if (b.exitingSince !== null) {
        const p = (elapsedS - b.exitingSince) / EXIT_S;
        if (p >= 1) {
          removeBeing(b.id);
          continue;
        }
        b.text.x = Math.round((b.x + (b.exitDy === 0 ? b.dir * p : 0)) * CW);
        b.text.y = surfaceLocalY(b.x) + b.exitDy * p * 2 * CH;
        b.text.alpha = 1 - p;
        continue;
      }
      // Phase B climb-in: a vertical arrival descends (or rises) the shaft
      // to the ground line before normal life resumes. Renderer juice only —
      // x is pinned, the intent clock waits (pausedUntil set at arrival).
      if (b.climb !== null) {
        const p = (elapsedS - b.climb.startedS) / CLIMB_S;
        if (p >= 1) {
          b.climb = null;
          b.text.alpha = 1;
        } else {
          b.text.x = Math.round(b.x * CW);
          b.text.y = surfaceLocalY(b.x) + b.climb.fromRows * (1 - partEase(p)) * CH;
          b.text.alpha = Math.min(1, p * 4);
          continue;
        }
      }
      // Entry juice: fade in while already walking inward.
      if (b.enteringSince !== null) {
        const p = (elapsedS - b.enteringSince) / ENTER_S;
        if (p >= 1) {
          b.enteringSince = null;
          b.text.alpha = 1;
        } else b.text.alpha = p;
      }

      // Presence dynamics (Visitor's cycle, Ghost's rare apparitions) —
      // tickPresence reuses the CELL's schedule rules on the real mind.
      // Absent: invisible, no walking, no crossings; the roster home holds.
      const def = COHORT_BY_ID.get(b.id);
      if (def && def.schedule.length > 0) {
        tickPresence(def, b.mind, { prngs: presencePrngs }, mountedAtMs, Date.now());
      }
      b.text.visible = b.mind.present;
      if (!b.mind.present) continue;

      const x0 = b.x;
      if (!b.pending) {
        // BT re-pick on cadence (or forced when an intent invalidates).
        if (elapsedS >= b.nextIntentAt) {
          // Marginalia: the COMPLETED intent may earn a mark before the
          // next one is picked — placement rides the re-pick clock as a
          // side-effect of living, deliberately not a new intent kind.
          const done = b.intent;
          let markKind: MarkContextKind | null = null;
          if (b.pendingArrivalMark) {
            markKind = 'after_crossing';
            b.pendingArrivalMark = false;
          } else if (done.kind === 'approach' && Math.abs(b.x - done.targetX) <= APPROACH_NEAR) {
            markKind = 'at_structure';
          } else if (done.kind === 'watch_edge' && edges[done.side]) {
            markKind = 'at_edge';
          } else if (done.kind === 'wander' || done.kind === 'rest') {
            markKind = 'mid_wander';
          }
          if (markKind) {
            const d = maybeMark(rng, {
              agentId: b.id,
              kind: markKind,
              col: Math.round(b.x),
              nowS: elapsedS,
              lastMarkAtS: markLastAt.get(b.id) ?? -Infinity,
              existingCols: marks.map((m) => m.col),
              thought: b.mind.intent,
            });
            if (d) {
              markLastAt.set(b.id, elapsedS);
              recordMark(memory, { agentId: b.id, note: d.note, col: d.col, row: model.surface[d.col] });
              addMarkView(b.id, d.note, d.col);
            }
          }

          b.intent = pickIntent(rng, intentCtx(b.x), b.persona.bias);
          b.pausedUntil = elapsedS + HESITATE_S[0] + rng() * HESITATE_S[1];
          b.nextIntentAt = elapsedS + (INTENT_S[0] + rng() * INTENT_S[1]) * b.persona.intentWindowMult;

          // Tier-1 pump (arrival-driven): only arrivals queue events, so an
          // empty queue is the common free no-op. routeTier1 is UNCHANGED —
          // real def, real throttle (a throttled event drains on a later
          // re-pick), deny-verbs, telemetry, memory writes. Fire-and-forget:
          // the walker never blocks; a parseable `approach x,y` intent
          // steers, anything else is flavor (memory prose). Key-free rail:
          // transport failure logs + stamps throttle inside routeTier1.
          if (def && b.mind.perceptionQueue.length > 0) {
            void routeTier1(
              def,
              b.mind,
              sceneLabelFor(wing, model.width, structureCols),
              Date.now(),
              { memory },
            ).then((res) => {
              if (!res.tick) return;
              const li = landIntentFromTick(res.tick.intent, { width: model.width });
              if (li && beings.get(b.id) === b) {
                b.intent = li;
                b.nextIntentAt =
                  elapsedS + (INTENT_S[0] + rng() * INTENT_S[1]) * b.persona.intentWindowMult;
              }
            }).catch(() => {
              // Memory contract: contention costs a lost observation, never a broken tick.
            });
          }
        }

        // Intent → this frame's signed velocity (cells/sec).
        let vel = 0;
        const it = b.intent;
        if (it.kind === 'wander') {
          b.dir = it.dir;
          vel = b.dir * b.speed;
        } else if (it.kind === 'approach') {
          if (Math.abs(b.x - it.targetX) > APPROACH_NEAR) {
            b.dir = b.x < it.targetX ? 1 : -1;
            vel = b.dir * b.speed;
          } // else linger at the structure: stand, keep bobbing
        } else if (it.kind === 'errand') {
          // Walks like approach, but the arrival FIRES: Steam on the last
          // step, or at the cap if they were too far to make it in time (a
          // launcher may not make you wait — the cap fires and they step
          // through from wherever they stand).
          if (Math.abs(b.x - it.targetX) <= APPROACH_NEAR) {
            completeErrand(b);
            continue;
          }
          b.dir = b.x < it.targetX ? 1 : -1;
          vel = b.dir * b.speed;
        } else if (it.kind === 'dispatch') {
          // Dungeon rung 1: walks like approach; the arrival at the
          // shaft mouth FIRES the expedition (the errand posture — the
          // colony asked, so the world may watch the walk).
          if (Math.abs(b.x - it.targetX) <= APPROACH_NEAR) {
            if (delveState && delveDispatch?.agentId === b.id) {
              // Rung 2: the dispatcher's temperament shapes the expedition
              // (persona-derived, prng-free — spec bar 1).
              beginExpedition(delveState, b.id, directiveParams(b.id, b.persona), Date.now());
              saveDelve();
              spawnSpark('down'); // the send-off, at the mouth
              delveDispatch = null;
            }
            b.intent = { kind: 'rest' }; // linger a beat, then normal life
            b.pausedUntil = elapsedS + 2;
            b.nextIntentAt = elapsedS + 6;
            continue;
          }
          b.dir = b.x < it.targetX ? 1 : -1;
          vel = b.dir * b.speed;
        } else if (it.kind === 'watch_edge') {
          if (!edges[it.side]) {
            b.nextIntentAt = elapsedS; // edge closed under us — re-pick next frame
          } else {
            const edgeX = it.side === 'left' ? 0 : model.width - 1;
            b.dir = it.side === 'left' ? -1 : 1;
            const near = Math.abs(b.x - edgeX) <= WATCH_NEAR;
            vel = b.dir * b.speed * (near ? WATCH_DRIFT : 1);
          }
        } // rest: vel stays 0

        if (elapsedS >= b.pausedUntil) b.x += vel * dt;

        // Phase B: the shaft mouth. A being that steps ACROSS the shaft
        // column while the vertical seam is open may take it — down from
        // the surface, back up from the undercroft. Chance-gated so the
        // shaft is a temptation, not a drain; cooldown-gated like every
        // crossing (anti-ping-pong).
        if (
          vEdgeOpen &&
          vel !== 0 &&
          b.intent.kind !== 'dispatch' && // a dispatcher stops AT the mouth, never takes it
          elapsedS >= b.crossCooldownUntil &&
          x0 !== b.x &&
          (x0 - vShaftX) * (b.x - vShaftX) <= 0 &&
          rng() < DESCEND_CHANCE
        ) {
          tryExit(b, isUnder ? 'up' : 'down');
        } else if (b.x <= 0) {
          if (edges.left && elapsedS >= b.crossCooldownUntil) {
            tryExit(b, 'left');
          } else {
            b.x = 0;
            b.dir = 1;
            if (b.intent.kind === 'wander') b.intent = { kind: 'wander', dir: 1 };
            else b.nextIntentAt = elapsedS; // bounced — re-pick
          }
        } else if (b.x >= model.width - 1) {
          if (edges.right && elapsedS >= b.crossCooldownUntil) {
            tryExit(b, 'right');
          } else {
            b.x = model.width - 1;
            b.dir = -1;
            if (b.intent.kind === 'wander') b.intent = { kind: 'wander', dir: -1 };
            else b.nextIntentAt = elapsedS;
          }
        }
      }

      // Liveliness (beingAnim.ts). The gait rides DISTANCE walked, the
      // walk/stand blend and the facing lean ride dt, and a being that has
      // not moved gets seeded idle beats so a 6-18 s rest reads as loitering
      // rather than as a frozen prop. Deliberately outside the !b.pending
      // block: a being waiting on the broker stands still and should fidget.
      const moved = Math.abs(b.x - x0);
      b.gaitPhase = stepGait(b.gaitPhase, moved);
      b.moving = stepMoving(b.moving, moved > 0, dt);
      if (moved > 0) b.face = b.dir;
      if (moved === 0 && b.idleBeat === null && elapsedS >= b.idleBeatAt) {
        const turn = rng() < IDLE_TURN_CHANCE;
        if (turn) b.face = b.face === 1 ? -1 : 1;
        b.idleBeat = { startedS: elapsedS, turn };
        b.idleBeatAt = elapsedS + IDLE_BEAT_S[0] + rng() * IDLE_BEAT_S[1];
      } else if (b.idleBeat !== null && elapsedS - b.idleBeat.startedS >= IDLE_BEAT_DUR) {
        b.idleBeat = null;
      }
      b.lean = stepLean(b.lean, b.face, dt);

      // Half-pixel snap, not whole: a 1.3 px lean would be rounded away, and
      // 0.5 local px = 1 screen px at WORLD_SCALE 2, so it stays crisp.
      b.text.x = Math.round((b.x * CW + b.lean + beatOffset(b, elapsedS)) * 2) / 2;
      b.text.y = surfaceLocalY(b.x) + bobOffset(b, elapsedS);
      beingCols.push(b.x);

      // Footfall: count column ENTRIES (not frames) toward path wear.
      const col = Math.round(b.x);
      if (col !== b.lastCol) {
        b.lastCol = col;
        wearDirty = true;
        if (footfall.step(col)) refreshWear();
      }
    }

    // Marginalia reveal — one slot; a passing being unfurls a note.
    if (!reveal) {
      const idx = pickReveal(marks, beingCols, elapsedS);
      if (idx !== null) {
        const mark = marks[idx];
        reveal = { mark, startedAtS: elapsedS };
        mark.lastRevealAtS = elapsedS;
        caption.text = wrapNote(mark.note, CAPTION_MAX_W).join('\n');
        caption.x = Math.max(0, Math.min(model.width * CW - caption.width, Math.round(mark.col * CW - caption.width / 2)));
        caption.y = markDisplayRow(model.surface, mark.col) * CH - caption.height - CH;
        captionBack.clear();
        captionBack
          .rect(caption.x - CAPTION_PAD, caption.y - CAPTION_PAD,
                caption.width + CAPTION_PAD * 2, caption.height + CAPTION_PAD * 2)
          .fill(hexToInt(theme.palette.bg));
        caption.alpha = 0;
        captionBack.alpha = 0;
        caption.visible = true;
        captionBack.visible = true;
        world.addChild(captionBack); // re-append as a PAIR → backing stays under
        world.addChild(caption);     // its text and both stay topmost
      }
    } else if (!marks.includes(reveal.mark)) {
      // Evicted by the render cap mid-reveal: close the caption safely.
      caption.visible = false;
      captionBack.visible = false;
      if (skylineOccluded) {
        skylineOccluded = false;
        maskSkyline(null);
      }
      reveal = null;
    } else {
      const t = elapsedS - reveal.startedAtS;
      const a = revealAlpha(t);
      caption.alpha = a;
      // The backing rides the same envelope but never fully opaque, so the
      // world stays faintly visible through it rather than being punched out.
      captionBack.alpha = a * 0.88;
      const occlude = a >= SKYLINE_OCCLUDE_ALPHA;
      if (occlude !== skylineOccluded) {
        skylineOccluded = occlude;
        maskSkyline(occlude ? captionRect() : null);
      }
      if (a === 0) {
        caption.visible = false;
        captionBack.visible = false;
        reveal = null;
      }
    }
  };
  app.ticker.add(tick);

  // ── Broker wiring ────────────────────────────────────────────────────────
  const unsubTopology = subscribeTerminalTopology(({ joins, vjoins, wings, allWings, widths }) =>
    applyJoins(joins, wings, allWings, vjoins, widths),
  );
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side, state, from }) => {
    if (beings.has(agentId)) return; // duplicate guard
    const vertical = side === 'down' || side === 'up';
    spawnSpark(side);
    // Vertical arrivals appear at the shaft mouth and CLIMB in; horizontal
    // arrivals keep the walk-in-from-the-edge juice.
    const b = vertical
      ? addBeing(agentId, vShaftX, vShaftX < model.width / 2 ? 1 : -1, true)
      : addBeing(agentId, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1, true);
    if (vertical) {
      const groundRow = (model.surface[vShaftX] ?? model.height) - 1;
      b.enteringSince = null; // the climb owns the fade
      b.climb = {
        // 'up' entry = came from above (descending): start at the ceiling.
        // 'down' entry = came from below (ascending): start past the floor.
        fromRows: side === 'up' ? -groundRow : model.height - groundRow,
        startedS: elapsedS,
      };
      b.pausedUntil = elapsedS + CLIMB_S; // no walking mid-rung
    }
    b.crossCooldownUntil = elapsedS + CROSS_COOLDOWN_S; // anti-ping-pong
    if (!presencePrngs.has(agentId)) {
      presencePrngs.set(agentId, mulberry32(fnv1a(`presence:${agentId}:${terminalId}`)));
    }
    const surfaceRow = model.surface[Math.round(b.x)] ?? 0;
    if (state) {
      // RESUME, don't respawn: gait + phase carry over; the intent
      // continues in this land's terms (chain-aware watch_edge, nearest
      // structure for approach). Missing state (stale preload) degrades
      // to the fresh-spawn defaults addBeing already chose.
      b.speed = state.speed;
      if (!vertical) b.dir = state.dir; // a shaft has no carried facing
      b.bobPhase = state.bobPhase;
      b.intent = resumeIntent(state.intent, side, intentCtx(b.x));
      if (state.mind) b.mind = reconstructMind(agentId, Math.round(b.x), surfaceRow, state.mind);
    }
    // The arrival is a PERCEPTION now — queued on the mind, drained (and
    // written to memory) by the next re-pick's routeTier1. recordArrival
    // is boot-spawn-only as of T2. An undercroft arrival names itself so
    // the memory line reads honestly (zero new AI call sites — this rides
    // the existing arrival drain; spec 2026-08-18 cost note).
    b.mind.perceptionQueue.push({
      kind: 'terminal_arrival',
      subject: isUnder ? `${wing} undercroft` : wing,
      at: { x: Math.round(b.x), y: surfaceRow },
      when: Date.now(),
    });
    recordCrossing(memory, {
      agentId,
      fromWing: from?.wing || '?',
      toWing: isUnder ? `${wing} undercroft` : wing,
      col: Math.round(b.x),
      row: surfaceRow,
      whenMs: Date.now(),
    });
  });
  const unsubNeighbour = subscribeTerminalNeighbourSummary(({ side, beings: bs }) => {
    neighbourNear[side] = bs;
  });
  void getTerminalTopology().then(({ joins, vjoins, wings, allWings, widths }) => applyJoins(joins, wings, allWings, vjoins, widths));
  if (!isUnder) drawEdges();

  window.__terminal = {
    state: () => ({
      terminalId,
      wing,
      edges: { ...edges },
      beings: [...beings.values()].map((b) => ({
        id: b.id,
        x: Math.round(b.x * 10) / 10,
        dir: b.dir,
        intent: b.intent.kind,
        present: b.mind.present,
        away: b.away !== null,
      })),
      knits: {
        live: knits.length,
        fired: knitsFired,
        glowStale: knits.reduce(
          (n, k) =>
            n +
            k.glow.filter((g, i) => {
              const cell = knitGlowCell(model, footfall.worn, k.side, i);
              return cell !== null && g.y !== cell.row * CH;
            }).length,
          0,
        ),
      },
      worn: [...footfall.worn].sort((a, b) => a - b),
      marks: marks.map((m) => ({
        col: m.col,
        agentId: m.agentId,
        revealed: reveal !== null && reveal.mark === m,
      })),
      neighbours: {
        left: projectAcrossEdge('left', model.width, neighbourNear.left),
        right: projectAcrossEdge('right', model.width, neighbourNear.right),
      },
      mural: model.mural ? { state: muralState, appid: model.mural.appid } : null,
    }),
    debugPlace: (id, x, dir, hold) => {
      const b = beings.get(id);
      if (!b || b.pending) return false;
      b.x = Math.min(model.width - 1, Math.max(0, x));
      // A teleport is not a walk: re-base lastCol so the next tick doesn't
      // score a footfall for a column the being never entered (wear is
      // "column ENTRIES", and debugWear-driven e2e reads these counts).
      b.lastCol = Math.round(b.x);
      b.dir = dir;
      b.face = dir; // a parked being never moves, so nothing else would set it
      // hold: park (rest) so a proximity-reveal shot has time to land.
      b.intent = hold ? { kind: 'rest' } : { kind: 'wander', dir };
      b.pausedUntil = 0;
      b.crossCooldownUntil = 0;
      b.nextIntentAt = elapsedS + 30; // hold course long enough to cross
      return true;
    },
    debugThrottle: () => ({
      state: throttleState,
      started: app.ticker.started,
      maxFPS: app.ticker.maxFPS,
    }),
    debugBeings: () =>
      [...beings.values()].map((b) => ({
        id: b.id,
        x: Math.round(b.x * 1000) / 1000,
        dx: Math.round((b.text.x - b.x * CW) * 1000) / 1000,
        dy: Math.round((b.text.y - surfaceLocalY(b.x)) * 1000) / 1000,
        face: b.face,
        moving: Math.round(b.moving * 1000) / 1000,
        beat: b.idleBeat !== null,
        intent: b.intent.kind,
      })),
    debugDepth: () => ({
      monument: scene.layers.monument?.[0]?.alpha ?? null,
      sun: scene.layers.sun?.[0]?.alpha ?? null,
      // null = this wing composed no such body (a mural or a pack's landOmit
      // can evict one) — distinct from 0, which means the clock has set it.
      moon: scene.layers.moon?.[0]?.alpha ?? null,
      star: scene.layers.star?.[0]?.alpha ?? null,
      foliageX: (scene.layers.foliage ?? []).map((t) => t.x),
    }),
    // Command only — it reports the hour it INTENDS, never the drawn alphas:
    // those are still the previous tick's until the next frame runs, and a hook
    // that returned them here would report the sky it just replaced (observed:
    // forcing noon read back the 06:30 sky). Read the result from debugDepth
    // after a frame.
    debugClock: (hour) => {
      clockOverrideH = hour;
      const h = hour ?? localHour(Date.now());
      return {
        hour: Math.round(h * 1000) / 1000,
        overridden: hour !== null,
        // What the curve SAYS at this hour. What the sky DID about it is
        // debugSky(), one frame later.
        daylight: Math.round(daylight(h) * 1000) / 1000,
      };
    },
    debugSky: () => {
      const r3 = (n: number): number => Math.round(n * 1000) / 1000;
      return {
        // Drawn ROW — the arc's observable. Read off the render-side body, not
        // the baked layer, which the terminal path hides.
        sunY: sunView ? r3(sunView.text.y / CH) : null,
        moonY: moonView ? r3(moonView.text.y / CH) : null,
        sunAlpha: sunView ? r3(sunView.text.alpha) : null,
        moonAlpha: moonView ? r3(moonView.text.alpha) : null,
        lampAlpha: scene.layers.lamp?.[0] ? r3(scene.layers.lamp[0].alpha) : null,
        sunCol: sunView ? sunView.spec.col : null,
        moonCol: moonView ? moonView.spec.col : null,
        skyInk: scene.sky.tint as number,
        farInk: (scene.farLayers[0]?.bt.tint as number | undefined) ?? null,
        shared: {
          chain: [...chain.order],
          index: chain.index,
          key: chain.key,
          sunHost: chain.order.length > 1 ? bodyHost(chain.key, 'sun', chain.order.length) : null,
          moonHost: chain.order.length > 1 ? bodyHost(chain.key, 'moon', chain.order.length) : null,
          wisps: wispViews.map((w) => {
            const local = w.text.x / CW;
            return {
              row: w.spec.row,
              deskX: r3(w.desk ? local + chainOffsetCols : local),
              localX: r3(local),
              alpha: r3(w.text.alpha),
            };
          }),
        },
      };
    },
    debugLabels: () =>
      siteLabelViews.map((v) => ({
        text: v.site.text,
        x: v.site.x,
        y: v.site.y,
        kind: v.site.kind,
        alpha: Math.round(v.text.alpha * 1000) / 1000,
      })),
    debugWear: (col, passes) => {
      let crossed = false;
      for (let i = 0; i < passes; i++) if (footfall.step(col)) crossed = true;
      if (passes > 0) wearDirty = true;
      if (crossed) refreshWear();
      return footfall.worn.has(col);
    },
    debugMark: (col, agentId = 'loki') => {
      const note = noteFor(agentId, 'mid_wander', rng, '');
      const c = Math.max(0, Math.min(model.width - 1, col));
      recordMark(memory, { agentId, note, col: c, row: model.surface[c] });
      addMarkView(agentId, note, c);
      return marks.some((m) => m.col === c);
    },
    debugReveal: () => {
      if (!reveal) return null;
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      return {
        open: caption.visible,
        tS: r3(elapsedS - reveal.startedAtS),
        alpha: r3(caption.alpha),
        backAlpha: r3(captionBack.alpha),
        // The box is what read as a speech bubble; assert its absence directly
        // rather than inferring it from the glyph count.
        framed: /[╔╗╚╝║═]/.test(caption.text),
        lines: caption.text.split('\n').length,
        skylineOccluded,
      };
    },
    debugCellAt: (x, y) =>
      model.char[y]?.[x] !== undefined ? { char: model.char[y][x], role: model.role[y][x] } : null,
    debugClouds: () =>
      wispViews.map((w) => ({
        x: Math.round((w.text.x / CW) * 100) / 100,
        alpha: Math.round(w.text.alpha * 1000) / 1000,
      })),
    debugLaunch: () => ({
      targets: launchHotspots.map((t) => ({
        x: t.x,
        y: t.y,
        px: Math.round(world.x + (t.x + 0.5) * CW * WORLD_SCALE),
        py: Math.round(world.y + (t.y + 0.5) * CH * WORLD_SCALE),
        name: t.name,
        appid: t.appid,
      })),
      doorX,
      hoverX,
      errand: errand
        ? { agentId: errand.agentId, targetX: errand.targetX, name: errand.target.name }
        : null,
      away: [...beings.values()].filter((b) => b.away !== null).map((b) => b.id),
      last: lastLaunch,
    }),
    debugClick: (x, y) => {
      const hit = hitLaunchTarget(launchHotspots, x, y);
      if (!hit) return false;
      beginErrand(hit);
      return true;
    },
    debugMasthead: () => ({
      label: mastLabel.text,
      residents: mastKey ? mastKey.split(',') : [],
      holdings: mastHoldings.text,
      labelInk: mastLabel.style.fill as number,
      residentInks: mastResidents.map((t) => t.style.fill as number),
      backCols: mastBackCols,
      cols: model.width,
    }),
    debugTopology: async (proposals = false) => {
      const t = await deskSnapshot();
      return { line: deskTopologyLine(t, { proposals }), ...t, reachable: reachableWings(t) };
    },
    debugReflect: async (agentId, mode = 'force') => {
      const b = beings.get(agentId);
      if (!b) {
        // Not a dead end: called with an id nobody answers to, this is a FREE
        // observer of the banner + buffer (no dispatch, no Sonnet call).
        return {
          dispatched: false,
          skipReason: 'not_here',
          counter: 0,
          buffered: nightDispatch.length,
          bannerOpen: dispatchBanner !== null,
          ...(dispatchBanner && { bannerRect: bannerRect() }),
        };
      }
      const night = mode === 'night';
      const r = await reflectFor(
        b,
        night ? { sleeping: true } : mode === 'force' ? { force: true } : {},
      );
      if (night && nightDispatch.length > 0) {
        showDispatch(nightDispatch.slice());
        nightDispatch.length = 0;
      }
      return {
        dispatched: r.dispatched,
        ...(r.skipReason && { skipReason: r.skipReason }),
        ...(r.reflection && { reflection: r.reflection.text }),
        ...(b.mind.activePlan && {
          plan: {
            text: b.mind.activePlan.text,
            steps: b.mind.activePlan.steps.map((s) => ({
              kind: s.kind,
              ...(s.target && { target: s.target }),
            })),
          },
        }),
        counter: b.mind.reflectionCounter,
        buffered: nightDispatch.length,
        bannerOpen: dispatchBanner !== null,
        // Where the banner actually landed. `bannerOpen` only says a teardown
        // exists; a banner mounted off-screen or at zero size would still
        // report open, so bar 7 needs the rect.
        ...(dispatchBanner && { bannerRect: bannerRect() }),
      };
    },
    debugBanner: (lines = 2, text = 'the terminals beckon like warm spots') => {
      showDispatch(
        Array.from({ length: Math.max(1, lines) }, (_, i) => ({
          agentName: COHORT[i % COHORT.length].name,
          text,
          hadPlan: i === 0,
        })),
      );
      return bannerRect();
    },
    debugSleepSweep: async (agentId) => {
      const b = beings.get(agentId);
      if (!b) {
        return { dispatched: false, skipReason: 'not_here', proposal: null, pending: pendingProposal };
      }
      const r = await reflectFor(b, { sleeping: true, proposals: true, force: true });
      return {
        dispatched: r.dispatched,
        ...(r.skipReason && { skipReason: r.skipReason }),
        proposal: r.proposal ?? null,
        pending: pendingProposal,
      };
    },
    debugProposal: async (wing = 'd5') => {
      const r = await terminalProposeTopology(wing, 'debug');
      if (r.accepted) pendingProposal = { wing, agentName: 'debug' };
      if (pendingProposal) showDispatch(nightDispatch.slice(), pendingProposal);
      return {
        accepted: r.accepted,
        reason: r.reason ?? null,
        pending: pendingProposal,
        bannerOpen: dispatchBanner !== null,
        ...(dispatchBanner && { bannerRect: bannerRect() }),
      };
    },
    debugTapProposal: (which) => ({
      tapped: tapProposal(which),
      pending: pendingProposal,
      bannerOpen: dispatchBanner !== null,
    }),
    debugDelve: () => {
      const s = isUnder ? underDelve : delveState;
      return {
        here: delversHere(),
        delverWing,
        state: s
          ? {
              delvers: s.delvers.map((d) => ({ id: d.id, name: d.name })),
              targetPop: s.targetPop,
              hoardGold: s.hoardGold,
              expeditionSeq: s.expeditionSeq,
              uptimeMs: Math.round(s.uptimeMs),
              nextDispatchAtUptimeMs: Math.round(s.nextDispatchAtUptimeMs),
              nextArrivalAtMs: s.nextArrivalAtMs,
              active: s.active
                ? {
                    dispatcherId: s.active.dispatcherId,
                    partyIds: [...s.active.partyIds],
                    startedAtMs: s.active.startedAtMs,
                    resolveAtMs: s.active.resolveAtMs,
                    hazardAtMs: s.active.hazardAtMs,
                    deadCount: s.active.outcome.deadIndices.length,
                  }
                : null,
            }
          : null,
        dispatch: delveDispatch ? { agentId: delveDispatch.agentId } : null,
        views: [...delverViews.values()].map((v) => ({
          id: v.id,
          x: Math.round(v.x * 10) / 10,
          below: v.below,
          visible: v.text.visible,
        })),
        hazardGlyphs: hazardViews.length,
        hoardStage: hoardStage(s?.hoardGold ?? 0),
        hoardGlyphs: hoardViews.length,
      };
    },
    debugDelveDispatch: () => {
      if (isUnder || !delveState || !delversHere()) return false;
      delveState.uptimeMs = delveState.nextDispatchAtUptimeMs;
      return true;
    },
    debugDelveResolve: () => {
      if (isUnder || !delveState?.active) return false;
      const nowMs = Date.now();
      delveState.active.resolveAtMs = nowMs;
      if (delveState.active.hazardAtMs !== null && delveState.active.hazardAtMs > nowMs) {
        delveState.active.hazardAtMs = nowMs;
      }
      saveDelve();
      return true;
    },
    debugEdgeFrame: () => {
      const r3 = (n: number): number => Math.round(n * 1000) / 1000;
      const read = (side: 'left' | 'right'): {
        open: boolean;
        parting: boolean;
        front: number;
        span: number;
        wall: number[];
        jamb: number[];
        jambGlyphs: string[];
      } => {
        const f = frames[side];
        return {
          open: edges[side],
          parting: f.part !== null,
          front: r3(f.front),
          span: f.span,
          // By DISTANCE from the ground line, not by row — the front's own
          // axis, so "nearest the ground parts first" is readable directly.
          wall: [...f.wall]
            .sort((a, b) => a.dist - b.dist)
            .map((w) => r3(w.text.alpha)),
          jamb: f.jamb.map((t) => r3(t.alpha)),
          jambGlyphs: f.jamb.map((t) => t.text),
        };
      };
      return { left: read('left'), right: read('right') };
    },
  };

  return () => {
    flushWear(); // final wear write — teardown must not lose the session
    saveDelve(); // final colony write (uptime + anything mid-flight)
    unsubTopology();
    unsubEnter();
    unsubNeighbour();
    unsubThrottle();
    unsubDeskAttention();
    app.ticker.remove(tick);
    app.canvas.removeEventListener('pointermove', onPointerMove);
    app.canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('focus', onWindowFocus);
    delete window.__terminal;
    if (glowFilter) {
      world.filters = [];
      glowFilter.destroy();
    }
    app.destroy(true, { children: true });
  };
}
