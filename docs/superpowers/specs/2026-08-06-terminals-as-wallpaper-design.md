# Terminals-as-wallpaper — the desk becomes the desktop

**Date:** 2026-08-06
**Programme item:** `PLAN.md:80` "Terminals-as-wallpaper | OPEN" — the last
unbuilt product pillar for the shipped surface.

## Why

CLAUDE.md's first line promises a thing that "lives as a live wallpaper and an
alt-tab destination, doubles as a launcher". The terminals desk — the **default
desktop boot** since `8ec7ee4` — has the alt-tab destination, and got the
launcher on 2026-08-06. It cannot be a wallpaper. Wallpaper mode and peek are
palace-only (`STATE.md:451`, `main.ts:455-461`), so the surface that actually
ships cannot do the thing the product is named for.

This also pays a recorded debt. `docs/PRD-snapping-terminals.md:200` says the
T1 slice would do the `mainWindow` / peek / throttle singleton refactor with
the existing wallpaper QA checklist; T1 shipped without it, and `PRD:47` still
lists those singletons. They are precisely what blocks N windows, so this slice
does that refactor as its first two legs.

## Direction calls (taken before any code)

### 1. Wallpaper terminals are click-through, read-only ambience. **Peek is the interaction path.**

Cmd+Alt+L lifts the *whole desk together*, arrangement preserved, so dragging,
snapping, joins, crossings and the launcher all work exactly as they do today;
then the desk drops back.

**The argument against, recorded because it is real.** The desk shipped its
first user input today. This call switches the launcher pillar *off* at the
moment the wallpaper pillar switches *on*: you see a site on your desktop,
click it, and nothing happens until you have learned a three-key chord. That is
a worse product than the desk we have, and it makes the two pillars mutually
exclusive rather than composed. Further, the governing precedent
(`IDEAS.md:384`, "composition is only available in window mode... the peek
hotkey brings the window-mode UI up for changes") is about **palace panes** —
composing a Dockview layout is a heavyweight editing gesture that genuinely
belongs in a lifted UI. A single click on a hill is not. Quoting palace
precedent at a desk gesture is an analogy, not a ruling.

**It loses anyway, because the WindowServer decides this, not us.** At
`CGWindowLevelForKey(kCGDesktopWindowLevelKey)` the window sits *below*
Finder's desktop window, which spans the screen and consumes clicks — that is
how rubber-band select and desktop right-click work. Removing
`setIgnoreMouseEvents(true)` does not make the desk clickable; it makes it a
window that receives no clicks *and* can no longer honestly be called
click-through. `app.setActivationPolicy('accessory')` additionally means the
window is never key, so `window.addEventListener('focus')` never fires either.
The alternative ships three dead input paths and calls them interactive.

Consequence, stated plainly rather than discovered later: **in wallpaper mode
you cannot click to launch.** See "The away consequence" below, which is the
part of this that needed real work rather than acceptance.

### 2. App-wide `mode`. No per-window wallpaper flag.

`Config.mode` (`config.ts:41`) stays one scalar. Palace and desk are mutually
exclusive at boot (`main.ts:466`), so it is never ambiguous: it means "the mode
of whatever surface booted". A per-window mode is a promise peek cannot keep —
peek is one boolean, so a desk with two wallpapered terminals and one windowed
one has no defined peek. Half a per-window design is worse than none.

Zero config diff also matters for a specific reason: `config.ts:76-78` warns
that an unparsed field is *erased* by the next read-modify-write, so every
schema change is a hazard.

*Escape hatch, recorded:* a future "pin one terminal as wallpaper" slice adds
`TerminalSlot.wallpaper?: boolean` and makes peek per-window. Not now.

### 3. The desk is the peek unit, not the window.

One boolean, not persisted, all N lift together.

## SPIKE-A — the alternative, checked rather than assumed

Ran before the bars were frozen. Nothing branches on it; the shipped default is
desktop level + peek either way. But "could the desk be an interactive
wallpaper?" was an untested assumption, and a NEEDS-CHECK beats a guess.

Behind `LOKILIBRARY_WP_LEVEL=icons`, three changes in `macos.ts` and nothing
else: resolve `CGWindowLevelForKey(kCGDesktopIconWindowLevelKey /* 3 */) + 1`
instead of key 2; skip `setIgnoreMouseEvents`; skip `setActivationPolicy`.

Four questions, answered on screen with a 2-terminal desk:

**Method note.** A CDP-injected `Input.dispatchMouseEvent` would have proved
nothing here: it is delivered straight into the renderer and never goes near
the WindowServer, which is the thing under test. Both input answers were taken
with **real `CGEvent`s posted to `.cghidEventTap`** (a compiled Swift poster),
with every visible app hidden so the desktop layer was genuinely exposed.

| # | Question | Answer |
|---|---|---|
| a | Does a site click reach `onPointerDown`? | **NO.** Real CGEvent click at screen (188,563), dead centre of the `stardew` site: `debugLaunch()` returned `{last:null, errand:null, hoverX:null}`. Nothing reached the renderer. |
| b | Does the 20px drag strip drag the window? | **NO.** Real CGEvent press-drag-release from (380,170) by (+80,+40) across the strip: `d0 — t1` bounds `60,160 640x520` before and `60,160 640x520` after — byte-identical. |
| c | Does the desk stay *behind* Safari and Finder? | **YES, strongly.** At `CGWindowLevelForKey(3) + 1 = -19` both terminals are absent from the `optionOnScreenOnly` list entirely while a normal (layer 0) app is frontmost, and visible in `optionAll` at `layer=-19`. Every ordinary app window is layer 0. |
| d | Are desktop icons still usable, or occluded? | **Would be occluded** — `kCGDesktopIconWindowLevel` resolves to `-20` on this machine, so `-19` is above it. *Recorded as inference, not observation:* no Finder desktop-icon window appeared in the window list on this box, so occlusion was not directly seen. |

**Result: KILL fired — (a) and (b) both failed. Peek-only stands unmodified,
and the "above icons, below apps" third tier is dead rather than deferred.**

This is a stronger negative than the direction call needed. The call was argued
on `kCGDesktopWindowLevel` sitting below Finder's click-eating desktop window;
the spike shows that even one level *above* the icons, with `clickThrough` off
and the activation policy left at `'regular'` — i.e. every mitigation the
alternative had available — the WindowServer still routes no mouse events to
the window at all. There is no negative window level at which the desk is both
behind apps and clickable, so "interactive wallpaper" is not a dial we chose
not to turn; it is not available.

One incidental confirmation worth keeping: the spike ran with the bounds
untouched, and both windows held their own `640x520` at `60,160` and
`700,160`. The `bounds: 'keep'` path in Leg 1 is therefore not a new risk —
this is what it looks like working.

## Architecture

Two new small modules carry the risk, both chosen so the dangerous parts become
headlessly testable. `macos.ts` **cannot** be smoked: koffi `dlopen`s libobjc,
so under `mockElectronModule` `ensureBridge()` returns null and every function
early-returns — a smoke against it would pass **vacuously**, which is the exact
failure mode [[regression-test-must-fail-on-prefix-code]] is about. So the
bookkeeping moves out and `macos.ts` becomes a thin FFI shell.

### `desktop/src/wallpaper/wallpaperState.ts` (new, pure — no electron, no koffi)

```ts
beginEnter(key, capture) -> { fresh, state }   // fresh:false => already entered, do NOT re-capture
endExit(key) -> CapturedWindowState | null
isEntered(key) / enteredCount()
policyFor(before, after) -> 'regular' | 'accessory' | null
```

A `WeakMap<object, CapturedWindowState>` plus a count. This replaces the module
singleton `state` (`macos.ts:165-174`) and its `if (state.priorLevel === null)`
guard (`:192`), which today means **entering wallpaper on window 2 skips
capture entirely**, and either window's exit restores one set of values and
then nulls the shared state so window 3's exit restores nothing. That is a
latent bug in the palace too — it just never surfaced at N=1.

`policyFor` is the refcount for blocker 7: `app.setActivationPolicy` is
process-scoped, so without it one window's exit flips the Dock icon back while
others are still wallpapered. `endExit` on an unknown key is a no-op that
cannot drive the count negative.

### `desktop/src/wallpaper/macos.ts`

```ts
enterWallpaper(win, display, opts?: Partial<{ bounds: 'display' | 'keep'; clickThrough: boolean }>)
```

Defaults `{ bounds: 'display', clickThrough: true }` — **byte-for-byte today's
palace behaviour, so main.ts's four call sites do not change at all.** The desk
passes `bounds: 'keep'`: its snapped 640×520 *is* the arrangement, and a null
captured bounds means "we never touched bounds, so do not restore any", which
is what makes the arrangement survive a round-trip and stops an exit clobbering
a desk layout.

### `desktop/src/wallpaper/index.ts`

Widen `WallpaperImpl` and the exported `enterWallpaper` to the 3-arg shape.
**`windows.ts` gets zero diff** — a 2-arg function is structurally assignable
to a 3-arg type, so the dormant Win32 path stays untouched, satisfying the
Mac-only direction without a platform branch.

### `desktop/src/broadcast.ts` (new, ~40 lines)

`registerWindow` (self-deregisters on `'closed'`) / `unregisterWindow` /
`broadcast(channel, payload)` (skips destroyed, try/catch per send) /
`targetCount`. Fed by **both** `main.ts:131` and `terminals.ts:181`.
`emitThrottleChange` (`main.ts:366-376`), `notifyPeek` (`:354-361`) and
`applyMode`'s send (`:293`) drop their `if (!mainWindow) return` guards — and
`mainWindow` is null in terminals mode, which is why `wallpaper:setMode` from a
terminal today silently returns `true` while doing nothing.

**Deliberately NOT unified:** `terminals.ts`'s `broadcastTopology`
(`:130-142`) keeps its own change-gated loop. It carries desk-specific payload
and a dedupe key; folding it in is the general-purpose-window-manager
temptation. `broadcast.ts` owns "who is listening" and nothing else — no
lifecycle, no bounds, no ordering.

### `desktop/src/wallpaper/throttle.ts`

One signature relaxation: `startThrottleController(win: BrowserWindow | null,
opts)`, with `if (!win) return` guarding the Win32 branch before
`getNativeWindowHandle()`. On macOS `startIdleController` (`:558-598`) ignores
`win` entirely, so **one controller legitimately serves N terminals**; only the
fan-out changes. No per-window controller, no new state.

### `desktop/src/terminals.ts`

Module-scope `deskMode` / `deskPeeking` beside the existing `terminals` /
`roster` / `homes` state, plus `applyDeskMode` / `toggleDeskPeek`.

**Peek-on** (no-op unless `deskMode === 'wallpaper'`, palace parity): stop
throttle → emit a synthetic `'full'` → per window `exitWallpaper` +
`setAlwaysOnTop(true)` → **one** `app.focus({ steal: true })` then `focus()` on
the **first** window only (focusing N in a loop fights the WindowServer and
ends with an arbitrary winner) → `broadcast('desk:attention')` → rebuild tray.

**No re-snap, ever.** Because the desk entered with `bounds: 'keep'`, no
window's bounds were touched, so the arrangement is *already* exactly right.
Calling `settle()` here would be a bug: it re-runs `computeSnapTarget` and
could pull together windows the user deliberately left 20px apart.

**A joined pair needs no special handling, and that is provable.**
`computeJoins` (`topology.ts:94-110`) is bounds-pure and bounds do not change
across an enter/peek/exit round-trip, so join invariance is a **smoke
assertion**, not a hope.

**Peek-off:** `setAlwaysOnTop(false)` → re-enter at whatever bounds each window
now has (so a drag made *during* peek is preserved) → start the throttle once.
**Mode change clears peek** (palace parity, `main.ts:268-272`).

**Accelerator.** `main.ts:485-494` currently sits *after* the terminals early
return at `:466`, so the desk never registers it. Hoist to
`registerPeekShortcut(onToggle)` and call it in both branches;
`globalShortcut.unregisterAll()` in `window-all-closed` already covers both.

**Desk tray** (`rebuildTray`, `terminals.ts:279-293`, already re-invoked on
spawn and close): add Window mode / Wallpaper mode **checkboxes** — not radio,
per the v0.6 auto-fire hazard documented at `main.ts:161-172` — plus a Peek
item shown only in wallpaper mode. **No Display submenu, deliberately:** for a
desk of individually positioned windows, picking a display means *moving N
windows to another monitor*, which is an arrangement change and sits adjacent
to PRD §3's "agents never move the user's windows". Recorded as out of scope
with a reason, not silently omitted. Blocker 11 is fixed here too: hoist `tray`
to module scope and destroy it in the existing `before-quit` handler
(`terminals.ts:212-214`).

## The away consequence — and the fix

With `clickThrough` **and** `accessory`, *all three* of `onAttention`'s
triggers die (`terminalLand.ts:1055` pointermove, `:1062` pointerdown, `:1069`
focus), so `AWAY_CEIL_MS` (30 min) becomes the sole return path. A being sent
into a 20-minute game would be absent for thirty.

One mitigation is free and worth stating: `beginErrand` also cannot fire while
wallpapered, so **no new beings go away in wallpaper mode**. The stuck case
only arises for someone who went away in window or peek mode before the desk
dropped — which is exactly the case a user hits, because you launch a game and
*then* your desk gets buried.

Two new attention signals, fanned via `broadcast('desk:attention')`:

- **Peek-on** (not peek-off — that is you leaving). A deliberate "I am here and
  looking at the desk" is strictly better evidence than a mousemove that might
  be you reaching for a browser tab. `AWAY_FLOOR_S` still applies, so a peek
  three seconds after a launch cannot yank the runner back before Steam has
  opened.
- **`throttled-1hz → full`.** Can only follow ≥ `IDLE_THROTTLE_MS` of genuine
  idleness, so it cannot fire spuriously the way a mousemove can. It is
  honestly "you came back to the machine", not "to the desk" — you might have
  come back to Slack. That is fine, and arguably better: a being re-emerging
  while you are in Slack costs nothing, and the payoff lands the next time you
  glance at the wallpaper, which is when it is supposed to land.

Taken together this is a **more** honest "you came back" than a stray pointer
event in a window you cannot point at — which is worth saying plainly, in the
same register as the launcher-beat spec's own "the return signal is attention,
not process state". The real macOS game-exit probe remains the out-of-scope
follow-up it already was.

**Required gate: never treat `isInitial: true` as attention.** Those fire on
every `enterWallpaper`, every peek-off and at startup (`throttle.ts:573`,
`main.ts:288/334`); without the gate any mode toggle snaps everyone back and
the ceiling becomes decorative. Fire only on
`!isInitial && next === 'full' && prev !== 'full'`.

Transport: `onDeskAttention` in `preload.ts`, `subscribeDeskAttention` in
`src/api/electron.ts` following the `subscribePeek` shape (`:322`) including
the `warnStalePreload` guard, one wire in `terminalLand.ts` beside
`onWindowFocus`.

## Legs — each independently shippable

0. **This spec, bars frozen**, then SPIKE-A with its four answers pasted in.
1. **`wallpaperState.ts` + per-window `macos.ts` + widened `index.ts`.** Ships
   alone: palace behaviour byte-identical, and the cross-window corruption bug
   fixed *for the palace too*.
2. **`broadcast.ts` + de-singletoned sends + the throttle signature.** Ships
   alone and inert: terminals now receive events nothing listens to yet.
3. **Throttle reaches the terminal renderer.** Must land **before** leg 4 or
   bar 5 fails on day one — `subscribeThrottle` appears nowhere under
   `src/terminal/` today, so a wallpapered desk would run at full FPS forever.
4. **Desk wallpaper mode.** First user-visible landing; shippable without peek
   (toggle from the tray). Bars 1, 2, 5 checkable here.
5. **Desk peek** + the attention wiring. Bars 3, 4, 6.
6. **Eyeball pass**, then doc updates.

## Verification plan

**Three commands, not one.** `npm run typecheck` covers `src` + `worker` only
(`tsconfig.json` is `include: ["src"]`); **`desktop/src` is covered by neither
it nor the known `scripts/*.mts` gap** — it needs `cd desktop && npm run build`:

```
npm run typecheck && (cd desktop && npm run build) \
  && npx tsx scripts/smoke-desk-wallpaper.mts && npx tsx scripts/smoke-broadcast.mts
```

plus the full existing smoke sweep — especially the T0/T2 join and crossing
smokes — to prove window mode is untouched.

**Headless.** `smoke-desk-wallpaper.mts`: per-window capture (two windows both
`fresh: true`, each holding its own level); re-enter idempotence (the capture
closure is not invoked twice); `bounds:'keep'` → `endExit().bounds === null`;
`endExit` on an unknown key cannot drive the count negative; `policyFor` across
an interleaved `enter(a) enter(b) exit(a) exit(b)`; **join invariance across a
peek round-trip using the real `topology.ts`**; the pure desk-peek transition
(all N flip together, no-op in window mode, mode change clears peek); the
attention gate. `smoke-broadcast.mts`: destroyed windows skipped, a throwing
`send` contained, `targetCount`, `'closed'` deregistration.

**Mutant check, one per new invariant, run and recorded** — and per the lesson
learned earlier the same day, assert *behaviour*, never `CONST === CONST`:

| Invariant | Mutant that must make it red |
|---|---|
| per-window capture | reinstate module-level freshness (today's bug) |
| `bounds: 'keep'` | always record and restore bounds |
| policy refcount | `policyFor` returns `'regular'` on any decrement |
| count floor | let `endExit` decrement on an unknown key |
| broadcast fan-out | send to `windows[0]` only |
| attention gate | drop the `!isInitial` term |
| peek is all-or-nothing | flip only `windows[0]` |

**Live app** (`launch-desktop-app`), for what cannot be faked: the koffi bridge
over N frameless windows; level *and* collection behaviour restored for **all**
N on exit; the Dock icon returning exactly once across ≥3 round-trips;
`globalShortcut.register` returning true in terminals mode; throttle IPC
actually dropping `ticker.maxFPS` in a terminal renderer; Cmd-Tab (desk absent
while wallpapered via `IgnoresCycle`, present during peek). Window frontmost —
a throttled window passes vacuously.

## Eyeball bars (frozen now, before implementation)

Shots + a live watch, `docs/design-reviews/2026-08-06-terminals-as-wallpaper/`.
Per bar: at most the single named dial, then the kill fires. No bar may be
softened after shots exist.

1. **It is a wallpaper.** With apps open on top, the terminals sit behind every
   window, are absent from Cmd-Tab, and the lands read as ambience at a glance
   — you can tell what is happening without reading. KILL: it floats above an
   app, or steals focus even once in five minutes → `desktopLevel - 1` once,
   then abandon desktop level and ship the desk as an alt-tab destination only.
2. **The arrangement survived.** Entering wallpaper moves, resizes and unsnaps
   nothing: a joined A–B pair stays joined, the ground line is continuous
   across the seam, and the seam is pixel-identical to window mode. KILL: any
   window jumps, or a join breaks on enter → enter-then-explicit-`settle()`
   once, then revert to per-window bounds capture and record `bounds:'keep'`
   as failed.
3. **Peek is the desk coming to you.** Cmd+Alt+L: all N windows arrive
   together, in one beat, in the same arrangement, interactive immediately —
   the drag strip drags, a site click launches. KILL: they arrive raggedly or
   in stages, or one stays behind → serialise the lift behind a single
   `app.focus({steal:true})` after the loop, once; then reduce peek to a
   single-window lift and record desk-wide peek as failed.
4. **Peek round-trips clean.** Peek off returns every window to the desktop
   layer with no leftover always-on-top, shadow, traffic lights or Dock icon,
   and a drag made *during* peek is preserved and still snapped on the way
   back down. KILL: any leftover after three round-trips → audit the refcount
   once, then make peek exit-only (peek ends by returning to window mode).
5. **Alive but cheap.** Wallpapered and untouched for three minutes, the desk
   visibly slows and the machine is quiet; touch the keyboard and it is back to
   full within a second. KILL: full FPS while wallpapered, or it never wakes →
   tune the idle ladder once, then gate wallpaper mode behind an explicit
   "this runs at full speed" warning and make throttle-to-terminals blocking.
6. **Nobody is lost.** Send a being into a game, then drop the desk to
   wallpaper: a peek, or returning to the machine after a real idle, brings
   them back to the door with their mark. KILL: still gone after both → drop
   the floor for the peek signal specifically, once; then accept the 30-minute
   ceiling and record the desk-as-wallpaper as launcher-hostile.

## Out of scope (recorded, not scheduled)

- Per-window wallpaper mode (`TerminalSlot.wallpaper?: boolean` + per-window
  peek).
- A desk Display submenu (see the tray note above for the reason).
- The "above icons, below apps" third tier — a follow-up slice if SPIKE-A
  passes all four.
- A real macOS game-exit probe (inherited from the launcher-beat spec).
- Folding `broadcastTopology` into `broadcast.ts`.
- Win32 anything: the dormant path takes zero diff by construction.
