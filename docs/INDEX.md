# Docs index — where the authority lives

Reconciled 2026-05-28 as Phase 5 slice 5R. The project has accumulated
docs across the 3D era + the Memory Palace pivot + strategic
brainstorms; this page is the single map of which doc owns which
question. **When in doubt, check this index, not your memory.**

## Authoritative docs (read these)

| Scope | Authority | Path |
|---|---|---|
| **Strategy + v1.0 scope** | `CONSOLIDATION.md` | `docs/pivot/CONSOLIDATION.md` |
| **Day-to-day rules, conventions, what not to do** | `CLAUDE.md` | `CLAUDE.md` |
| **Phase + slice plan, sequence of work** | `PLAN.md` | `PLAN.md` |
| **Long-form spec (architecture, surfaces, schemas)** | `SPEC.md` | `SPEC.md` |
| **Parked ideas, future directions** | `IDEAS.md` | `IDEAS.md` |
| **Per-phase retros** | `RETROS/phase-*.md` | `RETROS/` |
| **Pivot design + feasibility background** | `DESIGN.md` + `FEASIBILITY.md` | `docs/pivot/` |
| **Dated research reports** | (timestamped) | `docs/research/` |

When two docs disagree:
- **Strategy / v1.0 scope** → `docs/pivot/CONSOLIDATION.md` wins.
  It's the newest (2026-05-28) and the most opinionated about what's
  v1.0 vs v1.x vs Year-2.
- **Day-to-day conventions** → `CLAUDE.md` wins.
- **Slice sequencing** → `PLAN.md` wins, but Phase 5+ should be cross-
  checked against `CONSOLIDATION.md` for v1.0 scope alignment (5R did
  this reconciliation for Phase 5; future phases may need similar
  passes).
- **Schemas / surface definitions** → `SPEC.md` wins (but check Phase
  retros — Phase 2D and later often updated schemas without
  re-syncing SPEC.md verbatim).

## Recent strategic updates worth knowing

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

1. **Strategy or scope question?** Read CONSOLIDATION.md.
2. **Convention question?** Read CLAUDE.md.
3. **"What's the next slice?"** Read PLAN.md § current phase.
4. **"How does feature X work today?"** Read the relevant `RETROS/`
   phase first, then the code.
5. **"Is this a parked idea?"** Read IDEAS.md.
6. **"Why did we pivot from 3D?"** Read `docs/pivot/DESIGN.md` +
   `FEASIBILITY.md`.
