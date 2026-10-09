#!/usr/bin/env bash
# Renders the settle backplate (48 frames, resuming after a crash), then the calibration target with the ball at the end.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
for t in 1 2 3 4 5; do
  SETTLE_PLATE=1 caffeinate -i $B --background --python lookdev.py -- --scene settle --out renders > renders/settle-plate.log 2>&1
  n=$(ls renders/settle-plate/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "plate try $t: $n frames"; [ "$n" -ge 48 ] && break
done
for t in 1 2 3; do
  SETTLE_FRAME=48 caffeinate -i $B --background --python lookdev.py -- --scene settle --out renders/targets/settle > renders/settle-target.log 2>&1
  [ -f renders/targets/settle/settle/f_0048.png ] && break
done
echo "target done"
