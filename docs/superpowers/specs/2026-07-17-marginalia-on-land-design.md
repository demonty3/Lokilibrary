# Marginalia on land — marks, found-writing, persistent wear — design

**Date:** 2026-07-17 · **Source:** the terminals-first migration column,
slice 2 (memory `terminals-first-direction`; the palace's
agent-as-marginalia moat — IDEAS.md — ported to the product surface).
Harry decided the three open questions: **note reveal = being-proximity
(ambient, wallpaper-first); authoring = deterministic vocab + Tier-1
garnish (zero new AI calls); wear = persist per wing with slow decay.**
Architecture: **palace-parity reuse** (marks are plan rows through the
existing wing-namespaced writer; wear gets one additive table) — chosen
over dedicated land-marks tables and over broker-config persistence.

## Problem

The land's beings are real minds now (T2 society migration) but they
leave no trace: the only marginalia beat on the desk is session-scoped
footfall wear that evaporates on relaunch. The design moat — "the agent
expresses itself through what changes in the world: what gets placed,
what notes appear, what paths wear deeper" — lives only in the demoted
palace surface (place_mark plan steps, per-being mark glyphs, boxed
found-notes). Concretely:

- A being lingers at a monument, watches a populated edge, crosses a
  seam — and the land afterwards looks exactly as if it hadn't.
- The palace's found-writing beat (walk onto a mark, read the note) has
  no land equivalent at all — and can't be ported literally, because the
  land has **no player character**; it is watched, not walked.
- Worn paths (`▀ → ▔`) are the one trace that exists, and it resets
  every session — the desk never accumulates history.

## Decisions (Harry, 2026-07-17)

1. **Reveal = being-proximity.** A mark's note unfurls when a being
   passes near it; fully ambient, works as wallpaper with zero
   interaction. (Mouse hover, always-visible boxes, and combinations
   were considered and declined.)
2. **Authoring = deterministic + Tier-1 garnish.** Placement and note
   text are engine-driven and authored; when the mind already holds a
   real Tier-1 intent string (from the existing arrival dispatch), it
   may flavor the note. **Zero new runtime AI calls** — no CLAUDE.md
   ledger entry required; the key-free rail gets the full feature.
3. **Wear = persist + slow decay.** Footfall counts persist per wing
   and decay (halve per real-world day), so trails reflect recent habit
   and abandoned routes grow back. (Persist-forever tends to uniformly
   worn land — the feature would erase itself; session-scoped was the
   scope-cut option.)

## Approaches considered

- **A. Palace-parity reuse (CHOSEN):** marks are written as plan rows
  (`recordPlan` + a `place_mark` step) through the existing
  wing-namespaced writer and read back with the existing
  `placedMarksForCell` — zero schema change for marks; a wing's
  marginalia follows the wing to whichever window hosts it; marks live
  in the Smallville stream where T4 topology-reflection can later read
  them. Wear gets one additive table (the lore-table precedent).
- **B. Dedicated land-marks tables:** cleaner column-space coordinates
  and explicit caps, but a second marks store to keep coherent with the
  palace's, a bigger schema bump, and no free parity with the existing
  read path. Rejected.
- **C. Broker/config persistence:** works with the null writer, but
  world memory doesn't belong in window config, nothing ties into the
  memory stream, and it caps out fast. Rejected.

## Design

### 1. Placement — a side-effect of living, not a new intent

New pure module **`src/terminal/marks.ts`** (the `wear.ts` posture: no
PIXI, no IPC, no wall clock; rand injected).

At each intent **re-pick** in `terminalLand.ts`, a pure
`maybeMark(rand, ctx)` decides whether the being's *completed* intent
earns a mark. Context kinds and the intents that produce them:

| Context kind | When |
|---|---|
| `after_crossing` | first re-pick after an arrival (`enteringSince` recently set) |
| `at_structure` | completed `approach` — lingered within `APPROACH_NEAR` of a structure column |
| `at_edge` | completed `watch_edge` at an open edge |
| `mid_wander` | completed `wander`/`rest` (rare — the low-chance tail) |

Gates, all inside `maybeMark`:
- **Per-being cooldown** ~90–180 s, seeded per being (FNV-staggered, the
  `seamCooldownMs` pattern) — marks are occasional punctuation, not
  confetti.
- **Column dedupe:** no new mark within 2 columns of an existing mark on
  this land.
- **Per-context seeded chance** (`at_structure` and `after_crossing`
  likeliest; `mid_wander` a low tail).

Deliberately **NOT** a new `BeingIntent` kind: `pickIntent`'s scoring
ladder and its smoke-enforced watch_edge-dominance invariant stay
byte-identical, and `resumeIntent`'s unknown-kind→wander decay means a
new kind would be handoff-fragile. Placement rides the re-pick clock as
a side-effect.

Randomness comes from the land's existing `makeRng` runtime stream
(renderer-side "deterministic-enough", the walker contract). Nothing
here touches `src/procedural/`.

### 2. Note text — authored vocab, garnished by the mind

Per-being, per-context line tables in `marks.ts`, written in the
agent-mind voices (the `LAUNCH_MARK_NOTES` pattern — deterministic paths
must already be in-voice). Some templates carry a `{thought}` slot: when
`being.mind.intent` holds a non-empty Tier-1 string (produced by the
existing arrival dispatch), it is folded in, lowercased, into the note —
the mind's actual words reach the land with zero new calls. Missing or
empty intent → a pure authored line; the vocab table is total (every
being × every context has lines). Notes are **local-only** — rendered
and persisted on-device, never egressed.

### 3. Storage — the palace's exact shape

A placed mark is:

```ts
writer.recordPlan({
  agentId,
  text: note,
  steps: [{ kind: 'place_mark', location: { x: col, y: surfaceRow }, status: 'pending' }],
  status: 'active',
  importance: 6, // palace launch-mark parity (cell.ts)
})
```

(`status: 'active'` + step `'pending'` is load-bearing, not a quirk:
`placedMarksForCell` filters to exactly that pair — the palace's
launch-mark shape. A `'done'` mark would be invisible to the read
path.)

against the **already-wing-namespaced** writer `terminalLand.ts` holds.
Mount-time render reads `placedMarksForCell(wingCellId)` — the palace's
retrieval, unchanged. Consequences, all free:

- **Zero schema change** for marks (schema v3 untouched; no new
  `ObservationSource` token needed — a mark IS a plan row, already a
  first-class stream citizen).
- A wing's marginalia follows the wing to whatever window hosts it, and
  survives relaunch.
- T4 topology-reflection will find marks in the stream without new
  plumbing.

**Render cap:** the 12 most recent marks per land (retrieval already
caps at 64 plan rows; the render slice keeps the land uncluttered).

**Coordinate subtlety:** the stored `y` (surface row at placement) is
advisory. The display row is **re-derived from the current model's
surface height at that column** — the joined-edge Hermite ramp shifts
surface rows near seams, and a mark must sit on the ground as it is
*now*. Store `y` anyway (the `PlanStep.location` shape requires it, and
it documents placement-time truth).

**Null writer** (web preview / pre-bootstrap): `recordPlan` no-ops →
marks are session-only, live-rendered from an in-memory list; everything
else behaves identically.

### 4. Rendering + the reveal

- **Mark glyphs**: a `marksLayer` in `terminalLand.ts` (sibling of
  `edgeLayer`), one BitmapText per mark, glyph + tint from the shared
  mark-style table (§5) — a mark wears its AUTHOR's accent, ghost takes
  `mark.ghost` (the MARK_STYLES re-key decision, 2026-07-17). Marks sit
  at the surface row (one above the crust) of their column, re-derived
  at render time per §3.
- **Reveal**: when any being's column comes within ~1.5 cells of a mark
  whose reveal cooldown (~60 s per mark) has passed, the note unfurls in
  a `captionFor`-boxed BitmapText above the mark: fade in, hold ~4 s,
  fade out — driven by the existing elapsed-seconds ticker (freezes
  under throttle, like every other land animation). **One reveal at a
  time per land** (a single slot; while occupied, passes don't queue) —
  the land stays quiet, notes stay an event.

### 5. Shared helpers — pure extraction from cell.ts

Two module-local pieces of `cell.ts` become small shared modules, both
pure data/functions, palace behavior unchanged:

- **`MARK_STYLES` + `DEFAULT_MARK_STYLE`** (glyph + role + fallback per
  agent id) → a shared module (e.g. `src/agents/markStyles.ts`);
  `cell.ts` and `marks.ts` both import it. One vocabulary of trace
  glyphs across both surfaces is the point of the migration.
- **`captionFor`** (word-wrap + `╔═╗` box) → a shared pure module (e.g.
  `src/render/noteBox.ts`); `cell.ts` re-imports.

### 6. Persistent wear

**Additive table** (the lore-table precedent — own table, no migration
of existing tables):

```sql
CREATE TABLE IF NOT EXISTS land_wear (
  cell_id    TEXT NOT NULL,
  col        INTEGER NOT NULL,
  count      REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (cell_id, col)
);
```

Writer gains two namespace-closured methods (+ null-writer no-ops):
`landWearForCell(): Array<{col, count, updatedAt}>` and
`flushLandWear(entries, nowMs)` (upsert; one transaction).

**Lazy decay, no background job:** effective count on read =
`count × 0.5^((now − updated_at) / 86_400_000)`; rows whose effective
count falls below 1 are pruned on flush. Wall-clock is fine here —
renderer-side, the `lastTier1At` time-base precedent; `src/procedural/`
is untouched.

**`wear.ts` changes:** `createFootfall(threshold?, initial?)` accepts
persisted seed counts (columns at/past threshold start worn) and exposes
its counts for flushing (`snapshot(): ReadonlyMap<number, number>`).
Mount seeds footfall from the DB through the decay function; dirty
counts flush every ~30 s and on teardown — never per footstep (WAL
churn; the DB is WAL-shared across renderer processes,
`busy_timeout=3000` already set).

### 7. e2e surface

`__terminal.state()` gains
`marks: Array<{col, agentId, revealed: boolean}>` (+ live reveal state);
a `debugMark(col, agentId?)` hook mirrors `debugWear` so the e2e harness
can place a mark on demand instead of waiting out a cooldown.

## Not in this slice

- **Mouse-hover reveal** (declined for now; ambient-only).
- **Tier-2 / topology reflection reading marks** (T4 arc — the storage
  choice feeds it for free).
- **Palace-side changes** beyond the two pure extractions.
- **Wear stages beyond the existing two** (`▀ → ▔` only; a deeper ramp
  is land-polish territory).
- **Marks crossing seams** — a mark belongs to its wing's land and
  renders wherever that wing renders; it never migrates.

## Verification

- **`smoke-t2-marks`** (pure): `maybeMark` trigger cadence per context,
  cooldown gate, column dedupe, cap; vocab totality (every being ×
  context yields a line) + `{thought}` garnish substitution incl. the
  empty-intent fallback; surface-row re-derivation against a ramped
  model; reveal slot (one at a time, cooldown, proximity edge cases).
- **`smoke-land-wear-persist`** (pure + real better-sqlite3, the
  t1-society-memory pattern): decay math (half-life, prune-below-1),
  flush/restore round-trip, `createFootfall` seeding (pre-worn columns
  render worn from frame one), dedupe of flush upserts.
- **Existing smokes stay green byte-identically** — in particular
  t2-society (intent ladder untouched), t1-broker-handoff (no new
  intent kind), smoke-land-seam (composeLand untouched).
- **On-screen (real desk):** a being lingers at a structure → its mark
  appears wearing its accent; another being passes → the note unfurls,
  holds, fades; `LOKILIBRARY_TERMINALS=2` relaunch WITHOUT reset → the
  same marks and the same worn columns are there before any being
  moves. Key-free rail (no worker): identical behavior minus the
  garnish.
- Full smoke sweep + both typecheck legs green.
