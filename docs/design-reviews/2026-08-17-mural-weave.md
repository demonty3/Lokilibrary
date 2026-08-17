# Mural weave — re-rendering the recognition surface in the world's own glyphs

**2026-08-17.** Probe opened from Harry's read of the cross-stitch reference
("how it gets across an image using those glyphs") the same day the stitch
family merged. New question, new document; the records it sits on:

## 1 · The standing record (verbatim, sources named)

**The mural is currently CUT from the desk** — anatomy pass, 2026-08-08
(TODO-USER.md):

> The mural is cut (one word, reversible; the sky is whole again and the ☾
> is up in both windows)

**The palette ruling** — Murals #16, 2026-08-01 (STATE.md): murals are
*palette-quantised*; "Harry's ruling on the palette-quantise question:
full-RGB exemption RETIRED."

**The recognition rule** — CLAUDE.md:

> **Per-game art = Steam CDN, recognition surface only.** [...] This
> triggers the "oh I own that" beat; substituting generated art for it
> weakens that beat.

Scope note: a glyph weave does not substitute other art for the CDN header —
it re-renders the same source, the palette-quantise ruling taken one step
further into the medium. What it risks is not the rule but the beat itself:
every step away from the literal header trades recognition for coherence,
and the mural interior is only **22×5 cells** (`MURAL_INTERIOR_W/H`,
`src/procedural/land.ts:231`). That tiny canvas is what this probe tests.

## 2 · The question

Can a flagship game's Steam header, re-woven as a Cozette glyph mosaic at
22×5 cells and locked to the window's 13-key pack palette, stay
**recognisable** — while finally reading as *part of the glyph world* rather
than a photo pasted onto it (the read that got the mural cut)?

## 3 · Kill conditions — frozen 2026-08-17, before any weave was generated or viewed

> **K1 (recognition, the mural's job):** if Harry — who owns these games —
> cannot name the game from the woven mural at desk scale, the weave fails
> as a mural. Fallback scope on a K1 fail: non-game tapestry panels (woven
> world-content with no recognition duty), a separate idea, not this one.

> **K2 (in-medium, the reason the mural was cut):** if the weave still
> reads as a pasted photograph rather than as woven world content, the
> re-render buys nothing and the cut stands.

> **K3 (palette):** any colour outside the pack's 13 keys is a defect —
> the 2026-08-01 quantise ruling inherited verbatim.

Bars do not soften after viewing; authoring artefacts (bad resize, wrong
frame, mojibake) route to fix-the-probe-and-look-again.

## 4 · The probe

`2026-08-17-mural-weave.html`: three headers Harry recognises instantly
(Hades, Stardew Valley, Hollow Knight — the sample library's own appids,
fetched from the Steam CDN at probe-build time, never committed), each
woven at exactly 22×5 cells by sub-cell glyph matching (space/shade/block/
half/quadrant masks; per cell the best (glyph, fg, bg) pair from the pack
palette), framed with the mural's cartouche, sat in a sky snippet — in
**phosphor** (the boot pack) and **aegean-stitch** (the stitch family's
own). The real header thumbnail sits beside each for the recognition
comparison. Judged at desk scale (26px Cozette = WORLD_SCALE 2). Verdict
recorded below, dated.

---

## Verdict — 2026-08-17, Harry's eyeball (same day): MUTATE → cell density

Harry, verbatim: "I was more thinking of a more foundational cell rework,
like seeing if we can get better results on fidelity with this art
technique. I wasn't such a fan of the mural design before because i
couldn't tell what it was before, the first diagnostic only is clearly the
best the one on the left."

Read against §3: **K1 at 22×5 is not passed** — consistent with the exact
complaint that got the original mural cut ("couldn't tell what it was").
**Mosaic beats cloth** — the named best is the mosaic diagnostic. The
44×10 mosaic being "clearly the best" routes the finding to **cell
density, not technique**: the binding variable is cells available, and the
mural question folds into the foundational one. The probe mutates into
`2026-08-17-cell-density.md`; the mural's return waits on that question's
answer (at a finer world cell, the same mural rect quadruples its cell
count on its own).
