"""The floating grains' streams as drawn curves (Liam, 2026-10-11: curve-guided streams, from the cinematic rocks
tutorial's curve guide), drafted over the hero.

Runs inside lookdev.py's hero scene through its LOOKDEV_LIST hook (lookdev.py builds the chaos, the lights and the
camera; this adds the curves, renders the review and exports them):

  LOOKDEV_LIST=blender/lookdev/stream_curves.py LOOKDEV_BIGPREVIEW=1 /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene hero --phase chaos --word none --preview

Each curve is written in the cloud's own terms, the way the live grains are placed (drift-grains.ts): about the
cloud's centre, in units of its radius, in the view's frame (x the screen's right, y its up, z toward the viewer).
So the same curves hold wherever the sand goes later (the desk, the pull-back) with that chapter's camera.

Writes public/lab/sand/streams.json and blender/lookdev/renders/streams-review.png.
"""
import json
import os

import bpy
import numpy as np

ROOT = os.getcwd()   # run from the project root (as every lookdev command is)

# Control points per stream, placed where they land in the hero frame: x, y on screen (-1..1, right and up) and
# depth z in cloud radii toward the viewer from the cloud's centre (the camera stands at z ~ 3.3). Back-projected
# through the hero camera, then stored in the cloud's frame. Each starts on the face of the cloud toward the viewer
# and sweeps out; they differ in reach, depth and pace on purpose (Liam: different sizes, paces, lengths, depths).
STREAMS = [
    # name, points (screen x, screen y, depth), width (grain radii at the start), fan (spread per unit travelled), pace (life, s)
    ("left sweep", [(-0.35, -0.05, 0.3), (-0.55, 0.15, 0.4), (-0.75, 0.4, 0.5), (-0.9, 0.65, 0.55), (-0.97, 0.9, 0.6)], 5, 0.12, 11),
    ("right curl", [(0.35, 0.1, 0.25), (0.6, 0.25, 0.3), (0.78, 0.5, 0.35), (0.72, 0.75, 0.4), (0.55, 0.92, 0.45)], 4, 0.10, 13),
    ("low drift", [(0.05, -0.45, 0.4), (0.35, -0.6, 0.5), (0.65, -0.68, 0.6), (0.88, -0.62, 0.7), (1.05, -0.5, 0.8)], 6, 0.16, 9),
    ("toward the lens", [(-0.15, -0.2, 0.5), (-0.35, -0.45, 0.8), (-0.6, -0.7, 1.1), (-0.85, -0.95, 1.4)], 4, 0.08, 7),
    ("top rise", [(0.05, 0.3, 0.25), (0.15, 0.5, 0.3), (0.05, 0.7, 0.35), (0.18, 0.88, 0.4), (0.1, 1.05, 0.45)], 3, 0.12, 14),
    ("deep arc", [(-0.5, 0.3, -0.15), (-0.7, 0.45, -0.2), (-0.85, 0.65, -0.25), (-0.95, 0.85, -0.2)], 7, 0.18, 12),
]
SAMPLES = 64


def catmull_rom(pts, n):
    """n points along a centripetal-free (uniform) Catmull-Rom spline through pts, evenly spaced by arc length."""
    p = np.asarray(pts, dtype=np.float64)
    p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    dense = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, 40, endpoint=False):
            t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    dense.append(p[-2])
    dense = np.array(dense)
    seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    u = np.linspace(0, s[-1], n)
    return np.stack([np.interp(u, s, dense[:, k]) for k in range(3)], axis=1), float(s[-1])


def b2t(v):   # Blender (z up) -> three.js (y up)
    return np.array([v[0], v[2], -v[1]], dtype=np.float64)


def t2b(v):
    return np.array([v[0], -v[2], v[1]], dtype=np.float64)


scene = bpy.context.scene
bpy.context.view_layer.update()   # the camera's world matrix, after lookdev.py aimed it
# the cloud as the live page measures it: its centre (the grains' mean) and radius (half the chaos box's least side)
meta = json.load(open(os.path.join(ROOT, "public/lab/sand/sand.json")))
lo, hi = np.array(meta["chaos_box"][0]), np.array(meta["chaos_box"][1])
R = 0.5 * float(np.min(hi - lo))
chaos = bpy.data.objects["chaos"]
co = np.empty(len(chaos.data.vertices) * 3, dtype=np.float32)
chaos.data.vertices.foreach_get("co", co)
C = b2t(co.reshape(-1, 3).mean(0))
cam = b2t(np.array(scene.camera.matrix_world.translation))
F = (cam - C) / np.linalg.norm(cam - C)
Rt = np.cross([0, 1, 0], F); Rt /= np.linalg.norm(Rt)
U = np.cross(F, Rt)
print("STREAMS cloud centre (three)", np.round(C, 3), "radius", round(R, 3), "camera", np.round(cam, 3))

# the curves, drawn in the render as thin glowing tubes (a review aid only)
mat = bpy.data.materials.new("stream_curve"); mat.use_nodes = True
nt = mat.node_tree
for nd in list(nt.nodes):
    if nd.type != "OUTPUT_MATERIAL":
        nt.nodes.remove(nd)
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = (0.55, 0.9, 1.0, 1)
em.inputs["Strength"].default_value = 3.0
nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])

# the hero camera's own frame (three.js axes), for placing points on screen
mw = scene.camera.matrix_world
cam_fwd = b2t(-np.array(mw.col[2][:3])); cam_right = b2t(np.array(mw.col[0][:3])); cam_up = b2t(np.array(mw.col[1][:3]))
cd = scene.camera.data
tan_x = cd.sensor_width / 2 / cd.lens
tan_y = tan_x * scene.render.resolution_y / scene.render.resolution_x
D = float(np.dot(C - cam, cam_fwd))   # the cloud's centre's depth from the camera


def on_screen(sx, sy, z):
    dd = D - z * R
    return cam + cam_fwd * dd + cam_right * (sx * tan_x * dd) + cam_up * (sy * tan_y * dd)


out = []
for name, pts, width, fan, pace in STREAMS:
    world, length = catmull_rom([on_screen(*p) for p in pts], SAMPLES)
    q = np.stack([(world - C) @ Rt, (world - C) @ U, (world - C) @ F], axis=1) / R
    length /= R
    cu = bpy.data.curves.new("stream_" + name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.012
    sp = cu.splines.new("POLY")
    sp.points.add(len(world) - 1)
    for i, w in enumerate(world):
        b = t2b(w)
        sp.points[i].co = (b[0], b[1], b[2], 1)
    ob = bpy.data.objects.new("stream_" + name, cu)
    ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    out.append({"name": name, "points": [[round(float(v), 4) for v in p] for p in q], "length": round(length, 4),
                "width": width, "fan": fan, "pace": pace})

json.dump({
    "version": 1,
    "frame": "cloud radii about the cloud's centre; x the screen's right, y its up, z toward the viewer",
    "reference": {"centre": [round(float(v), 4) for v in C], "radius": round(R, 4), "camera": [round(float(v), 4) for v in cam]},
    "streams": out,
}, open(os.path.join(ROOT, "public/lab/sand/streams.json"), "w"), indent=1)
print("WROTE public/lab/sand/streams.json")

scene.render.filepath = os.path.join(ROOT, "blender/lookdev/renders/streams-review.png")
bpy.ops.render.render(write_still=True)
print("WROTE", scene.render.filepath)
