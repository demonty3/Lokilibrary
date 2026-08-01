# Docs index — where the authority lives

Reconciled 2026-05-28 as Phase 5 slice 5R; routing refreshed 2026-08-01
(PLAN.md rewritten as the roadmap of record). This page is the single
map of which doc owns which question. **When in doubt, check this
index, not your memory.**

## Authoritative docs (read these)

| Scope | Authority | Path |
|---|---|---|
| **Roadmap: directions, next slices, statuses, open decisions** | `PLAN.md` | `PLAN.md` |
| **Day-to-day rules, conventions, what not to do** | `CLAUDE.md` | `CLAUDE.md` |
| **Present-tense state + per-slice evidence** | `STATE.md` | `STATE.md` |
| **The active arc's full spec (snapping terminals T0–T5)** | `PRD-snapping-terminals.md` | `docs/PRD-snapping-terminals.md` |
| **Long-form spec (architecture, surfaces, schemas)** | `SPEC.md` | `SPEC.md` |
| **Parked ideas, future directions** | `IDEAS.md` | `IDEAS.md` |
| **The assembled long view (map of the above)** | `VISION.md` | `VISION.md` |
| **Design-review verdicts (frozen; statuses live in PLAN.md)** | (dated) | `docs/design-reviews/` |
| **Per-phase retros (per-slice from 4A onward)** | `RETROS/phase-*.md` | `RETROS/` |
| **User-blocked items (only the user can do these)** | `TODO-USER.md` | `TODO-USER.md` |
| **Strategy-era v1.0 scope (2026-05, partly superseded)** | `CONSOLIDATION.md` | `docs/pivot/CONSOLIDATION.md` |
| **Pivot design + feasibility background** | `DESIGN.md` + `FEASIBILITY.md` | `docs/pivot/` |
| **Dated research reports** | (timestamped) | `docs/research/` |
| **Style-pack authoring (for users' own agents)** | `style-pack.md` | `docs/blueprints/style-pack.md` |

When two docs disagree:
- **What to build next / statuses** → `PLAN.md` wins (rewritten
  2026-08-01 as the roadmap of record; maintenance rule: slice closure
  updates it). `STATE.md` carries the evidence behind each status.
- **Day-to-day conventions** → `CLAUDE.md` wins.
- **Strategy / scope** → the direction banners in `PLAN.md` +
  `CLAUDE.md` win. `docs/pivot/CONSOLIDATION.md` is strategy-era
  (2026-05-27): still the best statement of the pillars and the v1.0
  MVP reasoning, but its distribution section is superseded by the
  2026-07-11 free-OSS direction and its scope predates terminals-first.
- **Schemas / surface definitions** → `SPEC.md` wins (but check Phase
  retros — Phase 2D and later often updated schemas without
  re-syncing SPEC.md verbatim).
- **Design verdicts and bars** → the dated doc in
  `docs/design-reviews/` is frozen; bars inherit verbatim into new
  documents, and current live/parked status lives in `PLAN.md`.

## Recent strategic updates worth knowing

- **2026-06-11 `docs/PRD-snapping-terminals.md`** (new, ACTIVE): separate
  terminal OS windows that snap together to join side-on worlds — agents
  walk between windows. Supersedes same-day `PRD-composable-panes.md`
  (in-app panes; deleted — see git history) after Harry clarified the
  vision. The Terminal-Terraria visual PRD stays parked at its V0 gate
  (spike shipped, verdict "not yet").

- **2026-05-28 `IDEAS.md`** (your additions): Sleep mode, Living
  world, Composable panes. The Sleep mode entry promotes itself to
  Phase 5 slice 5B per the 5R reconciliation. Living world is a v1.x
  reframe — captured but not in v1.0 scope. Composable panes is the
  pane-as-substrate direction; v2.x territory per CONSOLIDATION.md's
  "not in v1.0: scale ladder" line.
- **2026-05-27 `CONSOLIDATION.md`** (new): the single source of truth
  for "what is v1.0." Explicitly excludes: chaos/conflict, scale
  ladder, multi-agent society, dream mode.
- **2026-05-27 Phase 4** shipped (4A wallpaper throttle, 4B
  multi-monitor picker, 4C peek hotkey). See `RETROS/` for any
  retro that exists; Phase 4 retro is a stub at time of writing.

## Legacy / superseded (don't reactivate without lifting deliberately)

The project pivoted from a 3D Three.js build to a 2D pixel-art Memory
Palace in May 2026. The 3D-era assets are preserved but **not part of
the active build**. Per `CLAUDE.md` "Things to NOT do":

> Don't reach into `legacy-3d/` or `legacy-desktop-v0.6/`. They're
> preserved as references; not part of the active build. Lift specific
> files (already done for Mulberry32, FNV-1a, and Phase 1's
> `playerPos` + `scatter`); don't reactivate the rest.

Reference branches on the remote (3D era, MERGED but representing the
pre-pivot product):
- `claude/phase1-renderer-foundations` — last 3D-era code on main
- `claude/phase4-state-visual-treatment` — 3D-era SPEC §4 work
- `claude/phase5-slice1-prng-seed` through `phase5-slice5-scatter` —
  the 3D-era Phase 5 (procedural layout, share-URL, paths, scatter).
  Phase 5 in the *Memory Palace* numbering is different — see
  `PLAN.md` § Phase 5.
- `claude/phase6-slice1-electron-skeleton` through
  `phase6-slice6-hotkey-peek` — Electron + Steamworks + wallpaper mode
  + multi-monitor + peek hotkey. **Pattern source for Memory Palace
  Phase 4A/4B/4C** (the desktop wrapper layer is identical between
  eras; lifted patterns are explicitly documented per slice).

`legacy-3d/` and `legacy-desktop-v0.6/` directories on disk hold the
pre-prune code for archeology. `SPEC.md` Appendix A is the 3D-era
spec preserved verbatim.

## Quick-reference: what to check before non-trivial work

1. **Strategy or scope question?** Read PLAN.md's direction banners
   (CONSOLIDATION.md for the 2026-05 pillars background).
2. **Convention question?** Read CLAUDE.md.
3. **"What's the next slice?"** Read PLAN.md (the depth track + slice
   ladder).
4. **"How does feature X work today?"** Read STATE.md's entry, then
   the relevant `RETROS/` phase, then the code.
5. **"Is this a parked idea?"** Read IDEAS.md.
6. **"Why did we pivot from 3D?"** Read `docs/pivot/DESIGN.md` +
   `FEASIBILITY.md`.
