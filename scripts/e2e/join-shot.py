#!/usr/bin/env python3
"""Occlusion-proof capture of ALL terminal windows, composited by their real
desktop positions into one image.

Region `screencapture -R` grabs whatever is frontmost in the rectangle, so a
stray system dialog photobombs the shot. This captures each Electron window's
OWN bitmap by CGWindowID (`screencapture -l`) — z-order irrelevant — then
pastes them onto one canvas at their true relative offsets, so a joined seam
renders exactly as it sits on the desktop.

Usage: python3 scripts/e2e/join-shot.py out.png [OwnerName]
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/loki-join-shot.png")
owner = sys.argv[2] if len(sys.argv) > 2 else "Electron"

rows = subprocess.run(
    ["swift", str(HERE / "termwins.swift"), owner],
    capture_output=True, text=True, check=True,
).stdout.split()
wins = [tuple(map(int, rows[i:i + 5])) for i in range(0, len(rows), 5)]
if not wins:
    sys.exit("no terminal windows found")

shots = []
with tempfile.TemporaryDirectory() as td:
    for num, x, y, w, h in wins:
        f = Path(td) / f"{num}.png"
        subprocess.run(["screencapture", "-x", f"-l{num}", str(f)], check=True)
        shots.append((Image.open(f).copy(), x, y, w, h))

# Retina: bitmaps are scale× the point bounds; derive per-window and use the
# first window's scale for the canvas grid.
scale = shots[0][0].width / shots[0][3]
minx = min(s[1] for s in shots)
miny = min(s[2] for s in shots)
cw = max(int((s[1] - minx + s[3]) * scale) for s in shots)
ch = max(int((s[2] - miny + s[4]) * scale) for s in shots)
canvas = Image.new("RGB", (cw, ch), (10, 10, 10))
for img, x, y, w, h in shots:
    canvas.paste(img, (int((x - minx) * scale), int((y - miny) * scale)))
canvas.save(out)
print(f"wrote {out} ({cw}x{ch}, {len(shots)} windows)")
