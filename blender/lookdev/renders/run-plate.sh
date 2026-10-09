#!/usr/bin/env bash
# Renders the pull-back backplate (60 frames), resuming after a crash; then the calibration targets with sand.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
for t in 1 2 3 4 5; do
  PULLBACK_PLATE=1 caffeinate -i $B --background --python lookdev.py -- --scene pullback --out renders > renders/pullback-plate.log 2>&1
  n=$(ls renders/pullback-plate/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "plate try $t: $n frames"; [ "$n" -ge 60 ] && break
done
for f in 30 60; do
  for t in 1 2 3; do
    PULLBACK_FRAME=$f caffeinate -i $B --background --python lookdev.py -- --scene pullback --out renders/targets/pb > renders/pb-target.log 2>&1
    [ -f renders/targets/pb/pullback/f_$(printf %04d $f).png ] && break
  done
  echo "target $f"
done
