# LibraryWorld — Parked ideas

A place for template directions and creative concepts that aren't on the v0.1–v1.0 roadmap but are worth not forgetting. Anything here is a candidate, not a commitment.

---

## Terminal Terraria (B&W)

*Captured 2026-05-12.*

**Pitch.** A minimalist 2D side-scrolling alternative to the painted-3D templates. The world is viewed from the side like Terraria, but rendered as if you're looking through an old terminal — monospaced typography, ASCII-adjacent block geometry, pure black and white (or an amber-on-black phosphor variant). Game-objects are stacks of glyphs; rituals are fade-to-block or scroll-text transitions.

**Visual references.**

- Terraria's side-on viewport and procedural building
- ASCII roguelikes — Dwarf Fortress, Cogmind, Caves of Qud
- Late 1970s / early 1980s phosphor terminal aesthetic — green-on-black or amber-on-black
- The credits sequence of *Inscryption* — Kaycee's Mod ASCII layer

**Why it might land.**

- Wildly different from the painted-3D templates. Variety in available templates *is* variety in personalisation — a user whose library leans roguelike / strategy / sim / Dwarf-Fortress-adjacent gets a world that feels native to that taste, not a forced cosy seaside town.
- The "your library as ASCII art" framing has its own evocative pull. Hardcore PC players have an aesthetic affection for terminal output that no 3D scene reaches.
- Cheap to ship. No AI 3D assets, no PBR textures, no lighting rig. A small library of monospaced glyph-objects and a side-scrolling camera. Realistically a long weekend once the rest of the infrastructure is built.

**What it would require.**

- A second renderer track. Probably the Phaser scaffold we preserved in `legacy-2d/` — that work isn't entirely sunk cost; it's the right starting point for this idea if we ever pick it up. Or raw Canvas2D / WebGL for the phosphor shader.
- A monospaced font choice (Berkeley Mono, IBM Plex Mono, or a CRT-revival font like Departure Mono) and a small ASCII-glyph library per archetype:
  - `lighthouse` = stacked rectangles with a flickering `@` at the top
  - `ship` = three vertical lines + a triangle sail
  - `arcade cabinet` = `[░░░]` over `▓▓▓`
  - `case file` = `■` that opens into rows of `─` lines
  - `campfire` = `*` that ASCII-flickers between `*`, `+`, `×`
- A phosphor / CRT shader pass. Optional but a huge visual win for cheap — scanlines, slight chromatic aberration, soft glow on bright pixels. WebGL fragment shader, ~50 lines.
- Rituals in monochrome — fade the screen to all `█`, scroll-text upward, screen flickers and the game launches.

**Status.** Captured idea; not on the v0.1–v1.0 roadmap. Could become an alt template at v0.5+ once the painted-3D templates have proven the loop. If the painted-3D approach struggles to land, this becomes a serious *fallback* because it's so much cheaper to build to "looks intentional" in monochrome ASCII — there's no "asset flip" risk when every object is hand-authored glyphs.

**Open questions for when we revisit.**

- Does the 3D-walking premise transfer to a 2D side-scroll? Maybe the affordance changes — instead of walking up and pressing E, you might step into the glyph and the world transitions on contact. Different feel; possibly better for the monochrome aesthetic.
- Does this even need an LLM-picked metaphor, or is the aesthetic itself the metaphor? Possibly the Claude call here just picks per-game glyph art rather than a whole organising metaphor.

---

*Add new parked ideas below as separate `##` sections, dated.*
