#!/usr/bin/env bash
# V0 "Terminal Terraria" acceptance-shot matrix (PRD validation spike).
# Assumes scripts/e2e/run.sh is READY. Output: /tmp/loki-v0-shots/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
OUT=/tmp/loki-v0-shots
mkdir -p "$OUT"

shot() { # shot <theme> <seed-js> <name>
  local theme="$1" seed="$2" name="$3"
  node scripts/e2e/drive.mjs eval "__loki.setTheme('${theme}')" >/dev/null
  sleep 3 # palace remount settles
  node scripts/e2e/drive.mjs eval "__loki.previewLand(${seed})" >/dev/null
  for i in $(seq 1 20); do
    s="$(node scripts/e2e/drive.mjs eval '__loki.landMuralState()')"
    case "$s" in *ready*|*failed*) break ;; esac
    sleep 1
  done
  echo "mural[${name}]: ${s}"
  # Hide the DOM HUD for clean hero shots (idempotent; per-shot because a
  # theme swap can re-render it).
  node scripts/e2e/drive.mjs eval "document.querySelectorAll('[data-hud]').forEach((el) => { el.style.display = 'none' })" >/dev/null
  node scripts/e2e/drive.mjs shot "${OUT}/${name}.png"
}

shot phosphor 0xca11ed v0-phosphor-ca11ed
shot phosphor 7 v0-phosphor-seed7
shot ibm-3270 0xca11ed v0-ibm3270-ca11ed
shot solarized-dark 0xca11ed v0-solarized-ca11ed

# Determinism spot-check: re-shoot the hero seed, byte-compare.
shot phosphor 0xca11ed v0-phosphor-ca11ed-rerun
if cmp -s "${OUT}/v0-phosphor-ca11ed.png" "${OUT}/v0-phosphor-ca11ed-rerun.png"; then
  echo "determinism: PASS (byte-identical re-render)"
else
  echo "determinism: DIFFER (inspect — may be HUD/animation, not the land)"
fi
ls -la "$OUT"
