# Away-session briefing (the phone lane)

**What this is.** Harry works from his phone for a stretch starting
2026-08-25, driving Claude sessions that do NOT run on his Mac: cloud
sessions at claude.ai/code opened on this GitHub repo, or plain
claude.ai chats pointed at this file. Those sessions cannot see his
global instructions, the project memory, the shared brain, or his local
skills. This page carries the distilled versions they need, plus the
work queue. Staged 2026-08-24 from the Mac session holding full
context.

**Harry: to start a session.** Claude app or claude.ai/code, new
session on `demonty3/Lokilibrary`, then say: *"Read
docs/AWAY-SESSION-BRIEFING.md and run queue item 1."* Fallback if cloud
sessions are unavailable: a plain claude.ai chat, paste this file's
GitHub URL.

**If you are a Claude session reading this:** `STATE.md` is the
present-tense source of truth, `TODO-USER.md` is Harry's action
backlog, `CLAUDE.md` is the rulebook (read it first, as usual).
Everything below supplements those documents and overrides nothing.

## How to work with Harry (distilled from his global instructions)

- He is not a software engineer. He directs; Claude implements.
  Explain in terms of what a thing does and what it costs him, name
  the tradeoff, give one recommendation. Say plainly when something is
  risky, irreversible, or a guess.
- Mark inference: separate what you observed from what you inferred,
  and name the assumption a recommendation rests on.
- Falsification over confirmation: before any test or judged look,
  write down what would confirm AND what would kill, and freeze those
  bars before observation. Never soften a bar after seeing a result.
  Bars may be revised between rounds only if the revision is written
  before the next observation, records the old bars and old verdict,
  and the rationale never references which outcome the new bar would
  produce.
- Verdicts on developed ideas are mandatory: PURSUE / PARK / KILL /
  NEEDS-CHECK, with the strongest argument against stated before the
  verdict. Search for prior art before calling anything novel.
- British spelling in anything he will show someone; no em-dashes in
  delivered documents; UTC timestamps in pipelines and logs.

## The spec-interview method (the away queue's main tool)

Harry's local `spec-interview` skill is not in this repo; run the
method directly:

- For creative or taste-led work, interview as DIALOGUE with a few
  concrete variants Harry reacts to, never a questionnaire.
- The output is a spec document in `docs/superpowers/specs/` (copy the
  format of the existing ones, e.g.
  `2026-08-21-dungeon-rung4-cookbook-dm.md`): scope, Done-means bars,
  frozen kill conditions, verification plan. Harry approves and the
  spec FREEZES before any implementation.
- Execution protocol on this project: implementation later runs in a
  FRESH context reading only the spec plus the repo (never the
  interview conversation), then a fresh-context spec review grades the
  artifact against the spec, then Harry's eyeball.
- Away sessions produce specs, documents, decisions and HTML variant
  pages. Implementation that touches the engine, or anything that
  needs the desk on screen, queues for the Mac (macOS is the only
  build and verify platform).

## Queue, in order

### 1. MCP builder's-hand rung: SPEC-INTERVIEW (the headline)

Context a fresh session needs:

- **The direction** (opened 2026-08-21; these are Harry's own picks):
  the user's own Claude Code session gets tools over a LIVE MCP server
  into the running desk; changes land as frozen, gate-validated
  authored content, never runtime generation. Of three connection
  options Harry picked only this one: the live connection is the
  excitement. First-run-as-Claude-building-your-palace is a LATER rung
  with its own interview. One question is explicitly deferred to that
  pair of interviews: hard-dependency first-run vs generic procedural
  boot plus a "move-in" ritual.
- **What rung 1 proved** (CLOSED 2026-08-24, full ladder passed):
  gated stranger-agent mural authoring works end to end. Blueprint
  plus smoke gates produced cold-authored murals with zero hand-fixes;
  the blind A/B passed; Harry blind-matched four cold mural sets to
  four library profiles 4 out of 4, through a planted confound. See
  `docs/superpowers/specs/2026-08-21-claude-authoring-rung1-mural-blueprint.md`,
  `docs/blueprints/mural.md`, `src/murals/`, and the
  `smoke-mural-blueprint` gate.
- **Prior art** (scouted 2026-08-21, medium confidence): the bare
  mechanism is skeleton-occupied. OpenPets (openpets.dev) ships a
  player-facing `@open-pets/mcp` whose tools are status/react/say
  only: no authoring, no gates, no persistence (useful as a plumbing
  reference). MCPlayerOne generates a world via MCP but ephemeral and
  freeform. Agent World is the read-only mirror image. UNOCCUPIED: the
  conjunction of own agent, live MCP, hand-authored content, frozen
  gate-validated assets, deterministic engine, first-run-as-move-in.
  The moat is the gates and the frozen deterministic assets, never the
  plumbing; nothing (README included) may claim "MCP into a game" as
  novel.
- **Shape constraints:** dungeon rung 4's propose, bound, judge
  machinery (deterministic validation before AND after any LLM
  judgment; consumed rejections so nothing retries in a loop; hard
  caps claimed from the main process) is the pattern the MCP intake
  should follow. `scripts/pull-library.mts` plus the gitignored
  `fixtures/` pattern is the likely seed of library intake. Any new
  runtime AI call needs a CLAUDE.md ledger entry (cost model, caching,
  fallback) drafted into the spec itself; whether a tool call made by
  the user's own session counts against that ledger is an open
  question for the interview, not a settled fact.
- **Deliverable:** an approved, frozen spec committed to
  `docs/superpowers/specs/` (PR or push to main). Implementation is
  NOT part of the away lane.

### 2. Addendum-9 display rung: SPEC-INTERVIEW

The material is IDEAS.md, section "Addendum 9 — displaying many
dungeons: gates, depth, the vertical scroll". The dungeon ladder's
rungs 1 to 4 are shipped (STATE.md has the record). Same interview
method, same deliverable shape. Queued behind item 1.

### 3. Small decisions (single-message items)

- Tier-2 depth review: re-run over the widened range or accept the
  partial pass. TODO-USER.md, the DECIDE item, has both sides; cost is
  the open variable and the reason it is Harry's call.

### 4. Optional: visual direction rounds as artifacts

The established pattern: variant pages authored as HTML artifacts,
kill bars frozen and written down BEFORE Harry looks, one verdict per
variant. Candidates if he wants a taste thread: the five bigger-jump
primitive directions (IDEAS.md, "The detail thread"; none killed), and
the never-built fine-lattice mural rect. Honesty rule: engine-true
screenshots cannot be produced away from the Mac; away pages are
sketches for direction-finding, and anything that needs the real
composer's output waits for the Mac.

## What away sessions must NOT do

- No engine implementation and no desk-boot claims: macOS is the only
  build and verify platform, and the desk cannot be seen from a cloud
  session. Never mark an eyeball done.
- No new runtime AI call sites, even inside a spec, without the
  CLAUDE.md ledger entry drafted into the spec itself.
- The repo rules in CLAUDE.md apply in full (whitelists, determinism,
  licence hygiene). This file adds context; it relaxes nothing.
