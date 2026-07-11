# PRD — Snapping terminals: joined worlds across OS windows

**Status:** Proposed 2026-06-11. Supersedes `PRD-composable-panes.md`
(same-day): Harry clarified the vision is not panes inside one window but
**separate terminal app windows on the desktop that snap together to join
their worlds**. T0 is the validation spike; later slices gate on Harry's
checkpoint verification.
**Owner:** Harry. **Implementer:** Claude Code.
**Context docs:** `IDEAS.md` §Composable Panes (the Depth ladder — now
realised as OS windows), `STATE.md`, `desktop/src/main.ts`,
`src/state/seams.ts` + `src/state/agentRuntime.ts` (the host-agnostic
crossing machinery), `src/procedural/land.ts` + `src/render/levels/land.ts`
(the side-on world).

---

## 1. The vision

Each terminal is its **own frameless OS window** showing a side-on land —
one wing of the library as an inhabitable strip. Drag a terminal next to
another and they snap edge-to-edge: the ground line continues across the
gap, the frames open at the join, and an agent can walk out of one window
and into the other. The desktop is the arrangement surface; the user's
window layout IS the world's topology. Decisions made with Harry
(2026-06-11):

- **Each terminal owns a land segment** (a wing); snapping joins worlds —
  arrangement changes the world graph, not just the camera.
- **Side-on only in terminals.** Top-down cell joins read as confusing;
  ground-line continuity is instantly legible. (Cell level stays in the
  codebase; it's just not what terminals show.)
- **Electron multi-window first** — real OS windows, real snapping; the
  actual product surface. Browser approximations only if needed for tests.

## 2. What already exists (build on, don't rebuild)

- **Crossing machinery is host-agnostic:** `buildSeams`/`bridgeCoord`
  (src/state/seams.ts) derive adjacency in abstract grid space;
  `migrateRuntime` (src/state/agentRuntime.ts) moves an agent between any
  two scopes; the single-roaming-roster invariant (7D.2) is exactly the
  contract for cross-window handoffs.
- **Side-on land:** deterministic `composeLand` (wings → structures,
  engagement → place), walkable surface heights, scrolling camera,
  porous/bleed frame modes (`buildPorousFrame`) — the frame vocabulary
  already knows how to be an edge that opens.
- **Electron wrapper:** Steam-less graceful init on macOS works;
  wallpaper enter/exit is per-window; `display-picker.ts` helpers are pure.
  Known singletons to refactor: `mainWindow`, global `peeking`, the
  throttle controller, broadcasts hardcoded to one webContents
  (desktop/src/main.ts:61-370).
- **In-app pane system (7B):** stays as-is, PARKED for terminals. Its
  seam/roster semantics are the spec the window version implements.

## 3. Non-goals

- No top-down cell rendering in terminal windows.
- No vertical joins in v0 (side-on lands join left/right only; stacked
  windows = sky/underground relationships are a later idea).
- No Dockview/panes work; no visual-PRD M-slices (still parked at its gate).
- No cross-machine/multiplayer anything.
- Agents never move or resize the user's windows without the Depth-3
  opt-in (T5) — and even then only via surfaced, reversible proposals.

## 4. Hard constraints

- Determinism: terminal world content seeds from profile + wing id;
  window ids are stable; no `Math.random()`/`Date.now()` in procedural
  or shared-state paths.
- One society: a single roaming roster across all terminals — an agent
  lives in exactly one window at a time (`migrateRuntime` semantics over
  IPC). Roster authority lives in the MAIN process.
- All AI calls stay in the Worker; the main process brokers topology and
  agent state only.
- Keep existing smokes green; new machinery ships with its own smokes
  (pure parts: snap detection, ground alignment, handoff protocol).
- Wallpaper mode: out of scope for joins in v0 (a wallpaper terminal is
  click-through and pinned; treat it as un-snappable until T3+).
- Sub-character animation preserved: snapping quantises WINDOW BOUNDS to
  the Cozette grid, never sprite movement.

## 5. Slices

### T0 — Two-terminal joined-world spike (~2–3 days, the demo)

The validation moment: drag two real macOS windows together, watch the
worlds join, watch a being walk across.

1. **Spawn:** dev flag (`LOKILIBRARY_TERMINALS=2`) makes main open two
   BrowserWindows (normal frames fine for the spike), each loading the
   renderer with `?terminal=t1&wing=d0` / `?terminal=t2&wing=d1`. Renderer
   mounts ONLY the side-on land for its wing (no pane system).
2. **Topology broker v0 (main):** track bounds via `move`/`resize` events;
   adjacency when A.right ≈ B.left within a snap threshold AND vertical
   overlap; on snap, `setBounds` to exact abutment and align vertically so
   both windows' GROUND LINES share a screen row (quantised to the 6×13
   cell grid). Broadcast `topology:changed` with the join state to both.
3. **Edges open:** on join, each renderer switches that edge's frame from
   closed (porous frame side) to open (the `‹ ›` carat edge clears); on
   un-snap (drag apart past threshold), it closes.
4. **Minimal land beings:** the land currently bakes beings as static
   glyphs — give it a tiny runtime: N beings per terminal walking the
   surface height field (Tier-0 wander, seeded), rendered as live
   BitmapText like the movable player.
5. **Handoff v0:** a being reaching an OPEN edge emits `agent:exit` to
   main; main validates the join, computes the entry column in the
   neighbour (ground-line aligned), and `agent:enter`s it there. The being
   despawns from A and walks on in B. Main owns the roster map
   (`Map<agentId, terminalId>`) — one place, always.

**Acceptance:** on the real desktop: two terminals, drag together → snap +
frames open + ground continuous; within a minute a being walks from one
window into the other; drag apart → frames close, no more crossings; same
seeds → same lands. Screen recording is the artefact.

**Decision gate:** Harry feels the magic (or doesn't). Iterate snap feel /
edge treatment here before any T1 investment.

### T1 — Real windows: frameless, registry, persistence (~1 week)

- Frameless terminals: glyph title bar (`┤ wing d0 ├`) rendered by the
  world, doubling as the OS drag region (`-webkit-app-region: drag`);
  close/minimise as glyph buttons.
- Main-process **terminal registry** replaces the `mainWindow` singleton:
  `Map<terminalId, {win, wing, bounds, joins}>`; broadcasts go to all;
  peek/throttle become per-terminal (the known refactor list from the
  desktop exploration).
- Snap polish: magnetic pull within threshold, cell-quantised bounds
  always, multi-terminal chains (A–B–C), un-snap hysteresis.
- Persistence: terminal set + wings + bounds in config; relaunch restores
  the desk as you left it.
- Tray: "New terminal" (next unused wing), per-terminal entries.

**Acceptance:** three frameless terminals chained A–B–C survive relaunch;
dragging the middle one out closes both joins cleanly; agents keep walking
through it all.

### T2 — One society, real runtime (~1 week)

- Replace spike beings with the real cohort: agent runtime state for land
  (position on surface, Tier-0 behaviours; perception events on arrival,
  near-structures, near-player), single roster authoritative in main,
  `migrateRuntime`-over-IPC with the same guards (anti-ping-pong,
  duplicate refusal, floor/edge gating).
- Crossings write to the Smallville memory stream ("crossed from the d0
  terminal into d1"); Tier-1 perception fires on arrival in a new land.
- Cross-edge perception: a being near an open edge perceives the
  neighbour's near-edge subjects (the `enrichSnapshotAcrossSeams` pattern,
  fed by a main-process neighbour summary).

**Acceptance (headless-able):** smoke proves roster uniqueness across two
simulated terminals, crossing-writes-memory, and perception enrichment;
on-screen, agents cluster toward joins when something interesting is on
the other side.

### T3 — Terminal identity + chrome (~1 weekend)

- Per-terminal theming hooks (one theme per terminal scene — themes may
  differ BETWEEN terminals; the join edge is the boundary), wing label,
  status row (who's here, engagement summary).
- Joined-edge treatment becomes a crafted moment: frame glyphs part like
  undergrowth, ground knits across (this is where the glyph craft from
  the parked visual PRD gets exercised on a surface that matters).

**Acceptance:** screenshot of two joined terminals reads as one continuous
diegetic object; a third, unjoined terminal reads as deliberately apart.

### T4 — Topology → reflection (~½ week)

- Tier-2 reflection context gains a topology summary (which terminals
  exist, which are joined, who's where); plans can target other terminals
  using existing whitelisted actions ("walk to the d1 terminal").
- Morning dispatch narrates overnight movement across the desk.

**Acceptance:** a reflection fired after a new join references it in a
plan; no new runtime AI calls (rides existing reflection dispatch).

### T5 — Orchestration v0, Depth-3 gated (~1 week)

- Opt-in only: overnight, the society may PROPOSE one topology change —
  "open a terminal onto wing d2" — surfaced in the morning dispatch with
  one-tap apply/dismiss. Applying opens the window (spawned adjacent,
  already joined). Agents never move existing windows.

**Acceptance:** opted-in: wake to a proposal, apply it, watch agents
explore the new terminal; opted-out: nothing ever appears.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Ground lines can't align (different window heights/scales) | Lock land scale across terminals; broker aligns ground row on snap; T0 proves it |
| IPC handoff drops/duplicates agents | Main-process roster is the single authority; transfer is idempotent (ack before despawn); smoke the protocol pure |
| Window-move event spam → broker thrash | Debounce; joins evaluated on settle, not mid-drag |
| Frameless drag region fights world input | Title row is the only drag region; world input below it |
| Multi-window Pixi perf | One land per window is light (V0 scene ≈ 30 text layers); throttle controller goes per-terminal in T1 |
| `mainWindow`/throttle singleton refactor regressions | T0 avoids them (dev flag, window-mode only); T1 does the refactor with the existing wallpaper QA checklist |
| Wallpaper-mode interactions | Explicitly out of scope until T3+; wallpaper terminal is un-snappable |

## 7. Sequencing notes

- The **in-app pane system (7B/7D.2) is the reference implementation** of
  seams + roster semantics; it stays intact and smoke-tested, but new UX
  investment goes to OS windows, not panes.
- The **visual PRD stays parked**; its glyph-chrome craft resurfaces in T3
  where it serves the join moment. The side-on commitment it made is
  vindicated here — terminals show lands.
- `v1-scope-gaps` (Loki events, enrichment budget) still queue ahead of
  shipping any of this in v1.0; this arc is the v2.x flagship.
