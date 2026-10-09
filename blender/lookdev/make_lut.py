"""Blender's exact view transform (AgX, look Punchy) as a 3D lookup table for the browser.
Input per channel x in [0,1] is AgX's log2 encoding of scene-linear light: c = 2^(MIN + x * (MAX - MIN)),
MIN = log2(2^-10 * 0.18), MAX = log2(2^6.5 * 0.18). Output: display sRGB. Writes N x N*N uint8 RGB (r fastest, then g,
then b slices) to public/lab/desk3d/agx-punchy-64.bin.
  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/make_lut.py"""
import bpy, numpy as np, os, subprocess, tempfile
N = 64
MIN, MAX = np.log2(2.0 ** -10 * 0.18), np.log2(2.0 ** 6.5 * 0.18)
x = np.linspace(0, 1, N)
c = 2.0 ** (MIN + x * (MAX - MIN))
r, g, b = np.meshgrid(c, c, c, indexing="ij")          # r[i,j,k] = c[i] etc.
# image: width N*N (b major blocks of r), height N (g rows)
img = np.zeros((N, N * N, 4), np.float32)
for k in range(N):
    img[:, k * N:(k + 1) * N, 0] = r[:, :, k].T    # rows = g index, cols = r index
    img[:, k * N:(k + 1) * N, 1] = g[:, :, k].T
    img[:, k * N:(k + 1) * N, 2] = b[:, :, k].T
img[..., 3] = 1
scene = bpy.context.scene
scene.view_settings.view_transform = "AgX"
for look in ("AgX - Punchy", "Punchy"):
    try:
        scene.view_settings.look = look; break
    except TypeError:
        pass
scene.view_settings.exposure = 0; scene.view_settings.gamma = 1
im = bpy.data.images.new("lut", N * N, N, float_buffer=True)
im.pixels.foreach_set(img[::-1].ravel())    # Blender images are bottom-up
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_depth = "16"; scene.render.image_settings.color_mode = "RGB"
tmp = os.path.join(tempfile.gettempdir(), "agx_lut.png")
im.save_render(tmp, scene=scene)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", tmp, "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"], capture_output=True, check=True).stdout
out = np.frombuffer(raw, np.uint16).reshape(N, N * N, 3).astype(np.float64) / 65535   # top-down, display sRGB
lut = np.zeros((N, N, N, 3), np.uint8)   # [b][g][r]
for k in range(N):
    lut[k] = np.round(out[:, k * N:(k + 1) * N] * 255).astype(np.uint8)   # [g][r]
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "lab", "desk3d", "agx-punchy-64.bin")
lut.tofile(dst)
print("LUT", scene.view_settings.look, lut.shape, "mid grey ->", lut[N // 2, N // 2, N // 2], "white(1.0) idx", np.searchsorted(c, 1.0))
