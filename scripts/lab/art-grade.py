"""Straighten, crop and gently grade Liam's artworks (pure PIL). Neutral paper, honest canvas colour, a little contrast."""
import sys, json, math
from PIL import Image, ImageFilter, ImageStat

def solve(A, b):
    n = len(b); M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c])); M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [x - f * y for x, y in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] for i in range(n)]

def warp(im, quad, size):
    w, h = size; A, B = [], []
    for (x, y), (u, v) in zip([(0, 0), (w, 0), (w, h), (0, h)], quad):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return im.transform(size, Image.PERSPECTIVE, tuple(solve(A, B)), Image.BICUBIC)

def pct(hist, p):
    tot = sum(hist); acc = 0
    for i, v in enumerate(hist):
        acc += v
        if acc >= tot * p: return i
    return 255

def grade(im, kind, warmth):
    if kind == "paper":
        # white balance from the paper (the brightest pixels), kept a touch warm
        L = im.convert("L"); thr = pct(L.histogram(), 0.75)
        mask = L.point(lambda v: 255 if v >= thr else 0)
        r, g, b = ImageStat.Stat(im, mask).mean; m = (r + g + b) / 3
        gains = [(m / c) * (1 - warmth) + warmth for c in (r, g, b)]
        im = Image.merge("RGB", [ch.point(lambda v, k=k: min(255, v * k)) for ch, k in zip(im.split(), gains)])
        # mostly neutral graphite, a whisper of warm paper
        grey = im.convert("L").convert("RGB")
        tint = Image.merge("RGB", [grey.getchannel(0), grey.getchannel(1).point(lambda v: v * 0.985), grey.getchannel(2).point(lambda v: v * 0.955)])
        im = Image.blend(im, tint, 0.3)
        lo, hi = pct(im.convert("L").histogram(), 0.005), pct(im.convert("L").histogram(), 0.90)
        top = 238
    else:
        # half-way gray-world: the room's tungsten out, the paint's own colour kept
        r, g, b = ImageStat.Stat(im).mean; m = (r + g + b) / 3
        gains = [(m / c) * 0.5 + 0.5 for c in (r, g, b)]
        im = Image.merge("RGB", [ch.point(lambda v, k=k: min(255, v * k)) for ch, k in zip(im.split(), gains)])
        lo, hi = pct(im.convert("L").histogram(), 0.004), pct(im.convert("L").histogram(), 0.996)
        top = 250
    def curve(v):
        x = min(max((v - lo) / max(hi - lo, 1), 0), 1)
        x = x + 0.10 * x * (1 - x) * (2 * x - 1)   # a gentle S
        return int(6 + x * (top - 6))
    lut = [curve(v) for v in range(256)]
    im = im.point(lut * 3)
    return im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=30, threshold=3))

for j in json.load(open(sys.argv[1])):
    im = Image.open(j["src"]).convert("RGB"); q = j["quad"]
    d = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])
    wt = (d(q[0], q[1]) + d(q[3], q[2])) / 2; ht = (d(q[0], q[3]) + d(q[1], q[2])) / 2
    k = j.get("aspect"); w, h = int(wt), int(wt / k if k else ht)
    out = warp(im, q, (w, h)); i = j.get("inset", 0.012)
    out = out.crop((int(w * i), int(h * i), int(w * (1 - i)), int(h * (1 - i))))
    if j.get("rot"): out = out.rotate(j["rot"], expand=True)
    graded = grade(out, j["kind"], j.get("warmth", 0.15))
    k = j.get("strength", 1.0)   # (how much of the grade: some pieces only need a nudge)
    if k < 1:
        # the rest: the plain crop with only its colour cast taken out
        r, g, b = ImageStat.Stat(out).mean; m = (r + g + b) / 3
        plain = Image.merge("RGB", [ch.point(lambda v, q=(m / c) * 0.35 + 0.65: min(255, v * q)) for ch, c in zip(out.split(), (r, g, b))])
        graded = Image.blend(plain, graded, k)
    out = graded; out.thumbnail((1600, 1600), Image.LANCZOS)
    out.save(j["out"], quality=88); print(j["out"].split("/")[-1], out.size)
