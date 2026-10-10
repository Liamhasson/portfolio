#!/usr/bin/env bash
# The cloud move (2.3, sand only) review clip, full grain counts (210 frames, 960x600), resuming after Blender's occasional silent crash.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
rm -rf renders/deskmove-cloud
for t in 1 2 3 4 5 6; do
  LOOKDEV_REVIEW=1 caffeinate -i $B --background --python lookdev.py -- --scene deskmove --move cloud --out renders > renders/deskmove-cloud.log 2>&1
  n=$(ls renders/deskmove-cloud/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "try $t: $n frames"; [ "$n" -ge 210 ] && break
done
ffmpeg -v error -y -framerate 24 -i renders/deskmove-cloud/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 renders/deskmove-cloud-review.mp4 && echo "WROTE review"
