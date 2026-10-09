"""The baked desk for the site: renders/bake/{shut,open,lit} -> public/lab/desk3d.
Geometry from the open state (all parts, the lid on its hinge); probes from shut; each surface's diffuse per state
(JPEG); roughness/normal from shut. Every state shares each surface's UVs (the lid's parts are unwrapped in the hinge's
frame), so the site blends the states on one mesh as the lid turns.
  python3 scripts/lab/desk3d-publish.py"""
import json, os, shutil, subprocess, glob
SRC, DST = "blender/lookdev/renders/bake", "public/lab/desk3d"
os.makedirs(DST, exist_ok=True)
for f in glob.glob(os.path.join(DST, "bake_*")):
    os.remove(f)
states = {s: json.load(open(os.path.join(SRC, s, "desk.json"))) for s in ("shut", "open", "lit")}
shut, opn, lit = states["shut"], states["open"], states["lit"]
shutil.copy(os.path.join(SRC, "open", "desk.glb"), DST)
shutil.copy(os.path.join(SRC, "shut", "probe.exr"), DST)   # the room without the lights (the lights are real)
if os.path.exists(os.path.join(DST, "probe_lit.exr")):
    os.remove(os.path.join(DST, "probe_lit.exr"))
def jpg(state, name, q):
    src = os.path.join(SRC, state, name)
    if not os.path.exists(src):
        return None
    out = name.replace(".png", f".{state}.jpg") if ".diff." in name else name.replace(".png", ".jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-q:v", str(q), os.path.join(DST, out)], check=True)
    return out
for name, m in opn["materials"].items():
    for st in ("shut", "lit"):
        o = states[st]["materials"].get(name)
        if o and "uv_sum" in m and abs(o.get("uv_sum", m["uv_sum"]) - m["uv_sum"]) > 0.05:
            raise SystemExit(f"{name}: its UVs differ between {st} and open ({o['uv_sum']} vs {m['uv_sum']})")
mats = {}
for name, m in opn["materials"].items():
    m = dict(m); m.pop("uv_sum", None)
    if m.get("screen"):
        mats[name] = m; continue
    diff = {}
    for st in ("shut", "open", "lit"):
        if name not in states[st]["materials"]:
            continue   # keys, trackpad, bezel: hidden under the shut lid, not baked shut
        f = jpg(st, os.path.basename(states[st]["materials"][name]["diff"]), 3)
        if f: diff[st] = f
    m["diff"] = diff
    src_maps = shut["materials"].get(name, m)
    for k in ("rough", "normal"):
        if k in src_maps:
            m[k] = jpg("shut" if name in shut["materials"] else "open", src_maps[k], 2 if k == "normal" else 3)
    if name in shut["materials"] and shut["materials"][name].get("combined"):
        m["combined"] = True
    mats[name] = m
# the screen: the index design (from the prototype capture)
shutil.copy("blender/lookdev/textures-local/work-index-screen.png", os.path.join(DST, "screen.png"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(DST, "screen.png"), "-q:v", "2", os.path.join(DST, "screen.jpg")], check=True)
os.remove(os.path.join(DST, "screen.png"))
lights = dict(shut["lights"])
for k in ("side_fill",):
    if k in opn["lights"]:
        lights[k] = dict(opn["lights"][k], follows="open")   # the low view's fill rises as the lid opens
meta = {**{k: v for k, v in shut.items() if k not in ("materials", "lights", "laptop", "probe_lit")}, "version": 3, "materials": mats,
        "lights": lights, "screen": "screen.jpg", "lid": {"pivot": "lid_pivot", "baked_open_deg": opn["lid_open_deg"]}}
json.dump(meta, open(os.path.join(DST, "desk.json"), "w"))
print("published", len(mats), "surfaces;", subprocess.run(["du", "-sh", DST], capture_output=True, text=True).stdout.strip())
