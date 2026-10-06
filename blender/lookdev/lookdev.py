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
ap.add_argument("--scene", choices=["ball", "chaos", "glass", "studio"], required=True)
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
        drain.inputs["B"].default_value = (0.98, 0.84, 0.76, 1)
        nt.links.new(clear.outputs["Fac"], drain.inputs["Factor"])
        nt.links.new(ramp.outputs["Color"], drain.inputs["A"])
        nt.links.new(drain.outputs["Result"], bsdf.inputs["Base Color"])
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
        tint.inputs["A"].default_value = (0.86, 0.74, 0.74, 1)
        tint.inputs["B"].default_value = (1, 1, 1, 1)
        nt.links.new(attr.outputs["Fac"], tint.inputs["Factor"])
        nt.links.new(tint.outputs["Result"], bsdf.inputs["Base Color"])
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

# ---------------------------------------------------------------- go

{"ball": build_ball, "chaos": build_chaos, "glass": build_glass, "studio": build_studio}[args.scene]()
if args.preview:
    render_settings(24, 480, 300)
else:
    render_settings(512 if args.scene in ("glass", "studio") else 256)

os.makedirs(args.out, exist_ok=True)
tag = f"{args.scene}-{args.state}" if args.scene == "studio" else args.scene
path = os.path.abspath(os.path.join(args.out, f"{tag}{'-preview' if args.preview else ''}.png"))
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
print("WROTE", path)
