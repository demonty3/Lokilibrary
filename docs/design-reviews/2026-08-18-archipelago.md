# Archipelago full-screen mockup — bars (frozen before the shots)

**Date:** 2026-08-18 · **Rung 3 of the full-screen-desk ladder** (recorded
2026-08-17; unblocked by scale/anchor + variable-widths, both eyeballs
PASSED). Related: IDEAS.md § Terminals of different sizes, layout-directions
round 1 direction 06 (Archipelago Desk — still open, no verdict).

## What this is

Not an engine slice. A **live-desk mockup**: the shipped engine (variable
heights [520, 780], variable widths [480, 1200], the undercroft dock)
arranged via the debug IPC into full-screen compositions on the real
1440×900 MacBook display, screenshotted whole (windows + the desktop
between them). Everything in the shots is honest composer output — nothing
hand-drawn. The question is whether the *full-screen desk* direction
survives contact with the eye, before any engine work (multi-seam edges,
resizable windows, desk-global sky) is spent on it.

## The two arrangements

**Shot 01 — the continent.** The display filled edge to edge with one
joined mass: an 800×780 aperture on the left; a 640×520 standard window
with its 640×260 undercroft docked beneath on the right (right column
780 tall, matching). 800 + 640 = 1440: the world block is 1440×780 with a
strait of bare desktop below.

**Shot 02 — the archipelago.** Two separated islands with desktop sea
between: a mainland island (640×520 + its undercroft) upper-left, and a
lone 480×520 outpost lower-right, tops deliberately unaligned, no join
anywhere between the islands.

## Bars (two-sided, frozen now)

**K1 — the continent reads as one world.** Shot 01 reads as ONE world seen
through a wall of differently-sized apertures: ground line continuous
across the aligned seam, the basement reads as beneath its parent, one
sky over the mass. **Kill:** it reads as a pile of application windows /
N separate wallpapers that happen to touch → the full-screen direction
fails at desk scale; the desk stays a row-of-windows product and the
ladder ends here (hall/storeys stays parked on its own precondition,
unaffected).

**K2 — apart reads as deliberate.** In shot 02 the outpost reads as an
island across a strait — part of the same world, deliberately apart — not
as a window someone forgot to close. **Kill:** apart reads as forgotten or
broken → island separation needs the apartness dialect (direction 06's
outpost treatment: double walls, dimmer sky, a beacon facing home) as its
own rung before any archipelago engine work; the continent form (K1) may
still stand on its own.

**Pre-registered observation (named before looking, judged by Harry with
the shots; it is NOT a softening route for K1/K2).** Shared-sky chains
are per-island by construction, so shot 02's two islands each host their
own ☼/☾ — two suns may be visible on one desk. If *that specific thing*
is what grates, it routes to a desk-global sky rung (an engine gap, the
shared-sky mechanism widened from chain-key to desk-key), and K2 is then
judged on the apart-read with the sky question set aside. If the outpost
read fails for any other reason, K2's kill fires as written.

## What a pass unblocks

The archipelago engine rungs, in whatever order the findings suggest:
desk-global sky, the apartness dialect, arrangement persistence for
mixed-size desks, and eventually the L-shape / multi-seam work (IDEAS
item 3) — each as its own specced slice. A kill on K1 ends the ladder;
a kill on K2 alone re-orders (dialect before archipelago).

## Evidence discipline

Shots land in `docs/design-reviews/2026-08-18-archipelago/` (01 continent,
02 archipelago), captured with macOS `screencapture` so the desktop
between windows is in frame. This file is committed before the app is
launched; the bars above do not move after the shots exist.
