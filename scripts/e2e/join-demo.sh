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
