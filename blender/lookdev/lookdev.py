"""Material look-dev renders for the portfolio sphere (approval stills, not web assets).

Run (from the repo root):
  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/lookdev.py -- --scene ball
  ... --scene chaos | glass   [--preview]   [--out blender/lookdev/renders]

Scenes
  ball   the dense ball: hundreds of thousands of solid, matte, faceted grains on noise filaments
  chaos  the same grains spread into the chaotic cloud, with a gust of grains flying toward the lens
  glass  the final clear, thick glass sphere, true to a dark set
"""

import argparse
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------- args

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--scene", choices=["ball", "chaos", "glass", "studio", "desk", "bench", "canvas"], required=True)
ap.add_argument("--grid", choices=["etched", "glow", "mat"], default="etched", help="bench scene only")
ap.add_argument("--state", choices=["dense", "mid", "glass"], default="glass", help="studio scene only")
ap.add_argument("--preview", action="store_true", help="small, fast, noisy render to check the setup")
ap.add_argument("--out", default="blender/lookdev/renders")
args = ap.parse_args(argv)

# ---------------------------------------------------------------- brand colours (linear)

def srgb(hex_):
    c = [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)

MAGENTA = srgb("#7a2452")
PLUM = srgb("#2e0d1c")
DUSTY_ROSE = srgb("#8f4258")
ROSE_GOLD = srgb("#b9725c")
MUTED_GOLD = srgb("#b98a4a")
ROSE = srgb("#bb687b")
ROSE_SOFT = srgb("#cda2b9")
GOLD = srgb("#cda265")
PEACH = srgb("#e7a48c")

# ---------------------------------------------------------------- vectorised value noise (same family as the web version)

_perm = np.random.default_rng(1234).permutation(256)
PERM = np.concatenate([_perm, _perm])

def _lat(i, j, k):
    return PERM[(PERM[(PERM[i & 255] + j) & 255] + k) & 255] / 255.0

def noise(x, y, z):
    xi, yi, zi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64), np.floor(z).astype(np.int64)
    xf, yf, zf = x - xi, y - yi, z - zi
    u, v, w = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf), zf * zf * (3 - 2 * zf)
    a, b = _lat(xi, yi, zi), _lat(xi + 1, yi, zi)
    c, d = _lat(xi, yi + 1, zi), _lat(xi + 1, yi + 1, zi)
    e, f = _lat(xi, yi, zi + 1), _lat(xi + 1, yi, zi + 1)
    g, h = _lat(xi, yi + 1, zi + 1), _lat(xi + 1, yi + 1, zi + 1)
    x1, x2, x3, x4 = a + (b - a) * u, c + (d - c) * u, e + (f - e) * u, g + (h - g) * u
    y1, y2 = x1 + (x2 - x1) * v, x3 + (x4 - x3) * v
    return y1 + (y2 - y1) * w

def fbm(x, y, z):
    return noise(x, y, z) * 0.55 + noise(x * 2.03 + 5.2, y * 2.03, z * 2.03) * 0.3 + noise(x * 4.1, y * 4.1 + 1.7, z * 4.1) * 0.15

def filament_points(n, seed, sharp=6):
    """Points inside the unit ball, concentrated on warped noise sheets/filaments (the 'sand' structure)."""
    rng = np.random.default_rng(seed)
    out = []
    have = 0
    while have < n:
        p = rng.uniform(-1, 1, size=(400_000, 3))
        p = p[(p ** 2).sum(1) < 1]
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        wx = x + (fbm(x * 1.5 + 3.1, y * 1.5, z * 1.5) - 0.5) * 1.6
        wy = y + (fbm(x * 1.5, y * 1.5 + 7.3, z * 1.5) - 0.5) * 1.6
        wz = z + (fbm(x * 1.5, y * 1.5, z * 1.5 + 11.7) - 0.5) * 1.6
        f = fbm(wx * 2.2, wy * 2.2, wz * 2.2)
        ridge = np.clip(1 - np.abs(f - 0.5) * 3.2, 0, 1)
        keep = rng.uniform(0, 1, len(p)) < ridge ** sharp * 1.3
        out.append(p[keep])
        have += int(keep.sum())
    p = np.concatenate(out)[:n]
    hue = fbm(p[:, 0] * 1.2 + 20, p[:, 1] * 1.2, p[:, 2] * 1.2)
    hue = np.clip((hue - hue.min()) / (hue.max() - hue.min() + 1e-9), 0, 1)
    return p.astype(np.float32), hue.astype(np.float32)

# ---------------------------------------------------------------- scene helpers

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def aim(obj, target=(0, 0, 0)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

def area_light(name, loc, size, energy, color=(1, 1, 1), size_y=None, target=(0, 0, 0)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color[:3]
    if size_y:
        data.shape = "ELLIPSE" if name == "key" else "RECTANGLE"
        data.size, data.size_y = size, size_y
    else:
        data.size = size
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    scene.collection.objects.link(ob)
    aim(ob, target)
    return ob

def camera(loc, target=(0, 0, 0), lens=50, focus=None, fstop=None):
    data = bpy.data.cameras.new("cam")
    data.lens = lens
    if focus is not None:
        data.dof.use_dof = True
        data.dof.focus_distance = focus
        data.dof.aperture_fstop = fstop
    ob = bpy.data.objects.new("cam", data)
    ob.location = loc
    scene.collection.objects.link(ob)
    aim(ob, target)
    scene.camera = ob
    return ob

def principled(name, base, roughness, **inputs):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = roughness
    for k, v in inputs.items():
        bsdf.inputs[k].default_value = v
    return m

def plane(name, size, loc, rot=(0, 0, 0), mat=None):
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    if mat:
        ob.data.materials.append(mat)
    return ob

def softbox(name, loc, w, h, strength, target=(0, 0, 0), color=(1, 0.97, 0.95, 1), visible=False, edge=0.5, peak=0.95):
    """An emissive panel that is bright in the middle and falls off to its edges, like a real softbox."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (w, h, 1)
    direction = Vector(target) - ob.location
    ob.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    m = bpy.data.materials.new(name + "_mat")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (-0.5, -0.5, 0)
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = edge
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = peak
    ramp.color_ramp.elements[1].color = color
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    ob.data.materials.append(m)
    ob.visible_camera = visible
    return ob

def csock(sockets, name):
    """The RGBA socket called `name` (Mix nodes expose float, vector and colour sockets with identical names)."""
    return next(s for s in sockets if s.name == name and s.type == "RGBA")

def world(color, strength):
    w = bpy.data.worlds.new("world")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = color
    bg.inputs["Strength"].default_value = strength
    scene.world = w

def sand_material(transform=False):
    m = bpy.data.materials.new("sand_to_glass" if transform else "sand")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_type = "INSTANCER"
    attr.attribute_name = "hue"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, PLUM
    els[1].position, els[1].color = 0.42, DUSTY_ROSE
    e = els.new(0.74); e.color = ROSE_GOLD
    e = els.new(1.0); e.color = MUTED_GOLD
    nt.links.new(attr.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    # Solid, matte, crisp: no glow, a little sheen of specular only.
    bsdf.inputs["Roughness"].default_value = 0.62
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    if transform:
        # 'clear' 0 = sand, 1 = glass. The colour drains as the grain clears; no heat, no glow.
        clear = nt.nodes.new("ShaderNodeAttribute")
        clear.attribute_type = "INSTANCER"
        clear.attribute_name = "clear"
        glass = nt.nodes.new("ShaderNodeBsdfPrincipled")
        glass.inputs["Base Color"].default_value = (1, 1, 1, 1)
        frost = nt.nodes.new("ShaderNodeMapRange")
        frost.inputs["To Min"].default_value = 0.45
        frost.inputs["To Max"].default_value = 0.04
        nt.links.new(clear.outputs["Fac"], frost.inputs["Value"])
        nt.links.new(frost.outputs["Result"], glass.inputs["Roughness"])
        glass.inputs["Base Color"].default_value = (1.0, 0.9, 0.85, 1)
        glass.inputs["IOR"].default_value = 1.5
        glass.inputs["Transmission Weight"].default_value = 1.0
        mix = nt.nodes.new("ShaderNodeMixShader")
        out = nt.nodes["Material Output"]
        drain = nt.nodes.new("ShaderNodeMix")
        drain.data_type = "RGBA"
        csock(drain.inputs, "B").default_value = (0.98, 0.84, 0.76, 1)
        nt.links.new(clear.outputs["Fac"], drain.inputs["Factor"])
        nt.links.new(ramp.outputs["Color"], csock(drain.inputs, "A"))
        nt.links.new(csock(drain.outputs, "Result"), bsdf.inputs["Base Color"])
        nt.links.new(clear.outputs["Fac"], mix.inputs["Fac"])
        nt.links.new(bsdf.outputs[0], mix.inputs[1])
        nt.links.new(glass.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m

def grains(name, pts, hue, radius, jitter=0.22, clear=None):
    """Instances a small faceted rock-like grain (icosphere, flat shaded, random squash and rotation) on every point."""
    me = bpy.data.meshes.new(name + "_pts")
    me.vertices.add(len(pts))
    me.vertices.foreach_set("co", pts.ravel())
    a = me.attributes.new("hue", "FLOAT", "POINT")
    a.data.foreach_set("value", hue)
    s = me.attributes.new("gscale", "FLOAT", "POINT")
    s.data.foreach_set("value", radius.astype(np.float32))
    if clear is not None:
        c = me.attributes.new("clear", "FLOAT", "POINT")
        c.data.foreach_set("value", clear.astype(np.float32))
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)

    ng = bpy.data.node_groups.new(name + "_gn", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, l = ng.nodes, ng.links
    gin, gout = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    m2p = n.new("GeometryNodeMeshToPoints")
    ico = n.new("GeometryNodeMeshIcoSphere")
    ico.inputs["Radius"].default_value = 1.0
    ico.inputs["Subdivisions"].default_value = 2
    smooth = n.new("GeometryNodeSetShadeSmooth")
    setm = n.new("GeometryNodeSetMaterial")
    setm.inputs["Material"].default_value = sand_material(transform=clear is not None)
    inst = n.new("GeometryNodeInstanceOnPoints")
    sca = n.new("GeometryNodeInputNamedAttribute")
    sca.data_type = "FLOAT"
    sca.inputs["Name"].default_value = "gscale"
    rot = n.new("FunctionNodeRandomValue")
    rot.data_type = "FLOAT_VECTOR"
    rot.inputs[1].default_value = (6.2832, 6.2832, 6.2832)
    rot.inputs["Seed"].default_value = 3
    squash = n.new("FunctionNodeRandomValue")
    squash.data_type = "FLOAT_VECTOR"
    squash.inputs[0].default_value = (1 - jitter, 1 - jitter, 1 - jitter)
    squash.inputs[1].default_value = (1 + jitter, 1 + jitter, 1 + jitter)
    squash.inputs["Seed"].default_value = 9
    vm = n.new("ShaderNodeVectorMath")
    vm.operation = "SCALE"
    l.new(gin.outputs[0], m2p.inputs["Mesh"])
    l.new(m2p.outputs["Points"], inst.inputs["Points"])
    l.new(ico.outputs["Mesh"], smooth.inputs["Geometry"])
    l.new(smooth.outputs["Geometry"], setm.inputs["Geometry"])
    l.new(setm.outputs["Geometry"], inst.inputs["Instance"])
    l.new(squash.outputs[0], vm.inputs[0])
    l.new(sca.outputs["Attribute"], vm.inputs["Scale"])
    l.new(vm.outputs[0], inst.inputs["Scale"])
    l.new(rot.outputs[0], inst.inputs["Rotation"])
    l.new(inst.outputs["Instances"], gout.inputs[0])
    mod = ob.modifiers.new("grains", "NODES")
    mod.node_group = ng
    return ob

def render_settings(samples, w=1600, h=1000):
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "METAL"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 16
    scene.cycles.transmission_bounces = 16
    scene.cycles.glossy_bounces = 8
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Punchy", "Punchy", "AgX - High Contrast", "High Contrast", "AgX - Medium High Contrast"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.render.image_settings.file_format = "PNG"

# ---------------------------------------------------------------- scenes

def build_ball():
    n = 60_000 if args.preview else 700_000
    p, hue = filament_points(n, seed=2026)
    r = np.linalg.norm(p, axis=1, keepdims=True)
    dirs = p / np.maximum(r, 1e-6)
    pts = dirs * (r ** 0.3)          # same texture, pulled toward the surface: a dense ball
    rng = np.random.default_rng(7)
    radius = rng.uniform(0.004, 0.009, len(pts)) * (2.4 if args.preview else 1)
    grains("ball", pts, hue, radius)
    world((0.004, 0.0035, 0.0035, 1), 1.0)
    area_light("key", (-3.2, -3.0, 3.4), 2.6, 1150, (1.0, 0.82, 0.68))
    area_light("rim", (3.0, 3.2, 1.8), 1.4, 800, ROSE_SOFT)
    area_light("fill", (2.8, -3.5, 0.6), 3.0, 60, (0.72, 0.78, 0.95))
    camera((0, -5.2, 0.55), (0, 0, 0), lens=55, focus=4.25, fstop=8)

def build_chaos():
    n = 80_000 if args.preview else 520_000
    p, hue = filament_points(n, seed=2026, sharp=10)
    rng = np.random.default_rng(7)
    r = np.linalg.norm(p, axis=1)
    keep = rng.uniform(0, 1, len(p)) < (1 - 0.75 * r ** 2)      # thin out toward the edge: no hard outline
    p, hue, r = p[keep], hue[keep], r[keep]
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    wx = x + (fbm(x * 0.9 + 2.0, y * 0.9, z * 0.9) - 0.5) * 1.8   # large-scale warp: a torn, organic silhouette
    wy = y + (fbm(x * 0.9, y * 0.9 + 6.0, z * 0.9) - 0.5) * 1.8
    wz = z + (fbm(x * 0.9, y * 0.9, z * 0.9 + 9.0) - 0.5) * 1.8
    spread = 1 + 0.6 * r ** 3
    pts = np.stack([wx * 2.3 * spread, wz * 2.0 * spread, wy * 1.45 * spread], axis=1)
    radius = rng.uniform(0.004, 0.009, len(pts)) * (2.4 if args.preview else 1)
    # A gust: a stream of grains travelling from the cloud toward the lens.
    g = 260
    t = np.sort(rng.uniform(0, 1, g)) ** 1.6
    start, end = np.array([-0.6, 0.4, 0.25]), np.array([0.7, -8.9, 0.7])
    stream = start + (end - start) * t[:, None] + rng.normal(0, 1, (g, 3)) * (0.06 + 0.12 * t[:, None])
    pts = np.concatenate([pts, stream]).astype(np.float32)
    hue = np.concatenate([hue, rng.uniform(0.65, 1, g).astype(np.float32)])
    radius = np.concatenate([radius, rng.uniform(0.012, 0.02, g) * (2.4 if args.preview else 1)])
    grains("chaos", pts, hue, radius)
    world((0.004, 0.0035, 0.0035, 1), 1.0)
    area_light("key", (-4.0, -7.0, 4.0), 3.5, 1900, (1.0, 0.82, 0.68))
    area_light("rim", (3.5, 4.0, 2.0), 2.2, 1100, ROSE_SOFT)
    area_light("fill", (3.5, -4.0, -1.0), 4.0, 80, (0.72, 0.78, 0.95))
    # Focused on the cloud with a deep aperture: grains stay crisp, only the last ones by the lens go soft.
    camera((0, -9.5, 0.6), (0, 0, 0.1), lens=45, focus=9.3, fstop=11)

def build_glass():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=160, ring_count=80, radius=1.0, location=(0, 0, 0))
    sph = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new("glass")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.5
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    absorb = nt.nodes.new("ShaderNodeVolumeAbsorption")
    absorb.inputs["Color"].default_value = (0.86, 0.92, 0.93, 1)
    absorb.inputs["Density"].default_value = 0.35
    nt.links.new(absorb.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    sph.data.materials.append(m)
    # A dark set: a curved backdrop and floor (one continuous surface) with a soft gradient of light on it,
    # so the glass has something to refract. Nothing recognisable is reflected.
    bpy.ops.mesh.primitive_plane_add(size=1)
    cyc = bpy.context.active_object
    cyc.name = "cyc"
    bm_verts = []
    W, D, H, Rb = 30.0, 9.0, 12.0, 3.0
    import bmesh
    bm = bmesh.new()
    prof = []
    for i in range(0, 21):
        prof.append((-12 + i * (D + 12 - Rb) / 20, -1.0))
    for i in range(1, 25):
        a = (i / 24) * (math.pi / 2)
        prof.append((D - Rb + math.sin(a) * Rb, -1.0 + Rb - math.cos(a) * Rb))
    for i in range(1, 11):
        prof.append((D, -1.0 + Rb + i * (H - Rb) / 10))
    rows = []
    for x in (-W / 2, W / 2):
        rows.append([bm.verts.new((x, y, z)) for (y, z) in prof])
    for k in range(len(prof) - 1):
        bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
    bm.to_mesh(cyc.data)
    bm.free()
    cyc_mat = principled("set", (0.035, 0.031, 0.032, 1), 0.35)
    cyc.data.materials.clear()
    cyc.data.materials.append(cyc_mat)
    bpy.ops.object.shade_smooth()
    world((0.002, 0.002, 0.002, 1), 1.0)
    # Key softbox: big, soft, upper right front -> the crisp crescent highlight. Neutral white.
    softbox("key", (3.2, -3.4, 3.6), 3.2, 2.0, 28.0)
    # Rim strips: carry the only colour, rose and gold, on the edges.
    area_light("rim_rose", (-3.6, 2.2, 1.2), 0.25, 450, ROSE, size_y=4.0)
    area_light("rim_gold", (3.8, 2.6, 0.2), 0.25, 300, GOLD, size_y=3.0)
    # A soft wash on the backdrop so refraction through the glass is visible.
    area_light("wash", (0, 5.5, 5.5), 6.0, 380, (0.95, 0.92, 0.92), target=(0, 8.5, 1.5))
    camera((0, -6.2, 0.65), (0, 0, 0.05), lens=60)

def glass_material(frost=False):
    m = bpy.data.materials.new("glass_frost" if frost else "glass")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.5
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    absorb = nt.nodes.new("ShaderNodeVolumeAbsorption")
    absorb.inputs["Color"].default_value = (0.86, 0.92, 0.93, 1)
    absorb.inputs["Density"].default_value = 0.35
    nt.links.new(absorb.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    if frost:
        # Where the surface has only just turned (clear near 0) it is frosted and faintly warm; it clears as clear -> 1.
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_type = "GEOMETRY"
        attr.attribute_name = "clear"
        rough = nt.nodes.new("ShaderNodeMapRange")
        rough.inputs["To Min"].default_value = 0.6
        rough.inputs["To Max"].default_value = 0.14
        nt.links.new(attr.outputs["Fac"], rough.inputs["Value"])
        nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
        tint = nt.nodes.new("ShaderNodeMix")
        tint.data_type = "RGBA"
        csock(tint.inputs, "A").default_value = (0.96, 0.82, 0.76, 1)
        csock(tint.inputs, "B").default_value = (1, 1, 1, 1)
        nt.links.new(attr.outputs["Fac"], tint.inputs["Factor"])
        nt.links.new(csock(tint.outputs, "Result"), bsdf.inputs["Base Color"])
        exists = nt.nodes.new("ShaderNodeMapRange")
        exists.inputs["From Min"].default_value = 0.0
        exists.inputs["From Max"].default_value = 0.06
        nt.links.new(attr.outputs["Fac"], exists.inputs["Value"])
        transparent = nt.nodes.new("ShaderNodeBsdfTransparent")
        mask = nt.nodes.new("ShaderNodeMixShader")
        out = nt.nodes["Material Output"]
        nt.links.new(exists.outputs["Result"], mask.inputs["Fac"])
        nt.links.new(transparent.outputs[0], mask.inputs[1])
        nt.links.new(bsdf.outputs[0], mask.inputs[2])
        nt.links.new(mask.outputs[0], out.inputs["Surface"])
        # Still forming: the clearing is a lit, translucent frost skin (like sugar glass) that only slowly gains
        # transparency, so it reads as solid material catching the studio light, not a window into the ball.
        bsdf.inputs["Subsurface Weight"].default_value = 1.0
        bsdf.inputs["Subsurface Radius"].default_value = (0.4, 0.25, 0.2)
        bsdf.inputs["Subsurface Scale"].default_value = 0.05
        trans = nt.nodes.new("ShaderNodeMapRange")
        trans.inputs["To Min"].default_value = 0.15
        trans.inputs["To Max"].default_value = 0.7
        nt.links.new(attr.outputs["Fac"], trans.inputs["Value"])
        nt.links.new(trans.outputs["Result"], bsdf.inputs["Transmission Weight"])
    return m

def glass_sphere(radius, clear_fn=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=160, ring_count=80, radius=radius, location=(0, 0, 0))
    ob = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    if clear_fn is not None:
        co = np.empty(len(ob.data.vertices) * 3, dtype=np.float32)
        ob.data.vertices.foreach_get("co", co)
        d = co.reshape(-1, 3)
        d = d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
        a = ob.data.attributes.new("clear", "FLOAT", "POINT")
        a.data.foreach_set("value", clear_fn(d).astype(np.float32))
    ob.data.materials.append(glass_material(frost=clear_fn is not None))
    return ob

def ring_light(z, major, minor, strength):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=(0, -0.6, z))
    ob = bpy.context.active_object
    m = bpy.data.materials.new("ring")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1, 0.97, 0.95, 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    ob.data.materials.append(m)
    ob.visible_camera = False
    return ob

def build_studio():
    """Ch3: the sphere floats in a dark studio in front of a large soft gradient of light."""
    cam_loc = (0, -6.4, 0.35)
    world((0.002, 0.002, 0.002, 1), 1.0)
    # The lit backdrop: a big panel, brightest in the middle, falling off to black. Warm neutral, no strong colour.
    softbox("backdrop", (0, 7.0, 0.5), 7.5, 7.5, 1.6, target=cam_loc, color=(0.86, 0.76, 0.72, 1), visible=True, edge=0.5, peak=1.0)
    # Dim bounce cards above and below, out of frame: the glass edges pick up soft light instead of going black.
    softbox("card_top", (0, -0.5, 6.0), 9.0, 6.0, 1.3, target=(0, -0.5, 0), color=(0.9, 0.86, 0.84, 1), edge=0.2)
    softbox("card_low", (0, -0.5, -6.0), 9.0, 6.0, 0.8, target=(0, -0.5, 0), color=(0.9, 0.84, 0.8, 1), edge=0.2)
    softbox("key", (-3.2, -3.6, 3.0), 3.0, 2.0, 22.0)
    area_light("rim_rose", (-3.4, 2.4, 0.8), 0.25, 380, ROSE, size_y=4.0)
    area_light("rim_gold", (3.6, 2.6, 0.0), 0.25, 260, GOLD, size_y=3.0)
    camera(cam_loc, (0, 0, 0), lens=62)
    if args.state in ("dense", "mid"):
        area_light("grain_key", (-3.2, -3.0, 3.4), 2.6, 1150, (1.0, 0.82, 0.68))
    if args.state in ("mid", "glass"):
        softbox("top", (-1.2, -2.6, 4.2), 4.2, 2.2, 4.0, color=(1, 0.97, 0.95, 1), edge=0.25)
        softbox("strip_l", (-3.0, -2.0, 0.2), 0.5, 3.2, 6.0, color=(1, 0.97, 0.95, 1), edge=0.35)
        softbox("strip_r", (3.0, -2.2, -0.2), 0.4, 2.6, 4.0, color=(1, 0.97, 0.95, 1), edge=0.35)

    full = 60_000 if args.preview else 700_000
    rng = np.random.default_rng(7)
    if args.state in ("dense", "mid"):
        p, hue = filament_points(full, seed=2026)
        r = np.linalg.norm(p, axis=1, keepdims=True)
        dirs = p / np.maximum(r, 1e-6)
        shell = r[:, 0] ** 0.3
        radius = rng.uniform(0.004, 0.009, len(p)) * (2.4 if args.preview else 1)
        if args.state == "dense":
            grains("ball", dirs * shell[:, None], hue, radius)
        else:
            # Mid-contraction: a glass core has formed; what's left of the sand is pulled in toward it, swirling.
            # Inside out: the core has already become glass and the clarity is breaking through the surface in
            # irregular patches. At the edge of each patch the grains themselves turn to glass (colour drains, they go
            # transparent and sink into the surface). Elsewhere the sand is compacted, matte and rose. One material.
            R0 = 0.84
            norm = (shell - shell.min()) / (shell.max() - shell.min())
            field = fbm(dirs[:, 0] * 1.7 + 3.0, dirs[:, 1] * 1.7, dirs[:, 2] * 1.7 + 5.0)
            rank = np.argsort(np.argsort(field)) / len(field)          # uniform 0..1 over the sphere
            lo, hi = 0.62, 0.88                                          # transition band; above hi it's already glass
            keep = rank < hi
            dirs, norm, hue, radius, rank = dirs[keep], norm[keep], hue[keep], radius[keep], rank[keep]
            clear = np.clip((rank - lo) / (hi - lo), 0, 1) ** 1.4
            rad = R0 * (0.985 + 0.03 * norm) - 0.03 * clear              # compacted shell; clearing grains sink in
            radius = radius * (1 + 0.7 * clear)                         # and spread, fusing into the surface
            grains("fusing", (dirs * rad[:, None]).astype(np.float32), hue, radius, clear=clear)
            def fld(d):
                return fbm(d[:, 0] * 1.7 + 3.0, d[:, 1] * 1.7, d[:, 2] * 1.7 + 5.0)
            f_lo, f_hi, f_top = np.quantile(field, [lo, hi, 0.97])
            glass_sphere(R0 * 1.012, clear_fn=lambda d: np.clip((fld(d) - f_lo) / (f_top - f_lo), 0, 1))
    else:
        glass_sphere(0.72)

# ---------------------------------------------------------------- chapter 2 sets (real-world scale: metres)

def dense_ball(center, R, flare=True, seed=2026):
    """The living dense ball at real scale, with one solar-flare arc of grains lifting off its surface."""
    full = 50_000 if args.preview else 520_000
    p, hue = filament_points(full, seed=seed)
    r = np.linalg.norm(p, axis=1, keepdims=True)
    dirs = p / np.maximum(r, 1e-6)
    pts = dirs * (r ** 0.3) * R
    rng = np.random.default_rng(seed + 1)
    radius = rng.uniform(0.004, 0.009, len(pts)) * R * (2.4 if args.preview else 1)
    if flare:
        # An arc of grains lifting off the upper-left limb and falling back, like a solar prominence.
        k = 1100
        t = rng.uniform(0, 1, k)
        a0 = np.array([-0.62, -0.35, 0.70]); a0 /= np.linalg.norm(a0)
        tang = np.cross(a0, [0, 0, 1.0]); tang /= np.linalg.norm(tang)
        h = 0.22 * np.sin(np.pi * t) * rng.uniform(0.4, 1.0, k)
        base = a0[None, :] + tang[None, :] * (t[:, None] - 0.5) * 0.55
        base /= np.linalg.norm(base, axis=1, keepdims=True)
        fp = base * (1 + h[:, None]) + rng.normal(0, 0.06, (k, 3)) * (0.3 + h[:, None] * 3)
        pts = np.concatenate([pts, fp * R])
        hue = np.concatenate([hue, rng.uniform(0.55, 1.0, k).astype(np.float32)])
        radius = np.concatenate([radius, rng.uniform(0.004, 0.008, k) * R * (2.4 if args.preview else 1)])
    grains("ball", (pts + np.array(center)).astype(np.float32), hue, radius)

def image_from_array(name, rgba):
    h, w = rgba.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.flipud(rgba).astype(np.float32).ravel())
    img.pack()
    return img

def scribble_texture(name, lines, seed, ink=(0.08, 0.08, 0.1)):
    """Placeholder handwriting: loose graphite scribble lines. Replaced later by photos of Liam's real notes."""
    W = H = 512
    rng = np.random.default_rng(seed)
    a = np.zeros((H, W), np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    for i in range(lines):
        y0 = 90 + i * (H - 160) / max(1, lines - 1)
        x_end = rng.uniform(0.55, 0.88) * W
        f1, f2, ph = rng.uniform(0.08, 0.14), rng.uniform(0.02, 0.04), rng.uniform(0, 6)
        curve = y0 + 9 * np.sin(xx * f1 + ph) * np.sin(xx * f2) + rng.normal(0, 0.5)
        gaps = (np.sin(xx * 0.045 + ph * 3) > -0.85)
        stroke = np.exp(-((yy - curve) ** 2) / (2 * 2.2 ** 2)) * (xx > 60) * (xx < x_end) * gaps
        a = np.maximum(a, stroke)
    rgba = np.zeros((H, W, 4), np.float32)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = ink
    rgba[..., 3] = np.clip(a * 0.9, 0, 1)
    return image_from_array(name, rgba)

def transcript_texture(name, seed):
    """An interview transcript: grey text bars and a few highlighter stripes."""
    W, H = 512, 724
    rng = np.random.default_rng(seed)
    rgba = np.zeros((H, W, 4), np.float32)
    y = 60
    while y < H - 50:
        n = rng.integers(5, 11)
        x = 50
        for _ in range(n):
            w = rng.integers(18, 60)
            if x + w > W - 50:
                break
            rgba[y:y + 7, x:x + w, :3] = 0.18
            rgba[y:y + 7, x:x + w, 3] = 0.85
            x += w + 9
        if rng.uniform() < 0.12:
            x0 = rng.integers(50, 250); x1 = min(W - 50, x0 + rng.integers(80, 220))
            rgba[y - 4:y + 11, x0:x1, 0] = 0.95; rgba[y - 4:y + 11, x0:x1, 1] = 0.62; rgba[y - 4:y + 11, x0:x1, 2] = 0.62
            rgba[y - 4:y + 11, x0:x1, 3] = 0.55
        y += 22 if rng.uniform() > 0.15 else 40
    return image_from_array(name, rgba)

def paper_material(name, base, overlay=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.78
    bsdf.inputs["Subsurface Weight"].default_value = 0.06
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 400.0
    noise.inputs["Detail"].default_value = 6.0
    mixc = nt.nodes.new("ShaderNodeMix"); mixc.data_type = "RGBA"
    mixc.inputs["Factor"].default_value = 0.06
    csock(mixc.inputs, "A").default_value = base
    nt.links.new(noise.outputs["Color"], csock(mixc.inputs, "B"))
    col = csock(mixc.outputs, "Result")
    if overlay is not None:
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = overlay
        ink = nt.nodes.new("ShaderNodeMix"); ink.data_type = "RGBA"
        nt.links.new(tex.outputs["Alpha"], ink.inputs["Factor"])
        nt.links.new(col, csock(ink.inputs, "A"))
        nt.links.new(tex.outputs["Color"], csock(ink.inputs, "B"))
        col = csock(ink.outputs, "Result")
    nt.links.new(col, bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.05
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def sheet(name, size, loc, rot_z, mat, curl=0.0, lift=0.0006):
    """A thin, slightly curled sheet of paper or a sticky note."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(loc[0], loc[1], loc[2] + lift))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.rotation_euler = (0, 0, rot_z)
    bpy.ops.object.transform_apply(scale=True)
    sub = ob.modifiers.new("sub", "SUBSURF"); sub.subdivision_type = "SIMPLE"; sub.levels = sub.render_levels = 4
    if curl:
        # A gentle lift of the paper's far edge: displace vertices by distance from the near edge (a few mm at most).
        co = np.empty(len(ob.data.vertices) * 3, np.float32)
        ob.data.vertices.foreach_get("co", co)
        v = co.reshape(-1, 3)
        span = v[:, 0].max() - v[:, 0].min() + 1e-9
        u = (v[:, 0] - v[:, 0].min()) / span
        v[:, 2] += curl * 0.02 * u ** 3
        ob.data.vertices.foreach_set("co", v.ravel())
        ob.data.update()
    sol = ob.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.0003
    ob.data.materials.append(mat)
    return ob

def walnut_material():
    m = bpy.data.materials.new("walnut")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Coat Weight"].default_value = 0.25
    bsdf.inputs["Coat Roughness"].default_value = 0.25
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (2.2, 42.0, 1.0)
    grain = nt.nodes.new("ShaderNodeTexNoise"); grain.inputs["Scale"].default_value = 4.0
    grain.inputs["Detail"].default_value = 12.0; grain.inputs["Roughness"].default_value = 0.62; grain.inputs["Distortion"].default_value = 0.6
    fine = nt.nodes.new("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 160.0; fine.inputs["Detail"].default_value = 4.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.32, srgb("#1c110b")
    els[1].position, els[1].color = 0.68, srgb("#4b301f")
    e = els.new(0.5); e.color = srgb("#33201a")
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], grain.inputs["Vector"])
    nt.links.new(grain.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.04
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def build_desk():
    """2.1 Finding the problem: a walnut desk at night, lit by a warm lamp off-frame. The ball hovers among the notes."""
    plane("desk", 3.0, (0, 0, 0), mat=walnut_material())
    R = 0.07
    ball_c = (0.0, 0.03, R + 0.028)
    dense_ball(ball_c, R)
    PAPER = srgb("#ece6da"); YELLOW = srgb("#e6c86a"); PINK = srgb("#e3a6a6"); CARD = srgb("#f1ede4")
    sheet("transcript", (0.21, 0.297), (0.2, 0.17, 0), 0.32, paper_material("transcript_m", PAPER, transcript_texture("transcript_t", 3)), curl=0.06)
    sheet("card_a", (0.127, 0.076), (-0.17, 0.14, 0), -0.18, paper_material("card_a_m", CARD, scribble_texture("card_a_t", 4, 11)), curl=0.05)
    sheet("card_b", (0.127, 0.076), (-0.2, -0.02, 0.0004), 0.22, paper_material("card_b_m", CARD, scribble_texture("card_b_t", 3, 12)), curl=0.04)
    # The hero sticky note: closest to the ball and to the camera, in focus.
    sheet("sticky_hero", (0.076, 0.076), (0.085, -0.1, 0.0008), -0.12, paper_material("sticky_hero_m", YELLOW, scribble_texture("sticky_hero_t", 3, 21)), curl=0.12)
    sheet("sticky_b", (0.076, 0.076), (-0.09, -0.12, 0.0005), 0.3, paper_material("sticky_b_m", PINK, scribble_texture("sticky_b_t", 2, 22)), curl=0.08)
    sheet("sticky_c", (0.076, 0.076), (0.22, -0.04, 0.0009), -0.4, paper_material("sticky_c_m", YELLOW, scribble_texture("sticky_c_t", 3, 23)), curl=0.1)
    # A pen lying across a card.
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.0055, depth=0.145, location=(-0.15, 0.06, 0.0062), rotation=(0, math.pi / 2, 0.55))
    pen = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    pen.data.materials.append(principled("pen", (0.02, 0.02, 0.025, 1), 0.25, **{"Coat Weight": 0.6}))
    world((0.0025, 0.0024, 0.003, 1), 1.0)
    # The lamp: off-frame, upper left, warm. Its light defines the scene; the ball does not emit.
    sp = bpy.data.lights.new("lamp", "SPOT")
    sp.energy = 230
    sp.color = (1.0, 0.74, 0.48)
    sp.spot_size = math.radians(85)
    sp.spot_blend = 0.85
    sp.shadow_soft_size = 0.06
    lamp = bpy.data.objects.new("lamp", sp)
    lamp.location = (-0.42, 0.3, 0.55)
    scene.collection.objects.link(lamp)
    aim(lamp, (0.0, 0.0, 0.0))
    camera((0.03, -0.62, 0.46), (0.0, 0.02, 0.03), lens=50, focus=0.74, fstop=3.2)

def grid_material(kind):
    """A grid in object space, so it follows the surface into the gravity well."""
    m = bpy.data.materials.new("grid_" + kind)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    def line(axis_out):
        s = nt.nodes.new("ShaderNodeMath"); s.operation = "MULTIPLY"; s.inputs[1].default_value = 25.0  # 4 cm cells
        fr = nt.nodes.new("ShaderNodeMath"); fr.operation = "FRACT"
        lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = 0.045
        nt.links.new(axis_out, s.inputs[0]); nt.links.new(s.outputs[0], fr.inputs[0]); nt.links.new(fr.outputs[0], lt.inputs[0])
        return lt.outputs[0]
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
    nt.links.new(line(sep.outputs["X"]), mx.inputs[0]); nt.links.new(line(sep.outputs["Y"]), mx.inputs[1])
    mask = mx.outputs[0]
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    nt.links.new(mask, mix.inputs["Factor"])
    out = nt.nodes["Material Output"]
    if kind == "etched":
        csock(mix.inputs, "A").default_value = srgb("#cfd2d4"); csock(mix.inputs, "B").default_value = srgb("#8e9397")
        bsdf.inputs["Roughness"].default_value = 0.5
        bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; bump.invert = True
        nt.links.new(mask, bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    elif kind == "mat":
        csock(mix.inputs, "A").default_value = srgb("#2b2f31"); csock(mix.inputs, "B").default_value = srgb("#c9ccc6")
        bsdf.inputs["Roughness"].default_value = 0.85
    else:  # glow
        csock(mix.inputs, "A").default_value = srgb("#0b0c0e"); csock(mix.inputs, "B").default_value = srgb("#0b0c0e")
        bsdf.inputs["Roughness"].default_value = 0.6
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.75, 0.86, 1.0, 1)
        str_ = nt.nodes.new("ShaderNodeMath"); str_.operation = "MULTIPLY"; str_.inputs[1].default_value = 2.2
        nt.links.new(mask, str_.inputs[0]); nt.links.new(str_.outputs[0], em.inputs["Strength"])
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(bsdf.outputs[0], add.inputs[0]); nt.links.new(em.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs["Surface"])
    nt.links.new(csock(mix.outputs, "Result"), bsdf.inputs["Base Color"])
    return m

def well_surface(name, size, depth, sigma, mat, segments=260, edge_lift=0.0):
    """A square surface that sinks into a smooth well under the ball (the 'gravity' of the idea)."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=segments, y_subdivisions=segments, size=size, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    co = np.empty(len(ob.data.vertices) * 3, np.float32)
    ob.data.vertices.foreach_get("co", co)
    v = co.reshape(-1, 3)
    r2 = v[:, 0] ** 2 + v[:, 1] ** 2
    v[:, 2] = -depth * np.exp(-r2 / (2 * sigma ** 2))
    if edge_lift:
        edge = np.maximum(np.abs(v[:, 0]), np.abs(v[:, 1])) / (size / 2)
        v[:, 2] += edge_lift * np.clip((edge - 0.85) / 0.15, 0, 1) ** 2
    ob.data.vertices.foreach_set("co", v.ravel())
    ob.data.update()
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    return ob

def build_bench():
    """2.2 Checking I'm right: the ball's 'gravity' bends the grid. Three grid styles to choose from."""
    kind = args.grid
    R = 0.085
    if kind == "mat":
        plane("bench", 4.0, (0, 0, -0.16), mat=principled("bench_top", srgb("#2a2e31"), 0.6))
        well_surface("mat", 0.7, 0.085, 0.12, grid_material("mat"), edge_lift=0.0)
    else:
        well_surface("surface", 1.6, 0.11, 0.13, grid_material(kind))
    dense_ball((0, 0, R + 0.03), R)
    if kind == "glow":
        world((0.0015, 0.0018, 0.0025, 1), 1.0)
        area_light("key", (-0.6, -0.7, 0.9), 0.6, 55, (0.85, 0.92, 1.0))
        area_light("rim", (0.5, 0.6, 0.35), 0.3, 25, ROSE_SOFT)
    else:
        world((0.02, 0.024, 0.03, 1), 1.0)
        # Cool daylight from a big window to the left, plus a soft fill.
        area_light("window", (-1.3, -0.4, 0.9), 1.4, 260, (0.86, 0.93, 1.0), size_y=1.0)
        area_light("fill", (0.9, -0.9, 0.6), 1.0, 35, (1.0, 0.96, 0.92))
        area_light("rim", (0.4, 0.8, 0.4), 0.4, 30, ROSE_SOFT)
    camera((0.0, -0.92, 0.42), (0, 0, 0.0), lens=45, focus=0.98, fstop=4)

def build_canvas():
    """2.3 Building it: a dark design-tool canvas made of real beads, crowding toward the ball."""
    plane("canvas", 4.0, (0, 0, 0), mat=principled("canvas_m", srgb("#1b1c1f"), 0.55))
    R = 0.08
    dense_ball((0.06, 0.0, R + 0.05), R)
    # Bead grid: regular far away, pulled toward the ball near it (same mapping as the storyboard).
    sp = 0.022
    g = np.arange(-0.9, 0.9 + 1e-9, sp)
    gx, gy = np.meshgrid(g, g)
    gx, gy = gx.ravel() - 0.06, gy.ravel()
    r = np.hypot(gx, gy) + 1e-9
    r2 = r * (1 - 0.55 * np.exp(-r / (R * 2.6)))
    keep = r2 > R * 0.9
    x, y = 0.06 + gx[keep] * r2[keep] / r[keep], gy[keep] * r2[keep] / r[keep]
    near = np.exp(-(r2[keep] - R) / (R * 1.6))
    bead_r = 0.0016 + 0.0009 * near
    pts = np.stack([x, y, bead_r], axis=1).astype(np.float32)
    hue = (0.85 + 0.15 * near).astype(np.float32)
    beads = grains("beads", pts, hue, bead_r * 1.0, jitter=0.05)
    # Beads are a neutral, slightly warm porcelain, not sand-coloured.
    mat = bpy.data.materials["sand"] if "sand" in bpy.data.materials else None
    bm = principled("bead_m", srgb("#d8d3cd"), 0.35, **{"Coat Weight": 0.3})
    beads.modifiers["grains"].node_group.nodes["Set Material"].inputs["Material"].default_value = bm
    world((0.003, 0.003, 0.0035, 1), 1.0)
    softbox("top", (-0.2, -0.3, 1.1), 1.2, 0.8, 9.0, target=(0.06, 0, 0))
    area_light("key", (-0.7, -0.6, 0.7), 0.5, 45, (1.0, 0.9, 0.82))
    area_light("rim", (0.6, 0.7, 0.35), 0.3, 22, ROSE_SOFT)
    camera((0.05, -0.85, 0.55), (0.06, 0.0, 0.02), lens=45, focus=1.0, fstop=4)

# ---------------------------------------------------------------- go

{"ball": build_ball, "chaos": build_chaos, "glass": build_glass, "studio": build_studio,
 "desk": build_desk, "bench": build_bench, "canvas": build_canvas}[args.scene]()
if args.preview:
    render_settings(24, 480, 300)
else:
    render_settings(512 if args.scene in ("glass", "studio") else 256)

os.makedirs(args.out, exist_ok=True)
tag = f"{args.scene}-{args.state}" if args.scene == "studio" else f"{args.scene}-{args.grid}" if args.scene == "bench" else args.scene
path = os.path.abspath(os.path.join(args.out, f"{tag}{'-preview' if args.preview else ''}.png"))
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
print("WROTE", path)
