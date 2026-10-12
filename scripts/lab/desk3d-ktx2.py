"""The desk's lighting bakes as GPU-compressed KTX2 (pre-launch audit, 2026-10-12): public/lab/desk3d's diffuse JPEGs ->
ETC1S KTX2 with their mips. As JPEGs they took 683 MB of GPU memory (a phone's tab can die of it); ETC1S is about an
eighth, at about the JPEGs' download. Identical bakes become one file (one download, one upload). The normal and roughness
maps and the screen's design stay JPEG (ETC1S can't hold them). Run after desk3d-publish.py (it calls this).
Needs KTX-Software's `ktx` (env KTX, else on PATH: installed at ~/.local/opt/ktx-software-4.4.2, linked from
~/.local/bin, 2026-10-13) and ffmpeg.
  python3 scripts/lab/desk3d-ktx2.py"""
import hashlib, json, os, subprocess, tempfile
DST = "public/lab/desk3d"
KTX = os.environ.get("KTX", "ktx")
meta = json.load(open(os.path.join(DST, "desk.json")))
by_sum, converted = {}, set()

def encode(jpg):
    out = jpg[:-4] + ".ktx2"
    with tempfile.TemporaryDirectory() as t:
        png = os.path.join(t, "in.png")
        # (whole 4x4 blocks: the desk top's 2047 rows become 2048; its UVs are normalized, so nothing moves)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(DST, jpg), "-vf",
                        "scale=ceil(iw/4)*4:ceil(ih/4)*4:flags=lanczos", "-pix_fmt", "rgb24", png], check=True)
        subprocess.run([KTX, "create", "--format", "R8G8B8_SRGB", "--assign-tf", "srgb", "--encode", "basis-lz",
                        "--clevel", "2", "--qlevel", "255", "--generate-mipmap", png, os.path.join(DST, out)], check=True)
    return out

def ktx2(f):
    if not f.endswith(".jpg"):
        return f
    s = hashlib.sha256(open(os.path.join(DST, f), "rb").read()).hexdigest()
    if s not in by_sum:
        by_sum[s] = encode(f)
    converted.add(f)
    return by_sum[s]

for m in meta["materials"].values():
    if m.get("screen"):
        continue
    m["diff"] = ktx2(m["diff"]) if isinstance(m["diff"], str) else {st: ktx2(f) for st, f in m["diff"].items()}
json.dump(meta, open(os.path.join(DST, "desk.json"), "w"))
for f in converted:
    os.remove(os.path.join(DST, f))
print(f"KTX2: {len(converted)} bakes as {len(by_sum)} files")
