#!/usr/bin/env bash
# Capture every state for each look and print live-vs-render numbers. Usage: scripts/lab/sweep.sh 'LOOK1;LOOK2' [states]
set -euo pipefail
PY=/Applications/Blender.app/Contents/Resources/5.1/python/bin/python3.13
states=${2:-ball,chaos,mid}
IFS=';' read -ra looks <<< "$1"
for i in "${!looks[@]}"; do
  node scripts/lab/capture-sand.mjs http://localhost:3100 "$states" test-results/sand "${looks[$i]}" > /dev/null
  echo "== $i ${looks[$i]}"
  for t in ${states//,/ }; do
    if [ "$t" = ball ]; then crop="540 230 520 520"; else crop="0 0 1600 1000"; fi
    $PY -I scripts/lab/compare_sand.py test-results/sand/live-$t.png public/lab/sand/targets/$t.jpg test-results/sand/cmp-$t-$i.png $crop | python3 -c "
import json,sys; d=json.load(sys.stdin)
for k in ('live','render'):
  if k=='render' and '$i'!='0': continue
  s=d[k]; r=s['mean_rgb']; print('$t'.ljust(6), k.ljust(6), 'cov %.3f'%s['coverage'],'G/R %.3f B/R %.3f'%(r[1]/r[0],r[2]/r[0]),'p10 %.3f p50 %.3f p90 %.3f'%(s['p10'],s['p50'],s['p90']),'grain %.3f struct %.3f'%(s['grain_contrast'],s['structure_contrast']), ('LIGHT ' + ' '.join('%.2f'%v for v in d['light_ratio_rgb'])) if k=='live' else '')"
  done
done
