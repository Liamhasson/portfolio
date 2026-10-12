import { expect, test } from "vitest";
import { ATTACK_REGIONS, attackPhoneLayout } from "./attack-phone";

const area = (r: { w: number; h: number }) => r.w * r.h;

test("on a phone the attack is redrawn as a phone would show it: the call above, its chat below, both inside the frame (Liam, 2026-10-13: the wide video was a strip with its chat a sliver)", () => {
  const box = { w: 340, h: 420 };
  const l = attackPhoneLayout(box.w, box.h)!;
  expect(l).not.toBeNull();
  for (const r of [l.call, l.chat]) {
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(box.w + 1e-6); expect(r.y + r.h).toBeLessThanOrEqual(box.h + 1e-6);
  }
  expect(l.chat.y).toBeGreaterThan(l.call.y + l.call.h - 1e-6);   // (below the call)
  // each keeps its own proportions
  expect(l.call.w / l.call.h).toBeCloseTo(ATTACK_REGIONS.call.w / ATTACK_REGIONS.call.h, 5);
  expect(l.chat.w / l.chat.h).toBeCloseTo(ATTACK_REGIONS.chat.w / ATTACK_REGIONS.chat.h, 5);
  // the chat (its text) at least twice the size it had in the whole video fitted to the box's width
  const plain = box.w / 1440;
  expect(l.chat.w).toBeGreaterThan(2 * ATTACK_REGIONS.chat.w * plain);
  expect(area(l.call) + area(l.chat)).toBeGreaterThan(0.6 * box.w * box.h);
});

test("on a wide frame (desktop, a landscape phone) the video stays as it is", () => {
  expect(attackPhoneLayout(1000, 460)).toBeNull();
  expect(attackPhoneLayout(800, 500)).toBeNull();
});
