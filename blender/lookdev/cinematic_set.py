"""The cinematic look on a chapter's set (cinematic plan step 5, 2026-10-11): the rosier B's sand material (the live
SAND_RAMP stops, gloss, subsurface) and air lit only by the set's own motivated light (the desk lamp), on one frame of a
lookdev.py scene. Runs through its LOOKDEV_LIST hook (lookdev.py untouched); pass --out to a scratch folder, since
scenes like settle write their camera json there.

  SET_LOOK=new SETTLE_FRAME=48 LOOKDEV_LIST=blender/lookdev/cinematic_set.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene settle --out /tmp/x

Env: SET_LOOK old (as approved) | new; SET_HAZE density per metre (0.012); SET_KEY the light that lights the air (lamp);
SET_RES "w,h" (960,600); SET_SAMPLES (64); SET_TAG. Writes blender/lookdev/renders/cinematic-set-<scene>-<look><tag>.png
"""
import os
import sys

import bpy

scene = bpy.context.scene
look = os.environ.get("SET_LOOK", "new")
w, h = (int(v) for v in os.environ.get("SET_RES", "960,600").split(","))
scene.render.resolution_x, scene.render.resolution_y = w, h
scene.cycles.samples = int(os.environ.get("SET_SAMPLES", "64"))


def srgb(hex_):
    hex_ = hex_.lstrip("#")
    c = [int(hex_[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


# the live palette (src/three/sand/sand-field.ts SAND_RAMP): the hue positions are absolute, as live
RAMP = [(0.0, "#26161a"), (0.2277, "#94626c"), (0.4542, "#bf8a78"), (0.5687, "#c4a47e"), (0.6381, "#e3d6c6")]

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
        print("CINE material", m.name)
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
