"""Marni Came's burn, cut from real film-burn footage (Liam, 2026-10-22: "Film Burn Overlay.mp4", tools/marni-came/sources/
film-burn.mp4). The After Heartbreaks video's burn is never the same twice: it changes shape, place and size, sometimes
comes from two sides at once, washes the whole frame for a moment, then leaves long dark gaps. So every burn here is a
different moment of the footage, at its own speed, size, rotation and flip, now and then two at once, with dark between.

The footage only says how much light there is; its colour comes from the brand's burn ramp (8D4802 → B36F0B → FFE1AA,
light only), screened over the picture. Never more than three flashes a second (the brand's rule, WCAG 2.3.1).

    track(seconds, fps, size, seed) -> list of L images (the burn's light, frame by frame); seamless when looped
    still(size, seed) -> one L image (a single burn, for a photograph)
    apply(rgb, light) -> rgb with the burn screened in
"""
import os, random, subprocess
from PIL import Image, ImageChops, ImageFilter, ImageOps

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "film-burn.mp4")
SRC_SECONDS = 73.7
WORK = (640, 329)   # the footage is soft; it's read small and enlarged

# the brand's burn ramp, from no light to full light
STOPS = [(0, (0, 0, 0)), (70, (0x8D, 0x48, 0x02)), (150, (0xB3, 0x6F, 0x0B)), (215, (0xFF, 0xE1, 0xAA)), (255, (0xFF, 0xF6, 0xE6))]


def _ramp():
    lut = [[], [], []]
    for v in range(256):
        for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
            if a <= v <= b:
                k = (v - a) / (b - a)
                for c in range(3):
                    lut[c].append(int(ca[c] + (cb[c] - ca[c]) * k))
                break
    return lut


RAMP = _ramp()
# the footage's dim red haze would lift the whole frame to amber: only its brighter light burns through
LEVELS = [0 if v < 48 else int(255 * ((v - 48) / 200) ** 1.7) if v < 248 else 255 for v in range(256)]


def colour(light):
    """The burn's light as the brand's amber (L -> RGB)."""
    return Image.merge("RGB", [light.point(RAMP[c]) for c in range(3)])


def apply(rgb, light, strength=1.0):
    """Screen the burn over a picture."""
    if strength != 1.0:
        light = light.point(lambda v: int(min(255, v * strength)))
    return ImageChops.screen(rgb, colour(light))


def _read(start, seconds, fps):
    """A stretch of the footage as small L frames (luminance, weighted toward the warm channels where its light lives)."""
    w, h = WORK
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-i", SRC, "-vf",
                        f"fps={fps:.4f},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    out = []
    for i in range(len(p) // (w * h * 3)):
        im = Image.frombytes("RGB", (w, h), p[i * w * h * 3:(i + 1) * w * h * 3])
        out.append(im.convert("L", (0.55, 0.35, 0.10, 0)).point(LEVELS))
    return out


def _place(frame, size, t):
    """One burn frame transformed (rotation, flip, zoom, offset) and fitted to the picture's size."""
    rot, flip, zoom, ox, oy = t
    im = frame.rotate(rot, expand=True) if rot else frame
    if flip & 1: im = ImageOps.mirror(im)
    if flip & 2: im = ImageOps.flip(im)
    W, H = size
    im = ImageOps.fit(im, (int(W / zoom), int(H / zoom)), Image.BILINEAR, centering=(ox, oy)).resize(size, Image.BICUBIC)
    # (the footage is read small and carries its own compression blocks: smooth it once enlarged, so neither shows)
    return im.filter(ImageFilter.GaussianBlur(max(1.0, W / WORK[0] * 5.0)))


def _transform(rng):
    return (rng.choice([0, 0, 90, 180, 270]), rng.randrange(4), rng.uniform(1.0, 1.9), rng.random(), rng.random())


def _coverage(im):
    """The share of the frame that is lit, and the share that stays dark."""
    h = im.histogram(); n = im.size[0] * im.size[1]
    return sum(h[128:]) / n, sum(h[:24]) / n


def still(size, seed, layers=None, wash=0.12):
    """One burn for a photograph: a moment with both light and dark in it (a part of the frame burns, the rest survives),
    placed and turned at random; sometimes two at once; now and then (wash) one that covers the whole frame."""
    rng = random.Random(seed)
    n = layers or (2 if rng.random() < 0.35 else 1)
    whole = rng.random() < wash
    light = Image.new("L", size, 0)
    for _ in range(n):
        best = None
        for _try in range(30):
            f = _read(rng.uniform(0, SRC_SECONDS - 0.2), 0.05, 20)[0]
            lit, dark = _coverage(f)
            ok = (lit > 0.5) if whole else (0.06 < lit < 0.4 and dark > 0.35)
            if ok: best = f; break
            if best is None and lit > 0.04: best = f
        if best is None: continue
        # (re-roll a placement that zooms into the dark: the burn should show)
        for _try in range(10):
            placed = _place(best, size, _transform(rng))
            if _coverage(placed)[0] > (0.5 if whole else 0.05): break
        light = ImageChops.lighter(light, placed)
    # a still's burn falls off tighter than a moving one, so the picture stays black and white around it
    return light if whole else light.point(lambda v: int(255 * (v / 255) ** 1.5))


def _lit(rng, seconds, fps):
    """A stretch of the footage with light in it (the footage has long dark gaps: a cut landing in one burns nothing)."""
    for _ in range(8):
        frames = _read(rng.uniform(0, SRC_SECONDS - seconds - 0.1), seconds, fps)
        if frames and sum(_mean(f) for f in frames) / len(frames) > 22: return frames
    return frames


def track(seconds, fps, size, seed, density=0.6):
    """The burn for a loop of `seconds`: events cut from the footage, placed on the timeline with dark gaps; none crosses
    the loop's seam (it starts and ends dark), and no second has more than three flashes."""
    rng = random.Random(seed)
    n = int(round(seconds * fps))
    light = [Image.new("L", size, 0) for _ in range(n)]
    t = rng.uniform(0.15, 0.6)
    while t < seconds - 0.5:
        dur = min(rng.choice([rng.uniform(0.15, 0.5), rng.uniform(0.4, 1.2), rng.uniform(0.8, 1.8)]), seconds - 0.25 - t)
        speed = rng.choice([0.75, 1.0, 1.5, 2.0, 3.0])
        frames = _lit(rng, dur * speed, fps / speed)
        tr = _transform(rng)
        a = int(t * fps)
        fade = max(1, int(0.08 * fps))
        for k, f in enumerate(frames):
            i = a + k
            if i >= n: break
            # (a short fade at each end, so a burn never pops in or out on one frame unless the footage itself does)
            g = min(1.0, (k + 1) / fade, (len(frames) - k) / fade)
            lit = _place(f, size, tr).point(lambda v, g=g: int(v * g))
            light[i] = ImageChops.lighter(light[i], lit)
        # a second burn joins now and then, from somewhere else
        if rng.random() < 0.3:
            t2 = t + rng.uniform(0.1, dur * 0.6)
            d2 = min(rng.uniform(0.3, 1.2), seconds - 0.25 - t2)
            if d2 > 0.2:
                fr2 = _lit(rng, d2, fps)
                tr2 = _transform(rng)
                for k, f in enumerate(fr2):
                    i = int(t2 * fps) + k
                    if i >= n: break
                    g = min(1.0, (k + 1) / fade, (len(fr2) - k) / fade)
                    light[i] = ImageChops.lighter(light[i], _place(f, size, tr2).point(lambda v, g=g: int(v * g)))
        t += dur + rng.choice([rng.uniform(0.05, 0.4), rng.uniform(0.4, 1.4), rng.uniform(1.2, 2.4)]) / density
    return _limit_flashes(light, fps)


def _mean(im):
    h = im.histogram(); return sum(i * c for i, c in enumerate(h)) / (im.size[0] * im.size[1])


def flashes(light, fps):
    """The most flashes in any one second: a flash is the frame-to-frame mean light rising by a fifth of full or more."""
    m = [_mean(f) / 255 for f in light]
    ups = [i for i in range(1, len(m)) if m[i] - m[i - 1] >= 0.2]
    return max((sum(1 for u in ups if s <= u < s + fps) for s in range(len(m))), default=0)


def _limit_flashes(light, fps):
    """Soften any rise that would make a fourth flash inside one second."""
    m = [_mean(f) / 255 for f in light]
    recent = []
    for i in range(1, len(light)):
        recent = [r for r in recent if i - r < fps]
        if m[i] - m[i - 1] >= 0.2:
            if len(recent) >= 3:
                k = max(0.0, (m[i - 1] + 0.15) / max(m[i], 1e-3))
                light[i] = light[i].point(lambda v, k=k: int(v * k)); m[i] = _mean(light[i]) / 255
            else:
                recent.append(i)
    return light
