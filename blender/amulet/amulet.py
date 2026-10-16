"""Liam's brass Brahma (Phra Phrom) pendant, modelled from his photos (blender/amulet/*.jpg, 2026-10-16) for the site's
floating object: four serene faces on a lotus cup, a fluted foot, a pointed crown, a lotus-bud finial and the hanging ring.
Built in units measured on the front photo (e286a6aa; the pendant 529 tall), normalised to 1 unit tall on export.
The brass: worn gold, scratched, a dark patina and a hint of rust in the recesses (a procedural material baked to colour,
roughness and normal maps).

  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/amulet/amulet.py -- [--out DIR] [--preview]
Writes DIR/amulet.glb (default public/models) and, with --preview, renders turntable stills into blender/amulet/renders.
With --web DIR it writes the About page's assets instead (scripts/about/pendant-publish.sh runs it): pendant.glb (one mesh, no
materials, the non-head faces decimated), pendant-wire.glb (a ~5k-triangle copy, positions only) and the three baked maps
color.png, normal.png, rough.png (roughness in every channel, so in G).
"""
import math
import os
import shutil
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WEB = os.path.abspath(argv[argv.index("--web") + 1]) if "--web" in argv else None
OUT = WEB or (argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(ROOT, "public", "models"))
PREVIEW = "--preview" in argv
TEX = int(argv[argv.index("--tex") + 1]) if "--tex" in argv else 2048

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def spline(profile, per=8):
    """A Catmull-Rom curve through the profile's points, `per` samples a span: a turned profile drawn as straight
    segments shades as flat bands of cone."""
    P = [np.array(p, float) for p in profile]
    P = [2 * P[0] - P[1]] + P + [2 * P[-1] - P[-2]]
    out = []
    for k in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[k - 1], P[k], P[k + 1], P[k + 2]
        for t in np.linspace(0, 1, per, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)))
    out.append(tuple(P[-2]))
    return out


def lathe(name, profile, seg=96, dr=None, dz=None, cap_top=False, cap_bottom=False, per=8):
    """A turned surface: `profile` [(r, z)] from bottom to top, splined; `dr(theta, z, i)` / `dz(theta, z, i)` add relief
    (i indexes the splined points)."""
    profile = spline(profile, per) if per > 1 else profile
    verts, faces = [], []
    n = len(profile)
    for j in range(seg):
        th = 2 * math.pi * j / seg
        for i, (r, z) in enumerate(profile):
            rr = r + (dr(th, z, i) if dr else 0.0)
            zz = z + (dz(th, z, i) if dz else 0.0)
            verts.append((rr * math.cos(th), rr * math.sin(th), zz))
    for j in range(seg):
        a, b = j * n, ((j + 1) % seg) * n
        for i in range(n - 1):
            faces.append((a + i, b + i, b + i + 1, a + i + 1))
    if cap_bottom:
        c = len(verts); verts.append((0, 0, profile[0][1]))
        for j in range(seg):
            faces.append((c, ((j + 1) % seg) * n, j * n))
    if cap_top:
        c = len(verts); verts.append((0, 0, profile[-1][1]))
        for j in range(seg):
            faces.append((c, j * n + n - 1, ((j + 1) % seg) * n + n - 1))
    return mesh_from(name, verts, faces)


def ribs(count, depth, sharp=3.0):
    """Fluting: `count` rounded ribs around, grooves `depth` deep."""
    return lambda th: -depth * (1 - abs(math.cos(count * th / 2)) ** (1 / sharp))


# (measured on the front photo e286a6aa, scaled so the whole pendant is 529 units: foot at z 0, the ring's top at 529)

# ---------- the foot: a fluted bell, flaring to its flanged rim (z 0..88) ----------
foot_prof = [(78, 0), (80, 3), (80, 8), (76, 12), (68, 19), (60, 32), (55, 50), (52, 68), (51, 80), (52, 88)]
fr = ribs(16, 7.0, sharp=2.2)
lathe("foot", foot_prof, seg=192, dr=lambda th, z, i: fr(th) * smooth(11, 20, z) * (1 - 0.3 * smooth(60, 88, z)), cap_bottom=True)

# ---------- the tie: a bound band (z 86..110) ----------
lathe("tie", [(51, 86), (56, 90), (58, 96), (58, 102), (55, 108), (49, 111)], seg=128)

# ---------- the lotus cup: a steep bowl of petals, each with a raised edge, the rim scalloped (z 108..181) ----------
PET = 16
def petal(th):
    """0 at a petal's middle, 1 at the seam between two."""
    return abs(math.sin(PET * th / 2))
CUP_OUT = 7 * 8   # (the outside's last splined point: the lip and inside take no petal relief)
def cup_dr(th, z, i):
    if i > CUP_OUT:
        return 0.0
    s = petal(th)
    # the seams cut in toward the rim; each petal's edge stands a touch proud of its middle
    return (-7.0 * s ** 3 + 1.6 * math.exp(-((s - 0.8) / 0.12) ** 2)) * smooth(112, 150, z)
def cup_dz(th, z, i):
    # the rim dips at each seam: a scallop
    return -7.0 * petal(th) ** 4 * smooth(166, 180, z)
cup_prof = [(49, 108), (62, 112), (78, 119), (91, 130), (99, 145), (102, 160), (103, 172), (102, 179),   # outside, up
            (98, 182), (90, 180), (76, 178), (58, 178), (48, 180)]                                       # the lip, then in to the neck
lathe("cup", cup_prof, seg=256, dr=cup_dr, dz=cup_dz)

# ---------- the neck and the core between the heads (z 176..330), the neck's metal worked in vertical strokes ----------
lathe("core", [(47, 176), (51, 186), (52, 200), (51, 212), (48, 230), (48, 260), (56, 300), (62, 330)], seg=128,
      dr=lambda th, z, i: -1.6 * abs(math.sin(14 * th)) ** 0.5 * smooth(230, 200, z))

# ---------- four heads, back to back, each facing out: MPFB's human head shaped toward the pendant's (head.py) ----------
HEAD = np.load(os.path.join(HERE, "head.npz"))
CHIN_Z, EYE_RISE, NOSE_R = 216.0, 50.0, 100.0   # (from the photo: the chin at 216, the eyes 50 above it, the nose 100 out)
NECK_R = 38.0
HS = EYE_RISE / (float(HEAD["eyes"]) - float(HEAD["chin"]))
# the pendant's faces are broad: about 1.6 times as wide as eyes-to-chin, against a person's 1.25
FACE_W, FACE_D = 1.32, 1.08
hv0 = HEAD["verts"] * HS * np.array([FACE_W, FACE_D, 1.0])
hv0[:, 2] += CHIN_Z - float(HEAD["chin"]) * HS
hv0[:, 1] += NOSE_R - hv0[:, 1].max()
head_world, head_obs = [], []
for k in range(4):
    a = k * math.pi / 2
    ca, sa = math.cos(a), math.sin(a)
    # its forward (sin a, cos a), its right (cos a, -sin a)
    w = np.stack([hv0[:, 0] * ca + hv0[:, 1] * sa, -hv0[:, 0] * sa + hv0[:, 1] * ca, hv0[:, 2]], 1)
    # under the chin the neck tucks in toward the axis: four necks read as the pendant's one slim neck, not a ball
    r = np.hypot(w[:, 0], w[:, 1])
    k_in = smooth(CHIN_Z - 16.0, CHIN_Z + 2.0, w[:, 2])
    r_new = np.minimum(r, NECK_R + (r - NECK_R) * k_in)
    w[:, :2] *= (r_new / np.maximum(r, 1e-6))[:, None]
    head_world.append(w)
    ob = mesh_from(f"head_{k}", w.tolist(), HEAD["faces"].tolist())
    bpy.context.view_layer.objects.active = ob
    ob.modifiers.new("s", "SUBSURF").levels = 1
    bpy.ops.object.modifier_apply(modifier="s")
    # (marks the faces as the heads' for the join: the UVs give them more of the map, the web build leaves them undecimated)
    ob.data.attributes.new("is_head", "BOOLEAN", "FACE").data.foreach_set("value", [True] * len(ob.data.polygons))
    head_obs.append(ob)


# ---------- the crown: over each face a pointed gable; where two faces meet, the hood comes down their sides with leaf
# flares above. It hugs the heads (and the headdress above them): its inside follows their outermost surface ----------
def corner(th):
    """0 straight over a face, 1 where two faces meet (the faces stand at 0, 90, 180, 270 degrees)."""
    return abs(((th + math.pi / 4) % (math.pi / 2)) - math.pi / 4) / (math.pi / 4)


# the surface under the crown: rays cast in toward the axis from outside, at every angle and height, onto the heads
from mathutils.bvhtree import BVHTree
hv_all, hf_all = [], []
for ob in head_obs:
    base = len(hv_all)
    hv_all += [tuple(v.co) for v in ob.data.vertices]
    hf_all += [tuple(base + i for i in p.vertices) for p in ob.data.polygons]
heads_bvh = BVHTree.FromPolygons(hv_all, hf_all)
TH_N, RZ0, RZ1, RDZ, FAR = 384, 200.0, 400.0, 1.0, 200.0
RZ_N = int((RZ1 - RZ0) / RDZ) + 1
hood = np.zeros((TH_N, RZ_N))
for i in range(TH_N):
    th = 2 * math.pi * i / TH_N
    d = Vector((-math.cos(th), -math.sin(th), 0))
    for j in range(RZ_N):
        hit = heads_bvh.ray_cast(Vector((FAR * math.cos(th), FAR * math.sin(th), RZ0 + RDZ * j)), d, FAR)
        if hit[0] is not None:
            hood[i, j] = FAR - hit[3]
DOME = [(84, 300), (86, 322), (80, 344), (68, 362), (55, 376), (47, 384)]
dome_r = np.interp(RZ0 + RDZ * np.arange(RZ_N), [z for r, z in DOME], [r for r, z in DOME], left=0, right=0)
hood = np.maximum(hood, dome_r[None, :])
# ...and the core between the heads: where two faces part (under the ears) a ray passes between them and reads the axis,
# a hole the crown's skirt would plunge into, in teeth (the crown's rows cross that cliff at a different height each turn)
CORE = [(176, 47), (186, 51), (200, 52), (212, 51), (230, 48), (260, 48), (300, 56), (330, 62)]
hood = np.maximum(hood, np.interp(RZ0 + RDZ * np.arange(RZ_N), [z for z, r in CORE], [r for z, r in CORE])[None, :])
for _ in range(16):   # soften the small hollows (the crown is a sheet over them, not a skin), never inside the surface
    hood = np.maximum(hood, (np.roll(hood, 2, 0) + np.roll(hood, 1, 0) + hood + np.roll(hood, -1, 0) + np.roll(hood, -2, 0)) / 5)
    hood[:, 2:-2] = np.maximum(hood[:, 2:-2], (hood[:, :-4] + hood[:, 1:-3] + hood[:, 2:-2] + hood[:, 3:-1] + hood[:, 4:]) / 5)


def hood_r(th, z):
    """The outermost surface under the crown at this angle and height."""
    t = (th % (2 * math.pi)) / (2 * math.pi) * TH_N
    z = (min(max(z, RZ0), RZ1) - RZ0) / RDZ
    i0, j0 = int(t) % TH_N, min(int(z), RZ_N - 2)
    ft, fz = t - int(t), z - j0
    i1 = (i0 + 1) % TH_N
    return ((1 - ft) * ((1 - fz) * hood[i0, j0] + fz * hood[i0, j0 + 1]) + ft * ((1 - fz) * hood[i1, j0] + fz * hood[i1, j0 + 1]))


def crown_profile(th):
    s = corner(th)
    z_band = 286.0 + 14.0 * smooth(0.62, 0.0, s) ** 0.8             # the tiara's lower edge, arching up over each brow
    z0 = z_band - 70.0 * smooth(0.5, 0.86, s)                       # ...and the hood down the sides of the faces, over the ears
    z1 = z_band + 13.0 + 44.0 * smooth(0.74, 0.0, s) ** 1.25 + 40.0 * smooth(0.76, 1.0, s) ** 2
    curl = 9.0 * smooth(0.8, 1.0, s)
    pts = []
    for t in np.linspace(0, 1, 64):
        z = z0 + (z1 - z0) * t
        tt = max(0.0, (z - z_band) / max(z1 - z_band, 1e-6))        # (the flare curls out above the band)
        pts.append((hood_r(th, z) + 1.0 + 4.5 + curl * tt * tt, z))
    out = pts
    inner = [(r - 4.5, z) for r, z in reversed(out)]
    top = (out[-1][0] - 2.2, out[-1][1] + 1.2)
    return out + [top] + inner


def lathe_fn(name, profile_fn, seg=256, close=True):
    """A lathe whose profile changes around the turn: `profile_fn(theta)` -> [(r, z)], the same count every time."""
    rows = [profile_fn(2 * math.pi * j / seg) for j in range(seg)]
    n = len(rows[0])
    verts = []
    for j, prof in enumerate(rows):
        th = 2 * math.pi * j / seg
        verts += [(r * math.cos(th), r * math.sin(th), z) for r, z in prof]
    faces = []
    for j in range(seg):
        a, b = j * n, ((j + 1) % seg) * n
        for i in range(n - 1 if not close else n):
            i2 = (i + 1) % n
            faces.append((a + i, b + i, b + i2, a + i2))
    return mesh_from(name, verts, faces)


lathe_fn("crown", crown_profile, seg=576)
# the diamond at the front of each tiara, and the engraved band's beads
for k in range(4):
    a = k * math.pi / 2
    jr = hood_r(math.pi / 2 - a, 322) + 6.5
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=(jr * math.sin(a), jr * math.cos(a), 322))
    j = bpy.context.active_object; j.name = f"jewel_{k}"; j.scale = (6.5, 3.0, 8.5); j.rotation_euler = (0, 0, -a)
    bpy.ops.object.shade_smooth()

# ---------- the headdress inside the crown (combed lines), the top band, the lotus bud, the ring ----------
lathe("dome", DOME, seg=192,
      dr=lambda th, z, i: -1.1 * abs(math.sin(24 * th)) ** 0.6)
lathe("band", [(45, 381), (50, 384), (52, 389), (50, 394), (43, 397)], seg=128)
def bud_dr(th, z, i):
    """A lotus bud of flame petals in two rings: eight outer petals, pointed, their tips at 446; eight inner ones between
    them rising to the top. Each petal stands proud of the one behind it, its edge a soft step."""
    s1 = abs(math.sin(4 * th))                    # 0 at an outer petal's middle, 1 between two
    s2 = abs(math.cos(4 * th))                    # the same for the inner ring
    e1 = 446.0 - 38.0 * s1 ** 1.1
    e2 = 472.0 - 40.0 * s2 ** 1.1
    below1 = float(smooth(e1 + 5.0, e1 - 5.0, z)); below2 = float(smooth(e2 + 5.0, e2 - 5.0, z))
    # each petal bulges (fullest along its middle) and stands proud of the ring behind it
    d = below1 * (2.0 + 3.0 * (1 - s1 * s1)) + (1 - below1) * below2 * (1.0 + 2.5 * (1 - s2 * s2))
    d -= 2.5 * math.exp(-((s1 - 1.0) / 0.16) ** 2) * below1                          # the cut between two outer petals
    return d * float(smooth(398, 404, z))
lathe("bud", [(40, 396), (42, 404), (42, 414), (40, 426), (34, 440), (26, 452), (17, 462), (9, 470), (6, 476)],
      seg=256, dr=bud_dr, cap_top=True, per=22)
bpy.ops.mesh.primitive_cylinder_add(radius=9, depth=12, vertices=48, location=(0, 0, 478))
bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_torus_add(major_radius=16, minor_radius=11, major_segments=72, minor_segments=32,
                                 location=(0, 0, 502), rotation=(math.pi / 2, 0, 0))
ring = bpy.context.active_object; ring.name = "ring"
bpy.ops.object.shade_smooth()

# ---------- one object: join, centre on the axis with its foot at 0, 1 unit tall ----------
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["foot"]
bpy.ops.object.join()
am = bpy.context.active_object; am.name = "amulet"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
H = 529.0
am.scale = (1 / H,) * 3
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_auto_smooth(angle=math.radians(50)) if hasattr(bpy.ops.object, "shade_auto_smooth") else None

# ---------- the brass: worn gold (Liam, 2026-10-16: between the old dark brass and his worn-gold reference; a hint of rust
# in the recesses; fine hairline scratches; then both a bit stronger). A procedural material, in the model's own space, baked to three maps
# (colour, roughness, normal) so the site needs no shader of its own ----------
am.data.materials.clear()
mat = bpy.data.materials.new("brass"); mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
am.data.materials.append(mat)

# UVs for the bakes
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(72), island_margin=0.004)
bpy.ops.object.mode_set(mode="OBJECT")


def heads_denser():
    """The faces get twice the UV size, so four times the map area: each UV island made only of head faces is scaled x2
    about its own centre, then everything is packed again (which keeps the islands' relative sizes)."""
    bm = bmesh.new(); bm.from_mesh(am.data)
    uvl = bm.loops.layers.uv.active
    head = bm.faces.layers.bool.get("is_head")
    parent = list(range(len(bm.faces)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    # islands: faces that share an edge whose two ends have the same UVs on both sides
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        f1, f2 = e.link_faces
        ok = True
        for v in e.verts:
            l1 = next(l for l in f1.loops if l.vert == v); l2 = next(l for l in f2.loops if l.vert == v)
            if (l1[uvl].uv - l2[uvl].uv).length > 1e-6:
                ok = False; break
        if ok:
            parent[find(f1.index)] = find(f2.index)
    members = {}
    for f in bm.faces:
        members.setdefault(find(f.index), []).append(f)
    n = 0
    for fs in members.values():
        if not all(f[head] for f in fs):
            continue
        uvs = [l[uvl].uv for f in fs for l in f.loops]
        lo = Vector((min(u.x for u in uvs), min(u.y for u in uvs))); hi = Vector((max(u.x for u in uvs), max(u.y for u in uvs)))
        c = (lo + hi) / 2
        for f in fs:
            for l in f.loops:
                l[uvl].uv = c + (l[uvl].uv - c) * 2.0
        n += 1
    bm.to_mesh(am.data); bm.free()
    print("HEAD ISLANDS scaled x2:", n, "of", len(members), flush=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")


heads_denser()

scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = "GPU"
except Exception:
    pass
scene.world = bpy.data.worlds.new("w"); scene.world.use_nodes = True


def node(kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def link(a, b):
    nt.links.new(a, b)


def put(sock, v):
    """A socket's input: a number, a colour, or another node's output."""
    if isinstance(v, bpy.types.NodeSocket):
        link(v, sock)
    else:
        sock.default_value = v


def maprange(v, a, b, lo=0.0, hi=1.0):
    """v from [a, b] to [lo, hi], smoothstepped and clamped."""
    m = node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
    put(m.inputs["Value"], v); m.inputs["From Min"].default_value = a; m.inputs["From Max"].default_value = b
    m.inputs["To Min"].default_value = lo; m.inputs["To Max"].default_value = hi
    return m.outputs["Result"]


def math_(op, a, b=0.0):
    m = node("ShaderNodeMath", operation=op)
    put(m.inputs[0], a); put(m.inputs[1], b)
    return m.outputs[0]


def mix_col(fac, a, b):
    m = node("ShaderNodeMix", data_type="RGBA")
    put(m.inputs[0], fac); put(m.inputs[6], a); put(m.inputs[7], b)
    return m.outputs[2]


def mix_f(fac, a, b):
    m = node("ShaderNodeMix", data_type="FLOAT")
    put(m.inputs[0], fac); put(m.inputs[2], a); put(m.inputs[3], b)
    return m.outputs[0]


def noise(vec, scale, detail=6.0, rough=0.55, w=None, distortion=0.0):
    n = node("ShaderNodeTexNoise", noise_dimensions="4D" if w is not None else "3D")
    link(vec, n.inputs["Vector"]); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough; n.inputs["Distortion"].default_value = distortion
    if w is not None:
        n.inputs["W"].default_value = w
    return n.outputs["Fac"]


P = node("ShaderNodeTexCoord").outputs["Object"]      # (the model is 1 unit tall: these scales are per pendant)

# where the light can't reach: the recesses (patina, rust), and the finer cavities (grime). Baked first as their own AO
# passes (the AO shader node reads almost nothing inside a bake), then read back through the UVs
out = node("ShaderNodeOutputMaterial")
scene.render.bake.margin = 16; scene.render.bake.margin_type = "EXTEND"   # (the islands run on into the gutter between them)
scene.cycles.samples = 64


def bake_ao(name, reach):
    img = bpy.data.images.new(name, TEX, TEX, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    t = node("ShaderNodeTexImage"); t.image = img
    nt.nodes.active = t
    scene.world.light_settings.distance = reach
    bpy.ops.object.bake(type="AO")
    print("BAKED", name, flush=True)
    return t.outputs["Color"]


ao = bake_ao("ao", 0.08)
cav = bake_ao("cavity", 0.015)
occl = maprange(ao, 0.92, 0.45)                             # 0 open .. 1 deep
crev = maprange(cav, 0.92, 0.6)
# the raised edges, worn bright by handling: nose, lips, crown points, petal rims, fluting
edge = maprange(node("ShaderNodeNewGeometry").outputs["Pointiness"], 0.515, 0.57)
edge = math_("MULTIPLY", edge, maprange(occl, 0.6, 0.2))
# uneven tone, the reference's mottling; and a few darker blotches
mottle = maprange(noise(P, 6.0, 10.0, 0.66), 0.3, 0.7)
blotch = maprange(noise(P, 11.0, 8.0, 0.6, distortion=0.35), 0.56, 0.68)
# pinprick pits
vor = node("ShaderNodeTexVoronoi"); link(P, vor.inputs["Vector"]); vor.inputs["Scale"].default_value = 170.0
specks = math_("MULTIPLY", maprange(vor.outputs["Distance"], 0.07, 0.02), maprange(noise(P, 5.0, 2.0, 0.5, w=3.0), 0.5, 0.62))
# hairline scratches: thin contours of noise stretched across one direction, in three directions, here and there
scr = None
for k, (rot, w) in enumerate((((0.4, 1.1, 0.2), 1.0), ((1.3, 0.2, 2.1), 7.0), ((2.2, 2.6, 0.9), 13.0))):
    mp = node("ShaderNodeMapping"); link(P, mp.inputs["Vector"])
    mp.inputs["Rotation"].default_value = rot; mp.inputs["Scale"].default_value = (0.7, 0.7, 34.0)
    n = noise(mp.outputs["Vector"], 1.0, 1.5, 0.4, w=w)
    line = maprange(math_("ABSOLUTE", math_("SUBTRACT", n, 0.5)), 0.0058, 0.0)
    patch = maprange(noise(P, 9.0, 2.0, 0.5, w=w + 40.0), 0.5, 0.6)
    l = math_("MULTIPLY", line, patch)
    scr = l if scr is None else math_("MAXIMUM", scr, l)
scr = math_("MULTIPLY", scr, maprange(occl, 0.8, 0.4))        # (not down in the recesses)
# a hint of rust, only down in the deepest places
rust = math_("MULTIPLY", maprange(occl, 0.42, 0.85), maprange(noise(P, 24.0, 8.0, 0.6, w=21.0), 0.49, 0.62))

col = mix_col(mottle, (0.22, 0.135, 0.04, 1), (0.52, 0.34, 0.11, 1))              # worn gold, between the two
col = mix_col(math_("MULTIPLY", occl, 0.9), col, (0.06, 0.045, 0.018, 1))         # dark olive-brown patina in the recesses
col = mix_col(math_("MULTIPLY", crev, 0.6), col, (0.08, 0.06, 0.025, 1))
col = mix_col(math_("MULTIPLY", blotch, 0.7), col, (0.10, 0.08, 0.03, 1))
col = mix_col(math_("MULTIPLY", specks, 0.85), col, (0.045, 0.032, 0.014, 1))
col = mix_col(math_("MULTIPLY", rust, 0.95), col, (0.25, 0.08, 0.024, 1))
col = mix_col(math_("MULTIPLY", edge, 0.75), col, (0.68, 0.48, 0.19, 1))           # worn bright on the highs
col = mix_col(math_("MULTIPLY", scr, 0.9), col, (0.80, 0.61, 0.29, 1))             # the scratches: fresh metal

rough = mix_f(mottle, 0.6, 0.3)                          # (the darker, worn tone is duller too)
rough = mix_f(occl, rough, 0.62)
rough = mix_f(math_("MULTIPLY", blotch, 0.8), rough, 0.72)
rough = mix_f(math_("MULTIPLY", specks, 0.8), rough, 0.7)
rough = mix_f(rust, rough, 0.88)
rough = mix_f(math_("MULTIPLY", edge, 0.8), rough, 0.22)
rough = mix_f(math_("MULTIPLY", scr, 0.95), rough, 0.15)

# relief: the pits sink, a fine casting grain, the scratches only just (cut deep, a thin line bakes as a dotted one)
height = math_("ADD", math_("MULTIPLY", scr, -0.25), math_("MULTIPLY", specks, -0.6))
height = math_("ADD", height, math_("MULTIPLY", noise(P, 380.0, 3.0, 0.5), 0.25))
bump = node("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.0006
link(height, bump.inputs["Height"])

bsdf = node("ShaderNodeBsdfPrincipled")
bsdf.inputs["Metallic"].default_value = 1.0
link(col, bsdf.inputs["Base Color"]); link(rough, bsdf.inputs["Roughness"]); link(bump.outputs["Normal"], bsdf.inputs["Normal"])
emit = node("ShaderNodeEmission")

os.makedirs(OUT, exist_ok=True)
scene.cycles.samples = 16


def bake(name, kind, surface, colorspace):
    img = bpy.data.images.new(name, TEX, TEX, float_buffer=False)
    img.colorspace_settings.name = colorspace       # (before the bake: setting it after regenerates the image)
    t = node("ShaderNodeTexImage"); t.image = img
    nt.nodes.active = t
    link(surface, out.inputs["Surface"])
    bpy.ops.object.bake(type=kind)
    img.filepath_raw = os.path.join(OUT, f"amulet_{name}.png"); img.file_format = "PNG"
    img.save()
    nt.nodes.remove(t)
    print("BAKED", name, flush=True)
    return img


link(col, emit.inputs["Color"])
c_img = bake("color", "EMIT", emit.outputs["Emission"], "sRGB")
nt.links.remove(emit.inputs["Color"].links[0])
rgb = node("ShaderNodeCombineColor")
for ch in ("Red", "Green", "Blue"):
    link(rough, rgb.inputs[ch])
link(rgb.outputs["Color"], emit.inputs["Color"])
r_img = bake("rough", "EMIT", emit.outputs["Emission"], "Non-Color")
n_img = bake("normal", "NORMAL", bsdf.outputs["BSDF"], "Non-Color")

# where the islands are (a white bake at no margin), for filling the rest of the maps (--web)
if WEB:
    for l in list(emit.inputs["Color"].links):
        nt.links.remove(l)
    emit.inputs["Color"].default_value = (1, 1, 1, 1)
    scene.render.bake.margin = 0
    bake("mask", "EMIT", emit.outputs["Emission"], "Non-Color")

# the exported material: the three maps on a plain metal
nt.nodes.clear()
bsdf = node("ShaderNodeBsdfPrincipled"); bsdf.inputs["Metallic"].default_value = 1.0
out = node("ShaderNodeOutputMaterial"); link(bsdf.outputs["BSDF"], out.inputs["Surface"])
ct = node("ShaderNodeTexImage"); ct.image = c_img; link(ct.outputs["Color"], bsdf.inputs["Base Color"])
rt = node("ShaderNodeTexImage"); rt.image = r_img; link(rt.outputs["Color"], bsdf.inputs["Roughness"])
nm = node("ShaderNodeNormalMap"); ntex = node("ShaderNodeTexImage"); ntex.image = n_img
link(ntex.outputs["Color"], nm.inputs["Color"]); link(nm.outputs["Normal"], bsdf.inputs["Normal"])
scene.cycles.samples = 128

bpy.ops.object.select_all(action="DESELECT"); am.select_set(True)


def decimate(ob, ratio):
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    md = ob.modifiers.new("dec", "DECIMATE"); md.ratio = ratio
    bpy.ops.object.modifier_apply(modifier="dec")


def export_glb(ob, path, **kw):
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, **kw)
    print("WROTE", path, len(ob.data.polygons), "faces", flush=True)


if WEB:
    # the three baked maps, at TEX (roughness is baked into all three channels, so it is in G as glTF wants it)
    # ...with every island run out into the empty atlas around it, so that no black reaches an edge texel, a mip level, or a
    # compressor's block (the gutters bled dark smears into the hood's edge). The pixels are read and written RAW (each
    # file loaded as Non-Color: the baked bytes in, the same bytes out; the colour stays sRGB-encoded exactly once, as baked).
    def raw(path):
        im = bpy.data.images.load(path); im.colorspace_settings.name = "Non-Color"
        a = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32); im.pixels.foreach_get(a)
        return im, a.reshape(im.size[1], im.size[0], 4)

    _, mk = raw(os.path.join(WEB, "amulet_mask.png"))
    covered = mk[..., 0] > 0.5
    print("ATLAS covered", round(float(covered.mean()), 3), flush=True)
    for name, neutral in (("color", None), ("normal", (0.5, 0.5, 1.0)), ("rough", None)):
        im, a = raw(os.path.join(WEB, f"amulet_{name}.png"))
        rgb = a[..., :3]
        known = covered.copy()
        for _ in range(48):                       # a pixel at a time out from the islands' edges, averaging what it touches
            if known.all():
                break
            acc = np.zeros_like(rgb); cnt = np.zeros(known.shape, np.float32)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy or dx:
                        k = np.roll(known, (dy, dx), (0, 1))
                        acc += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]; cnt += k
            new = ~known & (cnt > 0)
            rgb[new] = acc[new] / cnt[new][:, None]
            known |= new
        rest = ~known                             # (what is left, far from any island: the maps' mean, or a flat normal)
        rgb[rest] = neutral if neutral else rgb[covered].mean(0)
        a[..., 3] = 1.0
        im.pixels.foreach_set(a.ravel())
        im.filepath_raw = os.path.join(WEB, f"{name}.png"); im.file_format = "PNG"; im.save()
        os.remove(os.path.join(WEB, f"amulet_{name}.png"))
        print("FILLED", name, "covered", round(float(covered.mean()), 3), "->", round(float(known.mean()), 3), flush=True)
    # the wire copy first, from the whole joined object: about 5k triangles, positions only
    wire = am.copy(); wire.data = am.data.copy(); wire.name = "wire"; wire.data.materials.clear()
    scene.collection.objects.link(wire)
    decimate(wire, 0.010)   # (0.012 gave 6.1k triangles on today's denser crown)
    export_glb(wire, os.path.join(WEB, "pendant-wire.glb"), export_materials="NONE", export_normals=False,
               export_texcoords=False, export_attributes=False, export_image_format="NONE")
    print("WIRE", sum(len(p.vertices) - 2 for p in wire.data.polygons), "triangles", flush=True)
    # the pendant: everything but the heads decimated (the heads keep their faces), one mesh, no materials
    me = am.data
    bpy.ops.object.select_all(action="DESELECT"); am.select_set(True); bpy.context.view_layer.objects.active = am
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="FACE")
    bm = bmesh.from_edit_mesh(me)
    flag = bm.faces.layers.bool["is_head"]
    for f in bm.faces:
        f.select_set(False)
    for f in bm.faces:
        if f[flag]:
            f.select_set(True)
    bm.select_flush_mode()
    bmesh.update_edit_mesh(me)
    print("HEAD FACES", sum(1 for f in bm.faces if f[flag]), "of", len(bm.faces), flush=True)
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    heads = [o for o in scene.objects if o.type == "MESH" and o not in (am, wire)][0]
    NONHEAD = float(argv[argv.index("--ratio") + 1]) if "--ratio" in argv else 0.35
    n0 = len(am.data.polygons)
    decimate(am, NONHEAD)
    print("DECIMATED non-head", n0, "->", len(am.data.polygons), "faces; heads", len(heads.data.polygons), flush=True)
    bpy.ops.object.select_all(action="DESELECT"); heads.select_set(True); am.select_set(True)
    bpy.context.view_layer.objects.active = am
    bpy.ops.object.join()
    am.data.materials.clear()
    export_glb(am, os.path.join(WEB, "pendant.glb"), export_materials="NONE", export_normals=True, export_texcoords=True,
               export_attributes=False, export_image_format="NONE")
else:
    glb = os.path.join(OUT, "amulet.glb")
    export_glb(am, glb, export_image_format="JPEG", export_jpeg_quality=88)
    print("WROTE", glb, len(am.data.vertices), "verts", flush=True)

if PREVIEW:
    rd = os.path.join(HERE, "renders"); os.makedirs(rd, exist_ok=True)
    # a soft studio: a big warm key, a cool rim, a dim fill; transparent ground
    def area(name, loc, size, watts, col):
        d = bpy.data.lights.new(name, "AREA"); d.size = size; d.energy = watts; d.color = col
        o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    area("key", (-1.6, -2.0, 1.8), 1.6, 160, (1.0, 0.92, 0.82))
    area("rim", (1.8, 1.6, 1.4), 1.0, 120, (0.82, 0.88, 1.0))
    area("fill", (2.0, -1.5, 0.4), 2.0, 30, (1, 1, 1))
    # metal shows what it reflects: Blender's own studio HDRI around it
    wn = scene.world.node_tree
    env = wn.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(os.path.dirname(bpy.app.binary_path), "..", "Resources",
                                                  f"{bpy.app.version[0]}.{bpy.app.version[1]}", "datafiles", "studiolights", "world", "studio.exr"))
    wn.links.new(env.outputs["Color"], wn.nodes["Background"].inputs["Color"])
    wn.nodes["Background"].inputs["Strength"].default_value = 0.8
    cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 85
    cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 900, 1200
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    for k, deg in enumerate((0, 45, 90, 180)):
        a = math.radians(deg)
        cam.location = (4.2 * math.sin(a), -4.2 * math.cos(a), 0.62)
        cam.rotation_euler = (Vector((0, 0, 0.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(rd, f"amulet_{deg:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDER", deg, flush=True)
    # and the face up close
    cam.location = (0.25, -1.55, 0.53); cam_d.lens = 100
    cam.rotation_euler = (Vector((0, 0, 0.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(rd, "amulet_face.png")
    bpy.ops.render.render(write_still=True)
sys.exit(0)
