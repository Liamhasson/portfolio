"""Derive the lid mark from the approved hero frame: the sand cloud's silhouette, smoothed into a clean flat shape.

Run with Blender's bundled Python (numpy):
  /Applications/Blender.app/Contents/Resources/5.1/python/bin/python3.13 blender/lookdev/make_mark.py SRC.jpg OUT_DIR [blur] [threshold]

Writes OUT_DIR/mark.svg (the outline as a smooth closed path), OUT_DIR/mark-preview.png, and OUT_DIR/mark-outline.json
(normalised points, used to build the inlay in Blender).
"""

import json
import subprocess
import sys
import zlib
import struct

import numpy as np

src, out = sys.argv[1], sys.argv[2]
BLUR = int(sys.argv[3]) if len(sys.argv) > 3 else 22
THRESH = float(sys.argv[4]) if len(sys.argv) > 4 else 0.16
W = 800

# --- load as luminance
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={W}:-2,format=gray", "-f", "rawvideo", "-"],
                     capture_output=True, check=True).stdout
H = len(raw) // W
img = np.frombuffer(raw, np.uint8)[: W * H].reshape(H, W).astype(np.float32) / 255.0

# --- the sand's mass: density of bright grains, blurred into a soft field
def box(a, r):
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in (0, 1)], mode="edge"), axis=axis)
        a = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return a

grains = (img > 0.08).astype(np.float32)
field = box(box(box(grains, BLUR), BLUR), BLUR)
mask = field > THRESH

# keep the largest connected region
lab = np.zeros(mask.shape, np.int32)
nxt = 1
sizes = {}
for y0 in range(H):
    for x0 in range(W):
        if mask[y0, x0] and not lab[y0, x0]:
            stack = [(y0, x0)]; lab[y0, x0] = nxt; n = 0
            while stack:
                y, x = stack.pop(); n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = nxt; stack.append((yy, xx))
            sizes[nxt] = n; nxt += 1
big = max(sizes, key=sizes.get)
mask = lab == big

# --- trace the boundary (Moore neighbourhood), then smooth and resample it
ys, xs = np.nonzero(mask)
start = (ys.min(), xs[ys == ys.min()].min())
dirs = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
def inside(p):
    y, x = p
    return 0 <= y < H and 0 <= x < W and mask[y, x]
boundary = [start]; cur = start; back = 6
for _ in range(200000):
    found = False
    for k in range(8):
        d = (back + 1 + k) % 8
        p = (cur[0] + dirs[d][0], cur[1] + dirs[d][1])
        if inside(p):
            back = (d + 4) % 8; cur = p; found = True; break
    if not found or cur == start:
        break
    boundary.append(cur)
pts = np.array([(x, y) for y, x in boundary], np.float64)

# resample evenly, then a strong circular smoothing so the outline reads as one clean, organic shape
seg = np.r_[0, np.cumsum(np.hypot(*np.diff(np.vstack([pts, pts[:1]]), axis=0).T))]
N = 400
t = np.linspace(0, seg[-1], N, endpoint=False)
closed = np.vstack([pts, pts[:1]])
res = np.c_[np.interp(t, seg, closed[:, 0]), np.interp(t, seg, closed[:, 1])]
F = np.fft.rfft(res[:, 0] + 1j * res[:, 1]) if False else None
z = res[:, 0] + 1j * res[:, 1]
Z = np.fft.fft(z)
keep = 18                                # number of harmonics kept: lower = simpler, rounder shape
Z[keep + 1: N - keep] = 0
smooth = np.fft.ifft(Z)
sx, sy = smooth.real, smooth.imag

# normalise to a unit box, centred
minx, maxx, miny, maxy = sx.min(), sx.max(), sy.min(), sy.max()
s = max(maxx - minx, maxy - miny)
nx = (sx - (minx + maxx) / 2) / s
ny = (sy - (miny + maxy) / 2) / s

# --- outputs
import os
os.makedirs(out, exist_ok=True)
json.dump({"points": [[float(a), float(-b)] for a, b in zip(nx, ny)], "aspect": float((maxx - minx) / (maxy - miny))},
          open(os.path.join(out, "mark-outline.json"), "w"))
d = "M " + " L ".join(f"{(a + 0.5) * 1000:.1f} {(b + 0.5) * 1000:.1f}" for a, b in zip(nx, ny)) + " Z"
open(os.path.join(out, "mark.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="{d}" fill="#111"/></svg>\n')

# preview: the source frame with the outline drawn over it, plus the flat mark
prev = np.stack([img, img, img], -1)
for a, b in zip(sx, sy):
    yy, xx = int(round(b)), int(round(a))
    if 1 <= yy < H - 1 and 1 <= xx < W - 1:
        prev[yy - 1:yy + 2, xx - 1:xx + 2] = (0.95, 0.65, 0.55)
P = 400
poly = np.c_[(nx + 0.5) * P * 0.8 + P * 0.1, (ny + 0.5) * P * 0.8 + P * 0.1]
yy, xx = np.mgrid[0:P, 0:P].astype(np.float64)
inside_ = np.zeros((P, P), bool)
for i in range(len(poly)):                      # even-odd ray casting, vectorised over pixels
    x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
    cond = ((y1 > yy) != (y2 > yy)) & (xx < (x2 - x1) * (yy - y1) / (y2 - y1 + 1e-12) + x1)
    inside_ ^= cond
flat = np.ones((P, P, 3), np.float32) * 0.94
flat[inside_] = (0.08, 0.08, 0.09)
side = np.ones((H, W + P + 20, 3), np.float32) * 0.94
side[:, :W] = prev
oy = max(0, (H - P) // 2)
side[oy:oy + P, W + 20:W + 20 + P] = flat[: min(P, H - oy)]

def write_png(path, rgb):
    h, w = rgb.shape[:2]
    b = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    raw_ = b"".join(b"\x00" + b[y].tobytes() for y in range(h))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw_, 9)) + chunk(b"IEND", b""))

write_png(os.path.join(out, "mark-preview.png"), side)
print("wrote", out, "harmonics", keep, "points", len(nx))
