"""Cut the desk passes into the looping slide-reveal film (Liam, 2026-10-16; About pictures spec, section 5):
wire -> clay -> materials -> light -> final -> wire, 0.8 s eased wipes, 0.9 s holds, 2 s on the final, 9.6 s at 1440x900,
H.264 CRF 20. The poster is the final frame. Reads the five PNGs desk_passes.py renders; needs Pillow and ffmpeg.

  python3 blender/lookdev/desk_passes_compose.py [passes_dir] [out.mp4]

Defaults: blender/lookdev/renders/desk-passes -> public/about/desk-build.mp4 (+ desk-build.jpg beside it).
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "renders", "desk-passes")
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "public", "about", "desk-build.mp4")
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
W, H, FPS = 1440, 900, 30
HOLD, WIPE, FINAL_HOLD = 0.9, 0.8, 2.0

def load(name):
    return Image.open(f"{src}/{name}.png").convert("RGB").resize((W, H), Image.LANCZOS)

wire, clay, mat, light, final = (load(n) for n in ("wire", "clay", "mat", "light", "final"))

layers = [wire, clay, mat, light, final, wire]   # (back to the wire: the loop closes on the frame it opened on)

def ease(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2

frames = []
def hold(img, secs):
    frames.extend([img] * round(secs * FPS))

def wipe(a, b):
    n = round(WIPE * FPS)
    for i in range(1, n + 1):
        x = round(ease(i / n) * W)
        f = a.copy()
        if x > 0:
            f.paste(b.crop((0, 0, x, H)), (0, 0))   # the next layer slides in from the left, left to right
            if x < W:
                ImageDraw.Draw(f).line((x, 0, x, H), fill=(214, 206, 196), width=1)   # a hairline at the seam, no glow
        frames.append(f)

for i in range(len(layers) - 1):
    hold(layers[i], FINAL_HOLD if layers[i] is final else HOLD)
    wipe(layers[i], layers[i + 1])

p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", "-an", out],
                     stdin=subprocess.PIPE)
for f in frames:
    p.stdin.write(f.tobytes())
p.stdin.close()
p.wait()
final.save(os.path.splitext(out)[0] + ".jpg", quality=88)
print("frames", len(frames), "secs", round(len(frames) / FPS, 1))
