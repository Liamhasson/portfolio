#!/usr/bin/env bash
# The baked desk for the site: geometry, per-surface maps (as JPEG), probes, metadata (renders/bake -> public/lab/desk3d).
set -euo pipefail
src=blender/lookdev/renders/bake; dst=public/lab/desk3d
mkdir -p "$dst"
find "$dst" -name "bake_*" -delete
cp "$src/desk.glb" "$src/probe.exr" "$src/probe_lit.exr" "$dst/"
for f in "$src"/bake_*.diff.png "$src"/bake_*.rough.png "$src"/bake_*.normal.png; do
  [ -f "$f" ] || continue
  q=3; case "$f" in *.normal.png) q=2;; esac
  ffmpeg -v error -y -i "$f" -q:v $q "$dst/$(basename "${f%.png}").jpg"
done
python3 - "$src/desk.json" "$dst/desk.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for m in d["materials"].values():
    for k in ("diff", "rough", "normal"):
        if k in m: m[k] = m[k].replace(".png", ".jpg")
json.dump(d, open(sys.argv[2], "w"))
PY
du -sh "$dst"
