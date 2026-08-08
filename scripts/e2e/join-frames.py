#!/usr/bin/env python3
"""Capture the desk as a frame sequence WITHOUT the desktop behind it.

Region capture (`screencapture -R`) grabs whatever is inside a rectangle, which
for a demo of two separated windows means the user's wallpaper, their icons and
their folder names end up in a file that ships in a public README. That is what
the 2026-07 join-moment GIF did. This composites each window's OWN bitmap
(`screencapture -l<id>`, occlusion-proof) onto a fixed neutral canvas at its
true relative position, so the drift and snap still read and nothing behind the
windows is ever sampled.

Fixed canvas, not a per-frame union: the windows move, and a canvas that
resized with them would make a GIF whose dimensions changed every frame.

Usage:  join-frames.py <outdir> <originX> <originY> <width> <height> [owner]
Stops when <outdir>/.run is deleted.
"""
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
out = Path(sys.argv[1])
OX, OY, CW, CH = (int(v) for v in sys.argv[2:6])
owner = sys.argv[6] if len(sys.argv) > 6 else "Electron"
BG = (16, 16, 18)          # neutral desk, not anyone's wallpaper
SCALE = 2                  # retina backing store

out.mkdir(parents=True, exist_ok=True)
run_flag = out / ".run"
pos_file = out / ".pos"

# Window IDs once. They are stable for the life of the windows; only positions
# move, and the caller publishes those (see below) because it is the thing
# issuing the moves.
rows = []
while run_flag.exists() and not rows:
    rows = subprocess.run(["swift", str(HERE / "termwins.swift"), owner],
                          capture_output=True, text=True).stdout.strip().splitlines()
    if not rows:
        time.sleep(0.2)
ids = [int(r.split()[0]) for r in rows]
fallback = [(int(r.split()[1]), int(r.split()[2])) for r in rows]


def positions():
    """Where to paste each window this frame.

    Read from `.pos` (written by the caller after every move) rather than by
    re-reading window geometry: `swift termwins.swift` costs 1.28s per call
    against 0.02s for an actual window capture, so polling it is what caps the
    loop at ~1 fps. Falls back to the geometry read at startup.
    """
    try:
        vals = [int(v) for v in pos_file.read_text().split()]
        return list(zip(vals[0::2], vals[1::2]))
    except Exception:
        return fallback


i = 0
while run_flag.exists():
    pos = positions()
    canvas = Image.new("RGB", (CW * SCALE, CH * SCALE), BG)
    with tempfile.TemporaryDirectory() as td:
        for n, num in enumerate(ids):
            f = Path(td) / f"{num}.png"
            subprocess.run(["screencapture", "-x", f"-l{num}", str(f)], capture_output=True)
            if not f.exists() or n >= len(pos):
                continue
            x, y = pos[n]
            canvas.paste(Image.open(f).convert("RGB"), ((x - OX) * SCALE, (y - OY) * SCALE))
    canvas.save(out / f"f{i:04d}.png", compress_level=1)
    i += 1
print(f"[join-frames] {i} frames -> {out}")
