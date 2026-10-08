"""Live sand vs its Blender render: side-by-side crop and numbers.
Run with Blender's Python (numpy):  python3.13 -I scripts/lab/compare_sand.py live.png render.png out.png [x y w h]"""
import subprocess, sys, json
import numpy as np

def load(path):
    w, h = 1600, 1000
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32) / 255

live, ref = load(sys.argv[1]), load(sys.argv[2])
x, y, w, h = (int(v) for v in sys.argv[4:8]) if len(sys.argv) > 7 else (0, 0, 1600, 1000)
L, R = live[y:y + h, x:x + w], ref[y:y + h, x:x + w]
lum = lambda a: a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
def box(a, r):
    k = 2 * r + 1
    c = np.cumsum(np.cumsum(np.pad(a, r + 1, mode="edge"), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k])[: a.shape[0], : a.shape[1]] / k / k
def stats(a):
    l = lum(a); m = l > 0.02                       # sand pixels
    fine = l - box(l, 2); coarse = box(l, 3) - box(l, 18)
    return dict(coverage=round(float(m.mean()), 3), mean_rgb=[round(float(v), 4) for v in a[m].mean(0)] if m.any() else None,
                p10=round(float(np.percentile(l[m], 10)), 4), p50=round(float(np.percentile(l[m], 50)), 4),
                p90=round(float(np.percentile(l[m], 90)), 4), grain_contrast=round(float(fine[m].std()), 4),
                structure_contrast=round(float(coarse[m].std()), 4))
lin = lambda a: np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
light = (lin(L).sum((0, 1)) / np.maximum(lin(R).sum((0, 1)), 1e-9)).round(3).tolist()   # total light, live / render, per channel
print(json.dumps({"live": stats(L), "render": stats(R), "light_ratio_rgb": light}, indent=1))
side = np.concatenate([L, np.ones((h, 6, 3), np.float32), R], axis=1)
raw = (np.clip(side, 0, 1) * 255).astype(np.uint8).tobytes()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{side.shape[1]}x{side.shape[0]}", "-i", "-", sys.argv[3]],
               input=raw, check=True)
