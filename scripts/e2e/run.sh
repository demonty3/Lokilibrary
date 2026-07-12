#!/usr/bin/env bash
# Deterministic E2E harness for the Lokilibrary renderer.
#
# Builds a PRODUCTION bundle with the `window.__loki` debug hook
# (VITE_E2E=1 → no HMR, no StrictMode double-invoke, ONE module graph), serves
# it via `vite preview`, and launches headless Chrome with CDP. This removes the
# dev-server non-determinism (per-module instances, HMR listener churn) that made
# CDP probing unreliable. Drive it with scripts/e2e/drive.mjs.
#
# Why production preview, not dev: the contradictory readings during multi-pane
# debugging came from Vite dev serving each `import('/src/…')` as a distinct
# module instance + React StrictMode double-mounting effects. A built bundle has
# exactly one instance of everything and no StrictMode re-runs.
#
# GOTCHA (2026-07-12): vite.config.ts defines the /api proxy only under
# `server:` (dev), not `preview:` — so this harness NEVER has a real Steam
# library: auth fails, store.library stays null, and shelves render from the
# hard-coded SAMPLE_LIBRARY fallback (a separate code path). Driver scripts
# needing real appids must use src/data/sampleLibrary.ts's constants, not
# __loki.store.getState().library (always empty here).
#
# Flags: --no-build reuses the existing dist/ (faster when only re-driving).
# Logs: /tmp/loki-e2e-preview.log, /tmp/loki-e2e-chrome.log
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PREVIEW_PORT="${LOKI_E2E_PORT:-4173}"
CDP_PORT="${LOKI_E2E_CDP:-9334}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

cd "$ROOT"

if [[ "${1:-}" != "--no-build" ]]; then
  echo "build: VITE_E2E=1 vite build…"
  VITE_E2E=1 npx vite build >/tmp/loki-e2e-build.log 2>&1 || { echo "BUILD FAILED — tail:"; tail -20 /tmp/loki-e2e-build.log; exit 1; }
  echo "build: ok ($(grep -c '' dist/index.html 2>/dev/null || echo '?') lines index.html)"
fi

# Preview server — restart it so it serves the fresh dist/.
pkill -f "vite preview --port ${PREVIEW_PORT}" 2>/dev/null || true
sleep 1
echo "preview: starting on :${PREVIEW_PORT}…"
( cd "$ROOT" && nohup npx vite preview --port "${PREVIEW_PORT}" --strictPort >/tmp/loki-e2e-preview.log 2>&1 & )
for i in $(seq 1 40); do sleep 0.5; curl -s -o /dev/null "http://localhost:${PREVIEW_PORT}/" 2>/dev/null && break; done
echo "preview: up at http://localhost:${PREVIEW_PORT}/"

# Headless Chrome with CDP. Real GPU path (WebGL renders; captureScreenshot works
# in headless=new, unlike Electron's surface stall).
pkill -f "loki-e2e-chrome-profile" 2>/dev/null || true
sleep 1
echo "chrome: launching headless (CDP :${CDP_PORT})…"
"$CHROME" --headless=new --remote-debugging-port="${CDP_PORT}" \
  --window-size=1440,820 --hide-scrollbars \
  --user-data-dir=/tmp/loki-e2e-chrome-profile about:blank \
  >/tmp/loki-e2e-chrome.log 2>&1 &
for i in $(seq 1 30); do sleep 0.5; curl -s -o /dev/null "http://localhost:${CDP_PORT}/json/version" 2>/dev/null && break; done
echo "READY — preview :${PREVIEW_PORT}, CDP :${CDP_PORT}. Drive: node scripts/e2e/drive.mjs <verb>"
