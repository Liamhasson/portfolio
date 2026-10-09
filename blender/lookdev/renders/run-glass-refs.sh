#!/usr/bin/env bash
# 2.3 references for the live glass: the finished glass at the arrival view (descend frame 100), hovering and landed,
# sharp (no depth of field), each retried after Blender's occasional silent crash. Writes renders/glass-ref-<z>/f_0100.png
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
for z in 0.15 0.0705; do
  for t in 1 2 3; do
    DESCEND_BALL=glass BALL1_Z=$z NO_DOF=1 MOVE_FRAME=100 MOVE_NAME=glass-ref-$z caffeinate -i $B --background --python lookdev.py -- --scene deskmove --move descend --out renders > renders/glass-ref-$z.log 2>&1
    [ -f renders/glass-ref-$z/f_0100.png ] && break
    echo "retry $z $t"
  done
  echo "rendered $z"
done
