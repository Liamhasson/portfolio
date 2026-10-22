"""Marni Came's video grade: black and white with fixed levels, the burn cut from real film-burn footage (burnfx.py), and
grain. One function grades any clip; the loops the site plays:

    hero   Drop Dead live at Lido: the solo (2:18–2:24), then the drummer's view (2:40–2:44)      1440 × 810
    card   the Lido solo peak alone (2:18–2:24), for the home page's card                           1280 × 800
    crowd  the crowd during Dopamine at Badehaus (Omri's handheld, 13.5–21.5 s), the Problem's half   864 × 1080

`python3 tools/marni-came/lido.py <hero|card|crowd> <out_base>` writes <out_base>.mp4, a near-lossless master for
scripts/encode-video.sh (Liam, 2026-10-20 and 10-22).
"""
import os, subprocess, sys
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from treat import BLACK, BONE, G   # noqa: E402
import burnfx   # noqa: E402

LIDO = os.path.expanduser(os.environ.get("MC_LIDO", "~/Documents/Marni Came/Premiere Pro projects/Drop dead live at lido FULL/DROP DEAD live at LIDO - full.mp4"))
CROWD = os.path.join(G, "Dopamine music video footage", "Omri handheld cam", "C0011.MP4")

# name: source, cuts (seconds), size, fps, crop (ffmpeg crop before scaling, or None), burn seed
CLIPS = {
    # (the solo opens on 2:18.0, not on the half-second of white curtain before it, so the wordmark reads)
    "hero": (LIDO, ((138.0, 144.0), (160.0, 164.0)), (1440, 810), 25, None, 11),
    "card": (LIDO, ((138.0, 144.0),), (1280, 800), 25, "crop=ih*1.6:ih", 23),
    "crowd": (CROWD, ((13.5, 21.5),), (864, 1080), 30, "crop=ih*0.8:ih", 37),
}


def tone(im, lo, hi, gamma=1.12, contrast=1.18):
    """The brand's black and white with fixed levels (no per-frame auto levels, so the loop doesn't flicker). The red
    stage light carries most of the picture, so red weighs more than in a plain greyscale."""
    g = im.convert("L", (0.5, 0.38, 0.12, 0))
    lut = [0 if v < lo else 255 if v > hi else int(255 * ((v - lo) / (hi - lo)) ** gamma) for v in range(256)]
    g = ImageEnhance.Contrast(g.point(lut)).enhance(contrast)
    return ImageOps.colorize(g, BLACK, BONE, mid=(116, 113, 108))


def grains(size, n=10):
    W, H = size
    return [Image.effect_noise((W // 2, H // 2), 64).filter(ImageFilter.GaussianBlur(0.5)).resize(size, Image.BICUBIC).convert("RGB") for _ in range(n)]


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


def frames(src, cuts, size, fps, crop):
    W, H = size
    pre = f"{crop}," if crop else ""
    trims = ";".join(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,{pre}scale={W}:{H}:flags=lanczos,fps={fps}[c{i}]" for i, (a, b) in enumerate(cuts))
    graph = trims + ";" + "".join(f"[c{i}]" for i in range(len(cuts))) + f"concat=n={len(cuts)}:v=1:a=0[v]"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-filter_complex", graph, "-map", "[v]", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    out = []
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        out.append(Image.frombytes("RGB", (W, H), b))
    p.wait()
    return out


def build(name, out_base):
    src, cuts, size, fps, crop, seed = CLIPS[name]
    raw = frames(src, cuts, size, fps, crop)
    lo, hi = levels(raw[:: max(1, len(raw) // 24)])
    burn = burnfx.track(len(raw) / fps, fps, size, seed)
    gr = grains(size)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-",
                            "-c:v", "libx264", "-crf", "8", "-preset", "slow", "-pix_fmt", "yuv420p", out_base + ".mp4"], stdin=subprocess.PIPE)
    for n, im in enumerate(raw):
        out = burnfx.apply(tone(im, lo, hi), burn[min(n, len(burn) - 1)])
        out = Image.blend(out, ImageChops.soft_light(out, gr[n % len(gr)]), 0.36)
        enc.stdin.write(out.tobytes())
    enc.stdin.close(); enc.wait()
    print("wrote", out_base + ".mp4", len(raw), "frames, levels", lo, hi, "flashes/s max", burnfx.flashes(burn, fps))


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in CLIPS:
        sys.exit(f"usage: lido.py <{'|'.join(CLIPS)}> <out_base>")
    build(sys.argv[1], sys.argv[2])
