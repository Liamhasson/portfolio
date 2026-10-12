"""The laptop screen's still (public/lab/desk3d/screen.jpg) with the index's current card posters pasted into each card's
media box (src/three/sand/screen-reveal.json), so the still a card shows before its loop has a frame is the loop's own
first picture (Liam, 2026-10-12: the still kept the old Cyvore crop after the new full-screen recording). Run by
desk3d-publish.py after it writes screen.jpg.
  python3 scripts/lab/desk3d-screen-posters.py"""
import json, os, subprocess, tempfile
SCREEN = "public/lab/desk3d/screen.jpg"
reveal = json.load(open("src/three/sand/screen-reveal.json"))
W, H = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                "-of", "csv=p=0", SCREEN], capture_output=True, text=True, check=True).stdout.strip().split(","))
inputs, chain, last = ["-i", SCREEN], [], "0:v"
for m in reveal["media"]:
    if not m["src"]:
        continue
    poster = "public" + m["src"].rsplit(".", 1)[0] + ".jpg"
    x0, y0, x1, y1 = m["box"]
    if y1 > 1:
        continue   # (below the screen's fold: not in the still)
    k = len(inputs) // 2
    inputs += ["-i", poster]
    w, h = round((x1 - x0) * W), round((y1 - y0) * H)
    chain.append(f"[{k}:v]scale={w}:{h}:flags=lanczos[p{k}];[{last}][p{k}]overlay={round(x0 * W)}:{round(y0 * H)}[o{k}]")
    last = f"o{k}"
with tempfile.TemporaryDirectory() as t:
    out = os.path.join(t, "screen.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", f"[{last}]", "-q:v", "2", out], check=True)
    os.replace(out, SCREEN)
print("screen still: posters pasted for", len(chain), "cards")
