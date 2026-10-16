"""One head for Liam's Brahma pendant (2026-10-16), from MPFB's base human (CC0 assets: base mesh and shape targets,
vendored in blender/amulet/mpfb; https://extensions.blender.org/add-ons/mpfb, v2.0.18) shaped toward the pendant's face:
broad and round, wide-set almond eyes with the lids almost closed and lowered, high arched brows, a long fairly broad
nose with a rounded tip, a wide mouth with full lips and a soft smile, a round soft chin, long earlobes.

  Blender --background --python blender/amulet/head.py -- [--preview]
Writes blender/amulet/head.npz (the head's verts and quads, face looking +y, z up, units as MakeHuman's decimetres;
the chin's and the eyes' heights);
amulet.py places four. With --preview, renders it in clay into blender/amulet/renders/head_*.png.
"""
import gzip
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "mpfb")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# the macros: a young adult, between female and male (the pendant's faces are soft), Asian, full-faced
GENDER, WEIGHT = 0.6, 0.55
wt = (WEIGHT - 0.5) / 0.5
MACRO = {
    "macrodetails/universal-female-young-averagemuscle-averageweight": (1 - GENDER) * (1 - wt),
    "macrodetails/universal-female-young-averagemuscle-maxweight": (1 - GENDER) * wt,
    "macrodetails/universal-male-young-averagemuscle-averageweight": GENDER * (1 - wt),
    "macrodetails/universal-male-young-averagemuscle-maxweight": GENDER * wt,
    "macrodetails/asian-female-young": 1 - GENDER,
    "macrodetails/asian-male-young": GENDER,
}
# the face, toward the pendant's
FACE = {
    "head/head-oval": 0.4, "head/head-round": 0.2,
    "cheek/l-cheek-volume-incr": 0.15, "cheek/r-cheek-volume-incr": 0.15, "cheek/l-cheek-bones-incr": 0.3, "cheek/r-cheek-bones-incr": 0.3,
    "chin/chin-width-incr": 0.3, "chin/chin-height-incr": 0.2,
    "eyes/l-eye-trans-out": 0.35, "eyes/r-eye-trans-out": 0.35, "eyes/l-eye-scale-incr": 0.2, "eyes/r-eye-scale-incr": 0.2,
    "eyes/l-eye-corner1-up": 0.0, "eyes/r-eye-corner1-up": 0.0,
    "eyebrows/eyebrows-trans-up": 0.8, "eyebrows/eyebrows-angle-up": 0.45,
    "nose/nose-scale-vert-incr": 0.8, "nose/nose-scale-horiz-incr": 0.35, "nose/nose-point-width-incr": 0.5,
    "nose/nose-flaring-incr": 0.3, "nose/nose-hump-decr": 0.5,
    "mouth/mouth-scale-horiz-incr": 0.5, "mouth/mouth-upperlip-volume-incr": 0.5, "mouth/mouth-lowerlip-volume-incr": 0.6,
    "mouth/mouth-angles-up": 0.6, "mouth/mouth-scale-vert-incr": 0.2,
    "ears/l-ear-scale-decr": 1.0, "ears/r-ear-scale-decr": 1.0, "ears/l-ear-flap-decr": 1.0, "ears/r-ear-flap-decr": 1.0,   # (under the hood)
    # (four necks meet under the chins: slim them so they read as the pendant's one neck, not a bulge)
    "neck/neck-scale-horiz-decr": 1.0, "neck/neck-scale-depth-decr": 1.0, "neck/neck-double-decr": 1.0,
    # the expression: lids almost closed, a soft smile
    "expression/units/asian/eye-left-closure": 0.92, "expression/units/asian/eye-right-closure": 0.92,
    "expression/units/asian/mouth-compression": 0.25,
}


def load_obj(path):
    """The body's quads, and the vertices of each joint marker (tiny cubes: their centre is the joint)."""
    verts, faces, joints, group = [], [], {}, None
    for line in open(path):
        if line.startswith("v "):
            verts.append([float(t) for t in line.split()[1:4]])
        elif line.startswith("g "):
            group = line.split()[1]
        elif line.startswith("f "):
            idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
            if group == "body":
                faces.append(idx)
            elif group.startswith("joint-"):
                joints.setdefault(group, set()).update(idx)
    return np.array(verts), faces, joints


def apply_target(verts, name, w):
    if not w:
        return
    with gzip.open(os.path.join(DATA, "targets", name + ".target.gz"), "rt") as f:
        for line in f:
            p = line.split()
            if len(p) == 4 and not line.startswith("#"):
                verts[int(p[0])] += w * np.array([float(p[1]), float(p[2]), float(p[3])])


def build():
    verts, faces, joints = load_obj(os.path.join(DATA, "3dobjs", "base.obj"))
    for n, w in {**MACRO, **FACE}.items():
        apply_target(verts, n, w)
    # MakeHuman: y up, the face looking +z -> ours: z up, the face looking +y (a mirror: the quads turn to stay outward)
    v = np.stack([verts[:, 0], verts[:, 2], verts[:, 1]], 1)
    faces = [f[::-1] for f in faces]
    eye_z = float(np.mean([v[list(joints[j]), 2].mean() for j in ("joint-l-eye", "joint-r-eye")]))
    return v, faces, eye_z


def head_only(v, faces, eye_z):
    """The head and the top of the neck: faces whose every corner lies above a cut just under the jaw."""
    used = sorted({i for f in faces for i in f})
    body = v[used]
    top = body[:, 2].max()
    # the chin: the lowest point near the middle, in front
    # (the face's own front: within half a decimetre of the nose's tip; the neck lies further back)
    mid = body[(np.abs(body[:, 0]) < 0.05) & (body[:, 2] > eye_z - 1.2) & (body[:, 2] < eye_z)]
    front = mid[mid[:, 1] > mid[:, 1].max() - 0.55]
    chin_z = front[:, 2].min()
    cut = chin_z - 0.35
    keep = [f for f in faces if all(v[i, 2] > cut for i in f)]
    idx = sorted({i for f in keep for i in f})
    remap = {o: n for n, o in enumerate(idx)}
    return v[idx], np.array([[remap[i] for i in f] for f in keep]), chin_z


if __name__ == "__main__":
    v, faces, eye_z = build()
    hv, hf, chin = head_only(v, faces, eye_z)
    print("HEAD", len(hv), "verts", len(hf), "faces; chin", round(chin, 3), "eyes", round(eye_z, 3), "bbox", hv.min(0).round(3), hv.max(0).round(3), flush=True)
    np.savez(os.path.join(HERE, "head.npz"), verts=hv, faces=hf, chin=chin, eyes=eye_z)
    if "--preview" in argv:
        import bpy
        from mathutils import Vector
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        me = bpy.data.meshes.new("head"); me.from_pydata(hv.tolist(), [], hf.tolist()); me.update()
        for p in me.polygons: p.use_smooth = True
        ob = bpy.data.objects.new("head", me); sc.collection.objects.link(ob)
        ob.modifiers.new("s", "SUBSURF").levels = 2
        m = bpy.data.materials.new("clay"); m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0.55, 0.42, 0.25, 1); b.inputs["Roughness"].default_value = 0.55
        me.materials.append(m)
        c = (hv.min(0) + hv.max(0)) / 2
        sc.render.engine = "CYCLES"; sc.cycles.samples = 64
        sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True
        sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.2, 0.2, 0.21, 1)
        def area(loc, size, watts):
            d = bpy.data.lights.new("a", "AREA"); d.size = size; d.energy = watts
            o = bpy.data.objects.new("a", d); sc.collection.objects.link(o); o.location = Vector(c) + Vector(loc)
            o.rotation_euler = (Vector(c) - o.location).to_track_quat("-Z", "Y").to_euler()
        area((-3, 4, 3), 3, 600); area((3, 2, 0.5), 3, 150)
        cd = bpy.data.cameras.new("c"); cd.lens = 85; cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = 600, 700; sc.render.film_transparent = True
        for name, ang in (("front", 0), ("three", 35), ("side", 90)):
            a = math.radians(ang)
            cam.location = Vector(c) + Vector((9 * math.sin(a), 9 * math.cos(a), 0.3))
            cam.rotation_euler = (Vector(c) - cam.location).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(HERE, "renders", f"head_{name}.png"); bpy.ops.render.render(write_still=True)
