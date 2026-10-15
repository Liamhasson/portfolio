"""The playground drive on the desk (Liam, 2026-10-14/15, approved from renders): a slim aluminium portable drive after
Liam's reference (no maker's mark), titanium grey a step lighter, its last few millimetres a lighter cap; a light dot on
top by the port end; a masking-tape label with "Playground" in Liam's own hand (photo IMG_2973, extract_ink.py, thickened);
its USB-C cable in a loose loop to the laptop's left port. Placed in the laptop's frame (lookdev.py build_desk: laptop
at (0.27, 0.04), turned -24 degrees).

Bakes like the rest of the desk: the tape is named card_tape so it bakes as paper (combined light); its torn ends are
real geometry (alpha doesn't survive a bake); the cable is a mesh. The site finds the parts by name (drive_*, card_tape).

  from drive import build_drive; build_drive(ink_png)
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector

W, D, H, CAP = 0.057, 0.085, 0.008, 0.0045   # the drive (m)
TL, TW = 0.050, 0.0195                       # the tape (m)
LAPTOP = (Vector((0.27, 0.04, 0.0)), math.radians(-24))


def _srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def _mat(name, hexcol, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*_srgb(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m, b


def _in_laptop_frame(lx, ly, z=0.0):
    (loc, rot) = LAPTOP
    c, s = math.cos(rot), math.sin(rot)
    return Vector((loc.x + lx * c - ly * s, loc.y + lx * s + ly * c, z))


def _tape(root, ink_png):
    """Masking tape: straight long edges, torn short ends (real geometry), crepe and ink in its material."""
    rng = random.Random(15)
    pts = []
    n_end = 22
    # the torn ends wander in and out a millimetre or so, the long edges stay straight
    for i in range(n_end + 1):   # left end, bottom to top
        t = i / n_end
        pts.append((-TL / 2 + rng.uniform(0.0, 0.0022) + 0.0012 * math.sin(t * 9.0), -TW / 2 + t * TW))
    for i in range(n_end + 1):   # right end, top to bottom
        t = i / n_end
        pts.append((TL / 2 - rng.uniform(0.0, 0.0022) - 0.0010 * math.sin(t * 7.0 + 1.0), TW / 2 - t * TW))
    me = bpy.data.meshes.new("card_tape")
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0.0)) for x, y in reversed(pts)]   # (counter-clockwise from above: the face looks up)
    face = bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=[face])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x / TL + 0.5, lp.vert.co.y / TW + 0.5)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("card_tape", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = root
    ob.location = (0.002, 0.004, H + 0.00035)
    ob.rotation_euler = (0, 0, math.radians(90 - 5))

    m, b = _mat("card_tape", "#c8ae7f", 0.5)
    b.inputs["Specular IOR Level"].default_value = 0.35
    nt = m.node_tree
    N, L = nt.nodes.new, nt.links.new
    uvn = N("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    wave = N("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 95.0
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 3.0
    L(uvn.outputs["UV"], wave.inputs["Vector"])
    grain = N("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 420.0
    L(uvn.outputs["UV"], grain.inputs["Vector"])
    hgt = N("ShaderNodeMath")
    hgt.operation = "MULTIPLY_ADD"
    hgt.inputs[1].default_value = 0.6
    L(wave.outputs["Fac"], hgt.inputs[0])
    L(grain.outputs["Fac"], hgt.inputs[2])
    bump = N("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.75
    bump.inputs["Distance"].default_value = 0.0008
    L(hgt.outputs[0], bump.inputs["Height"])
    L(bump.outputs["Normal"], b.inputs["Normal"])
    mott = N("ShaderNodeTexNoise")
    mott.inputs["Scale"].default_value = 18.0
    L(uvn.outputs["UV"], mott.inputs["Vector"])
    rid = N("ShaderNodeMath")
    rid.operation = "MULTIPLY_ADD"
    rid.inputs[1].default_value = 0.35
    L(wave.outputs["Fac"], rid.inputs[0])
    L(mott.outputs["Fac"], rid.inputs[2])
    ramp = N("ShaderNodeValToRGB")
    # (a little of the grey under it in the paper's colour: masking tape is a touch see-through)
    ramp.color_ramp.elements[0].color = (*_srgb("#ad946a"), 1)
    ramp.color_ramp.elements[1].color = (*_srgb("#cbb488"), 1)
    L(rid.outputs[0], ramp.inputs["Fac"])
    img = N("ShaderNodeTexImage")
    img.image = bpy.data.images.load(ink_png)
    img.extension = "CLIP"
    mp = N("ShaderNodeMapping")
    kx = 1.3
    ky = kx * (TL / TW) / (605 / 312)
    mp.inputs["Scale"].default_value = (kx, ky, 1)
    mp.inputs["Location"].default_value = (0.5 - 0.5 * kx, 0.5 - 0.5 * ky, 0)
    L(uvn.outputs["UV"], mp.inputs["Vector"])
    L(mp.outputs["Vector"], img.inputs["Vector"])
    mix = N("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[7].default_value = (*_srgb("#1e1915"), 1)
    L(ramp.outputs["Color"], mix.inputs[6])
    L(img.outputs["Alpha"], mix.inputs[0])
    L(mix.outputs[2], b.inputs["Base Color"])
    me.materials.append(m)
    return ob


def build_drive(ink_png):
    root = bpy.data.objects.new("drive", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = _in_laptop_frame(-0.245, -0.075)
    root.rotation_euler = (0, 0, LAPTOP[1] + math.radians(-40))   # its port end toward the laptop, not quite aimed

    body_m = _mat("drive_body", "#6b6d72", 0.36, metal=1.0)[0]
    cap_m = _mat("drive_cap", "#a9aaad", 0.3, metal=1.0)[0]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, H / 2))
    body = bpy.context.active_object
    body.name = "drive_body"
    body.scale = (W, D, H)
    bpy.ops.object.transform_apply(scale=True)
    bv = body.modifiers.new("b", "BEVEL")
    bv.width = 0.0036
    bv.segments = 10
    bv.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    body.data.materials.append(body_m)
    body.data.materials.append(cap_m)   # the lighter caps: the same body, its last few millimetres
    for f in body.data.polygons:
        if abs(f.center.y) > D / 2 - CAP:
            f.material_index = 1
    body.parent = root

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, D / 2 + 0.0001, H / 2))
    port = bpy.context.active_object
    port.name = "drive_port"
    port.scale = (0.0088, 0.0006, 0.0028)
    bpy.ops.object.transform_apply(scale=True)
    port.data.materials.append(_mat("drive_port", "#111113", 0.5)[0])
    port.parent = root

    # the light: a dot on top by the port end (the site wakes it on hover)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0009, depth=0.0003, location=(-0.019, D / 2 - CAP - 0.004, H + 0.0001))
    led = bpy.context.active_object
    led.name = "drive_led"
    led.data.materials.append(_mat("drive_led", "#e7d8c8", 0.3)[0])
    led.parent = root

    _tape(root, ink_png)

    # the plug, then the cable as a mesh: out of the port end, a loose loop on the desk, into the laptop's left port
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, D / 2 + 0.006, 0.004))
    plug = bpy.context.active_object
    plug.name = "drive_plug"
    plug.scale = (0.011, 0.012, 0.0055)
    bpy.ops.object.transform_apply(scale=True)
    bv = plug.modifiers.new("b", "BEVEL")
    bv.width = 0.0022
    bv.segments = 6
    bpy.ops.object.modifier_apply(modifier="b")
    cab_m = _mat("drive_cable", "#1b1b1d", 0.5)[0]
    plug.data.materials.append(cab_m)
    plug.parent = root
    bpy.context.view_layer.update()
    start = root.matrix_world @ Vector((0.0, D / 2 + 0.012, 0.004))
    end = _in_laptop_frame(-0.1563 - 0.006, -0.025, 0.0045)
    d1 = start + (root.matrix_world.to_3x3() @ Vector((0, 0.03, 0)))
    d1.z = 0.0018
    m2 = (start + end) / 2 + Vector((0.01, -0.03, 0))
    m2.z = 0.0018
    cu = bpy.data.curves.new("drive_cable", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.0018
    cu.bevel_resolution = 4
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(3)
    for p_, co in zip(sp.bezier_points, (start, d1, m2, end)):
        p_.co = co
        p_.handle_left_type = p_.handle_right_type = "AUTO"
    cab = bpy.data.objects.new("drive_cable", cu)
    bpy.context.scene.collection.objects.link(cab)
    cab.data.materials.append(cab_m)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = cab
    cab.select_set(True)
    bpy.ops.object.convert(target="MESH")
    cab.name = "drive_cable"
    print("DRIVE built", tuple(round(v, 3) for v in root.location), flush=True)
    return root
