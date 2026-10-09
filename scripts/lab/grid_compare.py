"""Where live and render differ: a grid of mean linear luminance (sand pixels) and warmth (G/R), live vs render.
python3.13 -I scripts/lab/grid_compare.py live.png render.png [x y w h] [cols rows]"""
import subprocess, sys
import numpy as np
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vf", "scale=1600:1000", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(1000, 1600, 3).astype(np.float64) / 255
    return np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
L, R = load(sys.argv[1]), load(sys.argv[2])
x, y, w, h = (int(v) for v in sys.argv[3:7]) if len(sys.argv) > 6 else (100, 0, 1100, 560)
cols, rows = (int(v) for v in sys.argv[7:9]) if len(sys.argv) > 8 else (5, 3)
lum = np.array([0.2126, 0.7152, 0.0722])
for name, A in (("live", L), ("render", R)):
    print(name)
    for j in range(rows):
        cells = []
        for i in range(cols):
            c = A[y + j * h // rows: y + (j + 1) * h // rows, x + i * w // cols: x + (i + 1) * w // cols].reshape(-1, 3)
            m = c @ lum > 0.003
            if m.sum() < 50: cells.append("    -    "); continue
            s = c[m].mean(0)
            cells.append("%.3f/%.2f" % (s @ lum, s[1] / s[0]))
        print("  " + "  ".join(cells))
