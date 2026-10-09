"""Fits the live sand's desk lighting to the Cycles pull-back render (frame 60) by coordinate search.
Each round captures every candidate in one browser session (scripts/lab/pb-calib.mjs) and scores it on a grid:
log-luminance error per cell plus warmth (G/R) error. Run with Blender's Python (numpy):
  python3.13 -I scripts/lab/fit_desk_light.py [rounds=7]"""
import json, subprocess, sys
import numpy as np

import os
LAMP_ONLY = bool(os.environ.get("LAMP_ONLY"))   # fit the lamp alone against the lamp-only render (rim, bounce off)
REF = "blender/lookdev/renders/targets/pb-lamp/pullback/f_0060.png" if LAMP_ONLY else "blender/lookdev/renders/targets/pb/pullback/f_0060.png"
X, Y, W, H, C, R = (100, 0, 1200, 440, 6, 3) if LAMP_ONLY else (100, 0, 1200, 580, 6, 4)

def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vf", "scale=1600:1000", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(1000, 1600, 3).astype(np.float64) / 255
    return np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)

def cells(A):
    lum = np.array([0.2126, 0.7152, 0.0722]); out = []
    for j in range(R):
        for i in range(C):
            c = A[Y + j * H // R: Y + (j + 1) * H // R, X + i * W // C: X + (i + 1) * W // C].reshape(-1, 3)
            s = c.mean(0); l = c @ lum; sand = l[l > 0.002]
            p50, p90 = (np.percentile(sand, 50), np.percentile(sand, 90)) if len(sand) > 50 else (0.0, 0.0)
            out.append((s @ lum, s[1] / max(s[0], 1e-6), p50, p90))
    return np.array(out)

ref = cells(load(REF))

def score(path):
    live = cells(load(path))
    m = (ref[:, 0] > 0.002) | (live[:, 0] > 0.002)
    lerr = np.log((live[m, 0] + 0.003) / (ref[m, 0] + 0.003))
    werr = (live[m, 1] - ref[m, 1]) * np.sqrt(np.clip(ref[m, 0] / ref[m, 0].max(), 0.05, 1))
    # how the light is spread over the grains: median and brightest tenth of the sand pixels, per cell
    d50 = np.log((live[m, 2] + 0.004) / (ref[m, 2] + 0.004)); d90 = np.log((live[m, 3] + 0.004) / (ref[m, 3] + 0.004))
    return float((lerr ** 2).mean() + float(os.environ.get("WARM_W", 25)) * (werr ** 2).mean() + 0.5 * (d50 ** 2).mean() + 0.5 * (d90 ** 2).mean())

# parameters: name, start, kind ("mul" or "add"), step, bounds
P = [["lamp", 0.55, "mul", 1.35, (0.05, 5)], ["rim", 0.3, "mul", 1.6, (0.005, 4)], ["bnc", 0.4, "mul", 1.4, (0.0, 5)],
     ["shadowKChaos", 0.45, "mul", 1.4, (0.05, 4)], ["wrap", 0.9, "add", 0.2, (0, 2.5)], ["sat", 0.0, "add", 0.1, (0, float(os.environ.get("SAT_MAX", 1)))],
     ["bounce", 0.35, "mul", 1.4, (0.0, float(os.environ.get("BOUNCE_MAX", 3)))], ["bx", 0.0, "add", 0.08, (-0.4, 0.4)], ["by", -0.12, "add", 0.08, (-0.4, 0.3)],
     ["bg", 0.6, "add", 0.08, (0.35, 0.95)], ["lr", 2.0, "mul", 1.5, (0.3, 8)],
     ["localOcclusion", 0.1, "mul", 1.6, (0.01, 2)], ["spec", 0.01, "mul", 2.0, (0.001, 0.5)],
     ["filter", 0.6, "add", 0.15, (0.2, 1.4)], ["radScaleChaos", 1.15, "mul", 1.12, (0.7, 1.8)],
     ["spotDeg", 140, "add", 12, (85, 179)], ["blend", 0.85, "add", 0.1, (0.1, 1.0)]]

def setstr(v):
    d = dict(zip([p[0] for p in P], v))
    look = {"shadowKChaos": d["shadowKChaos"], "wrap": d["wrap"], "sat": d["sat"], "bounce": d["bounce"],
            "localOcclusion": d["localOcclusion"], "spec": d["spec"], "filter": d["filter"], "radScaleChaos": d["radScaleChaos"],
            "desk": {"bouncePos": [d["bx"], d["by"], 0.0], "bounceColor": [1.0, d["bg"], d["bg"] * 0.57], "radii": [d["lr"], 1.2, 3.0], "spotDeg": d["spotDeg"], "blend": d["blend"]}}
    if LAMP_ONLY: d["rim"] = d["bnc"] = 0.0
    return f'{d["lamp"]:.4f},{d["rim"]:.4f},{d["bnc"]:.4f}|{json.dumps(look)}'

def evaluate(vs):
    open("test-results/sand/fit-sets.txt", "w").write("\n".join(setstr(v) for v in vs))
    subprocess.run(["node", "scripts/lab/pb-calib.mjs", "60", "@", "test-results/sand/fit-sets.txt"], check=True, capture_output=True)
    return [score(f"test-results/sand/pb-60-{i}.png") for i in range(len(vs))]

def move(v, k, sign, scale):
    v = list(v); name, _, kind, step, (lo, hi) = P[k]
    s = step ** scale if kind == "mul" else step * scale
    v[k] = v[k] * s ** sign if kind == "mul" else v[k] + sign * s
    v[k] = min(max(v[k], lo), hi); return v

best = [p[1] for p in P]
if len(sys.argv) > 2:   # resume from a previous fit: name=value,...
    start = dict(kv.split("=") for kv in sys.argv[2].split(","))
    best = [float(start.get(p[0], p[1])) for p in P]
best_s = evaluate([best])[0]
print("start", round(best_s, 4), flush=True)
rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 7
scale = 1.0
for r in range(rounds):
    skip = {"rim", "bnc", "bx", "by", "bg"} if LAMP_ONLY else set()
    cands = [move(best, k, s, scale) if P[k][0] not in skip else best for k in range(len(P)) for s in (1, -1)]
    scores = evaluate(cands)
    order = np.argsort(scores)
    if scores[order[0]] < best_s:
        # take the best move, then try stacking the next improving ones on top of it
        best, best_s = cands[order[0]], scores[order[0]]
        improving = [i for i in order[1:6] if scores[i] < best_s + 0.02 and (i // 2) != (order[0] // 2)]
        if improving:
            combo = best
            for i in improving:
                combo = move(combo, i // 2, 1 if i % 2 == 0 else -1, scale)
            cs = evaluate([combo])[0]
            if cs < best_s: best, best_s = combo, cs
    else:
        scale *= 0.5
    print(f"round {r}: {best_s:.4f} scale {scale}", {p[0]: round(x, 3) for p, x in zip(P, best)}, flush=True)
open("test-results/sand/fit-best.txt", "w").write(setstr(best))
print("BEST", setstr(best))
