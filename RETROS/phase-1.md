# Phase 1 retrospective — Memory Palace renderer foundations

The second stage of the Memory Palace pivot. Phase 0 (`RETROS/phase-0-spike.md`)
shipped the PixiJS hello-world + Electron + Steamworks + Tier 1 agent
round-trip + wallpaper-mode revival. Phase 1 lays the renderer
foundation on top of that — Cozette bitmap font, multi-theme registry,
hand-rolled WFC tile composition, single-library-room cell renderer,
scale-ladder state machine (cell + district implemented; higher 4
stubbed), player avatar + Loki test sprite, 2D scatter — plus the doc
rewrites that move `CLAUDE.md` / `SPEC.md` / `PLAN.md` from
LibraryWorld to Memory Palace.

**Status (2026-05-22). Awaiting browser verification + the aesthetic
checkpoint (§ The mandatory aesthetic question below). All seven
slices shipped clean; typecheck + build green throughout; CLI smokes
all passing.** Code on branch `claude/phase1-renderer-foundations`,
draft PR #27 at https://github.com/demonty3/Lokilibrary/pull/27.

The user-confirmed scoping decisions held — Cozette 6×13, scaffold all
6 scale levels + implement cell + district, single library room as the
cell content. The plan was at
`/home/henrydemontfort/.claude/plans/i-m-pivoting-this-project-cozy-newell.md`
and stayed unchanged through execution.

## What Phase 1 shipped (7 commits on `claude/phase1-renderer-foundations`)

| # | Commit | Sub-phase | Verifies |
|---|---|---|---|
| 1 | `2f1a9f8` docs: rewrite CLAUDE.md for Memory Palace pivot | 1A | Day-to-day rulebook reflects PixiJS / Cozette / WFC / Smallville stack; legacy "Things to NOT do" preserved + new ones added |
| 2 | `7987ba2` docs: rewrite SPEC.md for Memory Palace, archive 3D-era as Appendix A | 1A | Spec ported from `docs/pivot/DESIGN.md`; 3D-era preserved verbatim as Appendix A for historical context |
| 3 | `b4ebeb0` docs: rewrite PLAN.md for Memory Palace phases 0-6 + Workshop prereqs | 1A | Phases renumbered for the new build path; ~16–21 weekends to v1.0 |
| 4 | `daec4be` phase 1B: Cozette bitmap font + 4 new themes + registry | 1B | Cozette woff2 + @font-face + 5 themes in registry; BitmapText path works end-to-end |
| 5 | `98f9487` phase 1C: WFC tile-bible solver + library-room cell renderer | 1C | Hand-rolled tiled-model WFC produces enclosed rooms; same seed → same layout |
| 6 | `d5b801e` phase 1D: scale-ladder router + playerPos + Loki sprite + HUD | 1D | `[` / `]` cycles 6 scale levels (cell + district real; 4 stubbed); WASD walks the floor |
| 7 | `c473e62` phase 1E: 2D scatter — chairs, plants, book stacks, lamps | 1E | Scatter decor non-blocking; deterministic; never on spawn cells |

## What Phase 1 does **not** touch yet (Phase 2+ territory)

- Smallville memory-stream agents (Phase 2)
- Tiered router with Tier 1+2 LLM dispatch (Phase 2)
- Loki as a real agent with persona + dialogue (Phase 2 — Phase 1's
  Loki is a Tier 0 random walk only)
- Bookshelf interaction + `steam://run` / Steamworks launching
  (Phase 2)
- Pixel-art SDXL+LoRA sprite pipeline (Phase 3)
- Wallpaper polish: three-tier throttling, multi-monitor picker,
  peek hotkey (Phase 4)
- Lore upload + embeddings + agent reflection (Phase 5)
- Share-URL contract (dropped in Phase 0 prune; will revisit at
  Phase 5 if Phase 2 needs it)

## Verification — to fill in after running locally

Each must be green before ff-merging to `main`. Fill in observations
after running.

### 1. Cozette bitmap font renders crisp (WSL or Windows)

`npm install && npm run dev` → open `http://localhost:5183`

Expected: the renderer panel + cell room render in the Cozette 6×13
bitmap glyphs (visibly bitmap; no antialiasing blur on glyph edges).
The cell room shows enclosed walls (`─│┌┐└┘`), one door (`╪`) on the
south wall, one window (`╫`) on the north wall, ~30 bookshelves (`▓`)
with bright spine letters from `SAMPLE_LIBRARY`, ~3 tables (`□`),
plus scattered chairs / plants / book stacks / (rarely) lamps. `@`
player at the spawn (one cell north of the door). `L` Loki sprite
elsewhere on the floor.

- Status: ⬜
- Notes: ___

### 2. Player + Loki + collision

- WASD / arrow keys move `@` one cell per ~100ms. Holding a key gives
  smooth-ish movement (not teleport).
- Walking into a wall, bookshelf, table, door, or window blocks. The
  player cannot exit the room.
- Walking into a scatter item (plant, chair, etc.) **does** succeed —
  scatter is non-blocking by design.
- `L` Loki wanders the floor on its own (one step every ~400ms). Never
  overlaps a wall. Same library / same boot → same Loki path.
- Status: ⬜
- Notes: ___

### 3. Scale-ladder transitions

- `]` from cell → district view (3×3 minimap with "YOU" centre).
- `]` again → "island — not yet built. keep playing." stub.
- `]` again → continent stub. Again → planet stub. Again → solar system
  stub. Then ignored (no level beyond solar_system).
- `[` walks back. Cell renderer cleanly remounts (the player + Loki
  re-appear).
- HUD top-left updates with current level on each transition.
- Status: ⬜
- Notes: ___

### 4. Theme swap preserves layout

- Edit `DEFAULT_THEME_ID` in `src/themes/index.ts` to each of
  `gruvbox-dark`, `catppuccin-mocha`, `tokyo-night`, `ibm-3270` in
  turn. Reload after each.
- Expected: the **same room layout** in every theme; only the palette
  changes. (Determinism survives theme swap because layout seed is
  profile-derived, not theme-derived.)
- Status: ⬜
- Notes: ___

### 5. Anonymous vs signed-in profile

- First boot (signed out): renders `SAMPLE_LIBRARY` against
  `ANONYMOUS_SEED` (`0xa11ce11`). Spine letters are H, S, H, D, O, S, C
  (Hades, Stardew, Hollow, Disco, Outer, Slay, Civ).
- Sign in via the Electron desktop wrapper (or web Steam OpenID).
  *Known Phase 1 limitation:* the cell does NOT auto-remount on
  profile change — you'll need to refresh the page after sign-in to
  see your library's spine letters + a different room layout. Phase 2
  wires the profile subscription.
- Status: ⬜
- Notes: ___

### 6. Wallpaper-mode regression (Windows-native Electron)

From a PowerShell window (NOT WSL): `cd desktop && npm install &&
npm run dev`. Tray → "Wallpaper mode".

- Cell renders behind desktop icons; icons remain clickable.
- WASD does **not** move the player in wallpaper mode (input gated
  by `wallpaperMode === true`).
- `[` / `]` likewise inert in wallpaper mode.
- Phase 0's five integration checks still pass (Vite + PixiJS,
  Electron + wallpaper, Steamworks + overlay, Worker `/healthz`,
  Tier 1 agent round-trip).
- Status: ⬜
- Notes: ___

### 7. Phase 0 boot diagnostic still fires

Console on first load shows
`[phase 0] agent tick { action, intent, model, provider, latencyMs }`
within a few seconds. Confirms the Worker is reachable + the Tier 1
LLM round-trip still closes through the Phase 1 renderer changes.

- Status: ⬜
- Notes: ___

## The mandatory aesthetic question

Per `PLAN.md` "When to stop and reconsider" § Phase 1: *"does the WFC +
bitmap-font + theme combination actually deliver the terminal-aesthetic
magic the design pillar promises?"*

This is the gating retro question for the whole project — the
aesthetic moat (SPEC.md § 2.1) is what the pivot was *for*. If the
answer is "almost," the right move is to rework the approach now
(different font, different glyph palette, palette tuning, room-size
tuning), not to grind through the next 15+ weekends hoping it lands.

- Honest answer (≥ 2 sentences): ___
- If "almost": what would close the gap? ___

## Cost envelope (carried over from Phase 0)

Phase 1 doesn't add any runtime AI calls — the renderer stays
free-of-LLM. The Phase 0 cost target (≤ $1/user/month at Claude Sonnet
rates for the full agent runtime, telemetered from Phase 2 onward) is
unchanged.

## Pending follow-ups (write into Phase 2)

- **GPU detection for Ollama** (still pending from Phase 0). Tier 1
  CPU latency was 27s; expected <1s on the 4070 once Ollama detects
  it. Becomes critical in Phase 2 when the per-agent tick loop lands.
- **Profile change → cell remount.** PixiApp subscribes to the `scale`
  slice only; profile arrives later from `/api/library` after first
  paint, and the cell doesn't currently re-seed. Phase 2 either adds a
  profile subscription or wraps both into a single "scene state"
  subscription.
- **Stage 1 manifest dormant in Phase 1.** The
  `/api/world → {template, metaphor, casting}` route stays unused by
  the renderer. Phase 2 plans to reintroduce it as flavour text for
  Loki ("Loki notices the bookshelves") — *not* as a placement
  contract. Either reuse the existing shape (`metaphor` becomes Loki's
  observation prompt) or carve a new `/api/agent/world-vibe` route.
- **Bookshelf row clustering.** WFC frequency + min-entropy bias
  toward distribution rather than the tight horizontal rows the
  bible's E/W adjacency suggests. Possible Phase 2 tuning: either
  bump bookshelf frequency + tighten N/S adjacency, or post-process
  the WFC output to merge isolated bookshelves into rows.
- **Lamp glyph rarity.** ☼ at weight 1 of 13 total ≈ 1.4 expected per
  18-item scatter — often appears 0 times. Bump to weight 2 or accept
  as "rare collectible" design.
- **Loki / player cell-overlap.** Both can occupy the same tile mid-
  walk; no collision check between them. Probably fine for one agent
  but breaks at Phase 2's 4–6 agents.
- **District stub is shallow.** Phase 2's biggest district-level
  decision: agent activity heatmap, real neighbour-cell layouts, or
  both. Currently a 3×3 static minimap with "YOU" centred.
- **Tee tile (id 8) unused.** Reserved in the bible for fancier door
  framing (`─ ┴ ╪ ┴ ─`) but never placed by `layoutCell`. Phase 2 can
  either wire it in for visual polish or drop it from the bible.
- **`walkable` set on bible.** `LIBRARY_BIBLE.walkable = {T_FLOOR}` is
  defined but the cell renderer's keydown handler hard-codes
  `layout.tiles[ty][tx] !== T_FLOOR`. Should consume the bible's set
  instead so future tile bibles with multiple walkable tile types
  Just Work.
- **Cozette `CozetteCrossedSeven` variant** ships alongside Cozette
  Vector. If the user prefers the slashed-7 (terminal-emulator
  convention), it's a one-line swap in `index.html` + `fonts.ts`.

## Decision: ff-merge `claude/phase1-renderer-foundations` to `main`?

Decision: ⬜ pending verification + aesthetic check above.

- Browser verification (§ 1–7 above) all green
- Wallpaper-mode regression (Windows § 6) green
- Aesthetic question (§ The mandatory aesthetic question) answered
  honestly

If all three: ff-merge (Phase 0 pattern); start Phase 2 (Smallville
agent v0 on the cell level — `PLAN.md` Phase 2).
