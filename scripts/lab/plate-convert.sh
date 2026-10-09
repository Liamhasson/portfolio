#!/usr/bin/env bash
# Backplates for the site: PNG (Blender) -> JPEG in public/lab/<move>, plus the camera path.
#   scripts/lab/plate-convert.sh [pullback|settle]
set -euo pipefail
move=${1:-pullback}
src=blender/lookdev/renders/$move-plate
dst=public/lab/$move
mkdir -p "$dst"
cp "blender/lookdev/renders/$move-camera.json" "$dst/camera.json"
for f in "$src"/f_*.png; do
  out="$dst/$(basename "${f%.png}").jpg"
  [ -f "$out" ] && [ "$out" -nt "$f" ] && continue
  ffmpeg -v error -y -i "$f" -q:v 3 "$out"
done
ls "$dst" | wc -l
du -sh "$dst"
