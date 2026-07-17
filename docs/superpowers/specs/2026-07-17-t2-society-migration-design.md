# T2 society migration — the real cohort moves into the terminal lands — design

**Date:** 2026-07-17 · **Source:** the terminals-first direction (STATE.md
2026-07-17) + PRD-snapping-terminals §T2 + the living-society slice's
deferred list (real cohort defs, migrateRuntime-over-IPC, Tier-1 dispatch
on arrival with a no-LLM rail, proper ObservationSource token, relaunch
persistence). Harry pre-decided the four open questions: **cohort replaces
natives; Tier-1 fires on arrival only; homes-only persistence; full
personality (biases + presence dynamics) ports over.** Architecture:
**hybrid — land walker body, real agent-runtime mind** (chosen over a
runtime shim and over a full behavior.ts port).

## Problem

The terminal lands are alive but anonymous. Each terminal spawns
`BEINGS_PER_TERMINAL` generic walkers (`t1-☺0`-style ids, glyphs from
`BEING_GLYPHS`, accents hash-picked by `beingAccentRole`) — bodies without
identities. The real society — the 5-agent `COHORT` (Loki, Archivist, Cat,
Visitor, Ghost) with personas, deny-verbs, Tier-1 throttles, presence
schedules — lives only in the top-down cell surface, which the 2026-07-17
direction demoted to design corpus. Concretely:

- No cohort member ever appears on the desk; the killer-demo surface shows
  strangers.
- No LLM ever fires from a terminal (`terminalMemory.ts` records only) —
  the magic surface is dark on the product surface.
- Crossings write memory under the frozen `'self_perception'` source (the
  deferred schema bump).
- Handoffs carry only `{speed, dir, intent-kind, bobPhase}` — no mind
  state crosses a seam.
- Relaunch restores the desk's windows but respawns fresh beings — the
  society reshuffles nightly.

## Approaches considered

- **A. Land-first shim**: keep the walker, feed a minimal local runtime
  shim into a routeTier1-like call. Least wiring, but a second
  implementation of the Tier-1 contract that drifts from cell semantics
  (throttle edges, counter accrual, telemetry). Rejected.
- **B. Full runtime port**: run behavior.ts's 2-D BT + scopes on the land.
  The BT is cell-grid-shaped (doors, shelves, FOV); the land is a 1-D
  surface; heavy adaptation, regression risk on both surfaces. Rejected.
- **C. Hybrid** (chosen): the proven `Being` walker stays the body
  (sub-cell easing, bob, sparks, the pure intent engine); each cohort
  member gets a REAL `AgentRuntimeState` (via `initialRuntime` + a
  per-terminal `RuntimeScope`) as the mind, so `routeTier1` runs
  UNCHANGED. One contract, no shim divergence, smallest honest diff.

## Design

### 1 · Population + homes

The generic-native spawn loop in `terminalLand.ts` is retired
(`BEINGS_PER_TERMINAL`, `BEING_GLYPHS`, `beingAccentRole` usage for
natives go with it). On terminal mount, the terminal spawns the cohort
members whose **home** is its wing:

- Homes resolve from the persisted society in config when present (§5),
  else deterministic round-robin over the desk's open wings in `COHORT`
  order. One terminal open → all five live there.
- A persisted home whose wing is not on the restored desk falls back to
  round-robin over open wings — nobody is ever stranded invisible.
- Sprites carry the real identities: `AgentDef.glyph` (L, A, c, V, G)
  tinted via `def.paletteKey` — the same accents the cell and the ladder
  use for these beings.
- Roster registration (`terminalAgentSpawn`, first-writer-wins) and its
  reload-refusal semantics are unchanged.

The palace cell surface keeps its own cohort mounting as today; both
surfaces share one sqlite memory stream — the same five beings seen from
two camera angles. No interplay beyond the shared DB (they are different
run modes).

### 2 · Personality on land

A small pure per-agent bias table (`landPersona` beside
`src/terminal/beingIntents.ts`): per-intent score offsets, a speed range,
and a re-pick cadence derived from `def.tier0StepMs`. `pickIntent` gains
an optional bias parameter (absent → current behavior, so the existing
smoke stays meaningful). Character reads:

- **Loki** — fast, wander/watch_edge-biased (drawn to open seams).
- **Archivist** — approach-biased toward labelled structures.
- **Cat** — slow, rest-biased near structures.
- **Visitor** — wander-biased, ordinary pace.
- **Ghost** — slow drift, rest-biased.

Presence dynamics reuse **`tickPresence` unchanged** (it is already a pure
function of `(def, runtime, ctx, mountedAt, nowMs)`): Visitor's
90s-per-15-min cycle and Ghost's rare appearance work on land. The land
supplies the minimal `ctx` it needs. Ghost's theme gate reuses the pure
`filterByTheme` (cohort.ts) at land spawn — a theme-excluded agent simply
never spawns on that terminal, exactly the cell's semantics; any persisted
home it has is kept harmlessly. Absent agents fade out through the
existing enter/exit easing, tick nothing, cross nothing, and KEEP their
roster home.

### 3 · Mind wiring — Tier-1 on arrival

Each terminal renderer owns a `RuntimeScope`; spawn and arrival create a
real `AgentRuntimeState` via `initialRuntime` at the being's land
position (x = column, y = surface row).

- **Trigger (arrival only):** a crossing's arrival queues one perception
  event (`kind: 'terminal_arrival'`, subject = wing) on the runtime.
  `routeTier1(def, runtime, scene, now, {memory})` is called on the
  walker's re-pick cadence, fire-and-forget — an empty queue is a free
  no-op (`'empty_queue'`), so this is cell parity, and a throttled
  arrival's event drains on a later call instead of stranding
  (routeTier1 checks throttle BEFORE draining). Only arrivals queue
  events, so dispatch remains arrival-driven. The direct
  `recordArrival` call on crossing-arrivals is REMOVED — routeTier1's
  drain writes that observation (same importance via the default) —
  while boot spawns keep `recordArrival` (no queue, no dispatch at
  boot) and `recordCrossing` is unchanged.
- **Scene string:** names the land and its labelled structures WITH their
  columns ("the monument stands near column 34"), so the existing
  `approach x,y` intent format is expressible. No worker prompt change,
  no whitelist widening.
- **Consumption (cell parity):** if `tick.intent` parses as
  `approach x,y` (the cell's `parseIntentTarget` format), the walker gets
  `{kind:'approach', targetX: clamp(x)}`; anything else is flavor —
  memory prose + telemetry — and the pure intent engine carries on. A
  pure mapper (`landIntentFromTick`) owns this; total, never throws.
- **No-LLM rail:** no key / no worker / transport failure → routeTier1's
  existing failure path (the attempt stamps `lastTier1At`, the error is
  swallowed, telemetry logs the miss) and the intent engine never
  noticed. The desk is fully alive key-free.
- **Tier-2 stays OFF on land** (that is T4's slice). `reflectionCounter`
  accrues for free inside `routeTier1`. The sleep-reflection sweep
  remains cell-scoped (`listCellPaneScopes`) — no accidental land
  dispatch.

**Cost-model entry (CLAUDE.md gate for a new runtime AI call):** Tier-1
on terminal-land arrival. Arrival-only trigger × per-agent
`tier1ThrottleMs` (30–120 s) × 5 agents; call volume is bounded by the
crossing rate — a few Haiku calls/hour on an active desk, zero idle,
zero key-free. Caching: none needed (each call is a fresh perception).
Fallback: the pure intent engine. Telemetry: existing `logTier1` rows.
CLAUDE.md gets this entry as part of the slice.

### 4 · Handoff + memory schema

- **Carried state** extends with the mind fields:
  `{lastTier1At, reflectionCounter, perceptionQueue}` alongside the
  existing `{speed, dir, intent, bobPhase}`. The queue is usually empty
  (dispatch drains it), but a throttled arrival can leave an event
  queued — carrying it (it is plain JSON) means no perception is ever
  lost at a seam. The broker forwards the state opaquely, unchanged.
- **Arrival reconstruction:** `initialRuntime` + overlay of the carried
  fields — migrateRuntime-over-IPC completed in spirit: serialize →
  exactly-once broker ack → reconstruct. The anti-ping-pong cooldown and
  duplicate-refusal guards are unchanged.
- **Schema bump:** `SCHEMA_VERSION` 2 → 3 adds
  `'terminal_crossing' | 'terminal_arrival'` to `ObservationSource`;
  `sourceFromEventKind` maps the kinds properly instead of folding to
  `'self_perception'`. Additive migration — old rows untouched, no table
  shape change.

### 5 · Persistence — homes only

The broker persists `society: Record<agentId, wing>` (wing, not
terminalId — wings are the stable identity) into config on every roster
change: spawn registration and every crossing. Same
parse-don't-strip read-modify-write discipline `TerminalSlot[]` earned
(config.ts parses the field so unrelated writes can't drop it). Boot
reads it for §1's home resolution. `LOKILIBRARY_TERMINALS_RESET=1`
clears it along with the desk (reproducible harness layouts).

### Out of scope

- Tier-2 / topology-aware reflection and morning-dispatch narration (T4).
- Orchestration proposals (T5).
- Marginalia on land, launcher beat, lore/desk events (later migration
  column items).
- Land visual polish (murals #16, land polish #19 stay their own arcs).
- Any change to the palace cell cohort path beyond sharing the DB.

## Verification

- **New smoke `smoke-t2-society.mts`:** home assignment determinism
  (round-robin + persisted restore + missing-wing fallback); bias table
  differentiation (each agent's intent distribution measurably differs
  under a fixed rand stream); `landIntentFromTick` (approach parse,
  clamp, flavor fallthrough, never throws); handoff carry/reconstruct of
  the mind fields through the real broker (mockElectronModule pattern
  from smoke-t1-broker-handoff), including a throttled arrival's queued
  event surviving the seam; presence-on-land (Visitor cycles, Ghost
  `filterByTheme`-gated, absent agents don't cross); schema v2→v3
  migration (old rows
  readable, new sources written).
- **Existing smokes updated** where the natives die
  (smoke-t1-being-intents / broker-handoff / cross-edge / society-memory
  keep their subjects but spawn cohort ids).
- **On-screen (headless e2e, then real desktop per launch-desktop-app):**
  two joined terminals show the five real glyphs with their accents; a
  crossing writes a `terminal_crossing`-source sqlite row; the arrival
  fires exactly one Tier-1 dispatch (telemetry row, or the logged
  no-LLM miss when key-free); quit + relaunch restores each agent to the
  wing it last lived in.
- Full smoke sweep + both typecheck legs green.
