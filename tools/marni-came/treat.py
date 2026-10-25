"""Marni Came's image treatments (board docs/prototypes/marni-came-mockups.html; spec
docs/superpowers/specs/2026-10-20-marni-came-case-study-design.md §4.3). Pillow only.

The brand grade, grain, the round lens, the burn (cut from real film-burn footage: burnfx.py, Liam 10-22) and doubled
(one moment only). `python3 tools/marni-came/treat.py <out_dir>` writes
every still the case study and the band site use.

Sources: MC_ARCHIVE (default ~/Documents/Marni Came), MC_VIDEO (the After Heartbreaks music video), and two stills
plus one Drive photo kept in tools/marni-came/sources/.
"""
import os, random, subprocess, sys, tempfile, itertools
from PIL import Image, ImageOps, ImageChops, ImageFilter, ImageDraw, ImageEnhance

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ARCHIVE = os.path.expanduser(os.environ.get("MC_ARCHIVE", "~/Documents/Marni Came"))
VIDEO = os.path.expanduser(os.environ.get("MC_VIDEO", "~/Downloads/Marni Came - After Heartbreaks (Official music video).mp4"))
LIDO = os.path.expanduser(os.environ.get("MC_LIDO", "~/Documents/Marni Came/Premiere Pro projects/Drop dead live at lido FULL/DROP DEAD live at LIDO - full.mp4"))
G = os.path.join(ARCHIVE, "Gallery")
SRC = os.path.join(HERE, "sources")
BLACK, BONE = (10, 9, 8), (238, 234, 226)
TMP = tempfile.mkdtemp(prefix="mc-")


def frame(t, src=VIDEO, width=None):
    """One frame of a video at t seconds, as a PNG path (cached per call)."""
    out = os.path.join(TMP, f"{abs(hash((src, t, width)))}.png")
    if not os.path.exists(out):
        vf = ["-vf", f"scale={width}:-1"] if width else []
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src, "-map", "0:v:0", "-frames:v", "1", *vf, out], check=True)
    return out


def load(p, size=None, centering=(0.5, 0.4)):
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
    return ImageOps.fit(im, size, Image.LANCZOS, centering=centering) if size else im


def grade(im, lo=18, hi=225, gamma=1.15, contrast=1.25):
    g = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=0.6)
    lut = [0 if v < lo else 255 if v > hi else int(255 * ((v - lo) / (hi - lo)) ** gamma) for v in range(256)]
    g = ImageEnhance.Contrast(g.point(lut)).enhance(contrast)
    return ImageOps.colorize(g, BLACK, BONE, mid=(116, 113, 108))


def grain(im, amt=0.16, seed=1):
    random.seed(seed)
    n = Image.effect_noise(im.size, 64).convert("RGB").filter(ImageFilter.GaussianBlur(0.6))
    return Image.blend(im, ImageChops.soft_light(im, n), amt * 3)


def lens(im, inner=0.30, outer=0.62):
    w, h = im.size; m = Image.new("L", im.size, 0); r = min(w, h) * outer
    ImageDraw.Draw(m).ellipse((w / 2 - r, h / 2 - r, w / 2 + r, h / 2 + r), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * (outer - inner) * 0.6))
    return Image.composite(im, Image.new("RGB", im.size, BLACK), m)


def slices(im, n, shifts):
    """Vertical bands, each shifted up or down by its shift in pixels."""
    w, h = im.size; out = im.copy()
    for i in range(n):
        x0, x1 = w * i // n, w * (i + 1) // n
        out.paste(ImageChops.offset(im.crop((x0, 0, x1, h)), 0, int(shifts[i])), (x0, 0))
    return out


def burn(im, light=None, pos=(0.5, 0.5), edge="l", reach=0.5, gamma=1.3, seed=None):
    """The burn on a still: one moment (or two) of real film-burn footage, placed and turned at random, in the brand's
    amber, screened in (burnfx.py; Liam 10-22: never the same burn twice). The old arguments only seed the choice now,
    so each picture keeps its own burn from one build to the next."""
    import hashlib, burnfx
    key = seed if seed is not None else int(hashlib.md5(f"{im.size}{pos}{edge}{reach}".encode()).hexdigest()[:8], 16)
    return burnfx.apply(im, burnfx.still(im.size, key))


def doubled(base, other, box, dx=0.0, dy=0.0, scale=1.0, amt=0.9, feather=0.05):
    """Part of the subject repeats: `other` (another frame of the same moment, or the same frame) is scaled about the
    box's centre, offset by (dx, dy) of the frame, masked to a feathered ellipse and screened over `base`."""
    w, h = base.size; o = other
    if scale != 1.0:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        nw, nh = int(w * scale), int(h * scale); o = o.resize((nw, nh), Image.LANCZOS)
        L, T = int(cx * nw - cx * w), int(cy * nh - cy * h); o = o.crop((L, T, L + w, T + h))
    o = ImageChops.offset(o, int(dx * w), int(dy * h))
    m = Image.new("L", base.size, 0)
    ImageDraw.Draw(m).ellipse(((box[0] + dx) * w, (box[1] + dy) * h, (box[2] + dx) * w, (box[3] + dy) * h), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(feather * min(w, h)))
    return Image.composite(Image.blend(base, ImageChops.screen(base, o), amt), base, m)


def build(out):
    os.makedirs(out, exist_ok=True)
    def save(im, name, q=86):
        p = os.path.join(out, name); os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p, quality=q); print(name, im.size)
    light = None   # (the burn comes from the film-burn footage now: burnfx.py)
    # the burn as a swatch and as the band site's light: a few moments of the footage in the brand's amber
    import burnfx
    for i in range(6):
        save(burnfx.colour(burnfx.still((1280, 720), 100 + i, layers=1)), f"burn/{i}.jpg", q=82)
    face = os.path.join(SRC, "after-heartbreaks-still-face.jpg")
    lido = os.path.join(G, "Lido pictures BIMM")
    shoot = os.path.join(G, "12th March photoshoot edits")
    # the four moves
    # (Slice went, Liam 10-22: the video never used it)
    # (Liam 10-22: the Burn picture is a real burn frame, the video's thumbnail; the face still was a blowout)
    save(load(os.path.join(SRC, "after-heartbreaks-thumbnail.jpg"), (1600, 1200), (0.55, 0.45)), "moves/burn.jpg")
    a = grade(load(os.path.join(G, "Pictures from After Heartbreaks photoshoot/C0020T01.JPG"), (1600, 1200)), lo=6, hi=170)
    b = grade(load(os.path.join(G, "Pictures from After Heartbreaks photoshoot/C0019T01.JPG"), (1600, 1200)), lo=6, hi=170)
    save(grain(lens(doubled(a, b, (0.18, 0.0, 0.62, 0.62), dx=0.05, dy=-0.01, amt=.95, feather=.06), .34, .8)), "moves/doubled.jpg")
    # (Liam 10-21: the lens is a sharp centre with smeared edges; and Blowout, the fifth move: two stills Liam picked)
    save(load(os.path.join(SRC, "after-heartbreaks-still-lens.jpg"), (1600, 1200), (0.55, 0.5)), "moves/lens.jpg", q=84)
    save(load(os.path.join(SRC, "after-heartbreaks-still-blowout.jpg"), (1600, 1200), (0.5, 0.5)), "moves/blowout.jpg", q=84)
    # the switch: the face, graded, with nothing applied (the page applies the moves live)
    # (Liam 10-20: the Lido stage photo, arms up, the guitarist in front, in the brand's black and white)
    save(grain(grade(load(os.path.join(lido, "416742665_926263899302184_7215614059312349568_n.jpg"), (1600, 900), (0.5, 0.4)), lo=6, hi=230, gamma=1.05, contrast=1.15), .12), "switch.jpg", q=72)
    # problem: the Badehaus 2023 crowd (video still)
    bh23 = os.path.join(G, "Badehaus 2023")
    # (the Problem is now a video: crowd.py, Liam 10-21)
    # the fan at Lido, and the captured-glow example
    save(grain(lens(grade(load(os.path.join(lido, "415052473_926257569302817_8722647996964470191_n.jpeg"), (1600, 1200)), lo=15, hi=215), .2, .5)), "fan-lido.jpg")
    save(grain(grade(load(frame(131), (1600, 1200)), lo=6, hi=235)), "glow-allowed.jpg")
    # the single: the original four-face edit
    save(load(os.path.join(G, "After Heartbreaks/After Heartbreaks cover art design.jpg"), (1600, 1600)), "cover-after-heartbreaks.jpg")
    # posters (dates set in HTML): Lido, Badehaus 2024 (photo Ben), Badehaus 2023 (video still), End of Term 2022
    P = (1200, 1700)
    save(grain(burn(lens(grade(load(os.path.join(lido, "417412541_926263995968841_17596110508459146_n.jpg"), P), lo=22, hi=215), .3, .7), light, (0.5, 0), "t", .45)), "posters/lido.jpg")
    save(grain(burn(lens(grade(load(os.path.join(G, "Badehaus 2024/Ben's pics/2024-02-09 Imris badehaus shoot Colord ex1-OBD00681.jpg"), P), lo=16, hi=215), .3, .72), light, (1, 0.5), "r", .4)), "posters/badehaus-2024.jpg")
    # (Liam 10-20: posters 3 and 4 show the band, not only Liam. Badehaus 2023: the whole band from the steady cam at 11:43,
    # for the framed layout; End of Term: the guitarist mid-solo at Lido, Liam's call to me)
    save(grain(burn(lens(grade(load(frame(703, os.path.join(bh23, "Marni Came steady 1.MP4")), (1200, 1436)), lo=8, hi=225), .32, .8), light, (0.5, 0), "t", .45)), "posters/badehaus-2023.jpg", q=80)
    save(grain(burn(lens(grade(load(os.path.join(lido, "416839192_926264049302169_1082200003046739174_n.jpg"), P, (0.5, 0.4)), lo=14, hi=220), .3, .75), light, (0, 1), "b", .45)), "posters/end-of-term.jpg", q=78)
    # the band site's band: the four of you in 'b&w clothes 2' (Pedro, Sami, Liam, Rikki), and the backstage meet-up before
    # Badehaus 2024 for the moodboard
    save(grain(grade(load(os.path.join(shoot, "b&w clothes 2.jpg"), (2000, 1333)), lo=4, hi=240, gamma=1.08, contrast=1.08), .12), "band/group.jpg", q=80)
    save(grain(grade(load(os.path.join(G, "Badehaus 2024/Pictures from the show/Dopamine videoshoot direction meet up before the show.JPG"), (1300, 867)), lo=6, hi=225), .12), "backstage.jpg", q=74)
    # the Strategy section's references (Liam 10-21): free-licensed Wikimedia Commons photos, credits in sources/refs/credits.json,
    # graded to the brand's black and white (an edit, credited as such)
    for name, c in (("bowie", (0.5, 0.3)), ("cobain", (0.62, 0.45)), ("grohl", (0.42, 0.3))):
        save(grain(grade(load(os.path.join(SRC, "refs", f"{name}.jpg"), (640, 800), c), lo=6, hi=232, gamma=1.05, contrast=1.12), .12), f"refs/{name}.jpg", q=72)
    # Måneskin with their fans (Liam's pick, 10-22; 452 px source, so kept at its own size)
    save(grain(grade(load(os.path.join(SRC, "refs", "maneskin.png"), (452, 565), (0.5, 0.45)), lo=6, hi=232, gamma=1.05, contrast=1.12), .12), "refs/maneskin.jpg", q=80)
    # the USP's picture: Liam handing a beer to someone in the crowd mid-song, Badehaus (Liam 10-25), burned behind him
    import burnfx
    # (Liam picked option F, 10-25: a wide soft wash from the top left, the toast kept readable)
    import random
    im = grade(load(os.path.join(SRC, "cheers-badehaus.jpg"), (1600, 1067), (0.5, 0.45)), lo=6, hi=230, gamma=1.05, contrast=1.12)
    W, H = im.size; rng = random.Random(414); n = rng.choice([2, 2, 3])
    L = Image.new("L", (W, H), 0)
    for k in range(n): L = ImageChops.lighter(L, burnfx.still((W, H), 4140 + k, layers=1, wash=0))
    L = L.filter(ImageFilter.GaussianBlur(rng.uniform(40, 90)))
    keep = Image.new("L", (W, H), 255); ImageDraw.Draw(keep).ellipse((int(W * .28), int(H * .42), int(W * .62), int(H * .82)), fill=110)
    L = ImageChops.multiply(L, keep.filter(ImageFilter.GaussianBlur(120)))
    save(grain(burnfx.apply(im, L), .12).resize((1100, 733), Image.LANCZOS), "cheers.jpg", q=74)
    # the Doubled moodboard: the video's own doubles (timestamps in seconds)
    for i, t in enumerate((117.5, 150.24, 109.5, 21.26, 194.1, 112.24, 191.24, 21.74, 108.24, 116.5)):
        save(load(frame(t)).resize((1600, 900), Image.LANCZOS), f"doubled/{i + 1:02d}.jpg")
    tall = load(frame(110.7)); th = tall.size[1]; tw = int(th * 0.7); tl = int(tall.size[0] * 0.4 - tw / 2)
    save(tall.crop((tl, 0, tl + tw, th)).resize((800, 1143), Image.LANCZOS), "doubled/tall.jpg")
    # the Premiere method on a still: the same frame, screened back larger and offset
    v = grade(load(frame(155), (1600, 1200)), lo=8, hi=225)
    save(grain(doubled(v, v, (0.30, 0.0, 0.62, 0.5), dx=0.06, dy=0.01, scale=1.12, amt=.85, feather=.06)), "doubled/same-frame.jpg")
    # the videos' posters: Liam singing (the music video at 2:44), and Dopamine live at Badehaus graded to the brand (1:31)
    # (Liam 10-21: the video's original thumbnail, the amber scream)
    save(load(os.path.join(SRC, "after-heartbreaks-thumbnail.jpg"), (1600, 900)), "video/after-heartbreaks.jpg", q=84)
    repo = os.path.dirname(os.path.dirname(HERE))
    save(grain(grade(load(frame(91, os.path.join(repo, "public/playground/dopamine.mp4")), (1600, 900)), lo=12, hi=225)), "video/dopamine.jpg")
    # the burned logo: the old PNG master on Blackout with the light from the left
    logo = Image.open(os.path.join(G, "logo/PNG/Marni Came logo.png")).crop((645, 733, 2840, 1751))
    tile = Image.new("RGB", (1600, 1000), BLACK); lw = 1100; l = logo.resize((lw, int(lw * logo.height / logo.width)), Image.LANCZOS)
    tile.paste(Image.new("RGB", l.size, BONE), ((1600 - lw) // 2, (1000 - l.height) // 2), l)
    save(grain(burn(tile, light, (0, 0.5), "l", .85, 1.0), .12), "logo/burned.jpg")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "public/case-studies/marni-came")
