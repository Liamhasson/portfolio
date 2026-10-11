"""The shot (spec 2026-10-11-scene-order-design.md §3, §9.1): one forward camera move from the hero's framing to the
laptop's screen, in desk metres (Blender z-up). Pure Python (no bpy): run with any python3.

  frames   0-39   ease   the hero framing easing in 4% toward the ball while it forms
          39-79   tilt   in place, down until the ball has left the frame above and the desk fills it
          79-188  glide + tail: one smooth movement straight into the screen (Liam, 2026-10-12: no turn to the sticky note),
                         eased once over the whole scroll from the desk to the screen; the lid opens and the screen wakes
                         on the way; it lands on the approved last frame (shot-src/through-camera.json frame 210)

  python3 blender/lookdev/shot_path.py            # writes public/lab/shot/camera.json
  python3 blender/lookdev/shot_path.py --check    # and asserts the joins, the direction and the ball leaving the frame
"""
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
THROUGH = os.path.join(ROOT, "blender", "lookdev", "shot-src", "through-camera.json")
PULLBACK = os.path.join(ROOT, "blender", "lookdev", "shot-src", "pullback-camera.json")
OUT = os.path.join(ROOT, "public", "lab", "shot", "camera.json")

HERO_POS = (0.0, -0.92, 0.52)        # the hero camera (public/lab/sand/sand.json camera (0, 0.6, 9.5)) in desk metres
HERO_AT = (0.0, 0.03, 0.47)          # its target (0, 0.1, 0)
BALL = (0.0, 0.03, 0.47)             # the ball stays here, above the desk (public/lab/sand/sand.json ball centre (0, 0.1, 0))
BALL_R = 0.11                        # (its radius 1.1: 47% of the hero's height)
EASE_IN = 0.04                       # the ease-in: 4% of the way to the ball
TILT_AT = (0.0, 0.16, 0.0)           # where the tilt ends looking: ~26.5 degrees down, the frame's bottom edge just on the desk's
                                     # front edge (steeper showed the void in front of it), the ball just clear of the top
JOIN = 170                           # the old tail's frame 171: its lid fully open (the opening is read from its frames 136-171)
BEATS = {"ease": (0, 39), "tilt": (39, 79), "glide": (79, 149), "tail": (149, 188)}
LID_SCROLL = (2.88, 3.2)              # the screens of scroll over which the lid opens (as before: the old glide's last 40%)
WAKE_SCROLL = 3.06                   # where the screen wakes (as before)
APPROACH = 0.25                      # metres: the last stretch arrives along the line of sight to the screen
AIM = 0.85                           # the share of the move over which the eye turns from the desk onto the screen
ROLL_FROM = 0.6                      # from here the orientation settles onto the last frame's own (its slight roll)


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a): return mul(a, 1.0 / math.sqrt(dot(a, a)))
def lerp(a, b, t): return add(a, mul(sub(b, a), t))
def smoother(t): t = min(max(t, 0.0), 1.0); return t * t * t * (t * (t * 6 - 15) + 10)
def smooth(t): t = min(max(t, 0.0), 1.0); return t * t * (3 - 2 * t)


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


SCROLL = {"glide": (2.4, 3.2), "tail": (3.2, 4.2)}   # the beats' screens of scroll (src/three/sand/story-timeline.ts BEATS)


def scroll_at(i, beats):
    """A frame's place in the scroll (screens), as the page maps them (story-timeline.ts shotFrame), from the glide on."""
    for k in ("glide", "tail"):
        f0, f1 = beats[k]
        if i <= f1:
            p0, p1 = SCROLL[k]
            return p0 + (p1 - p0) * (i - f0) / (f1 - f0)
    return SCROLL["tail"][1]


def bezier(p0, p1, p2, p3, t):
    a, b, c = lerp(p0, p1, t), lerp(p1, p2, t), lerp(p2, p3, t)
    return lerp(lerp(a, b, t), lerp(b, c, t), t)


def lid_at(tp, sp):
    """The lid's angle at a scroll position: the tail's own opening (its frames 136-171) over the same scroll as before."""
    x = (sp - LID_SCROLL[0]) / (LID_SCROLL[1] - LID_SCROLL[0])
    if x <= 0: return 0.0
    kf = 136 + (JOIN - 136) * min(x, 1.0)
    k0 = min(int(kf), JOIN - 1)
    return max(tp[k0]["lid_open_deg"] + (tp[k0 + 1]["lid_open_deg"] - tp[k0]["lid_open_deg"]) * (kf - k0), 0.0)


def build():
    th = json.load(open(THROUGH))
    tp = th["path"]
    e = tp[209]                                   # where it ends: the screen filling the frame (the approved last frame)
    e_pos, e_q, e_lens = tuple(e["position"]), tuple(e["quaternion"]), e["lens_mm"]
    sc = e["screen_corners"]
    screen = mul(add(add(sc[0], sc[1]), add(sc[2], sc[3])), 0.25)
    e_fwd = norm(sub(screen, e_pos))
    p1 = lerp(HERO_POS, BALL, EASE_IN)
    # one curve from the tilt's end into the screen: leaving toward the laptop, arriving along the line of sight to the
    # screen (its height only ever falls, it only ever goes forward: the control points sit in order between the ends)
    c2 = sub(e_pos, mul(e_fwd, APPROACH))
    c1 = lerp(p1, c2, 0.45)
    frames = []
    g0, g1 = BEATS["glide"][0], BEATS["tail"][1]
    for i in range(g1 + 1):
        lid = 0.0
        if i <= BEATS["ease"][1]:
            t = smoother(i / BEATS["ease"][1])
            pos, at, lens = lerp(HERO_POS, p1, t), HERO_AT, 45.0
        elif i <= BEATS["tilt"][1]:
            t = smoother((i - BEATS["tilt"][0]) / (BEATS["tilt"][1] - BEATS["tilt"][0]))
            pos, at, lens = p1, lerp(HERO_AT, TILT_AT, t), 45.0
        else:
            # eased once over the whole scroll from the desk to the screen (not per beat: one movement); a cubic ease: from
            # rest after the tilt, but under way at once (the quintic held it still for a third of a screen)
            sp = scroll_at(i, BEATS)
            u = smooth((sp - SCROLL["glide"][0]) / (SCROLL["tail"][1] - SCROLL["glide"][0]))
            pos = bezier(p1, c1, c2, e_pos, u)
            # the eye: from where the tilt left it, turning steadily onto the screen
            at = lerp(TILT_AT, screen, smoother(min(u / AIM, 1.0)))
            lens = 45.0 + (e_lens - 45.0) * u
            lid = lid_at(tp, sp)
        q = look_quat(pos, at)
        if i > g0:
            # (onto the approved last frame's own orientation, its slight roll included, over the approach)
            u = smooth((scroll_at(i, BEATS) - SCROLL["glide"][0]) / (SCROLL["tail"][1] - SCROLL["glide"][0]))
            q = slerp(q, e_q, smoother(max(u - ROLL_FROM, 0.0) / (1.0 - ROLL_FROM)))
        frames.append({"frame": i + 1, "position": list(pos), "quaternion": list(q), "lens_mm": lens, "sensor_mm": 36,
                       "lid_open_deg": lid, "focus_m": math.sqrt(dot(sub(at, pos), sub(at, pos)))})
    frames[-1].update(position=list(e_pos), quaternion=list(e_q), lens_mm=e_lens, lid_open_deg=e["lid_open_deg"])
    frame_of = lambda sp: next(i for i in range(g0, g1 + 1) if scroll_at(i, BEATS) >= sp)
    return {
        "move": "shot", "fps": 24, "frames": len(frames), "units": "metres", "up": "z",
        "chaos_center": th["chaos_center"], "chaos_scale": th["chaos_scale"], "plate_overscan": 1.0,
        "wake_frame": frame_of(WAKE_SCROLL) + 1, "screen_from": frame_of(LID_SCROLL[0]),
        "beats": {k: list(v) for k, v in BEATS.items()},
        "lights": json.load(open(PULLBACK))["lights"],
        "path": frames,
    }


def check(d):
    P = d["path"]
    assert d["frames"] == 189 and len(P) == 189, d["frames"]
    assert max(abs(a - b) for a, b in zip(P[0]["position"], HERO_POS)) < 1e-9, "starts on the hero framing"
    th = json.load(open(THROUGH))["path"]
    # it lands on the approved last frame: the screen filling it
    assert max(abs(a - b) for a, b in zip(P[188]["position"], th[209]["position"])) < 1e-9, "lands on the last frame"
    assert max(abs(a - b) for a, b in zip(P[188]["quaternion"], th[209]["quaternion"])) < 1e-9, "lands on the last frame"
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
    # one smooth movement from the table into the screen (Liam, 2026-10-12: "it aims at the sticky note … just go straight
    # into the computer. one smooth movement"): per screen of scroll, the camera's speed and its turn never jump from one
    # frame to the next, and from the tilt's end on it only ever turns toward the screen
    g0, end = d["beats"]["glide"][0], d["frames"] - 1
    sp, tu = [], []
    for i in range(g0, end):
        dp = scroll_at(i + 1, d["beats"]) - scroll_at(i, d["beats"])
        sp.append(math.sqrt(dot(sub(P[i + 1]["position"], P[i]["position"]), sub(P[i + 1]["position"], P[i]["position"]))) / dp)
        qa, qb = tuple(P[i]["quaternion"]), tuple(P[i + 1]["quaternion"])
        tu.append(2 * math.acos(min(1.0, abs(dot(qa, qb)))) / dp)
    top_s, top_t = max(sp), max(tu)
    for k in range(1, len(sp)):
        assert abs(sp[k] - sp[k - 1]) <= 0.12 * top_s, ("the speed jumps", g0 + k, round(sp[k - 1], 3), round(sp[k], 3))
        assert abs(tu[k] - tu[k - 1]) <= 0.12 * top_t, ("the turn jumps", g0 + k, round(tu[k - 1], 3), round(tu[k], 3))
    sc = json.load(open(THROUGH))["path"][209]["screen_corners"]
    screen = mul(add(add(sc[0], sc[1]), add(sc[2], sc[3])), 0.25)
    off = []
    for i in range(g0, end + 1):
        q, pos = tuple(P[i]["quaternion"]), tuple(P[i]["position"])
        f = rotate(q, (0.0, 0.0, -1.0))
        off.append(math.acos(max(-1.0, min(1.0, dot(f, norm(sub(screen, pos)))))))
    for k in range(1, len(off)):
        assert off[k] <= off[k - 1] + 0.004, ("turns away from the screen (the note)", g0 + k, round(math.degrees(off[k - 1]), 1), round(math.degrees(off[k]), 1))
    print("shot ok:", d["frames"], "frames; wake", d["wake_frame"], "; screen from", d["screen_from"])


if __name__ == "__main__":
    d = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(d, open(OUT, "w"))
    print("WROTE", OUT)
    if "--check" in sys.argv:
        check(d)
