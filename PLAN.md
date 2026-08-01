---
up: "[[Lokilibrary]]"
---

# PLAN — roadmap of record

**What this file is.** The single answer to "what do we build next."
Direction banners, the slice ladder with status, the numbered backlog
with status, and the open decisions. **Maintenance rule: closing a
slice updates this file** — status marks live HERE, never in the
verdict docs (design reviews and retros are frozen records; bars
inherit verbatim, new documents only).

Detail lives elsewhere: `STATE.md` (present-tense state + evidence,
per slice), `docs/PRD-snapping-terminals.md` (the active arc's full
spec), `docs/design-reviews/2026-07-13-visual-programme.md` (the
numbered backlog's frozen verdicts), `IDEAS.md` (parked directions),
`VISION.md` (the long view), `TODO-USER.md` (blocked on Harry),
`RETROS/` (history). The pre-2026-08 PLAN.md — the full phase-by-phase
build plan for Phases 0–7, all shipped or superseded — is preserved in
git history (`git log --follow PLAN.md`) and summarised per-phase in
`RETROS/`.

---

## Directions in force

- **Free open source (2026-07-11).** No Steam, no monetization. Bar
  MET 2026-07-16: v1.0.0 tagged + released, README leads with the join
  moment. Licence hygiene does not relax.
- **Terminals-first (2026-07-17).** The product is the side-on
  terminals desk (`docs/PRD-snapping-terminals.md`). The top-down
  palace stays working (v1.0.0 surface, smokes green) but gets no new
  investment; palace-facing backlog items are parked, land-facing ones
  stay live.
- **Mac-only (2026-07-17).** macOS is the sole build + verification
  platform. Win32 paths stay in-tree as dormant OSS-contributor
  surface.
- **Depth over breadth (2026-07-31).** The style-pack ceiling-widening
  track is PARKED after both eyeballs passed; effort redirects to the
  terminals-first depth column. Unpark precondition, verbatim from
  `brain/decisions/lokilibrary-depth-over-breadth.md`: *"a real pack
  author needs a slot that does not exist, or the depth track reaches
  its bar."*

## The depth track (active queue, in ruled order)

1. ~~Marginalia on land~~ — **SHIPPED 2026-08-01, eyeball PASSED**
   ("this feels right"); slice closed, no tuning.
2. **Murals #16** — Hades mural terminal treatment (CDN art through
   the shade ramp, hung in a box-drawing frame). Next candidate.
   Composition input: the KEPT Mural Anchor direction (layout round 2,
   2026-08-01) — one framed mural per window as its recognisable face.
3. **Land polish #19** — monument architecture + door, constellations
   / moon / cloud wisps, ore veins / caverns, site signage, **plus**
   unopened-wing skyline silhouettes on the ridge (09 folded in,
   layout round 2, 2026-08-01).
4. **Static-beings liveliness.**

Sequencing evidence for 2–3: the **crust-legibility finding**
(2026-08-01, pinned from the diorama-neighbour probe — STATE.md +
`docs/design-reviews/2026-07-31-diorama-neighbour.md`): the desk's
shade-dither crust band reads as letter-noise to a first-time viewer;
the risk is the clone-and-run first minute. It is evidence inside
murals / #19, not a separate item.

## Snapping-terminals slice ladder (PRD §5 — statuses live here)

| Slice | Status |
|---|---|
| T0 — two-terminal joined-world spike | SHIPPED (join moment 2026-07-16; human beats passed 07-17) |
| T1 — frameless windows, registry, persistence | SHIPPED (desk persistence, tray, chains 2026-07-16) |
| T2 — one society, real runtime | SHIPPED 2026-07-17 (T2 society migration) |
| T2 remainder | OPEN — deferred from T2: Tier-2/topology reflection (→T4), the launcher beat |
| T3 — terminal identity + chrome | OPEN (parked, not rejected; glyph-chrome craft resurfaces here) |
| T4 — topology → reflection | OPEN |
| T5 — orchestration v0 (Depth-3 gated) | OPEN |
| Terminals-as-wallpaper | OPEN |

## Visual-programme backlog (numbering from the 2026-07-13 review — statuses live here)

Shipped / fixed: **#1** ladder label double-draw (salience campaign),
**#9** ambient life register, **#10** shelves read as books (both
2026-07-17 ambient-salience bundle), **#13** ladder identity pass
(2026-07-17). Several quick wins (**#2** HUD ink, **#4** seam dialect,
**#6** pane focus, **#7** note-reveal frames) were substantially
absorbed by the 2026-07-13 salience campaign (themed HUD, blue
aperture dialect, focus alpha, double-line marginalia frames) without
individual rulings.

Live (land-facing, on the depth track): **#16** murals, **#19** land
polish.

Parked (palace-facing, per terminals-first): **#12** shade-ramp
deployment, **#14** phosphor / raw ANSI, **#17** composition /
density pass.

Not individually ruled (palace-facing → implicitly deprioritized):
**#3** attention contract, **#5** tofu decor, **#8** HUD content diet,
**#11** split-reads-as-one-world (largely met by the join moment;
never formally ruled), **#15** agents need errands, **#18** district
≠ island.

## Style-pack track (PARKED 2026-07-31)

Shipped and closed: the five pack slots (palette / landGlyphs / fx /
landRamp / landOmit), the 284-assertion gate corpus, the blueprint
`docs/blueprints/style-pack.md`, cold test 2/2 (night-drive,
cozy-autumn — both merged unedited), DMG re-cut + amber-crt eyeballs
PASSED. Parked with kill conditions frozen where they stand:
oscilloscope 08 stroke-only cut, light-ground 07 e-ink, cold run 3
over the new slots. Survivor task: **README billing for the
blueprint** (mechanism credited to Deephaven 2026-02; claim scoped to
the smoke-gated version).

## Open decisions / threads

- **Shared rules across terminals** — candidate depth-track slice,
  recorded not scheduled. Canonical write-up: `IDEAS.md` § Shared
  rules across terminals.
- **Stray `*` in gameboy-dmg's sky** — painter unidentified (likely an
  event/salience overlay). Identify the painter, then rule feature vs
  leak. (STATE.md, 2026-07-31.)
- **Tier-2 depth review** — 🔔 Harry decides: re-run (18/34 agents
  errored; ~1.3M tokens) or accept the partial pass. `TODO-USER.md`.
- **Diorama-neighbour engine work** — parked behind two unmet
  preconditions (in-medium round resolved; one Phase 3 sprite
  surviving curation). Verdict:
  `docs/design-reviews/2026-07-31-diorama-neighbour.md`.
- **Enrichment budget** — the one v1.0-scoped feature still unbuilt
  (CONSOLIDATION.md; the Art system's seed). Core vision, not
  release-gated.
- **Layout directions round 2 — JUDGED 2026-08-01.** 05 KEPT (→ murals
  #16 input), 09 FOLDED into #19, 07+08 KILLED (invariant-breakers,
  tombstoned). Still open, no verdict: 02, 03, 04, 06, 10 — parked for
  a future round (`IDEAS.md` § Layout directions round 1).
- Standing gaps: `scripts/*.mts` not covered by `npm run typecheck`
  ("worth its own slice someday"); knit trail tick-latency
  (deliberately left; see STATE.md); a telemetry-schema slice
  hypothesized in `RETROS/phase-5B.md`; `docs/pivot/DESIGN.md`'s
  research questions #1 (pixel-art pipeline) and #7 (Electron vs
  Tauri — "a 2D build may reopen this", and the Steam retirement
  weakens the steamworks.js rationale) remain open on paper, untracked.
