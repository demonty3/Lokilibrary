# Murals on land (#16) — design

**Date:** 2026-08-01 · **Slice:** depth track item 2 (murals #16)
**Brief sources:** `docs/design-reviews/2026-07-13-visual-programme.md` #16 ·
Mural Anchor (KEPT, layout round 2, `2026-07-30-layout-directions.html` §05) ·
`VISION.md` § On fidelity · crust-legibility finding (STATE.md 2026-08-01).
**Ruled by Harry this session:** palette-quantise wins — the V0 spike's
full-RGB exemption (`src/render/ansiSpike.ts:6-8`) is RETIRED for the
terminal desk. Approach A (mural as first-class land roles) approved.

## Goal

Every terminal window carries a framed, palette-quantised mural of its
wing's flagship game, mid-sky — the window's recognisable face at
wallpaper distance. Steam CDN header art only (recognition rule);
re-rendered as `░▒▓█` density glyphs in the active theme's colours.
Key-free, zero AI calls, graceful offline.

## What ships

- **Outer frame 24×7** (interior 22×5), horizontally centred, sky row 2.
  Double box-drawing frame with a bottom-rail cartouche:
  `╚══╡ hades ╞══╝` (name lowercased, truncated to fit). Windows too
  small for it (cols < 32 or skyH < 9) compose no mural.
- **Flagship** = the composer's `surface[0]` game (the hall rule). If it
  has no appid, no mural is reserved at all (no empty frame).
- Picture cells arrive async from the CDN header; until then (and on
  load failure) the frame + cartouche stand alone — the name still
  identifies the wing.

## Architecture

### 1. Model side — `src/procedural/land.ts` (pure; stays deterministic)

- `LandGame` gains optional `appid?: number`. `SAMPLE_LAND` entries get
  appids from `SAMPLE_LIBRARY` (`celeste` has none — degrades).
- `composeLand` opts gain `mural?: boolean` (**default absent →
  byte-identical output to today**; only the terminal desk passes true).
- When enabled + flagship has appid + window fits: reserve the rect,
  emit frame + cartouche chars into `char`/`role` grids as new roles
  `muralFrame` (frame + cartouche, single colour) and `mural` (interior,
  blank chars — pixels are render-side). Sky decoration passes skip
  reserved cells mechanically. Pure arithmetic — **no new PRNG salt**.
- `LandModel` gains `mural?: { x; y; w; h; appid; name }`.

### 2. Quantise module — `src/render/muralCells.ts` (pure, no PIXI/network)

- `quantizeMural(rgba, srcW, srcH, cellsW, cellsH, targets) → cells`
  where `targets` is `[{key, rgb}]` and each cell is `{ch, key}`.
- Integer box-averaging (never canvas rescale — the spike's lesson);
  Rec.709 luminance → glyph over `[' ', '░', '▒', '▓', '█']` (darkest =
  space; the theme-bg backing shows through); chroma → nearest target
  palette key by RGB distance.
- **Quantise targets = the active theme's palette keys minus `bg`
  variants and `fgBright`** (the beings' reserved register — salience
  contract holds by construction).

### 3. Load + mount — `src/render/mural.ts` + `src/terminal/terminalLand.ts`

- `loadMuralPixels(appid)`: Image + `crossOrigin='anonymous'` + one
  full-res `getImageData` (the ansiSpike recipe; ansiSpike itself stays
  untouched for the V0 preview). **Session cache keyed by appid stores
  the raw pixel buffer** — joins/rebuilds and theme swaps re-quantise
  from cache, never refetch.
- Mount: one `BitmapText` per palette key used (≤ ~8 layers, not
  per-cell objects), positioned at the model's mural rect, added to the
  world after `buildLandContainer`; re-mounted on join recompose;
  dead-guard so a late resolve never touches a destroyed container
  (the `render/levels/land.ts:498` pattern).
- Reuse/extend the existing `LandMuralState` lifecycle
  (`idle/loading/ready/failed-cors/failed-load`) — per-terminal now.
- Backing rect fills from `theme.palette.bg` (the hard-coded `0x050505`
  debt does NOT propagate; light themes safe).

### 4. Roles + style-pack contract — `src/render/levels/land.ts`

- `LandRole` gains `'mural' | 'muralFrame'`; `ROLE_KEY`: `muralFrame:
  'fg'`, `mural: 'fgDim'` (nominal — interior colour is per-cell).
- Lock sets: `muralFrame` → glyph-locked, ramp-locked, omit-locked.
  `mural` → glyph-locked, ramp-locked (the quantise IS its ramp),
  **omit ALLOWED** (lossy-lens doctrine; a pack may delete the picture,
  never contradict it — DMG blank-sky precedent).
- Because interior colours resolve against the ACTIVE theme palette, a
  pack like gameboy-dmg automatically yields a 4-green mural.

### 5. Glyph provenance

`░▒▓█` and `╔═╗║╚╝` are in-atlas (noteBox precedent). Cartouche wants
`╡ ╞` — **verify against the Cozette atlas first**; if absent, fall
back to `┤ ├` (the drag-strip precedent). Whichever ships gets a
provenance entry in `smoke-glyph-coverage.mts`.

## Not in this slice

V0 preview migration (ansiSpike stays); palace-view murals;
per-pack mural styling; RenderTexture perf work; multiple murals per
window; any change to `regions.ts` wing labelling.

## Verification

Every bullet below maps to a plan task or an explicit "dropped because".

- [ ] `smoke-mural-cells.mts` — pure quantise: box-average maths on
  synthetic pixels; Rec.709 endpoints; darkest→space; nearest-key
  chroma mapping; **`fgBright` never emitted**; determinism (same input
  → same cells).
- [ ] `smoke-land-mural.mts` — compose: rect + frame + cartouche glyph
  runs and roles; truncation; skip when cols < 32 / skyH < 9 / no
  appid; sky decorations never inside the rect; determinism; **opts
  without `mural` → byte-identical `LandModel` to pre-slice** (lock
  with a stringify golden).
- [ ] `smoke-style-pack.mts` updated: two new roles in the runtime role
  list; lock-set membership asserted (`muralFrame` all three, `mural`
  omit-allowed only).
- [ ] `smoke-glyph-coverage.mts`: provenance entries for the cartouche
  pair (post atlas check).
- [ ] Existing land/salience smokes green: `smoke-land-atmosphere`,
  `smoke-land-bands`, `smoke-land-seam`, `smoke-salience`,
  `smoke-worn-paths`, `smoke-land-wear-persist`, `smoke-t2-marks`.
- [ ] e2e: `__terminal.state()` exposes `mural: {state, appid}`;
  deterministic frame assertion via state; screenshot via
  `scripts/e2e` drive.
- [ ] **On-screen eyeball (launch-desktop-app, `LOKILIBRARY_TERMINALS=2`):**
  two windows show two DIFFERENT murals (the identity read at
  wallpaper distance); theme hot-swap retints without refetch;
  gameboy-dmg pack shows the 4-green quantise; beings remain the
  brightest marks (salience read). Screenshot-and-look is a budgeted
  step (reviews-miss-visual-defects lesson).
- [ ] Offline / CDN-blocked run: frame + cartouche render, no spinner,
  no error surface, `failed-load` state readable via e2e hook.
- [ ] Both typecheck legs green.

## Gates

`npm run typecheck` + each named smoke individually + the on-screen
eyeball. Kill condition for the slice (frozen now, before pixels):
**if the quantised mural at wallpaper distance reads as noise rather
than "that's Hades" — iterate the quantise (glyph ramp, cell size,
target set), never the recognition rule (no generated art, no raw
RGB).**
