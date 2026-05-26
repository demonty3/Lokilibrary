# Phase 2 retrospective — Memory Palace agent v0

Smallville on the cell level. Phase 1 (`RETROS/phase-1.md`) laid the
renderer foundation — Cozette + WFC + scale ladder + scatter + a Tier-0
random-walk Loki. Phase 2 turns that empty room into a society:
DB-backed memory stream, five-agent cohort with spatially-bounded
perception, three-tier router (BT default → Tier 1 micro-action → Tier 2
reflection), Loki + 4 NPC personas, bookshelf launch with persistent
marginalia, cost-telemetry overlay, and the profile-aware remount that
closes the last Phase 1 carryover.

**Status (2026-05-26). All seven slices shipped clean on
`claude/phase2-agent-v0`; typecheck + build green throughout; 158
smoke assertions across 2A–2G all passing. Awaiting browser
verification (§ Verification below) + the mid-phase aesthetic
checkpoint (§ The mandatory aesthetic question).** Phase 1's
unverified ⬜ checks have been folded in here — running through this
list in one pass covers the whole Phase 1 + Phase 2 surface.

The Phase 2 plan is `PLAN.md` § Phase 2 — there is no per-phase plan
file the way Phase 1 had `i-m-pivoting-this-project-cozy-newell.md`;
each slice was scoped against PLAN.md's task list inline.

## What Phase 2 shipped (7 commits on `claude/phase2-agent-v0`)

| # | Commit | Sub-slice | Verifies |
|---|---|---|---|
| 1 | `16c7439` phase 2A: SQLite memory stream + markdown vault export | 2A | better-sqlite3 + sqlite-vec + FTS5 + Obsidian-style vault mirror; namespace columns (cell_id, library_id); round-trip vault edit → reimport |
| 2 | `3d320bf` phase 2B: Tier-0 BT + 5-agent cohort | 2B | Utility-AI behaviour tree; Loki / Archivist / Cat / Visitor / Ghost; per-agent PRNG + tier0StepMs; theme-gated Ghost; deterministic walk |
| 3 | `f71c87b` phase 2C: perception + Tier-1 dispatch | 2C | Chebyshev FOV per agent; perception queue → routeTier1; deny-verb whitelist; throttled HTTP path to /api/agent/tick |
| 4 | `b7e0462` phase 2D: Tier-2 reflection + Smallville retrieval + DB-backed writer | 2D | importance threshold 150; recency × relevance × importance retrieval; reflection rows + synthesised_from edges; DB-backed MemoryWriter wraps the better-sqlite3 store |
| 5 | `5d15998` phase 2E: bookshelf launch + Loki marginalia | 2E | E key on adjacent shelf → launchGame (Electron IPC or steam://); Loki Plan with place_mark step persists; magenta `·` survives cell remount |
| 6 | `48480b4` phase 2F: telemetry overlay + personas + Electron bootstrap + reprompt | 2F | PRICE_TABLE per (provider, model); Ctrl+\` toggles cost overlay; persona auto-seed (5 agents); /healthz reports ollama_gpu; deny-verb one-shot reprompt + rejection telemetry |
| 7 | `b916440` phase 2G: profile-aware remount + writer namespace rebuild | 2G | loadAuth cascades into loadLibrary; PixiApp subscribes to profile + sync rebuilds writer namespace before remount; Tier-0 cadence bugfix (executeAction was firing every frame) |

## What Phase 2 does **not** touch yet (Phase 3+ territory)

- Pixel-art SDXL+LoRA sprite pipeline (Phase 3)
- Sprite-aware cell renderer (Phase 3)
- Wallpaper polish: three-tier throttling, multi-monitor picker, peek
  hotkey (Phase 4)
- Smallville reflection on a real time budget (one per real-world hour
  per agent, not per-event) (Phase 5)
- Weekly "dream" sequences (Phase 5)
- Upload-lore feature + embedded user lore (Phase 5)
- macOS wallpaper port (Phase 4)
- Share-URL contract (still dropped from Phase 0 prune; revisit Phase 5 if
  Phase 2's namespace work surfaces a need)
- Bookshelf row clustering / Tee tile / lamp glyph rarity / `walkable`
  set on bible — all noted in `RETROS/phase-1.md` § "Pending follow-ups",
  none load-bearing and none touched in Phase 2

## Verification — to fill in after running locally

Each must be green before ff-merging to `main`. The list spans Phase 1's
unverified ⬜ checks (renderer foundations) and Phase 2's own gates
(agent layer). Fill in observations after running.

### A. Phase 1 carryover — renderer foundations still hold

**A1. Cozette bitmap font renders crisp.** `npm install && npm run
dev` → `http://localhost:5183`. The renderer panel + cell room render
in Cozette 6×13 (visibly bitmap; no antialiasing blur on glyph edges).
Cell room: enclosed walls `─│┌┐└┘`, one door `╪` south, one window
`╫` north, ~30 bookshelves `▓` with bright spine letters, ~3 tables
`□`, scattered chairs / plants / book stacks / (rarely) lamps. `@`
player at spawn one cell north of the door.

- Status: ⬜
- Notes: ___

**A2. WASD + arrow keys + collision.** WASD moves `@` one cell per
~100ms. Holding gives smooth-ish movement (not teleport). Walking into
walls / bookshelves / tables / doors / window blocks. Scatter items
(plants, chairs) are walkable.

- Status: ⬜
- Notes: ___

**A3. Scale-ladder transitions.** `]` cell → district (3×3 minimap
with "YOU" centre) → "island — not yet built. keep playing." → 3 more
stubs → ignored at solar_system. `[` walks back; cell remounts cleanly.
HUD top-left updates with current level.

- Status: ⬜
- Notes: ___

**A4. Theme swap preserves layout.** Edit `DEFAULT_THEME_ID` in
`src/themes/index.ts` to each of `gruvbox-dark`, `catppuccin-mocha`,
`tokyo-night`, `ibm-3270` in turn. Reload. Same room layout, only
palette changes. Determinism holds because the layout seed is
profile-derived, not theme-derived.

- Status: ⬜
- Notes: ___

**A5. Phase 0 boot diagnostic still fires.** Console shows
`[phase 0] agent tick { action, intent, model, provider, latencyMs }`
within a few seconds. Confirms Worker reachable + Tier 1 round-trip
closes through every Phase 1+2 renderer change.

- Status: ⬜
- Notes: ___

### B. Phase 2 — the agent layer

**B1. Five-agent cohort renders + behaves.** On a default theme
(non-Tokyo-Night), four glyphs visible in the room: magenta `L` Loki,
blue `A` Archivist (near the door), yellow `c` Cat (random floor),
cyan `V` Visitor (on the door, only present ~90s every 15min). On
Tokyo Night a fifth glyph appears: `G` Ghost (theme-gated). Each
agent steps **about once per their tier0StepMs cadence** — Loki ~2.5
steps/sec, Cat ~1/sec — *not* dozens of cells per second. This is the
2G bugfix; if you see letters flying around, the bugfix didn't ship.

- Status: ⬜
- Notes: ___

**B2. Perception → Tier 1 dispatch.** With Worker + Ollama (or
Anthropic) running, walk `@` to within Loki's FOV (radius 8, so any
of the bottom half of the room). Console shows a Tier-1 tick with
`agentId="loki"` followed by an intent update. Walk away → no
duplicate dispatch (perception queue drained, throttle holds for
30s). Memory store has a new `observation` row with kind
`player_proximity`.

- Status: ⬜
- Notes: ___

**B3. Tier 2 reflection at threshold 150.** Pace around Loki for a
while (or trigger any direct user action — see B5). When Loki's
`reflectionCounter` crosses 150 OR you press E on a bookshelf, a
reflection row lands in `memories` with kind `reflection` +
non-empty `synthesised_from` array. Worker log shows Sonnet 4.6 (or
the local Qwen 14B+ fallback) being called, not Haiku.

- Status: ⬜
- Notes: ___

**B4. Telemetry overlay (Ctrl+\`).** Press Ctrl+\` — corner panel
appears showing tier-1 + tier-2 counts, recent latency, cost in
window, monthly extrapolation, reprompt + rejection counters.
Numbers update every 2s. Press again to dismiss. Overlay stays
visible across scale transitions (cell → district → back).

- Status: ⬜
- Notes: ___

**B5. Bookshelf launch (E).** Walk `@` adjacent to a bookshelf with
a known game spine. Float prompt appears: `[E] play <name>`. Press
E: console logs `[cell] launch <surface> appid=<id> ok=... name="..."`.
On the web build, Steam URL handler fires `steam://run/<appid>`. On
Electron, IPC routes through main-process `shell.openExternal`.
Loki's `game_launched` perception event fires + force-triggers Tier 2
(see B3).

- Status: ⬜
- Notes: ___

**B6. Marginalia persists across restart.** After B5: scale out
(`]`) then back (`[`), or close + reopen the app. A magenta `·` dot
sits near the shelf you launched from — Loki's `place_mark` Plan
step rendered from the SQLite memory store. The dot survives full
restart on Electron (it's in `userData/memory.sqlite`); on web it
survives scale transitions only (no persistence layer).

- Status: ⬜
- Notes: ___

**B7. Profile-aware remount (signed-in → cell re-seeds, no refresh).**
First boot signed-out: spine letters are H, S, H, D, O, S, C (sample
library: Hades, Stardew, Hollow, Disco, Outer, Slay, Civ). Sign in via
the Electron tray flow (or web Steam OpenID). **The cell remounts
without a page refresh** with your real library's top-N spine letters
and a different room layout (seed = profileSeed(profile)). This is
the 2G fix; if you have to reload the page to see your library, the
2G subscription didn't wire.

- Status: ⬜
- Notes: ___

**B8. Persona auto-seed (Electron only).** After first Electron boot,
inspect `userData/memory.sqlite`:
`sqlite3 <path> "SELECT agent_id, name FROM agent_personas"`. Five
rows: loki, archivist, cat, visitor, ghost. Each row's
`system_prompt` is >50 chars. Loki's `metadata_json.whitelist`
includes `shelve`.

- Status: ⬜
- Notes: ___

**B9. Wallpaper-mode regression (Windows-native Electron).** From a
PowerShell window (NOT WSL): `cd desktop && npm install && npm run
dev`. Tray → "Wallpaper mode". Cell renders behind desktop icons;
icons remain clickable. WASD does NOT move `@` in wallpaper mode
(input gated on `wallpaperMode === true`). `[` / `]` inert. Phase 0's
five integration checks still pass.

- Status: ⬜
- Notes: ___

**B10. GPU detection on `/healthz`.** With Ollama running, `curl
http://localhost:8787/healthz` (or your wrangler-dev port) returns
JSON including `ollama_gpu.available` + a `models[]` array with at
least one entry having `onGpu: true` (assuming GPU detected). If
`onGpu: false` for all loaded models, Worker logs warn with "expect
<1s on 12GB+ GPU" reminder — that's a Phase 0 follow-up that landed
in 2F.

- Status: ⬜
- Notes: ___

**B11. Memory persistence across restart.** With Electron: load app,
do anything (walk around, trigger perception, press E on a shelf).
Close Electron. Reopen. The marginalia (B6) is still there.
`SELECT COUNT(*) FROM memories` is non-zero. `SELECT COUNT(*) FROM
agent_telemetry` shows the prior session's dispatches. None of
these survive on the web build (no DB) — only Electron.

- Status: ⬜
- Notes: ___

## The mandatory aesthetic question

Per `PLAN.md` "When to stop and reconsider" § Phase 2: *"are the
agents feeling like beings or like canned-response bots?"*

This is the gating question for the whole agent layer — Smallville's
architecture is well-validated but the persona depends on prompt
craft. If "bots," budget a real prompt-engineering pass on Loki +
the four NPCs before Phase 3 sprite work (which can't compensate for
weak dialogue). Bad agent dialogue cannot be fixed by adding more
agents.

A specific tell: after 15 minutes of walking around, are Loki's
Tier-2 reflections referencing *specific* spine letters / scatter
glyphs / your walking pattern, or are they generic ("the room is
quiet, the books wait")? If specific → beings. If generic → bots.

- Honest answer (≥ 2 sentences): ___
- If "bots": what would close the gap? ___

A second aesthetic check carries over from Phase 1: *"does the WFC +
bitmap-font + theme combination still deliver the terminal-aesthetic
magic the design pillar promises?"* Phase 2 didn't touch the
renderer's visual surface, so the answer should be the same as Phase
1 — but it's worth re-asking now that the room is *populated*.
Static empty room vs. five glyphs wandering reads very differently.

- Honest answer (≥ 2 sentences): ___

## Cost envelope

Phase 2 turned on Tier 1 (per-perception) and Tier 2 (per-reflection)
LLM calls. The 2F telemetry overlay is where the truth lives — fill
in actual numbers below after a representative session.

Target (PLAN.md + CLAUDE.md): **≤ $1/user/month at Claude Sonnet
rates** for the full agent runtime.

Measured (fill in from Ctrl+\` overlay after ≥30 min real-time):
- Tier 1 dispatches / hour: ___
- Tier 2 dispatches / hour: ___
- Tokens in / hour (combined): ___
- Tokens out / hour (combined): ___
- $ / hour (combined): ___
- Monthly extrapolation: $___

If the monthly extrapolation is >$1, the most impactful knob is
agent throttles (`tier1ThrottleMs` on cohort.ts) — bumping Loki from
30s to 60s halves Tier 1 volume. Tier 2 cadence is bounded by the
importance-150 threshold; raising to 200 reduces Sonnet volume but
risks the agent feeling less reflective.

## Pending follow-ups (write into Phase 3)

- **Pixel-art pipeline kickoff.** Phase 3's plan is fully in PLAN.md
  § Phase 3 — start with the VRAM-detection branch + provider
  interface (`src/agents/pixelart.ts` doesn't exist yet) so we can
  fall back to PixelLab.ai cleanly on <8 GB cards.
- **Bookshelf row clustering** (carried over from Phase 1 retro).
  WFC's min-entropy bias still distributes shelves rather than
  clustering. Phase 3 could either bump bookshelf frequency + tighten
  N/S adjacency OR post-process WFC output to merge isolated shelves.
- **Lamp glyph rarity** (carried over from Phase 1 retro). ☼ at
  weight 1 of 13 often appears 0 times per 18-item scatter. Bump to
  weight 2 or accept as "rare collectible." Cat's `bias_idle_near_glyph`
  schedule depends on lamps existing, so 0-lamp rooms partially
  break Cat's behaviour.
- **`walkable` set on bible unused** (carried over from Phase 1
  retro). Cell renderer + behaviour.ts hard-code `tiles[y][x] !==
  T_FLOOR`. Should consume `LIBRARY_BIBLE.walkable` so future tile
  bibles with multiple walkable tile types Just Work.
- **District + stub levels stay shallow.** Phase 2's task list noted
  district-level decisions as a Phase 2 candidate; the slice never
  landed. District is still a 3×3 minimap with "YOU" centred. Phase
  3+ should decide between agent activity heatmap, real neighbour-cell
  layouts, or both.
- **Loki / NPC cell-overlap.** Multiple agents can occupy the same
  tile mid-walk; no inter-agent collision check. Probably fine at 5
  agents but worth a guard before Phase 5 (where lore-driven
  district-level populations could push densities higher).
- **Anthropic / Ollama latency parity.** 2F surfaced the GPU
  detection on /healthz; we still haven't measured Tier-2 latency
  on Qwen 14B+ vs Sonnet 4.6 head-to-head. Phase 3 work can absorb
  this with a 30-min comparison; the answer affects whether local
  Tier 2 is even a sensible dev surface.
- **Memory aging not yet implemented.** Smallville's importance ×
  recency decay is described in 2A's plan but the actual age-out
  cron / on-mount sweep doesn't exist. Cap N=1,000 entries per agent
  hasn't been hit in dev; will be a real concern in Phase 5 when
  lore upload starts loading the same table.
- **`tickPresence` doesn't fire mid-action.** Visitor's
  `intermittent_presence` schedule rule could in theory leave
  Visitor visible mid-walk when the absence window starts. Worth a
  Phase 3 check that `present=false` doesn't leave a stranded sprite.

## Decision: ff-merge `claude/phase2-agent-v0` to `main`?

Decision: ⬜ pending verification + aesthetic checks above.

- Browser verification (§ A1–A5, B1–B11) all green
- Wallpaper-mode regression (Windows § B9) green
- Aesthetic question (§ The mandatory aesthetic question) answered
  honestly
- Cost envelope (§ Cost envelope) measured + within target, or a
  written rationale for the gap + which throttle is the next knob

If all four: ff-merge (Phase 0 + Phase 1 pattern); start Phase 3
(pixel-art pipeline — `PLAN.md` Phase 3).

If the aesthetic question lands "bots": pause Phase 3, budget 1–2
weekends for a Loki + NPC prompt rewrite + retry the check. The
emotional core of the product is here.
