"""The desk's surfaces under the notes, rebaked without the notes' shadows (blender/lookdev/bake_notes_free.py ->
renders/bake-notesfree/<state>), into public/lab/desk3d in place of their old bakes: the same steps as desk3d-publish.py
then desk3d-ktx2.py (PNG -> JPEG q3 -> ETC1S KTX2 with mips), for those surfaces only. The site's notes cast live
shadows instead (src/three/sand/note-story/desk-notes.ts).
  python3 scripts/lab/desk3d-notesfree-publish.py [path to blender/lookdev/renders/bake-notesfree]"""
import json, os, subprocess, sys, tempfile
SRC = sys.argv[1] if len(sys.argv) > 1 else "blender/lookdev/renders/bake-notesfree"
DST = "public/lab/desk3d"
KTX = os.environ.get("KTX", "ktx")
meta = json.load(open(os.path.join(DST, "desk.json")))
for name in ("bake_desk_top", "bake_card_b"):
    for st in ("shut", "open", "lit"):
        png = os.path.join(SRC, st, f"{name}.diff.png")
        out = meta["materials"][name]["diff"][st]
        assert out.endswith(".ktx2") and st in out, out
        with tempfile.TemporaryDirectory() as t:
            jpg, inp = os.path.join(t, "a.jpg"), os.path.join(t, "in.png")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", png, "-q:v", "3", jpg], check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", jpg, "-vf", "scale=ceil(iw/4)*4:ceil(ih/4)*4:flags=lanczos", "-pix_fmt", "rgb24", inp], check=True)
            subprocess.run([KTX, "create", "--format", "R8G8B8_SRGB", "--assign-tf", "srgb", "--encode", "basis-lz", "--clevel", "2",
                            "--qlevel", "255", "--generate-mipmap", inp, os.path.join(DST, out)], check=True)
        print("wrote", out)
