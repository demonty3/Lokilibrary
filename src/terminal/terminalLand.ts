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
import { buildLandContainer, landRoleFill } from '../render/levels/land';
import { loadMuralPixels, buildQuantizedMural, type TerminalMuralState } from '../render/mural';
import { quantizeMural, muralQuantizeTargets } from '../render/muralCells';
import { knitGlowCell } from './knit';
import { createFootfall, crustLayerText, decayedCount, WEAR_THRESHOLD } from './wear';
import { extractWisps, wispAlpha, wispX, type WispSpec } from './clouds';
import {
  launchNote,
  maybeMark,
  markDisplayRow,
  MARK_DEDUPE_COLS,
  noteFor,
  pickReveal,
  MARK_RENDER_CAP,
  REVEAL_FADE_S,
  REVEAL_HOLD_S,
  type MarkContextKind,
} from './marks';
import { MARK_STYLES, DEFAULT_MARK_STYLE } from '../agents/markStyles';
import { captionFor } from '../render/noteBox';
import { easeLabelAlpha, siteLabelTarget, stepLabelAlpha } from './siteLabels';
import {
  doorColumn,
  hitLaunchTarget,
  launchTargets,
  type LaunchTarget,
} from './launchTargets';
import { launchGame } from '../agents/launch';
import { composeLand, SAMPLE_LAND, type LandGame, type LandSite } from '../procedural/land';
import {
  getTerminalSociety,
  getTerminalTopology,
  getThrottleState,
  subscribeTerminalAgentEnter,
  subscribeTerminalNeighbourSummary,
  subscribeTerminalTopology,
  subscribeThrottle,
  subscribeDeskAttention,
  terminalAgentExit,
  terminalAgentSpawn,
  terminalReportNearEdge,
  type TerminalJoin,
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
import { nullMemoryWriter, routeTier1, type MemoryWriter } from '../agents/router';
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
/** Raised horizon (2026-07-30): a tight 4-row underground; the reclaimed rows
 *  go to the sky (skyH 5 → 11 at 640×520). Terrace Join's precondition. */
const UNDER_H = 4;
const SURFACE_BAND = 4;
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
const SPARK_S = 0.3;
/** Tier-2 structure glow: alpha pulse (the 6A landmark-pulse envelope). */
const GLOW_STRUCT_PERIOD_S = 2.8;
const GLOW_STRUCT_RANGE: [number, number] = [0.72, 1];
const GLOW_SUN_PERIOD_S = 4.2;
const GLOW_SUN_RANGE: [number, number] = [0.62, 1];
/** Tier-2 foliage sway: sub-cell x oscillation (local px; × WORLD_SCALE on
 *  screen), the parity planes counter-phased. Stays well under CW = 6. */
const SWAY_PX = 1.2;
const SWAY_HZ = 0.35;
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
      debugDepth(): { monument: number | null; sun: number | null; foliageX: number[] };
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
): Promise<() => void> {
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

  // Land dims from the (fixed-size) window at the scaled cell size. Equal
  // window sizes + equal scale across terminals ⇒ equal ground row ⇒
  // ground-line continuity once the broker aligns window y.
  const cols = Math.max(40, Math.floor(app.screen.width / (CW * WORLD_SCALE)));
  const rows = Math.max(20, Math.floor(app.screen.height / (CH * WORLD_SCALE)));
  const skyH = rows - SURFACE_BAND - 1 - UNDER_H;
  const seed = fnv1a(`terminal:${wing}`);
  // Memory stream (Tier-1 society): the desktop terminal gets the DB-backed
  // writer namespaced per wing; the web preview degrades to the null writer.
  // Each terminal window is its own renderer process → its own bootstrap.
  let memory = getCurrentMemoryWriter() ?? nullMemoryWriter;
  void bootstrapMemory({
    namespace: { cellId: cellIdFor(seed), libraryId: libraryIdFor(null) },
  }).then((r) => {
    memory = r.writer;
    // Persisted marks (the palace's exact read path) — the 12 most
    // recent; stored y is advisory, the display row re-derives from the
    // live surface inside addMarkView.
    for (const m of r.writer.placedMarksForCell(cellIdFor(seed)).slice(0, MARK_RENDER_CAP)) {
      addMarkView(m.agentId, m.text, m.location.x);
    }
    seedWear(r.writer); // fresh-process path (bootstrap cache was cold)
  });
  // Each wing owns a DISTINCT slice of the library — same games in the same
  // order across terminals made t1/t2 read as copies, not as two wings.
  // Deterministic rotation by wing hash; real profile wings replace this in T2.
  const rot = fnv1a(wing) % SAMPLE_LAND.length;
  const games: LandGame[] = Array.from(
    { length: 5 },
    (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length],
  );
  const composeOpts = { width: cols, skyH, surfaceBand: SURFACE_BAND, underH: UNDER_H, withPlayer: false, mural: true };
  let model = composeLand(seed, games, composeOpts);

  // Persistent transform container; the land SCENE is a swappable child so a
  // join can recompose the terrain without disturbing beings / edges / sparks.
  const world = new Container();
  world.scale.set(WORLD_SCALE);
  app.stage.addChild(world);

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

  let scene = buildLandContainer(theme, model);
  let sceneContainer = scene.container;
  let contentH = scene.contentH;
  world.addChildAt(sceneContainer, 0);

  // Bottom anchor: dead space (if any) lives behind the sky, never below
  // the bedrock — the land sits on the window sill.
  const layoutWorld = (): void => {
    world.x = Math.floor((app.screen.width - model.width * CW * WORLD_SCALE) / 2);
    world.y = app.screen.height - contentH * WORLD_SCALE;
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
  // in a captionFor box — fade in, hold, fade out on elapsedS (freezes
  // under throttle). While the slot is occupied, passes don't queue.
  const CAPTION_MAX_W = 24;
  let reveal: { mark: MarkView; startedAtS: number } | null = null;
  const caption = new BitmapText({
    text: '',
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fg) },
  });
  caption.visible = false;
  world.addChild(caption);

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
  interface WispView { spec: WispSpec; text: BitmapText }
  let wispViews: WispView[] = [];
  const buildWisps = (): void => {
    for (const w of wispViews) w.text.destroy();
    wispViews = [];
    if ((theme.landOmit ?? []).includes('cloud')) return; // a pack that deletes clouds gets no wisps either
    wispViews = extractWisps(model, seed).map((spec) => {
      const text = new BitmapText({
        text: spec.text,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: landRoleFill(theme, 'cloud') },
      });
      text.y = spec.row * CH;
      text.alpha = 0; // positioned + faded on the first tick
      world.addChildAt(text, 1); // same plane as the label overlays
      return { spec, text };
    });
  };
  let muralState: TerminalMuralState = 'idle';
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
    model = composeLand(seed, games, {
      ...composeOpts,
      ...(join ? { join } : {}),
      ...(closedWings.length > 0 ? { skyline: closedWings } : {}),
    });
    world.removeChild(sceneContainer);
    sceneContainer.destroy({ children: true });
    scene = buildLandContainer(theme, model);
    sceneContainer = scene.container;
    contentH = scene.contentH;
    world.addChildAt(sceneContainer, 0);
    layoutWorld();
    refreshWear(); // worn columns survive a join recompose
    drawMarks(); // marks re-sit on the reshaped surface
    hideBakedLayers();
    buildSiteLabels(); // rebuilt at alpha 0 — a reshaped land re-earns its reveals
    buildWisps(); // same — the composed clouds are new, so the wisps must be too
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

  // ── Edges: closed = wall; open = a bright threshold doorway ────────────
  let edges = { left: false, right: false };
  const edgeLayer = new Container(); // child of world → local cell space
  world.addChild(edgeLayer);
  /** Pulsing open-edge markers, animated in tick(). */
  const thresholds: BitmapText[] = [];

  const drawEdges = (): void => {
    thresholds.length = 0;
    edgeLayer.removeChildren().forEach((c) => c.destroy());
    for (const side of ['left', 'right'] as const) {
      const edgeCol = side === 'left' ? 0 : model.width - 1;
      const surfaceRow = model.surface[edgeCol];
      if (edges[side]) {
        // Open: a doorway at the ground line, not a wall — the existing
        // land edge vocabulary (‹ ›), brightened + pulsing.
        const mark = new BitmapText({
          text: side === 'left' ? '‹' : '›',
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
        });
        mark.x = edgeCol * CW;
        mark.y = (surfaceRow - 1) * CH;
        edgeLayer.addChild(mark);
        thresholds.push(mark);
      } else {
        // Closed: a wall that visibly meets the land (fg, not fgDim — the
        // old wall failed the glance test).
        const lines: string[] = [];
        for (let y = 0; y < model.height; y++) {
          if (y === surfaceRow) lines.push(side === 'left' ? '▌' : '▐');
          else lines.push(y % 4 === 2 ? '╎' : '║');
        }
        const wall = new BitmapText({
          text: lines.join('\n'),
          style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fg) },
        });
        wall.x = edgeCol * CW;
        wall.y = 0;
        edgeLayer.addChild(wall);
      }
    }
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
  ): void => {
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
    const key = `${join.left ?? ''}|${join.right ?? ''}|${closedWings.join(',')}`;
    if (key !== joinKey) {
      joinKey = key;
      recompose(join.left === undefined && join.right === undefined ? null : join);
      if (edges.left && !prev.left) startKnit('left');
      if (edges.right && !prev.right) startKnit('right');
    }
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

  const spawnSpark = (side: 'left' | 'right'): void => {
    const edgeCol = side === 'left' ? 0 : model.width - 1;
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
    b.returningSince === null;

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
    if (shouldFireAttention(throttleState, state, isInitial)) onAttention();
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

  const tryExit = (b: Being, side: 'left' | 'right'): void => {
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
        b.exitingSince = elapsedS; // ease out past the edge, then destroy
        spawnSpark(side);
      } else {
        b.pending = false;
        b.dir = side === 'left' ? 1 : -1; // refused — turn around
      }
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

    // Tier-2 structure glow: monuments (and a hall, if one ever composes
    // here) pulse gently; ☼ sun/lamps cycle slower. Cos-eased off elapsedS
    // (deltaMS-accumulated), so it freezes cleanly under throttle.
    const glow = (periodS: number, [lo, hi]: [number, number]): number =>
      lo + (hi - lo) * (0.5 - 0.5 * Math.cos(((elapsedS % periodS) / periodS) * 2 * Math.PI));
    const structAlpha = glow(GLOW_STRUCT_PERIOD_S, GLOW_STRUCT_RANGE);
    for (const t of scene.layers.monument ?? []) t.alpha = structAlpha;
    for (const t of scene.layers.hall ?? []) t.alpha = structAlpha;
    const sunAlpha = glow(GLOW_SUN_PERIOD_S, GLOW_SUN_RANGE);
    for (const t of scene.layers.sun ?? []) t.alpha = sunAlpha;

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
    // (glyphs move BETWEEN cells — never snap-to-cell).
    const sway = Math.sin(elapsedS * SWAY_HZ * 2 * Math.PI) * SWAY_PX;
    (scene.layers.foliage ?? []).forEach((t, i) => {
      t.x = i % 2 === 0 ? sway : -sway;
    });

    // #19 slice 2: cloud drift — wall-clock so same-wing windows agree and a
    // woken throttle snaps to where the sky has got to (no accumulator).
    const skyT = Date.now() / 1000;
    for (const w of wispViews) {
      const xc = wispX(w.spec, skyT, model.width);
      w.text.x = xc * CW;
      w.text.alpha = wispAlpha(w.spec, xc) * 0.9;
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
      if (b.exitingSince !== null) {
        const p = (elapsedS - b.exitingSince) / EXIT_S;
        if (p >= 1) {
          removeBeing(b.id);
          continue;
        }
        b.text.x = Math.round((b.x + b.dir * p) * CW);
        b.text.y = surfaceLocalY(b.x);
        b.text.alpha = 1 - p;
        continue;
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

        if (b.x <= 0) {
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
        caption.text = captionFor(mark.note, CAPTION_MAX_W);
        caption.x = Math.max(0, Math.min(model.width * CW - caption.width, Math.round(mark.col * CW - caption.width / 2)));
        caption.y = markDisplayRow(model.surface, mark.col) * CH - caption.height - CH;
        caption.alpha = 0;
        caption.visible = true;
        world.addChild(caption); // re-append → topmost over runtime-added texts
      }
    } else if (!marks.includes(reveal.mark)) {
      // Evicted by the render cap mid-reveal: close the caption safely.
      caption.visible = false;
      reveal = null;
    } else {
      const t = elapsedS - reveal.startedAtS;
      const total = REVEAL_FADE_S + REVEAL_HOLD_S + REVEAL_FADE_S;
      caption.alpha = t < REVEAL_FADE_S
        ? t / REVEAL_FADE_S
        : t < REVEAL_FADE_S + REVEAL_HOLD_S
          ? 1
          : Math.max(0, (total - t) / REVEAL_FADE_S);
      if (t >= total) {
        caption.visible = false;
        reveal = null;
      }
    }
  };
  app.ticker.add(tick);

  // ── Broker wiring ────────────────────────────────────────────────────────
  const unsubTopology = subscribeTerminalTopology(({ joins, wings, allWings }) =>
    applyJoins(joins, wings, allWings),
  );
  const unsubEnter = subscribeTerminalAgentEnter(({ agentId, side, state, from }) => {
    if (beings.has(agentId)) return; // duplicate guard
    spawnSpark(side);
    const b = addBeing(agentId, side === 'left' ? 0 : model.width - 1, side === 'left' ? 1 : -1, true);
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
      b.dir = state.dir;
      b.bobPhase = state.bobPhase;
      b.intent = resumeIntent(state.intent, side, intentCtx(b.x));
      if (state.mind) b.mind = reconstructMind(agentId, Math.round(b.x), surfaceRow, state.mind);
    }
    // The arrival is a PERCEPTION now — queued on the mind, drained (and
    // written to memory) by the next re-pick's routeTier1. recordArrival
    // is boot-spawn-only as of T2.
    b.mind.perceptionQueue.push({
      kind: 'terminal_arrival',
      subject: wing,
      at: { x: Math.round(b.x), y: surfaceRow },
      when: Date.now(),
    });
    recordCrossing(memory, {
      agentId,
      fromWing: from?.wing || '?',
      toWing: wing,
      col: Math.round(b.x),
      row: surfaceRow,
      whenMs: Date.now(),
    });
  });
  const unsubNeighbour = subscribeTerminalNeighbourSummary(({ side, beings: bs }) => {
    neighbourNear[side] = bs;
  });
  void getTerminalTopology().then(({ joins, wings, allWings }) => applyJoins(joins, wings, allWings));
  drawEdges();

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
      foliageX: (scene.layers.foliage ?? []).map((t) => t.x),
    }),
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
  };

  return () => {
    flushWear(); // final wear write — teardown must not lose the session
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
