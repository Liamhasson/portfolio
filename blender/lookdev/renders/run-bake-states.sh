#!/usr/bin/env bash
# The 3D desk in its three lighting states (shut, open, lit), each retried after Blender's occasional silent crash.
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
for st in shut open lit; do
  for t in 1 2 3; do
    BAKE_STATE=$st BAKE_SAMPLES=${BAKE_SAMPLES:-256} BAKE_SCALE=${BAKE_SCALE:-1} caffeinate -i $B --background --python lookdev.py -- --scene bakedesk --out renders > renders/bake-$st.log 2>&1
    grep -q "^WROTE" renders/bake-$st.log && break
    echo "retry $st $t"
  done
  echo "baked $st"
done
