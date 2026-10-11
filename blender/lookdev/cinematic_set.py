"""The cinematic look on a chapter's set (cinematic plan step 5, 2026-10-11): the rosier B's sand material (the live
SAND_RAMP stops, gloss, subsurface) and air lit only by the set's own motivated light (the desk lamp), on one frame of a
lookdev.py scene. Runs through its LOOKDEV_LIST hook (lookdev.py untouched); pass --out to a scratch folder, since
scenes like settle write their camera json there.

  SET_LOOK=new SETTLE_FRAME=48 LOOKDEV_LIST=blender/lookdev/cinematic_set.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene settle --out /tmp/x

SET_LIGHTS=hero (Liam, 2026-10-11: the desk with the lamp off, before the ball forms): the set's own lights out, the
hero's key, rim and fill in their true places (desk = chaos centre + 0.1 x hero, power x 0.1^2), the key lighting the air.

SET_WORLD=sand (Liam, 2026-10-11: the desk where the sand belongs, Lusion's lesson that particles live in a world of
their own material): sand spilled on the desk (a low drift where the ball forms, a scatter across it and the papers),
the set graded into the palette (walnut toward plum-brown, the papers muted and warmed), denser dust for the beam.
SET_FOCUS=ball focuses on the ball's place instead of the cloud.

Env: SET_LOOK old (as approved) | new; SET_HAZE density per metre (0.012); SET_KEY the light that lights the air (lamp);
SET_RES "w,h" (960,600); SET_SAMPLES (64); SET_TAG. Writes blender/lookdev/renders/cinematic-set-<scene>-<look><tag>.png
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # (run through lookdev.py's hook: __file__ is lookdev.py, beside us)
from pallet import pallet_wood, spill_points, srgb, swap_pallet  # noqa: E402,F401

scene = bpy.context.scene
look = os.environ.get("SET_LOOK", "new")
w, h = (int(v) for v in os.environ.get("SET_RES", "960,600").split(","))
scene.render.resolution_x, scene.render.resolution_y = w, h
scene.cycles.samples = int(os.environ.get("SET_SAMPLES", "64"))




# the live palette (src/three/sand/sand-field.ts SAND_RAMP): the hue positions are absolute, as live
RAMP = [(0.0, "#26161a"), (0.2277, "#94626c"), (0.4542, "#bf8a78"), (0.5687, "#c4a47e"), (0.6381, "#e3d6c6")]

if os.environ.get("SET_LIGHTS") == "hero":
    from mathutils import Vector
    k, c = 0.1, Vector((0.0, 0.03, 0.46))   # lookdev.py CHAOS_SCALE, CHAOS_C
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        print("CINE light out", o.name)
        bpy.data.objects.remove(o, do_unlink=True)
    # the hero's lights (src/three/sand/sand-field.ts HERO_LIGHTS, Blender axes), at the desk's scale
    for name, pos, size, watts, col, aim_at in (
        ("key", (-7.5, -3.0, 2.8), 3.5, 4200, "#ffdccf", (-0.5, 0.3, 0.2)),
        ("rim", (1.5, 6.5, 2.5), 2.0, 1300, "#cda2b9", (0, 0, 0)),
        ("fill", (3.5, -4.0, -1.0), 4.0, 45, "#8a93a8", (0, 0, 0)),
    ):
        d = bpy.data.lights.new(name, "AREA"); d.energy = watts * k * k; d.size = size * k; d.color = srgb(col)[:3]
        ob = bpy.data.objects.new(name, d); scene.collection.objects.link(ob)
        ob.location = c + Vector(pos) * k
        ob.rotation_euler = (c + Vector(aim_at) * k - ob.location).to_track_quat("-Z", "Y").to_euler()
        print("CINE light", name, tuple(round(v, 3) for v in ob.location), round(d.energy, 2), "W")
        if name == "key" and os.environ.get("SET_KEY_SPREAD"):
            # barn doors: the key pools on the cloud and falls off across the desk (a vignette in the light itself)
            d.spread = math.radians(float(os.environ["SET_KEY_SPREAD"]))
            d.energy *= float(os.environ.get("SET_KEY_GAIN", "1"))   # the narrower beam concentrates its power: the cloud kept as in the hero
    # the lens: focus on the cloud (SET_FSTOP), the desk below goes soft
    if os.environ.get("SET_FSTOP"):
        bpy.context.view_layer.update()
        cam = scene.camera
        cam.data.dof.use_dof = True
        at = Vector((0.0, 0.03, 0.098)) if os.environ.get("SET_FOCUS") == "ball" else c
        cam.data.dof.focus_distance = (cam.matrix_world.translation - at).length
        cam.data.dof.aperture_fstop = float(os.environ["SET_FSTOP"])
        print("CINE focus", round(cam.data.dof.focus_distance, 3), "m at f/", cam.data.dof.aperture_fstop)

# SET_DESK=pallet (Liam, 2026-10-11, from a vintage pallet table: the wood only, in the sand's tones, a notch calmer
# than the reference, procedural): three long pine planks with gaps, a stain rubbed back to pale wood along the grain,
# knots, fine scratches, a few nail holes. The desk's old material (scanned oak as walnut) stays in lookdev.py


if os.environ.get("SET_DESK") == "pallet":
    swap_pallet()


# SET_LAMP "watts,cone deg,blend,aim height" (Liam, 2026-10-11: the lamp brighter and tighter on the cloud, so the cloud
# keeps the hero's pop while the desk stays in the same light): aimed at the cloud, its beam carries on to the desk
if os.environ.get("SET_LAMP") and "lamp" in bpy.data.objects:
    from mathutils import Vector
    watts, cone, blend, aim_z = (float(v) for v in os.environ["SET_LAMP"].split(","))
    lamp = bpy.data.objects["lamp"]
    lamp.data.energy = watts; lamp.data.spot_size = math.radians(cone); lamp.data.spot_blend = blend
    lamp.rotation_euler = (Vector((0.0, 0.03, aim_z)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    print("CINE lamp", watts, "W", cone, "deg, blend", blend, "aimed at height", aim_z)

if look == "new":
    for m in bpy.data.materials:
        if not m.use_nodes or not m.name.startswith("sand"):
            continue
        nt = m.node_tree
        ramp = next((n for n in nt.nodes if n.type == "VALTORGB"), None)
        bsdf = nt.nodes.get("Principled BSDF")
        if ramp is None or bsdf is None:
            continue
        els = ramp.color_ramp.elements
        while len(els) > 2:
            els.remove(els[-1])
        els[0].position, els[0].color = RAMP[0][0], srgb(RAMP[0][1])
        els[1].position, els[1].color = RAMP[1][0], srgb(RAMP[1][1])
        for pos, col in RAMP[2:]:
            e = els.new(pos); e.color = srgb(col)
        bsdf.inputs["Roughness"].default_value = 0.22
        bsdf.inputs["Specular IOR Level"].default_value = 0.5
        bsdf.inputs["Subsurface Weight"].default_value = 0.6
        bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.45)
        bsdf.inputs["Subsurface Scale"].default_value = 0.004 * float(os.environ.get("SET_GRAIN_SCALE", "0.07"))   # the desk's grains are ~1/14 the hero's
        m["cine"] = 1
        print("CINE material", m.name)
    if os.environ.get("SET_WORLD") == "sand":
        import numpy as np
        from mathutils import Vector as V3
        rng = np.random.default_rng(23)
        src = bpy.data.objects.get("chaos") or bpy.data.objects.get("ball")
        if src is not None and "hue" in src.data.attributes:
            hh = np.empty(len(src.data.vertices), dtype=np.float32); src.data.attributes["hue"].data.foreach_get("value", hh)
        else:
            hh = rng.uniform(0, 0.9, 10000).astype(np.float32)
        pts, hue_spill, rad_spill = spill_points(np, rng, hh, os.environ.get("SET_DESK") == "pallet")
        grains("spill", pts, hue_spill, rad_spill)
        print("CINE spilled sand", len(pts))
        # its material made after the sand's was set: the cinematic palette and gloss too (it had the look-dev one: the
        # red puddle), without the subsurface (through a dense pile it glows red)
        for m in bpy.data.materials:
            if m.use_nodes and m.name.startswith("sand") and m.get("cine") is None:
                nt = m.node_tree
                ramp = next((n for n in nt.nodes if n.type == "VALTORGB"), None)
                b = nt.nodes.get("Principled BSDF")
                if ramp is None or b is None:
                    continue
                els = ramp.color_ramp.elements
                while len(els) > 2:
                    els.remove(els[-1])
                els[0].position, els[0].color = RAMP[0][0], srgb(RAMP[0][1])
                els[1].position, els[1].color = RAMP[1][0], srgb(RAMP[1][1])
                for pos, col in RAMP[2:]:
                    e = els.new(pos); e.color = srgb(col)
                b.inputs["Roughness"].default_value = 0.22
                b.inputs["Specular IOR Level"].default_value = 0.5
                b.inputs["Subsurface Weight"].default_value = 0.0
                m["cine"] = 1
                print("CINE spill material", m.name)
        # the set graded into the palette
        def tint(name, rgb):
            m = bpy.data.materials.get(name)
            if not m or not m.use_nodes:
                return
            nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
            if b is None:
                return
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = (*rgb, 1.0)    # B
            inp = b.inputs["Base Color"]
            if inp.is_linked:
                nt.links.new(inp.links[0].from_socket, mix.inputs[6])   # A
            else:
                mix.inputs[6].default_value = inp.default_value
            nt.links.new(mix.outputs[2], inp)
            print("CINE tint", name)
        if os.environ.get("SET_DESK") != "pallet":
            tint("walnut", (0.78, 0.66, 0.68))
        for n in ("blank_m", "card_a_m", "card_b_m"):
            tint(n, (0.78, 0.72, 0.71))
        for n in ("sticky_hero_m", "sticky_b_m", "sticky_c_m"):
            tint(n, (0.8, 0.72, 0.72))

# the air, lit only by the set's motivated light
    density = float(os.environ.get("SET_HAZE", "0.012"))
    if density > 0:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.6))
        hz = bpy.context.active_object
        hz.name = "haze"; hz.scale = (5, 5, 2.4)
        hm = bpy.data.materials.new("haze"); hm.use_nodes = True
        hnt = hm.node_tree
        hnt.nodes.remove(hnt.nodes["Principled BSDF"])
        vol = hnt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Color"].default_value = srgb("#e8d0cc")
        vol.inputs["Density"].default_value = density
        vol.inputs["Anisotropy"].default_value = 0.45
        hnt.links.new(vol.outputs[0], hnt.nodes["Material Output"].inputs["Volume"])
        hz.data.materials.append(hm)
        hz.visible_shadow = False
        key = os.environ.get("SET_KEY", "lamp")
        for o in bpy.data.objects:
            if o.type == "LIGHT":
                o.visible_volume_scatter = o.name.split(".")[0] == key
                print("CINE light", o.name, "lights the air" if o.visible_volume_scatter else "")
        scene.cycles.volume_bounces = 1

out = os.path.abspath(os.path.join("blender/lookdev/renders", f"cinematic-set-{os.environ.get('SET_NAME', 'set')}-{look}{os.environ.get('SET_TAG', '')}.png"))
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("WROTE", out)
sys.exit(0)
