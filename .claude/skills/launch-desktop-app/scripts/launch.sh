#!/usr/bin/env bash
# Launch the Lokilibrary Electron desktop app on macOS with CDP enabled.
#
# Brings up two processes: the Vite renderer (localhost:5183) and the Electron
# wrapper pointed at it, with --remote-debugging-port=9222 so drive.mjs can
# attach. Idempotent: reuses an already-running Vite, and replaces any existing
# CDP-debugged Electron instance.
#
# Logs: /tmp/loki-vite.log and /tmp/loki-electron.log
# After this returns "READY", drive it with scripts/drive.mjs.
set -euo pipefail

# repo root = four dirs up from this script (.claude/skills/<name>/scripts/)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
RENDERER_URL="http://localhost:5183"
CDP_PORT="${LOKI_CDP_PORT:-9222}"

echo "repo: $ROOT"

# 1. Vite renderer — start only if not already serving.
if curl -s -o /dev/null -w '%{http_code}' "$RENDERER_URL/" 2>/dev/null | grep -q 200; then
  echo "vite: already up at $RENDERER_URL"
else
  echo "vite: starting…"
  ( cd "$ROOT" && nohup npm run dev > /tmp/loki-vite.log 2>&1 & )
  for i in $(seq 1 40); do
    sleep 0.5
    curl -s -o /dev/null "$RENDERER_URL/" 2>/dev/null && break
  done
  echo "vite: up at $RENDERER_URL"
fi

# 2. Build the desktop main process (tsc → dist/).
echo "desktop: building (tsc)…"
( cd "$ROOT/desktop" && npx tsc )

# 3. Replace any existing CDP-debugged Electron, then launch.
pkill -f "remote-debugging-port=${CDP_PORT}" 2>/dev/null || true
sleep 1
echo "electron: launching (CDP :$CDP_PORT)…"
(
  cd "$ROOT/desktop"
  LOKILIBRARY_RENDERER_URL="$RENDERER_URL" \
    nohup ./node_modules/.bin/electron . --remote-debugging-port="$CDP_PORT" \
    > /tmp/loki-electron.log 2>&1 &
)

# 4. Wait for CDP + a rendered canvas.
for i in $(seq 1 40); do
  sleep 0.5
  curl -s -o /dev/null "http://localhost:$CDP_PORT/json/version" 2>/dev/null && break
done
sleep 3  # let the BrowserWindow load the renderer + PixiJS boot

echo "--- electron boot log ---"
grep -iE "startup|steamworks|wallpaper|DevTools" /tmp/loki-electron.log | head || true
echo "READY — CDP on :$CDP_PORT. Drive with scripts/drive.mjs (run 'window' first to enable keybinds)."
