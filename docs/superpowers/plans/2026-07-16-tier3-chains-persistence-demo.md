# Terminal Chains, Desk Persistence & the Demo Artifact — Implementation Plan (Tier 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on:** the join-moment plan (`docs/superpowers/plans/2026-07-16-join-moment.md`) fully landed — this plan assumes `composeLand` has `join?: {left?: number; right?: number}`, the topology payload is `{joins, wings}`, terminal windows are frameless, and the knit sweep exists.

**Goal:** The snapping-terminals arc graduates from a two-window spike to a small product: three-terminal A–B–C chains work end-to-end (middle terminal ramps both edges, beings hop A→B→C, dragging the middle out closes both joins *cleanly* — which requires an un-snap capture-band fix), the desk persists across relaunches, a tray item opens new terminals onto unused wings, and a scripted demo capture produces the animated artifact for the clone-and-run README.

**Architecture:** Four additive slices around the existing T0 broker. (1) A pure `SNAP_Y_PX` vertical capture band in `desktop/src/topology.ts` — T0's overlap-only test recaptured any vertical drag-out up to half a window height (260px), so a snapped terminal could never detach vertically; the band is the minimal stateless hysteresis (nudges ≤48px re-hold, deliberate drags escape and *stay* escaped on every subsequent settle). (2) A demo capture script riding the existing `t0-drive.mjs` debug IPC: `screencapture -R` frame loop + assembly that degrades ffmpeg → ImageMagick (`magick` is present on this Mac; ffmpeg is not) → raw PNG sequence. (3) Desk persistence via the `desktop/src/config.ts` per-field getter/setter pattern (`terminals: TerminalSlot[]`), persisted on settle/close/spawn, restored at `startTerminalsMode` boot — **critically, `readConfig` must learn to parse the new field, because its read-modify-write currently strips unknown keys** (a `setMode` call would erase the desk). (4) A terminals-mode-only tray built inside `terminals.ts` (main.ts's tray is never created on this path — the early return), whose "New terminal" item shares a `spawnNext()` path with a new `terminal:debugSpawn` harness verb. `desktop/src/main.ts` is untouched for the whole tier.

**Tech Stack:** TypeScript strict (both legs), Electron main-process broker (`desktop/src/terminals.ts`), pure topology math (`desktop/src/topology.ts`), smokes via `npx tsx scripts/smoke-*.mts` + `makeChecker`/`mockElectronModule` from `scripts/lib/smoke.ts` (no vitest), e2e via `scripts/e2e/t0-drive.mjs` over CDP, bash + macOS `screencapture` for capture.

## Global Constraints

- **Determinism:** nothing in `src/procedural/` changes this tier. All new desktop logic is deterministic pure math or event-driven — no `Math.random`/`Date.now` anywhere in this plan.
- **No LLM / API keys / network:** everything here is Tier-0 behaviours + local JSON config. The demo script talks only to `localhost` (vite + CDP).
- **No new glyphs:** every rendered glyph already ships; `scripts/smoke-glyph-coverage.mts` needs no changes (verify it stays green in each sweep).
- **Every task ends green:** `npm run typecheck` (repo root) + `npm --prefix desktop run build` + the full sweep `for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done` + a git commit.
- **On-screen verification** uses the T0 harness: `cd desktop && LOKILIBRARY_TERMINALS=N LOKILIBRARY_RENDERER_URL=http://localhost:5183 ./node_modules/.bin/electron . --remote-debugging-port=9222`, driven by `node scripts/e2e/t0-drive.mjs state|move|place|waitcross|shot`. macOS Screen Recording permission for the driving terminal is a precondition (already granted — the T0 `shot` verb works).
- **Surgical + additive:** `desktop/src/main.ts` is not modified. The T1 registry refactor (mainWindow/peek/throttle singletons) stays out of scope. Task order is value order: chains → demo artifact → persistence → tray.

---

### Task 1: Un-snap vertical capture band (pure topology, TDD)

The T0 defect, confirmed by reading `computeSnapTarget`: capture requires only horizontal gap ≤ `SNAP_PX` (32) + vertical overlap ≥ 50% of a window (260px at H=520). So a snapped window dragged 100px vertically (x still aligned) is yanked straight back to the neighbour's y on settle — a chained middle terminal cannot be detached by dragging it away vertically. Minimal stateless fix: snap capture additionally requires tops within `SNAP_Y_PX` (48px — holds the 36px boot ladder and gentle nudges; a deliberate drag escapes, and *stays* escaped because the test is position-based, not history-based). `computeJoins` (JOIN_EPS_PX) is untouched.

**Files:**
- Modify: `desktop/src/topology.ts` (new exported `SNAP_Y_PX`; one condition in `computeSnapTarget`)
- Modify: `scripts/smoke-t0-topology.mts` (import + H-block assertions; header comment)

**Interfaces:**
- Produces: `export const SNAP_Y_PX = 48` (desktop/src/topology.ts). `computeSnapTarget` signature unchanged — behaviour contract: candidates with `|moved.y - o.y| > SNAP_Y_PX` never snap.
- Consumes: nothing new. The broker's `settle()` needs no change.

- [ ] **Step 1: Write the failing smoke assertions**

In `scripts/smoke-t0-topology.mts`, add `SNAP_Y_PX` to the import block:

```ts
import {
  computeJoins,
  computeSnapTarget,
  neighbourOf,
  openSides,
  JOIN_EPS_PX,
  SNAP_PX,
  SNAP_Y_PX,
  type TermBounds,
} from '../desktop/src/topology.ts';
```

Add to the header docblock, after the JOINS list:

```
 *   UN-SNAP CAPTURE BAND (SNAP_Y_PX — T1 hysteresis slice)
 *     H1  nudged within the band → recaptured (magnetic hold)
 *     H2  vertical drag-out past the band, x aligned → free (THE fix)
 *     H3  the 36px boot ladder still snaps together
 *     H4  band boundary inclusive at exactly SNAP_Y_PX
```

Add this block between the Snap-target block and the Joins block:

```ts
// ── Un-snap vertical capture band ──────────────────────────────────────────
{
  const t1 = t('t1', 100, 200);
  // H1: nudged within the band → recaptured (the snap still "holds").
  const hold = computeSnapTarget(t('t2', 100 + W + 6, 200 + SNAP_Y_PX - 8), [t1]);
  check('H1 nudge within band recaptures', hold !== null && hold.x === 100 + W && hold.y === 200);
  // H2: dragged out vertically past the band with x still aligned → free.
  //     THE regression this locks: overlap-only capture recaptured any
  //     |dy| ≤ height/2, so a snapped window could never detach vertically.
  check(
    'H2 vertical drag-out escapes',
    computeSnapTarget(t('t2', 100 + W, 200 + SNAP_Y_PX + 1), [t1]) === null,
  );
  // H3: the boot ladder (36px y offsets) must stay snappable.
  const boot = computeSnapTarget(t('t2', 100 + W + 20, 236), [t1]);
  check('H3 boot ladder offset (36px) snaps', boot !== null && boot.y === 200);
  // H4: boundary inclusive.
  check('H4 dy == SNAP_Y_PX still snaps', computeSnapTarget(t('t2', 100 + W, 200 + SNAP_Y_PX), [t1]) !== null);
}
```

*(Existing snap assertions use dy of 30/10/5 — all inside the band, so none break.)*

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-t0-topology.mts`
Expected: FAIL — `SNAP_Y_PX` is not exported (import error).

- [ ] **Step 3: Implement the band**

In `desktop/src/topology.ts`, add below `MIN_OVERLAP_FRAC`:

```ts
/** Vertical capture band for SNAPPING (not joining): a settle only snaps to
 *  a neighbour whose top is within this many px. Doubles as the un-snap
 *  escape distance — T0's overlap-only test recaptured any vertical drag-out
 *  up to half a window height (260px), so a snapped terminal could never be
 *  detached by dragging it away vertically. 48px holds the snap against
 *  nudges (and the 36px boot ladder) while a deliberate drag escapes — and
 *  stays escaped, because the test is position-based, not history-based.
 *  computeJoins is untouched (JOIN_EPS_PX). */
export const SNAP_Y_PX = 48;
```

In `computeSnapTarget`, immediately after the existing `if (o.id === moved.id || !overlapsEnough(moved, o)) continue;` line, add:

```ts
    if (Math.abs(moved.y - o.y) > SNAP_Y_PX) continue; // outside the capture band — un-snap escape
```

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-t0-topology.mts`
Expected: all assertions pass (previous count + 4).

- [ ] **Step 5: Typecheck both legs + full sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: both legs clean; every smoke green.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/topology.ts scripts/smoke-t0-topology.mts
git commit -m "fix(terminals): vertical capture band — snapped windows can be dragged out"
```

---

### Task 2: Three-terminal chains — boot spread + the A–B–C e2e

`LOKILIBRARY_TERMINALS=3` already spawns 3 windows, but the default spread (`60 + i*720`) puts t3 fully off a 1440-wide display, and macOS shuffles fully-offscreen windows (fighting the broker — the T0 comment already warns of this). Minimal fix: compress the boot spread to fit the work area (an overlapping cascade is fine — overlaps never join). Then drive the full chain acceptance: both edges ramp on the middle terminal, crossings hop A→B→C, and dragging the middle out closes both joins (exercising Task 1's fix live).

**Files:**
- Modify: `desktop/src/terminals.ts` (`screen` import; `clampX` helper; boot `spacing`)

**Interfaces:**
- Consumes: `screen.getPrimaryDisplay().workArea` (safe — `startTerminalsMode` runs inside `app.whenReady()`); Tier-0's `{joins, wings}` payload and both-edge `composeLand` ramp (no renderer changes needed — Tier 0's `applyJoins` already handles `left` and `right` simultaneously).

- [ ] **Step 1: Clamp the boot spread**

In `desktop/src/terminals.ts`, add `screen` to the electron import:

```ts
import { BrowserWindow, ipcMain, screen } from 'electron';
```

Add beside `allBounds()`:

```ts
/** Keep a spawn x on the primary work area — macOS shuffles fully-offscreen
 *  windows unpredictably (a 3×640 chain outgrows a 1440-wide desk), which
 *  fights the broker. */
function clampX(x: number): number {
  const wa = screen.getPrimaryDisplay().workArea;
  return Math.max(wa.x, Math.min(x, wa.x + wa.width - TERMINAL_W));
}
```

In `startTerminalsMode`, after the `const n = …` line, add:

```ts
  // Boot spread: fully apart when the chain fits the display; a clamped,
  // overlapping cascade when it doesn't (overlaps never join, so this only
  // changes where windows START — the user/e2e drags them into place).
  const wa = screen.getPrimaryDisplay().workArea;
  const spacing = Math.min(
    TERMINAL_W + 80,
    Math.max(40, Math.floor((wa.width - TERMINAL_W - 120) / Math.max(1, n - 1))),
  );
```

and change the BrowserWindow `x` option (keep the existing two-line comment above it):

```ts
      x: clampX(60 + i * spacing),
```

- [ ] **Step 2: Typecheck both legs + sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean.

- [ ] **Step 3: On-screen — build the A–B–C chain**

```bash
npm run dev > /tmp/loki-vite.log 2>&1 &   # if not already serving :5183
( cd desktop && LOKILIBRARY_TERMINALS=3 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-t3.log 2>&1 & )
sleep 8
node scripts/e2e/t0-drive.mjs move t1 20 160
node scripts/e2e/t0-drive.mjs move t2 672 172     # 12px off → snaps to (660,160)
node scripts/e2e/t0-drive.mjs move t3 1312 172    # 12px off → snaps to (1300,160)
node scripts/e2e/t0-drive.mjs state
```

Expected in `state`: `joins` = `[{left:"t1",right:"t2"},{left:"t2",right:"t3"}]`; `windows.t2.edges` = `{left:true,right:true}`; `windows.t1.edges.right` and `windows.t3.edges.left` true; all three wings in the broker.

- [ ] **Step 4: On-screen — middle terminal ramps BOTH edges (screenshot)**

```bash
osascript -e 'tell application "System Events" to set frontmost of (first process whose name is "Electron") to true'
node scripts/e2e/t0-drive.mjs shot /tmp/loki-t3/chain.png
```

Expected: eyeball `/tmp/loki-t3/chain.png` — the ground line is continuous across BOTH seams (x≈660 and x≈1300; t3 shows a ~140px sliver on a 1440-wide display, which includes its seam). No wall glyphs at either of t2's edges.

- [ ] **Step 5: On-screen — a being hops A→B→C**

```bash
B1=$(node scripts/e2e/t0-drive.mjs state | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(s.windows.t1.beings[0].id)')
node scripts/e2e/t0-drive.mjs waitcross "$B1" 30 & WAIT=$!
sleep 1
node scripts/e2e/t0-drive.mjs place t1 "$B1" 500 1   # clamps to the right edge → exits next tick
wait $WAIT                                            # CROSSED: … t1 → t2
node scripts/e2e/t0-drive.mjs waitcross "$B1" 30 & WAIT=$!
sleep 1
node scripts/e2e/t0-drive.mjs place t2 "$B1" 500 1
wait $WAIT                                            # CROSSED: … t2 → t3
```

Expected: two `CROSSED` lines; final `state` roster shows `$B1` in `t3`. (The waitcross-before-place ordering avoids the race where an edge-placed being crosses before polling starts.)

- [ ] **Step 6: On-screen — dragging the middle out closes both joins (Task 1 live)**

```bash
node scripts/e2e/t0-drive.mjs move t2 660 300   # dy=140 > SNAP_Y_PX: escapes (T0 would recapture)
node scripts/e2e/t0-drive.mjs state             # joins: [] ; t1.edges.right=false ; t3.edges.left=false
node scripts/e2e/t0-drive.mjs move t2 660 160   # re-chain → both joins reform, knit fires on both seams
node scripts/e2e/t0-drive.mjs move t2 668 168   # gentle nudge → recaptured, joins persist
node scripts/e2e/t0-drive.mjs state             # joins: both again; t2 back at (660,160)
```

Expected exactly as commented; also confirm t1+t3 never join each other while t2 is out (their edges are 640px apart).

- [ ] **Step 7: Commit**

```bash
git add desktop/src/terminals.ts
git commit -m "feat(terminals): fit the boot spread to the work area for 3+ chains"
```

---

### Task 3: Demo capture script → `docs/demo/` artifact

The killer-demo artifact for the clone-and-run README: two terminals apart → drift → snap (knit sweep) → a being walks across. Frame loop via `screencapture -R`; assembly degrades ffmpeg (gif+mp4) → ImageMagick gif (`magick` IS installed on this Mac at `/opt/homebrew/bin`; ffmpeg is not) → keep the PNG sequence + print the assembly command. Three keyframe stills are written regardless, so `docs/demo/` always gains a committed artifact.

**Files:**
- Create: `scripts/e2e/join-demo.sh` (executable)
- Create (output): `docs/demo/join-moment.gif`, `docs/demo/join-1-apart.png`, `docs/demo/join-2-joined.png`, `docs/demo/join-3-crossed.png`

**Interfaces:**
- Consumes: `t0-drive.mjs` verbs `state|move|place|waitcross|shot`; `LOKILIBRARY_TERMINALS_RESET=1` (no-op until Task 4 lands — then it guarantees the scripted layout wins over a persisted desk).
- Produces: `scripts/e2e/join-demo.sh` (run from anywhere; cd's to repo root).

- [ ] **Step 1: Write the script**

Create `scripts/e2e/join-demo.sh`:

```bash
#!/usr/bin/env bash
# Join-moment demo capture (docs/PRD-snapping-terminals.md, snapping-terminals arc).
# Two terminals apart → drift together → snap (knit sweep) → a being walks
# across the seam. Captures the beat as a frame sequence and assembles an
# animated artifact for the clone-and-run README.
#
# Assembly degrades gracefully:
#   ffmpeg          → docs/demo/join-moment.mp4 + .gif
#   ImageMagick     → docs/demo/join-moment.gif
#   neither         → PNG sequence kept in /tmp/loki-join-demo/frames + hint
# Three keyframe stills are written to docs/demo/ regardless.
#
# Preconditions: macOS; Screen Recording permission for this terminal
# (the T0 `shot` verb already exercises it); desktop deps installed.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

OUT=docs/demo
WORK=/tmp/loki-join-demo
FRAMES="$WORK/frames"
DRIVE="node scripts/e2e/t0-drive.mjs"
rm -rf "$WORK"; mkdir -p "$FRAMES" "$OUT"

# Capture region (logical px): union of t1@(60,200) 640x520 and t2's path
# 780→700 @ y 236→200, plus padding.
RX=48; RY=188; RW=1384; RH=584

ELECTRON_PID=""
VITE_PID=""
cleanup() {
  rm -f "$FRAMES/.run"
  [ -n "$ELECTRON_PID" ] && kill "$ELECTRON_PID" 2>/dev/null || true
  [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true
}
trap cleanup EXIT

# 1 · renderer dev server (leave it alone if already up)
if ! curl -sf http://localhost:5183 >/dev/null 2>&1; then
  echo "[demo] starting vite…"
  ./node_modules/.bin/vite > "$WORK/vite.log" 2>&1 &
  VITE_PID=$!
  for _ in $(seq 1 30); do curl -sf http://localhost:5183 >/dev/null 2>&1 && break; sleep 1; done
  curl -sf http://localhost:5183 >/dev/null || { echo "[demo] vite never came up"; exit 1; }
fi

# 2 · desktop build + launch (2 terminals; RESET so a persisted desk never
#     overrides the scripted layout — a no-op before persistence lands)
npm --prefix desktop run build
pushd desktop >/dev/null
LOKILIBRARY_TERMINALS=2 LOKILIBRARY_TERMINALS_RESET=1 \
LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > "$WORK/electron.log" 2>&1 &
ELECTRON_PID=$!
popd >/dev/null
for _ in $(seq 1 30); do $DRIVE state >/dev/null 2>&1 && break; sleep 1; done
$DRIVE state >/dev/null   # hard-fail if the broker never came up
sleep 5                   # fonts + beings settle

# 3 · known APART layout, windows frontmost for clean captures
$DRIVE move t1 60 200
$DRIVE move t2 780 236
osascript -e 'tell application "System Events" to set frontmost of (first process whose name is "Electron") to true'
sleep 1
$DRIVE shot "$OUT/join-1-apart.png"

# 4 · frame capture loop (as fast as screencapture goes, ~4–6 fps)
touch "$FRAMES/.run"
(
  i=0
  while [ -f "$FRAMES/.run" ]; do
    screencapture -x -R"$RX,$RY,$RW,$RH" "$FRAMES/$(printf 'f%04d' "$i").png" 2>/dev/null || true
    i=$((i+1))
    sleep 0.05
  done
) &
CAP_PID=$!

# 5 · the beat: drift → snap (knit sweep) → crossing
sleep 1
$DRIVE move t2 748 224          # drift closer — still outside SNAP_PX
sleep 1
$DRIVE move t2 712 212          # inside range → snaps to (700,200); knit fires
sleep 2
$DRIVE shot "$OUT/join-2-joined.png"
BEING=$($DRIVE state | node -e '
  const s = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const w = s.windows.t1;
  if (!w || !w.beings.length) { console.error("no t1 beings"); process.exit(1); }
  console.log(w.beings[0].id);
')
echo "[demo] crossing being: $BEING"
$DRIVE waitcross "$BEING" 30 &
WAIT_PID=$!
sleep 1
$DRIVE place t1 "$BEING" 500 1  # clamps to the right edge → exits next tick
wait "$WAIT_PID"                # CROSSED: … t1 → t2
sleep 2                         # entry juice + a few wander steps
$DRIVE shot "$OUT/join-3-crossed.png"

# 6 · stop capture, assemble
rm -f "$FRAMES/.run"
wait "$CAP_PID" 2>/dev/null || true
COUNT=$(ls "$FRAMES"/f*.png 2>/dev/null | wc -l | tr -d ' ')
echo "[demo] captured $COUNT frames"

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -framerate 6 -pattern_type glob -i "$FRAMES/f*.png" \
    -vf "scale=960:-2:flags=neighbor" -pix_fmt yuv420p "$OUT/join-moment.mp4"
  ffmpeg -y -framerate 6 -pattern_type glob -i "$FRAMES/f*.png" \
    -vf "scale=960:-1:flags=neighbor,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
    "$OUT/join-moment.gif"
  echo "[demo] wrote $OUT/join-moment.mp4 + .gif (ffmpeg)"
elif command -v magick >/dev/null 2>&1; then
  magick -delay 16 -loop 0 "$FRAMES"/f*.png -resize 960x -layers Optimize "$OUT/join-moment.gif"
  echo "[demo] wrote $OUT/join-moment.gif (ImageMagick)"
else
  echo "[demo] no ffmpeg/magick — PNG sequence kept at $FRAMES"
  echo "        assemble later: ffmpeg -framerate 6 -pattern_type glob -i '$FRAMES/f*.png' $OUT/join-moment.gif"
fi
ls -la "$OUT"
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x scripts/e2e/join-demo.sh
scripts/e2e/join-demo.sh
```

Expected: `[demo] captured N frames` (N ≈ 50–100), `wrote docs/demo/join-moment.gif (ImageMagick)` on this machine, and three stills in `docs/demo/`.

- [ ] **Step 3: Eyeball the artifact**

Open `docs/demo/join-moment.gif`. Expected beats, in order: two separate frameless lands → t2 slides left twice → the snap (y aligns, edges open, a bright knit sweep runs the seam) → a being walks off t1's right edge and fades into t2 with a ✦ spark. Check the stills: `join-1-apart` shows closed wall edges; `join-2-joined` shows the continuous ground; `join-3-crossed` shows the being in t2. If the gif is over ~8 MB, re-run assembly with `-resize 720x`.

- [ ] **Step 4: Typecheck + sweep (unchanged code — confirms no drift), then commit**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`

```bash
git add scripts/e2e/join-demo.sh docs/demo/
git commit -m "feat(e2e): join-moment demo capture — animated artifact for the README"
```

---

### Task 4: Desk persistence — restore the terminal set on relaunch

Persist `{id, wing, bounds}` per terminal via the `config.ts` pattern; restore at boot so positions — and therefore joins — survive relaunch (PRD T1 acceptance). The subtle bug to design around: `readConfig()` reconstructs the config from known fields only, so `setMode`/`setDisplayId` would silently erase an unparsed `terminals` field — `readConfig` must parse it. And app-quit closes windows one by one — a `quitting` flag stops the close cascade from persisting a shrinking desk.

**Files:**
- Create: `scripts/smoke-t3-desk.mts`
- Modify: `desktop/src/config.ts` (`TerminalSlot`, `Config.terminals`, `isTerminalSlot`, readConfig parsing, `getTerminals`/`setTerminals`, header comment)
- Modify: `desktop/src/terminals.ts` (`app` import; config imports; `quitting`; `persistTerminals`; spawn-loop → `spawnTerminal` + restore-or-default slots; persist in `settle` and `closed`)

**Interfaces:**
- Produces: `export interface TerminalSlot { id: string; wing: string; x: number; y: number; width: number; height: number }` · `export function getTerminals(): TerminalSlot[] | undefined` · `export function setTerminals(slots: TerminalSlot[] | undefined): void` (desktop/src/config.ts) · env `LOKILIBRARY_TERMINALS_RESET=1` (skip restore) · internal `spawnTerminal(id, wing, x, y)`.
- Consumes: `mockElectronModule` from `scripts/lib/smoke.ts` (smoke); `clampX` from Task 2.

- [ ] **Step 1: Write the failing smoke**

Create `scripts/smoke-t3-desk.mts`:

```ts
/**
 * Desk-persistence smoke — `npx tsx scripts/smoke-t3-desk.mts`.
 * Locks the terminals field of desktop/src/config.ts:
 *   - fresh config → undefined; set/get round-trip
 *   - setMode PRESERVES terminals (readConfig's read-modify-write used to
 *     strip unknown fields — the regression this exists to catch)
 *   - malformed entries filtered on read; clear/empty → undefined
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeChecker, mockElectronModule } from './lib/smoke.ts';

const { check, report } = makeChecker('smoke t3-desk');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-desk-'));
mockElectronModule({ app: { getPath: () => tmpDir } });
const { getTerminals, setTerminals, setMode, getMode } = await import('../desktop/src/config.ts');

check('fresh config → undefined', getTerminals() === undefined);

const desk = [
  { id: 't1', wing: 'd0', x: 20, y: 160, width: 640, height: 520 },
  { id: 't2', wing: 'd1', x: 660, y: 160, width: 640, height: 520 },
];
setTerminals(desk);
check('round-trip', JSON.stringify(getTerminals()) === JSON.stringify(desk));

setMode('wallpaper'); // read-modify-write on an unrelated field
check('setMode preserves terminals', JSON.stringify(getTerminals()) === JSON.stringify(desk));
check('setMode still works', getMode() === 'wallpaper');

// malformed entries are dropped on read, valid ones kept
fs.writeFileSync(
  path.join(tmpDir, 'config.json'),
  JSON.stringify({
    mode: 'window',
    terminals: [desk[0], { id: 42, wing: 'd1' }, 'junk', { ...desk[1], x: 'NaN' }],
  }),
);
check('malformed entries filtered', JSON.stringify(getTerminals()) === JSON.stringify([desk[0]]));

setTerminals(undefined);
check('clear → undefined', getTerminals() === undefined);
setTerminals([]);
check('empty array → undefined', getTerminals() === undefined);

report();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-t3-desk.mts`
Expected: FAIL — `getTerminals` is not exported.

- [ ] **Step 3: Extend config.ts**

In `desktop/src/config.ts`, add to the header docblock "Stores:" list:

```
 *   - `terminals` (id/wing/bounds array) — snapping-terminals desk
 *     persistence. Written by desktop/src/terminals.ts on settle/close/
 *     spawn; restored on the next LOKILIBRARY_TERMINALS launch.
```

Add below the `Config` interface (and extend it):

```ts
/** One persisted terminal window of the snapping-terminals desk. */
export interface TerminalSlot {
  id: string;
  wing: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Config {
  mode: Mode;
  displayId?: number;
  terminals?: TerminalSlot[];
}

function isTerminalSlot(v: unknown): v is TerminalSlot {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.wing === 'string' &&
    typeof s.x === 'number' &&
    typeof s.y === 'number' &&
    typeof s.width === 'number' &&
    typeof s.height === 'number'
  );
}
```

*(Delete the old two-field `Config` declaration — this replaces it.)*

Replace `readConfig`'s return with a terminals-aware one (readConfig reconstructs from known fields, so an unparsed field would be ERASED by the next read-modify-write — this parse is load-bearing):

```ts
function readConfig(): Config {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw) as Partial<Config>;
    const terminals = Array.isArray(cfg.terminals) ? cfg.terminals.filter(isTerminalSlot) : [];
    return {
      mode: cfg.mode === 'wallpaper' ? 'wallpaper' : 'window',
      displayId: typeof cfg.displayId === 'number' ? cfg.displayId : undefined,
      ...(terminals.length > 0 ? { terminals } : {}),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
```

Add at the bottom, matching the `displayId` getter/setter pattern:

```ts
export function getTerminals(): TerminalSlot[] | undefined {
  return readConfig().terminals;
}

export function setTerminals(slots: TerminalSlot[] | undefined): void {
  const cfg = readConfig();
  if (!slots || slots.length === 0) delete cfg.terminals;
  else cfg.terminals = slots;
  writeConfig(cfg);
}
```

- [ ] **Step 4: Run the smoke to verify it passes**

Run: `npx tsx scripts/smoke-t3-desk.mts`
Expected: `[smoke t3-desk] 7 assertions passed`

- [ ] **Step 5: Persist + restore in the broker**

In `desktop/src/terminals.ts`, extend the imports:

```ts
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { getTerminals, setTerminals } from './config';
```

Add module-level state + helper beside `snapping`:

```ts
/** App quit in progress — the per-window 'closed' cascade must not persist
 *  a shrinking desk (quitting a 3-terminal desk would otherwise save 0). */
let quitting = false;
```

and beside `clampX`:

```ts
/** Write the live desk {id, wing, bounds} to config (desk persistence). */
function persistTerminals(): void {
  setTerminals(
    [...terminals.values()]
      .filter((t) => !t.win.isDestroyed())
      .map((t) => {
        const b = t.win.getBounds();
        return { id: t.id, wing: t.wing, x: b.x, y: b.y, width: b.width, height: b.height };
      }),
  );
}
```

In `settle()`, add as the last line (after `broadcastTopology();`):

```ts
  persistTerminals();
```

Then replace everything in `startTerminalsMode` from its opening brace down to (but excluding) the `// --- IPC: renderer ↔ broker ---` comment with (the IPC section and everything after it stays verbatim):

```ts
export function startTerminalsMode(count: number, rendererUrl: string): void {
  const settleTimers = new Map<string, NodeJS.Timeout>();

  function spawnTerminal(id: string, wing: string, x: number, y: number): void {
    const win = new BrowserWindow({
      width: TERMINAL_W,
      height: TERMINAL_H,
      x,
      y,
      resizable: false,
      backgroundColor: '#0a0a0a',
      show: false,
      frame: false, // frameless: the ground continues across the join, no title bar gap
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: false,
        nodeIntegration: true,
      },
    });
    win.once('ready-to-show', () => win.show());
    const sep = rendererUrl.includes('?') ? '&' : '?';
    void win.loadURL(`${rendererUrl}${sep}terminal=${id}&wing=${wing}`);
    win.webContents.on('will-navigate', (e, target) => {
      if (target !== win.webContents.getURL()) e.preventDefault();
    });

    const onMove = (): void => {
      if (snapping) return;
      const prev = settleTimers.get(id);
      if (prev) clearTimeout(prev);
      settleTimers.set(id, setTimeout(() => settle(id), SETTLE_MS));
    };
    win.on('move', onMove);
    win.on('closed', () => {
      terminals.delete(id);
      for (const [agent, where] of roster) if (where === id) roster.delete(agent);
      broadcastTopology();
      if (!quitting) persistTerminals();
    });

    terminals.set(id, { id, wing, win });
  }

  // ── Desk persistence: restore the set as it was left ────────────────────
  // LOKILIBRARY_TERMINALS still gates ENTERING terminals mode (main.ts);
  // once in, a persisted desk wins over the count — relaunch restores the
  // desk as you left it. LOKILIBRARY_TERMINALS_RESET=1 skips the restore
  // (the e2e/demo harness sets it for reproducible layouts).
  app.on('before-quit', () => {
    quitting = true;
  });
  const saved = process.env.LOKILIBRARY_TERMINALS_RESET ? undefined : getTerminals();
  const fromConfig: Array<{ id: string; wing: string; x: number; y: number }> = [];
  const seen = new Set<string>();
  for (const s of saved ?? []) {
    if (seen.has(s.id) || !WINGS.includes(s.wing)) continue; // hand-edited-config hygiene
    seen.add(s.id);
    fromConfig.push({ id: s.id, wing: s.wing, x: clampX(s.x), y: s.y });
  }
  const restored = fromConfig.length >= 2;
  let slots = fromConfig;
  if (!restored) {
    const n = Math.max(2, Math.min(count, WINGS.length));
    // Boot spread: fully apart when the chain fits the display; a clamped,
    // overlapping cascade when it doesn't (overlaps never join, so this only
    // changes where windows START — the user/e2e drags them into place).
    const wa = screen.getPrimaryDisplay().workArea;
    const spacing = Math.min(
      TERMINAL_W + 80,
      Math.max(40, Math.floor((wa.width - TERMINAL_W - 120) / Math.max(1, n - 1))),
    );
    slots = Array.from({ length: n }, (_, i) => ({
      id: `t${i + 1}`,
      wing: WINGS[i],
      x: clampX(60 + i * spacing),
      y: 160 + i * 36,
    }));
  }
  // eslint-disable-next-line no-console
  console.log(`[terminals] ${restored ? 'restoring desk' : 'spawning defaults'} — ${slots.length} terminal windows`);
  for (const s of slots) spawnTerminal(s.id, s.wing, s.x, s.y);
  broadcastTopology(); // a restored desk can boot already-joined
  persistTerminals();
```

*(This absorbs Task 2's spacing/clampX code into the default-slots branch; the per-window body is byte-equivalent to the old loop, with `x`/`y` now parameters and the persist line added to `closed`.)*

- [ ] **Step 6: Typecheck both legs + sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean, `smoke t3-desk` included.

- [ ] **Step 7: On-screen — the desk survives relaunch**

```bash
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_TERMINALS_RESET=1 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-persist-1.log 2>&1 & )
sleep 8
node scripts/e2e/t0-drive.mjs move t1 20 160
node scripts/e2e/t0-drive.mjs move t2 672 172        # snaps → joined at (660,160)
node scripts/e2e/t0-drive.mjs state                  # note bounds + joins [t1+t2]
osascript -e 'tell application "Electron" to quit'   # graceful quit → before-quit fires
sleep 3
cat "$HOME/Library/Application Support/lokilibrary-desktop/config.json"
# expected: "terminals": t1@(20,160) + t2@(660,160), both 640x520 — NOT empty
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-persist-2.log 2>&1 & )
sleep 8
node scripts/e2e/t0-drive.mjs state
osascript -e 'tell application "Electron" to quit'
```

Expected on relaunch, with NO moves driven: bounds identical to the saved desk; `joins` = `[{left:"t1",right:"t2"}]`; both windows' edges open and the seam continuous (the desk wakes joined).

- [ ] **Step 8: Commit**

```bash
git add desktop/src/config.ts desktop/src/terminals.ts scripts/smoke-t3-desk.mts
git commit -m "feat(terminals): desk persistence — terminal set restored across relaunch"
```

---

### Task 5: Tray "New terminal" (next unused wing)

Terminals mode never reaches main.ts's `createTray()` (the early return), so the mode gets its own minimal tray inside `terminals.ts` — "New terminal (dN)" + Quit. The tray item and a new `terminal:debugSpawn` IPC share one `spawnNext()` path, so the harness verifies the exact code the tray click runs. `main.ts` stays untouched.

**Files:**
- Modify: `desktop/src/terminals.ts` (electron imports; `trayIcon`; `nextIndex`/`nextWing`/`spawnNext`/`rebuildTray`; tray creation; `rebuildTray()` in `closed`; `terminal:debugSpawn` handler)
- Modify: `scripts/e2e/t0-drive.mjs` (`spawn` verb + usage line)

**Interfaces:**
- Produces: IPC `terminal:debugSpawn` → `string | null` (new terminal id, or null when all 6 wings are open); harness verb `node scripts/e2e/t0-drive.mjs spawn`.
- Consumes: `spawnTerminal`/`persistTerminals`/`clampX` (Task 4); `desktop/assets/tray-icon.png` (exists — same asset main.ts uses).

- [ ] **Step 1: Tray + spawnNext in the broker**

In `desktop/src/terminals.ts`, extend the electron import:

```ts
import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
```

Add module-level, beside `persistTerminals`:

```ts
/** Same asset + sizing as main.ts's createTray — desktop/assets/tray-icon.png,
 *  two levels up from desktop/dist. */
function trayIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(path.resolve(__dirname, '..', 'assets', 'tray-icon.png'));
  return icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
}
```

Inside `startTerminalsMode`, insert after the boot block (`persistTerminals();`) and before the `// --- IPC: renderer ↔ broker ---` section:

```ts
  // ── Tray: "New terminal" onto the next unused wing ──────────────────────
  // Terminals mode never reaches main.ts's createTray() (the early return),
  // so this is the mode's only tray. Plain action items — main.ts's
  // checkbox/radio auto-fire hazard doesn't apply here.
  let tray: Tray | null = null;
  let nextIndex =
    1 + [...terminals.keys()].reduce((m, id) => Math.max(m, Number(/^t(\d+)$/.exec(id)?.[1] ?? '0')), 0);

  function nextWing(): string | undefined {
    const used = new Set([...terminals.values()].map((t) => t.wing));
    return WINGS.find((w) => !used.has(w));
  }

  function spawnNext(): string | null {
    const wing = nextWing();
    if (!wing) return null;
    const id = `t${nextIndex++}`;
    const i = terminals.size;
    spawnTerminal(id, wing, clampX(60 + i * (TERMINAL_W + 80)), 160 + i * 36);
    persistTerminals();
    rebuildTray();
    return id;
  }

  function rebuildTray(): void {
    if (!tray) return;
    const wing = nextWing();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: wing ? `New terminal (${wing})` : 'New terminal — all wings open',
          enabled: wing !== undefined,
          click: () => void spawnNext(),
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]),
    );
  }

  tray = new Tray(trayIcon());
  tray.setToolTip('lokilibrary — terminals');
  rebuildTray();
```

In `spawnTerminal`'s `closed` handler, add after the persist guard (a close frees a wing, so the menu label must refresh):

```ts
      rebuildTray();
```

In the IPC section, add beside the other debug handlers:

```ts
  // Tray parity for the harness: the exact spawn path the tray item drives.
  ipcMain.handle('terminal:debugSpawn', () => spawnNext());
```

- [ ] **Step 2: `spawn` verb in the harness**

In `scripts/e2e/t0-drive.mjs`, add before the `else if (verb === 'shot')` branch:

```js
  } else if (verb === 'spawn') {
    const id = await evalAny(`(async()=>{const {ipcRenderer}=require('electron');return await ipcRenderer.invoke('terminal:debugSpawn');})()`);
    await sleep(800); // window boot
    console.log(JSON.stringify({ spawned: id, bounds: (await brokerState()).bounds }));
```

Update the header comment verb list and the usage error line to include `spawn`:

```js
    console.error('usage: t0-drive.mjs state | move <tid> <x> <y> | place <tid> <being> <x> <dir> | waitcross <being> [sec] | spawn | shot <out.png>');
```

- [ ] **Step 3: Typecheck both legs + sweep**

Run: `npm run typecheck && npm --prefix desktop run build && for f in scripts/smoke-*.mts; do npx tsx "$f" || break; done`
Expected: clean.

- [ ] **Step 4: On-screen verification**

```bash
( cd desktop && LOKILIBRARY_TERMINALS=2 LOKILIBRARY_TERMINALS_RESET=1 LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
  ./node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/loki-tray.log 2>&1 & )
sleep 8
node scripts/e2e/t0-drive.mjs spawn    # → {"spawned":"t3", bounds: [3 windows]}
node scripts/e2e/t0-drive.mjs state    # t3 present, wing d2, on-screen bounds
node scripts/e2e/t0-drive.mjs spawn && node scripts/e2e/t0-drive.mjs spawn && node scripts/e2e/t0-drive.mjs spawn
node scripts/e2e/t0-drive.mjs spawn    # 6 wings used → {"spawned":null,…}
```

Then the human beat: click the tray icon → "New terminal (…)" is disabled at 6 terminals; close a terminal window → the tray item re-enables with the freed wing; click it → a new window opens on that wing (identical code path to the `spawn` verb just verified). Quit via the tray Quit item; relaunch restores the enlarged desk (Task 4 + Task 5 composing).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/terminals.ts scripts/e2e/t0-drive.mjs
git commit -m "feat(terminals): tray New-terminal onto the next unused wing + debugSpawn verb"
```

---

## Self-Review

**Spec coverage:**
- (a) chains: `LOKILIBRARY_TERMINALS=3` boot fits the display (Task 2 spacing/clampX); middle ramps both edges + A→B→C hops + middle-out closes both joins → Task 2 e2e steps 3–6. Un-snap hysteresis: checked `computeSnapTarget`/`settle` — the broker DOES lack it (overlap-only capture re-snaps any vertical drag-out ≤260px); minimal stateless fix = `SNAP_Y_PX` band, TDD'd (Task 1) and asserted live (Task 2 step 6). ✓
- (d) demo: `scripts/e2e/join-demo.sh` — apart → drift → snap/knit → place → waitcross, frame loop + assembly checked against what this Mac actually has (ImageMagick yes, ffmpeg no) with a PNG-sequence fallback; output committed to `docs/demo/` (Task 3). ✓
- (b) persistence: `TerminalSlot` via the config.ts per-field pattern, persisted on settle/close/spawn, restored at boot; `readConfig` parses the field so unrelated writes can't strip it (smoke-locked); `quitting` flag guards the close cascade; `LOKILIBRARY_TERMINALS_RESET` keeps the harness reproducible; terminals-mode-only, no registry refactor (Task 4). ✓
- (c) tray: terminals-mode-only tray in terminals.ts (main.ts untouched — its tray never exists on this path); "New terminal" → next unused `WINGS` entry via `spawnNext()`, shared with `terminal:debugSpawn` for e2e (Task 5). ✓

**Placeholder scan:** none — every step carries full code.

**Type consistency:** `SNAP_Y_PX` defined (Task 1) and imported by the smoke; `TerminalSlot` defined once in config.ts, consumed by `persistTerminals`/restore in terminals.ts and by `smoke-t3-desk.mts` literals; `spawnTerminal(id, wing, x, y)` defined in Task 4, consumed by boot/restore (Task 4) and `spawnNext` (Task 5); `terminal:debugSpawn` returns `string | null` in both the handler and the `spawn` verb's use. Task 2's boot spacing is deliberately re-stated inside Task 4's rewrite so each task boundary compiles.

**Ordering:** Tasks run (a)→(d)→(b)→(c) per the value ranking — the demo artifact lands before persistence/tray. Task 3's script sets `LOKILIBRARY_TERMINALS_RESET=1` before the env exists (harmless), which makes the demo immune to Task 4's restore from day one. Task 4 rewrites the spawn block Task 2 touched — run in order, not interleaved.

**Risk notes:** `osascript … quit` (not SIGKILL) is required in Task 4's e2e so `before-quit` fires; the t3 window in Task 2's chain is partially offscreen on a 1440-wide display — all chain assertions are broker-state-based, with the screenshot only needing the two seams (both visible). If `magick` versions differ, the `-layers Optimize` flag is the only exotic bit — dropping it just yields a larger gif.

### Critical Files for Implementation

- /Users/henrydemontfort/code/projects/Lokilibrary/desktop/src/terminals.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/desktop/src/topology.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/desktop/src/config.ts
- /Users/henrydemontfort/code/projects/Lokilibrary/scripts/e2e/t0-drive.mjs
- /Users/henrydemontfort/code/projects/Lokilibrary/scripts/smoke-t0-topology.mts