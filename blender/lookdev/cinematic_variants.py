"""The hero in three looks, toward a cinematic light (Liam, 2026-10-11; reference: Ducky 3D's particle flow render).

Runs inside lookdev.py's hero scene through its LOOKDEV_LIST hook (lookdev.py builds the chaos, the wordmark, the
lights and the camera, untouched; this changes them per variant and renders):

  VARIANT=B LOOKDEV_LIST=blender/lookdev/cinematic_variants.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene hero --phase chaos

  A  today's hero, as approved in look-dev (the reference)
  B  the recommendation: one raking key (fills ~1/8 of it), highlights near white, the natural palette (bone on about
     a quarter of the grains, rose and gold the rest, plum the shadows), glossy grains with a soft subsurface glow, a
     faint haze lit by the key, shallow focus on the lit front
  C  further: B with denser haze, shallower focus, harder contrast

Env: VARIANT (A/B/C), CINE_RES "w,h" (1600,1000), CINE_SAMPLES (128), CINE_EXPOSURE (overrides the variant's).
Writes blender/lookdev/renders/cinematic-<V>.png (raw). The grade (warm lifted black ~#0b0908, slight vignette, fine
grain: the site's final pass, previewed) is applied after, to B and C:

  ffmpeg -i cinematic-B.png -vf "vignette=PI/6,colorlevels=romin=0.043:gomin=0.035:bomin=0.031,noise=alls=3" cinematic-B-graded.png
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector

V = os.environ.get("VARIANT", "B").upper()
scene = bpy.context.scene
w, h = (int(v) for v in os.environ.get("CINE_RES", "1600,1000").split(","))
scene.render.resolution_x, scene.render.resolution_y = w, h
scene.cycles.samples = int(os.environ.get("CINE_SAMPLES", "128"))


def srgb(hex_):
    hex_ = hex_.lstrip("#")
    c = [int(hex_[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


if V != "A":
    C = V == "C"
    # ROSE=1 (Liam, 2026-10-11: "B with more rose"): rose carries the cloud, bone only its brightest few, a rosier key
    ROSE = bool(os.environ.get("ROSE"))
    # ---- the palette: same hues, more natural (bone on ~25% of the grains: at 45% the cloud read beige, not rose)
    chaos = bpy.data.objects["chaos"]
    hue = np.empty(len(chaos.data.vertices), dtype=np.float32)
    chaos.data.attributes["hue"].data.foreach_get("value", hue)
    q = lambda p: float(np.quantile(hue, p))
    stops = [(q(0.0), "#26161a"), (q(0.15), "#94626c"), (q(0.42), "#bf8a78"), (q(0.62), "#c4a47e"), (q(0.76), "#e3d6c6"), (1.0, "#e3d6c6")]
    if ROSE:
        stops = [(q(0.0), "#26161a"), (q(0.1), "#94626c"), (q(0.5), "#bf8a78"), (q(0.76), "#c4a47e"), (q(0.88), "#e3d6c6"), (1.0, "#e3d6c6")]
    m = bpy.data.materials["sand"]
    nt = m.node_tree
    ramp = next(n for n in nt.nodes if n.type == "VALTORGB")
    els = ramp.color_ramp.elements
    while len(els) > 2:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0][0], srgb(stops[0][1])
    els[1].position, els[1].color = stops[1][0], srgb(stops[1][1])
    for pos, col in stops[2:]:
        e = els.new(min(pos, 1.0)); e.color = srgb(col)
    # ---- the grain: glossy (Ducky: roughness down) with a soft subsurface glow (his: subsurface weight 1)
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    bsdf.inputs["Subsurface Weight"].default_value = 0.6
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.45) if ROSE else (1.0, 0.55, 0.4)
    bsdf.inputs["Subsurface Scale"].default_value = 0.004   # a grain is ~0.004-0.009 across
    # ---- the light: one raking key from the side, the fills about an eighth of it, the rose rim kept
    key = bpy.data.objects["key"]
    key.location = (-8.0, -1.5, 2.2) if C else (-7.5, -3.0, 2.8)
    aim(key, (-0.5, 0.3, 0.2))
    key.data.size = 3.5
    key.data.energy = 5200 if C else 4200
    key.data.color = srgb("#ffdccf" if ROSE else "#ffe8d4")[:3]
    fill = bpy.data.objects["fill"]
    fill.data.energy = 30 if C else 45
    fill.data.color = srgb("#8a93a8")[:3]
    rim = bpy.data.objects["rim"]
    rim.data.energy = 1100 if C else 1300
    # ---- the air: a faint haze lit by the key (forward scattering), over a warm near-black
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
    haze = bpy.context.active_object
    haze.name = "haze"
    haze.scale = (34, 34, 22)
    hm = bpy.data.materials.new("haze"); hm.use_nodes = True
    hnt = hm.node_tree
    hnt.nodes.remove(hnt.nodes["Principled BSDF"])
    vol = hnt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = srgb("#e8d0cc" if ROSE else "#e9d9cc")
    vol.inputs["Density"].default_value = 0.002 if C else 0.0013
    vol.inputs["Anisotropy"].default_value = 0.45
    hnt.links.new(vol.outputs[0], hnt.nodes["Material Output"].inputs["Volume"])
    haze.data.materials.append(hm)
    haze.visible_shadow = False   # the air lights; it doesn't darken the sand
    # the background stays black and lights nothing: the warm near-black is the grade's lift (grade_still), applied to
    # everything at once, so a grain in shadow is exactly as dark as the background behind it (Liam's rule)
    wn = scene.world.node_tree.nodes["Background"]
    wn.inputs["Color"].default_value = (0, 0, 0, 1)
    scene.cycles.volume_bounces = 1
    # only the key lights the air (one motivated source; the rim lit a glowing blob in it)
    for name in ("rim", "fill"):
        bpy.data.objects[name].visible_volume_scatter = False
    # ---- the lens: shallow focus on the lit front of the cloud
    cam = scene.camera
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 8.4
    cam.data.dof.aperture_fstop = 1.8 if C else 3.2
    # ---- the exposure: the lit side near white
    scene.view_settings.exposure = float(os.environ.get("CINE_EXPOSURE", "0.2" if C else "0.25"))
    if C:
        for look in ("AgX - High Contrast", "High Contrast"):
            try:
                scene.view_settings.look = look
                break
            except TypeError:
                continue

out = os.path.abspath(os.path.join("blender/lookdev/renders", f"cinematic-{V}{os.environ.get('CINE_TAG', '')}.png"))
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("WROTE", out)
