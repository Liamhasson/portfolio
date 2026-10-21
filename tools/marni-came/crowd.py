"""The Problem section's loop: the crowd at Dopamine live at Badehaus (09.02.2024, Omri's handheld camera, 13.5–21.5 s),
cropped to half the screen (4:5) and graded like the hero (lido.py): black and white, the burn moving between edges
(Liam, 2026-10-21). `python3 tools/marni-came/crowd.py <out_base>` writes <out_base>.mp4, a master for encode-video.sh.
"""
import os, subprocess, sys
from PIL import Image, ImageChops

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lido   # noqa: E402
from treat import G   # noqa: E402

SRC = os.path.join(G, "Dopamine music video footage", "Omri handheld cam", "C0011.MP4")
lido.W, lido.H, FPS = 864, 1080, 30
START, LENGTH = 13.5, 8.0


def build(out_base):
    W, H = lido.W, lido.H
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(START), "-t", str(LENGTH), "-i", SRC, "-vf",
                          f"fps={FPS},crop=ih*0.8:ih:(iw-ih*0.8)/2:0,scale={W}:{H}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    raw = []
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        raw.append(Image.frombytes("RGB", (W, H), b))
    p.wait()
    lo, hi = lido.levels(raw[:: max(1, len(raw) // 24)])
    L, Gr = lido.lights(), lido.grains()
    # the burn: from the left breathing, then a sweep from the top, then a low flicker, closing back on the left
    segs = ((0.0, 2.8, "l", lambda t: (lido.ramp("l", 0.45 + 0.12 * __import__("math").sin(t * 2.1)), 0.7)),
            (2.6, 5.4, "t", lambda t: (ImageChops.multiply(lido.ramp("t", 0.7), lido.band(0.9 - 0.8 * (t - 2.6) / 2.8, 0.35)), 0.85)),
            (5.2, LENGTH, "b", lambda t: (lido.ramp("b", 0.3), lido.flick(t) * 0.9)))
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "8", "-preset", "slow", "-pix_fmt", "yuv420p", out_base + ".mp4"], stdin=subprocess.PIPE)
    for n, im in enumerate(raw):
        t = n / FPS
        out = lido.tone(im, lo, hi)
        for a, b, edge, fn in segs:
            w, tt = max((lido.weight(t + s, a, b), t + s) for s in (0.0, LENGTH, -LENGTH))
            if w <= 0.002: continue
            m, k = fn(tt)
            out = Image.composite(ImageChops.screen(out, L[edge]), out, lido.scale(m, k * w))
        out = Image.blend(out, ImageChops.soft_light(out, Gr[n % len(Gr)]), 0.36)
        enc.stdin.write(out.tobytes())
    enc.stdin.close(); enc.wait()
    print("wrote", out_base + ".mp4", len(raw), "frames, levels", lo, hi)


if __name__ == "__main__":
    build(sys.argv[1])
