---
name: game-design-review
description: >-
  Design-review lens for the Memory Palace's 2D terminal/pixel-art world —
  judging and improving how it LOOKS (terminal/pixel craft), how it FEELS
  (game-feel, juice, the agents-as-beings read), and how it READS (UX,
  legibility, wallpaper glance-value). Use this WHENEVER the work is about the
  visual/experiential quality of the rendered world rather than pure logic —
  phrasings like "does this look good / look right", "make it look really
  good", "feel like I described", "make it feel alive", "is the aesthetic
  landing", "review the cell render", "the HUD / overlay / prompt", "the
  palette / theme / colours", "the agents feel static / robotic", "add juice /
  polish / game-feel", "is it readable as a wallpaper", "what should we improve
  visually", or any time you're about to screenshot the world and critique it.
  Pairs with the launch-desktop-app skill (desktop/wallpaper/lore surfaces) and
  the headless e2e harness (scripts/e2e). NOT for backend/agent-runtime logic,
  determinism, or build/packaging work.
---

# Game-design review — the Memory Palace's look, feel & read

This project's moat is **taste, not technology** (`docs/pivot/CONSOLIDATION.md`).
The two hardest bets already passed on screen — *the aesthetic reads as
intentional terminal-art* (checkpoint ①) and *the agents read as beings*
(checkpoint ②). Your job with this skill is to protect and deepen that: every
visual/UX change should move the world toward **"looks really good and feels
like the pitch,"** never toward generic-game-engine defaults.

Use this as a **lens you actually run**, not advice you recite: capture the real
pixels, critique against the checklists, fix the highest-leverage thing, capture
again. Don't reason about the look from the code alone — *look at it*.

## The loop (Process)

1. **Capture the real frame.** Never judge from source.
   - **Web / window render** (fast, deterministic, no Electron): the headless
     harness. `bash scripts/e2e/run.sh` (build + `vite preview` + headless
     Chrome on CDP), then `node scripts/e2e/drive.mjs shot /tmp/x.png`. Drive it
     with `key`/`split`/`level`/`region`/`eval`. **Gotcha:** the tab does NOT
     reload on a rebuild — relaunch Chrome (`pkill -f loki-e2e-chrome-profile`)
     to see new code, or you'll critique a stale frame.
   - **Desktop / wallpaper / lore / theme-recolor**: the `launch-desktop-app`
     skill (`scripts/launch.sh` → `drive.mjs window|state|key|shot`). This is
     the ONLY way to see the real Electron app, wallpaper-mode pinning, the
     SQLite-backed lore recolor, and the local-AI landmark.
   - **Force a palette to preview a lore recolor without ingesting**:
     `node scripts/e2e/drive.mjs eval "window.__loki.setTheme('gruvbox-dark')"`
     (themes: `solarized-dark` default, `gruvbox-dark`, `tokyo-night`,
     `catppuccin-mocha`, `ibm-3270`). `setTheme(null)` clears.
2. **Read the frame as a player, then as a critic.** First impression (does it
   read? what's the eye drawn to? what feels off?), then walk the checklists
   below. Name the single biggest detractor before listing nits.
3. **Fix the highest-leverage thing first.** One change, re-capture, compare.
   Prefer the change that buys the most coherence per line (e.g. dropping the
   rainbow placeholder shelves bought the whole palette at once).
4. **Keep the rails green.** `npm run typecheck` + the relevant `smoke-*.mts`;
   for renderer-glyph changes, `npx tsx scripts/smoke-glyph-coverage.mts` (any
   off-atlas glyph renders as tofu □). Determinism rules in `src/procedural/`
   still hold — no `Math.random`.

## LOOK — terminal / pixel craft

The medium is **pixel-art that *reads* as terminal** (box-drawing + block +
unicode glyphs), not a literal TTY and not generic pixel-art.

- **One palette per scene, always.** Mixing palettes reads as *broken*, not
  artistic (`CLAUDE.md`). Every tint comes from the active `theme.palette[...]`.
  Full-spectrum colour dropped into a themed scene (the placeholder-sprite trap)
  is the #1 coherence killer — if an element isn't drawn from the palette, it's
  wrong.
- **Glyph vocabulary is deliberate.** Box-drawing frames (`┌─┐│└┘ ┼┬┴├┤`), shade
  ramp (`▓▒░·`), block elements — reused consistently across scales. A new glyph
  must be in the Cozette atlas (run the coverage smoke) and earn its place in
  the existing vocabulary, not introduce a new dialect.
- **Per-game art = Steam CDN recognition surface only**, never generated
  (`headerImageUrl`). Pre-v1.0 the world is **glyphs only**; curated pixel-art
  (Phase 3D) returns one hand-picked survivor at a time via `CURATED_SLOTS` —
  never auto-generated placeholder noise.
- **Composition:** is the room framed and centred? Integer-scaled (crisp, no
  fractional blur — nearest-neighbour)? Is negative space intentional or just
  empty? Does the eye land on the agents/Loki/player, or on clutter?
- **Theme coherence across recolor:** when lore recolors the world (gruvbox,
  tokyo-night…), every layer must shift together — background, shelves, agents,
  scatter, HUD. A layer that keeps its old tint betrays a hard-coded colour.

## FEEL — game-feel & juice

The renderer is pixel-art-that-moves, **not** a static TUI. If a change would
force snap-to-cell-only motion, push back — sub-character animation is the
medium's whole advantage (`CLAUDE.md`).

- **The agents must read as alive, not as a process.** Idle/wander cadence,
  easing between cells (not teleport-snapping), a beat of hesitation, distinct
  silhouettes. A cohort that marches on a grid is the failure mode.
- **Juice the moments that matter:** game launch, a seam-crossing, the lore
  recolor remount (one clean black flash is OK; two stacked canvases is a bug),
  morning-dispatch arrival, Loki placing a mark. A glow, a fade, a particle, an
  ease — small, in-palette, never gaudy.
- **Loki expresses through the world, not a chat bubble.** No speech bubbles, no
  summon-the-librarian chat — the contribution is *spatial* (what moves, what
  notes appear, what paths wear). This is a design moat; protect it.
- **Throttle-aware:** animation must freeze cleanly under `paused`/`sleeping`
  and ride `app.ticker.deltaMS`, never a wall clock (wallpaper runs 24/7;
  see the throttle ladder).
- **Stakes feel, not punishment:** wounds leave scars, nothing essential is
  permanently destroyed.

## READ — UX & legibility

It doubles as a **live wallpaper** (glance-value) and an **alt-tab destination**
(focused use). Both have to work.

- **Glance test:** at wallpaper distance, in 2 seconds, can you tell what's
  happening — is the world alive, where are the beings, did something change?
  If it needs study, it fails as a wallpaper.
- **Affordances:** can the player tell what's interactive (a launchable shelf,
  the local-AI landmark, a seam) before pressing a key? Is the `@` always
  findable? Does the HUD say what the keys do without shouting over the scene?
- **"What did the agent change?"** Loki's mischief must be *legible and
  reversible* — every rearrangement has a discoverable rationale; the user can
  see what moved and lock things they don't want touched.
- **Navigation:** the scale ladder (`[`/`]`) and multi-pane (`\`,`|`,`Tab`)
  must read as one coherent space — seams legible, the YOU-marker findable at
  every zoom, no pane bleeding past its clip.
- **Onboarding:** a first-run user should discover movement → a shelf → a launch
  → the agents, without a manual. Don't assume the player reads the HUD.

## Anti-patterns (auto-flag these)

- Off-palette / full-spectrum colour in a themed scene (placeholder-sprite trap).
- A new glyph that isn't in the Cozette atlas (tofu □) or breaks the vocabulary.
- Snap-to-cell-only motion; agents that march; teleport instead of ease.
- Any chatbot/speech-bubble surface for an agent.
- Generated per-game art instead of the Steam CDN recognition surface.
- Wall-clock-driven animation (breaks under throttle, breaks determinism).
- `Math.random` in `src/procedural/` (breaks the same-profile-same-world rule).
- Two stacked canvases after a remount; content bleeding across a pane seam.

## Anchors

- **Pillars + scope:** `docs/pivot/CONSOLIDATION.md` (design pillars, v1.0 MVP,
  the four-tier personalisation model), `docs/pivot/DESIGN.md`.
- **Rules:** `CLAUDE.md` ("Aesthetic coherence over scope creep",
  "Sub-character animation matters", "Don't make the agent a chatbot").
- **Present state:** `STATE.md` (renderer + theme + throttle shapes).
- **Checkpoints:** ① aesthetic · ② agents-as-beings · ③ wallpaper-all-day ·
  ④ lore-feels-personal (`RETROS/consolidation-2026-06.md`).
- **Harnesses:** `scripts/e2e/` (web/window), `launch-desktop-app` skill
  (desktop/wallpaper/lore), `scripts/smoke-glyph-coverage.mts` (tofu guard).
