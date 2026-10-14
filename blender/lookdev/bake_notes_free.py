"""The desk's surfaces under the notes, rebaked without the notes' shadows (Liam, 2026-10-14: a note lifted off the desk
left its baked shadow behind). The baked desk (bake_pallet.py: lookdev.py --scene bakedesk with the pallet wood) with
the four touchable notes kept out of every other surface's light (no shadow, no bounce), only the surfaces they lie on
baked (desk_top, card_b), into renders/bake-notesfree/<state>; the site gives each note a live soft shadow instead.
Same arguments and env as bake_pallet.py:

  BAKE_STATE=shut /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/bake_notes_free.py \
    -- --scene bakedesk --out renders
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOOKDEV = os.environ.get("BAKE_LOOKDEV", os.path.join(HERE, "lookdev.py"))   # (the checkout whose renders/bake/uv to reuse)
NOTES = ("sticky_hero", "sticky_b", "sticky_c", "card_a")
ONLY = tuple(os.environ.get("BAKE_NOTES_ONLY", "desk_top,card_b").split(","))

sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(LOOKDEV))
from pallet import swap_pallet  # noqa: E402


def notes_out_of_the_light():
    import bpy
    for o in bpy.data.objects:
        nm = o.name.split(".")[0]
        if nm in NOTES or nm in tuple("bake_" + n for n in NOTES):   # (the originals, and the copies the bake makes)
            o.visible_shadow = False
            o.visible_diffuse = False
            o.visible_glossy = False
            o.visible_transmission = False
            print("NOTESFREE", o.name, flush=True)


code = open(LOOKDEV).read()
def swap(anchor, new):
    global code
    assert code.count(anchor) == 1, f"lookdev.py's bakedesk changed: update bake_notes_free.py ({anchor[:60]!r})"
    code = code.replace(anchor, new)
swap('    os.environ["LOOKDEV_NO_SAND"] = "1"\n    build_desk()\n    if state == "open":',
     '    os.environ["LOOKDEV_NO_SAND"] = "1"\n    build_desk()\n    swap_pallet()\n    notes_out_of_the_light()\n    if state == "open":')
swap('"renders", "bake", state)', '"renders", "bake-notesfree", state)')
swap("    for n, img, base in baked:\n        bpy.ops.object.select_all(action=\"DESELECT\")",
     "    notes_out_of_the_light()\n    for n, img, base in [b for b in baked if b[2] in ONLY]:\n        bpy.ops.object.select_all(action=\"DESELECT\")")
swap("    for n in screens:\n        mats_meta[n.name] = {\"screen\": True,",
     "    print(\"WROTE\", out, flush=True); sys.exit(0)\n    for n in screens:\n        mats_meta[n.name] = {\"screen\": True,")
g = {"__name__": "__main__", "__file__": LOOKDEV, "swap_pallet": swap_pallet, "notes_out_of_the_light": notes_out_of_the_light, "ONLY": ONLY}
exec(compile(code, LOOKDEV, "exec"), g)
