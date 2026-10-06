"""Lift handwriting off photographed sticky notes into clean ink-only RGBA textures.

Finds the yellow note in each photo, straightens it with a perspective warp, removes uneven lighting,
and keeps only the ink as alpha. The ink is later laid onto rendered paper in the Blender scene.

Run with Blender's bundled Python (it has numpy):
  /Applications/Blender.app/Contents/Resources/5.1/python/bin/python3.13 blender/lookdev/extract_ink.py IN.jpg OUT.png
"""

import subprocess
import sys
import zlib
import struct

import numpy as np

SIZE = 1024  # output texture, square like the note


def load_rgb(path):
    # ffmpeg applies the phone's rotation; scale to a fixed width keeping aspect.
    probe = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=1512:-2", "-f", "image2pipe",
                            "-vcodec", "ppm", "-"], capture_output=True, check=True).stdout
    # Parse the PPM header.
    parts = probe.split(b"\n", 3)
    w, h = map(int, parts[1].split())
    data = np.frombuffer(parts[3], dtype=np.uint8)[: w * h * 3]
    return data.reshape(h, w, 3).astype(np.float32) / 255.0


def note_corners(img):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    yellow = (r > 0.55) & (g > 0.45) & (b < 0.45) & (r - b > 0.3)
    ys, xs = np.nonzero(yellow)
    s, d = xs + ys, xs - ys
    tl = (xs[s.argmin()], ys[s.argmin()])
    br = (xs[s.argmax()], ys[s.argmax()])
    tr = (xs[d.argmax()], ys[d.argmax()])
    bl = (xs[d.argmin()], ys[d.argmin()])
    return np.array([tl, tr, br, bl], dtype=np.float64)


def homography(src, dst):
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(a))
    return vt[-1].reshape(3, 3) / vt[-1][-1]


def warp(img, corners):
    # Map each output pixel back into the photo (inverse homography) and sample bilinearly.
    inset = 0.03 * SIZE  # trim the very edge of the note
    dst = np.array([[inset, inset], [SIZE - inset, inset], [SIZE - inset, SIZE - inset], [inset, SIZE - inset]])
    hinv = homography(dst, corners)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    pts = np.stack([xx.ravel(), yy.ravel(), np.ones(SIZE * SIZE)])
    m = hinv @ pts
    sx, sy = m[0] / m[2], m[1] / m[2]
    h, w = img.shape[:2]
    x0 = np.clip(np.floor(sx).astype(int), 0, w - 2)
    y0 = np.clip(np.floor(sy).astype(int), 0, h - 2)
    fx, fy = (sx - x0)[:, None], (sy - y0)[:, None]
    out = (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy)
           + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)
    return out.reshape(SIZE, SIZE, 3)


def max_filter(a, radius):
    out = a.copy()
    for axis in (0, 1):
        acc = out.copy()
        for k in range(1, radius + 1):
            acc = np.maximum(acc, np.roll(out, k, axis))
            acc = np.maximum(acc, np.roll(out, -k, axis))
        out = acc
    return out


def box_blur(a, radius):
    out = a.copy()
    for axis in (0, 1):
        acc = out.copy()
        for k in range(1, radius + 1):
            acc += np.roll(out, k, axis) + np.roll(out, -k, axis)
        out = acc / (2 * radius + 1)
    return out


def ink_alpha(note):
    lum = note @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    # Paper brightness everywhere (ink removed by a max filter), smoothed: this cancels uneven light.
    paper = box_blur(max_filter(lum, 14), 20)
    darkness = np.clip((paper - lum) / np.maximum(paper, 1e-3), 0, 1)
    alpha = np.clip((darkness - 0.12) / 0.33, 0, 1)
    # Drop isolated specks (dust on the photo): keep pixels whose neighbourhood has some ink.
    support = box_blur(alpha, 3)
    alpha[support < 0.12] = 0
    # The note's own edge (and any desk visible past it) is not handwriting: clear a margin all round.
    m = int(0.07 * SIZE)
    alpha[:m, :] = 0; alpha[-m:, :] = 0; alpha[:, :m] = 0; alpha[:, -m:] = 0
    return alpha


def write_png(path, rgba):
    h, w = rgba.shape[:2]
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)


def main(src, dst):
    img = load_rgb(src)
    note = warp(img, note_corners(img))
    alpha = ink_alpha(note)
    rgba = np.zeros((SIZE, SIZE, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 18, 18, 22  # marker ink, near black
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    write_png(dst, rgba)
    print("wrote", dst, "ink coverage", round(float((alpha > 0.5).mean()) * 100, 2), "%")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
