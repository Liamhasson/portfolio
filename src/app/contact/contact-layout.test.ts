// src/app/contact/contact-layout.test.ts
import { describe, expect, test } from "vitest";
import { CONTACT_FRAME } from "@/three/sand/contact-view";
import { contactLayout, PORTRAIT } from "./contact-layout";

describe("contactLayout", () => {
  test("wide screens keep the approved framing, the words where the CSS puts them", () => {
    const l = contactLayout(1440, 900, 900, 200);
    expect([l.share, l.at, l.wordsTop]).toEqual([CONTACT_FRAME.share, CONTACT_FRAME.at, null]);
    expect(l.r).toBeCloseTo(135, 9);
  });

  test("upright with room: the approved framing as it was, the words in their own place", () => {
    const l = contactLayout(768, 1024, 1024, 200);
    expect([l.share, l.at, l.wordsTop]).toEqual([CONTACT_FRAME.share, CONTACT_FRAME.at, null]);
  });

  // an iPhone 13 Pro Max with Safari's toolbars showing (visible 428 x 746, the canvas the large viewport 926) and hidden,
  // an iPhone SE with its toolbars (375 x 548 / 667)
  for (const [name, w, h, H, wordsH] of [["13 Pro Max, toolbars", 428, 746, 926, 260], ["13 Pro Max", 428, 926, 926, 260], ["SE", 375, 548, 667, 280]] as const) {
    test(`upright (${name}): the ball its approved size wherever it fits, never under the words, all on screen`, () => {
      const l = contactLayout(w, h, H, wordsH);
      const top = l.wordsTop ?? h - PORTRAIT.foot * h - wordsH;
      expect(top - (l.cy + l.r)).toBeGreaterThanOrEqual(PORTRAIT.gapMin - 1e-9);
      expect(top + wordsH).toBeLessThanOrEqual(h - PORTRAIT.bottom + 1e-9);
      expect(l.share * H).toBeCloseTo(2 * l.r, 9);
      expect(l.at * H).toBeCloseTo(l.cy, 9);
      if (l.cy - l.r > PORTRAIT.top + 1e-6) expect(l.r).toBeCloseTo((CONTACT_FRAME.share * H) / 2, 9); // (its size kept)
      expect(l.cy).toBeLessThanOrEqual(CONTACT_FRAME.at * H + 1e-9); // (never lower than it was)
    });
  }

  test("the ball moves up only as far as the words need", () => {
    const l = contactLayout(428, 746, 926, 260);
    const gap = Math.max(PORTRAIT.gapMin, PORTRAIT.gap * 746);
    expect(l.wordsTop! + 260).toBeCloseTo(746 - PORTRAIT.bottom, 6);
    expect(l.wordsTop! - (l.cy + l.r)).toBeCloseTo(gap, 6);
  });
});
