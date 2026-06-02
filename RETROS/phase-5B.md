# Phase 5B — Sleep mode (SLEEPING state + sleep-reflection + morning dispatch)

**Shipped** 2026-05-28 on `claude/phase5b-sleep-mode` (first slice on
the new per-slice branch cadence post-5H).

## What landed

Per IDEAS.md 2026-05-28 "Sleep mode" entry. Four sub-pieces:

1. **SLEEPING state in the throttle pipeline**
   (`desktop/src/wallpaper/throttle.ts`). `ThrottleState` gains
   `'sleeping'`. Idle detection via two new Win32 koffi bindings:
   `GetLastInputInfo` (LASTINPUTINFO struct marshalled as a `_Inout_
   uint32_t*` 8-byte buffer; cbSize=8 + dwTime fields) and
   `GetTickCount` for the ms-since-boot baseline. SLEEPING gate sits
   ABOVE the fullscreen detection so user-idle + Progman-foreground
   correctly enters sleep — but fullscreen-app-foreground still wins
   (active game/video sessions stay PAUSED even if input-idle).
   Default threshold 10 min.

2. **`applyThrottle` handles SLEEPING** (`src/render/PixiApp.ts`).
   Same as PAUSED visually: `app.ticker.stop()`. The semantic
   difference lives in App.tsx (sweep + banner), not in the renderer
   loop.

3. **Sleep reflection sweep** (`src/agents/sleep-reflection.ts`,
   new). On SLEEPING entry (after 5s grace), iterate present agents
   with `reflectionCounter > 0`, call `routeTier2` per agent with
   `reflectionMinIntervalMs: 0` (bypass the 5A per-real-hour
   rate-limit — this IS the budget being spent). Reflection texts +
   plan-summary metadata buffer in a module-local array.
   Fire-and-forget; Promise.allSettled-style.

4. **Morning dispatch overlay**
   (`src/render/overlays/morning-dispatch.ts`, new). On SLEEPING →
   FULL transition (any other transition out of sleep counts), App.tsx
   drains the buffer via `consumeSleepReflections()` and mounts a
   terminal-styled BitmapText banner at the top-center of the cell.
   `── overnight ──` header + per-agent reflection lines + optional
   `↳ and made a plan` decoration + footer rule. Auto-dismiss after
   30s via PIXI ticker delta (NOT setTimeout — ticker is stopped
   during sleep so setTimeout would fire too early).

## What surprised me

- **Renderer-side `ThrottleState` type drift**. The throttle union
  is declared in 3 places: `desktop/src/wallpaper/throttle.ts`,
  `desktop/src/preload.ts`, `src/api/electron.ts`. Adding `'sleeping'`
  to the desktop side alone left the renderer typecheck broken until
  the other two also updated. Caught by `tsc`; lesson for STATE.md:
  call out the multi-declaration shape so future sleep-mode-like
  changes know to update all three.

- **The 5s grace before firing the sweep matters**. User idle
  detection fires the SLEEPING transition; my first impulse was to
  trigger reflection immediately. But idle is system-wide — the user
  might be reading a long article in another app for 11 minutes and
  briefly focus the wallpaper desktop. Without the grace period,
  a Sonnet call fires on every sleep transition even for ~5-second
  visits. 5s window catches "I just stepped away, never mind" without
  noticeably delaying real sleep reflections.

- **Auto-dismiss timer via PIXI ticker, not setTimeout**. The
  overlay's auto-dismiss needs to elapse against the user's *visible*
  time, not wall-clock. If the user re-enters SLEEPING immediately
  after wake, the ticker stops and a setTimeout would still fire 30s
  later (banner gone before the user saw it again). PIXI ticker
  callbacks only fire when the ticker is running, which is exactly
  the dismiss semantic we want.

- **SLEEPING-vs-PAUSED ordering**. The intuition was "PAUSED is the
  most aggressive, put it first." But PAUSED means "fullscreen app
  foreground, pause everything"; the user might still be ACTIVELY
  playing a game. SLEEPING means "user is gone." If both true (user
  left a fullscreen video paused at lunch), SLEEPING is the right
  call — but my code does fullscreen detection BEFORE sleeping, so
  the "fullscreen wins" property is preserved when the user IS
  actively playing (input idle > 10 min while playing a game is
  unusual). Hybrid resolution: SLEEPING gate excludes fullscreen-
  foreground from triggering. So idle + fullscreen → PAUSED (still);
  idle + non-fullscreen → SLEEPING. Captured in inline comment +
  smoke covers both cases.

## What's deferred

- **Overnight cadence** ("the agent did 5 things while you slept").
  Current: one reflection per agent per sleep session. If we want
  multiple things per night, that's a setInterval on App.tsx firing
  the sweep periodically; ~30 LOC follow-up.

- **Interactive dismiss** of the morning dispatch. Wallpaper mode is
  click-through + keydown-gated, so neither click nor keypress
  reaches the renderer. Auto-30s is the only path. A "click to
  dismiss" UX would need the peek-hotkey-style temporary
  setIgnoreMouseEvents(false), which is more complex than the value
  it adds.

- **Persisted reflection-during-sleep telemetry**. The sleep sweep
  uses Tier-2 telemetry rows via the existing logTier2 path, so
  cost tracking works. But there's no separate "sleep-fired" tag —
  if we want to bucket sleep cost separately from wake cost, that's
  a future telemetry-schema slice.

## What the user verified (PENDING)

5B is freshly shipped. User verification on Windows pending:
- Leave wallpaper running unfocused with no input for 11+ minutes
- PowerShell shows `[throttle] ... idle=Ns state=sleeping ⟹ full→sleeping`
- ~5 seconds later: `[sleep-reflection] firing for N agent(s)` +
  per-agent `[sleep-reflection] X reflected (M plan steps)` lines
- Move mouse to wake → `[throttle] state=full` transition → banner
  appears at top of cell with overnight reflection lines
- Banner auto-dismisses after 30 seconds (silently)

## Files

- `desktop/src/wallpaper/throttle.ts` — `'sleeping'` in union,
  `idleDurationMs` on probe, `GetLastInputInfo`/`GetTickCount` koffi
  bindings, `queryIdleDurationMs()` helper, SLEEPING gate above
  fullscreen, log line includes `idle=Ns`
- `desktop/src/preload.ts` + `src/api/electron.ts` — type union
  updates (3-state → 4-state)
- `src/render/PixiApp.ts` — `applyThrottle` extension + new
  `getCurrentRenderContext()` export for App.tsx's overlay mount
- `src/App.tsx` — sleep grace timer, sweep dispatch on entry,
  banner mount on wake
- `src/agents/sleep-reflection.ts` (new) — `triggerSleepReflection`
  + `consumeSleepReflections` + module-local buffer
- `src/render/overlays/morning-dispatch.ts` (new) —
  `mountMorningDispatch` overlay + pure `renderDispatch` text builder
- `scripts/smoke-5b-sleep.mts` (new, 22 assertions) — SLEEPING gate
  matrix, drain semantics, render-dispatch builder cases
- `STATE.md` — updated throttle + sleep-reflection sections, +22
  assertion count
