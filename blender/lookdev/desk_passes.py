"""The desk build-up, baked (Liam, 2026-10-16; About pictures spec, section 5): the five frames of the film that builds the
desk on the About page, from the same Blender desk the site's hero uses. Not run on its own: lookdev.py exec's it through the
LOOKDEV_LIST hook once the desk is built, so `camera`, `scene` and `render_settings` below are lookdev.py's own.

One still camera, laptop shut, no sand (LOOKDEV_NO_SAND=1): (0.12, -0.64, 0.60) looking at (0.08, 0.06, 0.00), 36 mm.
Five frames, each at 1920x1200 into PASS_OUT: wire, clay, mat (materials under flat light), light (lit, neutral AgX, no lens)
and final (what the site shows: AgX Punchy and the camera's depth of field). Then desk_passes_compose.py cuts the loop:
0.8 s eased wipes, 0.9 s holds, 2 s on the final, back to the wireframe; 9.6 s at 1440x900, H.264 CRF 20; the poster is the
final frame. Output: public/about/desk-build.mp4 and public/about/desk-build.jpg.

From the repo root (the bake took about 4.5 min on Blender 5.1.1; PASS_ONLY="wire,clay" re-renders just those frames):

  LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/desk_passes.py PASS_OUT=blender/lookdev/renders/desk-passes \\
    /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/lookdev.py -- --scene desk --view tq
  python3 blender/lookdev/desk_passes_compose.py

PASS_CAM ("x,y,z,tx,ty,tz,lens") overrides the camera; the default is the approved one.
"""
import os
import bpy

out = os.path.abspath(os.environ.get("PASS_OUT", "blender/lookdev/renders/desk-passes"))
os.makedirs(out, exist_ok=True)
W, H = 1920, 1200
only = os.environ.get("PASS_ONLY", "wire,clay,mat,light,final").split(",")

cx, cy, cz, tx, ty, tz, lens = (float(v) for v in os.environ.get("PASS_CAM", "0.12,-0.64,0.60,0.08,0.06,0.00,36").split(","))
camera((cx, cy, cz), (tx, ty, tz), lens=lens, focus=((cx - tx) ** 2 + (cy - ty) ** 2 + (cz - tz) ** 2) ** 0.5, fstop=5.6)
cam = scene.camera.data
lights = [o for o in bpy.data.objects if o.type == "LIGHT"]
world0 = scene.world

def cycles(samples, lens_blur=False, look=True):
    render_settings(samples, W, H)   # (AgX, look Punchy: the site's exact view transform, make_lut.py)
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.01
    cam.dof.use_dof = lens_blur
    if not look:
        scene.view_settings.look = "None"

def shot(name):
    scene.render.filepath = os.path.join(out, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("PASS", name, flush=True)

def flat_material(name, nodes_fn):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes_fn(m.node_tree)
    return m

if "final" in only:
    cycles(768, lens_blur=True)
    shot("final")

if "light" in only:
    cycles(512, look=False)
    shot("light")

if "clay" in only:
    cycles(384, look=False)
    def clay_nodes(nt):
        b = nt.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.085, 0.08, 0.076, 1)   # (near the walnut's value: the lamp exposes it alike)
        b.inputs["Roughness"].default_value = 0.6
    bpy.context.view_layer.material_override = flat_material("clay", clay_nodes)
    shot("clay")
    bpy.context.view_layer.material_override = None

if "mat" in only:
    cycles(384, look=False)
    for o in lights:
        o.hide_render = True
    w = bpy.data.worlds.new("flat")
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.9
    # the flat light lights the desk but is never seen: the camera sees the same black void
    lp = nt.nodes.new("ShaderNodeLightPath")
    blk = nt.nodes.new("ShaderNodeBackground"); blk.inputs["Color"].default_value = (0, 0, 0, 1)
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nt.links.new(bg.outputs[0], mx.inputs[1]); nt.links.new(blk.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes["World Output"].inputs["Surface"])
    scene.world = w
    shot("mat")
    scene.world = world0
    for o in lights:
        o.hide_render = False

if "wire" in only:
    cycles(128, look=False)
    scene.cycles.use_denoising = False   # (denoising smears thin lines)
    def wire_nodes(nt):
        nt.nodes.clear()
        wf = nt.nodes.new("ShaderNodeWireframe"); wf.use_pixel_size = True; wf.inputs["Size"].default_value = 1.5
        dark = nt.nodes.new("ShaderNodeEmission"); dark.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1)
        line = nt.nodes.new("ShaderNodeEmission"); line.inputs["Color"].default_value = (0.86, 0.83, 0.79, 1); line.inputs["Strength"].default_value = 0.85
        mix = nt.nodes.new("ShaderNodeMixShader")
        o_ = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(wf.outputs["Fac"], mix.inputs[0]); nt.links.new(dark.outputs[0], mix.inputs[1]); nt.links.new(line.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], o_.inputs["Surface"])
    bpy.context.view_layer.material_override = flat_material("wire", wire_nodes)
    for o in bpy.data.objects:   # the notes' 49x49 grids read as solid grey: un-subdivide them for this pass only
        if o.type == "MESH" and o.name.split(".")[0].startswith(("sticky", "card")):
            d = o.modifiers.new("thin", "DECIMATE"); d.decimate_type = "UNSUBDIV"; d.iterations = 3
            o.modifiers.move(len(o.modifiers) - 1, 0)
    shot("wire")
