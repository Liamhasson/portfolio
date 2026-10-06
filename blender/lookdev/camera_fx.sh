#!/usr/bin/env bash
# Camera realism applied after rendering: gentle highlight bloom, slight chromatic aberration at the edges,
# lens vignette and fine film grain. Usage: blender/lookdev/camera_fx.sh in.png out.jpg
set -euo pipefail
ffmpeg -v error -y -i "$1" -filter_complex "\
[0:v]format=gbrp,split=2[base][hi];\
[hi]curves=all='0/0 0.72/0 1/1',gblur=sigma=26[bloom];\
[base][bloom]blend=all_mode=screen:all_opacity=0.35[b1];\
[b1]rgbashift=rh=-1:bh=1[ca];\
[ca]vignette=angle=PI/4.6:mode=forward,noise=alls=5:allf=t,format=yuv444p" -q:v 2 "$2"
