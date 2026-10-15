"""The baked desk with the playground drive (Liam, 2026-10-15): bake_notes_free.py's desk (the pallet wood, the four
touchable notes kept out of every other surface's light) with drive.py's drive, tape and cable added, every surface
baked, into renders/bake-drive/<state>; then scripts/lab/desk3d-publish.py BAKE_SRC=... publishes it. Same args/env:

  BAKE_STATE=shut BAKE_LOOKDEV=<checkout>/blender/lookdev/lookdev.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/bake_drive.py -- --scene bakedesk --out renders
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOOKDEV = os.environ.get("BAKE_LOOKDEV", os.path.join(HERE, "lookdev.py"))
NOTES = ("sticky_hero", "sticky_b", "sticky_c", "card_a")
INK = os.path.join(HERE, "handwriting", "playground.png")

sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(LOOKDEV))
from pallet import swap_pallet  # noqa: E402
from drive import build_drive  # noqa: E402


def notes_out_of_the_light():
    import bpy
    for o in bpy.data.objects:
        nm = o.name.split(".")[0]
        if nm in NOTES or nm in tuple("bake_" + n for n in NOTES):
            o.visible_shadow = False
            o.visible_diffuse = False
            o.visible_glossy = False
            o.visible_transmission = False


code = open(LOOKDEV).read()
def swap(anchor, new):
    global code
    assert code.count(anchor) == 1, f"lookdev.py's bakedesk changed: update bake_drive.py ({anchor[:60]!r})"
    code = code.replace(anchor, new)
swap('    os.environ["LOOKDEV_NO_SAND"] = "1"\n    build_desk()\n    if state == "open":',
     '    os.environ["LOOKDEV_NO_SAND"] = "1"\n    build_desk()\n    swap_pallet()\n    build_drive(INK)\n    notes_out_of_the_light()\n    if state == "open":')
swap('"renders", "bake", state)', '"renders", "bake-drive", state)')
swap("    for n, img, base in baked:\n        bpy.ops.object.select_all(action=\"DESELECT\")",
     "    notes_out_of_the_light()\n    for n, img, base in baked:\n        bpy.ops.object.select_all(action=\"DESELECT\")")
g = {"__name__": "__main__", "__file__": LOOKDEV, "swap_pallet": swap_pallet, "build_drive": build_drive,
     "notes_out_of_the_light": notes_out_of_the_light, "INK": INK}
exec(compile(code, LOOKDEV, "exec"), g)
