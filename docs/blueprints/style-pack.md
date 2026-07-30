# Style-pack blueprint — restyle the terminals desk with your own agent

This document is written for a coding agent (Claude Code or similar) working in a
fresh clone of this repo, directed by someone who wants the terminal-land desk to
look like *them*. Follow it end to end and you will produce a **style pack**: one
theme JSON that restyles the whole scene, validated by executable gates, accepted
by screenshot. No engine code changes are required or wanted.

A style pack has exactly three slots:

1. **Palette** (required): the 13 colour keys every renderer resolves through.
2. **Glyph dialect** (optional): per-land-role glyph overrides, e.g. foliage
   `♣` becomes `♠`, topsoil dither becomes `▚`.
3. **Fx flag** (optional): `"scanlines"` lays a static CRT line field over the
   terminal window.

Everything else in the world (layout, terrain, structures, beings' behaviour) is
procedural and deterministic. A pack recolours and re-voices the scene; it never
reshapes it. That split is the contract: **arrangement is the engine's, dialect
is yours.**

## 0 · Start from the person, not the palette

The point of a pack is personalisation. Before picking colours, extract a
direction from whatever the person gives you (listening history, subreddits,
favourite games, a photo of their desk):

- **One mood, not a mood board.** The scene renders one palette. "Synthwave
  sunset" is a pack; "synthwave but also cottagecore" is two packs.
- **Map moods to the register structure**, not to individual props: `bg`/`bgAlt`
  set the air, `fgDim`→`fg`→`fgBright` are the quiet-to-loud text ramp, and the
  six accents (`yellow orange red magenta violet blue cyan green`) are where the
  personality lives. Beings (the little walking letters) draw from `magenta`,
  `violet`, `orange`, `cyan` and `fgBright`, so those five carry the most
  character per pixel.
- **Glyphs are texture, not decoration.** Pick 2-5 role overrides that push the
  material feel (soil, stone, leaves, stars). More than that reads as noise.

## 1 · Slot schemas

Create one file: `src/themes/<pack-id>.json`. Kebab-case id, matching the
filename.

```jsonc
{
  "id": "<pack-id>",
  "name": "<Display Name>",
  "palette": {
    // ALL 13 keys, #rrggbb each. No extra keys, no missing keys.
    "bg": "…", "bgAlt": "…",
    "fgDim": "…", "fg": "…", "fgBright": "…",
    "yellow": "…", "orange": "…", "red": "…", "magenta": "…",
    "violet": "…", "blue": "…", "cyan": "…", "green": "…"
  },
  // OPTIONAL, slot 2: land-role → single glyph.
  "landGlyphs": { "<role>": "<one glyph>" },
  // OPTIONAL, slot 3: exactly "scanlines" or omit.
  "fx": "scanlines"
}
```

**Palette rules the gates enforce** (numbers are frozen; the smoke prints yours
with `--values`):

- Dark ground only: relative luminance of `bg` must be < 0.35. Light-paper
  themes are a known engine gap in v1; do not fight this bar.
- Register order: contrast-vs-bg must rank `fgBright` > `fg` > `fgDim`.
- Beings stay loud: each of `magenta`, `violet`, `orange`, `cyan`, `fgBright`
  needs ≥ 3.0:1 contrast against `bg` AND ≥ 0.85 × the strongest ground
  register (`fgDim`, `bgAlt`, the demoted lawn fills). The walking letters are
  the life of the scene; a pack that buries them is broken by definition, so
  this is a gate, not advice.

**Glyph dialect rules:**

- Keys must be real land roles. Overridable: `star starBright skyDither sun
  moon cloud ridge ridgeFar hall topsoil stone deep bedrock cavern shelf roof
  monument cottage foliage relic shaft`.
- A role can be emitted in more than one place: `sun` draws the sky sun AND
  the beacon glyphs on structure crowns, so your sun glyph appears two or
  three times in the scene. Pick one that survives both readings.
- **Locked, never overridable** (live machinery owns their glyphs): `label`
  (game names), `being`, `player`, `crust` (the wear system re-texts it),
  `edge`. `sky` is background and never drawn, so overriding it does nothing.
- Each value is exactly ONE visible glyph, and its codepoint must exist in the
  shipped Cozette font. Safe hunting grounds: ASCII, box drawing (U+2500…),
  block elements (`░▒▓█▀▄▔`), quadrants (`▖▗▘▝▚▞▙▛▜▟`), card suits (`♠♣♥♦`),
  geometric shapes (`■□▪▫`), arrows, braille. The conformance smoke names any
  glyph the font lacks; trust it, not your assumption.

**Fx rules:** `"scanlines"` is the entire v1 whitelist. Anything else fails the
gate. Do not implement new fx in a pack; that is an engine change.

There is also an advanced `roles` slot (per-theme remapping of semantic roles
like `being.loki` to different palette KEYS, see `src/themes/roles.ts`). The
defaults are usually right; only touch it if a specific being's colour fights
your palette, and only with palette keys as values.

## 2 · Registration (4 mechanical touch points)

All in `src/themes/index.ts`, mirroring the existing themes exactly:

1. `import myPack from './<pack-id>.json';`
2. Add `'<pack-id>': myPack as Theme,` to the `THEMES` object.
3. Add `'<pack-id>',` to the `THEME_IDS` tuple.
4. Nothing else. Do not change `DEFAULT_THEME_ID`; packs are opted into via
   `?theme=`, they never replace the default.

A drift smoke asserts `THEME_IDS` matches `Object.keys(THEMES)`; miss touch
point 2 or 3 and the gates below catch it.

## 3 · The gates (all must be green, in this order)

```bash
npm run typecheck
npx tsx scripts/smoke-style-pack.mts <pack-id>     # the pack conformance smoke
npx tsx scripts/smoke-5d-lore-profile.mts          # theme-registry drift guard
npx tsx scripts/smoke-glyph-coverage.mts           # whole-app tofu guard
```

`smoke-style-pack` is your authoring loop: it checks registration, palette
shape, the contrast bars, glyph validity and font coverage, and prints the
measured numbers with `--values` so you can tune instead of guess. A pack that
fails any gate is not done; fix the pack, not the gate. The gate scripts and
the bars inside them are off-limits to packs by definition.

## 4 · Screenshot acceptance loop

Green gates prove conformance, not taste. Now look at it:

```bash
# Fresh clone: npm install first. run.sh builds (~60 s) then stays attached
# to the Chrome it launched, so run it in the BACKGROUND and poll readiness:
bash scripts/e2e/run.sh &
until curl -s -o /dev/null http://localhost:9334/json/version && \
      curl -s -o /dev/null http://localhost:4173/; do sleep 2; done
export LOKI_E2E_PATH='?terminal=t1&wing=d0&theme=<pack-id>'
node scripts/e2e/drive.mjs shot /tmp/pack.png
```

Also take the stock reference once, for a side-by-side:

```bash
LOKI_E2E_PATH='?terminal=t1&wing=d0' node scripts/e2e/drive.mjs shot /tmp/stock.png
```

**Read the PNGs and check, honestly:**

- No blank rectangles or missing glyphs anywhere (tofu).
- The walking letter-beings are the first thing your eye finds on the surface.
  If you have to hunt for them, raise their accent keys and reshoot.
- The crust line (surface) reads as one continuous ground; strata below it
  (topsoil / stone / bedrock) still read as distinct bands.
- The sky reads intentional: stars densest at the top, one moon, clouds.
- One coherent palette. If a region looks like it belongs to a different pack,
  it does; fix the offending key.
- With `fx: scanlines`: the lines are present but legibility survives. (They
  are subtle by design, roughly a 16% dim every third row; confirm with a
  pixel probe if unsure, not by squinting.)

**Iterate:** edit the JSON, then re-run `bash scripts/e2e/run.sh` (theme JSONs
are bundled at build time; a `--no-build` rerun will NOT pick up your edit),
then reshoot. Beings walk on their own schedule; if none are on screen, wait
ten seconds and reshoot before concluding anything.

For a live interactive look instead of headless: `npm run dev`, then open
`http://localhost:5183/?terminal=t1&wing=d0&theme=<pack-id>`.

## 5 · Worked example

This exact pack passes every gate and has been verified on screen (palette
re-tint, `♠` foliage, `▚`/`▞` strata, pixel-verified scanlines). Use it as the
shape to copy, not the style to copy:

```json
{
  "id": "amber-crt",
  "name": "Amber CRT",
  "palette": {
    "bg":        "#140a00",
    "bgAlt":     "#241400",
    "fgDim":     "#7a4a00",
    "fg":        "#c47a00",
    "fgBright":  "#ffb000",
    "yellow":    "#ffcc33",
    "orange":    "#ff9500",
    "red":       "#d95f00",
    "magenta":   "#ffa64d",
    "violet":    "#cc8800",
    "blue":      "#b37400",
    "cyan":      "#ffd280",
    "green":     "#e0a000"
  },
  "landGlyphs": {
    "topsoil": "▚",
    "stone": "▞",
    "foliage": "♠"
  },
  "fx": "scanlines"
}
```

Why it works: the whole 13-key ramp is one amber family (one mood), the five
being keys sit at the bright end of it (10:1 to 14:1 contrast, beings stay
loud), the three glyph swaps push "phosphor terminal" without touching any
locked role, and scanlines seal the CRT read.

## 6 · Hard rails (from the repo's CLAUDE.md, restated so you cannot miss them)

- **Touch only** `src/themes/<pack-id>.json` and the two registration lines in
  `src/themes/index.ts`. A style pack that edits the renderer, the smokes, or
  anything in `src/procedural/` is not a style pack.
- **Never** add `Math.random()` (or any RNG) anywhere; packs are static data.
- **Never** invent new palette keys, new fx values, new roles, or multi-glyph
  values. The whitelists are the product's taste rails; widening them is an
  engine decision, not a pack decision.
- One palette per scene. No per-game or per-region colour exceptions.
- Known v1 limits, documented not fixable-by-you: light backgrounds are
  unsupported (dark-ground bar), and the Ghost being only appears on the
  themes in its own allow-list, so it will not visit your pack. Both are fine.

## 7 · Definition of done

- [ ] `src/themes/<pack-id>.json` exists; registration touch points done.
- [ ] All four gate commands green, run fresh, output shown.
- [ ] Pack screenshot + stock screenshot taken; the checklist in § 4 honestly
      passes on the pack screenshot.
- [ ] You can say in two sentences whose pack this is and why it looks like
      them.
