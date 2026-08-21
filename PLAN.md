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
2. ~~Murals #16~~ — **SHIPPED 2026-08-01, eyeball PASSED**
   (STATE.md has the record; kill condition never fired). Built to the
   KEPT Mural Anchor composition — one framed, palette-quantised mural
   per window.
3. **Land polish #19** — slice 1 (evidence-first: strata material read
   + closed-wing skyline + stray-`*` ruling) **SHIPPED 2026-08-02,
   eyeball PENDING** — STATE.md has the record + the frozen bars.
   Remaining legs for slice 2: monument architecture + door,
   constellations / moon / cloud wisps, ore veins / caverns, site
   signage.
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
| T2 remainder | Launcher beat SHIPPED + eyeball PASSED 2026-08-06 (all six bars); still OPEN: Tier-2/topology reflection (→T4) |
| T3 — terminal identity + chrome | **CODE-COMPLETE 2026-08-09; both eyeballs open.** Slice 1 (per-terminal packs) SHIPPED 2026-08-08 — the seam half (knit, hermite blend, edge swap) shipped long ago; what was missing was identity, and every window wore `phosphor`. Preceded by the two-pack seam spike (`docs/design-reviews/2026-08-08-two-pack-seam.md`), which CONFIRMED the shape and added the constraint. Slice 2 SHIPPED 2026-08-09 (`docs/superpowers/specs/2026-08-09-t3-slice2-design.md`) — the world-rendered masthead (wing + who's here + holdings, in the window's own pack) and the parting frame (the wall parts outward from the ground line over 0.45 s and leaves a jamb, instead of being cut in one frame). Bars 1-6 measured on screen; bar 7 is Harry's look |
| T4 — topology → reflection | **SHIPPED 2026-08-09** (`docs/superpowers/specs/2026-08-09-t4-topology-reflection-design.md`). The desk had never dispatched Tier-2 at all — T4 owned standing the pump up, not just the context. Bars 1-6 measured on the running desk (incl. a real Sonnet reflection whose plan step was `{kind:"move_to", target:"d1"}` — the neighbour terminal, existing verb). **Bar 7 (the morning-dispatch banner) is NOT confirmed on screen**: it mounts, persists and extracts ink, but never appeared in a capture — see STATE.md |
| T5 — orchestration v0 (Depth-3 gated) | **SHIPPED 2026-08-15; eyeball (bar 8, the shy-question taste bar) OPEN.** Opt-in tray checkbox, proposal rides the T4 sleep pass (zero new AI calls), one per desk per night, banner taps `[ open it ] / [ let it pass ]`, apply spawns adjacent+joined via the existing spawn path. Spec `docs/superpowers/specs/2026-08-14-t5-orchestration-design.md`; smokes t5-proposal/t5-placement/t5-broker; STATE.md has the record + three live findings (noun-phrase targets, low organic rate, 1440px no-room) |
| Terminals-as-wallpaper | **SHIPPED + eyeball PASSED 2026-08-06** (all six bars, no dial spent) — desk wallpaper mode + desk-wide peek; spec `docs/superpowers/specs/2026-08-06-terminals-as-wallpaper-design.md` |
| Vertical stacking — underground continuation | **SHIPPED + eyeball PASSED 2026-08-18 ("the undercroft reads as one place — merged"); arc CLOSED at v0.** Probe eyeball passed same day ("the lower window reads as the same wing"), then all Phase B engine slices in one session (spec `docs/superpowers/specs/2026-08-18-underground-continuation-phase-b.md`): VJoin topology + tray spawn, composeUnderLand seam agreement, parting floor + shaft-mouth thresholds, being descent/return. Zero new AI call sites. L-shape deferred; hall/storeys parked. STATE.md has the record |
| Scale/anchor — height means depth, not zoom | **SHIPPED 2026-08-18; eyeball PASSED same day ("reads as the same wing, merged").** The full-screen ladder's load-bearing rung: DESK_SURFACE fixed from the window top, world top-anchored (pixel-identical at shipped sizes, proven), extra height = aperture-rock extension rows on per-global-row EXT_SALT streams (canonical compose byte-frozen — 80-smoke sweep green, zero re-baselines), debug tall-spawn path (640×650 verified joined to a 520 sibling live). Spec `docs/superpowers/specs/2026-08-18-scale-anchor-slice.md`; smoke-land-aperture; shots `docs/design-reviews/2026-08-18-scale-anchor/`. Next rungs: variable widths → archipelago full-screen mockup |
| Variable widths — width means horizon, not zoom | **SHIPPED 2026-08-18; eyeball PASSED same day ("both read as apertures, merged").** Rung 2 of the full-screen ladder: broker carries per-window width (debugSpawn {widthPx} clamped [480,1200], session-only), topology payload carries widths, shared sky runs on prefix-sum desk-space (chainOffsets — uniform chains byte-identical by construction), vertical dock gains a width-equality predicate + spawnUnder standard-width gate. 80-smoke sweep green, zero re-baselines; live: 960 and 480 windows snapped to standard siblings, deskX prefix identity measured from both seats. Spec `docs/superpowers/specs/2026-08-18-variable-widths.md`; shots `docs/design-reviews/2026-08-18-variable-widths/`. Next rung: archipelago full-screen mockup |
| Dungeon economy rung 1 — Tier-0 delvers under one wing | **SHIPPED 2026-08-19; eyeball PASSED 2026-08-20 ("both eyeballs pass") — rung CLOSED.** Spec frozen before implementation (`docs/superpowers/specs/2026-08-19-dungeon-rung1-delvers.md`); pure engine `src/terminal/delve.ts`, `delve_state` persistence (schema v5), dispatch walk + undercroft presenter + one marginalia line per expedition; smoke-delve 130 incl. the bar-7 odds test; zero LLM calls, no numerals rendered. STATE.md has the record. Ladder (IDEAS.md § The dungeon economy): rung 2 = gold as hoard glyph + being directives move the params; rung 3 = monuments; rung 4 = cookbook + DM |
| Dungeon economy rung 2 — persona directives + the hoard glyph | **SHIPPED 2026-08-20; eyeball PASSED same day ("the hoard reads as treasure") — rung CLOSED; rung 3 + Addendum-9 display rung UNBLOCKED.** Spec frozen before implementation (`docs/superpowers/specs/2026-08-20-dungeon-rung2-directives-hoard.md`; Addendum 1 only, per the routing). Harry's calls: persona-derived zero-LLM directives (reflection = later rung), hoard glyph only (memorial/sprite stay on the ladder). `directiveParams` (pure, prng-free) maps persona temperament over calibrated ranges depth 4-8 / retreat 2-5 / party 4-3; the Addendum-1 kill test lives in smoke-delve2 on identical seed streams (ghost 1.27% / default 1.80% / loki 2.51%, spread 1.24pp, ratio 1.98x); `hoardStage`+`HOARD_GLYPH_ROWS` render the pile static in the undercroft. smoke-delve2 41, smoke-delve byte-untouched, sweep + 3 typecheck legs green, spec review zero findings, live-verified (gold ledger fingerprints each dispatcher's directive). STATE.md has the record. Next rungs: rung 3 = monuments/spend; Addendum-9 display rung sequences after rung 2, own spec-interview |
| Dungeon economy rung 3 — the shrine, the spend, watchable veneration | **SHIPPED 2026-08-20; eyeball PASSED 2026-08-21 ("yea i think one is working" — no kill named on bars 9-10) — rung CLOSED; rung 4 (cookbook + DM, Addenda 2/7/8) + the Addendum-9 display spec-interview UNBLOCKED, rung 4 the lead arc per the 2026-08-21 plan.** Spec frozen before implementation (`docs/superpowers/specs/2026-08-20-dungeon-rung3-monuments.md`; Addendum 2 only, per the routing). Harry's calls: persona-derived zero-LLM spend, ward buff, surface shrine in construction stages, reinvest = bigger colony. Per-resolution tranche (reserve 40 / tranche 60) routed by `directiveBoldness` — timid builds the shrine, bold raises the colony cap (`effectiveTargetPop`, hard cap 8); ward = threshold swap in `runExpedition` (0.055 vs 0.1, calibrated: gap 1.11pp at ratio 0.562 on the bold-most probe — zero inserted draws, unwarded byte-identical); shrine complete → two-leg dispatch walk (venerate at the shrine, descend warded); one marginalia line per stage (`SHRINE_VOCAB`). smoke-delve3 58; smoke-delve + smoke-delve2 byte-untouched; 84-script sweep + 3 typecheck legs green; live-verified end-to-end (8 organic cycles, ledger fingerprint, veneration phases toShrine→toShaft+warded, cold-relaunch recovery). STATE.md has the record. Next: rung 4 = cookbook + DM (Addenda 2/7/8); Addendum-9 display rung's spec-interview |
| Dungeon economy rung 4 — the skill cookbook and the DM | **SHIPPED 2026-08-21; eyeball PENDING (bars 10-11, TODO-USER.md) — spec review SOUND, zero findings, bars 1-4 + 6-9 MET.** Spec frozen before implementation (`docs/superpowers/specs/2026-08-21-dungeon-rung4-cookbook-dm.md`; Addenda 2/7/8 per the routing) and bar 5's go/no-go run pre-engine with verdict GO (`…-go-no-go.md`). Grammar v0 + the residue-1 seventh verb `break`: 7 mechanical verbs x 4 modifiers (`src/terminal/craft.ts`), every verb a threshold swap on an existing draw — no-loadout path byte-identical to rung 3; deterministic score/price/death-floor (plain code is the balance authority); seed cookbook 8 entries, two aspect-gated; deeds-only aspects; pure pacing-gated payment. Proposal rides the dispatcher's next reflection through the UNCHANGED routeTier2 (craft clause on the topology string, T5 extraction off plan steps); the DM is the THIRD desk-side runtime AI call (Sonnet via `/api/agent/adjudicate`, desk-wide 5/day broker cap, consumed rejections, CLAUDE.md ledger entry before ship); marginalia the only surface (CRAFT_VOCAB, numeral-free). smoke-delve4 159; delve smokes 1-3 byte-untouched; 84-script sweep + 3 typecheck legs green; VERIFIED LIVE (loki proposed an unseeded hold-once-when-few, DM granted `low-oath` at price 14 in bounds, hoard paid, marginalia trail, reload recovery, next dispatch fingerprinted the loadout). STATE.md has the record. Next: the Addendum-9 display rung's spec-interview; archipelago engine rungs queue behind |
| Archipelago full-screen mockup — the direction judgment | **MOCKUP TAKEN 2026-08-18; eyeball PASSED 2026-08-21 ("yea 2. looks good" — neither K1 nor K2 kill fired; the pre-registered TWO MOONS drew no complaint, no desk-global-sky routing forced) — engine rungs UNBLOCKED, queued behind the dungeon arc per the 2026-08-21 plan.** Rung 3 of the full-screen ladder, all live-desk engine output (no hand-drawn HTML): 01 the continent (800×780 + standard + undercroft = 1440×780 world block filling the display), 02 the archipelago (mainland island + lone 480 outpost, desktop sea). Bars frozen before the shots: K1 one-world read, K2 deliberately-apart read; pre-registered: TWO MOONS in shot 02 (per-chain sky) routes to a desk-global sky rung if it grates. Doc `docs/design-reviews/2026-08-18-archipelago.md`; shots `docs/design-reviews/2026-08-18-archipelago/`. A pass unblocks the engine rungs (desk-global sky, apartness dialect, mixed-size persistence, multi-seam) |

## Visual-programme backlog (numbering from the 2026-07-13 review — statuses live here)

Shipped / fixed: **#1** ladder label double-draw (salience campaign),
**#9** ambient life register, **#10** shelves read as books (both
2026-07-17 ambient-salience bundle), **#13** ladder identity pass
(2026-07-17), **#16** murals (2026-08-01, eyeball passed). Several quick wins (**#2** HUD ink, **#4** seam dialect,
**#6** pane focus, **#7** note-reveal frames) were substantially
absorbed by the 2026-07-13 salience campaign (themed HUD, blue
aperture dialect, focus alpha, double-line marginalia frames) without
individual rulings.

Live (land-facing, on the depth track): **#19** land polish.

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
- ~~Stray `*` in gameboy-dmg's sky~~ — **RESOLVED 2026-08-02**: the
  painter was the `☼` sun (role `sun`, never in the pack's omit list);
  pack gap, not an engine leak. STATE.md has the ruling.
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
