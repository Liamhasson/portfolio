"""The photographs for the print files (docs/marni-came/print/), treated at print size: the posters' and the sleeve's
pictures and the EPK's band portraits. The type is set over them by print.mjs, as the site sets it (poster.tsx).

Same treatments and sources as treat.py, run at 300 dpi; the grain is drawn at the web's scale and enlarged, so a print
reads like the screen. `python3 tools/marni-came/print.py <build_dir>`
"""
import os, sys
from PIL import Image, ImageFilter, ImageChops
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from treat import G, SRC, frame, load, grade, lens, burn   # noqa: E402

DPI = 300
MM = DPI / 25.4
px = lambda mm: round(mm * MM)
BLEED = 3


def print_grain(im, amt=0.16, seed=1, web_width=1200):
    """treat.grain at the web's grain size: the noise drawn at web_width and enlarged to the print."""
    random.seed(seed)
    k = im.size[0] / web_width
    small = (max(1, round(im.size[0] / k)), max(1, round(im.size[1] / k)))
    n = Image.effect_noise(small, 64).convert("RGB").filter(ImageFilter.GaussianBlur(0.6)).resize(im.size, Image.BICUBIC)
    return Image.blend(im, ImageChops.soft_light(im, n), amt * 3)


def build(out):
    os.makedirs(out, exist_ok=True)

    def save(im, name):
        p = os.path.join(out, name); im.save(p, quality=95, dpi=(DPI, DPI)); print(name, im.size)

    # A3 with bleed (the posters' 1200:1700 is A3's own shape)
    A3 = (px(297 + 2 * BLEED), px(420 + 2 * BLEED))
    light = frame(62.4)   # pure amber light, no subject (the video at 1:02)
    lido = os.path.join(G, "Lido pictures BIMM")
    bh23 = os.path.join(G, "Badehaus 2023")
    sources = {
        "lido": (os.path.join(lido, "417412541_926263995968841_17596110508459146_n.jpg"), dict(lo=22, hi=215), (.3, .7), ((0.5, 0), "t", .45)),
        "badehaus-2024": (os.path.join(G, "Badehaus 2024/Ben's pics/2024-02-09 Imris badehaus shoot Colord ex1-OBD00681.jpg"), dict(lo=16, hi=215), (.3, .72), ((1, 0.5), "r", .4)),
        "end-of-term": (os.path.join(lido, "416839192_926264049302169_1082200003046739174_n.jpg"), dict(lo=14, hi=220), (.3, .75), ((0, 1), "b", .45)),
    }
    for name, (src, g, (inner, outer), (pos, edge, reach)) in sources.items():
        print(name, "source", Image.open(src).size)
        save(print_grain(burn(lens(grade(load(src, A3), **g), inner, outer), light, pos, edge, reach)), f"poster-{name}.jpg")
    # Badehaus 2023 is framed: its photo sits inside the black margin (90% x 76% of the trim), the whole band at 11:43
    F = (px(297 * 0.9), px(420 * 0.76))
    st = frame(703, os.path.join(bh23, "Marni Came steady 1.MP4"))
    save(print_grain(burn(lens(grade(load(st, F), lo=8, hi=225), .32, .8), light, (0.5, 0), "t", .45)), "poster-badehaus-2023.jpg")

    # the 12" sleeve: the cover's master (3000 px), to 12" with bleed
    S = px(304.8 + 2 * BLEED)
    save(load(os.path.join(G, "After Heartbreaks/After Heartbreaks cover art design.jpg")).resize((S, S), Image.LANCZOS), "sleeve.jpg")

    # the EPK's portraits: the red-light session at full size (treat.py's crops, 4:5)
    rs = load(os.path.join(G, "12th March photoshoot edits/Red separated.jpg")); W, H = rs.size
    for name, (qx, qy), cx in (("sami", (0, 0), .40), ("liam", (1, 0), .55), ("pedro", (0, 1), .43), ("rikki", (1, 1), .40)):
        q = rs.crop((qx * W // 2, qy * H // 2, (qx + 1) * W // 2, (qy + 1) * H // 2)); Q = q.size[0]
        w = 0.66 * Q; h = w * 1.25; L = max(0, min(cx * Q - w / 2, Q - w)); T = 0.1 * Q
        im = grade(q.crop((int(L), int(T), int(L + w), int(T + h))), lo=2, hi=90, gamma=1.0, contrast=1.3)
        save(print_grain(im, .12, web_width=900), f"band-{name}.jpg")

    # the EPK's burned logo, at print size
    logo = Image.open(os.path.join(G, "logo/PNG/Marni Came logo.png")).crop((645, 733, 2840, 1751))
    tw, th = px(204), px(128)
    tile = Image.new("RGB", (tw, th), (10, 9, 8)); lw = round(tw * 0.69); l = logo.resize((lw, round(lw * logo.height / logo.width)), Image.LANCZOS)
    tile.paste(Image.new("RGB", l.size, (238, 234, 226)), ((tw - lw) // 2, (th - l.height) // 2), l)
    save(print_grain(burn(tile, frame(62.4), (0, 0.5), "l", .85, 1.0), .12, web_width=1600), "burned.jpg")
    # the shirt's back: the single's cut faces as one-colour bone ink (alpha from light), fading out at the edges
    from PIL import ImageOps, ImageDraw
    g = ImageOps.autocontrast(ImageOps.grayscale(Image.open(os.path.join(G, "After Heartbreaks/After Heartbreaks cover art design.jpg"))), cutoff=1)
    a = g.point([0 if v < 40 else 255 if v > 235 else int(255 * ((v - 40) / 195) ** 1.15) for v in range(256)])
    w, h = a.size; m = Image.new("L", a.size, 0)
    ImageDraw.Draw(m).ellipse((w * 0.08, h * 0.04, w * 0.92, h * 0.98), fill=255)
    a = ImageChops.multiply(a, m.filter(ImageFilter.GaussianBlur(w * 0.06)))
    ink = Image.new("RGBA", a.size, (238, 234, 226, 0)); ink.putalpha(a)
    ink.save(os.path.join(out, "shirt-faces.png")); print("shirt-faces.png", ink.size)


if __name__ == "__main__":
    build(sys.argv[1])
