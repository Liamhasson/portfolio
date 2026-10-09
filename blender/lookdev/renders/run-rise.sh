#!/usr/bin/env bash
# The rise backplate (60 frames, resuming after a crash), then its ray-traced depth.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
start=$(date +%s)
for t in 1 2 3 4 5; do
  DESKMOVE_PLATE=1 caffeinate -i $B --background --python lookdev.py -- --scene deskmove --move rise --out renders > renders/rise-plate.log 2>&1
  n=$(ls renders/rise-plate/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "plate try $t: $n frames"; [ "$n" -ge 60 ] && break
done
echo "plate seconds: $(( $(date +%s) - start ))"
$B --background --python lookdev.py -- --scene raygrid --move-name rise --out renders 2>&1 | grep -E "WROTE|Traceback"
