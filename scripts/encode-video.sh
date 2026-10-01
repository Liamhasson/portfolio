#!/usr/bin/env bash
# Encode a source clip into the site's web formats (AV1/WebM, H.264/MP4, JPEG poster).
# Usage: scripts/encode-video.sh <input> <output-path-without-extension> [max-width=1440] [poster-second=0] [drop-last-frames=0]
#   drop-last-frames: trim this many frames off the end (for loops whose last frame duplicates frame 0).
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: scripts/encode-video.sh <input> <output-path-without-extension> [max-width=1440] [poster-second=0] [drop-last-frames=0]" >&2
  exit 1
fi

in="$1"
out="$2"
width="${3:-1440}"
poster_at="${4:-0}"
drop="${5:-0}"

if [[ ! -f "$in" ]]; then
  echo "error: input file not found: $in" >&2
  exit 1
fi
if ! [[ "$width" =~ ^[0-9]+$ ]] || [[ "$width" -lt 1 ]]; then
  echo "error: max-width must be a positive integer, got: $width" >&2
  exit 1
fi
if ! [[ "$drop" =~ ^[0-9]+$ ]]; then
  echo "error: drop-last-frames must be a non-negative integer, got: $drop" >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found on PATH" >&2
  exit 1
fi
if ! ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libsvtav1; then
  echo "error: ffmpeg lacks libsvtav1" >&2
  exit 1
fi

scale="scale='min(${width},iw)':-2"

if [[ "$drop" -gt 0 ]]; then
  total="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$in")"
  frames=$((total - drop))
  vf="trim=end_frame=${frames},setpts=PTS-STARTPTS,${scale}"
else
  frames="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$in")"
  vf="$scale"
fi

mkdir -p "$(dirname "$out")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

ffmpeg -v error -y -i "$in" -vf "$vf" -c:v libsvtav1 -crf 40 -preset 4 -g "$frames" -pix_fmt yuv420p -cues_to_front 1 -an "$tmp/out.webm"
ffmpeg -v error -y -i "$in" -vf "$vf" -c:v libx264 -crf 28 -preset slow -profile:v high -g "$frames" -keyint_min "$frames" -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "$tmp/out.mp4"
ffmpeg -v error -y -ss "$poster_at" -i "$in" -frames:v 1 -vf "$scale" -q:v 3 "$tmp/out.jpg"

mv "$tmp/out.webm" "${out}.webm"
mv "$tmp/out.mp4" "${out}.mp4"
mv "$tmp/out.jpg" "${out}.jpg"

ls -lh "${out}".webm "${out}".mp4 "${out}".jpg
