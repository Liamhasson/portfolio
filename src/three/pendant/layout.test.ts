// src/three/pendant/layout.test.ts
import { describe, expect, it } from "vitest";
import type { Box } from "./camera";
import { clipBox, findSpot, freeSpot, hits, layerTimeline, padBox, placeBox, SAME, shownShare, type Probe, type Sample, type SpotLimits, type TextRect } from "./layout";

const box = (l: number, r: number, t = 100, b = 300): Box => ({ l, t, r, b });

describe("hits", () => {
  it("counts overlaps after shifting texts by s", () => {
    const texts: TextRect[] = [{ l: 2000, t: 150, w: 300, h: 40 }];
    const b = box(500, 600);
    expect(hits(b, texts, 0)).toBe(0);
    expect(hits(b, texts, 1450)).toBe(1); // text now at screen x 550–850
  });
  it("needs vertical overlap too: the track only moves sideways", () => {
    const texts: TextRect[] = [{ l: 500, t: 400, w: 300, h: 40 }];
    expect(hits(box(500, 600), texts, 0)).toBe(0);
  });
  it("treats touching edges as not overlapping", () => {
    const texts: TextRect[] = [{ l: 600, t: 150, w: 100, h: 40 }];
    expect(hits(box(500, 600), texts, 0)).toBe(0); // box.r === text left
    expect(hits(box(700, 800), texts, 0)).toBe(0); // box.l === text right
    expect(hits(box(500, 601), texts, 0)).toBe(1);
  });
  it("counts each text box once", () => {
    const texts: TextRect[] = [
      { l: 500, t: 150, w: 50, h: 20 },
      { l: 520, t: 200, w: 50, h: 20 },
      { l: 900, t: 150, w: 50, h: 20 },
    ];
    expect(hits(box(500, 600), texts, 0)).toBe(2);
  });
  it("counts a partly drawn box (a picture) only where it shows, and not at all when it is gone", () => {
    // a picture at track x 1000..1200, screen y 100..300: cut at screen x 60 as it leaves, risen to y 200 as it arrives
    const pic = (shown: TextRect["shown"]): TextRect[] => [{ l: 1000, t: 100, w: 200, h: 200, shown }];
    const seen: number[] = [];
    const cut = pic((s) => { seen.push(s); return { x: 60, y: 0 }; });
    expect(hits(box(0, 100), cut, 1000)).toBe(1); // (screen 0..200, showing from 60: the box 0..100 covers 60..100)
    expect(hits(box(0, 60), cut, 1000)).toBe(0); // (only the cut part)
    expect(seen).toEqual([1000, 1000]); // (asked at the travel tested)
    const rising = pic(() => ({ x: -Infinity, y: 200 }));
    expect(hits(box(0, 300, 100, 200), rising, 1000)).toBe(0); // (above where it has risen to)
    expect(hits(box(0, 300, 100, 201), rising, 1000)).toBe(1);
    expect(hits(box(0, 300), pic(() => null), 1000)).toBe(0); // (gone: nothing of it shows)
    expect(hits(box(0, 300), pic(() => ({ x: 500, y: 0 })), 1000)).toBe(0); // (cut past its right edge)
  });
});

// Samples every 10 px of travel. A "hitting" sample's box sits over a text; a clear sample's box is far from every text.
// hits() shifts texts by the sample's own s, so the text for a hitting sample at s has track x 1000 + s (screen 1000..1040).
const onText = box(1000, 1200);
const clear = box(0, 50);
const mk = (s: number, wanted: "front" | "back", hitting: boolean): Sample => ({ s, wanted, box: hitting ? onText : clear });
const hitTexts = (from: number, to: number): TextRect[] => {
  const out: TextRect[] = [];
  for (let s = from; s <= to; s += 10) out.push({ l: 1000 + s, t: 150, w: 40, h: 40 });
  return out;
};

describe("layerTimeline", () => {
  const samples = (wantedAt: (s: number) => "front" | "back", hitFrom: number, hitTo: number): Sample[] =>
    Array.from({ length: 31 }, (_, i) => i * 10).map((s) => mk(s, wantedAt(s), s >= hitFrom && s <= hitTo));

  it("forces back where front would cover words", () => {
    const tl = layerTimeline(samples(() => "front", 100, 200), hitTexts(100, 200));
    expect(tl(0)).toBe("front");
    expect(tl(50)).toBe("front");
    for (const s of [100, 120, 150, 200]) expect(tl(s)).toBe("back");
    expect(tl(250)).toBe("front");
  });

  it("only switches where the pendant covers no words", () => {
    // wanted flips front -> back at s 150, but the pendant covers words over 120..180
    const tl = layerTimeline(samples((s) => (s < 150 ? "front" : "back"), 120, 180), hitTexts(120, 180));
    expect(tl(110)).toBe("back"); // the nearest sample before 120 with no hit
    expect(tl(100)).toBe("front");
    expect(tl(90)).toBe("front");
    for (const s of [120, 150, 180, 300]) expect(tl(s)).toBe("back");
  });

  it("switches back to front only on a clear sample", () => {
    const tl = layerTimeline(samples((s) => (s < 100 ? "back" : "front"), 100, 130), hitTexts(100, 130));
    for (const s of [0, 50, 100, 130]) expect(tl(s)).toBe("back");
    expect(tl(140)).toBe("front");
  });

  it("follows the wanted layer when nothing is covered", () => {
    const tl = layerTimeline(samples((s) => (s < 150 ? "front" : "back"), 999, 999), []);
    expect(tl(140)).toBe("front");
    expect(tl(150)).toBe("back");
  });

  it("answers back when there is no clear sample to switch on (words covered from the very first sample)", () => {
    const tl = layerTimeline(samples(() => "front", 0, 60), hitTexts(0, 60));
    expect(tl(0)).toBe("back");
    expect(tl(60)).toBe("back");
    expect(tl(70)).toBe("front");
  });

  it("clamps outside the samples: before the first and after the last", () => {
    const tl = layerTimeline(samples((s) => (s < 150 ? "front" : "back"), 999, 999), []);
    expect(tl(-500)).toBe("front");
    expect(tl(99999)).toBe("back");
  });

  it("holds the previous sample's layer between samples", () => {
    const tl = layerTimeline(samples((s) => (s < 150 ? "front" : "back"), 999, 999), []);
    expect(tl(149.9)).toBe("front");
  });

  it("with no samples it answers back (the safe side)", () => {
    expect(layerTimeline([], [])(0)).toBe("back");
  });
});

describe("freeSpot", () => {
  const vw = 1000;
  const t: TextRect[] = [{ l: 400, t: 150, w: 100, h: 40 }]; // screen x 400..500
  it("returns 0 when the box is already free", () => {
    expect(freeSpot(box(600, 700), t, 0, vw, 0.25)).toBe(0);
  });
  it("finds the nearest free horizontal position", () => {
    const d = freeSpot(box(440, 540), t, 0, vw, 0.25); // right edge of text is 500: shift +60 px; left would need -140
    expect(d).not.toBeNull();
    expect(d as number).toBeCloseTo(0.06, 2);
  });
  it("goes left when that is nearer", () => {
    const d = freeSpot(box(360, 460), t, 0, vw, 0.25); // left: box.r <= 400 needs -60
    expect(d as number).toBeCloseTo(-0.06, 2);
  });
  it("prefers the positive shift at equal distance", () => {
    const d = freeSpot(box(400, 500), t, 0, vw, 0.25); // +100 px right or -100 px left
    expect(d as number).toBeCloseTo(0.1, 2);
  });
  it("accounts for the travel s", () => {
    const d = freeSpot(box(440, 540), [{ l: 1400, t: 150, w: 100, h: 40 }], 1000, vw, 0.25);
    expect(d as number).toBeCloseTo(0.06, 2);
  });
  it("returns null when nothing is free within maxShift", () => {
    expect(freeSpot(box(440, 540), t, 0, vw, 0.05)).toBeNull();
  });
});

// Task 8: the fixed site chrome (wordmark, pill nav, burger, resume pill, progress bar) holds still on screen while the
// track moves, so its boxes are screen px and never shift with s.
describe("fixed boxes (screen px, not moved by s)", () => {
  const nav: Box = { l: 1000, t: 40, r: 1300, b: 90 };
  it("hits counts a fixed box without the s shift", () => {
    const b = box(1200, 1400, 60, 200);
    expect(hits(b, [], 0, [nav])).toBe(1);
    expect(hits(b, [], 5000, [nav])).toBe(1); // still there however far the track has gone
    expect(hits(b, [{ l: 6200, t: 100, w: 100, h: 40 }], 5000, [nav])).toBe(2); // a text and the chrome
  });
  it("treats touching a fixed box's edge as not overlapping", () => {
    expect(hits(box(1300, 1400, 60, 200), [], 0, [nav])).toBe(0);
    expect(hits(box(1100, 1200, 90, 200), [], 0, [nav])).toBe(0);
  });
  it("defaults to no fixed boxes", () => {
    expect(hits(box(1200, 1400, 60, 200), [], 0)).toBe(0);
  });
  it("layerTimeline never puts the pendant in front over a fixed box", () => {
    const over = box(1200, 1400, 60, 200), free = box(0, 50);
    const samples: Sample[] = [0, 10, 20, 30, 40].map((s) => ({ s, wanted: "front", box: s === 20 || s === 30 ? over : free }));
    const tl = layerTimeline(samples, [], [nav]);
    expect(tl(0)).toBe("front");
    expect(tl(10)).toBe("back"); // (the switch lands on the clear sample before the chrome is reached)
    expect(tl(20)).toBe("back");
    expect(tl(30)).toBe("back");
    expect(tl(40)).toBe("front");
    expect(layerTimeline(samples, [])(20)).toBe("front"); // (without the chrome nothing is covered)
  });
  it("freeSpot moves the box off a fixed box", () => {
    const d = freeSpot(box(1250, 1350, 60, 200), [], 3000, 1000, 0.25, [nav]); // right: +50 px; left: -350 px
    expect(d as number).toBeCloseTo(0.05, 2);
    expect(freeSpot(box(1250, 1350, 60, 200), [], 0, 1000, 0.02, [nav])).toBeNull();
  });
});

// Task 8, fix round 1: the 2D search (sideways, up or down, smaller) used by the solver.
describe("findSpot", () => {
  const lim: SpotLimits = { vw: 1000, vh: 1000, maxX: 0.25, maxY: 0.2, minK: 0.7, edgeLoss: 0.25, minShown: 0.35 };
  // a 100 x 200 box centred at (500, 500), scaling about its centre, needing 10 px of clearance
  const probe = (over: Partial<Probe> = {}): Probe => ({ s: 0, box: { l: 450, t: 400, r: 550, b: 600 }, cx: 500, cy: 500, pad: 10, ...over });

  it("keeps the shot as written when it is clear", () => {
    expect(findSpot([probe()], [{ l: 700, t: 0, w: 100, h: 1000 }], [], lim)).toEqual(SAME);
  });
  it("counts the padding: a line 5 px away is too close", () => {
    const d = findSpot([probe()], [{ l: 555, t: 450, w: 100, h: 20 }], [], lim)!;
    expect(d).not.toEqual(SAME);
  });
  it("moves sideways when that is nearest", () => {
    // a short line under the right half: 50 px left (+10 pad) clears it, nothing vertical is as near
    const d = findSpot([probe()], [{ l: 520, t: 300, w: 100, h: 400 }], [], lim)!;
    expect(d.dy).toBe(0);
    expect(d.k).toBe(1);
    expect(d.dx).toBeCloseTo(-0.04, 5); // (box right 550 + 10 pad must be <= 520: -40 px; touching edges don't overlap)
  });
  it("moves down when a band across the whole screen blocks the top", () => {
    const band: TextRect = { l: -5000, t: 300, w: 20000, h: 120 }; // y 300..420: the box's top 400 (-10 pad) is in it
    const d = findSpot([probe()], [band], [], lim)!;
    expect(d.dx).toBe(0);
    expect(d.dy).toBeGreaterThan(0);
    expect(d.dy).toBeLessThanOrEqual(0.04);
  });
  it("shrinks when nothing nearer clears", () => {
    // walls left, right, above and below, each just inside the box's padded edge, and too wide or tall to move around
    const walls: TextRect[] = [
      { l: -5000, t: 380, w: 5445, h: 1000 }, { l: 555, t: 380, w: 5000, h: 1000 }, // x < 445 and x > 555, below y 380
      { l: -5000, t: -1000, w: 20000, h: 1380 }, // everything above y 380
      { l: -5000, t: 615, w: 20000, h: 1000 }, // everything below y 615
    ];
    const d = findSpot([probe()], walls, [], lim)!;
    expect(d).not.toBeNull();
    expect(d.k).toBeLessThan(1);
    expect(d.k).toBeGreaterThanOrEqual(0.7);
  });
  it("answers null when nothing within the limits is clear", () => {
    expect(findSpot([probe()], [{ l: -5000, t: -5000, w: 20000, h: 20000 }], [], lim)).toBeNull();
  });
  it("treats fixed boxes like lines and ignores s for them", () => {
    const d = findSpot([probe({ s: 3000 })], [], [{ l: 520, t: 300, r: 620, b: 700 }], lim)!;
    expect(d.dx).toBeCloseTo(-0.04, 5);
  });
  it("must clear every probe at once (a shot's whole rest window)", () => {
    // the same line seen at two travels: at s 0 it is right of the box, at s 100 it has moved 100 px left onto it
    const line: TextRect = { l: 600, t: 300, w: 300, h: 400 };
    expect(findSpot([probe()], [line], [], lim)).toEqual(SAME);
    const d = findSpot([probe(), probe({ s: 100 })], [line], [], lim)!;
    expect(d).not.toEqual(SAME);
    for (const s of [0, 100]) {
      const placed = placeBox(probe({ s }), d, 1000, 1000);
      expect(hits(padBox(placed, 10), [line], s)).toBe(0);
    }
  });
  it("never pushes the pendant off the screen: at least 35% stays on, and no more than a quarter more is lost", () => {
    // the box sits at the left edge, half on screen; a wall covers everything right of x 20 (even shrunk to 70% it needs
    // to move 25 px left, which leaves 14% of it on screen)
    const edge = probe({ box: { l: -50, t: 400, r: 50, b: 600 }, cx: 0 });
    const wall: TextRect = { l: 20, t: -5000, w: 20000, h: 20000 };
    expect(findSpot([edge], [wall], [], lim)).toBeNull(); // (only moving it off the screen to the left would clear it)
    const lax = findSpot([edge], [wall], [], { ...lim, minShown: 0, edgeLoss: 1 });
    expect(lax).not.toBeNull();
    expect(lax!.dx).toBeLessThan(0);
  });
});

describe("box helpers", () => {
  it("pads, clips and measures the on-screen share", () => {
    expect(padBox({ l: 10, t: 10, r: 20, b: 20 }, 5)).toEqual({ l: 5, t: 5, r: 25, b: 25 });
    expect(clipBox({ l: -10, t: 5, r: 10, b: 2000 }, 100, 100)).toEqual({ l: 0, t: 5, r: 10, b: 100 });
    expect(clipBox({ l: 200, t: 5, r: 300, b: 50 }, 100, 100).r > 0).toBe(false);
    expect(shownShare({ l: -50, t: 0, r: 50, b: 100 }, 100, 100)).toBeCloseTo(0.5, 9);
    expect(shownShare({ l: -150, t: 0, r: -50, b: 100 }, 100, 100)).toBe(0); // (wholly off screen: 0, not NaN)
  });
  it("places a box: scaled about the aim point, then moved", () => {
    const p: Probe = { s: 0, box: { l: 400, t: 400, r: 600, b: 600 }, cx: 500, cy: 500, pad: 0 };
    expect(placeBox(p, { dx: 0.1, dy: -0.1, k: 0.5 }, 1000, 1000)).toEqual({ l: 550, t: 350, r: 650, b: 450 });
  });
});
