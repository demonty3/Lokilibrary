---
up: "[[Lokilibrary]]"
---

# TODO — things only you can do

Accreting list of items blocked on user action. When I (Claude)
identify something the user has to do — provide a key, verify
something visually, decide a strategic question — it lands here so it
doesn't get buried in chat messages that scroll out of context.

**Format**: each item has a status tag, a one-line summary, what
unblocks me, and a pointer to where the blocked work lives. Mark
items DONE / SKIP and I'll prune them on the next slice.

Last updated: **2026-07-31, evening** (the ceiling-widening eyeball FIRED
its kill condition on gameboy-dmg — read as "another reshade"; the pack
was re-cut over the new omission axis + full glyph dialect and awaits a
fresh eyeball. amber-crt's glow leg unchanged. Also opened: the
diorama-neighbour probe, a NEW question distinct from the killed 09).
Previously **2026-07-31** (added the ceiling-widening eyeball gate —
gameboy-dmg + amber-crt probe packs await Harry's side-by-side).
Previously **2026-07-30** (the `wt-atmo` worktree Harry spotted in Mori was
a throwaway `--detach` sandbox from a review subagent — no code was ever off
`main` — but chasing it surfaced a whole adversarial review that died with its
session unread. Findings recovered and landed; the "only half ran" item below
is what's left.) Previously **2026-07-24** (branch prune: 45 remote branches → 2. 27 were
merged into `main`; 13 more had landed via rebase/squash so git's ancestry
check couldn't see them — verified by content, not by merge status — and
their commits are mirrored to local `refs/archive/` refs. PR #28 closed as
superseded. The last survivor, `claude/reveal-flythrough`, was then retired
by decision rather than rebased — see Done below; PR #34 closed, commit
archived. `main` now stands alone.) Previously **2026-07-17** (evening: Harry ran the snapping-terminals
human beats + the lore-ingest leg — both PASSED, moved to Done. Earlier
same day: platform direction change: **Mac-only** — the Windows/WSL
target is retired, so every "verify on Windows" item below was either
already re-verified on macOS during the 2026-06 consolidation pass (now
in Done) or re-worded for macOS. The Win32 code paths stay in-tree as
dormant OSS-contributor surface; we don't build, test, or gate on them.)

---

## Active

### 👁 EYEBALL — gameboy-dmg re-cut (omission + chunky dialect)
**Status**: the first cut's eyeball FIRED the kill condition 2026-07-31
(Harry: reads as "another reshade"). Re-cut same day over the new
omission slot (`landOmit`, style-pack slot 5) + eleven chunky
block/quadrant glyph overrides, ramp unchanged, no fx (LCD, not CRT).
All gates green (corpus 284 assertions), regression trio green. Shots:
`docs/design-reviews/2026-07-31-dmg-recut/` — `gameboy-dmg-before.png`
is the exact artifact you judged (copied, never retaken),
`gameboy-dmg-recut.png` is the new cut, `stock-phosphor.png` the
reference. Live look: `npm run dev` →
`?terminal=t1&wing=d0&theme=gameboy-dmg`.
**What**: side-by-side at wallpaper distance. **Kill condition,
inherited verbatim from the fired round**: if gameboy-dmg reads as "the
default with a green filter" rather than a different machine (monochrome
hue, quantised 4-band strata, dark structure masses), the widening
failed — iterate the pack's palette keys / ramped roles, never the
gates. Known approximation, judge it knowingly: the locked crust/foliage
and the kept ridge still render blended greens outside the 4-colour set
(engine maths, not pack-fixable).
**Unblocks**: marking the omission round eyeball-passed in STATE.md; the
remaining follow-on axes (oscilloscope 08 pack over the omission slot,
light ground for 07, cold run 3 over the new slots).

### 👁 EYEBALL — diorama-neighbour joined-pair mockup
**Status**: probe opened 2026-07-31 as a NEW question (the 09
replacement kill stands; this asks whether a hi-bit diorama world can
coexist as a *neighbour window*, seam as the boundary). Decision doc
with the inherited bars quoted verbatim:
`docs/design-reviews/2026-07-31-diorama-neighbour.md`. Mockup:
`docs/design-reviews/2026-07-31-diorama-neighbour.html` (published as its
own artifact: https://claude.ai/code/artifact/4951def3-0957-43ca-9a26-193ade95520c).
**What**: view the joined pair at wallpaper distance. **Kill condition,
frozen before the mockup was viewed**: if the glyph window reads as
downgraded beside the diorama window — if your eye refuses to return to
it — coexistence fails and the diorama stays dead at every scope. Pass =
the pair reads as a portal between genuinely different places. React
keep / kill / mutate; the verdict is recorded in the .md.
**Unblocks**: nothing mechanical — engine work stays parked behind two
preconditions regardless (in-medium round resolved; one Phase 3 sprite
surviving your curation eyeball).

### 👁 EYEBALL — amber-crt glow leg (unchanged from the ceiling round)
**Status**: shipped 2026-07-31, gates green, glow proven by same-theme
A/B pixel probe (dark floor 20 → 48). Shots:
`docs/design-reviews/2026-07-31-ceiling-widening/` (`amber-crt-glow.png`
+ the no-glow A/B leg). Live look:
`npm run dev` → `?terminal=t1&wing=d0&theme=amber-crt`.
**What**: glow reads as *glowing*, not *blurred*; text stays sharp.
**Unblocks**: closing the ceiling-widening round's amber leg in STATE.md.

### ⏳ Sleep mode on macOS — 11 idle minutes (was "verify 5B on Windows")
**Status**: the macOS idle-throttle ladder landed via `powerMonitor`
(desktop commit `7926a64`); the sleep→reflect→morning-banner chain has never
been watched end-to-end on this box.
**What**: desktop app in wallpaper mode, hands off keyboard/mouse for 11+
minutes. Logs should show `⟹ full→sleeping` (at 10 min) then
`[sleep-reflection] firing for N agent(s)`; on wake, a terminal-styled
morning banner with the overnight reflections, auto-dismissing after ~30s.
Needs `ANTHROPIC_API_KEY` in `worker/.dev.vars` + `npm run worker` running.
**Unblocks**: nothing code-side; it's the last unwatched Phase-5 surface.

### 🔔 DECIDE — the Tier-2 depth review only half ran
**Status**: the 2026-07-16 `tier2-depth-review` workflow ran **34 agents and
18 of them errored** on the usage limit that killed the session. Its results
arrived after the last turn and were never read. Recovered from the transcript
and landed on 2026-07-30 (`a47c1d2..6945474`, STATE.md has the detail): two
confirmed findings fixed, plus two that the workflow had filed under
`rejected` with an **empty reasons list** — their verifiers had died, so they
were unverified rather than refuted. Both turned out to be real.
**What's open**: the ~18 agents' worth of ground that never got covered at
all. Nobody knows what it would have found.
**Your call**: re-run a review over the same range (`965e043..HEAD` plus what
has landed since), or accept the partial pass and move on. Cost is the reason
it's your call, not mine — the original burned ~1.3M subagent tokens.
**Note while you decide**: the knit *trail* has the same tick-latency property
the glow had, and is re-anchored per tick but not at the recompose. The
original review explicitly cleared it, so it was left alone rather than
quietly widened — but if a review does re-run, that's a known place to look.

### ⏳ Bake real PixelLab sprites (Phase 3 follow-up, deferred)
**Status**: open since slice 3C. Needs `PIXELLAB_API_KEY` in
`worker/.dev.vars` + `cd <repo>; npx tsx scripts/bake-sprites.mts
--slot=bookshelf --theme=solarized-dark --n=5`. Eyeball the 5
staging PNGs, pick the survivor, copy to
`public/sprites/solarized-dark/bookshelf.png`.
**Unblocks**: Phase 3 aesthetic gate ("do sprites add value over
glyphs?"). Until verified, slice 3D (local SDXL) is parked.

### 🔔 OPTIONAL — agent-mind frontier re-run (post-Aug-1)
**Status**: the agent-mind taste gate RAN (local models on harryspc; voices
landed per Harry, 2026-07). An optional re-run against frontier Claude
models is on record for after Aug 1 if you want to hear the registers at
full quality: `npm run worker` + `npx tsx scripts/agent-mind-livefire.mts`
(~10 paid calls, pennies) with `ANTHROPIC_API_KEY` in `worker/.dev.vars`.
**Note for later** (final-review RIDE item): `scripts/*.mts` aren't covered
by `npm run typecheck` — pre-existing gap, worth its own slice someday.

---

## Periodic checks worth doing

These don't block any specific slice but earn their place in the
session if convenient:

- **Telemetry overlay (Ctrl+\`)** after each meaningful session.
  Confirms the cost trajectory against the ≤$1/user/month sanity bar
  (a dial now, not a constraint — see CLAUDE.md).
- **`RETROS/phase-2.md`** has two `___` open items (aesthetic
  question + cost envelope). The agent-mind pass gives evidence for the
  aesthetic question; the telemetry overlay answers the cost envelope.
  Once both have evidence, fill in.

---

## Done / skipped (kept for posterity until next slice prunes)

- ✅ **Reveal flythrough — RETIRED 2026-07-24** (retired, not failed).
  `claude/reveal-flythrough` / PR #34, one commit `48cc0a1` (2026-06-02),
  779 lines, no new deps: a first-run cinematic — the cell builds itself
  from the player's top games, then the camera pulls back through all six
  scale levels (Powers-of-Ten style) and holds on a "your library as a
  solar system" poster. Skippable, honored `prefers-reduced-motion`,
  auto-played once, `R` to replay, never in wallpaper mode.
  **Why retired**: it was a candidate for the headline moment, and that
  slot went to the snapping-terminals crossing (the demo moment named in
  the deliverable bar, 2026-07-11) — two competing spectacles is one too
  many. It also belongs to the earlier framing: library-as-cosmos, from
  the Steam-era living-wallpaper concept, where `main` has since moved to
  library-as-inhabited-palace (marginalia, wear, lore, seam-walking
  agents). Cost sealed it — 195 commits behind, adds files `main` never
  had, and every touchpoint (`PixiApp.ts`, `store.ts`, `App.tsx`) was
  rewritten under the migration slices: a re-implementation, not a rebase.
  **Restore** (nothing was lost — mirrored to `refs/archive/*` on origin,
  which a plain `git clone` does **not** fetch; see CLAUDE.md Conventions):
  `git fetch origin 'refs/archive/*:refs/archive/*'` then
  `git branch reveal-flythrough refs/archive/claude/reveal-flythrough`.
  A bundle of all 14 archived refs also lives on harryspc at
  `C:\Users\demon\backups\lokilibrary-archive-refs.bundle`.
  `src/procedural/macro.ts` — pure seeded generators for the upper scale
  levels, no `Math.random` — is the piece worth reaching back for if a
  step-back-and-see-the-whole-thing view ever returns.
- ✅ **Snapping-terminals human beats — VERIFIED by Harry 2026-07-17**:
  real-mouse glyph-strip drag + snap works, the 0.6s knit sweep was SEEN
  on a fresh join, tray "New terminal (dN)" spawns and the label disables
  at 6 terminals. (Re-enable-on-close not explicitly exercised — the
  wing-accounting path is harness-verified, low risk.) Closes the
  snapping-terminals verification column.
- ✅ **Lore ingest — VERIFIED by Harry 2026-07-17**: Ctrl+U → dropped
  `lore-samples/nautical.md` in the desktop app → world remounted in
  tokyo-night. 5D.4 is now signed off end-to-end; lore is
  shipped-and-seen. (Egress checkbox defaults remain smoke-covered.)
- ✅ **Windows verification column — RETIRED 2026-07-17** (Mac-only
  direction). Everything it gated was re-verified on macOS during the
  2026-06 consolidation + later arcs, or re-worded above:
  - **7-B multi-pane visual QA** — verified on macOS via the e2e harness
    (multi-pane renders, masks clip, single-pane byte-identical).
  - **7-D seam-graph draw + 7-D.2 live seam walk** — VERIFIED ON SCREEN
    macOS 2026-06-04: walkable seam edge carved, roster crossing both
    directions with BFS pathing (STATE.md has the record).
  - **5D.4 / 7-A visual pass** — lore repaint proven via e2e; ladder rungs
    eyeballed during the salience campaign (which found + fixed the ladder
    label double-draw on screen). The ladder identity slice reworks those
    surfaces next anyway. Residual: the lore-ingest leg, kept Active above.
  - **6A local-AI landmark** — PARKED: needs a local Ollama, which this Mac
    can't host. The absence is graceful (`{present:false}` → no landmark).
    Dormant contributor surface; revisit only if a local-inference box
    re-enters the picture.
  - **5A reflection verify** — superseded by the agent-mind livefire (real
    tick + reflection outputs judged against the register anchors).
  - **nomic-embed-text install** — retired on this box (no Ollama); lore
    retrieval degrades to FTS/recency by design.
- ✅ **phase3-pixelart → main merge decision** — resolved: the branch is
  merged to main with history preserved (v1.0.0 shipped from main).
- ✅ **Repo is PUBLIC** (2026-07-11): MIT licence, full-history secrets scan
  clean, https://github.com/demonty3/Lokilibrary. (Optional polish:
  GitHub About description + topics for discoverability.)
- ✅ **Sample lore files** — `lore-samples/{pastoral,nautical}.md` +
  README + `scripts/lore-preview.mts` predictor (2026-06 consolidation).
- ✅ `better-sqlite3` install + electron-rebuild (2026-05-28, Windows-era;
  kept for OSS contributors hitting the same wall: needs VS 2022 Build
  Tools, then `npm install better-sqlite3 --save --ignore-scripts &&
  npm run rebuild`).
- ✅ Phase 4A/4B/4C wallpaper verification (2026-05, Windows-era raised
  desktop, 2560×1440).
