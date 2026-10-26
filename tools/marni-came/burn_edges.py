"""The burn shapes for the bottom-of-screen visualizer (Liam, 2026-10-26: "bottom-led", a light burn that comes in from
the screen's edges). Sixteen moments of the film-burn footage (burnfx.py), each turned so its light enters from the bottom
of the frame and fades out upward, in the brand's burn ramp. The page lays them along the screen's edges, crossfades
between two per burn and sets how bright each is from the music, so no burn repeats the one before.

One sheet, 2 x 8 shapes of 512 x 160, as a transparent PNG: the light is the alpha (its brightest channel) and the colour
is the ramp's at full, so the page adds only light, never a black box over its own black. `python3 tools/marni-came/burn_edges.py <out.png>`
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import burnfx   # noqa: E402
from PIL import Image, ImageChops, ImageFilter

SW, SH, COLS, N = 512, 160, 2, 16
PEAK = 150   # the brightest a shape gets: deep amber, never bright (the page dims it further when the music is quiet)


def rows(im, a, b):
    h = im.size[1]; c = im.crop((0, int(h * a), im.size[0], int(h * b))); hist = c.histogram()
    return sum(i * n for i, n in enumerate(hist)) / max(1, c.size[0] * c.size[1])


def edge_burn(rng, used):
    """A moment whose light comes in from the bottom of the frame and whose top stays dark."""
    best, score = None, -1e9
    for _ in range(60):
        t = rng.uniform(0, burnfx.SRC_SECONDS - .2)
        if any(abs(t - u) < 1.5 for u in used): continue
        f = burnfx._read(t, .05, 20)[0]
        for rot in (0, 180):
            g = (f.rotate(rot) if rot else f).resize((320, 165))
            bot, mid, top = rows(g, .75, 1), rows(g, .4, .75), rows(g, 0, .4)
            if not (25 < bot < 200): continue
            sc = bot - 1.2 * mid - 3 * top
            if sc > score: best, score, bt = g, sc, t
        if score > 30: break
    used.append(bt)
    return best


def inward(w, h):
    m = Image.new("L", (w, h)); px = m.load()
    for x in range(w):
        kx = min(1, x / (w * .2), (w - x) / (w * .2))
        for y in range(h):
            px[x, y] = int(255 * kx * (y / h) ** 1.5)
    return m


if __name__ == "__main__":
    rng, used = random.Random(2026), []
    sheet = Image.new("RGB", (SW * COLS, SH * (N // COLS)))
    knee = [0 if v < 6 else int(PEAK * (1 - math.exp(-v / 70))) for v in range(256)]   # (the faintest light to true black)
    mask = inward(SW, SH)
    for i in range(N):
        b = edge_burn(rng, used).resize((SW, SH), Image.BICUBIC).filter(ImageFilter.GaussianBlur(SH * .16))
        sheet.paste(burnfx.colour(ImageChops.multiply(b, mask).point(knee)), ((i % COLS) * SW, (i // COLS) * SH))

    rgba = Image.new("RGBA", sheet.size)
    rgba.putdata([(0, 0, 0, 0) if (a := max(p)) == 0 else (p[0] * 255 // a, p[1] * 255 // a, p[2] * 255 // a, a) for p in sheet.getdata()])
    rgba.save(sys.argv[1], optimize=True)
    print(sys.argv[1], sheet.size, os.path.getsize(sys.argv[1]), "bytes")
