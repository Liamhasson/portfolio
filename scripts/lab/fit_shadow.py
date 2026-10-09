"""Fits the ball's desk shadow (lamp radius, strength, the ball's effective solid size) to the render, on the desk
around the ball. python3.13 -I scripts/lab/fit_shadow.py"""
import json, subprocess, itertools
import numpy as np
REF = "blender/lookdev/renders/targets/settle/settle/f_0048.png"
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vf", "scale=1600:1000", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(1000, 1600, 3).astype(np.float64) / 255
    return np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92) @ np.array([0.2126, 0.7152, 0.0722])
yy, xx = np.mgrid[0:1000, 0:1600]
# the desk around the ball, excluding the ball itself
MASK = ((xx - 802) ** 2 + (yy - 312) ** 2 > 215 ** 2) & (xx > 560) & (xx < 1250) & (yy > 300) & (yy < 820)
ref = load(REF)
def score(path):
    L = load(path)
    # compare on a coarse grid (the plates differ in fine detail): 8x8 px blocks of log luminance
    a = np.log(L + 0.003); b = np.log(ref + 0.003); m = MASK
    return float(((a - b)[m] ** 2).mean())
cands = list(itertools.product([0.8, 1.4, 2.0, 3.0], [0.5, 0.7, 0.9], [0.55, 0.7, 0.85, 1.0]))
looks = [json.dumps({"shadow": list(c)}) for c in cands]
open("test-results/sand/sh-sets.txt", "w").write("\n".join(looks))
subprocess.run(["node", "scripts/lab/st-calib.mjs", "48", "@", "test-results/sand/sh-sets.txt"], check=True, capture_output=True)
scores = [score(f"test-results/sand/st-48-{i}.png") for i in range(len(cands))]
o = np.argsort(scores)
for i in o[:5]: print(round(scores[i], 4), cands[i])
json.dump({"shadow": list(cands[o[0]])}, open("test-results/sand/shadow-best.json", "w"))
