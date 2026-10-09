#!/usr/bin/env bash
# Pull-back plates for the site: PNG (Blender) -> JPEG in public/lab/pullback, plus the camera path.
set -euo pipefail
src=blender/lookdev/renders/pullback-plate
dst=public/lab/pullback
mkdir -p "$dst"
cp blender/lookdev/renders/pullback-camera.json "$dst/camera.json"
for f in "$src"/f_*.png; do
  out="$dst/$(basename "${f%.png}").jpg"
  [ -f "$out" ] && [ "$out" -nt "$f" ] && continue
  ffmpeg -v error -y -i "$f" -q:v 3 "$out"
done
ls "$dst" | wc -l
du -sh "$dst"
