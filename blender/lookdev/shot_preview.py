"""The shot over the pallet desk in Cycles, for Liam's approval before it is wired live (spec §9.1). Every 2nd frame,
960x600, 32 samples; a stand-in ball (matte, the sand's mid tone) where the ball stays; the lid and the screen follow
the path. Runs through lookdev.py's hook on the desk scene:

  LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/shot_preview.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene desk --out /tmp/x
Writes blender/lookdev/renders/shot-preview/f_NNNN.png; then ffmpeg makes the clip (Step 2)."""
import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pallet import srgb, swap_pallet  # noqa: E402

scene = bpy.context.scene
swap_pallet()
d = json.load(open(os.path.join(HERE, "..", "..", "public", "lab", "shot", "camera.json")))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(0.0, 0.03, 0.47), segments=48, ring_count=24)   # the hero ball (sand.json)
ball = bpy.context.active_object; ball.name = "ball_standin"; bpy.ops.object.shade_smooth()
m = bpy.data.materials.new("ball_standin"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("#bf8a78")
m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
ball.data.materials.append(m)
cam = scene.camera
cam.rotation_mode = "QUATERNION"
cam.data.dof.use_dof = True
cam.data.dof.aperture_fstop = 2.0
hinge = bpy.data.objects.get("hinge")
display = bpy.data.materials.get("display")
out = os.path.join(HERE, "renders", "shot-preview")
os.makedirs(out, exist_ok=True)
scene.render.resolution_x, scene.render.resolution_y = 960, 600
scene.cycles.samples = 32
for i in range(0, d["frames"], 2):
    fr = d["path"][i]
    cam.location = fr["position"]
    cam.rotation_quaternion = fr["quaternion"]
    cam.data.lens = fr["lens_mm"]
    cam.data.dof.focus_distance = fr["focus_m"]
    if hinge:
        hinge.rotation_euler.x = math.radians(90.0 - fr["lid_open_deg"])
    if display:
        display.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1.1 if i + 1 >= d["wake_frame"] else 0.0
    scene.render.filepath = os.path.join(out, f"f_{i // 2 + 1:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("SHOT frame", i + 1, flush=True)
sys.exit(0)
