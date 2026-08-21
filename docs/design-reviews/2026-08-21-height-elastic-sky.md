# Height-elastic sky — does a taller aperture buy a richer world?

**2026-08-21.** Opened from Harry's question — "are the glyphs we are using too
big to have detail?" — and from the three artifacts published 2026-08-20
(`The Row Budget`, `Thirteen Glyphs`, `Hue in the Dark`).

This is a **new document re-asking a settled question under a changed
condition**, per the standing rule that a settled question is never re-opened by
re-judging the same probe. The bars below inherit
`2026-08-17-cell-density.md` §3 **verbatim**; nothing is softened.

## 1 · What changed since the 08-17 verdict

Three things, all measured this session, none of them available on 08-17:

1. **The Row Budget artifact measured the wrong scene.** It quoted the desk as
   "200×55 cells". That is `V0_SCENE` (`src/render/levels/land.ts:28`), the old
   prototype preview land. The shipped desk window is `DESK_SURFACE` = **53×20 =
   1,060 cells**, measured live at `innerWidth 640 / innerHeight 520`.

2. **Render cost does not bind — the artifact's own frozen kill does not fire.**
   The artifact froze: *"if frame time on the wallpaper path degrades past the
   throttle budget… the rung dies"*, and called it "the first thing to test".
   Measured live on the desk (`scripts/e2e/frameprobe.mjs`, `cpuprobe.mjs`;
   rAF deltas over 240 frames + `Performance.TaskDuration` over 8 s wall):

   | window | cells | mean frame | CPU/wall |
   |---|---|---|---|
   | standard 640×520, scale 2 | 53×20 = 1,060 | 16.67 ms | 4.5 % |
   | full-screen 1440×811, scale 2 | 120×31 = 3,720 | 16.67 ms | 4.7 % |
   | full-screen 1440×811, **scale 1** | 240×62 = 14,880 | 16.67 ms | 3.8 % |

   Fourteen times the cells, vsync still locked, CPU flat. Cell count is
   effectively free in this renderer; cost lives in the per-frame animation set,
   not in static cell geometry. **The perf kill is dead.** It stays dead only
   for *static* cells — a future slice that animates per-cell would re-arm it.

3. **The display is smaller than the artifact assumed.** Harry's machine reports
   a logical work area of **1440×811** (2560×1600 physical, dpr 2). So a
   full-screen desk at today's glyph size is 3,720 cells — **less than a third**
   of the artifact's "today's grid" demo panel (222×55 = 12,210). That density
   is only reachable here at scale 1 (14,880). This is the fact that makes the
   question worth re-asking rather than settled: on 08-17 scale 1 was judged in
   a **640×520 window**; it has never been judged full-screen.

## 2 · The gap the probe tests

`DESK_SURFACE` is frozen at 20 rows and extra window height only extends
*downward* (`composeLandExtension`, scale/anchor slice). So the full-screen
window measured above composes **20 rows of world and 11 rows of bare aperture
rock**. IDEAS.md § "Terminals of different sizes" item 2 promised "more sky
above *and* more underground below"; only the underground half shipped, and no
doc records the sky half as decided, deferred or killed.

## 3 · Kill conditions — frozen 2026-08-21, before the probe was generated or viewed

**K1 (glance value, the moat) — inherited verbatim from `2026-08-17-cell-density.md` §3:**

> at wallpaper distance, if the scale-1 world's beings and site labels stop
> being findable/readable — if you have to lean in to find the life — fidelity
> has beaten the product and the global scale stays 2. Fidelity then routes to
> MIXED REGISTERS only (fine-lattice surfaces inside the coarse world: the mural
> rect, far tapestry layers), not a world rework.

**K2 (the letter-noise failure at world scale) — inherited verbatim:**

> if the finer grid reads as noise or fabric-in-general rather than as a *more
> detailed place* — the "unreadable ae's" finding recurring globally — same
> routing as K1.

**K3 (the stretched-sky failure — new, and the real risk for panel B):**
`starDensity` and `skyDitherDensity` are already `skyH`-relative, so a taller
sky *stretches the existing ramp* rather than adding structure. If panel B's tall
sky reads as **emptier** — a bigger void, not more world — the height-elastic
rung dies, and the finding is that sky detail needs a new density vocabulary,
not more rows.

**K4 (busy, not detailed) — inherited from The Row Budget's frozen kill:**
if a taller world reads as busy rather than detailed at glance distance, 20 rows
was the right answer for a wallpaper after all.

**Pass** = the read that passed for the undercroft and for the tall-window
aperture: *more of the same world*, still glanceable. A pass on B alone unblocks
the height-elastic engine slice. A pass on C alone re-opens the scale dial and
gets its own spec — it does **not** ship on this document, and it inherits
08-17's frozen condition that a pass requires every salience bar re-measured at
the new denominator and sub-cell animation re-dialled.

## 4 · The probe

`2026-08-21-height-elastic-sky.html`. Wing d0, phosphor, one seed, composed by
the **real composer** (`composeLand`) with the **real render rules**
(`landRoleGlyph`, `strataMaterialGlyph`, `landRoleFill`) — no hand-drawing, per
`brain/learnings/generate-the-mockup-from-the-real-system.md`. Three panels at
identical on-screen size (1440×811, the measured work area):

- **A · today, full-screen** — 120×31 at 12×26 px. 20 rows of world, 11 rows of
  bare aperture rock. The honest status quo.
- **B · height-elastic sky** — 120×31 at 12×26 px, all 31 rows composed as
  world at today's band proportions (sky 55 %, band 20 %): `skyH 17, band 6,
  underH 7`. Same glyph size as A. This is the rung.
- **C · full-screen at scale 1** — 240×62 at 6×13 px, same proportions
  (`skyH 34, band 12, underH 15`), 14,880 cells. The density ceiling, and the
  08-17 question re-asked full-screen.

Panels B and C pass `skyH` straight to `composeLand`. That is a probe
convenience, not the shipping mechanism: the real slice must extend sky on a
per-global-row salted stream (the `composeLandExtension` precedent), because
passing a larger `skyH` moves every golden.

Judge at wallpaper distance. Verdict recorded below, dated.

---

## Verdict — pending Harry's eyeball
