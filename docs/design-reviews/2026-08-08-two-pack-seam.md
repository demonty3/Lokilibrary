---
up: "[[Lokilibrary]]"
---

# Two-pack seam spike — can joined terminals wear different packs?

**Ran 2026-08-08. Bars frozen before looking, in the approved plan.** No
engine work: a throwaway per-wing pack map in `TerminalApp.tsx`, reverted after.

## Why it had to run before T3

T3's identity half threads a pack per terminal. That is the only thing standing
between ten authored packs and the product — `TerminalApp.tsx:16` hard-codes
`phosphor` for every window and the spawn URL never passes a theme, so every
terminal on the desk looks identical. But it collides head-on with a standing
rule in CLAUDE.md:

> One theme palette per scene template. Mixing palettes in a single scene reads
> as broken, not artistic.

A joined desk is arguably one scene. `IDEAS.md` § Per-terminal identity and the
PRD's own T3 bullet say the opposite ("the seam is the boundary … a portal
between genuinely different places"). That tension had never been looked at,
and building the config/spawn-URL plumbing first would have meant discovering
the answer after paying for it.

## Bars, frozen before the first capture

- **CONFIRM** — the seam reads as a boundary between two places you could walk
  across: terrain continuous, colour changing like a different machine showing
  the same hour.
- **KILL** — it reads as a rendering fault, one window having failed to load
  its palette. Then per-terminal packs is a dev affordance only, T3 collapses
  to the status row + edge parting, and the ten packs stay an authoring system
  rather than a product surface.

## Result — CONFIRMED, with one constraint the spike found

Four pairings, all `phosphor` on the left (the pack the desk boots), joined,
same wall-clock hour, captured window-composited by CGWindowID:

| Right-hand pack | Sky luminance ratio | Omits sky roles? | Read |
|---|---|---|---|
| `amber-crt` | 1.2× | no | fine — two machines, one world |
| `catppuccin-mocha` | 4.7× | no | fine — a visible tonal step, both read as night |
| `gruvbox-dark` | **7.1×** | no | **fine** |
| `gameboy-dmg` | 9.9× | **yes — 11 roles** | **broken** |

**The kill fired on exactly one pairing, and brightness is not what fired it.**
`gruvbox-dark` at 7.1× reads fine while `gameboy-dmg` at 9.9× does not — a
small difference in ratio, a large difference in readability. The variable that
actually moved is `landOmit`: DMG deletes `star`, `starBright`, `skyDither`,
`cloud`, `ridgeFar`, `moon`, `sun`, `lamp` and three more. So at the seam one
side has a starfield and a moon and the other has an empty field, **at the same
instant, in one continuous visual space.**

`gruvbox-dark` was run specifically to separate the two variables, and the
prediction was recorded before the capture: brighter than the pairing that
passed, nearly as bright as the one that failed, but with full sky content. It
passed. Brightness is not the discriminator; **shared content is.**

### The doctrine this refines

`IDEAS.md` § Shared rules across terminals says a pack "may compress or omit a
shared truth but may never contradict it", and DMG's blank sky is named there
as legal. That holds for a pack seen **alone**. This spike shows the rule needs
a seam clause:

> **At a join, omitting a shared truth IS contradicting it.** Both halves are
> visible in one field at one moment, so "there are stars" and "there are no
> stars" are asserted about the same sky simultaneously. A lossy lens is legal;
> two lenses disagreeing about what exists is the break the doctrine was
> written to prevent.

### What held, and was measured rather than judged

- **Terrain is continuous across a two-pack seam.** `t1` column 52 has its
  crust at row 16; `t2` column 0 has its crust at row 16 — an exact match, each
  window computing `landSeamBoundary` independently with no broker. The land is
  one land regardless of palette.
- Joins, knits and crossings are palette-blind: `edges.right: true`,
  `knits.fired 1`, `glowStale 0`, and beings visible in `neighbours.right`
  across the differently-packed boundary.

## Consequence for T3

**PURSUE.** The identity half is viable and the ten packs can reach the
product. One design change, made by the spike before any code was written: the
plan proposed assigning packs by `fnv1a` over wing id, a free hash. That is now
wrong — **adjacent packs must agree on which sky roles exist.** The assignment
needs to be omission-aware, and that is a gate-expressible rule (the style-pack
smoke already knows every pack's `landOmit`), not a matter of taste.

Cheapest sound version: partition packs into omission classes and assign within
a class, or simply exclude sky-omitting packs from multi-window desks and let
them be chosen explicitly for a solo terminal. Not decided here.

**Still Harry's call**: the four shots are the evidence, and where exactly the
line sits between "a visible tonal step" and "broken" is a taste judgement he
should make on the running desk, not from stills. Shots:
`spike-two-pack.png` (amber, 1.2×), `spike-mid-seam.png` (catppuccin, 4.7×),
`spike-gruvbox-seam.png` (gruvbox, 7.1×), `spike-dmg-seam.png` (DMG, 9.9×).
