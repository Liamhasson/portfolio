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

# the hero: Drop Dead live at Lido, the solo then the drummer's view, black and white with a burn that keeps moving (lido.py);
# the MP4 at CRF 31 keeps the grain under 2 MB
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
python3 tools/marni-came/lido.py "$tmp/hero"
scripts/encode-video.sh "$tmp/hero.mp4" "$OUT/video/hero-lido" 1440 1.5
n="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$tmp/hero.mp4")"
ffmpeg -v error -y -i "$tmp/hero.mp4" -c:v libx264 -crf 31 -preset slow -profile:v high -g "$n" -keyint_min "$n" -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "$OUT/video/hero-lido.mp4"

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
