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

  // an iPhone 13 Pro Max with Safari's toolbars showing (visible 428 x 746, the canvas the large viewport 926), an iPhone
  // SE the same (375 x 548 / 667), an upright iPad mini and iPad Pro
  for (const [name, w, h, H, wordsH] of [["13 Pro Max", 428, 746, 926, 230], ["SE", 375, 548, 667, 250], ["iPad mini", 768, 1024, 1024, 230], ["iPad Pro", 1024, 1366, 1366, 240]] as const) {
    test(`upright (${name}): the ball and the words one group, never touching, clear of the header and the foot`, () => {
      const l = contactLayout(w, h, H, wordsH);
      expect(l.wordsTop).not.toBeNull();
      const ballBottom = l.cy + l.r;
      expect(l.wordsTop! - ballBottom).toBeGreaterThanOrEqual(PORTRAIT.gapMin - 1e-9);
      expect(l.cy - l.r).toBeGreaterThanOrEqual(PORTRAIT.top - 1e-9);
      expect(l.wordsTop! + wordsH).toBeLessThanOrEqual(h - PORTRAIT.bottom + 1e-9);
      expect(2 * l.r).toBeLessThanOrEqual(PORTRAIT.ballW * w + 1e-9);
      // the framing the camera is given agrees with the ball on screen
      expect(l.share * H).toBeCloseTo(2 * l.r, 9);
      expect(l.at * H).toBeCloseTo(l.cy, 9);
    });
  }

  test("upright with room to spare: the group is centred in what is visible", () => {
    const l = contactLayout(768, 1024, 1024, 230);
    const top = l.cy - l.r, bottom = l.wordsTop! + 230;
    expect(top - 0).toBeCloseTo(1024 - bottom, 6);
  });
});
