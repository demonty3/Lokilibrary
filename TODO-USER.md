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

Last updated: **2026-08-23, latest** (MATCHING SHEET STAGED — Harry
supplied his real Steam ID, the library is pulled, four cold-authored
murals are shot, and the 4b sheet + sealed key are on disk. ONE eyeball
gates the whole rung now: the blind pairing below. The rung-4 eyeball
(bars 10-11) stays open.)

- ✅ **EYEBALL the mural MATCHING test (4b) — PASSED 2026-08-24, 4/4.**
  Your pairing (1-A, 2-D, 3-C, 4-B; the typed double-B fixed to 2-D
  with no hints) matched all four, including the not-confident 3-C.
  Frozen bar was ≥2 of 4; 4/4 clears even the strict reading. No kill
  fired anywhere on the rung — **claude-authoring rung 1 is CLOSED**,
  and the MCP builder's-hand rung's spec-interview is UNBLOCKED
  (say the word and we run it).

- ✅ **EYEBALL the blind mural A/B (taste bar 4a) — PASSED 2026-08-23
  ("four and three are weak, shippble but weak").** Weak picks resolved
  to one SEED (d2 disco) + one COLD (d1 civ) — no reliable
  singling-out of the cold set, none unshippable; both halves of the
  frozen bar met, kill did not fire. Cold murals MERGED unedited
  (806cb20): the desk now carries six murals, incl. cold d3's river
  passage replacing the seed hall (the hall is one file-restore away
  at d5feb6f if you ever want it back — a curation dial, no pressure).

- ✅ **Worktree cleanup — DONE 2026-08-23** (you authorised; the
  safety net steered it through `git stash` instead of `--force`).
  Worktree + branch gone; one labelled leftover: `stash@{0}` holds the
  npm-generated package-lock line — `git stash drop` whenever, or
  ignore it.

- ✅ **INPUT — your real library — RESOLVED 2026-08-23.** You supplied
  steamid 76561198405139364 + a Web API key; `scripts/pull-library.mts`
  pulled 5 games / 11.9h (the 6th is a never-launched free title, which
  GetOwnedGames omits; you confirmed the account is new and said keep
  going). Raw fixture stays local (gitignored `fixtures/`); the summary
  feeds the matching sheet above.

- ✅ **EYEBALL mural seed corpus (claude-authoring rung 1) — PASSED
  2026-08-23 ("yea these pass, d5 is fine too").** All four seed murals
  cleared B1-B3 (`docs/design-reviews/2026-08-23-mural-seed-corpus.md`),
  d5's near-ceiling density passed explicitly, no kill fired. Bars
  FROZEN in smoke-mural-blueprint with the corpus values; the spec
  review's finding 2 discharged (d0 = the maintainer-verified worked
  example). The game-IP finding was RULED the same day: rule relaxed
  ("doesn't need to be too artificially tough"), CLAUDE.md amended, the
  seed corpus legal where it sits. Cold test now RUNNING (context-cold
  agent, ≥3 wings, zero hand-fixes — the rung's load-bearing kill);
  next on your desk after it: the blind A/B + matching taste bar, and
  the matching half will eventually want your REAL library data (≥1
  real profile among the ≥4 pairs).

- **EYEBALL dungeon rung 4 (bars 10-11) — PENDING.** The question: is a
  granted skill's story followable from the MARGINALIA ALONE — the
  proposal, the DM's answer, the skill in use — and does it read as the
  society INVENTING, not as a changelog? KILL (frozen): reads as patch
  notes → re-cut voice and cadence, never add UI; a number appears →
  remove, never restyle; gauge/confetti → re-cut shape or thresholds.
  What's already on your desk: the colony (d0/t1) holds **low-oath**
  (hold once, when-few — loki proposed it after a "lost" pressure, the
  DM granted it at a fair price, cat later carried it below warded).
  The trail on the record, in order: "asked the craft for low-oath. the
  deep will say what it thinks of that." → "the craft took low-oath.
  the cookbook is one working heavier." → "the small ones went down
  carrying low-oath. it smells of intent." On screen only the LATEST
  mark at the shaft shows (same-column replacement — the desk grammar);
  judge the cadence as it happens live, or re-run the chain:
  worker on `anthropic` (`worker/.dev.vars` — currently `local` AS
  FOUND, which quietly disables ALL desk AI on this Mac), then
  `node scripts/e2e/term-drive.mjs t1 '__terminal.debugDelveNotable("loki","lost")'`
  and `…t1 '__terminal.debugCraftProposal("loki").then(r=>JSON.stringify(r))'`
  with the desk frontmost. One residue to judge alongside: loki NAMED
  its invention after the clause's format exemplar (low-oath) — the
  composition was original, the name anchored. If that grates, the fix
  is a placeholder-token exemplar (a dial, not a re-cut).

Previous update: **2026-08-21, evening** (BOTH GATING EYEBALLS PASSED, one
message: dungeon rung 3 — "yea i think one is working" (no kill named on
bars 9-10; the hedge recorded as spoken; pacing/shape dials stay
available) — rung CLOSED, rung 4 (cookbook + DM, Addenda 2/7/8) + the
Addendum-9 display spec-interview UNBLOCKED, rung 4 the lead arc per the
same-day approved plan; archipelago — "yea 2. looks good" (neither K1 nor
K2 kill fired; the pre-registered TWO MOONS drew no complaint, so no
desk-global-sky routing is forced) — engine rungs UNBLOCKED, queued
behind the dungeon arc. Next move: the rung-4 spec-interview. The five
non-blocking eyeballs below stay open.)
Previously **2026-08-21, session close** (DETAIL THREAD CLOSED. The
"double the grid, same scene finer" check ran and Harry judged it: "I actually
prefer the today one" — the frozen kill fires on both halves, so doubling is
DEAD and its unpark condition is spent. With scale 1 judged 08-17 and doubling
judged now, **the resolution axis is exhausted**: nothing left on this thread is
about the lattice. What stays open is primitives — bigger-jump directions 01-05,
none killed — and the fine-lattice mural rect the 08-17 verdict routed to and
nobody ever built. NOTHING SHIPPED this session; WORLD_SCALE is still 2 and every
golden is byte-identical. No eyeball is owed on this thread.)
Previously **2026-08-21, later** (detail thread judged and parked. The
height-elastic eyeball came back "I like B" (K3 never fired), but the follow-on
was that the scene INSIDE B needs a bigger jump — so a five-direction round was
built and none of them jumped out. All five stay OPEN, nothing killed. What
outlived it: Harry's own idea, "double the grid but make the same thing more
detailed" — never tested by either prior probe, now the named NEEDS-CHECK unpark
condition with two-sided bars in IDEAS.md § The detail thread. Nothing shipped;
WORLD_SCALE still 2. No eyeball owed on this thread.)
Previously **2026-08-20, night** (DUNGEON RUNG 3 shipped — the
shrine, the spend, and watchable veneration: gold now leaves the hoard
in tranches routed by the dispatcher's temperament (timid builds a
3-stage shrine on the surface near the shaft; bold grows the colony
past its founding size), and once the shrine is complete every
expedition walks TWO legs — a held bow at the shrine, then the shaft —
and descends warded (death odds measurably lower, calibrated inside
the frozen two-sided bars). Spec frozen before implementation
(Addendum 2 only); smoke-delve3 58 green, rungs 1-2 smokes
byte-untouched, live-verified end-to-end incl. a cold-relaunch
recovery. One eyeball queued below.)
Previously **2026-08-20, later** (BOTH dungeon eyeballs PASSED —
Harry: "both eyeballs pass — the hoard reads as treasure". Rung 1's four
register kills never fired; rung 2's bar 8 passed in its own words, and
the stages-1-2 same-glyph flag drew no complaint, so HOARD_GLYPH_ROWS
stands as shipped. The dungeon ladder's next rung — rung 3,
monuments/spend, loading Addendum 2 — is UNBLOCKED, as is the
Addendum-9 display rung's spec-interview.)
Previously **2026-08-20** (DUNGEON RUNG 2 shipped — persona directives
+ the hoard glyph: the dispatching being's temperament now sets each
expedition's depth/retreat/party (zero LLM, prng-free, the Addendum-1
consequentiality kill test is a smoke on identical seed streams — ghost
1.27% vs loki 2.51% per-delver death, live-verified by the gold ledger
fingerprinting each dispatcher's directive), and the invisible hoard now
renders as a static `▪░▒` pile in the undercroft, growing by stages,
never a number. Spec frozen before implementation; smoke-delve2 41 green,
rung-1's smoke byte-untouched, spec review zero findings. One eyeball
queued below.)
Previously **2026-08-19** (DUNGEON RUNG 1 shipped — Tier-0 delvers
under one wing: a 3-5-strong `▪` colony idles in the first wing's
undercroft, a being walks to the shaft mouth 2-4 times per day of desk
uptime to send an expedition down, one creature hazard rolls dice below,
delvers die permanently and are replaced over days, every expedition
leaves one marginalia line in the dispatcher's voice, gold accrues
invisibly. Zero LLM calls, no numerals anywhere on screen; spec frozen
before implementation; smoke-delve 130 green incl. the bar-7
params-move-odds test. One eyeball queued below.)
Previously **2026-08-18, latest** (ARCHIPELAGO full-screen MOCKUP
taken — two live-desk arrangements, all honest engine output: 01 the
continent (1440×780 world block filling the display), 02 the archipelago
(mainland + undercroft island, lone 480 outpost, desktop sea between).
Bars frozen + committed before the shots
(`docs/design-reviews/2026-08-18-archipelago.md`). TWO MOONS visible in
shot 02 — the pre-registered per-chain-sky observation, in frame. One
eyeball queued below; the app is left running in the shot-02 arrangement.)
Previously **2026-08-18** (the VARIABLE-WIDTHS eyeball
PASSED — "both read as apertures, merged". The frozen kill (width reads
as zoom) never fired; no masthead collision at 480, so the [480, 1200]
clamp stands. Next rung: the archipelago full-screen mockup is
UNBLOCKED.)
Previously **2026-08-18** (VARIABLE WIDTHS shipped — window
width now means horizon, not zoom: per-window widths through the broker
and the shared sky's new prefix-sum desk-space, width-equality on the
undercroft dock; 80-smoke sweep green, zero re-baselines; 960/480 windows
live-verified against standard siblings.)
Previously **2026-08-18** (the SCALE/ANCHOR eyeball PASSED —
"the aperture eyeball passes — reads as the same wing, merged". The
second-underworld kill never fired; the full-screen ladder's next rungs —
variable widths, then the archipelago mockup — are UNBLOCKED.)
Previously **2026-08-18** (SCALE/ANCHOR slice shipped — height
now means depth, not zoom: fixed geometry from the window top, top-anchored
world, aperture-rock rows for taller windows, all provably pixel-identical
at shipped sizes; one eyeball queued below. The full-screen ladder's next
rungs — variable widths, archipelago mockup — are gated on it.)
Previously **2026-08-18, PHASE B** (eyeball PASSED same day —
"passes, the undercroft reads as one place — merged". The arc is closed;
no kill was named against the violet `deep` band, so it stands as shipped
and its dial stays available if it ever grates.)
Previously **2026-08-18, later** (SHARED SKY shipped — one ☼/☾ desk-wide,
wisps crossing seams, no broker; all four measured bars passed live; one
eyeball queued below. The README demo-GIF re-cut is now unblocked.)
Previously **2026-08-18** (the UNDERGROUND-CONTINUATION eyeball PASSED —
"passes, the lower window reads as the same wing"; 640×260 accepted; Phase B
engine work — VJoin topology, under-compose, shaft descent — is UNBLOCKED.)
Previously **2026-08-17, night** (the CAPTION-BACKING DEFECT is closed —
close-out queue item 2: a marginalia caption now occludes the closed-wing
skyline under its rect instead of mixing with the wing ids; the judged
reveal envelope is untouched; verified live with before/after shots. One
eyeball queued below.)
Previously **2026-08-17, later** (the STITCH FAMILY eyeball PASSED — Harry: "yea those look nice", then "yea merged"; aegean-stitch, kilim and winter-sampler are MERGED, corpus 13. The motif-density half of the question went unanswered — the widening-track unpark is NOT triggered and NOT ruled out; it re-arms if he ever judges the packs short of the reference. Earlier same day: the UNDERGROUND-CONTINUATION PROBE: vertical
stacking re-opened as a mockup-first question — a window snapped UNDERNEATH is
the same wing's deep strata, no sky, the shaft stitching the pair. Bars were
frozen and committed BEFORE the mockup was authored, inheriting the Terrace
Join kill record verbatim. The mockup's upper half is generated from the real
composer at the desk's exact options and honesty-checked against a live t1
capture; only the under-land continuation is authored — that content IS the
proposal. One eyeball open, below; engine work (topology, under-compose,
being descent) is gated on it.)
Previously **2026-08-15** (T5 ORCHESTRATION V0: the snapping-terminals
ladder's last slice. Opt-in only — a tray checkbox, default off. Overnight,
an opted-in desk's sleep-pass reflections may name ONE closed wing; the
morning banner asks `the night asks: a terminal onto d4?` over two bracket
taps, and `[ open it ]` spawns the window adjacent and already joined —
verified with real mouse input, beings crossed into the applied window.
Zero new AI calls; opted-out desks are byte-identical to T4. One eyeball
open, below — plus two product findings worth your read.)
Previously **2026-08-08, late** (T3 SLICE 1: every terminal now derives its style pack from its wing, so the ten authored packs are finally visible in the product — d0 phosphor, d1 solarized-dark, d2 gruvbox-dark, and so on. Preceded by a spike that CONFIRMED the shape and found the one constraint: gameboy-dmg omits eleven sky roles and reads broken at a seam, so it is excluded from the auto-assigned pool. Two eyeballs open, below.)
Previously **2026-08-08, night** (the RESERVED-ACCENT FIX: the ramp-step lift was KILLED at calibration — a being is already at channel maximum, so it cannot be brightened — and the same separation shipped on the furniture instead: `cottage` + `monument` join `GROUND_DEMOTE` at the already-shipped 0.6, with `landRoleFill` capping rather than multiplying so no frozen ramp bar moved. Proven live: the vacated cell now changes by 76/255 where it changed by 2 before. One eyeball open, below.)
Previously **2026-08-08, evening** (the ANATOMY PASS: the desk's components were
inventoried into a marked-up page, and the marks came back 16 reads / 1 too-loud /
1 cut with NOTHING under "can't name it" — so "busy" was a naming problem that the
inventory itself solved, and the tidy collapsed to two changes. The mural is cut
(one word, reversible; the sky is whole again and the ☾ is up in both windows) and
the marginalia note no longer flashes (unframed, eased over 1.4 s to 0.74, soft
backing). Both measured on the running desk. One eyeball open, below.)
Previously **2026-08-08** (the DAYLIGHT SKY REGISTER shipped and its eyeball
PASSED the same day — all six bars, and bar 1's KILL INVERTED: the hue axis was
specced as the fallback for packs that could not afford to brighten, and judged
side by side it is the STRONGER axis for telling time. A pack now authors its own
night/twilight/day sky; `night` is pinned to `bg` so midnight is byte-identical,
and a pack that declares nothing never moves. Three packs authored, seven opt
out. Correction carried: the desk boots `phosphor`, not `DEFAULT_THEME_ID`.)
Previously **2026-08-07** (the HOUR WITHOUT COLOUR shipped and its eyeball
PASSED the same day — all six bars, no kill, no dial. The world clock is off
hold: the desk's sun climbs and sets, its moon counter-arcs, its lamps light at
night. Daylight COLOUR is not needed for the hour to read and is now an optional
pack-authoring axis; the two measured axes and their kills are in IDEAS.md.)
Previously **2026-08-06, late** (the LAUNCHER BEAT shipped AND its eyeball
PASSED the same day — all six bars, no kill fired, no dial spent. Click any
site on a land, the door lights, the nearest being walks to it, Steam fires,
they step through and are gone until you come back to the desk. Nothing is
outstanding on it. Two things recorded, neither blocking: the return signal is
attention rather than a real game-exit signal (macOS has none reachable from
the desk's windows — a real one drops into one call site), and the marginalia
caption has no opaque backing, so a note under a mural draws over the mural
frame — pre-existing, but every launch note lands on the same door column, so
it now recurs on demand.)
Previously **2026-08-06, evening** (land polish #19 slice 2 eyeball
PASSED on all six bars — the #19 programme item is CLOSED. Bar 3 took
two same-day fix rounds (wisp re-row past mural occlusion, then a speed
re-dial — the first band was humanly invisible). Also this session: the
terminals desk is now the DEFAULT desktop boot; the palace moved behind
`LOKILIBRARY_TERMINALS=0`. Next candidates: static-beings liveliness,
the launcher beat (the monument door role now exists as its landing
spot).)
Previously **2026-08-06** (slice 2 SHIPPED and first-watch judged: 5/6
bars, drift visibility defect found and fixed same day.)
Previously **2026-08-05** (land polish #19 slice 1 eyeball PASSED —
"the shots look right" on all three shots: strata, skyline, DMG blank
sky. Neither frozen kill condition fired; no tuning requested. The
slice is fully closed; next up is #19 slice 2 — monument architecture,
constellations/clouds, ore veins/caverns, signage.)
Previously **2026-08-01** (marginalia-on-land SHIPPED and the eyeball
PASSED the same day — "this feels right", watched live on the terminals
build. The depth track's first slice is fully closed: marks + in-voice
notes + proximity reveal + persistent decaying wear. No tuning
requested; the knobs stay in src/terminal/marks.ts if cadence ever
needs a nudge.)
Previously **2026-07-31, late evening** (all three open eyeballs
judged: gameboy-dmg re-cut PASSED — reads as a different machine;
amber-crt glow leg PASSED; diorama-neighbour MUTATE — pairing works,
the mockup's terminal design reads unbearable, element to pin before
re-mock. Direction call: **depth over breadth** — the remaining
widening axes (oscilloscope 08, light-ground 07, cold run 3) are PARKED
with a concrete unpark precondition; effort redirects to the
terminals-first / land-depth column. New thread recorded in STATE.md:
shared rules across terminals — time of day etc. conformed, packs may
omit but never contradict).
Previously **2026-07-31, evening** (the ceiling-widening eyeball FIRED
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

### 👁 EYEBALL — caption-backing defect closed: the caption now occludes the skyline

**Status**: shipped 2026-08-17 (close-out queue item 2, logged 2026-08-06).
A marginalia caption whose rect crossed the closed-wing skyline used to mix
with the wing silhouettes and `d2`/`d4`-style ids — text over text, hard to
read. Now, while a reveal is live, its rect mechanically hides the skyline
glyphs underneath (the caption is nearer than the far-ridge plane, same
doctrine as the mural's eviction); everything you already judged about the
reveal — the 1.4 s emergence, the 0.74 peak, the soft see-through backing —
is untouched, and terrain under the backing still dims rather than
disappears. Verified on the live desk: the `d4 d2 d5` ids vanish under a
caption sitting exactly on their band and return when it closes; ids away
from the caption never move.
**What to look at**: the pair of shots in
`docs/design-reviews/2026-08-17-caption-skyline/` (occluded during, restored
after) — or live, wait for a note to surface in the sky band. The one thing
worth judging by eye: the ids disappear once the caption is about half-risen
and return as it dies. If that swap reads as a pop rather than being covered
by the emerging note, say so — the dial is `SKYLINE_OCCLUDE_ALPHA` in
`terminalLand.ts` (higher = later, more hidden by the backing).
**Not blocking anything.**

### 👁 EYEBALL — T5: the desk may ask for one room a night (bar 8, taste)
**Status**: shipped 2026-08-15, verified end-to-end on the live desk with
real mouse taps (STATE.md has the record); bars 1–7 measured, bar 8 is
yours. The frozen bar, verbatim from the spec: *waking to a proposal reads
as the desk asking a small, shy question — one line, two quiet bracket
taps, gone in 30 seconds — not a notification demanding a decision;
applying feels like the desk growing a room. KILL: it reads as a dialog
box, or the new window's arrival reads as a popup rather than an opening.*
**What to look at**, on a booted desk:
1. Tray → tick **"Overnight proposals"** (it defaults OFF; untick it after
   if you don't want it live).
2. The organic path needs a real overnight (wallpaper mode + a sleep/wake
   cycle) and Sonnet only *sometimes* names a closed wing — five live
   dispatches produced zero, which is legal (empty nights are correct) but
   means you may wake to nothing. For a guaranteed look, the shot
   `docs/design-reviews/2026-08-14-t5-orchestration/desk-t1-proposal-banner.png`
   is exactly what the wake banner shows, and
   `desk-t3-d2-applied.png` is the applied window.
3. **Two product findings to weigh** (not defects): on the MacBook's
   1440-wide screen a joined pair leaves no room for a third window, so a
   proposal can only ever APPLY when a single terminal is open — T5 is
   near-inert on this display unless you close a window first; and the
   organic proposal rate is low because plans stay inside the open desk.
   If you want livelier nights, the dial is the clause's wording in
   `deskTopologyLine` (`src/terminal/deskTopology.ts`), never the gates.
**Not blocking anything**; T5 was the ladder's last open slice.

### 👁 EYEBALL — the anatomy pass: mural cut + the reveal unframed
**Status**: shipped 2026-08-08, measured on the running two-window desk;
your look is the gate. Both changes came straight off your marks.
**What to look at**, on a booted desk (`bash .claude/skills/launch-desktop-app/scripts/launch.sh`):
1. **The sky, with the mural gone.** It used to clear its own rect last and
   unconditionally — it was evicting the ☼ outright in 42% of lands. Both
   windows should now carry a whole starfield with the ☾ up.
2. **What the cut costs.** The land no longer shows any game *artwork* — the
   Steam CDN recognition surface, CLAUDE.md's "oh I own that" beat. Names
   survive on the proximity labels and the play-state ladder still encodes
   the relationship. If you miss the beat, say so: it is one word
   (`mural: false` in terminalLand.ts composeOpts) and it comes straight back.
3. **A note surfacing.** Wait for a being to walk past a mark. It should
   *emerge* over about a second and a half rather than appear — unframed
   text on a soft backing, never reaching full brightness. If it still reads
   as a pop-up, the dial is `REVEAL_FADE_S` / `REVEAL_PEAK_ALPHA` in
   `src/terminal/marks.ts`; if it reads as *too faint to notice*, that is the
   opposite failure and worth saying, because the fix is the same two numbers
   in the other direction.
**Not blocking anything**; nothing downstream waits on it.

### 👁 EYEBALL — T3 slice 1: every terminal now wears a different pack
**Status**: shipped 2026-08-08, verified on the joined two-window desk. This is
the slice that makes the ten authored packs visible in the product — until now
every window booted `phosphor` and the whole style-pack system was dev-only.

**What to look at**, on a booted desk
(`bash .claude/skills/launch-desktop-app/scripts/launch.sh`):
1. **The joined seam.** `d0` is phosphor (near-black) and `d1` is
   solarized-dark (teal). Terrain runs straight through; only the palette
   changes. Does it read as one world seen through two machines, or as a
   window that failed to load? The spike says the former, but the spike is my
   eye, not yours — this is the judgement that matters.
2. **Spawn a third and fourth terminal** from the tray. `d2` is gruvbox-dark,
   `d3` catppuccin-mocha, `d4` tokyo-night, `d5` ibm-3270. Four or five
   different machines on one desk is the thing T3 exists for; it may also be
   too much. If it is, say so — the fix is a smaller pool, one line.
3. **`d0` is still phosphor on first boot**, deliberately, so nothing you have
   already judged moved.

**What is deliberately NOT in the pool**: `gameboy-dmg`. It deletes stars,
moon, clouds and eight more roles, so at a seam one side has a starfield and
the other an empty field — measured as the one broken pairing of four. Reach it
explicitly with `?theme=gameboy-dmg`; it just never gets auto-assigned beside a
neighbour.
**Not blocking anything.**

### 👁 EYEBALL — the reserved-accent fix: two furniture roles got darker
**Status**: shipped 2026-08-08. You asked for the ramp-step lift; it was
**killed at calibration** and the same separation shipped on the other side.
Spec: `docs/superpowers/specs/2026-08-08-being-lift-design.md`.

**What was wrong.** A being drawn into a cell whose terrain shares its palette
key rendered in that terrain's exact colour and vanished. Measured on the
running desk: moving the cyan Visitor off the cyan monument changed the vacated
cell by **2/255 per channel** — nothing. Two of five agents were affected
(`cat` on cottages, `visitor` on monuments), in all ten packs.

**Why not the lift you asked for.** A being cannot be made brighter — its
accent is already at channel maximum in most packs (`night-drive` has no
headroom on any of the three; `phosphor`, which the desk boots, has none on
two). Pushing harder just clips: separation plateaus at 1.31 even at ×2.5,
against a 1.5 bar. So the darkening went on the furniture instead, at 0.6 —
the factor the lawn has worn since the salience campaign, not a new number.

**What to look at**, on a booted desk
(`bash .claude/skills/launch-desktop-app/scripts/launch.sh`):
1. **A monument and a cottage.** Both are now noticeably darker. They should
   still read as a tower and a building — muted, not sunken. This is terrain
   that has been through judged eyeballs (gameboy-dmg's bands, cozy-autumn,
   night-drive, amber-crt), so it is the one real cost of the fix.
2. **An agent standing in a doorway or in front of a cottage.** It should now
   be plainly there. The live check:
   `node scripts/e2e/term-drive.mjs t2 '__terminal.debugPlace("visitor",41,1,true)'`
   parks the Visitor in the monument on the right-hand window.
3. **gameboy-dmg** (`?theme=gameboy-dmg`) — its judged strata bands must be
   unmoved. Its ramp floor is provably untouched (the fix caps the ramp rather
   than multiplying it), but the bright end of its cottage/monument did move.

**If it reads as sunken**: the dial is the two entries in `GROUND_DEMOTE`
(`src/render/levels/land.ts`). 0.5 and 0.78 are both measured — 0.78 fails the
separation bar at 1.47, 0.5 passes with more margin.
**Not blocking anything.**

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

- ✅ **EYEBALL dungeon rung 3 (shrine/spend/veneration) — PASSED
  2026-08-21**: "yea i think one is working" — an affirmative over the
  rung as presented (the veneration walk + the shrine); no kill named on
  bars 9-10 (no pathing-noise read, no idle-game or gauge read, no number
  sighted). The hedge ("i think") is recorded as spoken; the pacing/shape
  dials stay available if the ritual read weakens on a longer watch. The
  rung is CLOSED. Rung 4 (cookbook + DM, Addenda 2/7/8) and the
  Addendum-9 display spec-interview are UNBLOCKED; rung 4 is the lead
  arc per the 2026-08-21 plan.
- ✅ **EYEBALL archipelago full-screen mockup — PASSED 2026-08-21**:
  "yea 2. looks good" — one affirmative over both shots, K1/K2 not
  separately spoken to; neither frozen kill fired (no pile-of-windows on
  K1, no forgotten-window on K2), and the pre-registered TWO MOONS drew
  no complaint, so no desk-global-sky routing is forced. The engine
  rungs (desk-global sky, apartness dialect, mixed-size persistence,
  multi-seam / L-shape) are UNBLOCKED, queued behind the dungeon arc per
  the 2026-08-21 plan.
- ✅ **The "double the grid" check — JUDGED 2026-08-21, KILLED**: "I actually
  prefer the today one." Harry's own idea, tested with a control panel: A today,
  B 2x with no new rules, C 2x scale-aware, all at identical PHYSICAL size. The
  kill fires on both halves — A→B is provably shape-identical (block elements
  encode sub-cell edges, so they expand exactly), and the finer grain in C is not
  worth the legibility it costs. The unpark condition is spent; the resolution
  axis is exhausted. Durable finding kept: a glyph grid holds BLOCK matter
  (tiles, holds screen size, takes a finer edge) and GLYPH matter (beings,
  labels, stars — cannot tile, halves in size), which is the named mechanism
  behind the 08-17 glance failure. Probe:
  `docs/design-reviews/2026-08-21-scale-aware.html`; brain note
  `a-glyph-grid-holds-two-kinds-of-matter`.

- ✅ **EYEBALL height-elastic sky — JUDGED 2026-08-21, same day**: "I like
  B." B preferred over A (today full-screen: 20 world rows + 11 of bare
  aperture rock) and C (full-screen at scale 1); **K3, the taller sky
  reading as a bigger void, did NOT fire**. K1/K2/K4 were not explicitly
  spoken to, so this is a preference, not a signed-off sweep — anyone
  reopening inherits §3 verbatim. The engine slice is unblocked but NOT
  scheduled: the follow-on finding was that the scene *inside* B needs to
  be better, which opened and then parked the bigger-jump round (five
  directions, none taken, none killed). `WORLD_SCALE` stays 2 and the
  08-17 KEEP verdict is untouched. Everything measured this session
  survives the park — the cell is not the cap, the perf kill is dead at
  14x the cells, braille ships in Cozette. Full record: IDEAS.md § The
  detail thread; round artifact
  https://claude.ai/code/artifact/5a119016-7b98-43d0-8c31-06f2e3ce6f6f

- ✅ **EYEBALL dungeon rung 2 (persona directives + hoard glyph) — PASSED
  2026-08-20, same day**: "both eyeballs pass — the hoard reads as
  treasure" — bar 8 in its own words. Neither register kill fired
  (gauge/confetti, cursed persona); the pre-flagged stages-1-2
  same-glyph ambiguity drew no complaint, so `HOARD_GLYPH_ROWS` stands
  as shipped (its dial stays available). Rung 3 (monuments/spend,
  Addendum 2) and the Addendum-9 display rung's spec-interview are
  UNBLOCKED.
- ✅ **EYEBALL dungeon rung 1 (Tier-0 delvers) — PASSED 2026-08-20**
  ("both eyeballs pass"). None of the four frozen kills fired: no
  idle-game read, not invisible without peeking, no number appeared,
  and params provably move odds (smoke-held). The colony, dispatch
  walk, hazard register, marginalia line and relaunch persistence all
  stand as shipped.

- ✅ **EYEBALL scale/anchor slice (tall-beside-standard) — PASSED
  2026-08-18, same day** ("the aperture eyeball passes — reads as the same
  wing, merged"). The frozen second-underworld kill never fired; its
  remedies (cut per-row ore glints, then cap extension depth) stay
  available as dials. The variable-widths rung and the archipelago
  full-screen mockup are UNBLOCKED.

- ✅ **EYEBALL Phase B undercroft (dock · seam · descent) — PASSED
  2026-08-18, same day** ("passes, the undercroft reads as one place —
  merged"). K1 answered in its own words; no kill named on the seam or the
  descent, and none against the flagged violet `deep` band — it stands as
  shipped (dial: `ROLE_KEY.deep` / deep fill density, if it ever grates).
  The vertical-stacking arc is CLOSED at v0 scope; the L-shape stays
  deferred, hall/storeys stays parked.

- ✅ **EYEBALL shared sky — PASSED 2026-08-18, same day** ("yea looks good,
  continue"): the one-sky read landed, no kill named on the bodyless window
  or the seam handoff. Shipped 2f4bc01; measured bars B1–B4 had already
  passed live.
- ✅ **EYEBALL underground continuation (stacked-pair probe) — PASSED
  2026-08-18**: "passes, the lower window reads as the same wing" — K2 in its
  own words, no kill named on K1/K3, 640×260 accepted (the 640×320 re-mock
  dial unspent). Verdict recorded in
  `docs/design-reviews/2026-08-17-underground-continuation.md`. Phase B
  engine slices (VJoin topology, under-compose, shaft descent) UNBLOCKED.
- ✅ **EYEBALL the daylight sky register — PASSED 2026-08-08, all six bars,
  and bar 1's kill INVERTED.** Harry judged it in three passes. First the
  side-by-side: *"solarized looks way better because it actually looks like a
  time of day"* — which passed bar 1 on the hue axis and refuted the recorded
  argument-against ("a hue rotation cannot make noon brighter, and brighter may
  be irreducible to what day means"). Solarized moves ×1.2 in luminance and
  reads as an hour; phosphor's first cut moved ×4.3 in pure green and read less
  like one. **Hue is the stronger axis for telling time, not the fallback.**
  Phosphor was then re-cut twice on that finding — hue rotated 154° → 179° at
  held luminance, then the red channel to zero for 40% more chroma at no
  brightness cost — and accepted on the four-hour frame. Bars 2 and 6 were
  settled by measurement rather than eye (zero differing pixels against the
  pre-slice build; three windows agreeing with no broker and clean joins);
  bars 3–5 passed on Harry's watch: *"bars 3-5 pass, ship it"*.
  **The rung is CLOSED and daylight colour is shipped.** One finding kept from
  the bar-4 pass: labels are ground-drawn (0 of 109 label cells sit in the sky
  band), so the recognition surface's contrast is invariant across the day —
  the gate needs no label bar. Shots:
  `docs/design-reviews/2026-08-08-daylight-sky-register/`.
  Commits `d9244b5` → `316e3eb`.

- ✅ **EYEBALL the hour without colour — PASSED 2026-08-07, all six bars.**
  Harry's live watch on the two-window desk: bar 1 first ("bar 1 passes, noon
  reads as day"), then "bars 2-6 all pass". No kill fired on any bar, no dial
  spent. **The world clock is released and the rung is CLOSED.** The pass
  settles the fork the slice existed to resolve: this world tells the hour by
  POSITION and STATE — the ☼ climbing and setting, the ☾ counter-arcing, the
  shelf lamps lit at night — with no colour at all. Two earlier mechanisms died
  getting here (presence-only, judged 2026-08-06; sky colour, killed at
  calibration 2026-08-07), and the answer was cheaper than either.
  Consequence: both daylight-colour axes become an OPTIONAL expressive axis for
  pack authors rather than the only path left — captured in IDEAS.md with their
  own tests and kills, nothing scheduled.

- ✅ **EYEBALL land polish #19 slice 2 — PASSED 2026-08-06, all six bars;
  the #19 programme item is CLOSED.** Two rounds: bars 1/2/4/5/6 first
  watch; bar 3 (drift) needed two same-day fixes — wisp re-row +
  resynthesis past mural occlusion (`d21fc3b`), then a speed re-dial
  0.04–0.10 → 0.25–0.45 cells/s because the first band was humanly
  invisible (`905c3b6`). "yes that's much better — bar 3 passes." No
  kill fired. Same session: plain desktop launch now boots the
  terminals desk (`8ec7ee4`; palace = LOKILIBRARY_TERMINALS=0).
- ✅ **EYEBALL land polish #19 slice 1 — PASSED 2026-08-05** ("the
  shots look right — eyeball passed on all three": strata material read,
  closed-wing skyline, DMG blank sky, judged against the bars frozen
  before implementation. Neither kill condition fired; no tuning
  requested.) Remaining #19 legs (monument architecture + door,
  constellations/clouds, ore veins/caverns, signage) are slice 2.
- ✅ **EYEBALL marginalia on land — PASSED 2026-08-01** (Harry watched
  the live beat — a driven reveal plus the ambient marks/wear surface —
  and called it: "this feels right"; no tuning requested). The moat
  beat is on the product surface: slice shape in STATE.md, knobs in
  `src/terminal/marks.ts`.
- ✅ **EYEBALL gameboy-dmg re-cut — PASSED 2026-07-31** (judged against
  the kill condition inherited verbatim from the fired round: reads as a
  different machine, not "the default with a green filter"; the omission
  slot + chunky dialect fixed what fired the first kill). The open
  one-liner (a single `*` surviving the blank sky) was RESOLVED
  2026-08-02: the painter was the `☼` sun, never in the pack's omit
  list — pack gap, not a leak; now omitted (STATE.md has the ruling).
- ✅ **EYEBALL amber-crt glow leg — PASSED 2026-07-31** (glow reads as
  glowing, not blurred; text stays sharp). Both legs of the
  ceiling-widening round are now closed green.
- ✅ **EYEBALL diorama-neighbour joined pair — MUTATE 2026-07-31,
  element PINNED 2026-08-01** (Harry: pairing works, but the glyph
  side's shade-dither crust band reads as unreadable letter-noise —
  "all of those ae's"; the frozen kill condition did NOT fire; engine
  work stays parked behind its two preconditions regardless). The pin
  reclassified the mutate: the mockup reproduces the shipped desk, so
  this is a first-contact legibility finding about the DESK — fix on
  the depth track, re-mock only after the desk's ground band improves.
  Full verdict + pin in `docs/design-reviews/2026-07-31-diorama-neighbour.md`.
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
