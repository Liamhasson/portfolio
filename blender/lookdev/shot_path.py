"""The shot (spec 2026-10-11-scene-order-design.md §3, §9.1): one forward camera move from the hero's framing to the
laptop's screen, in desk metres (Blender z-up). Pure Python (no bpy): run with any python3.

  frames   0-39   ease   the hero framing easing in 4% toward the ball while it forms
          39-79   tilt   in place, down until the ball has left the frame above and the desk fills it
          79-149  glide  down and forward, low past the note "Who is this product for?" (it reads: Liam, 2026-10-11), the lid
                         opening and the screen waking on the way, to the approved tail's frame 171
         149-188  tail   public/lab/through/camera.json frames 171-210, verbatim (the push into the screen)

  python3 blender/lookdev/shot_path.py            # writes public/lab/shot/camera.json
  python3 blender/lookdev/shot_path.py --check    # and asserts the joins, the direction and the ball leaving the frame
"""
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
THROUGH = os.path.join(ROOT, "public", "lab", "through", "camera.json")
PULLBACK = os.path.join(ROOT, "public", "lab", "pullback", "camera.json")
OUT = os.path.join(ROOT, "public", "lab", "shot", "camera.json")

HERO_POS = (0.0, -0.92, 0.52)        # the hero camera (public/lab/sand/sand.json camera (0, 0.6, 9.5)) in desk metres
HERO_AT = (0.0, 0.03, 0.47)          # its target (0, 0.1, 0)
BALL = (0.0, 0.03, 0.47)             # the ball stays here, above the desk (public/lab/sand/sand.json ball centre (0, 0.1, 0))
BALL_R = 0.11                        # (its radius 1.1: 47% of the hero's height)
EASE_IN = 0.04                       # the ease-in: 4% of the way to the ball
TILT_AT = (0.0, 0.16, 0.0)           # where the tilt ends looking: ~26.5 degrees down, the frame's bottom edge just on the desk's
                                     # front edge (steeper showed the void in front of it), the ball just clear of the top
JOIN = 170                           # the tail's index joined (its frame 171: low enough that the glide can pass the note and
                                     # only ever fall; the lid open, the screen awake)
BEATS = {"ease": (0, 39), "tilt": (39, 79), "glide": (79, 149), "tail": (149, 188)}
LID = (0.6, 1.0)                     # the glide's share over which the lid opens (the tail's own opening, its frames 137-171)
WAKE_K = 154                         # the tail's wake (its frame 155)
NOTE = (0.075, -0.095, 0.0008)       # "Who is this product for?" (lookdev.py sticky_hero), 7.6 cm
NOTE_SIZE = 0.076
BLEND = 15                           # the glide's last frames turn from the look-at to the tail's own orientation


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a): return mul(a, 1.0 / math.sqrt(dot(a, a)))
def lerp(a, b, t): return add(a, mul(sub(b, a), t))
def smoother(t): t = min(max(t, 0.0), 1.0); return t * t * t * (t * (t * 6 - 15) + 10)


def look_quat(pos, at):
    """A Blender camera at `pos` looking at `at`, no roll (it looks down -Z, +Y up): (w, x, y, z)."""
    f = norm(sub(at, pos))
    r = norm(cross(f, (0.0, 0.0, 1.0)))
    u = cross(r, f)
    b = mul(f, -1.0)
    m = ((r[0], u[0], b[0]), (r[1], u[1], b[1]), (r[2], u[2], b[2]))
    tr = m[0][0] + m[1][1] + m[2][2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        return (0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s)
    if m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2
        return ((m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s)
    if m[1][1] > m[2][2]:
        s = math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2
        return ((m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s)
    s = math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2
    return ((m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s)


def slerp(a, b, t):
    d = dot(a, b)
    if d < 0: b, d = mul(b, -1.0), -d
    if d > 0.9995: return norm(lerp(a, b, t))
    th = math.acos(d)
    return norm(add(mul(a, math.sin((1 - t) * th) / math.sin(th)), mul(b, math.sin(t * th) / math.sin(th))))


def rotate(q, v):
    """Rotate v by the unit quaternion q (w, x, y, z)."""
    w, x, y, z = q
    u = (x, y, z)
    t = mul(cross(u, v), 2.0)
    return add(add(v, mul(t, w)), cross(u, t))


def bezier(p0, p1, p2, p3, t):
    a, b, c = lerp(p0, p1, t), lerp(p1, p2, t), lerp(p2, p3, t)
    return lerp(lerp(a, b, t), lerp(b, c, t), t)


def build():
    th = json.load(open(THROUGH))
    tp = th["path"]
    j = tp[JOIN]
    j_pos, j_q, j_lens = tuple(j["position"]), tuple(j["quaternion"]), j["lens_mm"]
    j_fwd = rotate(j_q, (0.0, 0.0, -1.0))
    j_at = add(j_pos, mul(j_fwd, 0.5))
    p1 = lerp(HERO_POS, BALL, EASE_IN)
    frames = []
    for i in range(BEATS["glide"][1] + 1):
        if i <= BEATS["ease"][1]:
            t = smoother(i / BEATS["ease"][1])
            pos, at, lens = lerp(HERO_POS, p1, t), HERO_AT, 45.0
        elif i <= BEATS["tilt"][1]:
            t = smoother((i - BEATS["tilt"][0]) / (BEATS["tilt"][1] - BEATS["tilt"][0]))
            pos, at, lens = p1, lerp(HERO_AT, TILT_AT, t), 45.0
        else:
            t = smoother((i - BEATS["glide"][0]) / (BEATS["glide"][1] - BEATS["glide"][0]))
            # down and forward, low past the note: the height only ever falls (control points between the ends)
            pos = bezier(p1, (0.0, -0.75, 0.40), (0.03, -0.45, 0.34), j_pos, t)
            # the eye: the note at mid-glide, then the laptop (the tail's own line of sight)
            at = lerp(TILT_AT, NOTE, smoother(t / 0.5)) if t < 0.5 else lerp(NOTE, j_at, smoother((t - 0.5) / 0.5))
            lens = 45.0 + 10.0 * smoother(t / 0.5) if t < 0.5 else 55.0 + (j_lens - 55.0) * smoother((t - 0.5) / 0.5)
        q = look_quat(pos, at)
        if i > BEATS["glide"][1] - BLEND:
            q = slerp(q, j_q, smoother((i - (BEATS["glide"][1] - BLEND)) / BLEND))
        # the lid: shut, then the tail's own opening (its frames 137-171) over the glide's last 40%
        lid = 0.0
        if i > BEATS["ease"][1] and i > BEATS["tilt"][1]:
            tg = (i - BEATS["glide"][0]) / (BEATS["glide"][1] - BEATS["glide"][0])
            if tg > LID[0]:
                kf = 136 + (JOIN - 136) * (tg - LID[0]) / (LID[1] - LID[0])
                k0 = min(int(kf), JOIN - 1)
                lid = tp[k0]["lid_open_deg"] + (tp[k0 + 1]["lid_open_deg"] - tp[k0]["lid_open_deg"]) * (kf - k0)
        frames.append({"frame": i + 1, "position": list(pos), "quaternion": list(q), "lens_mm": lens, "sensor_mm": 36,
                       "lid_open_deg": max(lid, 0.0), "focus_m": math.sqrt(dot(sub(at, pos), sub(at, pos)))})
    frames[-1].update(position=list(j_pos), quaternion=list(j_q), lens_mm=j_lens, lid_open_deg=tp[JOIN]["lid_open_deg"])
    for k in range(JOIN + 1, th["frames"]):
        e = tp[k]
        frames.append({"frame": len(frames) + 1, "position": e["position"], "quaternion": e["quaternion"], "lens_mm": e["lens_mm"],
                       "sensor_mm": 36, "lid_open_deg": e["lid_open_deg"], "focus_m": frames[-1]["focus_m"]})
    g0, g1 = BEATS["glide"]
    at_k = lambda k: g0 + (g1 - g0) * (LID[0] + (LID[1] - LID[0]) * (k - 136) / (JOIN - 136))   # tail index -> glide frame
    return {
        "move": "shot", "fps": 24, "frames": len(frames), "units": "metres", "up": "z",
        "chaos_center": th["chaos_center"], "chaos_scale": th["chaos_scale"], "plate_overscan": 1.0,
        "wake_frame": round(at_k(WAKE_K)) + 1, "screen_from": round(at_k(136)),
        "beats": {k: list(v) for k, v in BEATS.items()},
        "lights": json.load(open(PULLBACK))["lights"],
        "path": frames,
    }


def check(d):
    P = d["path"]
    assert d["frames"] == 189 and len(P) == 189, d["frames"]
    assert max(abs(a - b) for a, b in zip(P[0]["position"], HERO_POS)) < 1e-9, "starts on the hero framing"
    th = json.load(open(THROUGH))["path"]
    for i, k in ((149, JOIN), (150, JOIN + 1), (188, 209)):
        assert max(abs(a - b) for a, b in zip(P[i]["position"], th[k]["position"])) < 1e-9, ("joins the tail", i)
    # forward and down: from the tilt on, the camera never climbs or backs away (0.5 cm tolerance: the tail's wobble)
    for i in range(BEATS["tilt"][0], d["frames"] - 1):
        assert P[i + 1]["position"][2] <= P[i]["position"][2] + 0.005, ("climbs", i)
        assert P[i + 1]["position"][1] >= P[i]["position"][1] - 0.005, ("backs away", i)
    # the ball is above the frame's top (16:10, horizontal fit) once the tilt has ended
    q = tuple(P[BEATS["tilt"][1]]["quaternion"]); pos = tuple(P[BEATS["tilt"][1]]["position"])
    inv = (q[0], -q[1], -q[2], -q[3])
    c = rotate(inv, sub(BALL, pos))
    tan_v = 18.0 / P[BEATS["tilt"][1]]["lens_mm"] / 1.6
    assert c[1] / -c[2] - BALL_R / math.sqrt(dot(c, c)) > tan_v, "the ball still in frame after the tilt"
    # and the frame's bottom edge lands on the desk (y >= -0.3), not the void in front of it
    bot = rotate(q, norm((0.0, -tan_v, -1.0)))
    t_hit = -pos[2] / bot[2]
    assert bot[2] < 0 and pos[1] + bot[1] * t_hit >= -0.3, ("the void below the desk's front edge in frame", pos[1] + bot[1] * t_hit)
    # the note reads on the way past (Liam, 2026-10-11): "Who is this product for?" fills a quarter of the frame's height
    # somewhere in the glide, well inside the frame (its central 60%)
    best = 0.0
    for i in range(d["beats"]["glide"][0], d["beats"]["glide"][1] + 1):
        q, pos = tuple(P[i]["quaternion"]), tuple(P[i]["position"])
        c = rotate((q[0], -q[1], -q[2], -q[3]), sub(NOTE, pos))
        if c[2] >= 0:
            continue
        tv = 18.0 / P[i]["lens_mm"] / 1.6
        if abs(c[0] / -c[2]) < tv * 1.6 * 0.6 and abs(c[1] / -c[2]) < tv * 0.6:
            best = max(best, NOTE_SIZE / -c[2] / (2 * tv))
    assert best >= 0.25, ("the note too small to read on the way past", round(best, 3))
    print("shot ok:", d["frames"], "frames; wake", d["wake_frame"], "; screen from", d["screen_from"])


if __name__ == "__main__":
    d = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(d, open(OUT, "w"))
    print("WROTE", OUT)
    if "--check" in sys.argv:
        check(d)
