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
def pallet_wood():
    m = bpy.data.materials.new("pallet_wood"); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["Object"], sep.inputs[0])
    def op(kind, a, bv=None, c=None):
        n = N.new("ShaderNodeMath"); n.operation = kind
        for k, v in enumerate((a, bv, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[k].default_value = v
            else:
                L.new(v, n.inputs[k])
        return n.outputs[0]
    def mr(v, fmin, fmax, tmin=0.0, tmax=1.0, smooth=True):
        n = N.new("ShaderNodeMapRange"); n.interpolation_type = "SMOOTHSTEP" if smooth else "LINEAR"
        n.inputs["From Min"].default_value, n.inputs["From Max"].default_value = fmin, fmax
        n.inputs["To Min"].default_value, n.inputs["To Max"].default_value = tmin, tmax
        L.new(v, n.inputs["Value"]); return n.outputs["Result"]
    # the planks: three across the desk's depth (0.6 m), running its length; u in plank widths
    u = op("MULTIPLY", op("ADD", sep.outputs["Y"], 0.3), 1 / 0.2)
    plank = op("FLOOR", u)
    fv = op("FRACT", u)
    edge = op("MULTIPLY", op("MINIMUM", fv, op("SUBTRACT", 1.0, fv)), 0.2)            # metres to the plank's edge
    gap = mr(edge, 0.0045, 0.003)                                                       # ~8 mm gaps
    wn = N.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "1D"; L.new(plank, wn.inputs["W"])
    rnd = wn.outputs["Value"]                                                           # each plank its own
    # where on the plank: its own coordinates, offset per plank (no two planks with the same grain)
    cmb = N.new("ShaderNodeCombineXYZ")
    L.new(op("ADD", sep.outputs["X"], op("MULTIPLY", rnd, 3.7)), cmb.inputs[0]); L.new(sep.outputs["Y"], cmb.inputs[1]); L.new(op("MULTIPLY", rnd, 9.1), cmb.inputs[2])
    P = cmb.outputs[0]
    def mapped(scale, rot_z=0.0):
        mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale; mp.inputs["Rotation"].default_value = (0, 0, rot_z)
        L.new(P, mp.inputs["Vector"]); return mp.outputs["Vector"]
    # pine grain: long lines along the plank, gently wavy
    wave = N.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 34.0; wave.inputs["Distortion"].default_value = 5.0
    wave.inputs["Detail"].default_value = 4.0; wave.inputs["Detail Scale"].default_value = 1.2
    L.new(mapped((0.35, 1.0, 1.0)), wave.inputs["Vector"])
    grain = op("MULTIPLY", mr(wave.outputs["Fac"], 0.62, 0.9), 0.35)   # (faint: even bands read as corduroy)
    fine = N.new("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 1.0; fine.inputs["Detail"].default_value = 8.0
    L.new(mapped((1.6, 110.0, 1.0)), fine.inputs["Vector"])
    grain = op("MAXIMUM", grain, mr(fine.outputs["Fac"], 0.52, 0.7))   # irregular grain lines
    # knots (Liam: stronger): dark oval cores, a ring of darker wood round them
    vor = N.new("ShaderNodeTexVoronoi"); vor.voronoi_dimensions = "2D"; vor.inputs["Scale"].default_value = 4.2;   # (2D: in 3D most cells' points sat off the face, and few knots showed)
    L.new(mapped((0.55, 1.6, 1.0)), vor.inputs["Vector"])
    # (each knot its own size, from tiny pins to broad ones, and about a third of the places with none: even spots read
    # as a pattern)
    kc = N.new("ShaderNodeSeparateColor"); L.new(vor.outputs["Color"], kc.inputs[0])
    ksize = mr(kc.outputs[0], 0.0, 1.0, 0.35, 1.2, smooth=False)
    kd = op("ADD", op("DIVIDE", vor.outputs["Distance"], ksize), op("MULTIPLY", op("GREATER_THAN", kc.outputs[1], 0.68), 10.0))
    knot = op("MAXIMUM", mr(kd, 0.2, 0.1), op("MULTIPLY", mr(kd, 0.32, 0.19), 0.55))   # (Liam: bolder)
    # the ring figure (Liam): each plank cut from a tree whose centre runs a few cm below its face, a little off its
    # middle, wandering along its length; its growth rings cut by the face are the arches and long ovals of flat-sawn
    # pine. They bend round the knots, and noise keeps them from being machine-even
    centre = op("ADD", op("MULTIPLY", op("ADD", plank, 0.5), 0.2), -0.3)            # the plank's middle (y)
    wob = op("MULTIPLY", op("SINE", op("ADD", op("MULTIPLY", sep.outputs["X"], op("ADD", 2.0, op("MULTIPLY", rnd, 2.5))), op("MULTIPLY", rnd, 6.28))), 0.035)
    pith = op("ADD", op("ADD", centre, op("MULTIPLY", op("SUBTRACT", rnd, 0.5), 0.12)), wob)
    dy = op("SUBTRACT", sep.outputs["Y"], pith)
    # (the log tapers, and the board is cut at a slight angle: the centre's depth changes along the plank, so each ring
    # closes into the tip of an arch where it leaves the face)
    wn2 = N.new("ShaderNodeTexWhiteNoise"); wn2.noise_dimensions = "1D"; L.new(op("ADD", plank, 17.3), wn2.inputs["W"])
    slope = op("MULTIPLY", op("ADD", 0.5, wn2.outputs["Value"]), op("SUBTRACT", op("MULTIPLY", op("FLOOR", op("MULTIPLY", wn2.outputs["Value"], 2.0)), 2.0), 1.0))
    slope = op("MULTIPLY", slope, 0.11)   # (always some taper, either way: 0.05-0.16)
    depth = op("ABSOLUTE", op("ADD", op("ADD", 0.012, op("MULTIPLY", rnd, 0.03)), op("MULTIPLY", op("ADD", sep.outputs["X"], op("MULTIPLY", rnd, 0.6)), slope)))
    r = op("SQRT", op("ADD", op("MULTIPLY", dy, dy), op("MULTIPLY", depth, depth)))
    rn = N.new("ShaderNodeTexNoise"); rn.inputs["Scale"].default_value = 1.0; rn.inputs["Detail"].default_value = 3.0
    L.new(mapped((3.0, 12.0, 1.0)), rn.inputs["Vector"])
    r = op("ADD", r, op("MULTIPLY", op("SUBTRACT", rn.outputs["Fac"], 0.5), 0.008))
    r = op("ADD", r, op("MULTIPLY", mr(kd, 0.36, 0.0), 0.016))                     # (bent round the knots)
    # ~5 mm between rings, closer toward the bark (a log-like spacing), each ring's dark band its own strength
    ring = op("FRACT", op("MULTIPLY", op("POWER", r, 0.85), 1 / 0.0095))
    rs = N.new("ShaderNodeTexNoise"); rs.inputs["Scale"].default_value = 1.0; rs.inputs["Detail"].default_value = 2.0
    L.new(mapped((1.2, 30.0, 1.0)), rs.inputs["Vector"])
    # (Liam: the lines never even in size or colour): each band's width from a slow noise (thin hairlines to broad
    # dark bands), its darkness from another
    wv = N.new("ShaderNodeTexNoise"); wv.inputs["Scale"].default_value = 1.0; wv.inputs["Detail"].default_value = 2.0
    L.new(mapped((0.9, 9.0, 1.0)), wv.inputs["Vector"])
    width = mr(wv.outputs["Fac"], 0.28, 0.72, 0.94, 0.45)                            # where the band starts
    soft = op("MULTIPLY", op("SUBTRACT", ring, width), op("DIVIDE", 1.0, op("MAXIMUM", op("SUBTRACT", 0.96, width), 0.01)))
    band = op("MULTIPLY", op("MINIMUM", op("MAXIMUM", soft, 0.0), 1.0), mr(ring, 1.0, 0.96))
    latewood = op("MULTIPLY", band, mr(rs.outputs["Fac"], 0.25, 0.75, 0.25, 1.0))
    grain = op("MAXIMUM", op("MULTIPLY", grain, 0.55), latewood)
    # the stain rubbed back along the grain (a notch calmer than the reference), more toward the plank's edges
    wear_n = N.new("ShaderNodeTexNoise"); wear_n.inputs["Scale"].default_value = 1.0; wear_n.inputs["Detail"].default_value = 7.0; wear_n.inputs["Roughness"].default_value = 0.62
    L.new(mapped((1.4, 60.0, 1.0)), wear_n.inputs["Vector"])   # (long streaks along the grain)
    edge_wear = mr(edge, 0.03, 0.006)
    streak = mr(op("ADD", wear_n.outputs["Fac"], op("MULTIPLY", edge_wear, 0.12)), 0.6, 0.7)
    # worn zones (Liam: some worn areas, toward the reference): broad patches where the streaks rub right through
    zone_n = N.new("ShaderNodeTexNoise"); zone_n.inputs["Scale"].default_value = 1.0; zone_n.inputs["Detail"].default_value = 3.0
    L.new(mapped((2.6, 7.0, 1.0)), zone_n.inputs["Vector"])
    zone = mr(zone_n.outputs["Fac"], 0.58, 0.7)
    wear = op("MINIMUM", op("MULTIPLY", streak, op("ADD", 0.12, op("MULTIPLY", zone, 1.2))), 1.0)
    # fine scratches, two ways
    def scratches(rot, lo):
        n = N.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 1.0; n.inputs["Detail"].default_value = 2.0
        L.new(mapped((700.0, 5.0, 1.0), rot), n.inputs["Vector"]); return mr(n.outputs["Fac"], lo, lo + 0.035)
    # (along the grain; the crosswise ones broken into short marks by a mask: long straight lines read as drawn)
    cross_n = N.new("ShaderNodeTexNoise"); cross_n.inputs["Scale"].default_value = 18.0; L.new(P, cross_n.inputs["Vector"])
    scratch = op("MAXIMUM", scratches(0.08, 0.725), op("MULTIPLY", scratches(-0.5, 0.75), mr(cross_n.outputs["Fac"], 0.6, 0.66)))
    # nail holes: small dark dots near the planks' ends
    nv = N.new("ShaderNodeTexVoronoi"); nv.inputs["Scale"].default_value = 22.0; L.new(P, nv.inputs["Vector"])
    ends = mr(op("ABSOLUTE", sep.outputs["X"]), 0.5, 0.54)
    nail = op("MULTIPLY", mr(nv.outputs["Distance"], 0.03, 0.018), ends)
    # colour, in the sand's tones
    def mixc(a, col, fac, amount=1.0):
        mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"
        L.new(op("MULTIPLY", fac, amount), mx.inputs["Factor"])
        if isinstance(a, tuple):
            mx.inputs[6].default_value = a
        else:
            L.new(a, mx.inputs[6])
        if isinstance(col, tuple):
            mx.inputs[7].default_value = col
        else:
            L.new(col, mx.inputs[7])
        return mx.outputs[2]
    def deep(hex_, k):
        c = srgb(hex_); return (c[0] * k, c[1] * k, c[2] * k, 1.0)
    # the stain: rose-gold and champagne, deepened to read as wood under the close lamp (the walnut sat at ~8% albedo)
    rose, champ = deep("#8a5442", 0.34), deep("#986a44", 0.34)
    base = mixc(rose, champ, rnd)
    hue_n = N.new("ShaderNodeTexNoise"); hue_n.inputs["Scale"].default_value = 1.0; L.new(mapped((1.1, 4.0, 1.0)), hue_n.inputs["Vector"])
    line_col = mixc(deep("#2a1512", 0.26), deep("#5e2c22", 0.3), mr(hue_n.outputs["Fac"], 0.3, 0.7))   # (darker plum-brown to a redder brown)
    col = mixc(base, line_col, grain, 0.85)       # the grain: plum-brown
    col = mixc(col, deep("#dcc6a8", 0.62), op("MULTIPLY", wear, op("SUBTRACT", 1.0, op("MULTIPLY", knot, 0.8))), 0.9)   # rubbed back to pale wood (toward bone; the knots' hard resin wears less)
    col = mixc(col, deep("#24130f", 0.14), knot, 1.0)            # (over the wear: the knots stay bold)
    col = mixc(col, deep("#e3d6c6", 0.7), scratch, 0.5)
    col = mixc(col, srgb("#1c1012"), nail, 0.9)
    col = mixc(col, srgb("#160d0e"), gap, 1.0)           # the gaps
    L.new(col, b.inputs["Base Color"])
    rough = mr(wear, 0.0, 1.0, 0.62, 0.86, smooth=False)   # (matte: at the low view a glossier stain mirrored the lamp over the grain)
    L.new(op("MAXIMUM", rough, op("MULTIPLY", gap, 0.92)), b.inputs["Roughness"])
    b.inputs["Specular IOR Level"].default_value = 0.25
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.002
    L.new(op("SUBTRACT", op("ADD", op("MULTIPLY", grain, 0.25), op("MULTIPLY", scratch, -0.3)), op("MULTIPLY", gap, 1.0)), bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


if os.environ.get("SET_DESK") == "pallet":
    pw = pallet_wood()
    for o in bpy.data.objects:
        for slot in getattr(o, "material_slots", []):
            if slot.material and slot.material.name.startswith("walnut"):
                slot.material = pw
                print("CINE desk wood", o.name)


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
        # a soft drift where the ball forms, and patches thinning fast away from it (as sand that fell gathers): fine
        # grains, clustered by a noise field, none past the desk's edge (dropped, not clamped)
        def patchy(xy):
            x, y = xy[:, 0] * 18.0, xy[:, 1] * 18.0
            return 0.5 + 0.25 * np.sin(x * 1.3 + np.sin(y * 0.7) * 2.0) * np.cos(y * 1.1 + np.sin(x * 0.9) * 1.7) + 0.25 * np.sin(x * 3.1 + y * 2.3)
        n1, n2 = 22000, 60000
        d = rng.normal(0, 0.04, (n1, 2)); r1 = rng.uniform(0.0003, 0.0006, n1)
        mound = 0.004 * np.exp(-(d ** 2).sum(1) / (2 * 0.035 ** 2)) * rng.uniform(0, 1, n1)
        p1 = np.stack([d[:, 0], 0.03 + d[:, 1], r1 + mound], 1)
        q = rng.normal(0, 0.12, (n2, 2)) * rng.choice([1.0, 2.2], (n2, 1), p=[0.75, 0.25])
        q[:, 1] += 0.03
        keep = (np.abs(q[:, 0]) < 0.58) & (np.abs(q[:, 1]) < 0.28) & (rng.uniform(0, 1, n2) < patchy(q) ** 2.5)
        q = q[keep]; r2 = rng.uniform(0.0003, 0.0006, len(q))
        # resting on the desk, or on a paper where one lies (each sheet's footprint, from its object: a ray down)
        zz = np.zeros(len(q))
        papers = [o for o in bpy.data.objects if o.type == "MESH" and o.name.split(".")[0] in ("card_a", "card_b", "sticky_hero", "sticky_b", "sticky_c", "blank")]
        bpy.context.view_layer.update()
        for o in papers:
            inv = o.matrix_world.inverted()
            for k in range(len(q)):
                lp = inv @ V3((q[k, 0], q[k, 1], 0.05))
                hit, loc, _n, _i = o.ray_cast(lp, inv.to_3x3() @ V3((0, 0, -1)))
                if hit:
                    zz[k] = max(zz[k], (o.matrix_world @ loc).z)
        # (the desk's three planks: the gaps at y = -0.1 and 0.1, ~8 mm wide; a grain over one drops into the crack,
        # drawn to its middle and a little below the surface, so the cracks fill where the spill is dense)
        if os.environ.get("SET_DESK") == "pallet":
            for gy in (-0.1, 0.1):
                over = (np.abs(q[:, 1] - gy) < 0.0045) & (zz == 0)
                q[over, 1] = gy + (q[over, 1] - gy) * 0.45
                zz[over] = -r2[over] * 0.9
            for arr in (p1,):
                for gy in (-0.1, 0.1):
                    over = np.abs(arr[:, 1] - gy) < 0.0045
                    arr[over, 1] = gy + (arr[over, 1] - gy) * 0.45
                    arr[over, 2] = arr[over, 2] - 0.0006
        p2 = np.stack([q[:, 0], q[:, 1], r2 + zz], 1)
        print("CINE spill on papers", int((zz > 0).sum()))
        pts = np.vstack([p1, p2]).astype(np.float32)
        r1, r2 = r1, r2
        # the ball's own sand tones: the bone, champagne and rose-gold end of the palette (lower read as a red puddle)
        hh_spill = hh[hh > 0.45] if (hh > 0.45).any() else hh
        grains("spill", pts, rng.choice(hh_spill, len(pts)).astype(np.float32), np.concatenate([r1, r2]).astype(np.float32))
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
