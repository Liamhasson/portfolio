// src/three/pendant/layout.test.ts
import { describe, expect, it } from "vitest";
import type { Box } from "./camera";
import { freeSpot, hits, layerTimeline, type Sample, type TextRect } from "./layout";

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
