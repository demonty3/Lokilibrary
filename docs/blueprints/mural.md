# Mural blueprint — paint a wing's mural with your own agent

This document is written for a coding agent (Claude Code or similar) working in
a fresh clone of this repo, directed by someone who wants their palace's wing
murals painted about *their* library. Follow it end to end and you will produce
**authored murals**: frozen glyph-grid JSONs, one per wing, validated by
executable gates, accepted by screenshot. No engine code changes are required
or wanted — authoring happens in your session at build time; the mural lands as
a static asset the deterministic engine mounts.

A mural is a 22×5 picture drawn in terminal glyphs, hung in the sky of a wing's
terminal-land window inside a box-drawing frame. The engine draws the frame and
a name cartouche (`╡ stardew ╞`) below it — **the cartouche carries the game's
name, so the mural itself is a picture, never a caption.** Every blank cell
shows the sky-tinted backing through, and that backing follows the world clock,
so a mural with breathing room sits *in* the hour rather than on top of it.

## 0 · Start from the library, not the picture

Each wing has a **flagship** — the first non-abandoned game in the wing's
slate — and the mural is about that game. Before drawing anything, choose one
of the two content briefs, per wing, from what the library data says:

1. **"The game's world"** — an interpretive scene *of the game's world*, in
   this repo's terminal dialect. Not box art, not a logo: the place itself,
   as a small landscape or interior.
2. **"You and the game"** — memory-palace art of the *player's relationship*
   with the game: the hours, the era, the backlog, the one they finished, the
   city they bought and never entered.

**The choice rule:** read the flagship's engagement data (in the sample
library that is its `state`; a real library adds hours, recency, genre).
When the data shows a marked personal arc — `mastered`, `dusty`, a return
after years, an outlier hour count — the relationship *is* the story: choose
brief 2. When the relationship is ordinary presence — `recent`, `loved` and
simply being played — the game's world is the stronger picture: choose
brief 1. You must decide per wing and record the decision: every mural
carries a one-line `why` stating which brief you chose and what in the data
drove it. That line is on the record; it is not rendered in-world.

The current sample-library wings and their flagships:

| wing | flagship | state | mural |
|---|---|---|---|
| d0 | stardew | recent | shipped (seed corpus) |
| d1 | civ | dusty | open |
| d2 | disco | dusty | shipped (seed corpus) |
| d3 | hades | loved | shipped (seed corpus) |
| d4 | spire | recent | open |
| d5 | hollow | mastered | shipped (seed corpus) |

One mural per wing. Authoring for a wing that already carries one is legal
and means **replacing** it: swap that wing's import and registry row in
`src/murals/index.ts` for yours. In your own palace, replacing the seed
corpus is the point.

## 1 · The surface (what the engine draws for you)

- Interior: exactly **22 columns × 5 rows** (`MURAL_INTERIOR_W/H` in
  `src/procedural/land.ts`). The frame, the cartouche, the centring in the
  window, and the eviction of sky decorations under the rect are all the
  composer's job — you author only the interior grid.
- The rect only composes on wings whose registry has an authored mural
  (`composeOpts` in `src/terminal/terminalLand.ts`); every other wing keeps
  its unbroken sky. Register your mural and the wall appears; there is
  nothing else to switch on.
- Blank cells are load-bearing: the backing behind the grid is tinted to the
  current sky, so what you *don't* draw is where the hour shows through. A
  solid slab of ink reads as a poster taped over the world.

## 2 · File format + registration

Create one file per wing: `src/murals/<wing>.json`.

```jsonc
{
  "wing": "d1",                    // a desk wing id (see the table above)
  "brief": "relationship",         // "world" | "relationship"
  "why": "one line: which brief and what in the data drove it",
  "rows": [                        // 5 strings, each EXACTLY 22 glyphs
    "                      ",
    …
  ],
  "ink": [                         // 5 strings, aligned 1:1 with rows
    "......................",
    …
  ]
}
```

- **`rows`** hold the glyphs. A space is a blank cell. Count in codepoints:
  every glyph must be a single codepoint that exists in the shipped Cozette
  font. Safe hunting grounds: ASCII punctuation, box drawing (U+2500…),
  block elements (`░▒▓█▀▄▁▂`), quadrants (`▖▗▘▝▚▞▙▛▜▟▌▐`), geometric shapes
  (`■□▪▫◦`), card suits (`♠♣♥♦`), stars and dots (`✦·☼`). The conformance
  smoke names any glyph the font lacks; trust it, not your assumption.
- **`ink`** holds one colour code per cell, aligned both ways with `rows`:
  `.` exactly where the glyph is a space, a legend letter exactly where it
  is not. The legend (`MURAL_INK_LEGEND` in `src/murals/index.ts`):

  | letter | palette key | letter | palette key |
  |---|---|---|---|
  | `d` | fgDim | `m` | magenta |
  | `f` | fg | `v` | violet |
  | `y` | yellow | `b` | blue |
  | `o` | orange | `c` | cyan |
  | `r` | red | `g` | green |

  Keys, never hex: the same mural is legal under every style pack by
  construction, and re-themes with the desk. `bg`, `bgAlt` and `fgBright`
  are absent from the legend **by design** — the backing owns the
  background, and `fgBright` is the walking beings' reserved salience
  register. A mural cannot even spell those keys; do not try to widen the
  legend.

**Registration** (2 mechanical touch points, in `src/murals/index.ts`,
mirroring the existing rows exactly):

1. `import d1 from './d1.json';`
2. Add `d1 as AuthoredMural,` to the `AUTHORED_MURALS` array (replacing the
   old row if the wing already had one).

## 3 · The gates (all must be green, in this order)

```bash
npm run typecheck
npx tsx scripts/smoke-mural-blueprint.mts <wing>   # your authoring loop
npx tsx scripts/smoke-mural-blueprint.mts          # the full registry
npx tsx scripts/smoke-glyph-coverage.mts           # whole-app tofu guard
```

`smoke-mural-blueprint` is the contract: grid shape and rows/ink alignment,
legend legality, Cozette coverage, wing wiring, and the two taste budgets —
**density** (drawn fraction of the 110 cells: floor 0.25, below which the rect
reads as a failed load; ceiling 0.92, above which the slab buries the sky
backing) and **letter-noise** (letterform glyphs `[A-Za-z0-9]` at most 0.15 of
drawn cells — murals are pictures; the cartouche already carries the name).
Add `--values` to print your measured numbers so you can tune instead of
guess. A mural that fails any gate is not done; fix the mural, not the gate —
the gate scripts and the bars inside them are off-limits to authors by
definition.

## 4 · Screenshot acceptance loop

Green gates prove conformance, not taste. Now look at it:

```bash
# Fresh clone: npm install first. run.sh builds (~60 s) then stays attached
# to the Chrome it launched, so run it in the BACKGROUND and poll readiness:
bash scripts/e2e/run.sh &
until curl -s -o /dev/null http://localhost:9334/json/version && \
      curl -s -o /dev/null http://localhost:4173/; do sleep 2; done
LOKI_E2E_PATH='?terminal=t1&wing=<wing>' node scripts/e2e/drive.mjs shot /tmp/mural.png
```

**Read the PNG and check, honestly:**

- The framed rect is present in the sky with the flagship's name in the
  cartouche, and the interior is your grid — no blank rectangle, no tofu.
- It reads as a *picture* at a glance from arm's length: a scene or a shape,
  not a texture and not text.
- The sky shows through your blank cells; the mural belongs to the same
  night (or day) as the rest of the window.
- Your brightest accents (the lit window, the sun, the one marked cell) are
  where the eye lands first *inside the frame* — but the walking beings on
  the surface still out-shine the mural. If the mural is the loudest thing
  in the window, thin it.
- Rows/ink misalignment shows up here as orphan colour or silent holes; if
  something looks off-by-one, it is — recount in codepoints.

**Iterate:** edit the JSON, re-run `bash scripts/e2e/run.sh` (murals are
bundled at build time; a `--no-build` rerun will NOT pick up your edit),
reshoot.

## 5 · Worked example

This exact mural passes every gate and has been verified on screen
(2026-08-23: frame + cartouche mounted on wing d0, backing sky-tinted, no
tofu). It ships as the seed corpus's `d0`:

```json
{
  "wing": "d0",
  "brief": "world",
  "why": "stardew is this wing's flagship and merely recent, no marked personal arc in the data, so the mural paints the valley itself: sun up, lit window, field rows.",
  "rows": [
    "   ☼                  ",
    "  ♣♣♣         ▄▟█▙▄   ",
    "   █          ▐█□█▌   ",
    " ▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚ ",
    " ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ "
  ],
  "ink": [
    "...y..................",
    "..ggg.........ooooo...",
    "...d..........ffyff...",
    ".gggggggggggggggggggg.",
    ".dddddddddddddddddddd."
  ]
}
```

Why it works: one scene, three masses (tree, farmhouse, field), read
left-to-right; the two brightest cells (`y`) are the sun and the lit window,
so the picture has exactly one story beat; the field rows use a quadrant
dither (`▚`) as *material*, not noise; and 50% of the rect is sky, so the
valley sits in the desk's hour. Density 0.500, letters 0.000.

**The example donates its shape, never its content.** Do not reuse this
scene, its composition, its subject, or its `why` phrasing for another wing —
an example's values leak into output unless you decide otherwise, and here
they must not: your mural is about *your* wing's flagship and *your*
library's data. If your first draft looks like a farmhouse and a tree, start
again from the brief.

## 6 · Hard rails (from the repo's CLAUDE.md, restated so you cannot miss them)

- **Touch only** `src/murals/<wing>.json` files and the registry rows in
  `src/murals/index.ts`. A mural that edits the renderer, the composer, the
  legend, the smokes, or anything in `src/procedural/` is not a mural.
- **Never** widen `MURAL_INK_LEGEND`, and never reach for `bg`/`bgAlt`/
  `fgBright`. The legend is the taste rail; widening it is an engine
  decision, not an authoring decision.
- **Never** add randomness anywhere; murals are static data.
- Murals are frozen assets: no runtime generation, no fetching art, no new
  AI call sites. Authoring is your session, at build time, once.
- Murals are **original compositions**: never reproduce distinctive
  protected artwork — no characters, no logos, no traced or copied game
  art. An abstract scene *about* the game is the medium (CLAUDE.md,
  amended 2026-08-23). Do not open a PR that adds your murals upstream —
  shipped repo art is maintainer-curated, and your murals are about *your*
  library. The Steam CDN header art remains the recognition anchor
  wherever it appears; a mural reinterprets, it never replaces that
  surface.
- One mural per wing, both briefs available, the choice yours — but the
  `why` line is mandatory and must be honest to the data.

## 7 · Definition of done

- [ ] One `src/murals/<wing>.json` per authored wing; registry rows done.
- [ ] All four gate commands green, run fresh, output shown.
- [ ] Per wing: screenshot taken and the § 4 checklist honestly passes.
- [ ] Per mural: the `why` line names the brief and the data behind it.
- [ ] You can say in two sentences whose murals these are and why they look
      like that person's library.
