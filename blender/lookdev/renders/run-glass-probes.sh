#!/usr/bin/env bash
# 2.3: what the glass sees, from where it is: 360 probes at the hover and the landed centres (descend frame 100: the
# lid open, the screen lit, the side fill up), retried after Blender's occasional silent crash.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
for z in 0.15 0.0705; do
  for t in 1 2 3; do
    DESCEND_BALL=glass BALL1_Z=$z MOVE_FRAME=100 PROBE_AT=0.47,-0.14,$z PROBE_NAME=glass-probe-$z caffeinate -i $B --background --python lookdev.py -- --scene deskmove --move descend --out renders > renders/glass-probe-$z.log 2>&1
    [ -f renders/glass-probe-$z.exr ] && break
    echo "retry $z $t"
  done
  echo "probe $z"
done
