#!/usr/bin/env bash
# The through move's review clip (170 frames, 960x600), resuming after Blender's occasional silent crash.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
rm -rf renders/deskmove-through-preview
for t in 1 2 3 4 5 6; do
  LOOKDEV_REVIEW=1 caffeinate -i $B --background --python lookdev.py -- --scene deskmove --move through --out renders --preview > renders/deskmove-through.log 2>&1
  n=$(ls renders/deskmove-through-preview/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "try $t: $n frames"; [ "$n" -ge 170 ] && break
done
ffmpeg -v error -y -framerate 24 -i renders/deskmove-through-preview/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 renders/deskmove-through-review.mp4 && echo "WROTE review"
