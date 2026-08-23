# SEALED — the matching answer key (taste bar 4b)

> **VERDICT (recorded 2026-08-24, after Harry answered): PASS, 4 of 4.**
> Harry's answer as typed: "2-b, 3c not confident, 4b, 1a by elimination"
> — the double-B made it an invalid permutation; asked to fix with no
> hints, he confirmed 2-D, giving 1-A, 2-D, 3-C, 4-B. All four correct,
> including the not-confident 3-C. Frozen bar was ≥2 of 4; 4/4 clears
> even the strict reading (~1/24 by chance). The kill did not fire.
> Rung 1 CLOSED; the MCP builder's-hand rung's spec-interview unblocks.

Open only after writing down four pairs against
`2026-08-23-mural-matching.html`. PASS = 2 or more of 4 correct;
kill fires at 1 or fewer (frozen 2026-08-23, before the murals existed).

## The key

| mural | library | profile | source | brief |
|---|---|---|---|---|
| 1 | **A** | finisher (fake) | cold agent, branch `worktree-agent-a2e4ccb8243f21609` @ `c74ea5a` | relationship |
| 2 | **D** | **harry (REAL — steamid 76561198405139364)** | cold agent, branch `worktree-agent-abefdd9b26f86adb3` @ `4d34aab` | relationship |
| 3 | **C** | collector (fake) | cold agent, branch `worktree-agent-acc32065c82697396` @ `fb8ad54` | relationship |
| 4 | **B** | cozy (fake) | cold agent, branch `worktree-agent-a9cc3d450646f4e02` @ `1802e0c` | relationship |

## The agents' whys, verbatim from their JSONs

- **mural 1 (finisher / Hollow Knight):** "hollow knight is the outlier:
  103h at 3.9x main in a finisher's library, still ongoing — so brief 2:
  the descent past the line where main ends, lamp still lit."
- **mural 2 (harry / Deep Rock Galactic):** "deep rock galactic leads a
  library where every game was tried and set down — 4.5h, most-played yet
  abandoned — so: a shallow dig, lantern lit, seams unmined."
- **mural 3 (collector / Vampire Survivors):** "relationship: vampire
  survivors holds 8 of 14 total hours while 15 titles sit unopened; the
  backlog is the horde, closing on the one game that got played."
- **mural 4 (cozy / Stardew Valley):** "stardew holds 56.7 of the
  library's 100.8 hours, past main and still played this week — an
  outlier arc, so brief 2: the loved door, its path worn deepest."

## Run record

- Real library pulled 2026-08-23 via `scripts/pull-library.mts`
  (GetOwnedGames + recently-played + achievements): 5 games, 11.9h.
  Harry reports the account holds 6; GetOwnedGames omits free titles
  never launched, which accounts for the gap. HLTB endpoint discovery
  failed on both attempts, so the real profile's tags are
  playtime-plus-recency only; that is also why summary D alone carries
  no completion fractions (the fakes embed static HLTB hours). Accepted:
  the sheet-reader recognising their own summary was already ruled
  harmless, and the format difference reveals nothing about mural
  pairings.
- Fake profiles: `scripts/lib/matching-profiles.ts`, summaries built by
  `scripts/build-matching-summaries.mts` through the identical
  tagLibrary + buildProfile path. Post-pull adjustments (both
  pre-registered): the third fake's pole changed from
  abandoned-backlog to unopened-hoard after the real library tagged
  4-abandoned (abandoned stays unique to the real profile); the
  collector owns Deep Rock Galactic unopened as the game-recognition
  confound.
- Mount wing d1 by the recorded rule: lowest wing whose SAMPLE_LAND
  flagship appears in no summary (civ was freed by swapping Civ VI,
  Disco Elysium and Outer Wilds out of the collector's filler dust).
- Shots: one `scripts/e2e/run.sh` Chrome window, shot order randomised
  (awk srand) to finisher, harry, collector, cozy; per candidate the
  mural was copied over `src/murals/d1.json`, the full
  smoke-mural-blueprint gate re-run green (190 assertions, zero
  hand-fixes), a fresh `VITE_E2E=1` build served, the page forced
  through about:blank so the new bundle loaded, then
  `drive.mjs shot`. Summary letters shuffled independently (A=finisher,
  B=cozy, C=collector, D=harry). Shipped d1 restored byte-identical
  afterwards; final gate green.
- All four agents independently chose the relationship brief; each
  profile was engineered around (or, for the real one, happened to be)
  a marked personal arc, so the blueprint's choice rule points the same
  way four times. The brief column therefore carries no pairing signal.
