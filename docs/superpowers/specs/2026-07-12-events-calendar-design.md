# Events calendar — design

*2026-07-12 · approved approach: A ("pure day-function + event ledger")*
*Decisions locked with Harry: clock = **real calendar days**; authoring =
**fully procedural, authored templates, zero new AI calls**; v1 catalogue =
**notes appear + books move** (visitor days, decor shifts deferred).*

## Why this pass

The second of the two missing v1.0-scope features (with the enrichment
budget still to come): DESIGN.md's "Loki personality" pillar — *"the world
has a calendar and stages performances… small daily surprises (books move,
notes appear)… mischief must be legible and reversible."* Today the world
has no notion of a day: nothing changes unless the user acts. This pass
gives the palace time.

The agent-mind pass (2026-07-12) built the two surfaces events need:
the trace/caption system (a mark whose walk-over note IS the "discoverable
rationale") and the perception→Tier-1/2 chain (agents can *notice* events
with zero new AI plumbing).

## Shape of the system

```
src/procedural/calendar.ts       pure selection: (day, seed, facts) → event | null
src/agents/events/stage.ts       staging: elapsed days → ledger rows + effects
src/agents/memory/*              world_events table + writer methods
src/render/levels/cell.ts        shelf overlay applied to slotToBook
src/render/overlays/morning-dispatch  "…changed while you were away" line
```

## 1 · Pure selection — `src/procedural/calendar.ts`

Lives in `src/procedural/` deliberately: it is under the module's
determinism charter (no `Math.random()`, no `Date.now()` inside the
selection function — the date arrives as an argument).

- `dayKey(date: Date): string` — local-time `YYYY-MM-DD`. Day boundary =
  local midnight.
- `buildLibraryFacts(games: readonly LibraryGame[]): LibraryFacts` — pure
  digest: dustiest / most-loved / abandoned pairs / long-dormant
  neighbours, each as `{appid, name}` lists sorted (playtime desc, appid
  asc — same tie-break discipline as `library-context.ts`).
- `eventForDay(dayKey: string, profileSeed: number, facts: LibraryFacts):
  DayEvent | null` — PRNG = `mulberry32(fnv1a(dayKey) ^ profileSeed)`
  (fnv1a over the dayKey string; XOR with the profile seed, matching the
  codebase's namespace-salt idiom). **Event probability 0.4 per day**
  (~2–3 events/week; quiet days are texture). Kind split when an event
  fires: **note 0.6 / move 0.4**. If the library lacks what a template
  needs (no dusty games, no pair), fall through the catalogue in
  deterministic order; if nothing applies → quiet day.

```ts
type DayEvent =
  | { kind: 'note'; day: string; templateId: string;
      target: { appid: number; name: string };            // resolved book
      note: string }                                       // ≤ 90 chars, authored
  | { kind: 'move'; day: string; templateId: string;
      pair: [ { appid: number; name: string },
              { appid: number; name: string } ];           // books to adjoin
      note: string };
```

**The catalogue is authored creative content** in Loki's register
(understatement, no exclamation marks, never addresses the user, ≤ 90
chars — the caption contract). 6–8 note templates + 3–4 move-pairing
templates, each `(facts, prng) → resolved event | null`. Exemplars of the
bar (final text authored in the plan):

- note / dustiest: *"two hundred hours in this one. the dust is recent.
  noted."*
- move / both-abandoned: *"both left at chapter three. they can compare
  notes."*

## 2 · Staging + ledger — `src/agents/events/stage.ts`

New table (db.ts migration, `schema_version` bump):

```sql
CREATE TABLE IF NOT EXISTS world_events (
  day        TEXT PRIMARY KEY,   -- YYYY-MM-DD; one event max per day
  kind       TEXT NOT NULL,      -- 'note' | 'move'
  payload    TEXT NOT NULL,      -- DayEvent JSON
  staged_at  INTEGER NOT NULL
);
```

`MemoryWriter` gains: `recordWorldEvent(event)`, `lastStagedDay(): string
| null`, `activeShelfMoves(nowDayKey): ShelfMove[]` (null writer: no-ops /
`[]` — web build has no events, same as marks today).

`stageMissedDays(writer, games, profileSeed, layout, now)` — needs the
live layout (to resolve mark slots), so it is invoked **via a
cell-registered closure**, the same module-level-registration pattern as
the e2e `placeMark` hook: `mountCell` registers `stageNow()` (closing
over writer/games/seed/layout) and calls it once at mount (the boot
path); App.tsx's SLEEPING→FULL wake handler calls the registered closure
(day may roll over mid-sleep); no cell mounted → staging simply waits
for the next mount. Then:

1. Walk days from `lastStagedDay + 1` to today, **capped at the most
   recent 7** (older days collapse to quiet — a month away yields at most
   7 ledger rows and the boot line says the palace kept its calendar,
   without flooding 30 marks). First run (no ledger): stage today only —
   no fake backfill.
2. Per day with an event: write the ledger row, then apply the effect:
   - **note** → `writer.recordPlan({agentId: 'loki', text: event.note,
     steps: [{kind: 'place_mark', target: 'shelf:<x>,<y>', location:
     <the target book's slot>, status: 'pending'}], status: 'active',
     importance: 6})` — it renders, persists, reveals, and enters agent
     memory through the existing machinery. The slot is resolved from the
     CURRENT layout at staging time (staging runs where layout is known).
   - **move** → ledger row only; the overlay (§ 3) reads it. The move's
     `note` becomes a `place_mark` at the pair's new shared location, so
     every rearrangement carries its rationale (the "legible" constraint).
3. Idempotent: `day` is the primary key; re-boot on the same day stages
   nothing new. Staging never throws into the caller (best-effort,
   console-warn), matching the sleep-reflection pattern.
4. Broadcast one `world_event` perception (importance 6) to present
   agents per staged event — existing `broadcast*` pattern in router.ts;
   the cohort's existing tiers do the reacting (Archivist logs it, etc.).
   No new AI surface.

**Morning-dispatch line:** when staging landed ≥1 event, the existing
overlay (boot + wake paths) gains one line: *"the palace kept its
calendar. N thing(s) changed while you were away."* (N = events staged
this call; singular/plural handled.)

## 3 · Shelf overlay — cell.ts

`slotToBook` currently assigns `books[i] → bookshelfSlots[i]`. After
building the base map, apply **active moves** (from
`writer.activeShelfMoves(today)`): each move swaps books so the pair sits
in adjacent slots. **Adjacency = consecutive indices in the
`bookshelfSlots` array** (row-major scan order, so usually spatially near
— good enough for v1; true spatial adjacency is a later refinement).
Deterministic rule: move the second book of the pair into the slot at
`index(first) + 1`; the displaced book takes the vacated slot. Defensive: skip a move if either appid is absent from the current
assignment (library changed since staging).

- **Auto-expiry: a move is active for 10 days** from its `day`, then the
  palace drifts back to base — reversibility is a property of the
  mechanism, not a UI. Expiry is a read-side filter (ledger rows are
  never deleted; they are history).
- **At most 3 concurrent active moves** (oldest beyond 3 treated as
  expired) — bounds drift from the deterministic base.
- **Locks: deferred post-v1.** With ≤3 bounded, self-expiring, historied
  moves, per-item locks are premature; the ledger is the natural surface
  when they come.

## 4 · Determinism contract

Same `(dayKey, profileSeed, library)` → same event, on every machine,
forever — pure-function smoke-locked. What is deliberately NOT
deterministic across installs: the ledger (which days were staged depends
on when the app ran) — history is personal; selection is universal.

## 5 · Verification

1. Smokes (new `scripts/smoke-calendar.mts` + staging cases): selection
   determinism (table across dates/seeds); probability bounds over a
   1000-day window (0.4 ± tolerance, kind split honoured); catalogue
   fall-through when facts are thin (empty library → always quiet);
   register lint on every template output (no `!`, ≤ 90 chars, no
   user-address); staging idempotence + 7-day cap + first-run behaviour
   (fake writer); overlay swap/expiry/3-cap/missing-appid math.
2. Existing smokes + typecheck green per task, as always.
3. E2e: debug hook to force a day's staging (`__loki` pattern), then
   screenshot: the mark renders; the pair sits adjacent (vs base shot);
   walk-over shows the note. **Mandatory screenshot-eyeball step** (per
   brain: [[reviews-miss-visual-defects]]).
4. No token/cost check needed — zero new AI calls; the only cost surface
   is +1 perception event per staged day into the existing Tier-1 budget.

## Out of scope (later)

Visitor days · decor shifts · per-item locks · island/continent-scale
events (DESIGN's "medium/rare" tiers) · the Tier-2 "fresh note" garnish
(would need its own CLAUDE.md runtime-AI scoping entry) · any event UI
beyond the morning-dispatch line.

## Files touched

`src/procedural/calendar.ts` (new) · `src/agents/events/stage.ts` (new) ·
`src/agents/memory/db.ts` + `schema.ts` + `writer.ts` (table + methods) ·
`src/agents/router.ts` (broadcastWorldEvent) · `src/render/levels/cell.ts`
(overlay + `stageNow` registration + boot-staging call) ·
`src/render/overlays/morning-dispatch.ts` (one
line) · `src/App.tsx` (wake handler calls the registered stage closure) · `src/debug/e2eHook.ts` (force
hook) · `scripts/smoke-calendar.mts` (new).
