"""The desk spill's rest spots for the live rising sand (spec 2026-10-11 §5): pallet.spill_points on the desk as built,
shuffled, capped at 30 000 -> public/lab/sand/desk-spill.bin (float32 x, y, z, hue per spot; desk metres, Blender z-up).
Runs through lookdev.py's LOOKDEV_LIST hook on the desk scene:

  LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/export_spill.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene desk --out /tmp/x
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pallet import spill_points  # noqa: E402

rng = np.random.default_rng(23)
hh = rng.uniform(0.45, 0.9, 10000).astype(np.float32)   # (no sand object in this scene: the spill's own hue range)
pts, hue, _r = spill_points(np, rng, hh, True)
# the note the camera passes ("Who is this product for?", lookdev.py sticky_hero: 7.6 cm, at (0.075, -0.095), turned -0.21)
# stays clear, so its handwriting reads (Liam, 2026-10-11)
ca, sa = np.cos(0.21), np.sin(0.21)
u = (pts[:, 0] - 0.075) * ca - (pts[:, 1] + 0.095) * sa
v = (pts[:, 0] - 0.075) * sa + (pts[:, 1] + 0.095) * ca
clear = ~((np.abs(u) < 0.042) & (np.abs(v) < 0.042))
pts, hue = pts[clear], hue[clear]
order = rng.permutation(len(pts))[:30000]
out = np.concatenate([pts[order], hue[order, None]], 1).astype("<f4")
dst = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "lab", "sand", "desk-spill.bin"))
out.tofile(dst)
print("SPILL", len(out), "spots ->", dst, "z range", float(pts[:, 2].min()), float(pts[:, 2].max()), flush=True)
sys.exit(0)
