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

# the loops, graded with the burn cut from real film-burn footage (lido.py, burnfx.py; Liam 10-22). New names whenever they
# change: /case-studies and /work are cached for a day. The MP4s at CRF 31 keep the grain under 2 MB.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
loop() {   # clip, out, width, poster second
  python3 tools/marni-came/lido.py "$1" "$tmp/$1"
  scripts/encode-video.sh "$tmp/$1.mp4" "$2" "$3" "$4"
  n="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$tmp/$1.mp4")"
  ffmpeg -v error -y -i "$tmp/$1.mp4" -c:v libx264 -crf 31 -preset slow -profile:v high -g "$n" -keyint_min "$n" -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "$2.mp4"
}
loop hero "$OUT/video/hero-burn" 1440 1.5
loop crowd "$OUT/video/problem-burn" 864 4.5
# the home page's card: the Lido solo peak (H.264 only, like the other cards)
python3 tools/marni-came/lido.py card "$tmp/card"
ffmpeg -v error -y -i "$tmp/card.mp4" -c:v libx264 -profile:v high -pix_fmt yuv420p -b:v 700k -maxrate 950k -bufsize 1900k -preset slow -movflags +faststart -an public/work/marni-came-lido.mp4
ffmpeg -v error -y -ss 2.6 -i public/work/marni-came-lido.mp4 -frames:v 1 -q:v 3 public/work/marni-came-lido.jpg

# the burn on its own, over the band site's hero (960 × 540); and the shapes for the burn along the study's edges
python3 - "$OUT/video" <<'PY'
import sys, subprocess; sys.path.insert(0, "tools/marni-came")
import burnfx
for name, size, seed, density in (("burn-loop", (960, 540), 59, 0.75),):
    L = burnfx.track(12, 25, size, seed, density)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}", "-r", "25", "-i", "-",
                            "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", f"{sys.argv[1]}/{name}.mp4"], stdin=subprocess.PIPE)
    for f in L: enc.stdin.write(burnfx.colour(f).tobytes())
    enc.stdin.close(); enc.wait()
PY
python3 tools/marni-came/burn_edges.py "$OUT/video/burn-edges.png"

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
# how loud each moment is and where it hits, for the burn along the edges
python3 tools/marni-came/energy.py "$OUT/audio/after-heartbreaks.m4a" "$OUT/audio/after-heartbreaks.energy.json"
python3 tools/marni-came/energy.py "$OUT/audio/dopamine.m4a" "$OUT/audio/dopamine.energy.json"
python3 tools/marni-came/energy.py public/playground/youll-be-you.m4a "$OUT/audio/youll-be-you.energy.json"
echo "done: $(du -sh "$OUT" | cut -f1)"
