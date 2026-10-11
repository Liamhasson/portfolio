"""The baked 3D desk (lookdev.py --scene bakedesk) with the pallet wood (cinematic_set.py SET_DESK=pallet, Liam
2026-10-11) in place of the walnut. bakedesk exits before lookdev.py's LOOKDEV_LIST hook runs, so this runs lookdev.py
itself with one line added after its build_desk(): the desk's walnut slots swapped for pallet_wood() (lookdev.py and
cinematic_set.py stay untouched). Same arguments and env as lookdev.py:

  BAKE_STATE=shut /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/bake_pallet.py \
    -- --scene bakedesk --out renders
"""
import ast
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOOKDEV = os.path.join(HERE, "lookdev.py")


def swap_pallet():
    import bpy
    src = open(os.path.join(HERE, "cinematic_set.py")).read()
    keep = [n for n in ast.parse(src).body
            if isinstance(n, (ast.Import, ast.ImportFrom)) or (isinstance(n, ast.FunctionDef) and n.name in ("srgb", "pallet_wood"))]
    g = {}
    exec(compile(ast.Module(keep, []), "cinematic_set", "exec"), g)
    pw = g["pallet_wood"]()
    for o in bpy.data.objects:
        for slot in getattr(o, "material_slots", []):
            if slot.material and slot.material.name.startswith("walnut"):
                slot.material = pw
                # (the wood is laid out in the desk's own coordinates; the bake copies sit in world space)
                print("BAKE pallet wood on", o.name, tuple(round(v, 4) for v in o.matrix_world.translation),
                      tuple(round(v, 4) for v in o.matrix_world.to_scale()), flush=True)


code = open(LOOKDEV).read()
anchor = '    os.environ["LOOKDEV_NO_SAND"] = "1"\n    build_desk()\n    if state == "open":'
assert code.count(anchor) == 1, "lookdev.py's bakedesk changed: update bake_pallet.py's anchor"
code = code.replace(anchor, anchor.replace("build_desk()\n", "build_desk()\n    swap_pallet()\n"))
g = {"__name__": "__main__", "__file__": LOOKDEV, "swap_pallet": swap_pallet}
exec(compile(code, LOOKDEV, "exec"), g)
