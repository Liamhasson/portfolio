"""How loud each track is, and the shape of its waveform, for the case study's audio button (Liam, 2026-10-26: a round
button like lusion.co's, its fill in the burn colours following the loudness, its line drawing the track's waveform).

Measured once here rather than live in the browser: routing the page's <audio> through Web Audio can leave it silent
on some phones, so the page reads these numbers at the song's current time instead.

    level   the loudness, 0..1 within the track's own range (10th to 99th percentile of its frames), 20 a second
    hit     how sharply it rises at that moment (bass and full band), 0..1, 20 a second
    wave    the waveform's height, 100 a second: the RMS of each 10 ms over the track's loudest moments (99.9th
            percentile), not its peaks, which a loud mix clips flat

Each is written as base64 letters (0..63): a four-minute track is two strings of ~4,800 letters and one of ~24,000.
`python3 tools/marni-came/energy.py <audio> <out.json>`
"""
import array, json, math, subprocess, sys

FPS, RATE = 20, 11025
B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


WAVE_FPS = 100


def rms(src, filt=None, fps=FPS):
    vf = ["-af", filt] if filt else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, *vf, "-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    s = array.array("h"); s.frombytes(raw)
    n = RATE // fps
    return [math.sqrt(sum(v * v for v in s[i:i + n]) / n) for i in range(0, len(s) - n + 1, n)]


def pct(xs, p):
    ys = sorted(xs); return ys[min(len(ys) - 1, int(p * len(ys)))]


def level(r):
    db = [20 * math.log10(max(v, 1)) for v in r]
    lo, hi = pct(db, .10), pct(db, .99)
    out = [min(1, max(0, (d - lo) / max(1e-6, hi - lo))) for d in db]
    return [sum(out[max(0, i - 1):i + 2]) / len(out[max(0, i - 1):i + 2]) for i in range(len(out))]   # (a touch of smoothing)


def flux(r, back=8):
    f = [max(0, r[i] - sum(r[max(0, i - back):i]) / max(1, min(back, i))) if i else 0 for i in range(len(r))]
    top = pct(f, .985) or 1
    return [min(1, v / top) for v in f]


def enc(xs): return "".join(B64[min(63, int(round(v * 63)))] for v in xs)


if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    full, low = rms(src), rms(src, "lowpass=f=180")
    n = min(len(full), len(low))
    hit = [max(a, .8 * b) for a, b in zip(flux(low[:n]), flux(full[:n]))]
    w = rms(src, fps=WAVE_FPS); top = pct(w, .999) or 1
    wave = [min(1, v / top) for v in w]
    json.dump({"fps": FPS, "level": enc(level(full[:n])), "hit": enc(hit), "waveFps": WAVE_FPS, "wave": enc(wave)}, open(out, "w"), separators=(",", ":"))
    print(out, n, "frames", f"{n / FPS:.1f}s")
