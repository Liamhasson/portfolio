#!/usr/bin/env bash
# Every Marni Came asset the case study and the band site serve, rebuilt from the archive (spec §6, plan Task 2).
# Usage: tools/marni-came/build-assets.sh   (MC_ARCHIVE and MC_VIDEO override the default source paths)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=public/case-studies/marni-came
ARCHIVE="${MC_ARCHIVE:-$HOME/Documents/Marni Came}"
VIDEO="${MC_VIDEO:-$HOME/Downloads/Marni Came - After Heartbreaks (Official music video).mp4}"
mkdir -p "$OUT"/{logo,audio,video}

# stills
python3 tools/marni-came/treat.py "$OUT"

# the wordmark: the vectors from the board, plus bone and blackout copies for <img> use
for v in wordmark wordmark-distressed; do
  cp "docs/prototypes/marni-came-mockups/logo/marni-came-$v.svg" "$OUT/logo/$v.svg"
  sed 's/fill="currentColor"/fill="#EEEAE2"/' "$OUT/logo/$v.svg" > "$OUT/logo/$v-bone.svg"
  sed 's/fill="currentColor"/fill="#0A0908"/' "$OUT/logo/$v.svg" > "$OUT/logo/$v-black.svg"
done

# the hero: Dopamine live at Badehaus (84–92.6 s), graded black and white, the video's amber light breathing in from the left
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
python3 - "$tmp" "$OUT/burn-light.jpg" <<'PY'
import sys, math
from PIL import Image, ImageFilter
tmp, light = sys.argv[1:]
b = Image.open(light).convert("RGB").resize((1440, 810)).filter(ImageFilter.GaussianBlur(18))
for i in range(215):
    t = i / 215; reach = 0.34 + 0.24 * (0.5 - 0.5 * math.cos(2 * math.pi * t))
    m = Image.new("L", (256, 1)); m.putdata([int(255 * max(0, 1 - (x / 255) / reach) ** 2.2) for x in range(256)])
    Image.composite(b, Image.new("RGB", b.size), m.resize(b.size, Image.BILINEAR)).save(f"{tmp}/b{i:03d}.png")
PY
ffmpeg -v error -y -ss 84 -t 8.6 -i public/playground/dopamine.mp4 -framerate 25 -i "$tmp/b%03d.png" -filter_complex \
  "[0:v]scale=1440:810,fps=25,hue=s=0,curves=all='0/0 0.07/0 0.5/0.46 0.9/0.96 1/1',colorchannelmixer=rr=1.0:gg=0.985:bb=0.955,noise=alls=10:allf=t,format=gbrp[bs];[1:v]format=gbrp[b];[bs][b]blend=all_mode=screen,format=yuv420p" \
  -an -c:v libx264 -crf 14 -preset slow "$tmp/hero.mp4"
scripts/encode-video.sh "$tmp/hero.mp4" "$OUT/video/hero-badehaus" 1440 0.6

# release week: the After Heartbreaks loop, and the full video for the lightbox (the Dopamine live video is the playground's)
scripts/encode-video.sh public/playground/after-heartbreaks-loop.mp4 "$OUT/video/release-loop" 1280 3.0
# two-pass at 1150 kbps keeps the 3:38 video near 35 MB, in line with the playground's Dopamine video
(cd "$tmp" && ffmpeg -v error -y -i "$VIDEO" -map 0:v:0 -vf "scale=-2:1080" -c:v libx264 -b:v 1150k -preset slow -pass 1 -an -f mp4 /dev/null \
  && ffmpeg -v error -y -i "$VIDEO" -map 0:v:0 -map 0:a:0 -vf "scale=-2:1080" -c:v libx264 -b:v 1150k -preset slow -pass 2 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart ah.mp4)
mv "$tmp/ah.mp4" "$OUT/video/after-heartbreaks.mp4"

# the masters, AAC 128 kbps, with their waveforms (You'll Be You is the playground's)
ffmpeg -v error -y -i "$ARCHIVE/Masters/Marni Came - After Heartbreaks.wav" -c:a aac -b:a 128k -movflags +faststart "$OUT/audio/after-heartbreaks.m4a"
ffmpeg -v error -y -i "$ARCHIVE/Masters/Marni Came - Dopamine.wav" -c:a aac -b:a 128k -movflags +faststart "$OUT/audio/dopamine.m4a"
python3 tools/marni-came/peaks.py "$OUT/audio/after-heartbreaks.m4a" "$OUT/audio/after-heartbreaks.peaks.json"
python3 tools/marni-came/peaks.py "$OUT/audio/dopamine.m4a" "$OUT/audio/dopamine.peaks.json"
echo "done: $(du -sh "$OUT" | cut -f1)"
