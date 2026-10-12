"""Half-size copies of the desk's data maps (normals, roughness) and the screen's still, for phones (Liam, 2026-10-13:
GPU memory; src/three/sand/baked-desk.ts deskFiles `half`). The lighting bakes are KTX2 already and stay as they are.
Run by desk3d-publish.py last (after the screen's posters).
  python3 scripts/lab/desk3d-half.py"""
import json, os, subprocess
DST = "public/lab/desk3d"
meta = json.load(open(os.path.join(DST, "desk.json")))
files = {meta["screen"]} | {m[k] for m in meta["materials"].values() for k in ("normal", "rough") if m.get(k)}
for f in sorted(files):
    out = f[:-4] + ".half.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(DST, f), "-vf", "scale=ceil(iw/2):ceil(ih/2):flags=lanczos",
                    "-q:v", "2", os.path.join(DST, out)], check=True)
print("half-size copies:", len(files))
