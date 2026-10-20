"""The case study's hero loop: Drop Dead live at Lido (Liam's edit), the solo then the drummer's view, graded like the
After Heartbreaks video (black and white, the amber burn) with the burn never the same twice: it changes edge, behaviour,
strength and size through the loop, and comes back to where it began so the loop is seamless (Liam, 2026-10-20).

`python3 tools/marni-came/lido.py <out_base>` writes <out_base>.mp4 (a near-lossless master for scripts/encode-video.sh).
Pillow only. Sources: MC_LIDO (the full edit) and the After Heartbreaks video's pure light (treat.frame(62.4)).
"""
import math, os, subprocess, sys
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from treat import BLACK, BONE, frame   # noqa: E402

LIDO = os.path.expanduser(os.environ.get("MC_LIDO", "~/Documents/Marni Came/Premiere Pro projects/Drop dead live at lido FULL/DROP DEAD live at LIDO - full.mp4"))
W, H, FPS = 1440, 810, 25
# the solo (2:18.0–2:24.0; it opens dark, not on the half-second of white curtain before it, so the wordmark reads), then
# the drummer's view (2:40.0–2:44.0): 10 s
CUTS = ((138.0, 144.0), (160.0, 164.0))
LENGTH = sum(b - a for a, b in CUTS)
FADE = 0.6   # seconds over which one burn hands over to the next


def tone(im, lo, hi, gamma=1.12, contrast=1.18):
    """The brand's black and white with fixed levels (no per-frame auto levels, so the loop doesn't flicker). The red
    stage light carries most of the picture, so red weighs more than in a plain greyscale."""
    g = im.convert("L", (0.5, 0.38, 0.12, 0))
    lut = [0 if v < lo else 255 if v > hi else int(255 * ((v - lo) / (hi - lo)) ** gamma) for v in range(256)]
    g = ImageEnhance.Contrast(g.point(lut)).enhance(contrast)
    return ImageOps.colorize(g, BLACK, BONE, mid=(116, 113, 108))


def ramp(edge, reach, power=1.6):
    """1 at the edge, falling to 0 at `reach` of the frame (l, r, t, b)."""
    data = [int(255 * max(0.0, 1 - (i / 255) / max(reach, 1e-3)) ** power) for i in range(256)]
    if edge in "rb":
        data = data[::-1]
    horiz = edge in "lr"
    m = Image.new("L", (256, 1) if horiz else (1, 256)); m.putdata(data)
    return m.resize((W, H), Image.BILINEAR)


def band(cx, width):
    """A soft vertical band centred at cx (0..1 of the width): the sweeping burn's window."""
    data = [int(255 * math.exp(-(((i / 255) - cx) / max(width, 1e-3)) ** 2)) for i in range(256)]
    m = Image.new("L", (256, 1)); m.putdata(data)
    return m.resize((W, H), Image.BILINEAR)


def scale(m, k):
    k = max(0.0, min(1.0, k))
    return m.point(lambda v: int(v * k))


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def flick(t):
    """Stage-light flicker: two slow sines, never faster than 2.5 swells a second (the ≤3 flashes/s rule)."""
    return 0.62 + 0.25 * math.sin(2 * math.pi * 1.7 * t) + 0.13 * math.sin(2 * math.pi * 2.3 * t + 1.1)


# each burn: (start, end, edge, mask(t) -> (L mask, strength)); edges and behaviours all differ
def seg_breathe(t):   # the solo opens: from the left, breathing
    return ramp("l", 0.42 + 0.14 * math.sin(2 * math.pi * t / 3.0)), 0.78


def seg_sweep(t):     # the blue spot: a big burn from the top, its window sweeping right to left
    u = (t - 2.8) / 3.3
    return ImageChops.multiply(ramp("t", 0.72), band(0.85 - 0.7 * u, 0.32)), 0.95


def seg_flicker(t):   # the drummer's view: small, low, flickering
    return ramp("b", 0.28), flick(t)


def seg_swell(t):     # the last beat: from the right, growing
    u = (t - 8.1) / 1.9
    return ramp("r", 0.18 + 0.34 * smooth(u)), 0.55 + 0.3 * smooth(u)


SEGS = ((0.0, 3.0, "l", seg_breathe), (2.8, 6.1, "t", seg_sweep), (5.9, 8.3, "b", seg_flicker), (8.1, LENGTH, "r", seg_swell))


def weight(t, a, b):
    """1 inside [a, b], fading over FADE at each end; the first burn also owns the wrap, so the loop closes on itself."""
    w = smooth((t - a) / FADE + 0.5) * smooth((b - t) / FADE + 0.5)
    return w


def lights():
    """The video's pure light turned so its bright side faces each edge."""
    base = Image.open(frame(62.4)).convert("RGB")
    lit = ImageOps.fit(base, (W, H), Image.LANCZOS, centering=(0, 0.5))
    gam = [int(255 * (v / 255) ** 1.3) for v in range(256)] * 3
    out = {"l": lit, "r": ImageOps.mirror(lit)}
    tall = ImageOps.fit(base, (H, W), Image.LANCZOS, centering=(0, 0.5))
    out["t"] = tall.rotate(-90, expand=True).resize((W, H))
    out["b"] = tall.rotate(90, expand=True).resize((W, H))
    return {k: v.point(gam) for k, v in out.items()}


def grains(n=10):
    out = []
    for _ in range(n):
        g = Image.effect_noise((W // 2, H // 2), 64).filter(ImageFilter.GaussianBlur(0.5)).resize((W, H), Image.BICUBIC)
        out.append(g.convert("RGB"))
    return out


def levels(samples):
    """Fixed black and white points from the clip's own range (0.5% and 99.5% of the weighted grey)."""
    hist = [0] * 256
    for im in samples:
        for i, c in enumerate(im.convert("L", (0.5, 0.38, 0.12, 0)).histogram()):
            hist[i] += c
    total = sum(hist); acc = 0; lo = hi = None
    for i, c in enumerate(hist):
        acc += c
        if lo is None and acc >= total * 0.005: lo = i
        if hi is None and acc >= total * 0.995: hi = i
    return lo, max(hi, lo + 40)


def frames():
    trims = ";".join(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,scale={W}:{H}:flags=lanczos,fps={FPS}[c{i}]" for i, (a, b) in enumerate(CUTS))
    graph = trims + ";" + "".join(f"[c{i}]" for i in range(len(CUTS))) + f"concat=n={len(CUTS)}:v=1:a=0[v]"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", LIDO, "-filter_complex", graph, "-map", "[v]", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    size = W * H * 3
    while True:
        b = p.stdout.read(size)
        if len(b) < size: break
        yield Image.frombytes("RGB", (W, H), b)
    p.wait()


def build(out_base):
    raw = list(frames())
    lo, hi = levels(raw[:: max(1, len(raw) // 24)])
    print("frames", len(raw), "levels", lo, hi)
    L, G = lights(), grains()
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "8", "-preset", "slow", "-pix_fmt", "yuv420p", out_base + ".mp4"], stdin=subprocess.PIPE)
    for n, im in enumerate(raw):
        t = n / FPS
        out = tone(im, lo, hi)
        for a, b, edge, fn in SEGS:
            # the loop is a circle: each burn is also looked for one loop back and one ahead, so the seam hands over too
            w, tt = max((weight(t + s, a, b), t + s) for s in (0.0, LENGTH, -LENGTH))
            if w <= 0.002: continue
            m, k = fn(tt)
            out = Image.composite(ImageChops.screen(out, L[edge]), out, scale(m, k * w))
        out = Image.blend(out, ImageChops.soft_light(out, G[n % len(G)]), 0.36)
        enc.stdin.write(out.tobytes())
    enc.stdin.close(); enc.wait()
    print("wrote", out_base + ".mp4")


if __name__ == "__main__":
    build(sys.argv[1])
