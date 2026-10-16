#!/usr/bin/env bash
# The About page's pendant, published for the web: Blender's --web build of blender/amulet/amulet.py (about 3 minutes: it
# bakes ambient occlusion and the brass to maps), then the five files in public/about/pendant:
#   pendant.glb       one mesh, no materials, positions + normals + UV0 (meshopt-compressed by gltfpack)
#   pendant-wire.glb  about 5k triangles, positions only, the same frame (Y-up, 1 unit tall, feet at y 0, axis at x = z = 0)
#   color.ktx2        sRGB ETC1S with mips (GPU-compressed: a JPEG would sit in memory at 16 MB on a phone)
#   normal.jpg        tangent space, OpenGL convention (as Blender bakes it); ffmpeg keeps it 4:4:4
#   rough.jpg         roughness in G (glTF's convention; Blender bakes it into R, G and B alike), 1024 x 1024 (the others 2048)
# Needs Blender (env BLENDER), KTX-Software's `ktx` (env KTX; ~/.local/bin/ktx), ffmpeg, and gltfpack (via npx).
# The non-head decimation ratio is 0.22 (the plan's 0.35 came to 2.65 MB; 2.5 MB is the budget, and the heads are never touched):
#   PENDANT_RATIO=0.3 bash scripts/about/pendant-publish.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
KTX="${KTX:-ktx}"
dst=public/about/pendant
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$dst"

# 1. Blender: the heads kept whole, everything else decimated; the three maps at 2048
"$BLENDER" --background --python blender/amulet/amulet.py -- --web "$tmp" --ratio "${PENDANT_RATIO:-0.22}"

# 2. the model: Blender already simplified it (no -si); -kv keeps the UVs on a mesh with no material, as desk3d-publish.py does;
#    -vtf keeps them as floats: with no material to carry gltfpack's UV scale (KHR_texture_transform), its default 16-bit UVs
#    come out all zero (every texel would read the map's corner). Costs about 0.2 MB.
npx gltfpack -i "$tmp/pendant.glb" -o "$dst/pendant.glb" -cc -kv -vtf
cp "$tmp/pendant-wire.glb" "$dst/pendant-wire.glb"

# 3. the colour as GPU-compressed KTX2 (Blender's PNG has an alpha channel: the format wants plain RGB)
ffmpeg -v error -y -i "$tmp/color.png" -pix_fmt rgb24 "$tmp/color-rgb.png"
"$KTX" create --format R8G8B8_SRGB --assign-tf srgb --encode basis-lz --clevel 2 --qlevel 255 --generate-mipmap \
  "$tmp/color-rgb.png" "$dst/color.ktx2"

# 4. the normal and roughness maps as JPEG
ffmpeg -v error -y -i "$tmp/normal.png" -q:v 2 "$dst/normal.jpg"
# (the roughness is a smooth, low-frequency map: half size, 1024, keeps the five under the 2.5 MB budget; the others stay 2048)
ffmpeg -v error -y -i "$tmp/rough.png" -vf scale=1024:1024:flags=lanczos -q:v 3 "$dst/rough.jpg"

# 5. the budget: 2.5 MB (2,500,000 bytes) for the five
ls -l "$dst" | awk 'NR>1 {printf "%9d  %s\n", $5, $9}'
total=$(cat "$dst"/{pendant.glb,pendant-wire.glb,color.ktx2,normal.jpg,rough.jpg} | wc -c | tr -d ' ')
echo "total $total bytes ($(awk -v t="$total" 'BEGIN {printf "%.2f", t/1048576}') MiB)"
