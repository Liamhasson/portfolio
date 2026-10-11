"""The baked 3D desk (lookdev.py --scene bakedesk) with the pallet wood (pallet.py, Liam 2026-10-11) in place of the walnut. bakedesk exits before lookdev.py's LOOKDEV_LIST hook runs, so this runs lookdev.py
itself with one line added after its build_desk(): the desk's walnut slots swapped for the pallet wood (pallet.py
swap_pallet; lookdev.py stays untouched). Same arguments and env as lookdev.py:

  BAKE_STATE=shut /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/bake_pallet.py \
    -- --scene bakedesk --out renders
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOOKDEV = os.path.join(HERE, "lookdev.py")


sys.path.insert(0, HERE)
from pallet import swap_pallet  # noqa: E402


code = open(LOOKDEV).read()
anchor = '    os.environ["LOOKDEV_NO_SAND"] = "1"\n    build_desk()\n    if state == "open":'
assert code.count(anchor) == 1, "lookdev.py's bakedesk changed: update bake_pallet.py's anchor"
code = code.replace(anchor, anchor.replace("build_desk()\n", "build_desk()\n    swap_pallet()\n"))
g = {"__name__": "__main__", "__file__": LOOKDEV, "swap_pallet": swap_pallet}
exec(compile(code, LOOKDEV, "exec"), g)
