"""Fits the formed ball's shading on the desk (end of the settle) to the Cycles target, by coordinate search over look
parameters. Grid over the ball only. python3.13 -I scripts/lab/fit_ball.py [rounds] [name=value,...]"""
import json, subprocess, sys
import numpy as np
REF = "blender/lookdev/renders/targets/settle/settle/f_0048.png"
X, Y, W, H, C, R = 600, 70, 420, 460, 3, 3
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vf", "scale=1600:1000", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(1000, 1600, 3).astype(np.float64) / 255
    return np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
lum = np.array([0.2126, 0.7152, 0.0722])
# only pixels inside the ball (the render's desk has the ball's shadow, the live plate doesn't yet)
CX, CY, CR = 802, 312, 198
yy, xx = np.mgrid[0:1000, 0:1600]
INSIDE = (xx - CX) ** 2 + (yy - CY) ** 2 < CR ** 2
def cells(A):
    out = []
    for j in range(R):
        for i in range(C):
            ys, xs = slice(CY - CR + j * 2 * CR // R, CY - CR + (j + 1) * 2 * CR // R), slice(CX - CR + i * 2 * CR // C, CX - CR + (i + 1) * 2 * CR // C)
            m = INSIDE[ys, xs]
            c = A[ys, xs][m] if m.sum() > 200 else A[ys, xs].reshape(-1, 3)
            l = c @ lum; s = c.mean(0)
            out.append((s @ lum, s[1] / max(s[0], 1e-6), np.percentile(l, 50), np.percentile(l, 90)))
    return np.array(out)
ref = cells(load(REF))
def score(path):
    live = cells(load(path))
    e = np.log((live[:, 0] + .003) / (ref[:, 0] + .003)); w = live[:, 1] - ref[:, 1]
    d50 = np.log((live[:, 2] + .003) / (ref[:, 2] + .003)); d90 = np.log((live[:, 3] + .003) / (ref[:, 3] + .003))
    return float((e ** 2).mean() + 40 * (w ** 2).mean() + 0.5 * (d50 ** 2).mean() + 0.5 * (d90 ** 2).mean())
P = [["shadowK", 0.8, "mul", 1.4, (0.05, 4)], ["cavity", 0.3, "add", 0.15, (0, 1)], ["wrap", 0.375, "add", 0.2, (0, 2.5)],
     ["bounce", 0.12, "mul", 1.5, (0.01, 3)], ["exposure", 1.0, "mul", 1.2, (0.3, 4)], ["radScale", 1.1, "mul", 1.1, (0.7, 1.6)],
     ["filter", 0.28, "add", 0.1, (0.1, 1.0)], ["spec", 0.016, "mul", 2, (0.001, 0.5)], ["cavityDepth", 0.1, "mul", 1.4, (0.03, 0.5)],
     ["bnc", 0.5, "mul", 1.6, (0.0, 20)], ["br", 0.5, "mul", 1.5, (0.1, 3)], ["lamp", 0.244, "mul", 1.25, (0.05, 2)], ["sat", 0.2, "add", 0.15, (0, 1)],
     ["by", -0.12, "add", 0.05, (-0.35, 0.05)], ["bz", 0.0, "add", 0.03, (0.0, 0.12)], ["bg", 0.62, "add", 0.08, (0.4, 0.9)],
     ["ground", 0.3, "mul", 1.5, (0.0, 20)], ["groundG", 0.62, "add", 0.08, (0.35, 0.9)]]
def look(v):
    d = {p[0]: x for p, x in zip(P, v)}
    # the desk under the ball, lit by the lamp, bounces warm light up into it
    bg = d.pop("bg")
    desk = {"radii": [0.573, 1.2, d.pop("br")], "spotDeg": 116, "blend": 1.0, "bouncePos": [0.0, d.pop("by"), d.pop("bz")],
            "bounceColor": [1.0, bg, bg * 0.58]}
    d["gains"] = [d.pop("lamp"), 1.0, d.pop("bnc")]; d["desk"] = desk
    return json.dumps(d)
def evaluate(vs):
    open("test-results/sand/st-sets.txt", "w").write("\n".join(look(v) for v in vs))
    subprocess.run(["node", "scripts/lab/st-calib.mjs", "48", "@", "test-results/sand/st-sets.txt"], check=True, capture_output=True)
    return [score(f"test-results/sand/st-48-{i}.png") for i in range(len(vs))]
def move(v, k, sg, sc):
    v = list(v); _, _, kind, step, (lo, hi) = P[k]
    v[k] = v[k] * (step ** sc) ** sg if kind == "mul" else v[k] + sg * step * sc
    v[k] = min(max(v[k], lo), hi); return v
best = [p[1] for p in P]
if len(sys.argv) > 2:
    st = dict(kv.split("=") for kv in sys.argv[2].split(",")); best = [float(st.get(p[0], p[1])) for p in P]
bs = evaluate([best])[0]; print("start", round(bs, 4), flush=True); sc = 1.0
for r in range(int(sys.argv[1]) if len(sys.argv) > 1 else 10):
    cands = [move(best, k, s, sc) for k in range(len(P)) for s in (1, -1)]
    scores = evaluate(cands); o = int(np.argmin(scores))
    if scores[o] < bs: best, bs = cands[o], scores[o]
    else: sc *= 0.5
    print(f"round {r}: {bs:.4f}", {p[0]: round(x, 3) for p, x in zip(P, best)}, flush=True)
open("test-results/sand/ball-best.json", "w").write(look(best)); print("BEST", look(best))
