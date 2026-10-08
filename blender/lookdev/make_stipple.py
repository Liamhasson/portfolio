"""Option 4 reworked: the chaos-cloud silhouette as a few hundred polished grains that hold their shape at logo size
(about 45 mm wide on the lid). Variable-radius Poisson-disc sampling: large, close grains inside; smaller, sparser
grains toward the edge; a few strays along the cloud's streak beyond it.
Run with Blender's bundled Python:  python3.13 blender/lookdev/make_stipple.py
Writes blender/lookdev/mark/stipple.json (x, y, r in a unit box, y up) and stipple-preview.png."""
import json, zlib, struct
import numpy as np

d = json.load(open("blender/lookdev/mark/h12/mark-outline.json"))
poly = np.array(d["points"]) * 0.78   # leave room for the strays inside the unit box
rng = np.random.default_rng(7)

def inside(p):
    x, y = p[..., 0], p[..., 1]
    res = np.zeros(x.shape, bool)
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        res ^= ((y1 > y) != (y2 > y)) & (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1)
    return res

def signed_dist(p):
    dmin = np.min(np.hypot(p[:, None, 0] - poly[None, :, 0], p[:, None, 1] - poly[None, :, 1]), axis=1)
    return np.where(inside(p), -dmin, dmin)

# streak direction: from the centroid to the outline point farthest right
cen = poly.mean(0)
tip = poly[np.argmax(poly[:, 0])]
streak = (tip - cen) / np.linalg.norm(tip - cen)

# candidates clumped along the cloud's own filaments: a fine noise field biases where grains may land
cand = rng.uniform(-0.5, 0.5, (90000, 2))
def vn(x, y):
    return (np.sin(x * 23.0 + 1.3) * np.sin(y * 19.0 + 0.7) + np.sin(x * 11.0 - y * 13.0 + 2.1)) * 0.25 + 0.5
cand = cand[rng.uniform(0, 1, len(cand)) < 0.35 + 0.65 * vn(cand[:, 0], cand[:, 1])]
sd = signed_dist(cand)
# acceptance: inside always; outside only near the edge, mostly along the streak side
along = np.clip(((cand - cen) @ streak) / 0.5, 0, 1)
ok = (sd < 0) | ((sd < 0.07) & (rng.uniform(0, 1, len(cand)) < 0.10 + 0.35 * along))
cand, sd = cand[ok], sd[ok]
order = rng.permutation(len(cand))
cand, sd = cand[order], sd[order]

def radius_for(s):
    depth = np.clip(-s / 0.14, 0, 1)            # 0 at the edge, 1 deep inside
    r = (0.0055 + 0.0055 * depth) * rng.uniform(0.75, 1.25)   # grain radius in the unit box (box = ~45 mm), varied
    return np.where(s > 0, 0.0055, r)

def spacing_for(s):
    depth = np.clip(-s / 0.14, 0, 1)
    gap = (0.009 - 0.0045 * depth) * rng.uniform(0.4, 1.4)    # uneven gaps: clumps and openings
    return np.where(s > 0, 0.03, gap)

pts, rad = [], []
cell = 0.03
grid = {}
for p, s in zip(cand, sd):
    r = float(radius_for(np.array([s]))[0]); g = float(spacing_for(np.array([s]))[0])
    cx, cy = int(p[0] // cell), int(p[1] // cell)
    clash = False
    for ix in range(cx - 2, cx + 3):
        for iy in range(cy - 2, cy + 3):
            for j in grid.get((ix, iy), ()):
                if np.hypot(*(p - pts[j])) < r + rad[j] + g:
                    clash = True; break
            if clash: break
        if clash: break
    if not clash:
        grid.setdefault((cx, cy), []).append(len(pts)); pts.append(p); rad.append(r)
pts = np.array(pts); rad = np.array(rad)
json.dump({"dots": [[float(a), float(b), float(r)] for (a, b), r in zip(pts, rad)], "box_mm": 45},
          open("blender/lookdev/mark/stipple.json", "w"))

def render(P, path):
    img = np.ones((P, P), np.float32) * 0.94
    yy, xx = np.mgrid[0:P, 0:P]
    for (a, b), r in zip(pts, rad):
        cx = (a + 0.5) * P; cy = (0.5 - b) * P; rr = r * P
        x0, x1 = max(0, int(cx - rr - 2)), int(cx + rr + 3); y0, y1 = max(0, int(cy - rr - 2)), int(cy + rr + 3)
        dd = np.hypot(xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy)
        cov = np.clip(rr + 0.5 - dd, 0, 1)
        img[y0:y1, x0:x1] = np.minimum(img[y0:y1, x0:x1], 0.94 - cov * 0.86)
    b = (img * 255).astype(np.uint8)
    raw = b"".join(b"\x00" + b[y].tobytes() for y in range(P))
    def chunk(t, dd): return struct.pack(">I", len(dd)) + t + dd + struct.pack(">I", zlib.crc32(t + dd) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", P, P, 8, 0, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

render(600, "blender/lookdev/mark/stipple-preview.png")
render(90, "blender/lookdev/mark/stipple-small.png")   # roughly how big it reads on screen
print(len(pts), "grains")
