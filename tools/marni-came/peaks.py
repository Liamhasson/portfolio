"""A track's waveform for the site's players, in the playground's format: {"duration": s, "peaks": [160 values 0..1]}.
Usage: python3 tools/marni-came/peaks.py <audio> <out.json>"""
import json, subprocess, sys, array

def peaks(path, n=160):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], check=True, capture_output=True).stdout
    s = array.array("h", raw)
    dur = len(s) / 8000
    step = max(1, len(s) // n)
    vals = [max((abs(x) for x in s[i * step:(i + 1) * step]), default=0) for i in range(n)]
    top = max(vals) or 1
    return {"duration": round(dur, 2), "peaks": [round(v / top, 3) for v in vals]}

if __name__ == "__main__":
    json.dump(peaks(sys.argv[1]), open(sys.argv[2], "w"))
